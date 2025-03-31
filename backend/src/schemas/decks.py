from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field

# Schema for a card in a deck
class DeckCardBase(BaseModel):
    card_id: str
    quantity: int = 1
    is_leader: bool = False
    is_base: bool = False

class DeckCardCreate(DeckCardBase):
    pass

class DeckCardUpdate(DeckCardBase):
    pass

class DeckCardResponse(DeckCardBase):
    id: int
    deck_id: str

    class Config:
        orm_mode = True

# Schema for a deck
class DeckBase(BaseModel):
    name: str
    description: Optional[str] = None

class DeckCreate(DeckBase):
    cards: List[DeckCardCreate] = []

class DeckUpdate(DeckBase):
    pass

class DeckResponse(DeckBase):
    id: str
    user_id: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    cards: List[DeckCardResponse] = []

    class Config:
        orm_mode = True

# Schema for listing decks
class DeckListResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    card_count: int = Field(..., description="Total number of cards in the deck")

    class Config:
        orm_mode = True