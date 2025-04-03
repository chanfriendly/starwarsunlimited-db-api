#!/bin/bash
# deploy.sh

# Set environment
ENV=${1:-production}
echo "Deploying to $ENV environment"

# Source environment variables
if [ -f ".env.$ENV" ]; then
  source .env.$ENV
else
  echo "Warning: Environment file .env.$ENV not found, using .env"
  source .env
fi

# Pull latest code
git pull origin main

# Build and restart containers
docker-compose down
docker-compose build
docker-compose up -d

# Check container status
docker-compose ps

echo "Deployment complete!"