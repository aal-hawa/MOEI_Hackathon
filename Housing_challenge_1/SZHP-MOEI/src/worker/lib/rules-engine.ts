/**
 * SZHP Arrears Rescheduling Rules Engine
 * Ported from src/lib/rules-engine.ts
 * Uses KV-cached config instead of in-memory config
 * All config reads go through getConfigNumber/getConfigBoolean/getConfigString
 */

import type { Env } from '../types'
import { DbClient } from '../db/queries'
import { getConfigNumber, getConfigBoolean, getConfigString } from './config'

// ── Type Definitions ────────────────────────────────────────────────
interface ApplicantData {
  isCitizen: boolean; hasFamilyBook: boolean; monthlyIncome: number;
  employerType: string; familySize: number;
}

interface LoanData {
  originalAmount: number; remainingBalance: number; monthlyInstallment: number;
  loanDurationMonths: number; elapsedMonths: number; loanType: string; status: string;
}

interface ArrearData {
  missedMonths: number; totalOverdue: number; delayDays: number; reason?: string;
}

interface EligibilityResult {
  eligible: boolean;
  checks: { rule: string; passed: boolean; message: string; severity: 'critical' | 'warning' | 'info' }[];
}

interface DBRResult {
  dbr: number; withinLimit: boolean; limit: number; monthlyIncome: number;
  totalObligations: number; proposedInstallment: number; headroom: number;
}

interface RiskResult {
  riskLevel: 'low' | 'medium' | 'high' | 'critical'; riskScore: number;
  factors: { factor: string; contribution: number; description: string }[];
}

interface ReschedulingResult {
  feasible: boolean; recommendedAmount: number; recommendedDuration: number;
  recommendedInstallment: number; proposedDBR: number; currentDBR: number;
  savingsPerMonth: number; totalInterestCost: number; warnings: string[];
}

interface IncomePerMemberResult {
  incomePerMember: number; belowThreshold: boolean; threshold: number;
}

interface IncomeStabilityResult {
  stabilityScore: number; stabilityLevel: 'stable' | 'moderately_stable' | 'unstable' | 'critical';
  factors: { factor: string; impact: string; description: string }[];
}

interface PaymentHistoryEntry {
  month: number; year: number; status: string; amount: number;
}

interface PaymentHistoryResult {
  paymentScore: number; pattern: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  onTimeRate: number; factors: { factor: string; description: string }[];
}

interface DocumentCompletenessResult {
  complete: boolean; missingDocuments: string[];
  checks: { document: string; required: boolean; provided: boolean }[];
}

interface MoeiComplianceResult {
  compliant: boolean; deductionRulePassed: boolean; periodRulePassed: boolean;
  deductionRate: number; maxDeductionRate: number; remainingPeriod: number;
  checks: { rule: string; passed: boolean; message: string; severity: 'critical' | 'warning' | 'info' }[];
}

interface MoeiRecommendationResult {
  recommendation: 'approve' | 'conditionally_approve' | 'request_documents' | 'refer_to_employee' | 'reject';
  reasoning: string; caseSummary: string;
}

interface RiskEnhancementData {
  incomePerMemberBelowThreshold?: boolean;
  incomeStabilityLevel?: 'stable' | 'moderately_stable' | 'unstable' | 'critical';
  paymentHistoryPattern?: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
}

// Default constants (fallbacks when DB is unavailable)
const DEFAULT_MAX_DBR = 0.20;
const DEFAULT_MAX_LOAN_DURATION = 360;
const DEFAULT_MAX_ASSISTANCE_AMOUNT = 800000;
const DEFAULT_HIGH_RISK_DELAY_DAYS = 180;
const DEFAULT_RISK_THRESHOLD_LOW = 30;
const DEFAULT_RISK_THRESHOLD_MEDIUM = 50;
const DEFAULT_RISK_THRESHOLD_HIGH = 70;
const DEFAULT_CITIZENSHIP_REQUIRED = true;
const DEFAULT_FAMILY_BOOK_REQUIRED = true;
const DEFAULT_MIN_MONTHLY_INCOME = 3000;

// ── Check Eligibility ───────────────────────────────────────────────
export async function checkEligibility(
  db: DbClient, kv: KVNamespace,
  applicant: ApplicantData, loan: LoanData, arrear: ArrearData
): Promise<EligibilityResult> {
  const checks: EligibilityResult['checks'] = [];

  const citizenshipRequired = await getConfigBoolean(db, kv, 'citizenship_required', DEFAULT_CITIZENSHIP_REQUIRED);
  const familyBookRequired = await getConfigBoolean(db, kv, 'family_book_required', DEFAULT_FAMILY_BOOK_REQUIRED);
  const maxAssistanceAmount = await getConfigNumber(db, kv, 'max_grant_amount', DEFAULT_MAX_ASSISTANCE_AMOUNT);
  const minIncome = await getConfigNumber(db, kv, 'min_monthly_income', DEFAULT_MIN_MONTHLY_INCOME);

  const isCitizen = !citizenshipRequired || applicant.isCitizen;
  checks.push({
    rule: 'citizenship', passed: isCitizen,
    message: applicant.isCitizen ? 'Applicant is a UAE citizen' : citizenshipRequired ? 'Applicant must be a UAE citizen to qualify' : 'Citizenship check is not required by current policy',
    severity: citizenshipRequired ? 'critical' : 'info',
  });

  const hasFamilyBook = !familyBookRequired || applicant.hasFamilyBook;
  checks.push({
    rule: 'family_book', passed: hasFamilyBook,
    message: applicant.hasFamilyBook ? 'Applicant holds a valid family book' : familyBookRequired ? 'Applicant must have a valid family book' : 'Family book check is not required',
    severity: familyBookRequired ? 'critical' : 'info',
  });

  const loanActive = loan.status === 'active' || loan.status === 'defaulted';
  checks.push({ rule: 'loan_status', passed: loanActive, message: loanActive ? `Loan status is ${loan.status}` : `Loan status (${loan.status}) is not eligible`, severity: 'critical' });

  const withinAmountLimit = loan.originalAmount <= maxAssistanceAmount;
  checks.push({ rule: 'loan_amount_limit', passed: withinAmountLimit, message: withinAmountLimit ? `Loan amount within limit` : `Loan amount exceeds AED ${maxAssistanceAmount.toLocaleString()} maximum`, severity: 'warning' });

  const hasRemainingBalance = loan.remainingBalance > 0;
  checks.push({ rule: 'remaining_balance', passed: hasRemainingBalance, message: hasRemainingBalance ? `Remaining balance: AED ${loan.remainingBalance.toLocaleString()}` : 'No remaining balance', severity: 'critical' });

  const hasArrears = arrear.missedMonths > 0 && arrear.totalOverdue > 0;
  checks.push({ rule: 'arrears_exist', passed: hasArrears, message: hasArrears ? `Arrears confirmed: ${arrear.missedMonths} months overdue` : 'No arrears detected', severity: 'info' });

  const validReasons = [
    'job_loss',
    'medical',
    'salary_cut',
    'divorce',
    'retirement',
    'other',
    'reschedule_arrears',
    'postpone_instalment',
    'reduce_instalment',
  ];
  const hasValidReason = arrear.reason ? validReasons.includes(arrear.reason) : false;
  checks.push({ rule: 'valid_reason', passed: hasValidReason, message: hasValidReason ? `Valid hardship reason: ${arrear.reason}` : 'Hardship reason not specified or invalid', severity: 'warning' });

  const normalizedEmployerType = applicant.employerType.replace(/_/g, '-')
  const isGovernmentEmployee = normalizedEmployerType === 'government';
  checks.push({ rule: 'government_employee', passed: true, message: isGovernmentEmployee ? 'Government employee - reduced risk weighting' : `Employment type: ${normalizedEmployerType}`, severity: 'info' });

  const criticalFailures = checks.filter(c => !c.passed && c.severity === 'critical');
  return { eligible: criticalFailures.length === 0, checks };
}

// ── Calculate DBR ───────────────────────────────────────────────────
export async function calculateDBR(
  db: DbClient, kv: KVNamespace,
  monthlyIncome: number, totalObligations: number, proposedInstallment: number
): Promise<DBRResult> {
  const maxDBR = await getConfigNumber(db, kv, 'max_dbr_limit', DEFAULT_MAX_DBR);
  const totalDebt = totalObligations + proposedInstallment;
  const dbr = monthlyIncome > 0 ? totalDebt / monthlyIncome : 1;
  const withinLimit = dbr <= maxDBR;
  const headroom = monthlyIncome * maxDBR - totalDebt;

  return {
    dbr: Math.round(dbr * 10000) / 10000, withinLimit, limit: maxDBR,
    monthlyIncome, totalObligations, proposedInstallment,
    headroom: Math.round(headroom * 100) / 100,
  };
}

// ── Determine Risk Level ────────────────────────────────────────────
export async function determineRiskLevel(
  db: DbClient, kv: KVNamespace,
  dbr: number, delayDays: number, income: number, reason: string,
  employerType: string = 'private', enhancementData?: RiskEnhancementData
): Promise<RiskResult> {
  const normalizedEmployerType = employerType.replace(/_/g, '-')
  const factors: RiskResult['factors'] = [];
  let riskScore = 0;

  const riskLow = await getConfigNumber(db, kv, 'risk_threshold_low', DEFAULT_RISK_THRESHOLD_LOW);
  const riskMedium = await getConfigNumber(db, kv, 'risk_threshold_medium', DEFAULT_RISK_THRESHOLD_MEDIUM);
  const riskHigh = await getConfigNumber(db, kv, 'risk_threshold_high', DEFAULT_RISK_THRESHOLD_HIGH);
  const delayLowDays = await getConfigNumber(db, kv, 'delay_low_risk_days', 90);
  const delayHighDays = await getConfigNumber(db, kv, 'delay_high_risk_days', DEFAULT_HIGH_RISK_DELAY_DAYS);
  const delaySevereDays = await getConfigNumber(db, kv, 'delay_severe_days', 365);
  const employerWeightGov = await getConfigNumber(db, kv, 'employer_weight_government', 0.8);
  const employerWeightSemi = await getConfigNumber(db, kv, 'employer_weight_semi_government', 1.0);
  const employerWeightPrivate = await getConfigNumber(db, kv, 'employer_weight_private', 1.3);

  // Factor 1: DBR (0-25)
  let dbrContribution = dbr > 0.8 ? 25 : dbr > 0.6 ? 20 : dbr > 0.4 ? 12 : dbr > 0.2 ? 5 : 0;
  riskScore += dbrContribution;
  factors.push({ factor: 'debt_burden_ratio', contribution: dbrContribution, description: `DBR of ${(dbr * 100).toFixed(1)}% contributes ${dbrContribution} risk points` });

  // Factor 2: Delay (0-30)
  let delayContribution = delayDays > delaySevereDays ? 30 : delayDays > delayHighDays ? 25 : delayDays > delayLowDays ? 15 : delayDays > 30 ? 8 : 0;
  riskScore += delayContribution;
  factors.push({ factor: 'delay_duration', contribution: delayContribution, description: `${delayDays} days delay contributes ${delayContribution} risk points` });

  // Factor 3: Income (0-20)
  let incomeContribution = income < 5000 ? 20 : income < 10000 ? 15 : income < 20000 ? 8 : income < 35000 ? 3 : 0;
  riskScore += incomeContribution;
  factors.push({ factor: 'income_level', contribution: incomeContribution, description: `Monthly income of AED ${income.toLocaleString()} contributes ${incomeContribution} risk points` });

  // Factor 4: Hardship reason (0-15)
  const highRiskReasons = ['job_loss', 'divorce'];
  const mediumRiskReasons = ['salary_cut', 'retirement'];
  let reasonContribution = highRiskReasons.includes(reason) ? 15 : mediumRiskReasons.includes(reason) ? 10 : reason === 'medical' ? 8 : 5;
  riskScore += reasonContribution;
  factors.push({ factor: 'hardship_reason', contribution: reasonContribution, description: `Hardship reason '${reason}' contributes ${reasonContribution} risk points` });

  // Factor 5: Employer type (0-15)
  let employerContribution = 0;
  let employerWeight = 1.0;
  if (normalizedEmployerType === 'private') { employerWeight = employerWeightPrivate; employerContribution = Math.round(10 * employerWeight); }
  else if (normalizedEmployerType === 'semi-government') { employerWeight = employerWeightSemi; employerContribution = Math.round(5 * employerWeight); }
  else if (normalizedEmployerType === 'government') { employerWeight = employerWeightGov; employerContribution = Math.round(2 * employerWeight); }
  employerContribution = Math.max(0, Math.min(15, employerContribution));
  riskScore += employerContribution;
  factors.push({ factor: 'employer_type', contribution: employerContribution, description: `${normalizedEmployerType} employment (weight: ${employerWeight}×) contributes ${employerContribution} risk points` });

  // MOEI: Factor 6 - Income per family member (0-5)
  if (enhancementData?.incomePerMemberBelowThreshold !== undefined) {
    const w = await getConfigNumber(db, kv, 'risk_weight_income_per_member', 5);
    const c = enhancementData.incomePerMemberBelowThreshold ? w : 0;
    riskScore += c;
    factors.push({ factor: 'income_per_family_member', contribution: c, description: enhancementData.incomePerMemberBelowThreshold ? `Income per family member below threshold adds ${c} risk points` : 'Income per family member above threshold' });
  }

  // MOEI: Factor 7 - Income stability (0-8)
  if (enhancementData?.incomeStabilityLevel !== undefined) {
    const w = await getConfigNumber(db, kv, 'risk_weight_income_stability', 8);
    let c = 0;
    switch (enhancementData.incomeStabilityLevel) {
      case 'critical': c = w; break;
      case 'unstable': c = Math.round(w * 0.7); break;
      case 'moderately_stable': c = Math.round(w * 0.35); break;
      case 'stable': c = 0; break;
    }
    riskScore += c;
    factors.push({ factor: 'income_stability', contribution: c, description: `Income stability level '${enhancementData.incomeStabilityLevel}' contributes ${c} risk points` });
  }

  // MOEI: Factor 8 - Payment history (0-7)
  if (enhancementData?.paymentHistoryPattern !== undefined) {
    const w = await getConfigNumber(db, kv, 'risk_weight_payment_history', 7);
    let c = 0;
    switch (enhancementData.paymentHistoryPattern) {
      case 'critical': c = w; break;
      case 'poor': c = Math.round(w * 0.7); break;
      case 'fair': c = Math.round(w * 0.4); break;
      case 'good': c = Math.round(w * 0.15); break;
      case 'excellent': c = 0; break;
    }
    riskScore += c;
    factors.push({ factor: 'payment_history', contribution: c, description: `Payment history pattern '${enhancementData.paymentHistoryPattern}' contributes ${c} risk points` });
  }

  riskScore = Math.min(riskScore, 100);

  let riskLevel: RiskResult['riskLevel'];
  if (riskScore >= riskHigh) riskLevel = 'critical';
  else if (riskScore >= riskMedium) riskLevel = 'high';
  else if (riskScore >= riskLow) riskLevel = 'medium';
  else riskLevel = 'low';

  return { riskLevel, riskScore, factors };
}

// ── Calculate Rescheduling ──────────────────────────────────────────
export async function calculateRescheduling(
  db: DbClient, kv: KVNamespace,
  loan: LoanData, arrear: ArrearData, requestedDuration: number,
  monthlyIncome: number, otherObligations: number = 0
): Promise<ReschedulingResult> {
  const warnings: string[] = [];
  const maxAssistanceAmount = await getConfigNumber(db, kv, 'max_grant_amount', DEFAULT_MAX_ASSISTANCE_AMOUNT);
  const maxDBR = await getConfigNumber(db, kv, 'max_dbr_limit', DEFAULT_MAX_DBR);
  const highRiskDelayDays = await getConfigNumber(db, kv, 'delay_high_risk_days', DEFAULT_HIGH_RISK_DELAY_DAYS);
  const gracePeriodMedical = await getConfigNumber(db, kv, 'grace_period_for_medical', 3);
  const gracePeriodDivorce = await getConfigNumber(db, kv, 'grace_period_for_divorce', 3);

  const totalAmount = loan.remainingBalance + arrear.totalOverdue;
  const maxRemainingDuration = loan.loanDurationMonths - loan.elapsedMonths;

  if (requestedDuration > maxRemainingDuration) {
    warnings.push(`Requested duration (${requestedDuration} months) exceeds remaining period of ${maxRemainingDuration} months. Capped.`);
  }
  const effectiveDuration = Math.min(requestedDuration, maxRemainingDuration);

  if (effectiveDuration <= 0) {
    return { feasible: false, recommendedAmount: 0, recommendedDuration: 0, recommendedInstallment: 0, proposedDBR: 0, currentDBR: 0, savingsPerMonth: 0, totalInterestCost: 0, warnings: ['Loan duration exhausted.'] };
  }

  const proposedInstallment = Math.ceil(totalAmount / effectiveDuration);
  const currentDBR = monthlyIncome > 0 ? (loan.monthlyInstallment + otherObligations) / monthlyIncome : 1;
  const proposedDBR = monthlyIncome > 0 ? (proposedInstallment + otherObligations) / monthlyIncome : 1;
  const feasible = proposedDBR <= maxDBR;

  if (!feasible) warnings.push(`Proposed DBR ${(proposedDBR * 100).toFixed(1)}% exceeds ${maxDBR * 100}% limit.`);
  const savingsPerMonth = loan.monthlyInstallment - proposedInstallment;

  if (arrear.reason === 'medical') warnings.push(`Medical hardship - consider grace period of ${gracePeriodMedical} months`);
  if (arrear.reason === 'divorce') warnings.push(`Divorce hardship - consider grace period of ${gracePeriodDivorce} months`);
  if (arrear.reason === 'retirement') warnings.push('Retirement hardship - verify pension income');
  if (loan.originalAmount > maxAssistanceAmount) warnings.push(`Loan amount exceeds AED ${maxAssistanceAmount.toLocaleString()} maximum`);
  if (arrear.delayDays > highRiskDelayDays) warnings.push(`Delay exceeds ${highRiskDelayDays} days - high risk`);

  return {
    feasible, recommendedAmount: Math.min(totalAmount, maxAssistanceAmount),
    recommendedDuration: effectiveDuration, recommendedInstallment: proposedInstallment,
    proposedDBR: Math.round(proposedDBR * 10000) / 10000,
    currentDBR: Math.round(currentDBR * 10000) / 10000,
    savingsPerMonth: Math.round(savingsPerMonth * 100) / 100, totalInterestCost: 0, warnings,
  };
}

// ── Run Governance Checks ───────────────────────────────────────────
export async function runGovernanceChecks(
  db: DbClient, kv: KVNamespace,
  applicant: ApplicantData, loan: LoanData, arrear: ArrearData,
  proposedDuration: number
): Promise<{ compliant: boolean; checks: { ruleCode: string; ruleName: string; passed: boolean; message: string; category: string }[] }> {
  const eligibilityResult = await checkEligibility(db, kv, applicant, loan, arrear);
  const proposedInstallment = proposedDuration > 0 ? loan.remainingBalance / proposedDuration : 0;
  const dbrResult = await calculateDBR(db, kv, applicant.monthlyIncome, 0, proposedInstallment);
  const riskResult = await determineRiskLevel(db, kv, dbrResult.dbr, arrear.delayDays, applicant.monthlyIncome, arrear.reason || 'other', applicant.employerType);

  const maxDBR = await getConfigNumber(db, kv, 'max_dbr_limit', DEFAULT_MAX_DBR);
  const maxAssistanceAmount = await getConfigNumber(db, kv, 'max_grant_amount', DEFAULT_MAX_ASSISTANCE_AMOUNT);
  const highRiskDelayDays = await getConfigNumber(db, kv, 'delay_high_risk_days', DEFAULT_HIGH_RISK_DELAY_DAYS);

  const checks: { ruleCode: string; ruleName: string; passed: boolean; message: string; category: string }[] = [];

  for (const check of eligibilityResult.checks) {
    checks.push({ ruleCode: `ELIG-${check.rule.toUpperCase()}`, ruleName: check.rule.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), passed: check.passed, message: check.message, category: 'eligibility' });
  }

  checks.push({ ruleCode: 'DBR-001', ruleName: 'Debt Burden Ratio Limit', passed: dbrResult.withinLimit, message: dbrResult.withinLimit ? `DBR ${(dbrResult.dbr * 100).toFixed(1)}% within ${maxDBR * 100}% limit` : `DBR ${(dbrResult.dbr * 100).toFixed(1)}% exceeds ${maxDBR * 100}% limit`, category: 'debt_burden' });

  const maxRemainingDuration = loan.loanDurationMonths - loan.elapsedMonths;
  checks.push({ ruleCode: 'DUR-001', ruleName: 'Maximum Loan Duration', passed: proposedDuration <= maxRemainingDuration, message: proposedDuration <= maxRemainingDuration ? `Duration within ${maxRemainingDuration}-month maximum` : `Duration exceeds ${maxRemainingDuration}-month maximum`, category: 'duration' });
  checks.push({ ruleCode: 'AMT-001', ruleName: 'Maximum Assistance Amount', passed: loan.originalAmount <= maxAssistanceAmount, message: loan.originalAmount <= maxAssistanceAmount ? 'Amount within cap' : 'Amount exceeds cap', category: 'amount' });
  checks.push({ ruleCode: 'RISK-001', ruleName: 'Risk Classification', passed: riskResult.riskLevel !== 'critical', message: `Risk level: ${riskResult.riskLevel} (score: ${riskResult.riskScore})`, category: 'risk' });
  checks.push({ ruleCode: 'DELAY-001', ruleName: 'Arrears Delay Duration', passed: arrear.delayDays <= highRiskDelayDays, message: arrear.delayDays <= highRiskDelayDays ? 'Delay within range' : `Delay exceeds ${highRiskDelayDays}-day threshold`, category: 'risk' });

  const hasValidReason = [
    'job_loss',
    'medical',
    'salary_cut',
    'divorce',
    'retirement',
    'reschedule_arrears',
    'postpone_instalment',
    'reduce_instalment',
    'other',
  ].includes(arrear.reason || '');
  checks.push({ ruleCode: 'DOC-001', ruleName: 'Supporting Documentation', passed: hasValidReason, message: hasValidReason ? 'Hardship reason documented' : 'Insufficient documentation', category: 'documentation' });

  if (['medical', 'divorce', 'retirement'].includes(arrear.reason || '')) {
    checks.push({ ruleCode: 'HARDSHIP-001', ruleName: 'Special Hardship Provision', passed: true, message: `${arrear.reason} hardship qualifies for special handling`, category: 'eligibility' });
  }

  const compliant = checks.every(c => c.passed || c.category === 'risk');
  return { compliant, checks };
}

// ══════════════════════════════════════════════════════════════════════
// MOEI-SPECIFIC RULES
// ══════════════════════════════════════════════════════════════════════

export async function calculateIncomePerFamilyMember(
  db: DbClient, kv: KVNamespace,
  totalHouseholdIncome: number, familySize: number
): Promise<IncomePerMemberResult> {
  const threshold = await getConfigNumber(db, kv, 'income_per_member_threshold', 2500);
  const safeFamilySize = Math.max(familySize, 1);
  const incomePerMember = Math.round((totalHouseholdIncome / safeFamilySize) * 100) / 100;
  return { incomePerMember, belowThreshold: incomePerMember < threshold, threshold };
}

export async function analyzeIncomeStability(
  db: DbClient, kv: KVNamespace,
  currentIncome: number, previousIncome: number | null,
  incomeStability: string, employerType: string
): Promise<IncomeStabilityResult> {
  const factors: IncomeStabilityResult['factors'] = [];
  let stabilityScore = 50;
  const normalizedEmployerType = employerType.replace(/_/g, '-');

  const govBonus = await getConfigNumber(db, kv, 'stability_bonus_government', 25);
  const semiGovBonus = await getConfigNumber(db, kv, 'stability_bonus_semi_government', 15);
  const privateBonus = await getConfigNumber(db, kv, 'stability_bonus_private', 0);

  if (normalizedEmployerType === 'government') { stabilityScore += govBonus; factors.push({ factor: 'employer_type', impact: 'positive', description: `Government employment (+${govBonus})` }); }
  else if (normalizedEmployerType === 'semi-government') { stabilityScore += semiGovBonus; factors.push({ factor: 'employer_type', impact: 'positive', description: `Semi-government (+${semiGovBonus})` }); }
  else { stabilityScore += privateBonus; factors.push({ factor: 'employer_type', impact: 'neutral', description: 'Private sector' }); }

  if (previousIncome !== null && previousIncome > 0) {
    const ratio = (currentIncome - previousIncome) / previousIncome;
    if (ratio >= 0) { const b = Math.min(15, Math.round(ratio * 30)); stabilityScore += b; factors.push({ factor: 'income_trend', impact: 'positive', description: `Income increased (+${b})` }); }
    else if (ratio > -0.2) { stabilityScore -= 10; factors.push({ factor: 'income_trend', impact: 'negative', description: 'Income slightly decreased (-10)' }); }
    else if (ratio > -0.5) { stabilityScore -= 25; factors.push({ factor: 'income_trend', impact: 'negative', description: 'Income significantly decreased (-25)' }); }
    else { stabilityScore -= 40; factors.push({ factor: 'income_trend', impact: 'critical', description: 'Income severely decreased (-40)' }); }
  } else { factors.push({ factor: 'income_trend', impact: 'neutral', description: 'No previous income data' }); }

  const pLost = await getConfigNumber(db, kv, 'stability_penalty_income_lost', 40);
  const pReduced = await getConfigNumber(db, kv, 'stability_penalty_income_reduced', 20);
  const pVariable = await getConfigNumber(db, kv, 'stability_penalty_income_variable', 10);
  const bStable = await getConfigNumber(db, kv, 'stability_bonus_income_stable', 10);

  switch (incomeStability.toLowerCase()) {
    case 'stable': stabilityScore += bStable; factors.push({ factor: 'declared_stability', impact: 'positive', description: `Stable (+${bStable})` }); break;
    case 'reduced': stabilityScore -= pReduced; factors.push({ factor: 'declared_stability', impact: 'negative', description: `Reduced (-${pReduced})` }); break;
    case 'lost': stabilityScore -= pLost; factors.push({ factor: 'declared_stability', impact: 'critical', description: `Lost (-${pLost})` }); break;
    case 'variable': stabilityScore -= pVariable; factors.push({ factor: 'declared_stability', impact: 'negative', description: `Variable (-${pVariable})` }); break;
  }

  stabilityScore = Math.max(0, Math.min(100, stabilityScore));
  const sT = await getConfigNumber(db, kv, 'stability_level_stable', 75);
  const mT = await getConfigNumber(db, kv, 'stability_level_moderate', 50);
  const uT = await getConfigNumber(db, kv, 'stability_level_unstable', 25);

  let stabilityLevel: IncomeStabilityResult['stabilityLevel'];
  if (stabilityScore >= sT) stabilityLevel = 'stable';
  else if (stabilityScore >= mT) stabilityLevel = 'moderately_stable';
  else if (stabilityScore >= uT) stabilityLevel = 'unstable';
  else stabilityLevel = 'critical';

  return { stabilityScore, stabilityLevel, factors };
}

export async function analyzePaymentHistory(
  db: DbClient, kv: KVNamespace,
  paymentHistory: PaymentHistoryEntry[], totalMissedPayments: number,
  reschedulingCount: number, loanDurationMonths: number, elapsedMonths: number
): Promise<PaymentHistoryResult> {
  const factors: PaymentHistoryResult['factors'] = [];

  const totalPayments = paymentHistory.length;
  const onTimePayments = paymentHistory.filter(p => ['paid', 'on_time', 'paid_on_time'].includes(p.status)).length;
  const onTimeRate = totalPayments > 0 ? (onTimePayments / totalPayments) * 100 : 0;
  let paymentScore = 100;

  if (totalPayments > 0) {
    const missedRate = 100 - onTimeRate;
    paymentScore -= Math.round((missedRate / 100) * 40);
    factors.push({ factor: 'on_time_rate', description: `On-time rate: ${onTimeRate.toFixed(1)}%` });
  } else if (elapsedMonths > 0) {
    const inferredOnTime = Math.max(0, elapsedMonths - totalMissedPayments);
    const inferredRate = (inferredOnTime / elapsedMonths) * 100;
    paymentScore -= Math.round(((100 - inferredRate) / 100) * 40);
    factors.push({ factor: 'on_time_rate_inferred', description: `Inferred on-time rate: ${inferredRate.toFixed(1)}%` });
  }

  const pLow = await getConfigNumber(db, kv, 'payment_penalty_missed_low', 5);
  const pMed = await getConfigNumber(db, kv, 'payment_penalty_missed_medium', 15);
  const pHigh = await getConfigNumber(db, kv, 'payment_penalty_missed_high', 25);

  if (totalMissedPayments === 0) factors.push({ factor: 'missed_payments', description: 'No missed payments' });
  else if (totalMissedPayments <= 2) { paymentScore -= pLow; factors.push({ factor: 'missed_payments', description: `${totalMissedPayments} missed (-${pLow})` }); }
  else if (totalMissedPayments <= 6) { paymentScore -= pMed; factors.push({ factor: 'missed_payments', description: `${totalMissedPayments} missed (-${pMed})` }); }
  else { paymentScore -= pHigh; factors.push({ factor: 'missed_payments', description: `${totalMissedPayments} missed (-${pHigh})` }); }

  const rPenalty = await getConfigNumber(db, kv, 'payment_penalty_per_reschedule', 10);
  if (reschedulingCount > 0) {
    const d = Math.min(reschedulingCount * rPenalty, 25);
    paymentScore -= d;
    factors.push({ factor: 'rescheduling_history', description: `${reschedulingCount} rescheduling(s) (-${d})` });
  } else { factors.push({ factor: 'rescheduling_history', description: 'First-time applicant' }); }

  if (totalPayments >= 6) {
    const recent = paymentHistory.slice(-3).filter(p => ['paid', 'on_time'].includes(p.status)).length;
    const older = paymentHistory.slice(-6, -3).filter(p => ['paid', 'on_time'].includes(p.status)).length;
    if (recent > older) { paymentScore += 5; factors.push({ factor: 'payment_trajectory', description: 'Improving trend (+5)' }); }
    else if (recent < older) { paymentScore -= 10; factors.push({ factor: 'payment_trajectory', description: 'Deteriorating trend (-10)' }); }
    else factors.push({ factor: 'payment_trajectory', description: 'Stable trend' });
  }

  paymentScore = Math.max(0, Math.min(100, paymentScore));

  const eT = await getConfigNumber(db, kv, 'payment_pattern_excellent', 85);
  const gT = await getConfigNumber(db, kv, 'payment_pattern_good', 70);
  const fT = await getConfigNumber(db, kv, 'payment_pattern_fair', 50);
  const pT = await getConfigNumber(db, kv, 'payment_pattern_poor', 30);

  let pattern: PaymentHistoryResult['pattern'];
  if (paymentScore >= eT) pattern = 'excellent';
  else if (paymentScore >= gT) pattern = 'good';
  else if (paymentScore >= fT) pattern = 'fair';
  else if (paymentScore >= pT) pattern = 'poor';
  else pattern = 'critical';

  return { paymentScore, pattern, onTimeRate: Math.round(onTimeRate * 100) / 100, factors };
}

export async function checkDocumentCompleteness(
  db: DbClient, kv: KVNamespace,
  supportingDocuments: string[], reasonCategory: string
): Promise<DocumentCompletenessResult> {
  const requiredDocuments = ['salary_certificate', 'income_statement'];
  const reasonSpecific: Record<string, string[]> = {
    job_loss: ['termination_letter', 'employment_history'],
    medical: ['medical_report', 'hospital_bill'],
    salary_cut: ['salary_change_letter', 'employer_letter'],
    divorce: ['divorce_certificate', 'court_order'],
    retirement: ['retirement_letter', 'pension_statement'],
  };

  const additionalDocs = reasonSpecific[reasonCategory] || [];
  const allRequired = [...requiredDocuments, ...additionalDocs];
  const checks = allRequired.map(doc => ({
    document: doc,
    required: true,
    provided: doc === 'income_statement'
      ? supportingDocuments.some(d => ['income_statement', 'bank_statement', 'detailed_salary_statement'].includes(d))
      : supportingDocuments.includes(doc),
  }));

  const missingDocuments = checks.filter(c => !c.provided).map(c => c.document);
  return { complete: missingDocuments.length === 0, missingDocuments, checks };
}

export async function calculateMoeiCompliance(
  db: DbClient, kv: KVNamespace,
  applicant: ApplicantData, loan: LoanData, arrear: ArrearData,
  requestedDuration: number, proposedInstallment: number
): Promise<MoeiComplianceResult> {
  const maxDeductionRate = await getConfigNumber(db, kv, 'moei_max_deduction_rate', 0.20);
  const deductionRate = applicant.monthlyIncome > 0 ? proposedInstallment / applicant.monthlyIncome : 1;
  const deductionRulePassed = deductionRate <= maxDeductionRate;

  const maxRemainingPeriod = loan.loanDurationMonths - loan.elapsedMonths;
  const periodRulePassed = requestedDuration <= maxRemainingPeriod;

  const checks: MoeiComplianceResult['checks'] = [
    { rule: '20_percent_deduction', passed: deductionRulePassed, message: deductionRulePassed ? `Deduction rate ${(deductionRate * 100).toFixed(1)}% within 20% limit` : `Deduction rate ${(deductionRate * 100).toFixed(1)}% exceeds 20% limit`, severity: deductionRulePassed ? 'info' : 'critical' },
    { rule: 'period_rule', passed: periodRulePassed, message: periodRulePassed ? `Duration within remaining period` : `Duration exceeds remaining period of ${maxRemainingPeriod} months`, severity: periodRulePassed ? 'info' : 'critical' },
  ];

  return {
    compliant: deductionRulePassed && periodRulePassed,
    deductionRulePassed, periodRulePassed,
    deductionRate, maxDeductionRate,
    remainingPeriod: maxRemainingPeriod, checks,
  };
}

export async function generateMoeiRecommendation(
  db: DbClient, kv: KVNamespace,
  eligibility: EligibilityResult, moeiCompliance: MoeiComplianceResult,
  risk: RiskResult, incomePerMember: IncomePerMemberResult,
  incomeStability: IncomeStabilityResult, paymentHistory: PaymentHistoryResult,
  documentCompleteness: DocumentCompletenessResult
): Promise<MoeiRecommendationResult> {
  if (!eligibility.eligible || risk.riskLevel === 'critical') {
    return { recommendation: 'reject', reasoning: 'Ineligible or critical risk', caseSummary: 'Case does not meet basic eligibility criteria or presents critical risk.' };
  }

  if (!documentCompleteness.complete) {
    return { recommendation: 'request_documents', reasoning: `Missing documents: ${documentCompleteness.missingDocuments.join(', ')}`, caseSummary: 'Application is incomplete. Required documents must be provided before assessment can proceed.' };
  }

  if (!moeiCompliance.deductionRulePassed || !moeiCompliance.periodRulePassed) {
    return { recommendation: 'refer_to_employee', reasoning: `Moei compliance issues: deduction=${moeiCompliance.deductionRulePassed ? 'pass' : 'fail'}, period=${moeiCompliance.periodRulePassed ? 'pass' : 'fail'}`, caseSummary: 'Case requires manual review due to MOEI compliance issues.' };
  }

  if (risk.riskLevel === 'high' || incomeStability.stabilityLevel === 'critical' || incomeStability.stabilityLevel === 'unstable') {
    return { recommendation: 'conditionally_approve', reasoning: 'Approvable with conditions. High risk or unstable income requires monitoring.', caseSummary: 'Case is conditionally approvable with enhanced monitoring and conditions.' };
  }

  return { recommendation: 'approve', reasoning: 'All criteria met. Low risk, stable income, compliant with MOEI rules.', caseSummary: 'Case meets all criteria for approval under MOEI guidelines.' };
}
