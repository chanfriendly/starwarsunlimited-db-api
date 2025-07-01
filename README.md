# Star Wars Unlimited - Twin Suns Deck Builder

## Project Overview

Star Wars Unlimited Deck Builder is a comprehensive web application designed for Star Wars Unlimited card game players, specifically optimized for the Twin Suns format. The application provides card browsing, deck building, and collection management features with **AI-powered deck suggestions and playtesting capabilities** planned for future development.

## ✨ Current Features

### 🎴 Card Management
- **Real Card Database**: **1,398+ official Star Wars Unlimited cards** with live data from the official API
- **Powerful Search Engine**: Multi-parameter search with debounced real-time filtering
- **Advanced Filtering**: Filter by aspects, types, keywords, costs, sets with visual filter badges
- **Smart Card Grouping**: Properly groups cards by name + subtitle + type while preserving art variants
- **Card Details**: Comprehensive view of card information, including aspects, abilities, and high-quality card art
- **Art Variant Navigation**: Navigate through multiple art variants using intuitive arrow controls
- **Collection Tracking**: Users can mark cards they own and manage their collection with quantity tracking
- **Double-Click to Collect**: Double-click any card to instantly add it to your collection

### 🔍 Enhanced Search & Browsing
- **Real-time Search**: Instant search across card names, text, and abilities with 300ms debounce
- **Collapsible Advanced Filters**: Toggleable filter panel with multi-select dropdowns (no duplicate aspects!)
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
- **Save Decks**: Authenticated users can save and manage their deck collections

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
- **Framework**: Next.js 15+ with App Router
- **Styling**: Tailwind CSS with custom design system
- **State Management**: React Context with optimized re-render patterns
- **API Handling**: Built-in API routes with automatic server-side proxy to backend
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

## 🚀 Quick Start

### Simple Development Setup
```bash
# Clone the repository
git clone https://github.com/yourusername/starwarsunlimited-db-api.git
cd starwarsunlimited-db-api

# Copy environment configuration
cp .env.example .env.dev
# Edit .env.dev if you need to customize any settings

# Make scripts executable and start
chmod +x dev.sh
./dev.sh
```

**That's it!** The script will:
- ✅ Load environment configuration
- ✅ Set up databases automatically (downloads 1,398+ cards)
- ✅ Install all dependencies  
- ✅ Start both frontend and backend
- ✅ Open browser to http://localhost:4000

### Manual Setup (If Needed)

#### Prerequisites
- **Node.js 20+** and npm
- **Python 3.10+** with pip
- **Git**

#### Backend Setup
```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\\Scripts\\activate
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

## 🐳 Production Deployment

This project uses a clean, production-ready deployment workflow:
**MacBook** → **Docker Hub** → **TrueNAS/Portainer**

### Prerequisites
- Docker installed and running on your development machine
- Docker Hub account access
- Production server with Portainer
- Database files properly located

### Step 1: Configure Environment

```bash
# Copy and customize production environment
cp .env.example .env.prod

# Edit .env.prod with your production settings:
# - SERVER_IP: Your production server IP
# - PRODUCTION_DATABASE_PATH: Database storage path
# - JWT_SECRET: Generate with: openssl rand -hex 32
# - CORS_ALLOWED_ORIGINS: Your production URL
```

### Step 2: Build and Push Images (Development Machine)

```bash
# Make the deployment script executable (first time only)
chmod +x deploy.sh

# Build and push to Docker Hub
./deploy.sh
```

This script will:
- ✅ Load production environment configuration
- ✅ Build optimized, security-hardened Docker images with database initialization
- ✅ Push both frontend and backend images to Docker Hub
- ✅ Show you exactly what's happening with colored output

### Step 3: Deploy on Production Server (Portainer)

1. **Copy environment file** to your production server:
   ```bash
   scp .env.prod user@your-server:/path/to/twinsuns/.env
   ```

2. **Copy the production compose file** (`docker-compose.prod.yaml`)

3. **Create a new stack** in Portainer named \"twinsuns\"

4. **Paste the compose file** content into the web editor

5. **Configure the environment file path** in Portainer stack settings:
   - Set environment file: `/path/to/twinsuns/.env`
   - Or manually add key environment variables if preferred

6. **Deploy the stack** - Portainer will:
   - ✅ Pull the latest images from Docker Hub
   - ✅ Automatically initialize databases on first run
   - ✅ Start both frontend and backend with proper networking

### Step 4: Verify Deployment

- **Backend health**: http://YOUR_SERVER_IP:8000/health
- **Frontend**: http://YOUR_SERVER_IP:4000
- **API test**: http://YOUR_SERVER_IP:8000/api/cards/
- **Database status**: Check container logs for "Database initialization completed successfully!"

### Production Features

- **🔒 Security hardened**: Non-root users, minimal attack surface
- **❤️ Health checks**: Automatic monitoring with restart policies
- **⚡ Optimized builds**: Multi-stage Docker builds for small images
- **🔄 Easy updates**: Just run `./deploy.sh` and restart the stack
- **📊 Monitoring**: Built-in health endpoints and logging
- **🌐 Dual networking**: Automatic container-to-container and browser-to-server routing
- **🗺 Database automation**: Automatic database download and initialization
- **🛠️ Environment management**: Flexible configuration via .env files

## 📶 Environment Configuration

### Environment Files

- **`.env.example`**: Template with all available configuration options
- **`.env.dev`**: Development configuration (copy from .env.example)
- **`.env.prod`**: Production configuration for your specific server

### Key Configuration Variables

```bash
# Server Configuration
SERVER_IP=192.168.1.124          # Your production server IP
FRONTEND_PORT=4000               # Port for frontend service
BACKEND_PORT=8000                # Port for backend API

# Database Paths
PRODUCTION_DATABASE_PATH=/mnt/volume1/docker/twinsuns/databases
DB_DIR=/databases                # Database directory inside containers

# Security
JWT_SECRET=your_secret_here      # Generate with: openssl rand -hex 32
ACCESS_TOKEN_EXPIRE_MINUTES=10080  # 7 days

# Networking
CORS_ALLOWED_ORIGINS=http://192.168.1.124:4000
NEXT_PUBLIC_API_URL=http://192.168.1.124:8000
INTERNAL_API_URL=http://twinsuns-backend:8000
```

### Environment Setup

```bash
# Development (automatically loaded by dev.sh)
cp .env.example .env.dev

# Production (used by deploy.sh and docker-compose.prod.yaml)
cp .env.example .env.prod
vim .env.prod  # Customize for your server
```

### Docker Compose Behavior

- **Development**: Uses `.env.dev` values as defaults
- **Production**: Loads from `.env.prod` or environment file in Portainer
- **Fallbacks**: Sensible defaults if environment variables aren't set

## 🎯 API Endpoints

### Card Management
- `GET /api/cards` - Browse and search cards with advanced filtering and sorting
- `GET /api/cards/{id}` - Get individual card details
- `GET /api/aspects` - Get all available aspects (deduplicated)
- `GET /api/types` - Get all card types
- `GET /api/sets` - Get all available sets
- `GET /api/keywords` - Get all available keywords

### Deck Management
- `GET /api/decks` - Get user's decks
- `POST /api/decks` - Create new deck
- `GET /api/decks/{id}` - Get specific deck
- `PUT /api/decks/{id}` - Update deck
- `DELETE /api/decks/{id}` - Delete deck

### Authentication
- `POST /api/auth/register` - Create new account
- `POST /api/auth/token` - Login and get JWT token
- `GET /api/auth/me` - Get current user info
- `POST /api/auth/logout` - Logout and invalidate token

### Collection Management
- `GET /api/me/collection` - Get user's card collection
- `POST /api/me/collection` - Add cards to collection (double-click cards!)
- `PUT /api/me/collection` - Update card quantities

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication with configurable expiration
- **Password Security**: bcrypt hashing with salt rounds
- **CORS Protection**: Configured origins and headers
- **Input Validation**: Comprehensive validation on all user inputs
- **Rate Limiting**: API rate limiting to prevent abuse
- **Security Headers**: Proper HTTP security headers set
- **Environment Isolation**: Sensitive data in environment variables only
- **Container Security**: Non-root users in production containers

## 🔮 AI Integration Roadmap

### Phase 1: Data Foundation (✅ Complete)
- ✅ **Real card database** with 1,398+ cards
- ✅ **Relationship mapping** (aspects, keywords, traits)
- ✅ **User behavior tracking** (deck building patterns)
- ✅ **Advanced search infrastructure** for semantic queries

### Phase 2: Basic AI Features (📋 Planned)
- 📋 **Card recommendations** based on selected leaders
- 📋 **Aspect synergy analysis** using card relationships
- 📋 **Deck completion suggestions** with format validation
- 📋 **Search relevance ranking** using ML algorithms

### Phase 3: Advanced AI (🔮 Future)
- 🔮 **AlphaGo Zero-style learning** from game simulations
- 🔮 **Vector database integration** for semantic card search
- 🔮 **AI playtesting opponent** with adaptive difficulty
- 🔮 **Meta analysis** and deck archetype recommendations

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

## 📋 Development Checklist

### ✅ Completed Features
- ✅ Clean production deployment workflow
- ✅ Dual environment support (development + production)
- ✅ Aspect filter deduplication
- ✅ Deck saving and management
- ✅ Double-click to add cards to collection
- ✅ Container networking and health checks
- ✅ Security-hardened Docker images
- ✅ Comprehensive API proxy layer

### 🚧 Known Issues
- 🚧 None currently identified

### 📋 Planned Improvements
- 📋 Enhanced error handling and user feedback
- 📋 Offline support with service workers
- 📋 Advanced deck analytics and statistics
- 📋 Bulk collection import/export
- 📋 Social features and deck sharing

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