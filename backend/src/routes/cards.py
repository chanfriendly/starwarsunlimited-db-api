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

def group_cards_by_identity(cards):
    """
    Group cards by a composite key of name, subtitle, type, and traits.
    
    Cards with the same name, subtitle, type, and traits are considered variants 
    of the same card (e.g., different set reprints) and will be grouped together 
    with the first card as primary and others as alternate_arts.
    
    Args:
        cards: List of card dictionaries from database
        
    Returns:
        List of cards with alternate_arts populated for variants
    """
    logger.info(f"Starting card grouping for {len(cards)} cards.")
    grouped = {}
    
    for card in cards:
        # Ensure traits are a sorted tuple for consistent hashing
        traits = tuple(sorted(card.get('traits', [])))
        
        # Create a composite key that uniquely identifies the card
        grouping_key = (
            card.get('name'),
            card.get('subtitle'),
            card.get('type'),
            traits
        )

        if grouping_key not in grouped:
            # First time seeing this card - make it the primary
            card['alternate_arts'] = []
            grouped[grouping_key] = card
        else:
            # This is a variant of an existing card
            primary_card = grouped[grouping_key]
            
            # Create alternate art info with relevant fields
            alternate_art_info = {
                "id": card.get('id'),
                "image_uri": card.get('image_uri'),
                "image_url": card.get('image_url'),
                "set_name": card.get('set_name'),
                "set_code": card.get('set_code'),
                "card_number": card.get('card_number'),
                "rarity": card.get('rarity'),
                "artist": card.get('artist'),
            }
            
            # Add to primary card's alternate arts
            primary_card['alternate_arts'].append(alternate_art_info)

    final_list = list(grouped.values())
    logger.info(f"Finished grouping. Result contains {len(final_list)} unique cards.")
    
    return final_list

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
    trait: Optional[str] = Query(None, description="Filter by traits (comma-separated)"),
    sort: Optional[str] = None,
    structured: Optional[bool] = None # Added to acknowledge frontend parameter
):
    """Get cards with flexible filtering options."""
    logger.info(f"Starting get_cards request with page={page}, limit={limit}, search={search}, type={type}, aspect={aspect}, costMin={costMin}, costMax={costMax}")
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
        
         # Add cost filters - FIXED: Only use energy_cost column
        if costMin is not None:
            conditions.append("c.energy_cost >= :cost_min")
            params["cost_min"] = int(costMin)

        if costMax is not None:
            conditions.append("c.energy_cost <= :cost_max")
            params["cost_max"] = int(costMax)

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
        
        # Add trait filter
        if trait:
            trait_list = trait.split(',')
            trait_conditions = []
            for i, tr in enumerate(trait_list):
                param_name = f"trait_{i}"
                params[param_name] = tr.strip()
                trait_conditions.append(f"c.id IN (SELECT card_id FROM card_traits WHERE trait = :{param_name})")
            if trait_conditions:
                conditions.append(f"({' OR '.join(trait_conditions)})")

        # Add WHERE conditions if any
        if conditions:
            base_sql += " AND " + " AND ".join(conditions)
        
        # Add sorting
        order_by_clause = ""
        if sort:
            sort_map = {
                "name_asc": "c.name ASC",
                "name_desc": "c.name DESC",
                "cost_asc": "c.energy_cost ASC, c.name ASC",
                "cost_desc": "c.energy_cost DESC, c.name ASC",
                "type_asc": "c.type ASC, c.name ASC",
                "set_newest": "c.set_code DESC, c.card_number ASC",
                "set_oldest": "c.set_code ASC, c.card_number ASC",
                "rarity_rare": "CASE c.rarity WHEN 'Legendary' THEN 1 WHEN 'Rare' THEN 2 WHEN 'Uncommon' THEN 3 WHEN 'Common' THEN 4 ELSE 5 END, c.name ASC",
                "rarity_common": "CASE c.rarity WHEN 'Common' THEN 1 WHEN 'Uncommon' THEN 2 WHEN 'Rare' THEN 3 WHEN 'Legendary' THEN 4 ELSE 5 END, c.name ASC"
            }
            if sort in sort_map:
                order_by_clause = f" ORDER BY {sort_map[sort]}"
            else:
                # Default sort if sort param is invalid
                order_by_clause = " ORDER BY c.name ASC"
        else:
            # Default sort
            order_by_clause = " ORDER BY c.name ASC"

        base_sql += order_by_clause
        
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
        
        logger.info("Executing database query...")
        result = db.execute(text(base_sql), params)
        logger.info("Database query executed.")
        
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
        
        # Group cards by identity
        grouped_cards = group_cards_by_identity(cards)

        logger.info(f"Finished get_cards request. Total cards: {total}, Grouped cards: {len(grouped_cards)}")
        
        # Return results with pagination info
        return {
            "data": grouped_cards,
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