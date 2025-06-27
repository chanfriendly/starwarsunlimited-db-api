# Star Wars Unlimited - Twin Suns Deck Builder

## Project Overview

Star Wars Unlimited Deck Builder is a comprehensive web application designed for Star Wars Unlimited card game players, specifically optimized for the Twin Suns format. The application provides card browsing, deck building, and collection management features with **AI-powered deck suggestions and playtesting capabilities** in development.

## ✨ Current Features

### 🎴 Card Management
- **Real Card Database**: **1,398+ official Star Wars Unlimited cards** with live data from the official API
- **Powerful Search Engine**: Multi-parameter search with debounced real-time filtering
- **Advanced Filtering**: Filter by aspects, types, keywords, costs, sets with visual filter badges
- **Smart Card Grouping**: Properly groups cards by name + subtitle + type while preserving art variants
- **Card Details**: Comprehensive view of card information, including aspects, abilities, and high-quality card art
- **Art Variant Navigation**: Navigate through multiple art variants using intuitive arrow controls
- **Collection Tracking**: Users can mark cards they own and manage their collection with quantity tracking

### 🔍 Enhanced Search & Browsing
- **Real-time Search**: Instant search across card names, text, and abilities with 300ms debounce
- **Collapsible Advanced Filters**: Toggleable filter panel with multi-select dropdowns
- **Cost Range Filtering**: Min/max cost inputs for precise filtering
- **Active Filter Display**: Visual badges showing applied filters with one-click removal
- **Sort Options**: Multiple sort options including name, cost, type, set, and rarity
- **Responsive Design**: Works seamlessly on desktop and mobile devices

### 🎯 Deck Building (Twin Suns Format)
- **Twin Suns Format Support**: Interface specifically optimized for the format's unique requirements
- **Aspect Compatibility**: Real-time filtering of compatible cards based on selected leaders and base
- **Deck Editing**: Full CRUD support for creating, viewing, editing, and deleting decks
- **Deck Stats**: Visual breakdown of deck composition, mana curves, and format compliance
- **Leader & Base Selection**: Dedicated interfaces for choosing leaders and bases with format validation

### 📱 Enhanced User Experience
- **Mobile-First Design**: Optimized for both desktop and mobile with touch-friendly interactions
- **Tap-to-Add Functionality**: Single-tap card addition on mobile with visual feedback
- **Responsive Grid Layout**: Adaptive card grids that work seamlessly across all screen sizes
- **Real-time Visual Feedback**: Loading states, success indicators, and error handling
- **Progressive Enhancement**: Works on slower connections with intelligent caching
- **Art Variant Controls**: Navigate card art variants with arrows and dot indicators
- **Card Detail Modal**: Enhanced card detail view with arrow navigation through art variants

### 🔐 Authentication & User Management
- **Secure Authentication**: JWT-based authentication with bcrypt password hashing
- **User Profiles**: Comprehensive profile management with saved decks and collection
- **Session Management**: Secure token handling with automatic refresh
- **Account Recovery**: Password reset and account recovery workflows

## 🏗️ Architecture

### Frontend (Next.js)
- **Framework**: Next.js 14+ with App Router
- **Styling**: Tailwind CSS with custom design system
- **State Management**: React Context with optimized re-render patterns
- **API Handling**: Built-in proxy configuration with automatic redirects
- **Build**: Standalone output for Docker deployment
- **Search**: Debounced search with intelligent caching and state management

### Backend (FastAPI)
- **Framework**: FastAPI with automatic OpenAPI documentation
- **ORM**: SQLAlchemy with declarative models
- **Database**: Dual SQLite setup (cards + application data)
- **Authentication**: JWT tokens with configurable expiration
- **API Design**: RESTful endpoints with comprehensive error handling
- **Card Grouping**: Smart backend grouping by name + subtitle + type + aspects + keywords

### Database Architecture
- **Card Database** (`swu_cards.db`): Static card data with relationships, aspects, keywords
- **Application Database** (`swu_app.db`): User accounts, decks, collections, preferences
- **Data Sync**: Automated updates from official Star Wars Unlimited API
- **Backup Strategy**: Automated database backups with versioning
- **Indexing**: Optimized database indices for fast search and filtering

### Deployment
- **Containerization**: Docker with multi-stage builds
- **Orchestration**: Docker Compose for development and production
- **Environment Management**: Flexible configuration for different deployment targets
- **Security**: Hardened containers with non-root users and minimal attack surface

## 🚀 Quick Start

### Simple Development Setup
```bash
# Clone and start everything with one command
git clone https://github.com/yourusername/starwarsunlimited-db-api.git
cd starwarsunlimited-db-api

# Make scripts executable and start
chmod +x dev.sh
./dev.sh
```

**That's it!** The script will:
- ✅ Set up databases automatically
- ✅ Install all dependencies  
- ✅ Start both frontend and backend
- ✅ Open browser to http://localhost:3000

### Manual Setup (If Needed)

#### Prerequisites
- **Node.js 18+** and npm
- **Python 3.10+** with pip
- **Git**

#### Backend Setup
```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Create environment file
cp .env.example .env
# Edit .env with your configuration

# Start backend
uvicorn src.api.main:app --reload --host 0.0.0.0 --port 8000
```

#### Frontend Setup
```bash
cd frontend
npm install

# Create environment file
cp .env.example .env.local
# Edit .env.local: NEXT_PUBLIC_API_URL=http://localhost:8000

# Start frontend
npm run dev
```

## 🐳 Docker Deployment

This project is configured for easy deployment using Docker. We provide two separate `docker-compose` files: one for local development and one for production.

### Local Development

For a seamless development experience with hot-reloading, use the default `docker-compose.yaml`.

```bash
# Start the development environment
docker-compose up
```

This command will mount your local source code into the containers and automatically reload on changes.

### Production Deployment (on NAS, Server, etc.)

For production, we use an optimized, multi-stage build process defined in `docker-compose.prod.yaml`. This creates lightweight, secure images for both the frontend and backend.

**1. Build and Push Images from your MacBook:**

First, build the production images:
```bash
docker-compose -f docker-compose.prod.yaml build
```

Next, log in to your container registry (e.g., GitHub Container Registry or Docker Hub) and push the images. *Replace `your-registry` with your actual registry name.*

```bash
# Example for GitHub Container Registry
docker login ghcr.io -u YOUR_USERNAME

docker push ghcr.io/christianglass/starwarsunlimited-db-api-frontend
docker push ghcr.io/christianglass/starwarsunlimited-db-api-backend
```

**2. Pull and Run on your NAS:**

On your NAS or production server, you just need the `docker-compose.prod.yaml` file. Pull the new images and start the services in detached mode:

```bash
docker-compose -f docker-compose.prod.yaml pull
docker-compose -f docker-compose.prod.yaml up -d
```

Your application is now running in production mode.

## 🎯 API Endpoints

### Card Management
- `GET /api/cards` - Browse and search cards with advanced filtering and sorting
- `GET /api/cards/{id}` - Get individual card details
- `GET /api/aspects` - Get all available aspects
- `GET /api/types` - Get all card types
- `GET /api/sets` - Get all available sets
- `GET /api/keywords` - Get all available keywords

### Deck Management
- `GET /api/me/decks` - Get user's decks
- `POST /api/me/decks` - Create new deck
- `GET /api/me/decks/{id}` - Get specific deck
- `PUT /api/me/decks/{id}` - Update deck
- `DELETE /api/me/decks/{id}` - Delete deck

### Authentication
- `POST /api/auth/register` - Create new account
- `POST /api/auth/token` - Login and get JWT token
- `GET /api/auth/me` - Get current user info
- `POST /api/auth/logout` - Logout and invalidate token

### Collection Management
- `GET /api/me/collection` - Get user's card collection
- `POST /api/me/collection` - Add cards to collection
- `PUT /api/me/collection` - Update card quantities

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication with configurable expiration
- **Password Security**: bcrypt hashing with salt rounds
- **CORS Protection**: Configured origins and headers
- **Input Validation**: Comprehensive validation on all user inputs
- **Rate Limiting**: API rate limiting to prevent abuse
- **Security Headers**: Proper HTTP security headers set
- **Environment Isolation**: Sensitive data in environment variables only

## 📋 Recent Updates & Fixes

### ✅ Version 2.1.0 - Enhanced Search & Navigation

1. **Powerful Search Engine**
   - **Real-time search**: Instant search across card names, text, and abilities
   - **Advanced filtering**: Multi-parameter filtering with visual feedback
   - **Debounced API calls**: Optimized performance with 300ms debounce
   - **Filter badges**: Visual representation of active filters with one-click removal

2. **Improved Card Grouping**
   - **Fixed frontend grouping**: Removed incorrect name-only grouping
   - **Backend grouping respected**: Cards grouped correctly by name + subtitle + type
   - **Art variant handling**: Proper display of multiple art variants for same cards
   - **Enhanced debugging**: Comprehensive logging for troubleshooting grouping issues

3. **Enhanced Card Detail Experience**
   - **Arrow navigation**: Navigate through art variants using intuitive left/right arrows
   - **Dot indicators**: Visual indicators showing current art variant position
   - **Art information**: Display set, artist, and rarity for current art variant
   - **Responsive design**: Optimized for both desktop and mobile interactions

4. **Component Architecture Improvements**
   - **TypeScript fixes**: Resolved all type safety issues and export conflicts
   - **Prop standardization**: Consistent "Action" suffix for function props
   - **Performance optimizations**: Memoized components and optimized re-renders
   - **Error handling**: Improved error boundaries and loading states

5. **Search & Filter Features**
   - **Cost range filtering**: Min/max cost inputs for precise control
   - **Multi-select filters**: Dropdown selections for types, aspects, keywords, sets
   - **Sort options**: Multiple sorting options including name, cost, type, set, rarity
   - **Responsive filters**: Collapsible filter panel optimized for mobile

### 🔧 Breaking Changes
If updating from older versions:

**CardGrid Component Props:**
```typescript
// Old (deprecated)
<CardGrid onCardClick={handler} onDoubleClick={handler} />

// New (current)
<CardGrid onCardClickAction={handler} onDoubleClickAction={handler} />
```

**CardSearch Component Props:**
```typescript
// Old (deprecated)
<CardSearch onFiltersChange={handler} />

// New (current)
<CardSearch onFiltersChangeAction={handler} />
```

## 🔮 AI Integration Roadmap

### Phase 1: Data Foundation (Current)
- ✅ **Real card database** with 1,398+ cards
- ✅ **Relationship mapping** (aspects, keywords, traits)
- ✅ **User behavior tracking** (deck building patterns)
- ✅ **Advanced search infrastructure** for semantic queries

### Phase 2: Basic AI Features (In Development)
- 🚧 **Card recommendations** based on selected leaders
- 🚧 **Aspect synergy analysis** using card relationships
- 🚧 **Deck completion suggestions** with format validation
- 🚧 **Search relevance ranking** using ML algorithms

### Phase 3: Advanced AI (Planned)
- 📋 **AlphaGo Zero-style learning** from game simulations
- 📋 **Vector database integration** for semantic card search
- 📋 **AI playtesting opponent** with adaptive difficulty
- 📋 **Meta analysis** and deck archetype recommendations

## 🛠️ Development

### Code Quality
- **TypeScript**: Strict type checking throughout
- **ESLint**: Comprehensive linting rules
- **Prettier**: Consistent code formatting
- **Git Hooks**: Pre-commit validation

### Testing Strategy
- **Unit Tests**: Component and utility function testing
- **Integration Tests**: API endpoint validation
- **E2E Tests**: User workflow testing
- **Performance Tests**: Load testing for critical paths

### Contributing
1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes with proper TypeScript types
4. Add tests for new functionality
5. Submit a pull request with clear description

## 📊 Performance

### Metrics
- **Initial Load**: < 3 seconds on 3G
- **Search Response**: < 200ms with debouncing
- **Card Filtering**: < 100ms client-side processing
- **Database Size**: ~1.4MB (highly optimized)
- **Bundle Size**: < 500KB gzipped

### Optimizations
- **Image Optimization**: WebP format with lazy loading
- **Code Splitting**: Dynamic imports for large components
- **Database Indexing**: Optimized queries for fast search
- **Caching Strategy**: Intelligent browser and API caching
- **Debounced Search**: Optimized API calls with smart caching

## 🤝 Contributing

We welcome contributions! Please see our contributing guidelines:

1. **Issues**: Report bugs or suggest features
2. **Code**: Follow TypeScript and React best practices
3. **Documentation**: Help improve setup and usage docs
4. **Testing**: Add tests for new features

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ⚠️ Disclaimer

This project is a community effort and is not officially affiliated with Star Wars Unlimited or Lucasfilm. It is created by Star Wars Unlimited players, for players. Please be respectful when using the API and follow rate limiting guidelines.

---

**Need Help?** 
- 📖 Check the [API Documentation](http://localhost:8000/docs) 
- 💬 Open an issue on GitHub
- 📧 Contact the development team

**Built with ❤️ for the Star Wars Unlimited community**