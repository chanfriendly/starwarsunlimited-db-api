import time
import logging
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
    create_password_reset_token,
    consume_password_reset_token,
    get_current_user,
    get_password_hash,
    revoke_user_tokens,
)

logger = logging.getLogger(__name__)

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
    Create a password-reset token. Returns the token directly for now —
    wire up email delivery by sending the token to user.email instead of
    returning it in the response body.
    """
    token = create_password_reset_token(db, body.username)
    # Always return 200 to avoid username enumeration
    if token is None:
        return {"detail": "If that username exists, a reset token has been issued."}
    # TODO: email the token instead of returning it once SMTP is configured
    return {"detail": "If that username exists, a reset token has been issued.", "reset_token": token}


@router.post("/password-reset-confirm")
async def password_reset_confirm(
    body: PasswordResetConfirm,
    db: Annotated[Session, Depends(get_app_db)],
):
    success = consume_password_reset_token(db, body.token, body.new_password)
    if not success:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token")
    return {"detail": "Password updated. Please log in again."}
