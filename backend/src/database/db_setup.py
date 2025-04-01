# Create db_setup.py
import sqlite3
import os
from .import_sample_data import import_sample_data

home_dir = os.path.expanduser("~")
db_dir = os.path.join(home_dir, '.swu')
# Ensure this path is EXACTLY the one for the CARD database
db_path = os.path.join(db_dir, 'swu_cards.db')

def setup_card_db(): # Renamed for clarity
    # Ensure the directory exists (optional, but good practice)
    os.makedirs(db_dir, exist_ok=True)

    # Remove existing database if it exists
    if os.path.exists(db_path):
         print(f"Removing existing CARD database at: {db_path}")
         os.remove(db_path)
    else:
         print(f"Creating new CARD database at: {db_path}")

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Drop all existing tables first
    cursor.executescript('''
        DROP TABLE IF EXISTS card_arenas;
        DROP TABLE IF EXISTS card_traits;
        DROP TABLE IF EXISTS card_keywords;
        DROP TABLE IF EXISTS card_aspects;
        DROP TABLE IF EXISTS price_history;
        DROP TABLE IF EXISTS cards;
        -- DO NOT DROP users, decks etc. here

    ''')
    
    # Create cards table only
    cursor.execute('''
    CREATE TABLE cards (
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
    )
    ''')
    
    # Create card_aspects table
    cursor.execute('''
    CREATE TABLE card_aspects (
        card_id TEXT,
        aspect_name TEXT,
        aspect_color TEXT,
        PRIMARY KEY (card_id, aspect_name),
        FOREIGN KEY (card_id) REFERENCES cards(id)
    )
    ''')
    
    # Create card_keywords table
    cursor.execute('''
    CREATE TABLE card_keywords (
        card_id TEXT,
        keyword TEXT,
        PRIMARY KEY (card_id, keyword),
        FOREIGN KEY (card_id) REFERENCES cards(id)
    )
    ''')
    
    # Create card_traits table
    cursor.execute('''
    CREATE TABLE card_traits (
        card_id TEXT,
        trait TEXT,
        PRIMARY KEY (card_id, trait),
        FOREIGN KEY (card_id) REFERENCES cards(id)
    )
    ''')
    
    # Create card_arenas table
    cursor.execute('''
    CREATE TABLE card_arenas (
        card_id TEXT,
        arena TEXT,
        PRIMARY KEY (card_id, arena),
        FOREIGN KEY (card_id) REFERENCES cards(id)
    )
    ''')
    
    # Create price_history table
    cursor.execute('''
    CREATE TABLE price_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        card_id TEXT,
        price_usd REAL,
        source TEXT,
        timestamp TEXT,
        FOREIGN KEY (card_id) REFERENCES cards(id)
    )
    ''')
    
    # Create indices for better performance
    cursor.executescript('''
        CREATE INDEX idx_cards_name ON cards(name);
        CREATE INDEX idx_cards_type ON cards(type);
        CREATE INDEX idx_card_aspects_card_id ON card_aspects(card_id);
        CREATE INDEX idx_card_keywords_card_id ON card_keywords(card_id);
        CREATE INDEX idx_card_traits_card_id ON card_traits(card_id);
        CREATE INDEX idx_card_arenas_card_id ON card_arenas(card_id);
    ''')
    
    conn.commit()
    conn.close()
    print("CARD Database setup completed successfully!")
    
    # Import sample data into the CARD database
    # Ensure import_sample_data uses the correct db_path
    import_sample_data(db_path) # Pass path explicitly if needed

if __name__ == '__main__':
    setup_card_db()