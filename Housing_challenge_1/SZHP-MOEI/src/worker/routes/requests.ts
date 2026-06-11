/**
 * Rescheduling Request Routes
 * GET /api/requests, POST /api/requests, GET /api/requests/:id, PATCH /api/requests/:id, POST /api/requests/:id/assess
 */

import { Hono } from 'hono'
import type { Env } from '../types'
import { DbClient } from '../db/queries'
import { requireAuthMiddleware, requirePermission } from '../middleware/auth'
import { generateId, toNum } from '../lib/utils'
import { runRequestAssessment } from '../lib/request-assessment'

const requests = new Hono<{ Bindings: Env; Variables: { auth: any; db: DbClient } }>()

// GET /api/requests
requests.get('/', requireAuthMiddleware, async (c) => {
  const db = c.get('db')
  const auth = c.get('auth')

  try {
    const page = parseInt(c.req.query('page') || '1')
    const limit = parseInt(c.req.query('limit') || '20')
    const status = c.req.query('status') || ''
    const priority = c.req.query('priority') || ''
    const reasonCategory = c.req.query('reasonCategory') || ''
    const search = c.req.query('search') || ''
    const offset = (page - 1) * limit

    const adminRoles = ['employee', 'reviewer', 'manager', 'admin', 'superadmin']
    const isAdminRole = adminRoles.includes(auth.user.role)

    let sql = `SELECT r.*, a.nameEn as applicantNameEn, a.nameAr as applicantNameAr, a.emiratesId as applicantEmiratesId,
      a.monthlyIncome as applicantMonthlyIncome, a.employerType as applicantEmployerType, a.familySize as applicantFamilySize, a.phone as applicantPhone,
      l.originalAmount as loanOriginalAmount, l.remainingBalance as loanRemainingBalance,
      l.monthlyInstallment as loanMonthlyInstallment, l.loanType as loanLoanType, l.status as loanStatus,
      ar.id as arrearId, ar.missedMonths, ar.totalOverdue, ar.delayDays as arrearDelayDays, ar.reason as arrearReason,
      ai.id as assessmentId, ai.riskScore, ai.riskLevel, ai.eligibilityStatus, ai.recommendedAmount,
      ai.recommendedDuration, ai.recommendedInstallment, ai.proposedDeductionRate, ai.requiresHumanReview
      FROM ReschedulingRequest r
      LEFT JOIN Applicant a ON r.applicantId = a.id
      LEFT JOIN HousingLoan l ON r.loanId = l.id
      LEFT JOIN Arrear ar ON l.id = ar.loanId
      LEFT JOIN AIAssessment ai ON r.id = ai.requestId`

    const conditions: string[] = []
    const params: any[] = []

    if (!isAdminRole) {
      const userRecord: any = await db.findUserById(auth.user.id)
      if (userRecord?.emiratesId) {
        conditions.push('a.emiratesId = ?')
        params.push(userRecord.emiratesId)
      }
    }

    if (status) { conditions.push('r.status = ?'); params.push(status) }
    if (priority) { conditions.push('r.priority = ?'); params.push(priority) }
    if (reasonCategory) { conditions.push('r.reasonCategory = ?'); params.push(reasonCategory) }
    if (search) {
      conditions.push('(a.nameEn LIKE ? OR a.nameAr LIKE ? OR a.emiratesId LIKE ? OR r.reason LIKE ?)')
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`)
    }

    if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ')
    sql += ' ORDER BY r.createdAt DESC LIMIT ? OFFSET ?'
    params.push(limit, offset)

    const result = await db.query(sql, ...params)
    const totalResult = await db.queryFirst("SELECT COUNT(*) as count FROM ReschedulingRequest")
    const total = (totalResult as any)?.count || 0

    const transformedRequests = (result.results || []).map((row: any) => {
      const { applicantNameEn, applicantNameAr, applicantEmiratesId, applicantMonthlyIncome, applicantEmployerType, applicantFamilySize, applicantPhone, loanOriginalAmount, loanRemainingBalance, loanMonthlyInstallment, loanLoanType, loanStatus, arrearId, missedMonths, totalOverdue, arrearDelayDays, arrearReason, assessmentId, riskScore, riskLevel, eligibilityStatus, recommendedAmount, recommendedDuration, recommendedInstallment, proposedDeductionRate, requiresHumanReview, ...req } = row
      return {
        ...req,
        applicant: { id: req.applicantId, nameEn: applicantNameEn, nameAr: applicantNameAr, emiratesId: applicantEmiratesId, monthlyIncome: applicantMonthlyIncome, employerType: applicantEmployerType, familySize: applicantFamilySize, phone: applicantPhone },
        loan: { id: req.loanId, originalAmount: loanOriginalAmount, remainingBalance: loanRemainingBalance, monthlyInstallment: loanMonthlyInstallment, loanType: loanLoanType, status: loanStatus },
        arrear: arrearId ? { id: arrearId, missedMonths, totalOverdue, delayDays: arrearDelayDays, reason: arrearReason } : null,
        assessment: assessmentId ? { id: assessmentId, riskScore, riskLevel, eligibilityStatus, recommendedAmount, recommendedDuration, recommendedInstallment, proposedDeductionRate, requiresHumanReview: !!requiresHumanReview } : null,
      }
    })

    return c.json(transformedRequests)
  } catch (error) {
    console.error('Error fetching requests:', error)
    return c.json({ error: 'Failed to fetch requests' }, 500)
  }
})

// POST /api/requests
requests.post('/', async (c) => {
  const db = new DbClient(c.env.DB)
  try {
    const body = await c.req.json()
    const validCategories = ['job_loss', 'medical', 'salary_cut', 'divorce', 'retirement', 'other', 'reschedule_arrears', 'postpone_instalment', 'reduce_instalment']
    const validPriorities = ['normal', 'urgent', 'critical']

    let applicantId: string, loanId: string, requestedDurationMonths: number
    let reason: string | null, reasonCategory: string, supportingDocuments: string | string[]
    let priority: string, notes: string | null = null

    if (body.applicant && body.loan && body.request) {
      const { applicant, loan, request: reqData } = body
      if (!applicant.emiratesId || !applicant.nameAr || !applicant.phone) return c.json({ error: 'Missing required applicant fields' }, 400)
      if (!reqData.reasonCategory) return c.json({ error: 'Missing required request fields: reasonCategory' }, 400)
      if (!validCategories.includes(reqData.reasonCategory)) return c.json({ error: 'Invalid reason category' }, 400)

      const reqPriority = reqData.priority || 'normal'
      if (!validPriorities.includes(reqPriority)) return c.json({ error: 'Invalid priority' }, 400)

      let applicantRecord: any = await db.findApplicantByEmiratesId(applicant.emiratesId)
      if (!applicantRecord) {
        const aId = generateId()
        await db.createApplicant({
          id: aId, emiratesId: applicant.emiratesId, nameAr: applicant.nameAr,
          nameEn: applicant.nameEn || null, phone: applicant.phone, email: applicant.email || null,
          monthlyIncome: toNum(applicant.monthlyIncome), employer: applicant.employer || null,
          employerType: applicant.employerType || null, familySize: toNum(applicant.familySize, 1),
          isCitizen: applicant.isCitizen !== false ? 1 : 0, hasFamilyBook: applicant.hasFamilyBook !== false ? 1 : 0,
        })
        applicantRecord = await db.findApplicantById(aId)
      } else {
        await db.updateApplicant(applicantRecord.id, {
          nameAr: applicant.nameAr, phone: applicant.phone,
          monthlyIncome: toNum(applicant.monthlyIncome), familySize: toNum(applicant.familySize, 1),
          ...(applicant.nameEn ? { nameEn: applicant.nameEn } : {}),
        })
      }

      const lId = generateId()
      await db.createLoan({
        id: lId, applicantId: applicantRecord.id,
        originalAmount: toNum(loan?.originalAmount), remainingBalance: toNum(loan?.remainingBalance),
        monthlyInstallment: toNum(loan?.monthlyInstallment), loanDurationMonths: toNum(loan?.loanDurationMonths),
        elapsedMonths: toNum(loan?.elapsedMonths), interestRate: 0,
        loanType: loan?.loanType || 'housing_loan', status: 'active',
      })

      const totalOverdue = toNum(loan?.totalOverdue)
      const missedMonths = toNum(loan?.missedMonths)
      const delayDays = toNum(loan?.delayDays)
      if (totalOverdue > 0 || missedMonths > 0 || delayDays > 0) {
        await db.createArrear({ id: generateId(), loanId: lId, missedMonths, totalOverdue, delayDays, reason: reqData.reasonCategory })
      }

      applicantId = applicantRecord.id; loanId = lId
      requestedDurationMonths = toNum(reqData.requestedDurationMonths, 120)
      reason = reqData.reason || null; reasonCategory = reqData.reasonCategory
      supportingDocuments = reqData.supportingDocuments || []; priority = reqPriority
      notes = reqData.notes || null
    } else if (body.applicant && body.request) {
      const { applicant, request: reqData } = body
      if (!applicant.emiratesId || !applicant.nameAr || !applicant.phone) return c.json({ error: 'Missing required applicant fields' }, 400)
      if (!reqData.reasonCategory) return c.json({ error: 'Missing required request fields: reasonCategory' }, 400)

      let applicantRecord: any = await db.findApplicantByEmiratesId(applicant.emiratesId)
      if (!applicantRecord) {
        const aId = generateId()
        await db.createApplicant({
          id: aId, emiratesId: applicant.emiratesId, nameAr: applicant.nameAr,
          nameEn: applicant.nameEn || null, phone: applicant.phone, email: applicant.email || null,
          monthlyIncome: toNum(applicant.monthlyIncome), employer: applicant.employer || null,
          employerType: applicant.employerType || null, familySize: toNum(applicant.familySize, 1),
          isCitizen: applicant.isCitizen !== false ? 1 : 0, hasFamilyBook: applicant.hasFamilyBook !== false ? 1 : 0,
        })
        applicantRecord = await db.findApplicantById(aId)
      }

      const lId = generateId()
      await db.createLoan({ id: lId, applicantId: applicantRecord.id, originalAmount: 0, remainingBalance: 0, monthlyInstallment: 0, loanDurationMonths: 0, elapsedMonths: 0, interestRate: 0, loanType: 'housing_loan', status: 'active' })

      applicantId = applicantRecord.id; loanId = lId
      requestedDurationMonths = toNum(reqData.requestedDurationMonths, 120)
      reason = reqData.reason || null; reasonCategory = reqData.reasonCategory
      supportingDocuments = reqData.supportingDocuments || []; priority = reqData.priority || 'normal'
      notes = reqData.notes || null
    } else {
      ({ applicantId, loanId, requestedDurationMonths, reason, reasonCategory, supportingDocuments, priority = 'normal' } = body)
      if (!applicantId || !loanId || !requestedDurationMonths || !reasonCategory) return c.json({ error: 'Missing required fields' }, 400)
    }

    const reqId = generateId()
    await db.createRequest({
      id: reqId, applicantId, loanId, requestedDurationMonths: toNum(requestedDurationMonths),
      reason: reason || null, reasonCategory,
      supportingDocuments: JSON.stringify(supportingDocuments || []),
      uploadedFiles: JSON.stringify((body.request?.uploadedFiles || body.uploadedFiles) || []),
      priority, notes: notes || null, status: 'pending',
    })

    await db.createAuditLog({
      id: generateId(), requestId: reqId, action: 'created', performedBy: 'system',
      details: JSON.stringify({ message: 'Rescheduling request created', reasonCategory, requestedDurationMonths: toNum(requestedDurationMonths) }),
    })

    // Auto-adjust priority
    let autoPriority = priority
    if (['job_loss', 'medical'].includes(reasonCategory)) autoPriority = 'urgent'
    const arrear: any = await db.queryFirst("SELECT * FROM Arrear WHERE loanId = ? LIMIT 1", loanId)
    if (arrear && arrear.delayDays > 180) autoPriority = 'critical'
    if (autoPriority !== priority) await db.updateRequest(reqId, { priority: autoPriority })

    let assessmentResult: Awaited<ReturnType<typeof runRequestAssessment>> | null = null
    try {
      assessmentResult = await runRequestAssessment(c.env, db, reqId, {
        performedBy: 'system:auto_assessment',
        replaceExisting: true,
      })
    } catch (assessmentError) {
      console.error('Auto-assessment failed:', assessmentError)
      await db.createAuditLog({
        id: generateId(), requestId: reqId, action: 'assessment_failed', performedBy: 'system:auto_assessment',
        details: JSON.stringify({ message: 'Automatic AI assessment failed; request remains pending manual assessment' }),
        category: 'request',
      })
    }

    const createdRequest: any = await db.findRequestById(reqId)
    const assessment: any = await db.findAssessmentByRequestId(reqId)
    return c.json({ data: createdRequest, assessment, autoAssessment: assessmentResult ? { completed: true, requiresHumanReview: !!assessment?.requiresHumanReview } : { completed: false } }, 201)
  } catch (error) {
    console.error('Error creating request:', error)
    return c.json({ error: 'Failed to create request' }, 500)
  }
})

// GET /api/requests/:id
requests.get('/:id', requireAuthMiddleware, async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')

  try {
    const req: any = await db.findRequestById(id)
    if (!req) return c.json({ error: 'Request not found' }, 404)

    const applicant: any = await db.findApplicantById(req.applicantId)
    const loan: any = await db.findLoanById(req.loanId)
    const arrears = loan ? await db.findArrearsByLoanId(loan.id) : { results: [] }
    const assessment: any = await db.findAssessmentByRequestId(id)

    return c.json({
      ...req,
      applicant: applicant || null,
      loan: loan || null,
      arrear: (arrears.results?.[0] as any) || null,
      assessment: assessment || null,
    })
  } catch (error) {
    console.error('Error fetching request:', error)
    return c.json({ error: 'Failed to fetch request' }, 500)
  }
})

// PATCH /api/requests/:id
requests.patch('/:id', requirePermission('cases'), async (c) => {
  const db = c.get('db')
  const auth = c.get('auth')
  const id = c.req.param('id')

  try {
    const body = await c.req.json()
    const existing: any = await db.findRequestById(id)
    if (!existing) return c.json({ error: 'Request not found' }, 404)

    const updateData: Record<string, unknown> = {}
    if (body.status) updateData.status = body.status
    if (body.priority) updateData.priority = body.priority
    if (body.notes !== undefined) updateData.notes = body.notes
    if (body.reviewedBy !== undefined) updateData.reviewedBy = body.reviewedBy
    if (body.reviewedAt !== undefined) updateData.reviewedAt = body.reviewedAt
    if (body.isViewed !== undefined) { updateData.isViewed = body.isViewed ? 1 : 0; updateData.firstViewedAt = new Date().toISOString() }

    if (Object.keys(updateData).length === 0) return c.json({ error: 'No changes to update' }, 400)

    await db.updateRequest(id, updateData)

    await db.createAuditLog({
      id: generateId(), requestId: id, action: 'modified',
      performedBy: `employee:${auth.user.email || auth.user.id}`,
      details: JSON.stringify({ message: 'Request updated', changes: Object.keys(updateData) }),
      category: 'request', performedByUserId: auth.user.id,
    })

    const updated: any = await db.findRequestById(id)
    return c.json({ data: updated })
  } catch (error) {
    console.error('Error updating request:', error)
    return c.json({ error: 'Failed to update request' }, 500)
  }
})

// POST /api/requests/:id/assess
requests.post('/:id/assess', requirePermission('cases'), async (c) => {
  const db = c.get('db')
  const auth = c.get('auth')
  const id = c.req.param('id')

  try {
    const result = await runRequestAssessment(c.env, db, id, {
      performedBy: `employee:${auth.user.email || auth.user.id}`,
      performedByUserId: auth.user.id,
      replaceExisting: true,
    })
    return c.json({
      data: {
        assessment: result.assessment,
        rulesEngine: result.rulesEngine,
        moeiAnalysis: result.moeiAnalysis,
        llmAnalysis: result.llmAnalysis,
      },
    }, 201)
  } catch (error) {
    console.error('Error running assessment:', error)
    return c.json({ error: 'Failed to run assessment' }, 500)
  }
})

export default requests
