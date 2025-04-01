# Star Wars Unlimited API Development Guide

This guide provides instructions and best practices for developing the backend API. Please refer to db_best_practices.md for more detail.

## Project Structure

backend/
├── scripts/                # Data import scripts and database setup utilities
├── src/
│   ├── api/                # Main API entry point (main.py)
│   ├── auth/               # Authentication logic (routes.py, auth.py)
│   ├── database/           # Database setup, models, and base definition
│   │   ├── base.py         # Shared SQLAlchemy Base definition
│   │   ├── db.py           # Database engines, sessions, dependency injectors
│   │   └── models.py       # SQLAlchemy ORM models
│   ├── routes/             # API route handlers (cards.py, decks.py, etc.)
│   ├── schemas/            # Pydantic schemas for request/response validation
│   └── utils/              # Utility functions (e.g., db_helpers.py, vector_db.py)
│       ├── db_helpers.py   # Database helper functions (if applicable)
│       └── vector_db.py    # Vector database utilities (if applicable)
├── tests/                  # Unit and integration tests (To be added)
├── .venv/                  # Virtual environment directory
├── init_app_database.py    # Script to initialize the application database schema
└── requirements.txt        # Python dependencies

## Database Setup & Access

The project utilizes two separate SQLite databases stored in the user's home directory (`~/.swu/`):

1.  **Card Database (`swu_cards.db`):** Stores static card data imported from external sources. Primarily read-only for the application. Managed by `src/database/db_setup.py` (or equivalent import scripts).
2.  **Application Database (`swu_app.db`):** Stores dynamic application data like users, decks, deck contents, etc. Read/write access needed. Schema managed by SQLAlchemy models (`src/database/models.py`) and initialized via `init_app_database.py`.

### Database Access Patterns

The project uses a hybrid approach with both SQLAlchemy ORM and raw SQL. Choose the appropriate method based on the task and the target database.

#### Dependency Injection

-   Use `Depends(get_app_db)` for routes interacting with users, decks, or other application-specific data.
-   Use `Depends(get_card_db)` for routes primarily reading static card data.

### When to Use ORM
- Simple CRUD operations on the **Application Database** (users, decks).
- Working with relationships defined in `models.py`.
- User management (uses Application Database).
- When database portability *for the application data* is important.

### When to Use Raw SQL
- Complex search/filtering on the **Card Database**.
- Bulk data loading/processing for the **Card Database**.
- Performance-critical read endpoints targeting the **Card Database**.
- Analytics and aggregations (specify which database).
- Vector database operations for AI (if applicable).

## Adding New Features

### Adding a New Route
1. Create a new file in `src/routes/` (e.g., `src/routes/my_feature.py`).
2. Define the `APIRouter` and endpoint functions.
3. Use `Depends(get_app_db)` or `Depends(get_card_db)` to inject the correct database session.
4. Include the router in `src/api/main.py`.

### Adding a New Application Model (e.g., User Preferences)
1. Add the model class inheriting from `Base` in `src/database/models.py`.
2. Create corresponding Pydantic schema(s) in `src/schemas/`.
3. Define any relationships with other application models (User, Deck).
4. **Important:** Rerun `python init_app_database.py` to add the new table(s) to `swu_app.db`.

### Adding AI Features
1. Use the vector database for card embeddings (presumably populated from `swu_cards.db`).
2. Access vector data through `src/utils/vector_db.py` (if applicable).
3. Implement AI logic in dedicated modules.

## Testing

(Placeholder - Needs Implementation)

-   Consider using separate test databases for both card and application data.
-   Implement fixtures for setting up and tearing down database states.
-   Run tests with:
    ```bash
    cd backend
    # python -m pytest
    ```

## Common Issues

### Circular Imports
-   Centralize `Base` definition in `src/database/base.py`.
-   Import `Base` into `db.py` and `models.py` from `base.py`.
-   Import models only where needed (e.g., in routes, schemas), not typically within `db.py`.
-   Keep schemas separate from models.

### Database Connection / Access
-   **Always use the correct dependency injector:** `Depends(get_app_db)` for app data, `Depends(get_card_db)` for card data. Mix-ups will lead to errors.
-   FastAPI handles session closing via the `yield` pattern in the dependency injectors.

### Error Handling
-   Use `try/except` blocks within route handlers for database operations and external calls.
-   Catch specific exceptions where possible (e.g., `HTTPException`, `sqlalchemy.exc.IntegrityError`).
-   Log errors clearly using Python's `logging` module.
-   Return informative `HTTPException`s to the client for expected errors (e.g., 404 Not Found, 400 Bad Request).
-   Allow FastAPI's default handling for unexpected 500 errors (after logging them).