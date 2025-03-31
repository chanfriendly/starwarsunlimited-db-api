import sqlite3
import os
import json

def inspect_db():
    db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "swu_cards.db")
    if not os.path.exists(db_path):
        print(f"Database file not found at: {db_path}")
        return
        
    print(f"Database file found at: {db_path}")
    print(f"File size: {os.path.getsize(db_path)} bytes")
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Get list of tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = cursor.fetchall()
    
    if not tables:
        print("No tables found in database!")
        return
        
    print("\nDatabase Tables:")
    for table in tables:
        table_name = table[0]
        print(f"\nTable: {table_name}")
        
        # Get table schema
        cursor.execute(f"PRAGMA table_info({table_name});")
        columns = cursor.fetchall()
        print("Columns:")
        for col in columns:
            print(f"  {col[1]} ({col[2]}) {'PRIMARY KEY' if col[5] else ''}")
            
        # Get row count
        try:
            cursor.execute(f"SELECT COUNT(*) FROM {table_name};")
            count = cursor.fetchone()[0]
            print(f"Row count: {count}")
        except sqlite3.Error as e:
            print(f"Error getting row count: {e}")
            
        # Get first row as sample
        try:
            cursor.execute(f"SELECT * FROM {table_name} LIMIT 1;")
            sample = cursor.fetchone()
            if sample:
                print("Sample row:")
                for col, val in zip([c[1] for c in columns], sample):
                    if len(str(val)) > 100:
                        print(f"  {col}: {str(val)[:100]}...")
                    else:
                        print(f"  {col}: {val}")
        except sqlite3.Error as e:
            print(f"Error getting sample: {e}")

    conn.close()

if __name__ == "__main__":
    inspect_db() 