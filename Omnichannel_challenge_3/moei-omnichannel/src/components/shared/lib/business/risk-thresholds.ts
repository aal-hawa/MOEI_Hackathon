/**
 * Risk Score & Delay Duration Color/Classification Utilities
 *
 * Extracted from case-detail.tsx helper functions:
 *   getRiskColor, getRiskStrokeColor, getRiskBgClass,
 *   getDelayColor, getDelayBgClass
 *
 * Default thresholds:
 *   Risk:  low=30, medium=60, high=80
 *   Delay: low=90, high=180
 */

// ─── Types ─────────────────────────────────────────────────────

export interface RiskThresholds {
  low: number
  medium: number
  high: number
}

export interface DelayThresholds {
  low: number
  high: number
}

export type DelayLevel = 'normal' | 'caution' | 'high' | 'severe'

export interface DelayClassification {
  level: DelayLevel
  label: { en: string; ar: string }
  color: string
  bgColor: string
}

// ─── Default Thresholds ────────────────────────────────────────

const DEFAULT_RISK_THRESHOLDS: RiskThresholds = { low: 30, medium: 60, high: 80 }
const DEFAULT_DELAY_THRESHOLDS: DelayThresholds = { low: 90, high: 180 }

// ─── Risk Score Functions ──────────────────────────────────────

/**
 * Returns Tailwind text color class based on risk score
 *
 * Matches case-detail.tsx:
 *   ≤ 30 → text-ae-green-600
 *   ≤ 60 → text-amber-600
 *   ≤ 80 → text-orange-600
 *   > 80 → text-ae-red-600
 */
export function getRiskColor(
  riskScore: number,
  thresholds: RiskThresholds = DEFAULT_RISK_THRESHOLDS
): string {
  const { low, medium, high } = thresholds
  if (riskScore <= low) return 'text-ae-green-600'
  if (riskScore <= medium) return 'text-amber-600'
  if (riskScore <= high) return 'text-orange-600'
  return 'text-ae-red-600'
}

/**
 * Returns Tailwind bg color class based on risk level string
 *
 * Maps a named risk level to combined bg + text + border classes.
 */
export function getRiskBgClass(
  riskLevel: string
): string {
  switch (riskLevel) {
    case 'low':
      return 'bg-ae-green-50 text-ae-green-700 border-ae-green-200'
    case 'medium':
      return 'bg-amber-50 text-amber-700 border-amber-200'
    case 'high':
      return 'bg-orange-50 text-orange-700 border-orange-200'
    case 'critical':
      return 'bg-ae-red-50 text-ae-red-700 border-ae-red-200'
    default:
      return 'bg-gray-50 text-gray-700 border-gray-200'
  }
}

/**
 * Returns Tailwind stroke color for SVG elements based on risk score
 *
 * Matches case-detail.tsx:
 *   ≤ 30 → '#317A40' (green)
 *   ≤ 60 → '#D97706' (amber)
 *   ≤ 80 → '#EA580C' (orange)
 *   > 80 → '#D83731' (red)
 */
export function getRiskStrokeColor(
  riskScore: number,
  thresholds: RiskThresholds = DEFAULT_RISK_THRESHOLDS
): string {
  const { low, medium, high } = thresholds
  if (riskScore <= low) return '#317A40'
  if (riskScore <= medium) return '#D97706'
  if (riskScore <= high) return '#EA580C'
  return '#D83731'
}

// ─── Delay Duration Functions ──────────────────────────────────

/**
 * Returns Tailwind text color class based on delay days
 *
 * Matches case-detail.tsx:
 *   < 90  → text-ae-green-600
 *   ≤ 180 → text-amber-600
 *   > 180 → text-ae-red-600
 */
export function getDelayColor(
  delayDays: number,
  thresholds: DelayThresholds = DEFAULT_DELAY_THRESHOLDS
): string {
  const { low, high } = thresholds
  if (delayDays < low) return 'text-ae-green-600'
  if (delayDays <= high) return 'text-amber-600'
  return 'text-ae-red-600'
}

/**
 * Returns Tailwind bg color class based on delay days
 *
 * Matches case-detail.tsx:
 *   < 90  → bg-ae-green-50 text-ae-green-700
 *   ≤ 180 → bg-amber-50 text-amber-700
 *   > 180 → bg-ae-red-50 text-ae-red-700
 */
export function getDelayBgClass(
  delayDays: number,
  thresholds: DelayThresholds = DEFAULT_DELAY_THRESHOLDS
): string {
  const { low, high } = thresholds
  if (delayDays < low) return 'bg-ae-green-50 text-ae-green-700'
  if (delayDays <= high) return 'bg-amber-50 text-amber-700'
  return 'bg-ae-red-50 text-ae-red-700'
}

/**
 * Classify delay duration into a structured level
 *
 *   normal:  < 90 days
 *   caution: 90–180 days
 *   high:    181–365 days
 *   severe:  > 365 days
 */
export function classifyDelay(
  delayDays: number,
  thresholds: DelayThresholds = DEFAULT_DELAY_THRESHOLDS
): DelayClassification {
  const { low, high } = thresholds

  if (delayDays < low) {
    return {
      level: 'normal',
      label: { en: 'Normal', ar: 'طبيعي' },
      color: 'text-ae-green-600',
      bgColor: 'bg-ae-green-50 text-ae-green-700',
    }
  }
  if (delayDays <= high) {
    return {
      level: 'caution',
      label: { en: 'Caution', ar: 'تحذير' },
      color: 'text-amber-600',
      bgColor: 'bg-amber-50 text-amber-700',
    }
  }
  if (delayDays <= 365) {
    return {
      level: 'high',
      label: { en: 'High', ar: 'مرتفع' },
      color: 'text-orange-600',
      bgColor: 'bg-orange-50 text-orange-700',
    }
  }
  return {
    level: 'severe',
    label: { en: 'Severe', ar: 'شديد' },
    color: 'text-ae-red-600',
    bgColor: 'bg-ae-red-50 text-ae-red-700',
  }
}
