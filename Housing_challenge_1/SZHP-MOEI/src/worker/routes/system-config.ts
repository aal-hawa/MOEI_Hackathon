/**
 * System Config Routes
 * GET /api/system-config, PATCH /api/system-config, POST /api/system-config/seed
 */

import { Hono } from 'hono'
import type { Env } from '../types'
import { DbClient } from '../db/queries'
import { requireAdminAuthMiddleware, requirePermission } from '../middleware/auth'
import { generateId } from '../lib/utils'
import { invalidateConfigCache } from '../lib/config'

const PUBLIC_CATEGORIES = ['landing_metrics', 'public']

const systemConfig = new Hono<{ Bindings: Env; Variables: { auth: any; db: DbClient } }>()

// GET /api/system-config
systemConfig.get('/', async (c) => {
  const db = new DbClient(c.env.DB)
  try {
    const category = c.req.query('category')
    const isPublicRequest = c.req.query('public') === 'true'

    if (isPublicRequest) {
      const placeholders = PUBLIC_CATEGORIES.map(() => '?').join(',')
      const result = await db.query(`SELECT * FROM SystemConfig WHERE isActive = 1 AND (isPublic = 1 OR category IN (${placeholders})) ORDER BY category ASC, labelEN ASC`, ...PUBLIC_CATEGORIES)
      const configs = result.results || []
      const grouped: Record<string, any[]> = {}
      for (const config of configs) { if (!grouped[(config as any).category]) grouped[(config as any).category] = []; grouped[(config as any).category].push(config) }
      return c.json({ configs, grouped })
    }

    if (category && PUBLIC_CATEGORIES.includes(category)) {
      const result = await db.query("SELECT * FROM SystemConfig WHERE category = ? AND isActive = 1 AND (isPublic = 1 OR category IN (" + PUBLIC_CATEGORIES.map(() => '?').join(',') + ")) ORDER BY category ASC, labelEN ASC", category, ...PUBLIC_CATEGORIES)
      const configs = result.results || []
      const grouped: Record<string, any[]> = {}
      for (const config of configs) { if (!grouped[(config as any).category]) grouped[(config as any).category] = []; grouped[(config as any).category].push(config) }
      return c.json({ configs, grouped })
    }

    // Requires admin auth
    const token = c.req.header('Authorization')?.replace('Bearer ', '')
    if (!token) return c.json({ error: 'Authentication required' }, 401)
    const authResult = await (await import('../middleware/auth')).verifyAuth(db, token)
    if (!authResult.authenticated) return c.json({ error: authResult.error }, 401)
    const adminRoles = ['employee', 'reviewer', 'manager', 'admin', 'superadmin']
    if (!adminRoles.includes(authResult.user!.role)) return c.json({ error: 'Admin access required' }, 403)

    const whereClause = category ? 'WHERE category = ? AND isActive = 1' : 'WHERE isActive = 1'
    const params = category ? [category] : []
    const result = await db.query(`SELECT * FROM SystemConfig ${whereClause} ORDER BY category ASC, labelEN ASC`, ...params)
    const configs = result.results || []
    const grouped: Record<string, any[]> = {}
    for (const config of configs) { if (!grouped[(config as any).category]) grouped[(config as any).category] = []; grouped[(config as any).category].push(config) }

    return c.json({ configs, grouped })
  } catch (error) {
    console.error('Failed to fetch system configs:', error)
    return c.json({ error: 'Failed to fetch system configs' }, 500)
  }
})

// PATCH /api/system-config
systemConfig.patch('/', requirePermission('settings'), async (c) => {
  const db = c.get('db')
  const auth = c.get('auth')
  try {
    const body = await c.req.json()
    const { updates } = body as { updates: Array<{ configKey: string; configValue: string }> }
    if (!updates || !Array.isArray(updates)) return c.json({ error: 'updates array required' }, 400)

    const results = []
    for (const update of updates) {
      const config: any = await db.findConfigByKey(update.configKey)
      if (!config) {
        if (update.configKey === 'default_llm_id' || update.configKey === 'default_vlm_id') {
          await db.createConfig({
            id: generateId(), configKey: update.configKey, configValue: update.configValue, defaultValue: '',
            valueType: 'string', category: 'ai_models',
            labelEN: update.configKey === 'default_llm_id' ? 'Default LLM Model' : 'Default VLM Model',
            labelAR: update.configKey === 'default_llm_id' ? 'نموذج LLM الافتراضي' : 'نموذج VLM الافتراضي',
            isPublic: 0, isActive: 1,
          })
          results.push({ configKey: update.configKey, status: 'updated' })
          continue
        }
        results.push({ configKey: update.configKey, status: 'not_found' })
        continue
      }

      if (config.valueType === 'number') {
        const numValue = parseFloat(update.configValue)
        if (isNaN(numValue)) { results.push({ configKey: update.configKey, status: 'invalid_number' }); continue }
        if (config.min !== null && numValue < config.min) { results.push({ configKey: update.configKey, status: 'below_min' }); continue }
        if (config.max !== null && numValue > config.max) { results.push({ configKey: update.configKey, status: 'above_max' }); continue }
      }
      if (config.valueType === 'boolean' && !['true', 'false'].includes(update.configValue)) { results.push({ configKey: update.configKey, status: 'invalid_boolean' }); continue }

      await db.updateConfigByKey(update.configKey, update.configValue)
      results.push({ configKey: update.configKey, status: 'updated' })
    }

    await invalidateConfigCache(c.env.KV)

    await db.createAuditLog({
      id: generateId(), action: 'settings_changed', performedBy: `employee:${auth.user.email || auth.user.id}`,
      details: JSON.stringify({ message: 'System configuration updated', updatedKeys: updates.map(u => u.configKey) }),
      category: 'settings', performedByUserId: auth.user.id,
      ipAddress: c.req.header('x-forwarded-for') || null, userAgent: c.req.header('user-agent') || null,
    })

    return c.json({ results })
  } catch (error) {
    console.error('Failed to update system configs:', error)
    return c.json({ error: 'Failed to update system configs' }, 500)
  }
})

// POST /api/system-config/seed
systemConfig.post('/seed', requireAdminAuthMiddleware, async (c) => {
  const db = c.get('db')
  try {
    const defaultConfigs = [
      { configKey: 'max_dbr_limit', configValue: '0.20', defaultValue: '0.20', labelEN: 'Maximum DBR Limit', labelAR: 'الحد الأقصى لنسبة عبء الدين', category: 'dbr_limits', valueType: 'number', min: 0.1, max: 1.0, unit: '%', isPublic: 0 },
      { configKey: 'max_grant_amount', configValue: '800000', defaultValue: '800000', labelEN: 'Maximum Grant Amount', labelAR: 'الحد الأقصى لمبلغ المنحة', category: 'loan_limits', valueType: 'number', min: 0, max: 2000000, unit: 'AED', isPublic: 0 },
      { configKey: 'risk_threshold_high', configValue: '70', defaultValue: '70', labelEN: 'High Risk Threshold', labelAR: 'عتبة المخاطر المرتفعة', category: 'risk_thresholds', valueType: 'number', min: 0, max: 100, unit: 'points', isPublic: 0 },
      { configKey: 'citizenship_required', configValue: 'true', defaultValue: 'true', labelEN: 'Citizenship Required', labelAR: 'مطلوب مواطنة', category: 'eligibility', valueType: 'boolean', isPublic: 0 },
      { configKey: 'income_per_member_threshold', configValue: '2500', defaultValue: '2500', labelEN: 'Income Per Member Threshold', labelAR: 'عتبة الدخل لكل فرد', category: 'moei', valueType: 'number', min: 500, max: 10000, unit: 'AED', isPublic: 1 },
    ]

    let seeded = 0
    for (const cfg of defaultConfigs) {
      const existing: any = await db.findConfigByKey(cfg.configKey)
      if (!existing) {
        await db.createConfig({ id: generateId(), ...cfg, descriptionEN: null, descriptionAR: null, isActive: 1 })
        seeded++
      }
    }

    await invalidateConfigCache(c.env.KV)
    return c.json({ success: true, message: `Seeded ${seeded} configs`, seeded })
  } catch (error) {
    console.error('Seed config error:', error)
    return c.json({ error: 'Failed to seed configs' }, 500)
  }
})

export default systemConfig
