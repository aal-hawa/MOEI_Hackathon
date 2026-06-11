/**
 * Shared formatting utilities used across the SZHP frontend.
 *
 * Extracted from:
 *   - components/dashboard/recent-cases.tsx
 *   - components/cases/case-list.tsx
 *   - components/assessment/case-detail.tsx
 *   - components/forms/new-request-form.tsx
 */

// ─── Currency Formatters ──────────────────────────────────────

/**
 * Format a number as AED currency string (e.g. "AED 1,234,567").
 *
 * Handles `null` / `undefined` gracefully → returns "AED 0".
 * Uses `decimal` style (no currency symbol auto-format) so the
 * "AED" prefix is always consistent.
 */
export function formatAED(amount: number | undefined | null): string {
  if (amount == null) return 'AED 0'
  const formatted = new Intl.NumberFormat('en-AE', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
  return `AED ${formatted}`
}

/**
 * Format a number as a full AED currency string using Intl
 * (e.g. "AED 1,234,567").
 *
 * Uses `style: 'currency'` which may produce locale-specific formatting.
 */
export function formatCurrency(
  amount: number,
  currency: string = 'AED',
  locale: string = 'en-AE',
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

// ─── Emirates ID Masking ──────────────────────────────────────

/**
 * Mask an Emirates ID, showing only the prefix (784) and the
 * trailing check digit.
 *
 * Accepts both hyphenated ("784-1990-1234567-1") and raw digit
 * formats. Returns "784-XXXX-XXXXXXX-X" when the input is empty
 * or too short to extract meaningful segments.
 */
export function maskEmiratesId(eid: string | undefined | null): string {
  if (!eid) return '784-XXXX-XXXXXXX-X'

  // If already in the standard 4-part hyphenated format
  const parts = eid.split('-')
  if (parts.length === 4) {
    return `${parts[0]}-****-*******-${parts[3]}`
  }

  // Strip non-digits and try the numeric format
  const cleaned = eid.replace(/\D/g, '')
  if (cleaned.length >= 12) {
    const prefix = cleaned.substring(0, 3)
    const check = cleaned.substring(cleaned.length - 1)
    return `${prefix}-XXXX-XXXXXXX-${check}`
  }

  // Fallback for short strings – show first 3 and last 4 chars
  if (eid.length > 8) {
    return eid.slice(0, 3) + '****' + eid.slice(-4)
  }

  return '784-XXXX-XXXXXXX-X'
}

// ─── File Size Formatter ──────────────────────────────────────

/**
 * Convert bytes to a human-readable size string.
 *
 * - < 1 KB → "123 B"
 * - < 1 MB → "1.2 KB"
 * - ≥ 1 MB → "3.4 MB"
 */
export function formatFileSize(bytes: number | undefined | null | string): string {
  const numBytes = typeof bytes === 'string' ? parseFloat(bytes) : bytes
  if (numBytes == null || isNaN(numBytes) || numBytes < 0) return '0 B'
  if (numBytes < 1024) return `${numBytes} B`
  if (numBytes < 1024 * 1024) return `${(numBytes / 1024).toFixed(1)} KB`
  return `${(numBytes / 1024 / 1024).toFixed(1)} MB`
}

// ─── Safe JSON Parse ──────────────────────────────────────────

/**
 * Safely parse a JSON string, returning `fallback` on failure
 * or when the input is `null` / `undefined` / empty.
 */
export function parseJSON<T>(jsonStr: string | null | undefined, fallback: T): T {
  if (!jsonStr) return fallback
  try {
    return JSON.parse(jsonStr) as T
  } catch {
    return fallback
  }
}
