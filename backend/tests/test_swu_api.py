import logging
from swu_api_client import SWUApiClient
import sqlite3
import json

# Set up detailed logging to see what's happening
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

def test_api_connection():
    """Test the basic API connection and first page of results"""
    client = SWUApiClient()
    
    logging.info("Testing API connection...")
    try:
        # Fetch first page of cards
        first_page = client.fetch_cards(page=1, page_size=1)
        logging.info("Successfully connected to API")
        logging.info(f"Response metadata: {json.dumps(first_page.get('meta', {}), indent=2)}")
        
        # Look at the first card's structure
        if first_page.get('data'):
            sample_card = first_page['data'][0]
            logging.info("\nSample card structure:")
            logging.info(json.dumps(sample_card, indent=2))
        
        return True
    except Exception as e:
        logging.error(f"API connection failed: {e}")
        return False

def test_database_creation():
    """Test database creation and initial structure"""
    client = SWUApiClient()
    
    logging.info("\nChecking database structure...")
    try:
        conn = sqlite3.connect(client.database_path)
        cursor = conn.cursor()
        
        # Get list of tables
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = cursor.fetchall()
        logging.info("Created tables:")
        for table in tables:
            logging.info(f"- {table[0]}")
            # Show table structure
            cursor.execute(f"PRAGMA table_info({table[0]})")
            columns = cursor.fetchall()
            for col in columns:
                logging.info(f"  - {col[1]} ({col[2]})")
        
        conn.close()
        return True
    except Exception as e:
        logging.error(f"Database creation failed: {e}")
        return False

def test_card_import(limit=5):
    """Test importing a small number of cards"""
    client = SWUApiClient()
    
    logging.info(f"\nTesting card import (limit: {limit} cards)...")
    try:
        # Fetch and process a few cards
        response_data = client.fetch_cards(page=1, page_size=limit)
        cards = response_data.get("data", [])
        
        logging.info(f"Successfully fetched {len(cards)} cards")
        
        # Process each card
        for card in cards:
            processed = client.process_card_data(card)
            logging.info(f"\nProcessed card: {processed['name']}")
            logging.info(f"- Type: {processed['type']}")
            logging.info(f"- Energy Cost: {processed['energy_cost']}")
            logging.info(f"- Faction: {processed['faction']}")
        
        return True
    except Exception as e:
        logging.error(f"Card import failed: {e}")
        return False

def main():
    logging.info("Starting API and database tests...")
    
    # Run tests in sequence
    tests = [
        ("API Connection", test_api_connection),
        ("Database Creation", test_database_creation),
        ("Card Import", test_card_import)
    ]
    
    for test_name, test_func in tests:
        logging.info(f"\n{'='*20} Testing {test_name} {'='*20}")
        success = test_func()
        logging.info(f"{test_name}: {'✓ Passed' if success else '✗ Failed'}")

if __name__ == "__main__":
    main()
