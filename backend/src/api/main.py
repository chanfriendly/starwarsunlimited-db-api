from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import sqlite3
from typing import List, Optional
import json
import os
import logging
from .vector_db import VectorDB
from .auth import router as auth_router
from .decks import router as deck_router

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = FastAPI(title="Star Wars Unlimited API")

# Configure CORS for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize vector database
vector_db = VectorDB()

# Include routers
app.include_router(auth_router)
app.include_router(deck_router)

def get_db():
    # Use the database in the user's home directory
    home_dir = os.path.expanduser("~")
    db_path = os.path.join(home_dir, '.swu', 'swu_cards.db')
    
    logger.debug(f"Attempting to connect to database at: {db_path}")
    
    if not os.path.exists(db_path):
        logger.error(f"Database not found at {db_path}")
        raise HTTPException(
            status_code=500, 
            detail=f"Database not found at {db_path}. Please run build_database.py first."
        )
    
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        logger.debug("Successfully connected to database")
        return conn
    except sqlite3.Error as e:
        logger.error(f"Failed to connect to database: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to connect to database: {str(e)}"
        )

@app.get("/")
async def root():
    return {"message": "Star Wars Unlimited API"}

@app.get("/api/cards")
async def get_cards(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    type: Optional[str] = None,
    aspect: Optional[str] = None
):
    try:
        # Connect to database
        db = get_db()
        
        # Build query
        query = "SELECT * FROM cards"
        params = []
        
        # Add conditions if filters are provided
        conditions = []
        if search:
            conditions.append("name LIKE ?")
            params.append(f"%{search}%")
        if type:
            conditions.append("type = ?")
            params.append(type)
        if aspect:
            query = """
                SELECT c.* FROM cards c
                JOIN card_aspects ca ON c.id = ca.card_id
                WHERE ca.aspect_name = ?
            """
            params = [aspect]
            # Add other conditions
            if search:
                query += " AND name LIKE ?"
                params.append(f"%{search}%")
            if type:
                query += " AND type = ?"
                params.append(type)
        elif conditions:
            query += " WHERE " + " AND ".join(conditions)
        
        # Add pagination
        query += " LIMIT ? OFFSET ?"
        params.extend([limit, (page - 1) * limit])
        
        # Execute query
        cursor = db.execute(query, params)
        cards = []
        
        # Process results
        for row in cursor:
            card = dict(row)
            card_id = str(card["id"])
            
            # Log the card data
            print(f"Card ID: {card_id}, Name: {card.get('name')}, Image URI: {card.get('image_uri')}")
            
            # Get aspects
            aspects_cursor = db.execute(
                "SELECT aspect_name, aspect_color FROM card_aspects WHERE card_id = ?",
                [card_id]
            )
            card["aspects"] = [dict(row) for row in aspects_cursor]
            
            # Get keywords
            keywords_cursor = db.execute(
                "SELECT keyword FROM card_keywords WHERE card_id = ?",
                [card_id]
            )
            card["keywords"] = [row["keyword"] for row in keywords_cursor]
            
            # Get traits
            traits_cursor = db.execute(
                "SELECT trait FROM card_traits WHERE card_id = ?",
                [card_id]
            )
            card["traits"] = [row["trait"] for row in traits_cursor]
            
            # Get arenas
            arenas_cursor = db.execute(
                "SELECT arena FROM card_arenas WHERE card_id = ?",
                [card_id]
            )
            card["arenas"] = [row["arena"] for row in arenas_cursor]
            
            cards.append(card)
        
        # Get total count for pagination
        count_query = "SELECT COUNT(*) FROM cards"
        if aspect:
            count_query = """
                SELECT COUNT(*) FROM cards c
                JOIN card_aspects ca ON c.id = ca.card_id
                WHERE ca.aspect_name = ?
            """
            count_params = [aspect]
            if search:
                count_query += " AND name LIKE ?"
                count_params.append(f"%{search}%")
            if type:
                count_query += " AND type = ?"
                count_params.append(type)
            cursor = db.execute(count_query, count_params)
        elif conditions:
            count_query += " WHERE " + " AND ".join(conditions)
            cursor = db.execute(count_query, params[:-2])  # exclude LIMIT params
        else:
            cursor = db.execute(count_query)
        
        total = cursor.fetchone()[0]
        
        db.close()
        
        return {
            "cards": cards,
            "total": total,
            "page": page,
            "limit": limit
        }
    except Exception as e:
        print(f"Error in get_cards: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
@app.get("/api/cards/{card_id}")
async def get_card(card_id: str):
    try:
        logger.debug(f"Getting card with ID: {card_id}")
        db = get_db()
        cursor = db.execute("SELECT * FROM cards WHERE id = ?", [card_id])
        result = cursor.fetchone()
        
        if not result:
            logger.warning(f"Card not found with ID: {card_id}")
            raise HTTPException(status_code=404, detail="Card not found")
            
        card = dict(result)
        card_id = str(card["id"])  # Convert ID to string
        
        # Get aspects
        aspects_cursor = db.execute(
            "SELECT aspect_name, aspect_color FROM card_aspects WHERE card_id = ?",
            [card_id]
        )
        card["aspects"] = [dict(row) for row in aspects_cursor]
        
        # Get keywords
        keywords_cursor = db.execute(
            "SELECT keyword FROM card_keywords WHERE card_id = ?",
            [card_id]
        )
        card["keywords"] = [row["keyword"] for row in keywords_cursor]
        
        # Get traits
        traits_cursor = db.execute(
            "SELECT trait FROM card_traits WHERE card_id = ?",
            [card_id]
        )
        card["traits"] = [row["trait"] for row in traits_cursor]
        
        # Get arenas
        arenas_cursor = db.execute(
            "SELECT arena FROM card_arenas WHERE card_id = ?",
            [card_id]
        )
        card["arenas"] = [row["arena"] for row in arenas_cursor]
        
        db.close()
        logger.debug(f"Successfully retrieved card: {card['name']}")
        return card
    except sqlite3.Error as e:
        logger.error(f"Database error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    except Exception as e:
        logger.error(f"Server error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")

@app.get("/api/aspects")
async def get_aspects():
    try:
        logger.debug("Getting all aspects")
        db = get_db()
        cursor = db.execute("SELECT DISTINCT aspect_name, aspect_color FROM card_aspects")
        aspects = [dict(row) for row in cursor]
        db.close()
        logger.debug(f"Successfully retrieved {len(aspects)} aspects")
        return aspects
    except sqlite3.Error as e:
        logger.error(f"Database error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@app.get("/api/types")
async def get_types():
    try:
        logger.debug("Getting all card types")
        db = get_db()
        cursor = db.execute("SELECT DISTINCT type FROM cards")
        types = [row["type"] for row in cursor]
        db.close()
        logger.debug(f"Successfully retrieved {len(types)} types")
        return types
    except sqlite3.Error as e:
        logger.error(f"Database error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}") 