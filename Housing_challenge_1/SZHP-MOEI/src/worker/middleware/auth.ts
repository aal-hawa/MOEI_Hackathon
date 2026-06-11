/**
 * Auth Middleware for Hono on Cloudflare Workers
 * Ported from src/lib/rbac.ts
 * Uses bcryptjs for password hashing (works with nodejs_compat)
 * Sessions stored in D1
 */

import { createMiddleware } from 'hono/factory'
import bcrypt from 'bcryptjs'
import type { Env, AuthResult } from '../types'
import { DbClient } from '../db/queries'

// ── Role Permissions ────────────────────────────────────────────────
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  superadmin: ['*'],
  manager: [
    'dashboard', 'cases', 'cases.approve', 'cases.reject', 'cases.escalate',
    'workflows', 'employees.view', 'employees.manage', 'audit.view', 'settings', 'models',
  ],
  admin: [
    'dashboard', 'cases', 'cases.approve', 'cases.reject',
    'workflows', 'employees.view', 'employees.manage', 'audit.view', 'settings', 'models',
  ],
  reviewer: ['dashboard', 'cases', 'cases.review', 'audit.view'],
  employee: ['dashboard', 'cases.view'],
  citizen: [],
}

/**
 * Check if a user's permissions include the required permission.
 */
export function hasPermission(permissions: string[], required: string): boolean {
  if (!permissions || !Array.isArray(permissions)) return false
  if (permissions.includes('*')) return true
  if (permissions.includes(required)) return true
  const parts = required.split('.')
  if (parts.length > 1 && permissions.includes(parts[0])) return true
  return false
}

/**
 * Get default permissions for a given role.
 */
export function getDefaultPermissions(role: string): string[] {
  return ROLE_PERMISSIONS[role] ?? []
}

// ── Password Hashing ────────────────────────────────────────────────
const SALT_ROUNDS = 12

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export function hashPasswordSync(password: string): string {
  return bcrypt.hashSync(password, SALT_ROUNDS)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$')) {
    return bcrypt.compare(password, hash)
  }
  // Legacy base64 hash (insecure, for migration)
  console.warn('[SECURITY] User has legacy base64 password hash. Admin should force password reset.')
  return btoa(password) === hash
}

export function isLegacyHash(hash: string): boolean {
  return !(hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$'))
}

// ── Access Token Generation ─────────────────────────────────────────
export function generateAccessToken(userId: string): string {
  const tokenPart = crypto.randomUUID()
  const timestamp = Date.now().toString(36)
  return `adm_${tokenPart}_${timestamp}`
}

// ── Auth Verification using D1 ──────────────────────────────────────
export async function verifyAuth(db: DbClient, token: string): Promise<AuthResult> {
  try {
    if (!token) {
      return { authenticated: false, error: 'No authentication token provided' }
    }

    // Find session + user via join
    const row = await db.findSessionByToken(token) as any

    if (!row) {
      return { authenticated: false, error: 'Invalid session token' }
    }

    // Check session expiry
    const expiresAt = new Date(row.expiresAt)
    if (expiresAt < new Date()) {
      await db.deleteSession(row.id).catch(() => {})
      return { authenticated: false, error: 'Session expired' }
    }

    // Check user is active
    if (!row.isActive) {
      return { authenticated: false, error: 'Account is deactivated' }
    }

    // Check account lock
    if (row.lockedUntil && new Date(row.lockedUntil) > new Date()) {
      return { authenticated: false, error: 'Account is locked' }
    }

    return {
      authenticated: true,
      user: {
        id: row.userId,
        email: row.email,
        role: row.role,
        permissions: JSON.parse(row.permissions || '[]'),
        isActive: !!row.isActive,
      },
      session: {
        id: row.id,
        authMode: row.authMode,
        expiresAt: row.expiresAt,
      },
    }
  } catch (error) {
    console.error('Auth verification error:', error)
    return { authenticated: false, error: 'Authentication check failed' }
  }
}

// ── Hono Middleware ──────────────────────────────────────────────────

/**
 * Extract Bearer token from Authorization header
 */
function extractToken(c: any): string | null {
  const authHeader = c.req.header('Authorization')
  return authHeader?.replace('Bearer ', '') || null
}

/**
 * Middleware: verifyAuth - Sets user info on context if authenticated (non-blocking)
 */
export const verifyAuthMiddleware = createMiddleware<{ Bindings: Env; Variables: { auth: AuthResult; db: DbClient } }>(
  async (c, next) => {
    const token = extractToken(c)
    const db = new DbClient(c.env.DB)
    const authResult = token ? await verifyAuth(db, token) : { authenticated: false, error: 'No token' } as AuthResult
    c.set('auth', authResult)
    c.set('db', db)
    await next()
  }
)

/**
 * Middleware: requireAuth - Requires authenticated user
 */
export const requireAuthMiddleware = createMiddleware<{ Bindings: Env; Variables: { auth: AuthResult; db: DbClient } }>(
  async (c, next) => {
    const token = extractToken(c)
    const db = new DbClient(c.env.DB)

    if (!token) {
      return c.json({ error: 'Authentication required' }, 401)
    }

    const authResult = await verifyAuth(db, token)
    c.set('auth', authResult)
    c.set('db', db)

    if (!authResult.authenticated) {
      return c.json({ error: authResult.error || 'Authentication required' }, 401)
    }

    await next()
  }
)

/**
 * Middleware: requireAdminAuth - Requires non-citizen admin role
 */
export const requireAdminAuthMiddleware = createMiddleware<{ Bindings: Env; Variables: { auth: AuthResult; db: DbClient } }>(
  async (c, next) => {
    const token = extractToken(c)
    const db = new DbClient(c.env.DB)

    if (!token) {
      return c.json({ error: 'Authentication required' }, 401)
    }

    const authResult = await verifyAuth(db, token)
    c.set('auth', authResult)
    c.set('db', db)

    if (!authResult.authenticated) {
      return c.json({ error: authResult.error || 'Authentication required' }, 401)
    }

    const adminRoles = ['employee', 'reviewer', 'manager', 'admin', 'superadmin']
    if (!adminRoles.includes(authResult.user!.role)) {
      return c.json({ error: 'Admin access required' }, 403)
    }

    await next()
  }
)

/**
 * Create a requirePermission middleware for a specific permission
 */
export function requirePermission(permission: string) {
  return createMiddleware<{ Bindings: Env; Variables: { auth: AuthResult; db: DbClient } }>(
    async (c, next) => {
      const token = extractToken(c)
      const db = new DbClient(c.env.DB)

      if (!token) {
        return c.json({ error: 'Authentication required' }, 401)
      }

      const authResult = await verifyAuth(db, token)
      c.set('auth', authResult)
      c.set('db', db)

      if (!authResult.authenticated) {
        const isPermissionError = authResult.error?.includes('Permission')
        return c.json({ error: authResult.error || 'Authentication required' }, isPermissionError ? 403 : 401)
      }

      const adminRoles = ['employee', 'reviewer', 'manager', 'admin', 'superadmin']
      if (!adminRoles.includes(authResult.user!.role)) {
        return c.json({ error: 'Admin access required' }, 403)
      }

      const userPerms = authResult.user!.permissions
      const effectivePerms = (userPerms && userPerms.length > 0)
        ? userPerms
        : getDefaultPermissions(authResult.user!.role)

      if (!hasPermission(effectivePerms, permission)) {
        return c.json({ error: `Permission '${permission}' required` }, 403)
      }

      await next()
    }
  )
}
