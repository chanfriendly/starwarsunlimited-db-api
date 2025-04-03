# backend/src/api/main.py
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
import logging
import os

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,  # Change to DEBUG for more details
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Star Wars Unlimited API")

# Import routers
try:
    from src.routes.cards import router as cards_router
    app.include_router(cards_router, prefix="/api/cards", tags=["cards"])
    logger.info("Successfully loaded cards router")
except Exception as e:
    logger.error(f"Failed to load cards router: {str(e)}")

try:
    from src.routes.decks import router as decks_router
    app.include_router(decks_router, prefix="/api/decks", tags=["decks"])
    logger.info("Successfully loaded decks router") 
except Exception as e:
    logger.error(f"Failed to load decks router: {str(e)}")

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

@app.get("/")
async def root():
    return {"message": "Star Wars Unlimited API is running"}

# Debug endpoint to help test the API
@app.get("/debug-routes")
async def debug_routes():
    """List all registered routes for debugging"""
    routes = []
    for route in app.routes:
        routes.append({
            "path": route.path,
            "name": route.name,
            "methods": [method for method in route.methods] if hasattr(route, "methods") else None
        })
    return {"routes": routes}

# Health check endpoint
@app.get("/health")
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
    max_age=86400,  # Cache preflight requests for 1 day
)