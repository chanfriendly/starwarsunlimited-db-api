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
#   - .env.prod present with non-secret config vars set
#   - Bitwarden CLI unlocked: export BW_SESSION=$(bw unlock --raw)
#     (secrets are fetched from Bitwarden; .env.prod fallback still works)
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
# Load .env.prod (non-secret config)
# ---------------------------------------------------------------------------
if [ -f ".env.prod" ]; then
  step "Loading production environment"
  set -a
  # shellcheck disable=SC1091
  source <(grep -v '^\s*#' .env.prod | grep -v '^\s*$')
  set +a
  success "Environment loaded"
else
  warn "No .env.prod found — Portainer redeploy step will be skipped"
fi

# ---------------------------------------------------------------------------
# Fetch secrets from Bitwarden (overrides any .env.prod fallback values)
# ---------------------------------------------------------------------------
if [ -n "${BW_SESSION}" ] && command -v bw >/dev/null 2>&1; then
  step "Fetching secrets from Bitwarden"

  _jwt=$(bw get password twinsuns-jwt-secret --session "${BW_SESSION}" 2>/dev/null)
  if [ -n "${_jwt}" ]; then
    export JWT_SECRET="${_jwt}"
    success "JWT_SECRET loaded from Bitwarden"
  else
    warn "Could not fetch twinsuns-jwt-secret from Bitwarden — using .env.prod fallback"
  fi

  _portainer_pw=$(bw get password twinsuns-portainer --session "${BW_SESSION}" 2>/dev/null)
  if [ -n "${_portainer_pw}" ]; then
    export PORTAINER_PASSWORD="${_portainer_pw}"
    success "PORTAINER_PASSWORD loaded from Bitwarden"
  else
    warn "Could not fetch twinsuns-portainer from Bitwarden — using .env.prod fallback"
  fi
else
  warn "BW_SESSION not set — secrets loaded from .env.prod fallback"
  warn "To use Bitwarden: export BW_SESSION=\$(bw unlock --raw)"
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
  # Use Python for all JSON operations — shell string interpolation breaks on
  # passwords that contain special characters like " or :.
  if [ ! -f ".env.prod" ]; then
    warn "No .env.prod found — skipping Portainer redeploy"
    return 0
  fi

  step "Triggering Portainer redeploy"

  local compose_file="docker-compose.prod.yaml"
  python3 - "$compose_file" <<'PYEOF'
import sys, json, ssl, urllib.request, urllib.error

compose_path = sys.argv[1]

# Parse .env.prod directly — avoids shell quoting issues with special-char passwords
config = {}
with open('.env.prod') as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            k, v = line.split('=', 1)
            config[k.strip()] = v.strip().strip("'\"")

required = ['PORTAINER_URL', 'PORTAINER_USER', 'PORTAINER_PASSWORD',
            'PORTAINER_STACK_ID', 'PORTAINER_ENDPOINT_ID']
missing = [k for k in required if not config.get(k)]
if missing:
    print(f"⚠  Portainer credentials missing in .env.prod: {missing} — skipping")
    sys.exit(0)

url      = config['PORTAINER_URL']
stack_id = config['PORTAINER_STACK_ID']
ep_id    = config['PORTAINER_ENDPOINT_ID']

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def api(method, path, data=None, token=None):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    body = json.dumps(data).encode() if data is not None else None
    req = urllib.request.Request(f'{url}{path}', data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, context=ctx) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        raise RuntimeError(f'HTTP {e.code}: {e.read().decode()}') from e

# Auth
resp = api('POST', '/api/auth', {'username': config['PORTAINER_USER'],
                                  'password': config['PORTAINER_PASSWORD']})
token = resp['jwt']
print('  ✓ Portainer authenticated')

# Preserve env vars stored in Portainer UI
stack   = api('GET', f'/api/stacks/{stack_id}', token=token)
env_vars = stack.get('Env', [])
print(f'  Preserving {len(env_vars)} env vars: {[e["name"] for e in env_vars]}')

# Use compose from disk — our single source of truth
with open(compose_path) as f:
    compose = f.read()

# Redeploy
result = api('PUT', f'/api/stacks/{stack_id}?endpointId={ep_id}',
             {'stackFileContent': compose, 'env': env_vars,
              'prune': False, 'pullImage': True},
             token=token)

status = result.get('Status')
if status == 1:
    print('  ✓ Stack redeployed — containers restarting with new images')
else:
    print(f'  ✗ Unexpected status: {status}  message: {result.get("message","")}')
    sys.exit(1)
PYEOF

  local exit_code=$?
  if [ $exit_code -ne 0 ]; then
    err "Portainer redeploy failed (see output above)"
    return 1
  fi
  success "Portainer redeploy complete"
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
