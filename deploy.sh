#!/bin/bash
# deploy.sh - Simple deployment script for Star Wars Unlimited

set -e

echo "🚀 Starting Star Wars Unlimited Deployment..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p data
mkdir -p logs

# Set environment variables
export NODE_ENV=production
export NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL:-http://localhost:8000}

# Build frontend
echo "🔨 Building frontend..."
cd frontend

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Build the application
echo "🏗️  Building Next.js application..."
npm run build

echo "✅ Build complete!"

# Optional: Start with Docker Compose if docker-compose.yml exists
if [ -f "../docker-compose.yml" ]; then
    echo "🐳 Starting with Docker Compose..."
    cd ..
    docker-compose up -d
    echo "✅ Application started!"
    echo "🌐 Frontend: http://localhost:3000"
    echo "🔗 Backend: http://localhost:8000"
else
    echo "📋 To start the application:"
    echo "   npm start (for development)"
    echo "   or use Docker manually"
fi

---

#!/bin/bash
# dev.sh - Development startup script

set -e

echo "🚀 Starting Star Wars Unlimited in Development Mode..."

cd frontend

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Start development server
echo "🔄 Starting development server..."
npm run dev

---

# package.json scripts section to add to frontend/package.json
{
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "deploy": "npm run build && npm run start",
    "docker:build": "docker build -t swu-frontend .",
    "docker:run": "docker run -p 3000:3000 -e NEXT_PUBLIC_API_URL=http://host.docker.internal:8000 swu-frontend"
  }
}

---

# .env.example - Copy to .env.local for development
# Frontend Environment Variables
NEXT_PUBLIC_API_URL=http://localhost:8000
NODE_ENV=development

# Backend URL for production (Docker)
# NEXT_PUBLIC_API_URL=http://backend:8000

# For external API access in production
# NEXT_PUBLIC_API_URL=https://your-backend-domain.com

---

# Quick setup commands for README.md

## Development Setup

```bash
# Clone the repository
git clone [your-repo-url]
cd starwarsunlimited-db-api

# Frontend setup
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

## Production Deployment

### Option 1: Direct Node.js
```bash
# Make scripts executable
chmod +x deploy.sh dev.sh

# Deploy
./deploy.sh
```

### Option 2: Docker
```bash
# Build and run with Docker
cd frontend
npm run docker:build
npm run docker:run
```

### Option 3: Docker Compose (if you have backend)
```bash
# Start entire stack
docker-compose up -d

# Stop stack
docker-compose down
```

## Troubleshooting

### Port conflicts
If port 3000 is in use:
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or run on different port
PORT=3001 npm run dev
```

### Docker issues
```bash
# Clean up Docker
docker system prune -a

# Rebuild without cache
docker build --no-cache -t swu-frontend .
```