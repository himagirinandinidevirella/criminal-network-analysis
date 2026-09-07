#!/usr/bin/env bash
# =============================================================================
# CrimeNet AI — Blockchain & Cybersecurity upgrade script
# -----------------------------------------------------------------------------
# Sets up and deploys the blockchain layer on top of the existing project:
#
#   1. Installs Python blockchain dependencies (web3, ipfshttpclient, crypto)
#   2. Installs & compiles the Hardhat smart contracts and runs their tests
#   3. Starts a local Ganache node (chain id 1337) — Docker, else npx ganache
#   4. Deploys the five contracts and writes:
#        blockchain/deployed_contracts.json     (backend ABIs + addresses)
#        frontend/src/contracts/contracts.json  (frontend addresses)
#   5. Starts a local IPFS node (optional; Docker)
#   6. Installs frontend dependencies and builds the UI
#
# The blockchain is an ENHANCEMENT — the app fully works without it (the
# backend falls back to a built-in local ledger when no node is reachable).
#
# Usage:  ./blockchain_upgrade.sh [ganache|ipfs|contracts|frontend|all|help]
# =============================================================================

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BLOCKCHAIN_DIR="$ROOT/blockchain"
BACKEND_DIR="$ROOT/backend"
FRONTEND_DIR="$ROOT/frontend"

GREEN="\033[0;32m"; YELLOW="\033[0;33m"; CYAN="\033[0;36m"; RED="\033[0;31m"; NC="\033[0m"

info()  { echo -e "${CYAN}[crimenet]${NC} $*"; }
ok()    { echo -e "${GREEN}[✓]${NC} $*"; }
warn()  { echo -e "${YELLOW}[!]${NC} $*"; }
err()   { echo -e "${RED}[✗]${NC} $*"; }

need() { command -v "$1" >/dev/null 2>&1 || { err "Missing dependency: $1"; return 1; }; }

# ── 1. Backend Python dependencies ────────────────────────────────────────────
install_backend_deps() {
  info "Installing backend blockchain dependencies…"
  cd "$BACKEND_DIR" || return 1
  if command -v pip3 >/dev/null 2>&1; then
    pip3 install -q "web3==6.11.0" "ipfshttpclient==0.8.0a2" "cryptography==41.0.4" \
      && ok "Backend deps installed" || warn "pip install failed (web3 optional — local ledger fallback will be used)"
  else
    warn "pip3 not found — skipping (the backend degrades gracefully without web3)"
  fi
}

# ── 2. Hardhat contracts: install, compile, test ──────────────────────────────
setup_contracts() {
  info "Setting up Hardhat contracts…"
  need node || return 1
  need npm  || return 1
  cd "$BLOCKCHAIN_DIR" || return 1
  npm install --silent || { err "npm install failed"; return 1; }
  ok "Hardhat dependencies installed"
  npx hardhat compile || { err "Contract compilation failed"; return 1; }
  ok "Contracts compiled"
  npx hardhat test || warn "Contract tests failed (review output above)"
}

# ── 3. Local Ganache node (chain id 1337) ─────────────────────────────────────
start_ganache() {
  info "Starting local Ganache node (chain id 1337)…"
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    if docker ps --format '{{.Names}}' | grep -q '^crimenet-ganache$'; then
      ok "Ganache container already running"
      return 0
    fi
    docker run -d --name crimenet-ganache -p 8545:8545 \
      trufflesuite/ganache:latest \
      --chain.chainId 1337 --server.host 0.0.0.0 --server.port 8545 \
      --wallet.mnemonic "test test test test test test test test test test test junk" \
      --wallet.totalAccounts 10 --wallet.defaultBalance 1000 >/dev/null 2>&1 \
      && ok "Ganache started (Docker)" || warn "Could not start Ganache via Docker"
  else
    cd "$BLOCKCHAIN_DIR" || return 1
    (nohup npx ganache --chain.chainId 1337 --port 8545 > ganache.log 2>&1 &) \
      && ok "Ganache started (npx)" || warn "Could not start Ganache via npx"
  fi
  # Wait for the RPC endpoint.
  for _ in $(seq 1 20); do
    if curl -s -X POST -H "Content-Type: application/json" \
        --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
        http://localhost:8545 >/dev/null 2>&1; then
      ok "Ganache RPC reachable at http://localhost:8545"
      return 0
    fi
    sleep 1
  done
  warn "Ganache not reachable — deploy will fall back to the built-in local ledger"
}

# ── 4. Deploy the five contracts ──────────────────────────────────────────────
deploy_contracts() {
  info "Deploying smart contracts…"
  cd "$BLOCKCHAIN_DIR" || return 1
  if ! command -v node >/dev/null 2>&1; then
    warn "Node not found — skipping deployment (local ledger fallback active)"
    return 0
  fi
  npx hardhat run scripts/deploy.js --network localhost 2>/dev/null \
    && ok "Contracts deployed → blockchain/deployed_contracts.json + frontend/src/contracts/contracts.json" \
    || warn "Deploy skipped (Ganache down). The backend will use its local ledger."
}

# ── 5. Local IPFS node (optional) ─────────────────────────────────────────────
start_ipfs() {
  info "Starting local IPFS node…"
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    if docker ps --format '{{.Names}}' | grep -q '^crimenet-ipfs$'; then
      ok "IPFS container already running"
      return 0
    fi
    docker run -d --name crimenet-ipfs \
      -p 5001:5001 -p 8080:8080 -p 4001:4001 \
      ipfs/kubo:latest >/dev/null 2>&1 \
      && ok "IPFS started (Docker) at http://localhost:5001" \
      || warn "Could not start IPFS via Docker (evidence falls back to local content store)"
  else
    warn "Docker not available — evidence files will use the local content-addressed store"
  fi
}

# ── 6. Frontend install + build ───────────────────────────────────────────────
build_frontend() {
  info "Installing frontend dependencies…"
  need node || return 1
  need npm  || return 1
  cd "$FRONTEND_DIR" || return 1
  npm install --silent || { err "npm install failed"; return 1; }
  ok "Frontend dependencies installed"
  npm run build || warn "Frontend build failed — run 'npm run dev' for development"
}

# ── Main ──────────────────────────────────────────────────────────────────────
main() {
  local step="${1:-all}"
  case "$step" in
    ganache)   start_ganache ;;
    ipfs)      start_ipfs ;;
    contracts) setup_contracts && deploy_contracts ;;
    frontend)  build_frontend ;;
    backend)   install_backend_deps ;;
    all)
      install_backend_deps
      setup_contracts
      start_ganache
      deploy_contracts
      start_ipfs
      build_frontend
      ;;
    help|-h|--help)
      echo "Usage: ./blockchain_upgrade.sh [ganache|ipfs|contracts|frontend|backend|all|help]"
      return 0
      ;;
    *)
      err "Unknown step '$step'"; return 1 ;;
  esac

  echo
  info "Done. Next steps:"
  echo "  • Backend:  cd backend && uvicorn app.main:app --reload  (auto-detects Ganache/IPFS)"
  echo "  • Frontend: cd frontend && npm run dev"
  echo "  • Explorer: http://localhost:3000/blockchain"
  echo
  info "Demo talking points:"
  echo "  • Evidence tamper detection  — SHA-256 fingerprint on-chain; verify any file"
  echo "  • Immutable audit trail      — every action committed; cannot be deleted"
  echo "  • Record integrity           — DB record hashes checked against the chain"
  echo "  • Inter-agency sharing       — time-boxed, level-scoped access grants"
}

main "$@"
