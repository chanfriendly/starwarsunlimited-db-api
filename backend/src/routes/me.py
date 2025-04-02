from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Annotated
import uuid
from src.database.db import get_app_db
from src.database.models import User, Deck, DeckCard, Card
from src.schemas.decks import DeckListResponse, DeckCreate, DeckResponse
from src.schemas.collection import CollectionItemResponse
from src.auth.auth import get_current_user
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

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
            
            # Create deck response
            deck_dict = {
                "id": deck.id,
                "name": deck.name,
                "description": deck.description,
                "created_at": deck.created_at,
                "updated_at": deck.updated_at,
                "leaders": [{"id": leader_id, "aspects": [], "name": f"Leader {i+1}"} for i, leader_id in enumerate(leaders_ids)],
                "base": {"id": base_id, "aspects": [], "name": "Base"} if base_id else None,
                "cards": [{"card": {"id": item["card_id"]}, "quantity": item["quantity"]} for item in card_items]
            }
            result.append(deck_dict)
        
        return result
        
    except Exception as e:
        logger.error(f"Error fetching decks for user {current_user.id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch user decks"
        )


@router.get("/collection", response_model=List[CollectionItemResponse])
async def get_user_collection(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_app_db)]
):
    """Get the card collection for the logged-in user"""
    try:
        # Try to query the user_collection table
        try:
            from src.database.models import UserCollection, Card
            
            # Join with Card to get full card information
            collection_items = (
                db.query(UserCollection, Card)
                .join(Card, UserCollection.card_id == Card.id)
                .filter(UserCollection.user_id == current_user.id)
                .all()
            )
            
            # Format response
            result = []
            for collection_item, card in collection_items:
                result.append({
                    "card": {
                        "id": card.id,
                        "name": card.name,
                        "type": card.type,
                        "set_name": card.set_name,
                        "set_code": card.set_code,
                        "image_uri": card.image_uri,
                    },
                    "count": collection_item.count
                })
            
            return result
        except Exception as table_error:
            # If table doesn't exist yet, return empty list
            if "no such table" in str(table_error):
                logger.warning("user_collection table doesn't exist yet, returning empty collection")
                return []
            else:
                # Re-raise other exceptions
                raise
    except Exception as e:
        logger.error(f"Error fetching collection for user {current_user.id}: {str(e)}", exc_info=True)
        # Just return empty list for now
        return []
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch user collection"
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
                is_leader=True
            )
            db.add(deck_card)
        
        # Add base to deck if provided
        if base_id:
            deck_card = DeckCard(
                deck_id=deck_id,
                card_id=base_id,
                quantity=1,
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
                quantity=quantity
            )
            db.add(deck_card)
        
        db.commit()
        db.refresh(new_deck)
        
        # Prepare a complete response with leaders, base, and cards
        # Since we don't have full card data here, return skeleton objects for now
        return {
            "id": deck_id,
            "name": deck_name,
            "description": "",
            "user_id": current_user.id,
            "created_at": new_deck.created_at,
            "updated_at": new_deck.updated_at,
            "leaders": [{"id": leader_id, "aspects": []} for leader_id in leaders_ids],
            "base": {"id": base_id, "aspects": []} if base_id else None,
            "cards": [{"card": {"id": card["card_id"]}, "quantity": card["quantity"]} for card in cards_data]
        }
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating deck: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create deck: {str(e)}"
        )
    

async def get_complete_deck(deck_id: str, current_user: User, db: Session):
    """Get a complete deck with all related data"""
    # Check if the deck exists and belongs to the user
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
    
    # Get cards details
    leaders = []
    base = None
    cards = []
    
    card_db = get_card_db().__next__()  # Get card database session
    
    try:
        for deck_card in deck_cards:
            # Get card from card database
            card = card_db.query(Card).filter(Card.id == deck_card.card_id).first()
            
            if not card:
                continue
                
            # Add aspects and other relationships
            enriched_card = enrich_card_with_relationships(card_db, card)
            
            if deck_card.is_leader:
                leaders.append(enriched_card)
            elif deck_card.is_base:
                base = enriched_card
            else:
                cards.append({
                    "card": enriched_card,
                    "quantity": deck_card.quantity
                })
    finally:
        card_db.close()
    
    # Build response
    response = {
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
    
    return response

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
        card_db = get_card_db().__next__()
        
        try:
            # Get leaders
            leaders = []
            for leader_id in leaders_ids:
                leader = card_db.query(Card).filter(Card.id == leader_id).first()
                if leader:
                    # Just get basic info for now
                    leaders.append({
                        "id": leader.id,
                        "name": leader.name,
                        "image_url": leader.image_uri,
                        "image_uri": leader.image_uri,
                        "aspects": []  # We'll add real aspects later
                    })
            
            # Get base
            base = None
            if base_id:
                base_card = card_db.query(Card).filter(Card.id == base_id).first()
                if base_card:
                    base = {
                        "id": base_card.id,
                        "name": base_card.name,
                        "image_url": base_card.image_uri,
                        "image_uri": base_card.image_uri,
                        "aspects": []  # We'll add real aspects later
                    }
            
            # Get cards
            cards = []
            for item in card_items:
                card = card_db.query(Card).filter(Card.id == item["card_id"]).first()
                if card:
                    cards.append({
                        "card": {
                            "id": card.id,
                            "name": card.name,
                            "image_url": card.image_uri,
                            "image_uri": card.image_uri
                        },
                        "quantity": item["quantity"]
                    })
        finally:
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