# src/database/db.py
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
# Get the database directory from environment or use default in home directory
home_dir = os.path.expanduser("~")
card_db_dir = os.environ.get("DB_DIR", os.path.join(home_dir, '.swu'))

# Ensure directory exists
os.makedirs(card_db_dir, exist_ok=True)

# --- Card Database Configuration ---
card_db_path = os.path.join(card_db_dir, 'swu_cards.db')
CARD_DB_URL = os.environ.get("CARD_DATABASE_URL", f"sqlite:///{card_db_path}")

# Normalize SQLite URLs
if CARD_DB_URL.startswith("sqlite:///") and not CARD_DB_URL.startswith("sqlite:////"):
    # Handle relative paths by making them absolute
    if CARD_DB_URL.startswith("sqlite:///~/"):
        CARD_DB_URL = CARD_DB_URL.replace("sqlite:///~/", f"sqlite:///{home_dir}/")
    else:
        # Make other relative paths absolute based on current directory
        relative_path = CARD_DB_URL.replace("sqlite:///", "")
        absolute_path = os.path.abspath(relative_path)
        CARD_DB_URL = f"sqlite:///{absolute_path}"

card_engine = create_engine(CARD_DB_URL, connect_args={"check_same_thread": False})
CardSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=card_engine)
db_conn_logger.info(f"Card DB Engine created for URL: {CARD_DB_URL}")

# --- Application Database Configuration ---
app_db_path = os.path.join(card_db_dir, 'swu_app.db')
APP_DB_URL = os.environ.get("DATABASE_URL", f"sqlite:///{app_db_path}")

# Normalize SQLite URLs for app database too
if APP_DB_URL.startswith("sqlite:///") and not APP_DB_URL.startswith("sqlite:////"):
    # Handle relative paths by making them absolute
    if APP_DB_URL.startswith("sqlite:///~/"):
        APP_DB_URL = APP_DB_URL.replace("sqlite:///~/", f"sqlite:///{home_dir}/")
    else:
        # Make other relative paths absolute based on current directory
        relative_path = APP_DB_URL.replace("sqlite:///", "")
        absolute_path = os.path.abspath(relative_path)
        APP_DB_URL = f"sqlite:///{absolute_path}"

app_engine = create_engine(APP_DB_URL, connect_args={"check_same_thread": False})
AppSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=app_engine)
db_conn_logger.info(f"App DB Engine created for URL: {APP_DB_URL}") 

# --- Dependency Injectors ---
def get_card_db():
    db_conn_logger.debug(f"get_card_db requested connection to: {CARD_DB_URL}")
    db = CardSessionLocal()
    try:
        yield db
    finally:
        db_conn_logger.debug(f"Closing Card DB Session: {id(db)}")
        db.close()

def get_app_db():
    db_conn_logger.info(f"get_app_db requested connection to: {APP_DB_URL}") 
    db = AppSessionLocal()
    db_conn_logger.debug(f"App DB Session created: {id(db)} bound to {db.get_bind().url}")
    try:
        yield db
    finally:
        db_conn_logger.debug(f"Closing App DB Session: {id(db)}")
        db.close()

# --- Database Initialization ---
def init_app_db(metadata_obj):
    print(f"Initializing Application DB schema at: {app_db_path}")
    print(f"Using metadata object ID: {id(metadata_obj)}")
    print(f"Tables known to this metadata: {list(metadata_obj.tables.keys())}")
    print(f"Creating tables on engine: {app_engine.url}")
    try:
        metadata_obj.create_all(bind=app_engine)
        print("Application DB schema initialization complete.")
    except Exception as e:
        import sys
        print(f"!!! ERROR during create_all: {e}", file=sys.stderr)