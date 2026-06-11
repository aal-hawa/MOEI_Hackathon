/**
 * Intent Route
 * POST /api/intent - Classify user intent
 */

import { Hono } from 'hono'
import { sanitizeInput } from '../lib/edge-security'

const app = new Hono()

app.post('/intent', async (c) => {
  try {
    const body = await c.req.json()
    const { message, language } = body

    if (!message) return c.json({ error: 'message is required' }, 400)

    const sanitized = sanitizeInput(message, 2000)
    const lang = language === 'ar' ? 'ar' : 'en'

    // Simple intent classification based on keywords
    const keywords: Record<string, string[]> = {
      electricity: ['electricity', 'power', 'كهرباء', 'طاقة'],
      water: ['water', 'مياه', 'ماء'],
      housing: ['housing', 'home', 'house', 'سكن', 'إسكان', 'بيت'],
      petroleum: ['petroleum', 'fuel', 'gas', 'بترول', 'وقود', 'غاز'],
      transport: ['transport', 'vehicle', 'car', 'نقل', 'مركبة', 'سيارة'],
      sustainability: ['sustainability', 'green', 'solar', 'استدامة', 'أخضر', 'شمسي'],
      complaint: ['complaint', 'problem', 'issue', 'شكوى', 'مشكلة'],
      bill: ['bill', 'payment', 'invoice', 'فاتورة', 'دفع'],
      connection: ['connection', 'new connection', 'توصيل', 'ربط'],
    }

    let detectedIntent = 'general_inquiry'
    const lowerMsg = sanitized.toLowerCase()

    for (const [intent, words] of Object.entries(keywords)) {
      if (words.some(w => lowerMsg.includes(w))) {
        detectedIntent = intent
        break
      }
    }

    return c.json({ intent: detectedIntent, language: lang, confidence: 0.7 })
  } catch (error) {
    console.error('Intent POST error:', error)
    return c.json({ error: 'Failed to classify intent' }, 500)
  }
})

export const intentRoutes = app
