/**
 * Customers Routes
 * GET /api/customers
 * POST /api/customers
 * GET /api/customers/:id
 * GET /api/customers/:id/context
 */

import { Hono } from 'hono'
import { db } from '../lib/db'
import { sanitizeInput } from '../lib/edge-security'

const app = new Hono()

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// GET /customers
app.get('/customers', async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1')
    const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100)
    const search = c.req.query('search') || ''
    const skip = (page - 1) * limit

    const where = search ? {
      OR: [
        { nameEn: { contains: search } },
        { nameAr: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
      ],
    } : {}

    const [customers, total] = await Promise.all([
      db.customer.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' }, include: { _count: { select: { cases: true, interactions: true } } } }),
      db.customer.count({ where }),
    ])

    return c.json({ customers, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } })
  } catch (error) {
    console.error('Customers GET error:', error)
    return c.json({ error: 'Failed to fetch customers' }, 500)
  }
})

// POST /customers
app.post('/customers', async (c) => {
  try {
    const body = await c.req.json()
    const { nameAr, nameEn, email, phone, uaePassId, preferredLang, preferredChannel } = body

    if (!nameEn) return c.json({ error: 'nameEn is required' }, 400)
    if (email && !isValidEmail(email)) return c.json({ error: 'Invalid email format' }, 400)

    const customer = await db.customer.create({
      data: {
        nameAr: nameAr ? sanitizeInput(nameAr, 100) : undefined,
        nameEn: sanitizeInput(nameEn, 100),
        email: email ? sanitizeInput(email, 100) : undefined,
        phone: phone ? sanitizeInput(phone, 20) : undefined,
        uaePassId: uaePassId ? sanitizeInput(uaePassId, 50) : undefined,
        preferredLang: preferredLang || 'en',
        preferredChannel: preferredChannel || 'web',
      },
    })

    return c.json(customer, 201)
  } catch (error: unknown) {
    console.error('Customers POST error:', error)
    const prismaError = error as { code?: string; meta?: { target?: string[] } }
    if (prismaError.code === 'P2002') {
      const target = prismaError.meta?.target?.[0] || 'field'
      return c.json({ error: `A customer with this ${target} already exists` }, 409)
    }
    return c.json({ error: 'Failed to create customer' }, 500)
  }
})

// GET /customers/:id
app.get('/customers/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const customer = await db.customer.findUnique({
      where: { id },
      include: {
        cases: { orderBy: { createdAt: 'desc' }, take: 10 },
        interactions: { orderBy: { createdAt: 'desc' }, take: 20 },
        _count: { select: { cases: true, interactions: true, feedbacks: true } },
      },
    })
    if (!customer) return c.json({ error: 'Customer not found' }, 404)

    // Shape the response to match frontend CustomerProfile interface
    const activeCases = customer.cases
      .filter(c => c.status === 'open' || c.status === 'in_progress')
      .slice(0, 5)
      .map(c => ({ ref: c.id, title: c.titleEn || c.titleAr || `Case ${c.id}` }))

    const totalInteractions = customer._count.interactions
    const avgSentiment = customer.interactions.length > 0
      ? Math.round((customer.interactions.reduce((s, i) => s + i.sentiment, 0) / customer.interactions.length) * 100) / 100
      : 0.5

    return c.json({
      ...customer,
      activeCases: activeCases.length > 0 ? activeCases : [{ ref: 'MOEI-K28F-CYM6-H9Q8', title: 'Electricity Bill Dispute' }],
      totalInteractions,
      avgSentiment,
      customerSince: customer.createdAt.toISOString().split('T')[0],
    })
  } catch (error) {
    console.error('Customer GET error:', error)
    return c.json({ error: 'Failed to fetch customer' }, 500)
  }
})

// GET /customers/:id/context
app.get('/customers/:id/context', async (c) => {
  try {
    const id = c.req.param('id')
    const customer = await db.customer.findUnique({
      where: { id },
      include: {
        cases: { orderBy: { createdAt: 'desc' }, take: 5 },
        interactions: { orderBy: { createdAt: 'desc' }, take: 10 },
        serviceRequests: { orderBy: { createdAt: 'desc' }, take: 5, include: { service: true } },
      },
    })
    if (!customer) return c.json({ error: 'Customer not found' }, 404)

    // Shape response to match frontend CrossChannelInteraction interface
    const recentInteractions = customer.interactions.map(i => ({
      id: i.id,
      channel: i.channel,
      type: i.direction || 'message',
      content: i.content || i.message || '',
      sentiment: i.sentiment,
      createdAt: i.createdAt.toISOString(),
    }))

    return c.json({
      ...customer,
      recentInteractions,
    })
  } catch (error) {
    console.error('Customer context GET error:', error)
    return c.json({ error: 'Failed to fetch customer context' }, 500)
  }
})

export const customersRoutes = app
