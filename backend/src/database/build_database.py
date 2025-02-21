# build_database.py

from ..api.swu_api_client import SWUApiClient
import logging
from datetime import datetime
import sqlite3
import os

def verify_database(database_path: str):
    """Verify the database contents and provide a summary."""
    conn = sqlite3.connect(database_path)
    cursor = conn.cursor()
    
    logging.info("\nDatabase Verification Results:")
    
    try:
        # Check main cards table
        cursor.execute("SELECT COUNT(*) FROM cards")
        total_cards = cursor.fetchone()[0]
        logging.info(f"Total cards in database: {total_cards}")
        
        # Check card type distribution
        cursor.execute("SELECT type, COUNT(*) FROM cards GROUP BY type ORDER BY COUNT(*) DESC")
        logging.info("\nCard Type Distribution:")
        for card_type, count in cursor.fetchall():
            logging.info(f"  {card_type}: {count}")
        
        # Check for data integrity issues
        integrity_checks = [
            ("Cards missing names", "SELECT COUNT(*) FROM cards WHERE name IS NULL"),
            ("Cards missing types", "SELECT COUNT(*) FROM cards WHERE type IS NULL"),
            ("Cards missing images", "SELECT COUNT(*) FROM cards WHERE image_uri IS NULL"),
            ("Leaders missing epic actions", "SELECT COUNT(*) FROM cards WHERE type='Leader' AND epic_action IS NULL"),
            ("Units missing power", "SELECT COUNT(*) FROM cards WHERE type='Unit' AND attack IS NULL"),
            ("Cards missing set info", "SELECT COUNT(*) FROM cards WHERE set_name IS NULL OR set_code IS NULL"),
        ]
        
        logging.info("\nData Integrity Checks:")
        for check_name, query in integrity_checks:
            cursor.execute(query)
            count = cursor.fetchone()[0]
            logging.info(f"  {check_name}: {count}")
        
        # Check related data consistency
        logging.info("\nRelated Data Consistency:")
        cursor.execute("""
            SELECT 
                (SELECT COUNT(DISTINCT card_id) FROM card_aspects) as cards_with_aspects,
                (SELECT COUNT(DISTINCT card_id) FROM card_keywords) as cards_with_keywords,
                (SELECT COUNT(DISTINCT card_id) FROM card_traits) as cards_with_traits,
                (SELECT COUNT(DISTINCT card_id) FROM card_arenas) as cards_with_arenas
        """)
        counts = cursor.fetchone()
        logging.info(f"  Cards with aspects: {counts[0]}")
        logging.info(f"  Cards with keywords: {counts[1]}")
        logging.info(f"  Cards with traits: {counts[2]}")
        logging.info(f"  Cards with arenas: {counts[3]}")
        
    finally:
        conn.close()

def main():
    # Set up logging with debug level
    logging.basicConfig(
        filename='database_build.log',
        level=logging.DEBUG,  # Changed from INFO to DEBUG
        format='%(asctime)s - %(levelname)s - %(message)s'
    )
    
    # Get the absolute path to the database file
    current_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.dirname(os.path.dirname(current_dir))
    database_path = os.path.join(backend_dir, 'swu_cards.db')
    
    logging.info(f"Starting database build at {datetime.now()}")
    logging.info(f"Using database at: {database_path}")
    
    try:
        # Initialize the client and build the database
        client = SWUApiClient(database_path=database_path)
        client.build_database()
        
        # Close the client's connection before verifying
        client._close_db_connection()
        
        # Now verify the database contents
        verify_database(database_path)
        
        # Log completion information
        logging.info(f"\nBuild Summary:")
        logging.info(f"Database build completed at {datetime.now()}")
        
    except Exception as e:
        logging.error(f"Database build failed: {e}")
        raise

if __name__ == "__main__":
    main()