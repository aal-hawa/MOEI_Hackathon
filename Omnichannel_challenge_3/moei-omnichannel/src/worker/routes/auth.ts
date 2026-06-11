/**
 * Auth Status Route
 * GET /api/auth/status
 */

import { Hono } from 'hono'

const app = new Hono()

const API_KEY = process.env.API_KEY || ''
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || ''
const AUTH_ENABLED = !!(API_KEY || ADMIN_TOKEN)

app.get('/auth/status', (c) => {
  return c.json({
    authEnabled: AUTH_ENABLED,
    methods: { apiKey: !!API_KEY, adminToken: !!ADMIN_TOKEN },
    mode: AUTH_ENABLED ? 'production' : 'development',
    message: AUTH_ENABLED ? 'Authentication is enabled' : 'Running in development mode - no auth configured',
  })
})

export const authRoutes = app
