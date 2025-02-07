from swu_api_client import SWUApiClient
import os

def main():
    # Use absolute path to the database in the backend directory
    db_path = os.path.abspath('swu_cards.db')
    print(f"Using database at: {db_path}")
    
    # Create a new client instance
    client = SWUApiClient(database_path=db_path)
    
    try:
        # Build the database with real SWU data
        print("Fetching Star Wars Unlimited card data...")
        client.build_database()
        print("Database successfully built!")
        
        # Verify the data
        conn = client._get_db_connection()
        cursor = conn.cursor()
        
        # Check card count
        cursor.execute("SELECT COUNT(*) FROM cards")
        card_count = cursor.fetchone()[0]
        print(f"Total cards imported: {card_count}")
        
        # Check aspects
        cursor.execute("SELECT COUNT(DISTINCT aspect_name) FROM card_aspects")
        aspect_count = cursor.fetchone()[0]
        print(f"Total unique aspects: {aspect_count}")
        
        # Check card types
        cursor.execute("SELECT type, COUNT(*) FROM cards GROUP BY type")
        type_counts = cursor.fetchall()
        print("\nCard types:")
        for type_name, count in type_counts:
            print(f"  {type_name}: {count}")
            
    except Exception as e:
        print(f"Error building database: {e}")
        import traceback
        traceback.print_exc()
    finally:
        client._close_db_connection()

if __name__ == "__main__":
    main() 