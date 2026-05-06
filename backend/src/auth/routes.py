from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import Annotated
import logging
import time
from collections import defaultdict
from src.utils.model_helpers import model_to_dict

from src.database.db import get_app_db
from src.database.models import User
from src.auth.auth import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    Token,
    UserCreate,
    UserResponse,
    authenticate_user,
    create_access_token,
    get_current_user,
    get_password_hash
)

# Strict rate limiter for auth endpoints: 10 attempts per minute per IP.
# Keyed by direct connection IP only — X-Forwarded-For is not trusted.
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

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

router = APIRouter(tags=["auth"])

# Login endpoint
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
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

# Registration endpoint
@router.post("/register", response_model=UserResponse)
async def register_user(
    user_data: UserCreate,
    db: Annotated[Session, Depends(get_app_db)],
    _: None = Depends(_check_auth_rate_limit),
):
    logger.info(f"Attempting to register user: {user_data.username}")
    try:
        # Check if username exists
        db_user = db.query(User).filter(User.username == user_data.username).first()
        if db_user:
            logger.warning(f"Username already registered: {user_data.username}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already registered"
            )
        
        # Check if email exists
        logger.debug(f"Checking for existing email: {user_data.email}")
        db_user = db.query(User).filter(User.email == user_data.email).first()
        if db_user:
            logger.warning(f"Email already registered: {user_data.email}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        
        # Create new user
        logger.debug(f"Attempting to create user object for: {user_data.username}")
        db_user = User(
            username=user_data.username,
            email=user_data.email,
            password_hash=get_password_hash(user_data.password)
        )
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        
        logger.info(f"User successfully created: {db_user.username} (ID: {db_user.id})")
        
        # Return user data in the format expected by UserResponse
        return {
            "id": db_user.id,
            "username": db_user.username,
            "email": db_user.email,
            "created_at": db_user.created_at
        }
        
    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        logger.error(f"Unexpected error during user registration for {user_data.username}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An internal error occurred during registration."
        )

@router.post("/logout")
async def logout():
    """Log out the current user (client-side only)"""
    # JWT tokens are stateless and can't be invalidated without extra infrastructure
    # We'll just return a success response for the frontend to clear the token
    return {"detail": "Successfully logged out"}

# User profile endpoint
@router.get("/me", response_model=UserResponse)
async def read_users_me(
    current_user: Annotated[User, Depends(get_current_user)]
):
    # Convert SQLAlchemy model to a dictionary
    user_dict = {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "created_at": current_user.created_at
    }
    return user_dict

