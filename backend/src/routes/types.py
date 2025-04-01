from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from src.database.db import get_app_db
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/")
async def get_types(db: Session = Depends(get_app_db)):
    """Get all distinct card types from the database."""
    try:
        # Query for unique types
        query = text("SELECT DISTINCT type FROM cards WHERE type IS NOT NULL ORDER BY type")
        results = db.execute(query).fetchall()
        
        # Convert to list
        types = [row[0] for row in results]
        return types
    except Exception as e:
        logger.error(f"Error getting types: {str(e)}")
        raise