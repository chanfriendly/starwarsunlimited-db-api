# backend/src/routes/cards.py

from fastapi import APIRouter, Query, HTTPException, Depends
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import text, or_, desc, asc, func
from src.database.db import get_card_db
from src.database.models import Card, CardAspect
from src.utils.db_helpers import enrich_card_with_relationships, card_to_dict
import logging
import math

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/")
async def get_cards(
    db: Session = Depends(get_card_db),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    type: Optional[str] = None,
    not_type: Optional[str] = None,  # Add this for filtering out certain types
    aspect: Optional[str] = None,    # Will handle comma-separated values
    costMin: Optional[int] = Query(None, description="Minimum cost filter"),
    costMax: Optional[int] = Query(None, description="Maximum cost filter"),
    keyword: Optional[str] = Query(None, description="Filter by keywords (comma-separated)"),
    set: Optional[str] = Query(None, description="Filter by sets (comma-separated)"),
    sort: Optional[str] = None
):
    """Get cards with flexible filtering options."""
    try:
        # Initialize params dictionary and conditions list
        params = {}
        conditions = []
        
        if aspect:
            # Split aspect into list if comma-separated
            aspect_list = aspect.split(',') if ',' in aspect else [aspect]
            
            # Build dynamic IN clause with explicit parameter placeholders
            aspect_placeholders = []
            
            for i, asp in enumerate(aspect_list):
                param_name = f"aspect_{i}"
                params[param_name] = asp
                aspect_placeholders.append(f":{param_name}")
            
            # Join the placeholders with commas
            aspect_in_clause = ", ".join(aspect_placeholders)
            
            # Build the base SQL query
            base_sql = f"""
                SELECT c.* FROM cards c
                JOIN card_aspects ca ON c.id = ca.card_id
                WHERE ca.aspect_name IN ({aspect_in_clause})
            """
        else:
            # For non-aspect filtering, start with a simpler query
            base_sql = """
                SELECT c.* FROM cards c
                WHERE 1=1
            """
        
        # Add search filter
        if search:
            conditions.append("c.name LIKE :search")
            params["search"] = f"%{search}%"
        
        # Add type filter
        if type:
            # Handle multiple types (comma-separated)
            if ',' in type:
                type_list = type.split(',')
                type_conditions = []
                
                for i, t in enumerate(type_list):
                    param_name = f"type_{i}"
                    params[param_name] = t.strip()
                    type_conditions.append(f"c.type = :{param_name}")
                
                if type_conditions:
                    conditions.append(f"({' OR '.join(type_conditions)})")
            else:
                conditions.append("c.type = :type")
                params["type"] = type
        
        # Add not_type filter
        if not_type:
            not_type_list = not_type.split(',')
            for i, nt in enumerate(not_type_list):
                param_name = f"not_type_{i}"
                conditions.append(f"c.type != :{param_name}")
                params[param_name] = nt.strip()
        
        # Add cost filters
        if costMin is not None:
            conditions.append("c.energy_cost >= :cost_min")
            params["cost_min"] = costMin

        if costMax is not None:
            conditions.append("c.energy_cost <= :cost_max")
            params["cost_max"] = costMax
        
        # Add keyword filter
        if keyword:
            keyword_list = keyword.split(',')
            keyword_conditions = []
            
            for i, kw in enumerate(keyword_list):
                param_name = f"keyword_{i}"
                params[param_name] = kw.strip()
                keyword_conditions.append(f"c.id IN (SELECT card_id FROM card_keywords WHERE keyword = :{param_name})")
            
            if keyword_conditions:
                conditions.append(f"({' OR '.join(keyword_conditions)})")
        
        # Add set filter
        if set:
            set_list = set.split(',')
            set_conditions = []
            
            for i, s in enumerate(set_list):
                param_name = f"set_{i}"
                params[param_name] = s.strip()
                set_conditions.append(f"(c.set_code = :{param_name} OR c.set_name = :{param_name})")
            
            if set_conditions:
                conditions.append(f"({' OR '.join(set_conditions)})")
        
        # Add WHERE conditions if any
        if conditions:
            base_sql += " AND " + " AND ".join(conditions)
        
        # Add sorting
        if sort:
            # Simple sort handling - could be expanded
            if sort == "name":
                base_sql += " ORDER BY c.name ASC"
            elif sort == "cost":
                base_sql += " ORDER BY COALESCE(c.energy_cost, c.cost) ASC"
        else:
            # Default sort
            base_sql += " ORDER BY c.name ASC"
        
        # Count query for pagination
        count_sql = base_sql.replace("SELECT c.*", "SELECT COUNT(*)")
        count_sql = count_sql.split(" ORDER BY")[0]  # Remove ORDER BY for count
        
        # Execute count query
        count_result = db.execute(text(count_sql), params)
        total = count_result.scalar() or 0
        
        # Add pagination to base query
        base_sql += " LIMIT :limit OFFSET :offset"
        params["limit"] = limit
        params["offset"] = (page - 1) * limit
        
        # Execute main query
        logger.debug(f"Executing SQL: {base_sql}")
        logger.debug(f"With params: {params}")
        
        result = db.execute(text(base_sql), params)
        
        # Process results
        columns = result.keys()
        cards = []
        
        for row in result:
            # Convert row to dictionary
            card = {}
            for idx, col in enumerate(columns):
                if isinstance(row, tuple):
                    card[col] = row[idx]
                else:
                    # For SQLAlchemy Row objects
                    card[col] = row._mapping[col]
            
            # Add relationship data
            cards.append(enrich_card_with_relationships(db, card))
        
        # Return results with pagination info
        return {
            "data": cards,
            "meta": {
                "total": total,
                "page": page,
                "limit": limit,
                "pages": math.ceil(total / limit) if limit > 0 else 1
            }
        }
    except Exception as e:
        logger.error(f"Error in get_cards: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{card_id}")
async def get_card(card_id: str, db: Session = Depends(get_card_db)):
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