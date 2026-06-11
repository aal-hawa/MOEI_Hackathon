/**
 * Service Categories Routes
 * GET /api/service-categories
 * POST /api/service-categories
 * PUT /api/service-categories/:key
 * DELETE /api/service-categories/:key
 */

import { Hono } from 'hono'
import { db } from '../lib/db'

const app = new Hono()

const BUILT_IN_CATEGORIES = [
  { key: 'electricity_water', labelEn: 'Electricity & Water', labelAr: 'الكهرباء والمياه', icon: 'Zap', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', border: 'border-amber-300 dark:border-amber-700', sortOrder: 0, isActive: true, isCustom: false },
  { key: 'housing', labelEn: 'Housing', labelAr: 'الإسكان', icon: 'Home', color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400', border: 'border-sky-300 dark:border-sky-700', sortOrder: 1, isActive: true, isCustom: false },
  { key: 'petroleum', labelEn: 'Petroleum', labelAr: 'البترول', icon: 'Fuel', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', border: 'border-red-300 dark:border-red-700', sortOrder: 2, isActive: true, isCustom: false },
  { key: 'transport', labelEn: 'Transport', labelAr: 'النقل', icon: 'Truck', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', border: 'border-emerald-300 dark:border-emerald-700', sortOrder: 3, isActive: true, isCustom: false },
  { key: 'sustainability', labelEn: 'Sustainability', labelAr: 'الاستدامة', icon: 'Leaf', color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400', border: 'border-teal-300 dark:border-teal-700', sortOrder: 4, isActive: true, isCustom: false },
  { key: 'general', labelEn: 'General', labelAr: 'عام', icon: 'Settings', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800/30 dark:text-gray-400', border: 'border-gray-300 dark:border-gray-700', sortOrder: 5, isActive: true, isCustom: false },
]

const BUILT_IN_KEYS = BUILT_IN_CATEGORIES.map(c => c.key)

// GET /service-categories
app.get('/service-categories', async (c) => {
  try {
    const customCategories = await db.serviceCategory.findMany({
      where: { isCustom: true },
      orderBy: { sortOrder: 'asc' },
    })

    const customFormatted = customCategories.map(cat => ({
      id: cat.id, key: cat.key, labelEn: cat.labelEn, labelAr: cat.labelAr,
      icon: cat.icon, color: cat.color, border: cat.border,
      sortOrder: cat.sortOrder, isActive: cat.isActive, isCustom: true,
      createdAt: cat.createdAt, updatedAt: cat.updatedAt,
    }))

    return c.json([...BUILT_IN_CATEGORIES, ...customFormatted])
  } catch (error) {
    console.error('ServiceCategories GET error:', error)
    return c.json({ error: 'Failed to fetch service categories' }, 500)
  }
})

// POST /service-categories
app.post('/service-categories', async (c) => {
  try {
    const body = await c.req.json()
    const { key, labelEn, labelAr, icon, color, border, sortOrder, isActive } = body

    if (!key || !labelEn || !labelAr) {
      return c.json({ error: 'key, labelEn, and labelAr are required' }, 400)
    }

    if (!/^[a-z][a-z0-9_]*$/.test(key)) {
      return c.json({ error: 'Key must start with a lowercase letter and contain only lowercase letters, numbers, and underscores' }, 400)
    }

    if (BUILT_IN_KEYS.includes(key)) {
      return c.json({ error: `Key "${key}" conflicts with a built-in category` }, 409)
    }

    const existing = await db.serviceCategory.findUnique({ where: { key } })
    if (existing) {
      return c.json({ error: `A custom category with key "${key}" already exists` }, 409)
    }

    const category = await db.serviceCategory.create({
      data: {
        key, labelEn, labelAr,
        icon: icon || 'Settings',
        color: color || 'bg-gray-100 text-gray-700 dark:bg-gray-800/30 dark:text-gray-400',
        border: border || 'border-gray-300 dark:border-gray-700',
        sortOrder: sortOrder ?? 0,
        isActive: isActive !== undefined ? isActive : true,
        isCustom: true,
      },
    })

    return c.json({ ...category, isCustom: true }, 201)
  } catch (error) {
    console.error('ServiceCategories POST error:', error)
    const message = error instanceof Error ? error.message : 'Failed to create service category'
    return c.json({ error: message }, 500)
  }
})

// PUT /service-categories/:key
app.put('/service-categories/:key', async (c) => {
  try {
    const key = c.req.param('key')
    const body = await c.req.json()

    if (BUILT_IN_KEYS.includes(key)) {
      return c.json({ error: `Cannot modify built-in category "${key}"` }, 403)
    }

    const existing = await db.serviceCategory.findUnique({ where: { key } })
    if (!existing) return c.json({ error: `Custom category "${key}" not found` }, 404)

    if (body.key && body.key !== key) {
      if (!/^[a-z][a-z0-9_]*$/.test(body.key)) {
        return c.json({ error: 'Invalid key format' }, 400)
      }
      if (BUILT_IN_KEYS.includes(body.key)) {
        return c.json({ error: `Key "${body.key}" conflicts with a built-in category` }, 409)
      }
      const keyExists = await db.serviceCategory.findUnique({ where: { key: body.key } })
      if (keyExists) return c.json({ error: `Category with key "${body.key}" already exists` }, 409)
    }

    const updateData: Record<string, unknown> = {}
    const allowedFields = ['labelEn', 'labelAr', 'icon', 'color', 'border', 'sortOrder', 'isActive']
    for (const field of allowedFields) {
      if (body[field] !== undefined) updateData[field] = body[field]
    }
    if (body.key && body.key !== key) updateData.key = body.key

    const updated = await db.serviceCategory.update({ where: { key }, data: updateData })

    if (body.key && body.key !== key) {
      await db.serviceRule.updateMany({ where: { category: key }, data: { category: body.key } })
    }

    return c.json({ ...updated, isCustom: true })
  } catch (error) {
    console.error('ServiceCategory PUT error:', error)
    const message = error instanceof Error ? error.message : 'Failed to update service category'
    return c.json({ error: message }, 500)
  }
})

// DELETE /service-categories/:key
app.delete('/service-categories/:key', async (c) => {
  try {
    const key = c.req.param('key')

    if (BUILT_IN_KEYS.includes(key)) {
      return c.json({ error: `Cannot delete built-in category "${key}"` }, 403)
    }

    const existing = await db.serviceCategory.findUnique({ where: { key } })
    if (!existing) return c.json({ error: `Custom category "${key}" not found` }, 404)

    const rulesUsingCategory = await db.serviceRule.count({ where: { category: key } })
    if (rulesUsingCategory > 0) {
      return c.json({
        error: `Cannot delete category "${key}" because ${rulesUsingCategory} service rule(s) are using it`,
        rulesCount: rulesUsingCategory,
      }, 409)
    }

    await db.serviceCategory.delete({ where: { key } })
    return c.json({ message: `Custom category "${key}" deleted successfully`, deletedKey: key })
  } catch (error) {
    console.error('ServiceCategory DELETE error:', error)
    const message = error instanceof Error ? error.message : 'Failed to delete service category'
    return c.json({ error: message }, 500)
  }
})

export const serviceCategoriesRoutes = app
