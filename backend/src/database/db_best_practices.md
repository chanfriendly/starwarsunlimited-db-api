# Database Best Practices for Star Wars Unlimited App

This document outlines the database architecture, access patterns, and best practices for the Star Wars Unlimited Twin Suns Deck Builder application.

## Database Architecture

The application uses a dual-database approach to separate static card data from dynamic user data:

### 1. Card Database (`swu_cards.db`)

- **Purpose**: Stores static card data, including card details, aspects, keywords, and relationships
- **Access Pattern**: Primarily read-only for the application
- **Location**: Stored in the user's home directory (`~/.swu/swu_cards.db`)
- **Updates**: Managed through import scripts, not through the main application

### 2. Application Database (`swu_app.db`)

- **Purpose**: Stores dynamic application data like users, decks, collections, and preferences
- **Access Pattern**: Read/write access for the application
- **Location**: Stored in the user's home directory (`~/.swu/swu_app.db`)
- **Schema**: Managed by SQLAlchemy models and initialized via scripts

## Database Access Patterns

### Dependency Injection

The application uses FastAPI's dependency injection system to provide database sessions:

- `Depends(get_app_db)`: For routes interacting with users, decks, or collections
- `Depends(get_card_db)`: For routes primarily reading static card data

### When to Use ORM

- **User Management**: For creating, updating, and querying user data
- **Deck Operations**: For CRUD operations on user decks
- **Collection Management**: For managing user card collections
- **Simple Queries**: For straightforward data access patterns

Example:
```python
@router.get("/me/decks")
async def get_user_decks(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_app_db)]
):
    decks = db.query(Deck).filter(Deck.user_id == current_user.id).all()
    return decks
```

### When to Use Raw SQL

- **Complex Card Searches**: For advanced filtering and search functionality
- **Performance-Critical Endpoints**: Where ORM overhead is a concern
- **Analytics Queries**: For statistical analysis and aggregations
- **Cross-Database Queries**: When data spans both databases

Example:

```python
@router.get("/cards")
async def get_cards(
    db: Session = Depends(get_card_db),
    search: Optional[str] = None,
    aspect: Optional[str] = None
):
    query = text("""
        SELECT c.* FROM cards c
        LEFT JOIN card_aspects ca ON c.id = ca.card_id
        WHERE (:search IS NULL OR c.name LIKE :search)
        AND (:aspect IS NULL OR ca.aspect_name = :aspect)
    """)
    
    result = db.execute(query, {
        "search": f"%{search}%" if search else None,
        "aspect": aspect
    })
    
    return [dict(row) for row in result]
```

###    Current Implementation
The database implementation currently includes:

**User System:**

- User registration and authentication
- Password hashing with bcrypt
- JWT token generation and validation


**Deck Management:**

- Deck creation and editing
- Association of decks with users
- Support for the Twin Suns format structure (leaders, base, cards)


**Card Browser:**

- Efficient filtering and searching
- Support for pagination
- Multi-parameter search capabilities


**Collection Tracking:**

- User card collection management
- Card ownership status and quantities



### Best Practices
Connection Management

- Always use dependency injection to obtain database sessions
- Let FastAPI handle session closure via the yield pattern
- Use the correct injector for the right database:
- pythonCopydb_app = Depends(get_app_db)  # For app data
=- db_cards = Depends(get_card_db)  # For card data


### Transaction Management

Use explicit transactions for operations that modify multiple tables:
pythonCopytry:
    db.begin()
    # Multiple database operations
    db.commit()
except Exception as e:
    db.rollback()
    raise HTTPException(status_code=500, detail=str(e))


#### Error Handling

Use try/except blocks to catch database errors
Return appropriate HTTP status codes with informative messages
Log detailed error information for debugging

#### Query Optimization

Add indexes for frequently queried columns
Use EXPLAIN QUERY PLAN to analyze query performance
Consider denormalizing data for read-heavy operations

### Future Improvements
For the planned AI features, several database enhancements are being considered:

#### Vector Database Integration:

Store card embeddings for semantic search
Enable similarity-based card recommendations


#### Game State Storage:

Develop schema for storing game states for AI training
Implement efficient retrieval patterns for AI inference


#### Usage Analytics:

Track popular cards and combinations
Store deck performance metrics


#### Card Relationship Modeling:

Explicit modeling of card synergies and combos
Statistical tracking of card co-occurrence