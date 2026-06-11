/**
 * Auth Routes
 * POST /api/auth/mock-login, /admin-login, /admin-register, /uaepass/login, /uaepass/callback, /logout, /seed-admin
 * GET /api/auth/me
 */

import { Hono } from 'hono'
import type { Env } from '../types'
import { DbClient } from '../db/queries'
import { hashPassword, hashPasswordSync, verifyPassword, isLegacyHash, generateAccessToken, getDefaultPermissions, ROLE_PERMISSIONS, requireAuthMiddleware, verifyAuth } from '../middleware/auth'
import { generateId } from '../lib/utils'

const auth = new Hono<{ Bindings: Env }>()

// POST /api/auth/mock-login
auth.post('/mock-login', async (c) => {
  try {
    const body = await c.req.json()
    const { profile, authMode } = body
    if (!profile || !profile.sub) return c.json({ error: 'Invalid mock profile' }, 400)

    const db = new DbClient(c.env.DB)
    const role = profile.role || 'citizen'
    const defaultPermissions = ROLE_PERMISSIONS[role] || []
    const permissionsJson = JSON.stringify(defaultPermissions)

    let user: any = await db.findUserBySub(profile.sub)

    if (!user) {
      const id = generateId()
      await db.createUser({
        id, uaepassSub: profile.sub, emiratesId: profile.idn,
        email: profile.email, phone: profile.mobile,
        firstnameEN: profile.firstnameEN, lastnameEN: profile.lastnameEN,
        firstnameAR: profile.firstnameAR, lastnameAR: profile.lastnameAR,
        fullnameEN: profile.fullnameEN, fullnameAR: profile.fullnameAR,
        nationalityEN: profile.nationalityEN, nationalityAR: profile.nationalityAR,
        gender: profile.gender, dob: profile.dob,
        role, department: profile.department, sopLevel: profile.sopLevel || 'sop2',
        permissions: permissionsJson, isActive: 1,
      })
      user = await db.findUserById(id)
    } else {
      await db.updateUser(user.id, {
        lastLoginAt: new Date().toISOString(),
        role,
        ...(user.permissions === '[]' ? { permissions: permissionsJson } : {}),
      })
      user = await db.findUserById(user.id)
    }

    const accessToken = `mock_${profile.sub}_${Date.now()}`
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    await db.createSession({
      id: generateId(), userId: user.id, accessToken, authMode: authMode || 'mock', expiresAt,
    })

    return c.json({
      success: true,
      user: {
        id: user.id, uaepassSub: user.uaepassSub, emiratesId: user.emiratesId,
        email: user.email, phone: user.phone, firstnameEN: user.firstnameEN,
        lastnameEN: user.lastnameEN, firstnameAR: user.firstnameAR, lastnameAR: user.lastnameAR,
        fullnameEN: user.fullnameEN, fullnameAR: user.fullnameAR,
        nationalityEN: user.nationalityEN, nationalityAR: user.nationalityAR,
        gender: user.gender, dob: user.dob, role: user.role,
        department: user.department, sopLevel: user.sopLevel,
      },
      uaepassProfile: { sub: profile.sub, firstnameEN: profile.firstnameEN, lastnameEN: profile.lastnameEN, firstnameAR: profile.firstnameAR, lastnameAR: profile.lastnameAR, fullnameEN: profile.fullnameEN, fullnameAR: profile.fullnameAR, email: profile.email, mobile: profile.mobile, idn: profile.idn, nationalityEN: profile.nationalityEN, nationalityAR: profile.nationalityAR, gender: profile.gender, dob: profile.dob, sopLevel: profile.sopLevel, exp: profile.exp },
      accessToken, expiresAt,
    })
  } catch (error) {
    console.error('Mock login error:', error)
    return c.json({ error: 'Authentication failed' }, 500)
  }
})

// POST /api/auth/admin-login
auth.post('/admin-login', async (c) => {
  try {
    const body = await c.req.json()
    const { email, password } = body
    if (!email || !password) return c.json({ error: 'Email and password are required' }, 400)

    const db = new DbClient(c.env.DB)
    const ADMIN_ROLES = ['employee', 'reviewer', 'manager', 'admin', 'superadmin']
    const MAX_LOGIN_ATTEMPTS = 5
    const LOCK_DURATION_MINUTES = 30

    const sanitizedEmail = email.trim().toLowerCase()
    const user: any = await db.findUserByEmail(sanitizedEmail)
    // Verify it's an admin user
    if (!user || !ADMIN_ROLES.includes(user.role)) return c.json({ error: 'Invalid email or password' }, 401)

    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      const remainingMinutes = Math.ceil((new Date(user.lockedUntil).getTime() - Date.now()) / 60000)
      return c.json({ error: `Account is locked. Try again in ${remainingMinutes} minutes.` }, 423)
    }

    if (!user.isActive) return c.json({ error: 'Account is deactivated.' }, 403)
    if (!user.passwordHash) return c.json({ error: 'Admin login not configured. Use UAE PASS.' }, 401)

    const passwordValid = await verifyPassword(password, user.passwordHash)

    if (!passwordValid) {
      const newAttempts = user.loginAttempts + 1
      const shouldLock = newAttempts >= MAX_LOGIN_ATTEMPTS
      await db.updateUser(user.id, {
        loginAttempts: newAttempts,
        lockedUntil: shouldLock ? new Date(Date.now() + LOCK_DURATION_MINUTES * 60 * 1000).toISOString() : null,
      })
      await db.createLoginHistory({
        id: generateId(), userId: user.id, authMethod: 'email_password', success: 0,
        failureReason: shouldLock ? `Account locked after ${MAX_LOGIN_ATTEMPTS} attempts` : 'Invalid password',
        ipAddress: c.req.header('x-forwarded-for') || null,
        userAgent: c.req.header('user-agent') || null,
      })
      if (shouldLock) return c.json({ error: `Account locked after ${MAX_LOGIN_ATTEMPTS} attempts.` }, 423)
      return c.json({ error: 'Invalid email or password' }, 401)
    }

    // Reset login attempts, auto-upgrade legacy hash
    const updateData: Record<string, unknown> = { loginAttempts: 0, lockedUntil: null, lastLoginAt: new Date().toISOString() }
    if (isLegacyHash(user.passwordHash)) updateData.passwordHash = await hashPassword(password)
    await db.updateUser(user.id, updateData)

    const accessToken = generateAccessToken(user.id)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    await db.createSession({
      id: generateId(), userId: user.id, accessToken, authMode: 'admin_password', expiresAt,
      ipAddress: c.req.header('x-forwarded-for') || null,
      userAgent: c.req.header('user-agent') || null,
      deviceInfo: c.req.header('user-agent') || null,
    })

    await db.createLoginHistory({
      id: generateId(), userId: user.id, authMethod: 'email_password', success: 1,
      ipAddress: c.req.header('x-forwarded-for') || null,
      userAgent: c.req.header('user-agent') || null,
    })

    await db.createAuditLog({
      id: generateId(), action: 'login', performedBy: `employee:${user.email}`,
      details: JSON.stringify({ authMethod: 'email_password', role: user.role }),
      category: 'auth', performedByUserId: user.id,
      ipAddress: c.req.header('x-forwarded-for') || null,
      userAgent: c.req.header('user-agent') || null,
    })

    const updatedUser: any = await db.findUserById(user.id)
    return c.json({
      success: true,
      user: {
        id: updatedUser.id, email: updatedUser.email, firstnameEN: updatedUser.firstnameEN,
        lastnameEN: updatedUser.lastnameEN, firstnameAR: updatedUser.firstnameAR,
        lastnameAR: updatedUser.lastnameAR, fullnameEN: updatedUser.fullnameEN,
        fullnameAR: updatedUser.fullnameAR, role: updatedUser.role,
        department: updatedUser.department, permissions: JSON.parse(updatedUser.permissions || '[]'),
        isActive: !!updatedUser.isActive, twoFactorEnabled: !!updatedUser.twoFactorEnabled,
        lastLoginAt: updatedUser.lastLoginAt,
      },
      accessToken, expiresAt,
    })
  } catch (error) {
    console.error('Admin login error:', error)
    return c.json({ error: 'Authentication failed' }, 500)
  }
})

// POST /api/auth/admin-register
auth.post('/admin-register', async (c) => {
  try {
    const body = await c.req.json()
    const { email, password, firstnameEN, lastnameEN, firstnameAR, lastnameAR, role, department } = body
    if (!email || !password || !firstnameEN || !lastnameEN || !role) {
      return c.json({ error: 'Missing required fields' }, 400)
    }

    const db = new DbClient(c.env.DB)
    const existing = await db.findUserByEmail(email)
    if (existing) return c.json({ error: 'Email already registered' }, 409)

    const passwordHash = await hashPassword(password)
    const permissions = getDefaultPermissions(role)
    const id = generateId()
    const rand = Math.random().toString(36).substring(2, 10)

    await db.createUser({
      id, uaepassSub: `admin_${email.replace(/[^a-zA-Z0-9]/g, '_')}_${rand}`,
      emiratesId: `ADM${rand}${Math.random().toString(36).substring(2, 6)}`,
      email, passwordHash, firstnameEN, lastnameEN,
      firstnameAR: firstnameAR || null, lastnameAR: lastnameAR || null,
      fullnameEN: `${firstnameEN} ${lastnameEN}`,
      fullnameAR: firstnameAR && lastnameAR ? `${firstnameAR} ${lastnameAR}` : null,
      role, department: department || null, permissions: JSON.stringify(permissions),
      isActive: 1, loginAttempts: 0,
    })

    const user: any = await db.findUserById(id)
    return c.json({ success: true, user: { id: user.id, email: user.email, role: user.role } }, 201)
  } catch (error) {
    console.error('Admin register error:', error)
    return c.json({ error: 'Registration failed' }, 500)
  }
})

// POST /api/auth/uaepass/login
auth.post('/uaepass/login', async (c) => {
  // Generate UAE PASS OAuth2 URL (placeholder)
  const clientId = 'szhp_moei_portal'
  const redirectUri = `${new URL(c.req.url).origin}/api/auth/uaepass/callback`
  const state = generateId()
  const authUrl = `https://uaepass.ae/idshub/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=openid&state=${state}`
  return c.json({ authUrl, state })
})

// POST /api/auth/uaepass/callback
auth.post('/uaepass/callback', async (c) => {
  // Placeholder for UAE PASS callback handling
  return c.json({ message: 'UAE PASS callback - implement OAuth2 token exchange' })
})

// POST /api/auth/logout
auth.post('/logout', async (c) => {
  const authHeader = c.req.header('Authorization')
  const token = authHeader?.replace('Bearer ', '')
  if (token) {
    const db = new DbClient(c.env.DB)
    const session: any = await db.findSessionByToken(token)
    if (session) await db.deleteSession(session.id)
  }
  return c.json({ success: true })
})

// GET /api/auth/me
auth.get('/me', async (c) => {
  try {
    const authHeader = c.req.header('Authorization')
    const token = authHeader?.replace('Bearer ', '')
    if (!token) return c.json({ error: 'No token provided' }, 401)

    const db = new DbClient(c.env.DB)
    const session: any = await db.findSessionByToken(token)
    if (!session || new Date(session.expiresAt) < new Date()) {
      return c.json({ error: 'Invalid or expired session' }, 401)
    }

    // session join gives us user fields on the same row
    return c.json({
      user: {
        id: session.userId, uaepassSub: session.uaepassSub, emiratesId: session.emiratesId,
        email: session.email, phone: session.phone, firstnameEN: session.firstnameEN,
        lastnameEN: session.lastnameEN, firstnameAR: session.firstnameAR, lastnameAR: session.lastnameAR,
        fullnameEN: session.fullnameEN, fullnameAR: session.fullnameAR,
        nationalityEN: session.nationalityEN, nationalityAR: session.nationalityAR,
        gender: session.gender, dob: session.dob, role: session.role,
        department: session.department, sopLevel: session.sopLevel, lastLoginAt: session.lastLoginAt,
      },
      authMode: session.authMode,
    })
  } catch (error) {
    console.error('Get current user error:', error)
    return c.json({ error: 'Failed to get user' }, 500)
  }
})

// POST /api/auth/seed-admin
auth.post('/seed-admin', async (c) => {
  try {
    const db = new DbClient(c.env.DB)

    // Check if superadmin already exists
    const existingSuperAdmin: any = await db.queryFirst("SELECT * FROM User WHERE role = 'superadmin' LIMIT 1")
    if (existingSuperAdmin) {
      return c.json({ success: true, message: 'Superadmin already exists. Seed disabled.' })
    }

    const allowSeed = c.env.ALLOW_ADMIN_SEED === 'true'
    if (!allowSeed) {
      return c.json({ error: 'Admin seeding disabled. Set ALLOW_ADMIN_SEED=true.' }, 403)
    }

    const defaultPassword = 'admin123'
    const passwordHash = hashPasswordSync(defaultPassword)
    const permissions = getDefaultPermissions('superadmin')
    const superAdminId = generateId()

    await db.createUser({
      id: superAdminId, uaepassSub: 'admin_szhp_system', emiratesId: 'ADM0000000001',
      email: 'admin@szhp.gov.ae', passwordHash, firstnameEN: 'System', lastnameEN: 'Administrator',
      firstnameAR: 'مسؤول', lastnameAR: 'النظام', fullnameEN: 'System Administrator',
      fullnameAR: 'مسؤول النظام', role: 'superadmin', department: 'management',
      permissions: JSON.stringify(permissions), isActive: 1, loginAttempts: 0,
    })

    await db.createAuditLog({
      id: generateId(), action: 'system_seeded', performedBy: 'system',
      details: JSON.stringify({ message: 'Default superadmin seeded', email: 'admin@szhp.gov.ae' }),
      category: 'system', affectedRecord: `User:${superAdminId}`,
      newValue: JSON.stringify({ email: 'admin@szhp.gov.ae', role: 'superadmin' }),
    })

    // Seed demo employees
    const demoEmployees = [
      { email: 'manager@szhp.gov.ae', password: 'manager123', firstnameEN: 'Ahmed', lastnameEN: 'Al Mansouri', firstnameAR: 'أحمد', lastnameAR: 'المنصوري', role: 'manager', department: 'management' },
      { email: 'reviewer@szhp.gov.ae', password: 'reviewer123', firstnameEN: 'Fatima', lastnameEN: 'Al Zaabi', firstnameAR: 'فاطمة', lastnameAR: 'الزعابي', role: 'reviewer', department: 'risk_assessment' },
      { email: 'employee@szhp.gov.ae', password: 'employee123', firstnameEN: 'Omar', lastnameEN: 'Al Ketbi', firstnameAR: 'عمر', lastnameAR: 'الكعبي', role: 'employee', department: 'housing_finance' },
      { email: 'admin2@szhp.gov.ae', password: 'admin123', firstnameEN: 'Sara', lastnameEN: 'Al Dhaheri', firstnameAR: 'سارة', lastnameAR: 'الظاهري', role: 'admin', department: 'compliance' },
    ]

    const createdEmployees = []
    for (const emp of demoEmployees) {
      const existing: any = await db.findUserByEmail(emp.email)
      if (existing) { createdEmployees.push({ email: emp.email, status: 'already_exists' }); continue }

      const empPermissions = getDefaultPermissions(emp.role)
      const empPasswordHash = hashPasswordSync(emp.password)
      const rand = Math.random().toString(36).substring(2, 10)
      const empSub = `admin_${emp.email.replace(/[^a-zA-Z0-9]/g, '_')}_${rand}`
      const empEmiratesId = `ADM${rand}${Math.random().toString(36).substring(2, 6)}`
      const empId = generateId()

      await db.createUser({
        id: empId, uaepassSub: empSub, emiratesId: empEmiratesId,
        email: emp.email, passwordHash: empPasswordHash,
        firstnameEN: emp.firstnameEN, lastnameEN: emp.lastnameEN,
        firstnameAR: emp.firstnameAR, lastnameAR: emp.lastnameAR,
        fullnameEN: `${emp.firstnameEN} ${emp.lastnameEN}`,
        fullnameAR: `${emp.firstnameAR} ${emp.lastnameAR}`,
        role: emp.role, department: emp.department,
        permissions: JSON.stringify(empPermissions), isActive: 1, loginAttempts: 0,
      })

      createdEmployees.push({ id: empId, email: emp.email, role: emp.role, status: 'created' })
    }

    return c.json({ success: true, message: 'Accounts seeded. Change default passwords immediately.', superAdmin: { id: superAdminId, email: 'admin@szhp.gov.ae', role: 'superadmin' }, demoEmployees: createdEmployees }, 201)
  } catch (error) {
    console.error('Seed admin error:', error)
    return c.json({ error: 'Failed to seed admin accounts' }, 500)
  }
})

export default auth
