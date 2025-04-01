# src/database/db.py
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from .base import Base
import logging # Add logging

print(f"--- Executing src/database/db.py ---")
print(f"--- Imported Base in db.py - ID: {id(Base)} ---")

# --- Configure Logging specifically for DB operations ---
# Use a distinct logger name
db_conn_logger = logging.getLogger("db_connections")
# Set level to DEBUG to catch everything (adjust handler level if needed)
db_conn_logger.setLevel(logging.DEBUG)
# Ensure logs propagate to root logger configured by FastAPI/Uvicorn
db_conn_logger.propagate = True
# Add a handler if running standalone or if root config doesn't catch it
# stream_handler = logging.StreamHandler()
# stream_formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
# stream_handler.setFormatter(stream_formatter)
# if not db_conn_logger.handlers:
#     db_conn_logger.addHandler(stream_handler)

# --- Card Database Configuration ---
home_dir = os.path.expanduser("~")
card_db_dir = os.path.join(home_dir, '.swu')
card_db_path = os.path.join(card_db_dir, 'swu_cards.db')
CARD_DB_URL = f"sqlite:///{card_db_path}"

card_engine = create_engine(CARD_DB_URL, connect_args={"check_same_thread": False})
CardSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=card_engine)
db_conn_logger.info(f"Card DB Engine created for URL: {CARD_DB_URL}")

# --- Application Database Configuration ---
app_db_dir = card_db_dir
app_db_path = os.path.join(app_db_dir, 'swu_app.db')
APP_DB_URL = f"sqlite:///{app_db_path}"

app_engine = create_engine(APP_DB_URL, connect_args={"check_same_thread": False})
AppSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=app_engine)
db_conn_logger.info(f"App DB Engine created for URL: {APP_DB_URL}") # Log creation

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
    db_conn_logger.info(f"get_app_db requested connection to: {APP_DB_URL}") # Log request
    db = AppSessionLocal()
    db_conn_logger.debug(f"App DB Session created: {id(db)} bound to {db.get_bind().url}")
    try:
        yield db
    finally:
        db_conn_logger.debug(f"Closing App DB Session: {id(db)}")
        db.close()

# --- Database Initialization ---
def init_app_db(metadata_obj):
    # ... (keep previous logging here) ...
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