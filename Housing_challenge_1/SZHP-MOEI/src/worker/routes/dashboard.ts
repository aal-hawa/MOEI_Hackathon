/**
 * Dashboard Route
 * GET /api/dashboard
 */

import { Hono } from 'hono'
import type { Env } from '../types'
import { DbClient } from '../db/queries'
import { requireAdminAuthMiddleware } from '../middleware/auth'

const dashboard = new Hono<{ Bindings: Env; Variables: { auth: any; db: DbClient } }>()

dashboard.get('/', requireAdminAuthMiddleware, async (c) => {
  const db = c.get('db')

  try {
    // Status counts
    const statusResult = await db.query("SELECT status, COUNT(*) as count FROM ReschedulingRequest GROUP BY status")
    const byStatus: Record<string, number> = { pending: 0, under_review: 0, ai_assessed: 0, approved: 0, rejected: 0, escalated: 0 }
    for (const row of (statusResult.results || [])) {
      byStatus[(row as any).status] = (row as any).count
    }

    const totalResult = await db.queryFirst("SELECT COUNT(*) as count FROM ReschedulingRequest")
    const totalRequests = (totalResult as any)?.count || 0

    // Risk distribution
    const riskResult = await db.query("SELECT riskLevel, COUNT(*) as count FROM AIAssessment GROUP BY riskLevel")
    const riskMap: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 }
    for (const row of (riskResult.results || [])) {
      riskMap[(row as any).riskLevel] = (row as any).count
    }
    const riskDistribution = Object.entries(riskMap).map(([riskLevel, count]) => ({ riskLevel, count }))

    const statusDistribution = Object.entries(byStatus).map(([status, count]) => ({ status, count }))

    // Avg processing time
    const avgResult = await db.queryFirst("SELECT AVG(processingTimeMs) as avg FROM AIAssessment WHERE processingTimeMs IS NOT NULL")
    const avgProcessingTime = Math.round((avgResult as any)?.avg || 0)

    // Automation rate
    const aiAssessedCount = byStatus.ai_assessed || 0
    const approvedCount = byStatus.approved || 0
    const automationRate = totalRequests > 0 ? ((aiAssessedCount + approvedCount) / totalRequests) * 100 : 0

    // Monthly trend (last 6 months)
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
    const monthlyResult = await db.query(
      "SELECT substr(createdAt, 1, 7) as monthKey, status FROM ReschedulingRequest WHERE createdAt >= ? ORDER BY createdAt ASC",
      sixMonthsAgo.toISOString()
    )
    const monthlyMap: Record<string, { month: string; requests: number; approved: number; rejected: number }> = {}
    for (const row of (monthlyResult.results || [])) {
      const r = row as any
      const monthLabel = r.monthKey
      if (!monthlyMap[r.monthKey]) monthlyMap[r.monthKey] = { month: monthLabel, requests: 0, approved: 0, rejected: 0 }
      monthlyMap[r.monthKey].requests++
      if (r.status === 'approved') monthlyMap[r.monthKey].approved++
      else if (r.status === 'rejected') monthlyMap[r.monthKey].rejected++
    }
    const monthlyTrend = Object.values(monthlyMap)

    // Recent requests (with joins)
    const recentResult = await db.query(`
      SELECT r.*, a.nameEn as applicantNameEn, a.nameAr as applicantNameAr, a.emiratesId as applicantEmiratesId,
        a.monthlyIncome as applicantMonthlyIncome, a.employerType as applicantEmployerType, a.familySize as applicantFamilySize,
        l.originalAmount as loanOriginalAmount, l.remainingBalance as loanRemainingBalance,
        l.monthlyInstallment as loanMonthlyInstallment, l.loanType as loanLoanType, l.status as loanStatus,
        ai.riskScore, ai.riskLevel, ai.confidenceScore, ai.recommendedAmount, ai.recommendedDuration,
        ai.recommendedInstallment, ai.debtBurdenRatio, ai.proposedDBR, ai.eligibilityStatus, ai.requiresHumanReview
      FROM ReschedulingRequest r
      LEFT JOIN Applicant a ON r.applicantId = a.id
      LEFT JOIN HousingLoan l ON r.loanId = l.id
      LEFT JOIN AIAssessment ai ON r.id = ai.requestId
      ORDER BY r.createdAt DESC LIMIT 10
    `)
    const recentRequests = (recentResult.results || []).map((row: any) => {
      const { applicantNameEn, applicantNameAr, applicantEmiratesId, applicantMonthlyIncome, applicantEmployerType, applicantFamilySize, loanOriginalAmount, loanRemainingBalance, loanMonthlyInstallment, loanLoanType, loanStatus, riskScore, riskLevel, confidenceScore, recommendedAmount, recommendedDuration, recommendedInstallment, debtBurdenRatio, proposedDBR, eligibilityStatus, requiresHumanReview, ...req } = row
      return {
        ...req,
        applicant: { id: req.applicantId, nameEn: applicantNameEn, nameAr: applicantNameAr, emiratesId: applicantEmiratesId, monthlyIncome: applicantMonthlyIncome, employerType: applicantEmployerType, familySize: applicantFamilySize },
        loan: { id: req.loanId, originalAmount: loanOriginalAmount, remainingBalance: loanRemainingBalance, monthlyInstallment: loanMonthlyInstallment, loanType: loanLoanType, status: loanStatus },
        assessment: riskScore ? { id: null, riskScore, riskLevel, confidenceScore, recommendedAmount, recommendedDuration, recommendedInstallment, debtBurdenRatio, proposedDBR, eligibilityStatus, requiresHumanReview: !!requiresHumanReview } : null,
        arrear: null,
      }
    })

    // Loan stats
    const loanStatsResult = await db.queryFirst("SELECT SUM(originalAmount) as totalOriginal, AVG(monthlyInstallment) as avgInstallment FROM HousingLoan")

    // Approved/rejected this month
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const approvedThisMonthResult = await db.queryFirst("SELECT COUNT(*) as count FROM ReschedulingRequest WHERE status = 'approved' AND updatedAt >= ?", startOfMonth)
    const rejectedThisMonthResult = await db.queryFirst("SELECT COUNT(*) as count FROM ReschedulingRequest WHERE status = 'rejected' AND updatedAt >= ?", startOfMonth)

    // Arrear stats
    const arrearStatsResult = await db.queryFirst("SELECT SUM(totalOverdue) as totalOverdue FROM Arrear")

    return c.json({
      totalRequests,
      pendingReview: byStatus.pending + byStatus.under_review,
      approvedThisMonth: (approvedThisMonthResult as any)?.count || 0,
      rejectedThisMonth: (rejectedThisMonthResult as any)?.count || 0,
      avgProcessingTime,
      automationRate: Math.round(automationRate * 10) / 10,
      statusDistribution,
      riskDistribution,
      monthlyTrend,
      recentRequests,
      avgMonthlyInstallment: Math.round((loanStatsResult as any)?.avgInstallment || 0),
      totalOutstandingArrears: (arrearStatsResult as any)?.totalOverdue || 0,
    })
  } catch (error) {
    console.error('Dashboard error:', error)
    return c.json({ error: 'Failed to fetch dashboard statistics' }, 500)
  }
})

export default dashboard
