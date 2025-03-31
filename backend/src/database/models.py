from sqlalchemy import Column, String, Integer, Float, ForeignKey, Boolean, DateTime, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
import datetime
import uuid

Base = declarative_base()

class User(Base):
    __tablename__ = 'users'
    __table_args__ = {'extend_existing': True}
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    username = Column(String, unique=True, nullable=False)
    email = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, onupdate=datetime.datetime.utcnow)
    
    decks = relationship("Deck", back_populates="user", cascade="all, delete-orphan")

class Deck(Base):
    __tablename__ = 'decks'
    __table_args__ = {'extend_existing': True}
    
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
    __table_args__ = {'extend_existing': True}
    
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
    __table_args__ = {'extend_existing': True}
    
    # Fixed column names to match the actual database schema
    id = Column(String, primary_key=True)
    name = Column(String)
    subtitle = Column(String, nullable=True)
    energy_cost = Column(Integer, nullable=True)
    type = Column(String)
    type2 = Column(String, nullable=True)
    rarity = Column(String, nullable=True)
    text = Column(String, nullable=True)
    text_styled = Column(String, nullable=True)
    epic_action = Column(String, nullable=True)
    deploy_box = Column(String, nullable=True)
    attack = Column(Integer, nullable=True)
    health = Column(Integer, nullable=True)
    image_uri = Column(String, nullable=True)
    image_back_uri = Column(String, nullable=True)
    price_usd = Column(Float, nullable=True)
    set_name = Column(String, nullable=True)
    set_code = Column(String, nullable=True)
    card_number = Column(String, nullable=True)
    release_date = Column(String, nullable=True)
    last_updated = Column(String, nullable=True)
    is_unique = Column(Boolean, nullable=True)
    artist = Column(String, nullable=True)
    serial_code = Column(String, nullable=True)
    
    # Relationships
    aspects = relationship("CardAspect", back_populates="card", cascade="all, delete-orphan")
    keywords = relationship("CardKeyword", back_populates="card", cascade="all, delete-orphan")
    traits = relationship("CardTrait", back_populates="card", cascade="all, delete-orphan")
    arenas = relationship("CardArena", back_populates="card", cascade="all, delete-orphan")
    price_history = relationship("PriceHistory", back_populates="card", cascade="all, delete-orphan")
    deck_entries = relationship("DeckCard", back_populates="card")

class CardAspect(Base):
    __tablename__ = 'card_aspects'
    __table_args__ = {'extend_existing': True}
    
    card_id = Column(String, ForeignKey('cards.id'), primary_key=True)
    aspect_name = Column(String, primary_key=True)
    aspect_color = Column(String, nullable=True)
    
    card = relationship("Card", back_populates="aspects")

class CardKeyword(Base):
    __tablename__ = 'card_keywords'
    __table_args__ = {'extend_existing': True}
    
    card_id = Column(String, ForeignKey('cards.id'), primary_key=True)
    keyword = Column(String, primary_key=True)
    
    card = relationship("Card", back_populates="keywords")

class CardTrait(Base):
    __tablename__ = 'card_traits'
    __table_args__ = {'extend_existing': True}
    
    card_id = Column(String, ForeignKey('cards.id'), primary_key=True)
    trait = Column(String, primary_key=True)
    
    card = relationship("Card", back_populates="traits")

class CardArena(Base):
    __tablename__ = 'card_arenas'
    __table_args__ = {'extend_existing': True}
    
    card_id = Column(String, ForeignKey('cards.id'), primary_key=True)
    arena = Column(String, primary_key=True)
    
    card = relationship("Card", back_populates="arenas")

class PriceHistory(Base):
    __tablename__ = 'price_history'
    __table_args__ = {'extend_existing': True}
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    card_id = Column(String, ForeignKey('cards.id'))
    price = Column(Float)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    
    card = relationship("Card", back_populates="price_history")