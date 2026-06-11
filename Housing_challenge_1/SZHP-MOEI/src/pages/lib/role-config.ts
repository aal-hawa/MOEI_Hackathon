/**
 * Unified role configuration for the SZHP frontend.
 *
 * Consolidates role-style maps from:
 *   - components/auth/login-page.tsx       (getRoleColor, getRoleLabel, getRoleIcon)
 *   - components/forms/new-request-form.tsx (getRoleColor, getRoleLabel, getRoleIcon)
 *   - components/admin/users-view.tsx       (ROLE_CONFIG)
 *
 * This is the single source of truth — all components should import
 * from here instead of defining their own ad-hoc maps.
 */

// ─── Types ────────────────────────────────────────────────────

export interface RoleConfig {
  /** Bilingual label */
  label: { en: string; ar: string }
  /** Lucide icon name (e.g. "User", "Crown") */
  icon: string
  /** Tailwind text-color class */
  color: string
  /** Tailwind bg-color class */
  bgColor: string
  /** Tailwind border-color class */
  borderColor: string
}

// ─── Role Map ─────────────────────────────────────────────────

export const ROLE_CONFIG: Record<string, RoleConfig> = {
  // ── Citizen-facing roles (UAE PASS) ───────────────────────
  citizen: {
    label: { en: 'Citizen', ar: 'مواطن' },
    icon: 'User',
    color: 'text-ae-green-600',
    bgColor: 'bg-ae-green-500/10',
    borderColor: 'border-ae-green-500/20',
  },

  // ── Internal staff roles (admin panel) ────────────────────
  employee: {
    label: { en: 'Employee', ar: 'موظف' },
    icon: 'UserCheck',
    color: 'text-green-600',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/20',
  },
  reviewer: {
    label: { en: 'Reviewer', ar: 'مراجع' },
    icon: 'Eye',
    color: 'text-blue-600',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
  },
  manager: {
    label: { en: 'Manager', ar: 'مدير' },
    icon: 'Briefcase',
    color: 'text-purple-600',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/20',
  },
  admin: {
    label: { en: 'Admin', ar: 'مسؤول' },
    icon: 'Shield',
    color: 'text-ae-gold-600',
    bgColor: 'bg-ae-gold-500/10',
    borderColor: 'border-ae-gold-500/20',
  },
  superadmin: {
    label: { en: 'Super Admin', ar: 'مدير عام' },
    icon: 'Crown',
    color: 'text-red-600',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/20',
  },
}

// ─── Fallback Config ──────────────────────────────────────────

const DEFAULT_ROLE_CONFIG: RoleConfig = {
  label: { en: 'Unknown', ar: 'غير معروف' },
  icon: 'User',
  color: 'text-gray-600',
  bgColor: 'bg-gray-500/10',
  borderColor: 'border-gray-500/20',
}

// ─── Getter Function ──────────────────────────────────────────

/**
 * Retrieve the full RoleConfig for a given role key.
 * Returns a default grey config when the role is not recognised.
 */
export function getRoleConfig(role: string): RoleConfig {
  return ROLE_CONFIG[role] ?? DEFAULT_ROLE_CONFIG
}
