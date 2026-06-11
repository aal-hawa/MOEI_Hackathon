#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────────
# MOEI Country Intelligence Platform – Service Stopper
# Stops all running services with comprehensive cleanup.
# ───────────────────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}  MOEI Country Intelligence Platform – Stopping Services${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Kill by process pattern (force kill)
echo -e "${YELLOW}Killing process groups...${NC}"

pkill -9 -f "uvicorn api.main:app" 2>/dev/null && echo "  ✓ Killed uvicorn" || echo "  - No uvicorn process found"
pkill -9 -f "mini-services/llm-proxy" 2>/dev/null && echo "  ✓ Killed llm-proxy" || echo "  - No llm-proxy process found"
pkill -9 -f "bun --hot index.ts" 2>/dev/null && echo "  ✓ Killed bun (llm-proxy)" || echo "  - No bun process found"
pkill -9 -f "next dev" 2>/dev/null && echo "  ✓ Killed next dev" || echo "  - No next dev process found"
pkill -9 -f "next-server" 2>/dev/null && echo "  ✓ Killed next-server" || echo "  - No next-server process found"

# Kill by port (free bound sockets)
echo ""
echo -e "${YELLOW}Freeing ports...${NC}"

fuser -k 3000/tcp 2>/dev/null && echo "  ✓ Freed port 3000" || echo "  - Port 3000 already free"
fuser -k 3040/tcp 2>/dev/null && echo "  ✓ Freed port 3040" || echo "  - Port 3040 already free"
fuser -k 3050/tcp 2>/dev/null && echo "  ✓ Freed port 3050" || echo "  - Port 3050 already free"

sleep 2

# Verify all ports are free
echo ""
echo -e "${YELLOW}Verifying ports are free...${NC}"

ALL_FREE=true
for PORT in 3000 3040 3050; do
  if fuser "$PORT/tcp" >/dev/null 2>&1; then
    echo -e "  ${RED}✗ Port $PORT is still occupied${NC}"
    ALL_FREE=false
  else
    echo -e "  ${GREEN}✓ Port $PORT is free${NC}"
  fi
done

echo ""
if [ "$ALL_FREE" = true ]; then
  echo -e "${GREEN}${BOLD}All services stopped and ports freed.${NC}"
else
  echo -e "${YELLOW}${BOLD}Some ports still occupied. You may need to manually kill processes.${NC}"
  echo -e "  Try: ${BOLD}fuser -k PORT/tcp${NC} or ${BOLD}pkill -9 -f 'pattern'${NC}"
fi

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
