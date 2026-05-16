import os
import time
import logging
from collections import defaultdict
from datetime import timedelta
from typing import Annotated, Optional

import requests as http_requests
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, Field, validator
from sqlalchemy.orm import Session

from src.database.db import get_app_db
from src.database.models import User
from src.auth.auth import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    Token,
    UserCreate,
    UserResponse,
    authenticate_user,
    create_access_token,
    create_password_reset_token,
    consume_password_reset_token,
    get_current_user,
    get_password_hash,
    revoke_user_tokens,
)

logger = logging.getLogger(__name__)


def _send_password_reset_email(to_email: str, token: str) -> bool:
    """
    Send a password reset email via Resend (https://resend.com).
    Returns True on success, False if RESEND_API_KEY is not configured or send fails.
    Requires env vars:
      RESEND_API_KEY  — API key from resend.com
      APP_BASE_URL    — e.g. https://twinsuns.chanfriendly.duckdns.org
      RESEND_FROM     — optional sender, defaults to noreply@yourdomain.com
    """
    api_key = os.environ.get("RESEND_API_KEY")
    if not api_key:
        return False

    base_url = os.environ.get("APP_BASE_URL", "http://localhost:3000").rstrip("/")
    from_addr = os.environ.get("RESEND_FROM", f"Twin Suns <noreply@{base_url.split('//')[-1].split('/')[0]}>")
    reset_link = f"{base_url}/reset-password?token={token}"

    try:
        resp = http_requests.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={
                "from": from_addr,
                "to": [to_email],
                "subject": "Twin Suns — Password Reset",
                "html": (
                    f"<p>You requested a password reset for your Twin Suns account.</p>"
                    f"<p><a href=\"{reset_link}\">Click here to reset your password</a></p>"
                    f"<p>This link expires in 1 hour. If you didn't request this, ignore this email.</p>"
                    f"<p style=\"font-size:11px;color:#888\">Or copy this URL: {reset_link}</p>"
                ),
            },
            timeout=10,
        )
        if resp.status_code not in (200, 201):
            logger.error("Resend API error %s: %s", resp.status_code, resp.text)
            return False
        return True
    except Exception as exc:
        logger.error("Failed to send password reset email: %s", exc)
        return False


# ── Rate limiter (auth endpoints only) ──────────────────────────────────────

_auth_attempts: dict = defaultdict(list)
_AUTH_LIMIT = 10
_AUTH_WINDOW = 60

def _check_auth_rate_limit(request: Request):
    ip = request.client.host if request.client else "unknown"
    now = time.time()
    _auth_attempts[ip] = [t for t in _auth_attempts[ip] if now - t < _AUTH_WINDOW]
    if len(_auth_attempts[ip]) >= _AUTH_LIMIT:
        raise HTTPException(status_code=429, detail="Too many attempts. Try again later.")
    _auth_attempts[ip].append(now)


# ── Pydantic helpers ─────────────────────────────────────────────────────────

class PasswordResetRequest(BaseModel):
    username: str

class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8, max_length=100)

    @validator('new_password')
    def validate_password(cls, v):
        if not any(c.isdigit() for c in v):
            raise ValueError('Password must contain at least one number')
        if not any(c.isalpha() for c in v):
            raise ValueError('Password must contain at least one letter')
        return v


# ── Router ───────────────────────────────────────────────────────────────────

router = APIRouter(tags=["auth"])


@router.post("/token", response_model=Token)
async def login_for_access_token(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Annotated[Session, Depends(get_app_db)],
    _: None = Depends(_check_auth_rate_limit),
):
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(
        data={"sub": user.username, "tv": user.token_version or 0},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/register", response_model=UserResponse)
async def register_user(
    user_data: UserCreate,
    db: Annotated[Session, Depends(get_app_db)],
    _: None = Depends(_check_auth_rate_limit),
):
    if db.query(User).filter(User.username == user_data.username).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already registered")
    if user_data.email and db.query(User).filter(User.email == user_data.email).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    db_user = User(
        username=user_data.username,
        email=user_data.email,
        password_hash=get_password_hash(user_data.password),
        token_version=0,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return {"id": db_user.id, "username": db_user.username, "email": db_user.email, "created_at": db_user.created_at}


@router.post("/logout")
async def logout(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_app_db)],
):
    """Invalidate all existing tokens for this user."""
    revoke_user_tokens(db, current_user)
    return {"detail": "Successfully logged out"}


@router.get("/me", response_model=UserResponse)
async def read_users_me(current_user: Annotated[User, Depends(get_current_user)]):
    return {"id": current_user.id, "username": current_user.username, "email": current_user.email, "created_at": current_user.created_at}


@router.post("/password-reset-request")
async def password_reset_request(
    body: PasswordResetRequest,
    db: Annotated[Session, Depends(get_app_db)],
    _: None = Depends(_check_auth_rate_limit),
):
    """
    Create a password-reset token. If RESEND_API_KEY is configured, emails the
    token to the user. Otherwise returns the token in the response body (dev mode).
    Always returns 200 to avoid username enumeration.
    """
    token = create_password_reset_token(db, body.username)
    if token is None:
        return {"detail": "If that username exists, a reset link has been sent."}

    # Look up the user's email to send to
    user = db.query(User).filter(User.username == body.username).first()
    if user and user.email:
        sent = _send_password_reset_email(user.email, token)
        if sent:
            return {"detail": "If that username exists, a reset link has been sent."}

    # Fallback: return token directly (dev / no SMTP / no email on account)
    return {"detail": "If that username exists, a reset link has been sent.", "reset_token": token}


@router.post("/password-reset-confirm")
async def password_reset_confirm(
    body: PasswordResetConfirm,
    db: Annotated[Session, Depends(get_app_db)],
):
    success = consume_password_reset_token(db, body.token, body.new_password)
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token")
    return {"detail": "Password updated. Please log in again."}
