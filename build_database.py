# build_database.py

from swu_api_client import SWUApiClient
import logging
from datetime import datetime
import sqlite3

def verify_database(database_path: str):
    """Verify the database contents and provide a summary."""
    conn = sqlite3.connect(database_path)
    cursor = conn.cursor()
    
    logging.info("\nDatabase Verification Results:")
    
    # Check main cards table
    cursor.execute("SELECT COUNT(*) FROM cards")
    total_cards = cursor.fetchone()[0]
    logging.info(f"Total cards in database: {total_cards}")
    
    # Check card type distribution
    cursor.execute("SELECT type, COUNT(*) FROM cards GROUP BY type ORDER BY COUNT(*) DESC")
    logging.info("\nCard Type Distribution:")
    for card_type, count in cursor.fetchall():
        logging.info(f"  {card_type}: {count}")
    
    # Check related data tables
    cursor.execute("SELECT COUNT(*) FROM card_aspects")
    total_aspects = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM card_keywords")
    total_keywords = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM card_traits")
    total_traits = cursor.fetchone()[0]
    
    logging.info("\nRelated Data Counts:")
    logging.info(f"  Aspects: {total_aspects}")
    logging.info(f"  Keywords: {total_keywords}")
    logging.info(f"  Traits: {total_traits}")
    
    # Check for any cards missing critical data
    cursor.execute("""
        SELECT COUNT(*) FROM cards 
        WHERE name IS NULL 
           OR type IS NULL 
           OR image_uri IS NULL
    """)
    missing_data = cursor.fetchone()[0]
    logging.info(f"\nCards with missing critical data: {missing_data}")
    
    conn.close()

def main():
    # Set up logging to both file and console
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler('database_build.log'),
            logging.StreamHandler()
        ]
    )
    
    start_time = datetime.now()
    database_path = "swu_cards.db"
    logging.info(f"Starting database build at {start_time}")
    
    try:
        # Initialize the client and build the database
        client = SWUApiClient(database_path)
        total_cards = client.fetch_cards()
        
        # Verify the database contents
        verify_database(database_path)
        
        # Log completion information
        end_time = datetime.now()
        duration = end_time - start_time
        
        logging.info(f"\nBuild Summary:")
        logging.info(f"Database build completed at {end_time}")
        logging.info(f"Total time: {duration}")
        logging.info(f"Total cards processed: {total_cards}")
        
    except Exception as e:
        logging.error(f"Database build failed: {e}")
        raise

if __name__ == "__main__":
    main()