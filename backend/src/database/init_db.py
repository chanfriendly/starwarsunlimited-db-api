from sqlalchemy import create_engine
import os
from .db import SQLALCHEMY_DATABASE_URL
from .models import Base, User, Deck, DeckCard, Card, CardAspect, CardKeyword, CardTrait, CardArena, PriceHistory

def init_db():
    """Initialize the database with tables for users and decks."""
    # Ensure directory exists
    home_dir = os.path.expanduser("~")
    db_dir = os.path.join(home_dir, '.swu')
    
    if not os.path.exists(db_dir):
        os.makedirs(db_dir)
    
    # Create SQLAlchemy engine
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
    )
    
    # Create tables
    Base.metadata.create_all(bind=engine)
    
    return engine

if __name__ == "__main__":
    init_db()
    print("Database initialized with user and deck tables")