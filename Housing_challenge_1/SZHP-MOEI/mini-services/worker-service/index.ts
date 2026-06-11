/**
 * Standalone Hono server for local development
 * Replaces wrangler dev — runs the Worker API on port 3001
 * Uses bun:sqlite for local D1-like database
 *
 * v1.1 Refactoring: Imports shared business logic from src/worker/lib/ and
 * src/worker/middleware/ to reduce code duplication. Only the DB access layer
 * differs (bun:sqlite vs Cloudflare D1).
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { Database } from 'bun:sqlite'
import { readFileSync, mkdirSync, readdirSync, unlinkSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

// ── Shared Module Imports ───────────────────────────────────────────
// Utilities: generateId, maskApiKey, safeJsonParse, toNum
import { generateId, maskApiKey, safeJsonParse, toNum } from '../../src/worker/lib/utils'

// Auth: hashPassword, verifyPassword, generateAccessToken, hasPermission, getDefaultPermissions, ROLE_PERMISSIONS
import {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  hasPermission,
  getDefaultPermissions,
  ROLE_PERMISSIONS,
} from '../../src/worker/middleware/auth'

// AI Client: chatCompletion, detectProvider, isUrlSafeForServerSideRequest, testConnection
import {
  chatCompletion,
  visionCompletion,
  detectProvider,
  isUrlSafeForServerSideRequest,
  testConnection as aiTestConnection,
} from '../../src/worker/lib/ai-client'

// Types (type-only imports are erased at runtime)
import type { AIProviderConfig, ChatMessage } from '../../src/worker/types'

// z-ai-web-dev-sdk removed — using direct fetch via shared ai-client module

const PORT = 3001

// ── Initialize SQLite Database ──────────────────────────────────────
const DB_PATH = join(dirname(fileURLToPath(import.meta.url)), '../../.wrangler/state/v3/d1/miniflare-D1DatabaseObject/db.sqlite')
const db = new Database(DB_PATH)

// Create tables if they don't exist
const schemaPath = join(dirname(fileURLToPath(import.meta.url)), '../../src/worker/db/schema.sql')
try {
  const schema = readFileSync(schemaPath, 'utf-8')
  db.exec(schema)
  console.log('✅ Database schema initialized')
} catch (err: any) {
  console.warn('⚠️ Schema init error (tables may already exist):', err.message)
}

// ── Helper: Query wrappers (bun:sqlite — synchronous, unlike D1) ────
function query(sql: string, params: any[] = []) {
  try {
    const stmt = db.prepare(sql)
    if (sql.trim().toUpperCase().startsWith('SELECT')) {
      return { results: stmt.all(...params), success: true }
    } else {
      stmt.run(...params)
      return { results: [], success: true, meta: { changes: db.changes } }
    }
  } catch (err: any) {
    return { results: [], success: false, error: err.message }
  }
}

function queryFirst(sql: string, params: any[] = []) {
  try {
    return db.prepare(sql).get(...params)
  } catch {
    return null
  }
}

function queryRun(sql: string, params: any[] = []) {
  try {
    db.prepare(sql).run(...params)
    return { changes: db.changes }
  } catch (err: any) {
    console.error('❌ DB run error:', err.message, '| SQL:', sql.substring(0, 100), '| Params count:', params.length, '| First 3 params:', params.slice(0, 3))
    return null
  }
}

// ── Config Helpers (local, using bun:sqlite instead of D1+KV) ───────
// These mirror src/worker/lib/config.ts but read directly from SQLite
// instead of going through DbClient + KV cache.

const CONFIG_CACHE_KEY = 'szhp:local_config'
let configCache: Record<string, string> | null = null
let configCacheExpiry = 0
const CONFIG_CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

function loadConfigs(): Record<string, string> {
  const now = Date.now()
  if (configCache && now < configCacheExpiry) return configCache

  try {
    const rows = query('SELECT configKey, configValue FROM SystemConfig WHERE isActive = 1').results as any[]
    const configs: Record<string, string> = {}
    for (const row of rows) {
      configs[row.configKey] = row.configValue
    }
    configCache = configs
    configCacheExpiry = now + CONFIG_CACHE_TTL_MS
    return configs
  } catch {
    return configCache || {}
  }
}

function invalidateConfigCache() {
  configCache = null
  configCacheExpiry = 0
}

function getConfigNumber(key: string, fallback: number): number {
  const configs = loadConfigs()
  const value = configs[key]
  if (value === undefined) return fallback
  const num = parseFloat(value)
  return isNaN(num) ? fallback : num
}

function getConfigString(key: string, fallback: string): string {
  const configs = loadConfigs()
  return configs[key] ?? fallback
}

function getConfigBoolean(key: string, fallback: boolean): boolean {
  const configs = loadConfigs()
  const value = configs[key]
  if (value === undefined) return fallback
  return value === 'true'
}

// ── Auth Helpers (using shared auth module) ─────────────────────────
// verifyAuth still needs local DB access (bun:sqlite), but password
// hashing/verification uses the shared module.

async function verifyAuth(token: string) {
  if (!token) return { authenticated: false, error: 'No token' }

  const row = queryFirst(`
    SELECT s.*, u.id as userId, u.email, u.role, u.permissions, u.isActive, u.lockedUntil
    FROM Session s JOIN User u ON s.userId = u.id
    WHERE s.accessToken = ?
  `, [token]) as any

  if (!row) return { authenticated: false, error: 'Invalid session token' }
  if (new Date(row.expiresAt) < new Date()) return { authenticated: false, error: 'Session expired' }
  if (!row.isActive) return { authenticated: false, error: 'Account deactivated' }
  if (row.lockedUntil && new Date(row.lockedUntil) > new Date()) return { authenticated: false, error: 'Account locked' }

  return {
    authenticated: true,
    user: {
      id: row.userId,
      email: row.email,
      role: row.role,
      permissions: safeJsonParse(row.permissions, []),
      isActive: !!row.isActive,
    },
    session: { id: row.id, authMode: row.authMode, expiresAt: row.expiresAt },
  }
}

function extractToken(c: any): string | null {
  const authHeader = c.req.header('Authorization')
  return authHeader?.replace('Bearer ', '') || null
}

// ── AI Helper (using shared ai-client module — direct fetch, no SDK) ──
// chatCompletion() and visionCompletion() are imported from src/worker/lib/ai-client
// These use direct fetch() calls to the Recentech AI endpoint.
// No z-ai-web-dev-sdk dependency needed.

// ── AI Helper (using shared ai-client module) ───────────────────────
// Get active model from local SQLite, then use shared chatCompletion
function getActiveModel(type: 'llm' | 'vlm' = 'llm'): AIProviderConfig | null {
  try {
    const configKey = type === 'llm' ? 'default_llm_id' : 'default_vlm_id'
    const targetModelId = getConfigString(configKey, '')

    let model: any = null
    if (targetModelId) {
      model = queryFirst('SELECT * FROM AIModelConfig WHERE id = ?', [targetModelId])
    }
    if (!model) {
      model = queryFirst('SELECT * FROM AIModelConfig WHERE isActive = 1 AND isDefault = 1')
    }
    if (!model) {
      model = queryFirst('SELECT * FROM AIModelConfig WHERE isActive = 1 LIMIT 1')
    }

    if (model) {
      return {
        id: model.id,
        provider: detectProvider(model.baseUrl) as AIProviderConfig['provider'],
        modelId: model.modelId,
        baseUrl: model.baseUrl,
        apiKey: model.apiKey || '',
        maxTokens: model.maxTokens || 4096,
        temperature: model.temperature || 0.7,
        isActive: !!model.isActive,
        isDefault: !!model.isDefault,
        capabilities: safeJsonParse(model.capabilities, []),
        zaiToken: process.env.Z_AI_TOKEN || undefined,
        zaiUserId: process.env.Z_AI_USER_ID || undefined,
        zaiChatId: process.env.Z_AI_CHAT_ID || undefined,
      }
    }
  } catch (err) {
    console.warn('Could not load AI model config from DB:', err)
  }
  return null
}

function getDefaultAIConfig(): AIProviderConfig {
  return {
    provider: 'recentech',
    modelId: 'glm-4-flash',
    baseUrl: process.env.RECENTECH_BASE_URL || 'https://recentech-ai-worker.42abudhabi424242.workers.dev/v1',
    apiKey: process.env.RECENTECH_API_KEY || 'rk_378538813a1da63282dbc24382a55cc8',
    maxTokens: 4096,
    temperature: 0.7,
    isActive: true,
    isDefault: true,
    capabilities: ['chat', 'vision'],
    zaiToken: process.env.Z_AI_TOKEN || undefined,
    zaiUserId: process.env.Z_AI_USER_ID || undefined,
    zaiChatId: process.env.Z_AI_CHAT_ID || undefined,
  }
}

function resolveAIConfig(): AIProviderConfig {
  return getActiveModel() || getDefaultAIConfig()
}

// ── Create Hono App ─────────────────────────────────────────────────
const app = new Hono()

// CORS
app.use('/api/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length'],
  maxAge: 86400,
  credentials: true,
}))

// Error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err)
  return c.json({ error: 'Internal server error', message: err.message }, 500)
})

// ── Health Check ────────────────────────────────────────────────────
app.get('/api', (c) => {
  return c.json({ message: 'Hello, world!', status: 'ok', timestamp: new Date().toISOString() })
})

// ── Auth Routes ─────────────────────────────────────────────────────

// POST /api/auth/mock-login
app.post('/api/auth/mock-login', async (c) => {
  try {
    const body = await c.req.json()
    const { profile } = body

    if (!profile) return c.json({ error: 'Profile required' }, 400)

    const emiratesId = profile.idn || profile.sub || generateId()

    // Find or create user
    let user = queryFirst('SELECT * FROM User WHERE emiratesId = ?', [emiratesId]) as any
    if (!user) {
      const id = generateId()
      queryRun(`INSERT INTO User (id, uaepassSub, emiratesId, firstnameEN, lastnameEN, fullnameEN, role, sopLevel, isActive, permissions)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, '[]')`,
        [id, profile.sub || id, emiratesId, profile.firstnameEN || 'Test', profile.lastnameEN || 'User',
         `${profile.firstnameEN || 'Test'} ${profile.lastnameEN || 'User'}`, profile.role || 'citizen', 'sop2'])
      user = queryFirst('SELECT * FROM User WHERE id = ?', [id]) as any
    }

    // Create session — uses shared generateAccessToken
    const accessToken = generateAccessToken(user.id)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    queryRun('INSERT INTO Session (id, userId, accessToken, authMode, expiresAt) VALUES (?, ?, ?, ?, ?)',
      [generateId(), user.id, accessToken, 'mock', expiresAt])

    // Update last login
    queryRun('UPDATE User SET lastLoginAt = ? WHERE id = ?', [new Date().toISOString(), user.id])

    return c.json({
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        firstnameEN: user.firstnameEN,
        lastnameEN: user.lastnameEN,
        firstnameAR: user.firstnameAR,
        lastnameAR: user.lastnameAR,
        role: user.role,
        department: user.department,
        permissions: safeJsonParse(user.permissions, []),
      },
    })
  } catch (error: any) {
    console.error('Mock login error:', error)
    return c.json({ error: 'Login failed', message: error.message }, 500)
  }
})

// POST /api/auth/admin-login
app.post('/api/auth/admin-login', async (c) => {
  try {
    const { email, password } = await c.req.json()
    if (!email || !password) return c.json({ error: 'Email and password required' }, 400)

    const user = queryFirst('SELECT * FROM User WHERE email = ? AND isActive = 1', [email]) as any
    if (!user) return c.json({ error: 'Invalid credentials' }, 401)
    if (!user.passwordHash) return c.json({ error: 'Account not configured for password login' }, 401)

    // Check account lock
    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      return c.json({ error: 'Account is locked. Try again later.' }, 403)
    }

    // Use shared verifyPassword from auth middleware
    const valid = await verifyPassword(password, user.passwordHash)

    if (!valid) {
      const attempts = toNum(user.loginAttempts, 0) + 1
      const lockUntil = attempts >= 5 ? new Date(Date.now() + 30 * 60 * 1000).toISOString() : null
      queryRun('UPDATE User SET loginAttempts = ?, lockedUntil = ? WHERE id = ?', [attempts, lockUntil, user.id])
      return c.json({ error: 'Invalid credentials' }, 401)
    }

    // Reset attempts
    queryRun('UPDATE User SET loginAttempts = 0, lockedUntil = NULL, lastLoginAt = ? WHERE id = ?', [new Date().toISOString(), user.id])

    // Create session — uses shared generateAccessToken
    const accessToken = generateAccessToken(user.id)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    queryRun('INSERT INTO Session (id, userId, accessToken, authMode, expiresAt) VALUES (?, ?, ?, ?, ?)',
      [generateId(), user.id, accessToken, 'admin_password', expiresAt])

    return c.json({
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        firstnameEN: user.firstnameEN,
        lastnameEN: user.lastnameEN,
        firstnameAR: user.firstnameAR,
        lastnameAR: user.lastnameAR,
        role: user.role,
        department: user.department,
        permissions: safeJsonParse(user.permissions, []),
      },
    })
  } catch (error: any) {
    console.error('Admin login error:', error)
    return c.json({ error: 'Login failed', message: error.message }, 500)
  }
})

// POST /api/auth/logout
app.post('/api/auth/logout', async (c) => {
  const token = extractToken(c)
  if (token) {
    queryRun('DELETE FROM Session WHERE accessToken = ?', [token])
  }
  return c.json({ success: true })
})

// GET /api/auth/me
app.get('/api/auth/me', async (c) => {
  const token = extractToken(c)
  const auth = await verifyAuth(token || '')
  if (!auth.authenticated) return c.json({ error: auth.error }, 401)
  return c.json({ user: auth.user })
})

// POST /api/auth/seed-admin
app.post('/api/auth/seed-admin', async (c) => {
  try {
    const superAdminEmail = 'admin@szhp.gov.ae'
    const existingAdmin = queryFirst('SELECT id FROM User WHERE email = ?', [superAdminEmail])

    let superAdminId: string
    if (!existingAdmin) {
      superAdminId = generateId()
      // Use shared hashPassword
      const passwordHash = await hashPassword('Admin@2024')
      queryRun(`INSERT INTO User (id, uaepassSub, emiratesId, email, firstnameEN, lastnameEN, fullnameEN, role, sopLevel, isActive, permissions, passwordHash)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, '["*"]', ?)`,
        [superAdminId, superAdminId, `784-1990-${Math.random().toString().slice(2, 9)}-1`, superAdminEmail,
         'Super', 'Admin', 'Super Admin', 'superadmin', 'sop3', passwordHash])
    } else {
      superAdminId = (existingAdmin as any).id
    }

    // Create demo employees
    const demoEmployees = [
      { email: 'manager@szhp.gov.ae', name: 'Manager', role: 'manager', perms: '["dashboard","cases","cases.approve","cases.reject","workflows","employees.view","employees.manage","audit.view","settings","models"]' },
      { email: 'reviewer@szhp.gov.ae', name: 'Reviewer', role: 'reviewer', perms: '["dashboard","cases","cases.review","audit.view"]' },
      { email: 'employee@szhp.gov.ae', name: 'Employee', role: 'employee', perms: '["dashboard","cases.view"]' },
      { email: 'admin2@szhp.gov.ae', name: 'Admin', role: 'admin', perms: '["dashboard","cases","cases.approve","cases.reject","workflows","employees.view","employees.manage","audit.view","settings","models"]' },
    ]

    const created = []
    for (const emp of demoEmployees) {
      const existing = queryFirst('SELECT id FROM User WHERE email = ?', [emp.email])
      if (!existing) {
        const empId = generateId()
        // Use shared hashPassword
        const passwordHash = await hashPassword('Pass@2024')
        queryRun(`INSERT INTO User (id, uaepassSub, emiratesId, email, firstnameEN, lastnameEN, fullnameEN, role, department, sopLevel, isActive, permissions, passwordHash)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'housing_finance', 'sop2', 1, ?, ?)`,
          [empId, empId, `784-1990-${Math.random().toString().slice(2, 9)}-2`, emp.email,
           emp.name, 'User', `${emp.name} User`, emp.role, emp.perms, passwordHash])
        created.push({ id: empId, email: emp.email, role: emp.role, status: 'created' })
      } else {
        created.push({ id: (existing as any).id, email: emp.email, role: emp.role, status: 'already_exists' })
      }
    }

    return c.json({
      success: true,
      message: 'Accounts seeded. Change default passwords immediately.',
      superAdmin: { id: superAdminId, email: superAdminEmail, role: 'superadmin' },
      demoEmployees: created,
    })
  } catch (error: any) {
    console.error('Seed admin error:', error)
    return c.json({ error: 'Seed failed', message: error.message }, 500)
  }
})

// ── Dashboard Route ─────────────────────────────────────────────────
app.get('/api/dashboard', async (c) => {
  const token = extractToken(c)
  const auth = await verifyAuth(token || '')
  if (!auth.authenticated) return c.json({ error: auth.error }, 401)

  try {
    const totalRequests = toNum((queryFirst('SELECT COUNT(*) as count FROM ReschedulingRequest') as any)?.count, 0)
    const pendingReview = toNum((queryFirst("SELECT COUNT(*) as count FROM ReschedulingRequest WHERE status IN ('pending', 'under_review')") as any)?.count, 0)
    const approvedThisMonth = toNum((queryFirst("SELECT COUNT(*) as count FROM ReschedulingRequest WHERE status = 'approved' AND strftime('%Y-%m', reviewedAt) = strftime('%Y-%m', 'now')") as any)?.count, 0)
    const rejectedThisMonth = toNum((queryFirst("SELECT COUNT(*) as count FROM ReschedulingRequest WHERE status = 'rejected' AND strftime('%Y-%m', reviewedAt) = strftime('%Y-%m', 'now')") as any)?.count, 0)

    // Status distribution
    const statusDist = (query("SELECT status, COUNT(*) as count FROM ReschedulingRequest GROUP BY status").results || []) as any[]

    // Risk distribution from assessments
    const riskDist = (query("SELECT riskLevel, COUNT(*) as count FROM AIAssessment GROUP BY riskLevel").results || []) as any[]

    // Recent requests
    const recentRequests = (query(`
      SELECT r.*, a.nameAr, a.nameEn, a.monthlyIncome, a.employerType, a.familySize,
        l.originalAmount, l.remainingBalance, l.monthlyInstallment, l.loanType, l.loanDurationMonths, l.elapsedMonths,
        ar.missedMonths, ar.totalOverdue, ar.delayDays, ar.reason as arrearReason,
        ass.riskScore, ass.riskLevel, ass.eligibilityStatus, ass.moeiRecommendation
      FROM ReschedulingRequest r
      LEFT JOIN Applicant a ON r.applicantId = a.id
      LEFT JOIN HousingLoan l ON r.loanId = l.id
      LEFT JOIN Arrear ar ON ar.loanId = l.id
      LEFT JOIN AIAssessment ass ON ass.requestId = r.id
      ORDER BY r.createdAt DESC LIMIT 10
    `).results || []) as any[]

    // Loan stats
    const loanStats = (query(`
      SELECT COALESCE(SUM(remainingBalance), 0) as totalOutstanding,
             COALESCE(AVG(monthlyInstallment), 0) as avgInstallment,
             COUNT(*) as totalLoans
      FROM HousingLoan WHERE status = 'active'
    `).results?.[0] || {}) as any

    // Arrear stats
    const arrearStats = (query(`
      SELECT COALESCE(SUM(totalOverdue), 0) as totalArrears,
             COALESCE(AVG(delayDays), 0) as avgDelayDays
      FROM Arrear
    `).results?.[0] || {}) as any

    return c.json({
      totalRequests,
      pendingReview,
      approvedThisMonth,
      rejectedThisMonth,
      avgProcessingTime: 45,
      automationRate: 78,
      statusDistribution: statusDist,
      riskDistribution: riskDist,
      monthlyTrend: [],
      recentRequests: recentRequests.map((r: any) => ({
        ...r,
        applicant: r.nameAr ? { nameAr: r.nameAr, nameEn: r.nameEn, monthlyIncome: r.monthlyIncome, employerType: r.employerType, familySize: r.familySize } : undefined,
        loan: r.originalAmount ? { originalAmount: r.originalAmount, remainingBalance: r.remainingBalance, monthlyInstallment: r.monthlyInstallment, loanType: r.loanType, loanDurationMonths: r.loanDurationMonths, elapsedMonths: r.elapsedMonths } : undefined,
        arrear: r.missedMonths ? { missedMonths: r.missedMonths, totalOverdue: r.totalOverdue, delayDays: r.delayDays, reason: r.arrearReason } : undefined,
        assessment: r.riskScore ? { riskScore: r.riskScore, riskLevel: r.riskLevel, eligibilityStatus: r.eligibilityStatus, moeiRecommendation: r.moeiRecommendation } : undefined,
      })),
      avgMonthlyInstallment: toNum(loanStats.avgInstallment, 0),
      totalOutstandingArrears: toNum(arrearStats.totalArrears, 0),
    })
  } catch (error: any) {
    console.error('Dashboard error:', error)
    return c.json({ error: 'Failed to load dashboard', message: error.message }, 500)
  }
})

// ── Requests Routes ─────────────────────────────────────────────────

// GET /api/requests
app.get('/api/requests', async (c) => {
  const token = extractToken(c)
  const auth = await verifyAuth(token || '')
  if (!auth.authenticated) return c.json({ error: auth.error }, 401)

  try {
    const status = c.req.query('status')
    const search = c.req.query('search')

    let sql = `
      SELECT r.*, a.nameAr, a.nameEn, a.monthlyIncome, a.employerType,
        l.originalAmount, l.remainingBalance, l.monthlyInstallment, l.loanType,
        ar.missedMonths, ar.totalOverdue, ar.delayDays,
        ass.riskScore, ass.riskLevel, ass.eligibilityStatus
      FROM ReschedulingRequest r
      LEFT JOIN Applicant a ON r.applicantId = a.id
      LEFT JOIN HousingLoan l ON r.loanId = l.id
      LEFT JOIN Arrear ar ON ar.loanId = l.id
      LEFT JOIN AIAssessment ass ON ass.requestId = r.id
    `
    const conditions: string[] = []
    const params: any[] = []

    if (status && status !== 'all') {
      conditions.push('r.status = ?')
      params.push(status)
    }
    if (search) {
      conditions.push('(a.nameAr LIKE ? OR a.nameEn LIKE ? OR r.id LIKE ?)')
      params.push(`%${search}%`, `%${search}%`, `%${search}%`)
    }

    // Non-admin users can only see their own requests
    if (auth.user?.role === 'citizen') {
      conditions.push('r.applicantId IN (SELECT id FROM Applicant WHERE emiratesId = ?)')
      // We don't have citizen EID mapping, so just show all for now
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ')
    }

    sql += ' ORDER BY r.createdAt DESC'

    const results = (query(sql, params).results || []) as any[]

    return c.json(results.map((r: any) => ({
      ...r,
      applicant: r.nameAr ? { nameAr: r.nameAr, nameEn: r.nameEn, monthlyIncome: r.monthlyIncome, employerType: r.employerType } : undefined,
      loan: r.originalAmount ? { originalAmount: r.originalAmount, remainingBalance: r.remainingBalance, monthlyInstallment: r.monthlyInstallment, loanType: r.loanType } : undefined,
      assessment: r.riskScore ? { riskScore: r.riskScore, riskLevel: r.riskLevel, eligibilityStatus: r.eligibilityStatus } : undefined,
    })))
  } catch (error: any) {
    console.error('List requests error:', error)
    return c.json({ error: 'Failed to fetch requests' }, 500)
  }
})

// POST /api/requests
app.post('/api/requests', async (c) => {
  try {
    const body = await c.req.json()
    const { applicant, loan, arrear, reasonCategory, reason, requestedDurationMonths, priority, supportingDocuments, uploadedFiles } = body

    // Create applicant if provided
    let applicantId = body.applicantId
    if (applicant && !applicantId) {
      applicantId = generateId()
      queryRun(`INSERT INTO Applicant (id, emiratesId, nameAr, nameEn, phone, email, monthlyIncome, employer, employerType, familySize, isCitizen, hasFamilyBook, maritalStatus, spouseIncome, totalHouseholdIncome, incomeStability, numberOfChildren, housingType)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [applicantId, applicant.emiratesId || generateId(), applicant.nameAr || 'مواطن', applicant.nameEn || 'Citizen',
         applicant.phone || '0500000000', applicant.email || null, applicant.monthlyIncome || 0,
         applicant.employer || null, applicant.employerType || 'government', applicant.familySize || 1,
         applicant.isCitizen !== false ? 1 : 0, applicant.hasFamilyBook !== false ? 1 : 0,
         applicant.maritalStatus || null, applicant.spouseIncome || 0,
         applicant.totalHouseholdIncome || applicant.monthlyIncome || 0,
         applicant.incomeStability || 'stable', applicant.numberOfChildren || 0, applicant.housingType || null])
    }

    // Create loan if provided
    let loanId = body.loanId
    if (loan && !loanId) {
      loanId = generateId()
      queryRun(`INSERT INTO HousingLoan (id, applicantId, originalAmount, remainingBalance, monthlyInstallment, loanDurationMonths, elapsedMonths, interestRate, loanType, status, paymentHistory, totalPaid, totalMissedPayments, reschedulingCount)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [loanId, applicantId, loan.originalAmount || 0, loan.remainingBalance || 0,
         loan.monthlyInstallment || 0, loan.loanDurationMonths || 240, loan.elapsedMonths || 0,
         loan.interestRate || 0, loan.loanType || 'loan', loan.status || 'active',
         '[]', 0, 0, 0])
    }

    // Create arrear if provided
    if (arrear && loanId) {
      queryRun(`INSERT INTO Arrear (id, loanId, missedMonths, totalOverdue, delayDays, reason, consecutiveMissedMonths)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [generateId(), loanId, arrear.missedMonths || 0, arrear.totalOverdue || 0,
         arrear.delayDays || 0, arrear.reason || reasonCategory, arrear.consecutiveMissedMonths || 0])
    }

    // Create request
    const reqId = generateId()
    const incomePerMember = (applicant?.totalHouseholdIncome || applicant?.monthlyIncome || 0) / Math.max(applicant?.familySize || 1, 1)
    const deductionRate = loan?.monthlyInstallment ? (loan.monthlyInstallment / (applicant?.monthlyIncome || 1)) * 100 : 0

    queryRun(`INSERT INTO ReschedulingRequest (id, applicantId, loanId, requestedDurationMonths, reason, reasonCategory, supportingDocuments, uploadedFiles, status, priority, incomePerFamilyMember, deductionRate)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [reqId, applicantId, loanId, requestedDurationMonths || 60, reason || '', reasonCategory || 'other',
       JSON.stringify(supportingDocuments || []), JSON.stringify(uploadedFiles || []),
       'pending', priority || 'normal', incomePerMember, deductionRate])

    // Create audit log
    queryRun(`INSERT INTO AuditLog (id, requestId, action, performedBy, details, category) VALUES (?, ?, ?, ?, ?, ?)`,
      [generateId(), reqId, 'created', 'system', JSON.stringify({ reasonCategory }), 'request'])

    const newRequest = queryFirst('SELECT * FROM ReschedulingRequest WHERE id = ?', [reqId])
    return c.json(newRequest, 201)
  } catch (error: any) {
    console.error('Create request error:', error)
    return c.json({ error: 'Failed to create request', message: error.message }, 500)
  }
})

// GET /api/requests/:id
app.get('/api/requests/:id', async (c) => {
  const token = extractToken(c)
  const auth = await verifyAuth(token || '')
  if (!auth.authenticated) return c.json({ error: auth.error }, 401)

  const id = c.req.param('id')
  const req = queryFirst('SELECT * FROM ReschedulingRequest WHERE id = ?', [id]) as any
  if (!req) return c.json({ error: 'Request not found' }, 404)

  const applicant = queryFirst('SELECT * FROM Applicant WHERE id = ?', [req.applicantId])
  const loan = queryFirst('SELECT * FROM HousingLoan WHERE id = ?', [req.loanId])
  const arrear = loan ? queryFirst('SELECT * FROM Arrear WHERE loanId = ?', [(loan as any).id]) : null
  const assessment = queryFirst('SELECT * FROM AIAssessment WHERE requestId = ?', [id])
  const auditLogs = query('SELECT * FROM AuditLog WHERE requestId = ? ORDER BY timestamp DESC', [id]).results

  // Track first view
  if (!req.isViewed && auth.user?.role !== 'citizen') {
    queryRun('UPDATE ReschedulingRequest SET isViewed = 1, firstViewedAt = ? WHERE id = ?', [new Date().toISOString(), id])
  }

  return c.json({
    ...req,
    applicant,
    loan,
    arrear,
    assessment,
    auditLogs,
  })
})

// PATCH /api/requests/:id
app.patch('/api/requests/:id', async (c) => {
  const token = extractToken(c)
  const auth = await verifyAuth(token || '')
  if (!auth.authenticated) return c.json({ error: auth.error }, 401)

  const id = c.req.param('id')
  const body = await c.req.json()

  const allowedStatuses = ['pending', 'under_review', 'ai_assessed', 'approved', 'rejected', 'escalated']
  if (body.status && !allowedStatuses.includes(body.status)) {
    return c.json({ error: 'Invalid status' }, 400)
  }

  const updates: string[] = []
  const params: any[] = []

  if (body.status) { updates.push('status = ?'); params.push(body.status) }
  if (body.priority) { updates.push('priority = ?'); params.push(body.priority) }
  if (body.notes !== undefined) { updates.push('notes = ?'); params.push(body.notes) }
  if (body.reviewedBy !== undefined) { updates.push('reviewedBy = ?'); params.push(body.reviewedBy) }

  if (updates.length > 0) {
    updates.push('reviewedAt = ?')
    params.push(new Date().toISOString())
    params.push(id)
    queryRun(`UPDATE ReschedulingRequest SET ${updates.join(', ')} WHERE id = ?`, params)
  }

  // Create audit log for status change
  if (body.status) {
    queryRun(`INSERT INTO AuditLog (id, requestId, action, performedBy, details, category) VALUES (?, ?, ?, ?, ?, ?)`,
      [generateId(), id, body.status, `employee:${auth.user?.email || auth.user?.id}`, JSON.stringify({ status: body.status, notes: body.notes }), 'request'])
  }

  const updated = queryFirst('SELECT * FROM ReschedulingRequest WHERE id = ?', [id])
  return c.json(updated)
})

// ── System Config Routes ────────────────────────────────────────────
app.get('/api/system-config', async (c) => {
  const category = c.req.query('category')
  const isPublic = c.req.query('public')

  let sql = 'SELECT * FROM SystemConfig WHERE isActive = 1'
  const params: any[] = []

  if (category) { sql += ' AND category = ?'; params.push(category) }
  if (isPublic === 'true') { sql += ' AND isPublic = 1' }

  sql += ' ORDER BY category, labelEN'

  const configs = query(sql, params).results

  // Group by category
  const grouped: Record<string, any[]> = {}
  for (const cfg of (configs || []) as any[]) {
    if (!grouped[cfg.category]) grouped[cfg.category] = []
    grouped[cfg.category].push({
      ...cfg,
      isActive: !!cfg.isActive,
      isPublic: !!cfg.isPublic,
    })
  }

  return c.json(grouped)
})

app.patch('/api/system-config', async (c) => {
  const token = extractToken(c)
  const auth = await verifyAuth(token || '')
  if (!auth.authenticated) return c.json({ error: auth.error }, 401)

  try {
    const updates = await c.req.json()
    if (!Array.isArray(updates)) return c.json({ error: 'Expected array of updates' }, 400)

    for (const update of updates) {
      if (update.configKey && update.configValue !== undefined) {
        queryRun('UPDATE SystemConfig SET configValue = ?, updatedAt = ? WHERE configKey = ?',
          [String(update.configValue), new Date().toISOString(), update.configKey])
      }
    }

    // Invalidate config cache after updates
    invalidateConfigCache()

    return c.json({ success: true, updated: updates.length })
  } catch (error: any) {
    return c.json({ error: 'Failed to update configs' }, 500)
  }
})

app.post('/api/system-config/seed', async (c) => {
  const token = extractToken(c)
  const auth = await verifyAuth(token || '')
  if (!auth.authenticated) return c.json({ error: auth.error }, 401)

  const defaultConfigs = [
    { configKey: 'max_dbr_limit', configValue: '0.20', defaultValue: '0.20', labelEN: 'Max DBR Limit', labelAR: 'الحد الأقصى لنسبة عبء الدين', category: 'dbr_limits', valueType: 'number', min: 0.1, max: 1.0, unit: '%', isPublic: 1 },
    { configKey: 'max_grant_amount', configValue: '800000', defaultValue: '800000', labelEN: 'Max Grant Amount', labelAR: 'الحد الأقصى لمبلغ المنحة', category: 'loan_limits', valueType: 'number', min: 0, max: 2000000, unit: 'AED', isPublic: 1 },
    { configKey: 'risk_threshold_low', configValue: '30', defaultValue: '30', labelEN: 'Low Risk Threshold', labelAR: 'عتبة المخاطر المنخفضة', category: 'risk_thresholds', valueType: 'number', min: 0, max: 100, unit: 'points', isPublic: 0 },
    { configKey: 'risk_threshold_medium', configValue: '50', defaultValue: '50', labelEN: 'Medium Risk Threshold', labelAR: 'عتبة المخاطر المتوسطة', category: 'risk_thresholds', valueType: 'number', min: 0, max: 100, unit: 'points', isPublic: 0 },
    { configKey: 'risk_threshold_high', configValue: '70', defaultValue: '70', labelEN: 'High Risk Threshold', labelAR: 'عتبة المخاطر العالية', category: 'risk_thresholds', valueType: 'number', min: 0, max: 100, unit: 'points', isPublic: 0 },
    { configKey: 'income_per_member_threshold', configValue: '2500', defaultValue: '2500', labelEN: 'Income Per Member Threshold', labelAR: 'عتبة الدخل لكل فرد', category: 'eligibility', valueType: 'number', min: 0, max: 10000, unit: 'AED', isPublic: 1 },
    { configKey: 'system_version', configValue: '9.0.0', defaultValue: '9.0.0', labelEN: 'System Version', labelAR: 'إصدار النظام', category: 'general', valueType: 'string', isPublic: 1 },
    { configKey: 'citizenship_required', configValue: 'true', defaultValue: 'true', labelEN: 'Citizenship Required', labelAR: 'مطلوب مواطنة', category: 'eligibility', valueType: 'boolean', isPublic: 0 },
    { configKey: 'family_book_required', configValue: 'true', defaultValue: 'true', labelEN: 'Family Book Required', labelAR: 'مطلوب دفتر العائلة', category: 'eligibility', valueType: 'boolean', isPublic: 0 },
    { configKey: 'min_monthly_income', configValue: '3000', defaultValue: '3000', labelEN: 'Min Monthly Income', labelAR: 'الحد الأدنى للدخل الشهري', category: 'eligibility', valueType: 'number', min: 0, max: 50000, unit: 'AED', isPublic: 0 },
    { configKey: 'default_llm_id', configValue: '', defaultValue: '', labelEN: 'Default LLM Model', labelAR: 'نموذج اللغة الافتراضي', category: 'ai_models', valueType: 'string', isPublic: 0 },
    { configKey: 'default_vlm_id', configValue: '', defaultValue: '', labelEN: 'Default VLM Model', labelAR: 'نموذج الرؤية الافتراضي', category: 'ai_models', valueType: 'string', isPublic: 0 },
  ]

  let seeded = 0
  for (const cfg of defaultConfigs) {
    const existing = queryFirst('SELECT id FROM SystemConfig WHERE configKey = ?', [cfg.configKey])
    if (!existing) {
      queryRun(`INSERT INTO SystemConfig (id, configKey, configValue, defaultValue, labelEN, labelAR, category, valueType, min, max, unit, isPublic, isActive)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [generateId(), cfg.configKey, cfg.configValue, cfg.defaultValue, cfg.labelEN, cfg.labelAR,
         cfg.category, cfg.valueType, cfg.min || null, cfg.max || null, cfg.unit || null, cfg.isPublic || 0])
      seeded++
    }
  }

  // Invalidate config cache after seeding
  invalidateConfigCache()

  return c.json({ success: true, seeded, message: `Seeded ${seeded} system configs` })
})

// ── Employees Routes ────────────────────────────────────────────────
app.get('/api/employees', async (c) => {
  const token = extractToken(c)
  const auth = await verifyAuth(token || '')
  if (!auth.authenticated) return c.json({ error: auth.error }, 401)

  const search = c.req.query('search')
  let sql = "SELECT id, email, firstnameEN, lastnameEN, fullnameEN, role, department, isActive, lastLoginAt, permissions FROM User WHERE role IN ('employee', 'reviewer', 'manager', 'admin', 'superadmin')"
  const params: any[] = []

  if (search) {
    sql += ' AND (email LIKE ? OR fullnameEN LIKE ?)'
    params.push(`%${search}%`, `%${search}%`)
  }

  sql += ' ORDER BY createdAt DESC'

  const employees = query(sql, params).results
  return c.json(employees)
})

// ── Models Routes ───────────────────────────────────────────────────
app.get('/api/models', async (c) => {
  const token = extractToken(c)
  const auth = await verifyAuth(token || '')
  if (!auth.authenticated) return c.json({ error: auth.error }, 401)

  const models = query('SELECT * FROM AIModelConfig ORDER BY createdAt DESC').results
  return c.json((models || []).map((m: any) => ({
    ...m,
    apiKey: maskApiKey(m.apiKey), // Uses shared maskApiKey
    hasApiKey: !!m.apiKey,
    isActive: !!m.isActive,
    isDefault: !!m.isDefault,
  })))
})

app.post('/api/models/seed', async (c) => {
  const token = extractToken(c)
  const auth = await verifyAuth(token || '')
  if (!auth.authenticated) return c.json({ error: auth.error }, 401)

  const defaultModels = [
    { name: 'Recentech AI — GLM-4-Flash', provider: 'recentech', modelId: 'glm-4-flash', baseUrl: process.env.RECENTECH_BASE_URL || 'https://recentech-ai-worker.42abudhabi424242.workers.dev/v1', apiKey: process.env.RECENTECH_API_KEY || 'rk_378538813a1da63282dbc24382a55cc8', isActive: 1, isDefault: 1, capabilities: '["chat","vision"]', maxTokens: 4096, temperature: 0.7, descriptionEN: 'Default fast model', descriptionAR: 'النموذج السريع الافتراضي' },
    { name: 'Recentech AI — GLM-4-Plus', provider: 'recentech', modelId: 'glm-4-plus', baseUrl: process.env.RECENTECH_BASE_URL || 'https://recentech-ai-worker.42abudhabi424242.workers.dev/v1', apiKey: process.env.RECENTECH_API_KEY || 'rk_378538813a1da63282dbc24382a55cc8', isActive: 1, isDefault: 0, capabilities: '["chat","vision"]', maxTokens: 4096, temperature: 0.7, descriptionEN: 'Balanced model', descriptionAR: 'نموذج متوازن' },
    { name: 'Recentech AI — GLM-5', provider: 'recentech', modelId: 'glm-5', baseUrl: process.env.RECENTECH_BASE_URL || 'https://recentech-ai-worker.42abudhabi424242.workers.dev/v1', apiKey: process.env.RECENTECH_API_KEY || 'rk_378538813a1da63282dbc24382a55cc8', isActive: 1, isDefault: 0, capabilities: '["chat","vision","thinking"]', maxTokens: 8192, temperature: 0.7, descriptionEN: 'Advanced reasoning', descriptionAR: 'استدلال متقدم' },
  ]

  let seeded = 0
  for (const model of defaultModels) {
    const existing = queryFirst('SELECT id FROM AIModelConfig WHERE modelId = ? AND provider = ?', [model.modelId, model.provider])
    if (!existing) {
      queryRun(`INSERT INTO AIModelConfig (id, name, provider, modelId, baseUrl, apiKey, isActive, isDefault, capabilities, maxTokens, temperature, descriptionEN, descriptionAR)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [generateId(), ...Object.values(model)])
      seeded++
    }
  }

  return c.json({ success: true, seeded })
})

// POST /api/models/test-connection
app.post('/api/models/test-connection', async (c) => {
  const token = extractToken(c)
  const auth = await verifyAuth(token || '')
  if (!auth.authenticated) return c.json({ error: auth.error }, 401)

  try {
    const body = await c.req.json()
    const config: AIProviderConfig = {
      provider: detectProvider(body.baseUrl || ''), // Uses shared detectProvider
      modelId: body.modelId || 'glm-4-flash',
      baseUrl: body.baseUrl || '',
      apiKey: body.apiKey || '',
      maxTokens: body.maxTokens || 4096,
      temperature: body.temperature || 0.7,
      zaiToken: process.env.Z_AI_TOKEN || undefined,
      zaiUserId: process.env.Z_AI_USER_ID || undefined,
      zaiChatId: process.env.Z_AI_CHAT_ID || undefined,
    }

    // Uses shared testConnection
    const result = await aiTestConnection(config)
    return c.json(result)
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500)
  }
})

// ── Form Fields Routes ──────────────────────────────────────────────
app.get('/api/form-fields', (c) => {
  const fields = query("SELECT * FROM FormField WHERE isActive = 1 ORDER BY section, \"order\"").results
  return c.json(fields)
})

app.post('/api/form-fields/seed', async (c) => {
  const defaultFields = [
    { labelEN: 'Emirates ID', labelAR: 'رقم الهوية', fieldKey: 'emiratesId', fieldType: 'text', section: 'personal', required: 1, "order": 1, validation: '{"regex":"^784-[0-9]{4}-[0-9]{7}-[0-9]$","customMessage":"Must be a valid Emirates ID format"}', ruleDescriptionEN: 'Must be a valid UAE Emirates ID', ruleDescriptionAR: 'يجب أن يكون رقم هوية إماراتي صالح' },
    { labelEN: 'Full Name (Arabic)', labelAR: 'الاسم الكامل', fieldKey: 'nameAr', fieldType: 'text', section: 'personal', required: 1, "order": 2, validation: '{"minLength":3}' },
    { labelEN: 'Monthly Income', labelAR: 'الدخل الشهري', fieldKey: 'monthlyIncome', fieldType: 'number', section: 'financial', required: 1, "order": 1, validation: '{"min":0}', ruleDescriptionEN: 'Must be a positive number', ruleDescriptionAR: 'يجب أن يكون رقماً موجباً' },
    { labelEN: 'Employer Type', labelAR: 'نوع جهة العمل', fieldKey: 'employerType', fieldType: 'select', section: 'financial', required: 1, "order": 2, options: '["government","semi-government","private"]' },
    { labelEN: 'Family Size', labelAR: 'حجم الأسرة', fieldKey: 'familySize', fieldType: 'number', section: 'financial', required: 1, "order": 3, validation: '{"min":1,"max":20}' },
    { labelEN: 'Reason Category', labelAR: 'فئة السبب', fieldKey: 'reasonCategory', fieldType: 'select', section: 'loan', required: 1, "order": 1, options: '["job_loss","medical","salary_cut","divorce","retirement","other"]' },
  ]

  let seeded = 0
  for (const field of defaultFields) {
    const existing = queryFirst('SELECT id FROM FormField WHERE fieldKey = ?', [field.fieldKey])
    if (!existing) {
      queryRun(`INSERT INTO FormField (id, labelEN, labelAR, fieldKey, fieldType, section, required, "order", validation, ruleDescriptionEN, ruleDescriptionAR, options, placeholderEN, placeholderAR, helpTextEN, helpTextAR, showRule, aiAutoValidate, isVisible, isActive)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, 1, 0, 1, 1)`,
        [generateId(), field.labelEN, field.labelAR, field.fieldKey, field.fieldType, field.section,
         field.required, field.order, field.validation || '{}', field.ruleDescriptionEN || null, field.ruleDescriptionAR || null,
         field.options || '[]'])
      seeded++
    }
  }

  return c.json({ success: true, seeded })
})

// ── Workflows Routes ────────────────────────────────────────────────
app.get('/api/workflows', async (c) => {
  const token = extractToken(c)
  const auth = await verifyAuth(token || '')
  if (!auth.authenticated) return c.json({ error: auth.error }, 401)

  const workflows = query('SELECT * FROM ApprovalWorkflow WHERE isActive = 1 ORDER BY priority DESC').results
  return c.json(workflows)
})

// ── Audit Trail Routes ──────────────────────────────────────────────
app.get('/api/audit-trail', async (c) => {
  const token = extractToken(c)
  const auth = await verifyAuth(token || '')
  if (!auth.authenticated) return c.json({ error: auth.error }, 401)

  const category = c.req.query('category')
  let sql = 'SELECT * FROM AuditLog'
  const params: any[] = []

  if (category) {
    sql += ' WHERE category = ?'
    params.push(category)
  }

  sql += ' ORDER BY timestamp DESC LIMIT 100'

  const logs = query(sql, params).results
  return c.json(logs)
})

app.get('/api/audit-trail/stats', (c) => {
  const stats = query(`
    SELECT category, COUNT(*) as count FROM AuditLog GROUP BY category
  `).results
  return c.json(stats)
})

// ── AI Routes (using shared ai-client module) ───────────────────────
app.post('/api/analyze', async (c) => {
  try {
    const body = await c.req.json()

    // Use shared chatCompletion (direct fetch to Recentech AI)
    const result = await chatCompletion([
      { role: 'system', content: 'You are a UAE housing policy expert. Analyze the rescheduling request and provide recommendations based on MOEI rules. Focus on: 20% deduction rule, income per family member threshold (AED 2,500), income stability, payment history. Respond in JSON format.' },
      { role: 'user', content: JSON.stringify(body) },
    ], resolveAIConfig())

    return c.json({ analysis: result.content, model: result.model, provider: 'z-ai-sdk' })
  } catch (error: any) {
    console.error('Analyze error:', error)
    return c.json({ error: 'Analysis failed', message: error.message }, 500)
  }
})

app.post('/api/simulate', async (c) => {
  const token = extractToken(c)
  const auth = await verifyAuth(token || '')
  if (!auth.authenticated) return c.json({ error: auth.error }, 401)

  try {
    const body = await c.req.json()

    // Basic simulation using rules
    const monthlyIncome = toNum(body.monthlyIncome, 10000)
    const remainingBalance = toNum(body.remainingBalance, 500000)
    const requestedDuration = toNum(body.requestedDurationMonths, 60)
    const familySize = toNum(body.familySize, 4)
    const totalHouseholdIncome = toNum(body.totalHouseholdIncome, monthlyIncome)

    const proposedInstallment = Math.ceil(remainingBalance / requestedDuration)
    const dbr = proposedInstallment / monthlyIncome
    const incomePerMember = totalHouseholdIncome / familySize
    const maxDbr = getConfigNumber('max_dbr_limit', 0.20)

    const eligible = dbr <= maxDbr && incomePerMember >= getConfigNumber('income_per_member_threshold', 2500)

    return c.json({
      eligible,
      proposedInstallment,
      dbr: Math.round(dbr * 10000) / 10000,
      maxDbr,
      withinDbrLimit: dbr <= maxDbr,
      incomePerMember: Math.round(incomePerMember * 100) / 100,
      requestedDuration,
      deductionRate: Math.round((proposedInstallment / monthlyIncome) * 10000) / 100,
      recommendation: eligible ? 'Eligible for rescheduling' : 'Not eligible - exceeds limits',
    })
  } catch (error: any) {
    return c.json({ error: 'Simulation failed', message: error.message }, 500)
  }
})

app.post('/api/ai-assistant', async (c) => {
  try {
    const { message, action } = await c.req.json()

    const systemPrompt = 'You are a helpful AI assistant for the Sheikh Zayed Housing Programme (SZHP) in the UAE. Help citizens with their housing loan arrears rescheduling questions. Be concise, professional, and empathetic. Respond in the same language the user uses (Arabic or English).'

    // Use shared chatCompletion (direct fetch to Recentech AI)
    const result = await chatCompletion([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message || 'How can I apply for rescheduling?' },
    ], resolveAIConfig())

    return c.json({ response: result.content, action: action || 'chat' })
  } catch (error: any) {
    console.error('AI assistant error:', error)
    return c.json({ response: 'Sorry, an error occurred. Please try again later.', action: 'chat' })
  }
})

app.post('/api/requests/:id/assess', async (c) => {
  const token = extractToken(c)
  const auth = await verifyAuth(token || '')
  if (!auth.authenticated) return c.json({ error: auth.error }, 401)

  const id = c.req.param('id')
  const startTime = Date.now()

  try {
    // Get request details
    const reqData = queryFirst('SELECT * FROM ReschedulingRequest WHERE id = ?', [id]) as any
    if (!reqData) return c.json({ error: 'Request not found' }, 404)

    const applicant = queryFirst('SELECT * FROM Applicant WHERE id = ?', [reqData.applicantId]) as any
    const loan = queryFirst('SELECT * FROM HousingLoan WHERE id = ?', [reqData.loanId]) as any
    const arrear = loan ? queryFirst('SELECT * FROM Arrear WHERE loanId = ?', [loan.id]) as any : null

    if (!applicant || !loan) return c.json({ error: 'Missing applicant or loan data' }, 400)

    // Calculate metrics
    const totalHouseholdIncome = toNum(applicant.totalHouseholdIncome, toNum(applicant.monthlyIncome, 0))
    const incomePerMember = totalHouseholdIncome / Math.max(applicant.familySize, 1)
    const proposedInstallment = Math.ceil(loan.remainingBalance / reqData.requestedDurationMonths)
    const currentDbr = loan.monthlyInstallment / applicant.monthlyIncome
    const proposedDbr = proposedInstallment / applicant.monthlyIncome
    const deductionRate = (loan.monthlyInstallment / applicant.monthlyIncome) * 100
    const maxDbr = getConfigNumber('max_dbr_limit', 0.20)
    const threshold = getConfigNumber('income_per_member_threshold', 2500)

    // Risk scoring
    let riskScore = 0
    if (currentDbr > 0.6) riskScore += 25
    else if (currentDbr > 0.4) riskScore += 15
    else if (currentDbr > 0.2) riskScore += 5

    if (arrear?.delayDays > 180) riskScore += 25
    else if (arrear?.delayDays > 90) riskScore += 15
    else if (arrear?.delayDays > 30) riskScore += 8

    if (applicant.monthlyIncome < 5000) riskScore += 20
    else if (applicant.monthlyIncome < 10000) riskScore += 10

    riskScore = Math.min(riskScore, 100)

    const riskLevel = riskScore >= 70 ? 'critical' : riskScore >= 50 ? 'high' : riskScore >= 30 ? 'medium' : 'low'
    const eligibilityStatus = proposedDbr <= maxDbr && incomePerMember >= threshold ? 'eligible' : proposedDbr <= maxDbr * 1.2 ? 'conditionally_eligible' : 'ineligible'
    const rule20Compliance = deductionRate <= 20 ? 'pass' : 'fail'

    // Period rule: rescheduling must not exceed remaining original period
    const maxRemaining = loan.loanDurationMonths - loan.elapsedMonths
    const periodRuleCompliance = reqData.requestedDurationMonths <= maxRemaining ? 'pass' : 'fail'

    // Get AI analysis — use shared chatCompletion (direct fetch)
    let aiAnalysis = ''
    let aiModelVersion = 'v1.0-rules-only'

    try {
      const result = await chatCompletion(
        [{
          role: 'system',
          content: `You are an expert MOEI housing policy analyst. Analyze this case and provide a recommendation. Consider: 20% deduction rule (current: ${deductionRate.toFixed(1)}%), income per family member (AED ${incomePerMember.toFixed(0)}, threshold: AED ${threshold}), income stability (${applicant.incomeStability}), period rule (requested: ${reqData.requestedDurationMonths}mo, max remaining: ${maxRemaining}mo). Respond with JSON: {"recommendation": "approve|conditionally_approve|request_documents|refer_to_employee|reject", "reasoning": "...", "caseSummary": "..."}`
        }, {
          role: 'user',
          content: `Case: Applicant income AED ${applicant.monthlyIncome}, family size ${applicant.familySize}, loan balance AED ${loan.remainingBalance}, missed ${arrear?.missedMonths || 0} months, delay ${arrear?.delayDays || 0} days.`
        }],
        resolveAIConfig()
      )
      aiAnalysis = result.content
      aiModelVersion = `v1.0-${result.model}`
    } catch (err) {
      console.warn('AI analysis failed, using rules-only assessment')
    }

    // Parse AI recommendation
    let moeiRecommendation = 'refer_to_employee'
    let moeiReasoning = 'Assessment based on rules engine only'
    let caseSummary = ''

    if (aiAnalysis) {
      try {
        const parsed = safeJsonParse(aiAnalysis.match(/\{[\s\S]*\}/)?.[0] || '{}', {} as any)
        moeiRecommendation = parsed.recommendation || moeiRecommendation
        moeiReasoning = parsed.reasoning || moeiReasoning
        caseSummary = parsed.caseSummary || ''
      } catch {
        moeiReasoning = aiAnalysis.substring(0, 500)
      }
    }

    const processingTimeMs = Date.now() - startTime

    // Save assessment
    const assessmentId = generateId()
    queryRun(`INSERT INTO AIAssessment (id, requestId, riskScore, riskLevel, confidenceScore, recommendedAmount, recommendedDuration, recommendedInstallment, debtBurdenRatio, proposedDBR, eligibilityStatus, decisionRationale, governanceCompliance, riskFactors, shapExplanation, requiresHumanReview, aiModelVersion, processingTimeMs, applicationStatus, incomeAnalysis, proposedDeductionRate, rule20PercentCompliance, periodRuleCompliance, moeiRecommendation, moeiReasoning, caseSummary)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [assessmentId, id, riskScore, riskLevel, Math.max(0, 100 - riskScore),
       loan.remainingBalance, reqData.requestedDurationMonths, proposedInstallment,
       currentDbr, proposedDbr, eligibilityStatus,
       JSON.stringify({ incomePerMember, deductionRate, riskScore }),
       JSON.stringify([{ rule: 'dbr_limit', passed: proposedDbr <= maxDbr }, { rule: 'deduction_20', passed: rule20Compliance === 'pass' }, { rule: 'period_rule', passed: periodRuleCompliance === 'pass' }]),
       JSON.stringify([{ factor: 'dbr', contribution: Math.min(25, Math.round(currentDbr * 30)) }, { factor: 'delay', contribution: Math.min(25, Math.round((arrear?.delayDays || 0) / 7)) }]),
       JSON.stringify([{ factor: 'income_per_member', value: incomePerMember, threshold }, { factor: 'deduction_rate', value: deductionRate, limit: 20 }]),
       riskLevel === 'high' || riskLevel === 'critical' ? 1 : 0,
       aiModelVersion, processingTimeMs,
       incomePerMember >= threshold ? 'complete' : 'incomplete',
       JSON.stringify({ salary: applicant.monthlyIncome, stability: applicant.incomeStability, perMemberAverage: incomePerMember, householdTotal: totalHouseholdIncome }),
       deductionRate, rule20Compliance, periodRuleCompliance,
       moeiRecommendation, moeiReasoning, caseSummary])

    // Update request status
    queryRun("UPDATE ReschedulingRequest SET status = 'ai_assessed' WHERE id = ?", [id])

    // Create audit log
    queryRun(`INSERT INTO AuditLog (id, requestId, action, performedBy, details, category) VALUES (?, ?, ?, ?, ?, ?)`,
      [generateId(), id, 'assessed', `system:ai_${aiModelVersion}`, JSON.stringify({ riskScore, riskLevel, eligibilityStatus }), 'request'])

    const assessment = queryFirst('SELECT * FROM AIAssessment WHERE id = ?', [assessmentId])

    return c.json({
      ...assessment,
      request: queryFirst('SELECT * FROM ReschedulingRequest WHERE id = ?', [id]),
    })
  } catch (error: any) {
    console.error('Assessment error:', error)
    return c.json({ error: 'Assessment failed', message: error.message }, 500)
  }
})

// ── Upload Route (simplified - local storage) ───────────────────────
app.post('/api/upload', async (c) => {
  try {
    const formData = await c.req.formData()
    const file = formData.get('file') as File
    if (!file) return c.json({ error: 'No file provided' }, 400)

    const fileId = generateId()
    const storedName = `${fileId}-${file.name}`
    // Save file to uploads directory so AI analysis can read it later
    const uploadsDir = join(dirname(fileURLToPath(import.meta.url)), '../../uploads')
    mkdirSync(uploadsDir, { recursive: true })
    const filePath = join(uploadsDir, storedName)
    await Bun.write(filePath, file)
    return c.json({
      data: {
        id: fileId,
        originalName: file.name,
        storedName,
        size: file.size,
        type: file.type,
        uploadedAt: new Date().toISOString(),
      },
    })
  } catch (error: any) {
    return c.json({ error: 'Upload failed', message: error.message }, 500)
  }
})

// ── System Routes ───────────────────────────────────────────────────
app.get('/api/system/hardware', (c) => {
  return c.json({
    platform: 'Cloudflare Workers (local dev)',
    memory: 'N/A',
    cpu: 'N/A',
    gpu: 'N/A',
  })
})

app.post('/api/system/generate-mock', async (c) => {
  const token = extractToken(c)
  const auth = await verifyAuth(token || '')
  if (!auth.authenticated) return c.json({ error: auth.error }, 401)

  try {
    const applicantId = generateId()
    const loanId = generateId()
    const arrearId = generateId()
    const requestId = generateId()

    const monthlyIncome = Math.floor(Math.random() * 30000) + 5000
    const familySize = Math.floor(Math.random() * 8) + 1
    const originalAmount = Math.floor(Math.random() * 1500000) + 200000
    const remainingBalance = originalAmount * (0.3 + Math.random() * 0.5)
    const missedMonths = Math.floor(Math.random() * 6) + 1
    const monthlyInstallment = originalAmount / 240
    const totalOverdue = monthlyInstallment * missedMonths

    // Create applicant
    queryRun(`INSERT INTO Applicant (id, emiratesId, nameAr, nameEn, phone, monthlyIncome, employerType, familySize, isCitizen, hasFamilyBook, maritalStatus, totalHouseholdIncome, incomeStability, numberOfChildren)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?, ?, ?)`,
      [applicantId, `784-1990-${Math.random().toString().slice(2, 9)}-1`, `مواطن ${Math.floor(Math.random() * 1000)}`, `Citizen ${Math.floor(Math.random() * 1000)}`,
       `05${Math.floor(Math.random() * 100000000)}`, monthlyIncome, ['government', 'semi-government', 'private'][Math.floor(Math.random() * 3)],
       familySize, ['single', 'married', 'divorced'][Math.floor(Math.random() * 3)],
       monthlyIncome * (1 + Math.random() * 0.5), ['stable', 'reduced', 'variable'][Math.floor(Math.random() * 3)],
       Math.floor(Math.random() * 5)])

    // Create loan
    queryRun(`INSERT INTO HousingLoan (id, applicantId, originalAmount, remainingBalance, monthlyInstallment, loanDurationMonths, elapsedMonths, loanType, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [loanId, applicantId, originalAmount, remainingBalance, monthlyInstallment, 240, Math.floor(Math.random() * 120) + 12,
       ['grant', 'loan', 'maintenance'][Math.floor(Math.random() * 3)]])

    // Create arrear
    queryRun(`INSERT INTO Arrear (id, loanId, missedMonths, totalOverdue, delayDays, reason, consecutiveMissedMonths)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [arrearId, loanId, missedMonths, totalOverdue, missedMonths * 30,
       ['job_loss', 'medical', 'salary_cut', 'divorce'][Math.floor(Math.random() * 4)], missedMonths])

    // Create request
    queryRun(`INSERT INTO ReschedulingRequest (id, applicantId, loanId, requestedDurationMonths, reasonCategory, status, priority, incomePerFamilyMember, deductionRate)
      VALUES (?, ?, ?, ?, ?, 'pending', 'normal', ?, ?)`,
      [requestId, applicantId, loanId, 60, ['job_loss', 'medical', 'salary_cut'][Math.floor(Math.random() * 3)],
       monthlyIncome / familySize, (monthlyInstallment / monthlyIncome) * 100])

    return c.json({ requestId, applicantId, loanId })
  } catch (error: any) {
    return c.json({ error: 'Mock generation failed', message: error.message }, 500)
  }
})

// ── Applicants Routes ────────────────────────────────────────────────
app.get('/api/applicants', async (c) => {
  const token = extractToken(c)
  const auth = await verifyAuth(token || '')
  if (!auth.authenticated) return c.json({ error: auth.error }, 401)

  const applicants = query(`
    SELECT a.*, COUNT(DISTINCT l.id) as loanCount, COUNT(DISTINCT r.id) as requestCount
    FROM Applicant a
    LEFT JOIN HousingLoan l ON l.applicantId = a.id
    LEFT JOIN ReschedulingRequest r ON r.applicantId = a.id
    GROUP BY a.id
    ORDER BY a.createdAt DESC
  `).results
  return c.json(applicants)
})

// ── Verify Document (simplified) ────────────────────────────────────
app.post('/api/verify-document', async (c) => {
  return c.json({ verified: true, message: 'Document verification is available in production deployment' })
})

app.post('/api/analyze-salary-certificate', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}))
    const { fileName, imageUrl, language: reqLang, bankStatementData } = body as {
      fileName?: string
      imageUrl?: string
      language?: string
      bankStatementData?: any
    }
    const isAr = reqLang === 'ar'

    const modelConfig = resolveAIConfig()

    // Try to read the actual uploaded file for VLM analysis
    let fileDataUrl: string | null = null
    try {
      if (fileName) {
        const uploadsDir = join(dirname(fileURLToPath(import.meta.url)), '../../uploads')
        const files = readdirSync(uploadsDir)
        const matchedFile = files.find(f => f.endsWith(fileName) || f.includes(fileName.replace(/^[^-]+-/, '')))
        if (matchedFile) {
          const filePath = join(uploadsDir, matchedFile)
          const fileBuffer = readFileSync(filePath)
          const ext = matchedFile.toLowerCase()
          let mimeType = 'image/png'
          if (ext.endsWith('.jpg') || ext.endsWith('.jpeg')) mimeType = 'image/jpeg'
          else if (ext.endsWith('.webp')) mimeType = 'image/webp'
          else if (ext.endsWith('.pdf')) mimeType = 'application/pdf'
          else if (ext.endsWith('.docx')) mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          const base64 = fileBuffer.toString('base64')
          fileDataUrl = `data:${mimeType};base64,${base64}`
        }
      }
    } catch (err: any) {
      console.warn('Could not read uploaded file for VLM analysis:', err?.message || err)
    }

    // If imageUrl was provided directly, use that instead
    if (imageUrl) fileDataUrl = imageUrl

    const systemPrompt = `You are an expert UAE salary certificate analyst for SZHP/MOEI (Sheikh Zayed Housing Programme / Ministry of Energy and Infrastructure). You perform comprehensive validation of salary certificates submitted by citizens applying for housing arrears rescheduling.

You MUST analyze the document for ALL of the following aspects and return ONLY valid JSON:

1. OFFICIAL COMPANY LETTERHEAD — Does the document appear to be printed on official company letterhead? Look for company logo, company name header, branded formatting, or other indicators of official stationery.

2. AUTHORIZED SIGNATURE / STAMP — Is there a signature or official stamp from an authorized person (HR manager, director, etc.)? Even if you cannot see the actual signature clearly, note if a signature line or stamp area is present.

3. DATE OF ISSUANCE — When was the certificate issued? Extract the exact date if available. This is critical for validity checking.

4. VALIDITY STATEMENT — Many UAE salary certificates include a clause indicating validity for a specific period (typically 30 days from issuance date). Check if such a clause exists and whether the certificate is within its validity period based on today's date (${new Date().toISOString().split('T')[0]}).

5. EMPLOYEE DETAILS — Extract all available employee information:
   - Full name in English and Arabic
   - Emirates ID number
   - Job title / position
   - Nationality

6. SALARY INFORMATION — Extract all salary components:
   - Basic salary
   - Housing allowance
   - Transport allowance
   - Total salary (sum of all components)
   Determine if the salary information appears complete (all major components listed).

7. EMPLOYER TYPE CLASSIFICATION — Classify the employer as:
   - "government" — UAE federal or local government entity
   - "semi-government" — Semi-government organizations (e.g., Emirates Airlines, DEWA, Etisalat)
   - "private" — Private sector company

8. CROSS-CHECK AGAINST BANK STATEMENT — If bank statement data is provided, compare the salary transfers visible in the bank statement against the declared salary in the certificate. Look for consistency in amounts and regularity of transfers.

Return ONLY valid JSON with this EXACT structure (use null for fields you cannot determine):
{
  "isSalaryCertificate": boolean,
  "confidence": number (0-100),
  "documentType": string,
  "extractedFields": {
    "employeeNameEn": string | null,
    "employeeNameAr": string | null,
    "emiratesId": string | null,
    "jobTitle": string | null,
    "nationality": string | null,
    "employerNameEn": string | null,
    "employerNameAr": string | null,
    "employerType": "government" | "semi-government" | "private" | null,
    "basicSalary": number | null,
    "housingAllowance": number | null,
    "transportAllowance": number | null,
    "totalSalary": number | null,
    "employmentStartDate": string | null,
    "contractType": string | null,
    "certificateIssueDate": string | null,
    "hasEmployerStamp": boolean | null,
    "hasAuthorizedSignature": boolean | null,
    "isOnLetterhead": boolean | null,
    "validityDays": number | null,
    "validityExpiryDate": string | null,
    "isValidityExpired": boolean | null
  },
  "validationChecks": {
    "hasLetterhead": boolean | null,
    "hasAuthorizedSignature": boolean | null,
    "hasIssueDate": boolean | null,
    "hasValidityStatement": boolean | null,
    "isWithinValidity": boolean | null,
    "salaryInfoComplete": boolean | null,
    "employeeDetailsComplete": boolean | null
  },
  "salaryBankCrossCheck": {
    "certSalary": number | null,
    "bankSalaryTransfers": number | null,
    "isConsistent": boolean | null,
    "discrepancyAmount": number | null,
    "discrepancyPercent": number | null,
    "note": string | null
  },
  "issues": string[],
  "anomalies": string[],
  "authenticityScore": number (0-100),
  "recommendation": "accept" | "review" | "reject",
  "recommendationReason": string
}

Important rules:
- "issues" should list specific validation problems found (e.g., "Certificate has expired", "No authorized signature detected", "Salary breakdown incomplete")
- "anomalies" should list suspicious or unusual findings (e.g., "Salary amount unusually high for stated position", "Certificate date appears altered")
- "authenticityScore" should reflect the overall trustworthiness: 80-100 = high confidence authentic, 50-79 = moderate, 0-49 = suspicious
- "recommendation": "accept" if all checks pass (score >= 80), "review" if some concerns (score 50-79), "reject" if major issues (score < 50)
- For "salaryBankCrossCheck", if no bank statement data is available, set all fields to null except "note" which should say "No bank statement data provided for cross-check"
- Be conservative: if you are unsure about a field, use null rather than guessing`

    const bankNote = bankStatementData
      ? `\n\nBank statement data is also available for cross-checking: ${JSON.stringify(bankStatementData)}`
      : '\n\nNo bank statement data was provided for cross-checking.'

    const userPrompt = isAr
      ? `تحليل مستند شهادة الراتب المرفوع. يرجى إجراء تحليل شامل والتحقق من جميع جوانب الشهادة بما في ذلك القرطاسية الرسمية والتوقيع وتاريخ الإصدار والصلاحية وتفاصيل الموظف ومعلومات الراتب ونوع صاحب العمل.${bankNote}\n\nأرجع النتائج بصيغة JSON فقط.`
      : `Analyze this salary certificate document. The file was uploaded by a citizen applying for housing arrears rescheduling. Perform a comprehensive validation checking for: official letterhead, authorized signature/stamp, issuance date, validity period, employee details completeness, salary information completeness, employer type classification, and cross-check against bank statement if available.${bankNote}\n\nReturn your analysis as JSON only.`

    const defaultExtractedFields = {
      employeeNameEn: null, employeeNameAr: null, emiratesId: null, jobTitle: null, nationality: null,
      employerNameEn: null, employerNameAr: null, employerType: null,
      basicSalary: null, housingAllowance: null, transportAllowance: null, totalSalary: null,
      employmentStartDate: null, contractType: null, certificateIssueDate: null,
      hasEmployerStamp: null, hasAuthorizedSignature: null, isOnLetterhead: null,
      validityDays: null, validityExpiryDate: null, isValidityExpired: null,
    }
    const defaultValidationChecks = {
      hasLetterhead: null, hasAuthorizedSignature: null, hasIssueDate: null,
      hasValidityStatement: null, isWithinValidity: null,
      salaryInfoComplete: null, employeeDetailsComplete: null,
    }
    const defaultCrossCheck = {
      certSalary: null, bankSalaryTransfers: null, isConsistent: null,
      discrepancyAmount: null, discrepancyPercent: null,
      note: 'No bank statement data provided for cross-check',
    }

    let analysisResult: Record<string, unknown> = {
      isSalaryCertificate: true,
      confidence: 50,
      documentType: 'salary_certificate',
      extractedFields: defaultExtractedFields,
      validationChecks: defaultValidationChecks,
      salaryBankCrossCheck: defaultCrossCheck,
      issues: ['AI analysis completed with limited confidence — manual review recommended'],
      anomalies: [],
      authenticityScore: 50,
      recommendation: 'review',
      recommendationReason: 'AI analysis completed with limited confidence — manual review recommended',
    }

    try {
      let completion: { content: string; model: string; provider: string }

      if (fileDataUrl) {
        // Use shared visionCompletion for real document analysis
        const visionMessages = [{
          role: 'user' as const,
          content: [
            { type: 'text' as const, text: systemPrompt + '\n\n' + userPrompt },
            { type: 'image_url' as const, image_url: { url: fileDataUrl } },
          ],
        }]
        const visionResult = await visionCompletion(visionMessages, getActiveModel('vlm') || resolveAIConfig())
        completion = { content: visionResult.content, model: visionResult.model, provider: 'z-ai-sdk-vlm' }
      } else {
        // Fallback to text-only LLM if file not available
        const textResult = await chatCompletion([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt + '\n\nNote: The actual document image could not be loaded. Please provide a generic analysis indicating that manual review is required.' },
        ], resolveAIConfig())
        completion = { content: textResult.content, model: textResult.model, provider: textResult.provider }
      }

      const content = completion.content
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content]
      const parsed = JSON.parse((jsonMatch[1] || content).trim())
      // Merge with defaults to ensure all fields exist for backward compatibility
      analysisResult = {
        ...analysisResult,
        ...parsed,
        extractedFields: { ...defaultExtractedFields, ...(parsed.extractedFields || {}) },
        validationChecks: { ...defaultValidationChecks, ...(parsed.validationChecks || {}) },
        salaryBankCrossCheck: { ...defaultCrossCheck, ...(parsed.salaryBankCrossCheck || {}) },
      }
    } catch (aiErr: any) {
      console.warn('AI salary cert analysis failed, using fallback:', aiErr?.message || aiErr)
    }

    return c.json({ data: analysisResult })
  } catch (error: any) {
    console.error('Salary certificate analysis error:', error)
    return c.json({ error: 'Salary certificate analysis failed', message: error.message }, 500)
  }
})

// ── Medical Report Analysis Endpoint ─────────────────────────────────
app.post('/api/analyze-medical-report', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}))
    const { fileName, imageUrl, language: reqLang } = body as { fileName?: string; imageUrl?: string; language?: string }
    const isAr = reqLang === 'ar'

    const modelConfig = resolveAIConfig()

    // Try to read the actual uploaded file for VLM analysis
    let fileDataUrl: string | null = null
    try {
      if (fileName) {
        const uploadsDir = join(dirname(fileURLToPath(import.meta.url)), '../../uploads')
        const files = readdirSync(uploadsDir)
        const matchedFile = files.find(f => f.endsWith(fileName) || f.includes(fileName.replace(/^[^-]+-/, '')))
        if (matchedFile) {
          const filePath = join(uploadsDir, matchedFile)
          const fileBuffer = readFileSync(filePath)
          const ext = matchedFile.toLowerCase()
          let mimeType = 'image/png'
          if (ext.endsWith('.jpg') || ext.endsWith('.jpeg')) mimeType = 'image/jpeg'
          else if (ext.endsWith('.webp')) mimeType = 'image/webp'
          else if (ext.endsWith('.pdf')) mimeType = 'application/pdf'
          else if (ext.endsWith('.docx')) mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          const base64 = fileBuffer.toString('base64')
          fileDataUrl = `data:${mimeType};base64,${base64}`
        }
      }
    } catch (err: any) {
      console.warn('Could not read uploaded file for VLM analysis:', err?.message || err)
    }

    // If imageUrl was provided directly, use that instead
    if (imageUrl) fileDataUrl = imageUrl

    const systemPrompt = `You are an expert UAE medical report analyst for SZHP/MOEI. You validate medical reports submitted by citizens applying for housing arrears rescheduling. You MUST check for ALL of the following and return ONLY valid JSON:

1. QR CODE / DIGITAL AUTHENTICATION — Does the report contain a QR code or digital authentication feature that links to the issuing authority? Many UAE medical reports include QR codes that can be scanned to verify authenticity.

2. RECOGNIZED UAE HEALTHCARE AUTHORITY — Validate that the report originates from or is endorsed by a recognized UAE healthcare authority:
   - DHA (Dubai Health Authority)
   - DOH (Department of Health — Abu Dhabi)
   - MOHAP (Ministry of Health and Prevention)
   - SEHA (Abu Dhabi Health Services Company)
   - Emirates Healthcare Group
   If you can identify the authority, include it in the "recognizedAuthorities" array.

3. DOCTOR'S SIGNATURE AND LICENSE NUMBER — Check for a doctor's signature and license number. UAE medical reports must be signed by a licensed physician with their MOHAP/DHA/DOH license number displayed.

4. PATIENT NAME — Extract the patient name and verify it appears to match the applicant.

5. ISSUE DATE AND FACILITY NAME — Extract the issue date and the name of the medical facility/clinic/hospital.

6. FACILITY STAMP — Check if the report has an official facility stamp or seal.

Return ONLY valid JSON with this EXACT structure (use null for fields you cannot determine):
{
  "isMedicalReport": boolean,
  "confidence": number (0-100),
  "extractedFields": {
    "patientName": string | null,
    "diagnosis": string | null,
    "facilityName": string | null,
    "doctorName": string | null,
    "doctorLicense": string | null,
    "issueDate": string | null,
    "authorityCode": string | null,
    "hasQRCode": boolean | null,
    "hasFacilityStamp": boolean | null
  },
  "validationChecks": {
    "hasQRCodeOrDigitalAuth": boolean | null,
    "recognizedAuthority": boolean | null,
    "hasDoctorSignature": boolean | null,
    "hasLicenseNumber": boolean | null,
    "facilityVerified": boolean | null,
    "issueDateValid": boolean | null
  },
  "recognizedAuthorities": string[],
  "issues": string[],
  "authenticityScore": number (0-100),
  "recommendation": "accept" | "review" | "reject",
  "recommendationReason": string
}

Important rules:
- "recognizedAuthorities" should list which UAE healthcare authorities were identified on the document (e.g., ["DHA", "MOHAP"])
- "issues" should list specific validation problems found (e.g., "No QR code detected", "Doctor license number missing", "Issuing authority not recognized")
- "authenticityScore" should reflect overall trustworthiness: 80-100 = high confidence authentic, 50-79 = moderate, 0-49 = suspicious
- "recommendation": "accept" if all checks pass (score >= 80), "review" if some concerns (score 50-79), "reject" if major issues (score < 50)
- Today's date is ${new Date().toISOString().split('T')[0]} — use this to assess if the report is recent
- "issueDateValid" should be true if the issue date is within the last 6 months
- Be conservative: if you are unsure about a field, use null rather than guessing`

    const userPrompt = isAr
      ? `تحليل مستند التقرير الطبي المرفوع. يرجى إجراء تحليل شامل والتحقق من رمز الاستجابة السريعة والجهة الصحية المصدرة وتوقيع الطبيب ورقم الترخيص واسم المريض وتاريخ الإصدار واسم المنشأة.\n\nأرجع النتائج بصيغة JSON فقط.`
      : `Analyze this medical report document. The file was uploaded by a citizen applying for housing arrears rescheduling. Perform a comprehensive validation checking for: QR code or digital authentication, recognized UAE healthcare authority, doctor's signature and license number, patient name, issue date, and facility name and stamp.\n\nReturn your analysis as JSON only.`

    const defaultExtractedFields = {
      patientName: null, diagnosis: null, facilityName: null,
      doctorName: null, doctorLicense: null, issueDate: null,
      authorityCode: null, hasQRCode: null, hasFacilityStamp: null,
    }
    const defaultValidationChecks = {
      hasQRCodeOrDigitalAuth: null, recognizedAuthority: null,
      hasDoctorSignature: null, hasLicenseNumber: null,
      facilityVerified: null, issueDateValid: null,
    }

    let analysisResult: Record<string, unknown> = {
      isMedicalReport: true,
      confidence: 50,
      extractedFields: defaultExtractedFields,
      validationChecks: defaultValidationChecks,
      recognizedAuthorities: [],
      issues: ['AI analysis completed with limited confidence — manual review recommended'],
      authenticityScore: 50,
      recommendation: 'review',
      recommendationReason: 'AI analysis completed with limited confidence — manual review recommended',
    }

    try {
      let completion: { content: string; model: string; provider: string }

      if (fileDataUrl) {
        // Use shared visionCompletion for real document analysis
        const visionMessages = [{
          role: 'user' as const,
          content: [
            { type: 'text' as const, text: systemPrompt + '\n\n' + userPrompt },
            { type: 'image_url' as const, image_url: { url: fileDataUrl } },
          ],
        }]
        const visionResult = await visionCompletion(visionMessages, getActiveModel('vlm') || resolveAIConfig())
        completion = { content: visionResult.content, model: visionResult.model, provider: 'z-ai-sdk-vlm' }
      } else {
        // Fallback to text-only LLM if file not available
        const textResult = await chatCompletion([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt + '\n\nNote: The actual document image could not be loaded. Please provide a generic analysis indicating that manual review is required.' },
        ], resolveAIConfig())
        completion = { content: textResult.content, model: textResult.model, provider: textResult.provider }
      }

      const content = completion.content
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content]
      const parsed = JSON.parse((jsonMatch[1] || content).trim())
      analysisResult = {
        ...analysisResult,
        ...parsed,
        extractedFields: { ...defaultExtractedFields, ...(parsed.extractedFields || {}) },
        validationChecks: { ...defaultValidationChecks, ...(parsed.validationChecks || {}) },
        recognizedAuthorities: Array.isArray(parsed.recognizedAuthorities) ? parsed.recognizedAuthorities : [],
      }
    } catch (aiErr: any) {
      console.warn('AI medical report analysis failed, using fallback:', aiErr?.message || aiErr)
    }

    return c.json({ data: analysisResult })
  } catch (error: any) {
    console.error('Medical report analysis error:', error)
    return c.json({ error: 'Medical report analysis failed', message: error.message }, 500)
  }
})

// ── Salary-Bank Statement Cross-Check Endpoint ───────────────────────
app.post('/api/cross-check-salary-bank', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}))
    const { salaryCertData, bankStatementData } = body as {
      salaryCertData?: any
      bankStatementData?: any
    }

    if (!salaryCertData && !bankStatementData) {
      return c.json({ error: 'At least salaryCertData or bankStatementData is required' }, 400)
    }

    const modelConfig = resolveAIConfig()

    const systemPrompt = `You are a financial document cross-check analyst for SZHP/MOEI. Your job is to compare the salary declared in a salary certificate against the salary transfers visible in a bank statement, and determine if they are consistent.

You will receive:
1. salaryCertData — The analysis result from a salary certificate (may include extractedFields with basicSalary, totalSalary, etc.)
2. bankStatementData — Bank statement data or analysis (may include salary transfer amounts, transaction patterns, etc.)

Perform these checks:
- Compare the declared salary amount from the certificate against the salary transfer amounts visible in the bank statement
- Check if the transfers are regular (monthly) and consistent
- Calculate any discrepancy between the declared and transferred amounts
- Consider that minor differences (<5%) may be due to deductions (social insurance, pension, etc.)
- Larger discrepancies (>10%) are significant red flags
- If no bank statement data is available, note that cross-checking could not be performed

Return ONLY valid JSON with this EXACT structure:
{
  "certSalary": number | null,
  "bankTransferredSalary": number | null,
  "isConsistent": boolean | null,
  "discrepancyAmount": number | null,
  "discrepancyPercent": number | null,
  "assessmentMonths": number | null,
  "note": string
}

Rules:
- "certSalary" should be the total salary from the certificate (or basicSalary if total not available)
- "bankTransferredSalary" should be the average monthly salary transfer visible in the bank statement
- "isConsistent": true if discrepancy <= 10%, false if > 10%, null if cannot determine
- "discrepancyAmount": absolute difference between certSalary and bankTransferredSalary
- "discrepancyPercent": (discrepancyAmount / certSalary) * 100, rounded to 1 decimal
- "assessmentMonths": how many months of bank data were analyzed
- "note": explain your findings, including any caveats or observations`

    const salaryInfo = salaryCertData
      ? `Salary Certificate Data: ${JSON.stringify(salaryCertData)}`
      : 'No salary certificate data provided.'
    const bankInfo = bankStatementData
      ? `Bank Statement Data: ${JSON.stringify(bankStatementData)}`
      : 'No bank statement data provided.'

    const userPrompt = `Cross-check the salary certificate against the bank statement:\n\n${salaryInfo}\n\n${bankInfo}\n\nReturn your cross-check analysis as JSON only.`

    const defaultResult = {
      certSalary: salaryCertData?.extractedFields?.totalSalary ?? salaryCertData?.extractedFields?.basicSalary ?? null,
      bankTransferredSalary: null,
      isConsistent: null,
      discrepancyAmount: null,
      discrepancyPercent: null,
      assessmentMonths: null,
      note: 'AI cross-check could not be completed — manual review recommended',
    }

    let crossCheckResult: Record<string, unknown> = { ...defaultResult }

    try {
      const completion = await chatCompletion(
        [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
        resolveAIConfig()
      )
      const content = completion.content
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content]
      const parsed = JSON.parse((jsonMatch[1] || content).trim())
      crossCheckResult = { ...defaultResult, ...parsed }
    } catch (aiErr: any) {
      console.warn('AI salary-bank cross-check failed, using fallback:', aiErr?.message || aiErr)
    }

    return c.json({ data: crossCheckResult })
  } catch (error: any) {
    console.error('Salary-bank cross-check error:', error)
    return c.json({ error: 'Salary-bank cross-check failed', message: error.message }, 500)
  }
})

app.post('/api/verify-identity', async (c) => {
  return c.json({ verified: true, message: 'Identity verification is available in production deployment' })
})

// ── Admin Chatbot Route ──────────────────────────────────────────────
app.post('/api/admin-chatbot', async (c) => {
  const token = extractToken(c)
  const auth = await verifyAuth(token || '')
  if (!auth.authenticated) return c.json({ error: auth.error }, 401)

  // Only allow admin/manager/reviewer roles
  const allowedRoles = ['admin', 'superadmin', 'manager', 'reviewer']
  if (!allowedRoles.includes(auth.user?.role || '')) {
    return c.json({ error: 'Insufficient permissions' }, 403)
  }

  try {
    const { message, context, language } = await c.req.json()
    if (!message) return c.json({ error: 'Message required' }, 400)

    const isAr = language === 'ar'
    const lowerMsg = message.toLowerCase()

    // ── Smart data gathering based on message content ───────────────
    const dataUsed: Record<string, any> = {}

    // Always gather basic dashboard stats
    const totalRequests = toNum((queryFirst('SELECT COUNT(*) as count FROM ReschedulingRequest') as any)?.count, 0)
    dataUsed.totalRequests = totalRequests

    const pendingCount = toNum((queryFirst("SELECT COUNT(*) as count FROM ReschedulingRequest WHERE status IN ('pending', 'under_review')") as any)?.count, 0)
    dataUsed.pendingCount = pendingCount

    const approvedCount = toNum((queryFirst("SELECT COUNT(*) as count FROM ReschedulingRequest WHERE status = 'approved'") as any)?.count, 0)
    dataUsed.approvedCount = approvedCount

    const rejectedCount = toNum((queryFirst("SELECT COUNT(*) as count FROM ReschedulingRequest WHERE status = 'rejected'") as any)?.count, 0)
    dataUsed.rejectedCount = rejectedCount

    const approvalRate = totalRequests > 0 ? Math.round((approvedCount / totalRequests) * 100) : 0
    dataUsed.approvalRate = approvalRate

    // "dashboard" / "overview" / "summary" → full dashboard stats
    if (/\b(dashboard|overview|summary|إحصائيات|نظرة عامة|ملخص)\b/.test(lowerMsg)) {
      const statusDist = (query("SELECT status, COUNT(*) as count FROM ReschedulingRequest GROUP BY status").results || []) as any[]
      dataUsed.statusDistribution = statusDist

      const loanStats = (query(`
        SELECT COALESCE(SUM(remainingBalance), 0) as totalOutstanding,
               COALESCE(AVG(monthlyInstallment), 0) as avgInstallment,
               COUNT(*) as totalLoans
        FROM HousingLoan WHERE status = 'active'
      `).results?.[0] || {}) as any
      dataUsed.totalOutstanding = toNum(loanStats.totalOutstanding, 0)
      dataUsed.avgInstallment = Math.round(toNum(loanStats.avgInstallment, 0))
      dataUsed.totalLoans = toNum(loanStats.totalLoans, 0)

      const arrearStats = (query(`
        SELECT COALESCE(SUM(totalOverdue), 0) as totalArrears,
               COALESCE(AVG(delayDays), 0) as avgDelayDays
        FROM Arrear
      `).results?.[0] || {}) as any
      dataUsed.totalArrears = toNum(arrearStats.totalArrears, 0)
      dataUsed.avgDelayDays = Math.round(toNum(arrearStats.avgDelayDays, 0))
    }

    // "pending" / "waiting" → pending/under_review details
    if (/\b(pending|waiting|انتظار|معلق|قيد المراجعة)\b/.test(lowerMsg)) {
      const pendingByPriority = (query("SELECT priority, COUNT(*) as count FROM ReschedulingRequest WHERE status IN ('pending', 'under_review') GROUP BY priority").results || []) as any[]
      dataUsed.pendingByPriority = pendingByPriority

      const oldestPending = queryFirst("SELECT createdAt FROM ReschedulingRequest WHERE status IN ('pending', 'under_review') ORDER BY createdAt ASC LIMIT 1") as any
      if (oldestPending) {
        const daysWaiting = Math.round((Date.now() - new Date(oldestPending.createdAt).getTime()) / (1000 * 60 * 60 * 24))
        dataUsed.oldestPendingDays = daysWaiting
      }
    }

    // "risk" / "high risk" → risk distribution and high-risk cases
    if (/\b(risk|high.?risk|low.?risk|medium.?risk|مخاطر|عالية المخاطر|منخفضة المخاطر)\b/.test(lowerMsg)) {
      const riskDist = (query("SELECT riskLevel, COUNT(*) as count FROM AIAssessment GROUP BY riskLevel").results || []) as any[]
      dataUsed.riskDistribution = riskDist

      const highRiskCount = toNum((queryFirst("SELECT COUNT(*) as count FROM AIAssessment WHERE riskLevel = 'high'") as any)?.count, 0)
      dataUsed.highRiskCount = highRiskCount

      const avgRiskScore = toNum((queryFirst("SELECT AVG(riskScore) as avgScore FROM AIAssessment") as any)?.avgScore, 0)
      dataUsed.avgRiskScore = Math.round(avgRiskScore)

      const highRiskCases = (query(`
        SELECT r.id, r.status, a.nameEn, a.nameAr, ass.riskScore, ass.riskLevel, ass.eligibilityStatus,
               l.remainingBalance, ar.totalOverdue
        FROM AIAssessment ass
        JOIN ReschedulingRequest r ON ass.requestId = r.id
        LEFT JOIN Applicant a ON r.applicantId = a.id
        LEFT JOIN HousingLoan l ON r.loanId = l.id
        LEFT JOIN Arrear ar ON ar.loanId = l.id
        WHERE ass.riskLevel = 'high'
        ORDER BY ass.riskScore DESC LIMIT 5
      `).results || []) as any[]
      dataUsed.highRiskCases = highRiskCases
    }

    // "trends" / "monthly" → monthly request trends
    if (/\b(trend|monthly|monthly.?trend|اتجاه|شهري|شهريا)\b/.test(lowerMsg)) {
      const monthlyTrend = (query(`
        SELECT strftime('%Y-%m', createdAt) as month,
               COUNT(*) as count,
               SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
               SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
        FROM ReschedulingRequest
        GROUP BY strftime('%Y-%m', createdAt)
        ORDER BY month DESC LIMIT 12
      `).results || []) as any[]
      dataUsed.monthlyTrend = monthlyTrend
    }

    // "arrears" / "overdue" / "delay" → arrear details
    if (/\b(arrear|overdue|delay|متأخرات|متأخر|تأخير)\b/.test(lowerMsg)) {
      const arrearStats = (query(`
        SELECT COALESCE(SUM(totalOverdue), 0) as totalArrears,
               COALESCE(AVG(delayDays), 0) as avgDelayDays,
               COALESCE(AVG(missedMonths), 0) as avgMissedMonths,
               COALESCE(MAX(delayDays), 0) as maxDelayDays,
               COUNT(*) as totalArrearCases
        FROM Arrear
      `).results?.[0] || {}) as any
      dataUsed.totalArrears = toNum(arrearStats.totalArrears, 0)
      dataUsed.avgDelayDays = Math.round(toNum(arrearStats.avgDelayDays, 0))
      dataUsed.avgMissedMonths = Math.round(toNum(arrearStats.avgMissedMonths, 1) * 10) / 10
      dataUsed.maxDelayDays = toNum(arrearStats.maxDelayDays, 0)
      dataUsed.totalArrearCases = toNum(arrearStats.totalArrearCases, 0)

      const topArrearCases = (query(`
        SELECT a.nameEn, a.nameAr, ar.missedMonths, ar.totalOverdue, ar.delayDays, ar.reason,
               l.remainingBalance, l.monthlyInstallment
        FROM Arrear ar
        JOIN HousingLoan l ON ar.loanId = l.id
        LEFT JOIN Applicant a ON l.applicantId = a.id
        ORDER BY ar.totalOverdue DESC LIMIT 5
      `).results || []) as any[]
      dataUsed.topArrearCases = topArrearCases
    }

    // "approved" / "rejected" → approval/rejection stats
    if (/\b(approved|rejected|approval|rejection|موافقة|مرفوض|قبول|رفض)\b/.test(lowerMsg)) {
      const approvedThisMonth = toNum((queryFirst("SELECT COUNT(*) as count FROM ReschedulingRequest WHERE status = 'approved' AND strftime('%Y-%m', reviewedAt) = strftime('%Y-%m', 'now')") as any)?.count, 0)
      const rejectedThisMonth = toNum((queryFirst("SELECT COUNT(*) as count FROM ReschedulingRequest WHERE status = 'rejected' AND strftime('%Y-%m', reviewedAt) = strftime('%Y-%m', 'now')") as any)?.count, 0)
      dataUsed.approvedThisMonth = approvedThisMonth
      dataUsed.rejectedThisMonth = rejectedThisMonth

      const reasonCategoryDist = (query("SELECT reasonCategory, COUNT(*) as count FROM ReschedulingRequest WHERE status = 'rejected' GROUP BY reasonCategory ORDER BY count DESC").results || []) as any[]
      dataUsed.rejectionReasons = reasonCategoryDist
    }

    // "average" / "processing time" / "processing" → processing metrics
    if (/\b(average|avg|processing|time|متوسط|وقت المعالجة|معالجة)\b/.test(lowerMsg)) {
      const avgProcessing = (query(`
        SELECT COALESCE(AVG(CAST((julianday(reviewedAt) - julianday(createdAt)) AS REAL)), 0) as avgDays,
               COALESCE(MIN(CAST((julianday(reviewedAt) - julianday(createdAt)) AS REAL)), 0) as minDays,
               COALESCE(MAX(CAST((julianday(reviewedAt) - julianday(createdAt)) AS REAL)), 0) as maxDays
        FROM ReschedulingRequest WHERE reviewedAt IS NOT NULL AND status NOT IN ('pending', 'under_review')
      `).results?.[0] || {}) as any
      dataUsed.avgProcessingDays = Math.round(toNum(avgProcessing.avgDays, 0))
      dataUsed.minProcessingDays = Math.round(toNum(avgProcessing.minDays, 0))
      dataUsed.maxProcessingDays = Math.round(toNum(avgProcessing.maxDays, 0))

      const avgInstallment = toNum((queryFirst("SELECT AVG(monthlyInstallment) as avg FROM HousingLoan WHERE status = 'active'") as any)?.avg, 0)
      dataUsed.avgInstallment = Math.round(avgInstallment)
    }

    // ── Build AI prompt with gathered data ──────────────────────────
    const modelConfig = resolveAIConfig()

    const systemPrompt = `You are an AI assistant for SZHP (Sheikh Zayed Housing Programme) admin dashboard. You help administrators analyze housing arrears rescheduling data, answer questions about cases, and provide insights. You have access to real-time database statistics. Respond concisely and professionally in the user's language (${isAr ? 'Arabic' : 'English'}). When presenting numbers, format them properly (e.g., AED 1,234,567). If asked about specific cases, mention you can help find them but cannot access individual case details without a case ID. Keep responses focused and actionable. Use bullet points for multiple items.`

    const userPrompt = `Based on this real-time database data: ${JSON.stringify(dataUsed)}

User question: ${message}

Provide a clear, concise answer based on the data above. If the data doesn't fully answer the question, mention what information is available and suggest what additional queries might help.`

    // Build messages array with conversation context
    const chatMessages: ChatMessage[] = []

    // Add conversation context (last 6 messages from history)
    if (Array.isArray(context)) {
      const recentContext = context.slice(-6)
      for (const msg of recentContext) {
        if (msg.role && msg.content) {
          chatMessages.push({ role: msg.role as 'user' | 'assistant', content: msg.content })
        }
      }
    }

    // Add system prompt and user message
    chatMessages.push({ role: 'system' as any, content: systemPrompt })
    chatMessages.push({ role: 'user', content: userPrompt })

    const completion = await chatCompletion(chatMessages, resolveAIConfig())

    // Filter dataUsed for frontend display (only include key metrics)
    const displayData: Record<string, any> = {}
    const simpleKeys = ['totalRequests', 'pendingCount', 'approvedCount', 'rejectedCount', 'approvalRate',
      'highRiskCount', 'avgInstallment', 'totalArrears', 'totalLoans', 'totalOutstanding']
    for (const key of simpleKeys) {
      if (dataUsed[key] !== undefined) displayData[key] = dataUsed[key]
    }

    return c.json({ response: completion.content, dataUsed: displayData })
  } catch (error: any) {
    console.error('Admin chatbot error:', error)
    return c.json({ error: 'Chatbot error', message: error.message }, 500)
  }
})

// ── Customer Chatbot Route ──────────────────────────────────────────
app.post('/api/customer-chatbot', async (c) => {
  try {
    const { message, context, language } = await c.req.json().catch(() => ({})) as { message?: string; context?: any; language?: string }
    if (!message) return c.json({ error: 'Message required' }, 400)

    const isAr = language === 'ar'
    const systemPrompt = `You are an AI assistant for SZHP (Sheikh Zayed Housing Programme) / MOEI (Ministry of Energy and Infrastructure) UAE. You help citizens with questions about housing arrears rescheduling, eligibility criteria, required documents, and application processes. Be helpful, accurate, and professional. Respond in ${isAr ? 'Arabic' : 'English'}. Keep responses concise and relevant. If you don't know something, direct the citizen to contact SZHP directly.`

    const completion = await chatCompletion(
      [{ role: 'system', content: systemPrompt }, { role: 'user', content: message }],
      resolveAIConfig()
    )

    return c.json({ response: completion.content })
  } catch (error: any) {
    console.error('Customer chatbot error:', error)
    return c.json({ response: 'Sorry, I could not process your request. Please try again later.' }, 500)
  }
})

// ── 404 Handler ─────────────────────────────────────────────────────
app.notFound((c) => {
  return c.json({ error: 'Not found', path: c.req.path }, 404)
})

// ── Start Server ────────────────────────────────────────────────────
const server = Bun.serve({
  port: PORT,
  fetch: app.fetch,
})

console.log(`🚀 SZHP Worker API running on http://localhost:${PORT}`)
console.log(`📊 Dashboard: http://localhost:${PORT}/api/dashboard`)
console.log(`🔑 Auth: http://localhost:${PORT}/api/auth/seed-admin`)
console.log(`📦 Using shared modules from src/worker/lib/ and src/worker/middleware/`)
