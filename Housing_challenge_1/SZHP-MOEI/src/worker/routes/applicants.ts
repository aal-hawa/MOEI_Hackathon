/**
 * Applicants Routes
 * GET /api/applicants, POST /api/applicants
 */

import { Hono } from 'hono'
import type { Env } from '../types'
import { DbClient } from '../db/queries'
import { requireAuthMiddleware, requireAdminAuthMiddleware } from '../middleware/auth'
import { generateId } from '../lib/utils'

const applicants = new Hono<{ Bindings: Env; Variables: { auth: any; db: DbClient } }>()

// GET /api/applicants
applicants.get('/', requireAuthMiddleware, async (c) => {
  const db = c.get('db')
  try {
    const page = parseInt(c.req.query('page') || '1')
    const limit = parseInt(c.req.query('limit') || '20')
    const search = c.req.query('search') || ''
    const employerType = c.req.query('employerType') || ''
    const offset = (page - 1) * limit

    let sql = 'SELECT * FROM Applicant'
    const conditions: string[] = []
    const params: any[] = []

    if (search) { conditions.push('(nameEn LIKE ? OR nameAr LIKE ? OR emiratesId LIKE ? OR email LIKE ? OR phone LIKE ?)'); params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`) }
    if (employerType) { conditions.push('employerType = ?'); params.push(employerType) }

    if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ')
    sql += ' ORDER BY createdAt DESC LIMIT ? OFFSET ?'
    params.push(limit, offset)

    const result = await db.query(sql, ...params)
    const totalResult = await db.queryFirst('SELECT COUNT(*) as count FROM Applicant')
    const total = (totalResult as any)?.count || 0

    return c.json({ data: result.results || [], pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } })
  } catch (error) {
    console.error('Error fetching applicants:', error)
    return c.json({ error: 'Failed to fetch applicants' }, 500)
  }
})

// POST /api/applicants
applicants.post('/', requireAdminAuthMiddleware, async (c) => {
  const db = c.get('db')
  try {
    const body = await c.req.json()
    const { emiratesId, nameAr, nameEn, phone, email, monthlyIncome, employer, employerType, familySize, isCitizen, hasFamilyBook } = body

    if (!emiratesId || !nameAr || !phone) return c.json({ error: 'Missing required fields: emiratesId, nameAr, phone' }, 400)

    const existing: any = await db.findApplicantByEmiratesId(emiratesId)
    if (existing) return c.json({ error: 'Applicant already exists' }, 409)

    const id = generateId()
    await db.createApplicant({
      id, emiratesId, nameAr, nameEn: nameEn || null, phone,
      email: email || null, monthlyIncome: parseFloat(monthlyIncome) || 0,
      employer: employer || null, employerType: employerType || null,
      familySize: parseInt(familySize) || 1,
      isCitizen: isCitizen !== false ? 1 : 0,
      hasFamilyBook: hasFamilyBook !== false ? 1 : 0,
    })

    const applicant: any = await db.findApplicantById(id)
    return c.json({ data: applicant }, 201)
  } catch (error) {
    console.error('Error creating applicant:', error)
    return c.json({ error: 'Failed to create applicant' }, 500)
  }
})

export default applicants
