/**
 * Employer Notification Management Routes - Hono
 * 
 * Endpoints:
 *   GET  /notifications                    - Get notifications for agent
 *   POST /notifications                    - Create notification
 *   PUT  /notifications/:id/read           - Mark as read
 *   POST /notifications/mark-all-read      - Mark all as read for an agent
 *   GET  /notifications/unread-count       - Get unread count for agent
 * 
 * Also includes legacy customer notification endpoint:
 *   GET  /notifications/customer           - Get customer notifications
 */

import { Hono } from 'hono'
import { db } from '../lib/db'

const app = new Hono()

// ─── GET /notifications/customer ──────────────────────────────────────────────
// Legacy: Get customer notifications
app.get('/notifications/customer', async (c) => {
  try {
    const customerId = c.req.query('customerId')
    const where = customerId ? { customerId } : {}

    const notifications = await db.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return c.json(notifications)
  } catch (error) {
    console.error('Customer notifications GET error:', error)
    return c.json({ error: 'Failed to fetch customer notifications' }, 500)
  }
})

// ─── GET /notifications ───────────────────────────────────────────────────────
// Get notifications for agent (query: agentId, unreadOnly, type)
app.get('/notifications', async (c) => {
  try {
    const agentId = c.req.query('agentId')
    const unreadOnly = c.req.query('unreadOnly') === 'true'
    const type = c.req.query('type')
    const limit = parseInt(c.req.query('limit') || '50', 10)

    const where: any = {}
    if (agentId) {
      where.OR = [{ agentId }, { agentId: null }] // Agent-specific + broadcast
    }
    if (unreadOnly) {
      where.isRead = false
    }
    if (type) {
      where.type = type
    }

    const notifications = await db.employerNotification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return c.json({
      notifications: notifications.map((n) => ({
        ...n,
        metadata: n.metadata ? JSON.parse(n.metadata) : {},
      })),
      count: notifications.length,
    })
  } catch (error) {
    console.error('Notifications GET error:', error)
    return c.json({ error: 'Failed to fetch notifications' }, 500)
  }
})

// ─── POST /notifications ──────────────────────────────────────────────────────
// Create notification
app.post('/notifications', async (c) => {
  try {
    const body = await c.req.json()
    const { agentId, type, title, titleAr, message, messageAr, link, priority, metadata } = body

    if (!type || !title || !message) {
      return c.json({ error: 'type, title, and message are required' }, 400)
    }

    const notification = await db.employerNotification.create({
      data: {
        agentId: agentId || null, // null = broadcast
        type,
        title,
        titleAr: titleAr || '',
        message,
        messageAr: messageAr || '',
        link: link || null,
        priority: priority || 'normal',
        metadata: metadata ? JSON.stringify(metadata) : '{}',
      },
    })

    return c.json({
      notification: {
        ...notification,
        metadata: notification.metadata ? JSON.parse(notification.metadata) : {},
      },
    }, 201)
  } catch (error) {
    console.error('Notification create error:', error)
    return c.json({ error: 'Failed to create notification' }, 500)
  }
})

// ─── PUT /notifications/:id/read ──────────────────────────────────────────────
// Mark as read
app.put('/notifications/:id/read', async (c) => {
  try {
    const { id } = c.req.param()

    const notification = await db.employerNotification.update({
      where: { id },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    })

    return c.json({
      id: notification.id,
      isRead: notification.isRead,
      readAt: notification.readAt,
    })
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return c.json({ error: 'Notification not found' }, 404)
    }
    console.error('Notification read error:', error)
    return c.json({ error: 'Failed to mark notification as read' }, 500)
  }
})

// ─── POST /notifications/mark-all-read ────────────────────────────────────────
// Mark all as read for an agent
app.post('/notifications/mark-all-read', async (c) => {
  try {
    const body = await c.req.json()
    const { agentId } = body

    if (!agentId) {
      return c.json({ error: 'agentId is required' }, 400)
    }

    const result = await db.employerNotification.updateMany({
      where: {
        OR: [{ agentId }, { agentId: null }],
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    })

    return c.json({
      markedCount: result.count,
      agentId,
    })
  } catch (error) {
    console.error('Mark all read error:', error)
    return c.json({ error: 'Failed to mark notifications as read' }, 500)
  }
})

// ─── GET /notifications/unread-count ──────────────────────────────────────────
// Get unread count for agent (query: agentId)
app.get('/notifications/unread-count', async (c) => {
  try {
    const agentId = c.req.query('agentId')

    if (!agentId) {
      return c.json({ error: 'agentId query parameter is required' }, 400)
    }

    const count = await db.employerNotification.count({
      where: {
        OR: [{ agentId }, { agentId: null }],
        isRead: false,
      },
    })

    // Group by type for detail
    const byType = await db.employerNotification.groupBy({
      by: ['type'],
      where: {
        OR: [{ agentId }, { agentId: null }],
        isRead: false,
      },
      _count: { type: true },
    })

    return c.json({
      agentId,
      unreadCount: count,
      byType: byType.map((g) => ({
        type: g.type,
        count: g._count.type,
      })),
    })
  } catch (error) {
    console.error('Unread count error:', error)
    return c.json({ error: 'Failed to get unread count' }, 500)
  }
})

export const notificationRoute = app
