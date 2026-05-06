#!/bin/bash
# Star Wars Unlimited — Production Deployment Script
#
# Usage: ./deploy.sh
#
# What it does:
#   1. Builds frontend + backend Docker images (linux/amd64)
#   2. Pushes both images to Docker Hub
#   3. Authenticates with Portainer and triggers a stack redeploy
#      (pulls fresh images and restarts containers automatically)
#
# Prerequisites:
#   - Docker Desktop running and logged into Docker Hub (`docker login`)
#   - .env.prod present with PORTAINER_* vars set
#
# No manual Portainer interaction needed after a successful run.

set -e

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
DOCKER_USERNAME="chanfriendly"
IMAGE_BASE="starwarsunlimited-db-api"
FRONTEND_IMAGE="${DOCKER_USERNAME}/${IMAGE_BASE}-frontend"
BACKEND_IMAGE="${DOCKER_USERNAME}/${IMAGE_BASE}-backend"

# ---------------------------------------------------------------------------
# Colour helpers
# ---------------------------------------------------------------------------
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
step()    { echo -e "${BLUE}==== $1 ====${NC}"; }
success() { echo -e "${GREEN}✓ $1${NC}"; }
warn()    { echo -e "${YELLOW}⚠ $1${NC}"; }
err()     { echo -e "${RED}✗ $1${NC}"; }

# ---------------------------------------------------------------------------
# Load .env.prod
# ---------------------------------------------------------------------------
if [ -f ".env.prod" ]; then
  step "Loading production environment"
  # Export key=value pairs, skipping comments and blanks
  set -a
  # shellcheck disable=SC1091
  source <(grep -v '^\s*#' .env.prod | grep -v '^\s*$')
  set +a
  success "Environment loaded"
else
  warn "No .env.prod found — Portainer redeploy step will be skipped"
fi

# ---------------------------------------------------------------------------
# Check Docker
# ---------------------------------------------------------------------------
if ! docker info >/dev/null 2>&1; then
  err "Docker is not running. Start Docker Desktop and try again."
  exit 1
fi
success "Docker is running"

# Check Docker Hub login (works with credential store)
if ! echo "https://index.docker.io/v1/" | docker-credential-desktop get >/dev/null 2>&1 && \
   ! docker info 2>/dev/null | grep -q "Username"; then
  warn "Docker Hub login not detected. Run: docker login"
  echo "Continuing — push will fail if you are not logged in."
fi

# ---------------------------------------------------------------------------
# Build + push
# ---------------------------------------------------------------------------
build_and_push() {
  local context_dir=$1
  local image_name=$2
  local dockerfile_path=$3

  step "Building ${image_name}:latest"
  docker build \
    --platform linux/amd64 \
    -t "${image_name}:latest" \
    -f "$dockerfile_path" \
    "$context_dir"
  success "Built ${image_name}"

  step "Pushing ${image_name}:latest"
  docker push "${image_name}:latest"
  success "Pushed ${image_name}"
}

[ -d "frontend" ] || { err "frontend/ directory not found"; exit 1; }
[ -d "backend" ]  || { err "backend/ directory not found";  exit 1; }

build_and_push "frontend" "$FRONTEND_IMAGE" "frontend/Dockerfile"
build_and_push "backend"  "$BACKEND_IMAGE"  "backend/Dockerfile"

# ---------------------------------------------------------------------------
# Portainer auto-redeploy
# ---------------------------------------------------------------------------
portainer_redeploy() {
  local portainer_url="${PORTAINER_URL}"
  local user="${PORTAINER_USER}"
  local pass="${PORTAINER_PASSWORD}"
  local stack_id="${PORTAINER_STACK_ID}"
  local endpoint_id="${PORTAINER_ENDPOINT_ID}"

  if [ -z "$portainer_url" ] || [ -z "$user" ] || [ -z "$pass" ] || \
     [ -z "$stack_id" ] || [ -z "$endpoint_id" ]; then
    warn "Portainer credentials not fully set in .env.prod — skipping auto-redeploy"
    echo "  Set: PORTAINER_URL, PORTAINER_USER, PORTAINER_PASSWORD, PORTAINER_STACK_ID, PORTAINER_ENDPOINT_ID"
    return 0
  fi

  step "Triggering Portainer redeploy (stack ${stack_id})"

  # Authenticate
  local token
  token=$(curl -sk -X POST "${portainer_url}/api/auth" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"${user}\",\"password\":\"${pass}\"}" \
    | python3 -c "import sys,json; print(json.load(sys.stdin).get('jwt',''))" 2>/dev/null)

  if [ -z "$token" ]; then
    err "Portainer authentication failed — check credentials in .env.prod"
    return 1
  fi
  success "Portainer authenticated"

  # Fetch current stack compose + env (preserve env vars set in Portainer UI)
  local stack_info
  stack_info=$(curl -sk -H "Authorization: Bearer ${token}" \
    "${portainer_url}/api/stacks/${stack_id}")

  local current_env
  current_env=$(echo "$stack_info" | python3 -c "
import sys,json
s=json.load(sys.stdin)
print(json.dumps(s.get('Env',[])))
" 2>/dev/null || echo "[]")

  # Read compose file from disk (our single source of truth)
  local compose_content
  compose_content=$(cat docker-compose.prod.yaml)

  # Update stack (pullImage:true pulls latest from Docker Hub before restarting)
  local result
  result=$(curl -sk -X PUT \
    "${portainer_url}/api/stacks/${stack_id}?endpointId=${endpoint_id}" \
    -H "Authorization: Bearer ${token}" \
    -H "Content-Type: application/json" \
    -d "{
      \"stackFileContent\": $(echo "$compose_content" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read()))"),
      \"env\": ${current_env},
      \"prune\": false,
      \"pullImage\": true
    }")

  local status
  status=$(echo "$result" | python3 -c "import sys,json; print(json.load(sys.stdin).get('Status','?'))" 2>/dev/null)
  local msg
  msg=$(echo "$result" | python3 -c "import sys,json; print(json.load(sys.stdin).get('message',''))" 2>/dev/null)

  if [ "$status" = "1" ]; then
    success "Stack redeployed — containers are restarting with new images"
  else
    err "Stack update returned unexpected status: ${status}"
    [ -n "$msg" ] && echo "  Message: $msg"
    return 1
  fi
}

portainer_redeploy

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
step "Deployment complete"
echo "  Frontend : ${FRONTEND_IMAGE}:latest"
echo "  Backend  : ${BACKEND_IMAGE}:latest"
echo ""
echo "  Production: http://192.168.1.124:4000"
echo "  Wait ~30s for containers to restart, then smoke-test:"
echo "    curl http://192.168.1.124:4000/api/cards?limit=1"
