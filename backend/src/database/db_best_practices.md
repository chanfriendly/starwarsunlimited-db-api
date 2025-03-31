# Database Access Patterns for Star Wars Unlimited API

This document explains the hybrid ORM/SQL approach used in the Star Wars Unlimited API.

## Overview

The project uses both SQLAlchemy ORM and raw SQL where each makes the most sense:

- **ORM (Object-Relational Mapping)**: Provides safety, type validation, and relationship management
- **Raw SQL**: Offers flexibility for complex queries and performance optimization

## When to Use Each Approach

### Use ORM When:
- Creating, updating, or deleting records
- Reading individual records by ID
- Simple filtering and sorting
- Working with relationships in straightforward ways

### Use Raw SQL When:
- Building complex search functionality
- Performing aggregations and analytics
- Optimizing performance-critical endpoints
- Working with the vector database for AI recommendations

## Helper Functions

The project includes utility functions to bridge the two approaches:

- `enrich_card_with_relationships()`: Adds relationship data to cards retrieved with raw SQL
- `card_to_dict()`: Converts ORM models to dictionaries with relationships

## Examples

### ORM Example (Simple Read)
```python
# Get a card by ID using ORM
card = db.query(Card).filter(Card.id == card_id).first()
Raw SQL Example (Complex Search)
pythonCopy# Search cards with aspect filtering using raw SQL
sql = text("""
    SELECT c.* FROM cards c
    JOIN card_aspects ca ON c.id = ca.card_id
    WHERE ca.aspect_name = :aspect
""")
result = db.execute(sql, {"aspect": "Command"})
Best Practices

Always use parameter binding (text() and named parameters)
Document complex queries with comments
Handle relationship data consistently
Use transactions where appropriate
Add appropriate error handling and logging