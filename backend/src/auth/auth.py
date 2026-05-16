import os
import re
import uuid
import logging
from datetime import datetime, timedelta
from typing import Annotated, Optional

from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, Field, EmailStr, validator
from sqlalchemy.orm import Session

load_dotenv()

logger = logging.getLogger(__name__)

from src.database.models import User, PasswordResetToken
from src.database.db import get_app_db

SECRET_KEY = os.getenv("JWT_SECRET", "09d25e094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))  # 24h default

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")


# ── Pydantic models ──────────────────────────────────────────────────────────

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=32, pattern=r'^[a-zA-Z0-9_]+$')
    email: Optional[EmailStr] = None
    password: str = Field(..., min_length=8, max_length=100)

    @validator('password')
    def validate_password(cls, v):
        if not any(c.isdigit() for c in v):
            raise ValueError('Password must contain at least one number')
        if not any(c.isalpha() for c in v):
            raise ValueError('Password must contain at least one letter')
        return v

class UserResponse(BaseModel):
    id: str
    username: str
    email: Optional[str] = None
    created_at: datetime


# ── Core helpers ─────────────────────────────────────────────────────────────

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def get_user(db: Session, username: str) -> Optional[User]:
    return db.query(User).filter(User.username == username).first()

def authenticate_user(db: Session, username: str, password: str):
    user = get_user(db, username)
    if not user or not verify_password(password, user.password_hash):
        return False
    return user

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire, "jti": str(uuid.uuid4())})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def revoke_user_tokens(db: Session, user: User) -> None:
    """Invalidate all existing tokens for a user by bumping token_version."""
    user.token_version = (user.token_version or 0) + 1
    db.commit()


# ── FastAPI dependency ───────────────────────────────────────────────────────

async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Annotated[Session, Depends(get_app_db)]
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username)
    except JWTError:
        raise credentials_exception

    user = get_user(db, username=token_data.username)
    if user is None:
        raise credentials_exception

    # Check token_version — if bumped since this token was issued, it's revoked
    token_version_claim = payload.get("tv", 0)
    if token_version_claim != (user.token_version or 0):
        raise credentials_exception

    return user


# ── User creation ────────────────────────────────────────────────────────────

def create_user(db: Session, user_data: UserCreate) -> dict:
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


# ── Password reset ───────────────────────────────────────────────────────────

PASSWORD_RESET_EXPIRY_MINUTES = 60

def create_password_reset_token(db: Session, username: str) -> Optional[str]:
    """Create a one-time reset token for username. Returns token string or None if user not found."""
    user = get_user(db, username)
    if not user:
        return None
    token_str = str(uuid.uuid4())
    db.add(PasswordResetToken(
        token=token_str,
        user_id=user.id,
        expires_at=datetime.utcnow() + timedelta(minutes=PASSWORD_RESET_EXPIRY_MINUTES),
        used=False,
    ))
    db.commit()
    return token_str

def consume_password_reset_token(db: Session, token_str: str, new_password: str) -> bool:
    """Validate token, update password, revoke all existing JWTs. Returns True on success."""
    record = db.query(PasswordResetToken).filter(
        PasswordResetToken.token == token_str,
        PasswordResetToken.used == False,
    ).first()
    if not record:
        return False
    if datetime.utcnow() > record.expires_at:
        return False
    user = db.query(User).filter(User.id == record.user_id).first()
    if not user:
        return False
    user.password_hash = get_password_hash(new_password)
    user.token_version = (user.token_version or 0) + 1
    record.used = True
    db.commit()
    return True
