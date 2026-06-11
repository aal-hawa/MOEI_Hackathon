import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'
import * as Papa from 'papaparse'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database from mock.csv...')

  const csvFilePath = path.join(__dirname, '../uploads/mock_from_MOEI/mock.csv')
  if (!fs.existsSync(csvFilePath)) {
    console.error('mock.csv not found at', csvFilePath)
    return
  }

  const csvData = fs.readFileSync(csvFilePath, 'utf8')
  const parsed = Papa.parse(csvData, { header: true, skipEmptyLines: true })
  const rows = parsed.data as any[]

  console.log(`Found ${rows.length} rows in CSV.`)

  // Create users to test with
  let count = 0
  for (const row of rows.slice(0, 50)) { // Limit to 50 for speed and demo purposes
    try {
      const applicantIdStr = row.APPLICANT
      const salary = parseFloat(row.CURRENT_SALARY) || 15000
      const currentEmi = parseFloat(row.CURRENT_EMI_AMT) || 3000
      const overdueAmt = parseFloat(row.OVER_DUE_AMT) || 0
      const overdueMonths = parseInt(row.OVER_DUE_MONTHS) || 0
      const justifications = row.JUSTIFICATIONS || 'Financial difficulties'
      const status = row.STATUS === 'APPROVED' ? 'approved' : 'pending'

      // Upsert Applicant
      const applicant = await prisma.applicant.upsert({
        where: { emiratesId: applicantIdStr },
        update: {},
        create: {
          emiratesId: applicantIdStr,
          nameEn: `Applicant ${applicantIdStr}`,
          nameAr: `مقدم الطلب ${applicantIdStr}`,
          phone: '+971-50-000-0000',
          email: `${applicantIdStr}@example.com`,
          monthlyIncome: salary,
          employer: 'Private Sector',
          employerType: 'private',
          familySize: 4,
          isCitizen: true,
          hasFamilyBook: true,
        }
      })

      // Upsert Loan
      const loan = await prisma.housingLoan.create({
        data: {
          applicantId: applicant.id,
          originalAmount: currentEmi * 120, // rough estimate
          remainingBalance: (currentEmi * 120) - (currentEmi * 20),
          monthlyInstallment: currentEmi,
          loanDurationMonths: 120,
          elapsedMonths: 20,
          interestRate: 0,
          loanType: 'loan',
          disbursementDate: new Date('2020-01-01'),
          status: 'active',
        }
      })

      // Create Arrears
      if (overdueMonths > 0) {
        await prisma.arrear.create({
          data: {
            loanId: loan.id,
            missedMonths: overdueMonths,
            totalOverdue: overdueAmt,
            delayDays: overdueMonths * 30,
            reason: 'other',
          }
        })
      }

      // Create Request (Force pending for some so AI can process them)
      const finalStatus = (count < 15) ? 'pending' : 'approved' 

      await prisma.reschedulingRequest.create({
        data: {
          applicantId: applicant.id,
          loanId: loan.id,
          requestedDurationMonths: parseInt(row.ADDITIONAL_MONTHS) || 24,
          reason: justifications,
          reasonCategory: 'other',
          status: finalStatus,
          priority: 'normal',
        }
      })

      count++
    } catch (err) {
      console.error('Error processing row:', err)
    }
  }

  console.log(`✅ Successfully seeded ${count} records from CSV.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
