# backend/src/schemas/decks.py
from pydantic import BaseModel, Field, validator
from typing import List, Optional
from datetime import datetime
import re

# Schema for a card in a deck
class DeckCardCreate(BaseModel):
    card_id: str = Field(..., min_length=3, max_length=50, 
                       pattern=r'^[a-zA-Z0-9_\-]+$')
    quantity: int = Field(..., ge=1, le=4)
    is_leader: bool = Field(False)
    is_base: bool = Field(False)
    
    @validator('card_id')
    def validate_card_id(cls, v):
        # Additional validation beyond regex pattern
        if not re.match(r'^[a-zA-Z0-9_\-]+$', v):
            raise ValueError('Card ID must contain only alphanumeric characters, underscores, and hyphens')
        return v

class DeckCardUpdate(BaseModel):
    quantity: int = Field(..., ge=0, le=4)
    is_leader: Optional[bool] = None
    is_base: Optional[bool] = None

class DeckCardResponse(BaseModel):
    deck_id: str
    card_id: str
    quantity: int
    is_leader: bool
    is_base: bool
    
    class Config:
        orm_mode = True

# Schema for a deck
class DeckCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=1000)
    cards: List[DeckCardCreate] = Field(..., min_items=1)
    
    @validator('name')
    def validate_name(cls, v):
        # Sanitize name
        v = v.strip()
        # Prevent common HTML/JS injection patterns
        if '<' in v or '>' in v or 'script' in v.lower():
            raise ValueError('Name contains invalid characters')
        return v
        
    @validator('description')
    def validate_description(cls, v):
        if v is None:
            return v
        # Sanitize description
        v = v.strip()
        # Prevent common HTML/JS injection patterns
        if '<' in v or '>' in v or 'script' in v.lower():
            raise ValueError('Description contains invalid characters')
        return v

class DeckUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=1000)
    
    @validator('name')
    def validate_name(cls, v):
        if v is None:
            return v
        # Sanitize name
        v = v.strip()
        # Prevent common HTML/JS injection patterns
        if '<' in v or '>' in v or 'script' in v.lower():
            raise ValueError('Name contains invalid characters')
        return v
        
    @validator('description')
    def validate_description(cls, v):
        if v is None:
            return v
        # Sanitize description
        v = v.strip()
        # Prevent common HTML/JS injection patterns
        if '<' in v or '>' in v or 'script' in v.lower():
            raise ValueError('Description contains invalid characters')
        return v

class DeckResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    user_id: str
    created_at: datetime
    updated_at: datetime
    cards: List[DeckCardResponse] = []
    
    class Config:
        orm_mode = True

class DeckListResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    card_count: int = Field(..., description="Total number of cards in the deck")
    
    class Config:
        orm_mode = True