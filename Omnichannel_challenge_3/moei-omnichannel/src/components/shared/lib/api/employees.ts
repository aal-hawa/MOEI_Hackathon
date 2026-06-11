import { authFetch } from '../utils'

// ── Types ─────────────────────────────────────────────────────────────────

export interface Employee {
  id: string
  email: string
  firstnameEN: string
  lastnameEN: string
  firstnameAR: string | null
  lastnameAR: string | null
  role: string
  department: string | null
  isActive: boolean
  permissions: string[]
  lastLoginAt: string | null
  createdAt: string
  isLocked?: boolean
  twoFactorEnabled?: boolean
}

export interface LoginHistoryEntry {
  id: string
  loginAt: string
  ipAddress: string | null
  userAgent: string | null
  authMethod?: string
  success?: boolean
}

export interface RecentAuditAction {
  id: string
  action: string
  category: string
  details: string | null
  timestamp: string
}

export interface EmployeeDetail extends Employee {
  loginHistory: LoginHistoryEntry[]
  recentAuditActions: RecentAuditAction[]
}

export interface EmployeeFormData {
  // For new employees
  email?: string
  password?: string
  firstnameEN: string
  lastnameEN: string
  firstnameAR?: string
  lastnameAR?: string
  role: string
  department: string
  permissions: string[]
  performedByUserId?: string
  // For updates
  userId?: string
}

// ── API functions ─────────────────────────────────────────────────────────

/**
 * Fetch all employees.
 * Mirrors: authFetch('/api/employees')
 */
export async function fetchEmployees(_search?: string): Promise<Employee[]> {
  const res = await authFetch('/api/employees')
  if (!res.ok) {
    throw new Error(`Failed to fetch employees: ${res.status}`)
  }
  const data = await res.json()
  return Array.isArray(data) ? data : (data.data || data.users || data.employees || [])
}

/**
 * Fetch a single employee's detail including login history and recent audit actions.
 * Mirrors: authFetch(`/api/employees/${id}`)
 */
export async function fetchEmployeeDetail(id: string): Promise<EmployeeDetail> {
  const res = await authFetch(`/api/employees/${id}`)
  if (!res.ok) {
    throw new Error(`Failed to fetch employee detail: ${res.status}`)
  }
  const data = await res.json()
  const user = data.user || data

  return {
    ...user,
    loginHistory: data.loginHistory || user.loginHistory || [],
    recentAuditActions: data.recentAuditActions || user.auditActions || [],
  } as EmployeeDetail
}

/**
 * Save (create or update) an employee.
 * - If `data.userId` is set → PUT /api/employees (update)
 * - Otherwise → POST /api/auth/admin-register (create)
 */
export async function saveEmployee(data: EmployeeFormData): Promise<Employee> {
  if (data.userId) {
    // Update existing employee
    const payload: Record<string, unknown> = {
      userId: data.userId,
      role: data.role,
      department: data.department,
      permissions: data.permissions,
      performedByUserId: data.performedByUserId,
    }
    if (data.password) payload.password = data.password
    if (data.firstnameEN) payload.firstnameEN = data.firstnameEN
    if (data.lastnameEN) payload.lastnameEN = data.lastnameEN
    if (data.firstnameAR) payload.firstnameAR = data.firstnameAR
    if (data.lastnameAR) payload.lastnameAR = data.lastnameAR

    const res = await authFetch('/api/employees', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error((err as Record<string, string>).error || 'Failed to update employee')
    }
    return (await res.json()) as Employee
  }

  // Create new employee
  const res = await authFetch('/api/auth/admin-register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: data.email,
      password: data.password,
      firstnameEN: data.firstnameEN,
      lastnameEN: data.lastnameEN,
      firstnameAR: data.firstnameAR || undefined,
      lastnameAR: data.lastnameAR || undefined,
      role: data.role,
      department: data.department,
      performedByUserId: data.performedByUserId,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as Record<string, string>).error || 'Failed to create employee')
  }
  return (await res.json()) as Employee
}

/**
 * Toggle an employee's active status.
 * Mirrors: authFetch(`/api/employees/${id}`, { method: 'PATCH', body: { isActive, performedByUserId } })
 */
export async function toggleEmployeeActive(
  id: string,
  active: boolean,
  performedByUserId?: string,
): Promise<void> {
  const body: Record<string, unknown> = { isActive: active }
  if (performedByUserId) body.performedByUserId = performedByUserId

  const res = await authFetch(`/api/employees/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as Record<string, string>).error || 'Failed to toggle employee active status')
  }
}
