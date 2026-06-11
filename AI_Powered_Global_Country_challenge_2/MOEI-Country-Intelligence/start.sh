#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────────
# MOEI Country Intelligence Platform – Service Launcher
# Starts all required services using ( cmd & ) subshell pattern
# for process survival across terminal session drops.
# ───────────────────────────────────────────────────────────────

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_ROOT"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}  MOEI Country Intelligence Platform – Starting Services${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# ── 1. Kill all stale processes ──────────────────────────────
echo ""
echo -e "${YELLOW}[1/4] Cleaning up existing processes...${NC}"

# Kill by process pattern
pkill -9 -f "uvicorn api.main:app" 2>/dev/null || true
pkill -9 -f "mini-services/llm-proxy" 2>/dev/null || true
pkill -9 -f "next dev" 2>/dev/null || true
pkill -9 -f "next-server" 2>/dev/null || true
pkill -9 -f "bun --hot" 2>/dev/null || true

# Kill by port (free up bound sockets)
fuser -k 3000/tcp 2>/dev/null || true
fuser -k 3040/tcp 2>/dev/null || true
fuser -k 3050/tcp 2>/dev/null || true

sleep 2

# Verify ports are free
for PORT in 3000 3040 3050; do
  if fuser "$PORT/tcp" >/dev/null 2>&1; then
    echo -e "  ${RED}✗ Port $PORT still occupied after cleanup${NC}"
  fi
done
echo -e "  ${GREEN}✓ Stale processes cleaned${NC}"

# ── 2. Start LLM Proxy (port 3040) ─────────────────────────
echo ""
echo -e "${YELLOW}[2/4] Starting LLM Proxy on port 3040...${NC}"

cd "$PROJECT_ROOT/mini-services/llm-proxy"

# Ensure bun dependencies are installed
if [ ! -d "node_modules" ]; then
  echo "  Installing LLM proxy dependencies..."
  bun install --silent 2>/dev/null
fi

# Start in subshell background — process survives terminal death
(
  bun --hot index.ts >> "$PROJECT_ROOT/logs/llm-proxy.log" 2>&1 &
)
cd "$PROJECT_ROOT"

# Wait and verify
echo "  Waiting for LLM proxy to start..."
for i in $(seq 1 15); do
  if curl -sf http://localhost:3040/health >/dev/null 2>&1; then
    echo -e "  ${GREEN}✓ LLM Proxy is running on port 3040${NC}"
    break
  fi
  if [ "$i" -eq 15 ]; then
    echo -e "  ${RED}✗ LLM Proxy failed to start (check logs/llm-proxy.log)${NC}"
  fi
  sleep 1
done

# ── 3. Start Intelligence Engine Backend (port 3050) ────────
echo ""
echo -e "${YELLOW}[3/4] Starting Intelligence Engine on port 3050...${NC}"

cd "$PROJECT_ROOT/mini-services/intelligence-engine"

# Ensure .env exists with correct configuration
if [ ! -f .env ]; then
  cat > .env << 'ENVEOF'
# ── Z SDK WEB proxy (OpenAI-compatible) ──
OPENAI_API_KEY=z-sdk-proxy
OPENAI_API_BASE=http://localhost:3040/v1

# Where the SQLite Library lives
LIBRARY_DB_PATH=./data/library.db
ENVEOF
  echo "  Created .env file for Intelligence Engine"
fi

# Ensure data directory exists
mkdir -p data

# Use the venv Python
IE_PYTHON="$PROJECT_ROOT/mini-services/intelligence-engine/.venv/bin/python3"

if [ ! -f "$IE_PYTHON" ]; then
  echo -e "  ${RED}✗ Virtual environment not found at $IE_PYTHON${NC}"
  echo "  Creating venv and installing dependencies..."
  python3 -m venv .venv
  .venv/bin/pip install -q -r requirements.txt
fi

# Fix SSL cert path for litellm (sandbox env may not have default path)
export SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt
export CURL_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt

# Start uvicorn in subshell background
(
  SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt \
  CURL_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt \
  "$IE_PYTHON" -m uvicorn api.main:app --host 0.0.0.0 --port 3050 >> "$PROJECT_ROOT/logs/intelligence-engine.log" 2>&1 &
)
cd "$PROJECT_ROOT"

# Wait and verify
echo "  Waiting for Intelligence Engine to start..."
for i in $(seq 1 20); do
  if curl -sf http://localhost:3050/health >/dev/null 2>&1; then
    echo -e "  ${GREEN}✓ Intelligence Engine is running on port 3050${NC}"
    break
  fi
  if [ "$i" -eq 20 ]; then
    echo -e "  ${RED}✗ Intelligence Engine failed to start (check logs/intelligence-engine.log)${NC}"
  fi
  sleep 1
done

# ── 4. Start Next.js Frontend (port 3000) ───────────────────
echo ""
echo -e "${YELLOW}[4/4] Starting Next.js Frontend on port 3000...${NC}"

# Start Next.js in subshell background — process survives terminal death
(
  ./node_modules/.bin/next dev -p 3000 >> "$PROJECT_ROOT/dev.log" 2>&1 &
)

# Wait and verify
echo "  Waiting for Next.js to compile..."
for i in $(seq 1 30); do
  if curl -sf -o /dev/null http://localhost:3000 >/dev/null 2>&1; then
    echo -e "  ${GREEN}✓ Next.js Frontend is running on port 3000${NC}"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo -e "  ${YELLOW}⚠ Next.js may still be compiling... (check dev.log)${NC}"
  fi
  sleep 2
done

# ── 5. Final Summary ────────────────────────────────────────
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}  Service Status Summary${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

ALL_OK=true

# Check each service
if curl -sf http://localhost:3040/health >/dev/null 2>&1; then
  echo -e "  ${GREEN}✓${NC} LLM Proxy            http://localhost:3040"
else
  echo -e "  ${RED}✗${NC} LLM Proxy            http://localhost:3040  ${RED}(DOWN)${NC}"
  ALL_OK=false
fi

if curl -sf http://localhost:3050/health >/dev/null 2>&1; then
  echo -e "  ${GREEN}✓${NC} Intelligence Engine   http://localhost:3050"
else
  echo -e "  ${RED}✗${NC} Intelligence Engine   http://localhost:3050  ${RED}(DOWN)${NC}"
  ALL_OK=false
fi

if curl -sf -o /dev/null http://localhost:3000 >/dev/null 2>&1; then
  echo -e "  ${GREEN}✓${NC} Next.js Frontend      http://localhost:3000"
else
  echo -e "  ${RED}✗${NC} Next.js Frontend      http://localhost:3000  ${RED}(DOWN)${NC}"
  ALL_OK=false
fi

# Check PID counts for each service
LLM_PIDS=$(pgrep -f "bun --hot index.ts" 2>/dev/null | wc -l)
IE_PIDS=$(pgrep -f "uvicorn api.main:app" 2>/dev/null | wc -l)
NEXT_PIDS=$(pgrep -f "next dev" 2>/dev/null | wc -l)

echo ""
echo -e "  Process counts:  LLM Proxy: ${LLM_PIDS}  |  Engine: ${IE_PIDS}  |  Next.js: ${NEXT_PIDS}"
echo ""
echo -e "  Log files:"
echo "    • logs/llm-proxy.log"
echo "    • logs/intelligence-engine.log"
echo "    • dev.log"
echo ""

if [ "$ALL_OK" = true ]; then
  echo -e "  ${GREEN}${BOLD}All services are running!${NC}"
else
  echo -e "  ${YELLOW}${BOLD}Some services are not ready. Check logs above.${NC}"
fi

echo ""
echo -e "  Use ${BOLD}bash stop.sh${NC} to stop all services."
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
