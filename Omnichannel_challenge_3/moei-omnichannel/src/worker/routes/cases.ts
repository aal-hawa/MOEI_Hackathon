/**
 * Cases Routes
 * GET /api/cases
 * POST /api/cases
 * GET /api/cases/:id
 * PUT /api/cases/:id
 * GET /api/cases/lookup
 */

import { Hono } from 'hono'
import { db } from '../lib/db'
import { sanitizeInput } from '../lib/edge-security'

const app = new Hono()

function generateReferenceNumber(): string {
  const prefix = 'MOEI'
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let id = ''
  for (let i = 0; i < 4; i++) id += chars[Math.floor(Math.random() * chars.length)]
  return `${prefix}-${id}`
}

const VALID_STATUSES = ['open', 'in_progress', 'resolved', 'closed']
const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent']
const VALID_CHANNELS = ['web', 'whatsapp', 'voice', 'email']

// GET /cases
app.get('/cases', async (c) => {
  try {
    const status = c.req.query('status')
    const priority = c.req.query('priority')
    const channel = c.req.query('channel')
    const customerId = c.req.query('customerId')

    const where: Record<string, unknown> = {}
    if (status && VALID_STATUSES.includes(status)) where.status = status
    if (priority && VALID_PRIORITIES.includes(priority)) where.priority = priority
    if (channel && VALID_CHANNELS.includes(channel)) where.channel = channel
    if (customerId) where.customerId = customerId

    const cases = await db.case.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: { id: true, nameEn: true, nameAr: true } },
        _count: { select: { interactions: true } },
      },
    })

    return c.json(cases)
  } catch (error) {
    console.error('Cases GET error:', error)
    return c.json({ error: 'Failed to fetch cases' }, 500)
  }
})

// POST /cases
app.post('/cases', async (c) => {
  try {
    const body = await c.req.json()
    const { customerId, titleAr, titleEn, description, priority, category, channel, assignedAgent, email, name } = body

    if (!titleEn) return c.json({ error: 'titleEn is required' }, 400)

    let resolvedCustomerId: string | undefined = customerId

    if (resolvedCustomerId && !resolvedCustomerId.startsWith('session-')) {
      const existingCustomer = await db.customer.findUnique({ where: { id: resolvedCustomerId } })
      if (!existingCustomer) resolvedCustomerId = undefined
    } else {
      resolvedCustomerId = undefined
    }

    if (!resolvedCustomerId) {
      if (email) {
        const existing = await db.customer.findFirst({ where: { email } })
        if (existing) {
          resolvedCustomerId = existing.id
        } else {
          const newCustomer = await db.customer.create({
            data: { nameEn: name || email.split('@')[0] || 'Customer', email, preferredLang: 'en', preferredChannel: channel || 'web' },
          })
          resolvedCustomerId = newCustomer.id
        }
      } else if (name) {
        const existing = await db.customer.findFirst({ where: { nameEn: name } })
        if (existing) {
          resolvedCustomerId = existing.id
        } else {
          const newCustomer = await db.customer.create({
            data: { nameEn: name, preferredLang: 'en', preferredChannel: channel || 'web' },
          })
          resolvedCustomerId = newCustomer.id
        }
      }
    }

    if (!resolvedCustomerId) {
      return c.json({ error: 'Could not identify customer' }, 400)
    }

    let assignedAgentId = assignedAgent || null
    if (!assignedAgentId) {
      const availableAgents = await db.agent.findMany({ where: { status: 'available' }, orderBy: { activeCases: 'asc' } })
      if (availableAgents.length > 0) {
        const categoryMatch = availableAgents.find(agent => {
          try { const skills = agent.skills ? JSON.parse(agent.skills) : []; return Array.isArray(skills) && skills.includes(category) } catch { return false }
        })
        assignedAgentId = (categoryMatch || availableAgents[0]).id
        await db.agent.update({ where: { id: assignedAgentId }, data: { activeCases: { increment: 1 } } })
      }
    }

    const referenceNumber = generateReferenceNumber()
    const newCase = await db.case.create({
      data: {
        referenceNumber,
        customerId: resolvedCustomerId,
        titleAr: titleAr ? sanitizeInput(titleAr, 200) : undefined,
        titleEn: sanitizeInput(titleEn, 200),
        description: description ? sanitizeInput(description, 2000) : undefined,
        status: 'open',
        priority: priority || 'medium',
        category: category ? sanitizeInput(category, 50) : undefined,
        channel: channel || 'web',
        assignedAgent: assignedAgentId,
      },
      include: { customer: { select: { id: true, nameEn: true, nameAr: true } } },
    })

    return c.json({ ...newCase, referenceNumber: newCase.referenceNumber }, 201)
  } catch (error) {
    console.error('Cases POST error:', error)
    return c.json({ error: 'Failed to create case' }, 500)
  }
})

// GET /cases/lookup
app.get('/cases/lookup', async (c) => {
  try {
    const ref = c.req.query('ref')
    if (!ref) return c.json({ error: 'Reference number (ref) is required' }, 400)

    const caseData = await db.case.findUnique({
      where: { referenceNumber: ref },
      include: {
        customer: { select: { id: true, nameEn: true, nameAr: true } },
        interactions: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    })
    if (!caseData) return c.json({ error: 'Case not found' }, 404)
    return c.json(caseData)
  } catch (error) {
    console.error('Case lookup error:', error)
    return c.json({ error: 'Failed to lookup case' }, 500)
  }
})

// GET /cases/:id
app.get('/cases/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const caseData = await db.case.findUnique({
      where: { id },
      include: {
        customer: true,
        interactions: { orderBy: { createdAt: 'desc' } },
        feedbacks: true,
      },
    })
    if (!caseData) return c.json({ error: 'Case not found' }, 404)
    return c.json(caseData)
  } catch (error) {
    console.error('Case GET error:', error)
    return c.json({ error: 'Failed to fetch case' }, 500)
  }
})

// PUT /cases/:id
app.put('/cases/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const body = await c.req.json()

    const existing = await db.case.findUnique({ where: { id } })
    if (!existing) return c.json({ error: 'Case not found' }, 404)

    const updateData: Record<string, unknown> = {}
    const allowedFields = ['status', 'priority', 'assignedAgent', 'resolution', 'titleEn', 'titleAr', 'description', 'category', 'channel']
    for (const field of allowedFields) {
      if (body[field] !== undefined) updateData[field] = body[field]
    }

    if (body.status === 'resolved' && !existing.resolvedAt) {
      updateData.resolvedAt = new Date()
    }

    const updated = await db.case.update({ where: { id }, data: updateData })
    return c.json(updated)
  } catch (error) {
    console.error('Case PUT error:', error)
    return c.json({ error: 'Failed to update case' }, 500)
  }
})

export const casesRoutes = app
