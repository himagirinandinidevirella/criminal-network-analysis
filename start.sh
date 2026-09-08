#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# CrimeNet AI — startup script (SIH 2025)
#
# Boots the full stack in the correct order:
#   1. Verify Docker
#   2. Start infrastructure (Neo4j, PostgreSQL, Redis)
#   3. Wait for database readiness
#   4. Start backend, wait for health check
#   5. Load synthetic data
#   6. Start frontend + nginx
#   7. Print access information
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

cd "$(dirname "$0")"

if [[ "${1:-}" == "--demo" ]]; then
    exec bash ./start-demo.sh "${@:2}"
fi

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No colour

info()  { echo -e "${GREEN}[CrimeNet]${NC} $1"; }
warn()  { echo -e "${YELLOW}[CrimeNet]${NC} $1"; }
error() { echo -e "${RED}[CrimeNet]${NC} $1"; }

# ── 1. Verify Docker ─────────────────────────────────────────────────────────
if ! command -v docker >/dev/null 2>&1; then
    error "Docker is not installed or not in PATH. Please install Docker first."
    exit 1
fi
if ! docker info >/dev/null 2>&1; then
    error "Docker daemon is not running. Start Docker and re-run this script."
    exit 1
fi
info "Docker is running."

# ── 2. Start infrastructure ──────────────────────────────────────────────────
info "Starting infrastructure (Neo4j, PostgreSQL, Redis)..."
docker compose up -d neo4j postgres redis

# ── 3. Wait for databases ────────────────────────────────────────────────────
info "Waiting 30s for databases to become ready..."
sleep 30

for i in $(seq 1 12); do
    if docker compose exec -T neo4j cypher-shell -u neo4j -p crimenet2025 "RETURN 1" >/dev/null 2>&1; then
        break
    fi
    warn "Neo4j not ready yet (attempt $i/12), retrying in 5s..."
    sleep 5
done

# ── 4. Start backend ─────────────────────────────────────────────────────────
info "Starting backend..."
docker compose up -d backend

info "Waiting for backend health check..."
for i in $(seq 1 24); do
    if curl -sf http://localhost:8000/health >/dev/null 2>&1; then
        break
    fi
    warn "Backend not healthy yet (attempt $i/24), retrying in 5s..."
    sleep 5
done

# ── 5. Load synthetic data ───────────────────────────────────────────────────
info "Loading synthetic data (Operation Mumbai dataset)..."
docker compose exec -T backend python data/synthetic_data_generator.py || \
    warn "Synthetic data already present or loader skipped."

# ── 6. Start frontend + nginx ────────────────────────────────────────────────
info "Starting frontend and nginx..."
docker compose up -d frontend nginx

# ── 7. Print access info ─────────────────────────────────────────────────────
cat <<EOF

${GREEN}✅ CrimeNet AI is running!${NC}
────────────────────────────────────────────────────────────
  🌐  Dashboard:   http://localhost
  📡  API Docs:    http://localhost:8000/docs
  🕸️  Neo4j UI:    http://localhost:7474
  ⚡  Health:      http://localhost:8000/health
────────────────────────────────────────────────────────────
  👤  Admin:    admin@crimenet.gov.in    / Admin@123
  👤  Officer:  officer@crimenet.gov.in  / Officer@123
  👤  Analyst:  analyst@crimenet.gov.in  / Analyst@123
  👤  Senior:   senior@crimenet.gov.in   / Senior@123
  🔗  Guest:    /public/report/demo-token-2025
────────────────────────────────────────────────────────────
EOF
