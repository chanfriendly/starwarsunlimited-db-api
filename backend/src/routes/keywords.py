from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from src.database.db import get_card_db
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/")
async def get_keywords(db: Session = Depends(get_card_db)):
    """Get all distinct keywords from the database."""
    try:
        # Query for unique keywords
        query = text("SELECT DISTINCT keyword FROM card_keywords ORDER BY keyword")
        results = db.execute(query).fetchall()
        
        # Convert to list
        keywords = [row[0] for row in results]
        return keywords
    except Exception as e:
        logger.error(f"Error getting keywords: {str(e)}")
        raise