/**
 * Service Rules Routes
 * GET /api/service-rules - List all rules
 * POST /api/service-rules - Create rule
 * GET /api/service-rules/test - Get rule stats (MUST be before /:id)
 * POST /api/service-rules/test - Test a message against rules
 * GET /api/service-rules/_analytics - Get analytics with date/category filters
 * POST /api/service-rules/_analytics/log - Log a rule hit
 * DELETE /api/service-rules/_analytics - Reset analytics data
 * GET /api/service-rules/:id - Get single rule
 * PUT /api/service-rules/:id - Update rule
 * DELETE /api/service-rules/:id - Delete rule
 */

import { Hono } from 'hono'
import { db } from '../lib/db'

const app = new Hono()

const BUILT_IN_CATEGORY_KEYS = [
  'electricity_water', 'housing', 'petroleum', 'transport', 'sustainability', 'general',
]

async function getValidCategoryKeys(): Promise<string[]> {
  const customCategories = await db.serviceCategory.findMany({ select: { key: true } })
  return [...BUILT_IN_CATEGORY_KEYS, ...customCategories.map(c => c.key)]
}

function formatRule(rule: Record<string, unknown>) {
  return {
    ...rule,
    requiredActions: rule.requiredActions ? JSON.parse(rule.requiredActions as string) : [],
    tags: rule.tags ? JSON.parse(rule.tags as string) : [],
    escalationRules: rule.escalationRules ? JSON.parse(rule.escalationRules as string) : {},
    relatedServices: rule.relatedServices ? JSON.parse(rule.relatedServices as string) : [],
    fields: (rule.fields as Record<string, unknown>[]).map(field => ({
      ...field,
      forActions: field.forActions ? JSON.parse(field.forActions as string) : [],
      optionsEn: field.optionsEn ? JSON.parse(field.optionsEn as string) : [],
      optionsAr: field.optionsAr ? JSON.parse(field.optionsAr as string) : [],
    })),
  }
}

// GET /service-rules
app.get('/service-rules', async (c) => {
  try {
    const category = c.req.query('category')
    const active = c.req.query('active')

    const where: any = {}
    if (category) where.category = category
    if (active !== undefined && active !== '') where.isActive = active === 'true'

    const rules = await db.serviceRule.findMany({
      where,
      include: { fields: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } } },
      orderBy: { sortOrder: 'asc' },
    })

    const formatted = rules.map(r => formatRule(r as unknown as Record<string, unknown>))
    return c.json(formatted)
  } catch (error) {
    console.error('ServiceRules GET error:', error)
    return c.json({ error: 'Failed to fetch service rules' }, 500)
  }
})

// POST /service-rules
app.post('/service-rules', async (c) => {
  try {
    const body = await c.req.json()
    const {
      nameEn, nameAr, category, descriptionEn, descriptionAr,
      feeAmount, feeCurrency, processingTimeEn, processingTimeAr,
      isActive, sortOrder, agentInstructionsEn, agentInstructionsAr,
      requiredActions, eligibilityEn, eligibilityAr, serviceId,
      priority, tags, requiredDocumentsEn, requiredDocumentsAr,
      serviceUrl, contactPhone, contactEmail,
      autoResponseEn, autoResponseAr, escalationRules,
      slaHours, slaMinutes, businessHoursEn, businessHoursAr, relatedServices,
      version, fields,
    } = body

    // Convert slaMinutes → slaHours if provided
    const effectiveSlaHours = slaHours ?? (slaMinutes ? Math.round(Number(slaMinutes) / 60) : undefined)

    if (!nameEn || !nameAr || !category) {
      return c.json({ error: 'nameEn, nameAr, and category are required' }, 400)
    }

    const validCategoryKeys = await getValidCategoryKeys()
    if (!validCategoryKeys.includes(category)) {
      return c.json({ error: `Invalid category "${category}". Must be one of: ${validCategoryKeys.join(', ')}` }, 400)
    }

    const rule = await db.$transaction(async (tx) => {
      const newRule = await tx.serviceRule.create({
        data: {
          nameEn, nameAr, category,
          descriptionEn: descriptionEn || '', descriptionAr: descriptionAr || '',
          feeAmount: feeAmount || null, feeCurrency: feeCurrency || 'AED',
          processingTimeEn: processingTimeEn || null, processingTimeAr: processingTimeAr || null,
          isActive: isActive !== undefined ? isActive : true,
          sortOrder: sortOrder || 0,
          agentInstructionsEn: agentInstructionsEn || '', agentInstructionsAr: agentInstructionsAr || '',
          requiredActions: JSON.stringify(requiredActions || []),
          eligibilityEn: eligibilityEn || '', eligibilityAr: eligibilityAr || '',
          serviceId: serviceId || null,
          priority: priority || 'medium',
          tags: JSON.stringify(tags || []),
          requiredDocumentsEn: requiredDocumentsEn || '', requiredDocumentsAr: requiredDocumentsAr || '',
          serviceUrl: serviceUrl || '', contactPhone: contactPhone || '', contactEmail: contactEmail || '',
          autoResponseEn: autoResponseEn || '', autoResponseAr: autoResponseAr || '',
          escalationRules: JSON.stringify(escalationRules || {}),
          slaHours: effectiveSlaHours ?? 72,
          businessHoursEn: businessHoursEn || '', businessHoursAr: businessHoursAr || '',
          relatedServices: JSON.stringify(relatedServices || []),
          version: version ?? 1,
        },
      })

      if (fields && Array.isArray(fields) && fields.length > 0) {
        for (let i = 0; i < fields.length; i++) {
          const field = fields[i]
          if (!field.fieldKey || !field.labelEn || !field.labelAr || !field.fieldType) {
            throw new Error(`Field at index ${i} is missing required properties`)
          }
          await tx.serviceRuleField.create({
            data: {
              ruleId: newRule.id,
              fieldKey: field.fieldKey, labelEn: field.labelEn, labelAr: field.labelAr,
              fieldType: field.fieldType,
              required: field.required !== undefined ? field.required : true,
              forActions: JSON.stringify(field.forActions || []),
              placeholderEn: field.placeholderEn || '', placeholderAr: field.placeholderAr || '',
              validationEn: field.validationEn || '', validationAr: field.validationAr || '',
              optionsEn: field.optionsEn ? JSON.stringify(field.optionsEn) : '',
              optionsAr: field.optionsAr ? JSON.stringify(field.optionsAr) : '',
              sortOrder: field.sortOrder !== undefined ? field.sortOrder : i,
              isActive: field.isActive !== undefined ? field.isActive : true,
            },
          })
        }
      }

      return tx.serviceRule.findUnique({
        where: { id: newRule.id },
        include: { fields: { orderBy: { sortOrder: 'asc' } } },
      })
    })

    const formatted = formatRule(rule as unknown as Record<string, unknown>)
    return c.json(formatted, 201)
  } catch (error) {
    console.error('ServiceRules POST error:', error)
    const message = error instanceof Error ? error.message : 'Failed to create service rule'
    return c.json({ error: message }, 500)
  }
})

// ─── Service Rules Test Endpoint ──────────────────────────────────────────────
// MUST be defined BEFORE /:id to avoid "test" being captured as an ID

// GET /service-rules/test - Get rule coverage stats (for rule-analytics-panel)
app.get('/service-rules/test', async (c) => {
  try {
    const [totalRules, activeRules, rulesWithInstructions, rulesWithFields] = await Promise.all([
      db.serviceRule.count(),
      db.serviceRule.count({ where: { isActive: true } }),
      db.serviceRule.count({ where: { agentInstructionsEn: { not: '' } } }),
      db.serviceRule.count({ where: { fields: { some: { isActive: true } } } }),
    ])

    const rulesByCategory = await db.serviceRule.groupBy({
      by: ['category'],
      _count: { category: true },
    })

    // Build rulesPerCategory matching frontend RuleStats interface
    const activeByCategory = await db.serviceRule.groupBy({
      by: ['category'],
      _count: { category: true },
      where: { isActive: true },
    })

    const rulesPerCategory: Record<string, { total: number; active: number }> = {}
    const categories: string[] = []
    for (const item of rulesByCategory) {
      const cat = item.category
      categories.push(cat)
      const activeEntry = activeByCategory.find(a => a.category === cat)
      rulesPerCategory[cat] = {
        total: item._count.category,
        active: activeEntry?._count.category ?? 0,
      }
    }

    return c.json({
      totalRules,
      activeRules,
      inactiveRules: totalRules - activeRules,
      rulesPerCategory,
      rulesWithFields,
      rulesWithoutFields: totalRules - rulesWithFields,
      rulesWithInstructions,
      rulesWithoutInstructions: totalRules - rulesWithInstructions,
      categories,
    })
  } catch (error) {
    console.error('ServiceRules test stats GET error:', error)
    return c.json({
      totalRules: 0,
      activeRules: 0,
      inactiveRules: 0,
      rulesPerCategory: {},
      rulesWithFields: 0,
      rulesWithoutFields: 0,
      rulesWithInstructions: 0,
      rulesWithoutInstructions: 0,
      categories: [],
    })
  }
})

// POST /service-rules/test - Test a message against rules (for rule-test-panel)
app.post('/service-rules/test', async (c) => {
  try {
    const body = await c.req.json()
    const { message, language, category } = body

    if (!message) {
      return c.json({ error: 'message is required' }, 400)
    }

    const sanitizedMessage = message.trim().slice(0, 2000)
    const detectedLang = (language || 'en') as 'en' | 'ar'

    // Find matching rules
    const where: any = { isActive: true }
    if (category && category !== 'all') where.category = category

    const rules = await db.serviceRule.findMany({
      where,
      include: { fields: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } } },
      orderBy: { sortOrder: 'asc' },
    })

    // Simple keyword matching to find relevant rules
    const messageLower = sanitizedMessage.toLowerCase()
    const matchedRules = rules.filter(rule => {
      const keywords = [
        rule.nameEn, rule.nameAr,
        rule.descriptionEn, rule.descriptionAr,
        rule.category,
        ...(rule.tags ? JSON.parse(rule.tags as string) : []),
      ].filter(Boolean).map(String)

      return keywords.some(kw => kw.toLowerCase().split(/[\s_-]+/).some(
        word => word.length > 3 && messageLower.includes(word.toLowerCase())
      ))
    })

    // If no keyword matches, return top rules as suggestions
    const resultRules = matchedRules.length > 0 ? matchedRules.slice(0, 3) : rules.slice(0, 3)

    // Build response matching frontend RuleTestResult interface
    const rulesUsed = resultRules.map(r => ({
      id: r.id,
      nameEn: r.nameEn,
      nameAr: r.nameAr,
      category: r.category,
    }))

    // Generate a response based on matched rules
    const topRule = resultRules[0]
    const response = topRule
      ? (detectedLang === 'ar' && topRule.autoResponseAr
          ? topRule.autoResponseAr
          : topRule.autoResponseEn || `Based on our service rules for ${topRule.category}, I can help you with this inquiry. Let me gather the relevant information.`)
      : 'I understand your inquiry. Let me connect you with the right service team to assist you further.'

    // Detect intent
    const intent = matchedRules.length > 0 ? matchedRules[0].category : 'general'

    // Simulate sentiment analysis
    const sentimentScore = matchedRules.length > 0 ? 0.62 : 0.45
    const emotion = sentimentScore >= 0.6 ? 'neutral' : sentimentScore >= 0.35 ? 'concerned' : 'frustrated'
    const urgency = messageLower.includes('urgent') || messageLower.includes('عاجل') ? 'high'
      : messageLower.includes('soon') || messageLower.includes('قريب') ? 'medium' : 'low'

    return c.json({
      response,
      rulesUsed,
      language: detectedLang,
      intent,
      sentiment: {
        score: sentimentScore,
        emotion,
        urgency,
        recommendedAction: urgency === 'high' ? 'Escalate to senior agent immediately' : 'Continue with standard workflow',
      },
    })
  } catch (error) {
    console.error('ServiceRules test POST error:', error)
    return c.json({ error: 'Failed to test message against rules' }, 500)
  }
})

// ─── Analytics Endpoints (MUST be before /:id) ───────────────────────────────

// GET /service-rules/_analytics - Get rule analytics with optional filters
// Using _ prefix to avoid collision with /:id parameterized route
app.get('/service-rules/_analytics', async (c) => {
  try {
    const category = c.req.query('category')
    const dateFrom = c.req.query('dateFrom')
    const dateTo = c.req.query('dateTo')

    // Build date filter
    const dateFilter: any = {}
    if (dateFrom) dateFilter.gte = new Date(dateFrom)
    if (dateTo) dateFilter.lte = new Date(dateTo)
    const hasDateFilter = dateFrom || dateTo

    // Get base stats
    const [totalRules, activeRules, rulesWithInstructions, rulesWithFields] = await Promise.all([
      db.serviceRule.count(category ? { where: { category } } : undefined),
      db.serviceRule.count({ where: { isActive: true, ...(category ? { category } : {}) } }),
      db.serviceRule.count({ where: { agentInstructionsEn: { not: '' }, ...(category ? { category } : {}) } }),
      db.serviceRule.count({ where: { fields: { some: { isActive: true } }, ...(category ? { category } : {}) } }),
    ])

    // Category distribution
    const rulesByCategory = await db.serviceRule.groupBy({
      by: ['category'],
      _count: { category: true },
      ...(category ? { where: { category } } : {}),
    })
    const activeByCategory = await db.serviceRule.groupBy({
      by: ['category'],
      _count: { category: true },
      where: { isActive: true, ...(category ? { category } : {}) },
    })
    const rulesPerCategory: Record<string, { total: number; active: number }> = {}
    const categories: string[] = []
    for (const item of rulesByCategory) {
      const cat = item.category
      categories.push(cat)
      const activeEntry = activeByCategory.find(a => a.category === cat)
      rulesPerCategory[cat] = {
        total: item._count.category,
        active: activeEntry?._count.category ?? 0,
      }
    }

    // Rule hit counts from RuleHitLog
    const hitLogWhere: any = {}
    if (category) {
      hitLogWhere.rule = { category }
    }
    if (hasDateFilter) {
      hitLogWhere.createdAt = dateFilter
    }

    const totalHits = await db.ruleHitLog.count({ where: hitLogWhere })

    // Per-rule hit counts
    const hitCounts = await db.ruleHitLog.groupBy({
      by: ['ruleId'],
      _count: { ruleId: true },
      where: hitLogWhere,
      orderBy: { _count: { ruleId: 'desc' } },
    })

    // Channel distribution
    const channelDistribution = await db.ruleHitLog.groupBy({
      by: ['channel'],
      _count: { channel: true },
      where: hitLogWhere,
    })

    // Effectiveness: % of hits that were helpful
    const helpfulCount = await db.ruleHitLog.count({
      where: { ...hitLogWhere, wasHelpful: true },
    })
    const notHelpfulCount = await db.ruleHitLog.count({
      where: { ...hitLogWhere, wasHelpful: false },
    })

    // Average response time
    const responseTimeAgg = await db.ruleHitLog.aggregate({
      _avg: { responseTimeMs: true },
      _min: { responseTimeMs: true },
      _max: { responseTimeMs: true },
      where: { ...hitLogWhere, responseTimeMs: { not: null } },
    })

    // Time-based trends: hits per day for the last 30 days (or date range)
    const trendDays: Array<{ date: string; hits: number }> = []
    const trendFrom = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const trendTo = dateTo ? new Date(dateTo) : new Date()
    const dayMs = 24 * 60 * 60 * 1000
    for (let d = new Date(trendFrom); d <= trendTo; d = new Date(d.getTime() + dayMs)) {
      const dayStart = new Date(d)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(d)
      dayEnd.setHours(23, 59, 59, 999)
      const count = await db.ruleHitLog.count({
        where: {
          ...hitLogWhere,
          createdAt: { gte: dayStart, lte: dayEnd },
        },
      })
      trendDays.push({ date: dayStart.toISOString().split('T')[0], hits: count })
    }

    // Intent distribution
    const intentDistribution = await db.ruleHitLog.groupBy({
      by: ['intent'],
      _count: { intent: true },
      where: { ...hitLogWhere, intent: { not: null } },
    })

    return c.json({
      totalRules,
      activeRules,
      inactiveRules: totalRules - activeRules,
      rulesPerCategory,
      rulesWithFields,
      rulesWithoutFields: totalRules - rulesWithFields,
      rulesWithInstructions,
      rulesWithoutInstructions: totalRules - rulesWithInstructions,
      categories,
      // Analytics data
      analytics: {
        totalHits,
        hitCounts: hitCounts.map(h => ({ ruleId: h.ruleId, hits: h._count.ruleId })),
        channelDistribution: channelDistribution.map(ch => ({ channel: ch.channel, count: ch._count.channel })),
        effectiveness: {
          helpful: helpfulCount,
          notHelpful: notHelpfulCount,
          rate: (helpfulCount + notHelpfulCount) > 0
            ? Math.round((helpfulCount / (helpfulCount + notHelpfulCount)) * 100)
            : null,
        },
        responseTime: {
          avgMs: responseTimeAgg._avg.responseTimeMs ? Math.round(responseTimeAgg._avg.responseTimeMs) : null,
          minMs: responseTimeAgg._min.responseTimeMs,
          maxMs: responseTimeAgg._max.responseTimeMs,
        },
        trends: trendDays,
        intentDistribution: intentDistribution.map(i => ({ intent: i.intent, count: i._count.intent })),
      },
    })
  } catch (error) {
    console.error('ServiceRules analytics GET error:', error)
    return c.json({
      totalRules: 0,
      activeRules: 0,
      inactiveRules: 0,
      rulesPerCategory: {},
      rulesWithFields: 0,
      rulesWithoutFields: 0,
      rulesWithInstructions: 0,
      rulesWithoutInstructions: 0,
      categories: [],
      analytics: {
        totalHits: 0,
        hitCounts: [],
        channelDistribution: [],
        effectiveness: { helpful: 0, notHelpful: 0, rate: null },
        responseTime: { avgMs: null, minMs: null, maxMs: null },
        trends: [],
        intentDistribution: [],
      },
    })
  }
})

// POST /service-rules/_analytics/log - Log a rule hit
app.post('/service-rules/_analytics/log', async (c) => {
  try {
    const body = await c.req.json()
    const { ruleId, channel, intent, wasHelpful, responseTimeMs, metadata } = body

    if (!ruleId) {
      return c.json({ error: 'ruleId is required' }, 400)
    }

    const log = await db.ruleHitLog.create({
      data: {
        ruleId,
        channel: channel || 'web',
        intent: intent || null,
        wasHelpful: wasHelpful !== undefined ? wasHelpful : null,
        responseTimeMs: responseTimeMs || null,
        metadata: metadata ? JSON.stringify(metadata) : '',
      },
    })

    return c.json(log, 201)
  } catch (error) {
    console.error('RuleHitLog POST error:', error)
    return c.json({ error: 'Failed to log rule hit' }, 500)
  }
})

// DELETE /service-rules/_analytics - Reset analytics data
app.delete('/service-rules/_analytics', async (c) => {
  try {
    const ruleId = c.req.query('ruleId')
    const category = c.req.query('category')

    const where: any = {}
    if (ruleId) {
      where.ruleId = ruleId
    } else if (category) {
      where.rule = { category }
    }

    const result = await db.ruleHitLog.deleteMany({ where })
    return c.json({
      message: `Deleted ${result.count} analytics records`,
      deletedCount: result.count,
    })
  } catch (error) {
    console.error('Analytics DELETE error:', error)
    return c.json({ error: 'Failed to delete analytics data' }, 500)
  }
})

// ─── Parameterized Routes (MUST be after /test and /analytics) ───────────────

// GET /service-rules/:id
app.get('/service-rules/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const rule = await db.serviceRule.findUnique({
      where: { id },
      include: { fields: { orderBy: { sortOrder: 'asc' } } },
    })

    if (!rule) return c.json({ error: 'Service rule not found' }, 404)
    return c.json(formatRule(rule as unknown as Record<string, unknown>))
  } catch (error) {
    console.error('ServiceRule GET error:', error)
    return c.json({ error: 'Failed to fetch service rule' }, 500)
  }
})

// PUT /service-rules/:id
app.put('/service-rules/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const body = await c.req.json()

    const existing = await db.serviceRule.findUnique({ where: { id } })
    if (!existing) return c.json({ error: 'Service rule not found' }, 404)

    if (body.category !== undefined) {
      const validCategoryKeys = await getValidCategoryKeys()
      if (!validCategoryKeys.includes(body.category)) {
        return c.json({ error: `Invalid category "${body.category}"` }, 400)
      }
    }

    const updatedRule = await db.$transaction(async (tx) => {
      const updateData: Record<string, unknown> = {}
      const simpleFields = [
        'nameEn', 'nameAr', 'category', 'descriptionEn', 'descriptionAr',
        'feeAmount', 'feeCurrency', 'processingTimeEn', 'processingTimeAr',
        'isActive', 'sortOrder', 'agentInstructionsEn', 'agentInstructionsAr',
        'eligibilityEn', 'eligibilityAr', 'serviceId',
        'priority', 'requiredDocumentsEn', 'requiredDocumentsAr',
        'serviceUrl', 'contactPhone', 'contactEmail',
        'autoResponseEn', 'autoResponseAr', 'slaHours',
        'businessHoursEn', 'businessHoursAr', 'version',
      ]
      for (const field of simpleFields) {
        if (body[field] !== undefined) updateData[field] = body[field]
      }
      // JSON fields
      if (body.requiredActions !== undefined) updateData.requiredActions = JSON.stringify(body.requiredActions)
      if (body.tags !== undefined) updateData.tags = JSON.stringify(body.tags)
      if (body.escalationRules !== undefined) updateData.escalationRules = JSON.stringify(body.escalationRules)
      if (body.relatedServices !== undefined) updateData.relatedServices = JSON.stringify(body.relatedServices)

      await tx.serviceRule.update({ where: { id }, data: updateData })

      if (body.fields !== undefined && Array.isArray(body.fields)) {
        await tx.serviceRuleField.deleteMany({ where: { ruleId: id } })
        for (let i = 0; i < body.fields.length; i++) {
          const field = body.fields[i]
          await tx.serviceRuleField.create({
            data: {
              ruleId: id,
              fieldKey: field.fieldKey || '', labelEn: field.labelEn || '', labelAr: field.labelAr || '',
              fieldType: field.fieldType || 'text',
              required: field.required !== undefined ? field.required : true,
              forActions: JSON.stringify(field.forActions || []),
              placeholderEn: field.placeholderEn || '', placeholderAr: field.placeholderAr || '',
              validationEn: field.validationEn || '', validationAr: field.validationAr || '',
              optionsEn: field.optionsEn ? JSON.stringify(field.optionsEn) : '',
              optionsAr: field.optionsAr ? JSON.stringify(field.optionsAr) : '',
              sortOrder: field.sortOrder !== undefined ? field.sortOrder : i,
              isActive: field.isActive !== undefined ? field.isActive : true,
            },
          })
        }
      }

      return tx.serviceRule.findUnique({
        where: { id },
        include: { fields: { orderBy: { sortOrder: 'asc' } } },
      })
    })

    return c.json(formatRule(updatedRule as unknown as Record<string, unknown>))
  } catch (error) {
    console.error('ServiceRule PUT error:', error)
    const message = error instanceof Error ? error.message : 'Failed to update service rule'
    return c.json({ error: message }, 500)
  }
})

// DELETE /service-rules/:id
app.delete('/service-rules/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const existing = await db.serviceRule.findUnique({ where: { id } })
    if (!existing) return c.json({ error: 'Service rule not found' }, 404)

    await db.serviceRule.delete({ where: { id } })
    return c.json({ message: 'Service rule and all associated fields deleted successfully', deletedId: id })
  } catch (error) {
    console.error('ServiceRule DELETE error:', error)
    return c.json({ error: 'Failed to delete service rule' }, 500)
  }
})

export const serviceRulesRoutes = app
