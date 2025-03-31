from sqlalchemy import Column, String, DateTime, func
from sqlalchemy.ext.declarative import declarative_base
import uuid
from ..database.db import Base 

class User(Base):
    __tablename__ = "users"  # Fixed double underscores
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    username = Column(String, unique=True, nullable=False)
    email = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # Optional additional fields for user profiles
    avatar_url = Column(String, nullable=True)
    bio = Column(String, nullable=True)