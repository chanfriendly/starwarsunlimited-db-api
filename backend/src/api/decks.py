from fastapi import APIRouter
from src.deck.routes import router as deck_router

# Export the router to be used in main.py
router = deck_router