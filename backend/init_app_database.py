# init_app_database.py
import sys
import os
import importlib

# Add src directory to Python path
script_dir = os.path.dirname(__file__)
src_path = os.path.abspath(os.path.join(script_dir, 'src'))
if src_path not in sys.path:
    sys.path.insert(0, src_path)

# --- Import Base from base.py FIRST ---
print("Importing database.base to define Base...")
import database.base
print(f"Base object ID after base import: {id(database.base.Base)}")

# --- Import models (they will import Base from base.py) ---
print("Importing database.models...")
import database.models
print(f"Base object ID accessed via models: {id(database.models.Base)}") # SHOULD BE SAME NOW

# --- Import db last (it also needs Base from base.py) ---
print("Importing database.db...")
import database.db
print(f"Base object ID accessed via db: {id(database.db.Base)}") # SHOULD BE SAME NOW

# --- Check metadata from the original source (base.py) ---
print(f"Tables known to database.base.Base.metadata: {list(database.base.Base.metadata.tables.keys())}")

if __name__ == "__main__":
    print("\nAttempting to initialize application database schema...")

    # Check metadata from the single source of truth
    if not database.base.Base.metadata.tables:
         print("!!! WARNING: Metadata is still empty after imports. Aborting.")
    else:
        # --- Code to remove existing db file ---
        try:
             home_dir = os.path.expanduser("~")
             app_db_path = os.path.join(home_dir, '.swu', 'swu_app.db')
             if os.path.exists(app_db_path):
                 print(f"Removing existing application database: {app_db_path}")
                 os.remove(app_db_path)
        except OSError as e:
             print(f"Error removing existing database: {e}")

        # --- Call init_app_db, passing the metadata from base.py ---
        print(f"Calling init_app_db with metadata from Base ID: {id(database.base.Base)}")
        database.db.init_app_db(database.base.Base.metadata) # Pass the correct metadata

    print("-" * 20)
    print("Script finished. Check logs above for details.")
    print("Make sure the database file (~/.swu/swu_app.db) was created/updated.")
    print("-" * 20)