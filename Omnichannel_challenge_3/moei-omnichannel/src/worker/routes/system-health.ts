/**
 * System Health Routes
 * GET /api/system-health
 */

import { Hono } from 'hono'
import { db } from '../lib/db'

const app = new Hono()

const DEFAULT_HEALTH = [
  { nameKey: 'housingServices', icon: 'Home', status: 'operational', uptime: 99.9, lastIncidentHours: 48, color: 'text-[#92722A]' },
  { nameKey: 'infrastructureServices', icon: 'Globe', status: 'operational', uptime: 99.95, lastIncidentHours: 72, color: 'text-sky-600' },
  { nameKey: 'landTransport', icon: 'Zap', status: 'operational', uptime: 99.98, lastIncidentHours: null, color: 'text-amber-600' },
  { nameKey: 'maritimeTransport', icon: 'Droplets', status: 'operational', uptime: 99.92, lastIncidentHours: 24, color: 'text-blue-600' },
  { nameKey: 'geologicalServices', icon: 'MessageSquare', status: 'operational', uptime: 99.97, lastIncidentHours: 120, color: 'text-stone-600' },
  { nameKey: 'inquiryServices', icon: 'Phone', status: 'operational', uptime: 99.99, lastIncidentHours: null, color: 'text-emerald-600' },
  { nameKey: 'petroleumServices', icon: 'Activity', status: 'operational', uptime: 99.94, lastIncidentHours: 96, color: 'text-orange-600' },
]

app.get('/', async (c) => {
  try {
    let health = await db.systemHealth.findMany()
    if (health.length === 0) {
      // Seed default
      for (const h of DEFAULT_HEALTH) {
        await db.systemHealth.create({ data: h })
      }
      health = await db.systemHealth.findMany()
    }
    return c.json(health)
  } catch (error) {
    console.error('SystemHealth GET error:', error)
    return c.json({ error: 'Failed to fetch system health' }, 500)
  }
})

export const systemHealthRoutes = app
