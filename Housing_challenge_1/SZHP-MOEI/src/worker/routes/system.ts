/**
 * System Routes
 * GET /api/system/hardware, POST /api/system/generate-mock
 */

import { Hono } from 'hono'
import type { Env } from '../types'
import { DbClient } from '../db/queries'
import { requireAdminAuthMiddleware } from '../middleware/auth'
import { generateId } from '../lib/utils'
import { toNum } from '../lib/utils'

const system = new Hono<{ Bindings: Env; Variables: { auth: any; db: DbClient } }>()

// GET /api/system/hardware
system.get('/hardware', requireAdminAuthMiddleware, async (c) => {
  return c.json({
    platform: 'cloudflare-workers',
    runtime: 'workerd',
    database: 'D1 (SQLite)',
    storage: 'R2',
    cache: 'KV',
    region: 'auto',
    timestamp: new Date().toISOString(),
  })
})

// POST /api/system/generate-mock
system.post('/generate-mock', requireAdminAuthMiddleware, async (c) => {
  const db = c.get('db')
  try {
    const body = await c.req.json() || {}
    const employerTypes = ['government', 'semi-government', 'private']
    const loanTypes = ['grant', 'loan', 'maintenance']
    const reasonCategories = ['job_loss', 'medical', 'salary_cut', 'divorce', 'retirement', 'other']

    const applicantId = generateId()
    const loanId = generateId()
    const arrearId = generateId()
    const requestId = generateId()

    const monthlyIncome = body.monthlyIncome || (10000 + Math.random() * 40000)
    const originalAmount = body.originalAmount || (100000 + Math.random() * 700000)
    const remainingBalance = originalAmount * (0.3 + Math.random() * 0.5)
    const monthlyInstallment = remainingBalance / (60 + Math.random() * 240)
    const totalOverdue = monthlyInstallment * (1 + Math.floor(Math.random() * 8))
    const missedMonths = 1 + Math.floor(Math.random() * 8)
    const delayDays = missedMonths * 30 + Math.floor(Math.random() * 30)
    const loanDurationMonths = 120 + Math.floor(Math.random() * 240)
    const elapsedMonths = Math.floor(loanDurationMonths * (0.2 + Math.random() * 0.6))
    const employerType = body.employerType || employerTypes[Math.floor(Math.random() * employerTypes.length)]
    const reasonCategory = body.reasonCategory || reasonCategories[Math.floor(Math.random() * reasonCategories.length)]
    const requestedDurationMonths = body.requestedDurationMonths || (60 + Math.floor(Math.random() * 120))

    await db.createApplicant({
      id: applicantId, emiratesId: `784${Date.now()}${Math.floor(Math.random() * 1000)}`,
      nameAr: `مواطن ${Math.floor(Math.random() * 1000)}`, nameEn: `Citizen ${Math.floor(Math.random() * 1000)}`,
      phone: `05${Math.floor(Math.random() * 100000000)}`, email: null,
      monthlyIncome, employer: `${employerType} Dept`, employerType,
      familySize: 2 + Math.floor(Math.random() * 8), isCitizen: 1, hasFamilyBook: 1,
    })

    await db.createLoan({
      id: loanId, applicantId, originalAmount, remainingBalance, monthlyInstallment,
      loanDurationMonths, elapsedMonths, interestRate: 0,
      loanType: loanTypes[Math.floor(Math.random() * loanTypes.length)], status: 'active',
    })

    await db.createArrear({
      id: arrearId, loanId, missedMonths, totalOverdue, delayDays, reason: reasonCategory,
    })

    await db.createRequest({
      id: requestId, applicantId, loanId, requestedDurationMonths,
      reason: `Hardship due to ${reasonCategory}`, reasonCategory,
      supportingDocuments: '[]', uploadedFiles: '[]', priority: ['job_loss', 'medical'].includes(reasonCategory) ? 'urgent' : 'normal',
      notes: null, status: 'pending',
    })

    const request: any = await db.findRequestById(requestId)
    return c.json({ data: request }, 201)
  } catch (error) {
    console.error('Generate mock error:', error)
    return c.json({ error: 'Failed to generate mock case' }, 500)
  }
})

export default system
