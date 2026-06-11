/**
 * SZHP — Essential Data Seed Script
 * Seeds ALL operational data the app needs to function:
 *   1. Admin Users
 *   2. AI Model Configs
 *   3. System Configs (business rules)
 *   4. Form Fields (with validation, AI prompts, cross-field checks)
 *
 * Run:  npx tsx prisma/seed-essential.ts
 *
 * Idempotent: skips any record that already exists.
 */

import { db } from '../src/lib/db'
import { hashPasswordSync, getDefaultPermissions } from '../src/lib/rbac'

// ─── Helpers ────────────────────────────────────────────────────────────────

function log(section: string, msg: string) {
  console.log(`  ✓ [${section}] ${msg}`)
}

function logSkip(section: string, msg: string) {
  console.log(`  ⇒ [${section}] ${msg} (skipped — already exists)`)
}

// ─── 1. Admin Users ────────────────────────────────────────────────────────

async function seedAdminUsers() {
  const SECTION = 'Admin Users'
  let created = 0
  let skipped = 0

  // --- Superadmin ---
  const existingSuperAdmin = await db.user.findFirst({
    where: { role: 'superadmin' },
  })

  let superAdminId: string

  if (existingSuperAdmin) {
    superAdminId = existingSuperAdmin.id
    logSkip(SECTION, `Superadmin ${existingSuperAdmin.email}`)
    skipped++
  } else {
    const passwordHash = hashPasswordSync('admin123')  // bcrypt secure hash
    const permissions = getDefaultPermissions('superadmin')

    const superAdmin = await db.user.create({
      data: {
        uaepassSub: 'admin_szhp_system',
        emiratesId: 'ADM0000000001',
        email: 'admin@szhp.gov.ae',
        passwordHash,
        firstnameEN: 'System',
        lastnameEN: 'Administrator',
        firstnameAR: 'مسؤول',
        lastnameAR: 'النظام',
        fullnameEN: 'System Administrator',
        fullnameAR: 'مسؤول النظام',
        role: 'superadmin',
        department: 'management',
        permissions: JSON.stringify(permissions),
        isActive: true,
        loginAttempts: 0,
      },
    })

    superAdminId = superAdmin.id

    await db.auditLog.create({
      data: {
        action: 'system_seeded',
        performedBy: 'system',
        details: JSON.stringify({
          message: 'Default superadmin account seeded',
          email: superAdmin.email,
        }),
        category: 'system',
        affectedRecord: `User:${superAdmin.id}`,
        newValue: JSON.stringify({
          email: superAdmin.email,
          role: superAdmin.role,
          department: superAdmin.department,
        }),
      },
    })

    log(SECTION, `Superadmin ${superAdmin.email}`)
    created++
  }

  // --- Demo employees ---
  const demoEmployees = [
    {
      email: 'manager@szhp.gov.ae',
      password: 'manager123',
      firstnameEN: 'Ahmed',
      lastnameEN: 'Al Mansouri',
      firstnameAR: 'أحمد',
      lastnameAR: 'المنصوري',
      role: 'manager' as const,
      department: 'management',
    },
    {
      email: 'reviewer@szhp.gov.ae',
      password: 'reviewer123',
      firstnameEN: 'Fatima',
      lastnameEN: 'Al Zaabi',
      firstnameAR: 'فاطمة',
      lastnameAR: 'الزعابي',
      role: 'reviewer' as const,
      department: 'risk_assessment',
    },
    {
      email: 'employee@szhp.gov.ae',
      password: 'employee123',
      firstnameEN: 'Omar',
      lastnameEN: 'Al Ketbi',
      firstnameAR: 'عمر',
      lastnameAR: 'الكعبي',
      role: 'employee' as const,
      department: 'housing_finance',
    },
    {
      email: 'admin2@szhp.gov.ae',
      password: 'admin123',
      firstnameEN: 'Sara',
      lastnameEN: 'Al Dhaheri',
      firstnameAR: 'سارة',
      lastnameAR: 'الظاهري',
      role: 'admin' as const,
      department: 'compliance',
    },
  ]

  for (const emp of demoEmployees) {
    const existing = await db.user.findFirst({ where: { email: emp.email } })
    if (existing) {
      logSkip(SECTION, emp.email)
      skipped++
      continue
    }

    const empPermissions = getDefaultPermissions(emp.role)
    const empPasswordHash = hashPasswordSync(emp.password)  // bcrypt secure hash
    const rand = Math.random().toString(36).substring(2, 10)
    const empSub = `admin_${emp.email.replace(/[^a-zA-Z0-9]/g, '_')}_${rand}`
    const empEmiratesId = `ADM${rand}${Math.random().toString(36).substring(2, 6)}`

    const newEmp = await db.user.create({
      data: {
        uaepassSub: empSub,
        emiratesId: empEmiratesId,
        email: emp.email,
        passwordHash: empPasswordHash,
        firstnameEN: emp.firstnameEN,
        lastnameEN: emp.lastnameEN,
        firstnameAR: emp.firstnameAR,
        lastnameAR: emp.lastnameAR,
        fullnameEN: `${emp.firstnameEN} ${emp.lastnameEN}`,
        fullnameAR: `${emp.firstnameAR} ${emp.lastnameAR}`,
        role: emp.role,
        department: emp.department,
        permissions: JSON.stringify(empPermissions),
        isActive: true,
        loginAttempts: 0,
      },
    })

    await db.auditLog.create({
      data: {
        action: 'user_created',
        performedBy: 'system',
        details: JSON.stringify({
          message: 'Demo employee seeded',
          email: newEmp.email,
          role: newEmp.role,
        }),
        category: 'user_management',
        performedByUserId: superAdminId,
        affectedRecord: `User:${newEmp.id}`,
        newValue: JSON.stringify({
          email: newEmp.email,
          role: newEmp.role,
          department: newEmp.department,
        }),
      },
    })

    log(SECTION, emp.email)
    created++
  }

  console.log(`  📊 [${SECTION}] ${created} created, ${skipped} skipped`)
}

// ─── 2. AI Model Configs ───────────────────────────────────────────────────

async function seedAIModelConfigs() {
  const SECTION = 'AI Models'
  // SECURITY: Read from environment variables, never hardcode API keys
  const RECENTECH_BASE_URL = process.env.RECENTECH_BASE_URL || 'https://recentech-ai-worker.42abudhabi424242.workers.dev/v1'
  const RECENTECH_API_KEY = process.env.RECENTECH_API_KEY || ''

  const defaultModels = [
    {
      name: 'Recentech AI — GLM-4-Flash',
      provider: 'recentech',
      modelId: 'glm-4-flash',
      baseUrl: RECENTECH_BASE_URL,
      apiKey: RECENTECH_API_KEY,
      isActive: true,
      isDefault: true,
      capabilities: JSON.stringify(['chat', 'vision']),
      maxTokens: 4096,
      temperature: 0.7,
      descriptionEN: 'Ultra-fast model for simple tasks. Best for quick responses.',
      descriptionAR: 'نموذج فائق السرعة للمهام البسيطة. الأفضل للاستجابات السريعة.',
    },
    {
      name: 'Recentech AI — GLM-4-Plus',
      provider: 'recentech',
      modelId: 'glm-4-plus',
      baseUrl: RECENTECH_BASE_URL,
      apiKey: RECENTECH_API_KEY,
      isActive: true,
      isDefault: false,
      capabilities: JSON.stringify(['chat', 'vision']),
      maxTokens: 4096,
      temperature: 0.7,
      descriptionEN: 'Default general purpose model. Good balance of speed and quality.',
      descriptionAR: 'نموذج الأغراض العامة الافتراضي. توازن جيد بين السرعة والجودة.',
    },
    {
      name: 'Recentech AI — GLM-5',
      provider: 'recentech',
      modelId: 'glm-5',
      baseUrl: RECENTECH_BASE_URL,
      apiKey: RECENTECH_API_KEY,
      isActive: true,
      isDefault: false,
      capabilities: JSON.stringify(['chat', 'vision']),
      maxTokens: 8192,
      temperature: 0.7,
      descriptionEN: 'Latest advanced reasoning model. Best quality responses.',
      descriptionAR: 'أحدث نموذج استدلال متقدم. أفضل جودة للاستجابات.',
    },
    {
      name: 'Recentech AI — Gemini 2.5 Flash',
      provider: 'gemini',
      modelId: 'gemini-2.5-flash',
      baseUrl: RECENTECH_BASE_URL,
      apiKey: RECENTECH_API_KEY,
      isActive: true,
      isDefault: false,
      capabilities: JSON.stringify(['chat', 'vision']),
      maxTokens: 8192,
      temperature: 0.7,
      descriptionEN: 'Google Gemini 2.5 Flash via Recentech AI proxy. Fast and capable.',
      descriptionAR: 'جوجل جيميني 2.5 فلاش عبر وكيل Recentech AI. سريع وقادر.',
    },
    {
      name: 'Recentech AI — Gemini 2.5 Pro',
      provider: 'gemini',
      modelId: 'gemini-2.5-pro',
      baseUrl: RECENTECH_BASE_URL,
      apiKey: RECENTECH_API_KEY,
      isActive: true,
      isDefault: false,
      capabilities: JSON.stringify(['chat', 'vision']),
      maxTokens: 8192,
      temperature: 0.7,
      descriptionEN: 'Google Gemini 2.5 Pro via Recentech AI proxy. Complex reasoning.',
      descriptionAR: 'جوجل جيميني 2.5 برو عبر وكيل Recentech AI. استدلال معقد.',
    },
    {
      name: 'Local — Ollama',
      provider: 'ollama',
      modelId: 'llama3',
      baseUrl: 'http://localhost:11434',
      apiKey: null,
      isActive: true,
      isDefault: false,
      capabilities: JSON.stringify(['chat', 'vision']),
      maxTokens: 4096,
      temperature: 0.7,
      descriptionEN: 'Local Ollama model. No API key needed. Change model ID to your installed model.',
      descriptionAR: 'نموذج Ollama محلي. لا حاجة لمفتاح API. غيّر معرف النموذج للنموذج المثبت.',
    },
    {
      name: 'OpenAI — GPT-4o',
      provider: 'openai',
      modelId: 'gpt-4o',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: '',
      isActive: false,
      isDefault: false,
      capabilities: JSON.stringify(['chat', 'vision']),
      maxTokens: 4096,
      temperature: 0.7,
      descriptionEN: 'OpenAI GPT-4o. Requires your own API key.',
      descriptionAR: 'OpenAI GPT-4o. يتطلب مفتاح API الخاص بك.',
    },
    {
      name: 'OpenAI — GPT-4o Mini',
      provider: 'openai',
      modelId: 'gpt-4o-mini',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: '',
      isActive: false,
      isDefault: false,
      capabilities: JSON.stringify(['chat']),
      maxTokens: 4096,
      temperature: 0.7,
      descriptionEN: 'OpenAI GPT-4o Mini. Cost-effective. Requires your own API key.',
      descriptionAR: 'OpenAI GPT-4o Mini. فعال من حيث التكلفة. يتطلب مفتاح API الخاص بك.',
    },
    {
      name: 'Custom — OpenAI Compatible',
      provider: 'openai_compatible',
      modelId: 'default',
      baseUrl: 'http://localhost:8080/v1',
      apiKey: '',
      isActive: false,
      isDefault: false,
      capabilities: JSON.stringify(['chat']),
      maxTokens: 4096,
      temperature: 0.7,
      descriptionEN: 'Any OpenAI-compatible endpoint (vLLM, LM Studio, Text Generation Inference, etc.)',
      descriptionAR: 'أي نقطة نهاية متوافقة مع OpenAI (vLLM، LM Studio، إلخ)',
    },
  ]

  let created = 0
  let skipped = 0

  for (const modelData of defaultModels) {
    const existing = await db.aIModelConfig.findFirst({
      where: { provider: modelData.provider, modelId: modelData.modelId },
    })
    if (existing) {
      logSkip(SECTION, `${modelData.provider}/${modelData.modelId}`)
      skipped++
      continue
    }
    await db.aIModelConfig.create({ data: modelData })
    log(SECTION, `${modelData.provider}/${modelData.modelId}`)
    created++
  }

  console.log(`  📊 [${SECTION}] ${created} created, ${skipped} skipped`)
}

// ─── 3. System Configs ─────────────────────────────────────────────────────

async function seedSystemConfigs() {
  const SECTION = 'System Configs'

  const defaultConfigs = [
    // ── DBR Limits ─────────────────────────────────────────────────
    // isPublic: true → visible to unauthenticated users (landing page, new-request page)
    { configKey: 'max_dbr_limit', configValue: '0.6', defaultValue: '0.6', labelEN: 'Maximum DBR Limit', labelAR: 'الحد الأقصى لنسبة عبء الدين', descriptionEN: 'Maximum Debt Burden Ratio allowed. Cases above this are auto-rejected per Cabinet Resolution 61/2021.', descriptionAR: 'الحد الأقصى المسموح لنسبة عبء الدين. الحالات التي تتجاوز هذا الحد تُرفض تلقائياً وفقاً لقرار مجلس الوزراء 61/2021.', category: 'dbr_limits', valueType: 'number', min: 0.1, max: 1.0, unit: '%', isPublic: true },
    { configKey: 'dbr_healthy_limit', configValue: '0.35', defaultValue: '0.35', labelEN: 'Healthy DBR Threshold', labelAR: 'عتبة نسبة عبء الدين الصحية', descriptionEN: 'DBR below this is considered healthy/low risk. Shown as green indicator to customers.', descriptionAR: 'نسبة عبء الدين أقل من هذا المستوى تعتبر صحية/منخفضة المخاطر. تظهر كمؤشر أخضر للعملاء.', category: 'dbr_limits', valueType: 'number', min: 0.1, max: 0.6, unit: '%', isPublic: true },
    { configKey: 'dbr_caution_limit', configValue: '0.5', defaultValue: '0.5', labelEN: 'Caution DBR Threshold', labelAR: 'عتبة تحذير نسبة عبء الدين', descriptionEN: 'DBR between healthy and this value is caution zone (yellow). Above this is high risk (red).', descriptionAR: 'نسبة عبء الدين بين المستوى الصحي وهذه القيمة هي منطقة تحذير (صفراء). أعلى من هذا مخاطر عالية (حمراء).', category: 'dbr_limits', valueType: 'number', min: 0.2, max: 0.7, unit: '%', isPublic: true },

    // ── Risk Score Thresholds ───────────────────────────────────────
    { configKey: 'risk_threshold_low', configValue: '30', defaultValue: '30', labelEN: 'Low Risk Threshold', labelAR: 'عتبة المخاطر المنخفضة', descriptionEN: 'Risk score 0 to this value = LOW risk. Low risk cases may be auto-approved.', descriptionAR: 'درجة المخاطر من 0 إلى هذه القيمة = مخاطر منخفضة. حالات المخاطر المنخفضة قد تحظى بموافقة تلقائية.', category: 'risk_thresholds', valueType: 'number', min: 0, max: 100, unit: 'points', isPublic: false },
    { configKey: 'risk_threshold_medium', configValue: '50', defaultValue: '50', labelEN: 'Medium Risk Threshold', labelAR: 'عتبة المخاطر المتوسطة', descriptionEN: 'Risk score above low and up to this value = MEDIUM risk. Requires standard review.', descriptionAR: 'درجة المخاطر أعلى من المنخفضة وحتى هذه القيمة = مخاطر متوسطة. تتطلب مراجعة عادية.', category: 'risk_thresholds', valueType: 'number', min: 10, max: 100, unit: 'points', isPublic: false },
    { configKey: 'risk_threshold_high', configValue: '70', defaultValue: '70', labelEN: 'High Risk Threshold', labelAR: 'عتبة المخاطر العالية', descriptionEN: 'Risk score above medium and up to this value = HIGH risk. Requires detailed review.', descriptionAR: 'درجة المخاطر أعلى من المتوسطة وحتى هذه القيمة = مخاطر عالية. تتطلب مراجعة تفصيلية.', category: 'risk_thresholds', valueType: 'number', min: 20, max: 100, unit: 'points', isPublic: false },

    // ── Loan Limits ─────────────────────────────────────────────────
    { configKey: 'max_loan_duration_months', configValue: '360', defaultValue: '360', labelEN: 'Maximum Loan Duration', labelAR: 'الحد الأقصى لمدة القرض', descriptionEN: 'Maximum loan duration in months per SZHP policy. Currently 30 years (360 months).', descriptionAR: 'الحد الأقصى لمدة القرض بالأشهر وفقاً لسياسة برنامج الشيخ زايد. حالياً 30 سنة (360 شهراً).', category: 'loan_limits', valueType: 'number', min: 12, max: 600, unit: 'months', isPublic: true },
    { configKey: 'min_loan_duration_months', configValue: '12', defaultValue: '12', labelEN: 'Minimum Loan Duration', labelAR: 'الحد الأدنى لمدة القرض', descriptionEN: 'Minimum loan duration in months.', descriptionAR: 'الحد الأدنى لمدة القرض بالأشهر.', category: 'loan_limits', valueType: 'number', min: 1, max: 60, unit: 'months', isPublic: false },
    { configKey: 'max_grant_amount', configValue: '800000', defaultValue: '800000', labelEN: 'Maximum Grant Amount (AED)', labelAR: 'الحد الأقصى لمبلغ المنحة (درهم)', descriptionEN: 'Maximum assistance amount for grants per SZHP policy.', descriptionAR: 'الحد الأقصى لمبلغ المساعدة للمنح وفقاً لسياسة برنامج الشيخ زايد.', category: 'loan_limits', valueType: 'number', min: 10000, max: 2000000, unit: 'AED', isPublic: false },
    { configKey: 'max_housing_loan_amount', configValue: '1500000', defaultValue: '1500000', labelEN: 'Maximum Housing Loan Amount (AED)', labelAR: 'الحد الأقصى لمبلغ القرض الإسكاني (درهم)', descriptionEN: 'Maximum housing loan amount per SZHP policy.', descriptionAR: 'الحد الأقصى لمبلغ القرض الإسكاني وفقاً لسياسة برنامج الشيخ زايد.', category: 'loan_limits', valueType: 'number', min: 100000, max: 5000000, unit: 'AED', isPublic: false },
    { configKey: 'max_maintenance_amount', configValue: '200000', defaultValue: '200000', labelEN: 'Maximum Maintenance Amount (AED)', labelAR: 'الحد الأقصى لمبلغ الصيانة (درهم)', descriptionEN: 'Maximum maintenance loan amount per SZHP policy.', descriptionAR: 'الحد الأقصى لمبلغ قرض الصيانة وفقاً لسياسة برنامج الشيخ زايد.', category: 'loan_limits', valueType: 'number', min: 10000, max: 500000, unit: 'AED', isPublic: false },

    // ── Eligibility ─────────────────────────────────────────────────
    { configKey: 'citizenship_required', configValue: 'true', defaultValue: 'true', labelEN: 'UAE Citizenship Required', labelAR: 'مطلوب الجنسية الإماراتية', descriptionEN: 'Whether UAE citizenship is mandatory for any housing assistance.', descriptionAR: 'ما إذا كانت الجنسية الإماراتية إلزامية لأي مساعدة إسكانية.', category: 'eligibility', valueType: 'boolean', min: null, max: null, unit: null, isPublic: false },
    { configKey: 'family_book_required', configValue: 'true', defaultValue: 'true', labelEN: 'Family Book Required', labelAR: 'مطلوب دفتر العائلة', descriptionEN: 'Whether a UAE family book (Khulasat Al Qaid) is mandatory for housing assistance.', descriptionAR: 'ما إذا كان دفتر العائلة (خلاصة القيد) إلزامياً للمساعدة الإسكانية.', category: 'eligibility', valueType: 'boolean', min: null, max: null, unit: null, isPublic: false },
    { configKey: 'min_monthly_income', configValue: '3000', defaultValue: '3000', labelEN: 'Minimum Monthly Income (AED)', labelAR: 'الحد الأدنى للدخل الشهري (درهم)', descriptionEN: 'Minimum monthly income to be eligible for rescheduling.', descriptionAR: 'الحد الأدنى للدخل الشهري للأهلية لإعادة الجدولة.', category: 'eligibility', valueType: 'number', min: 0, max: 50000, unit: 'AED', isPublic: false },

    // ── Auto-Approval Rules ─────────────────────────────────────────
    { configKey: 'auto_approve_enabled', configValue: 'true', defaultValue: 'true', labelEN: 'Auto-Approval Enabled', labelAR: 'الموافقة التلقائية مفعلة', descriptionEN: 'Enable or disable automatic approval for low-risk cases.', descriptionAR: 'تمكين أو تعطيل الموافقة التلقائية للحالات منخفضة المخاطر.', category: 'auto_approve', valueType: 'boolean', min: null, max: null, unit: null, isPublic: false },
    { configKey: 'auto_approve_max_risk_score', configValue: '30', defaultValue: '30', labelEN: 'Auto-Approve Max Risk Score', labelAR: 'الحد الأقصى لدرجة المخاطر للموافقة التلقائية', descriptionEN: 'Cases with risk score at or below this value are auto-approved.', descriptionAR: 'الحالات التي تبلغ درجة مخاطرها هذه القيمة أو أقل تحظى بموافقة تلقائية.', category: 'auto_approve', valueType: 'number', min: 0, max: 80, unit: 'points', isPublic: false },
    { configKey: 'auto_approve_max_dbr', configValue: '0.4', defaultValue: '0.4', labelEN: 'Auto-Approve Max DBR', labelAR: 'الحد الأقصى لنسبة عبء الدين للموافقة التلقائية', descriptionEN: 'Cases with proposed DBR at or below this value may be auto-approved.', descriptionAR: 'الحالات التي تبلغ نسبة عبء الدين المقترحة هذه القيمة أو أقل قد تحظى بموافقة تلقائية.', category: 'auto_approve', valueType: 'number', min: 0.1, max: 0.6, unit: '%', isPublic: false },
    { configKey: 'auto_approve_max_delay_days', configValue: '90', defaultValue: '90', labelEN: 'Auto-Approve Max Delay Days', labelAR: 'الحد الأقصى لأيام التأخير للموافقة التلقائية', descriptionEN: 'Cases with delay days at or below this value may be auto-approved.', descriptionAR: 'الحالات التي تبلغ أيام تأخيرها هذه القيمة أو أقل قد تحظى بموافقة تلقائية.', category: 'auto_approve', valueType: 'number', min: 0, max: 365, unit: 'days', isPublic: false },
    { configKey: 'auto_approve_gov_only', configValue: 'false', defaultValue: 'false', labelEN: 'Auto-Approve Government Employees Only', labelAR: 'الموافقة التلقائية للموظفين الحكوميين فقط', descriptionEN: 'If enabled, only government employees qualify for auto-approval.', descriptionAR: 'إذا تم التمكين، فقط الموظفون الحكوميون مؤهلون للموافقة التلقائية.', category: 'auto_approve', valueType: 'boolean', min: null, max: null, unit: null, isPublic: false },

    // ── Auto-Rejection Rules ────────────────────────────────────────
    { configKey: 'auto_reject_enabled', configValue: 'true', defaultValue: 'true', labelEN: 'Auto-Rejection Enabled', labelAR: 'الرفض التلقائي مفعل', descriptionEN: 'Enable or disable automatic rejection for ineligible cases.', descriptionAR: 'تمكين أو تعطيل الرفض التلقائي للحالات غير المؤهلة.', category: 'auto_reject', valueType: 'boolean', min: null, max: null, unit: null, isPublic: false },
    { configKey: 'auto_reject_min_dbr', configValue: '0.6', defaultValue: '0.6', labelEN: 'Auto-Reject DBR Threshold', labelAR: 'عتبة نسبة عبء الدين للرفض التلقائي', descriptionEN: 'Cases with proposed DBR exceeding this value are auto-rejected.', descriptionAR: 'الحالات التي تتجاوز نسبة عبء الدين المقترحة هذه القيمة تُرفض تلقائياً.', category: 'auto_reject', valueType: 'number', min: 0.3, max: 1.0, unit: '%', isPublic: false },
    { configKey: 'auto_reject_min_risk_score', configValue: '80', defaultValue: '80', labelEN: 'Auto-Reject Min Risk Score', labelAR: 'الحد الأدنى لدرجة المخاطر للرفض التلقائي', descriptionEN: 'Cases with risk score at or above this value are auto-rejected.', descriptionAR: 'الحالات التي تبلغ درجة مخاطرها هذه القيمة أو أكثر تُرفض تلقائياً.', category: 'auto_reject', valueType: 'number', min: 50, max: 100, unit: 'points', isPublic: false },
    { configKey: 'auto_reject_min_delay_days', configValue: '365', defaultValue: '365', labelEN: 'Auto-Reject Delay Days Threshold', labelAR: 'عتبة أيام التأخير للرفض التلقائي', descriptionEN: 'Cases with delay days exceeding this value may be auto-rejected.', descriptionAR: 'الحالات التي تتجاوز أيام تأخيرها هذه القيمة قد تُرفض تلقائياً.', category: 'auto_reject', valueType: 'number', min: 90, max: 1825, unit: 'days', isPublic: false },
    { configKey: 'auto_reject_non_citizen', configValue: 'true', defaultValue: 'true', labelEN: 'Auto-Reject Non-Citizens', labelAR: 'الرفض التلقائي لغير المواطنين', descriptionEN: 'If enabled, non-UAE citizens are automatically rejected.', descriptionAR: 'إذا تم التمكين، يتم رفض غير مواطني الإمارات تلقائياً.', category: 'auto_reject', valueType: 'boolean', min: null, max: null, unit: null, isPublic: false },

    // ── Human Review ────────────────────────────────────────────────
    { configKey: 'human_review_risk_threshold', configValue: '50', defaultValue: '50', labelEN: 'Human Review Risk Threshold', labelAR: 'عتبة المخاطر للمراجعة البشرية', descriptionEN: 'Cases with risk score above this value require human review.', descriptionAR: 'الحالات التي تتجاوز درجة مخاطرها هذه القيمة تتطلب مراجعة بشرية.', category: 'human_review', valueType: 'number', min: 0, max: 100, unit: 'points', isPublic: false },
    { configKey: 'human_review_dbr_threshold', configValue: '0.5', defaultValue: '0.5', labelEN: 'Human Review DBR Threshold', labelAR: 'عتبة نسبة عبء الدين للمراجعة البشرية', descriptionEN: 'Cases with proposed DBR above this value require human review.', descriptionAR: 'الحالات التي تتجاوز نسبة عبء الدين المقترحة هذه القيمة تتطلب مراجعة بشرية.', category: 'human_review', valueType: 'number', min: 0.2, max: 0.8, unit: '%', isPublic: false },
    { configKey: 'human_review_delay_days', configValue: '180', defaultValue: '180', labelEN: 'Human Review Delay Days', labelAR: 'أيام التأخير للمراجعة البشرية', descriptionEN: 'Cases with delay days above this value require human review.', descriptionAR: 'الحالات التي تتجاوز أيام تأخيرها هذه القيمة تتطلب مراجعة بشرية.', category: 'human_review', valueType: 'number', min: 30, max: 730, unit: 'days', isPublic: false },
    { configKey: 'human_review_estimated_days', configValue: '14', defaultValue: '14', labelEN: 'Estimated Review Days', labelAR: 'أيام المراجعة المقدرة', descriptionEN: 'Estimated number of business days for human review.', descriptionAR: 'العدد المقدر من أيام العمل للمراجعة البشرية.', category: 'human_review', valueType: 'number', min: 1, max: 60, unit: 'days', isPublic: false },

    // ── Employer Risk Weights ───────────────────────────────────────
    { configKey: 'employer_weight_government', configValue: '0.8', defaultValue: '0.8', labelEN: 'Government Employee Risk Weight', labelAR: 'معامل مخاطر الموظف الحكومي', descriptionEN: 'Risk multiplier for government employees. Below 1.0 = favorable (lower risk).', descriptionAR: 'معامل المخاطر للموظفين الحكوميين. أقل من 1.0 = مؤاتي (مخاطر أقل).', category: 'employer_weights', valueType: 'number', min: 0.1, max: 2.0, unit: '×', isPublic: false },
    { configKey: 'employer_weight_semi_government', configValue: '1.0', defaultValue: '1.0', labelEN: 'Semi-Government Employee Risk Weight', labelAR: 'معامل مخاطر الموظف شبه الحكومي', descriptionEN: 'Risk multiplier for semi-government employees. 1.0 = neutral.', descriptionAR: 'معامل المخاطر للموظفين شبه الحكوميين. 1.0 = محايد.', category: 'employer_weights', valueType: 'number', min: 0.1, max: 2.0, unit: '×', isPublic: false },
    { configKey: 'employer_weight_private', configValue: '1.3', defaultValue: '1.3', labelEN: 'Private Sector Employee Risk Weight', labelAR: 'معامل مخاطر موظف القطاع الخاص', descriptionEN: 'Risk multiplier for private sector employees. Above 1.0 = higher risk.', descriptionAR: 'معامل المخاطر لموظفي القطاع الخاص. أعلى من 1.0 = مخاطر أعلى.', category: 'employer_weights', valueType: 'number', min: 0.1, max: 3.0, unit: '×', isPublic: false },

    // ── Grace Period ────────────────────────────────────────────────
    { configKey: 'max_grace_period_months', configValue: '6', defaultValue: '6', labelEN: 'Maximum Grace Period (months)', labelAR: 'الحد الأقصى لفترة السماح (شهر)', descriptionEN: 'Maximum grace period allowed before rescheduled payments begin.', descriptionAR: 'الحد الأقصى لفترة السماح المسموح بها قبل بدء الأقساط المعاد جدولتها.', category: 'grace_period', valueType: 'number', min: 0, max: 24, unit: 'months', isPublic: false },
    { configKey: 'grace_period_for_medical', configValue: '3', defaultValue: '3', labelEN: 'Grace Period for Medical Cases', labelAR: 'فترة السماح للحالات الطبية', descriptionEN: 'Default grace period for medical hardship cases.', descriptionAR: 'فترة السماح الافتراضية لحالات الطوارئ الطبية.', category: 'grace_period', valueType: 'number', min: 0, max: 12, unit: 'months', isPublic: false },
    { configKey: 'grace_period_for_divorce', configValue: '3', defaultValue: '3', labelEN: 'Grace Period for Divorce Cases', labelAR: 'فترة السماح لحالات الطلاق', descriptionEN: 'Default grace period for divorce cases.', descriptionAR: 'فترة السماح الافتراضية لحالات الطلاق.', category: 'grace_period', valueType: 'number', min: 0, max: 12, unit: 'months', isPublic: false },

    // ── Delay Classification ────────────────────────────────────────
    { configKey: 'delay_low_risk_days', configValue: '90', defaultValue: '90', labelEN: 'Low Risk Delay Threshold (days)', labelAR: 'عتبة التأخير المنخفض المخاطر (يوم)', descriptionEN: 'Delay days up to this value classified as lower risk.', descriptionAR: 'أيام التأخير حتى هذه القيمة مصنفة كمخاطر أقل.', category: 'risk_thresholds', valueType: 'number', min: 1, max: 365, unit: 'days', isPublic: false },
    { configKey: 'delay_high_risk_days', configValue: '180', defaultValue: '180', labelEN: 'High Risk Delay Threshold (days)', labelAR: 'عتبة التأخير عالي المخاطر (يوم)', descriptionEN: 'Delay days exceeding this value classified as HIGH RISK.', descriptionAR: 'أيام التأخير التي تتجاوز هذه القيمة مصنفة كمخاطر عالية.', category: 'risk_thresholds', valueType: 'number', min: 30, max: 730, unit: 'days', isPublic: false },
    { configKey: 'delay_severe_days', configValue: '365', defaultValue: '365', labelEN: 'Severe Distress Delay (days)', labelAR: 'تأخير الضائقة الشديدة (يوم)', descriptionEN: 'Delay days exceeding this value indicate severe financial distress.', descriptionAR: 'أيام التأخير التي تتجاوز هذه القيمة تشير إلى ضائقة مالية شديدة.', category: 'risk_thresholds', valueType: 'number', min: 90, max: 1825, unit: 'days', isPublic: false },

    // ── Landing Page Metrics ────────────────────────────────────────
    // Entire landing_metrics category is public (no auth needed)
    { configKey: 'landing_automation_rate', configValue: '85', defaultValue: '85', labelEN: 'Automation Rate (%)', labelAR: 'معدل الأتمتة (%)', descriptionEN: 'Percentage shown on the landing page for automation rate metric.', descriptionAR: 'النسبة المئوية المعروضة في الصفحة الرئيسية لمعدل الأتمتة.', category: 'landing_metrics', valueType: 'number', min: 0, max: 100, unit: '%', isPublic: true },
    { configKey: 'landing_assessment_time', configValue: '30', defaultValue: '30', labelEN: 'Assessment Time (seconds)', labelAR: 'وقت التقييم (ثانية)', descriptionEN: 'Assessment time in seconds shown on the landing page.', descriptionAR: 'وقت التقييم بالثواني المعروض في الصفحة الرئيسية.', category: 'landing_metrics', valueType: 'number', min: 1, max: 300, unit: 'seconds', isPublic: true },
    { configKey: 'landing_compliance_rate', configValue: '100', defaultValue: '100', labelEN: 'Compliance Rate (%)', labelAR: 'معدل الامتثال (%)', descriptionEN: 'Compliance percentage shown on the landing page.', descriptionAR: 'نسبة الامتثال المعروضة في الصفحة الرئيسية.', category: 'landing_metrics', valueType: 'number', min: 0, max: 100, unit: '%', isPublic: true },

    // ── Documents & Upload ──────────────────────────────────────────
    { configKey: 'max_file_upload_size_mb', configValue: '10', defaultValue: '10', labelEN: 'Max File Upload Size (MB)', labelAR: 'الحد الأقصى لحجم الملف (ميجابايت)', descriptionEN: 'Maximum file size allowed for document uploads in megabytes.', descriptionAR: 'الحد الأقصى لحجم الملف المسموح به لرفع المستندات بالميجابايت.', category: 'documents', valueType: 'number', min: 1, max: 50, unit: 'MB', isPublic: false },

    // ── System Branding ─────────────────────────────────────────────
    { configKey: 'system_version', configValue: '9.0.0', defaultValue: '9.0.0', labelEN: 'System Version', labelAR: 'إصدار النظام', descriptionEN: 'Current system version displayed in the footer.', descriptionAR: 'إصدار النظام الحالي المعروض في التذييل.', category: 'branding', valueType: 'string', min: null, max: null, unit: null, isPublic: true },
  ]

  let created = 0
  let updated = 0

  for (const config of defaultConfigs) {
    const existing = await db.systemConfig.findUnique({
      where: { configKey: config.configKey },
    })

    const data = {
      configValue: config.configValue,
      defaultValue: config.defaultValue,
      labelEN: config.labelEN,
      labelAR: config.labelAR,
      descriptionEN: config.descriptionEN || null,
      descriptionAR: config.descriptionAR || null,
      category: config.category,
      valueType: config.valueType,
      min: config.min,
      max: config.max,
      unit: config.unit || null,
      isPublic: config.isPublic ?? false,
      isActive: true,
    }

    if (existing) {
      // Update label/description/min/max but preserve the current configValue (admin may have changed it)
      await db.systemConfig.update({
        where: { configKey: config.configKey },
        data: {
          defaultValue: data.defaultValue,
          labelEN: data.labelEN,
          labelAR: data.labelAR,
          descriptionEN: data.descriptionEN,
          descriptionAR: data.descriptionAR,
          category: data.category,
          valueType: data.valueType,
          min: data.min,
          max: data.max,
          unit: data.unit,
          isPublic: data.isPublic,
        },
      })
      log(SECTION, `${config.configKey} (updated metadata)`)
      updated++
    } else {
      await db.systemConfig.create({
        data: {
          configKey: config.configKey,
          ...data,
        },
      })
      log(SECTION, `${config.configKey}`)
      created++
    }
  }

  console.log(`  📊 [${SECTION}] ${created} created, ${updated} updated`)
}

// ─── 4. Form Fields ────────────────────────────────────────────────────────

async function seedFormFields() {
  const SECTION = 'Form Fields'

  const defaultFields = [
    // ── Personal Section ─────────────────────────────────────────────
    {
      fieldKey: 'emiratesId',
      labelEN: 'Emirates ID',
      labelAR: 'رقم الهوية',
      fieldType: 'text',
      placeholderEN: '784-1990-1234567-1',
      placeholderAR: '784-1990-1234567-1',
      helpTextEN: 'Auto-formatted: 784-XXXX-XXXXXXX-X',
      helpTextAR: 'تنسيق تلقائي: 784-XXXX-XXXXXXX-X',
      section: 'personal',
      required: true,
      order: 1,
      validation: { regex: '^784-\\d{4}-\\d{7}-\\d{1}$', customMessage: 'Emirates ID must follow format 784-XXXX-XXXXXXX-X', customMessageAr: 'يجب أن يتبع رقم الهوية التنسيق 784-XXXX-XXXXXXX-X' },
      ruleDescriptionEN: 'Must be a valid 15-digit UAE Emirates ID in format 784-XXXX-XXXXXXX-X',
      ruleDescriptionAR: 'يجب أن يكون رقم هوية إماراتي صحيح مكون من 15 رقماً بالتنسيق 784-XXXX-XXXXXXX-X',
      showRule: true,
      aiAutoValidate: true,
      aiValidationPrompt: 'Verify this is a valid UAE Emirates ID in the format 784-XXXX-XXXXXXX-X. The ID must start with 784 (UAE country code) and match the standard 15-digit format with hyphens. If UAE PASS data is available, confirm the Emirates ID matches the authenticated identity. Flag any ID that does not follow the correct format or appears to be fabricated.',
    },
    {
      fieldKey: 'nameEn',
      labelEN: 'Full Name (English)',
      labelAR: 'الاسم الكامل (بالإنجليزية)',
      fieldType: 'text',
      placeholderEN: 'Mohammed Ahmed Al Maktoum',
      placeholderAR: 'Mohammed Ahmed Al Maktoum',
      section: 'personal',
      required: false,
      order: 2,
      validation: { regex: '^[A-Za-z\\s\\-]+$', minLength: 2, maxLength: 100, customMessage: 'English name must contain only English letters', customMessageAr: 'يجب أن يحتوي الاسم بالإنجليزية على حروف إنجليزية فقط' },
      ruleDescriptionEN: 'English letters only, 2-100 characters',
      ruleDescriptionAR: 'حروف إنجليزية فقط، 2-100 حرف',
      showRule: true,
      aiAutoValidate: true,
      aiValidationPrompt: 'Verify the English name is written using only English/Latin letters and spaces. If UAE PASS data is available, confirm the name exactly matches the authenticated profile. The name should follow standard UAE naming conventions (First Father Grandfather Family). Flag if the name contains numbers, special characters, or does not match UAE PASS records.',
    },
    {
      fieldKey: 'nameAr',
      labelEN: 'Full Name (Arabic)',
      labelAR: 'الاسم الكامل (بالعربية)',
      fieldType: 'text',
      placeholderEN: 'محمد أحمد المكتوم',
      placeholderAR: 'محمد أحمد المكتوم',
      section: 'personal',
      required: true,
      order: 3,
      validation: { regex: '^[\\u0600-\\u06FF\\s\\-]+$', minLength: 2, maxLength: 100, customMessage: 'Arabic name must contain only Arabic letters', customMessageAr: 'يجب أن يحتوي الاسم بالعربية على حروف عربية فقط' },
      ruleDescriptionEN: 'Arabic letters only, 2-100 characters',
      ruleDescriptionAR: 'حروف عربية فقط، 2-100 حرف',
      showRule: true,
      aiAutoValidate: true,
      aiValidationPrompt: 'Verify the Arabic name is written using only Arabic letters and spaces. If UAE PASS data is available, confirm the Arabic name exactly matches the authenticated profile. The name should follow standard UAE Arabic naming conventions. Flag if the name contains non-Arabic characters or does not match UAE PASS records.',
    },
    {
      fieldKey: 'phone',
      labelEN: 'Phone Number',
      labelAR: 'رقم الهاتف',
      fieldType: 'text',
      placeholderEN: '05XXXXXXXX',
      placeholderAR: '05XXXXXXXX',
      helpTextEN: 'Auto-formatted to 05XXXXXXXX',
      helpTextAR: 'تنسيق تلقائي إلى 05XXXXXXXX',
      section: 'personal',
      required: true,
      order: 4,
      validation: { regex: '^05[0-9]{8}$', minLength: 10, maxLength: 10, customMessage: 'Must be a valid UAE mobile number (05XXXXXXXX)', customMessageAr: 'يجب أن يكون رقم هاتف إماراتي صحيح (05XXXXXXXX)' },
      ruleDescriptionEN: 'Must be a valid UAE mobile number starting with 05 (10 digits)',
      ruleDescriptionAR: 'يجب أن يكون رقم هاتف إماراتي صحيح يبدأ بـ 05 (10 أرقام)',
      showRule: true,
      aiAutoValidate: true,
      aiValidationPrompt: 'Verify this is a valid UAE mobile phone number. It must start with 05 followed by 8 digits (total 10 digits). Valid UAE mobile prefixes include 050, 052, 054, 055, 056, 058. Flag any number that does not follow this format or uses an invalid prefix.',
    },
    {
      fieldKey: 'email',
      labelEN: 'Email (Optional)',
      labelAR: 'البريد الإلكتروني (اختياري)',
      fieldType: 'text',
      placeholderEN: 'applicant@example.com',
      placeholderAR: 'applicant@example.com',
      section: 'personal',
      required: false,
      order: 5,
      validation: { regex: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$', customMessage: 'Must be a valid email address', customMessageAr: 'يجب أن يكون عنوان بريد إلكتروني صحيح' },
      ruleDescriptionEN: 'Valid email format (optional)',
      ruleDescriptionAR: 'تنسيق بريد إلكتروني صحيح (اختياري)',
      showRule: true,
      aiAutoValidate: true,
      aiValidationPrompt: 'Verify the email address follows a valid format (user@domain.ext). If provided, check for common UAE email patterns (.ae, .gov.ae domains for government employees). This field is optional, so empty values are acceptable. Flag clearly invalid formats like missing @ sign or domain.',
    },
    {
      fieldKey: 'monthlyIncome',
      labelEN: 'Monthly Income (AED)',
      labelAR: 'الدخل الشهري (درهم)',
      fieldType: 'number',
      placeholderEN: '25000',
      placeholderAR: '25000',
      section: 'personal',
      required: true,
      order: 6,
      validation: { min: 0, max: 500000, customMessage: 'Monthly income must be between AED 0 and 500,000', customMessageAr: 'يجب أن يكون الدخل الشهري بين 0 و 500,000 درهم' },
      ruleDescriptionEN: 'Minimum AED 0, maximum AED 500,000',
      ruleDescriptionAR: 'الحد الأدنى 0 درهم، الحد الأقصى 500,000 درهم',
      showRule: true,
      aiAutoValidate: true,
      aiValidationPrompt: 'Verify the monthly income is realistic for the stated employer type in the UAE. Government employees typically earn AED 8,000–80,000+. Semi-government: AED 6,000–60,000+. Private sector: AED 3,000–100,000+. Flag any income that seems inconsistent with the employer type or is unreasonably low/high. Income below AED 5,000 may indicate financial hardship requiring special consideration.',
    },
    {
      fieldKey: 'employer',
      labelEN: 'Employer Name',
      labelAR: 'اسم جهة العمل',
      fieldType: 'text',
      placeholderEN: 'Abu Dhabi Government',
      placeholderAR: 'حكومة أبوظبي',
      section: 'personal',
      required: false,
      order: 7,
      validation: { minLength: 2, maxLength: 200, customMessage: 'Employer name must be 2-200 characters', customMessageAr: 'يجب أن يكون اسم جهة العمل 2-200 حرف' },
      ruleDescriptionEN: '2-200 characters (optional)',
      ruleDescriptionAR: '2-200 حرف (اختياري)',
      showRule: true,
      aiAutoValidate: true,
      aiValidationPrompt: 'Verify the employer name is a plausible entity in the UAE. Recognize major UAE government entities (Abu Dhabi Government, Dubai Government, federal ministries), semi-government organizations (Mubadala, ADNOC, Emirates Airlines), and private sector companies. Cross-reference with the selected employer type for consistency.',
    },
    {
      fieldKey: 'employerType',
      labelEN: 'Employer Type',
      labelAR: 'نوع جهة العمل',
      fieldType: 'select',
      section: 'personal',
      required: true,
      order: 8,
      options: ['government', 'semi-government', 'private'],
      validation: { allowedValues: ['government', 'semi-government', 'private'], customMessage: 'Must select a valid employer type', customMessageAr: 'يجب اختيار نوع جهة عمل صحيح' },
      ruleDescriptionEN: 'Must be: Government, Semi-Government, or Private',
      ruleDescriptionAR: 'يجب أن يكون: حكومي، شبه حكومي، أو قطاع خاص',
      showRule: true,
      aiAutoValidate: true,
      aiValidationPrompt: 'Verify the employer type is correctly categorized as government, semi-government, or private sector. This classification critically affects risk weighting in the assessment: government employees receive the most favorable risk weighting, semi-government moderate, and private sector the highest risk weight. Cross-reference with the employer name for consistency.',
    },
    {
      fieldKey: 'familySize',
      labelEN: 'Family Size',
      labelAR: 'حجم الأسرة',
      fieldType: 'number',
      placeholderEN: '4',
      placeholderAR: '4',
      section: 'personal',
      required: true,
      order: 9,
      validation: { min: 1, max: 30, customMessage: 'Family size must be between 1 and 30', customMessageAr: 'يجب أن يكون حجم الأسرة بين 1 و 30' },
      ruleDescriptionEN: 'Minimum 1, maximum 30',
      ruleDescriptionAR: 'الحد الأدنى 1، الحد الأقصى 30',
      showRule: true,
      aiAutoValidate: true,
      aiValidationPrompt: 'Verify the family size is a reasonable number between 1 and 20. Consider UAE family demographics where the average family size is approximately 5-6 members. A family size of 1 with a housing loan may indicate the applicant is single, which is acceptable. Very large families (>10) should be cross-referenced with the family book.',
    },
    {
      fieldKey: 'hasFamilyBook',
      labelEN: 'Has Family Book',
      labelAR: 'يملك دفتر العائلة',
      fieldType: 'checkbox',
      section: 'personal',
      required: true,
      order: 10,
      validation: { allowedValues: [true, false], customMessage: 'Family book status is required', customMessageAr: 'حالة دفتر العائلة مطلوبة' },
      ruleDescriptionEN: 'MANDATORY for SZHP assistance per Cabinet Resolution 61/2021',
      ruleDescriptionAR: 'إلزامي للحصول على مساعدة برنامج الشيخ زايد وفقاً لقرار مجلس الوزراء 61/2021',
      showRule: true,
      aiAutoValidate: true,
      aiValidationPrompt: 'Verify the applicant has a UAE family book (Khulasat Al Qaid). This is a MANDATORY requirement for SZHP housing assistance per Cabinet Resolution 61/2021. An applicant without a family book is not eligible for any housing assistance. Flag immediately if this is false.',
    },

    // ── Loan Section ─────────────────────────────────────────────────
    {
      fieldKey: 'originalAmount',
      labelEN: 'Original Loan Amount (AED)',
      labelAR: 'مبلغ القرض الأصلي (درهم)',
      fieldType: 'number',
      placeholderEN: '1,500,000',
      placeholderAR: '1,500,000',
      section: 'loan',
      required: true,
      order: 11,
      validation: { min: 10000, max: 5000000, customMessage: 'Loan amount must be between AED 10,000 and 5,000,000', customMessageAr: 'يجب أن يكون مبلغ القرض بين 10,000 و 5,000,000 درهم' },
      ruleDescriptionEN: 'Minimum AED 10,000, maximum AED 5,000,000',
      ruleDescriptionAR: 'الحد الأدنى 10,000 درهم، الحد الأقصى 5,000,000 درهم',
      showRule: true,
      aiAutoValidate: true,
      aiValidationPrompt: 'Verify the original loan amount is within SZHP policy limits. Maximum assistance is AED 800,000 for grants. Housing loans typically range from AED 500,000 to AED 1,500,000. Maintenance loans are usually AED 50,000–200,000. Flag amounts that exceed these ranges or are inconsistent with the loan type selected.',
    },
    {
      fieldKey: 'remainingBalance',
      labelEN: 'Remaining Balance (AED)',
      labelAR: 'الرصيد المتبقي (درهم)',
      fieldType: 'number',
      placeholderEN: '1,200,000',
      placeholderAR: '1,200,000',
      section: 'loan',
      required: true,
      order: 12,
      validation: { min: 0, max: 5000000, customMessage: 'Remaining balance must be between AED 0 and 5,000,000', customMessageAr: 'يجب أن يكون الرصيد المتبقي بين 0 و 5,000,000 درهم' },
      ruleDescriptionEN: 'Must be ≤ original loan amount',
      ruleDescriptionAR: 'يجب أن يكون ≤ مبلغ القرض الأصلي',
      showRule: true,
      aiAutoValidate: true,
      aiValidationPrompt: 'Verify the remaining balance is logically consistent: it must be less than or equal to the original loan amount and greater than zero. Approximate check: remaining balance should roughly equal original amount minus (monthly installment × elapsed months). Flag any significant discrepancies that could indicate data entry errors or inconsistencies.',
    },
    {
      fieldKey: 'monthlyInstallment',
      labelEN: 'Current Monthly Installment (AED)',
      labelAR: 'القسط الشهري الحالي (درهم)',
      fieldType: 'number',
      placeholderEN: '8,500',
      placeholderAR: '8,500',
      section: 'loan',
      required: true,
      order: 13,
      validation: { min: 100, max: 200000, customMessage: 'Monthly installment must be between AED 100 and 200,000', customMessageAr: 'يجب أن يكون القسط الشهري بين 100 و 200,000 درهم' },
      ruleDescriptionEN: 'Minimum AED 100, maximum AED 200,000',
      ruleDescriptionAR: 'الحد الأدنى 100 درهم، الحد الأقصى 200,000 درهم',
      showRule: true,
      aiAutoValidate: true,
      aiValidationPrompt: 'Verify the monthly installment is consistent with the loan amount and duration. Approximate check: monthly installment ≈ remaining balance / remaining months. For a typical AED 1,000,000 loan over 240 months, installment should be around AED 4,000–5,500 (interest-free SZHP loans). Flag installments that seem too high or too low relative to the loan parameters.',
    },
    {
      fieldKey: 'loanDurationMonths',
      labelEN: 'Loan Duration (Months)',
      labelAR: 'مدة القرض (شهر)',
      fieldType: 'number',
      placeholderEN: '240',
      placeholderAR: '240',
      section: 'loan',
      required: true,
      order: 14,
      validation: { min: 12, max: 360, customMessage: 'Loan duration must be between 12 and 360 months', customMessageAr: 'يجب أن تكون مدة القرض بين 12 و 360 شهراً' },
      ruleDescriptionEN: 'Minimum 12 months, maximum 360 months (30 years) per SZHP policy',
      ruleDescriptionAR: 'الحد الأدنى 12 شهراً، الحد الأقصى 360 شهراً (30 سنة) وفقاً لسياسة برنامج الشيخ زايد',
      showRule: true,
      aiAutoValidate: true,
      aiValidationPrompt: 'Verify the loan duration does not exceed 360 months (30 years) per SZHP policy. Standard SZHP loan durations are 120, 180, 240, or 360 months. Flag durations that exceed 360 months or are not standard. The duration should align with the loan type and amount.',
    },
    {
      fieldKey: 'elapsedMonths',
      labelEN: 'Months Elapsed',
      labelAR: 'الأشهر المنقضية',
      fieldType: 'number',
      placeholderEN: '36',
      placeholderAR: '36',
      section: 'loan',
      required: true,
      order: 15,
      validation: { min: 0, max: 360, customMessage: 'Elapsed months must be between 0 and 360', customMessageAr: 'يجب أن تكون الأشهر المنقضية بين 0 و 360' },
      ruleDescriptionEN: 'Must be less than total loan duration',
      ruleDescriptionAR: 'يجب أن يكون أقل من إجمالي مدة القرض',
      showRule: true,
      aiAutoValidate: true,
      aiValidationPrompt: 'Verify the elapsed months is logically consistent: it must be less than the total loan duration months and greater than or equal to zero. Cross-reference with the disbursement date if available. If elapsed months + remaining months does not approximately equal the total duration, flag the inconsistency.',
    },
    {
      fieldKey: 'loanType',
      labelEN: 'Loan Type',
      labelAR: 'نوع القرض',
      fieldType: 'select',
      section: 'loan',
      required: true,
      order: 16,
      options: ['housing_loan', 'grant', 'maintenance'],
      validation: { allowedValues: ['housing_loan', 'grant', 'maintenance'], customMessage: 'Must select a valid loan type', customMessageAr: 'يجب اختيار نوع قرض صحيح' },
      ruleDescriptionEN: 'Must be: Housing Loan, Grant, or Maintenance',
      ruleDescriptionAR: 'يجب أن يكون: قرض إسكاني، منحة، أو صيانة',
      showRule: true,
      aiAutoValidate: true,
      aiValidationPrompt: 'Verify the loan type is correctly categorized as housing_loan, grant, or maintenance. Each type has different SZHP policies: Housing loans have maximum AED 1,500,000 with repayment terms up to 30 years. Grants are up to AED 800,000 and non-repayable. Maintenance loans are typically smaller (AED 50,000–200,000). Cross-reference with the loan amount for consistency.',
    },
    {
      fieldKey: 'totalOverdue',
      labelEN: 'Total Overdue Amount (AED)',
      labelAR: 'إجمالي المبلغ المتأخر (درهم)',
      fieldType: 'number',
      placeholderEN: '25,500',
      placeholderAR: '25,500',
      section: 'loan',
      required: true,
      order: 17,
      validation: { min: 0, max: 5000000, customMessage: 'Overdue amount must be between AED 0 and 5,000,000', customMessageAr: 'يجب أن يكون المبلغ المتأخر بين 0 و 5,000,000 درهم' },
      ruleDescriptionEN: 'Must be ≥ 0; flag if exceeds 50% of remaining balance',
      ruleDescriptionAR: 'يجب أن يكون ≥ 0؛ تنبيه إذا تجاوز 50% من الرصيد المتبقي',
      showRule: true,
      aiAutoValidate: true,
      aiValidationPrompt: 'Verify the total overdue amount is consistent with missed months and monthly installment. Approximate check: total overdue ≈ missed months × monthly installment. Significant discrepancies may indicate partial payments, penalties, or data entry errors. Flag if overdue amount exceeds 50% of the remaining balance as this indicates severe financial distress.',
    },
    {
      fieldKey: 'missedMonths',
      labelEN: 'Missed Months',
      labelAR: 'الأشهر المتأخرة',
      fieldType: 'number',
      placeholderEN: '3',
      placeholderAR: '3',
      section: 'loan',
      required: true,
      order: 18,
      validation: { min: 1, max: 60, customMessage: 'Missed months must be between 1 and 60', customMessageAr: 'يجب أن تكون الأشهر المتأخرة بين 1 و 60' },
      ruleDescriptionEN: 'Minimum 1; flag if > 6 months (prolonged difficulty)',
      ruleDescriptionAR: 'الحد الأدنى 1؛ تنبيه إذا تجاوز 6 أشهر (صعوبة مطولة)',
      showRule: true,
      aiAutoValidate: true,
      aiValidationPrompt: 'Verify the number of missed months is consistent with the delay days (missed months ≈ delay days / 30). Flag if missed months exceeds 6 months as this indicates prolonged financial difficulty. More than 12 missed months is a severe case requiring special handling. Cross-reference with the total overdue amount for consistency.',
    },
    {
      fieldKey: 'delayDays',
      labelEN: 'Delay Duration (Days)',
      labelAR: 'مدة التأخير (يوم)',
      fieldType: 'number',
      placeholderEN: '90',
      placeholderAR: '90',
      section: 'loan',
      required: true,
      order: 19,
      validation: { min: 1, max: 1825, customMessage: 'Delay days must be between 1 and 1,825', customMessageAr: 'يجب أن تكون أيام التأخير بين 1 و 1,825' },
      ruleDescriptionEN: '> 180 days = HIGH RISK, > 365 days = severe distress',
      ruleDescriptionAR: '> 180 يوم = مخاطر عالية، > 365 يوم = ضائقة شديدة',
      showRule: true,
      aiAutoValidate: true,
      aiValidationPrompt: 'Verify the delay duration in days is consistent with missed months (delay days ≈ missed months × 30). Per SZHP policy: delays exceeding 180 days are classified as HIGH RISK. Delays exceeding 365 days indicate severe financial distress and may require escalation. Delays under 90 days are lower risk but still require monitoring.',
    },

    // ── Request Section ───────────────────────────────────────────────
    {
      fieldKey: 'reasonCategory',
      labelEN: 'Reason Category',
      labelAR: 'فئة السبب',
      fieldType: 'select',
      section: 'request',
      required: true,
      order: 20,
      options: ['job_loss', 'medical', 'salary_cut', 'divorce', 'retirement', 'other'],
      validation: { allowedValues: ['job_loss', 'medical', 'salary_cut', 'divorce', 'retirement', 'other'], customMessage: 'Must select a valid reason category', customMessageAr: 'يجب اختيار فئة سبب صحيحة' },
      ruleDescriptionEN: 'Medical, Divorce, Retirement require mandatory supporting documents',
      ruleDescriptionAR: 'الحالات الطبية والطلاق والتقاعد تتطلب مستندات إلزامية',
      showRule: true,
      aiAutoValidate: true,
      aiValidationPrompt: 'Verify the reason category is appropriate for the described circumstances. Medical, divorce, and retirement hardships require special handling and mandatory supporting documentation per SZHP policy. Job loss requires an employment termination letter. Cross-reference the category with the detailed reason for consistency. Flag mismatches (e.g., category "medical" but reason describes job loss).',
    },
    {
      fieldKey: 'reason',
      labelEN: 'Detailed Reason',
      labelAR: 'السبب التفصيلي',
      fieldType: 'textarea',
      placeholderEN: 'Please describe the circumstances that led to the rescheduling request in detail...',
      placeholderAR: 'يرجى وصف الظروف التي أدت إلى طلب إعادة الجدولة بالتفصيل...',
      section: 'request',
      required: true,
      order: 21,
      validation: { minLength: 50, maxLength: 2000, customMessage: 'Reason must be at least 50 characters', customMessageAr: 'يجب أن يكون السبب 50 حرفاً على الأقل' },
      ruleDescriptionEN: 'Minimum 50 characters — provide specific, plausible details',
      ruleDescriptionAR: '50 حرفاً كحد أدنى — قدم تفاصيل محددة ومعقولة',
      showRule: true,
      aiAutoValidate: true,
      aiValidationPrompt: 'Analyze the detailed reason for: (1) Consistency with the selected reason category — flag contradictions. (2) Completeness — the reason should provide specific, plausible details about the circumstances, not generic statements. (3) Minimum length — at least 50 characters is expected. (4) Plausibility — assess whether the described situation is realistic and aligns with the financial data provided. (5) Sensitivity — for medical, divorce, or retirement cases, note that these require empathetic handling and additional documentation.',
    },
    {
      fieldKey: 'requestedDurationMonths',
      labelEN: 'Requested New Duration (months)',
      labelAR: 'المدة الجديدة المطلوبة (شهر)',
      fieldType: 'number',
      section: 'request',
      required: true,
      order: 22,
      validation: { min: 12, max: 360, customMessage: 'Requested duration must be between 12 and 360 months', customMessageAr: 'يجب أن تكون المدة المطلوبة بين 12 و 360 شهراً' },
      ruleDescriptionEN: 'Minimum 12 months, maximum 360 months (30 years) per SZHP policy',
      ruleDescriptionAR: 'الحد الأدنى 12 شهراً، الحد الأقصى 360 شهراً (30 سنة) وفقاً لسياسة برنامج الشيخ زايد',
      showRule: true,
      aiAutoValidate: true,
      aiValidationPrompt: 'Verify the requested duration is between 12 and 360 months per SZHP policy. The requested duration should typically be longer than the remaining loan duration to provide meaningful payment relief. Ensure it does not exceed the SZHP maximum of 30 years (360 months). Flag requests shorter than the remaining duration as they would not provide rescheduling benefit.',
    },
    {
      fieldKey: 'priority',
      labelEN: 'Priority',
      labelAR: 'الأولوية',
      fieldType: 'select',
      section: 'request',
      required: true,
      order: 23,
      options: ['normal', 'urgent', 'critical'],
      validation: { allowedValues: ['normal', 'urgent', 'critical'], customMessage: 'Must select a valid priority level', customMessageAr: 'يجب اختيار مستوى أولوية صحيح' },
      ruleDescriptionEN: '"Critical" requires supporting evidence — misuse flagged',
      ruleDescriptionAR: '"حرج" يتطلب أدلة مؤيدة — إساءة الاستخدام يتم الإبلاغ عنها',
      showRule: true,
      aiAutoValidate: true,
      aiValidationPrompt: 'Verify the priority level is appropriate for the case circumstances. Normal priority is for standard cases. Urgent should be reserved for cases with active financial distress (e.g., recent job loss, missed payments >3 months). Critical should ONLY be used for cases involving medical emergencies, imminent property loss, or extreme hardship. Flag if "critical" is selected without supporting evidence in the reason.',
    },
    {
      fieldKey: 'supportingDocuments',
      labelEN: 'Supporting Documents',
      labelAR: 'المستندات المؤيدة',
      fieldType: 'file',
      section: 'request',
      required: false,
      order: 24,
      validation: { maxFiles: 10, maxFileSize: 10485760, allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'], customMessage: 'Max 10 files, 10MB each (JPG, PNG, PDF)', customMessageAr: 'الحد الأقصى 10 ملفات، 10 ميجابايت لكل منها (JPG, PNG, PDF)' },
      ruleDescriptionEN: 'Max 10 files, 10MB each — JPG, PNG, WebP, PDF accepted',
      ruleDescriptionAR: 'الحد الأقصى 10 ملفات، 10 ميجابايت لكل منها — JPG، PNG، WebP، PDF',
      showRule: true,
      aiAutoValidate: true,
      aiValidationPrompt: 'Verify all required documents are attached based on the reason category: Job loss → employment termination letter + bank statement. Medical → official medical report from UAE hospital. Divorce → court order/decree. Retirement → retirement letter/pension statement. ALL cases require: salary certificate, Emirates ID copy, and bank statement. Flag missing mandatory documents for the selected reason category.',
    },
    {
      fieldKey: 'notes',
      labelEN: 'Additional Notes',
      labelAR: 'ملاحظات إضافية',
      fieldType: 'textarea',
      placeholderEN: 'Any additional information you would like to include...',
      placeholderAR: 'أي معلومات إضافية تريد إضافتها...',
      section: 'request',
      required: false,
      order: 25,
      validation: { maxLength: 2000, customMessage: 'Notes must not exceed 2000 characters', customMessageAr: 'يجب ألا تتجاوز الملاحظات 2000 حرف' },
      ruleDescriptionEN: 'Optional, max 2000 characters',
      ruleDescriptionAR: 'اختياري، 2000 حرف كحد أقصى',
      showRule: true,
      aiAutoValidate: false,
      aiValidationPrompt: 'This is an optional field for additional notes. No specific validation required unless the content contains claims that contradict other form data.',
    },

    // ── Cross-Field Verification Section ──────────────────────────────
    {
      fieldKey: 'cross_name_match',
      labelEN: 'Arabic-English Name Consistency',
      labelAR: 'تطابق الاسم العربي والإنجليزي',
      fieldType: 'cross_field',
      section: 'cross_field',
      required: false,
      order: 26,
      showRule: true,
      aiAutoValidate: true,
      aiValidationPrompt: 'Cross-Field Verification: Compare the English name (nameEn) and Arabic name (nameAr) fields. Verify that both names refer to the same person by checking: (1) The Arabic name is a valid Arabic translation/transliteration of the English name. (2) Both names have the same number of name parts (e.g., 4-part names: First Father Grandfather Family). (3) The family name portion matches in both languages. (4) No completely different names are provided (e.g., different person). If UAE PASS data is available, verify both names match the authenticated identity. Flag any discrepancies that suggest the names may belong to different individuals.',
    },
    {
      fieldKey: 'cross_income_employer',
      labelEN: 'Income-Employer Consistency',
      labelAR: 'تطابق الدخل مع جهة العمل',
      fieldType: 'cross_field',
      section: 'cross_field',
      required: false,
      order: 27,
      showRule: true,
      aiAutoValidate: true,
      aiValidationPrompt: 'Cross-Field Verification: Check consistency between monthly income and employer type/name. Government employees in the UAE typically earn AED 8,000–80,000+. Semi-government: AED 6,000–60,000+. Private sector: AED 3,000–100,000+. Flag if: (1) A government employee reports income below AED 5,000 or above AED 120,000. (2) A private sector employee reports income above AED 150,000 without being in a senior role. (3) The income is inconsistent with the specific employer name provided. Also verify the employer name matches known UAE entities for the given employer type.',
    },
    {
      fieldKey: 'cross_loan_arrear_math',
      labelEN: 'Loan-Arrear Mathematical Consistency',
      labelAR: 'الاتساق الرياضي بين القرض والمتأخرات',
      fieldType: 'cross_field',
      section: 'cross_field',
      required: false,
      order: 28,
      showRule: true,
      aiAutoValidate: true,
      aiValidationPrompt: 'Cross-Field Verification: Verify mathematical consistency across loan and arrear fields. Check: (1) remainingBalance ≤ originalAmount. (2) Approximate: monthlyInstallment × loanDurationMonths ≈ originalAmount (within reasonable tolerance for interest-free SZHP loans). (3) totalOverdue ≈ missedMonths × monthlyInstallment (allow for partial payments and penalties). (4) elapsedMonths < loanDurationMonths. (5) delayDays ≈ missedMonths × 30 (within ±15 days). Flag any significant mathematical discrepancies that suggest data entry errors or inconsistent information.',
    },
    {
      fieldKey: 'cross_reason_docs',
      labelEN: 'Reason-Documentation Consistency',
      labelAR: 'تطابق السبب مع المستندات',
      fieldType: 'cross_field',
      section: 'cross_field',
      required: false,
      order: 29,
      showRule: true,
      aiAutoValidate: true,
      aiValidationPrompt: 'Cross-Field Verification: Verify that the submitted supporting documents match the declared reason category. Required documents by category: Job loss → termination letter + bank statement. Medical → official medical report from UAE hospital/clinic. Divorce → court order/decree. Retirement → retirement letter/pension statement. Salary cut → official salary reduction letter from employer. All cases require: salary certificate, Emirates ID copy, and bank statement. Flag if: (1) Documents are missing for the declared reason. (2) Document content contradicts the stated reason (e.g., medical report for a "job loss" claim). (3) Document dates are implausible (e.g., termination letter dated after the application).',
    },
    {
      fieldKey: 'cross_dbr_feasibility',
      labelEN: 'DBR-Rescheduling Feasibility',
      labelAR: 'جدوى إعادة الجدولة بناءً على نسبة عبء الدين',
      fieldType: 'cross_field',
      section: 'cross_field',
      required: false,
      order: 30,
      showRule: true,
      aiAutoValidate: true,
      aiValidationPrompt: 'Cross-Field Verification: Assess the feasibility of the rescheduling request by analyzing the Debt Burden Ratio (DBR). Calculate DBR = total monthly debt obligations / monthly income. Check: (1) Current DBR — if > 65%, the applicant is under severe financial stress. (2) Proposed DBR after rescheduling — should be < 50% to be sustainable. (3) Whether the requested duration would meaningfully reduce the monthly installment. (4) If the applicant can realistically afford the proposed new installment. Flag if rescheduling would not bring DBR below 50%, as the applicant may need additional assistance beyond simple rescheduling.',
    },
    {
      fieldKey: 'cross_identity_eid',
      labelEN: 'Identity-Emirates ID Consistency',
      labelAR: 'تطابق الهوية مع رقم الهوية',
      fieldType: 'cross_field',
      section: 'cross_field',
      required: false,
      order: 31,
      showRule: true,
      aiAutoValidate: true,
      aiValidationPrompt: 'Cross-Field Verification: Validate the Emirates ID against the applicant identity. Check: (1) The Emirates ID birth year segment (positions 4-7) should be consistent with the applicant age implied by other data (e.g., employment history, loan duration). (2) The Emirates ID checksum digit (last digit) should be valid. (3) If UAE PASS authentication was used, the Emirates ID must match the authenticated identity exactly. (4) The Emirates ID should not appear to be fabricated (e.g., all same digits, sequential patterns). (5) Cross-reference with citizen status — only UAE nationals should have Emirates IDs starting with 784. Flag any inconsistencies between the Emirates ID and the declared personal information.',
    },
    {
      fieldKey: 'cross_family_book_size',
      labelEN: 'Family Book-Family Size Consistency',
      labelAR: 'تطابق دفتر العائلة مع حجم الأسرة',
      fieldType: 'cross_field',
      section: 'cross_field',
      required: false,
      order: 32,
      showRule: true,
      aiAutoValidate: true,
      aiValidationPrompt: 'Cross-Field Verification: Check consistency between the family book status and family size. Verify: (1) If hasFamilyBook is false, the applicant is NOT eligible for SZHP assistance — flag immediately as ineligible per Cabinet Resolution 61/2021. (2) The family size should be consistent with the family book records (if available via UAE PASS). (3) A family size of 1 with a housing loan may indicate a single applicant, which is acceptable but unusual for SZHP. (4) Very large family sizes (>10) should have supporting family book documentation. (5) Cross-reference family size with the housing needs — larger families may require larger housing units.',
    },
    {
      fieldKey: 'cross_loan_type_amount',
      labelEN: 'Loan Type-Amount Consistency',
      labelAR: 'تطابق نوع القرض مع المبلغ',
      fieldType: 'cross_field',
      section: 'cross_field',
      required: false,
      order: 33,
      showRule: true,
      aiAutoValidate: true,
      aiValidationPrompt: 'Cross-Field Verification: Verify the loan amount is consistent with the declared loan type per SZHP policy. Check: (1) Housing loans (housing_loan) typically range from AED 500,000 to AED 1,500,000 — flag amounts significantly outside this range. (2) Grants (grant) have a maximum of AED 800,000 — flag any grant amount exceeding this limit. (3) Maintenance loans (maintenance) are typically AED 50,000–200,000 — flag amounts above AED 300,000. (4) The remaining balance should be proportionally consistent with the loan type and elapsed duration. (5) Ensure the monthly installment is reasonable for the loan type and amount.',
    },
    {
      fieldKey: 'cross_priority_delay_severity',
      labelEN: 'Priority-Delay Severity Consistency',
      labelAR: 'تطابق الأولوية مع شدة التأخير',
      fieldType: 'cross_field',
      section: 'cross_field',
      required: false,
      order: 34,
      showRule: true,
      aiAutoValidate: true,
      aiValidationPrompt: 'Cross-Field Verification: Verify the declared priority level is consistent with the actual delay severity and financial distress indicators. Check: (1) "Critical" priority should correspond to delay days > 365 or overdue amount > 50% of remaining balance — flag if critical priority is claimed with low delay. (2) "Urgent" priority should correspond to delay days 90-365 or overdue amount > 25% of remaining balance. (3) "Normal" priority with delay days > 180 should be escalated to "Urgent". (4) The priority should align with the reason category — medical emergencies and imminent property loss justify "Critical". (5) Flag priority downgrading (e.g., "Normal" with severe delay) as it may indicate data quality issues.',
    },
    {
      fieldKey: 'cross_employer_income_ratio',
      labelEN: 'Employer Type-Income-DBR Cross Check',
      labelAR: 'فحص متبادل لنوع العمل والدخل ونسبة عبء الدين',
      fieldType: 'cross_field',
      section: 'cross_field',
      required: false,
      order: 35,
      showRule: true,
      aiAutoValidate: true,
      aiValidationPrompt: 'Cross-Field Verification: Perform a comprehensive cross-check of employer type, income level, and debt burden. Verify: (1) Government employees should have stable, verifiable income — flag if income seems inconsistent with government pay scales. (2) Private sector employees with high income (>AED 80,000) should have corresponding employer verification. (3) Calculate the effective DBR = monthlyInstallment / monthlyIncome — if > 50%, the applicant is under significant financial stress. (4) Semi-government employees should have income within AED 6,000–60,000 range. (5) Cross-reference: if employer type is "private" and income is very low (<AED 5,000), verify job stability as private sector employment may be less secure. Flag combinations that suggest higher risk profiles.',
    },
  ]

  let created = 0
  let updated = 0

  for (const field of defaultFields) {
    const existing = await db.formField.findUnique({
      where: { fieldKey: field.fieldKey },
    })

    const data = {
      labelEN: field.labelEN,
      labelAR: field.labelAR,
      fieldType: field.fieldType,
      placeholderEN: field.placeholderEN || null,
      placeholderAR: field.placeholderAR || null,
      helpTextEN: field.helpTextEN || null,
      helpTextAR: field.helpTextAR || null,
      section: field.section,
      required: field.required ?? true,
      order: field.order,
      options: JSON.stringify((field as any).options || []),
      validation: JSON.stringify(field.validation || {}),
      ruleDescriptionEN: field.ruleDescriptionEN || null,
      ruleDescriptionAR: field.ruleDescriptionAR || null,
      showRule: field.showRule ?? true,
      aiValidationPrompt: field.aiValidationPrompt || null,
      aiAutoValidate: field.aiAutoValidate ?? false,
      isVisible: true,
      isActive: true,
    }

    if (existing) {
      await db.formField.update({
        where: { fieldKey: field.fieldKey },
        data,
      })
      log(SECTION, `${field.fieldKey} (updated)`)
      updated++
    } else {
      await db.formField.create({
        data: {
          fieldKey: field.fieldKey,
          ...data,
        },
      })
      log(SECTION, `${field.fieldKey}`)
      created++
    }
  }

  console.log(`  📊 [${SECTION}] ${created} created, ${updated} updated`)
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log('─────────────────────────────────────────────────────')
  console.log('🌱 SZHP Essential Data Seed')
  console.log('─────────────────────────────────────────────────────')
  console.log()

  try {
    // 1. Admin Users
    console.log('👤 Seeding Admin Users...')
    await seedAdminUsers()
    console.log()

    // 2. AI Model Configs
    console.log('🤖 Seeding AI Model Configs...')
    await seedAIModelConfigs()
    console.log()

    // 3. System Configs
    console.log('⚙️  Seeding System Configs...')
    await seedSystemConfigs()
    console.log()

    // 4. Form Fields
    console.log('📝 Seeding Form Fields...')
    await seedFormFields()
    console.log()

    console.log('─────────────────────────────────────────────────────')
    console.log('✅ All essential data seeded successfully!')
    console.log('─────────────────────────────────────────────────────')
  } catch (error) {
    console.error()
    console.error('─────────────────────────────────────────────────────')
    console.error('❌ Seed failed with error:')
    console.error(error instanceof Error ? error.message : error)
    if (error instanceof Error && error.stack) {
      console.error(error.stack)
    }
    console.error('─────────────────────────────────────────────────────')
    process.exit(1)
  } finally {
    await db.$disconnect()
  }
}

main()
