import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Authenticated fetch wrapper — automatically:
 * 1. Adds the Authorization header with Bearer token from sessionStorage
 * 2. Keeps /api/* requests on the same browser origin.
 */
export function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
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

/**
 * Plain API fetch without the Authorization header. Use for public endpoints.
 */
export function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return fetch(input, init)
}
