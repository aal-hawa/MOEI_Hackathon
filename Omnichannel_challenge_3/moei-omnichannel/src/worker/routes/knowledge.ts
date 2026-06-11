/**
 * Knowledge Route
 * GET /api/knowledge
 */

import { Hono } from 'hono'
import { db } from '../lib/db'

const app = new Hono()

app.get('/knowledge', async (c) => {
  try {
    const category = c.req.query('category')
    const search = c.req.query('search')

    const where: Record<string, unknown> = { isActive: true }
    if (category) where.category = category
    if (search) {
      where.OR = [
        { titleEn: { contains: search } },
        { titleAr: { contains: search } },
        { contentEn: { contains: search } },
        { contentAr: { contains: search } },
      ]
    }

    const articles = await db.knowledgeArticle.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return c.json(articles)
  } catch (error) {
    console.error('Knowledge GET error:', error)
    return c.json({ error: 'Failed to fetch knowledge articles' }, 500)
  }
})

export const knowledgeRoutes = app
