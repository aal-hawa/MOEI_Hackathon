/**
 * Feedback Route
 * POST /api/feedback
 */

import { Hono } from 'hono'
import { db } from '../lib/db'

const app = new Hono()

app.post('/feedback', async (c) => {
  try {
    const body = await c.req.json()
    const { customerId, caseId, rating, categories, comment, channel } = body

    if (rating === undefined || rating < 1 || rating > 5) {
      return c.json({ error: 'Rating must be between 1 and 5' }, 400)
    }

    const feedback = await db.feedback.create({
      data: {
        customerId: customerId || null,
        caseId: caseId || null,
        rating,
        categories: categories ? JSON.stringify(categories) : '{}',
        comment: comment || null,
        channel: channel || 'web',
      },
    })

    return c.json(feedback, 201)
  } catch (error) {
    console.error('Feedback POST error:', error)
    return c.json({ error: 'Failed to submit feedback' }, 500)
  }
})

app.get('/feedback', async (c) => {
  try {
    const feedback = await db.feedback.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20
    })
    return c.json(feedback)
  } catch (error) {
    console.error('Feedback GET error:', error)
    return c.json({ error: 'Failed to fetch feedback' }, 500)
  }
})

export const feedbackRoutes = app
