# src/database/base.py
from sqlalchemy.orm import declarative_base

print("--- Executing src/database/base.py ---")
Base = declarative_base()
print(f"--- Defined Base in base.py - ID: {id(Base)} ---")