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

![image](https://github.com/user-attachments/assets/c53ce794-f20e-41b5-8e98-444eb34203b9)


## Known Issues

1. **Homepage Navigation**: The main homepage (localhost:3000) is currently non-functional. Please navigate directly to:
   - Card Browser: http://localhost:3000/cards
   - Deck Builder: http://localhost:3000/deck-builder

2. **Database Location**: The database is now stored in the user's home directory at `~/.swu/swu_cards.db` for better permissions handling.

3. **Image Loading**: Some card images may fail to load if they're not available from the API. Default placeholders will be shown instead.

4. **Performance**: Initial load of the card list may be slow due to fetching related data (aspects, keywords, etc.) for each card.

5. **Deck Builder Dialog**: The card details dialog in the deck builder is currently not functioning properly:
   - Dialog may not appear when clicking cards
   - Scrolling within the dialog may be inconsistent
   - Working on implementing a more reliable dialog solution

## Recent Progress (2024-02-07)

1. **Deck Builder Improvements**:
   - Implemented grid layout for card display
   - Added card filtering by type and aspect
   - Implemented deck building functionality with card limits
   - Added deck stats tracking
   - Working on fixing card details dialog issues

2. **Card Grid Layout**:
   - Improved card grid layout with proper sizing
   - Added support for both horizontal (bases/leaders) and vertical cards
   - Implemented responsive grid columns
   - Added card selection highlighting

3. **UI Enhancements**:
   - Added loading states for card fetching
   - Implemented proper error handling
   - Added responsive design improvements
   - Enhanced filter sidebar functionality

## Next Steps

1. Fix card details dialog in deck builder
2. Implement deck saving functionality
3. Add deck export feature
4. Enhance error messaging and user feedback
5. Add card search functionality
6. Implement deck sharing features

## AI Development Roadmap

### Overview

This roadmap outlines the development phases for integrating advanced AI capabilities into the Star Wars Unlimited Card Database project. The project will expand beyond its current card database and planned vector search functionality to include sophisticated deck building assistance and game simulation features.

### Phase 1: Enhanced Vector Search & Deck Recommendations

#### Card Embedding System
The embedding system captures not just card text, but the deep strategic elements of Star Wars Unlimited. The system uses OpenAI's text-embedding-3-small model to create rich vector representations of cards that understand their roles in the game.

The embedding system encodes:
```python
class CardEmbedding:
    def __init__(self):
        self.strategic_features = {
            'tempo_impact': 'How the card affects game pace',
            'resource_efficiency': 'Value relative to cost',
            'synergy_potential': 'Interaction with other cards',
            'game_phase_value': 'Utility in early/mid/late game'
        }
        self.mechanical_features = {
            'combat_impact': 'Effect on board state',
            'resource_generation': 'Contribution to economy',
            'control_elements': 'Ability to direct game flow'
        }
```

#### Deck Analysis Engine
The deck analysis system examines both individual cards and their interactions:

```python
class DeckAnalyzer:
    def analyze_deck(self, deck: List[Card]) -> DeckProfile:
        """
        Creates a comprehensive deck profile including:
        - Resource curve analysis
        - Power spike timing
        - Synergy patterns
        - Consistency metrics
        """
        # Implementation details for deck analysis
        pass
```

### Phase 2: Game State Representation

#### Core Game Logic
The foundation of the AI system is a precise representation of the game state:

```python
@dataclass
class GameState:
    # Board state
    player_hand: List[Card]
    player_resources: int
    player_bases: List[Base]
    player_units: List[Unit]
    
    # Game flow tracking
    current_phase: GamePhase
    initiative_player: PlayerID
    action_history: List[Action]
    
    def apply_action(self, action: Action) -> 'GameState':
        """
        Applies an action and returns the new game state.
        Enforces all game rules and timing restrictions.
        """
        pass
```

#### State Management
The system implements efficient state handling for AI training:

```python
class StateManager:
    def encode_state(self, state: GameState) -> np.ndarray:
        """
        Converts game state into a format suitable for
        neural network processing.
        """
        pass
    
    def decode_state(self, encoded: np.ndarray) -> GameState:
        """
        Reconstructs game state from encoded format.
        Critical for debugging and visualization.
        """
        pass
```

### Phase 3: Monte Carlo Tree Search Implementation

MCTS provides the initial AI opponent, balancing exploration and exploitation of game strategies:

```python
class MCTSNode:
    def __init__(self, state: GameState):
        self.state = state
        self.visits = 0
        self.value = 0
        self.children = {}
        
    def select_action(self) -> Action:
        """
        Chooses the most promising action using UCB1 formula.
        Balances exploitation of known good moves with
        exploration of new possibilities.
        """
        pass
```

### Phase 4: Deep Learning Integration

The neural network architecture comprises several specialized components:

```python
class SWUModel(nn.Module):
    def __init__(self):
        super().__init__()
        # State evaluation
        self.state_encoder = nn.Sequential(
            nn.Linear(STATE_SIZE, 512),
            nn.ReLU(),
            nn.Linear(512, 256)
        )
        
        # Action prediction
        self.policy_head = nn.Linear(256, ACTION_SPACE)
        
        # Position evaluation
        self.value_head = nn.Linear(256, 1)
```

### Phase 5: MLOps & Production

#### Model Serving
The existing FastAPI backend will be extended to serve AI features:

```python
@router.post("/api/v1/analyze-deck")
async def analyze_deck(deck: List[Card]):
    """
    Provides comprehensive deck analysis including:
    - Strategic assessment
    - Suggested improvements
    - Matchup predictions
    """
    pass

@router.post("/api/v1/suggest-play")
async def suggest_play(game_state: GameState):
    """
    Analyzes current game state and suggests optimal plays.
    Includes confidence levels and alternative options.
    """
    pass
```

#### Integration with Existing UI
The current components will be enhanced with AI features:

```typescript
interface DeckBuilderProps {
  cards: Card[]
  aiSuggestions?: boolean
}

const DeckBuilder: React.FC<DeckBuilderProps> = ({ cards, aiSuggestions }) => {
  // Enhanced deck builder with AI assistance
  return (
    <div className="grid grid-cols-12 gap-4">
      <DeckList />
      {aiSuggestions && <AISuggestionsPanel />}
    </div>
  )
}
```

### Implementation Strategy

Each phase builds upon the existing infrastructure:

1. Implementation begins with vector search integration
2. Game state tracking is added alongside the current deck builder
3. MCTS implementation provides initial AI testing capabilities
4. Deep learning components are gradually integrated
5. Production deployment includes comprehensive monitoring

The modular design ensures new AI features enhance rather than disrupt current functionality. Each component can be developed and tested independently while maintaining the overall system's stability.

### Performance Considerations

The system includes several optimizations:

1. State encoding compression for efficient training
2. Batched inference for deck analysis
3. Caching frequently requested suggestions
4. Edge-optimized model variants for local deployment

### Development Priorities

Current implementation priorities:

1. Complete vector search integration
2. Implement game state representation
3. Create initial test suite for game rules
4. Design and test baseline deck analysis features

### Contributing

Contributions to any phase of this AI development roadmap are welcome. Please refer to the Contributing section in the main README for guidelines on submitting changes.

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
