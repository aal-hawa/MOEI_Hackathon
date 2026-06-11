/**
 * Audit Trail Routes
 * GET /api/audit-trail, POST /api/audit-trail, GET /api/audit-trail/stats
 */

import { Hono } from 'hono'
import type { Env } from '../types'
import { DbClient } from '../db/queries'
import { requirePermission, requireAdminAuthMiddleware } from '../middleware/auth'
import { generateId } from '../lib/utils'

const auditTrail = new Hono<{ Bindings: Env; Variables: { auth: any; db: DbClient } }>()

// GET /api/audit-trail/stats
auditTrail.get('/stats', requirePermission('audit.view'), async (c) => {
  const db = c.get('db')
  try {
    const totalResult = await db.queryFirst("SELECT COUNT(*) as count FROM AuditLog")
    const todayResult = await db.queryFirst("SELECT COUNT(*) as count FROM AuditLog WHERE date(timestamp) = date('now')")
    const categoryResult = await db.query("SELECT category, COUNT(*) as count FROM AuditLog GROUP BY category")
    return c.json({ total: (totalResult as any)?.count || 0, today: (todayResult as any)?.count || 0, byCategory: (categoryResult.results || []).map((r: any) => ({ category: r.category, count: r.count })) })
  } catch (error) {
    return c.json({ error: 'Failed to fetch audit stats' }, 500)
  }
})

// GET /api/audit-trail
auditTrail.get('/', requirePermission('audit.view'), async (c) => {
  const db = c.get('db')
  try {
    const category = c.req.query('category')
    const action = c.req.query('action')
    const performedByUserId = c.req.query('performedByUserId')
    const dateFrom = c.req.query('dateFrom')
    const dateTo = c.req.query('dateTo')
    const limit = Math.min(parseInt(c.req.query('limit') || '50'), 200)
    const offset = parseInt(c.req.query('offset') || '0')
    const search = c.req.query('search')

    let sql = `SELECT al.*, u.email as userEmail, u.fullnameEN as userFullnameEN, u.fullnameAR as userFullnameAR, u.role as userRole
      FROM AuditLog al LEFT JOIN User u ON al.performedByUserId = u.id`
    const conditions: string[] = []
    const params: any[] = []

    if (category) { conditions.push('al.category = ?'); params.push(category) }
    if (action) { conditions.push('al.action = ?'); params.push(action) }
    if (performedByUserId) { conditions.push('al.performedByUserId = ?'); params.push(performedByUserId) }
    if (dateFrom) { conditions.push('al.timestamp >= ?'); params.push(dateFrom) }
    if (dateTo) { conditions.push('al.timestamp <= ?'); params.push(dateTo) }
    if (search) { conditions.push('(al.action LIKE ? OR al.details LIKE ? OR al.performedBy LIKE ? OR al.affectedRecord LIKE ?)'); params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`) }

    if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ')
    sql += ' ORDER BY al.timestamp DESC LIMIT ? OFFSET ?'
    params.push(limit, offset)

    const result = await db.query(sql, ...params)

    const countSql = conditions.length > 0
      ? `SELECT COUNT(*) as count FROM AuditLog WHERE ${conditions.join(' AND ')}`
      : 'SELECT COUNT(*) as count FROM AuditLog'
    const countParams = params.slice(0, -2)
    const totalResult = await db.query(countSql, ...countParams)
    const total = (totalResult as any)?.results?.[0] ? ((totalResult as any).results[0] as any).count : ((totalResult as any)?.count || 0)

    const logs = (result.results || []).map((row: any) => ({
      id: row.id, requestId: row.requestId, action: row.action, performedBy: row.performedBy,
      details: row.details, timestamp: row.timestamp, category: row.category,
      previousValue: row.previousValue, newValue: row.newValue, affectedRecord: row.affectedRecord,
      ipAddress: row.ipAddress, userAgent: row.userAgent, performedByUserId: row.performedByUserId,
      performedByUser: row.performedByUserId ? { id: row.performedByUserId, email: row.userEmail, fullnameEN: row.userFullnameEN, fullnameAR: row.userFullnameAR, role: row.userRole } : null,
    }))

    return c.json({ success: true, data: logs, pagination: { total, limit, offset, hasMore: offset + limit < total } })
  } catch (error) {
    console.error('Get audit trail error:', error)
    return c.json({ error: 'Failed to fetch audit trail' }, 500)
  }
})

// POST /api/audit-trail
auditTrail.post('/', requireAdminAuthMiddleware, async (c) => {
  const db = c.get('db')
  const auth = c.get('auth')
  try {
    const body = await c.req.json()
    const { action, category, details, affectedRecord, previousValue, newValue } = body
    if (!action || !category) return c.json({ error: 'action and category are required' }, 400)

    await db.createAuditLog({
      id: generateId(), action, performedBy: `employee:${auth.user.email || auth.user.id}`,
      details: typeof details === 'string' ? details : JSON.stringify(details || {}),
      category, performedByUserId: auth.user.id, affectedRecord: affectedRecord || null,
      previousValue: previousValue ? (typeof previousValue === 'string' ? previousValue : JSON.stringify(previousValue)) : null,
      newValue: newValue ? (typeof newValue === 'string' ? newValue : JSON.stringify(newValue)) : null,
      ipAddress: c.req.header('x-forwarded-for') || null, userAgent: c.req.header('user-agent') || null,
    })

    return c.json({ success: true }, 201)
  } catch (error) {
    return c.json({ error: 'Failed to create audit log' }, 500)
  }
})

export default auditTrail
