/**
 * SZHP Arrears Rescheduling System - MOEI Real Data Seed Script
 * Reads real MOEI data from CSV files (converted from Excel) and seeds the database
 */

import { db } from '../src/lib/db';
import Papa from 'papaparse';
import * as fs from 'fs';
import * as path from 'path';

// ── Types for CSV data ────────────────────────────────────────────
interface MoeiRow2023_2024 {
  ID: string;
  APPLICANT: string;
  APPLICATION_ID: string;
  AGREEMENT_ID: string;
  EDB_LOAN_ID: string;
  EDB_CUSTOMER_ID: string;
  REQUEST_TYPE: string;
  CURRENT_SALARY: string;
  OVER_DUE_AMT: string;
  OVER_DUE_MONTHS: string;
  DEDUCT_FROM_SALARY: string;
  APPROVED_REQUEST_TYPE: string;
  NEW_EMI_APPLICABLE_MONTHS: string;
  CURRENT_EMI_AMT: string;
  NEW_EMI_AMT: string;
  CREATED_DATE: string;
  STATUS: string;
  APPROVED_DATE: string;
  JUSTIFICATIONS: string;
  REMARKS: string;
  UNTIL_LOAN_END: string;
  ADDITIONAL_MONTHS: string;
  ADDITIONAL_PREMIUM: string;
  AUTH_SIGNATORY?: string;
  START_MONTH: string;
  START_YEAR: string;
}

interface MoeiRow2025 {
  APPLICATION_ID: string;
  AGREEMENT_ID: string;
  EDB_LOAN_ID: string;
  EDB_CUSTOMER_ID: string;
  CURRENT_SALARY: string;
  OVER_DUE_AMT: string;
  OVER_DUE_MONTHS: string;
  DEDUCT_FROM_SALARY: string;
  APPROVED_REQUEST_TYPE: string;
  NEW_EMI_APPLICABLE_MONTHS: string;
  CURRENT_EMI_AMT: string;
  NEW_EMI_AMT: string;
  CREATED_DATE: string;
  STATUS: string;
  CREATED_BY: string;
  APPROVED_DATE: string;
  JUSTIFICATIONS: string;
  REMARKS: string;
  UNTIL_LOAN_END: string;
  ADDITIONAL_MONTHS: string;
  ADDITIONAL_PREMIUM: string;
  START_MONTH: string;
  START_YEAR: string;
}

// ── Helper functions ──────────────────────────────────────────────

function parseFloatSafe(val: string | undefined | null): number {
  if (!val || val.trim() === '') return 0;
  const n = parseFloat(val.replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
}

function parseIntSafe(val: string | undefined | null): number {
  if (!val || val.trim() === '') return 0;
  const n = parseInt(val.replace(/,/g, ''), 10);
  return isNaN(n) ? 0 : n;
}

function parseDateSafe(val: string | undefined | null): Date | null {
  if (!val || val.trim() === '') return null;
  try {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

// Generate a realistic Emirates ID from the MOEI applicant code
function generateEmiratesId(applicantCode: string, index: number): string {
  // Extract year from the code if possible (e.g., MMOEI_197830121657 -> 1978)
  const yearMatch = applicantCode.match(/(\d{4})/);
  const year = yearMatch ? yearMatch[1] : '1985';
  const seq = String(index).padStart(6, '0');
  const checksum = String((index * 7) % 10);
  return `784-${year}-${seq}-1`;
}

// Generate Arabic name placeholder from applicant code
function generateArabicName(applicantCode: string, index: number): string {
  const familyNames = [
    'الراشدي', 'المنصوري', 'القبيسي', 'الزيودي', 'الكعبي',
    'البلوشي', 'الشامسي', 'الدرمكي', 'العامري', 'الظاهري',
    'النقبي', 'المزروعي', 'الهاملي', 'الطنيجي', 'السويدي',
    'الحوسني', 'الحمادي', 'السعدي', 'الشرقي', 'المهيري',
    'الظنحاني', 'الشحي', 'الخاطر', 'النعيمي', 'البادي',
  ];
  const firstNames = [
    'محمد', 'أحمد', 'خليفة', 'سعيد', 'عبدالله',
    'فاطمة', 'نورة', 'مريم', 'عائشة', 'هند',
    'يوسف', 'عبدالعزيز', 'شيخة', 'ماجد', 'لطيفة',
    'عمر', 'حمد', 'سالم', 'راشد', 'خالد',
  ];
  const first = firstNames[index % firstNames.length];
  const family = familyNames[index % familyNames.length];
  return `${first} ${family}`;
}

function generateEnglishName(applicantCode: string, index: number): string {
  const familyNames = [
    'Al Rashidi', 'Al Mansouri', 'Al Qubaisi', 'Al Zeyoudi', 'Al Kaabi',
    'Al Balushi', 'Al Shamsi', 'Al Darmaki', 'Al Ameri', 'Al Dhaheri',
    'Al Naqbi', 'Al Mazrouei', 'Al Hammadi', 'Al Tunaiji', 'Al Suwaidi',
    'Al Hosani', 'Al Hamadi', 'Al Saadi', 'Al Sharqi', 'Al Mahri',
    'Al Dhahani', 'Al Shehhi', 'Al Khatir', 'Al Naimi', 'Al Badi',
  ];
  const firstNames = [
    'Mohammed', 'Ahmed', 'Khalifa', 'Saeed', 'Abdullah',
    'Fatima', 'Noura', 'Mariam', 'Aisha', 'Hind',
    'Yousuf', 'Abdulaziz', 'Sheikha', 'Majid', 'Latifa',
    'Omar', 'Hamad', 'Salem', 'Rashid', 'Khalid',
  ];
  const first = firstNames[index % firstNames.length];
  const family = familyNames[index % familyNames.length];
  return `${first} ${family}`;
}

// Map overdue months to a reason category
function inferReasonCategory(overdueMonths: number, salary: number, emiAmount: number): string {
  const dbr = salary > 0 ? emiAmount / salary : 1;
  if (overdueMonths >= 10) return 'job_loss';
  if (overdueMonths >= 6) return 'salary_cut';
  if (dbr > 0.3) return 'other';
  return 'salary_cut';
}

// Generate a synthetic phone number
function generatePhone(index: number): string {
  const prefix = index % 2 === 0 ? '50' : '55';
  const num = String(1000000 + ((index * 7919) % 9000000));
  return `+971-${prefix}-${num.slice(0, 3)}-${num.slice(3, 7)}`;
}

// Generate payment history JSON from loan data
function generatePaymentHistory(
  elapsedMonths: number,
  monthlyInstallment: number,
  missedMonths: number
): string {
  const history: Array<{ month: number; year: number; status: string; amount: number }> = [];
  const now = new Date();
  for (let i = 0; i < Math.min(elapsedMonths, 24); i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const isMissed = i < missedMonths;
    history.push({
      month: d.getMonth() + 1,
      year: d.getFullYear(),
      status: isMissed ? 'missed' : 'paid',
      amount: isMissed ? 0 : monthlyInstallment,
    });
  }
  return JSON.stringify(history);
}

// Calculate risk score from data
function calculateRiskScore(
  salary: number,
  overdueAmount: number,
  overdueMonths: number,
  currentEmi: number
): number {
  const dbr = salary > 0 ? currentEmi / salary : 1;
  let score = 0;
  // DBR contribution (0-30)
  score += Math.min(dbr * 50, 30);
  // Overdue months contribution (0-40)
  score += Math.min(overdueMonths * 3, 40);
  // Overdue amount relative to salary (0-20)
  const overdueRatio = salary > 0 ? overdueAmount / (salary * 12) : 1;
  score += Math.min(overdueRatio * 20, 20);
  // Base risk (0-10)
  score += 5;
  return Math.min(Math.round(score), 100);
}

// Determine risk level from score
function getRiskLevel(score: number): string {
  if (score >= 75) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 25) return 'medium';
  return 'low';
}

// ── Main seed function ────────────────────────────────────────────

async function main() {
  console.log('🌱 Seeding MOEI real data...');
  console.log('=' .repeat(60));

  // ── Step 1: Read and parse CSV files ──────────────────────────
  const prismaDir = path.dirname(__filename);

  interface NormalizedRow {
    applicantCode: string;
    applicationId: string;
    agreementId: string;
    edbLoanId: string;
    currentSalary: number;
    overDueAmt: number;
    overDueMonths: number;
    deductFromSalary: string;
    approvedRequestType: string;
    currentEmiAmt: number;
    newEmiAmt: number;
    createdDate: string;
    status: string;
    approvedDate: string;
    justifications: string;
    additionalMonths: number;
    additionalPremium: number;
    startMonth: number;
    startYear: number;
    year: string; // which sheet it came from
  }

  const allRows: NormalizedRow[] = [];

  // Parse 2023 sheet
  const csv2023 = fs.readFileSync(path.join(prismaDir, 'moei_data_2023.csv'), 'utf-8');
  const parsed2023 = Papa.parse<MoeiRow2023_2024>(csv2023, { header: true, skipEmptyLines: true });
  console.log(`  📊 2023 sheet: ${parsed2023.data.length} rows`);

  for (const row of parsed2023.data) {
    if (!row.APPLICATION_ID || row.APPLICATION_ID.trim() === '') continue;
    allRows.push({
      applicantCode: row.APPLICANT || `MMOEI_UNKNOWN_${row.EDB_CUSTOMER_ID}`,
      applicationId: row.APPLICATION_ID,
      agreementId: row.AGREEMENT_ID || '',
      edbLoanId: row.EDB_LOAN_ID || '',
      currentSalary: parseFloatSafe(row.CURRENT_SALARY),
      overDueAmt: parseFloatSafe(row.OVER_DUE_AMT),
      overDueMonths: parseIntSafe(row.OVER_DUE_MONTHS),
      deductFromSalary: row.DEDUCT_FROM_SALARY || 'NO',
      approvedRequestType: row.APPROVED_REQUEST_TYPE || '',
      currentEmiAmt: parseFloatSafe(row.CURRENT_EMI_AMT),
      newEmiAmt: parseFloatSafe(row.NEW_EMI_AMT),
      createdDate: row.CREATED_DATE || '',
      status: row.STATUS || 'UNKNOWN',
      approvedDate: row.APPROVED_DATE || '',
      justifications: row.JUSTIFICATIONS || '',
      additionalMonths: parseIntSafe(row.ADDITIONAL_MONTHS),
      additionalPremium: parseFloatSafe(row.ADDITIONAL_PREMIUM),
      startMonth: parseIntSafe(row.START_MONTH),
      startYear: parseIntSafe(row.START_YEAR),
      year: '2023',
    });
  }

  // Parse 2024 sheet
  const csv2024 = fs.readFileSync(path.join(prismaDir, 'moei_data_2024.csv'), 'utf-8');
  const parsed2024 = Papa.parse<MoeiRow2023_2024>(csv2024, { header: true, skipEmptyLines: true });
  console.log(`  📊 2024 sheet: ${parsed2024.data.length} rows`);

  for (const row of parsed2024.data) {
    if (!row.APPLICATION_ID || row.APPLICATION_ID.trim() === '') continue;
    allRows.push({
      applicantCode: row.APPLICANT || `MMOEI_UNKNOWN_${row.EDB_CUSTOMER_ID}`,
      applicationId: row.APPLICATION_ID,
      agreementId: row.AGREEMENT_ID || '',
      edbLoanId: row.EDB_LOAN_ID || '',
      currentSalary: parseFloatSafe(row.CURRENT_SALARY),
      overDueAmt: parseFloatSafe(row.OVER_DUE_AMT),
      overDueMonths: parseIntSafe(row.OVER_DUE_MONTHS),
      deductFromSalary: row.DEDUCT_FROM_SALARY || 'NO',
      approvedRequestType: row.APPROVED_REQUEST_TYPE || '',
      currentEmiAmt: parseFloatSafe(row.CURRENT_EMI_AMT),
      newEmiAmt: parseFloatSafe(row.NEW_EMI_AMT),
      createdDate: row.CREATED_DATE || '',
      status: row.STATUS || 'UNKNOWN',
      approvedDate: row.APPROVED_DATE || '',
      justifications: row.JUSTIFICATIONS || '',
      additionalMonths: parseIntSafe(row.ADDITIONAL_MONTHS),
      additionalPremium: parseFloatSafe(row.ADDITIONAL_PREMIUM),
      startMonth: parseIntSafe(row.START_MONTH),
      startYear: parseIntSafe(row.START_YEAR),
      year: '2024',
    });
  }

  // Parse 2025 sheet (different structure - no ID/APPLICANT columns)
  const csv2025 = fs.readFileSync(path.join(prismaDir, 'moei_data_2025.csv'), 'utf-8');
  const parsed2025 = Papa.parse<MoeiRow2025>(csv2025, { header: true, skipEmptyLines: true });
  console.log(`  📊 2025 sheet: ${parsed2025.data.length} rows`);

  for (const row of parsed2025.data) {
    if (!row.APPLICATION_ID || row.APPLICATION_ID.trim() === '') continue;
    allRows.push({
      applicantCode: row.CREATED_BY || `MMOEI_UNKNOWN_${row.EDB_CUSTOMER_ID}`,
      applicationId: row.APPLICATION_ID,
      agreementId: row.AGREEMENT_ID || '',
      edbLoanId: row.EDB_LOAN_ID || '',
      currentSalary: parseFloatSafe(row.CURRENT_SALARY),
      overDueAmt: parseFloatSafe(row.OVER_DUE_AMT),
      overDueMonths: parseIntSafe(row.OVER_DUE_MONTHS),
      deductFromSalary: row.DEDUCT_FROM_SALARY || 'NO',
      approvedRequestType: row.APPROVED_REQUEST_TYPE || '',
      currentEmiAmt: parseFloatSafe(row.CURRENT_EMI_AMT),
      newEmiAmt: parseFloatSafe(row.NEW_EMI_AMT),
      createdDate: row.CREATED_DATE || '',
      status: row.STATUS || 'UNKNOWN',
      approvedDate: row.APPROVED_DATE || '',
      justifications: row.JUSTIFICATIONS || '',
      additionalMonths: parseIntSafe(row.ADDITIONAL_MONTHS),
      additionalPremium: parseFloatSafe(row.ADDITIONAL_PREMIUM),
      startMonth: parseIntSafe(row.START_MONTH),
      startYear: parseIntSafe(row.START_YEAR),
      year: '2025',
    });
  }

  console.log(`\n  📊 Total rows from all sheets: ${allRows.length}`);

  // ── Step 2: Group by unique applicant ─────────────────────────
  // Use a Map keyed by applicantCode to deduplicate
  const applicantMap = new Map<string, NormalizedRow[]>();
  for (const row of allRows) {
    const key = row.applicantCode;
    if (!applicantMap.has(key)) {
      applicantMap.set(key, []);
    }
    applicantMap.get(key)!.push(row);
  }

  console.log(`  👤 Unique applicants: ${applicantMap.size}`);

  // ── Step 3: Clear existing MOEI-seeded data (keep other data) ──
  // We won't clear all data — instead we'll add MOEI records
  // But we need to clear existing to avoid conflicts on emiratesId
  // Check how many applicants already exist
  const existingCount = await db.applicant.count();

  // We'll use a prefix for MOEI-seeded emirates IDs to avoid conflicts
  // with existing synthetic data

  // ── Step 4: Seed data ─────────────────────────────────────────
  // Process a representative sample to keep database manageable
  // Take up to 200 applicants (sampling from each year)
  const MAX_APPLICANTS = 200;
  const applicantEntries = Array.from(applicantMap.entries());

  // Filter out entries with unreasonable salary data (likely data errors)
  const MAX_REASONABLE_SALARY = 500000; // AED - anything above is likely annual total or error
  const MIN_REASONABLE_SALARY = 1000; // AED - filter out zero/near-zero entries
  const filteredEntries = applicantEntries.filter(([_, rows]) => {
    const salary = rows[0].currentSalary;
    return salary >= MIN_REASONABLE_SALARY && salary <= MAX_REASONABLE_SALARY;
  });
  console.log(`  📊 After salary filtering: ${filteredEntries.length} applicants (removed ${applicantEntries.length - filteredEntries.length} with unreasonable salary)`);

  // Shuffle to get a representative sample across salary ranges
  for (let i = filteredEntries.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [filteredEntries[i], filteredEntries[j]] = [filteredEntries[j], filteredEntries[i]];
  }

  const selectedEntries = filteredEntries.slice(0, MAX_APPLICANTS);
  console.log(`  ✅ Processing ${selectedEntries.length} applicants (sampled)`);

  let applicantsCreated = 0;
  let loansCreated = 0;
  let arrearsCreated = 0;
  let requestsCreated = 0;
  let assessmentsCreated = 0;
  let globalCounter = 0; // Unique counter for each applicant

  // Marital status options for randomization
  const maritalStatuses = ['single', 'married', 'divorced', 'widowed'];
  const housingTypes = ['apartment', 'villa', 'land'];
  const employerTypes = ['government', 'semi-government', 'private'];
  const employerNames = [
    'Abu Dhabi Executive Council', 'Dubai Health Authority', 'Ministry of Finance',
    'Federal Authority for Identity and Citizenship', 'Emirates NBD', 'Etisalat',
    'ADNOC', 'Mubadala', 'Dubai Properties', 'RAK Free Zone',
    'Private Trading LLC', 'Al Shamsi Group', 'Sharjah Islamic Financial Center',
  ];

  // Process in batches to avoid memory issues
  const BATCH_SIZE = 50;
  for (let batchStart = 0; batchStart < selectedEntries.length; batchStart += BATCH_SIZE) {
    const batch = selectedEntries.slice(batchStart, batchStart + BATCH_SIZE);
    console.log(`\n  🔄 Processing batch ${Math.floor(batchStart / BATCH_SIZE) + 1}/${Math.ceil(selectedEntries.length / BATCH_SIZE)}...`);

    for (const [applicantCode, rows] of batch) {
      try {
        // Use first row for applicant-level data
        const primaryRow = rows[0];
        const globalIndex = globalCounter++;

        // ── Create Applicant ────────────────────────────────────
        const maritalStatus = maritalStatuses[globalIndex % maritalStatuses.length];
        const familySize = maritalStatus === 'married'
          ? 2 + (globalIndex % 6)
          : 1 + (globalIndex % 4);
        const numberOfChildren = maritalStatus === 'married'
          ? globalIndex % 5
          : 0;
        const spouseIncome = maritalStatus === 'married'
          ? Math.round(primaryRow.currentSalary * (0.3 + (globalIndex % 5) * 0.15))
          : 0;
        const totalHouseholdIncome = primaryRow.currentSalary + spouseIncome;
        const incomePerMember = familySize > 0 ? totalHouseholdIncome / familySize : totalHouseholdIncome;

        // Determine income stability based on data patterns
        let incomeStability = 'stable';
        if (primaryRow.overDueMonths >= 10) incomeStability = 'lost';
        else if (primaryRow.overDueMonths >= 5) incomeStability = 'reduced';
        else if (primaryRow.overDueMonths >= 2) incomeStability = 'variable';

        const previousIncome = incomeStability !== 'stable'
          ? Math.round(primaryRow.currentSalary * 1.25)
          : null;

        const applicant = await db.applicant.create({
          data: {
            emiratesId: `784-MOEI-${String(globalIndex + 50000).padStart(8, '0')}-1`,
            nameAr: generateArabicName(applicantCode, globalIndex),
            nameEn: generateEnglishName(applicantCode, globalIndex),
            phone: generatePhone(globalIndex),
            email: null,
            monthlyIncome: primaryRow.currentSalary,
            employer: employerNames[globalIndex % employerNames.length],
            employerType: employerTypes[globalIndex % employerTypes.length],
            familySize,
            isCitizen: true,
            hasFamilyBook: true,
            maritalStatus,
            spouseIncome,
            totalHouseholdIncome,
            incomeStability,
            previousIncome,
            numberOfChildren,
            housingType: housingTypes[globalIndex % housingTypes.length],
          },
        });
        applicantsCreated++;

        // ── Process each loan/request for this applicant ────────
        for (let rIdx = 0; rIdx < rows.length; rIdx++) {
          const row = rows[rIdx];
          const currentEmi = row.currentEmiAmt > 0 ? row.currentEmiAmt : 1000;
          const overdueMonths = row.overDueMonths || 1;
          const salary = row.currentSalary || 5000;

          // Calculate loan details
          const originalAmount = Math.round(currentEmi * 180); // ~15 year loan
          const totalPaid = Math.round(currentEmi * Math.max(0, 60 - overdueMonths));
          const remainingBalance = Math.max(0, originalAmount - totalPaid);
          const elapsedMonths = Math.max(overdueMonths, 12 + (rIdx * 6));
          const loanDurationMonths = Math.max(elapsedMonths + 60, 180);

          // ── Create HousingLoan ──────────────────────────────────
          const loan = await db.housingLoan.create({
            data: {
              applicantId: applicant.id,
              originalAmount,
              remainingBalance,
              monthlyInstallment: currentEmi,
              loanDurationMonths,
              elapsedMonths,
              interestRate: 0,
              loanType: rIdx === 0 ? 'loan' : (rIdx === 1 ? 'maintenance' : 'grant'),
              disbursementDate: new Date(
                parseInt(row.year) - Math.floor(elapsedMonths / 12),
                (12 - (elapsedMonths % 12)) % 12,
                15
              ),
              status: overdueMonths >= 6 ? 'defaulted' : 'active',
              paymentHistory: generatePaymentHistory(elapsedMonths, currentEmi, overdueMonths),
              totalPaid,
              totalMissedPayments: overdueMonths,
              reschedulingCount: rIdx, // first request = 0 reschedulings before
            },
          });
          loansCreated++;

          // ── Create Arrear ───────────────────────────────────────
          const delayDays = overdueMonths * 30 + (globalIndex % 15);
          const reasonCategory = inferReasonCategory(overdueMonths, salary, currentEmi);
          const firstMissedDate = new Date(
            parseInt(row.year),
            (row.startMonth || 1) - 1 - overdueMonths,
            1
          );

          const arrear = await db.arrear.create({
            data: {
              loanId: loan.id,
              missedMonths: overdueMonths,
              totalOverdue: row.overDueAmt,
              delayDays,
              reason: reasonCategory,
              consecutiveMissedMonths: overdueMonths,
              firstMissedDate: isNaN(firstMissedDate.getTime()) ? null : firstMissedDate,
              lastPaymentDate: null,
              lastPaymentAmount: currentEmi,
            },
          });
          arrearsCreated++;

          // ── Create ReschedulingRequest ──────────────────────────
          const newEmi = row.newEmiAmt || Math.round(currentEmi * 0.7);
          const requestedDuration = row.additionalMonths > 0
            ? loanDurationMonths + row.additionalMonths
            : loanDurationMonths + 60;
          
          const deductionRate = salary > 0 ? newEmi / salary : 0;
          const rule20Pass = deductionRate <= 0.20;

          // Determine request status
          let requestStatus = 'pending';
          if (row.status === 'APPROVED') requestStatus = 'approved';
          else if (row.status === 'REJECTED') requestStatus = 'rejected';
          else requestStatus = 'pending';

          const request = await db.reschedulingRequest.create({
            data: {
              applicantId: applicant.id,
              loanId: loan.id,
              requestedDurationMonths: requestedDuration,
              reason: row.justifications || null,
              reasonCategory,
              supportingDocuments: JSON.stringify(
                row.deductFromSalary === 'YES'
                  ? ['salary_certificate', 'bank_statements_3m']
                  : ['bank_statements_3m']
              ),
              status: requestStatus,
              priority: overdueMonths >= 6 ? 'critical' : overdueMonths >= 3 ? 'urgent' : 'normal',
              reviewedBy: requestStatus === 'approved' ? 'system:moei_bulk' : null,
              reviewedAt: requestStatus === 'approved' ? parseDateSafe(row.approvedDate) : null,
              incomePerFamilyMember: Math.round(incomePerMember * 100) / 100,
              deductionRate: Math.round(deductionRate * 10000) / 10000,
              documentCompleteness: row.deductFromSalary === 'YES' ? 'complete' : 'incomplete',
              missingDocuments: JSON.stringify(
                row.deductFromSalary === 'YES'
                  ? []
                  : ['salary_certificate', 'employer_letter']
              ),
              moeiCompliance: JSON.stringify([
                { rule: '20_percent_deduction', passed: rule20Pass, value: Math.round(deductionRate * 100) },
                { rule: 'salary_deduction_available', passed: row.deductFromSalary === 'YES' },
                { rule: 'min_income_per_member', passed: incomePerMember >= 2500, value: incomePerMember },
              ]),
            },
          });
          requestsCreated++;

          // ── Create AIAssessment for approved cases ──────────────
          if (requestStatus === 'approved' && rIdx === 0) {
            const riskScore = calculateRiskScore(salary, row.overDueAmt, overdueMonths, currentEmi);
            const riskLevel = getRiskLevel(riskScore);
            const proposedDBR = salary > 0 ? newEmi / salary : 0;
            const currentDBR = salary > 0 ? currentEmi / salary : 0;
            const confidenceScore = Math.max(60, 95 - riskScore * 0.3);

            // Determine MOEI recommendation
            let moeiRecommendation = 'approve';
            if (!rule20Pass) moeiRecommendation = 'request_documents';
            if (riskScore > 70) moeiRecommendation = 'refer_to_employee';

            await db.aIAssessment.create({
              data: {
                requestId: request.id,
                riskScore,
                riskLevel,
                confidenceScore: Math.round(confidenceScore),
                recommendedAmount: remainingBalance,
                recommendedDuration: requestedDuration,
                recommendedInstallment: newEmi,
                debtBurdenRatio: Math.round(currentDBR * 10000) / 10000,
                proposedDBR: Math.round(proposedDBR * 10000) / 10000,
                eligibilityStatus: riskScore <= 25
                  ? 'eligible'
                  : riskScore <= 60
                    ? 'conditionally_eligible'
                    : 'ineligible',
                decisionRationale: JSON.stringify({
                  source: 'moei_historical_data',
                  year: row.year,
                  applicationId: row.applicationId,
                  originalJustification: row.justifications,
                  salaryDeduction: row.deductFromSalary === 'YES',
                }),
                governanceCompliance: JSON.stringify([
                  { ruleCode: 'MOEI-20PCT', passed: rule20Pass, message: `Deduction rate ${Math.round(deductionRate * 100)}% ${rule20Pass ? '≤' : '>'} 20%` },
                  { ruleCode: 'MOEI-INCOME', passed: incomePerMember >= 2500, message: `Income/member AED ${Math.round(incomePerMember)} ${incomePerMember >= 2500 ? '≥' : '<'} 2,500` },
                ]),
                riskFactors: JSON.stringify([
                  { factor: 'overdue_months', value: overdueMonths, severity: overdueMonths >= 6 ? 'high' : 'medium' },
                  { factor: 'dbr', value: Math.round(currentDBR * 100), severity: currentDBR > 0.3 ? 'high' : 'low' },
                ]),
                shapExplanation: JSON.stringify([
                  { feature: 'overdue_months', value: overdueMonths, contribution: Math.min(overdueMonths * 2, 30) },
                  { feature: 'income_level', value: salary, contribution: salary < 10000 ? 15 : salary < 20000 ? 5 : -5 },
                  { feature: 'deduction_rate', value: deductionRate, contribution: rule20Pass ? -10 : 10 },
                ]),
                requiresHumanReview: riskScore > 60,
                humanReviewReason: riskScore > 60 ? 'High risk score requires manual verification' : null,
                aiModelVersion: 'v1.0-moei',
                processingTimeMs: 800 + (globalIndex % 2000),
                // MOEI-specific assessment fields
                applicationStatus: row.deductFromSalary === 'YES' ? 'complete' : 'incomplete',
                incomeAnalysis: JSON.stringify({
                  salary,
                  stability: incomeStability,
                  perMemberAverage: Math.round(incomePerMember),
                  householdTotal: totalHouseholdIncome,
                }),
                proposedDeductionRate: Math.round(deductionRate * 10000) / 100,
                rule20PercentCompliance: rule20Pass ? 'pass' : 'fail',
                periodRuleCompliance: requestedDuration <= 360 ? 'pass' : 'fail',
                moeiRecommendation,
                moeiReasoning: `Based on MOEI historical data (${row.year}): Salary AED ${salary.toLocaleString()}, ` +
                  `Overdue AED ${row.overDueAmt.toLocaleString()} (${overdueMonths} months), ` +
                  `Deduction rate ${Math.round(deductionRate * 100)}%. ` +
                  `${rule20Pass ? 'Complies' : 'Exceeds'} with 20% deduction rule. ` +
                  `Income per family member AED ${Math.round(incomePerMember)}.`,
                caseSummary: `Beneficiary with AED ${salary.toLocaleString()} salary, ` +
                  `${overdueMonths} months overdue (AED ${row.overDueAmt.toLocaleString()}), ` +
                  `family of ${familySize}. Current EMI AED ${currentEmi.toLocaleString()}, ` +
                  `proposed EMI AED ${newEmi.toLocaleString()}. ` +
                  `Monthly deduction ${Math.round(deductionRate * 100)}% of income.`,
              },
            });
            assessmentsCreated++;
          }
        }
      } catch (err) {
        console.error(`  ⚠️ Error processing applicant ${applicantCode}:`, err instanceof Error ? err.message : err);
      }
    }
  }

  // ── Step 5: Create MOEI SystemConfig entries ─────────────────
  console.log('\n  ⚙️ Creating MOEI SystemConfig entries...');

  const moeiConfigs = [
    {
      configKey: 'min_income_per_family_member',
      configValue: '2500',
      defaultValue: '2500',
      labelEN: 'Minimum Income Per Family Member',
      labelAR: 'الحد الأدنى للدخل لكل فرد في الأسرة',
      descriptionEN: 'Minimum required income per family member in AED (MOEI threshold)',
      descriptionAR: 'الحد الأدنى المطلوب للدخل لكل فرد في الأسرة بالدرهم (حد وزارة الاقتصاد)',
      category: 'eligibility',
      valueType: 'number',
      min: 0,
      max: 10000,
      unit: 'AED',
      isPublic: true,
    },
    {
      configKey: 'max_deduction_rate',
      configValue: '0.20',
      defaultValue: '0.20',
      labelEN: 'Maximum Deduction Rate (20% Rule)',
      labelAR: 'الحد الأقصى لنسبة الخصم (قاعدة الـ 20%)',
      descriptionEN: 'Maximum monthly deduction as percentage of income per MOEI 20% rule',
      descriptionAR: 'الحد الأقصى للخصم الشهري كنسبة من الدخل وفقاً لقاعدة الـ 20% لوزارة الاقتصاد',
      category: 'dbr_limits',
      valueType: 'number',
      min: 0.05,
      max: 0.50,
      unit: '%',
      isPublic: true,
    },
    {
      configKey: 'require_salary_certificate',
      configValue: 'true',
      defaultValue: 'true',
      labelEN: 'Require Salary Certificate',
      labelAR: 'طلب شهادة راتب',
      descriptionEN: 'Whether salary certificate is required for rescheduling requests (MOEI policy)',
      descriptionAR: 'ما إذا كانت شهادة الراتب مطلوبة لطلبات إعادة الجدولة (سياسة وزارة الاقتصاد)',
      category: 'documents',
      valueType: 'boolean',
      isPublic: false,
    },
    {
      configKey: 'require_income_statement',
      configValue: 'true',
      defaultValue: 'true',
      labelEN: 'Require Income Statement',
      labelAR: 'طلب كشف حساب دخل',
      descriptionEN: 'Whether income statement is required for rescheduling requests (MOEI policy)',
      descriptionAR: 'ما إذا كان كشف حساب الدخل مطلوب لطلبات إعادة الجدولة (سياسة وزارة الاقتصاد)',
      category: 'documents',
      valueType: 'boolean',
      isPublic: false,
    },
    {
      configKey: 'payment_history_weight',
      configValue: '0.15',
      defaultValue: '0.15',
      labelEN: 'Payment History Weight in Risk Scoring',
      labelAR: 'وزن سجل السداد في تقييم المخاطر',
      descriptionEN: 'Weight factor for payment history in risk scoring algorithm (MOEI recommendation)',
      descriptionAR: 'معامل الوزن لسجل السداد في خوارزمية تقييم المخاطر (توصية وزارة الاقتصاد)',
      category: 'risk_thresholds',
      valueType: 'number',
      min: 0,
      max: 1,
      unit: 'weight',
      isPublic: false,
    },
  ];

  for (const config of moeiConfigs) {
    await db.systemConfig.upsert({
      where: { configKey: config.configKey },
      update: { configValue: config.configValue },
      create: config,
    });
  }
  console.log(`  ✓ Created/updated ${moeiConfigs.length} MOEI SystemConfig entries`);

  // ── Summary ──────────────────────────────────────────────────
  console.log('\n' + '='.repeat(60));
  console.log('✅ MOEI Data Seed Complete!');
  console.log(`  👤 Applicants created:    ${applicantsCreated}`);
  console.log(`  🏠 Housing Loans created:  ${loansCreated}`);
  console.log(`  📋 Arrears created:        ${arrearsCreated}`);
  console.log(`  📝 Requests created:       ${requestsCreated}`);
  console.log(`  🤖 Assessments created:    ${assessmentsCreated}`);
  console.log(`  ⚙️  System configs:        ${moeiConfigs.length}`);
  console.log('='.repeat(60));
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
