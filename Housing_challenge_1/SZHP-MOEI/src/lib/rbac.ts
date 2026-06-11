// RBAC (Role-Based Access Control) System for SZHP Admin Portal
// Security-hardened: bcrypt password hashing, crypto-secure tokens, server-side auth verification

import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  superadmin: ['*'],  // includes 'models'
  manager: [
    'dashboard',
    'cases',
    'cases.approve',
    'cases.reject',
    'cases.escalate',
    'workflows',
    'employees.view',
    'employees.manage',
    'audit.view',
    'settings',
    'models',
  ],
  admin: [
    'dashboard',
    'cases',
    'cases.approve',
    'cases.reject',
    'workflows',
    'employees.view',
    'employees.manage',
    'audit.view',
    'settings',
    'models',
  ],
  reviewer: [
    'dashboard',
    'cases',
    'cases.review',
    'audit.view',
  ],
  employee: [
    'dashboard',
    'cases.view',
  ],
  citizen: [],
}

/**
 * Check if a user's permissions include the required permission.
 * - "*" wildcard matches everything
 * - "cases.approve" requires exact match or parent "cases" or wildcard "*"
 */
export function hasPermission(permissions: string[], required: string): boolean {
  if (!permissions || !Array.isArray(permissions)) return false
  if (permissions.includes('*')) return true
  if (permissions.includes(required)) return true

  // Check parent permission (e.g., "cases" covers "cases.approve")
  const parts = required.split('.')
  if (parts.length > 1) {
    const parent = parts[0]
    if (permissions.includes(parent)) return true
  }

  return false
}

/**
 * Check if a user can access a specific view based on role and permissions.
 */
export function canAccessView(role: string, permissions: string[], view: string): boolean {
  if (role === 'superadmin') return true
  return hasPermission(permissions, view)
}

/**
 * Get a human-readable label for a role in the specified language.
 */
export function getRoleLabel(role: string, lang: 'en' | 'ar' = 'en'): string {
  const labels: Record<string, { en: string; ar: string }> = {
    superadmin: { en: 'Super Admin', ar: 'مدير النظام' },
    admin: { en: 'Admin', ar: 'مسؤول' },
    manager: { en: 'Manager', ar: 'مدير' },
    reviewer: { en: 'Reviewer', ar: 'مراجع' },
    employee: { en: 'Employee', ar: 'موظف' },
    citizen: { en: 'Citizen', ar: 'مواطن' },
  }
  return labels[role]?.[lang] ?? role
}

/**
 * Get default permissions for a given role.
 */
export function getDefaultPermissions(role: string): string[] {
  return ROLE_PERMISSIONS[role] ?? []
}

// ═══════════════════════════════════════════════════════════════════════
// PASSWORD HASHING — bcrypt with salt rounds (SECURE)
// ═══════════════════════════════════════════════════════════════════════

const SALT_ROUNDS = 12

/**
 * Hash a password using bcrypt (cryptographically secure).
 * Returns a bcrypt hash string.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

/**
 * Hash a password synchronously (for seed scripts that need sync operation).
 * Prefer hashPassword() for runtime use.
 */
export function hashPasswordSync(password: string): string {
  return bcrypt.hashSync(password, SALT_ROUNDS)
}

/**
 * Verify a password against a bcrypt hash.
 * Handles both bcrypt hashes and legacy base64 hashes (for migration).
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  // If it's a bcrypt hash (starts with $2a$, $2b$, or $2y$), use bcrypt
  if (hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$')) {
    return bcrypt.compare(password, hash)
  }

  // Legacy: Base64-encoded "hash" (insecure, for backward compatibility during migration)
  // Log a warning so admins know to force password reset
  console.warn(`[SECURITY] User has legacy base64 password hash. Admin should force password reset.`)
  return Buffer.from(password).toString('base64') === hash
}

/**
 * Check if a hash is a legacy (insecure) base64-encoded hash.
 */
export function isLegacyHash(hash: string): boolean {
  return !(hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$'))
}

// ═══════════════════════════════════════════════════════════════════════
// ACCESS TOKEN GENERATION — Cryptographically secure (SECURE)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Generate a cryptographically secure access token.
 * Uses crypto.randomUUID() for unpredictable, collision-resistant tokens.
 */
export function generateAccessToken(userId: string): string {
  const tokenPart = crypto.randomUUID()
  const timestamp = Date.now().toString(36)
  // Use crypto.randomUUID for the random part — Math.random is NOT cryptographically secure
  return `adm_${tokenPart}_${timestamp}`
}

// ═══════════════════════════════════════════════════════════════════════
// SERVER-SIDE AUTHENTICATION & AUTHORIZATION MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════

export interface AuthResult {
  authenticated: boolean
  user?: {
    id: string
    email: string | null
    role: string
    permissions: string[]
    isActive: boolean
  }
  session?: {
    id: string
    authMode: string
    expiresAt: Date
  }
  error?: string
}

/**
 * Verify the request's Authorization header against the database session.
 * This is the SERVER-SIDE source of truth — never trust client-supplied userId.
 */
export async function verifyAuth(request: Request): Promise<AuthResult> {
  try {
    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!token) {
      return { authenticated: false, error: 'No authentication token provided' }
    }

    // Find the session with the access token
    const session = await db.session.findFirst({
      where: { accessToken: token },
      include: { user: true },
    })

    if (!session) {
      return { authenticated: false, error: 'Invalid session token' }
    }

    // Check session expiry
    if (session.expiresAt < new Date()) {
      // Clean up expired session
      await db.session.delete({ where: { id: session.id } }).catch(() => {})
      return { authenticated: false, error: 'Session expired' }
    }

    // Check user is still active
    if (!session.user.isActive) {
      return { authenticated: false, error: 'Account is deactivated' }
    }

    // Check account lock
    if (session.user.lockedUntil && new Date(session.user.lockedUntil) > new Date()) {
      return { authenticated: false, error: 'Account is locked' }
    }

    return {
      authenticated: true,
      user: {
        id: session.user.id,
        email: session.user.email,
        role: session.user.role,
        permissions: JSON.parse(session.user.permissions || '[]'),
        isActive: session.user.isActive,
      },
      session: {
        id: session.id,
        authMode: session.authMode,
        expiresAt: session.expiresAt,
      },
    }
  } catch (error) {
    console.error('Auth verification error:', error)
    return { authenticated: false, error: 'Authentication check failed' }
  }
}

/**
 * Require that the request is authenticated. Returns 401 if not.
 * Usage: const authResult = await requireAuth(request); if (!authResult.authenticated) return unauthorizedResponse;
 */
export async function requireAuth(request: Request): Promise<AuthResult> {
  return verifyAuth(request)
}

/**
 * Require that the authenticated user has admin-level access (non-citizen).
 */
export async function requireAdminAuth(request: Request): Promise<AuthResult> {
  const authResult = await verifyAuth(request)
  if (!authResult.authenticated) return authResult

  const adminRoles = ['employee', 'reviewer', 'manager', 'admin', 'superadmin']
  if (!adminRoles.includes(authResult.user!.role)) {
    return { authenticated: false, error: 'Admin access required' }
  }

  return authResult
}

/**
 * Require that the authenticated user has a specific permission.
 * Falls back to role-based default permissions if the user's permissions array is empty.
 */
export async function requirePermission(request: Request, permission: string): Promise<AuthResult> {
  const authResult = await requireAdminAuth(request)
  if (!authResult.authenticated) return authResult

  // Use user's explicit permissions, or fall back to role-based defaults
  const userPerms = authResult.user!.permissions
  const effectivePerms = (userPerms && userPerms.length > 0)
    ? userPerms
    : getDefaultPermissions(authResult.user!.role)

  if (!hasPermission(effectivePerms, permission)) {
    return { authenticated: false, error: `Permission '${permission}' required` }
  }

  return authResult
}

/**
 * Create an unauthorized (401) NextResponse.
 */
export function unauthorizedResponse(message: string = 'Authentication required') {
  return new Response(
    JSON.stringify({ error: message }),
    {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    }
  )
}

/**
 * Create a forbidden (403) NextResponse.
 */
export function forbiddenResponse(message: string = 'Insufficient permissions') {
  return new Response(
    JSON.stringify({ error: message }),
    {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    }
  )
}
