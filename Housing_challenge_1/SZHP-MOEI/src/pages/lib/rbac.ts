// RBAC (Role-Based Access Control) System for SZHP Admin Portal
// Client-side utilities only — server-side auth verification is in the Worker

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  superadmin: ['*'],
  manager: [
    'dashboard',
    'cases',
    'cases.approve',
    'cases.reject',
    'cases.escalate',
    'workflows',
    'employees.view',
    'employees.manage',
    'audit.view',
    'settings',
    'models',
  ],
  admin: [
    'dashboard',
    'cases',
    'cases.approve',
    'cases.reject',
    'workflows',
    'employees.view',
    'employees.manage',
    'audit.view',
    'settings',
    'models',
  ],
  reviewer: [
    'dashboard',
    'cases',
    'cases.review',
    'audit.view',
  ],
  employee: [
    'dashboard',
    'cases.view',
  ],
  citizen: [],
}

/**
 * Check if a user's permissions include the required permission.
 */
export function hasPermission(permissions: string[], required: string): boolean {
  if (!permissions || !Array.isArray(permissions)) return false
  if (permissions.includes('*')) return true
  if (permissions.includes(required)) return true

  const parts = required.split('.')
  if (parts.length > 1) {
    const parent = parts[0]
    if (permissions.includes(parent)) return true
  }

  return false
}

/**
 * Check if a user can access a specific view based on role and permissions.
 */
export function canAccessView(role: string, permissions: string[], view: string): boolean {
  if (role === 'superadmin') return true
  return hasPermission(permissions, view)
}

/**
 * Get a human-readable label for a role in the specified language.
 */
export function getRoleLabel(role: string, lang: 'en' | 'ar' = 'en'): string {
  const labels: Record<string, { en: string; ar: string }> = {
    superadmin: { en: 'Super Admin', ar: 'مدير النظام' },
    admin: { en: 'Admin', ar: 'مسؤول' },
    manager: { en: 'Manager', ar: 'مدير' },
    reviewer: { en: 'Reviewer', ar: 'مراجع' },
    employee: { en: 'Employee', ar: 'موظف' },
    citizen: { en: 'Citizen', ar: 'مواطن' },
  }
  return labels[role]?.[lang] ?? role
}

/**
 * Get default permissions for a given role.
 */
export function getDefaultPermissions(role: string): string[] {
  return ROLE_PERMISSIONS[role] ?? []
}
