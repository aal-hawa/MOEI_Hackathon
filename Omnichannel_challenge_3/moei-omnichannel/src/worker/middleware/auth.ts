/**
 * Auth Middleware for Hono Worker
 * Validates API key / Admin token on mutation endpoints
 * Public GET endpoints are allowed without auth
 */

import { createMiddleware } from 'hono/factory'
import { checkRateLimit, getClientId } from '../lib/edge-security'

// Configuration
const API_KEY = process.env.API_KEY || ''
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || ''
const AUTH_ENABLED = !!(API_KEY || ADMIN_TOKEN)

// Public mutation endpoints (webhooks etc.)
const PUBLIC_MUTATION_ENDPOINTS = [
  '/api/seed',
  '/api/channels/voice/webhook',
  '/api/channels/whatsapp/webhook',
  '/api/channels/email/inbound',
  '/api/ai/voice',           // Voice Agent service → BrainOrchestrator
  '/api/ai/voice/pipeline',  // Voice HTTP pipeline → BrainOrchestrator
  '/api/ai/whatsapp',        // WhatsApp AI channel adapter
  '/api/ai/email',           // Email AI channel adapter
  '/api/voice/recording',    // Voice Agent → create recording DB record
]

const MUTATION_RATE_LIMIT = 30
const PUBLIC_RATE_LIMIT = 60
const RATE_LIMIT_WINDOW = 60_000

// Auth result
interface AuthResult {
  authorized: boolean
  identity: string
  method: 'api_key' | 'admin_token' | 'public' | 'none'
  error?: string
}

function validateAuth(req: Request): AuthResult {
  // Check x-api-key header
  const apiKey = req.headers.get('x-api-key')
  if (apiKey && API_KEY && apiKey === API_KEY) {
    return { authorized: true, identity: 'api_client', method: 'api_key' }
  }

  // Check Authorization Bearer token
  const authHeader = req.headers.get('authorization')
  if (authHeader) {
    const parts = authHeader.split(' ')
    if (parts.length === 2 && parts[0] === 'Bearer') {
      const token = parts[1]
      if (ADMIN_TOKEN && token === ADMIN_TOKEN) {
        return { authorized: true, identity: 'admin', method: 'admin_token' }
      }
    }
  }

  // Dev mode: no auth configured
  if (!AUTH_ENABLED) {
    return { authorized: true, identity: 'dev_mode', method: 'none' }
  }

  return { authorized: false, identity: 'anonymous', method: 'none', error: 'Authentication required' }
}

function isPublicMutationEndpoint(pathname: string): boolean {
  return PUBLIC_MUTATION_ENDPOINTS.some(ep => pathname.startsWith(ep))
}

export const authMiddleware = () =>
  createMiddleware(async (c, next) => {
    const method = c.req.method
    const pathname = new URL(c.req.url).pathname

    // Rate limiting for all requests
    const clientId = getClientId(c.req.raw)
    const isMutation = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)
    const rateLimitKey = isMutation
      ? `mutation:${clientId}:${pathname}`
      : `public:${clientId}:${pathname}`
    const rateLimitMax = isMutation ? MUTATION_RATE_LIMIT : PUBLIC_RATE_LIMIT

    const rateLimit = checkRateLimit(rateLimitKey, rateLimitMax, RATE_LIMIT_WINDOW)
    c.header('X-RateLimit-Remaining', String(rateLimit.remaining))

    if (!rateLimit.allowed) {
      return c.json(
        { error: 'Rate limit exceeded. Please try again later.', retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000) },
        429
      )
    }

    // Skip auth for GET requests (public reads)
    if (method === 'GET') {
      await next()
      return
    }

    // Skip auth for public mutation endpoints (webhooks)
    if (isPublicMutationEndpoint(pathname)) {
      await next()
      return
    }

    // Require auth for mutations
    const auth = validateAuth(c.req.raw)

    if (!auth.authorized) {
      console.log(`[AUTH] Denied ${method} ${pathname} from ${clientId} - ${auth.error}`)
      return c.json(
        { error: auth.error || 'Authentication required. Provide x-api-key header or Authorization: Bearer token.' },
        401
      )
    }

    // Log successful mutation access
    console.log(`[AUTH] ${method} ${pathname} by ${auth.identity} (${auth.method})`)

    await next()
  })
