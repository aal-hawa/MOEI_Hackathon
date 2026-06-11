// ─── Constants ────────────────────────────────────────────────
export {
  MOEI_GOLD,
  MOEI_GOLD_DARK,
  MOEI_GOLD_LIGHT,
  MOEI_GREEN,
  MOEI_RED,
  AE_GOLD_300,
  AE_GOLD_400,
  AE_GOLD_500,
  AE_GOLD_700,
  AE_GREEN_500,
  AE_GREEN_600,
  AE_RED_600,
  AE_COLORS,
  MOEI_HEADER_GRADIENT,
  MOEI_TOPBAR_GRADIENT,
  STATUS_CHART_COLORS,
  RISK_CHART_COLORS,
} from './constants'

// ─── Formatters ───────────────────────────────────────────────
export {
  formatAED,
  formatCurrency,
  maskEmiratesId,
  formatFileSize,
  parseJSON,
} from './formatters'

// ─── Status Config ────────────────────────────────────────────
export {
  STATUS_CONFIG,
  getStatusConfig,
  getStatusBadgeClasses,
} from './status-config'
export type { StatusConfig } from './status-config'

// ─── Risk Config ──────────────────────────────────────────────
export {
  RISK_CONFIG,
  getRiskConfig,
  RISK_CHART_COLORS as RISK_LEVEL_CHART_COLORS,
} from './risk-config'
export type { RiskConfig } from './risk-config'

// ─── Role Config ──────────────────────────────────────────────
export {
  ROLE_CONFIG,
  getRoleConfig,
} from './role-config'
export type { RoleConfig } from './role-config'

// ─── i18n ─────────────────────────────────────────────────────
export { t, Language } from './i18n'

// ─── UAE PASS Mock ────────────────────────────────────────────
export {
  MOCK_USERS,
  generateRandomMockUser,
  getUAEPEndpoints,
  generateUAEPassAuthUrl,
  MOCK_HOUSING_ASSISTANCE_FILES,
} from './uaepass-mock'
export type {
  UAEPassUserProfile,
  MockUserProfile,
  HousingAssistanceFile,
} from './uaepass-mock'

// ─── Utils ────────────────────────────────────────────────────
export { cn, authFetch, apiFetch } from './utils'

// ─── Store ────────────────────────────────────────────────────
export { useAppStore } from './store'
export type {
  AdminViewType,
  CustomerViewType,
  ViewType,
  ApplicantData,
  LoanData,
  ArrearData,
  AssessmentData,
  AuditLogData,
  UploadedFileData,
  RequestData,
  DashboardStats,
} from './store'

// ─── Auth Store ───────────────────────────────────────────────
export { useAuthStore } from './auth-store'
export type {
  UserRole,
  PortalType,
  AuthState,
} from './auth-store'

// ─── API ──────────────────────────────────────────────────────
export * from './api'

// ─── Business Logic ──────────────────────────────────────────
export * from './business'
