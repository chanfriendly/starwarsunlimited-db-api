from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Annotated
from src.database.db import get_app_db, get_card_db
from src.database.models import Deck, DeckCard
from src.utils.db_helpers import enrich_card_with_relationships
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/decks/share/{share_token}")
async def get_shared_deck(
    share_token: str,
    db: Annotated[Session, Depends(get_app_db)]
):
    """Public endpoint — returns deck by share token. No auth required."""
    deck = db.query(Deck).filter(Deck.share_token == share_token).first()
    if not deck:
        raise HTTPException(status_code=404, detail="Shared deck not found")

    deck_cards = db.query(DeckCard).filter(DeckCard.deck_id == deck.id).all()

    leaders_ids = []
    base_id = None
    card_items = []
    for dc in deck_cards:
        if dc.is_leader:
            leaders_ids.append(dc.card_id)
        elif dc.is_base:
            base_id = dc.card_id
        else:
            card_items.append({"card_id": dc.card_id, "quantity": dc.quantity})

    card_db_gen = get_card_db()
    card_db = next(card_db_gen)
    try:
        leaders = []
        for lid in leaders_ids:
            row = card_db.execute(text("SELECT * FROM cards WHERE id = :id"), {"id": lid}).fetchone()
            if row:
                d = {k: row._mapping[k] for k in row._mapping.keys()}
                leaders.append(enrich_card_with_relationships(card_db, d))

        base = None
        if base_id:
            row = card_db.execute(text("SELECT * FROM cards WHERE id = :id"), {"id": base_id}).fetchone()
            if row:
                d = {k: row._mapping[k] for k in row._mapping.keys()}
                base = enrich_card_with_relationships(card_db, d)

        cards = []
        for item in card_items:
            row = card_db.execute(
                text("SELECT * FROM cards WHERE id = :id"), {"id": item["card_id"]}
            ).fetchone()
            if row:
                d = {k: row._mapping[k] for k in row._mapping.keys()}
                cards.append({
                    "card": enrich_card_with_relationships(card_db, d),
                    "quantity": item["quantity"],
                })
    finally:
        card_db.close()

    return {
        "id": deck.id,
        "name": deck.name,
        "description": deck.description,
        "created_at": deck.created_at,
        "updated_at": deck.updated_at,
        "leaders": leaders,
        "base": base,
        "cards": cards,
    }
