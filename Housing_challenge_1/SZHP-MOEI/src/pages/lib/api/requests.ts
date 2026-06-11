import { authFetch } from '@/lib/utils'
import type { RequestData } from '@/lib/store'

// ── Types ─────────────────────────────────────────────────────────────────

export interface RequestApplicantData {
  emiratesId: string
  nameEn?: string | null
  nameAr: string
  phone: string
  email?: string | null
  monthlyIncome: number
  employer?: string | null
  employerType?: string | null
  familySize: number
  hasFamilyBook?: boolean
}

export interface RequestLoanData {
  originalAmount: number
  remainingBalance: number
  monthlyInstallment: number
  loanDurationMonths: number
  elapsedMonths: number
  loanType: string
  totalOverdue?: number
  missedMonths?: number
  delayDays?: number
}

export interface RequestFormData {
  applicant: RequestApplicantData
  loan: RequestLoanData
  request: {
    requestedDurationMonths: number
    reason: string | null
    reasonCategory: string
    priority: string
    supportingDocuments: string[]
    notes?: string
    uploadedFiles?: unknown[]
    housingAssistanceNumber?: string
    requestType?: string
    salaryCertAnalysis?: unknown
  }
}

export type Request = RequestData
export type RequestDetail = RequestData

// ── API functions ─────────────────────────────────────────────────────────

/**
 * Create a new request (submit application).
 * Mirrors: authFetch('/api/requests', { method: 'POST', body: JSON.stringify(payload) })
 */
export async function createRequest(data: RequestFormData): Promise<Request> {
  const res = await authFetch('/api/requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as Record<string, string>).error || 'Failed to submit request')
  }
  const result = await res.json()
  return result as Request
}

/**
 * Fetch the current user's requests (customer portal).
 * Mirrors: authFetch('/api/requests') — expects { requests: [...] }
 */
export async function fetchMyRequests(): Promise<Request[]> {
  const res = await authFetch('/api/requests')
  if (!res.ok) {
    throw new Error(`Failed to fetch requests: ${res.status}`)
  }
  const data = await res.json()
  // Customer portal expects { requests: [...] }
  return Array.isArray(data) ? data : (data.requests || data.data || [])
}

/**
 * Fetch a single request detail by ID.
 * Mirrors: authFetch(`/api/requests/${id}`)
 */
export async function fetchRequestDetail(id: string): Promise<RequestDetail> {
  const res = await authFetch(`/api/requests/${id}`)
  if (!res.ok) {
    throw new Error(`Failed to fetch request detail: ${res.status}`)
  }
  const data = await res.json()
  return data as RequestDetail
}
