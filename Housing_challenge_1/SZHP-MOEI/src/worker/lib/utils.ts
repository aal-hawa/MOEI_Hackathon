/**
 * Utility functions for the Cloudflare Worker backend
 */

/**
 * cn() - Classname utility (simplified clsx)
 */
export function cn(...inputs: (string | undefined | null | false)[]): string {
  return inputs.filter(Boolean).join(' ')
}

/**
 * Mask API key for display (show only first 4 and last 4 chars)
 */
export function maskApiKey(apiKey: string | null | undefined): string {
  if (!apiKey) return ''
  if (apiKey.length <= 8) return '****'
  return `${apiKey.substring(0, 4)}${'*'.repeat(apiKey.length - 8)}${apiKey.substring(apiKey.length - 4)}`
}

/**
 * Generate unique ID using crypto.randomUUID()
 * (D1 doesn't have cuid, so we use UUID instead)
 */
export function generateId(): string {
  return crypto.randomUUID()
}

/**
 * Safe JSON parse with fallback
 */
export function safeJsonParse<T>(str: string | null | undefined, fallback: T): T {
  if (!str) return fallback
  try {
    return JSON.parse(str)
  } catch {
    return fallback
  }
}

/**
 * Convert a value to a number with fallback
 */
export function toNum(val: unknown, fallback: number = 0): number {
  if (val === null || val === undefined || val === '') return fallback
  const n = Number(val)
  return Number.isNaN(n) ? fallback : n
}
