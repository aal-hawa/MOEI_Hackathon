/**
 * TypeScript types for the Cloudflare Worker backend
 */

// ── Cloudflare Bindings ─────────────────────────────────────────────
export interface Env {
  DB: D1Database
  STORAGE: R2Bucket
  KV: KVNamespace
  RECENTECH_BASE_URL?: string
  RECENTECH_API_KEY?: string
  Z_AI_TOKEN?: string
  Z_AI_USER_ID?: string
  Z_AI_CHAT_ID?: string
  ALLOW_ADMIN_SEED?: string
}

// ── Data Types matching D1 Schema ───────────────────────────────────
export interface Applicant {
  id: string
  emiratesId: string
  nameAr: string
  nameEn: string | null
  phone: string
  email: string | null
  monthlyIncome: number
  employer: string | null
  employerType: string | null
  familySize: number
  isCitizen: number // INTEGER 0|1
  hasFamilyBook: number // INTEGER 0|1
  maritalStatus: string | null
  spouseIncome: number | null
  totalHouseholdIncome: number | null
  incomeStability: string | null
  previousIncome: number | null
  numberOfChildren: number
  housingType: string | null
  createdAt: string
  updatedAt: string
}

export interface HousingLoan {
  id: string
  applicantId: string
  originalAmount: number
  remainingBalance: number
  monthlyInstallment: number
  loanDurationMonths: number
  elapsedMonths: number
  interestRate: number
  loanType: string
  disbursementDate: string
  status: string
  paymentHistory: string // JSON
  totalPaid: number
  totalMissedPayments: number
  reschedulingCount: number
  createdAt: string
  updatedAt: string
}

export interface Arrear {
  id: string
  loanId: string
  missedMonths: number
  totalOverdue: number
  delayDays: number
  reason: string | null
  consecutiveMissedMonths: number
  firstMissedDate: string | null
  lastPaymentDate: string | null
  lastPaymentAmount: number | null
  createdAt: string
  updatedAt: string
}

export interface ReschedulingRequest {
  id: string
  applicantId: string
  loanId: string
  requestedDurationMonths: number
  reason: string | null
  reasonCategory: string
  supportingDocuments: string // JSON
  uploadedFiles: string // JSON
  status: string
  priority: string
  notes: string | null
  reviewedBy: string | null
  reviewedAt: string | null
  isViewed: number // INTEGER 0|1
  firstViewedAt: string | null
  incomePerFamilyMember: number | null
  deductionRate: number | null
  documentCompleteness: string | null
  missingDocuments: string // JSON
  moeiCompliance: string // JSON
  createdAt: string
  updatedAt: string
}

export interface AIAssessment {
  id: string
  requestId: string
  riskScore: number
  riskLevel: string
  confidenceScore: number
  recommendedAmount: number
  recommendedDuration: number
  recommendedInstallment: number
  debtBurdenRatio: number
  proposedDBR: number
  eligibilityStatus: string
  decisionRationale: string // JSON
  governanceCompliance: string // JSON
  riskFactors: string // JSON
  shapExplanation: string // JSON
  requiresHumanReview: number // INTEGER 0|1
  humanReviewReason: string | null
  aiModelVersion: string
  processingTimeMs: number | null
  applicationStatus: string | null
  incomeAnalysis: string | null // JSON
  proposedDeductionRate: number | null
  rule20PercentCompliance: string | null
  periodRuleCompliance: string | null
  moeiRecommendation: string | null
  moeiReasoning: string | null
  caseSummary: string | null
  createdAt: string
}

export interface AuditLog {
  id: string
  requestId: string | null
  action: string
  performedBy: string
  details: string // JSON
  timestamp: string
  performedByUserId: string | null
  category: string
  previousValue: string | null // JSON
  newValue: string | null // JSON
  affectedRecord: string | null
  ipAddress: string | null
  userAgent: string | null
}

export interface GovernanceRule {
  id: string
  ruleCode: string
  nameEn: string
  nameAr: string
  description: string
  category: string
  condition: string // JSON
  isActive: number // INTEGER 0|1
  priority: number
  createdAt: string
  updatedAt: string
}

export interface User {
  id: string
  uaepassSub: string
  emiratesId: string
  email: string | null
  phone: string | null
  firstnameEN: string
  lastnameEN: string
  firstnameAR: string | null
  lastnameAR: string | null
  fullnameEN: string
  fullnameAR: string | null
  nationalityEN: string | null
  nationalityAR: string | null
  gender: string | null
  dob: string | null
  avatarUrl: string | null
  role: string
  department: string | null
  sopLevel: string
  isActive: number // INTEGER 0|1
  lastLoginAt: string | null
  createdAt: string
  updatedAt: string
  passwordHash: string | null
  twoFactorSecret: string | null
  twoFactorEnabled: number // INTEGER 0|1
  permissions: string // JSON
  loginAttempts: number
  lockedUntil: string | null
}

export interface Session {
  id: string
  userId: string
  accessToken: string
  refreshToken: string | null
  authMode: string
  expiresAt: string
  createdAt: string
  ipAddress: string | null
  userAgent: string | null
  deviceInfo: string | null
}

export interface FormField {
  id: string
  labelEN: string
  labelAR: string
  fieldKey: string
  fieldType: string
  placeholderEN: string | null
  placeholderAR: string | null
  helpTextEN: string | null
  helpTextAR: string | null
  required: number // INTEGER 0|1
  order: number
  section: string
  options: string // JSON
  validation: string // JSON
  ruleDescriptionEN: string | null
  ruleDescriptionAR: string | null
  showRule: number // INTEGER 0|1
  aiValidationPrompt: string | null
  aiAutoValidate: number // INTEGER 0|1
  isVisible: number // INTEGER 0|1
  isActive: number // INTEGER 0|1
  createdAt: string
  updatedAt: string
}

export interface ApprovalWorkflow {
  id: string
  nameEN: string
  nameAR: string
  descriptionEN: string | null
  descriptionAR: string | null
  steps: string // JSON
  autoApprovalRules: string // JSON
  autoRejectionRules: string // JSON
  isActive: number // INTEGER 0|1
  priority: number
  createdAt: string
  updatedAt: string
}

export interface SystemConfig {
  id: string
  configKey: string
  configValue: string
  defaultValue: string
  labelEN: string
  labelAR: string
  descriptionEN: string | null
  descriptionAR: string | null
  category: string
  valueType: string
  min: number | null
  max: number | null
  unit: string | null
  isPublic: number // INTEGER 0|1
  isActive: number // INTEGER 0|1
  createdAt: string
  updatedAt: string
}

export interface LoginHistory {
  id: string
  userId: string
  loginAt: string
  logoutAt: string | null
  ipAddress: string | null
  userAgent: string | null
  deviceInfo: string | null
  authMethod: string
  success: number // INTEGER 0|1
  failureReason: string | null
}

export interface AIModelConfig {
  id: string
  name: string
  provider: string
  modelId: string
  baseUrl: string
  apiKey: string | null
  isActive: number // INTEGER 0|1
  isDefault: number // INTEGER 0|1
  capabilities: string // JSON
  maxTokens: number
  temperature: number
  descriptionEN: string | null
  descriptionAR: string | null
  lastTestedAt: string | null
  lastTestResult: string | null
  createdAt: string
  updatedAt: string
}

// ── API Request/Response Types ──────────────────────────────────────
export interface AuthResult {
  authenticated: boolean
  user?: {
    id: string
    email: string | null
    role: string
    permissions: string[]
    isActive: boolean
  }
  session?: {
    id: string
    authMode: string
    expiresAt: string
  }
  error?: string
}

export interface AIProviderConfig {
  id?: string
  provider: 'recentech' | 'openai' | 'gemini' | 'ollama' | 'openai_compatible'
  modelId: string
  baseUrl: string
  apiKey?: string | null
  maxTokens?: number
  temperature?: number
  isActive?: boolean
  isDefault?: boolean
  capabilities?: string[]
  // Z.ai authentication headers
  zaiToken?: string
  zaiUserId?: string
  zaiChatId?: string
}

export interface ChatMessage {
  role: 'system' | 'assistant' | 'user'
  content: string
}

export interface ChatCompletionResult {
  content: string
  model: string
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
  provider: string
}

export interface VisionResult {
  content: string
  model: string
  provider: string
}
