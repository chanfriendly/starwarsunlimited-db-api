# swu_api_client.py

import requests
import sqlite3
from datetime import datetime
import time
from typing import Dict, List, Optional, Tuple
import logging
from urllib.parse import urljoin

class SWUApiClient:
    """Client for interacting with the Star Wars Unlimited official API.
    
    This client handles fetching card data from the Star Wars Unlimited API and storing
    it in a local SQLite database. It manages different card types (Leaders, Bases, Units)
    and their associated data (aspects, keywords, traits, arenas).
    """
    
    BASE_URL = "https://admin.starwarsunlimited.com/api/"
    
    def __init__(self, database_path: str = "swu_cards.db"):
        """Initialize the API client with database connection and session management.
        
        Args:
            database_path: Path to the SQLite database file. Defaults to "swu_cards.db".
        """
        self.database_path = database_path
        self.session = requests.Session()
        self._db_connection = None  # Database connection is managed as a single instance
        
        # Set up default headers for API requests
        self.session.headers.update({
            "Accept": "application/json",
            "Origin": "https://starwarsunlimited.com",
            "Referer": "https://starwarsunlimited.com/"
        })
        
        # Configure logging to track operations and debugging
        logging.basicConfig(
            filename='swu_api.log',
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s'
        )
        
        # Initialize database schema
        self._init_database()

    def _get_db_connection(self):
        """Get a database connection, creating it if necessary.
        
        Returns:
            sqlite3.Connection: An active database connection.
        """
        if self._db_connection is None:
            self._db_connection = sqlite3.connect(self.database_path)
        return self._db_connection
        
    def _close_db_connection(self):
        """Close the database connection if it exists."""
        if self._db_connection is not None:
            self._db_connection.close()
            self._db_connection = None

    def _init_database(self):
        """Initialize database with enhanced schema to capture all card information.
        
        Creates tables for:
        - cards: Main card information
        - price_history: Historical price tracking
        - card_aspects: Card factions/alignments
        - card_keywords: Card abilities
        - card_traits: Card characteristics
        - card_arenas: Where cards can be played
        """
        conn = self._get_db_connection()
        cursor = conn.cursor()
        
        # First, drop all existing tables to ensure a clean slate
        cursor.executescript('''
            DROP TABLE IF EXISTS card_arenas;
            DROP TABLE IF EXISTS card_traits;
            DROP TABLE IF EXISTS card_keywords;
            DROP TABLE IF EXISTS card_aspects;
            DROP TABLE IF EXISTS price_history;
            DROP TABLE IF EXISTS cards;
        ''')
        
        # Create tables with enhanced schema
        cursor.executescript('''
            -- Main cards table with additional fields
            CREATE TABLE IF NOT EXISTS cards (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                subtitle TEXT,
                energy_cost INTEGER,
                type TEXT NOT NULL,
                type2 TEXT,
                rarity TEXT,
                text TEXT,
                text_styled TEXT,
                epic_action TEXT,
                deploy_box TEXT,
                attack INTEGER,
                health INTEGER,
                image_uri TEXT,
                image_back_uri TEXT,
                price_usd REAL,
                set_name TEXT,
                set_code TEXT,
                card_number TEXT,
                release_date TEXT,
                last_updated TEXT,
                is_unique BOOLEAN,
                artist TEXT,
                serial_code TEXT
            );
            
            -- Price history tracking for market analysis
            CREATE TABLE IF NOT EXISTS price_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                card_id TEXT,
                price_usd REAL,
                source TEXT,
                timestamp TEXT,
                FOREIGN KEY(card_id) REFERENCES cards(id)
            );
            
            -- Card aspects (factions/alignments) with colors
            CREATE TABLE IF NOT EXISTS card_aspects (
                card_id TEXT,
                aspect_name TEXT,
                aspect_color TEXT,
                FOREIGN KEY(card_id) REFERENCES cards(id),
                PRIMARY KEY(card_id, aspect_name)
            );
            
            -- Keywords (game mechanics and abilities)
            CREATE TABLE IF NOT EXISTS card_keywords (
                card_id TEXT,
                keyword TEXT,
                FOREIGN KEY(card_id) REFERENCES cards(id),
                PRIMARY KEY(card_id, keyword)
            );
            
            -- Traits (Force, Pilot, etc.)
            CREATE TABLE IF NOT EXISTS card_traits (
                card_id TEXT,
                trait TEXT,
                FOREIGN KEY(card_id) REFERENCES cards(id),
                PRIMARY KEY(card_id, trait)
            );
            
            -- Arenas (Ground, Space, etc.)
            CREATE TABLE IF NOT EXISTS card_arenas (
                card_id TEXT,
                arena TEXT,
                FOREIGN KEY(card_id) REFERENCES cards(id),
                PRIMARY KEY(card_id, arena)
            );
            
            -- Create indices for common queries
            CREATE INDEX IF NOT EXISTS idx_card_name ON cards(name);
            CREATE INDEX IF NOT EXISTS idx_card_type ON cards(type);
            CREATE INDEX IF NOT EXISTS idx_card_set ON cards(set_name);
            CREATE INDEX IF NOT EXISTS idx_card_cost ON cards(energy_cost);
        ''')
        
        conn.commit()

    def process_card_data(self, card_data: dict) -> Tuple[dict, dict]:
        """Transform API card data into our database format, handling different card types.
        
        Processes the complex nested API response into a flat structure suitable for
        database storage. Handles special cases for Leaders, Bases, and regular cards.
        
        Args:
            card_data: Raw card data from the API
            
        Returns:
            Tuple of (card_dict, related_data) where:
                card_dict: Main card information
                related_data: Associated data (aspects, keywords, etc.)
        """
        if not card_data:
            logging.warning("Received empty card data")
            return None, None
            
        attributes = card_data.get("attributes", {})
        if not attributes:
            logging.warning(f"Card {card_data.get('id')} has no attributes")
            return None, None

        # Get the card type to determine how to process it
        card_type = attributes.get("type", {}).get("data", {}).get("attributes", {}).get("name")
        logging.info(f"Processing card {attributes.get('title')} of type {card_type}")

        # Process images based on card type
        image_uri = None
        image_back_uri = None
        
        # Handle front image
        art_front = attributes.get("artFront", {}).get("data", {}).get("attributes", {})
        if art_front:
            image_uri = (art_front.get("formats", {}).get("card", {}).get("url") 
                        or art_front.get("url"))
        
        # Handle back image (mainly for leaders)
        if card_type == "Leader":
            art_back = attributes.get("artBack", {}).get("data", {}).get("attributes", {})
            if art_back:
                image_back_uri = (art_back.get("formats", {}).get("card", {}).get("url") 
                                or art_back.get("url"))

        # Base card dictionary with fields common to all types
        card_dict = {
            "id": str(card_data.get("id")),
            "name": attributes.get("title"),
            "subtitle": attributes.get("subtitle"),
            "type": card_type,
            "rarity": attributes.get("rarity", {}).get("data", {}).get("attributes", {}).get("name"),
            "text": attributes.get("text"),
            "image_uri": image_uri,
            "image_back_uri": image_back_uri,
            "set_name": attributes.get("expansion", {}).get("data", {}).get("attributes", {}).get("name"),
            "set_code": attributes.get("expansion", {}).get("data", {}).get("attributes", {}).get("code"),
            "card_number": attributes.get("cardNumber"),
            "serial_code": attributes.get("serialCode"),
            "last_updated": datetime.now().isoformat()
        }

        # Add type-specific attributes
        if card_type == "Leader":
            # Leaders have epic actions and deploy boxes
            card_dict.update({
                "epic_action": attributes.get("epicAction"),
                "deploy_box": attributes.get("deployBox"),
                "energy_cost": attributes.get("cost")
            })
        elif card_type == "Base":
            # Bases mainly have health
            card_dict.update({
                "health": attributes.get("hp"),
                "energy_cost": None  # Bases don't have energy cost
            })
        else:
            # Regular cards have standard attributes
            card_dict.update({
                "energy_cost": attributes.get("cost"),
                "attack": attributes.get("power"),
                "health": attributes.get("hp")
            })

        # Process related data (aspects, keywords, traits, arenas)
        related_data = {
            "aspects": [
                {
                    "card_id": card_dict["id"],
                    "aspect_name": aspect.get("attributes", {}).get("name"),
                    "aspect_color": aspect.get("attributes", {}).get("color")
                }
                for aspect in attributes.get("aspects", {}).get("data", []) or []
            ],
            "keywords": [
                {
                    "card_id": card_dict["id"],
                    "keyword": keyword.get("attributes", {}).get("name")
                }
                for keyword in attributes.get("keywords", {}).get("data", []) or []
            ],
            "traits": [
                {
                    "card_id": card_dict["id"],
                    "trait": trait.get("attributes", {}).get("name")
                }
                for trait in attributes.get("traits", {}).get("data", []) or []
            ],
            "arenas": [
                {
                    "card_id": card_dict["id"],
                    "arena": arena.get("attributes", {}).get("name")
                }
                for arena in attributes.get("arenas", {}).get("data", []) or []
            ]
        }

        return card_dict, related_data

    def store_card_data(self, card_dict: dict, related_data: dict):
        """Store card and its related data in the database.
        
        Handles insertion of both the main card data and all related information
        like aspects, keywords, traits, and arenas.
        
        Args:
            card_dict: Main card information to store
            related_data: Associated data to store in related tables
        """
        conn = self._get_db_connection()
        cursor = conn.cursor()
        
        try:
            # Insert main card data
            placeholders = ", ".join(["?"] * len(card_dict))
            columns = ", ".join(card_dict.keys())
            cursor.execute(
                f"INSERT OR REPLACE INTO cards ({columns}) VALUES ({placeholders})",
                list(card_dict.values())
            )
            
            # Insert related data
            for aspect in related_data["aspects"]:
                cursor.execute('''
                    INSERT OR REPLACE INTO card_aspects (card_id, aspect_name, aspect_color)
                    VALUES (?, ?, ?)
                ''', (aspect["card_id"], aspect["aspect_name"], aspect["aspect_color"]))
                
            for keyword in related_data["keywords"]:
                cursor.execute('''
                    INSERT OR REPLACE INTO card_keywords (card_id, keyword)
                    VALUES (?, ?)
                ''', (keyword["card_id"], keyword["keyword"]))
                
            for trait in related_data["traits"]:
                cursor.execute('''
                    INSERT OR REPLACE INTO card_traits (card_id, trait)
                    VALUES (?, ?)
                ''', (trait["card_id"], trait["trait"]))
                
            for arena in related_data["arenas"]:
                cursor.execute('''
                    INSERT OR REPLACE INTO card_arenas (card_id, arena)
                    VALUES (?, ?)
                ''', (arena["card_id"], arena["arena"]))
            
            conn.commit()
            
        except Exception as e:
            logging.error(f"Error storing card data: {e}")
            conn.rollback()
            raise

    def fetch_cards(self, page: int = 1, page_size: int = 40) -> dict:
        """Fetch a page of cards from the API.
        
        Makes the actual API request with appropriate parameters and error handling.
        
        Args:
            page: Page number to fetch. Defaults to 1.
            page_size: Number of cards per page. Defaults to 40.
            
        Returns:
            dict: API response containing card data
        """
        endpoint = urljoin(self.BASE_URL, "card-list")
        logging.info(f"Fetching cards from API: page={page}, page_size={page_size}")
        
        params = {
            "locale": "en",
            "orderBy[expansion][id]": "asc",
            "sort[0]": "type.sortValue:asc,expansion.sortValue:desc,cardNumber:asc",
            "filters[variantOf][id][$null]": "true",
            "pagination[page]": page,
            "pagination[pageSize]": page_size
        }
        
        try:
            response = self.session.get(endpoint, params=params)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            logging.error(f"API request failed: {e}")
            raise