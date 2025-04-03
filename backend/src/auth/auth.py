from datetime import datetime, timedelta
from typing import Annotated, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session
from pydantic import BaseModel, ConfigDict
import logging
import os
from dotenv import load_dotenv
from pydantic import BaseModel, Field, EmailStr, validator
import re

logger = logging.getLogger(__name__)

from src.database.models import User
from src.database.db import get_app_db

# Configuration from environment variables
SECRET_KEY = os.getenv("JWT_SECRET", "09d25e094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "10080"))

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# OAuth2 setup
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")  # Add leading slash

# Pydantic models
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, 
                         pattern=r'^[a-zA-Z0-9_]+$')
    email: EmailStr = Field(...)
    password: str = Field(..., min_length=8, max_length=100)
    
    @validator('username')
    def validate_username(cls, v):
        # Additional validation beyond regex pattern
        if not re.match(r'^[a-zA-Z0-9_]+$', v):
            raise ValueError('Username must contain only alphanumeric characters and underscores')
        return v
        
    @validator('password')
    def validate_password(cls, v):
        # Check for password strength
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
            
        # Check for at least one number
        if not any(c.isdigit() for c in v):
            raise ValueError('Password must contain at least one number')
            
        # Check for at least one letter
        if not any(c.isalpha() for c in v):
            raise ValueError('Password must contain at least one letter')
            
        return v

class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    created_at: datetime

# Load environment variables
load_dotenv()

# Helper functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_user(db: Session, username: str):
    return db.query(User).filter(User.username == username).first()

def authenticate_user(db: Session, username: str, password: str):
    import logging
    logger = logging.getLogger(__name__)
    
    logger.debug(f"Attempting to authenticate user: {username}")
    user = get_user(db, username)
    
    if not user:
        logger.debug(f"User '{username}' not found in database")
        return False
    
    logger.debug(f"Found user {username}, verifying password")
    
    # Log password hash for debugging (hash is safe to log)
    logger.debug(f"Stored password hash: {user.password_hash[:10]}...")
    
    # Verify password
    is_valid = verify_password(password, user.password_hash)
    logger.debug(f"Password verification result: {is_valid}")
    
    if not is_valid:
        return False
    
    return user

async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Annotated[Session, Depends(get_app_db)]
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        # Log token info for debugging (not the full token)
        logger.debug(f"Processing token (first 10 chars): {token[:10]}...")
        
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        
        if username is None:
            logger.warn("Token payload missing 'sub' field")
            raise credentials_exception
            
        logger.debug(f"Token contains username: {username}")
        token_data = TokenData(username=username)
    except JWTError as e:
        logger.error(f"JWT error: {str(e)}")
        raise credentials_exception
        
    user = get_user(db, username=token_data.username)
    
    if user is None:
        logger.warn(f"User not found for username: {token_data.username}")
        raise credentials_exception
        
    logger.debug(f"Successfully authenticated user: {user.username}")
    return user

def create_user(db: Session, user_data: UserCreate):
    db_user = User(
        username=user_data.username,
        email=user_data.email,
        password_hash=get_password_hash(user_data.password)
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    # Convert to dictionary that matches UserResponse model
    user_dict = {
        "id": db_user.id,
        "username": db_user.username,
        "email": db_user.email,
        "created_at": db_user.created_at
    }
    return user_dict

# Simple test user 
def create_test_user(db: Session):
    # Check if test user exists
    test_user = get_user(db, "testuser")
    if not test_user:
        # Create a test user with a simple password
        user_data = UserCreate(
            username="testuser",
            email="test@example.com",
            password="password123"
        )
        return create_user(db, user_data)
    return test_user