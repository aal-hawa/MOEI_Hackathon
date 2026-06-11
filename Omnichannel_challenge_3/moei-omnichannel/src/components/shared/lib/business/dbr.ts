/**
 * Debt Burden Ratio (DBR) calculation and classification
 * Per MOEI Cabinet Resolution 61/2021
 *
 * DBR = (Monthly Installment / Monthly Income) × 100
 *
 * Classification thresholds:
 *   healthy:  < 35% (green)
 *   caution:  35–50% (yellow/amber)
 *   high:     50–60% (orange)
 *   critical: > 60% (red)
 */

// ─── Configuration ─────────────────────────────────────────────
const DBR_HEALTHY_LIMIT = 35
const DBR_CAUTION_LIMIT = 50
const DBR_HIGH_LIMIT = 60

// ─── Types ─────────────────────────────────────────────────────
export type DBRLevel = 'healthy' | 'caution' | 'high' | 'critical'

export interface DBRClassification {
  level: DBRLevel
  label: { en: string; ar: string }
  color: string
  bgColor: string
}

// ─── Core Calculations ─────────────────────────────────────────

/**
 * Calculate DBR as a percentage value (e.g., 35 for 35%)
 *
 * Matches the logic in customer-portal.tsx:
 *   Math.round((installment / income) * 10000) / 100
 */
export function calculateDBR(monthlyInstallment: number, monthlyIncome: number): number {
  if (monthlyIncome <= 0) return 0
  return Math.round((monthlyInstallment / monthlyIncome) * 10000) / 100
}

/**
 * Classify a DBR percentage into a risk level
 *
 * Thresholds match new-request-form.tsx DBRTrafficLight:
 *   - healthy: dbr < 35%
 *   - caution: 35% ≤ dbr ≤ 50% (between healthy and mid-range)
 *   - high:    50% < dbr ≤ 60%
 *   - critical: dbr > 60%
 */
export function classifyDBR(dbr: number): DBRClassification {
  if (dbr < DBR_HEALTHY_LIMIT) {
    return {
      level: 'healthy',
      label: { en: 'Healthy', ar: 'صحي' },
      color: 'text-green-700',
      bgColor: 'bg-green-100',
    }
  }
  if (dbr <= DBR_CAUTION_LIMIT) {
    return {
      level: 'caution',
      label: { en: 'Caution', ar: 'تحذير' },
      color: 'text-amber-700',
      bgColor: 'bg-amber-100',
    }
  }
  if (dbr <= DBR_HIGH_LIMIT) {
    return {
      level: 'high',
      label: { en: 'High', ar: 'مرتفع' },
      color: 'text-orange-700',
      bgColor: 'bg-orange-100',
    }
  }
  return {
    level: 'critical',
    label: { en: 'Critical', ar: 'حرج' },
    color: 'text-red-700',
    bgColor: 'bg-red-100',
  }
}

/**
 * Calculate the proposed DBR after rescheduling
 *
 * Given the remaining balance and requested duration, compute the new
 * monthly installment and then derive the resulting DBR.
 *
 * @param remainingBalance - Outstanding loan balance (AED)
 * @param requestedDurationMonths - New loan duration in months
 * @param monthlyIncome - Applicant's monthly income (AED)
 * @param interestRate - Optional annual interest rate as decimal (e.g., 0.05 for 5%)
 */
export function calculateProposedDBR(
  remainingBalance: number,
  requestedDurationMonths: number,
  monthlyIncome: number,
  interestRate: number = 0
): number {
  if (monthlyIncome <= 0 || requestedDurationMonths <= 0 || remainingBalance <= 0) {
    return 0
  }

  let proposedInstallment: number

  if (interestRate > 0) {
    // Amortization formula: M = P * [r(1+r)^n] / [(1+r)^n - 1]
    const monthlyRate = interestRate / 12
    const factor = Math.pow(1 + monthlyRate, requestedDurationMonths)
    proposedInstallment = remainingBalance * (monthlyRate * factor) / (factor - 1)
  } else {
    // Simple division for zero-interest government loans
    proposedInstallment = remainingBalance / requestedDurationMonths
  }

  return calculateDBR(proposedInstallment, monthlyIncome)
}

/**
 * Returns Tailwind classes for the traffic light indicator
 *
 * Matches DBRTrafficLight in new-request-form.tsx:
 *   green  → bg-green-500, ring-green-200, text-green-700
 *   amber  → bg-amber-500, ring-amber-200, text-amber-700
 *   red    → bg-red-500, ring-red-200, text-red-700
 */
export function getDBRTrafficLightClass(dbr: number): string {
  if (dbr < DBR_HEALTHY_LIMIT) {
    return 'bg-green-500 ring-green-200 text-green-700'
  }
  if (dbr <= DBR_HIGH_LIMIT) {
    return 'bg-amber-500 ring-amber-200 text-amber-700'
  }
  return 'bg-red-500 ring-red-200 text-red-700'
}
