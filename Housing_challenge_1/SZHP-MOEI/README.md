# SZHP MOEI AI Agent — Housing Arrears Rescheduling System

An AI-powered system for the Sheikh Zayed Housing Programme (SZHP) under the UAE Ministry of Energy and Infrastructure (MOEI), designed to automate and streamline the rescheduling of housing loan arrears.

## Quick Start

### Prerequisites
- **Node.js** 18+ (recommended: 20+)
- **npm** 9+ (comes with Node.js)

### Installation & Running

```bash
# 1. Install dependencies
npm install

# 2. Start both frontend and backend
npm run dev
```

The application will be available at:
- **App**: http://localhost:3000

The frontend and API are used together through the same browser origin. In development, Vite proxies `/api/*` internally to the Hono backend, so users only need to open `http://localhost:3000`.

## Hackathon Task 1 Demo

Use [`HACKATHON_TASK1_DEMO.md`](./HACKATHON_TASK1_DEMO.md) for the judge-facing demo flow, pitch script, and requirement coverage checklist.

### First-Time Setup

On first run, the backend automatically:
1. Creates the SQLite database at `./data/szhp.db`
2. Initializes the schema
3. Seeds default data (admin user, AI models, system configs, form fields)

### Default Login Credentials

| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@szhp.gov.ae | Admin@2024 |
| Manager | manager@szhp.gov.ae | Pass@2024 |
| Reviewer | reviewer@szhp.gov.ae | Pass@2024 |
| Employee | employee@szhp.gov.ae | Pass@2024 |
| Admin | admin2@szhp.gov.ae | Pass@2024 |

> ⚠️ **Security**: Change default passwords immediately in production!

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the unified app experience on port 3000 with `/api` proxied internally |
| `npm run dev:frontend` | Start Vite frontend only (port 3000) |
| `npm run dev:backend` | Start Hono API backend only for internal/API debugging (port 3001) |
| `npm run build` | Build frontend for production |
| `npm run lint` | Run ESLint |

## Architecture

- **Frontend**: Vite + React + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Hono + better-sqlite3 (Node.js)
- **Database**: SQLite (auto-created at `./data/szhp.db`)
- **AI**: Multi-provider support (Recentech AI, OpenAI, Gemini, Ollama)

## Key Features

- 🤖 AI-Powered Risk Assessment
- 📊 Dashboard with Real-time Analytics
- 📝 Smart Form Validation with AI
- ⚖️ MOEI Compliance Rules Engine
- 🔐 Role-Based Access Control (RBAC)
- 🌐 Bilingual (Arabic/English)
- 📋 Audit Trail & Governance
