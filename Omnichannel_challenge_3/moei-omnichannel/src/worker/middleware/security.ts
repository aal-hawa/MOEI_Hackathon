/**
 * Security Headers Middleware for Hono Worker
 */

import { createMiddleware } from 'hono/factory'

export const securityHeaders = () =>
  createMiddleware(async (c, next) => {
    await next()

    // Security headers
    c.header('X-Content-Type-Options', 'nosniff')
    c.header('X-Frame-Options', 'DENY')
    c.header('X-XSS-Protection', '1; mode=block')
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin')
    c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
    // CSP relaxed for development - tighten in production
    // c.header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'")
  })
