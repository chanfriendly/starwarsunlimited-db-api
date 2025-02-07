import sqlite3
import os

def test_db_connection():
    db_path = os.path.abspath('swu_cards.db')
    print(f"Attempting to connect to database at: {db_path}")
    print(f"File exists: {os.path.exists(db_path)}")
    print(f"File permissions: {oct(os.stat(db_path).st_mode)[-3:]}")
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY)")
        conn.commit()
        print("Successfully connected to and modified database!")
        conn.close()
    except Exception as e:
        print(f"Error: {e}")
        print(f"Current working directory: {os.getcwd()}")
        print(f"Directory contents: {os.listdir('.')}")

if __name__ == "__main__":
    test_db_connection() 