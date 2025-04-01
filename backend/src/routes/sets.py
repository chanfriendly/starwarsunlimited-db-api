from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from src.database.db import get_card_db
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/")
async def get_sets(db: Session = Depends(get_card_db)):
    """Get all distinct card sets from the database."""
    try:
        # Query for unique sets
        query = text("""
            SELECT DISTINCT COALESCE(set_code, set_name) as set_identifier 
            FROM cards 
            WHERE set_code IS NOT NULL OR set_name IS NOT NULL 
            ORDER BY set_identifier
        """)
        results = db.execute(query).fetchall()
        
        # Convert to list
        sets = [row[0] for row in results]
        return sets
    except Exception as e:
        logger.error(f"Error getting sets: {str(e)}")
        raise