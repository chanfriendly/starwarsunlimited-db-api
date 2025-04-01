from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Annotated

from src.database.db import get_app_db
from src.database.models import User, Deck, DeckCard
from src.schemas.decks import DeckListResponse
from src.schemas.collection import CollectionItemResponse
from src.auth.auth import get_current_user
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/decks", response_model=List[DeckListResponse])
async def get_user_decks(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_app_db)]
):
    """Get all decks for the logged-in user"""
    try:
        # Query decks with card count
        decks = db.query(Deck).filter(Deck.user_id == current_user.id).all()
        
        # Format response
        result = []
        for deck in decks:
            # Count cards in deck
            card_count = db.query(func.sum(DeckCard.quantity)).filter(DeckCard.deck_id == deck.id).scalar() or 0
            
            deck_dict = {
                "id": deck.id,
                "name": deck.name,
                "description": deck.description,
                "created_at": deck.created_at,
                "updated_at": deck.updated_at,
                "card_count": int(card_count)  # Convert from SQLAlchemy type to int
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