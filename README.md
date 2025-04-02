# Star Wars Unlimited Card Database & Browser

## Overview

SWU Deck Builder is a comprehensive tool for Star Wars Unlimited players, designed specifically to support the Twin Suns format. 

In the Twin Suns format, players build decks with distinctive rules:

- Each deck is built around two central Leader cards (similar to Commander in MTG)
- Only one copy of each card is allowed in a deck (unlike standard Star Wars Unlimited rules of 3-4 copies)
- The Leaders define the deck's core strategy and set the deck's aspectual identity

## Project Goals
Our mission is to support growth for the Star Wars Unlimited community, offering:

- Comprehensive card database with full card details and images
- Intuitive deck-building interface with aspect compatibility checking
- Advanced card search and filtering
- AI-powered deck analysis and playtesting (in development)

<img width="1293" alt="Screenshot 2025-03-23 at 1 05 35 PM" src="https://github.com/user-attachments/assets/b35a8216-c01c-4b5e-a5b7-350850decfef" />
<img width="1333" alt="Screenshot 2025-03-23 at 1 06 07 PM" src="https://github.com/user-attachments/assets/0f8ecea8-f18d-4d8a-b54c-3df901fe2f37" />

### Current Status (2025-04-02)

The project now has functional authentication, with several key features implemented:

1.  **Backend Development**:
    *   Robust database setup using **two separate SQLite databases**: `swu_cards.db` for static card data and `swu_app.db` for user/deck data.
    *   Full card data import mechanism (presumably populating `swu_cards.db`).
    *   RESTful API endpoints using FastAPI for cards, decks, aspects, etc.
    *   Authentication system using JWT and passlib/bcrypt. Auth logic consolidated.

2.  **Frontend Development**:
    *   Next.js/React frontend with components for card browsing, signup, and login.
    *   Basic card display and filtering capabilities.
    *   Implemented authentication flow with direct FastAPI backend communication.
    *   Basic deck builder interface (building but not saving yet).

3.  **Current Focus & Issues**:

    ### Authentication System
- ✅ Fixed user registration functionality
- ✅ Implemented proper response serialization for SQLAlchemy models
- ✅ Added logout feature to the navbar
- ✅ Enhanced error handling in auth routes

### User Profile Features
- ✅ Created user-specific endpoints for decks and collections
- ✅ Implemented `/api/me/decks` endpoint for personalized deck management
- ✅ Added foundation for `/api/me/collection` endpoint 
- ✅ Updated frontend to handle auth state properly

### Database Architecture
- ✅ Resolved database connection issues between app and card databases
- ✅ Created proper model relationships between users, decks, and cards

## Features

### Backend
- Fetches complete card data from external sources (populates `swu_cards.db`).
- Handles all card types (Leaders, Bases, Units, Events, etc.).
- Stores both card faces for Leader cards.
- Manages relationships between cards and their aspects, keywords, etc. (in `swu_cards.db`).
- Provides API endpoints for accessing card data.
- User authentication and authorization (using `swu_app.db`).
- API endpoints for creating/managing user decks (using `swu_app.db`).
- Detailed logging capabilities.

### Frontend
- Modern, responsive card browser interface (connected to backend).
- Filter cards by type, aspect, and other attributes.
- Search cards by name and text.
- Signup and Login pages.
- Dark mode interface.

### AI Features (In Development)
- Semantic card analysis using vector database.
- Deck suggestion engine based on card synergies.
- AI opponent for deck playtesting.

### Technical Architecture

#### Database

-   **Application Database:** SQLite (`~/.swu/swu_app.db`) for user accounts, decks, and other dynamic application data. Managed via SQLAlchemy ORM.
-   **Card Database:** SQLite (`~/.swu/swu_cards.db`) for static card data. Populated via scripts.
-   **Vector Database:** Qdrant (if implemented) for advanced semantic search capabilities.

#### Technologies

- Frontend: Next.js, React, Tailwind CSS 
- Backend: FastAPI, SQLAlchemy, Pydantic, SQLite, Passlib, python-jose
- Vector DB: Qdrant (if implemented)
- Authentication: JWT with bcrypt password hashing

## Getting Started

### Requirements
- Python 3.10 or higher
- Node.js 16 or higher
- SQLite3

### Installation

1. **Clone this repository:**
```bash
git clone https://github.com/yourusername/starwarsunlimited-db-api.git
cd starwarsunlimited-db-api
```

2. **Set up the backend:**
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

3. **Set up the frontend:**
```bash
cd frontend
npm install
```

4.  **Initialize Databases:**
    *   **Card Database:** Populate the static card data. (Update this command based on your actual script name, e.g., `db_setup.py` or `import_swu_data.py`)
      ```bash
      cd ../backend # Go back to backend directory
      source .venv/bin/activate # Activate venv if not already active
      python -m src.database.db_setup # Or your data import script
      ```
    *   **Application Database:** Create the necessary tables for users, decks, etc.
      ```bash
      # Still in backend directory with venv active
      python init_app_database.py
      ```

    *Note: Databases will be created in your home directory at `~/.swu/` (`swu_cards.db` and `swu_app.db`).*

### Development

Run both frontend and backend servers in development mode:
```bash
./dev.sh
```

This will start:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000

## Current Status and Known Issues

The project is actively under development.

### Current Focus

-   🔍 Fix "Method Not Allowed" error when saving decks to /api/me/decks endpoint
-   🔍 Debug request/response format between frontend and backend
-   🔍 Ensure backend has proper route handlers for deck CRUD operations
-   🔍 Verify authentication headers are correctly passed to backend for deck operations

**Specific Troubleshooting Steps:**

1. Verify backend route exists:

Check backend/src/routes/me.py for POST method implementation on /decks endpoint
Compare with existing GET /api/me/decks endpoint that works


2. Validate request format:

Examine the payload being sent from the deck builder
Ensure it matches the schema expected by the backend


3. Fix authentication token passing:

Confirm fetchWithAuth is correctly including the token in request headers
Test with Postman or similar tool to validate API independently


4. Backend route implementation:

Implement or fix the POST endpoint for /api/me/decks in backend/src/routes/me.py
Ensure proper error handling and validation

## Development Roadmap

### Phase 1: Core Functionality (Mostly Completed)
- ✅ Card database schema & population (`swu_cards.db`)
- ✅ Application database schema (`swu_app.db` via SQLAlchemy)
- ✅ Card browser API endpoints
- ✅ Basic frontend card browser
- ⏳ Multi-stage deck builder (Backend/Frontend implementation needed)
- ⏳ Aspect compatibility checking (Logic needed)
- ⏳ Leader card flip view (Frontend component)

### Phase 2: User Management (In Progress)
- ✅ Authentication backend logic (Password Hashing, JWT)
- ✅ Basic User model and DB table
- ⏳ **Fix Signup Response Error** (Current focus)
- ⏳ **Verify/Fix Login Flow** (Current focus)
- ⏳ User profile frontend
- ⏳ Deck saving and sharing (Requires user association)
- ⏳ Deck versioning and history

### Phase 3: AI Integration (Starting)
- ✅ Vector database setup (if applicable)
- ⏳ Semantic card relationship analysis
- ⏳ AI deck suggestions
- ⏳ Deck performance predictions

### Phase 4: Advanced AI Features (Planned)
- ⏳ AI opponent implementation
- ⏳ Game state tracking
- ⏳ Strategy analysis
- ⏳ Machine learning integration

## AI Feature Details

The project incorporates advanced AI capabilities to enhance deck building and gameplay:

1. **Vector Database Integration**
   - Cards are converted to vector embeddings capturing their semantic meaning
   - Rulebook sections are indexed for contextual understanding
   - Enables semantic search and relationship discovery

2. **Deck Building Assistant**
   - AI suggests cards based on synergies with selected leaders
   - Identifies optimal aspect combinations
   - Recommends cards based on play style preferences

3. **Game State Analysis**
   - Tracks and evaluates board states
   - Analyzes card interactions and synergies
   - Provides strategic recommendations

4. **AI Opponent**
   - Simulates gameplay for deck testing
   - Uses reinforcement learning to improve play patterns
   - Adapts to different deck archetypes and strategies

## Technical Details

### Database Access Patterns

The project implements a hybrid database access approach using **two SQLite databases**. See `Development.md` and `db_best_practices.md` for details on using `get_app_db` vs. `get_card_db` and ORM vs. Raw SQL.

### Database Schema

-   **Application Database (`swu_app.db`):** Contains `users`, `decks`, `deck_cards` tables managed by SQLAlchemy models in `src/database/models.py`.
-   **Card Database (`swu_cards.db`):** Contains `cards`, `card_aspects`, `card_keywords`, `card_traits`, `card_arenas`, `price_history` tables, typically populated via scripts.

#### Key Fields
Each card entry includes:
  - Basic information (name, type, cost, etc.)
  - Card text and abilities
  - Image URIs (including back face for Leaders)
  - Set information
  - Release data
  - Current price data

### Vector Database

The Qdrant vector database stores:
- Card embeddings generated from card text and attributes
- Rulebook section embeddings for context
- Relationships between cards based on semantic similarity

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Notes

Please be respectful when using the API:
- Implement appropriate rate limiting
- Cache data when possible
- Don't hammer the API with unnecessary requests

_Disclaimer: This project is a community effort and is not officially affiliated with Star Wars Unlimited or Lucasfilm. It is created by a Star Wars Unlimited player, for players._
