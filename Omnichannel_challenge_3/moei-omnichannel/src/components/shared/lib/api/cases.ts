import { authFetch } from '../utils'
import type { RequestData, AssessmentData } from '../store'

// ── Filter types ──────────────────────────────────────────────────────────

export interface CaseFilters {
  status?: string
  riskLevel?: string
  searchQuery?: string
}

// ── Response types ────────────────────────────────────────────────────────

export type Case = RequestData
export type CaseDetail = RequestData

export interface AssessmentResult {
  success: boolean
  message?: string
  error?: string
  assessment?: AssessmentData
}

// ── API functions ─────────────────────────────────────────────────────────

/**
 * Fetch all cases (requests) for the admin view.
 * Mirrors: authFetch('/api/requests')
 */
export async function fetchCases(_filters?: CaseFilters): Promise<Case[]> {
  const res = await authFetch('/api/requests')
  if (!res.ok) {
    throw new Error(`Failed to fetch cases: ${res.status}`)
  }
  const data = await res.json()
  return Array.isArray(data) ? data : (data.requests || data.data || [])
}

/**
 * Fetch a single case (request) detail by ID.
 * Mirrors: authFetch(`/api/requests/${id}`)
 */
export async function fetchCaseDetail(id: string): Promise<CaseDetail> {
  const res = await authFetch(`/api/requests/${id}`)
  if (!res.ok) {
    throw new Error(`Failed to fetch case detail: ${res.status}`)
  }
  const data = await res.json()
  return data as CaseDetail
}

/**
 * Update a case status (approve / reject / escalate).
 * Mirrors: authFetch(`/api/requests/${id}`, { method: 'PATCH', body: { action } })
 */
export async function updateCaseStatus(
  id: string,
  action: 'approve' | 'reject' | 'escalate',
  notes?: string,
): Promise<void> {
  const body: Record<string, unknown> = { action }
  if (notes) body.notes = notes

  const res = await authFetch(`/api/requests/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as Record<string, string>).error || `Failed to update case status: ${res.status}`)
  }
}

/**
 * Run AI assessment on a case.
 * Mirrors: authFetch(`/api/requests/${id}/assess`, { method: 'POST' })
 */
export async function runAssessment(id: string): Promise<AssessmentResult> {
  const res = await authFetch(`/api/requests/${id}/assess`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as Record<string, string>).error || `Assessment failed: ${res.status}`)
  }
  const data = await res.json()
  return data as AssessmentResult
}
