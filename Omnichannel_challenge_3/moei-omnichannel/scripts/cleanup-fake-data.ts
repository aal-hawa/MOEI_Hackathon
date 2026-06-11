/**
 * Cleanup script: Remove fake/mock customer data from the database
 * Keeps ServiceRules, agents, and other configuration data intact
 * Only removes: fake customers, their sessions, interactions, cases, bills, service requests, WA messages/contacts
 */

import { db } from '../src/worker/lib/db'

const FAKE_CUSTOMER_NAMES = [
  'Ahmed Khalifa Al Maktoum',
  'Fatima Hassan Al Nuaimi',
  'Mohammed Saeed Al Shehhi',
  'Sarah Williams',
  'Omar Khalil',
  'Aisha Obaid Al Ketbi',
]

async function cleanup() {
  console.log('🧹 Starting cleanup of fake customer data...\n')

  // Find fake customers
  const fakeCustomers = await db.customer.findMany({
    where: {
      nameEn: { in: FAKE_CUSTOMER_NAMES },
    },
    select: { id: true, nameEn: true },
  })

  if (fakeCustomers.length === 0) {
    console.log('✅ No fake customers found. Database is clean.')
    return
  }

  console.log(`Found ${fakeCustomers.length} fake customers to remove:`)
  fakeCustomers.forEach(c => console.log(`  - ${c.nameEn} (${c.id})`))

  const fakeCustomerIds = fakeCustomers.map(c => c.id)

  // Delete in correct order (respecting foreign key constraints)

  // 1. Delete WAMessages for sessions belonging to fake customers
  const fakeSessions = await db.conversationSession.findMany({
    where: { customerId: { in: fakeCustomerIds } },
    select: { id: true },
  })
  const fakeSessionIds = fakeSessions.map(s => s.id)

  if (fakeSessionIds.length > 0) {
    console.log('\n📦 Deleting WAMessages...')
    const waMsgResult = await db.wAMessage.deleteMany({
      where: { conversationId: { in: fakeSessionIds } },
    })
    console.log(`  Deleted ${waMsgResult.count} WAMessages`)

    console.log('📦 Deleting STTTranscripts...')
    const sttResult = await db.sTTTranscript.deleteMany({
      where: { sessionId: { in: fakeSessionIds } },
    })
    console.log(`  Deleted ${sttResult.count} STTTranscripts`)
  }

  // 2. Delete interactions for fake customers
  console.log('📦 Deleting Interactions...')
  const interactionResult = await db.interaction.deleteMany({
    where: { customerId: { in: fakeCustomerIds } },
  })
  console.log(`  Deleted ${interactionResult.count} Interactions`)

  // 3. Delete conversation sessions for fake customers
  console.log('📦 Deleting ConversationSessions...')
  const sessionResult = await db.conversationSession.deleteMany({
    where: { customerId: { in: fakeCustomerIds } },
  })
  console.log(`  Deleted ${sessionResult.count} ConversationSessions`)

  // 4. Delete bills for fake customers
  console.log('📦 Deleting Bills...')
  const billResult = await db.bill.deleteMany({
    where: { customerId: { in: fakeCustomerIds } },
  })
  console.log(`  Deleted ${billResult.count} Bills`)

  // 5. Delete service requests for fake customers
  console.log('📦 Deleting ServiceRequests...')
  const srResult = await db.serviceRequest.deleteMany({
    where: { customerId: { in: fakeCustomerIds } },
  })
  console.log(`  Deleted ${srResult.count} ServiceRequests`)

  // 6. Delete cases for fake customers
  console.log('📦 Deleting Cases...')
  const caseResult = await db.case.deleteMany({
    where: { customerId: { in: fakeCustomerIds } },
  })
  console.log(`  Deleted ${caseResult.count} Cases`)

  // 7. Delete employer notifications related to fake customers
  console.log('📦 Deleting EmployerNotifications...')
  const notifResult = await db.employerNotification.deleteMany({
    where: { customerId: { in: fakeCustomerIds } },
  })
  console.log(`  Deleted ${notifResult.count} EmployerNotifications`)

  // 8. Finally, delete the fake customers themselves
  console.log('📦 Deleting Customers...')
  const customerResult = await db.customer.deleteMany({
    where: { id: { in: fakeCustomerIds } },
  })
  console.log(`  Deleted ${customerResult.count} Customers`)

  // 9. Also clean up any WAContacts that might be fake
  console.log('📦 Cleaning up WAContacts...')
  const waContactResult = await db.wAContact.deleteMany({
    where: {
      phone: {
        in: ['+971501234567', '+971502345678', '+971503456789', '+971504567890', '+971505678901', '+971506789012'],
      },
    },
  })
  console.log(`  Deleted ${waContactResult.count} WAContacts`)

  console.log('\n✅ Cleanup complete! Fake data removed from database.')
  console.log('   ServiceRules and agent accounts are preserved.')
}

cleanup()
  .catch((err) => {
    console.error('❌ Cleanup failed:', err)
    process.exit(1)
  })
  .finally(() => {
    db.$disconnect()
  })
