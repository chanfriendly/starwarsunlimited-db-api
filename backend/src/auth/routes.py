from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import Annotated
import logging
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

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

router = APIRouter(tags=["auth"])

# Login endpoint
@router.post("/token", response_model=Token)
async def login_for_access_token(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Annotated[Session, Depends(get_app_db)]
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
    db: Annotated[Session, Depends(get_app_db)]
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

@router.get("/create-test-user")
async def create_test_user_endpoint(db: Annotated[Session, Depends(get_app_db)]):
    """Create a test user with known credentials"""
    from src.auth.auth import get_user, get_password_hash, UserCreate
    
    # Check if test user exists
    test_user = db.query(User).filter(User.username == "testuser").first()
    if not test_user:
        # Create a test user
        test_user = User(
            username="testuser",
            email="test@example.com",
            password_hash=get_password_hash("password123")
        )
        db.add(test_user)
        db.commit()
        db.refresh(test_user)
        return {"message": "Test user created", "username": "testuser"}
    return {"message": "Test user already exists", "username": "testuser"}

@router.get("/debug-login")
async def debug_login():
    """Debug login functionality with simple direct test"""
    from src.auth.auth import get_password_hash, verify_password
    
    # 1. Create a simple password hash
    test_password = "password123"
    password_hash = get_password_hash(test_password)
    
    # 2. Try to verify it immediately
    is_valid = verify_password(test_password, password_hash)
    
    return {
        "password": test_password,
        "hash": password_hash,
        "verification_result": is_valid,
        "message": "Password verification is working" if is_valid else "PASSWORD VERIFICATION IS BROKEN"
    }