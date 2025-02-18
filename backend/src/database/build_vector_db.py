import sqlite3
import os
import asyncio
from ..api.vector_db import VectorDB
from .rules_parser import parse_rulebook
import logging
from typing import List, Dict

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def get_all_cards() -> List[Dict]:
    """Fetch all cards from the SQLite database with their related data."""
    # Get the database path from the user's home directory
    home_dir = os.path.expanduser("~")
    db_path = os.path.join(home_dir, '.swu', 'swu_cards.db')
    
    if not os.path.exists(db_path):
        raise FileNotFoundError(f"Database not found at {db_path}")
    
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    try:
        # Get all cards
        cards = []
        cursor.execute("SELECT * FROM cards")
        for row in cursor:
            card = dict(row)
            card_id = str(card["id"])
            
            # Get aspects
            cursor.execute(
                "SELECT aspect_name, aspect_color FROM card_aspects WHERE card_id = ?",
                [card_id]
            )
            card["aspects"] = [dict(row) for row in cursor.fetchall()]
            
            # Get keywords
            cursor.execute(
                "SELECT keyword FROM card_keywords WHERE card_id = ?",
                [card_id]
            )
            card["keywords"] = [row["keyword"] for row in cursor.fetchall()]
            
            # Get traits
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
    # Get the path to the rules directory
    current_dir = os.path.dirname(os.path.abspath(__file__))
    rules_dir = os.path.join(current_dir, '..', 'rules')
    rulebook_path = os.path.join(rules_dir, 'rulebook.txt')
    
    # Create rules directory if it doesn't exist
    os.makedirs(rules_dir, exist_ok=True)
    
    if not os.path.exists(rulebook_path):
        logger.warning(f"Rulebook not found at {rulebook_path}. Using placeholder data.")
        return [
            {
                "title": "Game Setup",
                "section": "1",
                "text": """
                To set up a game of Star Wars Unlimited:
                1. Each player chooses a Base and up to 2 Leaders
                2. Shuffle your deck of at least 50 cards
                3. Draw 7 cards for your starting hand
                4. Place your Base face-up in your Base zone
                5. Place your Leaders face-down in your Leader zone
                """
            },
            # ... other placeholder sections ...
        ]
    
    return parse_rulebook(rulebook_path)

async def main():
    try:
        # Initialize vector database
        vector_db = VectorDB()
        vector_db.setup_collections()
        
        # Get all cards from SQLite
        logger.info("Fetching cards from SQLite database...")
        cards = await get_all_cards()
        logger.info(f"Found {len(cards)} cards to process")
        
        # Get rulebook sections
        logger.info("Loading rulebook sections...")
        rules = get_rulebook_sections()
        logger.info(f"Found {len(rules)} rulebook sections to process")
        
        # Index rulebook first
        logger.info("Indexing rulebook sections...")
        await vector_db.index_rules(rules)
        
        # Then index cards
        logger.info("Indexing cards...")
        for i, card in enumerate(cards, 1):
            try:
                await vector_db.index_card(card)
                if i % 10 == 0:  # Log progress every 10 cards
                    logger.info(f"Processed {i}/{len(cards)} cards")
            except Exception as e:
                logger.error(f"Error processing card {card.get('name')}: {e}")
                continue
        
        logger.info("Vector database build completed successfully!")
        
    except Exception as e:
        logger.error(f"Error building vector database: {e}")
        raise

if __name__ == "__main__":
    asyncio.run(main()) 