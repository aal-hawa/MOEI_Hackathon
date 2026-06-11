/**
 * Health Check Route
 * GET /api
 */

import { Hono } from 'hono'
import type { Env } from '../types'

const health = new Hono<{ Bindings: Env }>()

health.get('/', (c) => {
  return c.json({ message: 'Hello, world!', status: 'ok', timestamp: new Date().toISOString() })
})

export default health
