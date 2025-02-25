from fastapi import APIRouter
from src.auth.routes import router as auth_router

# Export the router to be used in main.py
router = auth_router