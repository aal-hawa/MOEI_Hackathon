'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  MessageCircle,
  Phone,
  Globe,
  Bot,
  AlertTriangle,
  Zap,
  FileText,
  Activity,
  ChevronUp,
  Clock,
  Mail,
  Sparkles,
  MessageSquare,
  Bell,
  TrendingUp,
  Heart,
  Coffee,
  Star,
  Settings,
  BarChart3,
  PieChart,
  ArrowRight,
  Users,
  Shield,
  Brain,
  ChevronDown,
  Cpu,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Layers,
  Gauge,
  Eye,
  Wifi,
  WifiOff,
  Server,
  RefreshCw,
  Play,
  Loader2,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore, type ConversationSession } from '@/store/app-store'
import { getAiModeLabel, AI_MODE_CONFIG } from '@/components/agent/ai-mode-config'
import { useTranslation } from '@/i18n'
import { useRealtime } from '@/hooks/use-realtime'
import AIInsightsPanel from '@/components/dashboard/ai-insights-panel'
import ChannelSettingsDialog from '@/components/agent/channel-settings-dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

// ─── Types ───────────────────────────────────────────────────────────────────

interface AgentNotification {
  id: string
  type: 'new_conversation' | 'sentiment_alert' | 'case_status' | 'escalation_request'
  message: string
  time: Date
  read: boolean
}

interface KPIData {
  totalConversations: number
  activeNow: number
  avgResponseTime: number
  csat: number
  resolutionRate: number
  escalationRate: number
  activeCases: number
  totalInteractions: number
  avgResolutionTime: number
  firstContactResolution: number
  selfServiceDeflection: number
  agentsOnline: number
  channelBreakdown?: Record<string, number>
}

interface RecentActivity {
  id: string
  type: 'conversation' | 'escalation' | 'resolution' | 'sentiment_alert' | 'transfer'
  customerName: string
  channel: string
  message: string
  timestamp: string | Date
  sentiment?: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function getSentimentLabel(sentiment: number, t?: (key: string) => string): string {
  if (sentiment >= 0.65) return t ? t('sentimentPositive') : 'Positive'
  if (sentiment >= 0.35) return t ? t('sentimentNeutral') : 'Neutral'
  return t ? t('sentimentNegative') : 'Negative'
}

function getChannelIcon(channel: string, className = 'h-4 w-4') {
  switch (channel) {
    case 'whatsapp':
      return <MessageCircle className={className} />
    case 'voice':
      return <Phone className={className} />
    case 'web':
      return <Globe className={className} />
    case 'email':
      return <Mail className={className} />
    default:
      return <MessageSquare className={className} />
  }
}

function getChannelColor(channel: string): string {
  switch (channel) {
    case 'whatsapp': return 'text-green-600'
    case 'voice': return 'text-blue-600'
    case 'web': return 'text-amber-600'
    case 'email': return 'text-purple-600'
    default: return 'text-muted-foreground'
  }
}

function getChannelBgColor(channel: string): string {
  switch (channel) {
    case 'whatsapp': return 'bg-green-50 border-green-200'
    case 'voice': return 'bg-blue-50 border-blue-200'
    case 'web': return 'bg-amber-50 border-amber-200'
    case 'email': return 'bg-purple-50 border-purple-200'
    default: return 'bg-muted/50 border-border'
  }
}

function getChannelLabel(channel: string, t: (key: string) => string): string {
  switch (channel) {
    case 'whatsapp': return t('whatsapp')
    case 'voice': return t('voice')
    case 'web': return t('webChat')
    default: return channel
  }
}

// ─── Notification System ─────────────────────────────────────────────────────
function NotificationBell({ notifications, onMarkRead, onMarkAllRead }: {
  notifications: AgentNotification[]
  onMarkRead: (id: string) => void
  onMarkAllRead: () => void
}) {
  const { t } = useTranslation()
  const unreadCount = notifications.filter(n => !n.read).length
  const [selectedNotification, setSelectedNotification] = useState<AgentNotification | null>(null)

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative h-8 w-8">
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-uae-red-500 text-[9px] font-bold text-white">
                {unreadCount}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="end">
          <div className="flex items-center justify-between p-3 border-b">
            <h4 className="text-sm font-semibold">{t('notifications')}</h4>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={onMarkAllRead}>
                {t('markAllRead')}
              </Button>
            )}
          </div>
          <div className="max-h-64 overflow-y-auto custom-scrollbar">
            {notifications.length === 0 ? (
              <p className="p-4 text-xs text-muted-foreground text-center">{t('noNotifications')}</p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => {
                    onMarkRead(n.id)
                    setSelectedNotification(n)
                  }}
                  className={`w-full text-left p-3 border-b hover:bg-ae-black-50 transition-colors ${!n.read ? 'bg-ae-gold-50/50' : ''}`}
                >
                  <div className="flex items-start gap-2">
                    <div className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${n.type === 'sentiment_alert' ? 'bg-uae-red-500' : n.type === 'escalation_request' ? 'bg-orange-500' : 'bg-ae-gold-500'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground">{n.message}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {n.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>

      <Dialog open={!!selectedNotification} onOpenChange={(open) => !open && setSelectedNotification(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className={`h-2.5 w-2.5 rounded-full ${selectedNotification?.type === 'sentiment_alert' ? 'bg-uae-red-500' : selectedNotification?.type === 'escalation_request' ? 'bg-orange-500' : 'bg-ae-gold-500'}`} />
              Notification Details
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-foreground mb-4">{selectedNotification?.message}</p>
            <p className="text-xs text-muted-foreground">Type: <Badge variant="outline" className="text-[10px]">{selectedNotification?.type}</Badge></p>
            <p className="text-xs text-muted-foreground mt-2">Received: {selectedNotification?.time.toLocaleString()}</p>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => setSelectedNotification(null)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── Agent Performance Bar ───────────────────────────────────────────────────

function AgentPerformanceBar() {
  const { t } = useTranslation()
  const [isOnline, setIsOnline] = useState(true)
  const [isOnBreak, setIsOnBreak] = useState(false)
  const [breakSeconds, setBreakSeconds] = useState(0)
  const [casesToday, setCasesToday] = useState(0)
  const [avgResponse, setAvgResponse] = useState('--:--')
  const [csatRating, setCsatRating] = useState(0)
  const [agentName, setAgentName] = useState('')

  useEffect(() => {
    fetch('/api/realtime/kpis?XTransformPort=3002')
      .then(res => res.json())
      .then(data => {
        if (data) {
          setCasesToday(data.activeCases ?? data.totalInteractions ?? 0)
          setCsatRating(data.csat ?? 0)
          if (typeof data.avgResolutionTime === 'number' && data.avgResolutionTime > 0) {
            // avgResolutionTime is already in minutes from the API
            setAvgResponse(`${Math.round(data.avgResolutionTime)}m`)
          }
        }
      })
      .catch(() => {
        // Keep default values on API failure
      })
  }, [])

  useEffect(() => {
    if (!isOnBreak) return
    const interval = setInterval(() => setBreakSeconds(s => s + 1), 1000)
    return () => clearInterval(interval)
  }, [isOnBreak])

  const handleToggleBreak = () => {
    if (isOnBreak) {
      setIsOnBreak(false)
      setIsOnline(true)
      setBreakSeconds(0)
    } else {
      setIsOnBreak(true)
      setIsOnline(false)
    }
  }

  const metrics = [
    { icon: FileText, label: t('casesHandledToday'), value: String(casesToday) },
    { icon: Clock, label: t('avgResponseTime'), value: avgResponse },
    { icon: Star, label: t('customerSatisfaction'), value: String(csatRating) },
  ]

  return (
    <div className="flex items-center gap-4 px-4 py-2 border-b border-ae-black-100 bg-white">
      {/* Agent Identity */}
      <div className="flex items-center gap-2.5">
        <div className="relative">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-ae-gold-500 text-white text-xs font-semibold">{agentName ? agentName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'AG'}</AvatarFallback>
          </Avatar>
          <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white ${
            isOnBreak ? 'bg-amber-500' : isOnline ? 'bg-uae-green-500' : 'bg-gray-400'
          }`} />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground leading-none">{agentName || t('agent')}</p>
          <button
            onClick={() => { setIsOnline(!isOnline); if (isOnline) setIsOnBreak(false) }}
            className={`text-[11px] font-medium mt-0.5 flex items-center gap-1 ${
              isOnBreak ? 'text-amber-600' : isOnline ? 'text-uae-green-600' : 'text-gray-400'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${
              isOnBreak ? 'bg-amber-500 animate-pulse' : isOnline ? 'bg-uae-green-500' : 'bg-gray-400'
            }`} />
            {isOnBreak ? t('breakMode') : isOnline ? t('agentOnline') : t('agentOffline')}
          </button>
        </div>
      </div>

      <div className="h-6 w-px bg-ae-black-100" />

      {/* Metrics */}
      <div className="flex items-center gap-3">
        {metrics.map((metric) => {
          const Icon = metric.icon
          return (
            <div key={metric.label} className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-ae-black-50/50">
              <Icon className="h-3.5 w-3.5 text-ae-gold-500" />
              <span className="text-[11px] text-ae-black-400">{metric.label}</span>
              <span className="text-[11px] font-bold text-foreground">{metric.value}</span>
            </div>
          )
        })}
      </div>

      <div className="ml-auto">
        <Button
          variant={isOnBreak ? 'default' : 'outline'}
          size="sm"
          className={`h-7 text-[11px] gap-1.5 ${
            isOnBreak ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'hover:bg-amber-50 hover:text-amber-600 hover:border-amber-300'
          }`}
          onClick={handleToggleBreak}
        >
          <Coffee className="h-3.5 w-3.5" />
          {isOnBreak ? `${formatDuration(breakSeconds)}` : t('takeBreak')}
        </Button>
      </div>
    </div>
  )
}

// ─── Agent Insights Bar (compact AI insights toggle) ─────────────────────────

function AgentInsightsBar() {
  const { t } = useTranslation()
  const [seed, setSeed] = useState(0)

  const insights = useMemo(() => {
    const r = () => Math.random()
    const volumeChange = 10 + Math.floor(r() * 15)
    const escalationCount = 2 + Math.floor(r() * 4)
    const sentimentChange = 3 + Math.floor(r() * 8)
    const extraAgents = 1 + Math.floor(r() * 3)

    return [
      { icon: TrendingUp, iconColor: 'text-ae-gold-600', text: t('predictedVolumeDesc').replace('{pct}', String(volumeChange)) },
      { icon: AlertTriangle, iconColor: 'text-uae-red-600', text: t('escalationRiskDesc').replace('{count}', String(escalationCount)) },
      { icon: Heart, iconColor: 'text-uae-green-600', text: t('sentimentTrendDesc').replace('{pct}', String(sentimentChange)) },
      { icon: Clock, iconColor: 'text-amber-600', text: t('staffingRecommendationDesc').replace('{count}', String(extraAgents)) },
    ]
  }, [t, seed])

  useEffect(() => {
    const interval = setInterval(() => {
      setSeed(s => s + 1)
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex items-center gap-2 min-w-max">
      <Badge variant="outline" className="gap-1 shrink-0 text-[9px] border-ae-gold-300 text-ae-gold-700 bg-ae-gold-50 dark:bg-ae-black-800/30 dark:text-ae-gold-400 dark:border-ae-gold-700">
        <Sparkles className="w-2.5 h-2.5" />
        AI
      </Badge>
      {insights.map((insight, i) => {
        const Icon = insight.icon
        return (
          <div key={i} className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted/50 text-[11px] text-muted-foreground whitespace-nowrap">
            <Icon className={`w-3 h-3 ${insight.iconColor}`} />
            <span>{insight.text}</span>
          </div>
        )
      })}
    </div>
  )
}

// ─── KPI Stats Card ──────────────────────────────────────────────────────────

function KPIStatsRow() {
  const { t } = useTranslation()
  const { activeConversations, kpis } = useAppStore()
  const [kpiData, setKpiData] = useState<KPIData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/realtime/kpis?XTransformPort=3002')
      .then(res => res.json())
      .then(data => {
        setKpiData(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  // Whether we have actual data from the API (vs null/not-loaded)
  const hasData = kpiData !== null

  // Derive values from store + API
  const totalConversations = kpiData?.totalConversations ?? kpiData?.totalInteractions ?? kpis.totalInteractions ?? 0
  const activeNow = kpiData?.activeNow ?? activeConversations.length
  const avgResponseTime = kpiData?.avgResolutionTime ?? kpis.avgResolutionTime ?? 0
  const csat = kpiData?.csat ?? kpis.csat ?? 0
  const resolutionRate = kpiData?.firstContactResolution ?? kpis.firstContactResolution ?? 0
  const escalationRate = kpiData?.escalationRate ?? kpis.escalationRate ?? 0

  // Format helpers — show actual values when data is loaded, 'N/A' when not
  const formatResponseTime = (minutes: number) => {
    if (!hasData) return 'N/A'
    if (minutes === 0) return '0m'
    return `${minutes}m`
  }
  const formatRating = (val: number) => {
    if (!hasData) return 'N/A'
    return `${val}/5`
  }
  const formatPercent = (val: number) => {
    if (!hasData) return 'N/A'
    return `${val}%`
  }

  const kpiCards = [
    {
      icon: MessageSquare,
      label: t('totalConversations'),
      value: totalConversations,
      color: 'text-ae-gold-600',
      bg: 'bg-ae-gold-50',
      borderColor: 'border-ae-gold-200',
    },
    {
      icon: Activity,
      label: t('activeNow'),
      value: activeNow,
      color: 'text-uae-green-600',
      bg: 'bg-uae-green-50',
      borderColor: 'border-uae-green-200',
    },
    {
      icon: Clock,
      label: t('avgResponseTime'),
      value: formatResponseTime(avgResponseTime),
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      borderColor: 'border-amber-200',
    },
    {
      icon: Star,
      label: t('customerSatisfaction'),
      value: formatRating(csat),
      color: 'text-ae-gold-600',
      bg: 'bg-ae-gold-50',
      borderColor: 'border-ae-gold-200',
    },
    {
      icon: CheckCircle2,
      label: t('resolutionRate'),
      value: formatPercent(resolutionRate),
      color: 'text-uae-green-600',
      bg: 'bg-uae-green-50',
      borderColor: 'border-uae-green-200',
    },
    {
      icon: AlertCircle,
      label: t('escalationRate'),
      value: formatPercent(escalationRate),
      color: 'text-uae-red-600',
      bg: 'bg-uae-red-50',
      borderColor: 'border-uae-red-200',
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {kpiCards.map((kpi, i) => {
        const Icon = kpi.icon
        return (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
          >
            <Card className={`border ${kpi.borderColor} hover:shadow-md transition-shadow`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`p-1.5 rounded-md ${kpi.bg}`}>
                    <Icon className={`h-4 w-4 ${kpi.color}`} />
                  </div>
                  <span className="text-[11px] text-muted-foreground font-medium">{kpi.label}</span>
                </div>
                <p className={`text-2xl font-bold ${kpi.color}`}>
                  {loading ? (
                    <span className="inline-block w-12 h-7 bg-muted animate-pulse rounded" />
                  ) : (
                    kpi.value
                  )}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )
      })}
    </div>
  )
}

// ─── Channel Distribution Card ───────────────────────────────────────────────

function ChannelDistributionCard() {
  const { t } = useTranslation()
  const { conversationSessions, activeConversations } = useAppStore()

  const channelData = useMemo(() => {
    // Combine data from conversationSessions and activeConversations
    const allSessions = [...conversationSessions]
    const channelCounts: Record<string, number> = {}

    // Count from conversation sessions
    for (const session of allSessions) {
      const ch = session.channel || 'unknown'
      channelCounts[ch] = (channelCounts[ch] || 0) + 1
    }

    // Also include active conversations not in sessions
    const sessionIds = new Set(allSessions.map(s => s.id))
    for (const conv of activeConversations) {
      if (!sessionIds.has(conv.id)) {
        const ch = conv.channel || 'unknown'
        channelCounts[ch] = (channelCounts[ch] || 0) + 1
      }
    }

    const total = Object.values(channelCounts).reduce((sum, c) => sum + c, 0) || 1

    const channels = [
      { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, color: 'bg-green-500', textColor: 'text-green-700', bgColor: 'bg-green-50' },
      { key: 'voice', label: t('voice'), icon: Phone, color: 'bg-blue-500', textColor: 'text-blue-700', bgColor: 'bg-blue-50' },
      { key: 'web', label: t('webChat'), icon: Globe, color: 'bg-amber-500', textColor: 'text-amber-700', bgColor: 'bg-amber-50' },
      { key: 'email', label: 'Email', icon: Mail, color: 'bg-purple-500', textColor: 'text-purple-700', bgColor: 'bg-purple-50' },
    ]

    return channels.map(ch => ({
      ...ch,
      count: channelCounts[ch.key] || 0,
      percentage: Math.round(((channelCounts[ch.key] || 0) / total) * 100),
    }))
  }, [conversationSessions, activeConversations, t])

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <PieChart className="h-4 w-4 text-ae-gold-500" />
          {t('channelDistribution')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {channelData.map((ch) => {
          const Icon = ch.icon
          return (
            <div key={ch.key} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`p-1 rounded ${ch.bgColor}`}>
                    <Icon className={`h-3.5 w-3.5 ${ch.textColor}`} />
                  </div>
                  <span className="text-xs font-medium text-foreground">{ch.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-foreground">{ch.count}</span>
                  <Badge variant="outline" className="text-[9px] h-4 px-1.5">
                    {ch.percentage}%
                  </Badge>
                </div>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${ch.color}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${ch.percentage}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                />
              </div>
            </div>
          )
        })}
        {channelData.every(ch => ch.count === 0) && (
          <div className="py-6 text-center">
            <Layers className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">{t('noActiveConversations')}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Recent Activity Feed Card ───────────────────────────────────────────────

function RecentActivityCard() {
  const { t } = useTranslation()
  const { activeConversations, conversationSessions } = useAppStore()
  const [activities, setActivities] = useState<RecentActivity[]>([])

  useEffect(() => {
    fetch('/api/conversations?XTransformPort=3002')
      .then(res => res.json())
      .then(data => {
        const convs = Array.isArray(data) ? data : (data.conversations || [])
        // Map conversations to activity items, take latest 10
        const mapped: RecentActivity[] = convs.slice(0, 10).map((conv: Record<string, unknown>) => ({
          id: (conv.id as string) || `act-${Date.now()}`,
          type: (conv.status === 'escalated' ? 'escalation' : conv.status === 'resolved' ? 'resolution' : 'conversation') as RecentActivity['type'],
          customerName: (conv.customerName as string) || (conv.customer as Record<string, unknown>)?.nameEn as string || (conv.customer as Record<string, unknown>)?.nameAr as string || 'Unknown',
          channel: (conv.channel as string) || 'unknown',
          message: (conv.lastMessage as string) || (conv.intent as string) || 'New interaction',
          timestamp: (conv.createdAt as string) || (conv.updatedAt as string) || new Date().toISOString(),
          sentiment: (conv.sentiment as number) || undefined,
        }))
        setActivities(mapped)
      })
      .catch(() => {
        // Fallback: derive from store data
        const fallback: RecentActivity[] = [...activeConversations].slice(0, 8).map(conv => ({
          id: conv.id,
          type: (conv.alert ? 'sentiment_alert' : 'conversation') as RecentActivity['type'],
          customerName: conv.customerName,
          channel: conv.channel,
          message: conv.intent || 'Active conversation',
          timestamp: new Date(Date.now() - conv.duration * 1000).toISOString(),
          sentiment: conv.sentiment,
        }))
        setActivities(fallback)
      })
  }, [activeConversations])

  const getActivityIcon = (type: RecentActivity['type']) => {
    switch (type) {
      case 'escalation': return <AlertCircle className="h-3.5 w-3.5 text-uae-red-500" />
      case 'resolution': return <CheckCircle2 className="h-3.5 w-3.5 text-uae-green-500" />
      case 'sentiment_alert': return <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
      case 'transfer': return <ArrowRight className="h-3.5 w-3.5 text-blue-500" />
      default: return <MessageSquare className="h-3.5 w-3.5 text-ae-gold-500" />
    }
  }

  const formatTimeAgo = (timestamp: string | Date): string => {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp
    const diff = Date.now() - date.getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return t('justNow')
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
  }

  return (
    <Card className="h-full overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Activity className="h-4 w-4 text-ae-gold-500" />
          {t('recentActivity')}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 overflow-hidden">
        <ScrollArea className="h-[280px]">
          <div className="px-4 pb-4 space-y-1">
            {activities.length === 0 ? (
              <div className="py-8 text-center">
                <Activity className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                <p className="text-xs text-muted-foreground">{t('noRecentActivity')}</p>
              </div>
            ) : (
              activities.map((activity, i) => (
                <motion.div
                  key={activity.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: i * 0.03 }}
                  className="flex items-start gap-2 p-2 rounded-lg hover:bg-muted/30 transition-colors max-w-full overflow-hidden"
                >
                  <div className="mt-0.5 shrink-0">
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1 min-w-0 max-w-full overflow-hidden">
                    <div className="flex items-center gap-1.5 overflow-hidden min-w-0">
                      <span className="text-xs font-medium text-foreground truncate min-w-0">{activity.customerName}</span>
                      <span className={`shrink-0 ${getChannelColor(activity.channel)}`}>
                        {getChannelIcon(activity.channel, 'h-3 w-3')}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate block max-w-full">{activity.message}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0 whitespace-nowrap">
                    {formatTimeAgo(activity.timestamp)}
                  </span>
                </motion.div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

// ─── Quick Actions Card ──────────────────────────────────────────────────────

function QuickActionsCard() {
  const { t } = useTranslation()
  const { setView } = useAppStore()

  const actions = [
    { id: 'conversations', icon: MessageSquare, label: t('conversations'), view: 'conversations', color: 'text-ae-gold-600', bg: 'bg-ae-gold-50 hover:bg-ae-gold-100', border: 'border-ae-gold-200' },
    { id: 'rules', icon: Shield, label: t('serviceRules'), view: 'rules', color: 'text-uae-green-600', bg: 'bg-uae-green-50 hover:bg-uae-green-100', border: 'border-uae-green-200' },
    { id: 'insights', icon: BarChart3, label: t('teamInsights'), view: 'insights', color: 'text-blue-600', bg: 'bg-blue-50 hover:bg-blue-100', border: 'border-blue-200' },
    { id: 'ai-config', icon: Brain, label: t('aiConfigPanel'), view: 'ai-config', color: 'text-purple-600', bg: 'bg-purple-50 hover:bg-purple-100', border: 'border-purple-200' },
    { id: 'settings', icon: Settings, label: t('settings'), view: 'settings', color: 'text-amber-600', bg: 'bg-amber-50 hover:bg-amber-100', border: 'border-amber-200' },
  ]

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Zap className="h-4 w-4 text-ae-gold-500" />
          {t('quickActions')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-2">
          {actions.map((action, i) => {
            const Icon = action.icon
            return (
              <motion.div
                key={action.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: i * 0.05 }}
              >
                <Button
                  variant="outline"
                  className={`w-full justify-start gap-3 h-10 ${action.bg} ${action.border} ${action.color} font-medium text-xs`}
                  onClick={() => setView(action.view)}
                >
                  <Icon className="h-4 w-4" />
                  {action.label}
                  <ArrowRight className="h-3 w-3 ml-auto opacity-50" />
                </Button>
              </motion.div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── AI Performance Summary Card ─────────────────────────────────────────────

function AIPerformanceCard() {
  const { t, language } = useTranslation()
  const { conversationSessions } = useAppStore()
  const isAr = language === 'ar'

  const aiStats = useMemo(() => {
    const sessions = conversationSessions || []

    // AI-assisted conversations (not human_only or ai_disabled)
    const aiAssisted = sessions.filter(s =>
      s.aiMode === 'full_ai' || s.aiMode === 'ai_assist' || s.aiMode === 'llm_tts'
    ).length

    // AI mode distribution
    const modeCounts: Record<string, number> = {}
    for (const s of sessions) {
      modeCounts[s.aiMode] = (modeCounts[s.aiMode] || 0) + 1
    }

    const total = sessions.length || 1
    const aiAssistPercentage = Math.round((aiAssisted / total) * 100)

    // Average sentiment for AI-assisted sessions (as proxy for confidence)
    const aiSessions = sessions.filter(s => s.aiMode === 'full_ai' || s.aiMode === 'ai_assist')
    const avgConfidence = aiSessions.length > 0
      ? Math.round((aiSessions.reduce((sum, s) => sum + s.sentiment, 0) / aiSessions.length) * 100)
      : 0

    const modeLabels: Record<string, { label: string; color: string; bgColor: string }> = {
      full_ai: { label: getAiModeLabel('full_ai', isAr), color: 'text-uae-green-700', bgColor: 'bg-uae-green-500' },
      ai_assist: { label: getAiModeLabel('ai_assist', isAr), color: 'text-ae-gold-700', bgColor: 'bg-ae-gold-500' },
      llm_tts: { label: getAiModeLabel('llm_tts', isAr), color: 'text-blue-700', bgColor: 'bg-blue-500' },
      human_only: { label: getAiModeLabel('human_only', isAr), color: 'text-amber-700', bgColor: 'bg-amber-500' },
      ai_disabled: { label: getAiModeLabel('ai_disabled', isAr), color: 'text-gray-600', bgColor: 'bg-gray-400' },
    }

    const modes = Object.entries(modeCounts).map(([mode, count]) => ({
      key: mode,
      ...modeLabels[mode] || { label: mode, color: 'text-muted-foreground', bgColor: 'bg-muted' },
      count,
      percentage: Math.round((count / total) * 100),
    }))

    return { aiAssisted, aiAssistPercentage, avgConfidence, modes, total: sessions.length }
  }, [conversationSessions, isAr])

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Cpu className="h-4 w-4 text-ae-gold-500" />
          {t('aiPerformanceSummary')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* AI Stats Row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-ae-gold-200 bg-ae-gold-50/50 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Bot className="h-3.5 w-3.5 text-ae-gold-600" />
              <span className="text-[10px] text-muted-foreground">{t('aiAssistedConversations')}</span>
            </div>
            <p className="text-lg font-bold text-ae-gold-700">{aiStats.aiAssisted}</p>
            <p className="text-[10px] text-muted-foreground">{aiStats.aiAssistPercentage}% of total</p>
          </div>
          <div className="rounded-lg border border-uae-green-200 bg-uae-green-50/50 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Gauge className="h-3.5 w-3.5 text-uae-green-600" />
              <span className="text-[10px] text-muted-foreground">{t('avgAiConfidence')}</span>
            </div>
            <p className="text-lg font-bold text-uae-green-700">{aiStats.avgConfidence}%</p>
            <p className="text-[10px] text-muted-foreground">Based on sentiment</p>
          </div>
        </div>

        {/* AI Mode Distribution */}
        <div>
          <p className="text-[11px] font-medium text-muted-foreground mb-2">{t('aiModeDistribution')}</p>
          <div className="space-y-2">
            {aiStats.modes.map((mode) => (
              <div key={mode.key} className="flex items-center gap-2">
                <span className={`text-[10px] font-medium w-20 ${mode.color}`}>{mode.label}</span>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${mode.bgColor}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${mode.percentage}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                  />
                </div>
                <span className="text-[10px] font-medium text-muted-foreground w-8 text-right">{mode.count}</span>
              </div>
            ))}
          </div>
        </div>

        {aiStats.total === 0 && (
          <div className="py-4 text-center">
            <Brain className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">{t('noConversationSessions')}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Sentiment Overview Card ─────────────────────────────────────────────────

function SentimentOverviewCard() {
  const { t } = useTranslation()
  const { activeConversations, conversationSessions } = useAppStore()

  const sentimentData = useMemo(() => {
    // Combine all conversations for sentiment analysis
    const allConvs = [
      ...activeConversations.map(c => ({ id: c.id, sentiment: c.sentiment })),
      ...conversationSessions.map(s => ({ id: s.id, sentiment: s.sentiment })),
    ]

    // Deduplicate
    const seen = new Set<string>()
    const unique = allConvs.filter(c => {
      if (seen.has(c.id)) return false
      seen.add(c.id)
      return true
    })

    const positive = unique.filter(c => c.sentiment >= 0.65).length
    const neutral = unique.filter(c => c.sentiment >= 0.35 && c.sentiment < 0.65).length
    const negative = unique.filter(c => c.sentiment < 0.35).length
    const total = unique.length || 1

    return {
      positive: { count: positive, percentage: Math.round((positive / total) * 100) },
      neutral: { count: neutral, percentage: Math.round((neutral / total) * 100) },
      negative: { count: negative, percentage: Math.round((negative / total) * 100) },
      total: unique.length,
    }
  }, [activeConversations, conversationSessions])

  const maxCount = Math.max(sentimentData.positive.count, sentimentData.neutral.count, sentimentData.negative.count, 1)

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Heart className="h-4 w-4 text-ae-gold-500" />
          {t('sentimentOverview')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Horizontal Bar Chart */}
        <div className="space-y-3">
          {/* Positive */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-uae-green-600" />
                <span className="text-xs font-medium text-uae-green-700">{t('sentimentPositive')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-foreground">{sentimentData.positive.count}</span>
                <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-uae-green-300 text-uae-green-700">
                  {sentimentData.positive.percentage}%
                </Badge>
              </div>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-uae-green-400 to-uae-green-500"
                initial={{ width: 0 }}
                animate={{ width: `${(sentimentData.positive.count / maxCount) * 100}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
          </div>

          {/* Neutral */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5 text-amber-600" />
                <span className="text-xs font-medium text-amber-700">{t('sentimentNeutral')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-foreground">{sentimentData.neutral.count}</span>
                <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-amber-300 text-amber-700">
                  {sentimentData.neutral.percentage}%
                </Badge>
              </div>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500"
                initial={{ width: 0 }}
                animate={{ width: `${(sentimentData.neutral.count / maxCount) * 100}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
          </div>

          {/* Negative */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <XCircle className="h-3.5 w-3.5 text-uae-red-600" />
                <span className="text-xs font-medium text-uae-red-700">{t('sentimentNegative')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-foreground">{sentimentData.negative.count}</span>
                <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-uae-red-300 text-uae-red-700">
                  {sentimentData.negative.percentage}%
                </Badge>
              </div>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-uae-red-400 to-uae-red-500"
                initial={{ width: 0 }}
                animate={{ width: `${(sentimentData.negative.count / maxCount) * 100}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="pt-2 border-t border-border">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{t('totalAnalyzed')}: {sentimentData.total}</span>
            <span>
              {sentimentData.positive.percentage >= sentimentData.neutral.percentage && sentimentData.positive.percentage >= sentimentData.negative.percentage
                ? t('overallPositive')
                : sentimentData.negative.percentage > sentimentData.neutral.percentage
                  ? t('overallNegative')
                  : t('overallNeutral')}
            </span>
          </div>
        </div>

        {sentimentData.total === 0 && (
          <div className="py-4 text-center">
            <Heart className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">{t('noSentimentData')}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Main Agent Dashboard ────────────────────────────────────────────────────

// ─── Service Health Widget ────────────────────────────────────────────────────

interface ServiceInfo {
  id: string
  name: string
  port: number
  icon: string
  description: string
  alive: boolean
  status: string
  responseTime?: number
  error?: string | null
}

function ServiceHealthWidget() {
  const { t } = useTranslation()
  const [services, setServices] = useState<ServiceInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState<Record<string, boolean>>({})

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/service-manager')
      const data = await res.json()
      setServices(data.services || [])
    } catch {
      setServices([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 15000) // Poll every 15s
    return () => clearInterval(interval)
  }, [fetchStatus])

  const startService = useCallback(async (serviceId: string) => {
    setStarting(prev => ({ ...prev, [serviceId]: true }))
    try {
      await fetch('/api/service-manager', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service: serviceId }),
      })
      // Wait for the service to initialize
      await new Promise(r => setTimeout(r, 4000))
      await fetchStatus()
    } catch {
      // ignore
    } finally {
      setStarting(prev => ({ ...prev, [serviceId]: false }))
    }
  }, [fetchStatus])

  const startAll = useCallback(async () => {
    try {
      await fetch('/api/service-manager', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start-all' }),
      })
      await new Promise(r => setTimeout(r, 6000))
      await fetchStatus()
    } catch {
      // ignore
    }
  }, [fetchStatus])

  const anyDown = services.some(s => !s.alive && s.id !== 'nextjs')
  const allUp = services.filter(s => s.id !== 'nextjs').every(s => s.alive)

  if (loading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Server className="h-4 w-4 text-ae-gold-500" />
            Services
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Server className="h-4 w-4 text-ae-gold-500" />
            Services
            {allUp ? (
              <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-emerald-300 text-emerald-700 bg-emerald-50">
                All Running
              </Badge>
            ) : anyDown ? (
              <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-red-300 text-red-700 bg-red-50">
                {services.filter(s => !s.alive && s.id !== 'nextjs').length} Down
              </Badge>
            ) : null}
          </CardTitle>
          {anyDown && (
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-[9px] px-2 gap-1"
              onClick={startAll}
            >
              <Play className="h-3 w-3" /> Start All
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-[9px] px-2 gap-1"
            onClick={fetchStatus}
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {services.map((service) => {
          const isStarting = starting[service.id]
          const isSelf = service.id === 'nextjs'
          return (
            <div
              key={service.id}
              className={`flex items-center gap-2 p-2 rounded-lg border transition-colors ${
                service.alive
                  ? 'border-emerald-200 bg-emerald-50/30'
                  : isSelf
                  ? 'border-amber-200 bg-amber-50/30'
                  : 'border-red-200 bg-red-50/30'
              }`}
            >
              <span className="text-base shrink-0">{service.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-medium text-foreground truncate">{service.name}</span>
                  <span className="text-[9px] text-muted-foreground shrink-0">:{service.port}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                    service.alive ? 'bg-emerald-500' : isSelf ? 'bg-amber-500' : 'bg-red-500'
                  }`} />
                  <span className={`text-[9px] truncate ${
                    service.alive ? 'text-emerald-700' : isSelf ? 'text-amber-700' : 'text-red-700'
                  }`}>
                    {isStarting ? 'Starting...' : service.alive ? service.status : isSelf ? 'Self' : (service.error || 'Offline')}
                  </span>
                  {service.responseTime && (
                    <span className="text-[9px] text-muted-foreground shrink-0">{service.responseTime}ms</span>
                  )}
                </div>
              </div>
              {!service.alive && !isSelf && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-[9px] px-2 gap-1 shrink-0"
                  onClick={() => startService(service.id)}
                  disabled={isStarting}
                >
                  {isStarting ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Play className="h-3 w-3" />
                  )}
                  {isStarting ? 'Starting' : 'Start'}
                </Button>
              )}
              {service.alive && !isSelf && (
                <Wifi className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              )}
              {isSelf && (
                <Badge variant="outline" className="text-[8px] h-4 px-1 shrink-0">This Server</Badge>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

export default function AgentDashboard() {
  const { t } = useTranslation()
  const { activeConversations, conversationSessions, setView, currentAgent, language } = useAppStore()
  const [showAiInsights, setShowAiInsights] = useState(false)
  const [channelSettingsOpen, setChannelSettingsOpen] = useState(false)

  // Realtime polling
  useRealtime()

  // Notifications state
  const [notifications, setNotifications] = useState<AgentNotification[]>([
    { id: 'n1', type: 'new_conversation', message: 'New WhatsApp conversation assigned to you', time: new Date(Date.now() - 60000), read: false },
    { id: 'n2', type: 'sentiment_alert', message: 'Customer sentiment dropping — possible frustration detected', time: new Date(Date.now() - 180000), read: false },
    { id: 'n3', type: 'case_status', message: 'Case MOEI-K28F-CYM6-H9Q8 status changed to In Progress', time: new Date(Date.now() - 360000), read: true },
    { id: 'n4', type: 'escalation_request', message: 'Agent Ahmed requested escalation on case MOEI-9M25-UXZH-FGPC', time: new Date(Date.now() - 600000), read: false },
  ])

  // Simulate new notifications
  useEffect(() => {
    const interval = setInterval(() => {
      const types: AgentNotification['type'][] = ['new_conversation', 'sentiment_alert', 'case_status', 'escalation_request']
      const messages = [
        'New Voice call waiting in queue',
        'Customer frustration detected in active chat',
        'Case MOEI-K7RM-P2H9-N4WX resolved',
        'Agent Sara requested escalation',
      ]
      const idx = Math.floor(Math.random() * types.length)
      setNotifications(prev => [{
        id: `n-${Date.now()}`,
        type: types[idx],
        message: messages[idx],
        time: new Date(),
        read: false,
      }, ...prev].slice(0, 20))
    }, 45000)
    return () => clearInterval(interval)
  }, [])

  const markNotificationRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }, [])

  const markAllNotificationsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }, [])

  return (
    <div className="flex h-full flex-col">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-1.5 border-b border-ae-black-100 bg-white">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-foreground">{t('agentDashboard')}</h2>
          <span className="flex items-center gap-1 text-[11px] text-ae-black-400">
            <span className="h-1.5 w-1.5 rounded-full bg-uae-green-500" />
            {activeConversations.length} {t('activeConversations')}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <ChannelSettingsDialog open={channelSettingsOpen} onOpenChange={setChannelSettingsOpen} />
          <NotificationBell notifications={notifications} onMarkRead={markNotificationRead} onMarkAllRead={markAllNotificationsRead} />
        </div>
      </div>

      {/* Agent Performance Bar */}
      <AgentPerformanceBar />

      {/* AI Insights Toggle Bar */}
      <div className="border-b border-border bg-background/50">
        <button
          onClick={() => setShowAiInsights(!showAiInsights)}
          className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-muted/30 transition-colors"
        >
          <Badge variant="outline" className="gap-1 shrink-0 text-[9px] border-ae-gold-300 text-ae-gold-700 bg-ae-gold-50 dark:bg-ae-black-800/30 dark:text-ae-gold-400 dark:border-ae-gold-700">
            <Sparkles className="w-2.5 h-2.5" />
            AI
          </Badge>
          <span className="text-[11px] text-muted-foreground">
            {showAiInsights ? t('hideAiInsights') : t('showAiInsights')}
          </span>
          {showAiInsights ? (
            <ChevronUp className="h-3 w-3 text-muted-foreground ml-auto" />
          ) : (
            <ChevronDown className="h-3 w-3 text-muted-foreground ml-auto" />
          )}
        </button>
        <AnimatePresence>
          {showAiInsights && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden px-2 pb-2"
            >
              <AgentInsightsBar />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Scrollable Dashboard Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="p-4 space-y-4 max-w-[1400px] mx-auto">
          {/* KPI Stats Row */}
          <KPIStatsRow />

          {/* Middle Row: Channel Distribution + AI Performance + Sentiment Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ChannelDistributionCard />
            <AIPerformanceCard />
            <SentimentOverviewCard />
          </div>

          {/* Bottom Row: Recent Activity + Quick Actions + Service Health */}
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div className="md:col-span-2">
              <RecentActivityCard />
            </div>
            <div className="md:col-span-2">
              <QuickActionsCard />
            </div>
            <div className="md:col-span-2">
              <ServiceHealthWidget />
            </div>
          </div>

          {/* AI Insights Panel (always visible at bottom) */}
          <AIInsightsPanel />
        </div>
      </div>
    </div>
  )
}
