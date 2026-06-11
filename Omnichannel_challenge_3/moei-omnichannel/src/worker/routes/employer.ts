/**
 * Employer/Agent Management Routes - Hono
 * 
 * Endpoints:
 *   GET  /employer/agents        - List all agents with status and active sessions
 *   GET  /employer/agents/:id    - Get agent details
 *   POST /employer/agents        - Create a new agent
 *   PUT  /employer/agents/:id/status - Update agent status
 *   GET  /employer/agents/:id/sessions - Get agent's active conversation sessions
 *   POST /employer/login         - Simple employer login (email-based)
 *   GET  /employer/me            - Get current employer info (from X-Agent-ID header)
 */

import { Hono } from 'hono'
import { db } from '../lib/db'

const app = new Hono()

// ─── GET /employer/agents ─────────────────────────────────────────────────────
// List all agents with their status and active sessions
app.get('/employer/agents', async (c) => {
  try {
    const agents = await db.agent.findMany({
      orderBy: { name: 'asc' },
      include: {
        sessions: {
          where: { status: { in: ['active', 'waiting'] } },
          select: {
            id: true,
            channel: true,
            status: true,
            aiMode: true,
            language: true,
            intent: true,
            createdAt: true,
          },
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    const result = agents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      nameAr: agent.nameAr,
      email: agent.email,
      phone: agent.phone,
      role: agent.role,
      status: agent.status,
      skills: (() => { try { return agent.skills ? JSON.parse(agent.skills) : [] } catch { return [] } })(),
      languages: (() => { try { return agent.languages ? JSON.parse(agent.languages) : ['en'] } catch { return [agent.languages || 'en'] } })(),
      avatar: agent.avatar,
      activeCases: agent.activeCases,
      activeSessionCount: agent.sessions.length,
      activeSessions: agent.sessions,
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt,
    }))

    return c.json({ agents: result, count: result.length })
  } catch (error) {
    console.error('Employer agents list error:', error)
    return c.json({ error: 'Failed to fetch agents' }, 500)
  }
})

// ─── GET /employer/agents/:id ─────────────────────────────────────────────────
// Get agent details
app.get('/employer/agents/:id', async (c) => {
  try {
    const { id } = c.req.param()
    const agent = await db.agent.findUnique({
      where: { id },
      include: {
        sessions: {
          where: { status: { in: ['active', 'waiting'] } },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        shifts: {
          orderBy: { startTime: 'desc' },
          take: 5,
        },
      },
    })

    if (!agent) {
      return c.json({ error: 'Agent not found' }, 404)
    }

    return c.json({
      ...agent,
      skills: (() => { try { return agent.skills ? JSON.parse(agent.skills) : [] } catch { return [] } })(),
      languages: (() => { try { return agent.languages ? JSON.parse(agent.languages) : ['en'] } catch { return [agent.languages || 'en'] } })(),
    })
  } catch (error) {
    console.error('Employer agent detail error:', error)
    return c.json({ error: 'Failed to fetch agent' }, 500)
  }
})

// ─── POST /employer/agents ────────────────────────────────────────────────────
// Create a new agent
app.post('/employer/agents', async (c) => {
  try {
    const body = await c.req.json()
    const { name, nameAr, email, phone, role, skills, languages } = body

    if (!name || !email) {
      return c.json({ error: 'name and email are required' }, 400)
    }

    // Check for duplicate email
    const existing = await db.agent.findUnique({ where: { email } })
    if (existing) {
      return c.json({ error: 'Agent with this email already exists' }, 409)
    }

    const agent = await db.agent.create({
      data: {
        name,
        nameAr: nameAr || '',
        email,
        phone: phone || null,
        role: role || 'agent',
        skills: skills ? JSON.stringify(skills) : null,
        languages: languages ? JSON.stringify(languages) : '["en"]',
        status: 'available',
      },
    })

    return c.json({
      agent: {
        ...agent,
        skills: agent.skills ? JSON.parse(agent.skills) : [],
        languages: agent.languages ? JSON.parse(agent.languages) : ['en'],
      },
    }, 201)
  } catch (error) {
    console.error('Employer agent create error:', error)
    return c.json({ error: 'Failed to create agent' }, 500)
  }
})

// ─── PUT /employer/agents/:id/status ──────────────────────────────────────────
// Update agent status (available, busy, offline, break)
app.put('/employer/agents/:id/status', async (c) => {
  try {
    const { id } = c.req.param()
    const body = await c.req.json()
    const { status } = body

    const validStatuses = ['available', 'busy', 'offline', 'break']
    if (!status || !validStatuses.includes(status)) {
      return c.json({ error: `status must be one of: ${validStatuses.join(', ')}` }, 400)
    }

    const agent = await db.agent.update({
      where: { id },
      data: { status },
    })

    // Create notification for agent about status change
    await db.employerNotification.create({
      data: {
        agentId: id,
        type: 'system',
        title: 'Status Updated',
        titleAr: 'تم تحديث الحالة',
        message: `Your status has been changed to ${status}`,
        messageAr: `تم تغيير حالتك إلى ${status === 'available' ? 'متاح' : status === 'busy' ? 'مشغول' : status === 'offline' ? 'غير متصل' : 'استراحة'}`,
        priority: 'normal',
      },
    })

    return c.json({
      agent: {
        ...agent,
        skills: agent.skills ? JSON.parse(agent.skills) : [],
        languages: agent.languages ? JSON.parse(agent.languages) : ['en'],
      },
    })
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return c.json({ error: 'Agent not found' }, 404)
    }
    console.error('Employer agent status update error:', error)
    return c.json({ error: 'Failed to update agent status' }, 500)
  }
})

// ─── GET /employer/agents/:id/sessions ────────────────────────────────────────
// Get agent's active conversation sessions
app.get('/employer/agents/:id/sessions', async (c) => {
  try {
    const { id } = c.req.param()
    const statusFilter = c.req.query('status')

    const where: any = { agentId: id }
    if (statusFilter) {
      where.status = statusFilter
    } else {
      where.status = { in: ['active', 'waiting'] }
    }

    const sessions = await db.conversationSession.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    // Enrich with transcript count
    const enriched = await Promise.all(
      sessions.map(async (session) => {
        const transcriptCount = await db.sTTTranscript.count({
          where: { sessionId: session.id },
        })
        return {
          ...session,
          transcript: session.transcript ? JSON.parse(session.transcript) : [],
          aiSuggestions: session.aiSuggestions ? JSON.parse(session.aiSuggestions) : [],
          metadata: session.metadata ? JSON.parse(session.metadata) : {},
          transcriptCount,
        }
      })
    )

    return c.json({ sessions: enriched, count: enriched.length })
  } catch (error) {
    console.error('Employer agent sessions error:', error)
    return c.json({ error: 'Failed to fetch agent sessions' }, 500)
  }
})

// ─── POST /employer/login ─────────────────────────────────────────────────────
// Simple employer login (email-based, creates agent if not exists)
app.post('/employer/login', async (c) => {
  try {
    const body = await c.req.json()
    const { email, name, nameAr, phone } = body

    if (!email) {
      return c.json({ error: 'email is required' }, 400)
    }

    // Find existing agent by email
    let agent = await db.agent.findUnique({ where: { email } })

    if (!agent) {
      // Create new agent if not exists
      agent = await db.agent.create({
        data: {
          name: name || email.split('@')[0],
          nameAr: nameAr || '',
          email,
          phone: phone || null,
          role: 'agent',
          status: 'available',
          languages: '["en","ar"]',
        },
      })
    } else {
      // Update last seen
      agent = await db.agent.update({
        where: { id: agent.id },
        data: { status: 'available' },
      })
    }

    return c.json({
      agent: {
        ...agent,
        skills: agent.skills ? JSON.parse(agent.skills) : [],
        languages: agent.languages ? JSON.parse(agent.languages) : ['en'],
      },
      token: `agent-${agent.id}`, // Simple token for X-Agent-ID header
    })
  } catch (error) {
    console.error('Employer login error:', error)
    return c.json({ error: 'Failed to login' }, 500)
  }
})

// ─── GET /employer/me ─────────────────────────────────────────────────────────
// Get current employer info (from header X-Agent-ID)
app.get('/employer/me', async (c) => {
  try {
    const agentId = c.req.header('X-Agent-ID')

    if (!agentId) {
      return c.json({ error: 'X-Agent-ID header is required' }, 401)
    }

    const agent = await db.agent.findUnique({
      where: { id: agentId },
      include: {
        sessions: {
          where: { status: { in: ['active', 'waiting'] } },
          select: {
            id: true,
            channel: true,
            status: true,
            aiMode: true,
            language: true,
            intent: true,
          },
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!agent) {
      return c.json({ error: 'Agent not found' }, 404)
    }

    // Get unread notification count
    const unreadCount = await db.employerNotification.count({
      where: {
        OR: [{ agentId }, { agentId: null }],
        isRead: false,
      },
    })

    return c.json({
      ...agent,
      skills: (() => { try { return agent.skills ? JSON.parse(agent.skills) : [] } catch { return [] } })(),
      languages: (() => { try { return agent.languages ? JSON.parse(agent.languages) : ['en'] } catch { return [agent.languages || 'en'] } })(),
      unreadNotifications: unreadCount,
    })
  } catch (error) {
    console.error('Employer me error:', error)
    return c.json({ error: 'Failed to fetch employer info' }, 500)
  }
})

export const employerRoutes = app
