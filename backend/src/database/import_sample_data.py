import sqlite3
import os

def import_sample_data():
    # Get the absolute path to the backend directory
    backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    db_path = os.path.join(backend_dir, 'swu_cards.db')
    
    print(f"Importing sample data into database at: {db_path}")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Sample card data with placeholder images from placeholder.com
    cards = [
        {
            "id": "1",
            "name": "Darth Vader",
            "subtitle": "Dark Lord of the Sith",
            "energy_cost": 5,
            "type": "Leader",
            "rarity": "Legendary",
            "text": "When Darth Vader enters play, you may destroy target character.",
            "attack": 5,
            "health": 5,
            "image_uri": "https://placehold.co/400x600/1a1a1a/ffffff?text=Darth+Vader",
            "set_name": "Core Set",
            "set_code": "SWU01",
            "card_number": "001",
        },
        {
            "id": "2",
            "name": "TIE Fighter",
            "subtitle": "Imperial Starfighter",
            "energy_cost": 3,
            "type": "Unit",
            "rarity": "Common",
            "text": "When TIE Fighter attacks, deal 1 damage to target character or vehicle.",
            "attack": 2,
            "health": 2,
            "image_uri": "https://placehold.co/400x600/1a1a1a/ffffff?text=TIE+Fighter",
            "set_name": "Core Set",
            "set_code": "SWU01",
            "card_number": "002",
        },
        {
            "id": "3",
            "name": "Force Choke",
            "energy_cost": 2,
            "type": "Event",
            "rarity": "Uncommon",
            "text": "Deal 3 damage to target character.",
            "image_uri": "https://placehold.co/400x600/1a1a1a/ffffff?text=Force+Choke",
            "set_name": "Core Set",
            "set_code": "SWU01",
            "card_number": "003",
        }
    ]
    
    # Insert cards
    for card in cards:
        placeholders = ", ".join(["?"] * len(card))
        columns = ", ".join(card.keys())
        cursor.execute(
            f"INSERT OR REPLACE INTO cards ({columns}) VALUES ({placeholders})",
            list(card.values())
        )
    
    # Sample aspects
    aspects = [
        ("1", "Command", "#FF0000"),
        ("1", "Dark Side", "#000000"),
        ("2", "Command", "#FF0000"),
        ("3", "Dark Side", "#000000")
    ]
    cursor.executemany(
        "INSERT OR REPLACE INTO card_aspects (card_id, aspect_name, aspect_color) VALUES (?, ?, ?)",
        aspects
    )
    
    # Sample keywords
    keywords = [
        ("1", "Fear"),
        ("1", "Intimidate"),
        ("2", "Flying"),
        ("3", "Instant")
    ]
    cursor.executemany(
        "INSERT OR REPLACE INTO card_keywords (card_id, keyword) VALUES (?, ?)",
        keywords
    )
    
    # Sample traits
    traits = [
        ("1", "Sith"),
        ("1", "Force User"),
        ("2", "Imperial"),
        ("3", "Force Power")
    ]
    cursor.executemany(
        "INSERT OR REPLACE INTO card_traits (card_id, trait) VALUES (?, ?)",
        traits
    )
    
    # Sample arenas
    arenas = [
        ("1", "Ground"),
        ("2", "Space"),
        ("3", "Ground")
    ]
    cursor.executemany(
        "INSERT OR REPLACE INTO card_arenas (card_id, arena) VALUES (?, ?)",
        arenas
    )
    
    conn.commit()
    conn.close()
    print("Sample data imported successfully!")

if __name__ == '__main__':
    import_sample_data() 