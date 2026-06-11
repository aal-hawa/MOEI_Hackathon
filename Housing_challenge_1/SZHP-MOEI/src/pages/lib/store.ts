import { create } from 'zustand'

// Admin dashboard view types
export type AdminViewType = 'dashboard' | 'new-request' | 'cases' | 'case-detail' | 'settings' | 'form-builder' | 'workflows' | 'rules' | 'users' | 'audit' | 'reports' | 'models' | 'data-import'

// Customer portal view types
export type CustomerViewType = 'overview' | 'new-request' | 'my-requests' | 'request-detail' | 'my-loans' | 'documents' | 'profile'

// Unified view type that supports both portals
export type ViewType = AdminViewType | CustomerViewType

interface AppState {
  // Navigation
  currentView: ViewType
  selectedCaseId: string | null
  
  // Layout
  sidebarCollapsed: boolean
  
  // Localization
  language: 'en' | 'ar'
  
  // Filters
  searchQuery: string
  statusFilter: string
  riskFilter: string
  
  // Portal-specific
  customerView: CustomerViewType
  adminView: AdminViewType
}

interface AppActions {
  // Navigation
  setView: (view: ViewType) => void
  selectCase: (id: string) => void
  
  // Layout
  toggleSidebar: () => void
  
  // Localization
  setLanguage: (lang: 'en' | 'ar') => void
  
  // Filters
  setSearchQuery: (query: string) => void
  setStatusFilter: (status: string) => void
  setRiskFilter: (risk: string) => void
  resetFilters: () => void
  
  // Portal navigation helpers
  setCustomerView: (view: CustomerViewType) => void
  setAdminView: (view: AdminViewType) => void
}

export const useAppStore = create<AppState & AppActions>((set) => ({
  currentView: 'cases',
  selectedCaseId: null,
  sidebarCollapsed: false,
  language: 'ar',
  searchQuery: '',
  statusFilter: 'all',
  riskFilter: 'all',
  customerView: 'overview',
  adminView: 'cases',

  setView: (view) => set({ currentView: view, selectedCaseId: null }),
  selectCase: (id) => set({ currentView: 'case-detail', selectedCaseId: id }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setLanguage: (lang) => set({ language: lang }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setStatusFilter: (status) => set({ statusFilter: status }),
  setRiskFilter: (risk) => set({ riskFilter: risk }),
  resetFilters: () => set({ searchQuery: '', statusFilter: 'all', riskFilter: 'all' }),
  setCustomerView: (view) => set({ currentView: view, customerView: view }),
  setAdminView: (view) => set({ currentView: view, adminView: view }),
}))

// Type definitions for API responses
export interface ApplicantData {
  id: string
  emiratesId: string
  nameAr: string
  nameEn: string
  phone: string
  email: string | null
  monthlyIncome: number
  employer: string
  employerType: string
  familySize: number
  isCitizen: boolean
  hasFamilyBook: boolean
  // MOEI-specific fields
  maritalStatus?: string | null
  spouseIncome?: number | null
  totalHouseholdIncome?: number | null
  incomeStability?: string | null
  previousIncome?: number | null
  numberOfChildren?: number | null
  housingType?: string | null
}

export interface LoanData {
  id: string
  originalAmount: number
  remainingBalance: number
  monthlyInstallment: number
  loanDurationMonths: number
  elapsedMonths: number
  interestRate: number
  loanType: string
  disbursementDate: string
  status: string
}

export interface ArrearData {
  id: string
  missedMonths: number
  totalOverdue: number
  delayDays: number
  reason: string | null
}

export interface AssessmentData {
  id: string
  riskScore: number
  riskLevel: string
  confidenceScore: number
  recommendedAmount: number
  recommendedDuration: number
  recommendedInstallment: number
  debtBurdenRatio: number
  proposedDBR: number
  eligibilityStatus: string
  decisionRationale: string
  governanceCompliance: string
  riskFactors: string
  shapExplanation: string
  requiresHumanReview: boolean
  humanReviewReason: string | null
  aiModelVersion: string
  processingTimeMs: number | null
  createdAt: string
  // MOEI-specific fields
  applicationStatus?: string | null
  incomeAnalysis?: string | null
  proposedDeductionRate?: number | null
  rule20PercentCompliance?: string | null
  periodRuleCompliance?: string | null
  moeiRecommendation?: string | null
  moeiReasoning?: string | null
  caseSummary?: string | null
}

export interface AuditLogData {
  id: string
  action: string
  performedBy: string
  details: string
  timestamp: string
}

export interface UploadedFileData {
  id: string
  originalName: string
  storedName: string
  size: number
  type: string
  uploadedAt: string
  docType?: string
}

export interface RequestData {
  id: string
  applicantId: string
  loanId: string
  requestedDurationMonths: number
  reason: string
  reasonCategory: string
  supportingDocuments: string
  uploadedFiles: string
  status: string
  priority: string
  notes: string | null
  reviewedBy: string | null
  reviewedAt: string | null
  createdAt: string
  updatedAt: string
  applicant?: ApplicantData
  loan?: LoanData
  assessment?: AssessmentData | null
  auditLogs?: AuditLogData[]
  arrear?: ArrearData
  // MOEI-specific fields
  incomePerFamilyMember?: number | null
  deductionRate?: number | null
  documentCompleteness?: string | null
  missingDocuments?: string | null
  moeiCompliance?: string | null
}

export interface DashboardStats {
  totalRequests: number
  pendingReview: number
  approvedThisMonth: number
  rejectedThisMonth: number
  avgProcessingTime: number
  automationRate: number
  statusDistribution: { status: string; count: number }[]
  riskDistribution: { riskLevel: string; count: number }[]
  monthlyTrend: { month: string; requests: number; approved: number; rejected: number }[]
  recentRequests: RequestData[]
  avgMonthlyInstallment: number
  totalOutstandingArrears: number
  // MOEI-specific stats
  rule20ComplianceRate?: number
  incomeBelowThresholdCount?: number
  documentCompletionRate?: number
  // Real analytics
  genderDistribution?: { gender: string; count: number }[]
  ageDistribution?: { ageGroup: string; count: number }[]
  avgResponseTimeHours?: number
  nationalityDistribution?: { nationality: string; count: number }[]
  responseTimeTrend?: { month: string; avgHours: number }[]
}
