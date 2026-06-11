/**
 * Cloudflare Worker Entry Point
 * Hono app with all API routes, CORS middleware, and global error handler
 * 
 * For local development, use mini-services/worker-service instead (uses bun:sqlite).
 * This file is for Cloudflare Workers deployment with D1, R2, and KV bindings.
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Env } from './types'

// Route imports
import health from './routes/health'
import auth from './routes/auth'
import dashboard from './routes/dashboard'
import requests from './routes/requests'
import employees from './routes/employees'
import upload from './routes/upload'
import systemConfig from './routes/system-config'
import models from './routes/models'
import formFields from './routes/form-fields'
import workflows from './routes/workflows'
import auditTrail from './routes/audit-trail'
import ai from './routes/ai'
import applicants from './routes/applicants'
import system from './routes/system'

// ── Create Hono App ─────────────────────────────────────────────────
const app = new Hono<{ Bindings: Env }>()

// ── Global CORS Middleware ───────────────────────────────────────────
app.use('/api/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length'],
  maxAge: 86400,
  credentials: true,
}))

// ── Global Error Handler ────────────────────────────────────────────
app.onError((err, c) => {
  console.error('Unhandled error:', err)
  return c.json(
    {
      error: 'Internal server error',
      message: err.message || 'An unexpected error occurred',
      timestamp: new Date().toISOString(),
    },
    500
  )
})

// ── Mount Route Groups ──────────────────────────────────────────────
app.route('/api', health)
app.route('/api/auth', auth)
app.route('/api/dashboard', dashboard)
app.route('/api/requests', requests)
app.route('/api/employees', employees)
app.route('/api/upload', upload)
app.route('/api/system-config', systemConfig)
app.route('/api/models', models)
app.route('/api/form-fields', formFields)
app.route('/api/workflows', workflows)
app.route('/api/audit-trail', auditTrail)
app.route('/api', ai)
app.route('/api/applicants', applicants)
app.route('/api/system', system)

// ── 404 Handler ─────────────────────────────────────────────────────
app.notFound((c) => {
  return c.json({ error: 'Not found', path: c.req.path }, 404)
})

// ── Export for Cloudflare Workers ────────────────────────────────────
export default app
