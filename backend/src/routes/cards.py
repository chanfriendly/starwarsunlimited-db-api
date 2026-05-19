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

# Set codes that are always reprints/promos of canonical cards.
# These are excluded from the main paginated results and instead attached
# as alternate_arts to their matching canonical card. IBH and TS26 are NOT
# included here because they contain a large number of unique-to-that-set cards.
ALWAYS_ALTERNATE_SETS = frozenset({
    'P25', 'P26', 'C24', 'C25', 'J24', 'J25', 'G25',
    'GG', 'JTLP', 'LOFP', 'LAWP', 'SECP',
})

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
    limit: int = Query(20, ge=1, le=2000),
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

        # Exclude promo/alternate sets from canonical results unless the user is
        # explicitly filtering by one of them (e.g. set=P26). When not filtered,
        # these cards are attached as alternate_arts after grouping.
        set_filter_codes = {s.strip() for s in set.split(',')} if set else frozenset()
        promo_filter_active = bool(set_filter_codes & ALWAYS_ALTERNATE_SETS)
        if not promo_filter_active:
            excl_placeholders = ', '.join(f':excl_set_{i}' for i in range(len(ALWAYS_ALTERNATE_SETS)))
            conditions.append(f"c.set_code NOT IN ({excl_placeholders})")
            for i, code in enumerate(sorted(ALWAYS_ALTERNATE_SETS)):
                params[f'excl_set_{i}'] = code

        # Add WHERE conditions if any
        if conditions:
            base_sql += " AND " + " AND ".join(conditions)
        
        # Add sorting
        # Chronological set order for set_newest/set_oldest sorts.
        # set_code sorts alphabetically which doesn't match release order, so we
        # use an explicit CASE mapping. Unknown/promo sets get a high number so
        # they sort after main sets rather than arbitrarily interspersed.
        set_order_case = """CASE c.set_code
            WHEN 'SOR'  THEN 1
            WHEN 'SHD'  THEN 2
            WHEN 'TWI'  THEN 3
            WHEN 'JTL'  THEN 4
            WHEN 'LOF'  THEN 5
            WHEN 'LAW'  THEN 6
            WHEN 'SEC'  THEN 7
            WHEN 'C24'  THEN 10
            WHEN 'J24'  THEN 11
            WHEN 'JTLP' THEN 12
            WHEN 'LOFP' THEN 13
            WHEN 'LAWP' THEN 14
            WHEN 'SECP' THEN 15
            WHEN 'P25'  THEN 20
            WHEN 'C25'  THEN 21
            WHEN 'G25'  THEN 22
            WHEN 'J25'  THEN 23
            WHEN 'TS26' THEN 30
            WHEN 'P26'  THEN 31
            WHEN 'GG'   THEN 40
            WHEN 'IBH'  THEN 41
            ELSE 99
        END"""
        # Secondary tiebreaker: always sort by canonical set order ASC then card number
        # so that when a card is reprinted across sets, the original printing is
        # always returned first and becomes the "primary" in the grouping function.
        canonical_tiebreak = f"{set_order_case} ASC, CAST(c.card_number AS INTEGER) ASC"

        order_by_clause = ""
        if sort:
            sort_map = {
                "name_asc": f"c.name ASC, {canonical_tiebreak}",
                "name_desc": f"c.name DESC, {canonical_tiebreak}",
                "cost_asc": f"c.energy_cost ASC, c.name ASC, {canonical_tiebreak}",
                "cost_desc": f"c.energy_cost DESC, c.name ASC, {canonical_tiebreak}",
                "type_asc": f"c.type ASC, c.name ASC, {canonical_tiebreak}",
                "set_newest": f"{set_order_case} DESC, CAST(c.card_number AS INTEGER) ASC",
                "set_newest_desc": f"{set_order_case} DESC, CAST(c.card_number AS INTEGER) DESC",
                "set_oldest": f"{set_order_case} ASC, CAST(c.card_number AS INTEGER) ASC",
                "set_oldest_desc": f"{set_order_case} ASC, CAST(c.card_number AS INTEGER) DESC",
                "rarity_rare": f"CASE c.rarity WHEN 'Legendary' THEN 1 WHEN 'Rare' THEN 2 WHEN 'Uncommon' THEN 3 WHEN 'Common' THEN 4 ELSE 5 END, c.name ASC, {canonical_tiebreak}",
                "rarity_common": f"CASE c.rarity WHEN 'Common' THEN 1 WHEN 'Uncommon' THEN 2 WHEN 'Rare' THEN 3 WHEN 'Legendary' THEN 4 ELSE 5 END, c.name ASC, {canonical_tiebreak}"
            }
            if sort in sort_map:
                order_by_clause = f" ORDER BY {sort_map[sort]}"
            else:
                # Default sort if sort param is invalid
                order_by_clause = f" ORDER BY c.name ASC, {canonical_tiebreak}"
        else:
            # Default sort
            order_by_clause = f" ORDER BY c.name ASC, {canonical_tiebreak}"

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
        
        # Group cards by identity (handles same-set art variants)
        grouped_cards = group_cards_by_identity(cards)

        # Attach promo/alternate-set variants to their canonical cards.
        # We do this after grouping so we can match against the deduplicated list.
        if not promo_filter_active and grouped_cards:
            card_names = list({c['name'] for c in grouped_cards})
            name_placeholders = ', '.join(f':pname_{i}' for i in range(len(card_names)))
            set_placeholders = ', '.join(f':pset_{i}' for i in range(len(ALWAYS_ALTERNATE_SETS)))
            promo_params: dict = {}
            for i, name in enumerate(card_names):
                promo_params[f'pname_{i}'] = name
            for i, code in enumerate(sorted(ALWAYS_ALTERNATE_SETS)):
                promo_params[f'pset_{i}'] = code

            promo_sql = f"""
                SELECT c.* FROM cards c
                WHERE c.set_code IN ({set_placeholders})
                AND c.name IN ({name_placeholders})
            """
            promo_result = db.execute(text(promo_sql), promo_params)
            promo_columns = promo_result.keys()
            promo_cards = []
            for row in promo_result:
                pc: dict = {}
                for idx, col in enumerate(promo_columns):
                    pc[col] = row._mapping[col] if hasattr(row, '_mapping') else row[idx]
                promo_cards.append(enrich_card_with_relationships(db, pc))

            # Build lookup from grouped cards: (name, subtitle, type) → card dict
            canonical_lookup: dict = {}
            for gc in grouped_cards:
                key = (gc.get('name'), gc.get('subtitle'), gc.get('type'))
                canonical_lookup[key] = gc

            for pc in promo_cards:
                key = (pc.get('name'), pc.get('subtitle'), pc.get('type'))
                if key not in canonical_lookup:
                    continue
                gc = canonical_lookup[key]
                existing_ids = {gc.get('id')} | {a['id'] for a in gc.get('alternate_arts', [])}
                if pc['id'] not in existing_ids:
                    gc.setdefault('alternate_arts', []).append({
                        "id": pc.get('id'),
                        "image_uri": pc.get('image_uri'),
                        "image_url": pc.get('image_url'),
                        "set_name": pc.get('set_name'),
                        "set_code": pc.get('set_code'),
                        "card_number": pc.get('card_number'),
                        "rarity": pc.get('rarity'),
                        "artist": pc.get('artist'),
                    })

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