/**
 * Seed Route
 * POST /api/seed - Seed the database with sample data
 * NO fake customer data — only creates agent accounts for the system to work
 */

import { Hono } from 'hono'
import { db } from '../lib/db'

const app = new Hono()

app.post('/seed', async (c) => {
  try {
    // Create agent accounts only (no fake customers)
    const agents = await Promise.all([
      db.agent.upsert({ where: { email: 'ahmed@moei.ae' }, update: {}, create: { name: 'Ahmed Al-Rashid', email: 'ahmed@moei.ae', status: 'available', skills: JSON.stringify(['electricity_water', 'housing']), activeCases: 0 } }),
      db.agent.upsert({ where: { email: 'fatima@moei.ae' }, update: {}, create: { name: 'Fatima Al-Mansoori', email: 'fatima@moei.ae', status: 'available', skills: JSON.stringify(['petroleum', 'sustainability']), activeCases: 0 } }),
      db.agent.upsert({ where: { email: 'omar@moei.ae' }, update: {}, create: { name: 'Omar Al-Ketbi', email: 'omar@moei.ae', status: 'available', skills: JSON.stringify(['transport', 'general']), activeCases: 0 } }),
    ])

    return c.json({ message: 'Database seeded successfully (agents only, no fake customer data)', agents: agents.length })
  } catch (error) {
    console.error('Seed error:', error)
    return c.json({ error: 'Failed to seed database' }, 500)
  }
})

export const seedRoutes = app
