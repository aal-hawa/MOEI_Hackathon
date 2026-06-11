import type { Env } from '../types'
import { DbClient } from '../db/queries'
import { generateId, safeJsonParse } from './utils'
import { getConfigNumber } from './config'
import {
  checkEligibility,
  calculateDBR,
  determineRiskLevel,
  calculateRescheduling,
  runGovernanceChecks,
  calculateIncomePerFamilyMember,
  analyzeIncomeStability,
  analyzePaymentHistory,
  checkDocumentCompleteness,
  calculateMoeiCompliance,
  generateMoeiRecommendation,
} from './rules-engine'
import { chatCompletion, getActiveModelConfig } from './ai-client'

interface RunRequestAssessmentOptions {
  performedBy?: string
  performedByUserId?: string | null
  replaceExisting?: boolean
}

function toPercent(rate: number): number {
  return Math.round(rate * 10000) / 100
}

function normalizeApplicationStatus(value: unknown, complete: boolean): 'complete' | 'incomplete' {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'complete' || normalized === 'incomplete') return normalized
  }
  return complete ? 'complete' : 'incomplete'
}

function getLlmRecommendation(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value : fallback
}

function normalizeConfidence(value: unknown, fallback = 70): number {
  const numeric = typeof value === 'number' ? value : fallback
  const percentage = numeric > 0 && numeric <= 1 ? numeric * 100 : numeric
  return Math.max(1, Math.min(100, Math.round(percentage)))
}

function hasIncomeEvidence(supportingDocuments: string[]): boolean {
  return supportingDocuments.some((doc) => ['income_statement', 'bank_statement', 'detailed_salary_statement'].includes(doc))
}

function normalizeDocType(value: unknown): string {
  return String(value || 'additional').trim().toLowerCase().replace(/\s+/g, '_')
}

function getDocumentLabel(docType: string): string {
  const labels: Record<string, string> = {
    salary_certificate: 'Salary certificate',
    income_statement: 'Income statement',
    bank_statement: 'Bank statement',
    detailed_salary_statement: 'Detailed salary statement',
    rescheduling_agreement: 'Rescheduling agreement',
    medical_report: 'Medical report',
    termination_letter: 'Termination letter',
    divorce_decree: 'Divorce decree',
    pension_statement: 'Pension statement',
  }
  return labels[docType] || docType.replace(/_/g, ' ')
}

function buildDeterministicDocumentSummaries(
  req: any,
  supportingDocuments: string[],
  documentCompleteness: { complete: boolean; missingDocuments: string[] },
) {
  const uploadedFiles = safeJsonParse<Array<Record<string, unknown>>>(req.uploadedFiles, [])
  const summaries: Array<Record<string, unknown>> = []
  const summarizedTypes = new Set<string>()

  for (const file of uploadedFiles) {
    const docType = normalizeDocType(file.docType || file.documentType || file.originalName)
    summarizedTypes.add(docType)
    summaries.push({
      fileName: String(file.originalName || file.storedName || getDocumentLabel(docType)),
      documentType: docType,
      verified: false,
      status: 'review_required',
      confidence: 62,
      method: 'metadata_only',
      summary: `${getDocumentLabel(docType)} is uploaded and counted for completeness. Content extraction is handled by the local document intelligence path when files are available; the strict rules never use unverified document text to override governance gates.`,
      signals: [
        'file metadata present',
        file.type ? `mime type: ${file.type}` : 'mime type unavailable',
        file.size ? `size: ${Number(file.size).toLocaleString()} bytes` : 'size unavailable',
      ],
    })
  }

  for (const doc of supportingDocuments) {
    const docType = normalizeDocType(doc)
    if (summarizedTypes.has(docType)) continue
    summaries.push({
      fileName: getDocumentLabel(docType),
      documentType: docType,
      verified: false,
      status: 'review_required',
      confidence: 58,
      method: 'metadata_only',
      summary: `${getDocumentLabel(docType)} was declared in the request. It is treated as a completeness signal only until source evidence is opened or OCR-verified.`,
      signals: ['declared by application payload'],
    })
  }

  for (const docType of documentCompleteness.missingDocuments) {
    summaries.push({
      fileName: getDocumentLabel(docType),
      documentType: docType,
      verified: false,
      status: 'missing',
      confidence: 100,
      method: 'not_provided',
      summary: `${getDocumentLabel(docType)} is mandatory and missing. This blocks the instant approval path.`,
      signals: ['mandatory document missing', 'blocks automatic approval'],
    })
  }

  return summaries
}

export async function runRequestAssessment(
  env: Env,
  db: DbClient,
  id: string,
  options: RunRequestAssessmentOptions = {},
) {
  const startTime = Date.now()
  const kv = env.KV

  const existingAssessment: any = await db.findAssessmentByRequestId(id)
  if (existingAssessment) {
    if (!options.replaceExisting) return { assessment: existingAssessment, alreadyAssessed: true }
    await db.run('DELETE FROM AIAssessment WHERE requestId = ?', id)
  }

  const req: any = await db.findRequestById(id)
  if (!req) throw new Error('Request not found')

  const applicant: any = await db.findApplicantById(req.applicantId)
  const loan: any = await db.findLoanById(req.loanId)
  if (!applicant || !loan) throw new Error('Missing applicant or loan data')

  const arrearsResult = await db.findArrearsByLoanId(loan.id)
  const arrear: any = (arrearsResult.results?.[0] as any) || {
    id: null,
    loanId: loan.id,
    missedMonths: 0,
    totalOverdue: 0,
    delayDays: 0,
    reason: req.reasonCategory || 'other',
  }
  const supportingDocuments = safeJsonParse(req.supportingDocuments, [])
  const activeRequestResult: any = await db.queryFirst(
    `SELECT COUNT(*) as count
     FROM ReschedulingRequest
     WHERE applicantId = ?
       AND id <> ?
       AND status IN ('pending', 'under_review', 'ai_assessed', 'escalated')`,
    req.applicantId,
    id,
  )
  const activeRequestCount = Number(activeRequestResult?.count || 0)
  const hasActiveRequest = activeRequestCount > 0

  const applicantData = {
    isCitizen: !!applicant.isCitizen,
    hasFamilyBook: !!applicant.hasFamilyBook,
    monthlyIncome: applicant.monthlyIncome || 0,
    employerType: applicant.employerType || 'private',
    familySize: applicant.familySize || 1,
  }
  const loanData = {
    originalAmount: loan.originalAmount || 0,
    remainingBalance: loan.remainingBalance || 0,
    monthlyInstallment: loan.monthlyInstallment || 0,
    loanDurationMonths: loan.loanDurationMonths || 0,
    elapsedMonths: loan.elapsedMonths || 0,
    loanType: loan.loanType || 'housing_loan',
    status: loan.status || 'active',
  }
  const arrearData = {
    missedMonths: arrear.missedMonths || 0,
    totalOverdue: arrear.totalOverdue || 0,
    delayDays: arrear.delayDays || 0,
    reason: arrear.reason || req.reasonCategory || 'other',
  }

  const eligibilityResult = await checkEligibility(db, kv, applicantData, loanData, arrearData)
  const reschedulingResult = await calculateRescheduling(
    db,
    kv,
    loanData,
    arrearData,
    req.requestedDurationMonths,
    applicant.monthlyIncome || 0,
  )
  const proposedDbrResult = await calculateDBR(
    db,
    kv,
    applicant.monthlyIncome || 0,
    0,
    reschedulingResult.recommendedInstallment,
  )
  const governanceResult = await runGovernanceChecks(
    db,
    kv,
    applicantData,
    loanData,
    arrearData,
    req.requestedDurationMonths,
  )

  const incomePerMember = await calculateIncomePerFamilyMember(
    db,
    kv,
    applicant.totalHouseholdIncome || applicant.monthlyIncome || 0,
    applicant.familySize || 1,
  )
  const incomeStabilityResult = await analyzeIncomeStability(
    db,
    kv,
    applicant.monthlyIncome || 0,
    applicant.previousIncome || null,
    applicant.incomeStability || 'stable',
    applicant.employerType || 'private',
  )
  const paymentHistoryResult = await analyzePaymentHistory(
    db,
    kv,
    safeJsonParse(loan.paymentHistory, []),
    loan.totalMissedPayments || arrearData.missedMonths || 0,
    loan.reschedulingCount || 0,
    loan.loanDurationMonths || 0,
    loan.elapsedMonths || 0,
  )
  const documentCompleteness = await checkDocumentCompleteness(
    db,
    kv,
    supportingDocuments,
    req.reasonCategory,
  )
  const incomeEvidenceProvided = hasIncomeEvidence(supportingDocuments)
  if (!incomeEvidenceProvided && !documentCompleteness.missingDocuments.includes('income_statement')) {
    documentCompleteness.checks.push({ document: 'income_statement', required: true, provided: false })
    documentCompleteness.missingDocuments.push('income_statement')
    documentCompleteness.complete = false
  }
  const documentSummaries = buildDeterministicDocumentSummaries(req, supportingDocuments, documentCompleteness)
  const moeiCompliance = await calculateMoeiCompliance(
    db,
    kv,
    applicantData,
    loanData,
    arrearData,
    req.requestedDurationMonths,
    reschedulingResult.recommendedInstallment,
  )
  const enhancedRiskResult = await determineRiskLevel(
    db,
    kv,
    proposedDbrResult.dbr,
    arrearData.delayDays,
    applicant.monthlyIncome || 0,
    arrearData.reason || 'other',
    applicant.employerType || 'private',
    {
      incomePerMemberBelowThreshold: incomePerMember.belowThreshold,
      incomeStabilityLevel: incomeStabilityResult.stabilityLevel,
      paymentHistoryPattern: paymentHistoryResult.pattern,
    },
  )
  const moeiRecommendation = await generateMoeiRecommendation(
    db,
    kv,
    eligibilityResult,
    moeiCompliance,
    enhancedRiskResult,
    incomePerMember,
    incomeStabilityResult,
    paymentHistoryResult,
    documentCompleteness,
  )

  let llmStructuredResponse: Record<string, unknown> = {}
  try {
    const llmConfig = await getActiveModelConfig(db, kv, 'llm', env.RECENTECH_BASE_URL, env.RECENTECH_API_KEY)
    const systemPrompt = `You are an expert housing arrears rescheduling analyst for SZHP under MOEI.
MOEI KEY RULES: 1. Deduction rate <= 20% of income. 2. Repayment period <= original approved remaining period. 3. Income per member < AED 2,500 -> lighter plan.
Respond with JSON: { "applicationStatus": "complete"|"incomplete", "caseSummary": "...", "incomeAnalysis": {...}, "recommendation": "approve"|"conditionally_approve"|"request_documents"|"refer_to_employee"|"reject", "reasoning": "...", "confidence": number, "riskAnalysis": {...}, "humanReviewRequired": boolean, "humanReviewReason": "..." }`
    const userPrompt = `Analyze case:
- Name: ${applicant.nameEn || applicant.nameAr}
- Monthly Income: AED ${Number(applicant.monthlyIncome || 0).toLocaleString()}
- Employer: ${applicant.employerType || 'unknown'}
- Remaining Balance: AED ${Number(loan.remainingBalance || 0).toLocaleString()}
- Arrears: ${arrearData.missedMonths} months, AED ${Number(arrearData.totalOverdue || 0).toLocaleString()}
- Proposed Installment: AED ${Number(reschedulingResult.recommendedInstallment || 0).toLocaleString()}
- Proposed Deduction Rate: ${toPercent(moeiCompliance.deductionRate).toFixed(1)}%
- Risk Level: ${enhancedRiskResult.riskLevel} (Score: ${enhancedRiskResult.riskScore})
- Documents Complete: ${documentCompleteness.complete ? 'yes' : 'no'}
- MOEI Recommendation: ${moeiRecommendation.recommendation}`

    const completion = await chatCompletion([{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }], llmConfig)
    const llmText = completion.content || ''
    try {
      const jsonMatch = llmText.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, llmText]
      llmStructuredResponse = JSON.parse((jsonMatch[1] || llmText).trim())
    } catch {
      llmStructuredResponse = {
        applicationStatus: documentCompleteness.complete ? 'complete' : 'incomplete',
        caseSummary: moeiRecommendation.caseSummary,
        recommendation: moeiRecommendation.recommendation,
        confidence: 70,
        humanReviewRequired: false,
      }
    }
  } catch {
    llmStructuredResponse = {
      applicationStatus: documentCompleteness.complete ? 'complete' : 'incomplete',
      caseSummary: moeiRecommendation.caseSummary,
      recommendation: moeiRecommendation.recommendation,
      confidence: 70,
      humanReviewRequired: false,
    }
  }

  const humanReviewRiskThreshold = await getConfigNumber(db, kv, 'human_review_risk_threshold', 50)
  const humanReviewDbrThreshold = await getConfigNumber(db, kv, 'human_review_dbr_threshold', 0.5)
  const humanReviewDelayDays = await getConfigNumber(db, kv, 'human_review_delay_days', 180)
  const humanReviewReasons: string[] = []
  const llmRec = llmStructuredResponse as any

  if (llmRec.humanReviewRequired && llmRec.humanReviewReason) humanReviewReasons.push(String(llmRec.humanReviewReason))
  if (hasActiveRequest) humanReviewReasons.push(`Existing active rescheduling application found (${activeRequestCount})`)
  if (!documentCompleteness.complete) humanReviewReasons.push(`Missing required documents: ${documentCompleteness.missingDocuments.join(', ')}`)
  if (!governanceResult.compliant) humanReviewReasons.push('One or more governance checks failed')
  if (!moeiCompliance.deductionRulePassed) humanReviewReasons.push(`Proposed deduction rate ${toPercent(moeiCompliance.deductionRate).toFixed(1)}% exceeds 20% limit`)
  if (!moeiCompliance.periodRulePassed) humanReviewReasons.push(`Requested duration exceeds remaining approved period of ${moeiCompliance.remainingPeriod} months`)
  if (!reschedulingResult.feasible) humanReviewReasons.push('Proposed rescheduling terms are not financially feasible')
  if (enhancedRiskResult.riskScore >= humanReviewRiskThreshold) humanReviewReasons.push(`Risk score ${enhancedRiskResult.riskScore} meets human review threshold ${humanReviewRiskThreshold}`)
  if (reschedulingResult.proposedDBR >= humanReviewDbrThreshold) humanReviewReasons.push(`Proposed DBR ${(reschedulingResult.proposedDBR * 100).toFixed(1)}% meets human review threshold ${(humanReviewDbrThreshold * 100).toFixed(1)}%`)
  if (arrearData.delayDays >= humanReviewDelayDays) humanReviewReasons.push(`Delay of ${arrearData.delayDays} days meets human review threshold ${humanReviewDelayDays} days`)

  const mandatoryEligibilityFailure = eligibilityResult.checks.some((check) =>
    (check.rule === 'citizenship' || check.rule === 'family_book') && !check.passed
  )
  const requiresHumanReview = !mandatoryEligibilityFailure && humanReviewReasons.length > 0
  let eligibilityStatus = 'eligible'
  if (!eligibilityResult.eligible || enhancedRiskResult.riskLevel === 'critical' || !reschedulingResult.feasible) eligibilityStatus = 'ineligible'
  else if (requiresHumanReview || enhancedRiskResult.riskLevel === 'high') eligibilityStatus = 'conditionally_eligible'

  const processingTimeMs = Date.now() - startTime
  const shapExplanation = enhancedRiskResult.factors.map((factor) => ({
    feature: factor.factor,
    value: factor.contribution,
    contribution: factor.contribution,
    description: factor.description,
  }))
  const riskFactors = enhancedRiskResult.factors.map((factor) => ({
    factor: factor.factor,
    severity: factor.contribution >= 20 ? 'critical' : factor.contribution >= 10 ? 'high' : 'medium',
    description: factor.description,
  }))
  const finalMoeiReasoning = mandatoryEligibilityFailure
    ? 'Applicant is not authorized for this service because MOEI/SZHP housing arrears rescheduling requires UAE national eligibility and family book validation.'
    : moeiRecommendation.reasoning
  const finalMoeiRecommendation = mandatoryEligibilityFailure
    ? 'reject'
    : getLlmRecommendation(llmRec.recommendation, moeiRecommendation.recommendation)
  const governanceChecks = [
    {
      ruleCode: 'ACTIVE-001',
      ruleName: 'Active Application Validation',
      passed: !hasActiveRequest,
      message: hasActiveRequest
        ? `Applicant has ${activeRequestCount} other active rescheduling application(s); human officer review is required`
        : 'No other active rescheduling application found',
      category: 'governance',
    },
    ...governanceResult.checks,
    {
      ruleCode: 'DOC-INCOME-001',
      ruleName: 'Detailed Income Statement',
      passed: incomeEvidenceProvided,
      message: incomeEvidenceProvided
        ? 'Detailed income evidence provided through income or bank statement'
        : 'Detailed income statement or bank statement is required',
      category: 'documentation',
    },
  ]
  const governanceCompliant = governanceChecks.every((check) => check.passed)
  const documentReviewCount = documentSummaries.filter((doc) => doc.verified !== true).length
  const deterministicConfidenceCap = Math.max(
    50,
    100 - enhancedRiskResult.riskScore - (documentCompleteness.missingDocuments.length * 15) - Math.min(12, documentReviewCount * 3),
  )
  const algorithmTrace = [
    {
      step: 1,
      gate: 'Eligibility Gate',
      rule: 'Applicant must be a UAE citizen and have a valid family book.',
      input: `eligible=${eligibilityResult.eligible}`,
      result: mandatoryEligibilityFailure ? 'fail' : 'pass',
      outcome: mandatoryEligibilityFailure ? 'Hard reject before financial optimization.' : 'Proceed to document and financial gates.',
    },
    {
      step: 2,
      gate: 'Document Gate',
      rule: 'Salary certificate plus income evidence are mandatory; hardship-specific documents are required when applicable.',
      input: `provided=${supportingDocuments.join(', ') || 'none'}; missing=${documentCompleteness.missingDocuments.join(', ') || 'none'}`,
      result: documentCompleteness.complete ? 'pass' : 'review',
      outcome: documentCompleteness.complete ? 'Evidence package complete.' : 'Automatic approval blocked until required evidence is supplied.',
    },
    {
      step: 3,
      gate: 'Financial Formula',
      rule: 'installment = rescheduled amount / duration; DBR = installment / monthly income.',
      input: `amount=AED ${Number(reschedulingResult.recommendedAmount || 0).toLocaleString()}; duration=${reschedulingResult.recommendedDuration} months; income=AED ${Number(applicant.monthlyIncome || 0).toLocaleString()}`,
      result: reschedulingResult.feasible ? 'pass' : 'fail',
      outcome: `installment=AED ${Number(reschedulingResult.recommendedInstallment || 0).toLocaleString()}; proposedDBR=${(reschedulingResult.proposedDBR * 100).toFixed(1)}%.`,
    },
    {
      step: 4,
      gate: 'Governance Gate',
      rule: '20% deduction cap, remaining approved period, no active duplicate request.',
      input: `deduction=${toPercent(moeiCompliance.deductionRate).toFixed(1)}%; remainingPeriod=${moeiCompliance.remainingPeriod}; activeRequests=${activeRequestCount}`,
      result: governanceCompliant ? 'pass' : 'review',
      outcome: governanceCompliant ? 'All configured governance checks passed.' : 'At least one governance rule requires officer attention.',
    },
    {
      step: 5,
      gate: 'Risk Score',
      rule: 'Weighted risk = proposed DBR + arrears delay + income level + employer type + income stability/payment history.',
      input: enhancedRiskResult.factors.map((factor) => `${factor.factor}:${factor.contribution}`).join('; '),
      result: enhancedRiskResult.riskScore >= humanReviewRiskThreshold ? 'review' : 'pass',
      outcome: `riskScore=${enhancedRiskResult.riskScore}/100; riskLevel=${enhancedRiskResult.riskLevel}; humanReviewThreshold=${humanReviewRiskThreshold}.`,
    },
    {
      step: 6,
      gate: 'Decision Path',
      rule: 'Reject mandatory eligibility failure; request documents when incomplete; hand off high-risk exceptions; otherwise AI-assessed.',
      input: `requiresHumanReview=${requiresHumanReview}; recommendation=${finalMoeiRecommendation}`,
      result: mandatoryEligibilityFailure || finalMoeiRecommendation === 'reject' ? 'fail' : requiresHumanReview ? 'review' : 'pass',
      outcome: mandatoryEligibilityFailure ? 'AI rejects due to mandatory eligibility failure.' : requiresHumanReview ? 'AI refers the exception to a human officer.' : 'AI can place the case on the instant assessed path.',
    },
  ]
  const decisionRationale = {
    algorithm: 'MOEI-STRICT-GOVERNANCE-V2',
    algorithm_trace: algorithmTrace,
    moei_recommendation: finalMoeiRecommendation,
    moei_reasoning: finalMoeiReasoning,
    rules_engine_eligible: eligibilityResult.eligible,
    governance_compliant: governanceCompliant,
    document_completeness: documentCompleteness,
    document_summaries: documentSummaries,
    active_application_validation: {
      passed: !hasActiveRequest,
      activeRequestCount,
    },
    human_review_reasons: humanReviewReasons,
    financial_summary: {
      currentDBR: reschedulingResult.currentDBR,
      proposedDBR: reschedulingResult.proposedDBR,
      proposedDeductionRate: toPercent(moeiCompliance.deductionRate),
      recommendedAmount: reschedulingResult.recommendedAmount,
      recommendedDuration: reschedulingResult.recommendedDuration,
      recommendedInstallment: reschedulingResult.recommendedInstallment,
    },
  }

  const assessmentId = generateId()
  await db.createAssessment({
    id: assessmentId,
    requestId: id,
    riskScore: enhancedRiskResult.riskScore,
    riskLevel: enhancedRiskResult.riskLevel,
    confidenceScore: Math.min(normalizeConfidence(llmRec.confidence), deterministicConfidenceCap),
    recommendedAmount: reschedulingResult.recommendedAmount,
    recommendedDuration: llmRec.reschedulingTerms?.recommendedDuration || reschedulingResult.recommendedDuration,
    recommendedInstallment: llmRec.reschedulingTerms?.recommendedInstallment || reschedulingResult.recommendedInstallment,
    debtBurdenRatio: reschedulingResult.currentDBR,
    proposedDBR: reschedulingResult.proposedDBR,
    eligibilityStatus,
    decisionRationale: JSON.stringify(decisionRationale),
    governanceCompliance: JSON.stringify(governanceChecks),
    riskFactors: JSON.stringify(riskFactors),
    shapExplanation: JSON.stringify(shapExplanation),
    requiresHumanReview: requiresHumanReview ? 1 : 0,
    humanReviewReason: humanReviewReasons.join('; ') || null,
    aiModelVersion: 'v1.1-moei-instant',
    processingTimeMs,
    applicationStatus: normalizeApplicationStatus(llmRec.applicationStatus, documentCompleteness.complete),
    incomeAnalysis: JSON.stringify(llmRec.incomeAnalysis || {
      salary: applicant.monthlyIncome,
      stability: incomeStabilityResult.stabilityLevel,
      perMemberAverage: incomePerMember.incomePerMember,
      householdTotal: applicant.totalHouseholdIncome || applicant.monthlyIncome || 0,
    }),
    proposedDeductionRate: toPercent(moeiCompliance.deductionRate),
    rule20PercentCompliance: moeiCompliance.deductionRulePassed ? 'pass' : 'fail',
    periodRuleCompliance: moeiCompliance.periodRulePassed ? 'pass' : 'fail',
    moeiRecommendation: finalMoeiRecommendation,
    moeiReasoning: finalMoeiReasoning,
    caseSummary: String(llmRec.caseSummary || moeiRecommendation.caseSummary || ''),
  })

  const nextRequestStatus = mandatoryEligibilityFailure ? 'rejected' : requiresHumanReview ? 'escalated' : 'ai_assessed'
  await db.updateRequest(id, {
    status: nextRequestStatus,
    incomePerFamilyMember: incomePerMember.incomePerMember,
    deductionRate: toPercent(moeiCompliance.deductionRate),
    documentCompleteness: documentCompleteness.complete ? 'complete' : 'incomplete',
    missingDocuments: JSON.stringify(documentCompleteness.missingDocuments),
    moeiCompliance: JSON.stringify(governanceChecks),
  })

  await db.createAuditLog({
    id: generateId(),
    requestId: id,
    action: existingAssessment ? 'reassessed' : 'assessed',
    performedBy: options.performedBy || 'system:ai_v1.1-moei-instant',
    details: JSON.stringify({
      message: existingAssessment ? 'AI assessment refreshed' : 'AI assessment completed',
      riskScore: enhancedRiskResult.riskScore,
      riskLevel: enhancedRiskResult.riskLevel,
      moeiRecommendation: moeiRecommendation.recommendation,
      requiresHumanReview,
      autoRejected: mandatoryEligibilityFailure,
      humanReviewReasons,
      algorithm: 'MOEI-STRICT-GOVERNANCE-V2',
      documentSummaries: documentSummaries.length,
      processingTimeMs,
    }),
    category: 'request',
    performedByUserId: options.performedByUserId || null,
  })

  const assessment: any = await db.findAssessmentByRequestId(id)
  return {
    assessment,
    alreadyAssessed: false,
    rulesEngine: {
      eligibility: eligibilityResult,
      dbr: proposedDbrResult,
      risk: enhancedRiskResult,
      rescheduling: reschedulingResult,
      governance: { compliant: governanceCompliant, checks: governanceChecks },
    },
    moeiAnalysis: {
      incomePerMember,
      incomeStability: incomeStabilityResult,
      paymentHistory: paymentHistoryResult,
      documentCompleteness,
      moeiCompliance,
      moeiRecommendation,
      humanReviewReasons,
    },
    llmAnalysis: llmStructuredResponse,
  }
}
