# backend/src/routes/stats.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from src.database.db import get_card_db
import logging

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/")
async def get_stats(db: Session = Depends(get_card_db)):
    """Get card database statistics.
    
    Uses raw SQL for complex aggregations and analytics.
    """
    try:
        # Get total cards count
        total_cards_sql = text("SELECT COUNT(*) FROM cards")
        total_cards = db.execute(total_cards_sql).scalar()
        
        # Get unique aspects count
        aspects_count_sql = text("SELECT COUNT(DISTINCT aspect_name) FROM card_aspects")
        aspects_count = db.execute(aspects_count_sql).scalar()
        
        # Get card type distribution
        type_distribution_sql = text("""
            SELECT type, COUNT(*) as count 
            FROM cards 
            GROUP BY type 
            ORDER BY count DESC
        """)
        type_distribution = db.execute(type_distribution_sql).fetchall()
        type_stats = [{"type": t[0], "count": t[1]} for t in type_distribution]
        
        # Get aspect distribution
        aspect_distribution_sql = text("""
            SELECT aspect_name, COUNT(*) as count, aspect_color
            FROM card_aspects
            GROUP BY aspect_name
            ORDER BY count DESC
        """)
        aspect_distribution = db.execute(aspect_distribution_sql).fetchall()
        aspect_stats = [
            {"aspect": a[0], "count": a[1], "color": a[2]} 
            for a in aspect_distribution
        ]
        
        # Get rarity distribution
        rarity_distribution_sql = text("""
            SELECT rarity, COUNT(*) as count
            FROM cards
            WHERE rarity IS NOT NULL
            GROUP BY rarity
            ORDER BY count DESC
        """)
        rarity_distribution = db.execute(rarity_distribution_sql).fetchall()
        rarity_stats = [
            {"rarity": r[0], "count": r[1]} 
            for r in rarity_distribution
        ]
        
        # Get sets information
        sets_sql = text("""
            SELECT set_name, COUNT(*) as card_count
            FROM cards
            WHERE set_name IS NOT NULL
            GROUP BY set_name
            ORDER BY card_count DESC
        """)
        sets_data = db.execute(sets_sql).fetchall()
        sets_stats = [
            {"set": s[0], "card_count": s[1]} 
            for s in sets_data
        ]
        
        return {
            "total_cards": total_cards,
            "aspects_count": aspects_count,
            "type_distribution": type_stats,
            "aspect_distribution": aspect_stats,
            "rarity_distribution": rarity_stats,
            "sets": sets_stats
        }
        
    except Exception as e:
        logger.error(f"Error in get_stats: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))