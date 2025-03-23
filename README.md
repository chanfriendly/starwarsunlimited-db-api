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

![Star Wars Unlimited Interface](https://github.com/user-attachments/assets/c53ce794-f20e-41b5-8e98-444eb34203b9)

### Current Status (2025-03-23)

The project has made significant progress with several key improvements:

1. **Complete Backend Development**:
   - Robust SQLite database with detailed card schema
   - Full card data import from official Star Wars Unlimited API
   - RESTful API endpoints for cards, decks, and aspects
   - Authentication system with JWT implementation
   - Vector database integration for semantic search capabilities

2. **Advanced Deck Builder Functionality**:
   - Multi-stage deck building workflow (Leaders → Base → Cards)
   - Intelligent aspect compatibility checking based on Twin Suns format rules
   - Visual indicators for card selection and compatibility status
   - Interactive card detail view with flip functionality for double-sided leader cards
   - Real-time deck statistics and validation

3. **User Interface Enhancements**:
   - Responsive grid layout with card filtering and search
   - Detailed card view with aspect color coding
   - Card grid with selection indicators and type badges
   - Stage progress indicators in deck builder
   - Dark mode optimized interface

4. **AI Integration (In Progress)**:
   - Vector database setup for semantic card relationship analysis
   - Foundation for AI deck suggestions and playtesting

## Features

### Backend
- Fetches complete card data from the official Star Wars Unlimited API
- Handles all card types (Leaders, Bases, Units, Events, etc.)
- Stores both card faces for Leader cards
- Maintains relationships between cards and their aspects, keywords, traits, and arenas
- Includes price history tracking capability
- Provides detailed logging of the database building process
- Rate-limited API access to be respectful of the server
- User authentication and authorization

### Frontend
- Modern, responsive card browser interface
- Filter cards by type, aspect, and other attributes
- Search cards by name and text
- Detailed card view with full card information
- Multi-stage deck building process
- Compatibility checking for proper deck construction
- Dark mode interface

### AI Features (In Development)
- Semantic card analysis using vector database
- Deck suggestion engine based on card synergies
- AI opponent for deck playtesting

### Technical Architecture

#### Database

- SQLite for structured card data storage
- Qdrant Vector Database for advanced semantic search capabilities

#### Technologies

- Frontend: Next.js 15, React 18, Tailwind CSS 4
- Backend: FastAPI, SQLite, Qdrant
- Authentication: JWT with bcrypt password hashing

## Getting Started

### Requirements
- Python 3.10 or higher
- Node.js 16 or higher
- SQLite3

### Installation

1. Clone this repository:
```bash
git clone https://github.com/yourusername/starwarsunlimited-db-api.git
cd starwarsunlimited-db-api
```

2. Set up the backend:
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

3. Set up the frontend:
```bash
cd frontend
npm install
```

4. Build the database:
```bash
cd backend
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
python -m src.api.import_swu_data
```

Note: The database will be created in your home directory at `~/.swu/swu_cards.db`

### Development

Run both frontend and backend servers in development mode:
```bash
./dev.sh
```

This will start:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000

## Current Status and Known Issues

The project is actively under development. Current limitations include:

### Incomplete Functionality

- Deck saving and sharing functionality needs to be completed
- User profile management is partially implemented
- AI features are still in early development

### User Interface

- Card grid layout needs optimization for variable card sizes
- Mobile responsiveness improvements needed for deck builder

### Features in Active Development

- AI deck suggestion system
- Comprehensive deck analysis
- Full vector database integration for semantic card relationships
- Playtesting against AI opponents

## Development Roadmap

### Phase 1: Core Functionality (Completed)
- ✅ Card database with comprehensive data model
- ✅ Card browser with filtering and search
- ✅ Multi-stage deck builder
- ✅ Aspect compatibility checking
- ✅ Leader card flip view

### Phase 2: User Management (In Progress)
- ✅ Authentication backend
- ⏳ User profile frontend
- ⏳ Deck saving and sharing
- ⏳ Deck versioning and history

### Phase 3: AI Integration (Starting)
- ✅ Vector database setup
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

### Database Schema

The database uses multiple tables to store card information:

#### Main Tables
- `cards`: Core card information (name, cost, stats, etc.)
- `price_history`: Historical price data for cards
- `card_aspects`: Card faction/alignment information
- `card_keywords`: Card keyword abilities
- `card_traits`: Card traits (Force, Pilot, etc.)
- `card_arenas`: Card arena affiliations (Ground, Space)

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
