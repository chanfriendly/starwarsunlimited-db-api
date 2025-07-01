#!/bin/bash
# dev.sh - Start development environment with proper configuration

set -e  # Exit on any error

echo "🚀 Starting Star Wars Unlimited Twin Suns Development Environment"
echo "================================================================="

# Load development environment
if [ -f ".env.dev" ]; then
    echo "📄 Loading development environment from .env.dev"
    export $(cat .env.dev | grep -v '^#' | xargs)
else
    echo "⚠️  .env.dev not found, using defaults"
fi

# Check if we're in the right directory
if [ ! -d "backend" ] || [ ! -d "frontend" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    echo "   Expected structure: project-root/backend and project-root/frontend"
    exit 1
fi

# Function to cleanup background processes
cleanup() {
    echo -e "\n🛑 Shutting down development servers..."
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
    fi
    exit 0
}

# Trap Ctrl+C to cleanup
trap cleanup SIGINT

# Check if required dependencies are installed
echo "🔍 Checking dependencies..."

# Check Python dependencies
echo "  Checking Python dependencies..."
cd backend
if ! python3 -c "import fastapi, uvicorn, sqlalchemy, passlib" 2>/dev/null; then
    echo "  📦 Installing Python dependencies..."
    pip install -r requirements.txt
    pip install passlib[bcrypt] python-jose[cryptography]
fi

# Check Node dependencies
echo "  Checking Node.js dependencies..."
cd ../frontend
if [ ! -d "node_modules" ]; then
    echo "  📦 Installing Node.js dependencies..."
    npm install
fi

# Verify database exists and has data
echo "🗃️  Checking database..."
cd ..
python3 -c "
import sqlite3
import os
db_path = os.path.expanduser('~/.swu/swu_cards.db')
if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute('SELECT COUNT(*) FROM cards')
    count = cursor.fetchone()[0]
    print(f'  ✅ Database found with {count} cards')
    conn.close()
else:
    print('  ⚠️  Database not found - run backend/scripts/build_database.py')
"

echo ""
echo "🎯 Starting development servers..."
echo "   Backend:  http://localhost:8000"
echo "   Frontend: http://localhost:3000"
echo "   API Docs: http://localhost:8000/docs"
echo ""
echo "📝 Logs will appear below. Press Ctrl+C to stop both servers."
echo "================================================================="

# Start backend server in background
echo "🔧 Starting backend server..."
cd backend
uvicorn src.api.main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# Give backend time to start
sleep 3

# Test if backend is running
if curl -s http://localhost:8000/health > /dev/null; then
    echo "✅ Backend server started successfully"
else
    echo "❌ Backend server failed to start"
    cleanup
fi

# Start frontend server in background
echo "🎨 Starting frontend server..."
cd ../frontend
npm run dev &
FRONTEND_PID=$!

# Give frontend time to start
sleep 3

echo ""
echo "🎉 Development environment ready!"
echo "   🔗 Frontend: http://localhost:3000"
echo "   🔗 Backend API: http://localhost:8000/api/cards"
echo "   🔗 API Documentation: http://localhost:8000/docs"
echo ""
echo "💡 To test the connection:"
echo "   🌐 Frontend: curl http://localhost:3000"
echo "   🔗 Backend API: curl http://localhost:8000/api/cards?limit=3"
echo "   🔍 API Health: curl http://localhost:8000/health"
echo ""
echo "📋 Watching for changes... Press Ctrl+C to stop"

# Wait for background processes
wait