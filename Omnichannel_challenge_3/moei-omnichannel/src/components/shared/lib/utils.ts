import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Rewrite a URL so that /api/* requests are routed through the
 * Caddy gateway's XTransformPort mechanism to the Worker service
 * (port 3001). All other paths are returned unchanged.
 */
function rewriteApiUrl(input: RequestInfo | URL): RequestInfo | URL {
  let url: string

  if (input instanceof URL) {
    url = input.href
  } else if (typeof input === 'string') {
    url = input
  } else {
    // Request object
    url = input.url
  }

  // Only rewrite relative /api/ URLs (not absolute URLs already pointing to worker)
  if (url.startsWith('/api')) {
    const sep = url.includes('?') ? '&' : '?'
    return `${url}${sep}XTransformPort=3001`
  }

  return input
}

/**
 * Authenticated fetch wrapper — automatically:
 * 1. Adds the Authorization header with Bearer token from sessionStorage
 * 2. Rewrites /api/* URLs to route through Caddy to the Worker service
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

  // Rewrite /api/* URLs to go through Caddy → Worker
  const rewrittenUrl = rewriteApiUrl(input)

  return fetch(rewrittenUrl, {
    ...init,
    headers,
  })
}

/**
 * Plain API fetch — same URL rewriting as authFetch but without
 * the Authorization header. Use for public endpoints.
 */
export function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const rewrittenUrl = rewriteApiUrl(input)
  return fetch(rewrittenUrl, init)
}
