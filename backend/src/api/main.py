# backend/src/api/main.py
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from src.utils.rate_limiter import RateLimitMiddleware
import logging
import os

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI(title="Star Wars Unlimited API")

@app.on_event("startup")
async def startup_event():
    """Ensure the app database schema exists and run lightweight column migrations."""
    try:
        import src.database.models
        from src.database.db import init_app_db, app_engine
        init_app_db()

        # Add token_version column to users table if it was created before this column existed
        with app_engine.connect() as conn:
            from sqlalchemy import text as _text
            cols = [row[1] for row in conn.execute(_text("PRAGMA table_info(users)"))]
            if 'token_version' not in cols:
                conn.execute(_text("ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0"))
                conn.commit()
                logger.info("Migrated: added token_version to users table")
            if 'avatar_url' not in cols:
                conn.execute(_text("ALTER TABLE users ADD COLUMN avatar_url TEXT"))
                conn.commit()
                logger.info("Migrated: added avatar_url to users table")
            if 'email_verified' not in cols:
                conn.execute(_text("ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0"))
                conn.commit()
                logger.info("Migrated: added email_verified to users table")

        with app_engine.connect() as conn:
            deck_cols = [row[1] for row in conn.execute(_text("PRAGMA table_info(decks)"))]
            if 'share_token' not in deck_cols:
                conn.execute(_text("ALTER TABLE decks ADD COLUMN share_token TEXT"))
                conn.commit()
                logger.info("Migrated: added share_token to decks table")

        with app_engine.connect() as conn:
            tbls = [r[0] for r in conn.execute(_text("SELECT name FROM sqlite_master WHERE type='table'"))]
            if 'user_achievements' not in tbls:
                conn.execute(_text("""
                    CREATE TABLE user_achievements (
                        id TEXT PRIMARY KEY,
                        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        key TEXT NOT NULL,
                        earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        source TEXT,
                        UNIQUE(user_id, key)
                    )
                """))
                conn.commit()
                logger.info("Migrated: created user_achievements table")

        logger.info("App database initialized.")
    except Exception as e:
        logger.error(f"Failed to initialize app database: {e}")

# Import routers
try:
    from src.routes.cards import router as cards_router
    app.include_router(cards_router, prefix="/api/cards", tags=["cards"])
    logger.info("Successfully loaded cards router")
except Exception as e:
    logger.error(f"Failed to load cards router: {str(e)}")

#try:
 #   from src.routes.decks import router as decks_router
  #  app.include_router(decks_router, prefix="/api/decks", tags=["decks"])
   # logger.info("Successfully loaded decks router") 
#except Exception as e:
 #   logger.error(f"Failed to load decks router: {str(e)}")

try:
    from src.auth.routes import router as auth_router
    app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
    logger.info("Successfully loaded auth router")
except Exception as e:
    logger.error(f"Failed to load auth router: {str(e)}")

try:
    from src.routes.stats import router as stats_router
    app.include_router(stats_router, prefix="/api/stats", tags=["stats"])
    logger.info("Successfully loaded stats router")
except Exception as e:
    logger.error(f"Failed to load stats router: {str(e)}")

try:
    from src.routes.me import router as me_router
    app.include_router(me_router, prefix="/api/me", tags=["me"])
    logger.info("Successfully loaded me router")
except Exception as e:
    logger.error(f"Failed to load me router: {str(e)}")

try:
    from src.routes.matches import router as matches_router
    app.include_router(matches_router, prefix="/api/me", tags=["matches"])
    logger.info("Successfully loaded matches router")
except Exception as e:
    logger.error(f"Failed to load matches router: {str(e)}")

try:
    from src.routes.aspects import router as aspects_router
    app.include_router(aspects_router, prefix="/api/aspects", tags=["aspects"])
    logger.info("Successfully loaded aspects router")
except Exception as e:
    logger.error(f"Failed to load aspects router: {str(e)}")

try:
    from src.routes.types import router as types_router
    app.include_router(types_router, prefix="/api/types", tags=["types"])
    logger.info("Successfully loaded types router")
except Exception as e:
    logger.error(f"Failed to load types router: {str(e)}")

try:
    from src.routes.keywords import router as keywords_router
    app.include_router(keywords_router, prefix="/api/keywords", tags=["keywords"])
    logger.info("Successfully loaded keywords router")
except Exception as e:
    logger.error(f"Failed to load keywords router: {str(e)}")

try:
    from src.routes.sets import router as sets_router
    app.include_router(sets_router, prefix="/api/sets", tags=["sets"])
    logger.info("Successfully loaded sets router")
except Exception as e:
    logger.error(f"Failed to load sets router: {str(e)}")

try:
    from src.routes.traits import router as traits_router
    app.include_router(traits_router, prefix="/api/traits", tags=["traits"])
    logger.info("Successfully loaded traits router")
except Exception as e:
    logger.error(f"Failed to load traits router: {str(e)}")

try:
    from src.routes.public_decks import router as public_decks_router
    app.include_router(public_decks_router, prefix="/api", tags=["public"])
    logger.info("Successfully loaded public decks router")
except Exception as e:
    logger.error(f"Failed to load public decks router: {str(e)}")

try:
    from src.routes.achievements import router as achievements_router
    app.include_router(achievements_router, prefix="/api/me", tags=["achievements"])
    logger.info("Successfully loaded achievements router")
except Exception as e:
    logger.error(f"Failed to load achievements router: {str(e)}")

@app.get("/")
async def root():
    return {"message": "Star Wars Unlimited API is running"}

# Health check endpoint - accepts both GET and HEAD
@app.get("/health")
@app.head("/health")
async def health():
    return {"status": "healthy"}

# Get allowed origins from environment variable or use defaults
allowed_origins = os.environ.get(
    "CORS_ALLOWED_ORIGINS",
    "http://localhost:3000,https://twinsuns.chanfriendly.duckdns.org"
).split(",")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=[
        "Content-Type",
        "Set-Cookie",
        "Access-Control-Allow-Headers",
        "Access-Control-Allow-Origin",
        "Authorization"
    ],
    max_age=86400,
)

# Rate limiting: 120 requests/minute per IP across all endpoints.
# Auth endpoints get a separate stricter limit via the auth router dependency.
app.add_middleware(RateLimitMiddleware, requests_per_minute=120)