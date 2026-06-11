/**
 * Workflows Routes
 * GET /api/workflows, POST /api/workflows
 */

import { Hono } from 'hono'
import type { Env } from '../types'
import { DbClient } from '../db/queries'
import { requireAuthMiddleware, requirePermission } from '../middleware/auth'
import { generateId } from '../lib/utils'

const workflows = new Hono<{ Bindings: Env; Variables: { auth: any; db: DbClient } }>()

// GET /api/workflows
workflows.get('/', requireAuthMiddleware, async (c) => {
  const db = c.get('db')
  try {
    const result = await db.findActiveWorkflows()
    return c.json(result.results || [])
  } catch (error) {
    return c.json({ error: 'Failed to fetch workflows' }, 500)
  }
})

// POST /api/workflows
workflows.post('/', requirePermission('workflows'), async (c) => {
  const db = c.get('db')
  try {
    const body = await c.req.json()
    const id = generateId()
    await db.createWorkflow({
      id, nameEN: body.nameEN, nameAR: body.nameAR,
      descriptionEN: body.descriptionEN || null, descriptionAR: body.descriptionAR || null,
      steps: JSON.stringify(body.steps || []), autoApprovalRules: JSON.stringify(body.autoApprovalRules || {}),
      autoRejectionRules: JSON.stringify(body.autoRejectionRules || {}),
      isActive: 1, priority: body.priority ?? 0,
    })
    const workflow: any = await db.queryFirst('SELECT * FROM ApprovalWorkflow WHERE id = ?', id)
    return c.json(workflow, 201)
  } catch (error) {
    return c.json({ error: 'Failed to create workflow' }, 500)
  }
})

export default workflows
