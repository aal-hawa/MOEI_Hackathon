/**
 * Service Rule Agent Context Route
 * GET /api/service-rules/agent-context
 */

import { Hono } from 'hono'
import { db } from '../lib/db'

const app = new Hono()

app.get('/service-rules/agent-context', async (c) => {
  try {
    const category = c.req.query('category')
    const where: Record<string, unknown> = { isActive: true }
    if (category) where.category = category

    const rules = await db.serviceRule.findMany({
      where,
      select: {
        id: true,
        nameEn: true,
        nameAr: true,
        category: true,
        agentInstructionsEn: true,
        agentInstructionsAr: true,
        requiredActions: true,
        autoResponseEn: true,
        autoResponseAr: true,
        fields: {
          where: { isActive: true },
          select: {
            fieldKey: true,
            labelEn: true,
            labelAr: true,
            fieldType: true,
            required: true,
            forActions: true,
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
    })

    const formatted = rules.map(r => ({
      ...r,
      requiredActions: r.requiredActions ? JSON.parse(r.requiredActions as string) : [],
      fields: r.fields.map(f => ({
        ...f,
        forActions: f.forActions ? JSON.parse(f.forActions as string) : [],
      })),
    }))

    return c.json(formatted)
  } catch (error) {
    console.error('Agent context GET error:', error)
    return c.json({ error: 'Failed to fetch agent context' }, 500)
  }
})

export const serviceRuleAgentContextRoutes = app
