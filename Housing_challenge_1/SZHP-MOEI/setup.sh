#!/bin/bash
set -e

ACTION=${1:-all}

case "$ACTION" in
  install)
    echo "📦 Installing dependencies..."
    npm install
    echo "📦 Installing worker service dependencies..."
    (cd mini-services/worker-service && bun install)
    ;;
  reinstall)
    echo "🗑️ Removing node_modules and package-lock.json..."
    rm -rf node_modules package-lock.json
    echo "📦 Re-installing dependencies..."
    npm install
    echo "🗑️ Removing worker service node_modules..."
    (cd mini-services/worker-service && rm -rf node_modules bun.lock && bun install)
    ;;
  clean)
    echo "🧹 Cleaning project (removing dist and data)..."
    rm -rf dist data
    echo "✅ Cleaned."
    ;;
  fclean)
    echo "🔥 Full clean (removing modules, dist, db, and env)..."
    rm -rf node_modules package-lock.json dist data .env
    echo "✅ Full clean complete."
    ;;
  run)
    echo "🚀 Starting development servers..."
    
    # Kill stale processes first
    pkill -9 -f "vite|tsx|node|concurrently|bun" 2>/dev/null || true
    fuser -k 3000/tcp 3001/tcp 2>/dev/null || true
    sleep 1
    
    # Start worker service in subshell background
    (cd mini-services/worker-service && bun run dev 2>&1 &)
    
    echo "✅ Servers starting..."
    echo "   Frontend: http://localhost:3000"
    echo "   API & Worker: http://localhost:3001"
    
    # Start main application
    npm run dev
    ;;
  all)
    echo "🚀 Starting full setup process..."
    
    echo "📦 Installing dependencies..."
    npm install
    
    echo "📦 Installing worker service dependencies..."
    (cd mini-services/worker-service && bun install)
    
    echo "⚙️  Setting up environment variables..."
    if [ ! -f .env ]; then
      cp .env.example .env
      echo "✅ Copied .env.example to .env."
    else
      echo "✅ .env file already exists."
    fi
    
    echo "🗄️  Preparing data directory..."
    mkdir -p data upload uploads
    
    if [ -f data/szhp.db ]; then
      echo "ℹ️  Existing database found. Keeping it (delete data/szhp.db to re-seed)."
    else
      echo "✅ Data directory ready. Database will be auto-created on first server start."
    fi
    
    # Kill stale processes first
    pkill -9 -f "vite|tsx|node|concurrently|bun" 2>/dev/null || true
    fuser -k 3000/tcp 3001/tcp 2>/dev/null || true
    sleep 1
    
    echo "🎉 Setup complete! Starting the development servers..."
    echo ""
    echo "📋 Admin Credentials:"
    echo "   Email: admin@szhp.gov.ae"
    echo "   Password: Admin@2024"
    echo ""
    
    # Start worker service in subshell background
    (cd mini-services/worker-service && bun run dev 2>&1 &)
    
    echo "✅ Servers starting..."
    echo "   Frontend: http://localhost:3000"
    echo "   API & Worker: http://localhost:3001"
    
    # Start main application
    npm run dev
    ;;
  *)
    echo "❌ Unknown argument: $ACTION"
    echo "Usage: ./setup.sh [install|reinstall|clean|fclean|run|all]"
    exit 1
    ;;
esac
