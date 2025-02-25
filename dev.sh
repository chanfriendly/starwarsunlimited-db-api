#!/bin/bash

# Start the backend server
cd backend
source venv/bin/activate
uvicorn src.api.main:app --reload --port 8000 &
BACKEND_PID=$!

# Start the frontend server
cd ../frontend
npm run dev &
FRONTEND_PID=$!

# Handle cleanup on script termination
cleanup() {
    echo "Shutting down servers..."
    kill $BACKEND_PID
    kill $FRONTEND_PID
    exit 0
}

trap cleanup SIGINT SIGTERM

# Keep the script running
wait 