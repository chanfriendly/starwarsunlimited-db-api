from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import Annotated
import logging

from src.database.db import get_app_db
from src.database.models import User
from src.auth.auth import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    Token,
    UserCreate,
    UserResponse,
    authenticate_user,
    create_access_token,
    create_user,
    get_current_user
)
import logging

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG) # Be explicit if needed
# Ensure propagation or add a handler if necessary

router = APIRouter(tags=["auth"])

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

logger = logging.getLogger(__name__)

@router.post("/register", response_model=UserResponse)
async def register_user(
    user_data: UserCreate,
    db: Annotated[Session, Depends(get_app_db)] # <--- Use app DB
):
    logger.info(f"Attempting to register user: {user_data.username}")
    try:
        # This query now runs against swu_app.db
        db_user = db.query(User).filter(User.username == user_data.username).first()
        if db_user:
            logger.warning(f"Username already registered: {user_data.username}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already registered"
            )

        # Check if email already exists
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
        # Make sure the create_user function itself is robust
        created_user = create_user(db, user_data)
        logger.info(f"User successfully created: {created_user.username} (ID: {created_user.id})") # Log success
        return created_user

    except HTTPException as http_exc:
         # Re-raise HTTPExceptions (like 400 Bad Request) so FastAPI handles them
        raise http_exc
    except Exception as e:
        # Log the unexpected error
        logger.error(f"Unexpected error during user registration for {user_data.username}: {str(e)}", exc_info=True) # Log full traceback
        # Return a generic 500 error
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An internal error occurred during registration."
        )

@router.get("/me", response_model=UserResponse)
async def read_users_me(
    current_user: Annotated[User, Depends(get_current_user)] # get_current_user needs app_db
):
    return current_user
