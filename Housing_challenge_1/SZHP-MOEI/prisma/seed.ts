/**
 * SZHP Arrears Rescheduling System - Database Seed Script
 * Generates comprehensive synthetic data for the UAE housing program
 */

import { db } from '../src/lib/db';

async function main() {
  console.log('🌱 Seeding database...');

  // Clean existing data
  await db.auditLog.deleteMany();
  await db.aIAssessment.deleteMany();
  await db.reschedulingRequest.deleteMany();
  await db.arrear.deleteMany();
  await db.housingLoan.deleteMany();
  await db.applicant.deleteMany();
  await db.governanceRule.deleteMany();

  console.log('  ✓ Cleared existing data');

  // ── Applicants ──────────────────────────────────────────────
  const applicants = await Promise.all([
    db.applicant.create({
      data: {
        emiratesId: '784-1990-1234567-1',
        nameAr: 'محمد سعيد الراشدي',
        nameEn: 'Mohammed Saeed Al Rashidi',
        phone: '+971-50-123-4567',
        email: 'm.alrashidi@email.ae',
        monthlyIncome: 25000,
        employer: 'Abu Dhabi Executive Council',
        employerType: 'government',
        familySize: 6,
        isCitizen: true,
        hasFamilyBook: true,
      },
    }),
    db.applicant.create({
      data: {
        emiratesId: '784-1985-2345678-2',
        nameAr: 'فاطمة خالد المنصوري',
        nameEn: 'Fatima Khalid Al Mansouri',
        phone: '+971-50-234-5678',
        email: 'f.almansouri@email.ae',
        monthlyIncome: 18000,
        employer: 'Dubai Health Authority',
        employerType: 'government',
        familySize: 4,
        isCitizen: true,
        hasFamilyBook: true,
      },
    }),
    db.applicant.create({
      data: {
        emiratesId: '784-1988-3456789-3',
        nameAr: 'عبدالله محمد القبيسي',
        nameEn: 'Abdullah Mohammed Al Qubaisi',
        phone: '+971-55-345-6789',
        email: 'a.alqubaisi@email.ae',
        monthlyIncome: 15000,
        employer: 'Emirates NBD',
        employerType: 'semi-government',
        familySize: 5,
        isCitizen: true,
        hasFamilyBook: true,
      },
    }),
    db.applicant.create({
      data: {
        emiratesId: '784-1992-4567890-4',
        nameAr: 'نورة سلطان الزيودي',
        nameEn: 'Noura Sultan Al Zeyoudi',
        phone: '+971-50-456-7890',
        email: 'n.alzeyoudi@email.ae',
        monthlyIncome: 12000,
        employer: 'Etisalat',
        employerType: 'semi-government',
        familySize: 3,
        isCitizen: true,
        hasFamilyBook: true,
      },
    }),
    db.applicant.create({
      data: {
        emiratesId: '784-1983-5678901-5',
        nameAr: 'خليفة عمر الكعبي',
        nameEn: 'Khalifa Omar Al Kaabi',
        phone: '+971-55-567-8901',
        email: 'k.alkaabi@email.ae',
        monthlyIncome: 8000,
        employer: 'Private Trading LLC',
        employerType: 'private',
        familySize: 7,
        isCitizen: true,
        hasFamilyBook: true,
      },
    }),
    db.applicant.create({
      data: {
        emiratesId: '784-1995-6789012-6',
        nameAr: 'مريم حسن البلوشي',
        nameEn: 'Mariam Hassan Al Balushi',
        phone: '+971-50-678-9012',
        email: 'm.albalushi@email.ae',
        monthlyIncome: 35000,
        employer: 'Ministry of Finance',
        employerType: 'government',
        familySize: 4,
        isCitizen: true,
        hasFamilyBook: true,
      },
    }),
    db.applicant.create({
      data: {
        emiratesId: '784-1987-7890123-7',
        nameAr: 'أحمد راشد الشامسي',
        nameEn: 'Ahmed Rashid Al Shamsi',
        phone: '+971-55-789-0123',
        email: 'a.alshamsi@email.ae',
        monthlyIncome: 9500,
        employer: 'Al Shamsi Group',
        employerType: 'private',
        familySize: 6,
        isCitizen: true,
        hasFamilyBook: true,
      },
    }),
    db.applicant.create({
      data: {
        emiratesId: '784-1991-8901234-8',
        nameAr: 'عائشة عبدالرحمن الدرمكي',
        nameEn: 'Aisha Abdulrahman Al Darmaki',
        phone: '+971-50-890-1234',
        email: 'a.aldarmaki@email.ae',
        monthlyIncome: 22000,
        employer: 'Abu Dhabi National Oil Company',
        employerType: 'semi-government',
        familySize: 5,
        isCitizen: true,
        hasFamilyBook: true,
      },
    }),
    db.applicant.create({
      data: {
        emiratesId: '784-1979-9012345-9',
        nameAr: 'سعيد حمد العامري',
        nameEn: 'Saeed Hamad Al Ameri',
        phone: '+971-55-901-2345',
        email: 's.alameri@email.ae',
        monthlyIncome: 4500,
        employer: 'Retired - Ministry of Education',
        employerType: 'government',
        familySize: 3,
        isCitizen: true,
        hasFamilyBook: true,
      },
    }),
    db.applicant.create({
      data: {
        emiratesId: '784-1993-0123456-0',
        nameAr: 'لطيفة محمد الظاهري',
        nameEn: 'Latifa Mohammed Al Dhaheri',
        phone: '+971-50-012-3456',
        email: 'l.aldhaheri@email.ae',
        monthlyIncome: 16000,
        employer: 'Sharjah Islamic Financial Center',
        employerType: 'semi-government',
        familySize: 4,
        isCitizen: true,
        hasFamilyBook: true,
      },
    }),
    db.applicant.create({
      data: {
        emiratesId: '784-1986-1122334-1',
        nameAr: 'يوسف إبراهيم النقبي',
        nameEn: 'Yousuf Ibrahim Al Naqbi',
        phone: '+971-55-112-2334',
        email: 'y.alnaqbi@email.ae',
        monthlyIncome: 11000,
        employer: 'Ras Al Khaimah Free Zone Authority',
        employerType: 'government',
        familySize: 5,
        isCitizen: true,
        hasFamilyBook: true,
      },
    }),
    db.applicant.create({
      data: {
        emiratesId: '784-1994-2233445-2',
        nameAr: 'هند عبدالله المزروعي',
        nameEn: 'Hind Abdullah Al Mazrouei',
        phone: '+971-50-223-3445',
        email: 'h.almazrouei@email.ae',
        monthlyIncome: 28000,
        employer: 'Mubadala Development Company',
        employerType: 'semi-government',
        familySize: 3,
        isCitizen: true,
        hasFamilyBook: true,
      },
    }),
    db.applicant.create({
      data: {
        emiratesId: '784-1982-3344556-3',
        nameAr: 'عبدالعزيز سالم الهاملي',
        nameEn: 'Abdulaziz Salem Al Hammadi',
        phone: '+971-55-334-4556',
        email: 'a.alhammadi@email.ae',
        monthlyIncome: 6500,
        employer: 'Unemployed (Former - Al Hammadi Trading)',
        employerType: 'private',
        familySize: 8,
        isCitizen: true,
        hasFamilyBook: true,
      },
    }),
    db.applicant.create({
      data: {
        emiratesId: '784-1996-4455667-4',
        nameAr: 'شيخة راشد الطنيجي',
        nameEn: 'Sheikha Rashid Al Tunaiji',
        phone: '+971-50-445-5667',
        email: 's.altunaiji@email.ae',
        monthlyIncome: 19000,
        employer: 'Federal Authority for Identity and Citizenship',
        employerType: 'government',
        familySize: 4,
        isCitizen: true,
        hasFamilyBook: true,
      },
    }),
    db.applicant.create({
      data: {
        emiratesId: '784-1989-5566778-5',
        nameAr: 'ماجد خميس السويدي',
        nameEn: 'Majid Khamis Al Suwaidi',
        phone: '+971-55-556-6778',
        email: 'm.alsuwaidi@email.ae',
        monthlyIncome: 14000,
        employer: 'Dubai Properties Group',
        employerType: 'semi-government',
        familySize: 6,
        isCitizen: true,
        hasFamilyBook: true,
      },
    }),
  ]);

  console.log(`  ✓ Created ${applicants.length} applicants`);

  // ── Housing Loans ───────────────────────────────────────────
  const loans = await Promise.all([
    db.housingLoan.create({
      data: {
        applicantId: applicants[0].id,
        originalAmount: 600000,
        remainingBalance: 420000,
        monthlyInstallment: 3500,
        loanDurationMonths: 240,
        elapsedMonths: 96,
        interestRate: 0,
        loanType: 'loan',
        disbursementDate: new Date('2017-01-15'),
        status: 'active',
      },
    }),
    db.housingLoan.create({
      data: {
        applicantId: applicants[1].id,
        originalAmount: 500000,
        remainingBalance: 350000,
        monthlyInstallment: 2800,
        loanDurationMonths: 180,
        elapsedMonths: 72,
        interestRate: 0,
        loanType: 'grant',
        disbursementDate: new Date('2019-06-01'),
        status: 'active',
      },
    }),
    db.housingLoan.create({
      data: {
        applicantId: applicants[2].id,
        originalAmount: 750000,
        remainingBalance: 580000,
        monthlyInstallment: 4200,
        loanDurationMonths: 300,
        elapsedMonths: 60,
        interestRate: 0,
        loanType: 'loan',
        disbursementDate: new Date('2020-03-20'),
        status: 'active',
      },
    }),
    db.housingLoan.create({
      data: {
        applicantId: applicants[3].id,
        originalAmount: 400000,
        remainingBalance: 280000,
        monthlyInstallment: 2200,
        loanDurationMonths: 180,
        elapsedMonths: 54,
        interestRate: 0,
        loanType: 'maintenance',
        disbursementDate: new Date('2020-09-10'),
        status: 'active',
      },
    }),
    db.housingLoan.create({
      data: {
        applicantId: applicants[4].id,
        originalAmount: 300000,
        remainingBalance: 245000,
        monthlyInstallment: 2500,
        loanDurationMonths: 120,
        elapsedMonths: 22,
        interestRate: 0,
        loanType: 'loan',
        disbursementDate: new Date('2023-08-01'),
        status: 'defaulted',
      },
    }),
    db.housingLoan.create({
      data: {
        applicantId: applicants[5].id,
        originalAmount: 800000,
        remainingBalance: 600000,
        monthlyInstallment: 4800,
        loanDurationMonths: 240,
        elapsedMonths: 48,
        interestRate: 0,
        loanType: 'loan',
        disbursementDate: new Date('2021-04-15'),
        status: 'active',
      },
    }),
    db.housingLoan.create({
      data: {
        applicantId: applicants[6].id,
        originalAmount: 350000,
        remainingBalance: 290000,
        monthlyInstallment: 2900,
        loanDurationMonths: 120,
        elapsedMonths: 20,
        interestRate: 0,
        loanType: 'loan',
        disbursementDate: new Date('2023-10-01'),
        status: 'defaulted',
      },
    }),
    db.housingLoan.create({
      data: {
        applicantId: applicants[7].id,
        originalAmount: 650000,
        remainingBalance: 480000,
        monthlyInstallment: 3600,
        loanDurationMonths: 180,
        elapsedMonths: 48,
        interestRate: 0,
        loanType: 'grant',
        disbursementDate: new Date('2021-06-01'),
        status: 'active',
      },
    }),
    db.housingLoan.create({
      data: {
        applicantId: applicants[8].id,
        originalAmount: 450000,
        remainingBalance: 120000,
        monthlyInstallment: 1500,
        loanDurationMonths: 300,
        elapsedMonths: 240,
        interestRate: 0,
        loanType: 'loan',
        disbursementDate: new Date('2005-01-01'),
        status: 'active',
      },
    }),
    db.housingLoan.create({
      data: {
        applicantId: applicants[9].id,
        originalAmount: 550000,
        remainingBalance: 400000,
        monthlyInstallment: 3200,
        loanDurationMonths: 180,
        elapsedMonths: 48,
        interestRate: 0,
        loanType: 'loan',
        disbursementDate: new Date('2021-07-01'),
        status: 'active',
      },
    }),
    db.housingLoan.create({
      data: {
        applicantId: applicants[10].id,
        originalAmount: 200000,
        remainingBalance: 160000,
        monthlyInstallment: 1600,
        loanDurationMonths: 120,
        elapsedMonths: 24,
        interestRate: 0,
        loanType: 'maintenance',
        disbursementDate: new Date('2023-06-15'),
        status: 'active',
      },
    }),
    db.housingLoan.create({
      data: {
        applicantId: applicants[11].id,
        originalAmount: 700000,
        remainingBalance: 520000,
        monthlyInstallment: 4000,
        loanDurationMonths: 240,
        elapsedMonths: 60,
        interestRate: 0,
        loanType: 'loan',
        disbursementDate: new Date('2020-01-01'),
        status: 'active',
      },
    }),
    db.housingLoan.create({
      data: {
        applicantId: applicants[12].id,
        originalAmount: 250000,
        remainingBalance: 210000,
        monthlyInstallment: 2100,
        loanDurationMonths: 120,
        elapsedMonths: 18,
        interestRate: 0,
        loanType: 'loan',
        disbursementDate: new Date('2024-01-01'),
        status: 'defaulted',
      },
    }),
    db.housingLoan.create({
      data: {
        applicantId: applicants[13].id,
        originalAmount: 500000,
        remainingBalance: 380000,
        monthlyInstallment: 2800,
        loanDurationMonths: 180,
        elapsedMonths: 42,
        interestRate: 0,
        loanType: 'grant',
        disbursementDate: new Date('2021-11-01'),
        status: 'active',
      },
    }),
    db.housingLoan.create({
      data: {
        applicantId: applicants[14].id,
        originalAmount: 450000,
        remainingBalance: 330000,
        monthlyInstallment: 2500,
        loanDurationMonths: 180,
        elapsedMonths: 48,
        interestRate: 0,
        loanType: 'loan',
        disbursementDate: new Date('2021-05-01'),
        status: 'active',
      },
    }),
    // Extra loans for some applicants (to test multiple loans)
    db.housingLoan.create({
      data: {
        applicantId: applicants[0].id,
        originalAmount: 150000,
        remainingBalance: 90000,
        monthlyInstallment: 1250,
        loanDurationMonths: 120,
        elapsedMonths: 48,
        interestRate: 0,
        loanType: 'maintenance',
        disbursementDate: new Date('2021-04-01'),
        status: 'active',
      },
    }),
    db.housingLoan.create({
      data: {
        applicantId: applicants[1].id,
        originalAmount: 200000,
        remainingBalance: 150000,
        monthlyInstallment: 1100,
        loanDurationMonths: 180,
        elapsedMonths: 54,
        interestRate: 0,
        loanType: 'maintenance',
        disbursementDate: new Date('2020-07-01'),
        status: 'active',
      },
    }),
    db.housingLoan.create({
      data: {
        applicantId: applicants[5].id,
        originalAmount: 100000,
        remainingBalance: 70000,
        monthlyInstallment: 830,
        loanDurationMonths: 120,
        elapsedMonths: 36,
        interestRate: 0,
        loanType: 'maintenance',
        disbursementDate: new Date('2022-06-01'),
        status: 'active',
      },
    }),
    db.housingLoan.create({
      data: {
        applicantId: applicants[7].id,
        originalAmount: 180000,
        remainingBalance: 120000,
        monthlyInstallment: 1000,
        loanDurationMonths: 180,
        elapsedMonths: 60,
        interestRate: 0,
        loanType: 'maintenance',
        disbursementDate: new Date('2020-03-01'),
        status: 'active',
      },
    }),
    db.housingLoan.create({
      data: {
        applicantId: applicants[11].id,
        originalAmount: 120000,
        remainingBalance: 90000,
        monthlyInstallment: 1000,
        loanDurationMonths: 120,
        elapsedMonths: 30,
        interestRate: 0,
        loanType: 'maintenance',
        disbursementDate: new Date('2022-12-01'),
        status: 'active',
      },
    }),
  ]);

  console.log(`  ✓ Created ${loans.length} housing loans`);

  // ── Arrears ─────────────────────────────────────────────────
  const arrears = await Promise.all([
    db.arrear.create({
      data: {
        loanId: loans[0].id,
        missedMonths: 4,
        totalOverdue: 14000,
        delayDays: 120,
        reason: 'salary_cut',
      },
    }),
    db.arrear.create({
      data: {
        loanId: loans[1].id,
        missedMonths: 2,
        totalOverdue: 5600,
        delayDays: 60,
        reason: 'medical',
      },
    }),
    db.arrear.create({
      data: {
        loanId: loans[2].id,
        missedMonths: 6,
        totalOverdue: 25200,
        delayDays: 200,
        reason: 'job_loss',
      },
    }),
    db.arrear.create({
      data: {
        loanId: loans[3].id,
        missedMonths: 3,
        totalOverdue: 6600,
        delayDays: 90,
        reason: 'divorce',
      },
    }),
    db.arrear.create({
      data: {
        loanId: loans[4].id,
        missedMonths: 8,
        totalOverdue: 20000,
        delayDays: 300,
        reason: 'job_loss',
      },
    }),
    db.arrear.create({
      data: {
        loanId: loans[5].id,
        missedMonths: 1,
        totalOverdue: 4800,
        delayDays: 30,
        reason: 'other',
      },
    }),
    db.arrear.create({
      data: {
        loanId: loans[6].id,
        missedMonths: 5,
        totalOverdue: 14500,
        delayDays: 150,
        reason: 'salary_cut',
      },
    }),
    db.arrear.create({
      data: {
        loanId: loans[7].id,
        missedMonths: 2,
        totalOverdue: 7200,
        delayDays: 55,
        reason: 'medical',
      },
    }),
    db.arrear.create({
      data: {
        loanId: loans[8].id,
        missedMonths: 7,
        totalOverdue: 10500,
        delayDays: 210,
        reason: 'retirement',
      },
    }),
    db.arrear.create({
      data: {
        loanId: loans[9].id,
        missedMonths: 3,
        totalOverdue: 9600,
        delayDays: 85,
        reason: 'other',
      },
    }),
    db.arrear.create({
      data: {
        loanId: loans[10].id,
        missedMonths: 2,
        totalOverdue: 3200,
        delayDays: 45,
        reason: 'salary_cut',
      },
    }),
    db.arrear.create({
      data: {
        loanId: loans[12].id,
        missedMonths: 4,
        totalOverdue: 8400,
        delayDays: 110,
        reason: 'job_loss',
      },
    }),
    db.arrear.create({
      data: {
        loanId: loans[14].id,
        missedMonths: 1,
        totalOverdue: 2800,
        delayDays: 25,
        reason: 'medical',
      },
    }),
    db.arrear.create({
      data: {
        loanId: loans[15].id,
        missedMonths: 3,
        totalOverdue: 3750,
        delayDays: 75,
        reason: 'salary_cut',
      },
    }),
    db.arrear.create({
      data: {
        loanId: loans[17].id,
        missedMonths: 2,
        totalOverdue: 2000,
        delayDays: 40,
        reason: 'other',
      },
    }),
  ]);

  console.log(`  ✓ Created ${arrears.length} arrears records`);

  // ── Rescheduling Requests ───────────────────────────────────
  const requests = await Promise.all([
    db.reschedulingRequest.create({
      data: {
        applicantId: applicants[0].id,
        loanId: loans[0].id,
        requestedDurationMonths: 300,
        reason: 'Salary reduction due to economic restructuring at government entity',
        reasonCategory: 'salary_cut',
        supportingDocuments: JSON.stringify(['salary_certificate', 'bank_statements_3m', 'employer_letter']),
        status: 'approved',
        priority: 'normal',
        reviewedBy: 'employee:ahmed.h@szhp.ae',
        reviewedAt: new Date('2025-01-15'),
      },
    }),
    db.reschedulingRequest.create({
      data: {
        applicantId: applicants[1].id,
        loanId: loans[1].id,
        requestedDurationMonths: 240,
        reason: 'Medical treatment costs for family member exceeded insurance coverage',
        reasonCategory: 'medical',
        supportingDocuments: JSON.stringify(['medical_report', 'hospital_bills', 'insurance_rejection_letter']),
        status: 'ai_assessed',
        priority: 'urgent',
      },
    }),
    db.reschedulingRequest.create({
      data: {
        applicantId: applicants[2].id,
        loanId: loans[2].id,
        requestedDurationMonths: 360,
        reason: 'Complete job loss - company closure and liquidation',
        reasonCategory: 'job_loss',
        supportingDocuments: JSON.stringify(['termination_letter', 'labour_ministry_certificate', 'bank_statements_6m']),
        status: 'under_review',
        priority: 'critical',
      },
    }),
    db.reschedulingRequest.create({
      data: {
        applicantId: applicants[3].id,
        loanId: loans[3].id,
        requestedDurationMonths: 240,
        reason: 'Divorce settlement requiring restructuring of joint financial obligations',
        reasonCategory: 'divorce',
        supportingDocuments: JSON.stringify(['divorce_certificate', 'court_settlement', 'alimony_order']),
        status: 'escalated',
        priority: 'urgent',
      },
    }),
    db.reschedulingRequest.create({
      data: {
        applicantId: applicants[4].id,
        loanId: loans[4].id,
        requestedDurationMonths: 180,
        reason: 'Extended unemployment after private sector company downsizing',
        reasonCategory: 'job_loss',
        supportingDocuments: JSON.stringify(['termination_letter', 'job_seeker_registration']),
        status: 'rejected',
        priority: 'critical',
        reviewedBy: 'employee:fatima.m@szhp.ae',
        reviewedAt: new Date('2025-02-01'),
        notes: 'Applicant does not meet DBR requirements even after rescheduling. Recommended for social aid referral.',
      },
    }),
    db.reschedulingRequest.create({
      data: {
        applicantId: applicants[5].id,
        loanId: loans[5].id,
        requestedDurationMonths: 300,
        reason: 'Temporary financial difficulty due to one-time unexpected expense',
        reasonCategory: 'other',
        supportingDocuments: JSON.stringify(['bank_statements_3m']),
        status: 'pending',
        priority: 'normal',
      },
    }),
    db.reschedulingRequest.create({
      data: {
        applicantId: applicants[6].id,
        loanId: loans[6].id,
        requestedDurationMonths: 180,
        reason: 'Significant salary cut due to company financial difficulties',
        reasonCategory: 'salary_cut',
        supportingDocuments: JSON.stringify(['salary_certificate', 'employer_letter', 'bank_statements_3m']),
        status: 'ai_assessed',
        priority: 'urgent',
      },
    }),
    db.reschedulingRequest.create({
      data: {
        applicantId: applicants[7].id,
        loanId: loans[7].id,
        requestedDurationMonths: 240,
        reason: 'Ongoing medical treatment requiring frequent hospital visits and medication',
        reasonCategory: 'medical',
        supportingDocuments: JSON.stringify(['medical_report', 'prescription_list', 'insurance_statement']),
        status: 'approved',
        priority: 'normal',
        reviewedBy: 'employee:khalid.s@szhp.ae',
        reviewedAt: new Date('2025-01-20'),
      },
    }),
    db.reschedulingRequest.create({
      data: {
        applicantId: applicants[8].id,
        loanId: loans[8].id,
        requestedDurationMonths: 120,
        reason: 'Retirement income insufficient to maintain existing payment schedule',
        reasonCategory: 'retirement',
        supportingDocuments: JSON.stringify(['pension_certificate', 'retirement_letter', 'bank_statements_6m']),
        status: 'ai_assessed',
        priority: 'urgent',
      },
    }),
    db.reschedulingRequest.create({
      data: {
        applicantId: applicants[9].id,
        loanId: loans[9].id,
        requestedDurationMonths: 240,
        reason: 'Unexpected financial obligations requiring temporary payment relief',
        reasonCategory: 'other',
        supportingDocuments: JSON.stringify(['bank_statements_3m', 'expense_documentation']),
        status: 'pending',
        priority: 'normal',
      },
    }),
    db.reschedulingRequest.create({
      data: {
        applicantId: applicants[10].id,
        loanId: loans[10].id,
        requestedDurationMonths: 180,
        reason: 'Salary reduction due to employer cost-cutting measures',
        reasonCategory: 'salary_cut',
        supportingDocuments: JSON.stringify(['salary_certificate', 'employer_letter']),
        status: 'pending',
        priority: 'normal',
      },
    }),
    db.reschedulingRequest.create({
      data: {
        applicantId: applicants[12].id,
        loanId: loans[12].id,
        requestedDurationMonths: 180,
        reason: 'Complete job loss - employer ceased operations',
        reasonCategory: 'job_loss',
        supportingDocuments: JSON.stringify(['termination_letter', 'labour_ministry_certificate']),
        status: 'under_review',
        priority: 'critical',
      },
    }),
  ]);

  console.log(`  ✓ Created ${requests.length} rescheduling requests`);

  // ── AI Assessments ──────────────────────────────────────────
  const assessments = await Promise.all([
    db.aIAssessment.create({
      data: {
        requestId: requests[0].id,
        riskScore: 32,
        riskLevel: 'medium',
        confidenceScore: 87,
        recommendedAmount: 434000,
        recommendedDuration: 300,
        recommendedInstallment: 1447,
        debtBurdenRatio: 0.19,
        proposedDBR: 0.058,
        eligibilityStatus: 'eligible',
        decisionRationale: JSON.stringify({
          primary_factors: [
            'Government employee with stable income',
            'Moderate delay duration (120 days)',
            'Reasonable DBR after rescheduling',
          ],
          recommendation: 'Approve rescheduling with standard terms',
          conditions: [
            'Maintain current employment for 12 months',
            'No further arrears during probation period',
          ],
        }),
        governanceCompliance: JSON.stringify([
          { ruleCode: 'ELIG-CITIZENSHIP', passed: true, message: 'UAE citizen verified' },
          { ruleCode: 'ELIG-FAMILY_BOOK', passed: true, message: 'Family book verified' },
          { ruleCode: 'DBR-001', passed: true, message: 'DBR 5.8% within 60% limit' },
          { ruleCode: 'DUR-001', passed: true, message: 'Duration within 360-month maximum' },
          { ruleCode: 'AMT-001', passed: true, message: 'Amount within AED 800,000 cap' },
        ]),
        riskFactors: JSON.stringify([
          { factor: 'salary_cut', severity: 'medium', description: 'Income reduction of approximately 20%' },
          { factor: 'delay_duration', severity: 'medium', description: '120 days of arrears' },
        ]),
        shapExplanation: JSON.stringify([
          { feature: 'employer_type_government', value: 1, contribution: -12, description: 'Government employment reduces risk by 12 points' },
          { feature: 'dbr_after', value: 0.058, contribution: -8, description: 'Low post-rescheduling DBR reduces risk by 8 points' },
          { feature: 'delay_days', value: 120, contribution: 15, description: 'Delay duration adds 15 risk points' },
          { feature: 'reason_salary_cut', value: 1, contribution: 10, description: 'Salary cut reason adds 10 risk points' },
          { feature: 'family_size', value: 6, contribution: 7, description: 'Large family size adds 7 risk points' },
        ]),
        requiresHumanReview: false,
        aiModelVersion: 'v1.0',
        processingTimeMs: 2340,
      },
    }),
    db.aIAssessment.create({
      data: {
        requestId: requests[1].id,
        riskScore: 28,
        riskLevel: 'low',
        confidenceScore: 82,
        recommendedAmount: 355600,
        recommendedDuration: 240,
        recommendedInstallment: 1482,
        debtBurdenRatio: 0.216,
        proposedDBR: 0.082,
        eligibilityStatus: 'eligible',
        decisionRationale: JSON.stringify({
          primary_factors: [
            'Government employee with stable income',
            'Medical hardship with documented evidence',
            'Short delay duration (60 days)',
          ],
          recommendation: 'Approve with medical hardship provisions - consider 3-month grace period',
          conditions: [
            'Provide updated medical reports every 6 months',
            'Grace period of 3 months before rescheduled payments begin',
          ],
        }),
        governanceCompliance: JSON.stringify([
          { ruleCode: 'ELIG-CITIZENSHIP', passed: true, message: 'UAE citizen verified' },
          { ruleCode: 'ELIG-FAMILY_BOOK', passed: true, message: 'Family book verified' },
          { ruleCode: 'DBR-001', passed: true, message: 'DBR 8.2% within 60% limit' },
          { ruleCode: 'HARDSHIP-001', passed: true, message: 'Medical hardship qualifies for special provisions' },
        ]),
        riskFactors: JSON.stringify([
          { factor: 'medical', severity: 'low', description: 'Medical hardship with documented evidence' },
          { factor: 'short_delay', severity: 'low', description: 'Only 60 days of arrears' },
        ]),
        shapExplanation: JSON.stringify([
          { feature: 'employer_type_government', value: 1, contribution: -12, description: 'Government employment reduces risk by 12 points' },
          { feature: 'medical_hardship', value: 1, contribution: -5, description: 'Medical hardship with documentation reduces risk' },
          { feature: 'delay_days', value: 60, contribution: 8, description: 'Short delay adds minimal risk' },
          { feature: 'income_level', value: 18000, contribution: 8, description: 'Moderate income level' },
        ]),
        requiresHumanReview: false,
        humanReviewReason: null,
        aiModelVersion: 'v1.0',
        processingTimeMs: 1890,
      },
    }),
    db.aIAssessment.create({
      data: {
        requestId: requests[6].id,
        riskScore: 65,
        riskLevel: 'high',
        confidenceScore: 75,
        recommendedAmount: 304500,
        recommendedDuration: 180,
        recommendedInstallment: 1692,
        debtBurdenRatio: 0.305,
        proposedDBR: 0.178,
        eligibilityStatus: 'conditionally_eligible',
        decisionRationale: JSON.stringify({
          primary_factors: [
            'Private sector employee with income reduction',
            'Extended delay period (150 days)',
            'DBR within limits but tight',
          ],
          recommendation: 'Conditionally approve with enhanced monitoring and shorter review cycle',
          conditions: [
            'Quarterly income verification required',
            'Must secure new employment within 6 months if job loss occurs',
            'Higher frequency payment monitoring',
          ],
        }),
        governanceCompliance: JSON.stringify([
          { ruleCode: 'ELIG-CITIZENSHIP', passed: true, message: 'UAE citizen verified' },
          { ruleCode: 'ELIG-FAMILY_BOOK', passed: true, message: 'Family book verified' },
          { ruleCode: 'DBR-001', passed: true, message: 'DBR 17.8% within 60% limit' },
          { ruleCode: 'DELAY-001', passed: false, message: 'Delay of 150 days - close to 180-day threshold' },
        ]),
        riskFactors: JSON.stringify([
          { factor: 'private_employer', severity: 'high', description: 'Private sector employment with higher income volatility' },
          { factor: 'salary_cut', severity: 'medium', description: 'Significant salary reduction' },
          { factor: 'delay_duration', severity: 'high', description: '150 days of arrears approaching high-risk threshold' },
          { factor: 'large_family', severity: 'medium', description: '6 family members increase financial obligations' },
        ]),
        shapExplanation: JSON.stringify([
          { feature: 'employer_type_private', value: 1, contribution: 10, description: 'Private employment adds 10 risk points' },
          { feature: 'delay_days', value: 150, contribution: 15, description: 'Extended delay adds 15 risk points' },
          { feature: 'salary_cut', value: 1, contribution: 10, description: 'Salary cut adds 10 risk points' },
          { feature: 'family_size', value: 6, contribution: 7, description: 'Large family size adds 7 risk points' },
          { feature: 'income_level', value: 9500, contribution: 15, description: 'Lower income level adds 15 risk points' },
          { feature: 'dbr_after', value: 0.178, contribution: -12, description: 'Reasonable DBR after rescheduling reduces risk' },
        ]),
        requiresHumanReview: true,
        humanReviewReason: 'High risk score (65) and private sector employment require manual verification of income stability',
        aiModelVersion: 'v1.0',
        processingTimeMs: 3120,
      },
    }),
    db.aIAssessment.create({
      data: {
        requestId: requests[7].id,
        riskScore: 25,
        riskLevel: 'low',
        confidenceScore: 90,
        recommendedAmount: 487200,
        recommendedDuration: 240,
        recommendedInstallment: 2030,
        debtBurdenRatio: 0.209,
        proposedDBR: 0.092,
        eligibilityStatus: 'eligible',
        decisionRationale: JSON.stringify({
          primary_factors: [
            'Semi-government employee with stable income',
            'Medical hardship well documented',
            'Short delay with strong payment history prior to event',
          ],
          recommendation: 'Approve with standard medical hardship provisions',
          conditions: [
            '6-month grace period for medical recovery',
            'Updated medical reports every 6 months',
          ],
        }),
        governanceCompliance: JSON.stringify([
          { ruleCode: 'ELIG-CITIZENSHIP', passed: true, message: 'UAE citizen verified' },
          { ruleCode: 'ELIG-FAMILY_BOOK', passed: true, message: 'Family book verified' },
          { ruleCode: 'DBR-001', passed: true, message: 'DBR 9.2% within 60% limit' },
          { ruleCode: 'HARDSHIP-001', passed: true, message: 'Medical hardship qualifies for special provisions' },
        ]),
        riskFactors: JSON.stringify([
          { factor: 'medical', severity: 'low', description: 'Medical hardship with full documentation' },
          { factor: 'short_delay', severity: 'low', description: '55 days of arrears' },
        ]),
        shapExplanation: JSON.stringify([
          { feature: 'employer_type_semi_gov', value: 1, contribution: -5, description: 'Semi-government employment reduces risk by 5 points' },
          { feature: 'income_level', value: 22000, contribution: 8, description: 'Good income level' },
          { feature: 'medical_hardship', value: 1, contribution: -3, description: 'Medical hardship with documentation' },
          { feature: 'delay_days', value: 55, contribution: 5, description: 'Short delay adds minimal risk' },
        ]),
        requiresHumanReview: false,
        aiModelVersion: 'v1.0',
        processingTimeMs: 2100,
      },
    }),
    db.aIAssessment.create({
      data: {
        requestId: requests[8].id,
        riskScore: 58,
        riskLevel: 'high',
        confidenceScore: 70,
        recommendedAmount: 130500,
        recommendedDuration: 120,
        recommendedInstallment: 1088,
        debtBurdenRatio: 0.333,
        proposedDBR: 0.242,
        eligibilityStatus: 'conditionally_eligible',
        decisionRationale: JSON.stringify({
          primary_factors: [
            'Retiree with limited fixed income',
            'Extended delay period (210 days)',
            'Retirement hardship qualifies for special provisions',
          ],
          recommendation: 'Approve with retirement hardship provisions and income verification from pension fund',
          conditions: [
            'Pension income verification required',
            'Reduced installment with extended duration',
            'Annual income reassessment',
          ],
        }),
        governanceCompliance: JSON.stringify([
          { ruleCode: 'ELIG-CITIZENSHIP', passed: true, message: 'UAE citizen verified' },
          { ruleCode: 'ELIG-FAMILY_BOOK', passed: true, message: 'Family book verified' },
          { ruleCode: 'DBR-001', passed: true, message: 'DBR 24.2% within 60% limit' },
          { ruleCode: 'HARDSHIP-001', passed: true, message: 'Retirement hardship qualifies for special provisions' },
          { ruleCode: 'DELAY-001', passed: false, message: 'Delay of 210 days exceeds 180-day threshold' },
        ]),
        riskFactors: JSON.stringify([
          { factor: 'retirement', severity: 'medium', description: 'Fixed pension income with no growth potential' },
          { factor: 'delay_duration', severity: 'high', description: '210 days of arrears exceeds high-risk threshold' },
          { factor: 'low_income', severity: 'high', description: 'Pension income of AED 4,500 is very low' },
        ]),
        shapExplanation: JSON.stringify([
          { feature: 'employer_type_government', value: 1, contribution: -12, description: 'Former government employment reduces risk' },
          { feature: 'retirement_hardship', value: 1, contribution: -5, description: 'Retirement hardship qualifies for special handling' },
          { feature: 'delay_days', value: 210, contribution: 25, description: 'Extended delay adds significant risk' },
          { feature: 'income_level', value: 4500, contribution: 20, description: 'Very low income adds substantial risk' },
          { feature: 'dbr_after', value: 0.242, contribution: -5, description: 'Reasonable post-rescheduling DBR' },
        ]),
        requiresHumanReview: true,
        humanReviewReason: 'Retirement case with extended delay requires manual review of pension adequacy and social support options',
        aiModelVersion: 'v1.0',
        processingTimeMs: 2780,
      },
    }),
    db.aIAssessment.create({
      data: {
        requestId: requests[4].id,
        riskScore: 82,
        riskLevel: 'critical',
        confidenceScore: 68,
        recommendedAmount: 0,
        recommendedDuration: 0,
        recommendedInstallment: 0,
        debtBurdenRatio: 0.313,
        proposedDBR: 0.35,
        eligibilityStatus: 'ineligible',
        decisionRationale: JSON.stringify({
          primary_factors: [
            'Private sector employee currently unemployed',
            'Very high DBR even after rescheduling attempts',
            'Extended delay (300 days) with no income recovery',
            'Large family with significant financial obligations',
          ],
          recommendation: 'Reject rescheduling - refer to social aid program for direct assistance',
          conditions: [
            'Refer to Social Support Program for basic needs assistance',
            'Reapply for rescheduling when employment is secured',
            'Consider partial loan write-off under extreme hardship provisions',
          ],
        }),
        governanceCompliance: JSON.stringify([
          { ruleCode: 'ELIG-CITIZENSHIP', passed: true, message: 'UAE citizen verified' },
          { ruleCode: 'ELIG-FAMILY_BOOK', passed: true, message: 'Family book verified' },
          { ruleCode: 'DBR-001', passed: false, message: 'DBR 35% even with minimal installment - no feasible rescheduling' },
          { ruleCode: 'DELAY-001', passed: false, message: 'Delay of 300 days - critical threshold exceeded' },
        ]),
        riskFactors: JSON.stringify([
          { factor: 'unemployment', severity: 'critical', description: 'Currently unemployed with no income source' },
          { factor: 'delay_duration', severity: 'critical', description: '300 days of arrears - critical' },
          { factor: 'large_family', severity: 'high', description: '8 family members - extreme financial pressure' },
          { factor: 'private_employer', severity: 'high', description: 'Private sector with no job security' },
        ]),
        shapExplanation: JSON.stringify([
          { feature: 'unemployment', value: 1, contribution: 25, description: 'Unemployment is the dominant risk factor' },
          { feature: 'delay_days', value: 300, contribution: 30, description: 'Extended critical delay' },
          { feature: 'family_size', value: 8, contribution: 10, description: 'Very large family increases obligations' },
          { feature: 'employer_type_private', value: 1, contribution: 10, description: 'Private sector employment adds risk' },
          { feature: 'income_level', value: 6500, contribution: 15, description: 'Low income even when employed' },
        ]),
        requiresHumanReview: true,
        humanReviewReason: 'Critical risk case requiring senior management decision and possible social aid referral',
        aiModelVersion: 'v1.0',
        processingTimeMs: 3500,
      },
    }),
    db.aIAssessment.create({
      data: {
        requestId: requests[3].id,
        riskScore: 45,
        riskLevel: 'medium',
        confidenceScore: 72,
        recommendedAmount: 286600,
        recommendedDuration: 240,
        recommendedInstallment: 1194,
        debtBurdenRatio: 0.183,
        proposedDBR: 0.1,
        eligibilityStatus: 'conditionally_eligible',
        decisionRationale: JSON.stringify({
          primary_factors: [
            'Divorce settlement impacts financial obligations',
            'Reasonable income but new alimony obligations',
            'Requires joint liability assessment',
          ],
          recommendation: 'Conditionally approve pending divorce settlement verification and alimony impact assessment',
          conditions: [
            'Final divorce decree required',
            'Alimony impact assessment needed',
            'Joint liability review if applicable',
          ],
        }),
        governanceCompliance: JSON.stringify([
          { ruleCode: 'ELIG-CITIZENSHIP', passed: true, message: 'UAE citizen verified' },
          { ruleCode: 'ELIG-FAMILY_BOOK', passed: true, message: 'Family book verified' },
          { ruleCode: 'DBR-001', passed: true, message: 'DBR 10% within 60% limit' },
          { ruleCode: 'HARDSHIP-001', passed: true, message: 'Divorce hardship qualifies for special provisions' },
        ]),
        riskFactors: JSON.stringify([
          { factor: 'divorce', severity: 'medium', description: 'Divorce creates uncertain financial obligations' },
          { factor: 'potential_alimony', severity: 'medium', description: 'Alimony may increase monthly obligations significantly' },
        ]),
        shapExplanation: JSON.stringify([
          { feature: 'employer_type_semi_gov', value: 1, contribution: -5, description: 'Semi-government employment reduces risk' },
          { feature: 'divorce_hardship', value: 1, contribution: -3, description: 'Divorce qualifies for special handling' },
          { feature: 'delay_days', value: 90, contribution: 15, description: 'Moderate delay adds risk' },
          { feature: 'income_level', value: 12000, contribution: 15, description: 'Lower income level adds risk' },
        ]),
        requiresHumanReview: true,
        humanReviewReason: 'Divorce case requires verification of settlement terms and alimony obligations',
        aiModelVersion: 'v1.0',
        processingTimeMs: 2650,
      },
    }),
    db.aIAssessment.create({
      data: {
        requestId: requests[2].id,
        riskScore: 72,
        riskLevel: 'high',
        confidenceScore: 65,
        recommendedAmount: 605200,
        recommendedDuration: 300,
        recommendedInstallment: 2017,
        debtBurdenRatio: 0.28,
        proposedDBR: 0.134,
        eligibilityStatus: 'conditionally_eligible',
        decisionRationale: JSON.stringify({
          primary_factors: [
            'Complete job loss due to company closure',
            'High remaining balance on large loan',
            'Previous semi-government employment suggests re-employability',
          ],
          recommendation: 'Conditionally approve with mandatory employment verification and reduced initial payments',
          conditions: [
            'Must provide proof of active job search quarterly',
            'Reduced payments for first 6 months (50% of installment)',
            'Full review after 6 months or when employment is secured',
          ],
        }),
        governanceCompliance: JSON.stringify([
          { ruleCode: 'ELIG-CITIZENSHIP', passed: true, message: 'UAE citizen verified' },
          { ruleCode: 'ELIG-FAMILY_BOOK', passed: true, message: 'Family book verified' },
          { ruleCode: 'DBR-001', passed: true, message: 'DBR 13.4% within 60% limit assuming income recovery' },
          { ruleCode: 'DELAY-001', passed: false, message: 'Delay of 200 days exceeds threshold' },
        ]),
        riskFactors: JSON.stringify([
          { factor: 'job_loss', severity: 'critical', description: 'Complete job loss - no current income' },
          { factor: 'delay_duration', severity: 'high', description: '200 days of arrears' },
          { factor: 'high_balance', severity: 'medium', description: 'AED 580,000 remaining balance' },
        ]),
        shapExplanation: JSON.stringify([
          { feature: 'job_loss', value: 1, contribution: 25, description: 'Job loss is the primary risk driver' },
          { feature: 'delay_days', value: 200, contribution: 25, description: 'Extended delay adds significant risk' },
          { feature: 'former_employer_type', value: 1, contribution: -5, description: 'Former semi-government employment slightly reduces risk' },
          { feature: 'income_potential', value: 15000, contribution: -8, description: 'Previous income suggests re-employability' },
        ]),
        requiresHumanReview: true,
        humanReviewReason: 'Job loss case with extended delay requires income recovery plan verification',
        aiModelVersion: 'v1.0',
        processingTimeMs: 2900,
      },
    }),
  ]);

  console.log(`  ✓ Created ${assessments.length} AI assessments`);

  // ── Audit Logs ──────────────────────────────────────────────
  const auditLogs = await Promise.all([
    db.auditLog.create({
      data: {
        requestId: requests[0].id,
        action: 'created',
        performedBy: 'system',
        details: JSON.stringify({ message: 'Rescheduling request created by applicant via portal' }),
        timestamp: new Date('2025-01-02T10:30:00Z'),
      },
    }),
    db.auditLog.create({
      data: {
        requestId: requests[0].id,
        action: 'assessed',
        performedBy: 'system:ai_v1.0',
        details: JSON.stringify({ message: 'AI assessment completed', riskScore: 32, riskLevel: 'medium', processingTimeMs: 2340 }),
        timestamp: new Date('2025-01-02T10:31:00Z'),
      },
    }),
    db.auditLog.create({
      data: {
        requestId: requests[0].id,
        action: 'approved',
        performedBy: 'employee:ahmed.h@szhp.ae',
        details: JSON.stringify({ message: 'Request approved with standard terms', approvedDuration: 300, approvedInstallment: 1447 }),
        timestamp: new Date('2025-01-15T14:00:00Z'),
      },
    }),
    db.auditLog.create({
      data: {
        requestId: requests[1].id,
        action: 'created',
        performedBy: 'system',
        details: JSON.stringify({ message: 'Rescheduling request created - medical hardship' }),
        timestamp: new Date('2025-01-10T09:00:00Z'),
      },
    }),
    db.auditLog.create({
      data: {
        requestId: requests[1].id,
        action: 'assessed',
        performedBy: 'system:ai_v1.0',
        details: JSON.stringify({ message: 'AI assessment completed', riskScore: 28, riskLevel: 'low', processingTimeMs: 1890 }),
        timestamp: new Date('2025-01-10T09:01:00Z'),
      },
    }),
    db.auditLog.create({
      data: {
        requestId: requests[2].id,
        action: 'created',
        performedBy: 'system',
        details: JSON.stringify({ message: 'Rescheduling request created - job loss case' }),
        timestamp: new Date('2025-01-08T11:00:00Z'),
      },
    }),
    db.auditLog.create({
      data: {
        requestId: requests[2].id,
        action: 'modified',
        performedBy: 'employee:ahmed.h@szhp.ae',
        details: JSON.stringify({ message: 'Priority escalated to critical due to job loss and extended delay', previousPriority: 'urgent' }),
        timestamp: new Date('2025-01-09T10:00:00Z'),
      },
    }),
    db.auditLog.create({
      data: {
        requestId: requests[3].id,
        action: 'created',
        performedBy: 'system',
        details: JSON.stringify({ message: 'Rescheduling request created - divorce settlement case' }),
        timestamp: new Date('2025-01-05T13:00:00Z'),
      },
    }),
    db.auditLog.create({
      data: {
        requestId: requests[3].id,
        action: 'assessed',
        performedBy: 'system:ai_v1.0',
        details: JSON.stringify({ message: 'AI assessment completed', riskScore: 45, riskLevel: 'medium', processingTimeMs: 2650 }),
        timestamp: new Date('2025-01-05T13:01:00Z'),
      },
    }),
    db.auditLog.create({
      data: {
        requestId: requests[3].id,
        action: 'escalated',
        performedBy: 'employee:fatima.m@szhp.ae',
        details: JSON.stringify({ message: 'Escalated for legal review of divorce settlement terms' }),
        timestamp: new Date('2025-01-12T09:30:00Z'),
      },
    }),
    db.auditLog.create({
      data: {
        requestId: requests[4].id,
        action: 'created',
        performedBy: 'system',
        details: JSON.stringify({ message: 'Rescheduling request created - unemployment case' }),
        timestamp: new Date('2024-12-20T08:00:00Z'),
      },
    }),
    db.auditLog.create({
      data: {
        requestId: requests[4].id,
        action: 'assessed',
        performedBy: 'system:ai_v1.0',
        details: JSON.stringify({ message: 'AI assessment completed', riskScore: 82, riskLevel: 'critical', processingTimeMs: 3500 }),
        timestamp: new Date('2024-12-20T08:01:00Z'),
      },
    }),
    db.auditLog.create({
      data: {
        requestId: requests[4].id,
        action: 'rejected',
        performedBy: 'employee:fatima.m@szhp.ae',
        details: JSON.stringify({ message: 'Request rejected - does not meet DBR requirements. Referred to social aid program.' }),
        timestamp: new Date('2025-02-01T11:00:00Z'),
      },
    }),
    db.auditLog.create({
      data: {
        requestId: requests[5].id,
        action: 'created',
        performedBy: 'system',
        details: JSON.stringify({ message: 'Rescheduling request created via portal' }),
        timestamp: new Date('2025-02-10T14:00:00Z'),
      },
    }),
    db.auditLog.create({
      data: {
        requestId: requests[6].id,
        action: 'created',
        performedBy: 'system',
        details: JSON.stringify({ message: 'Rescheduling request created - salary cut case' }),
        timestamp: new Date('2025-01-15T10:00:00Z'),
      },
    }),
    db.auditLog.create({
      data: {
        requestId: requests[6].id,
        action: 'assessed',
        performedBy: 'system:ai_v1.0',
        details: JSON.stringify({ message: 'AI assessment completed', riskScore: 65, riskLevel: 'high', processingTimeMs: 3120 }),
        timestamp: new Date('2025-01-15T10:01:00Z'),
      },
    }),
    db.auditLog.create({
      data: {
        requestId: requests[7].id,
        action: 'created',
        performedBy: 'system',
        details: JSON.stringify({ message: 'Rescheduling request created - medical case' }),
        timestamp: new Date('2025-01-05T09:00:00Z'),
      },
    }),
    db.auditLog.create({
      data: {
        requestId: requests[7].id,
        action: 'assessed',
        performedBy: 'system:ai_v1.0',
        details: JSON.stringify({ message: 'AI assessment completed', riskScore: 25, riskLevel: 'low', processingTimeMs: 2100 }),
        timestamp: new Date('2025-01-05T09:01:00Z'),
      },
    }),
    db.auditLog.create({
      data: {
        requestId: requests[7].id,
        action: 'approved',
        performedBy: 'employee:khalid.s@szhp.ae',
        details: JSON.stringify({ message: 'Approved with medical hardship provisions and 6-month grace period' }),
        timestamp: new Date('2025-01-20T14:30:00Z'),
      },
    }),
    db.auditLog.create({
      data: {
        requestId: requests[8].id,
        action: 'created',
        performedBy: 'system',
        details: JSON.stringify({ message: 'Rescheduling request created - retirement case' }),
        timestamp: new Date('2025-01-12T11:00:00Z'),
      },
    }),
    db.auditLog.create({
      data: {
        requestId: requests[8].id,
        action: 'document_verified',
        performedBy: 'employee:sara.a@szhp.ae',
        details: JSON.stringify({ message: 'Pension certificate and retirement documents verified' }),
        timestamp: new Date('2025-01-14T10:00:00Z'),
      },
    }),
    db.auditLog.create({
      data: {
        requestId: requests[8].id,
        action: 'assessed',
        performedBy: 'system:ai_v1.0',
        details: JSON.stringify({ message: 'AI assessment completed', riskScore: 58, riskLevel: 'high', processingTimeMs: 2780 }),
        timestamp: new Date('2025-01-14T10:01:00Z'),
      },
    }),
    db.auditLog.create({
      data: {
        requestId: requests[9].id,
        action: 'created',
        performedBy: 'system',
        details: JSON.stringify({ message: 'Rescheduling request created via portal' }),
        timestamp: new Date('2025-02-15T15:00:00Z'),
      },
    }),
    db.auditLog.create({
      data: {
        requestId: requests[10].id,
        action: 'created',
        performedBy: 'system',
        details: JSON.stringify({ message: 'Rescheduling request created - salary cut case' }),
        timestamp: new Date('2025-02-18T09:30:00Z'),
      },
    }),
    db.auditLog.create({
      data: {
        requestId: requests[11].id,
        action: 'created',
        performedBy: 'system',
        details: JSON.stringify({ message: 'Rescheduling request created - job loss case' }),
        timestamp: new Date('2025-02-20T08:00:00Z'),
      },
    }),
  ]);

  console.log(`  ✓ Created ${auditLogs.length} audit log entries`);

  // ── Governance Rules ────────────────────────────────────────
  const governanceRules = await Promise.all([
    db.governanceRule.create({
      data: {
        ruleCode: 'ELIG-001',
        nameEn: 'UAE Citizenship Requirement',
        nameAr: 'شرط الجنسية الإماراتية',
        description: 'Applicant must be a UAE citizen to qualify for housing loan rescheduling through SZHP',
        category: 'eligibility',
        condition: JSON.stringify({ field: 'isCitizen', operator: 'equals', value: true }),
        isActive: true,
        priority: 1,
      },
    }),
    db.governanceRule.create({
      data: {
        ruleCode: 'ELIG-002',
        nameEn: 'Family Book Requirement',
        nameAr: 'شرط دفتر العائلة',
        description: 'Applicant must hold a valid UAE family book (Khulasat Al Qaid) to be eligible for rescheduling',
        category: 'eligibility',
        condition: JSON.stringify({ field: 'hasFamilyBook', operator: 'equals', value: true }),
        isActive: true,
        priority: 2,
      },
    }),
    db.governanceRule.create({
      data: {
        ruleCode: 'DBR-001',
        nameEn: 'Maximum Debt Burden Ratio',
        nameAr: 'الحد الأقصى لنسبة عبء الدين',
        description: 'Debt Burden Ratio must not exceed 60% after rescheduling. DBR = Total Monthly Obligations / Monthly Income',
        category: 'debt_burden',
        condition: JSON.stringify({ field: 'proposedDBR', operator: 'less_than_or_equal', value: 0.6 }),
        isActive: true,
        priority: 3,
      },
    }),
    db.governanceRule.create({
      data: {
        ruleCode: 'DUR-001',
        nameEn: 'Maximum Loan Duration',
        nameAr: 'الحد الأقصى لمدة القرض',
        description: 'Total loan duration including rescheduled period must not exceed 30 years (360 months)',
        category: 'duration',
        condition: JSON.stringify({ field: 'totalDurationMonths', operator: 'less_than_or_equal', value: 360 }),
        isActive: true,
        priority: 4,
      },
    }),
    db.governanceRule.create({
      data: {
        ruleCode: 'AMT-001',
        nameEn: 'Maximum Assistance Amount',
        nameAr: 'الحد الأقصى لمبلغ المساعدة',
        description: 'Housing loan amount must not exceed AED 800,000 for rescheduling eligibility',
        category: 'amount',
        condition: JSON.stringify({ field: 'originalAmount', operator: 'less_than_or_equal', value: 800000 }),
        isActive: true,
        priority: 5,
      },
    }),
    db.governanceRule.create({
      data: {
        ruleCode: 'RISK-001',
        nameEn: 'High Risk Delay Threshold',
        nameAr: 'عتبة التأخير عالية المخاطر',
        description: 'Arrears delay exceeding 180 days automatically classifies the case as high risk and requires senior management approval',
        category: 'risk',
        condition: JSON.stringify({ field: 'delayDays', operator: 'greater_than', value: 180, riskLevel: 'high' }),
        isActive: true,
        priority: 6,
      },
    }),
    db.governanceRule.create({
      data: {
        ruleCode: 'EMPL-001',
        nameEn: 'Government Employee Risk Weighting',
        nameAr: 'توزيع المخاطر لموظفي الحكومة',
        description: 'Government employees receive reduced risk weighting due to employment stability and predictable income',
        category: 'eligibility',
        condition: JSON.stringify({ field: 'employerType', operator: 'equals', value: 'government', riskAdjustment: -10 }),
        isActive: true,
        priority: 7,
      },
    }),
    db.governanceRule.create({
      data: {
        ruleCode: 'HARD-001',
        nameEn: 'Medical Hardship Provision',
        nameAr: 'حكم المشقة الطبية',
        description: 'Applicants with documented medical hardship qualify for grace period of up to 6 months and special handling provisions',
        category: 'eligibility',
        condition: JSON.stringify({ field: 'reasonCategory', operator: 'equals', value: 'medical', gracePeriodMonths: 6 }),
        isActive: true,
        priority: 8,
      },
    }),
    db.governanceRule.create({
      data: {
        ruleCode: 'HARD-002',
        nameEn: 'Divorce Hardship Provision',
        nameAr: 'حكم المشقة بسبب الطلاق',
        description: 'Divorce cases require joint liability assessment and alimony impact review before rescheduling approval',
        category: 'documentation',
        condition: JSON.stringify({ field: 'reasonCategory', operator: 'equals', value: 'divorce', requiresJointLiabilityReview: true, requiresAlimonyAssessment: true }),
        isActive: true,
        priority: 9,
      },
    }),
    db.governanceRule.create({
      data: {
        ruleCode: 'HARD-003',
        nameEn: 'Retirement Hardship Provision',
        nameAr: 'حكم المشقة بسبب التقاعد',
        description: 'Retired applicants must verify pension income. Special consideration for reduced installments based on fixed pension amounts',
        category: 'eligibility',
        condition: JSON.stringify({ field: 'reasonCategory', operator: 'equals', value: 'retirement', requiresPensionVerification: true, allowsReducedInstallment: true }),
        isActive: true,
        priority: 10,
      },
    }),
  ]);

  console.log(`  ✓ Created ${governanceRules.length} governance rules`);
  console.log('\n✅ Seed completed successfully!');
  console.log(`  Summary:`);
  console.log(`    ${applicants.length} Applicants`);
  console.log(`    ${loans.length} Housing Loans`);
  console.log(`    ${arrears.length} Arrears Records`);
  console.log(`    ${requests.length} Rescheduling Requests`);
  console.log(`    ${assessments.length} AI Assessments`);
  console.log(`    ${auditLogs.length} Audit Log Entries`);
  console.log(`    ${governanceRules.length} Governance Rules`);
}

main()
  .then(async () => {
    await db.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Seed failed:', e);
    await db.$disconnect();
    process.exit(1);
  });
