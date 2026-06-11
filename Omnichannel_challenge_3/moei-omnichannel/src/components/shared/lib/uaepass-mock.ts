/**
 * UAE PASS Mock Authentication System
 * Simulates the real UAE PASS API response format exactly
 * Based on official UAE PASS OAuth2/OIDC integration documentation
 * 
 * Real UAE PASS endpoints:
 * - Staging: https://stg-id.uaepass.ae/idshub/{authorize|token|userinfo}
 * - Production: https://id.uaepass.ae/idshub/{authorize|token|userinfo}
 */

// UAE PASS user profile response - matches the real API response format exactly
export interface UAEPassUserProfile {
  sub: string                    // Unique identifier: "UAEPASS/{uuid}"
  firstnameEN: string
  lastnameEN: string
  firstnameAR: string
  lastnameAR: string
  fullnameEN: string
  fullnameAR: string
  email: string
  mobile: string                 // Format: +971XXXXXXXXX
  idn: string                    // Emirates ID Number: "784-YYYY-XXXXXXX-C"
  nationalityEN: string
  nationalityAR: string
  gender: string                 // "male" | "female"
  dob: string                    // ISO date: "YYYY-MM-DD"
  sopLevel: string               // "sop1" | "sop2" | "sop3"
  exp: number                    // Token expiry (Unix timestamp)
}

export interface MockUserProfile extends UAEPassUserProfile {
  role: 'citizen' | 'employee' | 'admin' | 'superadmin'
  department?: string
  monthlyIncome?: number
  employer?: string
  employerType?: string
  familySize?: number
  hasActiveLoan?: boolean
}

// Pre-defined mock user profiles with realistic UAE data
export const MOCK_USERS: Record<string, MockUserProfile> = {
  'ahmed-citizen': {
    sub: 'UAEPASS/a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    firstnameEN: 'Ahmed',
    lastnameEN: 'Al Maktoum',
    firstnameAR: 'أحمد',
    lastnameAR: 'المكتوم',
    fullnameEN: 'Ahmed Al Maktoum',
    fullnameAR: 'أحمد المكتوم',
    email: 'ahmed.almaktoum@email.ae',
    mobile: '+971501234567',
    idn: '784-1990-1234567-1',
    nationalityEN: 'Emirati',
    nationalityAR: 'إماراتي',
    gender: 'male',
    dob: '1990-03-15',
    sopLevel: 'sop3',
    exp: Math.floor(Date.now() / 1000) + 3600,
    role: 'citizen',
    monthlyIncome: 25000,
    employer: 'Dubai Municipality',
    employerType: 'government',
    familySize: 6,
    hasActiveLoan: true,
  },
  'fatima-citizen': {
    sub: 'UAEPASS/b2c3d4e5-f6a7-8901-bcde-f23456789012',
    firstnameEN: 'Fatima',
    lastnameEN: 'Al Zaabi',
    firstnameAR: 'فاطمة',
    lastnameAR: 'الزعابي',
    fullnameEN: 'Fatima Al Zaabi',
    fullnameAR: 'فاطمة الزعابي',
    email: 'fatima.alzaabi@email.ae',
    mobile: '+971502345678',
    idn: '784-1985-2345678-2',
    nationalityEN: 'Emirati',
    nationalityAR: 'إماراتية',
    gender: 'female',
    dob: '1985-07-22',
    sopLevel: 'sop3',
    exp: Math.floor(Date.now() / 1000) + 3600,
    role: 'citizen',
    monthlyIncome: 18000,
    employer: 'Abu Dhabi Education Council',
    employerType: 'government',
    familySize: 4,
    hasActiveLoan: true,
  },
  'mohammed-citizen': {
    sub: 'UAEPASS/c3d4e5f6-a7b8-9012-cdef-345678901234',
    firstnameEN: 'Mohammed',
    lastnameEN: 'Al Rashidi',
    firstnameAR: 'محمد',
    lastnameAR: 'الراشدي',
    fullnameEN: 'Mohammed Al Rashidi',
    fullnameAR: 'محمد الراشدي',
    email: 'm.alrashidi@email.ae',
    mobile: '+971503456789',
    idn: '784-1988-3456789-3',
    nationalityEN: 'Emirati',
    nationalityAR: 'إماراتي',
    gender: 'male',
    dob: '1988-11-08',
    sopLevel: 'sop2',
    exp: Math.floor(Date.now() / 1000) + 3600,
    role: 'citizen',
    monthlyIncome: 15000,
    employer: 'Emirates NBD',
    employerType: 'semi-government',
    familySize: 5,
    hasActiveLoan: true,
  },
  'noura-citizen': {
    sub: 'UAEPASS/d4e5f6a7-b8c9-0123-defa-456789012345',
    firstnameEN: 'Noura',
    lastnameEN: 'Al Zeyoudi',
    firstnameAR: 'نورة',
    lastnameAR: 'الزيودي',
    fullnameEN: 'Noura Al Zeyoudi',
    fullnameAR: 'نورة الزيودي',
    email: 'n.alzeyoudi@email.ae',
    mobile: '+971504567890',
    idn: '784-1992-4567890-4',
    nationalityEN: 'Emirati',
    nationalityAR: 'إماراتية',
    gender: 'female',
    dob: '1992-05-18',
    sopLevel: 'sop2',
    exp: Math.floor(Date.now() / 1000) + 3600,
    role: 'citizen',
    monthlyIncome: 12000,
    employer: 'Etisalat',
    employerType: 'semi-government',
    familySize: 3,
    hasActiveLoan: true,
  },
  'khalifa-citizen': {
    sub: 'UAEPASS/e5f6a7b8-c9d0-1234-efab-567890123456',
    firstnameEN: 'Khalifa',
    lastnameEN: 'Al Kaabi',
    firstnameAR: 'خليفة',
    lastnameAR: 'الكعبي',
    fullnameEN: 'Khalifa Al Kaabi',
    fullnameAR: 'خليفة الكعبي',
    email: 'k.alkaabi@email.ae',
    mobile: '+971505678901',
    idn: '784-1983-5678901-5',
    nationalityEN: 'Emirati',
    nationalityAR: 'إماراتي',
    gender: 'male',
    dob: '1983-01-30',
    sopLevel: 'sop2',
    exp: Math.floor(Date.now() / 1000) + 3600,
    role: 'citizen',
    monthlyIncome: 8000,
    employer: 'Private Trading LLC',
    employerType: 'private',
    familySize: 7,
    hasActiveLoan: true,
  },
  'mariam-citizen': {
    sub: 'UAEPASS/f6a7b8c9-d0e1-2345-fabc-678901234567',
    firstnameEN: 'Mariam',
    lastnameEN: 'Al Balushi',
    firstnameAR: 'مريم',
    lastnameAR: 'البلوشي',
    fullnameEN: 'Mariam Al Balushi',
    fullnameAR: 'مريم البلوشي',
    email: 'm.albalushi@email.ae',
    mobile: '+971506789012',
    idn: '784-1995-6789012-6',
    nationalityEN: 'Emirati',
    nationalityAR: 'إماراتية',
    gender: 'female',
    dob: '1995-09-12',
    sopLevel: 'sop3',
    exp: Math.floor(Date.now() / 1000) + 3600,
    role: 'citizen',
    monthlyIncome: 35000,
    employer: 'Ministry of Finance',
    employerType: 'government',
    familySize: 4,
    hasActiveLoan: false,
  },
  // Employee profiles
  'khalid-employee': {
    sub: 'UAEPASS/g7b8c9d0-e1f2-3456-abcd-789012345678',
    firstnameEN: 'Khalid',
    lastnameEN: 'Al Mansoori',
    firstnameAR: 'خالد',
    lastnameAR: 'المنصوري',
    fullnameEN: 'Khalid Al Mansoori',
    fullnameAR: 'خالد المنصوري',
    email: 'khalid.almansoori@moei.gov.ae',
    mobile: '+971507890123',
    idn: '784-1982-7890123-7',
    nationalityEN: 'Emirati',
    nationalityAR: 'إماراتي',
    gender: 'male',
    dob: '1982-11-08',
    sopLevel: 'sop3',
    exp: Math.floor(Date.now() / 1000) + 3600,
    role: 'employee',
    department: 'housing_finance',
    monthlyIncome: 35000,
    employer: 'Ministry of Energy & Infrastructure',
    employerType: 'government',
    familySize: 5,
  },
  'aisha-employee': {
    sub: 'UAEPASS/h8c9d0e1-f2a3-4567-bcde-890123456789',
    firstnameEN: 'Aisha',
    lastnameEN: 'Al Darmaki',
    firstnameAR: 'عائشة',
    lastnameAR: 'الدرمكي',
    fullnameEN: 'Aisha Al Darmaki',
    fullnameAR: 'عائشة الدرمكي',
    email: 'aisha.aldarmaki@moei.gov.ae',
    mobile: '+971508901234',
    idn: '784-1987-8901234-8',
    nationalityEN: 'Emirati',
    nationalityAR: 'إماراتية',
    gender: 'female',
    dob: '1987-04-25',
    sopLevel: 'sop3',
    exp: Math.floor(Date.now() / 1000) + 3600,
    role: 'employee',
    department: 'risk_assessment',
    monthlyIncome: 30000,
    employer: 'Ministry of Energy & Infrastructure',
    employerType: 'government',
    familySize: 3,
  },
  // Admin profile
  'saeed-admin': {
    sub: 'UAEPASS/i9d0e1f2-a3b4-5678-cdef-901234567890',
    firstnameEN: 'Saeed',
    lastnameEN: 'Al Ameri',
    firstnameAR: 'سعيد',
    lastnameAR: 'العامري',
    fullnameEN: 'Saeed Al Ameri',
    fullnameAR: 'سعيد العامري',
    email: 'saeed.alameri@moei.gov.ae',
    mobile: '+971509012345',
    idn: '784-1979-9012345-9',
    nationalityEN: 'Emirati',
    nationalityAR: 'إماراتي',
    gender: 'male',
    dob: '1979-06-14',
    sopLevel: 'sop3',
    exp: Math.floor(Date.now() / 1000) + 3600,
    role: 'admin',
    department: 'management',
    monthlyIncome: 45000,
    employer: 'Ministry of Energy & Infrastructure',
    employerType: 'government',
    familySize: 6,
  },
}

export interface HousingAssistanceFile {
  housingAssistanceNumber: string
  originalAmount: number
  remainingBalance: number
  monthlyInstallment: number
  loanDurationMonths: number
  elapsedMonths: number
  loanType: string
  totalOverdue: number
  missedMonths: number
  delayDays: number
  status: string
  issueDate: string
}

export const MOCK_HOUSING_ASSISTANCE_FILES: Record<string, HousingAssistanceFile[]> = {
  // Ahmed's IDN
  '784-1990-1234567-1': [
    {
      housingAssistanceNumber: 'SZHP-2018-00123',
      originalAmount: 800000,
      remainingBalance: 520000,
      monthlyInstallment: 4000,
      loanDurationMonths: 200,
      elapsedMonths: 70,
      loanType: 'housing_loan',
      totalOverdue: 12000,
      missedMonths: 3,
      delayDays: 90,
      status: 'active',
      issueDate: '2018-05-12',
    }
  ],
  // Fatima's IDN
  '784-1985-2345678-2': [
    {
      housingAssistanceNumber: 'SZHP-2020-00456',
      originalAmount: 500000,
      remainingBalance: 350000,
      monthlyInstallment: 2500,
      loanDurationMonths: 200,
      elapsedMonths: 60,
      loanType: 'maintenance_loan',
      totalOverdue: 0,
      missedMonths: 0,
      delayDays: 0,
      status: 'active',
      issueDate: '2020-01-15',
    }
  ],
  // Mohammed's IDN
  '784-1988-3456789-3': [
    {
      housingAssistanceNumber: 'SZHP-2015-00890',
      originalAmount: 1200000,
      remainingBalance: 600000,
      monthlyInstallment: 5000,
      loanDurationMonths: 240,
      elapsedMonths: 120,
      loanType: 'housing_loan',
      totalOverdue: 20000,
      missedMonths: 4,
      delayDays: 125,
      status: 'active',
      issueDate: '2015-11-22',
    }
  ],
  // Noura's IDN
  '784-1992-4567890-4': [
    {
      housingAssistanceNumber: 'SZHP-2021-01234',
      originalAmount: 600000,
      remainingBalance: 480000,
      monthlyInstallment: 3000,
      loanDurationMonths: 200,
      elapsedMonths: 40,
      loanType: 'housing_loan',
      totalOverdue: 6000,
      missedMonths: 2,
      delayDays: 60,
      status: 'active',
      issueDate: '2021-08-05',
    }
  ],
  // Khalifa's IDN
  '784-1983-5678901-5': [
    {
      housingAssistanceNumber: 'SZHP-2010-09876',
      originalAmount: 1500000,
      remainingBalance: 150000,
      monthlyInstallment: 6250,
      loanDurationMonths: 240,
      elapsedMonths: 216,
      loanType: 'housing_loan',
      totalOverdue: 0,
      missedMonths: 0,
      delayDays: 0,
      status: 'active',
      issueDate: '2010-03-10',
    }
  ]
}

// Random name pools for generating random mock users
const FIRST_NAMES_EN_MALE = ['Omar', 'Yousuf', 'Hamad', 'Rashid', 'Sultan', 'Faisal', 'Majed', 'Tariq', 'Zayed', 'Obaid']
const FIRST_NAMES_EN_FEMALE = ['Hind', 'Latifa', 'Sheikha', 'Hessa', 'Maitha', 'Shamsa', 'Amna', 'Fatma', 'Mouza', 'Alya']
const LAST_NAMES_EN = ['Al Nuaimi', 'Al Dhaheri', 'Al Shamsi', 'Al Qubaisi', 'Al Suwaidi', 'Al Hashmi', 'Al Muhairi', 'Al Tenaiji', 'Al Mazrouei', 'Al Rumaithi']
const FIRST_NAMES_AR_MALE = ['عمر', 'يوسف', 'حمد', 'راشد', 'سلطان', 'فيصل', 'ماجد', 'طارق', 'زايد', 'عبيد']
const FIRST_NAMES_AR_FEMALE = ['هند', 'لطيفة', 'شيخة', 'حصة', 'ميثاء', 'شمسة', 'أمينة', 'فاطمة', 'موزة', 'علياء']
const LAST_NAMES_AR = ['النعيمي', 'الظاهري', 'الشامسي', 'القبيسي', 'السويدي', 'الهاشمي', 'المهيري', 'الطنيجي', 'المزروعي', 'الرميثي']
const EMPLOYERS_GOV = ['Abu Dhabi Executive Council', 'Dubai Municipality', 'Ministry of Education', 'Ministry of Health', 'Federal Authority for Identity']
const EMPLOYERS_SEMI = ['Emirates NBD', 'Etisalat', 'ADNOC', 'Emirates Airlines', 'Dubai Properties']
const EMPLOYERS_PRIV = ['Al Futtaim Group', 'Majid Al Futtaim', 'Private Trading LLC', 'Gulf Business Group', 'Al Naboodah Holdings']

export function generateRandomMockUser(): MockUserProfile {
  const isMale = Math.random() > 0.5
  const gender = isMale ? 'male' : 'female'
  const firstEN = isMale 
    ? FIRST_NAMES_EN_MALE[Math.floor(Math.random() * FIRST_NAMES_EN_MALE.length)]
    : FIRST_NAMES_EN_FEMALE[Math.floor(Math.random() * FIRST_NAMES_EN_FEMALE.length)]
  const lastEN = LAST_NAMES_EN[Math.floor(Math.random() * LAST_NAMES_EN.length)]
  const firstAR = isMale
    ? FIRST_NAMES_AR_MALE[Math.floor(Math.random() * FIRST_NAMES_AR_MALE.length)]
    : FIRST_NAMES_AR_FEMALE[Math.floor(Math.random() * FIRST_NAMES_AR_FEMALE.length)]
  const lastAR = LAST_NAMES_AR[Math.floor(Math.random() * LAST_NAMES_AR.length)]
  
  const birthYear = 1975 + Math.floor(Math.random() * 25)
  const idnSeq = String(Math.floor(Math.random() * 9000000) + 1000000)
  const idnCheck = String(Math.floor(Math.random() * 9) + 1)
  
  const employerTypes: Array<'government' | 'semi-government' | 'private'> = ['government', 'semi-government', 'private']
  const employerType = employerTypes[Math.floor(Math.random() * employerTypes.length)]
  let employer: string
  if (employerType === 'government') employer = EMPLOYERS_GOV[Math.floor(Math.random() * EMPLOYERS_GOV.length)]
  else if (employerType === 'semi-government') employer = EMPLOYERS_SEMI[Math.floor(Math.random() * EMPLOYERS_SEMI.length)]
  else employer = EMPLOYERS_PRIV[Math.floor(Math.random() * EMPLOYERS_PRIV.length)]
  
  const monthlyIncome = 5000 + Math.floor(Math.random() * 40000)
  const familySize = 2 + Math.floor(Math.random() * 8)
  const phoneNum = '+97150' + String(Math.floor(Math.random() * 9000000) + 1000000)
  
  const uuid = crypto.randomUUID ? crypto.randomUUID() : 
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
    })

  return {
    sub: `UAEPASS/${uuid}`,
    firstnameEN: firstEN,
    lastnameEN: lastEN,
    firstnameAR: firstAR,
    lastnameAR: lastAR,
    fullnameEN: `${firstEN} ${lastEN}`,
    fullnameAR: `${firstAR} ${lastAR}`,
    email: `${firstEN.toLowerCase().replace(/\s/g, '')}.${lastEN.toLowerCase().replace(/\s/g, '')}@email.ae`,
    mobile: phoneNum,
    idn: `784-${birthYear}-${idnSeq}-${idnCheck}`,
    nationalityEN: 'Emirati',
    nationalityAR: isMale ? 'إماراتي' : 'إماراتية',
    gender,
    dob: `${birthYear}-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`,
    sopLevel: Math.random() > 0.3 ? 'sop2' : 'sop3',
    exp: Math.floor(Date.now() / 1000) + 3600,
    role: 'citizen',
    monthlyIncome,
    employer,
    employerType,
    familySize,
    hasActiveLoan: Math.random() > 0.3,
  }
}

// UAE PASS OAuth2 endpoints
export function getUAEPEndpoints(env: 'staging' | 'production') {
  const base = env === 'staging' ? 'https://stg-id.uaepass.ae' : 'https://id.uaepass.ae'
  return {
    authorize: `${base}/idshub/authorize`,
    token: `${base}/idshub/token`,
    userinfo: `${base}/idshub/userinfo`,
    logout: `${base}/idshub/session/end`,
  }
}

// Generate UAE PASS authorization URL (for production mode)
export function generateUAEPassAuthUrl(params: {
  clientId: string
  redirectUri: string
  scope?: string
  state?: string
  codeChallenge?: string
  env?: 'staging' | 'production'
  acrValues?: string
}) {
  const endpoints = getUAEPEndpoints(params.env || 'staging')
  const url = new URL(endpoints.authorize)
  url.searchParams.set('client_id', params.clientId)
  url.searchParams.set('redirect_uri', params.redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', params.scope || 'openid profile email uaepass_metadata')
  url.searchParams.set('state', params.state || crypto.randomUUID())
  if (params.codeChallenge) {
    url.searchParams.set('code_challenge', params.codeChallenge)
    url.searchParams.set('code_challenge_method', 'S256')
  }
  if (params.acrValues) {
    url.searchParams.set('acr_values', params.acrValues)
  }
  return url.toString()
}
