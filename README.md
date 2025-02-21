# Star Wars Unlimited Card Database & Browser

## Overview

SWU Deck Builder is a comprehensive tool for Star Wars Unlimited players, designed specifically to support the Twin Suns format. 

In the Twin Suns format, players build decks with distinctive rules:

- Each deck is built around a central Leader card (similar to a Commander in MTG)
- Only one copy of each card is allowed in a deck (unlike standard Star Wars Unlimited rules of 3-4 copies)
- The Leader defines the deck's core strategy and sets the deck's aspectual identity

## Project Goals
My mission is to support growth for the Star Wars Unlimited community, offering:

- Comprehensive card database
- Intuitive deck-building interface
- Advanced card search and filtering
- Future AI-powered deck analysis and playtesting

![image](https://github.com/user-attachments/assets/c53ce794-f20e-41b5-8e98-444eb34203b9)




## Features

### Backend
- Fetches complete card data from the official Star Wars Unlimited API
- Handles all card types (Leaders, Bases, Units, Events, etc.)
- Stores both card faces for Leader cards
- Maintains relationships between cards and their aspects, keywords, traits, and arenas
- Includes price history tracking capability
- Provides detailed logging of the database building process
- Rate-limited API access to be respectful of the server

### Frontend
- Modern, responsive card browser interface
- Filter cards by type, aspect, and other attributes
- Search cards by name
- Detailed card view with full card information
- Dark mode support

### Technical Architecture

#### Database

- SQLite for structured card data storage
- Qdrant Vector Database for advanced semantic search (future AI features)

#### Technologies

- Frontend: Next.js, React
- Backend: FastAPI
- Database: SQLite, Qdrant

### Upcoming Features

- Deck saving and sharing
- User profiles
- AI-powered deck suggestions
- Deck strategy analysis
- Playtesting against AI opponents

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
python -m src.database.build_database
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

The project is actively under development. Please see the change log for more detailed progress notes. Current limitations include:


### Incomplete Functionality

- Deck building is not fully implemented
- Cannot save or share decks
- No user authentication


### User Interface

- Homepage is not yet user-friendly
- Limited navigation options, mainly /cards and /deck-builder


Features in Development

- AI deck suggestion system
- Comprehensive deck analysis
- Full vector database integration
- Playtesting decks


## Future Development

### Immediate Next Steps

1. Improve homepage
2. Implement deck saving functionality
3. Add deck export feature
4. Enhance error messaging and user feedback
5. Add card search functionality
6. Implement deck sharing features

### AI Features Roadmap

The project plans to integrate advanced AI capabilities to enhance deck building and game analysis. This development will proceed in several phases:

#### Phase 1: Intelligent Card Analysis
- Implementation of vector search for semantic card relationships ✅
- AI-powered deck recommendations based on play patterns and card synergies
- Advanced filtering based on card mechanics and strategic roles

#### Phase 2: Deck Building Assistant
- Automated deck analysis for resource curve and strategy identification
- Synergy suggestions for deck improvement
- Performance predictions based on card combinations

#### Phase 3: Game State Analysis
- Implementation of game state tracking and analysis
- Basic AI opponent for deck testing
- Play pattern recognition and strategic suggestions

#### Phase 4: Advanced AI Features
- Deep learning integration for sophisticated strategy analysis
- Real-time play suggestions
- Deck performance optimization

Each phase will build upon the existing functionality while maintaining stability and usability. Detailed technical specifications for each phase will be published as implementation begins.

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

### Technologies

- Backend:
  - FastAPI
  - SQLite
  - Python 3.8+
  - SQLAlchemy

- Frontend:
  - Next.js 13
  - React
  - Tailwind CSS
  - shadcn/ui components

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## Notes

Please be respectful when using the API:
- Implement appropriate rate limiting
- Cache data when possible
- Don't hammer the API with unnecessary requests

_Disclaimer: This project is a community effort and is not officially affiliated with Star Wars Unlimited or Lucasfilm. It is created by a Star Wars Unlimited player, for players. This is also an educational project for me, so please understand my limitations._
