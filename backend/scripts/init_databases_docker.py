#!/usr/bin/env python3
"""
Docker-compatible database initialization script
This script can build databases in any environment, including Docker containers.
"""

import os
import sys
import logging
from pathlib import Path

# Add the backend source to the path
sys.path.insert(0, '/app')
sys.path.insert(0, '/app/src')
sys.path.insert(0, '/app/scripts')

def setup_logging():
    """Configure logging for the database build process."""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(sys.stdout),
            logging.FileHandler('/app/database_build.log', mode='w')
        ]
    )

def ensure_database_directory():
    """Ensure the database directory exists and is writable."""
    # Get database directory from environment
    db_dir = os.environ.get('DB_DIR', '/data/.swu')
    
    logging.info(f"Database directory: {db_dir}")
    
    # Create directory if it doesn't exist
    os.makedirs(db_dir, exist_ok=True)
    
    # Verify write permissions
    try:
        test_file = os.path.join(db_dir, '.write_test')
        Path(test_file).touch()
        os.remove(test_file)
        logging.info(f"✅ Database directory is writable: {db_dir}")
    except Exception as e:
        logging.error(f"❌ Cannot write to database directory {db_dir}: {e}")
        raise
    
    return db_dir

def check_existing_databases(db_dir):
    """Check if databases already exist and have data."""
    card_db_path = os.path.join(db_dir, 'swu_cards.db')
    app_db_path = os.path.join(db_dir, 'swu_app.db')
    
    card_db_exists = os.path.exists(card_db_path)
    app_db_exists = os.path.exists(app_db_path)
    
    logging.info(f"Card database exists: {card_db_exists}")
    logging.info(f"App database exists: {app_db_exists}")
    
    # Check if card database has data
    card_db_has_data = False
    if card_db_exists:
        try:
            import sqlite3
            conn = sqlite3.connect(card_db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM cards")
            count = cursor.fetchone()[0]
            card_db_has_data = count > 0
            logging.info(f"Card database has {count} cards")
            conn.close()
        except Exception as e:
            logging.warning(f"Could not check card database: {e}")
    
    return {
        'card_db_exists': card_db_exists,
        'app_db_exists': app_db_exists,
        'card_db_has_data': card_db_has_data,
        'card_db_path': card_db_path,
        'app_db_path': app_db_path
    }

def build_card_database(db_dir):
    """Build the card database using the API client."""
    try:
        # Import the API client
        from swu_api_client import SWUApiClient
        
        card_db_path = os.path.join(db_dir, 'swu_cards.db')
        logging.info(f"Building card database at: {card_db_path}")
        
        # Create a modified version that uses our specified path
        class DockerSWUApiClient(SWUApiClient):
            def __init__(self, database_path):
                self.database_path = database_path
                self.session = __import__('requests').Session()
                self._db_connection = None
                
                # Set up default headers for API requests
                self.session.headers.update({
                    "Accept": "application/json",
                    "Origin": "https://starwarsunlimited.com",
                    "Referer": "https://starwarsunlimited.com/"
                })
                
                # Initialize database schema
                self._init_database()
            
            def _get_db_connection(self):
                """Override to use our specified path directly."""
                if self._db_connection is None:
                    import sqlite3
                    logging.info(f"Using database at: {self.database_path}")
                    
                    try:
                        # Create a new database connection
                        self._db_connection = sqlite3.connect(self.database_path)
                        self._db_connection.row_factory = sqlite3.Row
                        
                        # Set pragmas for better performance
                        self._db_connection.execute("PRAGMA foreign_keys = ON")
                        self._db_connection.execute("PRAGMA cache_size = -2000")  # Use 2MB cache
                        
                    except sqlite3.Error as e:
                        logging.error(f"Error connecting to database: {e}")
                        logging.error(f"Database path: {self.database_path}")
                        raise
                        
                return self._db_connection
        
        # Initialize client and build database
        client = DockerSWUApiClient(database_path=card_db_path)
        client.build_database()
        client._close_db_connection()
        
        logging.info("✅ Card database build completed successfully")
        return True
        
    except Exception as e:
        logging.error(f"❌ Card database build failed: {e}")
        import traceback
        logging.error(traceback.format_exc())
        return False

def initialize_app_database(db_dir):
    """Initialize the application database with tables."""
    try:
        # Set the database URL environment variables
        app_db_path = os.path.join(db_dir, 'swu_app.db')
        os.environ['DATABASE_URL'] = f'sqlite:///{app_db_path}'
        os.environ['DB_DIR'] = db_dir
        
        logging.info(f"Initializing app database at: {app_db_path}")
        
        # Import and initialize the database
        from src.database.db import init_app_db
        init_app_db()
        
        logging.info("✅ App database initialization completed successfully")
        return True
        
    except Exception as e:
        logging.error(f"❌ App database initialization failed: {e}")
        import traceback
        logging.error(traceback.format_exc())
        return False

def main():
    """Main database initialization function."""
    setup_logging()
    logging.info("🚀 Starting database initialization")
    
    try:
        # Ensure database directory exists
        db_dir = ensure_database_directory()
        
        # Check existing databases
        db_status = check_existing_databases(db_dir)
        
        # Build card database if needed
        if not db_status['card_db_has_data']:
            logging.info("📦 Building card database...")
            if not build_card_database(db_dir):
                logging.error("Failed to build card database")
                return False
        else:
            logging.info("✅ Card database already exists with data")
        
        # Initialize app database if needed
        if not db_status['app_db_exists']:
            logging.info("🔧 Initializing application database...")
            if not initialize_app_database(db_dir):
                logging.error("Failed to initialize app database")
                return False
        else:
            logging.info("✅ Application database already exists")
        
        logging.info("🎉 Database initialization completed successfully!")
        return True
        
    except Exception as e:
        logging.error(f"💥 Database initialization failed: {e}")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)