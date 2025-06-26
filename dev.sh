#!/bin/bash
# dev.sh - Local development startup script

set -e

echo "🚀 Starting Star Wars Unlimited Twin Suns Local Development"
echo "=========================================================="

# Create local database directories
echo "📁 Setting up local database directories..."
mkdir -p ~/.swu
echo "✅ Database directories created at ~/.swu"

# Create backend .env file for local development
echo "📝 Creating backend .env file for local development..."
cat > backend/.env << EOF
# Local development configuration
DB_DIR=${HOME}/.swu
DATABASE_URL=sqlite:///${HOME}/.swu/swu_app.db
CARD_DATABASE_URL=sqlite:///${HOME}/.swu/swu_cards.db

# Security
JWT_SECRET=dev_secret_change_in_production_$(date +%s)
ACCESS_TOKEN_EXPIRE_MINUTES=10080

# CORS Configuration
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:4000,http://localhost:8000
EOF
echo "✅ Backend .env file created"

# Create root .env file for Docker if needed later
if [ ! -f .env ]; then
    echo "📝 Creating root .env file for Docker..."
    cat > .env << EOF
# Docker Environment Configuration
JWT_SECRET=dev_secret_change_in_production_$(date +%s)
ACCESS_TOKEN_EXPIRE_MINUTES=10080
NODE_ENV=development
NEXT_PUBLIC_API_URL=http://localhost:8000

# Database paths for Docker
DATABASE_PATH=./databases
FRONTEND_PATH=./frontend
BACKEND_PATH=./backend
EOF
    echo "✅ Root .env file created"
fi

echo ""
echo "🐍 Starting backend server..."
cd backend
# Install dependencies if venv doesn't exist
if [ ! -d "venv" ]; then
    echo "📦 Creating Python virtual environment..."
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
else
    source venv/bin/activate
fi

# Start backend in background
uvicorn src.api.main:app --host 127.0.0.1 --port 8000 --reload &
BACKEND_PID=$!
echo "✅ Backend started on http://localhost:8000 (PID: $BACKEND_PID)"

cd ..

echo ""
echo "⚛️ Starting frontend server..."
cd frontend
# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing Node.js dependencies..."
    npm ci
fi

# Start frontend in background
npm run dev &
FRONTEND_PID=$!
echo "✅ Frontend started on http://localhost:3000 (PID: $FRONTEND_PID)"

cd ..

echo ""
echo "🎉 Development environment is ready!"
echo ""
echo "🌐 Application URLs:"
echo "   Frontend: http://localhost:3000"
echo "   Backend API: http://localhost:8000"
echo "   API Docs: http://localhost:8000/docs"
echo ""
echo "🛑 To stop all services, press Ctrl+C or run:"
echo "   kill $BACKEND_PID $FRONTEND_PID"
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping services..."
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    echo "✅ Services stopped"
    exit 0
}

# Set trap to cleanup on script exit
trap cleanup SIGINT SIGTERM

# Wait for user to press Ctrl+C
echo "⏳ Services running... Press Ctrl+C to stop"
wait