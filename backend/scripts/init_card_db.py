#!/usr/bin/env python3
# init_card_db.py - Quick script to create a minimal card database for testing

import sqlite3
import os
import json

def create_sample_card_database():
    """Create a sample card database with some test data."""
    
    # Database path
    home_dir = os.path.expanduser("~")
    db_dir = os.path.join(home_dir, '.swu')
    db_path = os.path.join(db_dir, 'swu_cards.db')
    
    # Ensure directory exists
    os.makedirs(db_dir, exist_ok=True)
    
    print(f"Creating card database at: {db_path}")
    
    # Connect to database
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Create tables
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS cards (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        subtitle TEXT,
        energy_cost INTEGER,
        type TEXT NOT NULL,
        rarity TEXT,
        text TEXT,
        epic_action TEXT,
        attack INTEGER,
        health INTEGER,
        image_uri TEXT,
        image_url TEXT,
        set_name TEXT,
        set_code TEXT,
        card_number TEXT,
        artist TEXT
    )
    ''')
    
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS card_aspects (
        card_id TEXT,
        aspect_name TEXT,
        aspect_color TEXT,
        PRIMARY KEY (card_id, aspect_name),
        FOREIGN KEY (card_id) REFERENCES cards(id)
    )
    ''')
    
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS card_keywords (
        card_id TEXT,
        keyword TEXT,
        PRIMARY KEY (card_id, keyword),
        FOREIGN KEY (card_id) REFERENCES cards(id)
    )
    ''')
    
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS card_traits (
        card_id TEXT,
        trait TEXT,
        PRIMARY KEY (card_id, trait),
        FOREIGN KEY (card_id) REFERENCES cards(id)
    )
    ''')
    
    # Sample card data for testing
    sample_cards = [
        # Leaders
        {
            "id": "luke-skywalker-faithful-friend",
            "name": "Luke Skywalker",
            "subtitle": "Faithful Friend",
            "energy_cost": None,
            "type": "Leader",
            "rarity": "Rare",
            "text": "When Played: You may search your deck for a Vehicle, reveal it, and draw it.",
            "epic_action": "Epic Action: If you control 6 or more resources, deploy this leader. He costs 4 less.",
            "attack": 3,
            "health": 7,
            "image_uri": "https://example.com/luke-leader.jpg",
            "set_name": "Spark of Rebellion",
            "set_code": "SOR",
            "card_number": "001",
            "artist": "Artist Name"
        },
        {
            "id": "darth-vader-dark-lord-sith",
            "name": "Darth Vader",
            "subtitle": "Dark Lord of the Sith",
            "energy_cost": None,
            "type": "Leader",
            "rarity": "Rare",
            "text": "When Played: Deal 1 damage to a unit.",
            "epic_action": "Epic Action: If you control 6 or more resources, deploy this leader. He costs 6 less.",
            "attack": 5,
            "health": 8,
            "image_uri": "https://example.com/vader-leader.jpg",
            "set_name": "Spark of Rebellion",
            "set_code": "SOR",
            "card_number": "002",
            "artist": "Artist Name"
        },
        # Bases
        {
            "id": "echo-base",
            "name": "Echo Base",
            "subtitle": None,
            "energy_cost": None,
            "type": "Base",
            "rarity": "Fixed",
            "text": "When Played: Ready a resource.",
            "epic_action": "Epic Action: Attack with a unit. It gets +2/+0 for this attack.",
            "attack": None,
            "health": 30,
            "image_uri": "https://example.com/echo-base.jpg",
            "set_name": "Spark of Rebellion",
            "set_code": "SOR",
            "card_number": "003",
            "artist": "Artist Name"
        },
        {
            "id": "krennic-imperial-death-trooper",
            "name": "Krennic's Imperial Death Trooper",
            "subtitle": None,
            "energy_cost": None,
            "type": "Base",
            "rarity": "Fixed",
            "text": "When Played: Deal 1 damage to a unit.",
            "epic_action": "Epic Action: Deal 2 damage to a unit.",
            "attack": None,
            "health": 30,
            "image_uri": "https://example.com/death-trooper-base.jpg",
            "set_name": "Spark of Rebellion",
            "set_code": "SOR",
            "card_number": "004",
            "artist": "Artist Name"
        },
        # Units
        {
            "id": "tie-fighter",
            "name": "TIE Fighter",
            "subtitle": None,
            "energy_cost": 2,
            "type": "Unit",
            "rarity": "Common",
            "text": "Ambush",
            "epic_action": None,
            "attack": 2,
            "health": 1,
            "image_uri": "https://example.com/tie-fighter.jpg",
            "set_name": "Spark of Rebellion",
            "set_code": "SOR",
            "card_number": "005",
            "artist": "Artist Name"
        },
        {
            "id": "x-wing",
            "name": "X-wing",
            "subtitle": None,
            "energy_cost": 4,
            "type": "Unit",
            "rarity": "Common",
            "text": "When Played: You may deal 1 damage to a unit.",
            "epic_action": None,
            "attack": 3,
            "health": 3,
            "image_uri": "https://example.com/x-wing.jpg",
            "set_name": "Spark of Rebellion", 
            "set_code": "SOR",
            "card_number": "006",
            "artist": "Artist Name"
        },
        # Events
        {
            "id": "force-lightning",
            "name": "Force Lightning",
            "subtitle": None,
            "energy_cost": 3,
            "type": "Event",
            "rarity": "Uncommon",
            "text": "Deal 2 damage to a unit and 1 damage to another unit.",
            "epic_action": None,
            "attack": None,
            "health": None,
            "image_uri": "https://example.com/force-lightning.jpg",
            "set_name": "Spark of Rebellion",
            "set_code": "SOR", 
            "card_number": "007",
            "artist": "Artist Name"
        },
        {
            "id": "repair",
            "name": "Repair",
            "subtitle": None,
            "energy_cost": 1,
            "type": "Event",
            "rarity": "Common",
            "text": "Heal 3 damage from a unit.",
            "epic_action": None,
            "attack": None,
            "health": None,
            "image_uri": "https://example.com/repair.jpg",
            "set_name": "Spark of Rebellion",
            "set_code": "SOR",
            "card_number": "008",
            "artist": "Artist Name"
        }
    ]
    
    # Insert sample cards
    for card in sample_cards:
        cursor.execute('''
        INSERT OR REPLACE INTO cards 
        (id, name, subtitle, energy_cost, type, rarity, text, epic_action, attack, health, 
         image_uri, set_name, set_code, card_number, artist)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            card['id'], card['name'], card['subtitle'], card['energy_cost'], 
            card['type'], card['rarity'], card['text'], card['epic_action'],
            card['attack'], card['health'], card['image_uri'], card['set_name'],
            card['set_code'], card['card_number'], card['artist']
        ))
    
    # Add aspects for cards
    aspects = [
        ("luke-skywalker-faithful-friend", "Heroism", "#0066CC"),
        ("luke-skywalker-faithful-friend", "Vigilance", "#FFCC00"),
        ("darth-vader-dark-lord-sith", "Villainy", "#CC0000"),
        ("darth-vader-dark-lord-sith", "Aggression", "#FF6600"),
        ("echo-base", "Heroism", "#0066CC"),
        ("krennic-imperial-death-trooper", "Villainy", "#CC0000"),
        ("tie-fighter", "Villainy", "#CC0000"),
        ("x-wing", "Heroism", "#0066CC"),
        ("force-lightning", "Villainy", "#CC0000"),
        ("repair", "Heroism", "#0066CC")
    ]
    
    for card_id, aspect_name, aspect_color in aspects:
        cursor.execute('''
        INSERT OR REPLACE INTO card_aspects (card_id, aspect_name, aspect_color)
        VALUES (?, ?, ?)
        ''', (card_id, aspect_name, aspect_color))
    
    # Add keywords
    keywords = [
        ("tie-fighter", "Ambush"),
        ("x-wing", "Coordinate"),
    ]
    
    for card_id, keyword in keywords:
        cursor.execute('''
        INSERT OR REPLACE INTO card_keywords (card_id, keyword)
        VALUES (?, ?)
        ''', (card_id, keyword))
    
    # Add traits
    traits = [
        ("luke-skywalker-faithful-friend", "Force"),
        ("luke-skywalker-faithful-friend", "Rebel"),
        ("darth-vader-dark-lord-sith", "Force"),
        ("darth-vader-dark-lord-sith", "Imperial"),
        ("darth-vader-dark-lord-sith", "Sith"),
        ("tie-fighter", "Imperial"),
        ("tie-fighter", "Fighter"),
        ("x-wing", "Rebel"),
        ("x-wing", "Fighter")
    ]
    
    for card_id, trait in traits:
        cursor.execute('''
        INSERT OR REPLACE INTO card_traits (card_id, trait)
        VALUES (?, ?)
        ''', (card_id, trait))
    
    # Commit and close
    conn.commit()
    conn.close()
    
    print(f"✅ Sample card database created successfully!")
    print(f"📊 Added {len(sample_cards)} sample cards")
    print(f"📂 Database location: {db_path}")

if __name__ == "__main__":
    create_sample_card_database()