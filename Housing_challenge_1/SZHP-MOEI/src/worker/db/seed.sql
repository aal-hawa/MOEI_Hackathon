-- ═══════════════════════════════════════════════════════════════════════
-- SZHP MOEI AI Agent — D1 Seed Data
-- ═══════════════════════════════════════════════════════════════════════
-- This SQL file initializes the D1 database with default data.
-- All IDs are hardcoded UUIDs for consistency across environments.
--
-- Usage:
--   wrangler d1 execute szhp-housing-db --file=src/worker/db/seed.sql
--   wrangler d1 execute szhp-housing-db --local --file=src/worker/db/seed.sql
--
-- NOTE: Run schema.sql FIRST to create tables, then run this seed.sql.
-- This file is IDEMPOTENT — it uses INSERT OR IGNORE to skip existing rows.
-- ═══════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════
-- 1. DEFAULT USERS
-- ═══════════════════════════════════════════════════════════════════════

-- Superadmin: admin@szhp.gov.ae / Admin@2024
-- bcrypt hash generated with 12 salt rounds
INSERT OR IGNORE INTO User (id, uaepassSub, emiratesId, email, firstnameEN, lastnameEN, firstnameAR, lastnameAR, fullnameEN, fullnameAR, gender, dob, nationalityEN, nationalityAR, role, department, sopLevel, isActive, permissions, passwordHash, loginAttempts, twoFactorEnabled)
VALUES (
  'a1b2c3d4-0001-4000-8000-000000000001',
  'admin_szhp_system',
  'ADM0000000001',
  'admin@szhp.gov.ae',
  'System',
  'Administrator',
  'مسؤول',
  'النظام',
  'System Administrator',
  'مسؤول النظام',
  'male', '1979-06-15', 'Emirati', 'إماراتي',
  'superadmin',
  'management',
  'sop3',
  1,
  '["*"]',
  '$2b$12$bCFOFYvbLMrbCWyMdfxO0.QRPcfMGvn4CtXsGWPZvc92ZAh9K0S/i',
  0,
  0
);

-- Demo Employee: Manager — manager@szhp.gov.ae / Pass@2024
INSERT OR IGNORE INTO User (id, uaepassSub, emiratesId, email, firstnameEN, lastnameEN, firstnameAR, lastnameAR, fullnameEN, fullnameAR, gender, dob, nationalityEN, nationalityAR, role, department, sopLevel, isActive, permissions, passwordHash, loginAttempts, twoFactorEnabled)
VALUES (
  'a1b2c3d4-0002-4000-8000-000000000002',
  'admin_manager_szhp_gov_ae',
  'ADM0000000002',
  'manager@szhp.gov.ae',
  'Ahmed',
  'Al Mansouri',
  'أحمد',
  'المنصوري',
  'Ahmed Al Mansouri',
  'أحمد المنصوري',
  'male', '1982-03-20', 'Emirati', 'إماراتي',
  'manager',
  'management',
  'sop2',
  1,
  '["dashboard","cases","cases.approve","cases.reject","cases.escalate","workflows","employees.view","employees.manage","audit.view","settings","models"]',
  '$2b$12$/5O/zCThRJlOgBaiIW3isOyg.biXIKvKfp8tYcUf/QDgHmDU2jlOC',
  0,
  0
);

-- Demo Employee: Reviewer — reviewer@szhp.gov.ae / Pass@2024
INSERT OR IGNORE INTO User (id, uaepassSub, emiratesId, email, firstnameEN, lastnameEN, firstnameAR, lastnameAR, fullnameEN, fullnameAR, gender, dob, nationalityEN, nationalityAR, role, department, sopLevel, isActive, permissions, passwordHash, loginAttempts, twoFactorEnabled)
VALUES (
  'a1b2c3d4-0003-4000-8000-000000000003',
  'admin_reviewer_szhp_gov_ae',
  'ADM0000000003',
  'reviewer@szhp.gov.ae',
  'Fatima',
  'Al Zaabi',
  'فاطمة',
  'الزعابي',
  'Fatima Al Zaabi',
  'فاطمة الزعابي',
  'female', '1987-09-12', 'Emirati', 'إماراتي',
  'reviewer',
  'risk_assessment',
  'sop2',
  1,
  '["dashboard","cases","cases.review","audit.view"]',
  '$2b$12$/5O/zCThRJlOgBaiIW3isOyg.biXIKvKfp8tYcUf/QDgHmDU2jlOC',
  0,
  0
);

-- Demo Employee: Employee — employee@szhp.gov.ae / Pass@2024
INSERT OR IGNORE INTO User (id, uaepassSub, emiratesId, email, firstnameEN, lastnameEN, firstnameAR, lastnameAR, fullnameEN, fullnameAR, gender, dob, nationalityEN, nationalityAR, role, department, sopLevel, isActive, permissions, passwordHash, loginAttempts, twoFactorEnabled)
VALUES (
  'a1b2c3d4-0004-4000-8000-000000000004',
  'admin_employee_szhp_gov_ae',
  'ADM0000000004',
  'employee@szhp.gov.ae',
  'Omar',
  'Al Ketbi',
  'عمر',
  'الكعبي',
  'Omar Al Ketbi',
  'عمر الكعبي',
  'male', '1990-01-08', 'Emirati', 'إماراتي',
  'employee',
  'housing_finance',
  'sop2',
  1,
  '["dashboard","cases.view"]',
  '$2b$12$/5O/zCThRJlOgBaiIW3isOyg.biXIKvKfp8tYcUf/QDgHmDU2jlOC',
  0,
  0
);

-- Demo Employee: Admin — admin2@szhp.gov.ae / Pass@2024
INSERT OR IGNORE INTO User (id, uaepassSub, emiratesId, email, firstnameEN, lastnameEN, firstnameAR, lastnameAR, fullnameEN, fullnameAR, gender, dob, nationalityEN, nationalityAR, role, department, sopLevel, isActive, permissions, passwordHash, loginAttempts, twoFactorEnabled)
VALUES (
  'a1b2c3d4-0005-4000-8000-000000000005',
  'admin_admin2_szhp_gov_ae',
  'ADM0000000005',
  'admin2@szhp.gov.ae',
  'Sara',
  'Al Dhaheri',
  'سارة',
  'الظاهري',
  'Sara Al Dhaheri',
  'سارة الظاهري',
  'female', '1992-11-25', 'Emirati', 'إماراتي',
  'admin',
  'compliance',
  'sop2',
  1,
  '["dashboard","cases","cases.approve","cases.reject","workflows","employees.view","employees.manage","audit.view","settings","models"]',
  '$2b$12$/5O/zCThRJlOgBaiIW3isOyg.biXIKvKfp8tYcUf/QDgHmDU2jlOC',
  0,
  0
);

-- Audit log for seeding
INSERT OR IGNORE INTO AuditLog (id, requestId, action, performedBy, details, category, affectedRecord, newValue)
VALUES (
  'a1b2c3d4-0099-4000-8000-000000000099',
  NULL,
  'system_seeded',
  'system',
  '{"message":"Default accounts seeded via SQL","superadmin":"admin@szhp.gov.ae"}',
  'system',
  'User:a1b2c3d4-0001-4000-8000-000000000001',
  '{"email":"admin@szhp.gov.ae","role":"superadmin","department":"management"}'
);


-- ═══════════════════════════════════════════════════════════════════════
-- 2. AI MODEL CONFIGS
-- ═══════════════════════════════════════════════════════════════════════
-- NOTE: API keys should be set via environment variables or wrangler secrets.
-- The apiKey field is left empty here for security.

INSERT OR IGNORE INTO AIModelConfig (id, name, provider, modelId, baseUrl, apiKey, isActive, isDefault, capabilities, maxTokens, temperature, descriptionEN, descriptionAR)
VALUES (
  'b1b2c3d4-0001-4000-8000-000000000001',
  'Recentech AI — GLM-4-Flash',
  'recentech',
  'glm-4-flash',
  'https://recentech-ai-worker.42abudhabi424242.workers.dev/v1',
  '',
  1, 1,
  '["chat","vision"]',
  4096, 0.7,
  'Ultra-fast model for simple tasks. Best for quick responses.',
  'نموذج فائق السرعة للمهام البسيطة. الأفضل للاستجابات السريعة.'
);

INSERT OR IGNORE INTO AIModelConfig (id, name, provider, modelId, baseUrl, apiKey, isActive, isDefault, capabilities, maxTokens, temperature, descriptionEN, descriptionAR)
VALUES (
  'b1b2c3d4-0002-4000-8000-000000000002',
  'Recentech AI — GLM-4-Plus',
  'recentech',
  'glm-4-plus',
  'https://recentech-ai-worker.42abudhabi424242.workers.dev/v1',
  '',
  1, 0,
  '["chat","vision"]',
  4096, 0.7,
  'Default general purpose model. Good balance of speed and quality.',
  'نموذج الأغراض العامة الافتراضي. توازن جيد بين السرعة والجودة.'
);

INSERT OR IGNORE INTO AIModelConfig (id, name, provider, modelId, baseUrl, apiKey, isActive, isDefault, capabilities, maxTokens, temperature, descriptionEN, descriptionAR)
VALUES (
  'b1b2c3d4-0003-4000-8000-000000000003',
  'Recentech AI — GLM-5',
  'recentech',
  'glm-5',
  'https://recentech-ai-worker.42abudhabi424242.workers.dev/v1',
  '',
  1, 0,
  '["chat","vision","thinking"]',
  8192, 0.7,
  'Latest advanced reasoning model. Best quality responses.',
  'أحدث نموذج استدلال متقدم. أفضل جودة للاستجابات.'
);

INSERT OR IGNORE INTO AIModelConfig (id, name, provider, modelId, baseUrl, apiKey, isActive, isDefault, capabilities, maxTokens, temperature, descriptionEN, descriptionAR)
VALUES (
  'b1b2c3d4-0004-4000-8000-000000000004',
  'Recentech AI — Gemini 2.5 Flash',
  'gemini',
  'gemini-2.5-flash',
  'https://recentech-ai-worker.42abudhabi424242.workers.dev/v1',
  '',
  1, 0,
  '["chat","vision"]',
  8192, 0.7,
  'Google Gemini 2.5 Flash via Recentech AI proxy. Fast and capable.',
  'جوجل جيميني 2.5 فلاش عبر وكيل Recentech AI. سريع وقادر.'
);

INSERT OR IGNORE INTO AIModelConfig (id, name, provider, modelId, baseUrl, apiKey, isActive, isDefault, capabilities, maxTokens, temperature, descriptionEN, descriptionAR)
VALUES (
  'b1b2c3d4-0005-4000-8000-000000000005',
  'Recentech AI — Gemini 2.5 Pro',
  'gemini',
  'gemini-2.5-pro',
  'https://recentech-ai-worker.42abudhabi424242.workers.dev/v1',
  '',
  1, 0,
  '["chat","vision"]',
  8192, 0.7,
  'Google Gemini 2.5 Pro via Recentech AI proxy. Complex reasoning.',
  'جوجل جيميني 2.5 برو عبر وكيل Recentech AI. استدلال معقد.'
);

INSERT OR IGNORE INTO AIModelConfig (id, name, provider, modelId, baseUrl, apiKey, isActive, isDefault, capabilities, maxTokens, temperature, descriptionEN, descriptionAR)
VALUES (
  'b1b2c3d4-0006-4000-8000-000000000006',
  'Local — Ollama',
  'ollama',
  'llama3',
  'http://localhost:11434',
  NULL,
  1, 0,
  '["chat","vision"]',
  4096, 0.7,
  'Local Ollama model. No API key needed. Change model ID to your installed model.',
  'نموذج Ollama محلي. لا حاجة لمفتاح API. غيّر معرف النموذج للنموذج المثبت.'
);

INSERT OR IGNORE INTO AIModelConfig (id, name, provider, modelId, baseUrl, apiKey, isActive, isDefault, capabilities, maxTokens, temperature, descriptionEN, descriptionAR)
VALUES (
  'b1b2c3d4-0007-4000-8000-000000000007',
  'OpenAI — GPT-4o',
  'openai',
  'gpt-4o',
  'https://api.openai.com/v1',
  '',
  0, 0,
  '["chat","vision"]',
  4096, 0.7,
  'OpenAI GPT-4o. Requires your own API key.',
  'OpenAI GPT-4o. يتطلب مفتاح API الخاص بك.'
);

INSERT OR IGNORE INTO AIModelConfig (id, name, provider, modelId, baseUrl, apiKey, isActive, isDefault, capabilities, maxTokens, temperature, descriptionEN, descriptionAR)
VALUES (
  'b1b2c3d4-0008-4000-8000-000000000008',
  'OpenAI — GPT-4o Mini',
  'openai',
  'gpt-4o-mini',
  'https://api.openai.com/v1',
  '',
  0, 0,
  '["chat"]',
  4096, 0.7,
  'OpenAI GPT-4o Mini. Cost-effective. Requires your own API key.',
  'OpenAI GPT-4o Mini. فعال من حيث التكلفة. يتطلب مفتاح API الخاص بك.'
);

INSERT OR IGNORE INTO AIModelConfig (id, name, provider, modelId, baseUrl, apiKey, isActive, isDefault, capabilities, maxTokens, temperature, descriptionEN, descriptionAR)
VALUES (
  'b1b2c3d4-0009-4000-8000-000000000009',
  'Custom — OpenAI Compatible',
  'openai_compatible',
  'default',
  'http://localhost:8080/v1',
  '',
  0, 0,
  '["chat"]',
  4096, 0.7,
  'Any OpenAI-compatible endpoint (vLLM, LM Studio, Text Generation Inference, etc.)',
  'أي نقطة نهاية متوافقة مع OpenAI (vLLM، LM Studio، إلخ)'
);


-- ═══════════════════════════════════════════════════════════════════════
-- 3. SYSTEM CONFIG (Business Rules)
-- ═══════════════════════════════════════════════════════════════════════

-- ── DBR Limits ─────────────────────────────────────────────────
INSERT OR IGNORE INTO SystemConfig (id, configKey, configValue, defaultValue, labelEN, labelAR, descriptionEN, descriptionAR, category, valueType, min, max, unit, isPublic, isActive)
VALUES ('c1b2c3d4-0001-4000-8000-000000000001', 'max_dbr_limit', '0.6', '0.6', 'Maximum DBR Limit', 'الحد الأقصى لنسبة عبء الدين', 'Maximum Debt Burden Ratio allowed. Cases above this are auto-rejected per Cabinet Resolution 61/2021.', 'الحد الأقصى المسموح لنسبة عبء الدين. الحالات التي تتجاوز هذا الحد تُرفض تلقائياً وفقاً لقرار مجلس الوزراء 61/2021.', 'dbr_limits', 'number', 0.1, 1.0, '%', 1, 1);

INSERT OR IGNORE INTO SystemConfig (id, configKey, configValue, defaultValue, labelEN, labelAR, descriptionEN, descriptionAR, category, valueType, min, max, unit, isPublic, isActive)
VALUES ('c1b2c3d4-0002-4000-8000-000000000002', 'dbr_healthy_limit', '0.35', '0.35', 'Healthy DBR Threshold', 'عتبة نسبة عبء الدين الصحية', 'DBR below this is considered healthy/low risk. Shown as green indicator to customers.', 'نسبة عبء الدين أقل من هذا المستوى تعتبر صحية/منخفضة المخاطر. تظهر كمؤشر أخضر للعملاء.', 'dbr_limits', 'number', 0.1, 0.6, '%', 1, 1);

INSERT OR IGNORE INTO SystemConfig (id, configKey, configValue, defaultValue, labelEN, labelAR, descriptionEN, descriptionAR, category, valueType, min, max, unit, isPublic, isActive)
VALUES ('c1b2c3d4-0003-4000-8000-000000000003', 'dbr_caution_limit', '0.5', '0.5', 'Caution DBR Threshold', 'عتبة تحذير نسبة عبء الدين', 'DBR between healthy and this value is caution zone (yellow). Above this is high risk (red).', 'نسبة عبء الدين بين المستوى الصحي وهذه القيمة هي منطقة تحذير (صفراء). أعلى من هذا مخاطر عالية (حمراء).', 'dbr_limits', 'number', 0.2, 0.7, '%', 1, 1);

-- ── Risk Score Thresholds ───────────────────────────────────────
INSERT OR IGNORE INTO SystemConfig (id, configKey, configValue, defaultValue, labelEN, labelAR, descriptionEN, descriptionAR, category, valueType, min, max, unit, isPublic, isActive)
VALUES ('c1b2c3d4-0004-4000-8000-000000000004', 'risk_threshold_low', '30', '30', 'Low Risk Threshold', 'عتبة المخاطر المنخفضة', 'Risk score 0 to this value = LOW risk. Low risk cases may be auto-approved.', 'درجة المخاطر من 0 إلى هذه القيمة = مخاطر منخفضة. حالات المخاطر المنخفضة قد تحظى بموافقة تلقائية.', 'risk_thresholds', 'number', 0, 100, 'points', 0, 1);

INSERT OR IGNORE INTO SystemConfig (id, configKey, configValue, defaultValue, labelEN, labelAR, descriptionEN, descriptionAR, category, valueType, min, max, unit, isPublic, isActive)
VALUES ('c1b2c3d4-0005-4000-8000-000000000005', 'risk_threshold_medium', '50', '50', 'Medium Risk Threshold', 'عتبة المخاطر المتوسطة', 'Risk score above low and up to this value = MEDIUM risk. Requires standard review.', 'درجة المخاطر أعلى من المنخفضة وحتى هذه القيمة = مخاطر متوسطة. تتطلب مراجعة عادية.', 'risk_thresholds', 'number', 10, 100, 'points', 0, 1);

INSERT OR IGNORE INTO SystemConfig (id, configKey, configValue, defaultValue, labelEN, labelAR, descriptionEN, descriptionAR, category, valueType, min, max, unit, isPublic, isActive)
VALUES ('c1b2c3d4-0006-4000-8000-000000000006', 'risk_threshold_high', '70', '70', 'High Risk Threshold', 'عتبة المخاطر العالية', 'Risk score above medium and up to this value = HIGH risk. Requires detailed review.', 'درجة المخاطر أعلى من المتوسطة وحتى هذه القيمة = مخاطر عالية. تتطلب مراجعة تفصيلية.', 'risk_thresholds', 'number', 20, 100, 'points', 0, 1);

-- ── Loan Limits ─────────────────────────────────────────────────
INSERT OR IGNORE INTO SystemConfig (id, configKey, configValue, defaultValue, labelEN, labelAR, descriptionEN, descriptionAR, category, valueType, min, max, unit, isPublic, isActive)
VALUES ('c1b2c3d4-0007-4000-8000-000000000007', 'max_loan_duration_months', '360', '360', 'Maximum Loan Duration', 'الحد الأقصى لمدة القرض', 'Maximum loan duration in months per SZHP policy. Currently 30 years (360 months).', 'الحد الأقصى لمدة القرض بالأشهر وفقاً لسياسة برنامج الشيخ زايد. حالياً 30 سنة (360 شهراً).', 'loan_limits', 'number', 12, 600, 'months', 1, 1);

INSERT OR IGNORE INTO SystemConfig (id, configKey, configValue, defaultValue, labelEN, labelAR, descriptionEN, descriptionAR, category, valueType, min, max, unit, isPublic, isActive)
VALUES ('c1b2c3d4-0008-4000-8000-000000000008', 'min_loan_duration_months', '12', '12', 'Minimum Loan Duration', 'الحد الأدنى لمدة القرض', 'Minimum loan duration in months.', 'الحد الأدنى لمدة القرض بالأشهر.', 'loan_limits', 'number', 1, 60, 'months', 0, 1);

INSERT OR IGNORE INTO SystemConfig (id, configKey, configValue, defaultValue, labelEN, labelAR, descriptionEN, descriptionAR, category, valueType, min, max, unit, isPublic, isActive)
VALUES ('c1b2c3d4-0009-4000-8000-000000000009', 'max_grant_amount', '800000', '800000', 'Maximum Grant Amount (AED)', 'الحد الأقصى لمبلغ المنحة (درهم)', 'Maximum assistance amount for grants per SZHP policy.', 'الحد الأقصى لمبلغ المساعدة للمنح وفقاً لسياسة برنامج الشيخ زايد.', 'loan_limits', 'number', 10000, 2000000, 'AED', 0, 1);

INSERT OR IGNORE INTO SystemConfig (id, configKey, configValue, defaultValue, labelEN, labelAR, descriptionEN, descriptionAR, category, valueType, min, max, unit, isPublic, isActive)
VALUES ('c1b2c3d4-0010-4000-8000-000000000010', 'max_housing_loan_amount', '1500000', '1500000', 'Maximum Housing Loan Amount (AED)', 'الحد الأقصى لمبلغ القرض الإسكاني (درهم)', 'Maximum housing loan amount per SZHP policy.', 'الحد الأقصى لمبلغ القرض الإسكاني وفقاً لسياسة برنامج الشيخ زايد.', 'loan_limits', 'number', 100000, 5000000, 'AED', 0, 1);

INSERT OR IGNORE INTO SystemConfig (id, configKey, configValue, defaultValue, labelEN, labelAR, descriptionEN, descriptionAR, category, valueType, min, max, unit, isPublic, isActive)
VALUES ('c1b2c3d4-0011-4000-8000-000000000011', 'max_maintenance_amount', '200000', '200000', 'Maximum Maintenance Amount (AED)', 'الحد الأقصى لمبلغ الصيانة (درهم)', 'Maximum maintenance loan amount per SZHP policy.', 'الحد الأقصى لمبلغ قرض الصيانة وفقاً لسياسة برنامج الشيخ زايد.', 'loan_limits', 'number', 10000, 500000, 'AED', 0, 1);

-- ── Eligibility ─────────────────────────────────────────────────
INSERT OR IGNORE INTO SystemConfig (id, configKey, configValue, defaultValue, labelEN, labelAR, descriptionEN, descriptionAR, category, valueType, min, max, unit, isPublic, isActive)
VALUES ('c1b2c3d4-0012-4000-8000-000000000012', 'citizenship_required', 'true', 'true', 'UAE Citizenship Required', 'مطلوب الجنسية الإماراتية', 'Whether UAE citizenship is mandatory for any housing assistance.', 'ما إذا كانت الجنسية الإماراتية إلزامية لأي مساعدة إسكانية.', 'eligibility', 'boolean', NULL, NULL, NULL, 0, 1);

INSERT OR IGNORE INTO SystemConfig (id, configKey, configValue, defaultValue, labelEN, labelAR, descriptionEN, descriptionAR, category, valueType, min, max, unit, isPublic, isActive)
VALUES ('c1b2c3d4-0013-4000-8000-000000000013', 'family_book_required', 'true', 'true', 'Family Book Required', 'مطلوب دفتر العائلة', 'Whether a UAE family book (Khulasat Al Qaid) is mandatory for housing assistance.', 'ما إذا كان دفتر العائلة (خلاصة القيد) إلزامياً للمساعدة الإسكانية.', 'eligibility', 'boolean', NULL, NULL, NULL, 0, 1);

INSERT OR IGNORE INTO SystemConfig (id, configKey, configValue, defaultValue, labelEN, labelAR, descriptionEN, descriptionAR, category, valueType, min, max, unit, isPublic, isActive)
VALUES ('c1b2c3d4-0014-4000-8000-000000000014', 'min_monthly_income', '3000', '3000', 'Minimum Monthly Income (AED)', 'الحد الأدنى للدخل الشهري (درهم)', 'Minimum monthly income to be eligible for rescheduling.', 'الحد الأدنى للدخل الشهري للأهلية لإعادة الجدولة.', 'eligibility', 'number', 0, 50000, 'AED', 0, 1);

INSERT OR IGNORE INTO SystemConfig (id, configKey, configValue, defaultValue, labelEN, labelAR, descriptionEN, descriptionAR, category, valueType, min, max, unit, isPublic, isActive)
VALUES ('c1b2c3d4-0046-4000-8000-000000000046', 'income_per_member_threshold', '2500', '2500', 'Income Per Member Threshold', 'عتبة الدخل لكل فرد', 'Minimum household income per family member used to identify cases needing lighter rescheduling plans.', 'الحد الأدنى لدخل الأسرة لكل فرد لتحديد الحالات التي تحتاج إلى خطط إعادة جدولة أخف.', 'eligibility', 'number', 0, 10000, 'AED', 1, 1);

INSERT OR IGNORE INTO SystemConfig (id, configKey, configValue, defaultValue, labelEN, labelAR, descriptionEN, descriptionAR, category, valueType, min, max, unit, isPublic, isActive)
VALUES ('c1b2c3d4-0047-4000-8000-000000000047', 'moei_max_deduction_rate', '0.20', '0.20', 'MOEI Maximum Deduction Rate', 'الحد الأقصى لنسبة الخصم', 'Maximum proposed monthly deduction from income for arrears rescheduling under the 20% rule.', 'الحد الأقصى للخصم الشهري المقترح من الدخل لإعادة جدولة المتأخرات وفق قاعدة 20٪.', 'dbr_limits', 'number', 0.05, 0.5, '%', 1, 1);

INSERT OR IGNORE INTO SystemConfig (id, configKey, configValue, defaultValue, labelEN, labelAR, descriptionEN, descriptionAR, category, valueType, min, max, unit, isPublic, isActive)
VALUES ('c1b2c3d4-0043-4000-8000-000000000043', 'eligibility_check_enabled', 'true', 'true', 'Eligibility Check (Emirati + Loan)', 'التحقق من الأهلية (إماراتي + قرض)', 'Enable Emirati + active loan eligibility check before request submission.', 'تمكين التحقق من الأهلية (إماراتي + قرض نشط) قبل تقديم الطلب.', 'eligibility', 'boolean', NULL, NULL, NULL, 1, 1);

INSERT OR IGNORE INTO SystemConfig (id, configKey, configValue, defaultValue, labelEN, labelAR, descriptionEN, descriptionAR, category, valueType, min, max, unit, isPublic, isActive)
VALUES ('c1b2c3d4-0044-4000-8000-000000000044', 'salary_certificate_required', 'true', 'true', 'Salary Certificate Required', 'مطلوب شهادة الراتب', 'Whether a salary certificate is mandatory for rescheduling applications.', 'ما إذا كانت شهادة الراتب إلزامية لطلبات إعادة الجدولة.', 'documents', 'boolean', NULL, NULL, NULL, 1, 1);

INSERT OR IGNORE INTO SystemConfig (id, configKey, configValue, defaultValue, labelEN, labelAR, descriptionEN, descriptionAR, category, valueType, min, max, unit, isPublic, isActive)
VALUES ('c1b2c3d4-0045-4000-8000-000000000045', 'ai_analysis_mode', 'optional', 'optional', 'AI Analysis Mode', 'وضع تحليل الذكاء الاصطناعي', 'Whether AI document analysis is optional or required.', 'ما إذا كان تحليل المستندات بالذكاء الاصطناعي اختياري أو مطلوب.', 'documents', 'string', NULL, NULL, NULL, 1, 1);

-- ── Auto-Approval Rules ─────────────────────────────────────────
INSERT OR IGNORE INTO SystemConfig (id, configKey, configValue, defaultValue, labelEN, labelAR, descriptionEN, descriptionAR, category, valueType, min, max, unit, isPublic, isActive)
VALUES ('c1b2c3d4-0015-4000-8000-000000000015', 'auto_approve_enabled', 'true', 'true', 'Auto-Approval Enabled', 'الموافقة التلقائية مفعلة', 'Enable or disable automatic approval for low-risk cases.', 'تمكين أو تعطيل الموافقة التلقائية للحالات منخفضة المخاطر.', 'auto_approve', 'boolean', NULL, NULL, NULL, 0, 1);

INSERT OR IGNORE INTO SystemConfig (id, configKey, configValue, defaultValue, labelEN, labelAR, descriptionEN, descriptionAR, category, valueType, min, max, unit, isPublic, isActive)
VALUES ('c1b2c3d4-0016-4000-8000-000000000016', 'auto_approve_max_risk_score', '30', '30', 'Auto-Approve Max Risk Score', 'الحد الأقصى لدرجة المخاطر للموافقة التلقائية', 'Cases with risk score at or below this value are auto-approved.', 'الحالات التي تبلغ درجة مخاطرها هذه القيمة أو أقل تحظى بموافقة تلقائية.', 'auto_approve', 'number', 0, 80, 'points', 0, 1);

INSERT OR IGNORE INTO SystemConfig (id, configKey, configValue, defaultValue, labelEN, labelAR, descriptionEN, descriptionAR, category, valueType, min, max, unit, isPublic, isActive)
VALUES ('c1b2c3d4-0017-4000-8000-000000000017', 'auto_approve_max_dbr', '0.4', '0.4', 'Auto-Approve Max DBR', 'الحد الأقصى لنسبة عبء الدين للموافقة التلقائية', 'Cases with proposed DBR at or below this value may be auto-approved.', 'الحالات التي تبلغ نسبة عبء الدين المقترحة هذه القيمة أو أقل قد تحظى بموافقة تلقائية.', 'auto_approve', 'number', 0.1, 0.6, '%', 0, 1);

INSERT OR IGNORE INTO SystemConfig (id, configKey, configValue, defaultValue, labelEN, labelAR, descriptionEN, descriptionAR, category, valueType, min, max, unit, isPublic, isActive)
VALUES ('c1b2c3d4-0018-4000-8000-000000000018', 'auto_approve_max_delay_days', '90', '90', 'Auto-Approve Max Delay Days', 'الحد الأقصى لأيام التأخير للموافقة التلقائية', 'Cases with delay days at or below this value may be auto-approved.', 'الحالات التي تبلغ أيام تأخيرها هذه القيمة أو أقل قد تحظى بموافقة تلقائية.', 'auto_approve', 'number', 0, 365, 'days', 0, 1);

INSERT OR IGNORE INTO SystemConfig (id, configKey, configValue, defaultValue, labelEN, labelAR, descriptionEN, descriptionAR, category, valueType, min, max, unit, isPublic, isActive)
VALUES ('c1b2c3d4-0019-4000-8000-000000000019', 'auto_approve_gov_only', 'false', 'false', 'Auto-Approve Government Employees Only', 'الموافقة التلقائية للموظفين الحكوميين فقط', 'If enabled, only government employees qualify for auto-approval.', 'إذا تم التمكين، فقط الموظفون الحكوميون مؤهلون للموافقة التلقائية.', 'auto_approve', 'boolean', NULL, NULL, NULL, 0, 1);

-- ── Auto-Rejection Rules ────────────────────────────────────────
INSERT OR IGNORE INTO SystemConfig (id, configKey, configValue, defaultValue, labelEN, labelAR, descriptionEN, descriptionAR, category, valueType, min, max, unit, isPublic, isActive)
VALUES ('c1b2c3d4-0020-4000-8000-000000000020', 'auto_reject_enabled', 'true', 'true', 'Auto-Rejection Enabled', 'الرفض التلقائي مفعل', 'Enable or disable automatic rejection for ineligible cases.', 'تمكين أو تعطيل الرفض التلقائي للحالات غير المؤهلة.', 'auto_reject', 'boolean', NULL, NULL, NULL, 0, 1);

INSERT OR IGNORE INTO SystemConfig (id, configKey, configValue, defaultValue, labelEN, labelAR, descriptionEN, descriptionAR, category, valueType, min, max, unit, isPublic, isActive)
VALUES ('c1b2c3d4-0021-4000-8000-000000000021', 'auto_reject_min_dbr', '0.6', '0.6', 'Auto-Reject DBR Threshold', 'عتبة نسبة عبء الدين للرفض التلقائي', 'Cases with proposed DBR exceeding this value are auto-rejected.', 'الحالات التي تتجاوز نسبة عبء الدين المقترحة هذه القيمة تُرفض تلقائياً.', 'auto_reject', 'number', 0.3, 1.0, '%', 0, 1);

INSERT OR IGNORE INTO SystemConfig (id, configKey, configValue, defaultValue, labelEN, labelAR, descriptionEN, descriptionAR, category, valueType, min, max, unit, isPublic, isActive)
VALUES ('c1b2c3d4-0022-4000-8000-000000000022', 'auto_reject_min_risk_score', '80', '80', 'Auto-Reject Min Risk Score', 'الحد الأدنى لدرجة المخاطر للرفض التلقائي', 'Cases with risk score at or above this value are auto-rejected.', 'الحالات التي تبلغ درجة مخاطرها هذه القيمة أو أكثر تُرفض تلقائياً.', 'auto_reject', 'number', 50, 100, 'points', 0, 1);

INSERT OR IGNORE INTO SystemConfig (id, configKey, configValue, defaultValue, labelEN, labelAR, descriptionEN, descriptionAR, category, valueType, min, max, unit, isPublic, isActive)
VALUES ('c1b2c3d4-0023-4000-8000-000000000023', 'auto_reject_min_delay_days', '365', '365', 'Auto-Reject Delay Days Threshold', 'عتبة أيام التأخير للرفض التلقائي', 'Cases with delay days exceeding this value may be auto-rejected.', 'الحالات التي تتجاوز أيام تأخيرها هذه القيمة قد تُرفض تلقائياً.', 'auto_reject', 'number', 90, 1825, 'days', 0, 1);

INSERT OR IGNORE INTO SystemConfig (id, configKey, configValue, defaultValue, labelEN, labelAR, descriptionEN, descriptionAR, category, valueType, min, max, unit, isPublic, isActive)
VALUES ('c1b2c3d4-0024-4000-8000-000000000024', 'auto_reject_non_citizen', 'true', 'true', 'Auto-Reject Non-Citizens', 'الرفض التلقائي لغير المواطنين', 'If enabled, non-UAE citizens are automatically rejected.', 'إذا تم التمكين، يتم رفض غير مواطني الإمارات تلقائياً.', 'auto_reject', 'boolean', NULL, NULL, NULL, 0, 1);

-- ── Human Review ────────────────────────────────────────────────
INSERT OR IGNORE INTO SystemConfig (id, configKey, configValue, defaultValue, labelEN, labelAR, descriptionEN, descriptionAR, category, valueType, min, max, unit, isPublic, isActive)
VALUES ('c1b2c3d4-0025-4000-8000-000000000025', 'human_review_risk_threshold', '50', '50', 'Human Review Risk Threshold', 'عتبة المخاطر للمراجعة البشرية', 'Cases with risk score above this value require human review.', 'الحالات التي تتجاوز درجة مخاطرها هذه القيمة تتطلب مراجعة بشرية.', 'human_review', 'number', 0, 100, 'points', 0, 1);

INSERT OR IGNORE INTO SystemConfig (id, configKey, configValue, defaultValue, labelEN, labelAR, descriptionEN, descriptionAR, category, valueType, min, max, unit, isPublic, isActive)
VALUES ('c1b2c3d4-0026-4000-8000-000000000026', 'human_review_dbr_threshold', '0.5', '0.5', 'Human Review DBR Threshold', 'عتبة نسبة عبء الدين للمراجعة البشرية', 'Cases with proposed DBR above this value require human review.', 'الحالات التي تتجاوز نسبة عبء الدين المقترحة هذه القيمة تتطلب مراجعة بشرية.', 'human_review', 'number', 0.2, 0.8, '%', 0, 1);

INSERT OR IGNORE INTO SystemConfig (id, configKey, configValue, defaultValue, labelEN, labelAR, descriptionEN, descriptionAR, category, valueType, min, max, unit, isPublic, isActive)
VALUES ('c1b2c3d4-0027-4000-8000-000000000027', 'human_review_delay_days', '180', '180', 'Human Review Delay Days', 'أيام التأخير للمراجعة البشرية', 'Cases with delay days above this value require human review.', 'الحالات التي تتجاوز أيام تأخيرها هذه القيمة تتطلب مراجعة بشرية.', 'human_review', 'number', 30, 730, 'days', 0, 1);

INSERT OR IGNORE INTO SystemConfig (id, configKey, configValue, defaultValue, labelEN, labelAR, descriptionEN, descriptionAR, category, valueType, min, max, unit, isPublic, isActive)
VALUES ('c1b2c3d4-0028-4000-8000-000000000028', 'human_review_estimated_days', '14', '14', 'Estimated Review Days', 'أيام المراجعة المقدرة', 'Estimated number of business days for human review.', 'العدد المقدر من أيام العمل للمراجعة البشرية.', 'human_review', 'number', 1, 60, 'days', 0, 1);

-- ── Employer Risk Weights ───────────────────────────────────────
INSERT OR IGNORE INTO SystemConfig (id, configKey, configValue, defaultValue, labelEN, labelAR, descriptionEN, descriptionAR, category, valueType, min, max, unit, isPublic, isActive)
VALUES ('c1b2c3d4-0029-4000-8000-000000000029', 'employer_weight_government', '0.8', '0.8', 'Government Employee Risk Weight', 'معامل مخاطر الموظف الحكومي', 'Risk multiplier for government employees. Below 1.0 = favorable (lower risk).', 'معامل المخاطر للموظفين الحكوميين. أقل من 1.0 = مؤاتي (مخاطر أقل).', 'employer_weights', 'number', 0.1, 2.0, '×', 0, 1);

INSERT OR IGNORE INTO SystemConfig (id, configKey, configValue, defaultValue, labelEN, labelAR, descriptionEN, descriptionAR, category, valueType, min, max, unit, isPublic, isActive)
VALUES ('c1b2c3d4-0030-4000-8000-000000000030', 'employer_weight_semi_government', '1.0', '1.0', 'Semi-Government Employee Risk Weight', 'معامل مخاطر الموظف شبه الحكومي', 'Risk multiplier for semi-government employees. 1.0 = neutral.', 'معامل المخاطر للموظفين شبه الحكوميين. 1.0 = محايد.', 'employer_weights', 'number', 0.1, 2.0, '×', 0, 1);

INSERT OR IGNORE INTO SystemConfig (id, configKey, configValue, defaultValue, labelEN, labelAR, descriptionEN, descriptionAR, category, valueType, min, max, unit, isPublic, isActive)
VALUES ('c1b2c3d4-0031-4000-8000-000000000031', 'employer_weight_private', '1.3', '1.3', 'Private Sector Employee Risk Weight', 'معامل مخاطر موظف القطاع الخاص', 'Risk multiplier for private sector employees. Above 1.0 = higher risk.', 'معامل المخاطر لموظفي القطاع الخاص. أعلى من 1.0 = مخاطر أعلى.', 'employer_weights', 'number', 0.1, 3.0, '×', 0, 1);

-- ── Grace Period ────────────────────────────────────────────────
INSERT OR IGNORE INTO SystemConfig (id, configKey, configValue, defaultValue, labelEN, labelAR, descriptionEN, descriptionAR, category, valueType, min, max, unit, isPublic, isActive)
VALUES ('c1b2c3d4-0032-4000-8000-000000000032', 'max_grace_period_months', '6', '6', 'Maximum Grace Period (months)', 'الحد الأقصى لفترة السماح (شهر)', 'Maximum grace period allowed before rescheduled payments begin.', 'الحد الأقصى لفترة السماح المسموح بها قبل بدء الأقساط المعاد جدولتها.', 'grace_period', 'number', 0, 24, 'months', 0, 1);

INSERT OR IGNORE INTO SystemConfig (id, configKey, configValue, defaultValue, labelEN, labelAR, descriptionEN, descriptionAR, category, valueType, min, max, unit, isPublic, isActive)
VALUES ('c1b2c3d4-0033-4000-8000-000000000033', 'grace_period_for_medical', '3', '3', 'Grace Period for Medical Cases', 'فترة السماح للحالات الطبية', 'Default grace period for medical hardship cases.', 'فترة السماح الافتراضية لحالات الطوارئ الطبية.', 'grace_period', 'number', 0, 12, 'months', 0, 1);

INSERT OR IGNORE INTO SystemConfig (id, configKey, configValue, defaultValue, labelEN, labelAR, descriptionEN, descriptionAR, category, valueType, min, max, unit, isPublic, isActive)
VALUES ('c1b2c3d4-0034-4000-8000-000000000034', 'grace_period_for_divorce', '3', '3', 'Grace Period for Divorce Cases', 'فترة السماح لحالات الطلاق', 'Default grace period for divorce cases.', 'فترة السماح الافتراضية لحالات الطلاق.', 'grace_period', 'number', 0, 12, 'months', 0, 1);

-- ── Delay Classification ────────────────────────────────────────
INSERT OR IGNORE INTO SystemConfig (id, configKey, configValue, defaultValue, labelEN, labelAR, descriptionEN, descriptionAR, category, valueType, min, max, unit, isPublic, isActive)
VALUES ('c1b2c3d4-0035-4000-8000-000000000035', 'delay_low_risk_days', '90', '90', 'Low Risk Delay Threshold (days)', 'عتبة التأخير المنخفض المخاطر (يوم)', 'Delay days up to this value classified as lower risk.', 'أيام التأخير حتى هذه القيمة مصنفة كمخاطر أقل.', 'risk_thresholds', 'number', 1, 365, 'days', 0, 1);

INSERT OR IGNORE INTO SystemConfig (id, configKey, configValue, defaultValue, labelEN, labelAR, descriptionEN, descriptionAR, category, valueType, min, max, unit, isPublic, isActive)
VALUES ('c1b2c3d4-0036-4000-8000-000000000036', 'delay_high_risk_days', '180', '180', 'High Risk Delay Threshold (days)', 'عتبة التأخير عالي المخاطر (يوم)', 'Delay days exceeding this value classified as HIGH RISK.', 'أيام التأخير التي تتجاوز هذه القيمة مصنفة كمخاطر عالية.', 'risk_thresholds', 'number', 30, 730, 'days', 0, 1);

INSERT OR IGNORE INTO SystemConfig (id, configKey, configValue, defaultValue, labelEN, labelAR, descriptionEN, descriptionAR, category, valueType, min, max, unit, isPublic, isActive)
VALUES ('c1b2c3d4-0037-4000-8000-000000000037', 'delay_severe_days', '365', '365', 'Severe Distress Delay (days)', 'تأخير الضائقة الشديدة (يوم)', 'Delay days exceeding this value indicate severe financial distress.', 'أيام التأخير التي تتجاوز هذه القيمة تشير إلى ضائقة مالية شديدة.', 'risk_thresholds', 'number', 90, 1825, 'days', 0, 1);

-- ── Landing Page Metrics ────────────────────────────────────────
INSERT OR IGNORE INTO SystemConfig (id, configKey, configValue, defaultValue, labelEN, labelAR, descriptionEN, descriptionAR, category, valueType, min, max, unit, isPublic, isActive)
VALUES ('c1b2c3d4-0038-4000-8000-000000000038', 'landing_automation_rate', '85', '85', 'Automation Rate (%)', 'معدل الأتمتة (%)', 'Percentage shown on the landing page for automation rate metric.', 'النسبة المئوية المعروضة في الصفحة الرئيسية لمعدل الأتمتة.', 'landing_metrics', 'number', 0, 100, '%', 1, 1);

INSERT OR IGNORE INTO SystemConfig (id, configKey, configValue, defaultValue, labelEN, labelAR, descriptionEN, descriptionAR, category, valueType, min, max, unit, isPublic, isActive)
VALUES ('c1b2c3d4-0039-4000-8000-000000000039', 'landing_assessment_time', '30', '30', 'Assessment Time (seconds)', 'وقت التقييم (ثانية)', 'Assessment time in seconds shown on the landing page.', 'وقت التقييم بالثواني المعروض في الصفحة الرئيسية.', 'landing_metrics', 'number', 1, 300, 'seconds', 1, 1);

INSERT OR IGNORE INTO SystemConfig (id, configKey, configValue, defaultValue, labelEN, labelAR, descriptionEN, descriptionAR, category, valueType, min, max, unit, isPublic, isActive)
VALUES ('c1b2c3d4-0040-4000-8000-000000000040', 'landing_compliance_rate', '100', '100', 'Compliance Rate (%)', 'معدل الامتثال (%)', 'Compliance percentage shown on the landing page.', 'نسبة الامتثال المعروضة في الصفحة الرئيسية.', 'landing_metrics', 'number', 0, 100, '%', 1, 1);

-- ── Documents & Upload ──────────────────────────────────────────
INSERT OR IGNORE INTO SystemConfig (id, configKey, configValue, defaultValue, labelEN, labelAR, descriptionEN, descriptionAR, category, valueType, min, max, unit, isPublic, isActive)
VALUES ('c1b2c3d4-0041-4000-8000-000000000041', 'max_file_upload_size_mb', '10', '10', 'Max File Upload Size (MB)', 'الحد الأقصى لحجم الملف (ميجابايت)', 'Maximum file size allowed for document uploads in megabytes.', 'الحد الأقصى لحجم الملف المسموح به لرفع المستندات بالميجابايت.', 'documents', 'number', 1, 50, 'MB', 0, 1);

-- ── System Branding ─────────────────────────────────────────────
INSERT OR IGNORE INTO SystemConfig (id, configKey, configValue, defaultValue, labelEN, labelAR, descriptionEN, descriptionAR, category, valueType, min, max, unit, isPublic, isActive)
VALUES ('c1b2c3d4-0042-4000-8000-000000000042', 'system_version', '9.0.0', '9.0.0', 'System Version', 'إصدار النظام', 'Current system version displayed in the footer.', 'إصدار النظام الحالي المعروض في التذييل.', 'branding', 'string', NULL, NULL, NULL, 1, 1);


-- ═══════════════════════════════════════════════════════════════════════
-- 4. FORM FIELDS (with validation rules and AI prompts)
-- ═══════════════════════════════════════════════════════════════════════

-- ── Personal Section ─────────────────────────────────────────────

INSERT OR IGNORE INTO FormField (id, labelEN, labelAR, fieldKey, fieldType, placeholderEN, placeholderAR, helpTextEN, helpTextAR, section, required, "order", validation, ruleDescriptionEN, ruleDescriptionAR, options, showRule, aiAutoValidate, aiValidationPrompt, isVisible, isActive)
VALUES (
  'd1b2c3d4-0001-4000-8000-000000000001',
  'Emirates ID', 'رقم الهوية', 'emiratesId', 'text',
  '784-1990-1234567-1', '784-1990-1234567-1',
  'Auto-formatted: 784-XXXX-XXXXXXX-X', 'تنسيق تلقائي: 784-XXXX-XXXXXXX-X',
  'personal', 1, 1,
  '{"regex":"^784-\\d{4}-\\d{7}-\\d{1}$","customMessage":"Emirates ID must follow format 784-XXXX-XXXXXXX-X","customMessageAr":"يجب أن يتبع رقم الهوية التنسيق 784-XXXX-XXXXXXX-X"}',
  'Must be a valid 15-digit UAE Emirates ID in format 784-XXXX-XXXXXXX-X',
  'يجب أن يكون رقم هوية إماراتي صحيح مكون من 15 رقماً بالتنسيق 784-XXXX-XXXXXXX-X',
  '[]', 1, 1,
  'Verify this is a valid UAE Emirates ID in the format 784-XXXX-XXXXXXX-X. The ID must start with 784 (UAE country code) and match the standard 15-digit format with hyphens. If UAE PASS data is available, confirm the Emirates ID matches the authenticated identity. Flag any ID that does not follow the correct format or appears to be fabricated.',
  1, 1
);

INSERT OR IGNORE INTO FormField (id, labelEN, labelAR, fieldKey, fieldType, placeholderEN, placeholderAR, helpTextEN, helpTextAR, section, required, "order", validation, ruleDescriptionEN, ruleDescriptionAR, options, showRule, aiAutoValidate, aiValidationPrompt, isVisible, isActive)
VALUES (
  'd1b2c3d4-0002-4000-8000-000000000002',
  'Full Name (English)', 'الاسم الكامل (بالإنجليزية)', 'nameEn', 'text',
  'Mohammed Ahmed Al Maktoum', 'Mohammed Ahmed Al Maktoum',
  NULL, NULL,
  'personal', 0, 2,
  '{"regex":"^[A-Za-z\\s\\-]+$","minLength":2,"maxLength":100,"customMessage":"English name must contain only English letters","customMessageAr":"يجب أن يحتوي الاسم بالإنجليزية على حروف إنجليزية فقط"}',
  'English letters only, 2-100 characters',
  'حروف إنجليزية فقط، 2-100 حرف',
  '[]', 1, 1,
  'Verify the English name is written using only English/Latin letters and spaces. If UAE PASS data is available, confirm the name exactly matches the authenticated profile. The name should follow standard UAE naming conventions (First Father Grandfather Family). Flag if the name contains numbers, special characters, or does not match UAE PASS records.',
  1, 1
);

INSERT OR IGNORE INTO FormField (id, labelEN, labelAR, fieldKey, fieldType, placeholderEN, placeholderAR, helpTextEN, helpTextAR, section, required, "order", validation, ruleDescriptionEN, ruleDescriptionAR, options, showRule, aiAutoValidate, aiValidationPrompt, isVisible, isActive)
VALUES (
  'd1b2c3d4-0003-4000-8000-000000000003',
  'Full Name (Arabic)', 'الاسم الكامل (بالعربية)', 'nameAr', 'text',
  'محمد أحمد المكتوم', 'محمد أحمد المكتوم',
  NULL, NULL,
  'personal', 1, 3,
  '{"regex":"^[\\u0600-\\u06FF\\s\\-]+$","minLength":2,"maxLength":100,"customMessage":"Arabic name must contain only Arabic letters","customMessageAr":"يجب أن يحتوي الاسم بالعربية على حروف عربية فقط"}',
  'Arabic letters only, 2-100 characters',
  'حروف عربية فقط، 2-100 حرف',
  '[]', 1, 1,
  'Verify the Arabic name is written using only Arabic letters and spaces. If UAE PASS data is available, confirm the Arabic name exactly matches the authenticated profile. The name should follow standard UAE Arabic naming conventions. Flag if the name contains non-Arabic characters or does not match UAE PASS records.',
  1, 1
);

INSERT OR IGNORE INTO FormField (id, labelEN, labelAR, fieldKey, fieldType, placeholderEN, placeholderAR, helpTextEN, helpTextAR, section, required, "order", validation, ruleDescriptionEN, ruleDescriptionAR, options, showRule, aiAutoValidate, aiValidationPrompt, isVisible, isActive)
VALUES (
  'd1b2c3d4-0004-4000-8000-000000000004',
  'Phone Number', 'رقم الهاتف', 'phone', 'text',
  '05XXXXXXXX', '05XXXXXXXX',
  'Auto-formatted to 05XXXXXXXX', 'تنسيق تلقائي إلى 05XXXXXXXX',
  'personal', 1, 4,
  '{"regex":"^05[0-9]{8}$","minLength":10,"maxLength":10,"customMessage":"Must be a valid UAE mobile number (05XXXXXXXX)","customMessageAr":"يجب أن يكون رقم هاتف إماراتي صحيح (05XXXXXXXX)"}',
  'Must be a valid UAE mobile number starting with 05 (10 digits)',
  'يجب أن يكون رقم هاتف إماراتي صحيح يبدأ بـ 05 (10 أرقام)',
  '[]', 1, 1,
  'Verify this is a valid UAE mobile phone number. It must start with 05 followed by 8 digits (total 10 digits). Valid UAE mobile prefixes include 050, 052, 054, 055, 056, 058. Flag any number that does not follow this format or uses an invalid prefix.',
  1, 1
);

INSERT OR IGNORE INTO FormField (id, labelEN, labelAR, fieldKey, fieldType, placeholderEN, placeholderAR, helpTextEN, helpTextAR, section, required, "order", validation, ruleDescriptionEN, ruleDescriptionAR, options, showRule, aiAutoValidate, aiValidationPrompt, isVisible, isActive)
VALUES (
  'd1b2c3d4-0005-4000-8000-000000000005',
  'Email (Optional)', 'البريد الإلكتروني (اختياري)', 'email', 'text',
  'applicant@example.com', 'applicant@example.com',
  NULL, NULL,
  'personal', 0, 5,
  '{"regex":"^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$","customMessage":"Must be a valid email address","customMessageAr":"يجب أن يكون عنوان بريد إلكتروني صحيح"}',
  'Valid email format (optional)',
  'تنسيق بريد إلكتروني صحيح (اختياري)',
  '[]', 1, 1,
  'Verify the email address follows a valid format (user@domain.ext). If provided, check for common UAE email patterns (.ae, .gov.ae domains for government employees). This field is optional, so empty values are acceptable. Flag clearly invalid formats like missing @ sign or domain.',
  1, 1
);

INSERT OR IGNORE INTO FormField (id, labelEN, labelAR, fieldKey, fieldType, placeholderEN, placeholderAR, helpTextEN, helpTextAR, section, required, "order", validation, ruleDescriptionEN, ruleDescriptionAR, options, showRule, aiAutoValidate, aiValidationPrompt, isVisible, isActive)
VALUES (
  'd1b2c3d4-0006-4000-8000-000000000006',
  'Monthly Income (AED)', 'الدخل الشهري (درهم)', 'monthlyIncome', 'number',
  '25000', '25000',
  NULL, NULL,
  'personal', 1, 6,
  '{"min":0,"max":500000,"customMessage":"Monthly income must be between AED 0 and 500,000","customMessageAr":"يجب أن يكون الدخل الشهري بين 0 و 500,000 درهم"}',
  'Minimum AED 0, maximum AED 500,000',
  'الحد الأدنى 0 درهم، الحد الأقصى 500,000 درهم',
  '[]', 1, 1,
  'Verify the monthly income is realistic for the stated employer type in the UAE. Government employees typically earn AED 8,000-80,000+. Semi-government: AED 6,000-60,000+. Private sector: AED 3,000-100,000+. Flag any income that seems inconsistent with the employer type or is unreasonably low/high.',
  1, 1
);

INSERT OR IGNORE INTO FormField (id, labelEN, labelAR, fieldKey, fieldType, placeholderEN, placeholderAR, helpTextEN, helpTextAR, section, required, "order", validation, ruleDescriptionEN, ruleDescriptionAR, options, showRule, aiAutoValidate, aiValidationPrompt, isVisible, isActive)
VALUES (
  'd1b2c3d4-0007-4000-8000-000000000007',
  'Employer', 'جهة العمل', 'employer', 'text',
  'Government Entity Name', 'اسم الجهة الحكومية',
  NULL, NULL,
  'personal', 0, 7,
  '{"minLength":2,"maxLength":200}',
  'Employer name, 2-200 characters',
  'اسم جهة العمل، 2-200 حرف',
  '[]', 0, 0,
  NULL,
  1, 1
);

INSERT OR IGNORE INTO FormField (id, labelEN, labelAR, fieldKey, fieldType, placeholderEN, placeholderAR, helpTextEN, helpTextAR, section, required, "order", validation, ruleDescriptionEN, ruleDescriptionAR, options, showRule, aiAutoValidate, aiValidationPrompt, isVisible, isActive)
VALUES (
  'd1b2c3d4-0008-4000-8000-000000000008',
  'Employer Type', 'نوع جهة العمل', 'employerType', 'select',
  'Select employer type', 'اختر نوع جهة العمل',
  NULL, NULL,
  'personal', 1, 8,
  '{}',
  'Must be one of: government, semi-government, private',
  'يجب أن يكون أحد: حكومي، شبه حكومي، قطاع خاص',
  '["government","semi-government","private"]', 1, 1,
  'Verify the employer type matches the stated employer name. Government entities should be marked as government, government-owned companies as semi-government, and private companies as private. Cross-check with the employer name if provided.',
  1, 1
);

INSERT OR IGNORE INTO FormField (id, labelEN, labelAR, fieldKey, fieldType, placeholderEN, placeholderAR, helpTextEN, helpTextAR, section, required, "order", validation, ruleDescriptionEN, ruleDescriptionAR, options, showRule, aiAutoValidate, aiValidationPrompt, isVisible, isActive)
VALUES (
  'd1b2c3d4-0009-4000-8000-000000000009',
  'Family Size', 'حجم الأسرة', 'familySize', 'number',
  '4', '4',
  'Including applicant', 'بما في ذلك مقدم الطلب',
  'personal', 1, 9,
  '{"min":1,"max":20}',
  'Minimum 1, maximum 20',
  'الحد الأدنى 1، الحد الأقصى 20',
  '[]', 1, 0,
  NULL,
  1, 1
);

INSERT OR IGNORE INTO FormField (id, labelEN, labelAR, fieldKey, fieldType, placeholderEN, placeholderAR, helpTextEN, helpTextAR, section, required, "order", validation, ruleDescriptionEN, ruleDescriptionAR, options, showRule, aiAutoValidate, aiValidationPrompt, isVisible, isActive)
VALUES (
  'd1b2c3d4-0010-4000-8000-000000000010',
  'Has Family Book', 'لديه دفتر العائلة', 'hasFamilyBook', 'select',
  'Yes / No', 'نعم / لا',
  'Khulasat Al Qaid', 'خلاصة القيد',
  'personal', 1, 10,
  '{}',
  'Required for housing assistance eligibility',
  'مطلوب لأهلية المساعدة الإسكانية',
  '["true","false"]', 1, 0,
  NULL,
  1, 1
);

-- ── Loan Section ─────────────────────────────────────────────────

INSERT OR IGNORE INTO FormField (id, labelEN, labelAR, fieldKey, fieldType, placeholderEN, placeholderAR, helpTextEN, helpTextAR, section, required, "order", validation, ruleDescriptionEN, ruleDescriptionAR, options, showRule, aiAutoValidate, aiValidationPrompt, isVisible, isActive)
VALUES (
  'd1b2c3d4-0011-4000-8000-000000000011',
  'Original Loan Amount (AED)', 'مبلغ القرض الأصلي (درهم)', 'originalAmount', 'number',
  '500000', '500000',
  NULL, NULL,
  'loan', 1, 1,
  '{"min":0}',
  'Must be a positive number',
  'يجب أن يكون رقماً موجباً',
  '[]', 1, 0,
  NULL,
  1, 1
);

INSERT OR IGNORE INTO FormField (id, labelEN, labelAR, fieldKey, fieldType, placeholderEN, placeholderAR, helpTextEN, helpTextAR, section, required, "order", validation, ruleDescriptionEN, ruleDescriptionAR, options, showRule, aiAutoValidate, aiValidationPrompt, isVisible, isActive)
VALUES (
  'd1b2c3d4-0012-4000-8000-000000000012',
  'Remaining Balance (AED)', 'الرصيد المتبقي (درهم)', 'remainingBalance', 'number',
  '350000', '350000',
  NULL, NULL,
  'loan', 1, 2,
  '{"min":0}',
  'Must be a positive number',
  'يجب أن يكون رقماً موجباً',
  '[]', 1, 0,
  NULL,
  1, 1
);

INSERT OR IGNORE INTO FormField (id, labelEN, labelAR, fieldKey, fieldType, placeholderEN, placeholderAR, helpTextEN, helpTextAR, section, required, "order", validation, ruleDescriptionEN, ruleDescriptionAR, options, showRule, aiAutoValidate, aiValidationPrompt, isVisible, isActive)
VALUES (
  'd1b2c3d4-0013-4000-8000-000000000013',
  'Monthly Installment (AED)', 'القسط الشهري (درهم)', 'monthlyInstallment', 'number',
  '5000', '5000',
  NULL, NULL,
  'loan', 1, 3,
  '{"min":0}',
  'Must be a positive number',
  'يجب أن يكون رقماً موجباً',
  '[]', 1, 1,
  'Verify the monthly installment is consistent with the loan amount, remaining balance, and duration. For housing loans, the installment should typically be between 1% and 5% of the original amount per month. Flag any installment that seems disproportionately high or low relative to the loan parameters.',
  1, 1
);

INSERT OR IGNORE INTO FormField (id, labelEN, labelAR, fieldKey, fieldType, placeholderEN, placeholderAR, helpTextEN, helpTextAR, section, required, "order", validation, ruleDescriptionEN, ruleDescriptionAR, options, showRule, aiAutoValidate, aiValidationPrompt, isVisible, isActive)
VALUES (
  'd1b2c3d4-0014-4000-8000-000000000014',
  'Loan Duration (months)', 'مدة القرض (شهر)', 'loanDurationMonths', 'number',
  '240', '240',
  NULL, NULL,
  'loan', 1, 4,
  '{"min":1,"max":600}',
  'Minimum 1, maximum 600 months',
  'الحد الأدنى 1، الحد الأقصى 600 شهر',
  '[]', 1, 0,
  NULL,
  1, 1
);

INSERT OR IGNORE INTO FormField (id, labelEN, labelAR, fieldKey, fieldType, placeholderEN, placeholderAR, helpTextEN, helpTextAR, section, required, "order", validation, ruleDescriptionEN, ruleDescriptionAR, options, showRule, aiAutoValidate, aiValidationPrompt, isVisible, isActive)
VALUES (
  'd1b2c3d4-0015-4000-8000-000000000015',
  'Elapsed Months', 'الأشهر المنقضية', 'elapsedMonths', 'number',
  '60', '60',
  'Months since loan disbursement', 'الأشهر منذ صرف القرض',
  'loan', 1, 5,
  '{"min":0}',
  'Must be 0 or more',
  'يجب أن يكون 0 أو أكثر',
  '[]', 1, 0,
  NULL,
  1, 1
);

INSERT OR IGNORE INTO FormField (id, labelEN, labelAR, fieldKey, fieldType, placeholderEN, placeholderAR, helpTextEN, helpTextAR, section, required, "order", validation, ruleDescriptionEN, ruleDescriptionAR, options, showRule, aiAutoValidate, aiValidationPrompt, isVisible, isActive)
VALUES (
  'd1b2c3d4-0016-4000-8000-000000000016',
  'Loan Type', 'نوع القرض', 'loanType', 'select',
  'Select loan type', 'اختر نوع القرض',
  NULL, NULL,
  'loan', 1, 6,
  '{}',
  'Must be a valid loan type',
  'يجب أن يكون نوع قرض صالح',
  '["loan","grant","maintenance"]', 1, 0,
  NULL,
  1, 1
);

-- ── Arrear Section ───────────────────────────────────────────────

INSERT OR IGNORE INTO FormField (id, labelEN, labelAR, fieldKey, fieldType, placeholderEN, placeholderAR, helpTextEN, helpTextAR, section, required, "order", validation, ruleDescriptionEN, ruleDescriptionAR, options, showRule, aiAutoValidate, aiValidationPrompt, isVisible, isActive)
VALUES (
  'd1b2c3d4-0017-4000-8000-000000000017',
  'Total Overdue (AED)', 'إجمالي المتأخرات (درهم)', 'totalOverdue', 'number',
  '15000', '15000',
  NULL, NULL,
  'arrear', 1, 1,
  '{"min":0}',
  'Must be a positive number',
  'يجب أن يكون رقماً موجباً',
  '[]', 1, 1,
  'Verify the total overdue amount is consistent with the missed months and monthly installment. Total overdue should typically be close to missedMonths × monthlyInstallment, possibly with penalties. Flag if the overdue amount seems inconsistent.',
  1, 1
);

INSERT OR IGNORE INTO FormField (id, labelEN, labelAR, fieldKey, fieldType, placeholderEN, placeholderAR, helpTextEN, helpTextAR, section, required, "order", validation, ruleDescriptionEN, ruleDescriptionAR, options, showRule, aiAutoValidate, aiValidationPrompt, isVisible, isActive)
VALUES (
  'd1b2c3d4-0018-4000-8000-000000000018',
  'Missed Months', 'الأشهر المتأخرة', 'missedMonths', 'number',
  '3', '3',
  NULL, NULL,
  'arrear', 1, 2,
  '{"min":1}',
  'At least 1 missed month',
  'شهر متأخر واحد على الأقل',
  '[]', 1, 0,
  NULL,
  1, 1
);

INSERT OR IGNORE INTO FormField (id, labelEN, labelAR, fieldKey, fieldType, placeholderEN, placeholderAR, helpTextEN, helpTextAR, section, required, "order", validation, ruleDescriptionEN, ruleDescriptionAR, options, showRule, aiAutoValidate, aiValidationPrompt, isVisible, isActive)
VALUES (
  'd1b2c3d4-0019-4000-8000-000000000019',
  'Delay Days', 'أيام التأخير', 'delayDays', 'number',
  '90', '90',
  'Days since first missed payment', 'أيام منذ أول دفعة متأخرة',
  'arrear', 1, 3,
  '{"min":1}',
  'At least 1 day',
  'يوم واحد على الأقل',
  '[]', 1, 1,
  'Verify the delay days are consistent with the missed months. Delay days should be roughly proportional to missed months (approximately 30 days per missed month). Flag significant discrepancies between delay days and missed months.',
  1, 1
);

-- ── Request Section ──────────────────────────────────────────────

INSERT OR IGNORE INTO FormField (id, labelEN, labelAR, fieldKey, fieldType, placeholderEN, placeholderAR, helpTextEN, helpTextAR, section, required, "order", validation, ruleDescriptionEN, ruleDescriptionAR, options, showRule, aiAutoValidate, aiValidationPrompt, isVisible, isActive)
VALUES (
  'd1b2c3d4-0020-4000-8000-000000000020',
  'Reason Category', 'فئة السبب', 'reasonCategory', 'select',
  'Select reason category', 'اختر فئة السبب',
  NULL, NULL,
  'request', 1, 1,
  '{}',
  'Must be a valid reason category',
  'يجب أن تكون فئة سبب صالحة',
  '["job_loss","medical","salary_cut","divorce","retirement","other"]', 1, 1,
  'Verify the reason category matches the detailed reason text. Job loss should correspond to unemployment or termination. Medical should involve health-related financial hardship. Salary cut should show reduced income. Divorce should mention marital status change. Flag if the category and reason text are inconsistent.',
  1, 1
);

INSERT OR IGNORE INTO FormField (id, labelEN, labelAR, fieldKey, fieldType, placeholderEN, placeholderAR, helpTextEN, helpTextAR, section, required, "order", validation, ruleDescriptionEN, ruleDescriptionAR, options, showRule, aiAutoValidate, aiValidationPrompt, isVisible, isActive)
VALUES (
  'd1b2c3d4-0021-4000-8000-000000000021',
  'Detailed Reason', 'السبب التفصيلي', 'reason', 'textarea',
  'Explain your financial hardship...', 'اشرح ضائقك المالية...',
  NULL, NULL,
  'request', 1, 2,
  '{"minLength":10,"maxLength":2000}',
  'Minimum 10 characters, maximum 2000',
  'الحد الأدنى 10 أحرف، الحد الأقصى 2000',
  '[]', 1, 1,
  'Analyze the detailed reason for consistency with the reason category and overall financial situation. Check for plausibility of the stated hardship. Verify that the reason aligns with the applicant''s financial data (e.g., job loss should correlate with income changes, medical reasons should mention healthcare costs).',
  1, 1
);

INSERT OR IGNORE INTO FormField (id, labelEN, labelAR, fieldKey, fieldType, placeholderEN, placeholderAR, helpTextEN, helpTextAR, section, required, "order", validation, ruleDescriptionEN, ruleDescriptionAR, options, showRule, aiAutoValidate, aiValidationPrompt, isVisible, isActive)
VALUES (
  'd1b2c3d4-0022-4000-8000-000000000022',
  'Requested Duration (months)', 'المدة المطلوبة (شهر)', 'requestedDurationMonths', 'number',
  '60', '60',
  'Proposed new loan duration', 'مدة القرض الجديدة المقترحة',
  'request', 1, 3,
  '{"min":12,"max":600}',
  'Minimum 12, maximum 600 months',
  'الحد الأدنى 12، الحد الأقصى 600 شهر',
  '[]', 1, 0,
  NULL,
  1, 1
);

INSERT OR IGNORE INTO FormField (id, labelEN, labelAR, fieldKey, fieldType, placeholderEN, placeholderAR, helpTextEN, helpTextAR, section, required, "order", validation, ruleDescriptionEN, ruleDescriptionAR, options, showRule, aiAutoValidate, aiValidationPrompt, isVisible, isActive)
VALUES (
  'd1b2c3d4-0023-4000-8000-000000000023',
  'Priority', 'الأولوية', 'priority', 'select',
  'Normal', 'عادي',
  NULL, NULL,
  'request', 0, 4,
  '{}',
  'Must be: normal, high, or urgent',
  'يجب أن يكون: عادي، مرتفع، أو عاجل',
  '["normal","high","urgent"]', 1, 0,
  NULL,
  1, 1
);

INSERT OR IGNORE INTO FormField (id, labelEN, labelAR, fieldKey, fieldType, placeholderEN, placeholderAR, helpTextEN, helpTextAR, section, required, "order", validation, ruleDescriptionEN, ruleDescriptionAR, options, showRule, aiAutoValidate, aiValidationPrompt, isVisible, isActive)
VALUES (
  'd1b2c3d4-0024-4000-8000-000000000024',
  'Supporting Documents', 'المستندات الداعمة', 'supportingDocuments', 'file',
  'Upload documents', 'رفع المستندات',
  'PDF, images, or scanned documents', 'ملفات PDF، صور، أو مستندات ممسوحة',
  'request', 0, 5,
  '{}',
  'Optional supporting documentation',
  'وثائق داعمة اختيارية',
  '[]', 0, 0,
  NULL,
  1, 1
);

INSERT OR IGNORE INTO FormField (id, labelEN, labelAR, fieldKey, fieldType, placeholderEN, placeholderAR, helpTextEN, helpTextAR, section, required, "order", validation, ruleDescriptionEN, ruleDescriptionAR, options, showRule, aiAutoValidate, aiValidationPrompt, isVisible, isActive)
VALUES (
  'd1b2c3d4-0025-4000-8000-000000000025',
  'Additional Notes', 'ملاحظات إضافية', 'notes', 'textarea',
  'Any additional information...', 'أي معلومات إضافية...',
  NULL, NULL,
  'request', 0, 6,
  '{"maxLength":5000}',
  'Maximum 5000 characters',
  'الحد الأقصى 5000 حرف',
  '[]', 0, 0,
  NULL,
  1, 1
);

-- ── Cross-Field Validation Rules (virtual fields) ────────────────

INSERT OR IGNORE INTO FormField (id, labelEN, labelAR, fieldKey, fieldType, placeholderEN, placeholderAR, helpTextEN, helpTextAR, section, required, "order", validation, ruleDescriptionEN, ruleDescriptionAR, options, showRule, aiAutoValidate, aiValidationPrompt, isVisible, isActive)
VALUES (
  'd1b2c3d4-0026-4000-8000-000000000026',
  'Cross-Check: Name Match', 'تحقيق متقاطع: تطابق الاسم', 'cross_name_match', 'cross-field',
  NULL, NULL, NULL, NULL,
  'validation', 0, 1,
  '{}',
  'English and Arabic names should refer to the same person',
  'يجب أن يشير الاسم بالإنجليزية والعربية إلى نفس الشخص',
  '[]', 0, 1,
  'Verify that the English name and Arabic name refer to the same person. Check for phonetic similarity and common transliteration patterns (e.g., محمد = Mohammed, أحمد = Ahmed). Flag if the names appear to belong to different people.',
  0, 1
);

INSERT OR IGNORE INTO FormField (id, labelEN, labelAR, fieldKey, fieldType, placeholderEN, placeholderAR, helpTextEN, helpTextAR, section, required, "order", validation, ruleDescriptionEN, ruleDescriptionAR, options, showRule, aiAutoValidate, aiValidationPrompt, isVisible, isActive)
VALUES (
  'd1b2c3d4-0027-4000-8000-000000000027',
  'Cross-Check: Income vs Employer', 'تحقيق متقاطع: الدخل مقابل جهة العمل', 'cross_income_employer', 'cross-field',
  NULL, NULL, NULL, NULL,
  'validation', 0, 2,
  '{}',
  'Monthly income should be realistic for the employer type',
  'يجب أن يكون الدخل الشهري واقعياً لنوع جهة العمل',
  '[]', 0, 1,
  'Cross-validate the monthly income against the employer type. Government employees in UAE typically earn AED 8,000-80,000+. Semi-government: AED 6,000-60,000+. Private sector: AED 3,000-100,000+. Flag significant outliers.',
  0, 1
);

INSERT OR IGNORE INTO FormField (id, labelEN, labelAR, fieldKey, fieldType, placeholderEN, placeholderAR, helpTextEN, helpTextAR, section, required, "order", validation, ruleDescriptionEN, ruleDescriptionAR, options, showRule, aiAutoValidate, aiValidationPrompt, isVisible, isActive)
VALUES (
  'd1b2c3d4-0028-4000-8000-000000000028',
  'Cross-Check: Loan & Arrear Math', 'تحقيق متقاطع: حسابات القرض والمتأخرات', 'cross_loan_arrear_math', 'cross-field',
  NULL, NULL, NULL, NULL,
  'validation', 0, 3,
  '{}',
  'Overdue ≈ missedMonths × monthlyInstallment',
  'المتأخرات ≈ الأشهر المتأخرة × القسط الشهري',
  '[]', 0, 1,
  'Cross-validate that totalOverdue ≈ missedMonths × monthlyInstallment (within reasonable tolerance for penalties/fees). Flag if the overdue amount is more than 2x or less than 0.5x the expected value based on missed payments.',
  0, 1
);

INSERT OR IGNORE INTO FormField (id, labelEN, labelAR, fieldKey, fieldType, placeholderEN, placeholderAR, helpTextEN, helpTextAR, section, required, "order", validation, ruleDescriptionEN, ruleDescriptionAR, options, showRule, aiAutoValidate, aiValidationPrompt, isVisible, isActive)
VALUES (
  'd1b2c3d4-0029-4000-8000-000000000029',
  'Cross-Check: Reason vs Documents', 'تحقيق متقاطع: السبب مقابل المستندات', 'cross_reason_docs', 'cross-field',
  NULL, NULL, NULL, NULL,
  'validation', 0, 4,
  '{}',
  'Medical reasons should have medical documents, etc.',
  'الأسباب الطبية يجب أن تكون معها مستندات طبية، إلخ.',
  '[]', 0, 1,
  'Cross-validate the reason category with the uploaded supporting documents. Medical hardship should have medical reports/bills. Job loss should have termination letter. Divorce should have legal documents. Flag if critical documents are missing for the stated reason.',
  0, 1
);

INSERT OR IGNORE INTO FormField (id, labelEN, labelAR, fieldKey, fieldType, placeholderEN, placeholderAR, helpTextEN, helpTextAR, section, required, "order", validation, ruleDescriptionEN, ruleDescriptionAR, options, showRule, aiAutoValidate, aiValidationPrompt, isVisible, isActive)
VALUES (
  'd1b2c3d4-0030-4000-8000-000000000030',
  'Cross-Check: DBR Feasibility', 'تحقيق متقاطع: جدوى نسبة عبء الدين', 'cross_dbr_feasibility', 'cross-field',
  NULL, NULL, NULL, NULL,
  'validation', 0, 5,
  '{}',
  'Proposed installment must keep DBR below maximum',
  'يجب أن يحافظ القسط المقترح على نسبة عبء الدين أقل من الحد الأقصى',
  '[]', 0, 1,
  'Calculate the proposed Debt Burden Ratio: (monthlyInstallment / monthlyIncome) × 100. Verify it stays below the max_dbr_limit (currently 60%). Also check that the requested duration is sufficient to bring the installment to a feasible level.',
  0, 1
);

INSERT OR IGNORE INTO FormField (id, labelEN, labelAR, fieldKey, fieldType, placeholderEN, placeholderAR, helpTextEN, helpTextAR, section, required, "order", validation, ruleDescriptionEN, ruleDescriptionAR, options, showRule, aiAutoValidate, aiValidationPrompt, isVisible, isActive)
VALUES (
  'd1b2c3d4-0031-4000-8000-000000000031',
  'Cross-Check: Identity vs EID', 'تحقيق متقاطع: الهوية مقابل رقم الهوية', 'cross_identity_eid', 'cross-field',
  NULL, NULL, NULL, NULL,
  'validation', 0, 6,
  '{}',
  'Emirates ID should match the applicant identity',
  'يجب أن يتطابق رقم الهوية مع هوية مقدم الطلب',
  '[]', 0, 1,
  'Cross-validate that the Emirates ID is consistent with the applicant profile. If UAE PASS data is available, verify the EID matches. Check the birth year segment (positions 5-8) is reasonable for an adult applicant. Verify the gender digit matches stated gender.',
  0, 1
);

INSERT OR IGNORE INTO FormField (id, labelEN, labelAR, fieldKey, fieldType, placeholderEN, placeholderAR, helpTextEN, helpTextAR, section, required, "order", validation, ruleDescriptionEN, ruleDescriptionAR, options, showRule, aiAutoValidate, aiValidationPrompt, isVisible, isActive)
VALUES (
  'd1b2c3d4-0032-4000-8000-000000000032',
  'Cross-Check: Family Book vs Size', 'تحقيق متقاطع: دفتر العائلة مقابل حجم الأسرة', 'cross_family_book_size', 'cross-field',
  NULL, NULL, NULL, NULL,
  'validation', 0, 7,
  '{}',
  'Family size should be consistent with family book',
  'يجب أن يكون حجم الأسرة متسقاً مع دفتر العائلة',
  '[]', 0, 1,
  'Cross-validate family size against the family book status. If hasFamilyBook is true, family size should typically be at least 2 (applicant + at least one family member). Very large families (>10) without family book may require additional verification.',
  0, 1
);

INSERT OR IGNORE INTO FormField (id, labelEN, labelAR, fieldKey, fieldType, placeholderEN, placeholderAR, helpTextEN, helpTextAR, section, required, "order", validation, ruleDescriptionEN, ruleDescriptionAR, options, showRule, aiAutoValidate, aiValidationPrompt, isVisible, isActive)
VALUES (
  'd1b2c3d4-0033-4000-8000-000000000033',
  'Cross-Check: Loan Type vs Amount', 'تحقيق متقاطع: نوع القرض مقابل المبلغ', 'cross_loan_type_amount', 'cross-field',
  NULL, NULL, NULL, NULL,
  'validation', 0, 8,
  '{}',
  'Loan amount should be within limits for the loan type',
  'يجب أن يكون مبلغ القرض ضمن الحدود لنوع القرض',
  '[]', 0, 1,
  'Cross-validate the loan amount against the loan type. Housing loans: up to AED 1,500,000. Grants: up to AED 800,000. Maintenance: up to AED 200,000. Flag if the original amount exceeds the limit for the stated loan type.',
  0, 1
);

INSERT OR IGNORE INTO FormField (id, labelEN, labelAR, fieldKey, fieldType, placeholderEN, placeholderAR, helpTextEN, helpTextAR, section, required, "order", validation, ruleDescriptionEN, ruleDescriptionAR, options, showRule, aiAutoValidate, aiValidationPrompt, isVisible, isActive)
VALUES (
  'd1b2c3d4-0034-4000-8000-000000000034',
  'Cross-Check: Priority vs Delay Severity', 'تحقيق متقاطع: الأولوية مقابل شدة التأخير', 'cross_priority_delay_severity', 'cross-field',
  NULL, NULL, NULL, NULL,
  'validation', 0, 9,
  '{}',
  'Priority should reflect delay severity',
  'يجب أن تعكس الأولوية شدة التأخير',
  '[]', 0, 1,
  'Cross-validate the priority level against delay severity. Delay days > 180 with normal priority may be misclassified. Urgent priority should correspond to severe cases (delay > 365 days, or total overdue > AED 100,000). Normal priority with severe delays should be escalated.',
  0, 1
);

INSERT OR IGNORE INTO FormField (id, labelEN, labelAR, fieldKey, fieldType, placeholderEN, placeholderAR, helpTextEN, helpTextAR, section, required, "order", validation, ruleDescriptionEN, ruleDescriptionAR, options, showRule, aiAutoValidate, aiValidationPrompt, isVisible, isActive)
VALUES (
  'd1b2c3d4-0035-4000-8000-000000000035',
  'Cross-Check: Employer vs Income Ratio', 'تحقيق متقاطع: جهة العمل مقابل نسبة الدخل', 'cross_employer_income_ratio', 'cross-field',
  NULL, NULL, NULL, NULL,
  'validation', 0, 10,
  '{}',
  'Deduction rate should be feasible for the employer type',
  'يجب أن تكون نسبة الخصم مجدية لنوع جهة العمل',
  '[]', 0, 1,
  'Cross-validate the deduction rate (monthlyInstallment / monthlyIncome) against employer type. Government employees have stable income, so higher DBR may be tolerable. Private sector employees have higher risk, so stricter DBR limits should apply. Flag if the deduction rate exceeds 50% for private sector or 60% for government.',
  0, 1
);


-- ═══════════════════════════════════════════════════════════════════════
-- END OF SEED DATA
-- ═══════════════════════════════════════════════════════════════════════
