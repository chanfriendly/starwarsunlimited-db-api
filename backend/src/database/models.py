from sqlalchemy import Column, String, Integer, Float, ForeignKey, Boolean, Table, Text, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
import datetime
import uuid

Base = declarative_base()

class User(Base):
    __tablename__ = 'users'
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    username = Column(String, unique=True, nullable=False)
    email = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, onupdate=datetime.datetime.utcnow)
    
    decks = relationship("Deck", back_populates="user", cascade="all, delete-orphan")

class Deck(Base):
    __tablename__ = 'decks'
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey('users.id'), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, onupdate=datetime.datetime.utcnow)
    
    user = relationship("User", back_populates="decks")
    cards = relationship("DeckCard", back_populates="deck", cascade="all, delete-orphan")

class DeckCard(Base):
    __tablename__ = 'deck_cards'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    deck_id = Column(String, ForeignKey('decks.id'), nullable=False)
    card_id = Column(String, ForeignKey('cards.id'), nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    is_leader = Column(Boolean, default=False)
    is_base = Column(Boolean, default=False)
    
    deck = relationship("Deck", back_populates="cards")
    card = relationship("Card", back_populates="deck_entries")

class Card(Base):
    __tablename__ = 'cards'
    
    id = Column(String, primary_key=True)
    name = Column(String)
    type = Column(String)
    subtype = Column(String, nullable=True)
    cost = Column(Integer, nullable=True)
    health = Column(Integer, nullable=True)
    damage = Column(Integer, nullable=True)
    text = Column(String, nullable=True)
    flavor_text = Column(String, nullable=True)
    set_name = Column(String)
    set_id = Column(String)
    rarity = Column(String)
    number = Column(String)
    artist = Column(String, nullable=True)
    image_url = Column(String)
    back_image_url = Column(String, nullable=True)
    price = Column(Float, nullable=True)
    
    # Relationships
    aspects = relationship("CardAspect", back_populates="card", cascade="all, delete-orphan")
    keywords = relationship("CardKeyword", back_populates="card", cascade="all, delete-orphan")
    traits = relationship("CardTrait", back_populates="card", cascade="all, delete-orphan")
    arenas = relationship("CardArena", back_populates="card", cascade="all, delete-orphan")
    price_history = relationship("PriceHistory", back_populates="card", cascade="all, delete-orphan")
    deck_entries = relationship("DeckCard", back_populates="card")

class CardAspect(Base):
    __tablename__ = 'card_aspects'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    card_id = Column(String, ForeignKey('cards.id'))
    aspect = Column(String)
    
    card = relationship("Card", back_populates="aspects")

class CardKeyword(Base):
    __tablename__ = 'card_keywords'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    card_id = Column(String, ForeignKey('cards.id'))
    keyword = Column(String)
    
    card = relationship("Card", back_populates="keywords")

class CardTrait(Base):
    __tablename__ = 'card_traits'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    card_id = Column(String, ForeignKey('cards.id'))
    trait = Column(String)
    
    card = relationship("Card", back_populates="traits")

class CardArena(Base):
    __tablename__ = 'card_arenas'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    card_id = Column(String, ForeignKey('cards.id'))
    arena = Column(String)
    
    card = relationship("Card", back_populates="arenas")

class PriceHistory(Base):
    __tablename__ = 'price_history'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    card_id = Column(String, ForeignKey('cards.id'))
    price = Column(Float)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    
    card = relationship("Card", back_populates="price_history")