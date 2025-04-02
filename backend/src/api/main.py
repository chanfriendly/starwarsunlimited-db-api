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

try:
    from src.routes.me import router as me_router
    app.include_router(me_router, prefix="/api/me", tags=["me"])
    logger.info("Successfully loaded me router")
except Exception as e:
    logger.error(f"Failed to load me router: {str(e)}")

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

@router.post("/collection", status_code=status.HTTP_200_OK)
async def update_collection_item(
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_app_db)]
):
    """Add or update a card in the user's collection"""
    try:
        # Parse request body
        item_data = await request.json()
        card_id = item_data.get('card_id')
        count = item_data.get('count', 0)
        
        # Validate data
        if not card_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing card_id"
            )
        
        # If count is 0, remove from collection
        if count <= 0:
            # Delete the collection item if it exists
            db.query(UserCollection).filter(
                UserCollection.user_id == current_user.id,
                UserCollection.card_id == card_id
            ).delete()
            db.commit()
            
            return {"success": True, "message": "Card removed from collection"}
        else:
            # Check if item already exists
            existing_item = db.query(UserCollection).filter(
                UserCollection.user_id == current_user.id,
                UserCollection.card_id == card_id
            ).first()
            
            if existing_item:
                # Update count
                existing_item.count = count
                db.commit()
            else:
                # Create new collection item
                new_item = UserCollection(
                    user_id=current_user.id,
                    card_id=card_id,
                    count=count
                )
                db.add(new_item)
                db.commit()
            
            # Get card details for response
            card_db_gen = get_card_db()
            card_db = next(card_db_gen)
            
            try:
                card_query = text("SELECT * FROM cards WHERE id = :card_id")
                card_proxy = card_db.execute(card_query, {"card_id": card_id})
                
                if card_proxy.returns_rows:
                    card_row = card_proxy.fetchone()
                    if card_row:
                        # Convert to dictionary
                        card_dict = {key: card_row._mapping[key] for key in card_row._mapping.keys()}
                        
                        # Add relationships
                        card_with_relations = enrich_card_with_relationships(card_db, card_dict)
                        
                        # Return complete info
                        return {
                            "card": card_with_relations,
                            "count": count,
                            "in_collection": True
                        }
            finally:
                card_db.close()
            
            # Fallback response
            return {"success": True, "card_id": card_id, "count": count}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating collection: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update collection"
        )