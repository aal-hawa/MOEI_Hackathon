#!/bin/bash
# Deploy to Cloudflare Pages
# Prerequisites: npm install -g @cloudflare/next-on-pages wrangler

set -e

echo "🏗️  Building for Cloudflare Pages..."

# Install Cloudflare adapter if not present
if ! npm list @cloudflare/next-on-pages 2>/dev/null | grep -q "@cloudflare/next-on-pages"; then
  echo "📦 Installing @cloudflare/next-on-pages..."
  npm install -D @cloudflare/next-on-pages
fi

# Build the project for Cloudflare
echo "🔨 Running next-on-pages build..."
npx @cloudflare/next-on-pages

# Deploy
echo "🚀 Deploying to Cloudflare Pages..."
npx wrangler pages deploy .vercel/output/static --project-name=moei-omnichannel-ai

echo "✅ Deployment complete!"
echo ""
echo "⚠️  Don't forget to set environment variables in Cloudflare dashboard:"
echo "   - API_KEY: Your API key for mutation endpoints"
echo "   - ADMIN_TOKEN: Your admin token for dashboard access"
echo "   - DATABASE_URL: Your database connection string"
