/**
 * Secure API Client for Frontend
 * All API calls go through this module to ensure consistent auth headers
 * and safe data handling. No direct database access from the client.
 * 
 * Architecture: Frontend (src/pages/) -> API Client -> Worker Backend (src/worker/)
 * All mutations, secrets, and database access happen ONLY in the worker.
 * 
 * The Caddy gateway routes /api/* to the worker on port 3001 automatically.
 * No XTransformPort needed for API calls.
 */

// ─── Configuration ───────────────────────────────────────────────────────────

const API_BASE = `/api`

// Auth token storage (in-memory, not persisted to localStorage for security)
let _adminToken: string | null = null

/**
 * Set the admin token for authenticated API calls
 */
export function setAdminToken(token: string | null) {
  _adminToken = token
}

/**
 * Get the current admin token
 */
export function getAdminToken(): string | null {
  return _adminToken
}

// ─── Secure Fetch Wrapper ────────────────────────────────────────────────────

interface SecureFetchOptions extends RequestInit {
  /** Skip auth headers (for public endpoints) */
  public?: boolean
}

/**
 * Secure fetch wrapper that automatically adds auth headers
 * All frontend API calls should use this instead of raw fetch()
 */
export async function secureFetch(path: string, options: SecureFetchOptions = {}): Promise<Response> {
  const { public: isPublic, headers: customHeaders, ...restOptions } = options

  const headers: Record<string, string> = {}

  // Add auth headers for mutation endpoints
  if (!isPublic && _adminToken) {
    headers['Authorization'] = `Bearer ${_adminToken}`
  }

  // Merge custom headers
  if (customHeaders) {
    if (customHeaders instanceof Headers) {
      customHeaders.forEach((value, key) => { headers[key] = value })
    } else if (Array.isArray(customHeaders)) {
      customHeaders.forEach(([key, value]) => { headers[key] = value })
    } else {
      Object.entries(customHeaders).forEach(([key, value]) => {
        if (typeof value === 'string') headers[key] = value
      })
    }
  }

  // Set Content-Type for JSON bodies
  if (restOptions.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }

  // Caddy routes /api/* to the worker on port 3001 automatically
  const url = `${API_BASE}${path}`

  return fetch(url, {
    ...restOptions,
    headers,
  })
}

// ─── Convenience Methods ─────────────────────────────────────────────────────

export const api = {
  /** GET request (public, rate-limited) */
  get: (path: string) => secureFetch(path, { public: true }),

  /** POST request (requires auth) */
  post: (path: string, body?: unknown) =>
    secureFetch(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),

  /** PUT request (requires auth) */
  put: (path: string, body?: unknown) =>
    secureFetch(path, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    }),

  /** DELETE request (requires auth) */
  delete: (path: string) =>
    secureFetch(path, { method: 'DELETE' }),

  /** PATCH request (requires auth) */
  patch: (path: string, body?: unknown) =>
    secureFetch(path, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    }),
}

// ─── Auth Status Check ───────────────────────────────────────────────────────

interface AuthStatus {
  authEnabled: boolean
  methods: { apiKey: boolean; adminToken: boolean }
  mode: 'production' | 'development'
  message: string
}

/**
 * Check the auth status from the server
 */
export async function checkAuthStatus(): Promise<AuthStatus> {
  try {
    const res = await fetch(`${API_BASE}/auth/status`)
    if (res.ok) {
      return res.json()
    }
    return { authEnabled: false, methods: { apiKey: false, adminToken: false }, mode: 'development', message: 'Unable to check auth status' }
  } catch {
    return { authEnabled: false, methods: { apiKey: false, adminToken: false }, mode: 'development', message: 'Unable to check auth status' }
  }
}
