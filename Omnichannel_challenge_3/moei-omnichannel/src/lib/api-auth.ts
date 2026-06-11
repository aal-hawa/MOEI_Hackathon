/**
 * API Authentication & Authorization Module
 * Secures all mutation endpoints with API key or admin token validation
 * Supports Cloudflare Workers / Edge runtime compatibility
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getClientId, sanitizeInput } from './edge-security'

// ─── Configuration ───────────────────────────────────────────────────────────

const API_KEY = process.env.API_KEY || ''
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || ''

// Whether auth is enforced (if no keys configured, runs in dev mode)
const AUTH_ENABLED = !!(API_KEY || ADMIN_TOKEN)

// Public endpoints that don't require mutation auth
const PUBLIC_MUTATION_ENDPOINTS = [
  '/api/seed',
  '/api/channels/voice/webhook',
  '/api/channels/voice/status',
  '/api/channels/voice/gather',
  '/api/channels/voice/call',
  '/api/channels/whatsapp/webhook',
  '/api/channels/email/inbound',
  '/api/whatsapp/webhook',
]

// Rate limits
const PUBLIC_RATE_LIMIT = 60 // requests per minute for GET
const MUTATION_RATE_LIMIT = 30 // requests per minute for mutations
const RATE_LIMIT_WINDOW = 60_000 // 1 minute

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuthResult {
  authorized: boolean
  identity: string
  method: 'api_key' | 'admin_token' | 'public' | 'none'
  error?: string
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

// ─── Audit Logging ────────────────────────────────────────────────────────────

interface AuditEntry {
  timestamp: string
  method: string
  path: string
  identity: string
  authMethod: string
  ip: string
  statusCode?: number
  error?: string
}

const auditLog: AuditEntry[] = []
const MAX_AUDIT_LOG = 1000

function logAudit(entry: Omit<AuditEntry, 'timestamp'>) {
  auditLog.push({ ...entry, timestamp: new Date().toISOString() })
  if (auditLog.length > MAX_AUDIT_LOG) {
    auditLog.shift()
  }
  
  // Log to console in development
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[AUDIT] ${entry.method} ${entry.path} by ${entry.identity} (${entry.authMethod})${entry.error ? ` ERROR: ${entry.error}` : ''}`)
  }
}

// ─── Auth Validation ─────────────────────────────────────────────────────────

/**
 * Validate API authentication from request headers
 */
export function validateApiAuth(request: Request): AuthResult {
  // Check API key in x-api-key header
  const apiKey = request.headers.get('x-api-key')
  if (apiKey && API_KEY && apiKey === API_KEY) {
    return { authorized: true, identity: 'api_client', method: 'api_key' }
  }

  // Check admin token in Authorization header
  const authHeader = request.headers.get('authorization')
  if (authHeader) {
    const parts = authHeader.split(' ')
    if (parts.length === 2 && parts[0] === 'Bearer') {
      const token = parts[1]
      if (ADMIN_TOKEN && token === ADMIN_TOKEN) {
        return { authorized: true, identity: 'admin', method: 'admin_token' }
      }
    }
  }

  // Dev mode: if no auth configured, allow with warning
  if (!AUTH_ENABLED) {
    return { authorized: true, identity: 'dev_mode', method: 'none' }
  }

  return { authorized: false, identity: 'anonymous', method: 'none', error: 'Authentication required' }
}

/**
 * Check if a path is a public mutation endpoint (webhooks, etc.)
 */
function isPublicMutationEndpoint(pathname: string): boolean {
  return PUBLIC_MUTATION_ENDPOINTS.some(ep => pathname.startsWith(ep))
}

/**
 * Require authentication for mutation operations (POST, PUT, DELETE, PATCH)
 * Returns null if authorized, or a NextResponse error if not
 */
export function requireMutationAuth(request: NextRequest): NextResponse | null {
  const { pathname } = new URL(request.url)
  
  // Skip auth for public endpoints (webhooks etc.)
  if (isPublicMutationEndpoint(pathname)) {
    return null
  }

  // Rate limit check first
  const clientId = getClientId(request)
  const rateLimit = checkRateLimit(
    `mutation:${clientId}:${pathname}`,
    MUTATION_RATE_LIMIT,
    RATE_LIMIT_WINDOW
  )
  
  if (!rateLimit.allowed) {
    logAudit({
      method: request.method,
      path: pathname,
      identity: clientId,
      authMethod: 'rate_limited',
      ip: clientId,
      error: 'Rate limit exceeded',
    })
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please try again later.', retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000) },
      { 
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)),
          'X-RateLimit-Remaining': '0',
        }
      }
    )
  }

  // Auth check
  const auth = validateApiAuth(request)
  
  if (!auth.authorized) {
    logAudit({
      method: request.method,
      path: pathname,
      identity: getClientId(request),
      authMethod: auth.method,
      ip: getClientId(request),
      error: auth.error,
    })
    return NextResponse.json(
      { error: auth.error || 'Authentication required. Provide x-api-key header or Authorization: Bearer token.' },
      { status: 401 }
    )
  }

  // Log successful mutation access
  logAudit({
    method: request.method,
    path: pathname,
    identity: auth.identity,
    authMethod: auth.method,
    ip: getClientId(request),
  })

  return null // Authorized
}

/**
 * Check rate limit for public GET endpoints
 * Returns null if allowed, or a NextResponse error if rate limited
 */
export function checkPublicRateLimit(request: NextRequest): NextResponse | null {
  const clientId = getClientId(request)
  const pathname = new URL(request.url).pathname
  
  const rateLimit = checkRateLimit(
    `public:${clientId}:${pathname}`,
    PUBLIC_RATE_LIMIT,
    RATE_LIMIT_WINDOW
  )

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please try again later.' },
      { 
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)),
          'X-RateLimit-Remaining': '0',
        }
      }
    )
  }

  return null // Allowed
}

/**
 * Get auth status information
 */
export function getAuthStatus() {
  return {
    authEnabled: AUTH_ENABLED,
    methods: {
      apiKey: !!API_KEY,
      adminToken: !!ADMIN_TOKEN,
    },
    mode: AUTH_ENABLED ? 'production' : 'development',
    auditLogSize: auditLog.length,
  }
}

/**
 * Get recent audit log entries
 */
export function getAuditLog(limit: number = 50): AuditEntry[] {
  return auditLog.slice(-limit)
}

/**
 * Validate and sanitize request body fields
 */
export function validateRequestBody(body: Record<string, unknown>, rules: Record<string, { required?: boolean; type?: string; maxLength?: number }>): { valid: boolean; errors: string[]; sanitized: Record<string, unknown> } {
  const errors: string[] = []
  const sanitized: Record<string, unknown> = {}

  for (const [field, rule] of Object.entries(rules)) {
    const value = body[field]

    if (rule.required && (value === undefined || value === null || value === '')) {
      errors.push(`Field "${field}" is required`)
      continue
    }

    if (value === undefined || value === null) {
      continue
    }

    // Type check
    if (rule.type && typeof value !== rule.type) {
      errors.push(`Field "${field}" must be of type ${rule.type}`)
      continue
    }

    // Sanitize strings
    if (typeof value === 'string') {
      sanitized[field] = sanitizeInput(value, rule.maxLength || 2000)
    } else if (Array.isArray(value)) {
      sanitized[field] = value
    } else if (typeof value === 'object' && value !== null) {
      sanitized[field] = value
    } else {
      sanitized[field] = value
    }
  }

  return { valid: errors.length === 0, errors, sanitized }
}
