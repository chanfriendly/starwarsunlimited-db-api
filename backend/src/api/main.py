# backend/src/api/main.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import logging

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,  # Change to DEBUG for more details
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Star Wars Unlimited API")

# Configure CORS
origins = [
    "http://localhost:3000",  # Frontend in development
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import auth router from the correct location
try:
    # CHANGE THIS LINE to import from auth.routes instead of routes.auth
    from src.auth.routes import router as auth_router 
    app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
    logger.info("Successfully loaded auth router")
except Exception as e:
    logger.error(f"Failed to load auth router: {str(e)}")
    logger.error(f"Make sure src/auth/routes.py exists and contains a FastAPI router")

# Other routers
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
    from src.routes.stats import router as stats_router
    app.include_router(stats_router, prefix="/api/stats", tags=["stats"])
    logger.info("Successfully loaded stats router")
except Exception as e:
    logger.error(f"Failed to load stats router: {str(e)}")

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