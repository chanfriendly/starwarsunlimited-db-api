# Star Wars Unlimited API Development Guide

## Project Structure
backend/
├── scripts/                # Import scripts and utilities
├── src/
│   ├── api/                # Main API entry point
│   ├── auth/               # Authentication
│   ├── database/           # Database models and connection
│   ├── routes/             # API route handlers
│   ├── schemas/            # Pydantic schemas
│   └── utils/              # Utility functions
│       ├── auth.py         # Authentication utilities
│       ├── db_helpers.py   # Database helper functions
│       └── vector_db.py    # Vector database utilities
└── requirements.txt        # Python dependencies
Copy
## Database Access Patterns

The project uses a hybrid approach with both SQLAlchemy ORM and raw SQL.

### When to Use ORM
- Simple CRUD operations
- Working with relationships
- User management
- When database portability is important

### When to Use Raw SQL
- Complex search functionality
- Performance-critical endpoints
- Analytics and aggregations
- Vector database operations for AI

## Adding New Features

### Adding a New Route
1. Create a new file in `src/routes/`
2. Define the router and endpoints
3. Include the router in `src/api/main.py`

### Adding a New Model
1. Add the model to `src/database/models.py`
2. Create corresponding schema in `src/schemas/`
3. Ensure relationships are properly defined

### Adding AI Features
1. Use the vector database for card embeddings
2. Access vector data through `src/utils/vector_db.py`
3. Implement AI logic in dedicated modules

## Testing

Run tests with:
```bash
cd backend
python -m pytest
Common Issues
Circular Imports

Import models from src.database.models
Use src.utils.auth for authentication functions
Keep schemas separate from models

Database Connection

Always use get_db dependency for database access
Close connections properly with context managers or dependencies

Error Handling

Use try/except blocks with specific exception types
Log errors with appropriate level (error, warning, info)
Return clear error messages to clients

Copy
This comprehensive implementation provides a robust framework for the hybrid ORM/SQL approach. It establishes clear patterns, fixes import issues, and provides documentation for future development. The approach leverages the strengths of both ORM and raw SQL while maintaining consistency and best practices.