# src/database/build_vector_db.py

import os
import sys
import asyncio
import logging
from pathlib import Path

# Add the parent directory to the Python path
sys.path.append(str(Path(__file__).parent.parent.parent))

from src.api.vector_db import VectorDB
from src.database.rules_parser import parse_rulebook
import sqlite3
from typing import List, Dict

# Configure logging with both file and console handlers
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('vector_db_build.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

async def get_all_cards() -> List[Dict]:
    """Fetch all cards from the SQLite database with their related data."""
    # Get the database path from the user's home directory
    home_dir = os.path.expanduser("~")
    db_path = os.path.join(home_dir, '.swu', 'swu_cards.db')
    
    if not os.path.exists(db_path):
        raise FileNotFoundError(f"Database not found at {db_path}")
    
    logger.info(f"Connecting to SQLite database at {db_path}")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    try:
        # Get all cards
        cards = []
        cursor.execute("SELECT * FROM cards")
        total_cards = cursor.fetchall()
        logger.info(f"Found {len(total_cards)} cards to process")
        
        for row in total_cards:
            card = dict(row)
            card_id = str(card["id"])
            
            # Get related data
            cursor.execute(
                "SELECT aspect_name, aspect_color FROM card_aspects WHERE card_id = ?",
                [card_id]
            )
            card["aspects"] = [dict(row) for row in cursor.fetchall()]
            
            cursor.execute(
                "SELECT keyword FROM card_keywords WHERE card_id = ?",
                [card_id]
            )
            card["keywords"] = [row["keyword"] for row in cursor.fetchall()]
            
            cursor.execute(
                "SELECT trait FROM card_traits WHERE card_id = ?",
                [card_id]
            )
            card["traits"] = [row["trait"] for row in cursor.fetchall()]
            
            cards.append(card)
            
        return cards
        
    finally:
        conn.close()

def get_rulebook_sections() -> List[Dict[str, str]]:
    """Load and parse the rulebook into sections."""
    current_dir = Path(__file__).parent
    rules_dir = current_dir / 'rules'
    rulebook_path = rules_dir / 'rulebook.txt'
    
    # Create rules directory if it doesn't exist
    rules_dir.mkdir(exist_ok=True)
    
    if not rulebook_path.exists():
        logger.warning(f"Rulebook not found at {rulebook_path}. Using placeholder data.")
        return [
            {
                "title": "Game Setup",
                "section": "1",
                "text": "Basic game setup instructions..."
            }
        ]
    
    logger.info(f"Loading rulebook from {rulebook_path}")
    return parse_rulebook(str(rulebook_path))

async def main():
    try:
        logger.info("Starting vector database build process")
        
        # Initialize vector database
        vector_db = VectorDB()
        logger.info("Setting up vector database collections")
        vector_db.setup_collections()
        
        # Get all cards from SQLite
        logger.info("Fetching cards from SQLite database")
        cards = await get_all_cards()
        logger.info(f"Retrieved {len(cards)} cards for processing")
        
        # Get rulebook sections
        logger.info("Loading rulebook sections")
        rules = get_rulebook_sections()
        logger.info(f"Found {len(rules)} rulebook sections")
        
        # Index rulebook first
        logger.info("Indexing rulebook sections")
        await vector_db.index_rules(rules)
        
        # Then index cards
        logger.info("Starting card indexing process")
        for i, card in enumerate(cards, 1):
            try:
                await vector_db.index_card(card)
                if i % 10 == 0:  # Log progress every 10 cards
                    logger.info(f"Processed {i}/{len(cards)} cards")
            except Exception as e:
                logger.error(f"Error processing card {card.get('name', 'Unknown')}: {e}")
                continue
        
        logger.info("Vector database build completed successfully!")
        
    except Exception as e:
        logger.error(f"Error building vector database: {e}")
        raise

if __name__ == "__main__":
    asyncio.run(main())