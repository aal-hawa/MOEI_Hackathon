// Dashboard API
export {
  fetchDashboardStats,
} from './dashboard'

// Cases API
export {
  fetchCases,
  fetchCaseDetail,
  updateCaseStatus,
  runAssessment,
} from './cases'
export type {
  Case,
  CaseDetail,
  CaseFilters,
  AssessmentResult,
} from './cases'

// Employees API
export {
  fetchEmployees,
  fetchEmployeeDetail,
  saveEmployee,
  toggleEmployeeActive,
} from './employees'
export type {
  Employee,
  EmployeeDetail,
  EmployeeFormData,
  LoginHistoryEntry,
  RecentAuditAction,
} from './employees'

// Audit API
export {
  fetchAuditLogs,
  fetchAuditStats,
} from './audit'
export type {
  AuditLog,
  AuditStats,
  AuditFilters,
  AuditLogUser,
  MostActiveUser,
} from './audit'

// Models API
export {
  fetchModels,
  seedModels,
  testModelConnection,
  saveModel,
  deleteModel,
  searchOllamaModels,
  searchHFModels,
  pullOllamaModel,
  deleteOllamaModel,
  fetchOllamaModels,
  fetchHardware,
} from './models'
export type {
  AIModel,
  OllamaModel,
  SeedResult,
  TestResult,
  ModelTestConfig,
  ModelFormData,
  PullResult,
  OllamaListResult,
  HardwareInfo,
  HardwareResult,
} from './models'

// Requests API
export {
  createRequest,
  fetchMyRequests,
  fetchRequestDetail,
} from './requests'
export type {
  Request,
  RequestDetail,
  RequestFormData,
  RequestApplicantData,
  RequestLoanData,
} from './requests'

// Upload API
export {
  uploadFile,
  downloadFile,
  viewFile,
  deleteFile,
} from './upload'
export type {
  UploadedFileData as UploadFileData,
  UploadResult,
} from './upload'
