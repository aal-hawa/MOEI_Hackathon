/**
 * AI Analysis Routes
 * POST /api/analyze, /api/simulate, /api/ai-assistant, /api/verify-document, /api/analyze-salary-certificate, /api/verify-identity
 */

import { Hono } from 'hono'
import type { Env } from '../types'
import { DbClient } from '../db/queries'
import { chatCompletion, visionCompletion, getActiveModelConfig } from '../lib/ai-client'
import { checkEligibility, calculateDBR, determineRiskLevel, calculateRescheduling, runGovernanceChecks } from '../lib/rules-engine'
import { safeJsonParse } from '../lib/utils'

const ai = new Hono<{ Bindings: Env }>()

// POST /api/analyze
ai.post('/analyze', async (c) => {
  const db = new DbClient(c.env.DB)
  const kv = c.env.KV
  const startTime = Date.now()

  try {
    const body = await c.req.json()
    const { applicant, loan, request: reqData, uploadedFiles } = body
    if (!applicant || !loan || !reqData) return c.json({ error: 'Missing required data' }, 400)

    const arrear = { missedMonths: Number(loan.missedMonths) || 0, totalOverdue: Number(loan.totalOverdue) || 0, delayDays: Number(loan.delayDays) || 0, reason: reqData.reasonCategory || 'other' }

    const eligibilityResult = await checkEligibility(db, kv,
      { isCitizen: true, hasFamilyBook: applicant.hasFamilyBook !== false, monthlyIncome: Number(applicant.monthlyIncome) || 0, employerType: applicant.employerType || 'government', familySize: Number(applicant.familySize) || 1 },
      { originalAmount: Number(loan.originalAmount) || 0, remainingBalance: Number(loan.remainingBalance) || 0, monthlyInstallment: Number(loan.monthlyInstallment) || 0, loanDurationMonths: Number(loan.loanDurationMonths) || 0, elapsedMonths: Number(loan.elapsedMonths) || 0, loanType: loan.loanType || 'housing_loan', status: 'active' },
      arrear,
    )

    const reschedulingResult = await calculateRescheduling(db, kv,
      { originalAmount: Number(loan.originalAmount) || 0, remainingBalance: Number(loan.remainingBalance) || 0, monthlyInstallment: Number(loan.monthlyInstallment) || 0, loanDurationMonths: Number(loan.loanDurationMonths) || 0, elapsedMonths: Number(loan.elapsedMonths) || 0, loanType: loan.loanType || 'housing_loan', status: 'active' },
      arrear, Number(reqData.requestedDurationMonths) || 120, Number(applicant.monthlyIncome) || 0,
    )

    const dbrResult = await calculateDBR(db, kv, Number(applicant.monthlyIncome) || 0, Number(loan.monthlyInstallment) || 0, reschedulingResult.recommendedInstallment)
    const riskResult = await determineRiskLevel(db, kv, dbrResult.dbr, arrear.delayDays, Number(applicant.monthlyIncome) || 0, arrear.reason, applicant.employerType || 'government')
    const governanceResult = await runGovernanceChecks(db, kv,
      { isCitizen: true, hasFamilyBook: applicant.hasFamilyBook !== false, monthlyIncome: Number(applicant.monthlyIncome) || 0, employerType: applicant.employerType || 'government', familySize: Number(applicant.familySize) || 1 },
      { originalAmount: Number(loan.originalAmount) || 0, remainingBalance: Number(loan.remainingBalance) || 0, monthlyInstallment: Number(loan.monthlyInstallment) || 0, loanDurationMonths: Number(loan.loanDurationMonths) || 0, elapsedMonths: Number(loan.elapsedMonths) || 0, loanType: loan.loanType || 'housing_loan', status: 'active' },
      arrear, Number(reqData.requestedDurationMonths) || 120,
    )

    // LLM Analysis
    let llmStructuredResponse: Record<string, unknown> = {}
    try {
      const modelConfig = await getActiveModelConfig(db, kv, 'llm', c.env.RECENTECH_BASE_URL, c.env.RECENTECH_API_KEY, c.env.Z_AI_TOKEN, c.env.Z_AI_USER_ID, c.env.Z_AI_CHAT_ID)
      const systemPrompt = `You are an expert housing arrears rescheduling analyst for SZHP/MOEI. Analyze the case and provide structured JSON.
Respond ONLY with valid JSON: { "recommendation": "approve"|"conditionally_approve"|"reject"|"escalate", "confidence": 0-100, "summary": "...", "riskAnalysis": {...}, "reschedulingTerms": {...}, "humanReviewRequired": boolean, "humanReviewReason": "..." }`
      const userPrompt = `Analyze: Income=${applicant.monthlyIncome}, Loan=${loan.originalAmount}, Arrears=${arrear.totalOverdue}, Risk=${riskResult.riskLevel}(${riskResult.riskScore}), Eligible=${eligibilityResult.eligible}, DBR=${(dbrResult.dbr*100).toFixed(1)}%`

      const completion = await chatCompletion([{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }], modelConfig)
      try {
        const jsonMatch = completion.content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, completion.content]
        llmStructuredResponse = JSON.parse((jsonMatch[1] || completion.content).trim())
      } catch {
        llmStructuredResponse = { recommendation: 'escalate', confidence: 50, summary: completion.content.substring(0, 500), humanReviewRequired: true, humanReviewReason: 'LLM response could not be parsed' }
      }
    } catch {
      llmStructuredResponse = { recommendation: eligibilityResult.eligible && reschedulingResult.feasible ? 'conditionally_approve' : 'reject', confidence: 60, summary: 'AI unavailable - rules engine only', humanReviewRequired: true, humanReviewReason: 'AI model unavailable' }
    }

    const llmRec = llmStructuredResponse as any
    let eligibilityStatus = 'eligible'
    if (!eligibilityResult.eligible || riskResult.riskLevel === 'critical' || !reschedulingResult.feasible) eligibilityStatus = 'ineligible'
    else if (riskResult.riskLevel === 'high' || llmRec.humanReviewRequired) eligibilityStatus = 'conditionally_eligible'

    const shapExplanation = riskResult.factors.map(f => ({ feature: f.factor, value: f.contribution, contribution: f.contribution, description: f.description }))

    return c.json({
      data: {
        eligibilityStatus, recommendation: llmRec.recommendation || (eligibilityResult.eligible ? 'conditionally_approve' : 'reject'),
        confidence: llmRec.confidence || 70, processingTimeMs: Date.now() - startTime,
        rulesEngine: { eligibility: eligibilityResult, dbr: dbrResult, risk: riskResult, rescheduling: reschedulingResult, governance: governanceResult },
        llmAnalysis: llmStructuredResponse, shapExplanation,
        summary: { eligible: eligibilityResult.eligible, feasible: reschedulingResult.feasible, riskLevel: riskResult.riskLevel, riskScore: riskResult.riskScore, currentDBR: dbrResult.dbr, proposedDBR: reschedulingResult.proposedDBR, recommendedInstallment: reschedulingResult.recommendedInstallment, recommendedDuration: reschedulingResult.recommendedDuration, governanceCompliant: governanceResult.compliant, requiresHumanReview: llmRec.humanReviewRequired || riskResult.riskLevel === 'critical' },
      },
    })
  } catch (error) {
    console.error('Error running analysis:', error)
    return c.json({ error: 'Failed to run analysis' }, 500)
  }
})

// POST /api/simulate
ai.post('/simulate', async (c) => {
  const db = new DbClient(c.env.DB)
  const kv = c.env.KV
  try {
    const body = await c.req.json()
    const { applicant, loan, arrear: arrearData, proposedDuration, proposedInstallment } = body
    if (!applicant || !loan) return c.json({ error: 'Missing required data' }, 400)

    const arrear = { missedMonths: arrearData?.missedMonths || 0, totalOverdue: arrearData?.totalOverdue || 0, delayDays: arrearData?.delayDays || 0, reason: arrearData?.reason || 'other' }
    const reschedulingResult = await calculateRescheduling(db, kv, { originalAmount: loan.originalAmount, remainingBalance: loan.remainingBalance, monthlyInstallment: loan.monthlyInstallment, loanDurationMonths: loan.loanDurationMonths, elapsedMonths: loan.elapsedMonths, loanType: loan.loanType, status: 'active' }, arrear, proposedDuration || 120, applicant.monthlyIncome)
    const dbrResult = await calculateDBR(db, kv, applicant.monthlyIncome, loan.monthlyInstallment, proposedInstallment || reschedulingResult.recommendedInstallment)
    const riskResult = await determineRiskLevel(db, kv, dbrResult.dbr, arrear.delayDays, applicant.monthlyIncome, arrear.reason, applicant.employerType)

    return c.json({ data: { rescheduling: reschedulingResult, dbr: dbrResult, risk: riskResult, proposedDuration: proposedDuration || reschedulingResult.recommendedDuration, proposedInstallment: proposedInstallment || reschedulingResult.recommendedInstallment } })
  } catch (error) {
    return c.json({ error: 'Simulation failed' }, 500)
  }
})

// POST /api/ai-assistant
ai.post('/ai-assistant', async (c) => {
  const db = new DbClient(c.env.DB)
  const kv = c.env.KV
  try {
    const body = await c.req.json()
    const { message, context } = body
    if (!message) return c.json({ error: 'Message is required' }, 400)

    const modelConfig = await getActiveModelConfig(db, kv, 'llm', c.env.RECENTECH_BASE_URL, c.env.RECENTECH_API_KEY, c.env.Z_AI_TOKEN, c.env.Z_AI_USER_ID, c.env.Z_AI_CHAT_ID)
    const systemPrompt = `You are an AI assistant for SZHP housing arrears rescheduling. Help employees and reviewers with case analysis, policy questions, and rescheduling recommendations. Respond in the user's language (Arabic or English).`
    const completion = await chatCompletion([{ role: 'system', content: systemPrompt }, { role: 'user', content: message }], modelConfig)

    return c.json({ response: completion.content, model: completion.model, provider: completion.provider })
  } catch (error) {
    console.error('AI assistant error:', error)
    return c.json({ error: 'AI assistant unavailable' }, 500)
  }
})

// POST /api/verify-document
ai.post('/verify-document', async (c) => {
  const db = new DbClient(c.env.DB)
  const kv = c.env.KV
  try {
    const body = await c.req.json()
    const { imageUrl, documentType } = body
    if (!imageUrl) return c.json({ error: 'Image URL required' }, 400)

    const vlmConfig = await getActiveModelConfig(db, kv, 'vlm', c.env.RECENTECH_BASE_URL, c.env.RECENTECH_API_KEY, c.env.Z_AI_TOKEN, c.env.Z_AI_USER_ID, c.env.Z_AI_CHAT_ID)
    const result = await visionCompletion([{
      role: 'user', content: [
        { type: 'text', text: `Verify this ${documentType || 'document'}. Extract key information: name, ID number, salary, employer. Check if the document appears authentic and complete.` },
        { type: 'image_url', image_url: { url: imageUrl } },
      ],
    }], vlmConfig)

    return c.json({ analysis: result.content, model: result.model, provider: result.provider })
  } catch (error) {
    console.error('Document verification error:', error)
    return c.json({ error: 'Document verification failed' }, 500)
  }
})

// POST /api/analyze-salary-certificate
ai.post('/analyze-salary-certificate', async (c) => {
  const db = new DbClient(c.env.DB)
  const kv = c.env.KV
  try {
    const body = await c.req.json()
    const { imageUrl } = body
    if (!imageUrl) return c.json({ error: 'Image URL required' }, 400)

    const vlmConfig = await getActiveModelConfig(db, kv, 'vlm', c.env.RECENTECH_BASE_URL, c.env.RECENTECH_API_KEY, c.env.Z_AI_TOKEN, c.env.Z_AI_USER_ID, c.env.Z_AI_CHAT_ID)
    const result = await visionCompletion([{
      role: 'user', content: [
        { type: 'text', text: 'Extract salary certificate information as JSON: { employeeName, employer, monthlySalary, position, certificateDate, employerType }. If any field is unclear, set it to null.' },
        { type: 'image_url', image_url: { url: imageUrl } },
      ],
    }], vlmConfig)

    let parsed: Record<string, unknown> = {}
    try {
      const jsonMatch = result.content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, result.content]
      parsed = JSON.parse((jsonMatch[1] || result.content).trim())
    } catch {
      parsed = { rawText: result.content }
    }

    return c.json({ data: parsed, model: result.model })
  } catch (error) {
    console.error('Salary certificate error:', error)
    return c.json({ error: 'Salary certificate analysis failed' }, 500)
  }
})

// POST /api/verify-identity
ai.post('/verify-identity', async (c) => {
  const db = new DbClient(c.env.DB)
  try {
    const body = await c.req.json()
    const { emiratesId, nameEn } = body
    if (!emiratesId) return c.json({ error: 'Emirates ID required' }, 400)

    const user: any = await db.findUserByEmiratesId(emiratesId)
    if (!user) return c.json({ verified: false, reason: 'User not found in system' })

    const nameMatch = !nameEn || (user.fullnameEN && user.fullnameEN.toLowerCase().includes(nameEn.toLowerCase()))
    return c.json({ verified: !!user && nameMatch, user: { id: user.id, fullnameEN: user.fullnameEN, fullnameAR: user.fullnameAR, role: user.role, department: user.department } })
  } catch (error) {
    return c.json({ error: 'Identity verification failed' }, 500)
  }
})

export default ai
