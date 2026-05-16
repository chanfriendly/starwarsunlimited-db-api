from fastapi import APIRouter, Depends, HTTPException, status, Request, Response, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from typing import List, Annotated
import uuid
from src.database.db import get_app_db, get_card_db
from src.database.models import User, Deck, DeckCard, Card, UserCollection, UserWishlist
from src.auth.auth import get_current_user
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

# Define this function at the module level (not inside another function)
def enrich_card_with_relationships(db, card_dict):
    """Add relationship data to a card dictionary"""
    try:
        # Get card aspects
        aspects_query = text("SELECT aspect_name, aspect_color FROM card_aspects WHERE card_id = :card_id")
        aspects_proxy = db.execute(aspects_query, {"card_id": card_dict['id']})
        
        # Process aspect results
        aspects = []
        for aspect_row in aspects_proxy:
            aspects.append({
                'aspect_name': aspect_row._mapping['aspect_name'], 
                'aspect_color': aspect_row._mapping['aspect_color']
            })
        
        card_dict['aspects'] = aspects
    except Exception as e:
        logger.error(f"Error getting aspects: {e}")
        card_dict['aspects'] = []
        
    # Get card keywords
    try:
        keywords_query = text("SELECT keyword FROM card_keywords WHERE card_id = :card_id")
        keywords_proxy = db.execute(keywords_query, {"card_id": card_dict['id']})
        
        # Process keyword results
        keywords = []
        for keyword_row in keywords_proxy:
            keywords.append(keyword_row._mapping['keyword'])
        
        card_dict['keywords'] = keywords
    except Exception as e:
        logger.error(f"Error getting keywords: {e}")
        card_dict['keywords'] = []
        
    return card_dict

@router.get("/decks")
async def get_user_decks(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_app_db)]
):
    """Get all decks for the logged-in user"""
    try:
        # Query decks
        decks = db.query(Deck).filter(Deck.user_id == current_user.id).all()
        
        # Format response with full deck information
        result = []
        for deck in decks:
            # Get all deck cards
            deck_cards = db.query(DeckCard).filter(DeckCard.deck_id == deck.id).all()
            
            # Split into leaders, base, and regular cards
            leaders = []
            base = None
            cards = []
            
            # Get card DB session for fetching card details
            card_db_gen = get_card_db()
            card_db = next(card_db_gen)
            
            try:
                # Process leaders
                for deck_card in deck_cards:
                    if deck_card.is_leader:
                        # Fetch basic leader info
                        leader_query = text("SELECT id, name, image_uri FROM cards WHERE id = :card_id")
                        result_proxy = card_db.execute(leader_query, {"card_id": deck_card.card_id})
                        
                        # Get column names from the result
                        if result_proxy.returns_rows:
                            leader_result = result_proxy.fetchone()
                            if leader_result:
                                # Convert result to dict - FIXED
                                leader_dict = {key: leader_result._mapping[key] for key in leader_result._mapping.keys()}
                                
                                # Rename image_uri to image_url for frontend compatibility
                                if leader_dict.get("image_uri"):
                                    leader_dict["image_url"] = leader_dict["image_uri"]
                                
                                # Get aspects for display
                                try:
                                    aspects_query = text("SELECT aspect_name, aspect_color FROM card_aspects WHERE card_id = :card_id")
                                    aspects_proxy = card_db.execute(aspects_query, {"card_id": deck_card.card_id})
                                    aspects = []
                                    
                                    # Process aspect results
                                    for aspect_row in aspects_proxy:
                                        aspects.append({
                                            'aspect_name': aspect_row._mapping['aspect_name'], 
                                            'aspect_color': aspect_row._mapping['aspect_color']
                                        })
                                    
                                    leader_dict['aspects'] = aspects
                                except Exception as e:
                                    logger.error(f"Error fetching aspects: {e}")
                                    leader_dict['aspects'] = []
                                
                                leaders.append(leader_dict)
                            else:
                                # Fallback if card not found
                                leaders.append({
                                    "id": deck_card.card_id,
                                    "name": f"Leader",
                                    "aspects": []
                                })
                    
                    # Process base
                    elif deck_card.is_base:
                        # Fetch basic base info
                        base_query = text("SELECT id, name, image_uri FROM cards WHERE id = :card_id")
                        result_proxy = card_db.execute(base_query, {"card_id": deck_card.card_id})
                        
                        if result_proxy.returns_rows:
                            base_result = result_proxy.fetchone()
                            if base_result:
                                # Convert to dict - FIXED
                                base_dict = {key: base_result._mapping[key] for key in base_result._mapping.keys()}
                                
                                # Rename image_uri to image_url for frontend compatibility
                                if base_dict.get("image_uri"):
                                    base_dict["image_url"] = base_dict["image_uri"]
                                
                                # Get aspects for display
                                try:
                                    aspects_query = text("SELECT aspect_name, aspect_color FROM card_aspects WHERE card_id = :card_id")
                                    aspects_proxy = card_db.execute(aspects_query, {"card_id": deck_card.card_id})
                                    aspects = []
                                    
                                    # Process aspect results
                                    for aspect_row in aspects_proxy:
                                        aspects.append({
                                            'aspect_name': aspect_row._mapping['aspect_name'], 
                                            'aspect_color': aspect_row._mapping['aspect_color']
                                        })
                                    
                                    base_dict['aspects'] = aspects
                                except Exception as e:
                                    logger.error(f"Error fetching aspects: {e}")
                                    base_dict['aspects'] = []
                                
                                base = base_dict
                            else:
                                # Fallback if card not found
                                base = {
                                    "id": deck_card.card_id,
                                    "name": "Base",
                                    "aspects": []
                                }
                    
                    # Process regular cards
                    else:
                        # Fetch basic card info
                        card_query = text("SELECT id, name, image_uri FROM cards WHERE id = :card_id")
                        result_proxy = card_db.execute(card_query, {"card_id": deck_card.card_id})
                        
                        if result_proxy.returns_rows:
                            card_result = result_proxy.fetchone()
                            if card_result:
                                # Convert to dict - FIXED
                                card_dict = {key: card_result._mapping[key] for key in card_result._mapping.keys()}
                                
                                # Rename image_uri to image_url for frontend compatibility
                                if card_dict.get("image_uri"):
                                    card_dict["image_url"] = card_dict["image_uri"]
                                
                                cards.append({
                                    "card": card_dict,
                                    "quantity": deck_card.quantity
                                })
                            else:
                                # Fallback if card not found
                                cards.append({
                                    "card": {
                                        "id": deck_card.card_id,
                                        "name": "Card"
                                    },
                                    "quantity": deck_card.quantity
                                })
            finally:
                # Always close the card database session
                card_db.close()
            
            # Create deck response
            deck_dict = {
                "id": deck.id,
                "name": deck.name,
                "description": deck.description,
                "created_at": deck.created_at,
                "updated_at": deck.updated_at,
                "leaders": leaders,
                "base": base,
                "cards": cards
            }
            result.append(deck_dict)
        
        return result
        
    except Exception as e:
        logger.error(f"Error fetching decks for user {current_user.id}: {str(e)}", exc_info=True)
        # Return empty list instead of error for better frontend experience
        return []

@router.get("/decks/{deck_id}")
async def get_user_deck(
    deck_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_app_db)]
):
    """Get a specific deck for the logged-in user"""
    try:
        # Query the deck
        deck = db.query(Deck).filter(
            Deck.id == deck_id,
            Deck.user_id == current_user.id
        ).first()
        
        if not deck:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Deck not found"
            )
        
        # Get all deck cards
        deck_cards = db.query(DeckCard).filter(DeckCard.deck_id == deck_id).all()
        
        # Split into leaders, base, and regular cards
        leaders_ids = []
        base_id = None
        card_items = []
        
        for deck_card in deck_cards:
            if deck_card.is_leader:
                leaders_ids.append(deck_card.card_id)
            elif deck_card.is_base:
                base_id = deck_card.card_id
            else:
                card_items.append({
                    "card_id": deck_card.card_id,
                    "quantity": deck_card.quantity
                })
        
        # Get card details from card database
        # Get a card_db session properly
        card_db_gen = get_card_db()
        card_db = next(card_db_gen)
        
        try:
            # Get leaders
            leaders = []
            for leader_id in leaders_ids:
                # Use raw SQL with parameters to prevent SQL injection
                leader_query = text("SELECT * FROM cards WHERE id = :leader_id")
                result_proxy = card_db.execute(leader_query, {"leader_id": leader_id})
                
                # Process result properly
                if result_proxy.returns_rows:
                    leader_result = result_proxy.fetchone()
                    if leader_result:
                        # Create dictionary from row
                        leader_dict = {key: leader_result._mapping[key] for key in leader_result._mapping.keys()}
                        
                        # Add relationships
                        enriched_leader = enrich_card_with_relationships(card_db, leader_dict)
                        leaders.append(enriched_leader)
            
            # Get base
            base = None
            if base_id:
                base_query = text("SELECT * FROM cards WHERE id = :base_id")
                result_proxy = card_db.execute(base_query, {"base_id": base_id})
                
                # Process result properly
                if result_proxy.returns_rows:
                    base_result = result_proxy.fetchone()
                    if base_result:
                        # Convert row to dictionary
                        base_dict = {key: base_result._mapping[key] for key in base_result._mapping.keys()}
                        
                        # Add relationships
                        base = enrich_card_with_relationships(card_db, base_dict)
            
            # Get cards
            cards = []
            for item in card_items:
                card_query = text("SELECT * FROM cards WHERE id = :card_id")
                result_proxy = card_db.execute(card_query, {"card_id": item["card_id"]})
                
                # Process result properly
                if result_proxy.returns_rows:
                    card_result = result_proxy.fetchone()
                    if card_result:
                        # Convert row to dictionary
                        card_dict = {key: card_result._mapping[key] for key in card_result._mapping.keys()}
                        
                        # Add relationships
                        enriched_card = enrich_card_with_relationships(card_db, card_dict)
                        
                        cards.append({
                            "card": enriched_card,
                            "quantity": item["quantity"]
                        })
        finally:
            # Always close the database session
            card_db.close()
        
        # Create deck response
        return {
            "id": deck.id,
            "name": deck.name,
            "description": deck.description,
            "user_id": deck.user_id,
            "created_at": deck.created_at,
            "updated_at": deck.updated_at,
            "leaders": leaders,
            "base": base,
            "cards": cards
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching deck {deck_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch deck"
        )
    
@router.post("/decks", status_code=status.HTTP_201_CREATED)
async def create_user_deck(
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_app_db)]
):
    """Create a new deck for the logged-in user"""
    try:
        # Parse request body
        deck_data = await request.json()
        logger.debug(f"Received deck data: {deck_data}")
        
        # Extract deck components
        deck_name = deck_data.get('name', 'New Deck')
        leaders_ids = deck_data.get('leaders', [])
        base_id = deck_data.get('base')
        cards_data = deck_data.get('cards', [])
        
        # Generate unique ID
        deck_id = str(uuid.uuid4())
        
        # Create new deck
        new_deck = Deck(
            id=deck_id,
            name=deck_name,
            description="",
            user_id=current_user.id
        )
        
        db.add(new_deck)
        db.flush()
        
        # Add leaders to deck
        for i, leader_id in enumerate(leaders_ids):
            deck_card = DeckCard(
                deck_id=deck_id,
                card_id=leader_id,
                quantity=1,
                is_leader=True,
                is_base=False
            )
            db.add(deck_card)
        
        # Add base to deck if provided
        if base_id:
            deck_card = DeckCard(
                deck_id=deck_id,
                card_id=base_id,
                quantity=1,
                is_leader=False,
                is_base=True
            )
            db.add(deck_card)
        
        # Add regular cards to deck
        for card_data in cards_data:
            card_id = card_data.get('card_id')
            quantity = card_data.get('quantity', 1)
            
            deck_card = DeckCard(
                deck_id=deck_id,
                card_id=card_id,
                quantity=quantity,
                is_leader=False,
                is_base=False
            )
            db.add(deck_card)
        
        db.commit()
        db.refresh(new_deck)
        
        # Prepare a complete response with leaders, base, and cards
        # Since we don't have full card data here, return a simplified response
        return {
            "id": deck_id,
            "name": deck_name,
            "description": "",
            "user_id": current_user.id,
            "created_at": new_deck.created_at,
            "updated_at": new_deck.updated_at,
            "leaders": [{"id": leader_id} for leader_id in leaders_ids],
            "base": {"id": base_id} if base_id else None,
            "cards": [{"card": {"id": card["card_id"]}, "quantity": card["quantity"]} for card in cards_data]
        }
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating deck: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create deck: {str(e)}"
        )
    
@router.delete("/decks/{deck_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user_deck(
    deck_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_app_db)]
):
    """Delete a specific deck for the logged-in user"""
    try:
        # Query the deck
        deck = db.query(Deck).filter(
            Deck.id == deck_id,
            Deck.user_id == current_user.id
        ).first()
        
        if not deck:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Deck not found"
            )
        
        # Delete the deck
        db.delete(deck)
        db.commit()
        
        return Response(status_code=status.HTTP_204_NO_CONTENT)
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting deck {deck_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete deck"
        )

@router.put("/decks/{deck_id}")
async def update_user_deck(
    deck_id: str,
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_app_db)]
):
    """Update an existing deck for the logged-in user"""
    try:
        deck = db.query(Deck).filter(
            Deck.id == deck_id,
            Deck.user_id == current_user.id
        ).first()

        if not deck:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deck not found")

        deck_data = await request.json()
        deck_name = deck_data.get("name", deck.name)
        leaders_ids = deck_data.get("leaders", [])
        base_id = deck_data.get("base")
        cards_data = deck_data.get("cards", [])

        deck.name = deck_name

        # Replace all deck cards
        db.query(DeckCard).filter(DeckCard.deck_id == deck_id).delete()

        for leader_id in leaders_ids:
            db.add(DeckCard(deck_id=deck_id, card_id=leader_id, quantity=1, is_leader=True, is_base=False))

        if base_id:
            db.add(DeckCard(deck_id=deck_id, card_id=base_id, quantity=1, is_leader=False, is_base=True))

        for card in cards_data:
            db.add(DeckCard(
                deck_id=deck_id,
                card_id=card.get("card_id"),
                quantity=card.get("quantity", 1),
                is_leader=False,
                is_base=False
            ))

        db.commit()
        db.refresh(deck)

        return {
            "id": deck.id,
            "name": deck.name,
            "description": deck.description,
            "user_id": deck.user_id,
            "created_at": deck.created_at,
            "updated_at": deck.updated_at,
            "leaders": [{"id": lid} for lid in leaders_ids],
            "base": {"id": base_id} if base_id else None,
            "cards": [{"card": {"id": c["card_id"]}, "quantity": c["quantity"]} for c in cards_data]
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating deck {deck_id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update deck")


@router.post("/collection", status_code=status.HTTP_200_OK)
async def update_collection_item(
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_app_db)]
):
    """Add or update a card in the user's collection"""
    try:
        # Parse request body
        item_data = await request.json()
        card_id = item_data.get('card_id')
        count = item_data.get('count', 0)
        
        # Validate data
        if not card_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing card_id"
            )
        
        # If count is 0, remove from collection
        if count <= 0:
            # Delete the collection item if it exists
            db.query(UserCollection).filter(
                UserCollection.user_id == current_user.id,
                UserCollection.card_id == card_id
            ).delete()
            db.commit()
            
            return {"success": True, "message": "Card removed from collection"}
        else:
            # Check if item already exists
            existing_item = db.query(UserCollection).filter(
                UserCollection.user_id == current_user.id,
                UserCollection.card_id == card_id
            ).first()
            
            if existing_item:
                # Update count
                existing_item.count = count
                db.commit()
            else:
                # Create new collection item
                new_item = UserCollection(
                    user_id=current_user.id,
                    card_id=card_id,
                    count=count
                )
                db.add(new_item)
                db.commit()
            
            # Get card details for response
            card_db_gen = get_card_db()
            card_db = next(card_db_gen)
            
            try:
                card_query = text("SELECT * FROM cards WHERE id = :card_id")
                card_proxy = card_db.execute(card_query, {"card_id": card_id})
                
                if card_proxy.returns_rows:
                    card_row = card_proxy.fetchone()
                    if card_row:
                        # Convert to dictionary
                        card_dict = {key: card_row._mapping[key] for key in card_row._mapping.keys()}
                        
                        # Add relationships
                        card_with_relations = enrich_card_with_relationships(card_db, card_dict)
                        
                        # Return complete info
                        return {
                            "card": card_with_relations,
                            "count": count,
                            "in_collection": True
                        }
            finally:
                card_db.close()
            
            # Fallback response
            return {"success": True, "card_id": card_id, "count": count}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating collection: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update collection"
        )
    
@router.get("/collection")
async def get_user_collection(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_app_db)],
    all_cards: bool = Query(False)
):
    """Get the card collection for the logged-in user"""
    try:
        # If all_cards parameter is True, return all cards with in_collection flag
        if all_cards:
            # Get user's collection
            user_collection = db.query(UserCollection).filter(
                UserCollection.user_id == current_user.id
            ).all()
            
            # Create a set of card IDs in collection for faster lookups
            collection_card_ids = {item.card_id for item in user_collection}
            
            # Get card DB session
            card_db_gen = get_card_db()
            card_db = next(card_db_gen)
            
            try:
                # Fetch all cards
                cards_query = text("SELECT * FROM cards LIMIT 100")  # Limit for performance
                cards_proxy = card_db.execute(cards_query)
                
                result = []
                for card_row in cards_proxy:
                    # Convert to dict
                    card_dict = {key: card_row._mapping[key] for key in card_row._mapping.keys()}
                    
                    # Add relationships
                    card_with_relations = enrich_card_with_relationships(card_db, card_dict)
                    
                    # Check if card is in collection
                    card_id = card_dict['id']
                    in_collection = card_id in collection_card_ids
                    count = 0
                    
                    if in_collection:
                        # Get count from collection
                        collection_item = next(
                            (item for item in user_collection if item.card_id == card_id), 
                            None
                        )
                        if collection_item:
                            count = collection_item.count
                    
                    # Add to result
                    result.append({
                        "card": card_with_relations,
                        "count": count,
                        "in_collection": in_collection
                    })
                
                return result
            finally:
                card_db.close()
        else:
            # Just return cards in collection
            collection_items = db.query(UserCollection).filter(
                UserCollection.user_id == current_user.id
            ).all()
            
            if not collection_items:
                return []
            
            # Get card details from card database
            card_db_gen = get_card_db()
            card_db = next(card_db_gen)
            
            try:
                result = []
                for item in collection_items:
                    # Fetch card details
                    card_query = text("SELECT * FROM cards WHERE id = :card_id")
                    card_proxy = card_db.execute(card_query, {"card_id": item.card_id})
                    
                    if card_proxy.returns_rows:
                        card_row = card_proxy.fetchone()
                        if card_row:
                            # Convert to dict
                            card_dict = {key: card_row._mapping[key] for key in card_row._mapping.keys()}
                            
                            # Add relationships
                            card_with_relations = enrich_card_with_relationships(card_db, card_dict)
                            
                            # Add to result
                            result.append({
                                "card": card_with_relations,
                                "count": item.count,
                                "in_collection": True
                            })
                
                return result
            finally:
                card_db.close()
    except Exception as e:
        logger.error(f"Error fetching collection: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch collection"
        )

@router.get("/wishlist")
async def get_user_wishlist(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_app_db)]
):
    """Get the wishlist for the logged-in user"""
    try:
        items = db.query(UserWishlist).filter(
            UserWishlist.user_id == current_user.id
        ).order_by(UserWishlist.added_at.desc()).all()

        if not items:
            return []

        card_db_gen = get_card_db()
        card_db = next(card_db_gen)
        try:
            result = []
            for item in items:
                card_query = text("SELECT * FROM cards WHERE id = :card_id")
                card_proxy = card_db.execute(card_query, {"card_id": item.card_id})
                if card_proxy.returns_rows:
                    card_row = card_proxy.fetchone()
                    if card_row:
                        card_dict = {key: card_row._mapping[key] for key in card_row._mapping.keys()}
                        card_with_relations = enrich_card_with_relationships(card_db, card_dict)
                        result.append({
                            "card": card_with_relations,
                            "added_at": item.added_at.isoformat() if item.added_at else None,
                        })
            return result
        finally:
            card_db.close()
    except Exception as e:
        logger.error(f"Error fetching wishlist: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch wishlist"
        )


@router.post("/wishlist", status_code=status.HTTP_200_OK)
async def add_to_wishlist(
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_app_db)]
):
    """Add a card to the user's wishlist (idempotent)"""
    try:
        body = await request.json()
        card_id = body.get("card_id")
        if not card_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing card_id")

        existing = db.query(UserWishlist).filter(
            UserWishlist.user_id == current_user.id,
            UserWishlist.card_id == card_id
        ).first()

        if not existing:
            db.add(UserWishlist(user_id=current_user.id, card_id=card_id))
            db.commit()

        return {"success": True, "card_id": card_id}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error adding to wishlist: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to add to wishlist"
        )


@router.delete("/wishlist/{card_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_from_wishlist(
    card_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_app_db)]
):
    """Remove a card from the user's wishlist"""
    try:
        db.query(UserWishlist).filter(
            UserWishlist.user_id == current_user.id,
            UserWishlist.card_id == card_id
        ).delete()
        db.commit()
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except Exception as e:
        db.rollback()
        logger.error(f"Error removing from wishlist: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to remove from wishlist"
        )


@router.delete("/account", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_app_db)]
):
    """Permanently delete the authenticated user and all their data."""
    try:
        db.delete(current_user)
        db.commit()
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting account {current_user.id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete account"
        )
