from typing import Dict, Any
from pydantic import BaseModel

class CardSummary(BaseModel):
    id: str
    name: str
    type: str
    set_name: str = None
    set_code: str = None
    image_uri: str = None

class CollectionItemResponse(BaseModel):
    card: CardSummary
    count: int