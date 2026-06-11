/**
 * Translations Route
 * GET /api/translations
 */

import { Hono } from 'hono'
import { db } from '../lib/db'

const app = new Hono()

app.get('/translations', async (c) => {
  try {
    const category = c.req.query('category')
    const where = category ? { category } : {}

    const translations = await db.translation.findMany({ where })
    const result: Record<string, { en: string; ar: string }> = {}
    for (const t of translations) {
      result[t.key] = { en: t.en, ar: t.ar }
    }
    return c.json(result)
  } catch (error) {
    console.error('Translations GET error:', error)
    return c.json({ error: 'Failed to fetch translations' }, 500)
  }
})

export const translationsRoutes = app
