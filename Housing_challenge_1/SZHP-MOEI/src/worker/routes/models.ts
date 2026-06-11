/**
 * AI Model Config Routes
 * GET /api/models, POST /api/models, PATCH /api/models/:id, DELETE /api/models/:id, POST /api/models/seed
 */

import { Hono } from 'hono'
import type { Env } from '../types'
import { DbClient } from '../db/queries'
import { requireAdminAuthMiddleware, requirePermission } from '../middleware/auth'
import { generateId, maskApiKey } from '../lib/utils'
import { isUrlSafeForServerSideRequest, testConnection } from '../lib/ai-client'

const models = new Hono<{ Bindings: Env; Variables: { auth: any; db: DbClient } }>()

// GET /api/models
models.get('/', requireAdminAuthMiddleware, async (c) => {
  const db = c.get('db')
  try {
    const result = await db.findActiveModels()
    const safeModels = (result.results || []).map((model: any) => ({
      ...model, apiKey: maskApiKey(model.apiKey), hasApiKey: !!model.apiKey,
      isActive: !!model.isActive, isDefault: !!model.isDefault,
    }))
    return c.json(safeModels)
  } catch (error) {
    console.error('Failed to fetch models:', error)
    return c.json({ error: 'Failed to fetch models' }, 500)
  }
})

// POST /api/models
models.post('/', requirePermission('models'), async (c) => {
  const db = c.get('db')
  const auth = c.get('auth')
  try {
    const body = await c.req.json()
    const { name, provider, modelId, baseUrl, apiKey, isActive, isDefault, capabilities, maxTokens, temperature, descriptionEN, descriptionAR } = body
    if (!name || !provider || !modelId || !baseUrl) return c.json({ error: 'Missing required fields' }, 400)

    if (!isUrlSafeForServerSideRequest(baseUrl)) return c.json({ error: 'URL not allowed. Internal addresses blocked.' }, 400)

    if (isDefault) await db.unsetDefaultModels()

    const id = generateId()
    await db.createModel({
      id, name, provider, modelId, baseUrl, apiKey: apiKey || null,
      isActive: isActive !== false ? 1 : 0, isDefault: isDefault || false ? 1 : 0,
      capabilities: JSON.stringify(capabilities || []), maxTokens: maxTokens || 4096,
      temperature: temperature ?? 0.7, descriptionEN: descriptionEN || null, descriptionAR: descriptionAR || null,
    })

    await db.createAuditLog({
      id: generateId(), action: 'model_created', performedBy: `employee:${auth.user.email || auth.user.id}`,
      details: JSON.stringify({ modelId, provider, name }), category: 'settings', performedByUserId: auth.user.id,
    })

    return c.json({ id, name, provider, modelId, baseUrl, apiKey: maskApiKey(apiKey), hasApiKey: !!apiKey, isActive: isActive !== false, isDefault: !!isDefault, capabilities: capabilities || [], maxTokens: maxTokens || 4096, temperature: temperature ?? 0.7 }, 201)
  } catch (error) {
    console.error('Failed to create model:', error)
    return c.json({ error: 'Failed to create model' }, 500)
  }
})

// PATCH /api/models/:id
models.patch('/:id', requirePermission('models'), async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')
  try {
    const body = await c.req.json()
    const existing: any = await db.findModelById(id)
    if (!existing) return c.json({ error: 'Model not found' }, 404)

    const updateData: Record<string, unknown> = {}
    if (body.name !== undefined) updateData.name = body.name
    if (body.provider !== undefined) updateData.provider = body.provider
    if (body.modelId !== undefined) updateData.modelId = body.modelId
    if (body.baseUrl !== undefined) { if (!isUrlSafeForServerSideRequest(body.baseUrl)) return c.json({ error: 'URL not allowed' }, 400); updateData.baseUrl = body.baseUrl }
    if (body.apiKey !== undefined) updateData.apiKey = body.apiKey
    if (body.isActive !== undefined) updateData.isActive = body.isActive ? 1 : 0
    if (body.isDefault !== undefined) {
      if (body.isDefault) await db.unsetDefaultModels()
      updateData.isDefault = body.isDefault ? 1 : 0
    }
    if (body.capabilities !== undefined) updateData.capabilities = JSON.stringify(body.capabilities)
    if (body.maxTokens !== undefined) updateData.maxTokens = body.maxTokens
    if (body.temperature !== undefined) updateData.temperature = body.temperature
    if (body.descriptionEN !== undefined) updateData.descriptionEN = body.descriptionEN
    if (body.descriptionAR !== undefined) updateData.descriptionAR = body.descriptionAR
    if (body.lastTestResult !== undefined) { updateData.lastTestResult = body.lastTestResult; updateData.lastTestedAt = new Date().toISOString() }

    if (Object.keys(updateData).length > 0) await db.updateModel(id, updateData)
    const updated: any = await db.findModelById(id)
    return c.json({ ...updated, apiKey: maskApiKey(updated.apiKey), hasApiKey: !!updated.apiKey, isActive: !!updated.isActive, isDefault: !!updated.isDefault })
  } catch (error) {
    console.error('Failed to update model:', error)
    return c.json({ error: 'Failed to update model' }, 500)
  }
})

// DELETE /api/models/:id
models.delete('/:id', requirePermission('models'), async (c) => {
  const db = c.get('db')
  try {
    const existing: any = await db.findModelById(c.req.param('id'))
    if (!existing) return c.json({ error: 'Model not found' }, 404)
    await db.deleteModel(c.req.param('id'))
    return c.json({ success: true })
  } catch (error) {
    return c.json({ error: 'Failed to delete model' }, 500)
  }
})

// POST /api/models/seed
models.post('/seed', requireAdminAuthMiddleware, async (c) => {
  const db = c.get('db')
  try {
    const defaultModels = [
      { name: 'Recentech AI — GLM-4-Flash', provider: 'recentech', modelId: 'glm-4-flash', baseUrl: c.env.RECENTECH_BASE_URL || 'https://recentech-ai-worker.42abudhabi424242.workers.dev/v1', apiKey: c.env.RECENTECH_API_KEY || '', isActive: 1, isDefault: 1, capabilities: ['chat', 'vision'], maxTokens: 4096, temperature: 0.7, descriptionEN: 'Default fast model', descriptionAR: 'النموذج السريع الافتراضي' },
      { name: 'Recentech AI — GLM-4-Plus', provider: 'recentech', modelId: 'glm-4-plus', baseUrl: c.env.RECENTECH_BASE_URL || 'https://recentech-ai-worker.42abudhabi424242.workers.dev/v1', apiKey: c.env.RECENTECH_API_KEY || '', isActive: 1, isDefault: 0, capabilities: ['chat', 'vision'], maxTokens: 4096, temperature: 0.7, descriptionEN: 'Balanced model', descriptionAR: 'نموذج متوازن' },
    ]

    let seeded = 0
    for (const model of defaultModels) {
      const id = generateId()
      await db.createModel({ id, ...model, capabilities: JSON.stringify(model.capabilities) })
      seeded++
    }

    return c.json({ success: true, message: `Seeded ${seeded} models`, seeded })
  } catch (error) {
    console.error('Seed models error:', error)
    return c.json({ error: 'Failed to seed models' }, 500)
  }
})

export default models
