'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  MessageCircle,
  Phone,
  Globe,
  Mail,
  Search,
  Bot,
  Clock,
  Filter,
  Users,
  Languages,
  Wifi,
  Volume2,
  Eye,
} from 'lucide-react'
import { useAppStore, type ConversationSession } from '@/store/app-store'
import { type AiMode, getAiModeShortLabel, getAiModeBadgeColor, getAiModeLabel, AI_MODE_ORDER, AI_MODE_I18N } from '@/components/agent/ai-mode-config'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { logEmployerAction } from '@/lib/employer-action-logger'
import { motion, AnimatePresence } from 'framer-motion'

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getChannelIcon(channel: string) {
  switch (channel) {
    case 'whatsapp': return MessageCircle
    case 'voice': return Phone
    case 'web': return Globe
    case 'email': return Mail
    default: return MessageCircle
  }
}

function getChannelColor(channel: string): string {
  switch (channel) {
    case 'whatsapp': return 'bg-green-100 text-green-600'
    case 'voice': return 'bg-teal-100 text-teal-600'
    case 'web': return 'bg-amber-100 text-amber-600'
    case 'email': return 'bg-orange-100 text-orange-600'
    default: return 'bg-ae-black-100 text-ae-black-400'
  }
}

// AI mode labels and colors are now centralized in ai-mode-config.ts

function getSentimentIndicator(sentiment: number): { color: string; emoji: string } {
  if (sentiment >= 0.65) return { color: 'bg-green-500', emoji: '😊' }
  if (sentiment >= 0.35) return { color: 'bg-yellow-400', emoji: '😐' }
  return { color: 'bg-red-500', emoji: '😠' }
}

function getLanguageFlag(lang: string): string {
  switch (lang) {
    case 'ar': return '🇦🇪'
    case 'en': return '🇬🇧'
    case 'fr': return '🇫🇷'
    case 'ur': return '🇵🇰'
    case 'hi': return '🇮🇳'
    default: return '🌐'
  }
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function getStatusBadge(status: string, isAr: boolean) {
  const labels: Record<string, { en: string; ar: string; className: string }> = {
    active: { en: 'Active', ar: 'نشط', className: 'bg-green-100 text-green-700' },
    waiting: { en: 'Waiting', ar: 'في الانتظار', className: 'bg-yellow-100 text-yellow-700' },
    transferred: { en: 'Transferred', ar: 'تم النقل', className: 'bg-orange-100 text-orange-700' },
    closed: { en: 'Ended', ar: 'منتهية', className: 'bg-gray-100 text-gray-600' },
    resolved: { en: 'Resolved', ar: 'تم الحل', className: 'bg-teal-100 text-teal-700' },
  }
  const info = labels[status] || labels.active
  return { label: isAr ? info.ar : info.en, className: info.className }
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function ConversationPanel() {
  const {
    conversationSessions,
    selectedSessionId,
    setSelectedSessionId,
    setConversationSessions,
    markSessionRead,
    language,
    currentAgent,
  } = useAppStore()

  const isAr = language === 'ar'
  const [search, setSearch] = useState('')
  const [channelFilter, setChannelFilter] = useState<string>('all')
  const [aiModeFilter, setAiModeFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [unreadFilter, setUnreadFilter] = useState<boolean>(false)

  // Fetch conversation sessions
  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const res = await fetch('/api/conversations?XTransformPort=3002')
        if (res.ok) {
          const data = await res.json()
          const sessions: ConversationSession[] = (data.conversations || data || []).map((s: Record<string, unknown>) => {
            const customer = s.customer as Record<string, unknown> | undefined
            const hasRecording = (s.hasRecording as boolean) || false
            const recordingDuration = (s.recordingDuration as number) || 0
            const channel = (s.channel as ConversationSession['channel']) || 'web'
            const status = (s.status as ConversationSession['status']) || 'active'
            // Calculate duration: prefer recordingDuration for voice+recording, then elapsed seconds
            let duration: number
            if (s.duration) {
              duration = s.duration as number
            } else if (channel === 'voice' && hasRecording && recordingDuration > 0) {
              duration = Math.round(recordingDuration)
            } else {
              const created = new Date(s.createdAt as string || Date.now())
              const endTs = (status === 'closed' || status === 'resolved') && s.updatedAt
                ? new Date(s.updatedAt as string)
                : new Date()
              duration = Math.max(0, Math.floor((endTs.getTime() - created.getTime()) / 1000))
            }
            return {
              id: s.id as string,
              customerName: (s.customerName as string) || (customer?.nameEn as string) || (customer?.nameAr as string) || 'Unknown',
              channel,
              language: (s.language as string) || (customer?.preferredLang as string) || 'en',
              aiMode: (s.aiMode as AiMode) || 'full_ai',
              sentiment: (s.sentiment as number) || (customer?.sentiment as number) || 0.5,
              duration,
              status,
              customerId: (s.customerId as string) || (customer?.id as string),
              hasRecording,
              recordingDuration,
              unreadCount: (s.unreadCount as number) || 0,
            }
          })
          setConversationSessions(sessions)
        }
      } catch {
        // Silently fail
      }
    }
    fetchSessions()
    const interval = setInterval(fetchSessions, 10000)
    return () => clearInterval(interval)
  }, [setConversationSessions])

  // Real-time updates via polling (Socket.IO removed — no fake data service)
  // The fetchSessions interval above handles periodic data refresh from the real DB


  // Filter sessions
  const filteredSessions = useMemo(() => {
    let result = conversationSessions

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter((s) => s.customerName.toLowerCase().includes(q))
    }
    if (channelFilter !== 'all') {
      result = result.filter((s) => s.channel === channelFilter)
    }
    if (aiModeFilter !== 'all') {
      result = result.filter((s) => s.aiMode === aiModeFilter)
    }
    if (statusFilter !== 'all') {
      result = result.filter((s) => s.status === statusFilter)
    }
    if (unreadFilter) {
      result = result.filter((s) => (s.unreadCount || 0) > 0)
    }

    return result
  }, [conversationSessions, search, channelFilter, aiModeFilter, statusFilter, unreadFilter])

  const activeCount = conversationSessions.filter((s) => s.status === 'active').length
  const unreadTotal = conversationSessions.reduce((sum, s) => sum + (s.unreadCount || 0), 0)

  return (
    <div className="flex flex-col h-full min-h-0 bg-white border border-ae-black-100 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-4 pt-4 pb-3 border-b border-ae-black-100 bg-ae-gold-50/30">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-ae-gold-100 flex items-center justify-center">
              <Users className="w-4 h-4 text-ae-gold-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-ae-black-800">
                {isAr ? 'المحادثات النشطة' : 'Active Conversations'}
              </h3>
              <p className="text-[10px] text-ae-black-400">
                {activeCount} {isAr ? 'نشطة' : 'active'}
              </p>
            </div>
          </div>
          <Badge className="bg-ae-gold-100 text-ae-gold-700 border-ae-gold-200 text-[10px]">
            {filteredSessions.length}
          </Badge>
        </div>

        {/* Search */}
        <div className="relative mb-2">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ae-black-300" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isAr ? 'بحث عن عميل...' : 'Search customers...'}
            className="ps-8 h-8 text-xs bg-white border-ae-black-100"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <Select value={channelFilter} onValueChange={setChannelFilter}>
            <SelectTrigger className="h-7 text-[10px] w-auto min-w-[80px] bg-white border-ae-black-100">
              <Filter className="w-3 h-3 me-1 text-ae-black-300" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isAr ? 'جميع القنوات' : 'All Channels'}</SelectItem>
              <SelectItem value="web">Web</SelectItem>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
              <SelectItem value="voice">{isAr ? 'صوت' : 'Voice'}</SelectItem>
              <SelectItem value="email">Email</SelectItem>
            </SelectContent>
          </Select>

          <Select value={aiModeFilter} onValueChange={setAiModeFilter}>
            <SelectTrigger className="h-7 text-[10px] w-auto min-w-[80px] bg-white border-ae-black-100">
              <Bot className="w-3 h-3 me-1 text-ae-black-300" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isAr ? AI_MODE_I18N.allModes.ar : AI_MODE_I18N.allModes.en}</SelectItem>
              {AI_MODE_ORDER.map((modeId) => (
                <SelectItem key={modeId} value={modeId}>
                  {getAiModeLabel(modeId, isAr)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-7 text-[10px] w-auto min-w-[80px] bg-white border-ae-black-100">
              <Wifi className="w-3 h-3 me-1 text-ae-black-300" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isAr ? 'جميع الحالات' : 'All Status'}</SelectItem>
              <SelectItem value="active">{isAr ? 'نشط' : 'Active'}</SelectItem>
              <SelectItem value="waiting">{isAr ? 'في الانتظار' : 'Waiting'}</SelectItem>
              <SelectItem value="transferred">{isAr ? 'تم النقل' : 'Transferred'}</SelectItem>
              <SelectItem value="closed">{isAr ? 'منتهية' : 'Ended'}</SelectItem>
              <SelectItem value="resolved">{isAr ? 'تم الحل' : 'Resolved'}</SelectItem>
            </SelectContent>
          </Select>

          {/* Unread Filter Toggle */}
          <Button
            variant={unreadFilter ? 'default' : 'outline'}
            size="sm"
            className={`h-7 text-[10px] gap-1 px-2 ${
              unreadFilter
                ? 'bg-ae-gold-500 hover:bg-ae-gold-600 text-white border-ae-gold-500'
                : 'bg-white border-ae-black-100 text-ae-black-500 hover:bg-ae-gold-50 hover:border-ae-gold-200 hover:text-ae-gold-600'
            }`}
            onClick={() => setUnreadFilter(!unreadFilter)}
          >
            <Eye className="w-3 h-3" />
            {isAr ? 'غير مقروء' : 'Unread'}
            {unreadTotal > 0 && (
              <span className={`ml-0.5 text-[8px] font-bold ${unreadFilter ? 'text-white' : 'text-ae-gold-600'}`}>
                {unreadTotal}
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Session List — scrollable within flex container */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-2 space-y-1">
          {filteredSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-ae-black-300">
              <MessageCircle className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-xs">{isAr ? 'لا توجد محادثات' : 'No conversations found'}</p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {filteredSessions.map((session) => {
                const isSelected = selectedSessionId === session.id
                const ChannelIcon = getChannelIcon(session.channel)
                const sentimentInfo = getSentimentIndicator(session.sentiment)
                const statusBadge = getStatusBadge(session.status, isAr)
                const initials = session.customerName.split(' ').map((n) => n[0]).join('').slice(0, 2)

                return (
                  <motion.button
                    key={session.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    onClick={() => {
                      setSelectedSessionId(session.id)
                      if (session.unreadCount && session.unreadCount > 0) {
                        markSessionRead(session.id)
                        // Also persist read state to backend
                        fetch(`/api/conversations/${session.id}/read?XTransformPort=3002`, {
                          method: 'PUT',
                        }).catch(() => {})
                      }
                      // Log view conversation action
                      logEmployerAction({
                        action: 'view_conversation',
                        details: { sessionId: session.id, channel: session.channel, customerName: session.customerName },
                        channel: session.channel as 'web' | 'whatsapp' | 'voice' | 'email',
                        targetId: session.id,
                      })
                    }}
                    className={`w-full text-start rounded-lg transition-all duration-150 border cursor-pointer p-2.5 ${
                      isSelected
                        ? 'bg-ae-gold-50 border-ae-gold-300 shadow-sm'
                        : (session.unreadCount || 0) > 0
                        ? 'bg-ae-gold-50/50 border-ae-gold-100 hover:bg-ae-gold-50/80 hover:border-ae-gold-200'
                        : 'bg-white border-transparent hover:bg-ae-black-50/50 hover:border-ae-black-100'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      {/* Avatar */}
                      <div className="relative shrink-0">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="bg-ae-gold-100 text-ae-gold-700 text-[11px] font-semibold">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white ${sentimentInfo.color}`} />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        {/* Name + Channel */}
                        <div className="flex items-center gap-1.5">
                          {/* NEW badge for unread */}
                          {(session.unreadCount || 0) > 0 && (
                            <Badge className="text-[7px] px-1 py-0 h-3.5 leading-none bg-ae-gold-500 text-white border-0 shrink-0 animate-pulse">
                              {isAr ? 'جديد' : 'NEW'}
                            </Badge>
                          )}
                          <span className={`text-[13px] truncate ${session.unreadCount && session.unreadCount > 0 ? 'font-bold text-ae-black-900' : 'font-medium text-ae-black-800'}`}>
                            {session.customerName}
                          </span>
                          <div className={`shrink-0 w-5 h-5 rounded flex items-center justify-center ${getChannelColor(session.channel)}`}>
                            <ChannelIcon className="w-3 h-3" />
                          </div>
                          {/* Recording indicator for voice calls */}
                          {session.channel === 'voice' && session.hasRecording && (
                            <div className="shrink-0 w-4 h-4 rounded-full bg-teal-500 flex items-center justify-center" title={isAr ? 'تسجيل متاح' : 'Recording available'}>
                              <Volume2 className="w-2.5 h-2.5 text-white" />
                            </div>
                          )}
                        </div>

                        {/* Meta line */}
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          {/* AI Mode Badge */}
                          <Badge
                            variant="outline"
                            className={`text-[8px] px-1.5 py-0 h-4 leading-none ${getAiModeBadgeColor(session.aiMode)}`}
                          >
                            {getAiModeShortLabel(session.aiMode, isAr)}
                          </Badge>

                          {/* Language Flag */}
                          <span className="text-[10px]" title={session.language}>
                            {getLanguageFlag(session.language)}
                          </span>

                          {/* Duration */}
                          <span className="flex items-center gap-0.5 text-[10px] text-ae-black-400">
                            <Clock className="w-2.5 h-2.5" />
                            {formatDuration(session.duration)}
                          </span>

                          {/* Status */}
                          <Badge className={`text-[8px] px-1 py-0 h-4 leading-none ${statusBadge.className}`}>
                            {statusBadge.label}
                          </Badge>
                        </div>
                      </div>

                      {/* Unread indicator - gold dot + count badge */}
                      {(session.unreadCount || 0) > 0 && (
                        <div className="shrink-0 flex flex-col items-center gap-0.5">
                          <span className="h-2 w-2 rounded-full bg-ae-gold-500 animate-pulse" />
                          <span className="flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-ae-gold-500 text-[8px] font-bold text-white">
                            {session.unreadCount}
                          </span>
                        </div>
                      )}

                      {/* Sentiment */}
                      <div className="shrink-0 text-sm" title={`${isAr ? AI_MODE_I18N.sentiment.ar : AI_MODE_I18N.sentiment.en}: ${(session.sentiment * 100).toFixed(0)}%`}>
                        {sentimentInfo.emoji}
                      </div>
                    </div>
                  </motion.button>
                )
              })}
            </AnimatePresence>
          )}
        </div>
      </ScrollArea>

      {/* Footer stats */}
      <div className="shrink-0 px-4 py-2 border-t border-ae-black-100 bg-ae-black-50/30 flex items-center justify-between text-[10px] text-ae-black-400">
        <span>{conversationSessions.length} {isAr ? AI_MODE_I18N.totalConversations.ar : AI_MODE_I18N.totalConversations.en}</span>
        <span className="flex items-center gap-1">
          <Bot className="w-3 h-3" />
          {conversationSessions.filter((s) => s.aiMode !== 'ai_disabled' && s.aiMode !== 'human_only').length} {isAr ? AI_MODE_I18N.aiLabel.ar : AI_MODE_I18N.aiLabel.en}
        </span>
      </div>
    </div>
  )
}
