/**
 * Shared MOEI / UAE brand color constants used across the SZHP frontend.
 *
 * Extracted from:
 *   - routes/new-request.tsx
 *   - routes/my-requests.tsx
 *   - components/forms/new-request-form.tsx
 *   - components/dashboard/charts.tsx
 */

// ─── MOEI Brand Colors (hex) ──────────────────────────────────

/** Primary MOEI gold – used in headers, buttons, accents */
export const MOEI_GOLD = '#B68A35'

/** Darker gold variant – gradient endpoints, hover states */
export const MOEI_GOLD_DARK = '#9A7429'

/** Lighter gold variant – highlights, decorative elements */
export const MOEI_GOLD_LIGHT = '#D4A84B'

/** MOEI green – UAE PASS button, success indicators */
export const MOEI_GREEN = '#4CAF50'

/** MOEI red – error / danger indicators */
export const MOEI_RED = '#DC2626'

// ─── AE Design-System Colors (hex for charts / SVG) ──────────

export const AE_GOLD_300 = '#D7BC6D'
export const AE_GOLD_400 = '#C9A34E'
export const AE_GOLD_500 = '#B68A35'
export const AE_GOLD_700 = '#7C5E24'

export const AE_GREEN_500 = '#3F8E50'
export const AE_GREEN_600 = '#317A40'

export const AE_RED_600 = '#D83731'

// ─── AE Color Palette (convenience object) ────────────────────

export const AE_COLORS = {
  gold: {
    300: AE_GOLD_300,
    400: AE_GOLD_400,
    500: AE_GOLD_500,
    700: AE_GOLD_700,
  },
  green: {
    500: AE_GREEN_500,
    600: AE_GREEN_600,
  },
  red: {
    600: AE_RED_600,
  },
  moei: {
    gold: MOEI_GOLD,
    goldDark: MOEI_GOLD_DARK,
    goldLight: MOEI_GOLD_LIGHT,
    green: MOEI_GREEN,
    red: MOEI_RED,
  },
} as const

// ─── Common Gradient Presets ──────────────────────────────────

/** Standard MOEI header gradient (gold → dark gold) */
export const MOEI_HEADER_GRADIENT = `linear-gradient(135deg, ${MOEI_GOLD}, ${MOEI_GOLD_DARK})`

/** Top-bar gradient (dark gold → deepest brown) */
export const MOEI_TOPBAR_GRADIENT = `linear-gradient(135deg, ${MOEI_GOLD_DARK}, #7A5A1E)`

// ─── Chart Color Constants ────────────────────────────────────

/** Hex colors for recharts / SVG usage – status categories */
export const STATUS_CHART_COLORS: Record<string, string> = {
  pending: '#EAB308',
  under_review: '#3B82F6',
  ai_assessed: AE_GOLD_400,
  approved: AE_GREEN_600,
  rejected: AE_RED_600,
  escalated: '#8B5CF6',
}

/** Hex colors for recharts / SVG usage – risk levels */
export const RISK_CHART_COLORS: Record<string, string> = {
  low: AE_GREEN_500,
  medium: AE_GOLD_500,
  high: AE_GOLD_700,
  critical: AE_RED_600,
}
