import { authFetch } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────

export interface AuditFilters {
  category?: string
  action?: string
  dateFrom?: string
  dateTo?: string
  performedByUserId?: string
  limit?: number
  offset?: number
}

export interface AuditLogUser {
  id: string
  firstnameEN: string
  lastnameEN: string
  firstnameAR: string | null
  lastnameAR: string | null
  role: string
}

export interface AuditLog {
  id: string
  action: string
  category: string
  details: string | null
  affectedRecord: string | null
  previousValue: string | null
  newValue: string | null
  ipAddress: string | null
  performedByUserId: string
  createdAt: string
  user?: AuditLogUser
}

export interface MostActiveUser {
  name: string
  role: string
  count: number
}

export interface AuditStats {
  actions24h: number
  actions7d: number
  actions30d: number
  mostActiveUser: MostActiveUser | null
}

// ── API functions ─────────────────────────────────────────────────────────

/**
 * Fetch audit logs with optional filters.
 * Mirrors: authFetch(`/api/audit-trail?${params}`)
 */
export async function fetchAuditLogs(filters?: AuditFilters): Promise<AuditLog[]> {
  const params = new URLSearchParams()
  if (filters?.category) params.set('category', filters.category)
  if (filters?.action) params.set('action', filters.action)
  if (filters?.dateFrom) params.set('dateFrom', filters.dateFrom)
  if (filters?.dateTo) params.set('dateTo', filters.dateTo)
  if (filters?.performedByUserId) params.set('performedByUserId', filters.performedByUserId)
  params.set('limit', String(filters?.limit ?? 50))
  params.set('offset', String(filters?.offset ?? 0))

  const res = await authFetch(`/api/audit-trail?${params.toString()}`)
  if (!res.ok) {
    throw new Error(`Failed to fetch audit logs: ${res.status}`)
  }
  const data = await res.json()
  return Array.isArray(data) ? data : (data.logs || data.auditLogs || [])
}

/**
 * Fetch audit trail statistics (actions in 24h, 7d, 30d, most active user).
 * Mirrors: authFetch('/api/audit-trail/stats')
 */
export async function fetchAuditStats(): Promise<AuditStats> {
  const res = await authFetch('/api/audit-trail/stats')
  if (!res.ok) {
    throw new Error(`Failed to fetch audit stats: ${res.status}`)
  }
  const data = await res.json()
  return data as AuditStats
}
