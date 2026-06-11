/**
 * Chat Config Route
 * GET /api/chat-config         — Get all chat config entries
 * GET /api/chat-config/:key    — Get a specific config entry
 * PUT /api/chat-config/:key    — Update a config entry
 * POST /api/chat-config        — Create a new config entry (or seed defaults)
 * DELETE /api/chat-config/:key — Delete a config entry
 */

import { Hono } from 'hono'
import { db } from '../lib/db'

const app = new Hono()

// Default chat config values (seeded on first read if not present)
const DEFAULT_CONFIGS = [
  {
    key: 'welcome_message',
    valueEn: 'Hello! I am the AI assistant for the Ministry of Energy & Infrastructure. How can I help you today?',
    valueAr: 'مرحباً! أنا المساعد الذكي لوزارة الطاقة والبنية التحتية. كيف يمكنني مساعدتك اليوم؟',
    description: 'The first message shown when a customer opens the chat widget.',
  },
  {
    key: 'fallback_default',
    valueEn: 'Thank you for your message. I\'m here to assist you with Ministry of Energy & Infrastructure services including electricity, water, housing, petroleum, and transport. Could you please specify which service you need help with?',
    valueAr: 'شكراً لرسالتك. أنا هنا لمساعدتك في خدمات وزارة الطاقة والبنية التحتية بما في ذلك الكهرباء والمياه والإسكان والبترول والنقل. هل يمكنك تحديد الخدمة التي تحتاج مساعدة فيها؟',
    description: 'Default fallback response when no intent is matched.',
  },
  {
    key: 'fallback_electricity',
    valueEn: 'For electricity services, I can help you with new connections, billing inquiries, outage reports, and meter readings. Please provide your account number or Emirates ID for faster assistance.',
    valueAr: 'لخدمات الكهرباء، يمكنني مساعدتك في التوصيلات الجديدة، واستفسارات الفواتير، وبلانات الانقطاع، وقراءات العدادات. يرجى تزويدي برقم حسابك أو رقم الهوية لتسريع المساعدة.',
    description: 'Fallback response for electricity-related queries.',
  },
  {
    key: 'fallback_water',
    valueEn: 'For water services, I can assist with water connection requests, leak reports, billing questions, and conservation tips. Please share your account details. For urgent water safety issues, please call 998 immediately.',
    valueAr: 'لخدمات المياه، يمكنني مساعدتك في طلبات توصيل المياه، وبلانات التسرب، وأسئلة الفواتير، ونصائح الترشيد. يرجى مشاركة تفاصيل حسابك. لقضايا سلامة المياه العاجلة، يرجى الاتصال على 998 فوراً.',
    description: 'Fallback response for water-related queries.',
  },
  {
    key: 'fallback_housing',
    valueEn: 'For housing services, I can help with housing applications, maintenance requests, Sheikh Zayed Housing Programme inquiries, and rental support. Please provide your application reference number if available.',
    valueAr: 'لخدمات الإسكان، يمكنني مساعدتك في طلبات الإسكان، وطلبات الصيانة، واستفسارات برنامج الشيخ زايد للإسكان، ودعم الإيجار. يرجى تزويدي برقم مرجع طلبك إن وجد.',
    description: 'Fallback response for housing-related queries.',
  },
  {
    key: 'fallback_complaint',
    valueEn: 'I understand you\'d like to file a complaint. I\'ll help you create a case right away. Please describe your issue in detail, including any reference numbers.',
    valueAr: 'أفهم أنك ترغب في تقديم شكوى. سأساعدك في إنشاء حالة فوراً. يرجى وصف مشكلتك بالتفصيل، مع ذكر أي أرقام مرجعية.',
    description: 'Fallback response for complaint-related queries.',
  },
  {
    key: 'fallback_case',
    valueEn: 'To check your case status, please provide your case reference number (e.g., MOEI-XXXX). I can look it up for you right now.',
    valueAr: 'للتحقق من حالة حالتك، يرجى تزويدي برقم الحالة المرجعي (مثال: MOEI-XXXX). يمكنني البحث عنه لك الآن.',
    description: 'Fallback response for case status queries.',
  },
  {
    key: 'fallback_help',
    valueEn: 'I can help you with: Electricity & Water services, Housing programmes, Petroleum services, Transport services, Case status tracking, Filing complaints, and General inquiries. What would you like help with?',
    valueAr: 'يمكنني مساعدتك في: خدمات الكهرباء والمياه، برامج الإسكان، خدمات البترول، خدمات النقل، تتبع حالة الحالات، تقديم الشكاوى، والاستفسارات العامة. بماذا ترغب في الحصول على مساعدة؟',
    description: 'Fallback response for general help queries.',
  },
]

// Ensure defaults exist in DB (called lazily)
async function ensureDefaults() {
  for (const cfg of DEFAULT_CONFIGS) {
    const existing = await db.chatConfig.findUnique({ where: { key: cfg.key } })
    if (!existing) {
      await db.chatConfig.create({
        data: {
          key: cfg.key,
          valueEn: cfg.valueEn,
          valueAr: cfg.valueAr,
          description: cfg.description,
          isActive: true,
        },
      })
    }
  }
}

// GET /api/chat-config — Get all configs
app.get('/chat-config', async (c) => {
  try {
    await ensureDefaults()
    const configs = await db.chatConfig.findMany({ orderBy: { key: 'asc' } })
    return c.json(configs)
  } catch (error) {
    console.error('ChatConfig GET error:', error)
    return c.json({ error: 'Failed to fetch chat config' }, 500)
  }
})

// GET /api/chat-config/:key — Get a specific config
app.get('/chat-config/:key', async (c) => {
  try {
    const key = c.req.param('key')
    await ensureDefaults()
    const config = await db.chatConfig.findUnique({ where: { key } })
    if (!config) {
      return c.json({ error: 'Config not found' }, 404)
    }
    return c.json(config)
  } catch (error) {
    console.error('ChatConfig GET :key error:', error)
    return c.json({ error: 'Failed to fetch chat config' }, 500)
  }
})

// PUT /api/chat-config/:key — Update a config entry
app.put('/chat-config/:key', async (c) => {
  try {
    const key = c.req.param('key')
    const body = await c.req.json()
    const { valueEn, valueAr, description, isActive } = body

    const existing = await db.chatConfig.findUnique({ where: { key } })
    if (!existing) {
      // Create if doesn't exist (upsert behavior)
      const created = await db.chatConfig.create({
        data: {
          key,
          valueEn: valueEn || '',
          valueAr: valueAr || null,
          description: description || null,
          isActive: isActive !== undefined ? isActive : true,
        },
      })
      return c.json(created, 201)
    }

    const updated = await db.chatConfig.update({
      where: { key },
      data: {
        ...(valueEn !== undefined && { valueEn }),
        ...(valueAr !== undefined && { valueAr }),
        ...(description !== undefined && { description }),
        ...(isActive !== undefined && { isActive }),
      },
    })
    return c.json(updated)
  } catch (error) {
    console.error('ChatConfig PUT error:', error)
    return c.json({ error: 'Failed to update chat config' }, 500)
  }
})

// POST /api/chat-config — Create a new config entry
app.post('/chat-config', async (c) => {
  try {
    const body = await c.req.json()
    const { key, valueEn, valueAr, description, isActive } = body

    if (!key || !valueEn) {
      return c.json({ error: 'key and valueEn are required' }, 400)
    }

    const existing = await db.chatConfig.findUnique({ where: { key } })
    if (existing) {
      return c.json({ error: 'Config with this key already exists' }, 409)
    }

    const created = await db.chatConfig.create({
      data: {
        key,
        valueEn,
        valueAr: valueAr || null,
        description: description || null,
        isActive: isActive !== undefined ? isActive : true,
      },
    })
    return c.json(created, 201)
  } catch (error) {
    console.error('ChatConfig POST error:', error)
    return c.json({ error: 'Failed to create chat config' }, 500)
  }
})

// DELETE /api/chat-config/:key — Delete a config entry
app.delete('/chat-config/:key', async (c) => {
  try {
    const key = c.req.param('key')
    await db.chatConfig.delete({ where: { key } })
    return c.json({ success: true })
  } catch (error) {
    console.error('ChatConfig DELETE error:', error)
    return c.json({ error: 'Failed to delete chat config' }, 500)
  }
})

export const chatConfigRoutes = app
