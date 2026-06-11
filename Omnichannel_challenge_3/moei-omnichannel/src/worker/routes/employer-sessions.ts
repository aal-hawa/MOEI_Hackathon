/**
 * Employer Session & Action Log Routes - Hono
 * 
 * Endpoints:
 *   POST /employer-sessions/login       - Create session on login
 *   POST /employer-sessions/logout      - End session on logout
 *   POST /employer-sessions/action      - Log an action
 *   GET  /employer-sessions/history     - Get session history for agent
 *   GET  /employer-sessions/actions     - Get action logs for agent
 *   GET  /employer-settings/:agentId    - Get employer settings
 *   PUT  /employer-settings/:agentId    - Update employer settings
 */

import { Hono } from 'hono'
import { db } from '../lib/db'

const app = new Hono()

// ─── POST /employer-sessions/login ─────────────────────────────────────────
app.post('/employer-sessions/login', async (c) => {
  try {
    const body = await c.req.json()
    const { agentId, agentEmail, ipAddress, userAgent } = body

    if (!agentId || !agentEmail) {
      return c.json({ error: 'agentId and agentEmail are required' }, 400)
    }

    // End any existing active sessions for this agent
    await db.employerSession.updateMany({
      where: { agentId, isActive: true },
      data: { isActive: false, logoutAt: new Date() },
    })

    // Create new session
    const session = await db.employerSession.create({
      data: {
        agentId,
        agentEmail,
        ipAddress: ipAddress || '',
        userAgent: userAgent || '',
      },
    })

    // Log the login action
    await db.employerActionLog.create({
      data: {
        sessionId: session.id,
        agentId,
        action: 'login',
        details: JSON.stringify({ agentEmail, ipAddress }),
      },
    })

    return c.json({ session }, 201)
  } catch (error) {
    console.error('Session login error:', error)
    return c.json({ error: 'Failed to create session' }, 500)
  }
})

// ─── POST /employer-sessions/logout ────────────────────────────────────────
app.post('/employer-sessions/logout', async (c) => {
  try {
    const body = await c.req.json()
    const { agentId, sessionId } = body

    if (!agentId) {
      return c.json({ error: 'agentId is required' }, 400)
    }

    // End the session
    const where = sessionId
      ? { id: sessionId }
      : { agentId, isActive: true }

    const result = await db.employerSession.updateMany({
      where,
      data: { isActive: false, logoutAt: new Date() },
    })

    // Log the logout action
    const activeSession = await db.employerSession.findFirst({
      where: { agentId, isActive: false },
      orderBy: { logoutAt: 'desc' },
    })

    if (activeSession) {
      await db.employerActionLog.create({
        data: {
          sessionId: activeSession.id,
          agentId,
          action: 'logout',
          details: JSON.stringify({ timestamp: new Date().toISOString() }),
        },
      })
    }

    return c.json({ ended: result.count > 0 })
  } catch (error) {
    console.error('Session logout error:', error)
    return c.json({ error: 'Failed to end session' }, 500)
  }
})

// ─── POST /employer-sessions/action ────────────────────────────────────────
app.post('/employer-sessions/action', async (c) => {
  try {
    const body = await c.req.json()
    const { agentId, action, details, channel, targetId } = body

    if (!agentId || !action) {
      return c.json({ error: 'agentId and action are required' }, 400)
    }

    // Find or create an active session
    let session = await db.employerSession.findFirst({
      where: { agentId, isActive: true },
      orderBy: { loginAt: 'desc' },
    })

    if (!session) {
      // Auto-create a session if none exists
      session = await db.employerSession.create({
        data: {
          agentId,
          agentEmail: body.agentEmail || agentId,
        },
      })
    }

    const log = await db.employerActionLog.create({
      data: {
        sessionId: session.id,
        agentId,
        action,
        details: details ? JSON.stringify(details) : '{}',
        channel: channel || null,
        targetId: targetId || null,
      },
    })

    return c.json({ log }, 201)
  } catch (error) {
    console.error('Action log error:', error)
    return c.json({ error: 'Failed to log action' }, 500)
  }
})

// ─── GET /employer-sessions/history ────────────────────────────────────────
app.get('/employer-sessions/history', async (c) => {
  try {
    const agentId = c.req.query('agentId')
    const limit = parseInt(c.req.query('limit') || '20', 10)

    if (!agentId) {
      return c.json({ error: 'agentId query parameter is required' }, 400)
    }

    const sessions = await db.employerSession.findMany({
      where: { agentId },
      orderBy: { loginAt: 'desc' },
      take: limit,
      include: {
        actions: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    })

    return c.json({ sessions })
  } catch (error) {
    console.error('Session history error:', error)
    return c.json({ error: 'Failed to fetch session history' }, 500)
  }
})

// ─── GET /employer-sessions/actions ────────────────────────────────────────
app.get('/employer-sessions/actions', async (c) => {
  try {
    const agentId = c.req.query('agentId')
    const action = c.req.query('action')
    const limit = parseInt(c.req.query('limit') || '100', 10)

    if (!agentId) {
      return c.json({ error: 'agentId query parameter is required' }, 400)
    }

    const where: any = { agentId }
    if (action) where.action = action

    const actions = await db.employerActionLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return c.json({ actions })
  } catch (error) {
    console.error('Action logs error:', error)
    return c.json({ error: 'Failed to fetch action logs' }, 500)
  }
})

// ─── GET /employer-settings/:agentId ───────────────────────────────────────
app.get('/employer-settings/:agentId', async (c) => {
  try {
    const { agentId } = c.req.param()

    let settings = await db.employerSettings.findUnique({
      where: { agentId },
    })

    if (!settings) {
      // Create default settings
      settings = await db.employerSettings.create({
        data: { agentId },
      })
    }

    return c.json({ settings })
  } catch (error) {
    console.error('Get settings error:', error)
    return c.json({ error: 'Failed to fetch settings' }, 500)
  }
})

// ─── PUT /employer-settings/:agentId ───────────────────────────────────────
app.put('/employer-settings/:agentId', async (c) => {
  try {
    const { agentId } = c.req.param()
    const body = await c.req.json()

    // Filter to only allowed fields
    const allowedFields = [
      'fontSize', 'theme', 'language',
      'newMessageNotif', 'caseAssignmentNotif', 'escalationAlerts',
      'shiftReminders', 'aiSuggestionNotif', 'dailySummaryEmail',
      'criticalIncidentAlerts', 'soundNotifications', 'notificationSound',
      'autoReply', 'aiAssistanceLevel', 'conversationSoundAlerts',
      'statusAutoChange', 'compactMode', 'showAISuggestions',
      'defaultView', 'autoRefreshInterval', 'highContrast',
      'reducedMotion', 'screenReaderOpt',
    ]

    const data: Record<string, any> = {}
    for (const key of allowedFields) {
      if (body[key] !== undefined) {
        data[key] = body[key]
      }
    }

    const settings = await db.employerSettings.upsert({
      where: { agentId },
      update: data,
      create: { agentId, ...data },
    })

    return c.json({ settings })
  } catch (error) {
    console.error('Update settings error:', error)
    return c.json({ error: 'Failed to update settings' }, 500)
  }
})

export const employerSessionRoutes = app
