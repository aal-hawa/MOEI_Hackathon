#!/bin/bash

echo "╔════════════════════════════════════════════════════════╗"
echo "║  MOEI Portal - Unified AI Digital Brain Setup         ║"
echo "║  Omnichannel AI Platform — Service Manager             ║"
echo "╚════════════════════════════════════════════════════════╝"

# ──────────────────────────────────────────────────────────────────────────────
# This script starts ALL services using the ( cmd & ) subshell pattern.
# The KEY trick: ( cmd & ) creates a subshell that backgrounds the process,
# then the subshell exits cleanly. The process gets reparented to PID 1 (init)
# so it survives the terminal session dying.
# nohup + disown doesn't work in sandbox, but ( cmd & ) does.
#
# Services:
#   1. Hono Worker API    (port 3002) — bun --hot src/worker/index.ts
#   2. Voice Agent        (port 3004) — bun --hot src/worker/voice-agent/index.ts
#   3. Next.js Frontend   (port 3000) — next dev -p 3000
#
# Usage:
#   bash setup.sh          — Start all services
#   bash setup.sh restart  — Kill and restart all services
#   bash setup.sh status   — Check service status
# ──────────────────────────────────────────────────────────────────────────────

cd /home/z/my-project

# ─── Status Check ─────────────────────────────────────────────────────────────

if [ "$1" = "status" ]; then
  echo "🔍 Checking service status..."
  check_port() {
    if ss -tlnp 2>/dev/null | grep -q ":$1 "; then
      echo "  ✅ Port $1 ($2) - LISTENING"
    else
      echo "  ❌ Port $1 ($2) - NOT LISTENING"
    fi
  }
  check_port 3000 "Next.js"
  check_port 3002 "Worker API"
  check_port 3004 "Voice Agent"
  exit 0
fi

# ─── Kill stale processes ────────────────────────────────────────────────────

echo "🧹 Cleaning up stale processes..."
pkill -9 -f "next dev" 2>/dev/null || true
pkill -9 -f "next-server" 2>/dev/null || true
pkill -9 -f "chrome" 2>/dev/null || true
pkill -9 -f "bun --hot" 2>/dev/null || true
pkill -9 -f "bun index.ts" 2>/dev/null || true
pkill -9 -f "postcss" 2>/dev/null || true
fuser -k 3000/tcp 3002/tcp 3004/tcp 2>/dev/null || true
sleep 3

# ─── Database setup ──────────────────────────────────────────────────────────

echo "📦 Setting up database..."
bun run db:push 2>/dev/null || npx prisma db push 2>/dev/null || true

# Seed database (only if empty)
echo "🌱 Seeding database (if needed)..."
SEED_COUNT=$(python3 -c "import sqlite3; c=sqlite3.connect('db/custom.db'); print(c.execute('SELECT COUNT(*) FROM Customer').fetchone()[0])" 2>/dev/null || echo "0")
if [ "$SEED_COUNT" = "0" ] || [ -z "$SEED_COUNT" ]; then
  echo "  Seeding initial data..."
  bun run db:seed:moei 2>/dev/null || true
else
  echo "  Database already seeded ($SEED_COUNT customers)"
fi

# ─── Install dependencies ────────────────────────────────────────────────────

echo "📦 Installing worker dependencies..."
cd /home/z/my-project/src/worker && bun install 2>/dev/null || true
cd /home/z/my-project/src/worker/voice-agent && bun install 2>/dev/null || true
cd /home/z/my-project

# ─── Start all services using ( cmd & ) subshell pattern ─────────────────────
# This is the KEY trick: ( cmd & ) creates a subshell that backgrounds the
# process, then the subshell exits cleanly. The process gets reparented to
# PID 1 (init) so it survives the terminal session dying.
# nohup+disown doesn't work in this sandbox, but ( cmd & ) does.

# Start Hono Worker API (subshell background - port 3002)
echo "🚀 Starting Hono Worker API on port 3002..."
( cd /home/z/my-project/src/worker && bun --hot index.ts 2>&1 & )
sleep 3

# Start Voice Agent Service (subshell background - port 3004)
echo "🎤 Starting Voice Agent on port 3004..."
( cd /home/z/my-project/src/worker/voice-agent && bun --hot index.ts 2>&1 & )
sleep 3

# Start Next.js dev server (subshell background - port 3000)
# Using direct binary instead of `bun run dev` for max survivability
echo "🌐 Starting Next.js on port 3000..."
( cd /home/z/my-project && ./node_modules/.bin/next dev -p 3000 2>&1 & )
sleep 6

# ─── Verify all services are alive ───────────────────────────────────────────

echo ""
echo "🔍 Verifying services..."
SERVICES_OK=true

check_port() {
  if ss -tlnp 2>/dev/null | grep -q ":$1 "; then
    echo "  ✅ Port $1 ($2) - LISTENING"
  else
    echo "  ❌ Port $1 ($2) - NOT LISTENING"
    SERVICES_OK=false
  fi
}

check_port 3002 "Worker API"
check_port 3004 "Voice Agent"
check_port 3000 "Next.js"

if [ "$SERVICES_OK" = true ]; then
  echo ""
  echo "╔════════════════════════════════════════════════════════╗"
  echo "║  ✅ MOEI Omnichannel AI Platform is running!          ║"
  echo "║                                                        ║"
  echo "║  • Next.js:      http://localhost:3000                 ║"
  echo "║  • Worker API:   http://localhost:3002/api             ║"
  echo "║  • Voice Agent:  ws://localhost:3004                   ║"
  echo "║                                                        ║"
  echo "║  Channels: Web • WhatsApp • Voice Call • Email         ║"
  echo "║  Context: Unified AI Digital Brain (Cross-channel)     ║"
  echo "║                                                        ║"
  echo "║  Service Manager: /api/service-manager                 ║"
  echo "║  Start via Retry button or Dashboard Services widget   ║"
  echo "║                                                        ║"
  echo "║  API Keys: moei-config.json (not .env)                 ║"
  echo "║  STT: Deepgram Nova-3 | TTS: Cartesia Sonic-3.5       ║"
  echo "║  LLM: Gemini 2.5 Flash (via Recentech proxy)          ║"
  echo "║                                                        ║"
  echo "║  Process mgmt: ( cmd & ) subshell pattern              ║"
  echo "║  Processes reparent to PID 1 → survive terminal death  ║"
  echo "╚════════════════════════════════════════════════════════╝"
else
  echo ""
  echo "⚠️  Some services failed to start."
  echo "   Use the Service Manager API to retry:"
  echo "   curl -X POST http://localhost:3000/api/service-manager -H 'Content-Type: application/json' -d '{\"action\":\"start-all\"}'"
  echo "   Or click Retry/Start in the dashboard Services widget."
fi
