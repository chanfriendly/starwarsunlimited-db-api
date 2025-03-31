# backend/src/routes/cards.py

from fastapi import APIRouter, Query, HTTPException, Depends
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import text, or_
from src.database.db import get_db
from src.database.models import Card, CardAspect
from src.utils.db_helpers import enrich_card_with_relationships, card_to_dict
import logging

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/")
async def get_cards(
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    type: Optional[str] = None,
    aspect: Optional[str] = None,
    sort: Optional[str] = None
):
    """Get cards with flexible filtering options."""
    try:
        # Complex case: Aspect filtering (uses raw SQL for better performance)
        if aspect:
            # Build the SQL query with proper parameters
            base_sql = """
                SELECT c.* FROM cards c
                JOIN card_aspects ca ON c.id = ca.card_id
                WHERE ca.aspect_name = :aspect
            """
            
            # Add additional filtering
            conditions = []
            params = {"aspect": aspect, "limit": limit, "offset": (page - 1) * limit}
            
            if search:
                conditions.append("c.name LIKE :search")
                params["search"] = f"%{search}%"
            
            if type:
                conditions.append("c.type = :type")
                params["type"] = type
                
            # Add WHERE conditions if any
            if conditions:
                base_sql += " AND " + " AND ".join(conditions)
                
            # Add sorting
            if sort:
                # Simple sort handling - could be expanded
                if sort == "name":
                    base_sql += " ORDER BY c.name ASC"
                elif sort == "cost":
                    base_sql += " ORDER BY c.energy_cost ASC"  # Fixed: energy_cost not cost
            else:
                # Default sort
                base_sql += " ORDER BY c.name ASC"
                
            # Add pagination
            base_sql += " LIMIT :limit OFFSET :offset"
            
            # Execute query
            sql = text(base_sql)
            result = db.execute(sql, params)
            
            # Process results
            columns = result.keys()
            cards = []
            for row in result:
                # Convert row to dictionary
                card = {}
                for idx, col in enumerate(columns):
                    card[col] = row[idx]
                    
                # Add relationship data
                cards.append(enrich_card_with_relationships(db, card))
                
            # Get total count for pagination
            count_sql = """
                SELECT COUNT(*) FROM cards c
                JOIN card_aspects ca ON c.id = ca.card_id
                WHERE ca.aspect_name = :aspect
            """
            
            # Add additional filtering for count query
            if conditions:
                count_sql += " AND " + " AND ".join(conditions)
                
            # Execute count query
            count_params = {k: v for k, v in params.items() if k not in ["limit", "offset"]}
            count_result = db.execute(text(count_sql), count_params)
            total = count_result.scalar()
            
        # Simple case: Use ORM for basic filtering
        else:
            # Start with base query
            query = db.query(Card)
            
            # Apply filters
            if search:
                # Search in name with case-insensitive match
                query = query.filter(Card.name.ilike(f"%{search}%"))
                
            if type:
                query = query.filter(Card.type == type)
                
            # Add sorting
            if sort:
                if sort == "name":
                    query = query.order_by(Card.name)
                elif sort == "cost":
                    query = query.order_by(Card.energy_cost)  # Fixed: energy_cost not cost
            else:
                # Default sort
                query = query.order_by(Card.name)
                
            # Get total count before pagination
            total = query.count()
            
            # Apply pagination
            cards = query.offset((page - 1) * limit).limit(limit).all()
            
            # Convert to dictionaries with relationships
            cards = [card_to_dict(card) for card in cards]
            
        # Return results with pagination info
        return {
            "cards": cards,
            "total": total,
            "page": page,
            "limit": limit,
            "has_next": page * limit < total,
            "has_prev": page > 1
        }
        
    except Exception as e:
        logger.error(f"Error in get_cards: {str(e)}", exc_info=True)
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{card_id}")
async def get_card(card_id: str, db: Session = Depends(get_db)):
    """Get a single card by ID."""
    try:
        # Use ORM for simple lookup by ID
        card = db.query(Card).filter(Card.id == card_id).first()
        
        if not card:
            raise HTTPException(status_code=404, detail="Card not found")
            
        # Convert to dictionary with relationships
        return card_to_dict(card)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_card: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))