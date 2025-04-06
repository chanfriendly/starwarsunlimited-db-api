# Star Wars Unlimited - Twin Suns Deck Builder

## Project Overview

Star Wars Unlimited Deck Builder is a comprehensive web application designed for Star Wars Unlimited card game players, specifically optimized for the Twin Suns format. The application provides card browsing, deck building, and collection management features with plans to incorporate AI-based deck suggestions and playtesting capabilities.

## Current Features

### Card Management
- **Card Browser**: Fully functional search and filtering system for all Star Wars Unlimited cards
- **Card Details**: Comprehensive view of card information, including aspects, abilities, and card art
- **Collection Tracking**: Users can mark cards they own and manage their collection

### Deck Building
- **Twin Suns Format Support**: Interface optimized for the format's unique requirements
- **Aspect Compatibility**: Automatic filtering of compatible cards based on leaders and base
- **Deck Editing**: Full support for creating, viewing, and editing decks
- **Deck Stats**: Visual breakdown of deck composition and statistics

### User Experience
- **Responsive Design**: Works across desktop and mobile devices
- **Authentication System**: Secure user accounts with JWT-based authentication
- **Profile Management**: User profiles with saved decks and collection

## Architecture

The application follows a modern web architecture:

- **Frontend**: Next.js React application with Tailwind CSS
- **Backend**: FastAPI Python application with SQLAlchemy ORM
- **Database**: SQLite databases for card data and application state
- **Authentication**: JWT-based authentication with secure password handling
- **Deployment**: Docker containers managed via docker-compose
- **State Management**: Context-based state management with React hooks
- **Networking**: API proxy handling with built-in Next.js API routes

## Development Status

We've completed the core functionality of the application and are preparing for the initial production deployment. Key recent achievements include:

- ✅ **User Authentication System**: Complete user registration, login, and session management
- ✅ **Deck Building Interface**: Fully functional Twin Suns deck building experience
- ✅ **Card Browser**: Comprehensive search and filtering system
- ✅ **Collection Management**: User collection tracking and integration
- ✅ **Profile Dashboard**: User profile with saved decks and collection stats
- ✅ **Edit Functionality**: Support for editing existing decks

## Next Steps

### Immediate Priorities

1. **Production Deployment**: Deploy the containerized application to production servers
2. **Enhanced User Experience**: Polish the base experience with improved UI/UX
3. **Reliability Improvements**: Focus on bug fixes and stability enhancements
4. **Community Features**: Develop deck sharing and social features once stable

### Medium Term Goals

1. **AI Deck Suggestions**: Implement basic AI recommendations based on leader selection
2. **Advanced Filtering**: Enhance card browser with statistics-based filtering
3. **Performance Optimization**: Optimize database queries and frontend rendering
4. **Mobile Experience**: Further improve the mobile experience

### Long Term AI Integration

1. **Deck Recommendation Engine**: Build an advanced AI system to suggest cards based on deck theme
2. **Playtesting Simulation**: Develop AI opponent for deck testing
3. **Card Synergy Analysis**: Implement semantic analysis of card interactions
4. **Game State Modeling**: Create comprehensive game state tracking for AI

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Python 3.10+
- Git

### Local Development Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/chanfriendly/starwarsunlimited-db-api.git
   cd starwarsunlimited-twin-suns

### Environment Setup

1. Create a `.env` file based on `.env.example`:
   ```
  JWT_SECRET=your_secret_key_here
  ACCESS_TOKEN_EXPIRE_MINUTES=10080

2. Create necessary directories:
   ```bash
   mkdir -p /mnt/tank/apps/twinsuns/databases
   mkdir -p /mnt/tank/apps/twinsuns/backups
   ```

### Deployment Steps

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/starwarsunlimited-db-api.git
   cd starwarsunlimited-db-api
   ```

2. Copy `.env` file to project root

3. Build and start containers:
   ```bash
   docker-compose build
   docker-compose up -d
   ```

4. Verify deployment:
   ```bash
   docker-compose ps
   curl http://localhost:8000/health
   ```

5. Configure Nginx Proxy Manager:
   - Add a new proxy host
   - Point to the frontend container on port 3000
   - Configure SSL with Let's Encrypt
   - Add headers for security

### Maintenance

- Database updates can be run manually:
  ```bash
  docker-compose exec backend python scripts/build_database.py
  ```

- Viewing logs:
  ```bash
  docker-compose logs -f backend
  docker-compose logs -f frontend
  ```

## Technical Notes

### Database Structure

- **Card Database** (`swu_cards.db`): Contains static card data including relationships 
- **Application Database** (`swu_app.db`): Stores user accounts, decks, and collection data

### API Endpoints

- `/api/cards`: Browse and search card data
- `/api/decks`: Manage user decks
- `/api/auth`: User authentication
- `/api/me`: User profile and collection
- `/api/stats`: Database statistics

### Security Considerations

- JWT tokens expire after 7 days
- All passwords are hashed using bcrypt
- Input validation on all user-provided data
- CORS configured to allow only specific origins
- Environment variables for all sensitive configuration

## Next Deployment Steps

1. Update Docker configuration files with final settings
2. Create proper backup system for databases
3. Deploy to NAS server with Nginx
4. Set up automated database updates
5. Configure domain with DuckDNS

This progress report highlights the significant improvements made to the Star Wars Unlimited Deck Builder application, especially in the areas of deployment configuration, security, and database management. The project is now ready for production deployment with a robust foundation for future enhancements.

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
