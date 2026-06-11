/**
 * Service Request Management Routes - Hono
 * 
 * Endpoints:
 *   POST /requests               - Create a new service request from any channel
 *   GET  /requests/:ref          - Track request status by reference number
 *   GET  /requests/customer/:customerId - List all requests for a customer
 *   PUT  /requests/:id/status    - Update request status
 */

import { Hono } from 'hono'
import { db } from '../lib/db'

const app = new Hono()

// ─── Reference Number Generator ───────────────────────────────────────────────
// Format: MOEI-YYYYMMDD-NNNN (sequential per day)
async function generateReferenceNumber(): Promise<string> {
  const now = new Date()
  const dateStr = now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0')

  const prefix = `MOEI-${dateStr}-`

  // Find the last reference number for today across both Case and ServiceRequest
  const [lastCase, lastRequest] = await Promise.all([
    db.case.findFirst({
      where: { referenceNumber: { startsWith: prefix } },
      orderBy: { referenceNumber: 'desc' },
      select: { referenceNumber: true },
    }),
    db.serviceRequest.findFirst({
      where: { referenceNumber: { startsWith: prefix } },
      orderBy: { referenceNumber: 'desc' },
      select: { referenceNumber: true },
    }),
  ])

  let lastSeq = 0
  for (const ref of [lastCase?.referenceNumber, lastRequest?.referenceNumber]) {
    if (ref) {
      const seq = parseInt(ref.slice(-4), 10)
      if (!isNaN(seq) && seq > lastSeq) lastSeq = seq
    }
  }

  return `${prefix}${String(lastSeq + 1).padStart(4, '0')}`
}

// ─── POST /requests ───────────────────────────────────────────────────────────
// Create a new service request from any channel
app.post('/requests', async (c) => {
  try {
    const body = await c.req.json()
    const { customerId, serviceId, channel, data, customerEmail, customerName, language } = body

    if (!customerId) {
      return c.json({ error: 'customerId is required' }, 400)
    }

    // Find or create customer
    let customer = await db.customer.findUnique({ where: { id: customerId } })
    if (!customer) {
      // Try to find by email or phone if provided
      if (customerEmail) {
        customer = await db.customer.findUnique({ where: { email: customerEmail } })
      }
      if (!customer && body.customerPhone) {
        customer = await db.customer.findUnique({ where: { phone: body.customerPhone } })
      }
      // Create customer if still not found
      if (!customer) {
        customer = await db.customer.create({
          data: {
            nameEn: customerName || 'Customer',
            nameAr: body.customerNameAr || null,
            email: customerEmail || null,
            phone: body.customerPhone || null,
            preferredLang: language || 'en',
            preferredChannel: channel || 'web',
          },
        })
      }
    }

    // Find or create service
    let service: any = null
    if (serviceId) {
      service = await db.service.findUnique({ where: { id: serviceId } })
    }
    if (!service) {
      // Create a service entry from the category or use a generic one
      const serviceName = body.serviceName || serviceId || 'General Inquiry'
      const category = body.category || 'general'
      service = await db.service.create({
        data: {
          nameEn: serviceName,
          nameAr: body.serviceNameAr || serviceName,
          descriptionEn: body.serviceDescription || `Service request: ${serviceName}`,
          descriptionAr: body.serviceDescriptionAr || `طلب خدمة: ${serviceName}`,
          category,
          isActive: true,
        },
      })
    }

    // Generate reference number
    const referenceNumber = await generateReferenceNumber()
    const effectiveCustomerId = customer.id
    const effectiveServiceId = service.id

    // Create a Case
    const caseRecord = await db.case.create({
      data: {
        referenceNumber,
        customerId: effectiveCustomerId,
        titleEn: service.nameEn,
        titleAr: service.nameAr || service.nameEn,
        description: data ? JSON.stringify(data) : `Service request: ${service.nameEn}`,
        status: 'open',
        priority: 'medium',
        category: service.category,
        channel: channel || 'web',
      },
    })

    // Create ServiceRequest
    const request = await db.serviceRequest.create({
      data: {
        customerId: effectiveCustomerId,
        serviceId: effectiveServiceId,
        status: 'pending',
        referenceNumber,
        data: data ? JSON.stringify(data) : null,
      },
    })

    // Create ConversationSession
    const effectiveLanguage = language || customer.preferredLang || 'en'
    const session = await db.conversationSession.create({
      data: {
        customerId: effectiveCustomerId,
        channel: channel || 'web',
        status: 'active',
        aiMode: 'full_ai',
        language: effectiveLanguage,
        intent: 'service_request',
        caseId: caseRecord.id,
        serviceRequestId: request.id,
        metadata: JSON.stringify({
          referenceNumber,
          serviceName: service.nameEn,
          customerEmail: customerEmail || customer.email,
          customerName: customerName || customer.nameEn,
        }),
      },
    })

    // Create EmployerNotifications for all agents
    const agents = await db.agent.findMany({
      where: { status: 'available' },
      select: { id: true },
    })

    if (agents.length > 0) {
      await db.employerNotification.createMany({
        data: agents.map((agent) => ({
          agentId: agent.id,
          type: 'request_created',
          title: 'New Service Request',
          titleAr: 'طلب خدمة جديد',
          message: `New ${channel || 'web'} request: ${service.nameEn} (Ref: ${referenceNumber})`,
          messageAr: `طلب ${channel === 'voice' ? 'صوتي' : channel === 'whatsapp' ? 'واتساب' : 'إلكتروني'} جديد: ${service.nameAr || service.nameEn} (مرجع: ${referenceNumber})`,
          priority: 'high',
          link: `/conversations/${session.id}`,
          metadata: JSON.stringify({
            requestId: request.id,
            caseId: caseRecord.id,
            sessionId: session.id,
            referenceNumber,
          }),
        })),
      })
    }

    // Send confirmation email if customer has email
    let confirmationSent = false
    const emailToUse = customerEmail || customer.email
    if (emailToUse) {
      try {
        await fetch('http://localhost:3002/api/email/send-request-confirmation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: emailToUse,
            referenceNumber,
            customerName: customerName || customer.nameEn || customer.nameAr || 'Customer',
            language: effectiveLanguage,
            channel: channel || 'web',
          }),
        })
        confirmationSent = true
      } catch (emailError) {
        console.error('Confirmation email send failed:', emailError)
        // Don't fail the request if email fails
      }
    }

    return c.json({
      requestId: request.id,
      referenceNumber,
      caseId: caseRecord.id,
      sessionId: session.id,
      confirmationSent,
    }, 201)
  } catch (error) {
    console.error('Service request create error:', error)
    return c.json({ error: 'Failed to create service request' }, 500)
  }
})

// ─── GET /requests/:ref ───────────────────────────────────────────────────────
// Track request status by reference number
app.get('/requests/:ref', async (c) => {
  try {
    const { ref } = c.req.param()

    const request = await db.serviceRequest.findUnique({
      where: { referenceNumber: ref },
      include: {
        customer: {
          select: {
            id: true,
            nameEn: true,
            nameAr: true,
            email: true,
            phone: true,
            preferredLang: true,
          },
        },
        service: {
          select: {
            id: true,
            nameEn: true,
            nameAr: true,
            category: true,
          },
        },
      },
    })

    if (!request) {
      return c.json({ error: 'Request not found' }, 404)
    }

    // Find associated conversation session
    const session = await db.conversationSession.findFirst({
      where: { serviceRequestId: request.id },
      select: {
        id: true,
        status: true,
        channel: true,
        aiMode: true,
        language: true,
        createdAt: true,
      },
    })

    return c.json({
      ...request,
      data: request.data ? JSON.parse(request.data) : null,
      session,
    })
  } catch (error) {
    console.error('Request track error:', error)
    return c.json({ error: 'Failed to track request' }, 500)
  }
})

// ─── GET /requests/customer/:customerId ───────────────────────────────────────
// List all requests for a customer
app.get('/requests/customer/:customerId', async (c) => {
  try {
    const { customerId } = c.req.param()

    const requests = await db.serviceRequest.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      include: {
        service: {
          select: {
            id: true,
            nameEn: true,
            nameAr: true,
            category: true,
          },
        },
      },
    })

    const result = requests.map((req) => ({
      id: req.id,
      referenceNumber: req.referenceNumber,
      status: req.status,
      serviceName: req.service.nameEn,
      serviceNameAr: req.service.nameAr,
      category: req.service.category,
      data: req.data ? JSON.parse(req.data) : null,
      createdAt: req.createdAt,
      updatedAt: req.updatedAt,
    }))

    return c.json({ requests: result, count: result.length })
  } catch (error) {
    console.error('Customer requests error:', error)
    return c.json({ error: 'Failed to fetch customer requests' }, 500)
  }
})

// ─── PUT /requests/:id/status ─────────────────────────────────────────────────
// Update request status
app.put('/requests/:id/status', async (c) => {
  try {
    const { id } = c.req.param()
    const body = await c.req.json()
    const { status } = body

    const validStatuses = ['pending', 'in_progress', 'resolved', 'closed', 'cancelled']
    if (!status || !validStatuses.includes(status)) {
      return c.json({ error: `status must be one of: ${validStatuses.join(', ')}` }, 400)
    }

    const request = await db.serviceRequest.update({
      where: { id },
      data: { status },
    })

    // Also update associated case if exists
    const session = await db.conversationSession.findFirst({
      where: { serviceRequestId: id },
      select: { id: true, caseId: true, customerId: true },
    })

    if (session?.caseId) {
      const caseStatus = status === 'resolved' || status === 'closed' ? 'resolved' : status === 'in_progress' ? 'in_progress' : undefined
      if (caseStatus) {
        await db.case.update({
          where: { id: session.caseId },
          data: {
            status: caseStatus,
            ...(caseStatus === 'resolved' ? { resolvedAt: new Date() } : {}),
          },
        })
      }

      // If resolved/closed, also update session
      if (status === 'resolved' || status === 'closed') {
        await db.conversationSession.update({
          where: { id: session.id },
          data: {
            status: 'closed',
            endedAt: new Date(),
          },
        })
      }
    }

    return c.json({
      requestId: request.id,
      referenceNumber: request.referenceNumber,
      status: request.status,
      updatedAt: request.updatedAt,
    })
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return c.json({ error: 'Request not found' }, 404)
    }
    console.error('Request status update error:', error)
    return c.json({ error: 'Failed to update request status' }, 500)
  }
})

export const requestRoutes = app
