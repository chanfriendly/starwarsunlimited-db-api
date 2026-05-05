from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from src.database.db import get_card_db
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/")
async def get_traits(db: Session = Depends(get_card_db)):
    """Get all distinct traits from the database."""
    try:
        query = text("SELECT DISTINCT trait FROM card_traits WHERE trait IS NOT NULL ORDER BY trait")
        results = db.execute(query).fetchall()
        return [{"trait": row[0]} for row in results]
    except Exception as e:
        logger.error(f"Error getting traits: {str(e)}")
        raise
