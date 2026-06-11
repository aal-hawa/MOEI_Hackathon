import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Authenticated fetch wrapper — automatically adds the Authorization header
 * with the Bearer token from the persisted auth store (localStorage).
 *
 * Usage: identical to `fetch()`, but reads the token from localStorage
 * so it works in both React components and callbacks where hooks aren't available.
 */
export function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  // Read token directly from sessionStorage (zustand persist) so we don't need React context
  let token: string | null = null
  try {
    const raw = typeof window !== 'undefined' ? sessionStorage.getItem('szhp-auth-storage') : null
    if (raw) {
      const parsed = JSON.parse(raw)
      token = parsed?.state?.accessToken ?? null
    }
  } catch {
    // ignore
  }

  const headers = new Headers(init?.headers)
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  return fetch(input, {
    ...init,
    headers,
  })
}
