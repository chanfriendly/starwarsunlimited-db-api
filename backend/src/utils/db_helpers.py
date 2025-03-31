# backend/src/utils/db_helpers.py

from sqlalchemy import text
from typing import Dict, List, Any

def enrich_card_with_relationships(db, card_dict):
    """Add relationship data to a card dictionary from raw SQL results."""
    card_id = card_dict["id"]
    
    # Get aspects
    aspects_query = text("""
        SELECT aspect_name, aspect_color FROM card_aspects 
        WHERE card_id = :card_id
    """)
    aspects = db.execute(aspects_query, {"card_id": card_id}).fetchall()
    card_dict["aspects"] = [{"aspect_name": a[0], "aspect_color": a[1]} for a in aspects]
    
    # Get keywords
    keywords_query = text("SELECT keyword FROM card_keywords WHERE card_id = :card_id")
    keywords = db.execute(keywords_query, {"card_id": card_id}).fetchall()
    card_dict["keywords"] = [k[0] for k in keywords]
    
    # Get traits
    traits_query = text("SELECT trait FROM card_traits WHERE card_id = :card_id")
    traits = db.execute(traits_query, {"card_id": card_id}).fetchall()
    card_dict["traits"] = [t[0] for t in traits]
    
    # Get arenas
    arenas_query = text("SELECT arena FROM card_arenas WHERE card_id = :card_id")
    arenas = db.execute(arenas_query, {"card_id": card_id}).fetchall()
    card_dict["arenas"] = [a[0] for a in arenas]
    
    return card_dict

def card_to_dict(card_model):
    """Convert a Card ORM model to a dictionary with relationships."""
    # Convert model to dictionary - handle potential None values
    card_dict = {}
    for column in card_model.__table__.columns:
        card_dict[column.name] = getattr(card_model, column.name)
    
    # Add relationships with safe handling
    card_dict["aspects"] = []
    if hasattr(card_model, 'aspects') and card_model.aspects is not None:
        card_dict["aspects"] = [
            {"aspect_name": aspect.aspect_name, "aspect_color": aspect.aspect_color}
            for aspect in card_model.aspects
        ]
    
    card_dict["keywords"] = []
    if hasattr(card_model, 'keywords') and card_model.keywords is not None:
        card_dict["keywords"] = [keyword.keyword for keyword in card_model.keywords]
    
    card_dict["traits"] = []
    if hasattr(card_model, 'traits') and card_model.traits is not None:
        card_dict["traits"] = [trait.trait for trait in card_model.traits]
    
    card_dict["arenas"] = []
    if hasattr(card_model, 'arenas') and card_model.arenas is not None:
        card_dict["arenas"] = [arena.arena for arena in card_model.arenas]
    
    return card_dict