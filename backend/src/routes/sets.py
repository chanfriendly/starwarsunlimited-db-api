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
        query = text("""
            SELECT DISTINCT set_name, set_code
            FROM cards
            WHERE set_name IS NOT NULL
            ORDER BY set_name
        """)
        results = db.execute(query).fetchall()
        return [{"set_name": row[0], "set_code": row[1]} for row in results]
    except Exception as e:
        logger.error(f"Error getting sets: {str(e)}")
        raise