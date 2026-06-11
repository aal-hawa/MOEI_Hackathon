/**
 * Email Inbox Route - Fetch emails from DB for admin EmailPanel
 *
 * Endpoints:
 *   GET /email/inbox — returns all emails, grouped by folder
 *   Query params:
 *     folder     — filter by folder (inbox, sent, draft, trash, spam)
 *     limit      — max results (default 50)
 *     unreadOnly — boolean, only return unread emails
 *
 *   Return format: { emails: [...], folders: [{name, count}], total: number }
 */

import { Hono } from 'hono'
import { db } from '../lib/db'

const app = new Hono()

app.get('/email/inbox', async (c) => {
  try {
    const folder = c.req.query('folder') || undefined
    const limitParam = c.req.query('limit')
    const unreadOnly = c.req.query('unreadOnly') === 'true'

    const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 50, 200) : 50

    // Build where clause
    const where: any = {}
    if (folder) {
      where.folder = folder
    }
    if (unreadOnly) {
      where.isRead = false
    }

    // Fetch emails
    const [emails, totalCount] = await Promise.all([
      db.emailMsg.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: limit,
      }),
      db.emailMsg.count({ where }),
    ])

    // Get folder counts
    const allEmails = await db.emailMsg.findMany({
      select: { folder: true, isRead: true },
    })

    const folderMap = new Map<string, { total: number; unread: number }>()
    for (const email of allEmails) {
      const f = email.folder || 'inbox'
      const current = folderMap.get(f) || { total: 0, unread: 0 }
      current.total += 1
      if (!email.isRead) {
        current.unread += 1
      }
      folderMap.set(f, current)
    }

    // Build folders array with standard order
    const standardFolders = ['inbox', 'sent', 'draft', 'trash', 'spam']
    const folders: Array<{ name: string; count: number; unread: number }> = []

    for (const name of standardFolders) {
      const data = folderMap.get(name)
      if (data) {
        folders.push({ name, count: data.total, unread: data.unread })
      }
    }

    // Add any custom folders not in the standard list
    for (const [name, data] of folderMap.entries()) {
      if (!standardFolders.includes(name)) {
        folders.push({ name, count: data.total, unread: data.unread })
      }
    }

    return c.json({
      emails,
      folders,
      total: totalCount,
    })
  } catch (error) {
    console.error('Email inbox fetch error:', error)
    return c.json({ error: 'Failed to fetch emails' }, 500)
  }
})

export const emailInboxRoutes = app
