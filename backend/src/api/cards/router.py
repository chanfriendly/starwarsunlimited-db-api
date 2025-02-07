from fastapi import APIRouter, Query, HTTPException
from typing import Optional
import sqlite3
from ..database import get_db

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
        cursor = db.execute("SELECT * FROM cards LIMIT ? OFFSET ?", 
                          [limit, (page - 1) * limit])
        cards = [dict(row) for row in cursor]
        db.close()
        return {"cards": cards}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))