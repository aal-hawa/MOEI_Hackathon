/**
 * Employee Routes
 * GET /api/employees, PUT /api/employees, DELETE /api/employees, GET/PATCH /api/employees/:id
 */

import { Hono } from 'hono'
import type { Env } from '../types'
import { DbClient } from '../db/queries'
import { requirePermission, hasPermission, getDefaultPermissions } from '../middleware/auth'
import { generateId } from '../lib/utils'

const employees = new Hono<{ Bindings: Env; Variables: { auth: any; db: DbClient } }>()

// GET /api/employees
employees.get('/', requirePermission('employees.view'), async (c) => {
  const db = c.get('db')
  try {
    const role = c.req.query('role')
    const department = c.req.query('department')
    const isActive = c.req.query('isActive')
    const search = c.req.query('search')
    const limit = parseInt(c.req.query('limit') || '50')
    const offset = parseInt(c.req.query('offset') || '0')

    let sql = `SELECT id, email, firstnameEN, lastnameEN, firstnameAR, lastnameAR, fullnameEN, fullnameAR, role, department, isActive, permissions, lastLoginAt, createdAt, updatedAt, loginAttempts, lockedUntil, twoFactorEnabled FROM User WHERE role != 'citizen'`
    const params: any[] = []

    if (role) { sql += ' AND role = ?'; params.push(role) }
    if (department) { sql += ' AND department = ?'; params.push(department) }
    if (isActive !== null && isActive !== undefined && isActive !== '') { sql += ' AND isActive = ?'; params.push(isActive === 'true' ? 1 : 0) }
    if (search) { sql += ' AND (firstnameEN LIKE ? OR lastnameEN LIKE ? OR email LIKE ? OR firstnameAR LIKE ? OR lastnameAR LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`) }

    sql += ' ORDER BY createdAt DESC LIMIT ? OFFSET ?'
    params.push(limit, offset)

    const result = await db.query(sql, ...params)
    const totalResult = await db.queryFirst("SELECT COUNT(*) as count FROM User WHERE role != 'citizen'")
    const total = (totalResult as any)?.count || 0

    const usersWithLoginInfo = await Promise.all(
      (result.results || []).map(async (row: any) => {
        const lastLogin: any = await db.findLastLoginByUserId(row.id)
        return {
          ...row,
          permissions: JSON.parse(row.permissions || '[]'),
          lastLogin: lastLogin ? { loginAt: lastLogin.loginAt, ipAddress: lastLogin.ipAddress, authMethod: lastLogin.authMethod } : null,
          isLocked: row.lockedUntil ? new Date(row.lockedUntil) > new Date() : false,
        }
      })
    )

    return c.json({ success: true, data: usersWithLoginInfo, pagination: { total, limit, offset, hasMore: offset + limit < total } })
  } catch (error) {
    console.error('List employees error:', error)
    return c.json({ error: 'Failed to fetch employees' }, 500)
  }
})

// PUT /api/employees
employees.put('/', requirePermission('employees.manage'), async (c) => {
  const db = c.get('db')
  const auth = c.get('auth')
  try {
    const body = await c.req.json()
    const { userId, role, department, isActive, permissions } = body
    if (!userId) return c.json({ error: 'userId is required' }, 400)

    const targetUser: any = await db.findUserById(userId)
    if (!targetUser) return c.json({ error: 'User not found' }, 404)
    if (targetUser.role === 'citizen') return c.json({ error: 'Cannot modify citizen accounts' }, 400)

    const updateData: Record<string, unknown> = {}
    const changes: Record<string, { previous: unknown; new: unknown }> = {}

    if (role !== undefined && role !== targetUser.role) {
      updateData.role = role
      updateData.permissions = JSON.stringify(getDefaultPermissions(role))
      changes.role = { previous: targetUser.role, new: role }
    }
    if (department !== undefined && department !== targetUser.department) { updateData.department = department; changes.department = { previous: targetUser.department, new: department } }
    if (isActive !== undefined && isActive !== !!targetUser.isActive) { updateData.isActive = isActive ? 1 : 0; changes.isActive = { previous: !!targetUser.isActive, new: isActive } }
    if (permissions !== undefined && role === undefined) { updateData.permissions = JSON.stringify(permissions); changes.permissions = { previous: targetUser.permissions, new: updateData.permissions } }

    if (Object.keys(updateData).length === 0) return c.json({ error: 'No changes to update' }, 400)

    await db.updateUser(userId, updateData)
    await db.createAuditLog({
      id: generateId(), action: Object.keys(changes).includes('role') ? 'role_changed' : 'user_updated',
      performedBy: `employee:${auth.user.email || auth.user.id}`,
      details: JSON.stringify({ targetUserId: userId, changes }),
      category: 'user_management', performedByUserId: auth.user.id, affectedRecord: `User:${userId}`,
      previousValue: JSON.stringify(Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v.previous]))),
      newValue: JSON.stringify(Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v.new]))),
      ipAddress: c.req.header('x-forwarded-for') || null, userAgent: c.req.header('user-agent') || null,
    })

    const updatedUser: any = await db.findUserById(userId)
    return c.json({ success: true, user: { ...updatedUser, permissions: JSON.parse(updatedUser.permissions || '[]'), isActive: !!updatedUser.isActive } })
  } catch (error) {
    console.error('Update employee error:', error)
    return c.json({ error: 'Failed to update employee' }, 500)
  }
})

// DELETE /api/employees
employees.delete('/', requirePermission('employees.manage'), async (c) => {
  const db = c.get('db')
  const auth = c.get('auth')
  try {
    const userId = c.req.query('userId')
    if (!userId) return c.json({ error: 'userId is required' }, 400)
    if (auth.user.role !== 'superadmin') return c.json({ error: 'Only superadmin can deactivate accounts' }, 403)

    const targetUser: any = await db.findUserById(userId)
    if (!targetUser) return c.json({ error: 'User not found' }, 404)
    if (targetUser.role === 'citizen') return c.json({ error: 'Cannot deactivate citizen accounts' }, 400)
    if (!targetUser.isActive) return c.json({ error: 'Already deactivated' }, 400)

    await db.updateUser(userId, { isActive: 0 })
    await db.deleteSessionsByUser(userId)
    await db.createAuditLog({
      id: generateId(), action: 'user_deactivated', performedBy: `employee:${auth.user.email || auth.user.id}`,
      details: JSON.stringify({ targetUserId: userId, targetUserRole: targetUser.role }),
      category: 'user_management', performedByUserId: auth.user.id, affectedRecord: `User:${userId}`,
      previousValue: JSON.stringify({ isActive: true }), newValue: JSON.stringify({ isActive: false }),
      ipAddress: c.req.header('x-forwarded-for') || null, userAgent: c.req.header('user-agent') || null,
    })

    return c.json({ success: true, message: 'Employee deactivated' })
  } catch (error) {
    console.error('Deactivate employee error:', error)
    return c.json({ error: 'Failed to deactivate employee' }, 500)
  }
})

// GET /api/employees/:id
employees.get('/:id', requirePermission('employees.view'), async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')
  try {
    const user: any = await db.findUserById(id)
    if (!user || user.role === 'citizen') return c.json({ error: 'Employee not found' }, 404)
    return c.json({ success: true, data: { ...user, permissions: JSON.parse(user.permissions || '[]'), isActive: !!user.isActive } })
  } catch (error) {
    return c.json({ error: 'Failed to fetch employee' }, 500)
  }
})

// PATCH /api/employees/:id
employees.patch('/:id', requirePermission('employees.manage'), async (c) => {
  const db = c.get('db')
  const auth = c.get('auth')
  const id = c.req.param('id')
  try {
    const body = await c.req.json()
    const updateData: Record<string, unknown> = {}
    if (body.role) { updateData.role = body.role; updateData.permissions = JSON.stringify(getDefaultPermissions(body.role)) }
    if (body.department !== undefined) updateData.department = body.department
    if (body.isActive !== undefined) updateData.isActive = body.isActive ? 1 : 0
    if (body.permissions && !body.role) updateData.permissions = JSON.stringify(body.permissions)
    if (Object.keys(updateData).length === 0) return c.json({ error: 'No changes' }, 400)

    await db.updateUser(id, updateData)
    const updatedUser: any = await db.findUserById(id)
    return c.json({ success: true, user: { ...updatedUser, permissions: JSON.parse(updatedUser.permissions || '[]') } })
  } catch (error) {
    return c.json({ error: 'Failed to update employee' }, 500)
  }
})

export default employees
