'use client'

import { useAppStore } from '@/store/app-store'
import { Sidebar } from '@/components/layout/sidebar'
import AgentDashboard from '@/components/agent/agent-dashboard'
import ServiceRulesPanel from '@/components/agent/service-rules-panel'
import AgentSkillsMatrix from '@/components/agent/skills-matrix'
import MultilangQueue from '@/components/agent/multilang-queue'
import PerformanceLeaderboard from '@/components/agent/performance-leaderboard'
import UserSettingsPanel from '@/components/agent/user-settings-panel'
import AIConfigPanel from '@/components/agent/ai-config-panel'
import EmailPanel from '@/pages/components/agent/email-panel'
import { ConversationPanel } from '@/components/agent/conversation-panel'
import { ConversationDetail } from '@/components/agent/conversation-detail'
import { EmployerNotificationBell } from '@/components/agent/employer-notification-bell'
import { EmployerLoginDialog } from '@/components/agent/employer-login-dialog'
import { MoeiPageLayout } from '@/components/shared/layouts/moei-page-layout'
import { PageHeader } from '@/components/shared/ui/page-header'
import { UaeCard } from '@/components/shared/ui/uae-card'
import { Button } from '@/components/ui/button'
import {
  Settings,
  ShieldAlert,
  BarChart4,
  Cpu,
  Settings2,
  LayoutDashboard,
  MessageSquare,
  MessageCircle,
  Bell,
  Mail,
  Phone,
  ArrowRightLeft,
  AlertCircle,
  FileText,
  CheckCheck,
  RefreshCw,
  Loader2,
} from 'lucide-react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { useState, useCallback, useEffect } from 'react'
import { CommandPalette } from '@/components/command-palette'
import { useTranslation } from '@/i18n'
import { useRealtime } from '@/hooks/use-realtime'
import { motion, AnimatePresence } from 'framer-motion'
import type { NotificationType, EmployerNotification } from '@/store/app-store'

// ─── View Configuration Map ────────────────────────────────────────────────
// Centralizes title, description, icon, and breadcrumb for each view.

const viewConfig: Record<string, {
  titleKey: string
  titleFallback: string
  titleFallbackAr: string
  descriptionKey?: string
  descriptionFallback: string
  descriptionFallbackAr: string
  icon: React.ElementType
  breadcrumb: string
}> = {
  dashboard: {
    titleKey: 'agentDashboard',
    titleFallback: 'Agent Dashboard',
    titleFallbackAr: 'لوحة تحكم الموظف',
    descriptionFallback: 'Overview of KPIs, channel distribution, AI performance, and real-time analytics.',
    descriptionFallbackAr: 'نظرة عامة على مؤشرات الأداء وتوزيع القنوات وأداء الذكاء الاصطناعي والتحليلات في الوقت الفعلي.',
    icon: LayoutDashboard,
    breadcrumb: 'Admin',
  },
  conversations: {
    titleKey: 'conversations',
    titleFallback: 'Conversations',
    titleFallbackAr: 'المحادثات',
    descriptionFallback: 'Manage active conversations across all channels with AI-assisted tools.',
    descriptionFallbackAr: 'إدارة المحادثات النشطة عبر جميع القنوات باستخدام أدوات الذكاء الاصطناعي.',
    icon: MessageSquare,
    breadcrumb: 'Admin',
  },
  rules: {
    titleKey: 'aiConfigPanel',
    titleFallback: 'Service Rules',
    titleFallbackAr: 'قواعد الخدمة',
    descriptionFallback: 'Configure AI agent behavior rules, escalation policies, and service compliance guardrails.',
    descriptionFallbackAr: 'تكوين قواعد سلوك الوكيل الذكي وسياسات التصعيد وضوابط الامتثال للخدمة.',
    icon: ShieldAlert,
    breadcrumb: 'Admin',
  },
  insights: {
    titleKey: 'teamInsights',
    titleFallback: 'Team Insights',
    titleFallbackAr: 'رؤى الفريق',
    descriptionFallback: 'Agent skills overview, multilingual queue distribution, and performance leaderboard.',
    descriptionFallbackAr: 'نظرة عامة على مهارات الوكلاء وتوزيع قائمة اللغات المتعددة ولوحة المتصدرين.',
    icon: BarChart4,
    breadcrumb: 'Admin',
  },
  notifications: {
    titleKey: 'notifications',
    titleFallback: 'Notifications',
    titleFallbackAr: 'الإشعارات',
    descriptionFallback: 'View and manage all your notifications in one place.',
    descriptionFallbackAr: 'عرض وإدارة جميع الإشعارات في مكان واحد.',
    icon: Bell,
    breadcrumb: 'Admin',
  },
  email: {
    titleKey: 'emailChannel',
    titleFallback: 'Email Channel',
    titleFallbackAr: 'قناة البريد الإلكتروني',
    descriptionFallback: 'Manage customer emails, compose replies, and use AI-powered auto-reply across the email channel.',
    descriptionFallbackAr: 'إدارة رسائل العملاء وكتابة الردود واستخدام الرد التلقائي بالذكاء الاصطناعي عبر قناة البريد الإلكتروني.',
    icon: Mail,
    breadcrumb: 'Admin',
  },
  'ai-config': {
    titleKey: 'aiConfigPanel',
    titleFallback: 'AI Configuration',
    titleFallbackAr: 'إعدادات الذكاء الاصطناعي',
    descriptionFallback: 'Manage AI models, parameters, prompt templates, and fine-tuning configurations.',
    descriptionFallbackAr: 'إدارة نماذج الذكاء الاصطناعي والمعلمات وقوالب الأوامر وتكوينات الضبط الدقيق.',
    icon: Cpu,
    breadcrumb: 'Admin',
  },
  settings: {
    titleKey: 'settings',
    titleFallback: 'Settings',
    titleFallbackAr: 'الإعدادات',
    descriptionFallback: 'Manage your profile, notification preferences, and application settings.',
    descriptionFallbackAr: 'إدارة ملفك الشخصي وتفضيلات الإشعارات وإعدادات التطبيق.',
    icon: Settings2,
    breadcrumb: 'Admin',
  },
}

// ─── Animation Variants ─────────────────────────────────────────────────────

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
}

const pageTransition = {
  type: 'spring' as const,
  stiffness: 300,
  damping: 30,
  mass: 0.8,
}

// ─── Notifications View Component ──────────────────────────────────────────────

function NotificationsView() {
  const { language, employerNotifications, markNotificationRead, setEmployerUnreadCount, currentAgent, setEmployerNotifications } = useAppStore()
  const isAr = language === 'ar'
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [markingAllRead, setMarkingAllRead] = useState(false)

  // Local read state from localStorage
  const LOCAL_READ_KEY = 'moei_notification_read_ids'
  const getLocalReadIds = useCallback((): Set<string> => {
    try {
      const saved = localStorage.getItem(LOCAL_READ_KEY)
      if (saved) return new Set(JSON.parse(saved))
    } catch { /* silent */ }
    return new Set()
  }, [])

  const unread = employerNotifications.filter(n => !n.read)

  // Fetch notifications from DB + conversations
  const fetchNotifications = useCallback(async () => {
    try {
      const agentQuery = currentAgent ? `agentId=${currentAgent.id}&` : ''
      // Fetch both DB notifications and conversations in parallel
      const [dbRes, convRes] = await Promise.all([
        fetch(`/api/notifications?${agentQuery}XTransformPort=3002&limit=100`).catch(() => null),
        fetch('/api/conversations?XTransformPort=3002&limit=50').catch(() => null),
      ])

      const allNotifications: EmployerNotification[] = []
      const localReadIds = getLocalReadIds()

      // Parse DB notifications
      if (dbRes?.ok) {
        const data = await dbRes.json()
        const dbNotifs: EmployerNotification[] = (data.notifications || data || []).map((n: Record<string, unknown>) => ({
          id: n.id as string,
          type: (n.type as NotificationType) || 'system',
          title: (isAr ? (n.titleAr as string) : n.title as string) || (n.title as string) || 'Notification',
          message: (isAr ? (n.messageAr as string) : n.message as string) || (n.message as string) || '',
          timestamp: new Date((n.createdAt as string) || Date.now()),
          read: (n.isRead as boolean) || localReadIds.has(n.id as string),
          link: n.link as string | undefined,
        }))
        allNotifications.push(...dbNotifs)
      }

      // Generate notifications from conversations
      if (convRes?.ok) {
        const convData = await convRes.json()
        const conversations = convData.conversations || convData || []
        for (const conv of conversations) {
          const channelLabel = conv.channel === 'whatsapp' ? 'WhatsApp' : conv.channel === 'email' ? 'Email' : conv.channel === 'voice' ? 'Voice Call' : 'Web Chat'
          const channelType: NotificationType = (conv.channel as NotificationType) || 'system'

          // New conversation notification
          if (conv.createdAt) {
            const notifId = `conv-new-${conv.id}`
            allNotifications.push({
              id: notifId,
              type: channelType,
              title: `New ${channelLabel} Conversation`,
              message: `${conv.customerName || 'A customer'} started a ${channelLabel.toLowerCase()} conversation`,
              timestamp: new Date(conv.createdAt),
              read: localReadIds.has(notifId),
              link: '/admin/conversations',
            })
          }

          // Sentiment alert
          if (conv.sentiment !== undefined && conv.sentiment < 0.3) {
            const notifId = `conv-sentiment-${conv.id}`
            allNotifications.push({
              id: notifId,
              type: 'system',
              title: 'Negative Sentiment Alert',
              message: `${conv.customerName || 'A customer'} shows negative sentiment`,
              timestamp: new Date(conv.updatedAt || conv.createdAt || Date.now()),
              read: localReadIds.has(notifId),
              link: '/admin/conversations',
            })
          }

          // Transfer notification
          if (conv.status === 'transferred') {
            const notifId = `conv-transfer-${conv.id}`
            allNotifications.push({
              id: notifId,
              type: 'transfer',
              title: 'Conversation Transferred',
              message: `${conv.customerName || 'A customer'} was transferred`,
              timestamp: new Date(conv.updatedAt || conv.createdAt || Date.now()),
              read: localReadIds.has(notifId),
              link: '/admin/conversations',
            })
          }
        }
      }

      // Deduplicate by ID and sort
      const seen = new Set<string>()
      const deduped = allNotifications.filter(n => {
        if (seen.has(n.id)) return false
        seen.add(n.id)
        return true
      }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

      setEmployerNotifications(deduped)
      // Note: setEmployerNotifications now auto-computes employerUnreadCount
      setError(null)
    } catch (err) {
      console.error('Failed to fetch notifications:', err)
      setError(isAr ? 'فشل تحميل الإشعارات' : 'Failed to load notifications')
    }
    setLoading(false)
  }, [currentAgent, setEmployerNotifications, isAr, getLocalReadIds])

  useEffect(() => { 
    requestAnimationFrame(() => fetchNotifications())
    return () => {}
  }, [currentAgent, isAr, fetchNotifications])

  // Poll for new notifications every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  // Auto-generate seed notifications if DB is empty
  useEffect(() => {
    if (!loading && employerNotifications.length === 0 && currentAgent) {
      const seedNotifications = async () => {
        try {
          await fetch('/api/notifications?XTransformPort=3002', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              agentId: currentAgent.id,
              type: 'system',
              title: 'Welcome to MOEI Portal',
              titleAr: 'مرحبًا بكم في بوابة وزارة الطاقة والبنية التحتية',
              message: 'You have been logged in successfully. Start managing conversations and services.',
              messageAr: 'تم تسجيل دخولك بنجاح. ابدأ بإدارة المحادثات والخدمات.',
              priority: 'normal',
            }),
          })
          await fetch('/api/notifications?XTransformPort=3002', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              agentId: currentAgent.id,
              type: 'whatsapp',
              title: 'New WhatsApp Conversation',
              titleAr: 'محادثة واتساب جديدة',
              message: 'A customer has started a WhatsApp conversation that needs your attention.',
              messageAr: 'بدأ عميل محادثة واتساب تحتاج اهتمامك.',
              priority: 'high',
              link: '/admin/conversations',
            }),
          })
          await fetch('/api/notifications?XTransformPort=3002', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              agentId: currentAgent.id,
              type: 'system',
              title: 'AI Mode Update',
              titleAr: 'تحديث وضع الذكاء الاصطناعي',
              message: 'AI mode has been set to Full AI for new conversations by default.',
              messageAr: 'تم تعيين وضع الذكاء الاصطناعي الكامل للمحادثات الجديدة بشكل افتراضي.',
              priority: 'normal',
              link: '/admin/ai-config',
            }),
          })
          fetchNotifications()
        } catch { /* silent */ }
      }
      seedNotifications()
    }
  }, [loading, employerNotifications.length, currentAgent, fetchNotifications])

  const handleMarkAllRead = async () => {
    setMarkingAllRead(true)
    try {
      // Mark all as read in localStorage
      const allIds = employerNotifications.map(n => n.id)
      try {
        const saved = localStorage.getItem('moei_notification_read_ids')
        const existing: string[] = saved ? JSON.parse(saved) : []
        const merged = new Set([...existing, ...allIds])
        localStorage.setItem('moei_notification_read_ids', JSON.stringify([...merged]))
      } catch { /* silent */ }
      // Mark all as read in DB
      if (currentAgent) {
        await fetch('/api/notifications/mark-all-read?XTransformPort=3002', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agentId: currentAgent.id }),
        })
      }
      setEmployerUnreadCount(0)
      const store = useAppStore.getState()
      store.employerNotifications.forEach((n) => {
        if (!n.read) markNotificationRead(n.id)
      })
    } catch (err) {
      console.error('Failed to mark all read:', err)
    }
    setMarkingAllRead(false)
  }

  const handleMarkRead = async (id: string) => {
    // Mark as read locally
    try {
      const saved = localStorage.getItem('moei_notification_read_ids')
      const ids: string[] = saved ? JSON.parse(saved) : []
      if (!ids.includes(id)) {
        ids.push(id)
        localStorage.setItem('moei_notification_read_ids', JSON.stringify(ids))
      }
    } catch { /* silent */ }
    // Mark as read in DB
    try {
      await fetch(`/api/notifications/${id}/read?XTransformPort=3002`, { method: 'PUT' })
    } catch { /* silent */ }
    markNotificationRead(id)
  }

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

  return (
    <div className="p-6 sm:p-8 lg:p-10 h-full overflow-y-auto bg-ae-gold-50/30">
      <PageHeader
        title={isAr ? 'الإشعارات' : 'Notifications'}
        description={isAr ? 'عرض وإدارة جميع الإشعارات' : 'View and manage all your notifications'}
        icon={Bell}
        breadcrumb="Admin"
        actions={
          <div className="flex items-center gap-2">
            {unread.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1"
                onClick={handleMarkAllRead}
                disabled={markingAllRead}
              >
                {markingAllRead ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCheck className="h-3 w-3" />}
                {isAr ? 'قراءة الكل' : 'Mark all read'}
              </Button>
            )}
            <Button variant="outline" size="sm" className="text-xs gap-1" onClick={fetchNotifications}>
              <RefreshCw className="h-3 w-3" />
              {isAr ? 'تحديث' : 'Refresh'}
            </Button>
          </div>
        }
      />
      <UaeCard className="w-full">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-ae-gold-500" />
            <span className="ml-3 text-sm text-ae-black-400">{isAr ? 'جاري التحميل...' : 'Loading...'}</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 text-ae-black-300">
            <AlertCircle className="h-12 w-12 mb-3 opacity-20" />
            <p className="text-sm text-red-500">{error}</p>
            <Button variant="outline" size="sm" className="mt-3 text-xs gap-1" onClick={fetchNotifications}>
              <RefreshCw className="h-3 w-3" />
              {isAr ? 'إعادة المحاولة' : 'Retry'}
            </Button>
          </div>
        ) : employerNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-ae-black-300">
            <Bell className="h-12 w-12 mb-3 opacity-20" />
            <p className="text-sm">{isAr ? 'لا توجد إشعارات' : 'No notifications'}</p>
            <p className="text-xs text-ae-black-200 mt-1">{isAr ? 'ستظهر الإشعارات هنا عند حدوث أحداث جديدة' : 'Notifications will appear here when new events occur'}</p>
          </div>
        ) : (
          <div className="divide-y divide-ae-black-50 max-h-[calc(100vh-320px)] overflow-y-auto custom-scrollbar">
            {employerNotifications.map((notification) => {
              const Icon = NOTIFICATION_ICONS[notification.type] || AlertCircle
              const colorClass = NOTIFICATION_COLORS[notification.type] || 'text-ae-black-400 bg-ae-black-50'
              return (
                <button
                  key={notification.id}
                  onClick={() => handleMarkRead(notification.id)}
                  className={`w-full text-start px-4 py-3 flex items-start gap-3 hover:bg-ae-gold-50/40 transition-colors ${
                    !notification.read ? 'bg-ae-gold-50/20' : ''
                  }`}
                >
                  <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${colorClass}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm ${!notification.read ? 'font-semibold text-ae-black-800' : 'text-ae-black-600'}`}>
                        {notification.title}
                      </p>
                      {!notification.read && (
                        <span className="shrink-0 h-2 w-2 rounded-full bg-ae-gold-500" />
                      )}
                    </div>
                    <p className="text-xs text-ae-black-400 mt-0.5">{notification.message}</p>
                    <p className="text-[10px] text-ae-black-300 mt-1">
                      {new Date(notification.timestamp).toLocaleString(isAr ? 'ar-AE' : 'en-US')}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </UaeCard>
    </div>
  )
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const { currentView, sidebarCollapsed, language, currentAgent } = useAppStore()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)
  useRealtime()
  const { t } = useTranslation()
  const isAr = language === 'ar'

  const config = viewConfig[currentView] || viewConfig.dashboard

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        // AgentDashboard has its own 3-panel layout — don't wrap in card
        return <AgentDashboard />

      case 'conversations':
        // Conversation management: split panel layout with 3 independent scrolls
        // Scroll 1: conversation list (ConversationPanel has its own ScrollArea)
        // Scroll 2: chat messages (ConversationDetail has overflow-y-auto on message area)
        // Scroll 3: main page scroll (handled by the view's own overflow)
        return (
          <div className="flex gap-4 p-4 overflow-hidden h-full min-h-0">
            {/* Left panel: conversation list with internal scroll */}
            <div className="w-80 lg:w-96 shrink-0 h-full min-h-0 overflow-hidden">
              <ConversationPanel />
            </div>
            {/* Right panel: conversation detail with internal scroll for chat messages */}
            <div className="flex-1 min-w-0 h-full min-h-0 overflow-hidden">
              <ConversationDetail />
            </div>
          </div>
        )

      case 'rules':
        return (
          <div className="p-6 sm:p-8 lg:p-10 h-full overflow-y-auto bg-ae-gold-50/30">
            <PageHeader
              title={isAr ? config.titleFallbackAr : (t(config.titleKey as Parameters<typeof t>[0]) || config.titleFallback)}
              description={isAr ? config.descriptionFallbackAr : config.descriptionFallback}
              icon={config.icon}
              breadcrumb={config.breadcrumb}
            />
            <UaeCard className="w-full">
              <ServiceRulesPanel />
            </UaeCard>
          </div>
        )

      case 'insights':
        return (
          <div className="p-6 sm:p-8 lg:p-10 h-full overflow-y-auto bg-ae-gold-50/30">
            <PageHeader
              title={isAr ? config.titleFallbackAr : (t(config.titleKey as Parameters<typeof t>[0]) || config.titleFallback)}
              description={isAr ? config.descriptionFallbackAr : config.descriptionFallback}
              icon={config.icon}
              breadcrumb={config.breadcrumb}
            />
            <div className="space-y-6 w-full">
              <UaeCard title={isAr ? 'مصفوفة المهارات' : 'Skills Matrix'} icon={BarChart4}>
                <AgentSkillsMatrix />
              </UaeCard>
              <UaeCard title={isAr ? 'قائمة اللغات المتعددة' : 'Multilingual Queue'} icon={Settings}>
                <MultilangQueue />
              </UaeCard>
              <UaeCard title={isAr ? 'لوحة المتصدرين' : 'Performance Leaderboard'} icon={BarChart4}>
                <PerformanceLeaderboard />
              </UaeCard>
            </div>
          </div>
        )

      case 'email':
        return (
          <div className="flex h-full p-4">
            <div className="flex-1 min-w-0">
              <EmailPanel />
            </div>
          </div>
        )

      case 'notifications':
        return <NotificationsView />

      case 'ai-config':
        return (
          <div className="p-6 sm:p-8 lg:p-10 h-full overflow-y-auto bg-ae-gold-50/30">
            <PageHeader
              title={isAr ? config.titleFallbackAr : (t(config.titleKey as Parameters<typeof t>[0]) || config.titleFallback)}
              description={isAr ? config.descriptionFallbackAr : config.descriptionFallback}
              icon={config.icon}
              breadcrumb={config.breadcrumb}
            />
            <UaeCard className="w-full">
              <AIConfigPanel />
            </UaeCard>
          </div>
        )

      case 'settings':
        return (
          <div className="p-6 sm:p-8 lg:p-10 h-full overflow-y-auto bg-ae-gold-50/30">
            <PageHeader
              title={isAr ? config.titleFallbackAr : (t(config.titleKey as Parameters<typeof t>[0]) || config.titleFallback)}
              description={isAr ? config.descriptionFallbackAr : config.descriptionFallback}
              icon={config.icon}
              breadcrumb={config.breadcrumb}
            />
            <UaeCard className="w-full">
              <UserSettingsPanel />
            </UaeCard>
          </div>
        )

      default:
        return <AgentDashboard />
    }
  }

  return (
    <MoeiPageLayout
      title={{ en: t('agentDashboard') || 'Agent Dashboard', ar: t('agentDashboard') || 'لوحة تحكم الموظف' }}
      activeRoute="admin"
      showUaePass={true}
      headerActions={
        <div className="flex items-center gap-2">
          {/* Notification Bell in header */}
          <EmployerNotificationBell />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/10 hidden md:flex rounded-full"
            onClick={() => setSettingsOpen(true)}
            title={t('settings')}
            aria-label={t('settings')}
          >
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      }
      contentClassName="flex flex-col w-full max-w-full px-0 py-0 sm:px-0 sm:py-0 overflow-hidden"
      viewportConstrained={true}
    >
      <CommandPalette />
      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0">
          <SheetTitle className="sr-only">{t('settings')}</SheetTitle>
          <UserSettingsPanel />
        </SheetContent>
      </Sheet>

      <div className="flex flex-1 h-full min-h-0 overflow-hidden">
        <Sidebar />
        <div className="flex-1 transition-all duration-300 h-full overflow-hidden min-h-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={pageTransition}
              className="h-full"
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </MoeiPageLayout>
  )
}
