# Corrected version of backend/src/api/main.py
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import sqlite3
import os
import logging
from typing import Optional

# Import routers
from src.routes import auth
from src.routes import cards
from src.routes import decks
from src.routes import stats
from src.utils.vector_db import VectorDB

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Star Wars Unlimited API")

# Configure CORS
origins = [
    "http://localhost:3000",  # Frontend in development
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize vector database
vector_db = VectorDB()

# Include routers with proper error handling
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
if hasattr(cards, 'router'):
    app.include_router(cards.router, prefix="/api/cards", tags=["cards"])
if hasattr(decks, 'router'):
    app.include_router(decks.router, prefix="/api/decks", tags=["decks"])
if hasattr(stats, 'router'):
    app.include_router(stats.router, prefix="/api/stats", tags=["stats"])

# Database connection function
def get_db():
    # Use the database in the user's home directory
    home_dir = os.path.expanduser("~")
    db_path = os.path.join(home_dir, '.swu', 'swu_cards.db')
    
    logger.debug(f"Attempting to connect to database at: {db_path}")
    
    if not os.path.exists(db_path):
        logger.error(f"Database not found at {db_path}")
        raise HTTPException(
            status_code=500, 
            detail=f"Database not found at {db_path}. Please run build_database.py first."
        )
    
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        logger.debug("Successfully connected to database")
        yield conn
        conn.close()
    except sqlite3.Error as e:
        logger.error(f"Database error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Database error: {str(e)}"
        )

@app.get("/")
async def root():
    return {"message": "Star Wars Unlimited API is running"}