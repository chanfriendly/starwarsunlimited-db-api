# Star Wars Unlimited Card Database & Browser

This project provides a complete solution for building, maintaining, and browsing a local database of Star Wars Unlimited cards. It consists of a FastAPI backend API and a Next.js frontend interface, along with tools to fetch and update card data from the official Star Wars Unlimited API.

## Project Structure

```
starwarsunlimited-db-api/
├── backend/                 # Python FastAPI backend
│   ├── src/
│   │   ├── api/            # API endpoints and database client
│   │   └── database/       # Database setup and models
│   └── requirements.txt    # Python dependencies
├── frontend/               # Next.js frontend
│   ├── app/               # Next.js app directory
│   ├── components/        # React components
│   └── lib/              # Utility functions and API client
└── dev.sh                 # Development startup script
```

## Known Issues

1. **Homepage Navigation**: The main homepage (localhost:3000) is currently non-functional. Please navigate directly to:
   - Card Browser: http://localhost:3000/cards
   - Deck Builder: http://localhost:3000/deck-builder

2. **Database Location**: The database is now stored in the user's home directory at `~/.swu/swu_cards.db` for better permissions handling.

3. **Image Loading**: Some card images may fail to load if they're not available from the API. Default placeholders will be shown instead.

4. **Performance**: Initial load of the card list may be slow due to fetching related data (aspects, keywords, etc.) for each card.

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
- Built with Next.js 13 and shadcn/ui components

## Requirements

- Python 3.10 or higher
- Node.js 16 or higher
- SQLite3

## Installation

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

## Development

Run both frontend and backend servers in development mode:
```bash
./dev.sh
```

This will start:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000

## Database Schema

The database uses multiple tables to store card information:

### Main Tables
- `cards`: Core card information (name, cost, stats, etc.)
- `price_history`: Historical price data for cards
- `card_aspects`: Card faction/alignment information
- `card_keywords`: Card keyword abilities
- `card_traits`: Card traits (Force, Pilot, etc.)
- `card_arenas`: Card arena affiliations (Ground, Space)

### Key Fields
- Each card entry includes:
  - Basic information (name, type, cost, etc.)
  - Card text and abilities
  - Image URIs (including back face for Leaders)
  - Set information
  - Release data
  - Current price data

## Technologies

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

_Please understand, this is a project for me to learn; I am, in most ways, a novice, and it may take me time to respond, understand, or correct issues. Please be patient, or if you're more advanced and have the passion, take this and run with it farther and faster than I can. I want to see the community, and resources for it, grow._
