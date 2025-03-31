from fastapi import APIRouter, Query, HTTPException
from typing import Optional
import sqlite3
from src.database.db import get_db

# Define prefix and tags in the router
router = APIRouter()

@router.get("/")
async def get_cards(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    type: Optional[str] = None,
    aspect: Optional[str] = None
):
    try:
        db = get_db()
        cursor = next(db).execute("SELECT * FROM cards LIMIT ? OFFSET ?", 
                          [limit, (page - 1) * limit])
        cards = [dict(row) for row in cursor]
        return {"cards": cards}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))