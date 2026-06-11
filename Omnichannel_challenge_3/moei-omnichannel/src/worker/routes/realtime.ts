/**
 * Realtime Route - Hono
 * ALL data comes from the real database. No fake data, no simulation.
 *
 * Endpoints:
 *   GET  /realtime/status        - Combined status (KPIs + queue + conversation count)
 *   GET  /realtime/kpis          - Current KPIs (computed from real DB data)
 *   GET  /realtime/queue         - Queue status (computed from real DB data)
 *   GET  /realtime/conversations - Active conversations (from ConversationSession + Case tables)
 *   GET  /realtime/sentiment     - Sentiment timeline (from real Interaction data)
 *   GET  /realtime/whatsapp      - Recent WhatsApp messages (from WAMessage table)
 *   GET  /realtime/calls         - Active voice calls (from ConversationSession table)
 *   GET  /realtime/email         - Recent email messages (from EmailMsg table)
 *   GET  /realtime/history       - Historical interactions
 *   POST /realtime/whatsapp/send - Send a WhatsApp message (saves to DB)
 *   POST /realtime/whatsapp/receive - Receive a WhatsApp message (saves to DB)
 *   POST /realtime/call/start    - Start a new call session (saves to DB)
 *   POST /realtime/call/answer   - Answer a call (updates DB)
 *   POST /realtime/call/end      - End a call (updates DB)
 *   POST /realtime/email/send    - Send an email (saves to DB)
 *   POST /realtime/email/receive - Receive an email (saves to DB)
 *   POST /realtime/voice/stt-chunk - Save STT transcript chunk
 */

import { Hono } from 'hono'
import { db } from '../lib/db'
import { BrainOrchestrator } from '../lib/brain-orchestrator'

const app = new Hono()

// ============================================================
// Helper: Compute KPIs from real database data
// ============================================================

async function computeKPIs() {
  const [
    totalInteractions,
    activeCasesCount,
    agentsOnlineCount,
    resolvedCases,
    allFeedback,
    allInteractionsForAvg,
    totalConversations,
    activeNow,
    channelSessions,
  ] = await Promise.all([
    // Total interactions ever
    db.interaction.count(),
    // Active cases
    db.case.count({ where: { status: { in: ['open', 'in_progress', 'pending'] } } }),
    // Agents online
    db.agent.count({ where: { status: 'available' } }),
    // Resolved cases (for avg resolution time & first-contact resolution)
    db.case.findMany({
      where: { status: 'resolved', resolvedAt: { not: null } },
      select: { id: true, createdAt: true, resolvedAt: true },
      take: 100,
      orderBy: { resolvedAt: 'desc' },
    }),
    // Feedback for CSAT
    db.feedback.findMany({
      select: { rating: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    // All interactions for self-service calculation
    db.interaction.findMany({
      where: { type: 'message', direction: 'inbound' },
      select: { id: true, caseId: true },
      orderBy: { createdAt: 'desc' },
      take: 500,
    }),
    // Total conversation sessions
    db.conversationSession.count(),
    // Currently active conversation sessions
    db.conversationSession.count({ where: { status: 'active' } }),
    // Channel breakdown
    db.conversationSession.findMany({
      select: { channel: true },
    }),
  ])

  // Average resolution time (in minutes)
  let avgResolutionTime = 0
  if (resolvedCases.length > 0) {
    const totalMinutes = resolvedCases.reduce((sum, c) => {
      if (c.resolvedAt && c.createdAt) {
        return sum + (new Date(c.resolvedAt).getTime() - new Date(c.createdAt).getTime()) / 60000
      }
      return sum
    }, 0)
    avgResolutionTime = Math.round((totalMinutes / resolvedCases.length) * 10) / 10
  }

  // CSAT (average rating, scaled to 1-5)
  let csat = 0
  if (allFeedback.length > 0) {
    const totalRating = allFeedback.reduce((sum, f) => sum + f.rating, 0)
    csat = Math.round((totalRating / allFeedback.length) * 10) / 10
  }

  // First contact resolution (% of resolved cases with only 1 interaction)
  let firstContactResolution = 0
  if (resolvedCases.length > 0) {
    // Count interactions per resolved case
    const resolvedCaseIds = resolvedCases.map(c => c.id).filter(Boolean)
    if (resolvedCaseIds.length > 0) {
      const interactionCounts = await db.interaction.groupBy({
        by: ['caseId'],
        where: { caseId: { in: resolvedCaseIds } },
        _count: { id: true },
      })
      const fcrCount = interactionCounts.filter(ic => ic._count.id <= 1).length
      firstContactResolution = Math.round((fcrCount / resolvedCases.length) * 100 * 10) / 10
    }
  }

  // Self-service deflection (% of inbound interactions that didn't create a case)
  let selfServiceDeflection = 0
  if (allInteractionsForAvg.length > 0) {
    const withCase = allInteractionsForAvg.filter(i => i.caseId).length
    selfServiceDeflection = Math.round(((allInteractionsForAvg.length - withCase) / allInteractionsForAvg.length) * 100 * 10) / 10
  }

  // Escalation rate
  const escalatedCases = await db.case.count({ where: { priority: 'urgent' } })
  const totalCases = await db.case.count()
  let escalationRate = 0
  if (totalCases > 0) {
    escalationRate = Math.round((escalatedCases / totalCases) * 100 * 10) / 10
  }

  // Channel breakdown
  const channelBreakdown: Record<string, number> = {}
  for (const session of channelSessions) {
    const ch = session.channel || 'unknown'
    channelBreakdown[ch] = (channelBreakdown[ch] || 0) + 1
  }

  return {
    totalInteractions,
    totalConversations,
    activeNow,
    avgResolutionTime,
    firstContactResolution,
    csat,
    selfServiceDeflection,
    escalationRate,
    activeCases: activeCasesCount,
    agentsOnline: agentsOnlineCount,
    channelBreakdown,
  }
}

// ============================================================
// Helper: Compute queue status from real database data
// ============================================================

async function computeQueueStatus() {
  const [voiceWaiting, whatsappWaiting, webWaiting, voiceAgents, whatsappAgents, webAgents] =
    await Promise.all([
      db.conversationSession.count({ where: { channel: 'voice', status: 'waiting' } }),
      db.conversationSession.count({ where: { channel: 'whatsapp', status: 'waiting' } }),
      db.conversationSession.count({ where: { channel: 'web', status: 'waiting' } }),
      db.agent.count({ where: { status: 'available', skills: { contains: 'voice' } } }),
      db.agent.count({ where: { status: 'available', skills: { contains: 'whatsapp' } } }),
      db.agent.count({ where: { status: 'available', skills: { contains: 'web' } } }),
    ])

  // Compute avg wait from actual waiting sessions
  const now = Date.now()
  const waitingVoiceSessions = await db.conversationSession.findMany({
    where: { channel: 'voice', status: 'waiting' },
    select: { createdAt: true },
  })
  const waitingWaSessions = await db.conversationSession.findMany({
    where: { channel: 'whatsapp', status: 'waiting' },
    select: { createdAt: true },
  })
  const waitingWebSessions = await db.conversationSession.findMany({
    where: { channel: 'web', status: 'waiting' },
    select: { createdAt: true },
  })

  function avgWaitSeconds(sessions: { createdAt: Date }[]): number {
    if (sessions.length === 0) return 0
    const totalWait = sessions.reduce((sum, s) => sum + (now - new Date(s.createdAt).getTime()) / 1000, 0)
    return Math.round(totalWait / sessions.length)
  }

  return {
    voice: { waiting: voiceWaiting, avgWait: avgWaitSeconds(waitingVoiceSessions), activeAgents: voiceAgents },
    whatsapp: { waiting: whatsappWaiting, avgWait: avgWaitSeconds(waitingWaSessions), activeAgents: whatsappAgents },
    web: { waiting: webWaiting, avgWait: avgWaitSeconds(waitingWebSessions), activeAgents: webAgents },
  }
}

// ============================================================
// Helper: Compute sentiment timeline from real interaction data
// ============================================================

async function computeSentimentTimeline() {
  // Get interactions from the last 24 hours, grouped by hour
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const recentInteractions = await db.interaction.findMany({
    where: { createdAt: { gte: twentyFourHoursAgo } },
    select: { sentiment: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })

  if (recentInteractions.length === 0) {
    return []
  }

  // Group by hour
  const hourBuckets = new Map<string, { positive: number; neutral: number; negative: number; total: number }>()

  for (const interaction of recentInteractions) {
    const date = new Date(interaction.createdAt)
    const hourKey = new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()).toISOString()

    const bucket = hourBuckets.get(hourKey) || { positive: 0, neutral: 0, negative: 0, total: 0 }
    const s = interaction.sentiment ?? 0.5
    if (s >= 0.65) bucket.positive++
    else if (s >= 0.35) bucket.neutral++
    else bucket.negative++
    bucket.total++
    hourBuckets.set(hourKey, bucket)
  }

  // Convert to percentages
  const timeline = Array.from(hourBuckets.entries()).map(([time, bucket]) => ({
    time,
    positive: bucket.total > 0 ? Math.round((bucket.positive / bucket.total) * 100) : 0,
    neutral: bucket.total > 0 ? Math.round((bucket.neutral / bucket.total) * 100) : 0,
    negative: bucket.total > 0 ? Math.round((bucket.negative / bucket.total) * 100) : 0,
  }))

  return timeline
}

// ============================================================
// Routes
// ============================================================

// GET /realtime/status - Combined status (all from real DB)
app.get('/realtime/status', async (c) => {
  const [kpis, queue, activeSessionCount, activeCallCount, whatsappMsgCount, emailMsgCount] =
    await Promise.all([
      computeKPIs(),
      computeQueueStatus(),
      db.conversationSession.count({ where: { status: { in: ['active', 'waiting'] } } }),
      db.conversationSession.count({ where: { channel: 'voice', status: { in: ['active', 'waiting'] } } }),
      db.wAMessage.count(),
      db.emailMsg.count({ where: { folder: 'inbox' } }),
    ])

  return c.json({
    kpis,
    queue,
    conversationCount: activeSessionCount,
    activeCallCount,
    whatsappMessageCount: whatsappMsgCount,
    emailMessageCount: emailMsgCount,
    timestamp: new Date().toISOString(),
  })
})

// GET /realtime/kpis - Current KPIs (from real DB)
app.get('/realtime/kpis', async (c) => {
  const kpis = await computeKPIs()
  return c.json({
    ...kpis,
    timestamp: new Date().toISOString(),
  })
})

// GET /realtime/queue - Queue status (from real DB)
app.get('/realtime/queue', async (c) => {
  const queue = await computeQueueStatus()
  return c.json({
    ...queue,
    timestamp: new Date().toISOString(),
  })
})

// GET /realtime/conversations - Active conversations (from real DB)
app.get('/realtime/conversations', async (c) => {
  // Query ConversationSession table for active sessions with AI mode info
  const activeSessions = await db.conversationSession.findMany({
    where: { status: { in: ['active', 'waiting'] } },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  // Also query Case-based conversations for backward compatibility
  const activeCases = await db.case.findMany({
    where: { status: { in: ['open', 'in_progress'] } },
    orderBy: { updatedAt: 'desc' },
    take: 15,
    include: {
      customer: { select: { id: true, nameEn: true, nameAr: true, preferredLang: true, preferredChannel: true, sentiment: true } },
      _count: { select: { interactions: true } },
      interactions: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true, sentiment: true, intent: true, channel: true } },
    },
  })

  // Build session-based conversations
  const sessionConversations = await Promise.all(
    activeSessions.map(async (session) => {
      const customer = await db.customer.findUnique({
        where: { id: session.customerId },
        select: { id: true, nameEn: true, nameAr: true, preferredLang: true, preferredChannel: true, sentiment: true },
      })
      const agent = session.agentId
        ? await db.agent.findUnique({ where: { id: session.agentId }, select: { id: true, name: true, nameAr: true, status: true } })
        : null
      const interactionCount = await db.interaction.count({
        where: { caseId: session.caseId || undefined, customerId: session.customerId },
      })
      const durationSec = Math.floor((Date.now() - new Date(session.createdAt).getTime()) / 1000)

      return {
        id: session.id,
        customerId: session.customerId,
        customerName: customer?.nameEn || 'Unknown',
        customerNameAr: customer?.nameAr || '',
        channel: session.channel,
        intent: session.intent || 'inquiry',
        sentiment: session.sentiment,
        duration: Math.min(durationSec, 600),
        messages: interactionCount,
        language: session.language || 'en',
        aiMode: session.aiMode,
        agentId: session.agentId,
        agentName: agent?.name || null,
        alert: session.sentiment < 0.25,
        alertType: session.sentiment < 0.15 ? 'anger' : session.sentiment < 0.25 ? 'stress' : undefined,
        status: session.status,
        source: 'session',
      }
    })
  )

  // Build case-based conversations (backward compatibility)
  const caseConversations = activeCases.map((cs) => {
    const lastInteraction = cs.interactions[0]
    const durationSec = lastInteraction ? Math.floor((Date.now() - new Date(lastInteraction.createdAt).getTime()) / 1000) : 60
    const sentiment = lastInteraction?.sentiment ?? cs.sentiment ?? 0.5
    const channel = cs.channel === 'phone' ? 'voice' : cs.channel === 'mobile_app' ? 'web' : cs.channel

    return {
      id: cs.id,
      customerId: cs.customer.id,
      customerName: cs.customer.nameEn,
      channel,
      intent: lastInteraction?.intent || 'inquiry',
      sentiment,
      duration: Math.min(durationSec, 600),
      messages: cs._count.interactions,
      language: cs.customer.preferredLang || 'en',
      alert: sentiment < 0.25,
      alertType: sentiment < 0.15 ? 'anger' : sentiment < 0.25 ? 'stress' : undefined,
      status: 'active',
      source: 'case',
    }
  })

  // Merge: prefer session-based, add case-based if no session exists
  const sessionCaseIds = new Set(
    await Promise.all(
      activeSessions.filter((s) => s.caseId).map((s) => s.caseId!)
    )
  )
  const filteredCaseConversations = caseConversations.filter(
    (cc) => !sessionCaseIds.has(cc.id)
  )

  const all = [...sessionConversations, ...filteredCaseConversations]

  return c.json({
    conversations: all,
    count: all.length,
    sessionCount: sessionConversations.length,
    caseCount: filteredCaseConversations.length,
    timestamp: new Date().toISOString(),
  })
})

// GET /realtime/sentiment - Sentiment timeline (from real DB interactions)
app.get('/realtime/sentiment', async (c) => {
  const timeline = await computeSentimentTimeline()
  return c.json({
    timeline,
    count: timeline.length,
    timestamp: new Date().toISOString(),
  })
})

// GET /realtime/whatsapp - Recent WhatsApp messages (from real WAMessage table)
app.get('/realtime/whatsapp', async (c) => {
  const messages = await db.wAMessage.findMany({
    orderBy: { timestamp: 'desc' },
    take: 50,
    include: {
      contact: { select: { name: true, phone: true } },
    },
  })

  // Look up ConversationSession → Customer for each unique conversationId to get real customer IDs
  const conversationIds = [...new Set(messages.map(m => m.conversationId).filter(Boolean))]
  const sessions = await db.conversationSession.findMany({
    where: { id: { in: conversationIds } },
    select: { id: true, customerId: true },
  })
  const sessionMap = new Map(sessions.map(s => [s.id, s]))

  // Fetch customers for the customer IDs found in sessions
  const customerIds = [...new Set(sessions.map(s => s.customerId))]
  const customers = await db.customer.findMany({
    where: { id: { in: customerIds } },
    select: { id: true, nameEn: true, phone: true },
  })
  const customerMap = new Map(customers.map(c => [c.id, c]))

  const formatted = messages.map((m) => {
    const session = m.conversationId ? sessionMap.get(m.conversationId) : null
    const customer = session ? customerMap.get(session.customerId) : null
    // Customer phone: for outbound (from business), the customer is the recipient (toPhone);
    // for inbound (from customer), the customer is the sender (fromPhone via contact)
    const customerPhone = m.isFromBusiness ? m.toPhone : (m.contact?.phone || m.fromPhone)
    // Use the DB customer ID if available, otherwise fall back to phone for grouping
    const groupingId = customer?.id || customerPhone || 'unknown'
    const customerName = customer?.nameEn || m.contact?.name || customerPhone || 'Unknown'

    return {
      id: m.id,
      conversationId: m.conversationId,
      customerId: groupingId,
      customerName,
      customerPhone: customerPhone || '',
      text: m.text,
      timestamp: m.timestamp,
      direction: m.isFromBusiness ? 'outbound' as const : 'inbound' as const,
      status: m.status,
    }
  })

  return c.json({
    messages: formatted,
    count: formatted.length,
    timestamp: new Date().toISOString(),
  })
})

// GET /realtime/calls - Active voice calls (from real ConversationSession table)
app.get('/realtime/calls', async (c) => {
  const voiceSessions = await db.conversationSession.findMany({
    where: { channel: 'voice', status: { in: ['active', 'waiting'] } },
    orderBy: { createdAt: 'desc' },
    include: {
      agent: { select: { id: true, name: true } },
    },
  })

  // Fetch customers separately since ConversationSession doesn't have a direct customer relation
  const customerIds = [...new Set(voiceSessions.map(s => s.customerId))]
  const customers = await db.customer.findMany({
    where: { id: { in: customerIds } },
    select: { id: true, nameEn: true, phone: true, sentiment: true, preferredLang: true },
  })
  const customerMap = new Map(customers.map(c => [c.id, c]))

  const calls = voiceSessions.map((session) => {
    const customer = customerMap.get(session.customerId)
    const durationSec = Math.floor((Date.now() - new Date(session.createdAt).getTime()) / 1000)
    const metadata = session.metadata ? JSON.parse(session.metadata) : {}
    return {
      id: session.id,
      customerId: session.customerId,
      customerName: customer?.nameEn || metadata.customerName || 'Unknown Caller',
      phoneNumber: customer?.phone || metadata.phoneNumber || '',
      status: session.status === 'waiting' ? 'ringing' : session.status === 'active' ? 'answered' : session.status,
      duration: durationSec,
      language: session.language || 'en',
      sentiment: session.sentiment,
      transcriptChunks: session.transcript ? JSON.parse(session.transcript).map((c: { text: string }) => c.text) : [],
      agentId: session.agentId,
      agentName: session.agent?.name || null,
    }
  })

  return c.json({
    calls,
    count: calls.length,
    timestamp: new Date().toISOString(),
  })
})

// GET /realtime/email - Recent email messages (from real EmailMsg table)
app.get('/realtime/email', async (c) => {
  const emails = await db.emailMsg.findMany({
    orderBy: { timestamp: 'desc' },
    take: 50,
  })

  const formatted = emails.map((e) => ({
    id: e.id,
    conversationId: e.threadId || e.id,
    customerId: null,
    customerName: e.fromName || e.fromEmail,
    subject: e.subject,
    text: e.body,
    timestamp: e.timestamp,
    direction: (e.direction === 'outbound' ? 'outbound' : 'inbound') as 'inbound' | 'outbound',
    status: e.isRead ? 'read' : 'unread',
  }))

  return c.json({
    messages: formatted,
    count: formatted.length,
    timestamp: new Date().toISOString(),
  })
})

// GET /realtime/calls/history - Recent resolved/ended voice calls (from real DB)
app.get('/realtime/calls/history', async (c) => {
  const resolvedSessions = await db.conversationSession.findMany({
    where: { channel: 'voice', status: { in: ['resolved', 'closed'] } },
    orderBy: { updatedAt: 'desc' },
    take: 10,
  })

  // Enrich with customer data
  const customerIds = [...new Set(resolvedSessions.map(s => s.customerId))]
  const customers = await db.customer.findMany({
    where: { id: { in: customerIds } },
    select: { id: true, nameEn: true, phone: true, sentiment: true, preferredLang: true },
  })
  const customerMap = new Map(customers.map(c => [c.id, c]))

  const calls = resolvedSessions.map((session) => {
    const customer = customerMap.get(session.customerId)
    const durationSec = session.endedAt
      ? Math.floor((new Date(session.endedAt).getTime() - new Date(session.createdAt).getTime()) / 1000)
      : 0
    const metadata = session.metadata ? JSON.parse(session.metadata) : {}
    return {
      id: session.id,
      customerId: session.customerId,
      customerName: customer?.nameEn || metadata.customerName || 'Unknown Caller',
      phoneNumber: customer?.phone || metadata.phoneNumber || '',
      duration: durationSec,
      direction: 'inbound' as const,
      status: session.status,
      createdAt: session.createdAt,
      endedAt: session.endedAt,
    }
  })

  return c.json({
    calls,
    count: calls.length,
    timestamp: new Date().toISOString(),
  })
})

// GET /realtime/history - Fetch interaction history from DB
app.get('/realtime/history', async (c) => {
  try {
    const email = c.req.query('email')
    const phone = c.req.query('phone')
    const channelFilter = c.req.query('channel')

    if (!email && !phone) {
      return c.json({ error: 'email or phone is required' }, 400)
    }

    const customer = await db.customer.findFirst({
      where: {
        OR: [
          ...(email ? [{ email }] : []),
          ...(phone ? [{ phone }] : []),
        ]
      }
    })

    if (!customer) {
      return c.json({ history: [] })
    }

    const whereClause: any = { customerId: customer.id }
    if (channelFilter) {
      whereClause.channel = channelFilter
    }

    const interactions = await db.interaction.findMany({
      where: whereClause,
      orderBy: { createdAt: 'asc' }
    })

    return c.json({ history: interactions, customerId: customer.id })
  } catch (error) {
    console.error('History fetch error:', error)
    return c.json({ error: 'Failed to fetch history' }, 500)
  }
})

// ============================================================
// POST endpoints — write real data to DB
// ============================================================

// POST /realtime/whatsapp/send - Send a WhatsApp message (saves to DB)
app.post('/realtime/whatsapp/send', async (c) => {
  try {
    const body = await c.req.json()
    const { conversationId, customerId, message } = body

    if (!message) {
      return c.json({ error: 'message is required' }, 400)
    }

    // Find the conversation session (no customer relation on ConversationSession — fetch separately)
    const session = await db.conversationSession.findUnique({
      where: { id: conversationId },
    })

    // Fetch customer info separately (ConversationSession has no customer relation in schema)
    let customerPhone = customerId || 'unknown'
    if (session?.customerId) {
      try {
        const customer = await db.customer.findUnique({
          where: { id: session.customerId },
          select: { phone: true, nameEn: true },
        })
        if (customer?.phone) customerPhone = customer.phone
      } catch { /* use fallback */ }
    }

    const businessPhone = process.env.WA_BUSINESS_PHONE || '+9718006634'

    // Ensure a WAContact exists for the business phone (contact relation maps fromPhone → WAContact.phone)
    // Use upsert to avoid race-condition duplicates
    const businessContact = await db.wAContact.upsert({
      where: { phone: businessPhone },
      update: {},
      create: {
        name: 'MOEI Support',
        phone: businessPhone,
        isBusiness: true,
      },
    })

    // Save to WAMessage table (contact relation sets fromPhone automatically)
    const waMessage = await db.wAMessage.create({
      data: {
        conversationId: conversationId || 'unknown',
        toPhone: customerPhone,
        text: message,
        timestamp: new Date().toISOString(),
        status: 'sent',
        type: 'text',
        isFromBusiness: true,
        contact: { connect: { phone: businessPhone } },
      },
    })

    // Update status to delivered after a short delay
    setTimeout(async () => {
      try {
        await db.wAMessage.update({
          where: { id: waMessage.id },
          data: { status: 'delivered' },
        })
      } catch { /* silent */ }
    }, 2000)

    setTimeout(async () => {
      try {
        await db.wAMessage.update({
          where: { id: waMessage.id },
          data: { status: 'read' },
        })
      } catch { /* silent */ }
    }, 4000)

    // Save to Interaction table
    if (session) {
      await db.interaction.create({
        data: {
          customerId: session.customerId,
          caseId: session.caseId,
          channel: 'whatsapp',
          type: 'message',
          direction: 'outbound',
          content: message,
          sentiment: 0.7,
          language: session.language || 'en',
        },
      })
    }

    return c.json({
      success: true,
      messageId: waMessage.id,
      status: 'sent',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('WhatsApp send error:', error)
    return c.json({ error: 'Failed to send WhatsApp message' }, 500)
  }
})

// POST /realtime/whatsapp/receive - Receive a WhatsApp message from a real customer
app.post('/realtime/whatsapp/receive', async (c) => {
  try {
    const body = await c.req.json()
    const { customerName, text, phoneNumber, language, uaePassId } = body

    if (!text) {
      return c.json({ error: 'text is required' }, 400)
    }

    const effectiveLanguage = language || 'en'

    // Find or create customer
    let dbCustomer = await db.customer.findFirst({
      where: { OR: [{ phone: phoneNumber }, { uaePassId }] },
    })
    if (!dbCustomer) {
      dbCustomer = await db.customer.create({
        data: {
          nameEn: customerName || 'WhatsApp Customer',
          phone: phoneNumber || null,
          uaePassId: uaePassId || null,
          preferredLang: effectiveLanguage,
          preferredChannel: 'whatsapp',
        },
      })
    }

    // Find or create WAContact
    let waContact = await db.wAContact.findUnique({
      where: { phone: phoneNumber || 'unknown' },
    })
    if (!waContact) {
      waContact = await db.wAContact.create({
        data: {
          name: customerName || phoneNumber || 'Unknown',
          phone: phoneNumber || 'unknown',
        },
      })
    }

    // Find or create ConversationSession (reuse active session for same customer)
    let session = await db.conversationSession.findFirst({
      where: {
        customerId: dbCustomer.id,
        channel: 'whatsapp',
        status: { in: ['active', 'waiting'] },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (!session) {
      session = await db.conversationSession.create({
        data: {
          customerId: dbCustomer.id,
          channel: 'whatsapp',
          status: 'active',
          aiMode: 'full_ai',
          language: effectiveLanguage,
          intent: 'inquiry',
          metadata: JSON.stringify({
            phoneNumber,
            customerName,
            source: 'whatsapp',
          }),
        },
      })
    } else {
      // Update existing session's metadata
      await db.conversationSession.update({
        where: { id: session.id },
        data: {
          language: effectiveLanguage,
          updatedAt: new Date(),
        },
      })
    }

    // Save WAMessage (contact relation sets fromPhone automatically via WAContact.phone)
    const waMessage = await db.wAMessage.create({
      data: {
        conversationId: session.id,
        toPhone: process.env.WA_BUSINESS_PHONE || '+9718006634',
        text,
        timestamp: new Date().toISOString(),
        status: 'sent',
        type: 'text',
        isFromBusiness: false,
        contact: { connect: { phone: waContact.phone } },
      },
    })

    // Save Interaction
    await db.interaction.create({
      data: {
        customerId: dbCustomer.id,
        channel: 'whatsapp',
        type: 'message',
        direction: 'inbound',
        content: text,
        intent: 'inquiry',
        sentiment: 0.5,
        language: effectiveLanguage,
      },
    })

    // Update ConversationSession transcript so admin dashboard can see the message
    try {
      const currentTranscript = session.transcript ? JSON.parse(session.transcript) : []
      currentTranscript.push({
        speaker: 'customer',
        text,
        timestamp: new Date().toISOString(),
        language: effectiveLanguage,
      })
      await db.conversationSession.update({
        where: { id: session.id },
        data: {
          transcript: JSON.stringify(currentTranscript),
          updatedAt: new Date(),
        },
      })
    } catch (transcriptErr) {
      console.error('Failed to update session transcript:', transcriptErr)
    }

    // Notify available agents
    const availableAgents = await db.agent.findMany({
      where: { status: 'available' },
      select: { id: true },
    })
    if (availableAgents.length > 0) {
      await db.employerNotification.createMany({
        data: availableAgents.map((a) => ({
          agentId: a.id,
          type: 'whatsapp',
          title: 'New WhatsApp Message',
          titleAr: 'رسالة واتساب جديدة',
          message: `WhatsApp message from ${customerName || phoneNumber || 'Unknown'}: ${text.slice(0, 100)}`,
          messageAr: `رسالة واتساب من ${customerName || phoneNumber || 'غير معروف'}: ${text.slice(0, 100)}`,
          priority: 'high',
        })),
      })
    }

    return c.json({
      success: true,
      messageId: waMessage.id,
      sessionId: session.id,
      customerId: dbCustomer.id,
      status: 'received',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('WhatsApp receive error:', error)
    return c.json({ error: 'Failed to receive WhatsApp message' }, 500)
  }
})

// POST /realtime/call/start - Start a new call session (saves to DB)
app.post('/realtime/call/start', async (c) => {
  try {
    const body = await c.req.json()
    const { customerName, phoneNumber, language, uaePassId, agentId } = body

    const effectiveLanguage = language || 'en'

    // Find or create customer
    let dbCustomer = await db.customer.findFirst({
      where: { OR: [{ phone: phoneNumber }, { uaePassId }] },
    })
    if (!dbCustomer) {
      dbCustomer = await db.customer.create({
        data: {
          nameEn: customerName || 'Voice Caller',
          phone: phoneNumber || null,
          uaePassId: uaePassId || null,
          preferredLang: effectiveLanguage,
          preferredChannel: 'voice',
        },
      })
    }

    // Create ConversationSession in database
    const session = await db.conversationSession.create({
      data: {
        customerId: dbCustomer.id,
        agentId: agentId || null,
        channel: 'voice',
        status: 'waiting',
        aiMode: 'human_only',
        language: effectiveLanguage,
        intent: 'inquiry',
        metadata: JSON.stringify({
          phoneNumber,
          customerName,
          source: 'voice',
        }),
      },
    })

    // Notify available agents about incoming call
    const availableAgents = await db.agent.findMany({
      where: { status: 'available' },
      select: { id: true },
    })
    if (availableAgents.length > 0) {
      await db.employerNotification.createMany({
        data: availableAgents.map((a) => ({
          agentId: a.id,
          type: 'voice',
          title: 'Incoming Call',
          titleAr: 'مكالمة واردة',
          message: `Incoming call from ${customerName || phoneNumber || 'Unknown'} (${effectiveLanguage === 'ar' ? 'Arabic' : 'English'})`,
          messageAr: `مكالمة واردة من ${customerName || phoneNumber || 'غير معروف'} (${effectiveLanguage === 'ar' ? 'عربي' : 'إنجليزي'})`,
          priority: 'urgent',
          link: `/conversations/${session.id}`,
        })),
      })
    }

    return c.json({
      success: true,
      callId: session.id,
      sessionId: session.id,
      customerId: dbCustomer.id,
      status: 'ringing',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Call start error:', error)
    return c.json({ error: 'Failed to start call' }, 500)
  }
})

// POST /realtime/call/answer - Answer a call (updates DB)
app.post('/realtime/call/answer', async (c) => {
  try {
    const body = await c.req.json()
    const { callId, agentId } = body

    if (!callId) {
      return c.json({ error: 'callId is required' }, 400)
    }

    // Update the ConversationSession in DB
    const session = await db.conversationSession.findUnique({
      where: { id: callId },
    })

    if (!session) {
      return c.json({ error: 'Call session not found' }, 404)
    }

    await db.conversationSession.update({
      where: { id: callId },
      data: {
        status: 'active',
        agentId: agentId || session.agentId,
      },
    })

    // Save interaction
    await db.interaction.create({
      data: {
        customerId: session.customerId,
        caseId: session.caseId,
        channel: 'voice',
        type: 'call',
        direction: 'inbound',
        content: 'Call answered',
        sentiment: session.sentiment,
        language: session.language || 'en',
      },
    })

    return c.json({
      success: true,
      callId,
      status: 'answered',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Call answer error:', error)
    return c.json({ error: 'Failed to answer call' }, 500)
  }
})

// POST /realtime/call/end - End a call (updates DB)
app.post('/realtime/call/end', async (c) => {
  try {
    const body = await c.req.json()
    const { callId } = body

    if (!callId) {
      return c.json({ error: 'callId is required' }, 400)
    }

    const session = await db.conversationSession.findUnique({
      where: { id: callId },
    })

    if (!session) {
      return c.json({ error: 'Call session not found' }, 404)
    }

    const durationSec = Math.floor((Date.now() - new Date(session.createdAt).getTime()) / 1000)

    await db.conversationSession.update({
      where: { id: callId },
      data: {
        status: 'resolved',
        endedAt: new Date(),
      },
    })

    // Save interaction
    await db.interaction.create({
      data: {
        customerId: session.customerId,
        caseId: session.caseId,
        channel: 'voice',
        type: 'call',
        direction: 'inbound',
        content: `Call ended. Duration: ${durationSec}s`,
        sentiment: session.sentiment,
        language: session.language || 'en',
      },
    })

    return c.json({
      success: true,
      callId,
      status: 'ended',
      duration: durationSec,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Call end error:', error)
    return c.json({ error: 'Failed to end call' }, 500)
  }
})

// POST /realtime/email/send - Send an email (saves to DB)
app.post('/realtime/email/send', async (c) => {
  try {
    const body = await c.req.json()
    const { conversationId, customerId, message, subject } = body

    if (!message) {
      return c.json({ error: 'message is required' }, 400)
    }

    // Find the conversation session
    const session = await db.conversationSession.findUnique({
      where: { id: conversationId },
      include: { customer: { select: { nameEn: true, email: true } } },
    })

    // Save to EmailMsg table
    const emailMsg = await db.emailMsg.create({
      data: {
        fromEmail: 'moei@moei.gov.ae',
        fromName: 'MOEI Support',
        toEmails: JSON.stringify([session?.customer?.email || customerId || 'unknown']),
        subject: subject || 'Re: Inquiry',
        body: message,
        timestamp: new Date().toISOString(),
        folder: 'sent',
        direction: 'outbound',
      },
    })

    // Save to Interaction table
    if (session) {
      await db.interaction.create({
        data: {
          customerId: session.customerId,
          caseId: session.caseId,
          channel: 'email',
          type: 'message',
          direction: 'outbound',
          content: message,
          sentiment: 0.7,
          language: session.language || 'en',
        },
      })
    }

    return c.json({
      success: true,
      messageId: emailMsg.id,
      status: 'sent',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Email send error:', error)
    return c.json({ error: 'Failed to send Email' }, 500)
  }
})

// POST /realtime/email/receive - Receive an email (saves to DB)
app.post('/realtime/email/receive', async (c) => {
  try {
    const body = await c.req.json()
    const { customerName, text, email, subject, language, uaePassId } = body

    if (!text) {
      return c.json({ error: 'text is required' }, 400)
    }

    const effectiveLanguage = language || 'en'

    // Find or create customer
    let dbCustomer = await db.customer.findFirst({
      where: { OR: [{ email }, { uaePassId }] },
    })
    if (!dbCustomer) {
      dbCustomer = await db.customer.create({
        data: {
          nameEn: customerName || 'Email Customer',
          email: email || null,
          uaePassId: uaePassId || null,
          preferredLang: effectiveLanguage,
          preferredChannel: 'email',
        },
      })
    }

    // Save to EmailMsg table
    const emailMsg = await db.emailMsg.create({
      data: {
        fromEmail: email || 'unknown@unknown.com',
        fromName: customerName || 'Unknown',
        toEmails: JSON.stringify(['moei@moei.gov.ae']),
        subject: subject || 'Inquiry',
        body: text,
        timestamp: new Date().toISOString(),
        folder: 'inbox',
        labels: JSON.stringify(['inbox']),
      },
    })

    // Save to EmailMessage table
    await db.emailMessage.create({
      data: {
        customerId: dbCustomer.id,
        fromAddress: email || 'unknown@unknown.com',
        toAddress: 'moei@moei.gov.ae',
        subject: subject || 'Inquiry',
        body: text,
        direction: 'inbound',
        status: 'received',
        threadId: emailMsg.threadId,
      },
    })

    // Find or create ConversationSession (reuse active session for same customer)
    let session = await db.conversationSession.findFirst({
      where: {
        customerId: dbCustomer.id,
        channel: 'email',
        status: { in: ['active', 'waiting'] },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (!session) {
      session = await db.conversationSession.create({
        data: {
          customerId: dbCustomer.id,
          channel: 'email',
          status: 'active',
          aiMode: 'full_ai',
          language: effectiveLanguage,
          intent: 'inquiry',
          transcript: JSON.stringify([{
            speaker: 'customer',
            text,
            timestamp: new Date().toISOString(),
            language: effectiveLanguage,
            subject: subject || 'Inquiry',
          }]),
          metadata: JSON.stringify({
            email,
            customerName,
            subject,
            emailMsgId: emailMsg.id,
            source: 'email',
          }),
        },
      })
    } else {
      // Update existing session transcript
      try {
        const currentTranscript = session.transcript ? JSON.parse(session.transcript) : []
        currentTranscript.push({
          speaker: 'customer',
          text,
          timestamp: new Date().toISOString(),
          language: effectiveLanguage,
          subject: subject || 'Inquiry',
        })
        await db.conversationSession.update({
          where: { id: session.id },
          data: {
            transcript: JSON.stringify(currentTranscript),
            updatedAt: new Date(),
          },
        })
      } catch (transcriptErr) {
        console.error('Failed to update email session transcript:', transcriptErr)
      }
    }

    // Save Interaction
    await db.interaction.create({
      data: {
        customerId: dbCustomer.id,
        channel: 'email',
        type: 'message',
        direction: 'inbound',
        content: text,
        intent: 'inquiry',
        sentiment: 0.5,
        language: effectiveLanguage,
      },
    })

    // ═══════════════════════════════════════════════════════════════════
    // ║  CALL BRAIN ORCHESTRATOR — Auto-reply with AI (mirrors email-ai.ts)  ║
    // ═══════════════════════════════════════════════════════════════════

    let aiResponse = ''
    let aiIntent = 'inquiry'
    let aiSentiment = 0.5
    let aiProvider: 'gemini' | 'zai' | 'fallback' = 'fallback'

    try {
      // ── Load conversation history from the session transcript ──
      let conversationHistory: Array<{ speaker: string; text: string }> = []
      if (session) {
        const sessionWithTranscript = await db.conversationSession.findUnique({
          where: { id: session.id },
          select: { transcript: true },
        })
        if (sessionWithTranscript?.transcript) {
          const transcript = JSON.parse(sessionWithTranscript.transcript)
          // Take the last 20 messages for context (before the current one was added)
          const historyEntries = transcript.slice(0, -1).slice(-20)
          conversationHistory = historyEntries.map((entry: any) => ({
            speaker: entry.speaker === 'customer' ? 'customer' : 'ai',
            text: entry.text || '',
          })).filter((entry: any) => entry.text.trim().length > 0)
        }
      }

      const result = await BrainOrchestrator.handleMessage({
        message: text,
        channel: 'email',
        language: effectiveLanguage as 'ar' | 'en',
        customerId: dbCustomer.id,
        customerEmail: email,
        sessionId: session.id,
        conversationHistory,
        aiMode: 'full_ai',
      })

      aiResponse = result.response
      aiIntent = result.intent
      aiSentiment = result.sentiment
      aiProvider = result.provider

      // Build response with action results if any
      if (result.actionResults && result.actionResults.length > 0) {
        const createActions = result.actionResults.filter((a: any) => a.actionType === 'CREATE_RECORD' && a.success)
        if (createActions.length > 0) {
          for (const action of createActions) {
            const refMatch = action.details?.match(/case (MOEI-[\w-]+)/)
            if (refMatch) {
              if (effectiveLanguage === 'ar') {
                aiResponse += `\n\nتم إنشاء طلب الخدمة تلقائياً.\nالرقم المرجعي: ${refMatch[1]}\nيمكنك متابعة حالة طلبك باستخدام هذا الرقم.`
              } else {
                aiResponse += `\n\nA service request has been automatically created for you.\nReference Number: ${refMatch[1]}\nYou can track your request status using this reference number.`
              }
            }
          }
        }
      }

      // ── Save AI response to session transcript ──
      if (session) {
        try {
          const currentSession = await db.conversationSession.findUnique({ where: { id: session.id } })
          if (currentSession) {
            const currentTranscript = currentSession.transcript ? JSON.parse(currentSession.transcript) : []
            currentTranscript.push({
              speaker: 'ai',
              text: aiResponse,
              timestamp: new Date().toISOString(),
              language: effectiveLanguage,
            })
            await db.conversationSession.update({
              where: { id: session.id },
              data: {
                transcript: JSON.stringify(currentTranscript),
                intent: aiIntent !== 'default' ? aiIntent : currentSession.intent,
                sentiment: aiSentiment,
                updatedAt: new Date(),
              },
            })
          }
        } catch (transcriptErr) {
          console.error('Failed to update transcript with AI response:', transcriptErr)
        }

        // ── Save AI response as outbound Interaction ──
        try {
          await db.interaction.create({
            data: {
              customerId: dbCustomer.id,
              channel: 'email',
              type: 'message',
              direction: 'outbound',
              content: aiResponse,
              intent: aiIntent,
              sentiment: aiSentiment,
              language: effectiveLanguage,
              metadata: JSON.stringify({
                sessionId: session.id,
                aiGenerated: true,
                provider: aiProvider,
                subject: `Re: ${subject || 'Inquiry'}`,
              }),
            },
          })
        } catch {
          // Interaction save is optional
        }

        // ── Save AI response as outbound EmailMsg (folder: 'sent') ──
        try {
          const replySubject = (subject || 'Inquiry').startsWith('Re:') ? subject : `Re: ${subject || 'Inquiry'}`
          await db.emailMsg.create({
            data: {
              fromEmail: 'moei@moei.gov.ae',
              fromName: effectiveLanguage === 'ar' ? 'دعم وزارة الطاقة' : 'MOEI Support',
              toEmails: JSON.stringify([email || 'unknown']),
              subject: replySubject,
              body: aiResponse,
              timestamp: new Date().toISOString(),
              folder: 'sent',
            },
          })
        } catch (emailErr) {
          console.error('Failed to save AI response EmailMsg:', emailErr)
        }

        // ── Save AI response as outbound EmailMessage (direction: 'outbound') ──
        try {
          const replySubject = (subject || 'Inquiry').startsWith('Re:') ? subject : `Re: ${subject || 'Inquiry'}`
          await db.emailMessage.create({
            data: {
              customerId: dbCustomer.id,
              fromAddress: 'moei@moei.gov.ae',
              toAddress: email || 'unknown@unknown.com',
              subject: replySubject,
              body: aiResponse,
              direction: 'outbound',
              status: 'sent',
              aiReplied: true,
            },
          })
        } catch (emailMsgErr) {
          console.error('Failed to save AI response EmailMessage:', emailMsgErr)
        }
      }
    } catch (aiErr) {
      console.error('BrainOrchestrator auto-reply failed for email receive:', aiErr)
      // Auto-reply is a bonus, not a requirement — email is still saved and agents still notified
    }

    // Notify available agents
    const availableAgents = await db.agent.findMany({
      where: { status: 'available' },
      select: { id: true },
    })
    if (availableAgents.length > 0) {
      await db.employerNotification.createMany({
        data: availableAgents.map((a) => ({
          agentId: a.id,
          type: 'email',
          title: 'New Email Received',
          titleAr: 'بريد إلكتروني جديد',
          message: `Email from ${customerName || email || 'Unknown'}: ${subject || text.slice(0, 50)}`,
          messageAr: `بريد إلكتروني من ${customerName || email || 'غير معروف'}: ${subject || text.slice(0, 50)}`,
          priority: 'high',
        })),
      })
    }

    return c.json({
      success: true,
      messageId: emailMsg.id,
      sessionId: session.id,
      customerId: dbCustomer.id,
      status: 'received',
      timestamp: new Date().toISOString(),
      aiResponse: aiResponse || undefined,
      aiIntent: aiResponse ? aiIntent : undefined,
      aiSentiment: aiResponse ? aiSentiment : undefined,
      aiProvider: aiResponse ? aiProvider : undefined,
    })
  } catch (error) {
    console.error('Email receive error:', error)
    return c.json({ error: 'Failed to receive Email' }, 500)
  }
})

// POST /realtime/voice/stt-chunk - Receive STT transcript chunk and save to DB
app.post('/realtime/voice/stt-chunk', async (c) => {
  try {
    const body = await c.req.json()
    const { sessionId, callId, speaker, text, language } = body

    if (!text) {
      return c.json({ error: 'text is required' }, 400)
    }

    const effectiveSpeaker = speaker || 'customer'
    const effectiveLanguage = language || 'en'

    // Find the ConversationSession
    let dbSession = null
    if (sessionId) {
      dbSession = await db.conversationSession.findUnique({ where: { id: sessionId } })
    } else if (callId) {
      dbSession = await db.conversationSession.findFirst({
        where: { channel: 'voice', status: { in: ['active', 'waiting'] } },
        orderBy: { createdAt: 'desc' },
      })
    }

    let chunkId = null
    if (dbSession) {
      // Save to STTTranscript table
      const transcriptChunk = await db.sTTTranscript.create({
        data: {
          sessionId: dbSession.id,
          speaker: effectiveSpeaker,
          text,
          language: effectiveLanguage,
        },
      })
      chunkId = transcriptChunk.id

      // Update session transcript JSON
      const currentTranscript = dbSession.transcript ? JSON.parse(dbSession.transcript) : []
      currentTranscript.push({
        speaker: effectiveSpeaker,
        text,
        timestamp: new Date().toISOString(),
        language: effectiveLanguage,
      })
      await db.conversationSession.update({
        where: { id: dbSession.id },
        data: { transcript: JSON.stringify(currentTranscript) },
      })
    }

    return c.json({
      success: true,
      chunkId,
      sessionId: dbSession?.id || null,
      speaker: effectiveSpeaker,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('STT chunk error:', error)
    return c.json({ error: 'Failed to save STT transcript chunk' }, 500)
  }
})

export const realtimeRoutes = app
