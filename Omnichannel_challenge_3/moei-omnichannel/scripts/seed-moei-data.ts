/**
 * MOEI Service Rules & Mock UAEPass Customer Seed Script
 *
 * Seeds:
 *  1. 13 ServiceRules with mandatory ServiceRuleFields per action type
 *  2. 6 Mock UAEPass customers with rich profile data
 *  3. Cases, Bills, and ServiceRequests for UAE national customers
 *
 * Idempotent: checks for existing data before creating.
 *
 * Run: cd /home/z/my-project && bun run scripts/seed-moei-data.ts
 */

import { db } from '../src/worker/lib/db'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function refNum(prefix: string, num: number): string {
  return `${prefix}-2025-${String(num).padStart(4, '0')}`
}

// ─── 1. Service Rules Definitions ─────────────────────────────────────────────

interface FieldDef {
  fieldKey: string
  labelEn: string
  labelAr: string
  fieldType: string // text, number, email, phone, select, date, file, textarea, id_number
  required: boolean
  forActions: string[]
  placeholderEn?: string
  placeholderAr?: string
  validationEn?: string
  validationAr?: string
  optionsEn?: string   // JSON array string for select fields
  optionsAr?: string   // JSON array string for select fields
  customerProfileKey?: string  // maps to customer profile field: e.g. "emiratesId" → customer.emiratesId
  sortOrder: number
}

interface ActionDef {
  actionType: string      // "CREATE_RECORD", "UPDATE_STATUS", "SEND_EMAIL", "API_CALL"
  endpoint?: string       // for API_CALL
  payloadTemplate?: string // JSON template
  sortOrder: number
}

interface ServiceRuleDef {
  nameEn: string
  nameAr: string
  category: string
  descriptionEn: string
  descriptionAr: string
  feeAmount: string
  feeCurrency: string
  processingTimeEn: string
  processingTimeAr: string
  requiredActions: string[]
  eligibilityEn: string
  eligibilityAr: string
  requiredDocumentsEn: string
  requiredDocumentsAr: string
  priority: string
  slaHours: number
  agentInstructionsEn: string
  agentInstructionsAr: string
  autoResponseEn: string
  autoResponseAr: string
  tags: string[]
  sortOrder: number
  fields: FieldDef[]
  actions?: ActionDef[]
}

// Common reusable field definitions
const EMIRATES_ID_FIELD: FieldDef = {
  fieldKey: 'emiratesId',
  labelEn: 'Emirates ID',
  labelAr: 'رقم الهوية',
  fieldType: 'id_number',
  required: true,
  forActions: [],
  placeholderEn: '784-XXXX-XXXXXXX',
  placeholderAr: '784-XXXX-XXXXXXX',
  validationEn: 'Must be a valid 15-digit Emirates ID',
  validationAr: 'يجب أن يكون رقم هوية إماراتي صالح من 15 رقماً',
  customerProfileKey: 'emiratesId',
  sortOrder: 0,
}

const FULL_NAME_FIELD: FieldDef = {
  fieldKey: 'fullName',
  labelEn: 'Full Name',
  labelAr: 'الاسم الكامل',
  fieldType: 'text',
  required: true,
  forActions: [],
  placeholderEn: 'Enter your full name as on Emirates ID',
  placeholderAr: 'أدخل اسمك الكامل كما في الهوية',
  customerProfileKey: 'nameEn',
  sortOrder: 1,
}

const PHONE_FIELD: FieldDef = {
  fieldKey: 'phone',
  labelEn: 'Phone Number',
  labelAr: 'رقم الهاتف',
  fieldType: 'phone',
  required: true,
  forActions: [],
  placeholderEn: '+971-5X-XXX-XXXX',
  placeholderAr: '+971-5X-XXX-XXXX',
  validationEn: 'Must be a valid UAE phone number',
  validationAr: 'يجب أن يكون رقم هاتف إماراتي صالح',
  customerProfileKey: 'phone',
  sortOrder: 2,
}

const PROPERTY_OWNERSHIP_FIELD: FieldDef = {
  fieldKey: 'propertyOwnership',
  labelEn: 'Property Ownership Deed',
  labelAr: 'صك ملكية العقار',
  fieldType: 'text',
  required: true,
  forActions: [],
  placeholderEn: 'Enter title deed number',
  placeholderAr: 'أدخل رقم صك الملكية',
  customerProfileKey: 'propertyOwned',
  sortOrder: 4,
}

const PROPERTY_TYPE_FIELD: FieldDef = {
  fieldKey: 'propertyType',
  labelEn: 'Property Type',
  labelAr: 'نوع العقار',
  fieldType: 'select',
  required: true,
  forActions: [],
  optionsEn: JSON.stringify(['Residential', 'Commercial', 'Industrial']),
  optionsAr: JSON.stringify(['سكني', 'تجاري', 'صناعي']),
  customerProfileKey: 'propertyType',
  sortOrder: 5,
}

const EMIRATE_FIELD: FieldDef = {
  fieldKey: 'emirate',
  labelEn: 'Emirate',
  labelAr: 'الإمارة',
  fieldType: 'select',
  required: true,
  forActions: [],
  optionsEn: JSON.stringify(['Abu Dhabi', 'Dubai', 'Sharjah', 'Ajman', 'Umm Al Quwain', 'Ras Al Khaimah', 'Fujairah']),
  optionsAr: JSON.stringify(['أبوظبي', 'دبي', 'الشارقة', 'عجمان', 'أم القيوين', 'رأس الخيمة', 'الفجيرة']),
  customerProfileKey: 'emirate',
  sortOrder: 6,
}

const ADDRESS_FIELD: FieldDef = {
  fieldKey: 'address',
  labelEn: 'Property Address',
  labelAr: 'عنوان العقار',
  fieldType: 'textarea',
  required: true,
  forActions: [],
  placeholderEn: 'Enter full property address',
  placeholderAr: 'أدخل عنوان العقار بالكامل',
  customerProfileKey: 'addressEn',
  sortOrder: 7,
}

const FAMILY_BOOK_NUM_FIELD: FieldDef = {
  fieldKey: 'familyBookNum',
  labelEn: 'Family Book Number',
  labelAr: 'رقم دفتر العائلة',
  fieldType: 'text',
  required: true,
  forActions: [],
  placeholderEn: 'Enter family book number',
  placeholderAr: 'أدخل رقم دفتر العائلة',
  customerProfileKey: 'familyBookNum',
  sortOrder: 3,
}

const MONTHLY_INCOME_FIELD: FieldDef = {
  fieldKey: 'monthlyIncome',
  labelEn: 'Monthly Income (AED)',
  labelAr: 'الدخل الشهري (درهم)',
  fieldType: 'number',
  required: true,
  forActions: [],
  placeholderEn: 'Enter monthly income in AED',
  placeholderAr: 'أدخل الدخل الشهري بالدرهم',
  customerProfileKey: 'monthlyIncome',
  sortOrder: 4,
}

const NATIONALITY_FIELD: FieldDef = {
  fieldKey: 'nationality',
  labelEn: 'Nationality',
  labelAr: 'الجنسية',
  fieldType: 'select',
  required: true,
  forActions: [],
  optionsEn: JSON.stringify(['UAE']),
  optionsAr: JSON.stringify(['إماراتي']),
  validationEn: 'Must be UAE national',
  validationAr: 'يجب أن يكون مواطن إماراتي',
  customerProfileKey: 'nationality',
  sortOrder: 3,
}

// Helper to set forActions on a field
function forActions(field: FieldDef, actions: string[]): FieldDef {
  return { ...field, forActions: actions }
}

// ─── 13 Service Rule Definitions ──────────────────────────────────────────────

const serviceRuleDefs: ServiceRuleDef[] = [
  // ─── 1. New Electricity Connection ──────────────────────────────────────────
  {
    nameEn: 'New Electricity Connection',
    nameAr: 'توصيل كهرباء جديد',
    category: 'electricity_water',
    descriptionEn: 'Apply for a new electricity connection for residential, commercial, or industrial properties under MOEI jurisdiction.',
    descriptionAr: 'التقديم على توصيل كهرباء جديد للمنشآت السكنية والتجارية والصناعية ضمن اختصاص وزارة الطاقة والبنية التحتية.',
    feeAmount: '1,500',
    feeCurrency: 'AED',
    processingTimeEn: '3-5 working days',
    processingTimeAr: '3-5 أيام عمل',
    requiredActions: ['add'],
    eligibilityEn: 'Property owners or authorized tenants with valid UAE PASS',
    eligibilityAr: 'أصحاب العقارات أو المستأجرون المعتمدون الحاملون لبطاقة UAE PASS سارية',
    requiredDocumentsEn: 'Emirates ID, Title Deed or Tenancy Contract, NOC from landlord (if tenant)',
    requiredDocumentsAr: 'الهوية الإماراتية، صك الملكية أو عقد الإيجار، عدم ممانعة من المالك (في حال المستأجر)',
    priority: 'medium',
    slaHours: 120,
    agentInstructionsEn: 'Verify property ownership document. Confirm property type and load capacity. Ensure emirate is within MOEI federal jurisdiction (not Dubai or Abu Dhabi if they have their own utility). Collect all mandatory fields before submitting.',
    agentInstructionsAr: 'تحقق من وثيقة ملكية العقار. تأكد من نوع العقار وسعة الحمل. تأكد من أن الإمارة ضمن الاختصاص الاتحادي لوزارة الطاقة والبنية التحتية. اجمع جميع الحقول الإلزامية قبل التقديم.',
    autoResponseEn: 'Your electricity connection application has been received. You will be contacted within 3-5 working days.',
    autoResponseAr: 'تم استلام طلب توصيل الكهرباء. سيتم التواصل معكم خلال 3-5 أيام عمل.',
    tags: ['electricity', 'connection', 'residential', 'commercial'],
    sortOrder: 1,
    fields: [
      forActions(EMIRATES_ID_FIELD, ['add']),
      forActions(FULL_NAME_FIELD, ['add']),
      forActions(PHONE_FIELD, ['add']),
      forActions(PROPERTY_OWNERSHIP_FIELD, ['add']),
      forActions(PROPERTY_TYPE_FIELD, ['add']),
      {
        fieldKey: 'connectionLoad',
        labelEn: 'Load Capacity (kW)',
        labelAr: 'سعة الحمل',
        fieldType: 'number',
        required: true,
        forActions: ['add'],
        placeholderEn: 'Enter load capacity in kilowatts',
        placeholderAr: 'أدخل سعة الحمل بالكيلووات',
        validationEn: 'Must be a positive number',
        validationAr: 'يجب أن يكون رقماً موجباً',
        customerProfileKey: '',
        sortOrder: 8,
      },
      forActions(EMIRATE_FIELD, ['add']),
      forActions(ADDRESS_FIELD, ['add']),
    ],
    actions: [
      { actionType: 'CREATE_RECORD', sortOrder: 0 },
      { actionType: 'SEND_EMAIL', sortOrder: 1 },
    ],
  },

  // ─── 2. Water Connection Application ────────────────────────────────────────
  {
    nameEn: 'Water Connection Application',
    nameAr: 'طلب توصيل مياه',
    category: 'electricity_water',
    descriptionEn: 'Apply for a new water supply connection for residential, commercial, or industrial properties.',
    descriptionAr: 'التقديم على توصيل إمدادات مياه جديد للمنشآت السكنية والتجارية والصناعية.',
    feeAmount: '1,000',
    feeCurrency: 'AED',
    processingTimeEn: '2-5 working days',
    processingTimeAr: '2-5 أيام عمل',
    requiredActions: ['add'],
    eligibilityEn: 'Property owners or authorized tenants with valid UAE PASS',
    eligibilityAr: 'أصحاب العقارات أو المستأجرون المعتمدون الحاملون لبطاقة UAE PASS سارية',
    requiredDocumentsEn: 'Emirates ID, Title Deed or Tenancy Contract, NOC from landlord (if tenant)',
    requiredDocumentsAr: 'الهوية الإماراتية، صك الملكية أو عقد الإيجار، عدم ممانعة من المالك (في حال المستأجر)',
    priority: 'medium',
    slaHours: 120,
    agentInstructionsEn: 'Verify property ownership. Determine expected water usage type. Ensure all mandatory fields are provided before submitting the application.',
    agentInstructionsAr: 'تحقق من ملكية العقار. حدد نوع الاستهلاك المتوقع للمياه. تأكد من توفير جميع الحقول الإلزامية قبل تقديم الطلب.',
    autoResponseEn: 'Your water connection application has been received. You will be contacted within 2-5 working days.',
    autoResponseAr: 'تم استلام طلب توصيل المياه. سيتم التواصل معكم خلال 2-5 أيام عمل.',
    tags: ['water', 'connection', 'residential', 'commercial'],
    sortOrder: 2,
    fields: [
      forActions(EMIRATES_ID_FIELD, ['add']),
      forActions(FULL_NAME_FIELD, ['add']),
      forActions(PHONE_FIELD, ['add']),
      forActions(PROPERTY_OWNERSHIP_FIELD, ['add']),
      forActions(PROPERTY_TYPE_FIELD, ['add']),
      forActions(EMIRATE_FIELD, ['add']),
      forActions(ADDRESS_FIELD, ['add']),
      {
        fieldKey: 'waterUsage',
        labelEn: 'Expected Water Usage',
        labelAr: 'الاستهلاك المتوقع',
        fieldType: 'select',
        required: true,
        forActions: ['add'],
        optionsEn: JSON.stringify(['Residential', 'Commercial', 'Industrial']),
        optionsAr: JSON.stringify(['سكني', 'تجاري', 'صناعي']),
        customerProfileKey: '',
        sortOrder: 8,
      },
    ],
    actions: [
      { actionType: 'CREATE_RECORD', sortOrder: 0 },
      { actionType: 'SEND_EMAIL', sortOrder: 1 },
    ],
  },

  // ─── 3. Bill Payment Inquiry ────────────────────────────────────────────────
  {
    nameEn: 'Bill Payment Inquiry',
    nameAr: 'استعلام دفع الفواتير',
    category: 'electricity_water',
    descriptionEn: 'Inquire about electricity and water bill details, outstanding balance, and payment status.',
    descriptionAr: 'الاستعلام عن تفاصيل فواتير الكهرباء والمياه والرصيد المستحق وحالة الدفع.',
    feeAmount: 'Free',
    feeCurrency: 'AED',
    processingTimeEn: 'Instant',
    processingTimeAr: 'فوري',
    requiredActions: ['search'],
    eligibilityEn: 'Any registered customer with an active account',
    eligibilityAr: 'أي عميل مسجل بحساب نشط',
    requiredDocumentsEn: 'None',
    requiredDocumentsAr: 'لا يوجد',
    priority: 'low',
    slaHours: 1,
    agentInstructionsEn: 'Look up the account using account number and Emirates ID. Provide bill details, amount due, due date, and payment options.',
    agentInstructionsAr: 'ابحث عن الحساب باستخدام رقم الحساب ورقم الهوية. قدم تفاصيل الفاتورة والمبلغ المستحق وتاريخ الاستحقاق وخيارات الدفع.',
    autoResponseEn: 'Please provide your account number and Emirates ID to look up your bill.',
    autoResponseAr: 'يرجى تقديم رقم الحساب ورقم الهوية للاستعلام عن الفاتورة.',
    tags: ['billing', 'payment', 'inquiry'],
    sortOrder: 3,
    fields: [
      {
        fieldKey: 'accountNumber',
        labelEn: 'Account Number',
        labelAr: 'رقم الحساب',
        fieldType: 'text',
        required: true,
        forActions: ['search'],
        placeholderEn: 'Enter your account number',
        placeholderAr: 'أدخل رقم الحساب',
        customerProfileKey: '',
        sortOrder: 0,
      },
      {
        ...EMIRATES_ID_FIELD,
        forActions: ['search'],
        sortOrder: 1,
      },
    ],
    actions: [
      { actionType: 'API_CALL', endpoint: '/api/billing/lookup', sortOrder: 0 },
    ],
  },

  // ─── 4. Electricity/Water Complaint ─────────────────────────────────────────
  {
    nameEn: 'Electricity/Water Complaint',
    nameAr: 'شكوى كهرباء/مياه',
    category: 'electricity_water',
    descriptionEn: 'Submit a complaint related to electricity or water services including billing errors, service outages, meter issues, or quality problems.',
    descriptionAr: 'تقديم شكوى متعلقة بخدمات الكهرباء أو المياه بما في ذلك أخطاء الفواتير أو انقطاع الخدمة أو مشاكل العدادات أو مشاكل الجودة.',
    feeAmount: 'Free',
    feeCurrency: 'AED',
    processingTimeEn: '10 working days',
    processingTimeAr: '10 أيام عمل',
    requiredActions: ['add'],
    eligibilityEn: 'Any customer with an active electricity or water account',
    eligibilityAr: 'أي عميل بحساب كهرباء أو مياه نشط',
    requiredDocumentsEn: 'Emirates ID, relevant supporting documents (photos, previous bills)',
    requiredDocumentsAr: 'الهوية الإماراتية، المستندات الداعمة ذات الصلة (صور، فواتير سابقة)',
    priority: 'high',
    slaHours: 240,
    agentInstructionsEn: 'Classify complaint type accurately. For service outage complaints, check if there is a known outage in the area. For billing errors, verify the bill details. Escalate urgent safety issues immediately.',
    agentInstructionsAr: 'صنف نوع الشكوى بدقة. لشكاوى انقطاع الخدمة، تحقق من وجود انقطاع معروف في المنطقة. لأخطاء الفواتير، تحقق من تفاصيل الفاتورة. قم بتصعيد مشاكل السلامة العاجلة فوراً.',
    autoResponseEn: 'Your complaint has been registered. Our team will investigate and respond within 10 working days.',
    autoResponseAr: 'تم تسجيل شكواكم. سيتحقق فريقنا والرد خلال 10 أيام عمل.',
    tags: ['complaint', 'electricity', 'water', 'billing', 'outage'],
    sortOrder: 4,
    fields: [
      forActions(EMIRATES_ID_FIELD, ['add']),
      forActions(FULL_NAME_FIELD, ['add']),
      forActions(PHONE_FIELD, ['add']),
      {
        fieldKey: 'accountNumber',
        labelEn: 'Account Number',
        labelAr: 'رقم الحساب',
        fieldType: 'text',
        required: true,
        forActions: ['add'],
        placeholderEn: 'Enter your account number',
        placeholderAr: 'أدخل رقم الحساب',
        customerProfileKey: '',
        sortOrder: 3,
      },
      {
        fieldKey: 'complaintType',
        labelEn: 'Complaint Type',
        labelAr: 'نوع الشكوى',
        fieldType: 'select',
        required: true,
        forActions: ['add'],
        optionsEn: JSON.stringify(['Billing Error', 'Service Outage', 'Meter Issue', 'Quality Issue', 'Other']),
        optionsAr: JSON.stringify(['خطأ في الفاتورة', 'انقطاع الخدمة', 'مشكلة العداد', 'مشكلة جودة', 'أخرى']),
        customerProfileKey: '',
        sortOrder: 4,
      },
      {
        fieldKey: 'complaintDescription',
        labelEn: 'Complaint Description',
        labelAr: 'وصف الشكوى',
        fieldType: 'textarea',
        required: true,
        forActions: ['add'],
        placeholderEn: 'Describe your complaint in detail',
        placeholderAr: 'صف شكواك بالتفصيل',
        customerProfileKey: '',
        sortOrder: 5,
      },
    ],
    actions: [
      { actionType: 'CREATE_RECORD', sortOrder: 0 },
      { actionType: 'SEND_EMAIL', sortOrder: 1 },
      { actionType: 'UPDATE_STATUS', sortOrder: 2 },
    ],
  },

  // ─── 5. Track Request Status ────────────────────────────────────────────────
  {
    nameEn: 'Track Request Status',
    nameAr: 'تتبع حالة الطلب',
    category: 'electricity_water',
    descriptionEn: 'Track the status of a submitted service request using a reference number or Emirates ID.',
    descriptionAr: 'تتبع حالة طلب الخدمة المقدم باستخدام الرقم المرجعي أو رقم الهوية.',
    feeAmount: 'Free',
    feeCurrency: 'AED',
    processingTimeEn: 'Instant',
    processingTimeAr: 'فوري',
    requiredActions: ['search'],
    eligibilityEn: 'Any customer who has submitted a service request',
    eligibilityAr: 'أي عميل قدم طلب خدمة',
    requiredDocumentsEn: 'None',
    requiredDocumentsAr: 'لا يوجد',
    priority: 'low',
    slaHours: 1,
    agentInstructionsEn: 'If customer provides reference number, look up directly. If they provide Emirates ID, show all their requests. If neither, ask for one.',
    agentInstructionsAr: 'إذا قدم العميل رقماً مرجعياً، ابحث مباشرة. إذا قدم رقم الهوية، اعرض جميع طلباته. إذا لم يقدم أي منهما، اطلب واحداً.',
    autoResponseEn: 'Please provide your reference number or Emirates ID to track your request.',
    autoResponseAr: 'يرجى تقديم الرقم المرجعي أو رقم الهوية لتتبع طلبك.',
    tags: ['tracking', 'status', 'inquiry'],
    sortOrder: 5,
    fields: [
      {
        fieldKey: 'referenceNumber',
        labelEn: 'Reference Number',
        labelAr: 'الرقم المرجعي',
        fieldType: 'text',
        required: false,
        forActions: ['search'],
        placeholderEn: 'MOEI-XXXX-XXXX-XXXX',
        placeholderAr: 'MOEI-XXXX-XXXX-XXXX',
        validationEn: 'At least one of reference number or Emirates ID is required',
        validationAr: 'مطلوب على الأقل الرقم المرجعي أو رقم الهوية',
        customerProfileKey: '',
        sortOrder: 0,
      },
      {
        ...EMIRATES_ID_FIELD,
        required: false,
        forActions: ['search'],
        validationEn: 'At least one of reference number or Emirates ID is required',
        validationAr: 'مطلوب على الأقل الرقم المرجعي أو رقم الهوية',
        sortOrder: 1,
      },
    ],
    actions: [
      { actionType: 'API_CALL', endpoint: '/api/requests/lookup', sortOrder: 0 },
    ],
  },

  // ─── 6. Sheikh Zayed Housing Program - Grant Application ────────────────────
  {
    nameEn: 'Sheikh Zayed Housing Program - Grant Application',
    nameAr: 'برنامج الشيخ زايد للإسكان - طلب منحة',
    category: 'housing',
    descriptionEn: 'Apply for a housing grant under the Sheikh Zayed Housing Program for UAE nationals.',
    descriptionAr: 'التقديم على منحة إسكان ضمن برنامج الشيخ زايد للإسكان للمواطنين الإماراتيين.',
    feeAmount: 'Free',
    feeCurrency: 'AED',
    processingTimeEn: '30-90 days',
    processingTimeAr: '30-90 يوماً',
    requiredActions: ['add'],
    eligibilityEn: 'UAE nationals only, 21+ years old, income below AED 35,000/month, does not own more than one property',
    eligibilityAr: 'للمواطنين الإماراتيين فقط، 21+ سنة، دخل أقل من 35,000 درهم/شهر، لا يمتلك أكثر من عقار واحد',
    requiredDocumentsEn: 'Emirates ID, Family Book, Salary Certificate, Bank Statements (6 months)',
    requiredDocumentsAr: 'الهوية الإماراتية، دفتر العائلة، شهادة الراتب، كشوفات بنكية (6 أشهر)',
    priority: 'high',
    slaHours: 2160,
    agentInstructionsEn: 'Verify UAE nationality from Emirates ID (784 prefix). Check age requirement (21+). Confirm income is below AED 35,000/month. Verify family book number. Ensure applicant does not already own more than one property.',
    agentInstructionsAr: 'تحقق من الجنسية الإماراتية من الهوية (بادئة 784). تأكد من شرط العمر (21+). تأكد من أن الدخل أقل من 35,000 درهم/شهر. تحقق من رقم دفتر العائلة. تأكد من أن المتقدم لا يمتلك أكثر من عقار واحد.',
    autoResponseEn: 'Your housing grant application has been received. The review process takes 30-90 days. You will be notified of the decision.',
    autoResponseAr: 'تم استلام طلب منحة الإسكان. تستغرق عملية المراجعة 30-90 يوماً. سيتم إبلاغكم بالقرار.',
    tags: ['housing', 'grant', 'SZHP', 'UAE national'],
    sortOrder: 6,
    fields: [
      forActions(EMIRATES_ID_FIELD, ['add']),
      forActions(FULL_NAME_FIELD, ['add']),
      forActions(PHONE_FIELD, ['add']),
      forActions(NATIONALITY_FIELD, ['add']),
      forActions(FAMILY_BOOK_NUM_FIELD, ['add']),
      forActions(MONTHLY_INCOME_FIELD, ['add']),
      {
        fieldKey: 'maritalStatus',
        labelEn: 'Marital Status',
        labelAr: 'الحالة الاجتماعية',
        fieldType: 'select',
        required: true,
        forActions: ['add'],
        optionsEn: JSON.stringify(['Single', 'Married', 'Divorced', 'Widowed']),
        optionsAr: JSON.stringify(['أعزب', 'متزوج', 'مطلق', 'أرمل']),
        customerProfileKey: '',
        sortOrder: 7,
      },
      {
        fieldKey: 'numberOfDependents',
        labelEn: 'Number of Dependents',
        labelAr: 'عدد المعالين',
        fieldType: 'number',
        required: true,
        forActions: ['add'],
        placeholderEn: 'Enter number of dependents',
        placeholderAr: 'أدخل عدد المعالين',
        validationEn: 'Must be 0 or more',
        validationAr: 'يجب أن يكون 0 أو أكثر',
        customerProfileKey: '',
        sortOrder: 8,
      },
      {
        fieldKey: 'currentHousing',
        labelEn: 'Current Housing Status',
        labelAr: 'حالة السكن الحالية',
        fieldType: 'select',
        required: true,
        forActions: ['add'],
        optionsEn: JSON.stringify(['Renting', 'With Family', 'Homeless', 'Other']),
        optionsAr: JSON.stringify(['استئجار', 'مع العائلة', 'بلا مأوى', 'أخرى']),
        customerProfileKey: '',
        sortOrder: 9,
      },
      {
        fieldKey: 'employmentStatus',
        labelEn: 'Employment Status',
        labelAr: 'حالة التوظيف',
        fieldType: 'select',
        required: true,
        forActions: ['add'],
        optionsEn: JSON.stringify(['Employed - Government', 'Employed - Private', 'Self-Employed', 'Unemployed', 'Retired']),
        optionsAr: JSON.stringify(['موظف - حكومي', 'موظف - قطاع خاص', 'عمل حر', 'عاطل عن العمل', 'متقاعد']),
        customerProfileKey: '',
        sortOrder: 10,
      },
    ],
    actions: [
      { actionType: 'CREATE_RECORD', sortOrder: 0 },
      { actionType: 'SEND_EMAIL', sortOrder: 1 },
    ],
  },

  // ─── 7. Housing Maintenance Loan ────────────────────────────────────────────
  {
    nameEn: 'Housing Maintenance Loan',
    nameAr: 'قرض صيانة الإسكان',
    category: 'housing',
    descriptionEn: 'Apply for a housing maintenance loan for property repairs and upkeep. Available for UAE nationals who own property over 10 years old.',
    descriptionAr: 'التقديم على قرض صيانة إسكان لإصلاحات وصيانة العقار. متاح للمواطنين الإماراتيين الذين يمتلكون عقاراً عمره أكثر من 10 سنوات.',
    feeAmount: 'Free',
    feeCurrency: 'AED',
    processingTimeEn: '15-30 days',
    processingTimeAr: '15-30 يوماً',
    requiredActions: ['add'],
    eligibilityEn: 'UAE nationals who own property over 10 years old',
    eligibilityAr: 'المواطنون الإماراتيون الذين يمتلكون عقاراً عمره أكثر من 10 سنوات',
    requiredDocumentsEn: 'Emirates ID, Property Title Deed, Maintenance Cost Estimate, Bank Statements',
    requiredDocumentsAr: 'الهوية الإماراتية، صك ملكية العقار، تقدير تكلفة الصيانة، كشوفات بنكية',
    priority: 'medium',
    slaHours: 720,
    agentInstructionsEn: 'Verify UAE nationality. Confirm property ownership and that property is over 10 years old. Loan amount must be between AED 50,000-200,000. Ensure maintenance cost estimate is provided.',
    agentInstructionsAr: 'تحقق من الجنسية الإماراتية. تأكد من ملكية العقار وأن عمر العقار أكثر من 10 سنوات. يجب أن يكون مبلغ القرض بين 50,000-200,000 درهم. تأكد من تقديم تقدير تكلفة الصيانة.',
    autoResponseEn: 'Your housing maintenance loan application has been received. Processing takes 15-30 days.',
    autoResponseAr: 'تم استلام طلب قرض صيانة الإسكان. تستغرق المعالجة 15-30 يوماً.',
    tags: ['housing', 'loan', 'maintenance', 'UAE national'],
    sortOrder: 7,
    fields: [
      forActions(EMIRATES_ID_FIELD, ['add']),
      forActions(FULL_NAME_FIELD, ['add']),
      forActions(PHONE_FIELD, ['add']),
      forActions(FAMILY_BOOK_NUM_FIELD, ['add']),
      forActions(MONTHLY_INCOME_FIELD, ['add']),
      {
        fieldKey: 'propertyAddress',
        labelEn: 'Property Address',
        labelAr: 'عنوان العقار',
        fieldType: 'textarea',
        required: true,
        forActions: ['add'],
        placeholderEn: 'Enter full property address',
        placeholderAr: 'أدخل عنوان العقار بالكامل',
        customerProfileKey: '',
        sortOrder: 5,
      },
      {
        fieldKey: 'loanAmount',
        labelEn: 'Loan Amount (AED)',
        labelAr: 'مبلغ القرض',
        fieldType: 'number',
        required: true,
        forActions: ['add'],
        placeholderEn: '50,000 - 200,000',
        placeholderAr: '50,000 - 200,000',
        validationEn: 'Must be between 50,000 and 200,000 AED',
        validationAr: 'يجب أن يكون بين 50,000 و 200,000 درهم',
        customerProfileKey: '',
        sortOrder: 6,
      },
      {
        fieldKey: 'maintenanceType',
        labelEn: 'Maintenance Type',
        labelAr: 'نوع الصيانة',
        fieldType: 'select',
        required: true,
        forActions: ['add'],
        optionsEn: JSON.stringify(['Plumbing', 'Electrical', 'Roofing', 'AC', 'Structural', 'General']),
        optionsAr: JSON.stringify(['سباكة', 'كهرباء', 'سقف', 'تكييف', 'هيكلية', 'عامة']),
        customerProfileKey: '',
        sortOrder: 7,
      },
      {
        fieldKey: 'propertyAge',
        labelEn: 'Property Age (years)',
        labelAr: 'عمر العقار',
        fieldType: 'number',
        required: true,
        forActions: ['add'],
        placeholderEn: 'Enter property age in years',
        placeholderAr: 'أدخل عمر العقار بالسنوات',
        validationEn: 'Must be 10 or more years',
        validationAr: 'يجب أن يكون 10 سنوات أو أكثر',
        customerProfileKey: '',
        sortOrder: 8,
      },
    ],
    actions: [
      { actionType: 'CREATE_RECORD', sortOrder: 0 },
      { actionType: 'SEND_EMAIL', sortOrder: 1 },
    ],
  },

  // ─── 8. Federal Housing Loan ────────────────────────────────────────────────
  {
    nameEn: 'Federal Housing Loan',
    nameAr: 'قرض الإسكان الاتحادي',
    category: 'housing',
    descriptionEn: 'Apply for a federal housing loan for new construction, purchase, renovation, or completion of housing for UAE nationals.',
    descriptionAr: 'التقديم على قرض إسكاني اتحادي للبناء الجديد أو الشراء أو التجديد أو الإكمال للمواطنين الإماراتيين.',
    feeAmount: 'Free',
    feeCurrency: 'AED',
    processingTimeEn: '30-60 days',
    processingTimeAr: '30-60 يوماً',
    requiredActions: ['add'],
    eligibilityEn: 'UAE nationals, 21+ years, monthly income AED 5,000-35,000, does not own more than one property',
    eligibilityAr: 'المواطنون الإماراتيون، 21+ سنة، دخل شههري 5,000-35,000 درهم، لا يمتلك أكثر من عقار واحد',
    requiredDocumentsEn: 'Emirates ID, Salary Certificate, Bank Statements (6 months), Property Documents/Land Deed',
    requiredDocumentsAr: 'الهوية الإماراتية، شهادة الراتب، كشوفات بنكية (6 أشهر)، وثائق العقار/صك الأرض',
    priority: 'high',
    slaHours: 1440,
    agentInstructionsEn: 'Verify UAE nationality and age (21+). Confirm income is between AED 5,000-35,000/month. Loan amount must be between AED 200,000-800,000. Verify property documents are available.',
    agentInstructionsAr: 'تحقق من الجنسية الإماراتية والعمر (21+). تأكد من أن الدخل بين 5,000-35,000 درهم/شهر. يجب أن يكون مبلغ القرض بين 200,000-800,000 درهم. تحقق من توفر وثائق العقار.',
    autoResponseEn: 'Your federal housing loan application has been received. Processing takes 30-60 days.',
    autoResponseAr: 'تم استلام طلب القرض الإسكاني الاتحادي. تستغرق المعالجة 30-60 يوماً.',
    tags: ['housing', 'loan', 'federal', 'UAE national'],
    sortOrder: 8,
    fields: [
      forActions(EMIRATES_ID_FIELD, ['add']),
      forActions(FULL_NAME_FIELD, ['add']),
      forActions(PHONE_FIELD, ['add']),
      forActions(FAMILY_BOOK_NUM_FIELD, ['add']),
      forActions(MONTHLY_INCOME_FIELD, ['add']),
      {
        fieldKey: 'maritalStatus',
        labelEn: 'Marital Status',
        labelAr: 'الحالة الاجتماعية',
        fieldType: 'select',
        required: true,
        forActions: ['add'],
        optionsEn: JSON.stringify(['Single', 'Married', 'Divorced', 'Widowed']),
        optionsAr: JSON.stringify(['أعزب', 'متزوج', 'مطلق', 'أرمل']),
        customerProfileKey: '',
        sortOrder: 5,
      },
      {
        fieldKey: 'numberOfDependents',
        labelEn: 'Number of Dependents',
        labelAr: 'عدد المعالين',
        fieldType: 'number',
        required: true,
        forActions: ['add'],
        placeholderEn: 'Enter number of dependents',
        placeholderAr: 'أدخل عدد المعالين',
        customerProfileKey: '',
        sortOrder: 6,
      },
      {
        fieldKey: 'employmentStatus',
        labelEn: 'Employment Status',
        labelAr: 'حالة التوظيف',
        fieldType: 'select',
        required: true,
        forActions: ['add'],
        optionsEn: JSON.stringify(['Employed - Government', 'Employed - Private', 'Self-Employed', 'Unemployed', 'Retired']),
        optionsAr: JSON.stringify(['موظف - حكومي', 'موظف - قطاع خاص', 'عمل حر', 'عاطل عن العمل', 'متقاعد']),
        customerProfileKey: '',
        sortOrder: 7,
      },
      {
        fieldKey: 'loanPurpose',
        labelEn: 'Loan Purpose',
        labelAr: 'غرض القرض',
        fieldType: 'select',
        required: true,
        forActions: ['add'],
        optionsEn: JSON.stringify(['New Construction', 'Purchase', 'Renovation', 'Completion']),
        optionsAr: JSON.stringify(['بناء جديد', 'شراء', 'تجديد', 'إكمال']),
        customerProfileKey: '',
        sortOrder: 8,
      },
      {
        fieldKey: 'loanAmount',
        labelEn: 'Loan Amount (AED)',
        labelAr: 'مبلغ القرض',
        fieldType: 'number',
        required: true,
        forActions: ['add'],
        placeholderEn: '200,000 - 800,000',
        placeholderAr: '200,000 - 800,000',
        validationEn: 'Must be between 200,000 and 800,000 AED',
        validationAr: 'يجب أن يكون بين 200,000 و 800,000 درهم',
        customerProfileKey: '',
        sortOrder: 9,
      },
      {
        fieldKey: 'propertyLocation',
        labelEn: 'Property Location',
        labelAr: 'موقع العقار',
        fieldType: 'select',
        required: true,
        forActions: ['add'],
        optionsEn: JSON.stringify(['Abu Dhabi', 'Dubai', 'Sharjah', 'Ajman', 'Umm Al Quwain', 'Ras Al Khaimah', 'Fujairah']),
        optionsAr: JSON.stringify(['أبوظبي', 'دبي', 'الشارقة', 'عجمان', 'أم القيوين', 'رأس الخيمة', 'الفجيرة']),
        customerProfileKey: '',
        sortOrder: 10,
      },
    ],
    actions: [
      { actionType: 'CREATE_RECORD', sortOrder: 0 },
      { actionType: 'SEND_EMAIL', sortOrder: 1 },
    ],
  },

  // ─── 9. Fuel Station Complaint ──────────────────────────────────────────────
  {
    nameEn: 'Fuel Station Complaint',
    nameAr: 'شكوى محطة وقود',
    category: 'petroleum',
    descriptionEn: 'Submit a complaint about a fuel station including pricing violations, fuel quality, safety hazards, or service issues.',
    descriptionAr: 'تقديم شكوى عن محطة وقود بما في ذلك مخالفات التسعير أو جودة الوقود أو مخاطر السلامة أو مشاكل الخدمة.',
    feeAmount: 'Free',
    feeCurrency: 'AED',
    processingTimeEn: '10 working days',
    processingTimeAr: '10 أيام عمل',
    requiredActions: ['add'],
    eligibilityEn: 'Any member of the public',
    eligibilityAr: 'أي شخص من الجمهور',
    requiredDocumentsEn: 'Emirates ID, any supporting evidence (photos, receipts)',
    requiredDocumentsAr: 'الهوية الإماراتية، أي أدلة داعمة (صور، إيصالات)',
    priority: 'high',
    slaHours: 240,
    agentInstructionsEn: 'Record station name and location accurately. Classify complaint type. For safety hazards, flag as urgent and escalate immediately. Collect incident date for investigation purposes.',
    agentInstructionsAr: 'سجل اسم المحطة والموقع بدقة. صنف نوع الشكوى. لمخاطر السلامة، حدد كعاجل وقم بالتصعيد فوراً. اجمع تاريخ الحادثة لأغراض التحقيق.',
    autoResponseEn: 'Your fuel station complaint has been registered. Our inspection team will investigate within 10 working days.',
    autoResponseAr: 'تم تسجيل شكواكم عن محطة الوقود. سيتحقق فريق التفتيش خلال 10 أيام عمل.',
    tags: ['complaint', 'petroleum', 'fuel', 'safety'],
    sortOrder: 9,
    fields: [
      forActions(FULL_NAME_FIELD, ['add']),
      forActions(PHONE_FIELD, ['add']),
      forActions(EMIRATES_ID_FIELD, ['add']),
      {
        fieldKey: 'stationName',
        labelEn: 'Station Name',
        labelAr: 'اسم المحطة',
        fieldType: 'text',
        required: true,
        forActions: ['add'],
        placeholderEn: 'Enter fuel station name',
        placeholderAr: 'أدخل اسم محطة الوقود',
        customerProfileKey: '',
        sortOrder: 3,
      },
      {
        fieldKey: 'stationLocation',
        labelEn: 'Station Location',
        labelAr: 'موقع المحطة',
        fieldType: 'text',
        required: true,
        forActions: ['add'],
        placeholderEn: 'Enter station area or landmark',
        placeholderAr: 'أدخل منطقة المحطة أو المعلم',
        customerProfileKey: '',
        sortOrder: 4,
      },
      {
        fieldKey: 'complaintType',
        labelEn: 'Complaint Type',
        labelAr: 'نوع الشكوى',
        fieldType: 'select',
        required: true,
        forActions: ['add'],
        optionsEn: JSON.stringify(['Pricing Violation', 'Fuel Quality', 'Safety Hazard', 'Service Issue', 'Other']),
        optionsAr: JSON.stringify(['مخالفة تسعير', 'جودة الوقود', 'خطر سلامة', 'مشكلة خدمة', 'أخرى']),
        customerProfileKey: '',
        sortOrder: 5,
      },
      {
        fieldKey: 'complaintDescription',
        labelEn: 'Complaint Description',
        labelAr: 'وصف الشكوى',
        fieldType: 'textarea',
        required: true,
        forActions: ['add'],
        placeholderEn: 'Describe the incident in detail',
        placeholderAr: 'صف الحادثة بالتفصيل',
        customerProfileKey: '',
        sortOrder: 6,
      },
      {
        fieldKey: 'incidentDate',
        labelEn: 'Incident Date',
        labelAr: 'تاريخ الحادثة',
        fieldType: 'date',
        required: true,
        forActions: ['add'],
        placeholderEn: 'Select the date of the incident',
        placeholderAr: 'حدد تاريخ الحادثة',
        customerProfileKey: '',
        sortOrder: 7,
      },
    ],
    actions: [
      { actionType: 'CREATE_RECORD', sortOrder: 0 },
      { actionType: 'SEND_EMAIL', sortOrder: 1 },
    ],
  },

  // ─── 10. Land Transport Permit ──────────────────────────────────────────────
  {
    nameEn: 'Land Transport Permit',
    nameAr: 'تصريح النقل البري',
    category: 'transport',
    descriptionEn: 'Apply for or search for a land transport permit for commercial freight and passenger transport operations.',
    descriptionAr: 'التقديم على أو البحث عن تصريح نقل بري لعمليات الشحن التجاري ونقل الركاب.',
    feeAmount: 'Varies',
    feeCurrency: 'AED',
    processingTimeEn: '10-15 working days',
    processingTimeAr: '10-15 يوم عمل',
    requiredActions: ['add', 'search'],
    eligibilityEn: 'Companies with valid UAE trade license operating in transport sector',
    eligibilityAr: 'الشركات الحاصلة على رخصة تجارية إماراتية سارية تعمل في قطاع النقل',
    requiredDocumentsEn: 'Trade License, Vehicle Registration, Insurance Documents, Driver Licenses',
    requiredDocumentsAr: 'الرخصة التجارية، تسجيل المركبة، وثائق التأمين، رخص القيادة',
    priority: 'medium',
    slaHours: 360,
    agentInstructionsEn: 'For new applications, verify trade license validity and company details. For searches, use trade license number or Emirates ID. Confirm vehicle type and count match the trade license scope.',
    agentInstructionsAr: 'للطلبات الجديدة، تحقق من صلاحية الرخصة التجارية وتفاصيل الشركة. للبحث، استخدم رقم الرخصة التجارية أو رقم الهوية. تأكد من أن نوع وعدد المركبات يتوافق مع نطاق الرخصة التجارية.',
    autoResponseEn: 'Your land transport permit application has been received. Processing takes 10-15 working days.',
    autoResponseAr: 'تم استلام طلب تصريح النقل البري. تستغرق المعالجة 10-15 يوم عمل.',
    tags: ['transport', 'permit', 'commercial', 'freight'],
    sortOrder: 10,
    fields: [
      // Fields for "add" action
      forActions(EMIRATES_ID_FIELD, ['add', 'search']),
      forActions(FULL_NAME_FIELD, ['add']),
      forActions(PHONE_FIELD, ['add']),
      {
        fieldKey: 'companyName',
        labelEn: 'Company Name',
        labelAr: 'اسم الشركة',
        fieldType: 'text',
        required: true,
        forActions: ['add'],
        placeholderEn: 'Enter company name as on trade license',
        placeholderAr: 'أدخل اسم الشركة كما في الرخصة التجارية',
        customerProfileKey: '',
        sortOrder: 3,
      },
      {
        fieldKey: 'tradeLicense',
        labelEn: 'Trade License Number',
        labelAr: 'رقم الرخصة التجارية',
        fieldType: 'text',
        required: true,
        forActions: ['add', 'search'],
        placeholderEn: 'Enter trade license number',
        placeholderAr: 'أدخل رقم الرخصة التجارية',
        customerProfileKey: '',
        sortOrder: 4,
      },
      {
        fieldKey: 'vehicleType',
        labelEn: 'Vehicle Type',
        labelAr: 'نوع المركبة',
        fieldType: 'select',
        required: true,
        forActions: ['add'],
        optionsEn: JSON.stringify(['Light Vehicle', 'Heavy Vehicle', 'Bus', 'Truck', 'Specialized']),
        optionsAr: JSON.stringify(['مركبة خفيفة', 'مركبة ثقيلة', 'حافلة', 'شاحنة', 'متخصصة']),
        customerProfileKey: '',
        sortOrder: 5,
      },
      {
        fieldKey: 'vehicleCount',
        labelEn: 'Number of Vehicles',
        labelAr: 'عدد المركبات',
        fieldType: 'number',
        required: true,
        forActions: ['add'],
        placeholderEn: 'Enter number of vehicles',
        placeholderAr: 'أدخل عدد المركبات',
        validationEn: 'Must be 1 or more',
        validationAr: 'يجب أن يكون 1 أو أكثر',
        customerProfileKey: '',
        sortOrder: 6,
      },
    ],
    actions: [
      { actionType: 'CREATE_RECORD', sortOrder: 0 },
      { actionType: 'SEND_EMAIL', sortOrder: 1 },
    ],
  },

  // ─── 11. Solar Panel Installation Permit ─────────────────────────────────────
  {
    nameEn: 'Solar Panel Installation Permit',
    nameAr: 'تصريح تركيب ألواح الطاقة الشمسية',
    category: 'sustainability',
    descriptionEn: 'Apply for a permit to install solar panel systems on residential, commercial, or industrial properties.',
    descriptionAr: 'التقديم على تصريح لتركيب أنظمة الألواح الشمسية على المنشآت السكنية والتجارية والصناعية.',
    feeAmount: '500',
    feeCurrency: 'AED',
    processingTimeEn: '5-10 working days',
    processingTimeAr: '5-10 أيام عمل',
    requiredActions: ['add'],
    eligibilityEn: 'Property owners with valid UAE PASS and approved property in UAE',
    eligibilityAr: 'أصحاب العقارات الحاملون لبطاقة UAE PASS سارية والعقار المعتمد في الإمارات',
    requiredDocumentsEn: 'Emirates ID, Property Title Deed, Electrical Layout Plan, Solar System Specifications',
    requiredDocumentsAr: 'الهوية الإماراتية، صك ملكية العقار، مخطط التمديدات الكهربائية، مواصفات النظام الشمسي',
    priority: 'medium',
    slaHours: 240,
    agentInstructionsEn: 'Verify property ownership. Confirm system capacity is reasonable for the property type. Ensure installation type is appropriate. Check emirate-specific regulations for solar installations.',
    agentInstructionsAr: 'تحقق من ملكية العقار. تأكد من أن سعة النظام مناسبة لنوع العقار. تأكد من أن نوع التركيب مناسب. تحقق من اللوائح الخاصة بالإمارة للتركيبات الشمسية.',
    autoResponseEn: 'Your solar panel installation permit application has been received. Processing takes 5-10 working days.',
    autoResponseAr: 'تم استلام طلب تصريح تركيب الألواح الشمسية. تستغرق المعالجة 5-10 أيام عمل.',
    tags: ['sustainability', 'solar', 'permit', 'renewable energy'],
    sortOrder: 11,
    fields: [
      forActions(EMIRATES_ID_FIELD, ['add']),
      forActions(FULL_NAME_FIELD, ['add']),
      forActions(PHONE_FIELD, ['add']),
      forActions(PROPERTY_OWNERSHIP_FIELD, ['add']),
      forActions(PROPERTY_TYPE_FIELD, ['add']),
      forActions(EMIRATE_FIELD, ['add']),
      forActions(ADDRESS_FIELD, ['add']),
      {
        fieldKey: 'systemCapacity',
        labelEn: 'System Capacity (kW)',
        labelAr: 'سعة النظام',
        fieldType: 'number',
        required: true,
        forActions: ['add'],
        placeholderEn: 'Enter system capacity in kilowatts',
        placeholderAr: 'أدخل سعة النظام بالكيلووات',
        validationEn: 'Must be a positive number',
        validationAr: 'يجب أن يكون رقماً موجباً',
        customerProfileKey: '',
        sortOrder: 8,
      },
      {
        fieldKey: 'installationType',
        labelEn: 'Installation Type',
        labelAr: 'نوع التركيب',
        fieldType: 'select',
        required: true,
        forActions: ['add'],
        optionsEn: JSON.stringify(['Rooftop', 'Ground Mount', 'Carport', 'Hybrid']),
        optionsAr: JSON.stringify(['سقف', 'تركيب أرضي', 'مظلة سيارات', 'هجين']),
        customerProfileKey: '',
        sortOrder: 9,
      },
    ],
    actions: [
      { actionType: 'CREATE_RECORD', sortOrder: 0 },
      { actionType: 'SEND_EMAIL', sortOrder: 1 },
    ],
  },

  // ─── 12. General Complaint ──────────────────────────────────────────────────
  {
    nameEn: 'General Complaint',
    nameAr: 'شكوى عامة',
    category: 'general',
    descriptionEn: 'Submit a general complaint about any MOEI service or process not covered by specific complaint categories.',
    descriptionAr: 'تقديم شكوى عامة عن أي خدمة أو عملية لوزارة الطاقة والبنية التحتية غير مشمولة بفئات الشكاوى المحددة.',
    feeAmount: 'Free',
    feeCurrency: 'AED',
    processingTimeEn: '5-15 working days',
    processingTimeAr: '5-15 يوم عمل',
    requiredActions: ['add'],
    eligibilityEn: 'Any customer or member of the public',
    eligibilityAr: 'أي عميل أو شخص من الجمهور',
    requiredDocumentsEn: 'Emirates ID, any relevant supporting documents',
    requiredDocumentsAr: 'الهوية الإماراتية، أي مستندات داعمة ذات صلة',
    priority: 'medium',
    slaHours: 360,
    agentInstructionsEn: 'Classify the complaint category accurately to route to the right department. Gather all relevant details. For urgent safety issues, escalate immediately regardless of category.',
    agentInstructionsAr: 'صنف فئة الشكوى بدقة لتوجيهها إلى القسم المناسب. اجمع جميع التفاصيل ذات الصلة. لمشاكل السلامة العاجلة، قم بالتصعيد فوراً بغض النظر عن الفئة.',
    autoResponseEn: 'Your complaint has been registered and will be reviewed within 5-15 working days.',
    autoResponseAr: 'تم تسجيل شكواكم وسيتم مراجعتها خلال 5-15 يوم عمل.',
    tags: ['complaint', 'general'],
    sortOrder: 12,
    fields: [
      forActions(FULL_NAME_FIELD, ['add']),
      forActions(PHONE_FIELD, ['add']),
      forActions(EMIRATES_ID_FIELD, ['add']),
      {
        fieldKey: 'complaintCategory',
        labelEn: 'Complaint Category',
        labelAr: 'فئة الشكوى',
        fieldType: 'select',
        required: true,
        forActions: ['add'],
        optionsEn: JSON.stringify(['Electricity & Water', 'Housing', 'Petroleum', 'Transport', 'Sustainability', 'Other']),
        optionsAr: JSON.stringify(['الكهرباء والمياه', 'الإسكان', 'البترول', 'النقل', 'الاستدامة', 'أخرى']),
        customerProfileKey: '',
        sortOrder: 3,
      },
      {
        fieldKey: 'complaintDescription',
        labelEn: 'Complaint Description',
        labelAr: 'وصف الشكوى',
        fieldType: 'textarea',
        required: true,
        forActions: ['add'],
        placeholderEn: 'Describe your complaint in detail',
        placeholderAr: 'صف شكواك بالتفصيل',
        customerProfileKey: '',
        sortOrder: 4,
      },
    ],
    actions: [
      { actionType: 'CREATE_RECORD', sortOrder: 0 },
      { actionType: 'SEND_EMAIL', sortOrder: 1 },
    ],
  },

  // ─── 13. General Inquiry ────────────────────────────────────────────────────
  {
    nameEn: 'General Inquiry',
    nameAr: 'استفسار عام',
    category: 'general',
    descriptionEn: 'Ask general questions about MOEI services, fees, processes, or policies. No specific form fields required.',
    descriptionAr: 'اطرح أسئلة عامة عن خدمات وزارة الطاقة والبنية التحتية أو الرسوم أو العمليات أو السياسات. لا توجد حقول نموذج محددة مطلوبة.',
    feeAmount: 'Free',
    feeCurrency: 'AED',
    processingTimeEn: 'Instant',
    processingTimeAr: 'فوري',
    requiredActions: ['search'],
    eligibilityEn: 'Any member of the public',
    eligibilityAr: 'أي شخص من الجمهور',
    requiredDocumentsEn: 'None',
    requiredDocumentsAr: 'لا يوجد',
    priority: 'low',
    slaHours: 1,
    agentInstructionsEn: 'Handle general questions about MOEI services, fees, processes. Use knowledge base to provide accurate answers. If the inquiry is about a specific service, guide the customer to the appropriate service form.',
    agentInstructionsAr: 'تعامل مع الأسئلة العامة عن خدمات وزارة الطاقة والبنية التحتية والرسوم والعمليات. استخدم قاعدة المعرفة لتقديم إجابات دقيقة. إذا كان الاستفسار عن خدمة محددة، وجه العميل إلى نموذج الخدمة المناسب.',
    autoResponseEn: 'How can I help you today? Feel free to ask about any MOEI service or process.',
    autoResponseAr: 'كيف يمكنني مساعدتك اليوم؟ لا تتردد في السؤال عن أي خدمة أو عملية لوزارة الطاقة والبنية التحتية.',
    tags: ['inquiry', 'general', 'information'],
    sortOrder: 13,
    fields: [], // No mandatory fields — free-form inquiry
    actions: [
      { actionType: 'SEND_EMAIL', sortOrder: 0 },
    ],
  },
]

// ─── 2. Mock UAEPass Customers ────────────────────────────────────────────────

interface MockCustomer {
  nameEn: string
  nameAr: string
  email: string
  phone: string
  uaePassId: string
  preferredLang: string
  preferredChannel: string
  emirate: string
  nationality: string
  gender: string
  dateOfBirth: string
  emiratesId: string
  passportNumber: string
  familyBookNum: string
  addressAr: string
  addressEn: string
  occupation: string
  employer: string
  monthlyIncome: string
  propertyOwned: string
  propertyType: string
  isUaeNational: boolean
  isVerified: boolean
}

const mockCustomers: MockCustomer[] = [
  {
    nameEn: 'Ahmed Khalifa Al Maktoum',
    nameAr: 'أمير خليفة المكتوم',
    email: 'ahmed.almaktoum@email.ae',
    phone: '+971501234567',
    uaePassId: 'UAE-784-1990-1234567',
    preferredLang: 'ar',
    preferredChannel: 'whatsapp',
    emirate: 'Dubai',
    nationality: 'UAE',
    gender: 'male',
    dateOfBirth: '1990-03-15',
    emiratesId: '784-1990-1234567',
    passportNumber: 'A12345678',
    familyBookNum: 'DXB-FB-4521',
    addressAr: 'شارع الشيخ زايد، دبي، الإمارات',
    addressEn: 'Sheikh Zayed Road, Dubai, UAE',
    occupation: 'Government Employee',
    employer: 'Dubai Municipality',
    monthlyIncome: '28000',
    propertyOwned: 'yes',
    propertyType: 'residential',
    isUaeNational: true,
    isVerified: true,
  },
  {
    nameEn: 'Fatima Hassan Al Nuaimi',
    nameAr: 'فاطمة حسن النعيمي',
    email: 'fatima.alnuaimi@email.ae',
    phone: '+971502345678',
    uaePassId: 'UAE-784-1988-2345678',
    preferredLang: 'ar',
    preferredChannel: 'web',
    emirate: 'Abu Dhabi',
    nationality: 'UAE',
    gender: 'female',
    dateOfBirth: '1988-07-22',
    emiratesId: '784-1988-2345678',
    passportNumber: 'A23456789',
    familyBookNum: 'AD-FB-7832',
    addressAr: 'شارع المطار، أبوظبي، الإمارات',
    addressEn: 'Airport Road, Abu Dhabi, UAE',
    occupation: 'Teacher',
    employer: 'Ministry of Education',
    monthlyIncome: '22000',
    propertyOwned: 'no',
    propertyType: '',
    isUaeNational: true,
    isVerified: true,
  },
  {
    nameEn: 'Mohammed Saeed Al Shehhi',
    nameAr: 'محمد سعيد الشحي',
    email: 'mohammed.alshehhi@email.ae',
    phone: '+971503456789',
    uaePassId: 'UAE-784-1985-3456789',
    preferredLang: 'ar',
    preferredChannel: 'voice',
    emirate: 'Ras Al Khaimah',
    nationality: 'UAE',
    gender: 'male',
    dateOfBirth: '1985-11-08',
    emiratesId: '784-1985-3456789',
    passportNumber: 'A34567890',
    familyBookNum: 'RAK-FB-2156',
    addressAr: 'حي المعيرض، رأس الخيمة، الإمارات',
    addressEn: 'Al Mairid District, Ras Al Khaimah, UAE',
    occupation: 'Engineer',
    employer: 'ADNOC',
    monthlyIncome: '35000',
    propertyOwned: 'yes',
    propertyType: 'residential',
    isUaeNational: true,
    isVerified: true,
  },
  {
    nameEn: 'Sarah Williams',
    nameAr: 'سارة ويليامز',
    email: 'sarah.williams@email.ae',
    phone: '+971504567890',
    uaePassId: 'EXP-456-1992-4567890',
    preferredLang: 'en',
    preferredChannel: 'whatsapp',
    emirate: 'Sharjah',
    nationality: 'British',
    gender: 'female',
    dateOfBirth: '1992-05-30',
    emiratesId: '456-1992-4567890',
    passportNumber: 'GB98765432',
    familyBookNum: '',
    addressAr: 'النخيل، الشارقة، الإمارات',
    addressEn: 'Al Nasserya, Sharjah, UAE',
    occupation: 'Marketing Manager',
    employer: 'Private Company',
    monthlyIncome: '18000',
    propertyOwned: 'no',
    propertyType: '',
    isUaeNational: false,
    isVerified: true,
  },
  {
    nameEn: 'Omar Khalil',
    nameAr: 'عمر خليل',
    email: 'omar.khalil@email.ae',
    phone: '+971505678901',
    uaePassId: 'EXP-284-1995-5678901',
    preferredLang: 'ar',
    preferredChannel: 'web',
    emirate: 'Ajman',
    nationality: 'Jordanian',
    gender: 'male',
    dateOfBirth: '1995-01-12',
    emiratesId: '284-1995-5678901',
    passportNumber: 'JO54321678',
    familyBookNum: '',
    addressAr: 'الرميلة، عجمان، الإمارات',
    addressEn: 'Al Rumaila, Ajman, UAE',
    occupation: 'Accountant',
    employer: 'Emirates NBD',
    monthlyIncome: '15000',
    propertyOwned: 'no',
    propertyType: '',
    isUaeNational: false,
    isVerified: true,
  },
  {
    nameEn: 'Aisha Obaid Al Ketbi',
    nameAr: 'عائشة عبيد الكتبي',
    email: 'aisha.alketbi@email.ae',
    phone: '+971506789012',
    uaePassId: 'UAE-784-1993-6789012',
    preferredLang: 'ar',
    preferredChannel: 'email',
    emirate: 'Fujairah',
    nationality: 'UAE',
    gender: 'female',
    dateOfBirth: '1993-09-05',
    emiratesId: '784-1993-6789012',
    passportNumber: 'A56789012',
    familyBookNum: 'FUJ-FB-9876',
    addressAr: 'الفجيرة، الإمارات',
    addressEn: 'Fujairah City, Fujairah, UAE',
    occupation: 'Business Owner',
    employer: 'Self-Employed',
    monthlyIncome: '30000',
    propertyOwned: 'yes',
    propertyType: 'commercial',
    isUaeNational: true,
    isVerified: true,
  },
]

// ─── Seed Functions ────────────────────────────────────────────────────────────

async function seedServiceRules() {
  console.log('\n📋 Seeding Service Rules & Fields...')

  let rulesCreated = 0
  let rulesSkipped = 0
  let fieldsCreated = 0
  let fieldsSkipped = 0

  for (const ruleDef of serviceRuleDefs) {
    // Check if rule already exists by nameEn
    const existing = await db.serviceRule.findFirst({
      where: { nameEn: ruleDef.nameEn },
      include: { fields: true },
    })

    if (existing) {
      // Update the rule if it already exists (to keep fields fresh)
      await db.serviceRule.update({
        where: { id: existing.id },
        data: {
          nameAr: ruleDef.nameAr,
          category: ruleDef.category,
          descriptionEn: ruleDef.descriptionEn,
          descriptionAr: ruleDef.descriptionAr,
          feeAmount: ruleDef.feeAmount,
          feeCurrency: ruleDef.feeCurrency,
          processingTimeEn: ruleDef.processingTimeEn,
          processingTimeAr: ruleDef.processingTimeAr,
          requiredActions: JSON.stringify(ruleDef.requiredActions),
          eligibilityEn: ruleDef.eligibilityEn,
          eligibilityAr: ruleDef.eligibilityAr,
          requiredDocumentsEn: ruleDef.requiredDocumentsEn,
          requiredDocumentsAr: ruleDef.requiredDocumentsAr,
          priority: ruleDef.priority,
          slaHours: ruleDef.slaHours,
          agentInstructionsEn: ruleDef.agentInstructionsEn,
          agentInstructionsAr: ruleDef.agentInstructionsAr,
          autoResponseEn: ruleDef.autoResponseEn,
          autoResponseAr: ruleDef.autoResponseAr,
          tags: JSON.stringify(ruleDef.tags),
          sortOrder: ruleDef.sortOrder,
        },
      })

      // Delete existing fields and re-create them (cleanest approach for updates)
      await db.serviceRuleField.deleteMany({
        where: { ruleId: existing.id },
      })

      for (const fieldDef of ruleDef.fields) {
        await db.serviceRuleField.create({
          data: {
            ruleId: existing.id,
            fieldKey: fieldDef.fieldKey,
            customerProfileKey: fieldDef.customerProfileKey || '',
            labelEn: fieldDef.labelEn,
            labelAr: fieldDef.labelAr,
            fieldType: fieldDef.fieldType,
            required: fieldDef.required,
            forActions: JSON.stringify(fieldDef.forActions),
            placeholderEn: fieldDef.placeholderEn || '',
            placeholderAr: fieldDef.placeholderAr || '',
            validationEn: fieldDef.validationEn || '',
            validationAr: fieldDef.validationAr || '',
            optionsEn: fieldDef.optionsEn || '',
            optionsAr: fieldDef.optionsAr || '',
            sortOrder: fieldDef.sortOrder,
            isActive: true,
          },
        })
        fieldsCreated++
      }

      rulesSkipped++
    } else {
      // Create new rule with fields
      const rule = await db.serviceRule.create({
        data: {
          nameEn: ruleDef.nameEn,
          nameAr: ruleDef.nameAr,
          category: ruleDef.category,
          descriptionEn: ruleDef.descriptionEn,
          descriptionAr: ruleDef.descriptionAr,
          feeAmount: ruleDef.feeAmount,
          feeCurrency: ruleDef.feeCurrency,
          processingTimeEn: ruleDef.processingTimeEn,
          processingTimeAr: ruleDef.processingTimeAr,
          requiredActions: JSON.stringify(ruleDef.requiredActions),
          eligibilityEn: ruleDef.eligibilityEn,
          eligibilityAr: ruleDef.eligibilityAr,
          requiredDocumentsEn: ruleDef.requiredDocumentsEn,
          requiredDocumentsAr: ruleDef.requiredDocumentsAr,
          priority: ruleDef.priority,
          slaHours: ruleDef.slaHours,
          agentInstructionsEn: ruleDef.agentInstructionsEn,
          agentInstructionsAr: ruleDef.agentInstructionsAr,
          autoResponseEn: ruleDef.autoResponseEn,
          autoResponseAr: ruleDef.autoResponseAr,
          tags: JSON.stringify(ruleDef.tags),
          sortOrder: ruleDef.sortOrder,
          isActive: true,
          fields: {
            create: ruleDef.fields.map((f) => ({
              fieldKey: f.fieldKey,
              customerProfileKey: f.customerProfileKey || '',
              labelEn: f.labelEn,
              labelAr: f.labelAr,
              fieldType: f.fieldType,
              required: f.required,
              forActions: JSON.stringify(f.forActions),
              placeholderEn: f.placeholderEn || '',
              placeholderAr: f.placeholderAr || '',
              validationEn: f.validationEn || '',
              validationAr: f.validationAr || '',
              optionsEn: f.optionsEn || '',
              optionsAr: f.optionsAr || '',
              sortOrder: f.sortOrder,
              isActive: true,
            })),
          },
        },
      })

      fieldsCreated += ruleDef.fields.length
      rulesCreated++
    }
  }

  console.log(`  Service Rules: ${rulesCreated} created, ${rulesSkipped} updated`)
  console.log(`  Service Rule Fields: ${fieldsCreated} created/updated`)
}

async function seedServiceRuleActions() {
  console.log('\n⚡ Seeding Service Rule Actions...')

  let actionsCreated = 0

  for (const ruleDef of serviceRuleDefs) {
    if (!ruleDef.actions || ruleDef.actions.length === 0) continue

    // Find the rule by nameEn
    const rule = await db.serviceRule.findFirst({
      where: { nameEn: ruleDef.nameEn },
    })

    if (!rule) {
      console.log(`  ⚠️  Rule "${ruleDef.nameEn}" not found, skipping actions`)
      continue
    }

    // Delete existing actions for this rule (cleanest approach for updates)
    await db.serviceRuleAction.deleteMany({
      where: { ruleId: rule.id },
    })

    // Create new actions
    for (const actionDef of ruleDef.actions) {
      await db.serviceRuleAction.create({
        data: {
          ruleId: rule.id,
          actionType: actionDef.actionType,
          endpoint: actionDef.endpoint || '',
          payloadTemplate: actionDef.payloadTemplate || '',
          sortOrder: actionDef.sortOrder,
          isActive: true,
        },
      })
      actionsCreated++
    }
  }

  console.log(`  Service Rule Actions: ${actionsCreated} created`)
}

async function seedMockCustomers() {
  console.log('\n👥 Seeding Mock UAEPass Customers...')

  let created = 0
  let skipped = 0
  const customerIds: string[] = []

  for (const mc of mockCustomers) {
    // Check by email (unique) first, then by phone (unique), then by uaePassId (unique)
    const existingByEmail = mc.email ? await db.customer.findUnique({ where: { email: mc.email } }) : null
    const existingByPhone = mc.phone ? await db.customer.findUnique({ where: { phone: mc.phone } }) : null
    const existingByUaePassId = mc.uaePassId ? await db.customer.findUnique({ where: { uaePassId: mc.uaePassId } }) : null

    const existing = existingByEmail || existingByPhone || existingByUaePassId

    const profileData = {
      nameAr: mc.nameAr,
      nameEn: mc.nameEn,
      uaePassId: mc.uaePassId,
      preferredLang: mc.preferredLang,
      preferredChannel: mc.preferredChannel,
      emirate: mc.emirate,
      nationality: mc.nationality,
      gender: mc.gender,
      dateOfBirth: mc.dateOfBirth,
      emiratesId: mc.emiratesId,
      passportNumber: mc.passportNumber,
      familyBookNum: mc.familyBookNum,
      addressAr: mc.addressAr,
      addressEn: mc.addressEn,
      occupation: mc.occupation,
      employer: mc.employer,
      monthlyIncome: mc.monthlyIncome,
      propertyOwned: mc.propertyOwned,
      propertyType: mc.propertyType,
      isUaeNational: mc.isUaeNational,
      isVerified: mc.isVerified,
    }

    if (existing) {
      // Update existing record with full profile data
      // Build update data carefully to avoid unique constraint violations
      const updateData: Record<string, any> = { ...profileData }

      // Set email if the existing record doesn't have it, or if it matches
      if (mc.email) {
        if (!existing.email || existing.email === mc.email) {
          updateData.email = mc.email
        } else if (existing.email !== mc.email) {
          // Another email already on this record; check if target email is free
          const targetEmailOwner = await db.customer.findUnique({ where: { email: mc.email } })
          if (!targetEmailOwner) {
            updateData.email = mc.email
          }
          // else: skip email update to avoid conflict
        }
      }

      // Set phone similarly
      if (mc.phone) {
        if (!existing.phone || existing.phone === mc.phone) {
          updateData.phone = mc.phone
        } else if (existing.phone !== mc.phone) {
          const targetPhoneOwner = await db.customer.findUnique({ where: { phone: mc.phone } })
          if (!targetPhoneOwner) {
            updateData.phone = mc.phone
          }
        }
      }

      await db.customer.update({
        where: { id: existing.id },
        data: updateData,
      })
      customerIds.push(existing.id)
      skipped++
    } else {
      try {
        const customer = await db.customer.create({
          data: {
            nameEn: mc.nameEn,
            nameAr: mc.nameAr,
            email: mc.email,
            phone: mc.phone,
            ...profileData,
          },
        })
        customerIds.push(customer.id)
        created++
      } catch (e: any) {
        // If unique constraint fails, try to find and adopt the conflicting record
        if (e.code === 'P2002') {
          const conflict = await db.customer.findUnique({ where: { phone: mc.phone } }) 
            || await db.customer.findUnique({ where: { email: mc.email } })
          if (conflict) {
            await db.customer.update({
              where: { id: conflict.id },
              data: profileData,
            })
            customerIds.push(conflict.id)
            skipped++
          }
        } else {
          throw e
        }
      }
    }
  }

  console.log(`  Mock Customers: ${created} created, ${skipped} updated`)
  return customerIds
}

async function seedCustomerCases(customerIds: string[]) {
  console.log('\n📋 Seeding Cases for Mock Customers...')

  // Only create cases for UAE nationals
  const uaeNationals = await db.customer.findMany({
    where: {
      id: { in: customerIds },
      isUaeNational: true,
    },
  })

  let created = 0
  let caseNum = 1

  for (const customer of uaeNationals) {
    // Check if customer already has cases
    const existingCases = await db.case.count({
      where: { customerId: customer.id },
    })

    if (existingCases >= 2) {
      continue // Already has enough cases
    }

    // Create 1-2 cases per UAE national
    const casesToCreate = 2 - existingCases

    const caseTemplates = [
      {
        titleEn: `Electricity Connection Request - ${customer.nameEn}`,
        titleAr: `طلب توصيل كهرباء - ${customer.nameAr}`,
        category: 'electricity_water',
        priority: 'medium',
        status: 'in_progress',
      },
      {
        titleEn: `Water Supply Complaint - ${customer.nameEn}`,
        titleAr: `شكوى إمدادات المياه - ${customer.nameAr}`,
        category: 'electricity_water',
        priority: 'high',
        status: 'open',
      },
    ]

    for (let i = 0; i < casesToCreate; i++) {
      const template = caseTemplates[i % caseTemplates.length]
      const referenceNumber = refNum('MOEI-EW', caseNum)

      // Check if ref num already exists
      const existingRef = await db.case.findUnique({
        where: { referenceNumber },
      })

      if (existingRef) {
        caseNum++
        continue
      }

      await db.case.create({
        data: {
          referenceNumber,
          customerId: customer.id,
          titleEn: template.titleEn,
          titleAr: template.titleAr,
          description: `${template.titleEn} - Submitted via ${customer.preferredChannel} channel`,
          status: template.status,
          priority: template.priority,
          category: template.category,
          channel: customer.preferredChannel,
          sentiment: 0.6,
          createdAt: new Date(Date.now() - Math.floor(Math.random() * 7 * 86400000)),
        },
      })

      created++
      caseNum++
    }
  }

  console.log(`  Cases for Mock Customers: ${created} created`)
}

async function seedCustomerBills(customerIds: string[]) {
  console.log('\n💰 Seeding Bills for Mock Customers...')

  let created = 0

  for (const customerId of customerIds) {
    // Check if customer already has a bill
    const existingBills = await db.bill.count({
      where: { customerId },
    })

    if (existingBills >= 1) {
      continue
    }

    // Create a bill for each customer
    const amount = Math.floor(Math.random() * 2000 + 200) + Math.random()
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + Math.floor(Math.random() * 30 + 5))

    const descriptions = [
      'Electricity & Water Bill - March 2025',
      'Electricity & Water Bill - February 2025',
      'Utility Bill - Q1 2025',
    ]

    await db.bill.create({
      data: {
        customerId,
        amount: parseFloat(amount.toFixed(2)),
        status: Math.random() > 0.7 ? 'overdue' : 'pending',
        dueDate,
        description: descriptions[Math.floor(Math.random() * descriptions.length)],
      },
    })

    created++
  }

  console.log(`  Bills for Mock Customers: ${created} created`)
}

async function seedCustomerServiceRequests(customerIds: string[]) {
  console.log('\n📝 Seeding Service Requests for Mock Customers...')

  // Get or create services that match our service rules
  const serviceRules = await db.serviceRule.findMany({
    select: { id: true, nameEn: true, category: true },
  })

  let created = 0
  let requestNum = 1

  for (const customerId of customerIds) {
    // Check if customer already has service requests
    const existingRequests = await db.serviceRequest.count({
      where: { customerId },
    })

    if (existingRequests >= 1) {
      continue
    }

    // Find a Service linked to this or create a Service entry
    // First, ensure corresponding Service records exist
    const rule = serviceRules[requestNum % serviceRules.length]

    // Find or create a matching Service
    let service = await db.service.findFirst({
      where: { nameEn: rule.nameEn },
    })

    if (!service) {
      service = await db.service.create({
        data: {
          nameEn: rule.nameEn,
          nameAr: 'خدمة ' + rule.nameEn,
          descriptionEn: `Service for ${rule.nameEn}`,
          descriptionAr: `خدمة ${rule.nameEn}`,
          category: rule.category,
          icon: 'FileText',
        },
      })
    }

    const referenceNumber = refNum('MOEI-SR', requestNum)

    // Check if ref num already exists
    const existingRef = await db.serviceRequest.findUnique({
      where: { referenceNumber },
    })

    if (existingRef) {
      requestNum++
      continue
    }

    const statuses = ['pending', 'in_progress', 'approved']
    const status = statuses[Math.floor(Math.random() * statuses.length)]

    await db.serviceRequest.create({
      data: {
        customerId,
        serviceId: service.id,
        status,
        referenceNumber,
        data: JSON.stringify({
          ruleId: rule.id,
          ruleName: rule.nameEn,
          category: rule.category,
          submittedAt: new Date().toISOString(),
        }),
        createdAt: new Date(Date.now() - Math.floor(Math.random() * 14 * 86400000)),
      },
    })

    created++
    requestNum++
  }

  console.log(`  Service Requests for Mock Customers: ${created} created`)
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🚀 Starting MOEI Service Rules & UAEPass Customer Seed...\n')
  console.log('=' .repeat(60))

  // 1. Seed Service Rules with Fields
  await seedServiceRules()

  // 1b. Seed Service Rule Actions
  await seedServiceRuleActions()

  // NO fake customer data — customers are created only through real interactions
  // (web chat, WhatsApp, voice, email channels)
  // The following are intentionally SKIPPED:
  // - seedMockCustomers()
  // - seedCustomerCases()
  // - seedCustomerBills()
  // - seedCustomerServiceRequests()

  // ─── Summary ────────────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(60))
  console.log('📊 Final Counts:')

  const ruleCount = await db.serviceRule.count()
  const fieldCount = await db.serviceRuleField.count()
  const actionCount = await db.serviceRuleAction.count()
  console.log(`  Service Rules:        ${ruleCount}`)
  console.log(`  Service Rule Fields:  ${fieldCount}`)
  console.log(`  Service Rule Actions: ${actionCount}`)

  console.log('\n✅ MOEI Service Rules & UAEPass Customer Seed Complete!')
}

main()
  .catch((err) => {
    console.error('❌ Seed failed:', err)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
