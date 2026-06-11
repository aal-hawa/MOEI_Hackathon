import { NextRequest, NextResponse } from 'next/server'
import { checkPublicRateLimit, requireMutationAuth, getAuthStatus } from '@/lib/api-auth'

// ─── Security Headers ────────────────────────────────────────────────────────

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(self), geolocation=()',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https: wss: ws:; media-src 'self' blob: https:;",
}

// ─── CORS Configuration ──────────────────────────────────────────────────────

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'https://localhost:3000',
]

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, X-Transform-Port',
  'Access-Control-Max-Age': '86400',
  'Access-Control-Allow-Credentials': 'true',
}

// ─── Middleware ───────────────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const { pathname, origin } = new URL(request.url)

  // Skip non-API routes
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    const response = new NextResponse(null, { status: 204 })
    const requestOrigin = request.headers.get('origin') || ''
    response.headers.set(
      'Access-Control-Allow-Origin',
      ALLOWED_ORIGINS.includes(requestOrigin) ? requestOrigin : origin
    )
    Object.entries(CORS_HEADERS).forEach(([k, v]) => response.headers.set(k, v))
    Object.entries(SECURITY_HEADERS).forEach(([k, v]) => response.headers.set(k, v))
    return response
  }

  // ─── Auth Status Endpoint ─────────────────────────────────────────────
  if (pathname === '/api/auth/status') {
    const status = getAuthStatus()
    return NextResponse.json(status, { headers: SECURITY_HEADERS })
  }

  // ─── Mutation Endpoints (POST, PUT, DELETE, PATCH) ───────────────────
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
    const authError = requireMutationAuth(request)
    if (authError) {
      // Merge security headers into error response
      Object.entries(SECURITY_HEADERS).forEach(([k, v]) => {
        authError.headers.set(k, v)
      })
      return authError
    }
  }

  // ─── GET Endpoints - Rate Limit Only ──────────────────────────────────
  if (request.method === 'GET') {
    const rateLimitError = checkPublicRateLimit(request)
    if (rateLimitError) {
      Object.entries(SECURITY_HEADERS).forEach(([k, v]) => {
        rateLimitError.headers.set(k, v)
      })
      return rateLimitError
    }
  }

  // ─── Continue with request ────────────────────────────────────────────
  const response = NextResponse.next()

  // Add security headers
  Object.entries(SECURITY_HEADERS).forEach(([k, v]) => {
    response.headers.set(k, v)
  })

  // Add CORS headers for actual requests
  const requestOrigin = request.headers.get('origin') || ''
  if (ALLOWED_ORIGINS.includes(requestOrigin)) {
    response.headers.set('Access-Control-Allow-Origin', requestOrigin)
  }
  Object.entries(CORS_HEADERS).forEach(([k, v]) => {
    if (!response.headers.has(k)) response.headers.set(k, v)
  })

  // Add rate limit info headers
  const rateLimitRemaining = 50 // approximate
  response.headers.set('X-RateLimit-Remaining', String(rateLimitRemaining))

  return response
}

// ─── Matcher Configuration ───────────────────────────────────────────────────

export const config = {
  matcher: [
    '/api/:path*',
  ],
}
