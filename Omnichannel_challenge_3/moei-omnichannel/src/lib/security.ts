/**
 * MOEI Security Utilities
 * Cryptographic reference number generation, rate limiting, and input validation
 */

import { randomBytes, randomUUID } from 'crypto'

// ─── Secure Reference Number Generation ────────────────────────────────────

const REFERENCE_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // No I/O/0/1 to avoid confusion

/**
 * Generate a cryptographically secure reference number
 * Format: MOEI-XXXX-XXXX-XXXX (e.g., MOEI-K7RM-P2H9-N4WX)
 * 
 * - Uses crypto.randomBytes for true randomness
 * - 12 characters of entropy = 32^12 ≈ 1.15 × 10^18 possible combinations
 * - Impossible to guess or enumerate
 * - Readable format avoiding ambiguous characters (0/O, 1/I/l)
 */
export function generateReferenceNumber(): string {
  const bytes = randomBytes(12)
  const chars: string[] = []
  
  for (let i = 0; i < 12; i++) {
    chars.push(REFERENCE_CHARSET[bytes[i] % REFERENCE_CHARSET.length])
  }
  
  return `MOEI-${chars.slice(0, 4).join('')}-${chars.slice(4, 8).join('')}-${chars.slice(8, 12).join('')}`
}

/**
 * Validate reference number format
 */
export function isValidReferenceNumber(ref: string): boolean {
  return /^MOEI-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test(ref)
}

/**
 * Generate a secure session ID (replaces predictable conv-1, conv-2, etc.)
 */
export function generateSecureSessionId(): string {
  return `sess_${randomUUID()}`
}

/**
 * Generate a secure ID for channel configs and email messages
 * Replaces Date.now() + Math.random()
 */
export function generateSecureId(prefix: string): string {
  const bytes = randomBytes(8)
  const hex = bytes.toString('hex')
  return `${prefix}_${hex}`
}

// ─── Rate Limiting ─────────────────────────────────────────────────────────

interface RateLimitEntry {
  count: number
  resetAt: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

/**
 * Simple in-memory rate limiter
 * @param key - Unique identifier (e.g., IP address + endpoint)
 * @param maxRequests - Maximum requests per window
 * @param windowMs - Time window in milliseconds
 * @returns true if request is allowed, false if rate limited
 */
export function checkRateLimit(
  key: string,
  maxRequests: number = 30,
  windowMs: number = 60_000
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const entry = rateLimitStore.get(key)
  
  // Clean up expired entries periodically
  if (rateLimitStore.size > 10_000) {
    for (const [k, v] of rateLimitStore) {
      if (v.resetAt < now) rateLimitStore.delete(k)
    }
  }
  
  if (!entry || entry.resetAt < now) {
    // New window
    const resetAt = now + windowMs
    rateLimitStore.set(key, { count: 1, resetAt })
    return { allowed: true, remaining: maxRequests - 1, resetAt }
  }
  
  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt }
  }
  
  entry.count++
  return { allowed: true, remaining: maxRequests - entry.count, resetAt: entry.resetAt }
}

/**
 * Get client identifier from request (IP + optional user ID)
 */
export function getClientId(request: Request, userId?: string): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0]?.trim() || 
             request.headers.get('x-real-ip') || 
             'unknown'
  return userId ? `${ip}:${userId}` : ip
}

// ─── Input Validation ──────────────────────────────────────────────────────

/**
 * Sanitize string input to prevent injection attacks
 */
export function sanitizeInput(input: string, maxLength: number = 1000): string {
  return input
    .trim()
    .slice(0, maxLength)
    .replace(/[<>]/g, '') // Basic XSS prevention
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

/**
 * Validate UAE phone number
 */
export function isValidUAEPhone(phone: string): boolean {
  return /^(\+971|971|0)?[2-9]\d{7,8}$/.test(phone.replace(/[\s-]/g, ''))
}

/**
 * Validate case status
 */
const VALID_STATUSES = ['open', 'in_progress', 'resolved', 'escalated', 'closed']
export function isValidStatus(status: string): boolean {
  return VALID_STATUSES.includes(status)
}

/**
 * Validate priority level
 */
const VALID_PRIORITIES = ['low', 'medium', 'high', 'critical']
export function isValidPriority(priority: string): boolean {
  return VALID_PRIORITIES.includes(priority)
}

/**
 * Validate channel type
 */
const VALID_CHANNELS = ['web', 'whatsapp', 'voice', 'email', 'phone', 'mobile_app']
export function isValidChannel(channel: string): boolean {
  return VALID_CHANNELS.includes(channel)
}
