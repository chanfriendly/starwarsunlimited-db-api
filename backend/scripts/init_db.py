# backend/scripts/init_db.py

import os
import sys
import logging

# Add the parent directory to the path so we can import the application modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.database.db import get_app_db, get_card_db, app_engine, card_engine
from src.database.models import Base
from sqlalchemy import text

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("db_init")

def init_app_db():
    """Initialize application database tables"""
    logger.info("Initializing application database tables...")
    
    # Create all tables in the app database
    Base.metadata.create_all(bind=app_engine)
    logger.info("Application database tables created successfully")

def init_card_db():
    """Initialize card database tables"""
    logger.info("Initializing card database tables...")
    
    # Using a more direct approach with SQL to create tables
    # since the Card model might be defined differently
    with card_engine.connect() as conn:
        # Check if cards table exists
        result = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='cards'"))
        if not result.fetchone():
            logger.info("Creating cards table and related tables...")
            
            # Create cards table
            conn.execute(text("""
            CREATE TABLE IF NOT EXISTS cards (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                type TEXT,
                energy_cost INTEGER,
                cost INTEGER,
                power INTEGER,
                health INTEGER,
                image_uri TEXT,
                image_url TEXT,
                text TEXT,
                set_code TEXT,
                set_name TEXT,
                card_number TEXT,
                rarity TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
            """))
            
            # Create card_aspects table
            conn.execute(text("""
            CREATE TABLE IF NOT EXISTS card_aspects (
                card_id TEXT NOT NULL,
                aspect_name TEXT NOT NULL,
                aspect_color TEXT,
                PRIMARY KEY (card_id, aspect_name),
                FOREIGN KEY (card_id) REFERENCES cards(id)
            )
            """))
            
            # Create card_keywords table
            conn.execute(text("""
            CREATE TABLE IF NOT EXISTS card_keywords (
                card_id TEXT NOT NULL,
                keyword TEXT NOT NULL,
                PRIMARY KEY (card_id, keyword),
                FOREIGN KEY (card_id) REFERENCES cards(id)
            )
            """))
            
            # Insert some sample card data so the API works
            conn.execute(text("""
            INSERT INTO cards (id, name, type, cost, power, health, image_url, text, set_code)
            VALUES 
                ('1', 'Darth Vader', 'Leader', 5, 4, 4, 'https://cdn.jsdelivr.net/gh/JimJafar/SWU-images@main/cards/D20-001.webp', 'Villainous. After you play a card, deal 1 damage to target undefeated unit.', 'D20'),
                ('2', 'Luke Skywalker', 'Leader', 5, 3, 5, 'https://cdn.jsdelivr.net/gh/JimJafar/SWU-images@main/cards/D20-012.webp', 'Valiant. After an opponent plays a card, heal 1 damage from target undefeated unit.', 'D20')
            """))
            
            # Insert aspect data for sample cards
            conn.execute(text("""
            INSERT INTO card_aspects (card_id, aspect_name, aspect_color)
            VALUES 
                ('1', 'Command', '#e74c3c'),
                ('1', 'Villainy', '#34495e'),
                ('2', 'Heroism', '#3498db'),
                ('2', 'Force', '#9b59b6')
            """))
            
            # Insert keyword data for sample cards
            conn.execute(text("""
            INSERT INTO card_keywords (card_id, keyword)
            VALUES 
                ('1', 'Villainous'),
                ('2', 'Valiant')
            """))
            
            conn.commit()
            logger.info("Sample card data inserted successfully")
        else:
            logger.info("Card database tables already exist")

def main():
    """Main initialization function"""
    logger.info("Starting database initialization...")
    
    # Initialize both databases
    init_app_db()
    init_card_db()
    
    logger.info("Database initialization complete")

if __name__ == "__main__":
    main()