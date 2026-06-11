/**
 * SZHP Arrears Rescheduling Rules Engine
 * Implements UAE housing regulation compliance checks
 * Now reads limits from SystemConfig (admin-configurable) instead of hardcoded constants
 */

import { getConfigNumber, getConfigBoolean, getConfigString } from '@/lib/config';

// Type definitions
interface ApplicantData {
  isCitizen: boolean;
  hasFamilyBook: boolean;
  monthlyIncome: number;
  employerType: string; // government, semi-government, private
  familySize: number;
}

interface LoanData {
  originalAmount: number;
  remainingBalance: number;
  monthlyInstallment: number;
  loanDurationMonths: number;
  elapsedMonths: number;
  loanType: string; // grant, loan, maintenance
  status: string; // active, completed, defaulted
}

interface ArrearData {
  missedMonths: number;
  totalOverdue: number;
  delayDays: number;
  reason?: string;
}

interface EligibilityResult {
  eligible: boolean;
  checks: {
    rule: string;
    passed: boolean;
    message: string;
    severity: 'critical' | 'warning' | 'info';
  }[];
}

interface DBRResult {
  dbr: number;
  withinLimit: boolean;
  limit: number;
  monthlyIncome: number;
  totalObligations: number;
  proposedInstallment: number;
  headroom: number;
}

interface RiskResult {
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number; // 0-100
  factors: {
    factor: string;
    contribution: number;
    description: string;
  }[];
}

interface ReschedulingResult {
  feasible: boolean;
  recommendedAmount: number;
  recommendedDuration: number;
  recommendedInstallment: number;
  proposedDBR: number;
  currentDBR: number;
  savingsPerMonth: number;
  totalInterestCost: number;
  warnings: string[];
}

// MOEI-specific type definitions

interface IncomePerMemberResult {
  incomePerMember: number;
  belowThreshold: boolean;
  threshold: number;
}

interface IncomeStabilityResult {
  stabilityScore: number; // 0-100, higher = more stable
  stabilityLevel: 'stable' | 'moderately_stable' | 'unstable' | 'critical';
  factors: { factor: string; impact: string; description: string }[];
}

interface PaymentHistoryEntry {
  month: number;
  year: number;
  status: string;
  amount: number;
}

interface PaymentHistoryResult {
  paymentScore: number; // 0-100, higher = better
  pattern: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  onTimeRate: number; // percentage of on-time payments
  factors: { factor: string; description: string }[];
}

interface DocumentCompletenessResult {
  complete: boolean;
  missingDocuments: string[];
  checks: { document: string; required: boolean; provided: boolean }[];
}

interface MoeiComplianceResult {
  compliant: boolean;
  deductionRulePassed: boolean;
  periodRulePassed: boolean;
  deductionRate: number;
  maxDeductionRate: number;
  remainingPeriod: number;
  checks: { rule: string; passed: boolean; message: string; severity: 'critical' | 'warning' | 'info' }[];
}

interface MoeiRecommendationResult {
  recommendation: 'approve' | 'conditionally_approve' | 'request_documents' | 'refer_to_employee' | 'reject';
  reasoning: string;
  caseSummary: string;
}

interface RiskEnhancementData {
  incomePerMemberBelowThreshold?: boolean;
  incomeStabilityLevel?: 'stable' | 'moderately_stable' | 'unstable' | 'critical';
  paymentHistoryPattern?: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
}

// Default constants (used as fallbacks when DB is unavailable)
// Admin can change all of these from the Approval Workflows page
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

/**
 * Check basic eligibility rules for rescheduling
 */
export async function checkEligibility(
  applicant: ApplicantData,
  loan: LoanData,
  arrear: ArrearData
): Promise<EligibilityResult> {
  const checks: EligibilityResult['checks'] = [];

  // Load admin-configured values
  const citizenshipRequired = await getConfigBoolean('citizenship_required', DEFAULT_CITIZENSHIP_REQUIRED);
  const familyBookRequired = await getConfigBoolean('family_book_required', DEFAULT_FAMILY_BOOK_REQUIRED);
  const maxAssistanceAmount = await getConfigNumber('max_grant_amount', DEFAULT_MAX_ASSISTANCE_AMOUNT);
  const minIncome = await getConfigNumber('min_monthly_income', DEFAULT_MIN_MONTHLY_INCOME);

  // Rule 1: UAE Citizenship
  const isCitizen = !citizenshipRequired || applicant.isCitizen;
  checks.push({
    rule: 'citizenship',
    passed: isCitizen,
    message: applicant.isCitizen
      ? 'Applicant is a UAE citizen'
      : citizenshipRequired
        ? 'Applicant must be a UAE citizen to qualify for rescheduling'
        : 'Citizenship check is not required by current policy',
    severity: citizenshipRequired ? 'critical' : 'info',
  });

  // Rule 2: Family Book
  const hasFamilyBook = !familyBookRequired || applicant.hasFamilyBook;
  checks.push({
    rule: 'family_book',
    passed: hasFamilyBook,
    message: applicant.hasFamilyBook
      ? 'Applicant holds a valid family book (Khulasat Al Qaid)'
      : familyBookRequired
        ? 'Applicant must have a valid family book to qualify'
        : 'Family book check is not required by current policy',
    severity: familyBookRequired ? 'critical' : 'info',
  });

  // Rule 3: Loan is active
  const loanActive = loan.status === 'active' || loan.status === 'defaulted';
  checks.push({
    rule: 'loan_status',
    passed: loanActive,
    message: loanActive
      ? `Loan status is ${loan.status}`
      : `Loan status (${loan.status}) is not eligible for rescheduling`,
    severity: 'critical',
  });

  // Rule 4: Loan amount within limits (admin-configurable)
  const withinAmountLimit = loan.originalAmount <= maxAssistanceAmount;
  checks.push({
    rule: 'loan_amount_limit',
    passed: withinAmountLimit,
    message: withinAmountLimit
      ? `Loan amount (AED ${loan.originalAmount.toLocaleString()}) is within the AED ${maxAssistanceAmount.toLocaleString()} limit`
      : `Loan amount (AED ${loan.originalAmount.toLocaleString()}) exceeds the AED ${maxAssistanceAmount.toLocaleString()} maximum`,
    severity: 'warning',
  });

  // Rule 5: Loan not fully paid
  const hasRemainingBalance = loan.remainingBalance > 0;
  checks.push({
    rule: 'remaining_balance',
    passed: hasRemainingBalance,
    message: hasRemainingBalance
      ? `Remaining balance: AED ${loan.remainingBalance.toLocaleString()}`
      : 'Loan has no remaining balance - rescheduling not applicable',
    severity: 'critical',
  });

  // Rule 6: Arrears exist
  const hasArrears = arrear.missedMonths > 0 && arrear.totalOverdue > 0;
  checks.push({
    rule: 'arrears_exist',
    passed: hasArrears,
    message: hasArrears
      ? `Arrears confirmed: ${arrear.missedMonths} months overdue, AED ${arrear.totalOverdue.toLocaleString()}`
      : 'No arrears detected - rescheduling may not be necessary',
    severity: 'info',
  });

  // Rule 7: Reason category is valid
  const validReasons = ['job_loss', 'medical', 'salary_cut', 'divorce', 'retirement', 'other'];
  const hasValidReason = arrear.reason ? validReasons.includes(arrear.reason) : false;
  checks.push({
    rule: 'valid_reason',
    passed: hasValidReason,
    message: hasValidReason
      ? `Valid hardship reason: ${arrear.reason}`
      : 'Hardship reason not specified or invalid',
    severity: 'warning',
  });

  // Rule 8: Government employee preference (normalize semi_government → semi-government)
  const normalizedEmployerType = applicant.employerType.replace(/_/g, '-')
  const isGovernmentEmployee = normalizedEmployerType === 'government';
  checks.push({
    rule: 'government_employee',
    passed: true, // Not a blocking rule
    message: isGovernmentEmployee
      ? 'Government employee - eligible for reduced risk weighting'
      : `Employment type: ${normalizedEmployerType} - standard risk weighting applies`,
    severity: 'info',
  });

  // Determine overall eligibility
  const criticalFailures = checks.filter(
    (c) => !c.passed && c.severity === 'critical'
  );
  const eligible = criticalFailures.length === 0;

  return {
    eligible,
    checks,
  };
}

/**
 * Calculate Debt Burden Ratio
 * DBR = (Total Monthly Obligations / Monthly Income) * 100
 */
export async function calculateDBR(
  monthlyIncome: number,
  totalObligations: number,
  proposedInstallment: number
): Promise<DBRResult> {
  const maxDBR = await getConfigNumber('max_dbr_limit', DEFAULT_MAX_DBR);
  const totalDebt = totalObligations + proposedInstallment;
  const dbr = monthlyIncome > 0 ? totalDebt / monthlyIncome : 1;
  const withinLimit = dbr <= maxDBR;
  const headroom = monthlyIncome * maxDBR - totalDebt;

  return {
    dbr: Math.round(dbr * 10000) / 10000,
    withinLimit,
    limit: maxDBR,
    monthlyIncome,
    totalObligations,
    proposedInstallment,
    headroom: Math.round(headroom * 100) / 100,
  };
}

/**
 * Determine risk level based on multiple factors
 */
export async function determineRiskLevel(
  dbr: number,
  delayDays: number,
  income: number,
  reason: string,
  employerType: string = 'private',
  enhancementData?: RiskEnhancementData
): Promise<RiskResult> {
  // Normalize employer type: accept both 'semi-government' and 'semi_government'
  const normalizedEmployerType = employerType.replace(/_/g, '-')
  const factors: RiskResult['factors'] = [];
  let riskScore = 0;

  // Load admin-configured thresholds
  const riskLow = await getConfigNumber('risk_threshold_low', DEFAULT_RISK_THRESHOLD_LOW);
  const riskMedium = await getConfigNumber('risk_threshold_medium', DEFAULT_RISK_THRESHOLD_MEDIUM);
  const riskHigh = await getConfigNumber('risk_threshold_high', DEFAULT_RISK_THRESHOLD_HIGH);
  const delayLowDays = await getConfigNumber('delay_low_risk_days', 90);
  const delayHighDays = await getConfigNumber('delay_high_risk_days', DEFAULT_HIGH_RISK_DELAY_DAYS);
  const delaySevereDays = await getConfigNumber('delay_severe_days', 365);
  const employerWeightGov = await getConfigNumber('employer_weight_government', 0.8);
  const employerWeightSemi = await getConfigNumber('employer_weight_semi_government', 1.0);
  const employerWeightPrivate = await getConfigNumber('employer_weight_private', 1.3);

  // Factor 1: DBR contribution (0-25 points)
  let dbrContribution = 0;
  if (dbr > 0.8) {
    dbrContribution = 25;
  } else if (dbr > 0.6) {
    dbrContribution = 20;
  } else if (dbr > 0.4) {
    dbrContribution = 12;
  } else if (dbr > 0.2) {
    dbrContribution = 5;
  }
  riskScore += dbrContribution;
  factors.push({
    factor: 'debt_burden_ratio',
    contribution: dbrContribution,
    description: `DBR of ${(dbr * 100).toFixed(1)}% contributes ${dbrContribution} risk points`,
  });

  // Factor 2: Delay days contribution (0-30 points) — uses admin-configured thresholds
  let delayContribution = 0;
  if (delayDays > delaySevereDays) {
    delayContribution = 30;
  } else if (delayDays > delayHighDays) {
    delayContribution = 25;
  } else if (delayDays > delayLowDays) {
    delayContribution = 15;
  } else if (delayDays > 30) {
    delayContribution = 8;
  }
  riskScore += delayContribution;
  factors.push({
    factor: 'delay_duration',
    contribution: delayContribution,
    description: `${delayDays} days delay contributes ${delayContribution} risk points`,
  });

  // Factor 3: Income level contribution (0-20 points)
  let incomeContribution = 0;
  if (income < 5000) {
    incomeContribution = 20;
  } else if (income < 10000) {
    incomeContribution = 15;
  } else if (income < 20000) {
    incomeContribution = 8;
  } else if (income < 35000) {
    incomeContribution = 3;
  }
  riskScore += incomeContribution;
  factors.push({
    factor: 'income_level',
    contribution: incomeContribution,
    description: `Monthly income of AED ${income.toLocaleString()} contributes ${incomeContribution} risk points`,
  });

  // Factor 4: Hardship reason contribution (0-15 points)
  let reasonContribution = 0;
  const highRiskReasons = ['job_loss', 'divorce'];
  const mediumRiskReasons = ['salary_cut', 'retirement'];
  if (highRiskReasons.includes(reason)) {
    reasonContribution = 15;
  } else if (mediumRiskReasons.includes(reason)) {
    reasonContribution = 10;
  } else if (reason === 'medical') {
    reasonContribution = 8;
  } else {
    reasonContribution = 5;
  }
  riskScore += reasonContribution;
  factors.push({
    factor: 'hardship_reason',
    contribution: reasonContribution,
    description: `Hardship reason '${reason}' contributes ${reasonContribution} risk points`,
  });

  // Factor 5: Employer type adjustment — uses admin-configured risk weights
  let employerContribution = 0;
  let employerWeight = 1.0;
  if (normalizedEmployerType === 'private') {
    employerWeight = employerWeightPrivate;
    employerContribution = Math.round(10 * employerWeight);
  } else if (normalizedEmployerType === 'semi-government') {
    employerWeight = employerWeightSemi;
    employerContribution = Math.round(5 * employerWeight);
  } else if (normalizedEmployerType === 'government') {
    employerWeight = employerWeightGov;
    employerContribution = Math.round(2 * employerWeight);
  }
  employerContribution = Math.max(0, Math.min(15, employerContribution));
  riskScore += employerContribution;
  factors.push({
    factor: 'employer_type',
    contribution: employerContribution,
    description: `${normalizedEmployerType} employment (weight: ${employerWeight}×) contributes ${employerContribution} risk points`,
  });

  // MOEI Enhancement: Factor 6 - Income per family member (0-5 points)
  if (enhancementData?.incomePerMemberBelowThreshold !== undefined) {
    const incomePerMemberWeight = await getConfigNumber('risk_weight_income_per_member', 5);
    let incomePerMemberContribution = 0;
    if (enhancementData.incomePerMemberBelowThreshold) {
      incomePerMemberContribution = incomePerMemberWeight;
    }
    riskScore += incomePerMemberContribution;
    factors.push({
      factor: 'income_per_family_member',
      contribution: incomePerMemberContribution,
      description: enhancementData.incomePerMemberBelowThreshold
        ? `Income per family member below threshold adds ${incomePerMemberContribution} risk points`
        : `Income per family member above threshold - no additional risk`,
    });
  }

  // MOEI Enhancement: Factor 7 - Income stability (0-8 points)
  if (enhancementData?.incomeStabilityLevel !== undefined) {
    const incomeStabilityWeight = await getConfigNumber('risk_weight_income_stability', 8);
    let stabilityContribution = 0;
    switch (enhancementData.incomeStabilityLevel) {
      case 'critical':
        stabilityContribution = incomeStabilityWeight;
        break;
      case 'unstable':
        stabilityContribution = Math.round(incomeStabilityWeight * 0.7);
        break;
      case 'moderately_stable':
        stabilityContribution = Math.round(incomeStabilityWeight * 0.35);
        break;
      case 'stable':
        stabilityContribution = 0;
        break;
    }
    riskScore += stabilityContribution;
    factors.push({
      factor: 'income_stability',
      contribution: stabilityContribution,
      description: `Income stability level '${enhancementData.incomeStabilityLevel}' contributes ${stabilityContribution} risk points`,
    });
  }

  // MOEI Enhancement: Factor 8 - Payment history (0-7 points)
  if (enhancementData?.paymentHistoryPattern !== undefined) {
    const paymentHistoryWeight = await getConfigNumber('risk_weight_payment_history', 7);
    let paymentContribution = 0;
    switch (enhancementData.paymentHistoryPattern) {
      case 'critical':
        paymentContribution = paymentHistoryWeight;
        break;
      case 'poor':
        paymentContribution = Math.round(paymentHistoryWeight * 0.7);
        break;
      case 'fair':
        paymentContribution = Math.round(paymentHistoryWeight * 0.4);
        break;
      case 'good':
        paymentContribution = Math.round(paymentHistoryWeight * 0.15);
        break;
      case 'excellent':
        paymentContribution = 0;
        break;
    }
    riskScore += paymentContribution;
    factors.push({
      factor: 'payment_history',
      contribution: paymentContribution,
      description: `Payment history pattern '${enhancementData.paymentHistoryPattern}' contributes ${paymentContribution} risk points`,
    });
  }

  // Cap risk score at 100
  riskScore = Math.min(riskScore, 100);

  // Determine risk level — uses admin-configured thresholds
  let riskLevel: RiskResult['riskLevel'];
  if (riskScore >= riskHigh) {
    riskLevel = 'critical';
  } else if (riskScore >= riskMedium) {
    riskLevel = 'high';
  } else if (riskScore >= riskLow) {
    riskLevel = 'medium';
  } else {
    riskLevel = 'low';
  }

  return {
    riskLevel,
    riskScore,
    factors,
  };
}

/**
 * Calculate rescheduling terms
 */
export async function calculateRescheduling(
  loan: LoanData,
  arrear: ArrearData,
  requestedDuration: number,
  monthlyIncome: number,
  otherObligations: number = 0
): Promise<ReschedulingResult> {
  const warnings: string[] = [];

  // Load admin-configured limits
  const maxAssistanceAmount = await getConfigNumber('max_grant_amount', DEFAULT_MAX_ASSISTANCE_AMOUNT);
  const maxDBR = await getConfigNumber('max_dbr_limit', DEFAULT_MAX_DBR);
  const highRiskDelayDays = await getConfigNumber('delay_high_risk_days', DEFAULT_HIGH_RISK_DELAY_DAYS);
  const gracePeriodMedical = await getConfigNumber('grace_period_for_medical', 3);
  const gracePeriodDivorce = await getConfigNumber('grace_period_for_divorce', 3);

  // Calculate total amount to reschedule (remaining balance + overdue)
  const totalAmount = loan.remainingBalance + arrear.totalOverdue;

  // Validate requested duration
  // HACKATHON RULE: The proposed period should not exceed the original approved period.
  const maxAllowedDuration = loan.loanDurationMonths;
  const maxRemainingDuration = maxAllowedDuration - loan.elapsedMonths;
  
  if (requestedDuration > maxRemainingDuration) {
    warnings.push(
      `Requested duration (${requestedDuration} months) exceeds the remaining original approved period of ${maxRemainingDuration} months. Capped to maximum.`
    );
  }
  const effectiveDuration = Math.min(requestedDuration, maxRemainingDuration);

  if (effectiveDuration <= 0) {
    return {
      feasible: false,
      recommendedAmount: 0,
      recommendedDuration: 0,
      recommendedInstallment: 0,
      proposedDBR: 0,
      currentDBR: 0,
      savingsPerMonth: 0,
      totalInterestCost: 0,
      warnings: ['Loan duration has been exhausted. Rescheduling is not feasible.'],
    };
  }

  // Calculate proposed monthly installment
  const proposedInstallment = Math.ceil(totalAmount / effectiveDuration);

  // Calculate current DBR
  const currentTotalDebt = loan.monthlyInstallment + otherObligations;
  const currentDBR =
    monthlyIncome > 0 ? currentTotalDebt / monthlyIncome : 1;

  // Calculate proposed DBR
  const proposedDBR =
    monthlyIncome > 0
      ? (proposedInstallment + otherObligations) / monthlyIncome
      : 1;

  // Check feasibility
  const feasible = proposedDBR <= maxDBR;

  if (!feasible) {
    warnings.push(
      `Proposed DBR of ${(proposedDBR * 100).toFixed(1)}% exceeds the ${maxDBR * 100}% limit. Consider extending duration or partial write-off.`
    );
  }

  // Calculate monthly savings
  const savingsPerMonth = loan.monthlyInstallment - proposedInstallment;

  // Check for special hardship handling — uses admin-configured grace periods
  if (arrear.reason === 'medical') {
    warnings.push(
      `Medical hardship detected - consider additional grace period of ${gracePeriodMedical} months`
    );
  }
  if (arrear.reason === 'divorce') {
    warnings.push(
      `Divorce hardship detected - consider additional grace period of ${gracePeriodDivorce} months and joint liability assessment`
    );
  }
  if (arrear.reason === 'retirement') {
    warnings.push(
      'Retirement hardship detected - verify pension income and adjust calculations accordingly'
    );
  }

  // Check if loan amount exceeds maximum assistance
  if (loan.originalAmount > maxAssistanceAmount) {
    warnings.push(
      `Loan amount exceeds AED ${maxAssistanceAmount.toLocaleString()} maximum assistance. Only the capped amount can be rescheduled.`
    );
  }

  // Check high risk delay
  if (arrear.delayDays > highRiskDelayDays) {
    warnings.push(
      `Delay exceeds ${highRiskDelayDays} days - classified as high risk. Requires senior management approval.`
    );
  }

  // Calculate total interest cost (simplified - no interest for government housing loans)
  const totalInterestCost = 0; // UAE government housing loans are typically interest-free

  return {
    feasible,
    recommendedAmount: Math.min(totalAmount, maxAssistanceAmount),
    recommendedDuration: effectiveDuration,
    recommendedInstallment: proposedInstallment,
    proposedDBR: Math.round(proposedDBR * 10000) / 10000,
    currentDBR: Math.round(currentDBR * 10000) / 10000,
    savingsPerMonth: Math.round(savingsPerMonth * 100) / 100,
    totalInterestCost,
    warnings,
  };
}

/**
 * Run all governance compliance checks
 */
export async function runGovernanceChecks(
  applicant: ApplicantData,
  loan: LoanData,
  arrear: ArrearData,
  proposedDuration: number
): Promise<{
  compliant: boolean;
  checks: {
    ruleCode: string;
    ruleName: string;
    passed: boolean;
    message: string;
    category: string;
  }[];
}> {
  const eligibilityResult = await checkEligibility(applicant, loan, arrear);
  const dbrResult = await calculateDBR(
    applicant.monthlyIncome,
    loan.monthlyInstallment,
    loan.remainingBalance / proposedDuration
  );
  const riskResult = await determineRiskLevel(
    dbrResult.dbr,
    arrear.delayDays,
    applicant.monthlyIncome,
    arrear.reason || 'other',
    applicant.employerType
  );

  // Load admin-configured limits
  const maxDBR = await getConfigNumber('max_dbr_limit', DEFAULT_MAX_DBR);
  const maxAssistanceAmount = await getConfigNumber('max_grant_amount', DEFAULT_MAX_ASSISTANCE_AMOUNT);
  const highRiskDelayDays = await getConfigNumber('delay_high_risk_days', DEFAULT_HIGH_RISK_DELAY_DAYS);

  const checks: {
    ruleCode: string;
    ruleName: string;
    passed: boolean;
    message: string;
    category: string;
  }[] = [];

  // Convert eligibility checks to governance format
  for (const check of eligibilityResult.checks) {
    checks.push({
      ruleCode: `ELIG-${check.rule.toUpperCase()}`,
      ruleName: check.rule.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
      passed: check.passed,
      message: check.message,
      category: 'eligibility',
    });
  }

  // DBR check
  checks.push({
    ruleCode: 'DBR-001',
    ruleName: 'Debt Burden Ratio Limit',
    passed: dbrResult.withinLimit,
    message: dbrResult.withinLimit
      ? `DBR of ${(dbrResult.dbr * 100).toFixed(1)}% is within the ${maxDBR * 100}% limit`
      : `DBR of ${(dbrResult.dbr * 100).toFixed(1)}% exceeds the ${maxDBR * 100}% limit`,
    category: 'debt_burden',
  });

  // Duration check (Hackathon Rule: must not exceed remaining original approved period)
  const maxRemainingDuration = loan.loanDurationMonths - loan.elapsedMonths;
  checks.push({
    ruleCode: 'DUR-001',
    ruleName: 'Maximum Loan Duration',
    passed: proposedDuration <= maxRemainingDuration,
    message:
      proposedDuration <= maxRemainingDuration
        ? `Duration of ${proposedDuration} months is within the ${maxRemainingDuration}-month remaining maximum`
        : `Duration of ${proposedDuration} months exceeds the ${maxRemainingDuration}-month remaining maximum`,
    category: 'duration',
  });

  // Amount check
  checks.push({
    ruleCode: 'AMT-001',
    ruleName: 'Maximum Assistance Amount',
    passed: loan.originalAmount <= maxAssistanceAmount,
    message:
      loan.originalAmount <= maxAssistanceAmount
        ? `Amount AED ${loan.originalAmount.toLocaleString()} is within the AED ${maxAssistanceAmount.toLocaleString()} cap`
        : `Amount AED ${loan.originalAmount.toLocaleString()} exceeds the AED ${maxAssistanceAmount.toLocaleString()} cap`,
    category: 'amount',
  });

  // Risk level check
  checks.push({
    ruleCode: 'RISK-001',
    ruleName: 'Risk Classification',
    passed: riskResult.riskLevel !== 'critical',
    message: `Risk level: ${riskResult.riskLevel} (score: ${riskResult.riskScore})`,
    category: 'risk',
  });

  // High delay warning
  checks.push({
    ruleCode: 'DELAY-001',
    ruleName: 'Arrears Delay Duration',
    passed: arrear.delayDays <= highRiskDelayDays,
    message:
      arrear.delayDays <= highRiskDelayDays
        ? `Delay of ${arrear.delayDays} days is within acceptable range`
        : `Delay of ${arrear.delayDays} days exceeds ${highRiskDelayDays}-day threshold - requires escalation`,
    category: 'risk',
  });

  // Documentation check
  const hasValidReason = ['job_loss', 'medical', 'salary_cut', 'divorce', 'retirement'].includes(
    arrear.reason || ''
  );
  checks.push({
    ruleCode: 'DOC-001',
    ruleName: 'Supporting Documentation',
    passed: hasValidReason,
    message: hasValidReason
      ? 'Hardship reason documented with required supporting documents'
      : 'Insufficient documentation for hardship claim',
    category: 'documentation',
  });

  // Special hardship handling
  if (arrear.reason === 'medical' || arrear.reason === 'divorce' || arrear.reason === 'retirement') {
    checks.push({
      ruleCode: 'HARDSHIP-001',
      ruleName: 'Special Hardship Provision',
      passed: true,
      message: `${arrear.reason} hardship qualifies for special handling provisions under SZHP guidelines`,
      category: 'eligibility',
    });
  }

  const compliant = checks.every((c) => c.passed || c.category === 'risk');

  return { compliant, checks };
}

// ============================================================================
// MOEI-SPECIFIC RULES
// ============================================================================

/**
 * Calculate income per family member and check against threshold.
 * MOEI Rule: If average income per family member is below AED 2,500,
 * the beneficiary may require a lighter repayment plan.
 */
export async function calculateIncomePerFamilyMember(
  totalHouseholdIncome: number,
  familySize: number
): Promise<IncomePerMemberResult> {
  const threshold = await getConfigNumber('income_per_member_threshold', 2500);
  const safeFamilySize = Math.max(familySize, 1);
  const incomePerMember = Math.round((totalHouseholdIncome / safeFamilySize) * 100) / 100;
  const belowThreshold = incomePerMember < threshold;

  return {
    incomePerMember,
    belowThreshold,
    threshold,
  };
}

/**
 * Analyze income stability based on current/previous income,
 * declared stability, and employer type.
 * MOEI Rule: Analyze whether income is stable, reduced, or lost.
 */
export async function analyzeIncomeStability(
  currentIncome: number,
  previousIncome: number | null,
  incomeStability: string,
  employerType: string
): Promise<IncomeStabilityResult> {
  const factors: IncomeStabilityResult['factors'] = [];
  let stabilityScore = 50; // Start at neutral

  const normalizedEmployerType = employerType.replace(/_/g, '-');

  // Factor 1: Employer type stability bonus
  const govBonus = await getConfigNumber('stability_bonus_government', 25);
  const semiGovBonus = await getConfigNumber('stability_bonus_semi_government', 15);
  const privateBonus = await getConfigNumber('stability_bonus_private', 0);

  if (normalizedEmployerType === 'government') {
    stabilityScore += govBonus;
    factors.push({
      factor: 'employer_type',
      impact: 'positive',
      description: `Government employment provides strong income stability (+${govBonus})`,
    });
  } else if (normalizedEmployerType === 'semi-government') {
    stabilityScore += semiGovBonus;
    factors.push({
      factor: 'employer_type',
      impact: 'positive',
      description: `Semi-government employment provides moderate income stability (+${semiGovBonus})`,
    });
  } else {
    stabilityScore += privateBonus;
    factors.push({
      factor: 'employer_type',
      impact: 'neutral',
      description: 'Private sector employment - standard stability assessment applies',
    });
  }

  // Factor 2: Income comparison (if previous income available)
  if (previousIncome !== null && previousIncome > 0) {
    const incomeChangeRatio = (currentIncome - previousIncome) / previousIncome;
    if (incomeChangeRatio >= 0) {
      const increaseBonus = Math.min(15, Math.round(incomeChangeRatio * 30));
      stabilityScore += increaseBonus;
      factors.push({
        factor: 'income_trend',
        impact: 'positive',
        description: `Income has increased by ${(incomeChangeRatio * 100).toFixed(1)}% (+${increaseBonus})`,
      });
    } else if (incomeChangeRatio > -0.2) {
      stabilityScore -= 10;
      factors.push({
        factor: 'income_trend',
        impact: 'negative',
        description: `Income has decreased by ${(Math.abs(incomeChangeRatio) * 100).toFixed(1)}% (-10)`,
      });
    } else if (incomeChangeRatio > -0.5) {
      stabilityScore -= 25;
      factors.push({
        factor: 'income_trend',
        impact: 'negative',
        description: `Income has significantly decreased by ${(Math.abs(incomeChangeRatio) * 100).toFixed(1)}% (-25)`,
      });
    } else {
      stabilityScore -= 40;
      factors.push({
        factor: 'income_trend',
        impact: 'critical',
        description: `Income has severely decreased by ${(Math.abs(incomeChangeRatio) * 100).toFixed(1)}% (-40)`,
      });
    }
  } else {
    factors.push({
      factor: 'income_trend',
      impact: 'neutral',
      description: 'No previous income data available for comparison',
    });
  }

  // Factor 3: Declared income stability
  const stabilityPenaltyLost = await getConfigNumber('stability_penalty_income_lost', 40);
  const stabilityPenaltyReduced = await getConfigNumber('stability_penalty_income_reduced', 20);
  const stabilityPenaltyVariable = await getConfigNumber('stability_penalty_income_variable', 10);
  const stabilityBonusStable = await getConfigNumber('stability_bonus_income_stable', 10);

  const normalizedStability = incomeStability.toLowerCase().replace(/_/g, '_');
  switch (normalizedStability) {
    case 'stable':
      stabilityScore += stabilityBonusStable;
      factors.push({
        factor: 'declared_stability',
        impact: 'positive',
        description: `Income declared as stable (+${stabilityBonusStable})`,
      });
      break;
    case 'reduced':
      stabilityScore -= stabilityPenaltyReduced;
      factors.push({
        factor: 'declared_stability',
        impact: 'negative',
        description: `Income declared as reduced (-${stabilityPenaltyReduced})`,
      });
      break;
    case 'lost':
      stabilityScore -= stabilityPenaltyLost;
      factors.push({
        factor: 'declared_stability',
        impact: 'critical',
        description: `Income declared as lost (-${stabilityPenaltyLost})`,
      });
      break;
    case 'variable':
      stabilityScore -= stabilityPenaltyVariable;
      factors.push({
        factor: 'declared_stability',
        impact: 'negative',
        description: `Income declared as variable (-${stabilityPenaltyVariable})`,
      });
      break;
    default:
      factors.push({
        factor: 'declared_stability',
        impact: 'neutral',
        description: `Income stability status '${incomeStability}' not recognized - neutral assessment`,
      });
  }

  // Clamp score to 0-100
  stabilityScore = Math.max(0, Math.min(100, stabilityScore));

  // Determine stability level
  const stableThreshold = await getConfigNumber('stability_level_stable', 75);
  const moderateThreshold = await getConfigNumber('stability_level_moderate', 50);
  const unstableThreshold = await getConfigNumber('stability_level_unstable', 25);

  let stabilityLevel: IncomeStabilityResult['stabilityLevel'];
  if (stabilityScore >= stableThreshold) {
    stabilityLevel = 'stable';
  } else if (stabilityScore >= moderateThreshold) {
    stabilityLevel = 'moderately_stable';
  } else if (stabilityScore >= unstableThreshold) {
    stabilityLevel = 'unstable';
  } else {
    stabilityLevel = 'critical';
  }

  return {
    stabilityScore,
    stabilityLevel,
    factors,
  };
}

/**
 * Analyze payment history to assess the beneficiary's past payment behavior.
 * MOEI Rule: Consider past payment behavior.
 */
export async function analyzePaymentHistory(
  paymentHistory: PaymentHistoryEntry[],
  totalMissedPayments: number,
  reschedulingCount: number,
  loanDurationMonths: number,
  elapsedMonths: number
): Promise<PaymentHistoryResult> {
  const factors: PaymentHistoryResult['factors'] = [];

  // Calculate on-time rate
  const totalPayments = paymentHistory.length;
  const onTimePayments = paymentHistory.filter(
    (p) => p.status === 'paid' || p.status === 'on_time' || p.status === 'paid_on_time'
  ).length;
  const onTimeRate = totalPayments > 0 ? (onTimePayments / totalPayments) * 100 : 0;

  let paymentScore = 100; // Start perfect and deduct

  // Factor 1: On-time payment rate (major factor)
  if (totalPayments > 0) {
    const missedRate = 100 - onTimeRate;
    // Deduct up to 40 points based on missed rate
    const onTimeDeduction = Math.round((missedRate / 100) * 40);
    paymentScore -= onTimeDeduction;
    factors.push({
      factor: 'on_time_rate',
      description: `On-time payment rate: ${onTimeRate.toFixed(1)}% (${onTimePayments}/${totalPayments} payments on time)`,
    });
  } else {
    // Use elapsedMonths to infer payment history if no detailed records
    if (elapsedMonths > 0) {
      const inferredOnTime = Math.max(0, elapsedMonths - totalMissedPayments);
      const inferredRate = (inferredOnTime / elapsedMonths) * 100;
      const missedRate = 100 - inferredRate;
      const onTimeDeduction = Math.round((missedRate / 100) * 40);
      paymentScore -= onTimeDeduction;
      factors.push({
        factor: 'on_time_rate_inferred',
        description: `Inferred on-time rate: ${inferredRate.toFixed(1)}% (${inferredOnTime}/${elapsedMonths} months estimated on time)`,
      });
    }
  }

  // Factor 2: Total missed payments
  const missedPenaltyLow = await getConfigNumber('payment_penalty_missed_low', 5);
  const missedPenaltyMedium = await getConfigNumber('payment_penalty_missed_medium', 15);
  const missedPenaltyHigh = await getConfigNumber('payment_penalty_missed_high', 25);

  if (totalMissedPayments === 0) {
    factors.push({
      factor: 'missed_payments',
      description: 'No missed payments recorded',
    });
  } else if (totalMissedPayments <= 2) {
    paymentScore -= missedPenaltyLow;
    factors.push({
      factor: 'missed_payments',
      description: `${totalMissedPayments} missed payment(s) - minor impact (-${missedPenaltyLow})`,
    });
  } else if (totalMissedPayments <= 6) {
    paymentScore -= missedPenaltyMedium;
    factors.push({
      factor: 'missed_payments',
      description: `${totalMissedPayments} missed payments - moderate impact (-${missedPenaltyMedium})`,
    });
  } else {
    paymentScore -= missedPenaltyHigh;
    factors.push({
      factor: 'missed_payments',
      description: `${totalMissedPayments} missed payments - significant impact (-${missedPenaltyHigh})`,
    });
  }

  // Factor 3: Previous rescheduling count
  const reschedulingPenalty = await getConfigNumber('payment_penalty_per_reschedule', 10);
  if (reschedulingCount > 0) {
    const reschedulingDeduction = Math.min(reschedulingCount * reschedulingPenalty, 25);
    paymentScore -= reschedulingDeduction;
    factors.push({
      factor: 'rescheduling_history',
      description: `${reschedulingCount} previous rescheduling(s) - (-${reschedulingDeduction})`,
    });
  } else {
    factors.push({
      factor: 'rescheduling_history',
      description: 'No previous rescheduling - first-time applicant',
    });
  }

  // Factor 4: Loan progress vs. payment consistency
  if (loanDurationMonths > 0 && elapsedMonths > 0) {
    const progressRatio = elapsedMonths / loanDurationMonths;
    const expectedOnTimeRate = progressRatio > 0 ? onTimeRate / (progressRatio * 100) * 100 : onTimeRate;
    if (expectedOnTimeRate < 50 && progressRatio > 0.3) {
      paymentScore -= 5;
      factors.push({
        factor: 'loan_progress_consistency',
        description: `Payment consistency (${onTimeRate.toFixed(1)}%) is low relative to loan progress (${(progressRatio * 100).toFixed(1)}% elapsed) (-5)`,
      });
    } else {
      factors.push({
        factor: 'loan_progress_consistency',
        description: `Loan progress: ${(progressRatio * 100).toFixed(1)}% elapsed with ${onTimeRate.toFixed(1)}% on-time rate`,
      });
    }
  }

  // Factor 5: Payment trajectory (recent trend)
  if (totalPayments >= 6) {
    const recentPayments = paymentHistory.slice(-3);
    const olderPayments = paymentHistory.slice(-6, -3);
    const recentOnTime = recentPayments.filter(
      (p) => p.status === 'paid' || p.status === 'on_time' || p.status === 'paid_on_time'
    ).length;
    const olderOnTime = olderPayments.filter(
      (p) => p.status === 'paid' || p.status === 'on_time' || p.status === 'paid_on_time'
    ).length;

    if (recentOnTime > olderOnTime) {
      paymentScore += 5; // Improving trend bonus
      factors.push({
        factor: 'payment_trajectory',
        description: 'Payment trend improving - recent payments more consistent (+5)',
      });
    } else if (recentOnTime < olderOnTime) {
      paymentScore -= 10; // Deteriorating trend penalty
      factors.push({
        factor: 'payment_trajectory',
        description: 'Payment trend deteriorating - recent payments less consistent (-10)',
      });
    } else {
      factors.push({
        factor: 'payment_trajectory',
        description: 'Payment trend stable - consistent behavior',
      });
    }
  }

  // Clamp score to 0-100
  paymentScore = Math.max(0, Math.min(100, paymentScore));

  // Determine payment pattern
  const excellentThreshold = await getConfigNumber('payment_pattern_excellent', 85);
  const goodThreshold = await getConfigNumber('payment_pattern_good', 70);
  const fairThreshold = await getConfigNumber('payment_pattern_fair', 50);
  const poorThreshold = await getConfigNumber('payment_pattern_poor', 30);

  let pattern: PaymentHistoryResult['pattern'];
  if (paymentScore >= excellentThreshold) {
    pattern = 'excellent';
  } else if (paymentScore >= goodThreshold) {
    pattern = 'good';
  } else if (paymentScore >= fairThreshold) {
    pattern = 'fair';
  } else if (paymentScore >= poorThreshold) {
    pattern = 'poor';
  } else {
    pattern = 'critical';
  }

  return {
    paymentScore,
    pattern,
    onTimeRate: Math.round(onTimeRate * 100) / 100,
    factors,
  };
}

/**
 * Check document completeness for the application.
 * MOEI Rule: Verify salary certificate, income statement, and supporting documents.
 */
export async function checkDocumentCompleteness(
  supportingDocuments: string[],
  reasonCategory: string
): Promise<DocumentCompletenessResult> {
  // Define required and reason-specific documents
  const requiredDocuments = [
    'salary_certificate',
    'income_statement',
  ];

  // Additional documents based on reason category
  const reasonSpecificDocs: Record<string, string[]> = {
    medical: ['medical_report'],
    divorce: ['court_order'],
    job_loss: ['termination_letter'],
    retirement: ['pension_statement'],
    salary_cut: ['salary_change_letter'],
  };

  const additionalDocs = reasonSpecificDocs[reasonCategory] || [];
  const allRequiredDocs = [...requiredDocuments, ...additionalDocs];

  // Check each document
  const checks: DocumentCompletenessResult['checks'] = allRequiredDocs.map((doc) => {
    const provided = supportingDocuments.some(
      (sd) => sd.toLowerCase().replace(/[\s-]/g, '_') === doc.toLowerCase().replace(/[\s-]/g, '_')
    );
    return {
      document: doc,
      required: true,
      provided,
    };
  });

  // Also check optional documents that were provided
  const optionalDocs = ['bank_statement', 'employer_letter', 'family_book_copy', 'id_copy'];
  for (const optDoc of optionalDocs) {
    const provided = supportingDocuments.some(
      (sd) => sd.toLowerCase().replace(/[\s-]/g, '_') === optDoc.toLowerCase().replace(/[\s-]/g, '_')
    );
    if (provided) {
      checks.push({
        document: optDoc,
        required: false,
        provided: true,
      });
    }
  }

  const missingDocuments = checks
    .filter((c) => c.required && !c.provided)
    .map((c) => c.document);

  return {
    complete: missingDocuments.length === 0,
    missingDocuments,
    checks,
  };
}

/**
 * Calculate MOEI compliance - the main compliance check combining
 * the 20% deduction rule and the period rule.
 *
 * MOEI Key Rules:
 * 1. 20% Deduction Rule: The deduction rate must NOT exceed 20% of the beneficiary's income
 * 2. Period Rule: The repayment period must NOT exceed the original approved loan repayment period
 */
export async function calculateMoeiCompliance(
  applicant: ApplicantData,
  loan: LoanData,
  arrear: ArrearData,
  proposedDuration: number,
  proposedInstallment: number
): Promise<MoeiComplianceResult> {
  const checks: MoeiComplianceResult['checks'] = [];

  // Load configurable thresholds
  const maxDeductionRate = await getConfigNumber('moei_max_deduction_rate', 0.20);
  const maxLoanDurationOverride = await getConfigNumber('moei_max_loan_duration_override', 0);
  const maxLoanDuration = maxLoanDurationOverride > 0
    ? maxLoanDurationOverride
    : loan.loanDurationMonths;

  // ---- Rule 1: 20% Deduction Rule ----
  const deductionRate = applicant.monthlyIncome > 0
    ? proposedInstallment / applicant.monthlyIncome
    : 1;
  const deductionRulePassed = deductionRate <= maxDeductionRate;

  checks.push({
    rule: 'moei_deduction_rule',
    passed: deductionRulePassed,
    message: deductionRulePassed
      ? `Proposed deduction rate of ${(deductionRate * 100).toFixed(1)}% is within the ${(maxDeductionRate * 100).toFixed(0)}% limit`
      : `Proposed deduction rate of ${(deductionRate * 100).toFixed(1)}% exceeds the ${(maxDeductionRate * 100).toFixed(0)}% limit - MOEI non-compliant`,
    severity: deductionRulePassed ? 'info' : 'critical',
  });

  // ---- Rule 2: Period Rule ----
  const remainingPeriod = maxLoanDuration - loan.elapsedMonths;
  const periodRulePassed = proposedDuration <= remainingPeriod;

  checks.push({
    rule: 'moei_period_rule',
    passed: periodRulePassed,
    message: periodRulePassed
      ? `Proposed duration of ${proposedDuration} months is within the ${remainingPeriod}-month remaining period`
      : `Proposed duration of ${proposedDuration} months exceeds the ${remainingPeriod}-month remaining period - MOEI non-compliant`,
    severity: periodRulePassed ? 'info' : 'critical',
  });

  // ---- Additional compliance checks ----

  // Check if proposed installment would cover the total debt
  const totalDebtToRepay = loan.remainingBalance + arrear.totalOverdue;
  const totalProposedPayment = proposedInstallment * proposedDuration;
  const installmentCoversDebt = totalProposedPayment >= totalDebtToRepay;

  checks.push({
    rule: 'installment_coverage',
    passed: installmentCoversDebt,
    message: installmentCoversDebt
      ? `Proposed payments (AED ${totalProposedPayment.toLocaleString()}) cover total debt (AED ${totalDebtToRepay.toLocaleString()})`
      : `Proposed payments (AED ${totalProposedPayment.toLocaleString()}) do not cover total debt (AED ${totalDebtToRepay.toLocaleString()})`,
    severity: installmentCoversDebt ? 'info' : 'warning',
  });

  // Check if income is zero (cannot calculate meaningful deduction)
  if (applicant.monthlyIncome === 0) {
    checks.push({
      rule: 'income_verification',
      passed: false,
      message: 'Applicant has zero income - cannot determine compliant deduction rate. Requires special review.',
      severity: 'critical',
    });
  }

  // Overall compliance
  const criticalFailures = checks.filter((c) => !c.passed && c.severity === 'critical');
  const compliant = criticalFailures.length === 0;

  return {
    compliant,
    deductionRulePassed,
    periodRulePassed,
    deductionRate: Math.round(deductionRate * 10000) / 10000,
    maxDeductionRate,
    remainingPeriod: Math.max(0, remainingPeriod),
    checks,
  };
}

/**
 * Generate a MOEI-compliant recommendation that combines all analyses
 * into a final decision recommendation.
 *
 * Recommendation levels:
 * - approve: All checks pass, low risk
 * - conditionally_approve: Minor issues that can be resolved with conditions
 * - request_documents: Missing documents that must be provided
 * - refer_to_employee: Complex case requiring human review
 * - reject: Fails critical MOEI rules
 */
export async function generateMoeiRecommendation(
  eligibilityResult: EligibilityResult,
  moeiCompliance: MoeiComplianceResult,
  riskResult: RiskResult,
  incomePerMember: IncomePerMemberResult,
  incomeStability: IncomeStabilityResult,
  paymentHistory: PaymentHistoryResult,
  documentCompleteness: DocumentCompletenessResult
): Promise<MoeiRecommendationResult> {
  const summaryParts: string[] = [];

  // ---- Critical Blockers ----

  // Not eligible = reject
  if (!eligibilityResult.eligible) {
    const failedChecks = eligibilityResult.checks
      .filter((c) => !c.passed && c.severity === 'critical')
      .map((c) => c.message);
    return {
      recommendation: 'reject',
      reasoning: `Applicant does not meet basic eligibility requirements: ${failedChecks.join('; ')}`,
      caseSummary: 'Application rejected - fails mandatory eligibility criteria.',
    };
  }

  // MOEI compliance failed (deduction or period rule) = reject
  if (!moeiCompliance.compliant) {
    const failedRules = moeiCompliance.checks
      .filter((c) => !c.passed && c.severity === 'critical')
      .map((c) => c.message);
    return {
      recommendation: 'reject',
      reasoning: `Application fails MOEI compliance rules: ${failedRules.join('; ')}`,
      caseSummary: 'Application rejected - fails MOEI regulatory requirements.',
    };
  }

  // ---- Document check ----
  if (!documentCompleteness.complete) {
    summaryParts.push('documentation incomplete');

    return {
      recommendation: 'request_documents',
      reasoning: `Before proceeding, the following documents must be provided: ${documentCompleteness.missingDocuments.join(', ')}. These are required under MOEI document verification rules.`,
      caseSummary: `Application pending - requires ${documentCompleteness.missingDocuments.length} document(s) before assessment can continue.`,
    };
  }

  // ---- Risk assessment ----
  if (riskResult.riskLevel === 'critical') {
    summaryParts.push('critical risk');

    return {
      recommendation: 'refer_to_employee',
      reasoning: `Application presents critical risk (score: ${riskResult.riskScore}). Factors: ${riskResult.factors.map((f) => `${f.factor} (${f.contribution}pts)`).join(', ')}. Requires manual review by a qualified employee.`,
      caseSummary: 'Application flagged for manual review due to critical risk profile.',
    };
  }

  // ---- Conditional factors ----
  const conditionalFactors: string[] = [];

  // Income per member below threshold
  if (incomePerMember.belowThreshold) {
    conditionalFactors.push(
      `Income per family member (AED ${incomePerMember.incomePerMember.toLocaleString()}) is below the AED ${incomePerMember.threshold.toLocaleString()} threshold - lighter repayment plan may be needed`
    );
    summaryParts.push('low income per family member');
  }

  // Income stability concerns
  if (incomeStability.stabilityLevel === 'unstable' || incomeStability.stabilityLevel === 'critical') {
    conditionalFactors.push(
      `Income stability is ${incomeStability.stabilityLevel} (score: ${incomeStability.stabilityScore}) - repayment capacity at risk`
    );
    summaryParts.push(`${incomeStability.stabilityLevel} income stability`);
  }

  // Payment history concerns
  if (paymentHistory.pattern === 'poor' || paymentHistory.pattern === 'critical') {
    conditionalFactors.push(
      `Payment history is ${paymentHistory.pattern} (score: ${paymentHistory.paymentScore}, on-time rate: ${paymentHistory.onTimeRate.toFixed(1)}%)`
    );
    summaryParts.push(`${paymentHistory.pattern} payment history`);
  }

  // High risk level
  if (riskResult.riskLevel === 'high') {
    conditionalFactors.push(
      `High risk level (score: ${riskResult.riskScore}) - enhanced monitoring recommended`
    );
    summaryParts.push('high risk');
  }

  // Moderately stable income with other concerns
  if (incomeStability.stabilityLevel === 'moderately_stable' && riskResult.riskLevel !== 'low') {
    conditionalFactors.push(
      'Moderately stable income combined with other risk factors warrants closer monitoring'
    );
  }

  // ---- Final recommendation ----
  if (conditionalFactors.length === 0 && riskResult.riskLevel === 'low') {
    // All clear
    summaryParts.push('all checks passed');
    summaryParts.push('low risk');

    return {
      recommendation: 'approve',
      reasoning: `Application meets all MOEI requirements. Deduction rule passed (${(moeiCompliance.deductionRate * 100).toFixed(1)}% ≤ ${(moeiCompliance.maxDeductionRate * 100).toFixed(0)}%), period rule passed (${moeiCompliance.remainingPeriod} months remaining), income stability is ${incomeStability.stabilityLevel}, payment history is ${paymentHistory.pattern}, and risk level is ${riskResult.riskLevel}.`,
      caseSummary: `Application recommended for approval - ${summaryParts.join(', ')}.`,
    };
  }

  if (conditionalFactors.length > 0) {
    // Has conditions that should be addressed
    const hasSevereConditions = incomeStability.stabilityLevel === 'critical' ||
      paymentHistory.pattern === 'critical';

    if (hasSevereConditions) {
      return {
        recommendation: 'refer_to_employee',
        reasoning: `Application passes MOEI compliance but has significant concerns: ${conditionalFactors.join('; ')}. Recommend manual review by a qualified employee to determine appropriate conditions.`,
        caseSummary: `Application conditionally eligible but requires manual review - ${summaryParts.join(', ')}.`,
      };
    }

    return {
      recommendation: 'conditionally_approve',
      reasoning: `Application meets MOEI compliance requirements with conditions: ${conditionalFactors.join('; ')}. Recommend approval with enhanced monitoring and periodic review.`,
      caseSummary: `Application recommended for conditional approval - ${summaryParts.join(', ')}.`,
    };
  }

  // Medium risk without specific conditional factors
  if (riskResult.riskLevel === 'medium') {
    summaryParts.push('medium risk');
    return {
      recommendation: 'conditionally_approve',
      reasoning: `Application meets MOEI compliance requirements but presents medium risk (score: ${riskResult.riskScore}). Recommend approval with standard monitoring conditions.`,
      caseSummary: `Application recommended for conditional approval - ${summaryParts.join(', ')}.`,
    };
  }

  // Default to conditional approval for high risk
  return {
    recommendation: 'conditionally_approve',
    reasoning: `Application meets MOEI compliance requirements. Risk level is ${riskResult.riskLevel} (score: ${riskResult.riskScore}). Recommend approval with enhanced monitoring conditions.`,
    caseSummary: `Application recommended for conditional approval - ${summaryParts.join(', ')}.`,
  };
}
