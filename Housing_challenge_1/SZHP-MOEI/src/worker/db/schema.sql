-- SZHP MOEI D1 Database Schema
-- Converted from Prisma schema for Cloudflare D1
-- All DateTime → TEXT (ISO 8601), Boolean → INTEGER (0|1), JSON → TEXT

-- Applicants
CREATE TABLE IF NOT EXISTS Applicant (
  id TEXT PRIMARY KEY,
  emiratesId TEXT NOT NULL UNIQUE,
  nameAr TEXT NOT NULL,
  nameEn TEXT,
  phone TEXT NOT NULL,
  email TEXT,
  monthlyIncome REAL NOT NULL,
  employer TEXT,
  employerType TEXT,
  familySize INTEGER NOT NULL DEFAULT 1,
  isCitizen INTEGER NOT NULL DEFAULT 1,
  hasFamilyBook INTEGER NOT NULL DEFAULT 1,
  maritalStatus TEXT,
  spouseIncome REAL DEFAULT 0,
  totalHouseholdIncome REAL DEFAULT 0,
  incomeStability TEXT DEFAULT 'stable',
  previousIncome REAL,
  numberOfChildren INTEGER NOT NULL DEFAULT 0,
  housingType TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_applicant_emiratesId ON Applicant(emiratesId);

-- Housing Loans
CREATE TABLE IF NOT EXISTS HousingLoan (
  id TEXT PRIMARY KEY,
  applicantId TEXT NOT NULL,
  originalAmount REAL NOT NULL,
  remainingBalance REAL NOT NULL,
  monthlyInstallment REAL NOT NULL,
  loanDurationMonths INTEGER NOT NULL DEFAULT 0,
  elapsedMonths INTEGER NOT NULL DEFAULT 0,
  interestRate REAL NOT NULL DEFAULT 0,
  loanType TEXT NOT NULL,
  disbursementDate TEXT NOT NULL DEFAULT (datetime('now')),
  status TEXT NOT NULL DEFAULT 'active',
  paymentHistory TEXT NOT NULL DEFAULT '[]',
  totalPaid REAL NOT NULL DEFAULT 0,
  totalMissedPayments INTEGER NOT NULL DEFAULT 0,
  reschedulingCount INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (applicantId) REFERENCES Applicant(id)
);
CREATE INDEX IF NOT EXISTS idx_loan_applicantId ON HousingLoan(applicantId);

-- Arrears
CREATE TABLE IF NOT EXISTS Arrear (
  id TEXT PRIMARY KEY,
  loanId TEXT NOT NULL,
  missedMonths INTEGER NOT NULL,
  totalOverdue REAL NOT NULL,
  delayDays INTEGER NOT NULL,
  reason TEXT,
  consecutiveMissedMonths INTEGER NOT NULL DEFAULT 0,
  firstMissedDate TEXT,
  lastPaymentDate TEXT,
  lastPaymentAmount REAL,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (loanId) REFERENCES HousingLoan(id)
);
CREATE INDEX IF NOT EXISTS idx_arrear_loanId ON Arrear(loanId);

-- Rescheduling Requests
CREATE TABLE IF NOT EXISTS ReschedulingRequest (
  id TEXT PRIMARY KEY,
  applicantId TEXT NOT NULL,
  loanId TEXT NOT NULL,
  requestedDurationMonths INTEGER NOT NULL,
  reason TEXT,
  reasonCategory TEXT NOT NULL,
  supportingDocuments TEXT NOT NULL DEFAULT '[]',
  uploadedFiles TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending',
  priority TEXT NOT NULL DEFAULT 'normal',
  notes TEXT,
  reviewedBy TEXT,
  reviewedAt TEXT,
  isViewed INTEGER NOT NULL DEFAULT 0,
  firstViewedAt TEXT,
  incomePerFamilyMember REAL,
  deductionRate REAL,
  documentCompleteness TEXT DEFAULT 'pending',
  missingDocuments TEXT NOT NULL DEFAULT '[]',
  moeiCompliance TEXT NOT NULL DEFAULT '[]',
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (applicantId) REFERENCES Applicant(id),
  FOREIGN KEY (loanId) REFERENCES HousingLoan(id)
);
CREATE INDEX IF NOT EXISTS idx_request_applicantId ON ReschedulingRequest(applicantId);
CREATE INDEX IF NOT EXISTS idx_request_loanId ON ReschedulingRequest(loanId);
CREATE INDEX IF NOT EXISTS idx_request_status ON ReschedulingRequest(status);

-- AI Assessments
CREATE TABLE IF NOT EXISTS AIAssessment (
  id TEXT PRIMARY KEY,
  requestId TEXT NOT NULL UNIQUE,
  riskScore REAL NOT NULL,
  riskLevel TEXT NOT NULL,
  confidenceScore REAL NOT NULL,
  recommendedAmount REAL NOT NULL,
  recommendedDuration INTEGER NOT NULL,
  recommendedInstallment REAL NOT NULL,
  debtBurdenRatio REAL NOT NULL,
  proposedDBR REAL NOT NULL,
  eligibilityStatus TEXT NOT NULL,
  decisionRationale TEXT NOT NULL,
  governanceCompliance TEXT NOT NULL DEFAULT '[]',
  riskFactors TEXT NOT NULL DEFAULT '[]',
  shapExplanation TEXT NOT NULL DEFAULT '[]',
  requiresHumanReview INTEGER NOT NULL DEFAULT 0,
  humanReviewReason TEXT,
  aiModelVersion TEXT NOT NULL DEFAULT 'v1.0',
  processingTimeMs INTEGER,
  applicationStatus TEXT,
  incomeAnalysis TEXT,
  proposedDeductionRate REAL,
  rule20PercentCompliance TEXT,
  periodRuleCompliance TEXT,
  moeiRecommendation TEXT,
  moeiReasoning TEXT,
  caseSummary TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (requestId) REFERENCES ReschedulingRequest(id)
);
CREATE INDEX IF NOT EXISTS idx_assessment_requestId ON AIAssessment(requestId);

-- Audit Logs
CREATE TABLE IF NOT EXISTS AuditLog (
  id TEXT PRIMARY KEY,
  requestId TEXT,
  action TEXT NOT NULL,
  performedBy TEXT NOT NULL,
  details TEXT NOT NULL,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  performedByUserId TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  previousValue TEXT,
  newValue TEXT,
  affectedRecord TEXT,
  ipAddress TEXT,
  userAgent TEXT,
  FOREIGN KEY (requestId) REFERENCES ReschedulingRequest(id),
  FOREIGN KEY (performedByUserId) REFERENCES User(id)
);
CREATE INDEX IF NOT EXISTS idx_auditlog_requestId ON AuditLog(requestId);
CREATE INDEX IF NOT EXISTS idx_auditlog_performedByUserId ON AuditLog(performedByUserId);
CREATE INDEX IF NOT EXISTS idx_auditlog_category ON AuditLog(category);
CREATE INDEX IF NOT EXISTS idx_auditlog_timestamp ON AuditLog(timestamp);

-- Governance Rules
CREATE TABLE IF NOT EXISTS GovernanceRule (
  id TEXT PRIMARY KEY,
  ruleCode TEXT NOT NULL UNIQUE,
  nameEn TEXT NOT NULL,
  nameAr TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  condition TEXT NOT NULL,
  isActive INTEGER NOT NULL DEFAULT 1,
  priority INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Users
CREATE TABLE IF NOT EXISTS User (
  id TEXT PRIMARY KEY,
  uaepassSub TEXT NOT NULL UNIQUE,
  emiratesId TEXT NOT NULL UNIQUE,
  email TEXT,
  phone TEXT,
  firstnameEN TEXT NOT NULL,
  lastnameEN TEXT NOT NULL,
  firstnameAR TEXT,
  lastnameAR TEXT,
  fullnameEN TEXT NOT NULL,
  fullnameAR TEXT,
  nationalityEN TEXT,
  nationalityAR TEXT,
  gender TEXT,
  dob TEXT,
  avatarUrl TEXT,
  role TEXT NOT NULL DEFAULT 'citizen',
  department TEXT,
  sopLevel TEXT NOT NULL DEFAULT 'sop2',
  isActive INTEGER NOT NULL DEFAULT 1,
  lastLoginAt TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  passwordHash TEXT,
  twoFactorSecret TEXT,
  twoFactorEnabled INTEGER NOT NULL DEFAULT 0,
  permissions TEXT NOT NULL DEFAULT '[]',
  loginAttempts INTEGER NOT NULL DEFAULT 0,
  lockedUntil TEXT
);
CREATE INDEX IF NOT EXISTS idx_user_email ON User(email);
CREATE INDEX IF NOT EXISTS idx_user_role ON User(role);

-- Sessions
CREATE TABLE IF NOT EXISTS Session (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  accessToken TEXT NOT NULL,
  refreshToken TEXT,
  authMode TEXT NOT NULL DEFAULT 'mock',
  expiresAt TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  ipAddress TEXT,
  userAgent TEXT,
  deviceInfo TEXT,
  FOREIGN KEY (userId) REFERENCES User(id)
);
CREATE INDEX IF NOT EXISTS idx_session_accessToken ON Session(accessToken);
CREATE INDEX IF NOT EXISTS idx_session_userId ON Session(userId);

-- Form Fields
CREATE TABLE IF NOT EXISTS FormField (
  id TEXT PRIMARY KEY,
  labelEN TEXT NOT NULL,
  labelAR TEXT NOT NULL,
  fieldKey TEXT NOT NULL UNIQUE,
  fieldType TEXT NOT NULL,
  placeholderEN TEXT,
  placeholderAR TEXT,
  helpTextEN TEXT,
  helpTextAR TEXT,
  required INTEGER NOT NULL DEFAULT 1,
  "order" INTEGER NOT NULL DEFAULT 0,
  section TEXT NOT NULL DEFAULT 'personal',
  options TEXT NOT NULL DEFAULT '[]',
  validation TEXT NOT NULL DEFAULT '{}',
  ruleDescriptionEN TEXT,
  ruleDescriptionAR TEXT,
  showRule INTEGER NOT NULL DEFAULT 1,
  aiValidationPrompt TEXT,
  aiAutoValidate INTEGER NOT NULL DEFAULT 0,
  isVisible INTEGER NOT NULL DEFAULT 1,
  isActive INTEGER NOT NULL DEFAULT 1,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Approval Workflows
CREATE TABLE IF NOT EXISTS ApprovalWorkflow (
  id TEXT PRIMARY KEY,
  nameEN TEXT NOT NULL,
  nameAR TEXT NOT NULL,
  descriptionEN TEXT,
  descriptionAR TEXT,
  steps TEXT NOT NULL DEFAULT '[]',
  autoApprovalRules TEXT NOT NULL DEFAULT '{}',
  autoRejectionRules TEXT NOT NULL DEFAULT '{}',
  isActive INTEGER NOT NULL DEFAULT 1,
  priority INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

-- System Config
CREATE TABLE IF NOT EXISTS SystemConfig (
  id TEXT PRIMARY KEY,
  configKey TEXT NOT NULL UNIQUE,
  configValue TEXT NOT NULL,
  defaultValue TEXT NOT NULL,
  labelEN TEXT NOT NULL,
  labelAR TEXT NOT NULL,
  descriptionEN TEXT,
  descriptionAR TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  valueType TEXT NOT NULL DEFAULT 'number',
  min REAL,
  max REAL,
  unit TEXT,
  isPublic INTEGER NOT NULL DEFAULT 0,
  isActive INTEGER NOT NULL DEFAULT 1,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_systemconfig_category ON SystemConfig(category);

-- Login History
CREATE TABLE IF NOT EXISTS LoginHistory (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  loginAt TEXT NOT NULL DEFAULT (datetime('now')),
  logoutAt TEXT,
  ipAddress TEXT,
  userAgent TEXT,
  deviceInfo TEXT,
  authMethod TEXT NOT NULL DEFAULT 'uaepass',
  success INTEGER NOT NULL DEFAULT 1,
  failureReason TEXT,
  FOREIGN KEY (userId) REFERENCES User(id)
);
CREATE INDEX IF NOT EXISTS idx_loginhistory_userId ON LoginHistory(userId);

-- AI Model Config
CREATE TABLE IF NOT EXISTS AIModelConfig (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  modelId TEXT NOT NULL,
  baseUrl TEXT NOT NULL,
  apiKey TEXT,
  isActive INTEGER NOT NULL DEFAULT 1,
  isDefault INTEGER NOT NULL DEFAULT 0,
  capabilities TEXT NOT NULL DEFAULT '[]',
  maxTokens INTEGER NOT NULL DEFAULT 4096,
  temperature REAL NOT NULL DEFAULT 0.7,
  descriptionEN TEXT,
  descriptionAR TEXT,
  lastTestedAt TEXT,
  lastTestResult TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);
