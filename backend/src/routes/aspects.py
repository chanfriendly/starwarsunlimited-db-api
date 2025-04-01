from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from src.database.db import get_card_db
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/")
async def get_aspects(db: Session = Depends(get_card_db)):
    """Get all distinct aspects from the database."""
    try:
        # Query for unique aspects with their colors
        query = text("SELECT DISTINCT aspect_name, aspect_color FROM card_aspects ORDER BY aspect_name")
        results = db.execute(query).fetchall()
        
        # Convert to list of dictionaries
        aspects = [{"aspect_name": row[0], "aspect_color": row[1]} for row in results]
        return aspects
    except Exception as e:
        logger.error(f"Error getting aspects: {str(e)}")
        raise