/**
 * Unified status badge configuration for the SZHP frontend.
 *
 * Consolidates 5+ different status-style maps from:
 *   - components/dashboard/recent-cases.tsx   (STATUS_BADGE_STYLES)
 *   - components/cases/case-list.tsx          (STATUS_CONFIG)
 *   - components/assessment/case-detail.tsx   (getStatusBadgeClass)
 *   - routes/my-requests.tsx                  (getStatusInfo)
 *   - components/portal/customer-portal.tsx   (getStatusColor)
 *
 * This is the single source of truth — all components should import
 * from here instead of defining their own ad-hoc maps.
 */

// ─── Types ────────────────────────────────────────────────────

export interface StatusConfig {
  /** Bilingual label */
  label: { en: string; ar: string }
  /** Tailwind bg-color class (e.g. "bg-ae-gold-100") */
  color: string
  /** Tailwind text-color class (e.g. "text-ae-gold-700") */
  textColor: string
  /** Tailwind border-color class (e.g. "border-ae-gold-200") */
  borderColor: string
  /** Lucide icon name for rendering (e.g. "Clock") */
  icon?: string
  /** Hex color for charts / SVG (e.g. "#EAB308") */
  chartColor?: string
}

// ─── Comprehensive Status Map ─────────────────────────────────

export const STATUS_CONFIG: Record<string, StatusConfig> = {
  pending: {
    label: { en: 'Pending', ar: 'قيد الانتظار' },
    color: 'bg-ae-gold-100',
    textColor: 'text-ae-gold-700',
    borderColor: 'border-ae-gold-200',
    icon: 'Clock',
    chartColor: '#EAB308',
  },
  under_review: {
    label: { en: 'Under Review', ar: 'قيد المراجعة' },
    color: 'bg-blue-100',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-200',
    icon: 'Eye',
    chartColor: '#3B82F6',
  },
  ai_assessed: {
    label: { en: 'AI Assessed', ar: 'تم التقييم بالذكاء الاصطناعي' },
    color: 'bg-ae-gold-100',
    textColor: 'text-ae-gold-700',
    borderColor: 'border-ae-gold-200',
    icon: 'Brain',
    chartColor: '#C9A34E',
  },
  approved: {
    label: { en: 'Approved', ar: 'تمت الموافقة' },
    color: 'bg-ae-green-100',
    textColor: 'text-ae-green-700',
    borderColor: 'border-ae-green-200',
    icon: 'CheckCircle2',
    chartColor: '#317A40',
  },
  rejected: {
    label: { en: 'Rejected', ar: 'مرفوض' },
    color: 'bg-ae-red-100',
    textColor: 'text-ae-red-700',
    borderColor: 'border-ae-red-200',
    icon: 'XCircle',
    chartColor: '#D83731',
  },
  escalated: {
    label: { en: 'Escalated', ar: 'تمت الإحالة' },
    color: 'bg-purple-100',
    textColor: 'text-purple-700',
    borderColor: 'border-purple-200',
    icon: 'ArrowUpRight',
    chartColor: '#8B5CF6',
  },
  needs_info: {
    label: { en: 'Needs Info', ar: 'بحاجة لمعلومات' },
    color: 'bg-orange-100',
    textColor: 'text-orange-700',
    borderColor: 'border-orange-200',
    icon: 'AlertTriangle',
    chartColor: '#EA580C',
  },
  created: {
    label: { en: 'Created', ar: 'تم الإنشاء' },
    color: 'bg-gray-100',
    textColor: 'text-gray-700',
    borderColor: 'border-gray-200',
    icon: 'FileText',
  },
  assessed: {
    label: { en: 'Assessed', ar: 'تم التقييم' },
    color: 'bg-ae-gold-100',
    textColor: 'text-ae-gold-700',
    borderColor: 'border-ae-gold-200',
    icon: 'Brain',
  },
  modified: {
    label: { en: 'Modified', ar: 'تم التعديل' },
    color: 'bg-blue-100',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-200',
    icon: 'RefreshCw',
  },
  processing: {
    label: { en: 'Processing', ar: 'جاري المعالجة' },
    color: 'bg-blue-100',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-200',
    icon: 'FileSearch',
  },
}

// ─── Fallback Config ──────────────────────────────────────────

const DEFAULT_STATUS_CONFIG: StatusConfig = {
  label: { en: 'Unknown', ar: 'غير معروف' },
  color: 'bg-gray-100',
  textColor: 'text-gray-700',
  borderColor: 'border-gray-200',
  icon: 'FileText',
}

// ─── Getter Functions ─────────────────────────────────────────

/**
 * Retrieve the full StatusConfig for a given status key.
 * Returns a default grey config when the status is not recognised.
 */
export function getStatusConfig(status: string): StatusConfig {
  return STATUS_CONFIG[status] ?? DEFAULT_STATUS_CONFIG
}

/**
 * Convenience function that returns pre-combined Tailwind class strings
 * for a badge-style element.
 *
 * @example
 * ```tsx
 * const { container, dot } = getStatusBadgeClasses('approved')
 * <span className={container}>…</span>
 * ```
 */
export function getStatusBadgeClasses(
  status: string,
): { container: string; dot: string } {
  const cfg = getStatusConfig(status)
  return {
    container: `${cfg.color} ${cfg.textColor} ${cfg.borderColor}`,
    dot: cfg.textColor,
  }
}
