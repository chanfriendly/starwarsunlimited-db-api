# backend/src/database/db.py
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from .base import Base
import logging 
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
load_dotenv()

# Configure logging
db_conn_logger = logging.getLogger("db_connections")
db_conn_logger.setLevel(logging.DEBUG)
db_conn_logger.propagate = True

print(f"--- Executing src/database/db.py ---")
print(f"--- Imported Base in db.py - ID: {id(Base)} ---")

# --- Database Directory Configuration ---
# Get the database directory from environment or use default
db_dir = os.environ.get("DB_DIR")

if db_dir is None:
    # If no DB_DIR is set, use home directory (for local development)
    home_dir = os.path.expanduser("~")
    db_dir = os.path.join(home_dir, '.swu')
else:
    # Use the provided DB_DIR (for Docker/production)
    db_dir = os.path.abspath(db_dir)

print(f"Database directory: {db_dir}")

# Ensure directory exists
os.makedirs(db_dir, exist_ok=True)

# --- Card Database Configuration ---
card_db_url = os.environ.get("CARD_DATABASE_URL")
if card_db_url is None:
    # Default path if not specified
    card_db_path = os.path.join(db_dir, 'swu_cards.db')
    card_db_url = f"sqlite:///{card_db_path}"

print(f"Card database URL: {card_db_url}")

# --- Application Database Configuration ---
app_db_url = os.environ.get("DATABASE_URL")
if app_db_url is None:
    # Default path if not specified
    app_db_path = os.path.join(db_dir, 'swu_app.db')
    app_db_url = f"sqlite:///{app_db_path}"

print(f"App database URL: {app_db_url}")

# Validate that SQLite database files can be created/accessed
def validate_db_path(url: str, name: str) -> str:
    """Validate that the database path is accessible and create parent directories if needed."""
    if url.startswith('sqlite:///'):
        # Extract file path from SQLite URL
        file_path = url.replace('sqlite:///', '')
        
        # Handle the case where the URL starts with sqlite://// (four slashes)
        if url.startswith('sqlite:////'):
            file_path = url.replace('sqlite:///', '')
        
        # Create parent directory if it doesn't exist
        parent_dir = os.path.dirname(file_path)
        if parent_dir:
            os.makedirs(parent_dir, exist_ok=True)
            print(f"Ensured directory exists: {parent_dir}")
        
        # Test write permissions
        try:
            # Try to create the database file if it doesn't exist
            if not os.path.exists(file_path):
                # Touch the file to test write permissions
                Path(file_path).touch()
                print(f"Created {name} database file: {file_path}")
            else:
                print(f"{name} database file already exists: {file_path}")
                
        except Exception as e:
            print(f"ERROR: Cannot access {name} database at {file_path}: {e}")
            raise
    
    return url

# Validate database paths
card_db_url = validate_db_path(card_db_url, "Card")
app_db_url = validate_db_path(app_db_url, "Application")

# Create database engines
try:
    card_engine = create_engine(card_db_url, connect_args={"check_same_thread": False})
    CardSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=card_engine)
    db_conn_logger.info(f"Card DB Engine created successfully for URL: {card_db_url}")
except Exception as e:
    print(f"ERROR: Failed to create card database engine: {e}")
    raise

try:
    app_engine = create_engine(app_db_url, connect_args={"check_same_thread": False})
    AppSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=app_engine)
    db_conn_logger.info(f"App DB Engine created successfully for URL: {app_db_url}")
except Exception as e:
    print(f"ERROR: Failed to create app database engine: {e}")
    raise

# Database dependency for FastAPI
def get_card_db():
    """Dependency to get card database session."""
    db = CardSessionLocal()
    session_id = id(db)
    db_conn_logger.debug(f"Card DB Session created: {session_id} bound to {card_db_url}")
    try:
        yield db
    finally:
        db_conn_logger.debug(f"Closing Card DB Session: {session_id}")
        db.close()

def get_app_db():
    """Dependency to get application database session."""
    db = AppSessionLocal()
    session_id = id(db)
    db_conn_logger.debug(f"App DB Session created: {session_id} bound to {app_db_url}")
    try:
        yield db
    finally:
        db_conn_logger.debug(f"Closing App DB Session: {session_id}")
        db.close()

def init_card_db(metadata=None):
    """Initialize the card database with the provided metadata."""
    if metadata is None:
        metadata = Base.metadata
    print(f"Creating card database tables with metadata from Base ID: {id(Base)}")
    print(f"Tables to create: {list(metadata.tables.keys())}")
    metadata.create_all(bind=card_engine)
    print("Card database tables created successfully.")

def init_app_db(metadata=None):
    """Initialize the application database with the provided metadata."""
    if metadata is None:
        metadata = Base.metadata
    print(f"Creating app database tables with metadata from Base ID: {id(Base)}")
    print(f"Tables to create: {list(metadata.tables.keys())}")
    metadata.create_all(bind=app_engine)
    print("Application database tables created successfully.")

print("Database configuration completed successfully.")