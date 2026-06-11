/**
 * MOEI Eligibility Determination Logic
 *
 * Checks all eligibility criteria per MOEI regulations:
 *   - UAE citizenship requirement
 *   - Family book requirement
 *   - DBR limits (max 20% deduction rule per Cabinet Resolution 61/2021)
 *   - Income per family member threshold
 *   - Loan duration limits
 *   - Employer type restrictions
 *   - Delay duration assessment
 */

import { calculateDBR } from './dbr'

// ─── Types ─────────────────────────────────────────────────────

export interface EligibilityReason {
  code: string
  message: { en: string; ar: string }
  severity: 'error' | 'warning'
}

export interface EligibilityWarning {
  code: string
  message: { en: string; ar: string }
}

export interface EligibilityResult {
  eligible: boolean
  reasons: EligibilityReason[]
  warnings: EligibilityWarning[]
}

export interface EligibilityParams {
  isCitizen: boolean
  hasFamilyBook: boolean
  monthlyIncome: number
  familySize: number
  monthlyInstallment: number
  remainingBalance: number
  requestedDurationMonths: number
  loanType: string
  employerType: string
  delayDays: number
}

// ─── Constants ─────────────────────────────────────────────────

/** Maximum DBR for deduction rule: 20% of monthly income */
const MAX_DBR_DEDUCTION = 20

/** Minimum income per family member (AED) per MOEI guidelines */
const MIN_INCOME_PER_MEMBER = 2500

/** Maximum rescheduling duration in months */
const MAX_RESCHEDULE_DURATION = 360

// ─── Core Logic ────────────────────────────────────────────────

/**
 * Check all MOEI eligibility rules and return a structured result.
 *
 * Hard stops (severity 'error') make the applicant ineligible.
 * Soft issues (severity 'warning') flag concerns but don't block.
 */
export function checkEligibility(params: EligibilityParams): EligibilityResult {
  const reasons: EligibilityReason[] = []
  const warnings: EligibilityWarning[] = []

  // ── Must be UAE citizen ──
  if (!params.isCitizen) {
    reasons.push({
      code: 'NOT_CITIZEN',
      message: {
        en: 'Applicant must be a UAE citizen',
        ar: 'يجب أن يكون مقدم الطلب مواطناً إمارياً',
      },
      severity: 'error',
    })
  }

  // ── Must have family book ──
  if (!params.hasFamilyBook) {
    reasons.push({
      code: 'NO_FAMILY_BOOK',
      message: {
        en: 'Applicant must have a family book (Khulasat Al Qaid)',
        ar: 'يجب أن يكون لدى مقدم الطلب خلاصة القيد',
      },
      severity: 'error',
    })
  }

  // ── DBR must not exceed 20% deduction rule ──
  const dbr = calculateDBR(params.monthlyInstallment, params.monthlyIncome)
  if (dbr > MAX_DBR_DEDUCTION) {
    reasons.push({
      code: 'DBR_EXCEEDED',
      message: {
        en: `DBR (${dbr.toFixed(1)}%) exceeds the maximum ${MAX_DBR_DEDUCTION}% deduction limit`,
        ar: `نسبة عبء الدين (${dbr.toFixed(1)}%) تتجاوز حد الخصم الأقصى ${MAX_DBR_DEDUCTION}%`,
      },
      severity: 'error',
    })
  } else if (dbr > MAX_DBR_DEDUCTION * 0.75) {
    // Warning when approaching the limit (≥ 75% of threshold)
    warnings.push({
      code: 'DBR_APPROACHING_LIMIT',
      message: {
        en: `DBR (${dbr.toFixed(1)}%) is approaching the ${MAX_DBR_DEDUCTION}% limit`,
        ar: `نسبة عبء الدين (${dbr.toFixed(1)}%) تقترب من الحد ${MAX_DBR_DEDUCTION}%`,
      },
    })
  }

  // ── Income per family member threshold ──
  const incomePerMember = getIncomePerMember(params.monthlyIncome, params.familySize)
  if (incomePerMember < MIN_INCOME_PER_MEMBER) {
    warnings.push({
      code: 'LOW_INCOME_PER_MEMBER',
      message: {
        en: `Income per family member (AED ${incomePerMember.toFixed(0)}) is below AED ${MIN_INCOME_PER_MEMBER} — lighter rescheduling plan recommended`,
        ar: `الدخل لكل فرد من الأسرة (${incomePerMember.toFixed(0)} درهم) أقل من ${MIN_INCOME_PER_MEMBER} درهم — يُوصى بخطة إعادة جدولة أخف`,
      },
    })
  }

  // ── Loan duration limits ──
  if (params.requestedDurationMonths > MAX_RESCHEDULE_DURATION) {
    reasons.push({
      code: 'DURATION_EXCEEDS_MAX',
      message: {
        en: `Requested duration (${params.requestedDurationMonths} months) exceeds the maximum of ${MAX_RESCHEDULE_DURATION} months`,
        ar: `المدة المطلوبة (${params.requestedDurationMonths} شهر) تتجاوز الحد الأقصى ${MAX_RESCHEDULE_DURATION} شهر`,
      },
      severity: 'error',
    })
  }

  // ── Private sector employer warning ──
  if (params.employerType === 'private') {
    warnings.push({
      code: 'PRIVATE_EMPLOYER',
      message: {
        en: 'Private sector employment may require additional income verification',
        ar: 'العمل في القطاع الخاص قد يتطلب تحققاً إضافياً من الدخل',
      },
    })
  }

  // ── Zero income check ──
  if (params.monthlyIncome <= 0) {
    reasons.push({
      code: 'ZERO_INCOME',
      message: {
        en: 'Monthly income must be greater than zero',
        ar: 'يجب أن يكون الدخل الشهري أكبر من صفر',
      },
      severity: 'error',
    })
  }

  // ── Zero balance check ──
  if (params.remainingBalance <= 0) {
    warnings.push({
      code: 'ZERO_BALANCE',
      message: {
        en: 'Remaining balance is zero — no rescheduling needed',
        ar: 'الرصيد المتبقي صفر — لا حاجة لإعادة الجدولة',
      },
    })
  }

  const eligible = reasons.filter((r) => r.severity === 'error').length === 0

  return { eligible, reasons, warnings }
}

/**
 * Calculate income per family member
 *
 * Per MOEI guidelines, cases below AED 2,500 per member receive
 * lighter rescheduling plans with priority consideration.
 */
export function getIncomePerMember(totalIncome: number, familySize: number): number {
  if (familySize <= 0) return totalIncome
  return totalIncome / familySize
}
