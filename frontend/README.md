# Star Wars Unlimited - Twin Suns Deck Builder

## Project Overview

Star Wars Unlimited Deck Builder is a comprehensive web application designed for Star Wars Unlimited card game players, specifically optimized for the Twin Suns format. The application provides card browsing, deck building, and collection management features with **AI-powered deck suggestions and playtesting capabilities** in development.

## ✨ Current Features

### 🎴 Card Management
- **Real Card Database**: **1,398+ official Star Wars Unlimited cards** with live data from the official API
- **Advanced Search & Filtering**: Multi-parameter search with aspects, types, keywords, costs, and sets
- **Card Details**: Comprehensive view of card information, including aspects, abilities, and high-quality card art
- **Collection Tracking**: Users can mark cards they own and manage their collection with quantity tracking

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

### Backend (FastAPI)
- **Framework**: FastAPI with automatic OpenAPI documentation
- **ORM**: SQLAlchemy with declarative models
- **Database**: Dual SQLite setup (cards + application data)
- **Authentication**: JWT tokens with configurable expiration
- **API Design**: RESTful endpoints with comprehensive error handling

### Database Architecture
- **Card Database** (`swu_cards.db`): Static card data with relationships, aspects, keywords
- **Application Database** (`swu_app.db`): User accounts, decks, collections, preferences
- **Data Sync**: Automated updates from official Star Wars Unlimited API
- **Backup Strategy**: Automated database backups with versioning

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

### Development
```bash
docker-compose up -d
```

### Production
```bash
chmod +x deploy.sh
./deploy.sh
```

### Manual Docker Build
```bash
# Frontend only
cd frontend
npm run docker:build
npm run docker:run

# Full stack
docker-compose -f docker-compose.yml up -d
```

## 📋 Recent Updates & Fixes

### ✅ Issues Resolved

1. **Search & Type Safety**
   - Fixed TypeScript errors in CardBrowser with proper type handling
   - Enhanced aspect filtering with null-safe operations
   - Improved error boundaries for robust user experience

2. **Mobile Experience**
   - **Single-tap functionality**: Add cards to collection/deck with one touch
   - **Visual feedback**: Loading spinners, success confirmations, and error states
   - **Touch optimization**: Proper mobile gesture handling and responsive design

3. **Component Architecture**
   - **Props standardization**: Renamed function props with "Action" suffix for clarity
   - **Type safety**: Strict TypeScript interfaces prevent runtime errors
   - **Performance**: Memoized components and optimized re-render patterns

4. **Database & API**
   - **Real data integration**: Connected to actual Star Wars Unlimited card database
   - **Query optimization**: Efficient database queries with proper indexing
   - **API stability**: Robust error handling and retry logic

5. **Development Experience**
   - **One-command setup**: `./dev.sh` starts everything automatically
   - **Environment management**: Simplified configuration with sensible defaults
   - **Hot reloading**: Both frontend and backend support live code changes

### 🔧 Breaking Changes
If updating from older versions:

**CardGrid Component Props:**
```typescript
// Old (deprecated)
<CardGrid onCardClick={handler} onDoubleClick={handler} />

// New (current)
<CardGrid onCardClickAction={handler} onDoubleClickAction={handler} />
```

## 🎯 API Endpoints

### Card Management
- `GET /api/cards` - Browse and search cards with filtering
- `GET /api/cards/{id}` - Get individual card details
- `GET /api/aspects` - Get all available aspects
- `GET /api/types` - Get all card types
- `GET /api/sets` - Get all available sets

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

## 🚀 Deployment Guide

### Local Development
```bash
./dev.sh  # Starts everything locally
```

### Production Server
```bash
./deploy.sh  # Builds and deploys optimized version
```

### Docker Production
```bash
# Using docker-compose
docker-compose -f docker-compose.yml up -d

# Manual container management
docker build -t swu-frontend ./frontend
docker build -t swu-backend ./backend
docker run -d -p 3000:3000 swu-frontend
docker run -d -p 8000:8000 swu-backend
```

### Environment Variables

**Frontend (.env.local):**
```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
NODE_ENV=development
```

**Backend (.env):**
```bash
JWT_SECRET=your_secure_secret_here
ACCESS_TOKEN_EXPIRE_MINUTES=10080
DB_DIR=~/.swu
DATABASE_URL=sqlite:///~/.swu/swu_app.db
CARD_DATABASE_URL=sqlite:///~/.swu/swu_cards.db
CORS_ALLOWED_ORIGINS=http://localhost:3000
```

## 🔮 AI Integration Roadmap

### Phase 1: Data Foundation (Current)
- ✅ **Real card database** with 1,398+ cards
- ✅ **Relationship mapping** (aspects, keywords, traits)
- ✅ **User behavior tracking** (deck building patterns)

### Phase 2: Basic AI Features (In Development)
- 🚧 **Card recommendations** based on selected leaders
- 🚧 **Aspect synergy analysis** using card relationships
- 🚧 **Deck completion suggestions** with format validation

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
- **Card Search**: < 200ms response time
- **Database Size**: ~1.4MB (highly optimized)
- **Bundle Size**: < 500KB gzipped

### Optimizations
- **Image Optimization**: WebP format with lazy loading
- **Code Splitting**: Dynamic imports for large components
- **Database Indexing**: Optimized queries for fast search
- **Caching Strategy**: Intelligent browser and API caching

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