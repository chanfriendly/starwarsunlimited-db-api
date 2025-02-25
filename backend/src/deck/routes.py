from typing import Annotated, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from src.database.db import get_db
from src.database.models import Deck, DeckCard, Card, User
from src.auth.auth import get_current_user
from src.deck.schemas import (
    DeckCreate, DeckUpdate, DeckResponse, DeckListResponse,
    DeckCardCreate, DeckCardUpdate, DeckCardResponse
)

router = APIRouter(
    prefix="/api/decks",
    tags=["decks"]
)

# Deck routes
@router.get("/", response_model=List[DeckListResponse])
async def get_user_decks(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)]
):
    """Get all decks for the current user"""
    # Query decks with card count
    decks_with_count = db.query(
        Deck,
        func.count(DeckCard.id).label("card_count")
    ).outerjoin(
        DeckCard, Deck.id == DeckCard.deck_id
    ).filter(
        Deck.user_id == current_user.id
    ).group_by(
        Deck.id
    ).all()
    
    # Format response
    result = []
    for deck, card_count in decks_with_count:
        deck_dict = {
            "id": deck.id,
            "name": deck.name,
            "description": deck.description,
            "created_at": deck.created_at,
            "updated_at": deck.updated_at,
            "card_count": card_count
        }
        result.append(deck_dict)
    
    return result

@router.post("/", response_model=DeckResponse, status_code=status.HTTP_201_CREATED)
async def create_deck(
    deck_data: DeckCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)]
):
    """Create a new deck"""
    # Create new deck
    new_deck = Deck(
        name=deck_data.name,
        description=deck_data.description,
        user_id=current_user.id
    )
    db.add(new_deck)
    db.flush()
    
    # Add cards to deck
    for card_data in deck_data.cards:
        # Verify card exists
        card = db.query(Card).filter(Card.id == card_data.card_id).first()
        if not card:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Card with id {card_data.card_id} not found"
            )
        
        # Add card to deck
        deck_card = DeckCard(
            deck_id=new_deck.id,
            card_id=card_data.card_id,
            quantity=card_data.quantity,
            is_leader=card_data.is_leader,
            is_base=card_data.is_base
        )
        db.add(deck_card)
    
    db.commit()
    db.refresh(new_deck)
    return new_deck

@router.get("/{deck_id}", response_model=DeckResponse)
async def get_deck(
    deck_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)]
):
    """Get a specific deck"""
    deck = db.query(Deck).filter(
        Deck.id == deck_id,
        Deck.user_id == current_user.id
    ).first()
    
    if not deck:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Deck not found"
        )
    
    return deck

@router.put("/{deck_id}", response_model=DeckResponse)
async def update_deck(
    deck_id: str,
    deck_data: DeckUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)]
):
    """Update a deck's name or description"""
    deck = db.query(Deck).filter(
        Deck.id == deck_id,
        Deck.user_id == current_user.id
    ).first()
    
    if not deck:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Deck not found"
        )
    
    deck.name = deck_data.name
    deck.description = deck_data.description
    
    db.commit()
    db.refresh(deck)
    return deck

@router.delete("/{deck_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_deck(
    deck_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)]
):
    """Delete a deck"""
    deck = db.query(Deck).filter(
        Deck.id == deck_id,
        Deck.user_id == current_user.id
    ).first()
    
    if not deck:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Deck not found"
        )
    
    db.delete(deck)
    db.commit()
    return

# Deck card routes
@router.post("/{deck_id}/cards", response_model=DeckCardResponse, status_code=status.HTTP_201_CREATED)
async def add_card_to_deck(
    deck_id: str,
    card_data: DeckCardCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)]
):
    """Add a card to a deck"""
    # Verify deck exists and belongs to user
    deck = db.query(Deck).filter(
        Deck.id == deck_id,
        Deck.user_id == current_user.id
    ).first()
    
    if not deck:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Deck not found"
        )
    
    # Verify card exists
    card = db.query(Card).filter(Card.id == card_data.card_id).first()
    if not card:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Card with id {card_data.card_id} not found"
        )
    
    # Check if card already exists in deck
    existing_card = db.query(DeckCard).filter(
        DeckCard.deck_id == deck_id,
        DeckCard.card_id == card_data.card_id
    ).first()
    
    if existing_card:
        # Update quantity instead of creating new entry
        existing_card.quantity = card_data.quantity
        existing_card.is_leader = card_data.is_leader
        existing_card.is_base = card_data.is_base
        db.commit()
        db.refresh(existing_card)
        return existing_card
    
    # Add card to deck
    deck_card = DeckCard(
        deck_id=deck_id,
        card_id=card_data.card_id,
        quantity=card_data.quantity,
        is_leader=card_data.is_leader,
        is_base=card_data.is_base
    )
    db.add(deck_card)
    db.commit()
    db.refresh(deck_card)
    return deck_card

@router.put("/{deck_id}/cards/{card_id}", response_model=DeckCardResponse)
async def update_card_in_deck(
    deck_id: str,
    card_id: str,
    card_data: DeckCardUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)]
):
    """Update a card in a deck"""
    # Verify deck exists and belongs to user
    deck = db.query(Deck).filter(
        Deck.id == deck_id,
        Deck.user_id == current_user.id
    ).first()
    
    if not deck:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Deck not found"
        )
    
    # Get deck card
    deck_card = db.query(DeckCard).filter(
        DeckCard.deck_id == deck_id,
        DeckCard.card_id == card_id
    ).first()
    
    if not deck_card:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Card not found in deck"
        )
    
    # Update card
    deck_card.quantity = card_data.quantity
    deck_card.is_leader = card_data.is_leader
    deck_card.is_base = card_data.is_base
    
    db.commit()
    db.refresh(deck_card)
    return deck_card

@router.delete("/{deck_id}/cards/{card_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_card_from_deck(
    deck_id: str,
    card_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)]
):
    """Remove a card from a deck"""
    # Verify deck exists and belongs to user
    deck = db.query(Deck).filter(
        Deck.id == deck_id,
        Deck.user_id == current_user.id
    ).first()
    
    if not deck:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Deck not found"
        )
    
    # Get deck card
    deck_card = db.query(DeckCard).filter(
        DeckCard.deck_id == deck_id,
        DeckCard.card_id == card_id
    ).first()
    
    if not deck_card:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Card not found in deck"
        )
    
    # Remove card
    db.delete(deck_card)
    db.commit()
    return