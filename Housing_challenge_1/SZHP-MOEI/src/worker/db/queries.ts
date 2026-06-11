/**
 * Database Queries Helper for Cloudflare D1
 * Wraps D1 with type-safe query methods using parameterized queries
 */

import type { Env } from '../types'

export class DbClient {
  private db: D1Database

  constructor(db: D1Database) {
    this.db = db
  }

  // ── User Queries ──────────────────────────────────────────────────
  async findUserBySub(uaepassSub: string) {
    return this.db.prepare('SELECT * FROM User WHERE uaepassSub = ?').bind(uaepassSub).first()
  }

  async findUserByEmail(email: string) {
    return this.db.prepare('SELECT * FROM User WHERE email = ?').bind(email).first()
  }

  async findUserById(id: string) {
    return this.db.prepare('SELECT * FROM User WHERE id = ?').bind(id).first()
  }

  async findUserByEmiratesId(emiratesId: string) {
    return this.db.prepare('SELECT * FROM User WHERE emiratesId = ?').bind(emiratesId).first()
  }

  async findAdminUsers(limit: number = 50, offset: number = 0) {
    return this.db.prepare(
      'SELECT * FROM User WHERE role != ? ORDER BY createdAt DESC LIMIT ? OFFSET ?'
    ).bind('citizen', limit, offset).all()
  }

  async countAdminUsers() {
    const result = await this.db.prepare(
      'SELECT COUNT(*) as count FROM User WHERE role != ?'
    ).bind('citizen').first()
    return (result as any)?.count || 0
  }

  async createUser(data: {
    id: string; uaepassSub: string; emiratesId: string; email?: string | null;
    phone?: string | null; firstnameEN: string; lastnameEN: string;
    firstnameAR?: string | null; lastnameAR?: string | null;
    fullnameEN: string; fullnameAR?: string | null;
    nationalityEN?: string | null; nationalityAR?: string | null;
    gender?: string | null; dob?: string | null; avatarUrl?: string | null;
    role: string; department?: string | null; sopLevel?: string;
    permissions?: string; isActive?: number;
    passwordHash?: string | null; loginAttempts?: number;
  }) {
    return this.db.prepare(`
      INSERT INTO User (id, uaepassSub, emiratesId, email, phone, firstnameEN, lastnameEN,
        firstnameAR, lastnameAR, fullnameEN, fullnameAR, nationalityEN, nationalityAR,
        gender, dob, avatarUrl, role, department, sopLevel, permissions, isActive,
        passwordHash, loginAttempts, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(
      data.id, data.uaepassSub, data.emiratesId, data.email ?? null,
      data.phone ?? null, data.firstnameEN, data.lastnameEN,
      data.firstnameAR ?? null, data.lastnameAR ?? null,
      data.fullnameEN, data.fullnameAR ?? null,
      data.nationalityEN ?? null, data.nationalityAR ?? null,
      data.gender ?? null, data.dob ?? null, data.avatarUrl ?? null,
      data.role, data.department ?? null, data.sopLevel ?? 'sop2',
      data.permissions ?? '[]', data.isActive ?? 1,
      data.passwordHash ?? null, data.loginAttempts ?? 0
    ).run()
  }

  async updateUser(id: string, data: Record<string, unknown>) {
    const keys = Object.keys(data)
    const setClauses = keys.map(k => `${k} = ?`).join(', ')
    const values = keys.map(k => data[k])
    return this.db.prepare(
      `UPDATE User SET ${setClauses}, updatedAt = datetime('now') WHERE id = ?`
    ).bind(...values, id).run()
  }

  // ── Session Queries ───────────────────────────────────────────────
  async findSessionByToken(accessToken: string) {
    return this.db.prepare(`
      SELECT s.*, u.* FROM Session s
      JOIN User u ON s.userId = u.id
      WHERE s.accessToken = ?
    `).bind(accessToken).first()
  }

  async createSession(data: {
    id: string; userId: string; accessToken: string;
    authMode: string; expiresAt: string;
    ipAddress?: string | null; userAgent?: string | null; deviceInfo?: string | null;
  }) {
    return this.db.prepare(`
      INSERT INTO Session (id, userId, accessToken, authMode, expiresAt, ipAddress, userAgent, deviceInfo, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      data.id, data.userId, data.accessToken, data.authMode, data.expiresAt,
      data.ipAddress ?? null, data.userAgent ?? null, data.deviceInfo ?? null
    ).run()
  }

  async deleteSession(id: string) {
    return this.db.prepare('DELETE FROM Session WHERE id = ?').bind(id).run()
  }

  async deleteSessionsByUser(userId: string) {
    return this.db.prepare(
      "DELETE FROM Session WHERE userId = ? AND expiresAt > datetime('now')"
    ).bind(userId).run()
  }

  // ── Applicant Queries ─────────────────────────────────────────────
  async findApplicantByEmiratesId(emiratesId: string) {
    return this.db.prepare('SELECT * FROM Applicant WHERE emiratesId = ?').bind(emiratesId).first()
  }

  async findApplicantById(id: string) {
    return this.db.prepare('SELECT * FROM Applicant WHERE id = ?').bind(id).first()
  }

  async createApplicant(data: {
    id: string; emiratesId: string; nameAr: string; nameEn?: string | null;
    phone: string; email?: string | null; monthlyIncome: number;
    employer?: string | null; employerType?: string | null;
    familySize: number; isCitizen: number; hasFamilyBook: number;
    maritalStatus?: string | null; spouseIncome?: number | null;
    totalHouseholdIncome?: number | null; incomeStability?: string | null;
    previousIncome?: number | null; numberOfChildren?: number;
    housingType?: string | null;
  }) {
    return this.db.prepare(`
      INSERT INTO Applicant (id, emiratesId, nameAr, nameEn, phone, email, monthlyIncome,
        employer, employerType, familySize, isCitizen, hasFamilyBook, maritalStatus,
        spouseIncome, totalHouseholdIncome, incomeStability, previousIncome,
        numberOfChildren, housingType, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(
      data.id, data.emiratesId, data.nameAr, data.nameEn ?? null,
      data.phone, data.email ?? null, data.monthlyIncome,
      data.employer ?? null, data.employerType ?? null,
      data.familySize, data.isCitizen, data.hasFamilyBook,
      data.maritalStatus ?? null, data.spouseIncome ?? null,
      data.totalHouseholdIncome ?? null, data.incomeStability ?? null,
      data.previousIncome ?? null, data.numberOfChildren ?? 0,
      data.housingType ?? null
    ).run()
  }

  async updateApplicant(id: string, data: Record<string, unknown>) {
    const keys = Object.keys(data)
    const setClauses = keys.map(k => `${k} = ?`).join(', ')
    const values = keys.map(k => data[k])
    return this.db.prepare(
      `UPDATE Applicant SET ${setClauses}, updatedAt = datetime('now') WHERE id = ?`
    ).bind(...values, id).run()
  }

  // ── Loan Queries ──────────────────────────────────────────────────
  async createLoan(data: {
    id: string; applicantId: string; originalAmount: number;
    remainingBalance: number; monthlyInstallment: number;
    loanDurationMonths: number; elapsedMonths: number;
    interestRate: number; loanType: string; status: string;
  }) {
    return this.db.prepare(`
      INSERT INTO HousingLoan (id, applicantId, originalAmount, remainingBalance,
        monthlyInstallment, loanDurationMonths, elapsedMonths, interestRate,
        loanType, status, paymentHistory, totalPaid, totalMissedPayments,
        reschedulingCount, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', 0, 0, 0, datetime('now'), datetime('now'))
    `).bind(
      data.id, data.applicantId, data.originalAmount, data.remainingBalance,
      data.monthlyInstallment, data.loanDurationMonths, data.elapsedMonths,
      data.interestRate, data.loanType, data.status
    ).run()
  }

  async findLoanById(id: string) {
    return this.db.prepare('SELECT * FROM HousingLoan WHERE id = ?').bind(id).first()
  }

  // ── Arrear Queries ────────────────────────────────────────────────
  async createArrear(data: {
    id: string; loanId: string; missedMonths: number;
    totalOverdue: number; delayDays: number; reason?: string | null;
  }) {
    return this.db.prepare(`
      INSERT INTO Arrear (id, loanId, missedMonths, totalOverdue, delayDays, reason,
        consecutiveMissedMonths, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, 0, datetime('now'), datetime('now'))
    `).bind(data.id, data.loanId, data.missedMonths, data.totalOverdue, data.delayDays, data.reason ?? null).run()
  }

  async findArrearsByLoanId(loanId: string) {
    return this.db.prepare('SELECT * FROM Arrear WHERE loanId = ?').bind(loanId).all()
  }

  // ── Request Queries ───────────────────────────────────────────────
  async createRequest(data: {
    id: string; applicantId: string; loanId: string;
    requestedDurationMonths: number; reason: string | null;
    reasonCategory: string; supportingDocuments: string;
    uploadedFiles: string; priority: string; notes: string | null; status: string;
  }) {
    return this.db.prepare(`
      INSERT INTO ReschedulingRequest (id, applicantId, loanId, requestedDurationMonths,
        reason, reasonCategory, supportingDocuments, uploadedFiles, priority, notes, status,
        isViewed, missingDocuments, moeiCompliance, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, '[]', '[]', datetime('now'), datetime('now'))
    `).bind(
      data.id, data.applicantId, data.loanId, data.requestedDurationMonths,
      data.reason, data.reasonCategory, data.supportingDocuments,
      data.uploadedFiles, data.priority, data.notes, data.status
    ).run()
  }

  async findRequestById(id: string) {
    return this.db.prepare('SELECT * FROM ReschedulingRequest WHERE id = ?').bind(id).first()
  }

  async updateRequest(id: string, data: Record<string, unknown>) {
    const keys = Object.keys(data)
    const setClauses = keys.map(k => `${k} = ?`).join(', ')
    const values = keys.map(k => data[k])
    return this.db.prepare(
      `UPDATE ReschedulingRequest SET ${setClauses}, updatedAt = datetime('now') WHERE id = ?`
    ).bind(...values, id).run()
  }

  // ── Assessment Queries ────────────────────────────────────────────
  async findAssessmentByRequestId(requestId: string) {
    return this.db.prepare('SELECT * FROM AIAssessment WHERE requestId = ?').bind(requestId).first()
  }

  async createAssessment(data: Record<string, unknown>) {
    const keys = Object.keys(data)
    const placeholders = keys.map(() => '?').join(', ')
    const values = keys.map(k => data[k])
    return this.db.prepare(
      `INSERT INTO AIAssessment (${keys.join(', ')}, createdAt) VALUES (${placeholders}, datetime('now'))`
    ).bind(...values).run()
  }

  // ── Audit Log Queries ─────────────────────────────────────────────
  async createAuditLog(data: {
    id: string; requestId?: string | null; action: string; performedBy: string;
    details: string; category?: string; performedByUserId?: string | null;
    affectedRecord?: string | null; previousValue?: string | null;
    newValue?: string | null; ipAddress?: string | null; userAgent?: string | null;
  }) {
    return this.db.prepare(`
      INSERT INTO AuditLog (id, requestId, action, performedBy, details, category,
        performedByUserId, affectedRecord, previousValue, newValue, ipAddress, userAgent, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      data.id, data.requestId ?? null, data.action, data.performedBy,
      data.details, data.category ?? 'general', data.performedByUserId ?? null,
      data.affectedRecord ?? null, data.previousValue ?? null,
      data.newValue ?? null, data.ipAddress ?? null, data.userAgent ?? null
    ).run()
  }

  async createAuditLogsBatch(logs: Array<{
    id: string; requestId?: string | null; action: string; performedBy: string;
    details: string; category?: string; performedByUserId?: string | null;
    affectedRecord?: string | null; previousValue?: string | null;
    newValue?: string | null; ipAddress?: string | null; userAgent?: string | null;
  }>) {
    const stmt = this.db.prepare(`
      INSERT INTO AuditLog (id, requestId, action, performedBy, details, category,
        performedByUserId, affectedRecord, previousValue, newValue, ipAddress, userAgent, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `)
    const batch = logs.map(l => stmt.bind(
      l.id, l.requestId ?? null, l.action, l.performedBy,
      l.details, l.category ?? 'general', l.performedByUserId ?? null,
      l.affectedRecord ?? null, l.previousValue ?? null,
      l.newValue ?? null, l.ipAddress ?? null, l.userAgent ?? null
    ))
    return this.db.batch(batch)
  }

  // ── Login History Queries ─────────────────────────────────────────
  async createLoginHistory(data: {
    id: string; userId: string; authMethod: string; success: number;
    failureReason?: string | null; ipAddress?: string | null;
    userAgent?: string | null;
  }) {
    return this.db.prepare(`
      INSERT INTO LoginHistory (id, userId, authMethod, success, failureReason, ipAddress, userAgent, loginAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      data.id, data.userId, data.authMethod, data.success,
      data.failureReason ?? null, data.ipAddress ?? null, data.userAgent ?? null
    ).run()
  }

  async findLastLoginByUserId(userId: string) {
    return this.db.prepare(
      "SELECT * FROM LoginHistory WHERE userId = ? AND success = 1 ORDER BY loginAt DESC LIMIT 1"
    ).bind(userId).first()
  }

  // ── System Config Queries ─────────────────────────────────────────
  async findActiveConfigs() {
    return this.db.prepare('SELECT * FROM SystemConfig WHERE isActive = 1').all()
  }

  async findConfigByKey(configKey: string) {
    return this.db.prepare('SELECT * FROM SystemConfig WHERE configKey = ?').bind(configKey).first()
  }

  async updateConfigByKey(configKey: string, configValue: string) {
    return this.db.prepare(
      "UPDATE SystemConfig SET configValue = ?, updatedAt = datetime('now') WHERE configKey = ?"
    ).bind(configValue, configKey).run()
  }

  async createConfig(data: Record<string, unknown>) {
    const keys = Object.keys(data)
    const placeholders = keys.map(() => '?').join(', ')
    const values = keys.map(k => data[k])
    return this.db.prepare(
      `INSERT INTO SystemConfig (${keys.join(', ')}, createdAt, updatedAt) VALUES (${placeholders}, datetime('now'), datetime('now'))`
    ).bind(...values).run()
  }

  // ── AI Model Config Queries ───────────────────────────────────────
  async findModelById(id: string) {
    return this.db.prepare('SELECT * FROM AIModelConfig WHERE id = ?').bind(id).first()
  }

  async findActiveModels() {
    return this.db.prepare('SELECT * FROM AIModelConfig ORDER BY isDefault DESC, createdAt DESC').all()
  }

  async findDefaultModel() {
    return this.db.prepare('SELECT * FROM AIModelConfig WHERE isActive = 1 AND isDefault = 1').first()
  }

  async findAnyActiveModel() {
    return this.db.prepare('SELECT * FROM AIModelConfig WHERE isActive = 1 LIMIT 1').first()
  }

  async createModel(data: Record<string, unknown>) {
    const keys = Object.keys(data)
    const placeholders = keys.map(() => '?').join(', ')
    const values = keys.map(k => data[k])
    return this.db.prepare(
      `INSERT INTO AIModelConfig (${keys.join(', ')}, createdAt, updatedAt) VALUES (${placeholders}, datetime('now'), datetime('now'))`
    ).bind(...values).run()
  }

  async updateModel(id: string, data: Record<string, unknown>) {
    const keys = Object.keys(data)
    const setClauses = keys.map(k => `${k} = ?`).join(', ')
    const values = keys.map(k => data[k])
    return this.db.prepare(
      `UPDATE AIModelConfig SET ${setClauses}, updatedAt = datetime('now') WHERE id = ?`
    ).bind(...values, id).run()
  }

  async deleteModel(id: string) {
    return this.db.prepare('DELETE FROM AIModelConfig WHERE id = ?').bind(id).run()
  }

  async unsetDefaultModels() {
    return this.db.prepare('UPDATE AIModelConfig SET isDefault = 0').run()
  }

  // ── Form Field Queries ────────────────────────────────────────────
  async findActiveFormFields() {
    return this.db.prepare('SELECT * FROM FormField WHERE isActive = 1 ORDER BY "order" ASC').all()
  }

  async findFormFieldById(id: string) {
    return this.db.prepare('SELECT * FROM FormField WHERE id = ?').bind(id).first()
  }

  async findFormFieldByKey(fieldKey: string) {
    return this.db.prepare('SELECT * FROM FormField WHERE fieldKey = ?').bind(fieldKey).first()
  }

  async createFormField(data: Record<string, unknown>) {
    const keys = Object.keys(data)
    const placeholders = keys.map(() => '?').join(', ')
    const values = keys.map(k => data[k])
    return this.db.prepare(
      `INSERT INTO FormField (${keys.join(', ')}, createdAt, updatedAt) VALUES (${placeholders}, datetime('now'), datetime('now'))`
    ).bind(...values).run()
  }

  async updateFormField(id: string, data: Record<string, unknown>) {
    const keys = Object.keys(data)
    const setClauses = keys.map(k => `${k} = ?`).join(', ')
    const values = keys.map(k => data[k])
    return this.db.prepare(
      `UPDATE FormField SET ${setClauses}, updatedAt = datetime('now') WHERE id = ?`
    ).bind(...values, id).run()
  }

  async deleteFormField(id: string) {
    return this.db.prepare('DELETE FROM FormField WHERE id = ?').bind(id).run()
  }

  // ── Workflow Queries ──────────────────────────────────────────────
  async findActiveWorkflows() {
    return this.db.prepare('SELECT * FROM ApprovalWorkflow WHERE isActive = 1 ORDER BY priority DESC').all()
  }

  async createWorkflow(data: Record<string, unknown>) {
    const keys = Object.keys(data)
    const placeholders = keys.map(() => '?').join(', ')
    const values = keys.map(k => data[k])
    return this.db.prepare(
      `INSERT INTO ApprovalWorkflow (${keys.join(', ')}, createdAt, updatedAt) VALUES (${placeholders}, datetime('now'), datetime('now'))`
    ).bind(...values).run()
  }

  // ── Generic Query Helpers ─────────────────────────────────────────
  async query(sql: string, ...params: unknown[]) {
    return this.db.prepare(sql).bind(...params).all()
  }

  async queryFirst(sql: string, ...params: unknown[]) {
    return this.db.prepare(sql).bind(...params).first()
  }

  async run(sql: string, ...params: unknown[]) {
    return this.db.prepare(sql).bind(...params).run()
  }

  async batch(statements: D1PreparedStatement[]) {
    return this.db.batch(statements)
  }
}

/**
 * Helper to create a DbClient from Hono context
 */
export function getDb(env: Env): DbClient {
  return new DbClient(env.DB)
}
