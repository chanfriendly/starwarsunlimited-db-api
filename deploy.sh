#!/bin/bash

# Star Wars Unlimited - Production Deployment Script
# This script builds and pushes Docker images to Docker Hub

set -e  # Exit on any error

# Configuration
DOCKER_USERNAME="chanfriendly"
IMAGE_BASE="starwarsunlimited-db-api"
FRONTEND_IMAGE="${DOCKER_USERNAME}/${IMAGE_BASE}-frontend"
BACKEND_IMAGE="${DOCKER_USERNAME}/${IMAGE_BASE}-backend"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_step() {
    echo -e "${BLUE}==== $1 ====${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Function to check if Docker is running
check_docker() {
    if ! docker info >/dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
    print_success "Docker is running"
}

# Function to build and push an image
build_and_push() {
    local context_dir=$1
    local image_name=$2
    local dockerfile_path=$3
    
    print_step "Building $image_name"
    
    # Build with platform specification for compatibility
    docker build \
        --platform linux/amd64 \
        -t "${image_name}:latest" \
        -f "$dockerfile_path" \
        "$context_dir"
    
    print_success "Built $image_name"
    
    print_step "Pushing $image_name to Docker Hub"
    docker push "${image_name}:latest"
    print_success "Pushed $image_name"
}

# Main deployment function
main() {
    print_step "Starting Star Wars Unlimited Production Deployment"
    
    # Load production environment if available
    if [ -f ".env.prod" ]; then
        print_step "Loading production environment variables"
        export $(cat .env.prod | grep -v '^#' | xargs)
        print_success "Production environment loaded"
    else
        print_warning "No .env.prod file found, using defaults"
    fi
    
    # Check prerequisites
    check_docker
    
    # Check if we're logged into Docker Hub
    if ! docker info | grep -q "Username"; then
        print_warning "You may need to log into Docker Hub"
        echo "Run: docker login"
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
    
    # Build and push frontend
    if [ -d "frontend" ]; then
        build_and_push "frontend" "$FRONTEND_IMAGE" "frontend/Dockerfile"
    else
        print_error "Frontend directory not found"
        exit 1
    fi
    
    # Build and push backend
    if [ -d "backend" ]; then
        build_and_push "backend" "$BACKEND_IMAGE" "backend/Dockerfile"
    else
        print_error "Backend directory not found"
        exit 1
    fi
    
    print_step "Deployment Summary"
    echo "Frontend image: ${FRONTEND_IMAGE}:latest"
    echo "Backend image: ${BACKEND_IMAGE}:latest"
    echo ""
    echo "Next steps:"
    echo "1. Copy docker-compose.prod.yaml to your TrueNAS server"
    echo "2. Deploy the stack in Portainer using the production compose file"
    echo "3. Make sure your databases are at: /mnt/volume1/docker/twinsuns/databases"
    
    print_success "Deployment script completed successfully!"
}

# Run the script
main "$@"