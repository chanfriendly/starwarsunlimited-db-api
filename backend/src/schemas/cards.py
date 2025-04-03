# backend/src/schemas/cards.py
from pydantic import BaseModel, ConfigDict, Field
from typing import List, Optional, Dict, Any

# --- Individual Card Schema (for response) ---
# Define the fields you want to return for EACH card in the list or detail view
# This should match the structure your frontend expects (like ApiCard in api.ts)
# Make sure types match (e.g., use Optional for fields that might be null)
class CardResponse(BaseModel):
    id: str
    name: str
    subtitle: Optional[str] = None
    energy_cost: Optional[int] = None # Use the primary cost field name from model
    type: str
    type2: Optional[str] = None
    rarity: Optional[str] = None
    text: Optional[str] = None
    text_styled: Optional[str] = None
    epic_action: Optional[str] = None
    deploy_box: Optional[str] = None
    attack: Optional[int] = None
    health: Optional[int] = None
    image_uri: Optional[str] = None
    image_back_uri: Optional[str] = None
    price_usd: Optional[float] = None
    set_name: Optional[str] = None
    set_code: Optional[str] = None
    card_number: Optional[str] = None
    release_date: Optional[str] = None
    last_updated: Optional[str] = None
    is_unique: Optional[bool] = None
    artist: Optional[str] = None
    serial_code: Optional[str] = None

    # Include related data if needed (aligns with enrich_card... or card_to_dict helpers)
    aspects: List[Dict[str, Any]] = [] # Example: List of aspect dicts
    keywords: List[str] = []
    traits: List[str] = []
    arenas: List[str] = []

    # Use Pydantic V2 config for ORM conversion
    model_config = ConfigDict(from_attributes=True)

# --- Pagination Metadata Schema ---
class PaginationMeta(BaseModel):
    total: int
    page: int
    limit: int
    pages: int

# --- Paginated List Response Schema ---
# This is the structure for the GET /api/cards/ endpoint
class CardListResponse(BaseModel):
    data: List[CardResponse] # A list of card objects defined above
    meta: PaginationMeta     # The pagination metadata