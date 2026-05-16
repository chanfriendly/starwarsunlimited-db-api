import os
import time
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from collections import defaultdict
from datetime import timedelta
from typing import Annotated, Optional

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
    create_email_verification_token,
    consume_email_verification_token,
    create_password_reset_token,
    consume_password_reset_token,
    get_current_user,
    get_password_hash,
    revoke_user_tokens,
)

logger = logging.getLogger(__name__)


def _send_password_reset_email(to_email: str, token: str) -> bool:
    """
    Send a password reset email via Gmail SMTP.
    Requires env vars:
      SMTP_HOST     — e.g. smtp.gmail.com
      SMTP_PORT     — e.g. 587
      SMTP_USER     — Gmail address
      SMTP_PASSWORD — Gmail App Password (not your regular password)
      SMTP_FROM     — optional display name + address, defaults to SMTP_USER
      APP_BASE_URL  — e.g. https://twinsuns.chanfriendly.duckdns.org
    """
    smtp_user = os.environ.get("SMTP_USER")
    smtp_password = os.environ.get("SMTP_PASSWORD")
    if not smtp_user or not smtp_password:
        logger.warning("SMTP_USER or SMTP_PASSWORD not configured — skipping email send")
        return False

    smtp_host = os.environ.get("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.environ.get("SMTP_PORT", "587"))
    from_addr = os.environ.get("SMTP_FROM", smtp_user)
    base_url = os.environ.get("APP_BASE_URL", "http://localhost:3000").rstrip("/")
    reset_link = f"{base_url}/reset-password?token={token}"

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Twin Suns — Password Reset"
    msg["From"] = from_addr
    msg["To"] = to_email
    html = (
        f"<p>You requested a password reset for your Twin Suns account.</p>"
        f"<p><a href=\"{reset_link}\">Click here to reset your password</a></p>"
        f"<p>This link expires in 1 hour. If you didn't request this, ignore this email.</p>"
        f"<p style=\"font-size:11px;color:#888\">Or copy this URL: {reset_link}</p>"
    )
    msg.attach(MIMEText(html, "html"))

    try:
        with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
            server.ehlo()
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.sendmail(smtp_user, to_email, msg.as_string())
        return True
    except Exception as exc:
        logger.error("Failed to send password reset email: %s", exc)
        return False


def _send_verification_email(to_email: str, token: str) -> bool:
    """Send an email verification link. Uses the same SMTP config as password reset."""
    smtp_user = os.environ.get("SMTP_USER")
    smtp_password = os.environ.get("SMTP_PASSWORD")
    if not smtp_user or not smtp_password:
        logger.warning("SMTP not configured — skipping verification email")
        return False

    smtp_host = os.environ.get("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.environ.get("SMTP_PORT", "587"))
    from_addr = os.environ.get("SMTP_FROM", smtp_user)
    base_url = os.environ.get("APP_BASE_URL", "http://localhost:3000").rstrip("/")
    verify_link = f"{base_url}/verify-email?token={token}"

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Twin Suns — Verify your email"
    msg["From"] = from_addr
    msg["To"] = to_email
    html = (
        f"<p>Welcome to Twin Suns! Please verify your email address.</p>"
        f"<p><a href=\"{verify_link}\">Click here to verify your email</a></p>"
        f"<p>This link expires in 24 hours.</p>"
        f"<p style=\"font-size:11px;color:#888\">Or copy this URL: {verify_link}</p>"
    )
    msg.attach(MIMEText(html, "html"))

    try:
        with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
            server.ehlo()
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.sendmail(smtp_user, to_email, msg.as_string())
        return True
    except Exception as exc:
        logger.error("Failed to send verification email: %s", exc)
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
        email_verified=False,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    # Send verification email if address was provided
    verification_token = None
    if db_user.email:
        verification_token = create_email_verification_token(db, db_user)
        sent = _send_verification_email(db_user.email, verification_token)
        if not sent:
            # SMTP not configured — include token in response for dev
            logger.info("SMTP not configured; verification token for %s: %s", db_user.username, verification_token)

    response = {
        "id": db_user.id,
        "username": db_user.username,
        "email": db_user.email,
        "email_verified": db_user.email_verified,
        "created_at": db_user.created_at,
    }
    if verification_token:
        response["verification_token"] = verification_token
    return response


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
    return {"id": current_user.id, "username": current_user.username, "email": current_user.email, "avatar_url": current_user.avatar_url, "email_verified": current_user.email_verified or False, "created_at": current_user.created_at}


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


class VerifyEmailRequest(BaseModel):
    token: str

@router.post("/verify-email")
async def verify_email(
    body: VerifyEmailRequest,
    db: Annotated[Session, Depends(get_app_db)],
):
    success = consume_email_verification_token(db, body.token)
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired verification link")
    return {"detail": "Email verified. You can now log in."}


class ResendVerificationRequest(BaseModel):
    username: str

@router.post("/resend-verification")
async def resend_verification(
    body: ResendVerificationRequest,
    db: Annotated[Session, Depends(get_app_db)],
    _: None = Depends(_check_auth_rate_limit),
):
    """Re-send a verification email. Always returns 200 to avoid enumeration."""
    user = db.query(User).filter(User.username == body.username).first()
    if not user or not user.email or user.email_verified:
        return {"detail": "If that account exists and needs verification, a new link has been sent."}
    token = create_email_verification_token(db, user)
    _send_verification_email(user.email, token)
    return {"detail": "If that account exists and needs verification, a new link has been sent."}
