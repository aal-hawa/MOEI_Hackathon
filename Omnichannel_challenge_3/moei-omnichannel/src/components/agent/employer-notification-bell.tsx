'use client'

import { useState, useEffect, useCallback } from 'react'
import { Bell, Mail, MessageCircle, Phone, ArrowRightLeft, AlertCircle, FileText, CheckCheck, Loader2 } from 'lucide-react'
import { useAppStore, type EmployerNotification, type NotificationType } from '@/store/app-store'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { motion, AnimatePresence } from 'framer-motion'

const NOTIFICATION_ICONS: Record<NotificationType, React.ElementType> = {
  email: Mail,
  whatsapp: MessageCircle,
  voice: Phone,
  transfer: ArrowRightLeft,
  system: AlertCircle,
  request_created: FileText,
}

const NOTIFICATION_COLORS: Record<NotificationType, string> = {
  email: 'text-amber-600 bg-amber-50',
  whatsapp: 'text-green-600 bg-green-50',
  voice: 'text-teal-600 bg-teal-50',
  transfer: 'text-orange-600 bg-orange-50',
  system: 'text-ae-gold-600 bg-ae-gold-50',
  request_created: 'text-emerald-600 bg-emerald-50',
}

// ─── Local read state (supplements DB) ────────────────────────────────────────
const LOCAL_READ_KEY = 'moei_notification_read_ids'

function getLocalReadIds(): Set<string> {
  try {
    const saved = localStorage.getItem(LOCAL_READ_KEY)
    if (saved) return new Set(JSON.parse(saved))
  } catch { /* silent */ }
  return new Set()
}

function markLocalRead(id: string) {
  const ids = getLocalReadIds()
  ids.add(id)
  try {
    localStorage.setItem(LOCAL_READ_KEY, JSON.stringify([...ids]))
  } catch { /* silent */ }
}

function markAllLocalRead(ids: string[]) {
  const existing = getLocalReadIds()
  ids.forEach(id => existing.add(id))
  try {
    localStorage.setItem(LOCAL_READ_KEY, JSON.stringify([...existing]))
  } catch { /* silent */ }
}

function timeAgo(date: Date): string {
  const now = new Date()
  const diff = Math.floor((now.getTime() - new Date(date).getTime()) / 1000)
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

// ─── Conversation-to-Notification Generator ──────────────────────────────────
interface ConversationData {
  id: string
  customerName?: string
  channel?: string
  status?: string
  sentiment?: number
  aiMode?: string
  createdAt?: string
  updatedAt?: string
}

function generateNotificationsFromConversations(conversations: ConversationData[]): EmployerNotification[] {
  const localReadIds = getLocalReadIds()
  const notifications: EmployerNotification[] = []

  for (const conv of conversations) {
    // New conversation notification
    if (conv.createdAt) {
      const notifId = `conv-new-${conv.id}`
      const channelLabel = conv.channel === 'whatsapp' ? 'WhatsApp' : conv.channel === 'email' ? 'Email' : conv.channel === 'voice' ? 'Voice Call' : 'Web Chat'
      const channelType: NotificationType = (conv.channel as NotificationType) || 'system'
      notifications.push({
        id: notifId,
        type: channelType,
        title: `New ${channelLabel} Conversation`,
        message: `${conv.customerName || 'A customer'} started a ${channelLabel.toLowerCase()} conversation`,
        timestamp: new Date(conv.createdAt),
        read: localReadIds.has(notifId),
        link: '/admin/conversations',
      })
    }

    // Sentiment alert notification
    if (conv.sentiment !== undefined && conv.sentiment < 0.3) {
      const notifId = `conv-sentiment-${conv.id}`
      notifications.push({
        id: notifId,
        type: 'system',
        title: 'Negative Sentiment Alert',
        message: `${conv.customerName || 'A customer'} shows negative sentiment in ${conv.channel || 'chat'}`,
        timestamp: new Date(conv.updatedAt || conv.createdAt || Date.now()),
        read: localReadIds.has(notifId),
        link: '/admin/conversations',
      })
    }

    // Transfer notification
    if (conv.status === 'transferred') {
      const notifId = `conv-transfer-${conv.id}`
      notifications.push({
        id: notifId,
        type: 'transfer',
        title: 'Conversation Transferred',
        message: `${conv.customerName || 'A customer'} was transferred to another agent`,
        timestamp: new Date(conv.updatedAt || conv.createdAt || Date.now()),
        read: localReadIds.has(notifId),
        link: '/admin/conversations',
      })
    }
  }

  return notifications
}

export function EmployerNotificationBell() {
  const {
    currentAgent,
    employerNotifications,
    employerUnreadCount,
    setEmployerNotifications,
    markNotificationRead,
    setEmployerUnreadCount,
    setPageView,
    setView,
    language,
  } = useAppStore()

  const [open, setOpen] = useState(false)
  const isAr = language === 'ar'
  const [markingAllRead, setMarkingAllRead] = useState(false)

  // Fetch notifications from DB + conversations
  const fetchNotifications = useCallback(async () => {
    if (!currentAgent) return
    try {
      // Fetch DB notifications
      const [dbRes, convRes] = await Promise.all([
        fetch(`/api/notifications?agentId=${currentAgent.id}&XTransformPort=3002&limit=50`).catch(() => null),
        fetch(`/api/conversations?XTransformPort=3002&limit=50`).catch(() => null),
      ])

      const allNotifications: EmployerNotification[] = []
      const localReadIds = getLocalReadIds()

      // Parse DB notifications
      if (dbRes?.ok) {
        const data = await dbRes.json()
        const dbNotifs: EmployerNotification[] = (data.notifications || data || []).map((n: Record<string, unknown>) => ({
          id: n.id as string,
          type: (n.type as NotificationType) || 'system',
          title: (n.title as string) || (isAr ? (n.titleAr as string) : '') || 'Notification',
          message: (n.message as string) || (isAr ? (n.messageAr as string) : '') || '',
          timestamp: new Date((n.createdAt as string) || Date.now()),
          read: (n.isRead as boolean) || localReadIds.has(n.id as string),
          link: n.link as string | undefined,
        }))
        allNotifications.push(...dbNotifs)
      }

      // Generate notifications from conversations
      if (convRes?.ok) {
        const convData = await convRes.json()
        const conversations: ConversationData[] = convData.conversations || convData || []
        const convNotifs = generateNotificationsFromConversations(conversations)
        allNotifications.push(...convNotifs)
      }

      // Deduplicate by ID and sort by timestamp
      const seen = new Set<string>()
      const deduped = allNotifications.filter(n => {
        if (seen.has(n.id)) return false
        seen.add(n.id)
        return true
      }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

      setEmployerNotifications(deduped)
      // Note: setEmployerNotifications now auto-computes employerUnreadCount from the notifications
    } catch (err) {
      console.error('Failed to fetch notifications:', err)
    }
  }, [currentAgent, setEmployerNotifications, isAr])

  // Fetch unread count from DB and sync with store
  const fetchUnreadCount = useCallback(async () => {
    if (!currentAgent) return
    try {
      const res = await fetch(`/api/notifications/unread-count?agentId=${currentAgent.id}&XTransformPort=3002`)
      if (res.ok) {
        const data = await res.json()
        if (typeof data.unreadCount === 'number') {
          setEmployerUnreadCount(data.unreadCount)
        }
      }
    } catch (err) {
      console.error('Failed to fetch unread count:', err)
    }
  }, [currentAgent, setEmployerUnreadCount])

  // Initial fetch + polling
  useEffect(() => {
    if (!currentAgent) return
    fetchNotifications()
    fetchUnreadCount()
    const unreadInterval = setInterval(fetchUnreadCount, 10000)
    const notifInterval = setInterval(fetchNotifications, 30000)
    return () => {
      clearInterval(unreadInterval)
      clearInterval(notifInterval)
    }
  }, [currentAgent, fetchUnreadCount, fetchNotifications])

  // Fetch full list when dropdown opens
  useEffect(() => {
    if (open && currentAgent) {
      fetchNotifications()
    }
  }, [open, currentAgent, fetchNotifications])

  const handleNotificationClick = async (notification: EmployerNotification) => {
    // Mark as read locally
    markLocalRead(notification.id)
    // Mark as read in DB (if it's a DB notification)
    try {
      await fetch(`/api/notifications/${notification.id}/read?XTransformPort=3002`, { method: 'PUT' })
    } catch { /* silent */ }
    markNotificationRead(notification.id)
    if (notification.link) {
      if (notification.link.startsWith('/admin')) {
        setPageView('admin')
        const view = notification.link.split('/').pop()
        if (view) setView(view)
      } else if (notification.link.startsWith('/whatsapp')) {
        setPageView('whatsapp')
      } else if (notification.link.startsWith('/email')) {
        setPageView('email')
      } else if (notification.link.startsWith('/voice')) {
        setPageView('voice-call')
      }
    }
    setOpen(false)
  }

  const handleMarkAllRead = async () => {
    setMarkingAllRead(true)
    try {
      // Mark all local
      const allIds = employerNotifications.map(n => n.id)
      markAllLocalRead(allIds)
      // Mark all in DB
      if (currentAgent) {
        await fetch('/api/notifications/mark-all-read?XTransformPort=3002', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agentId: currentAgent.id }),
        })
      }
      // Mark all as read in store
      const store = useAppStore.getState()
      store.employerNotifications.forEach((n) => {
        if (!n.read) markNotificationRead(n.id)
      })
      setEmployerUnreadCount(0)
    } catch (err) {
      console.error('Failed to mark all read:', err)
    }
    setMarkingAllRead(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
          aria-label={isAr ? 'الإشعارات' : 'Notifications'}
        >
          <Bell className="h-[18px] w-[18px]" />
          <AnimatePresence>
            {employerUnreadCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-uae-red-500 text-[9px] font-bold text-white px-1"
              >
                {employerUnreadCount > 99 ? '99+' : employerUnreadCount}
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 z-50" align="end" sideOffset={8}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-ae-black-100">
          <h4 className="text-sm font-semibold text-ae-black-800">
            {isAr ? 'الإشعارات' : 'Notifications'}
          </h4>
          {employerUnreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] text-ae-gold-600 hover:text-ae-gold-700 gap-1"
              onClick={handleMarkAllRead}
              disabled={markingAllRead}
            >
              {markingAllRead ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCheck className="h-3 w-3" />}
              {isAr ? 'قراءة الكل' : 'Mark all read'}
            </Button>
          )}
        </div>

        {/* Notification List */}
        <ScrollArea className="max-h-80">
          {employerNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-ae-black-300">
              <Bell className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-xs">{isAr ? 'لا توجد إشعارات' : 'No notifications'}</p>
            </div>
          ) : (
            <div className="divide-y divide-ae-black-50">
              {employerNotifications.slice(0, 20).map((notification) => {
                const Icon = NOTIFICATION_ICONS[notification.type] || AlertCircle
                const colorClass = NOTIFICATION_COLORS[notification.type] || 'text-ae-black-400 bg-ae-black-50'

                return (
                  <motion.button
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`w-full text-start px-4 py-3 flex items-start gap-3 hover:bg-ae-gold-50/40 transition-colors ${
                      !notification.read ? 'bg-ae-gold-50/20' : ''
                    }`}
                    whileHover={{ x: 2 }}
                    transition={{ duration: 0.15 }}
                  >
                    {/* Icon */}
                    <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${colorClass}`}>
                      <Icon className="w-4 h-4" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-xs truncate ${!notification.read ? 'font-semibold text-ae-black-800' : 'font-medium text-ae-black-600'}`}>
                          {notification.title}
                        </p>
                        {!notification.read && (
                          <span className="shrink-0 h-2 w-2 rounded-full bg-ae-gold-500" />
                        )}
                      </div>
                      <p className="text-[11px] text-ae-black-400 mt-0.5 line-clamp-2">
                        {notification.message}
                      </p>
                      <p className="text-[10px] text-ae-black-300 mt-1">
                        {timeAgo(notification.timestamp)}
                      </p>
                    </div>
                  </motion.button>
                )
              })}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        {employerNotifications.length > 0 && (
          <>
            <Separator />
            <div className="px-4 py-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs text-ae-gold-600 hover:text-ae-gold-700"
                onClick={() => {
                  setPageView('admin')
                  setView('notifications')
                  setOpen(false)
                }}
              >
                {isAr ? 'عرض جميع الإشعارات' : 'View all notifications'}
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}
