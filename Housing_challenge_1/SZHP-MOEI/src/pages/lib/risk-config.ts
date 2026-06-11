/**
 * Unified risk level configuration for the SZHP frontend.
 *
 * Consolidates risk-style maps from:
 *   - components/dashboard/recent-cases.tsx   (RISK_BADGE_STYLES)
 *   - components/cases/case-list.tsx          (RISK_CONFIG)
 *   - components/assessment/case-detail.tsx   (getRiskBgClass, getRiskStrokeColor)
 *   - components/dashboard/charts.tsx         (RISK_COLORS)
 *
 * This is the single source of truth — all components should import
 * from here instead of defining their own ad-hoc maps.
 */

// ─── Types ────────────────────────────────────────────────────

export interface RiskConfig {
  /** Bilingual label */
  label: { en: string; ar: string }
  /** Tailwind bg-color class */
  color: string
  /** Tailwind bg + border combo class (e.g. "bg-ae-green-100 border-ae-green-200") */
  bgColor: string
  /** Tailwind border-color class */
  borderColor: string
  /** Tailwind text-color class */
  textColor: string
  /** Hex color for recharts / SVG strokes */
  chartColor: string
}

// ─── Risk Level Map ───────────────────────────────────────────

export const RISK_CONFIG: Record<string, RiskConfig> = {
  low: {
    label: { en: 'Low', ar: 'منخفض' },
    color: 'bg-ae-green-100',
    bgColor: 'bg-ae-green-100 border-ae-green-200',
    borderColor: 'border-ae-green-200',
    textColor: 'text-ae-green-700',
    chartColor: '#3F8E50',
  },
  medium: {
    label: { en: 'Medium', ar: 'متوسط' },
    color: 'bg-ae-gold-100',
    bgColor: 'bg-ae-gold-100 border-ae-gold-200',
    borderColor: 'border-ae-gold-200',
    textColor: 'text-ae-gold-700',
    chartColor: '#B68A35',
  },
  high: {
    label: { en: 'High', ar: 'مرتفع' },
    color: 'bg-orange-100',
    bgColor: 'bg-orange-100 border-orange-200',
    borderColor: 'border-orange-200',
    textColor: 'text-orange-700',
    chartColor: '#7C5E24',
  },
  critical: {
    label: { en: 'Critical', ar: 'حرج' },
    color: 'bg-ae-red-100',
    bgColor: 'bg-ae-red-100 border-ae-red-200',
    borderColor: 'border-ae-red-200',
    textColor: 'text-ae-red-700',
    chartColor: '#D83731',
  },
}

// ─── Fallback Config ──────────────────────────────────────────

const DEFAULT_RISK_CONFIG: RiskConfig = {
  label: { en: 'Unknown', ar: 'غير معروف' },
  color: 'bg-gray-100',
  bgColor: 'bg-gray-100 border-gray-200',
  borderColor: 'border-gray-200',
  textColor: 'text-gray-700',
  chartColor: '#9CA3AF',
}

// ─── Getter Function ──────────────────────────────────────────

/**
 * Retrieve the full RiskConfig for a given risk level key.
 * Returns a default grey config when the level is not recognised.
 */
export function getRiskConfig(level: string): RiskConfig {
  return RISK_CONFIG[level] ?? DEFAULT_RISK_CONFIG
}

// ─── Chart Color Array ────────────────────────────────────────

/**
 * Ordered array of hex colors for chart series, cycling through
 * low → medium → high → critical.
 *
 * Useful for recharts `Cell` fills or Pie chart color arrays.
 */
export const RISK_CHART_COLORS: string[] = [
  RISK_CONFIG.low.chartColor,
  RISK_CONFIG.medium.chartColor,
  RISK_CONFIG.high.chartColor,
  RISK_CONFIG.critical.chartColor,
]
