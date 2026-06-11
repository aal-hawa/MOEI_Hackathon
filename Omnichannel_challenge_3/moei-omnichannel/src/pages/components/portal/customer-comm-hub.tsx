'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageCircle,
  Mail,
  Phone,
  Send,
  Bot,
  User,
  Check,
  CheckCheck,
  Loader2,
  PhoneCall,
  PhoneOff,
  Mic,
  MicOff,
  FileText,
  Clock,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Plus,
  Activity,
  Hand,
  Radio,
  Settings2,
  Volume2,
  VolumeX,
  Speaker,
  Brain,
  MessageSquare,
  Shield,
  Eye,
  Zap,
  Heart,
  FolderOpen,
  Globe,
  Lock,
} from 'lucide-react'
import { useTranslation } from '@/i18n'
import { useAppStore, type ActiveCall } from '@/store/app-store'
import { useAuthStore } from '@/components/shared/lib/auth-store'
import { VoiceAgentProvider, useVoiceAgentContext, type VoiceAgentState } from '@/components/voice/voice-agent-provider'
import { WelcomeView } from '@/components/voice/welcome-view'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'

// ─── Types ──────────────────────────────────────────────────────────────────────

interface WhatsAppMsg {
  id: string
  role: 'customer' | 'ai'
  content: string
  timestamp: Date
  status: 'sending' | 'sent' | 'delivered' | 'read'
  intent?: string
  sentiment?: number
  showCreateCase?: boolean
  caseRef?: string
  relatedCases?: string[]
}

interface EmailItem {
  id: string
  from: string
  fromName: string
  to: string
  subject: string
  body: string
  status: 'sending' | 'sent' | 'failed'
  timestamp: Date
  aiReply?: string
  aiReplyTimestamp?: Date
}

interface AIBrainContext {
  customerName: string
  activeCases: number
  sentiment: number
  preferredChannel: string
  detectedIntent?: string
  relatedCases: string[]
  language: string
}

// ─── Animation variants ─────────────────────────────────────────────────────────

const tabContentVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.2 } },
}

const messageVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 8 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' as const } },
}

const pulseVariants = {
  pulse: {
    scale: [1, 1.15, 1],
    opacity: [0.7, 1, 0.7],
    transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' as const },
  },
}

// ─── Helper: Get user display name from UAE PASS ────────────────────────────────

function getUserDisplayName(
  userProfile: { fullnameEN: string; fullnameAR: string } | null,
  language: 'en' | 'ar',
  fallback?: string
): string {
  if (!userProfile) return fallback || ''
  return language === 'ar' && userProfile.fullnameAR ? userProfile.fullnameAR : userProfile.fullnameEN
}

function getUserEmail(
  userProfile: { email: string } | null,
  fallback?: string
): string {
  return userProfile?.email || fallback || ''
}

function getUserPhone(
  userProfile: { mobile: string } | null,
  fallback?: string
): string {
  return userProfile?.mobile || fallback || ''
}

function getSentimentLabel(sentiment: number, isRTL: boolean): { label: string; color: string; icon: string } {
  if (sentiment >= 0.6) return { label: isRTL ? 'إيجابي' : 'Positive', color: 'text-emerald-600 bg-emerald-50 border-emerald-200', icon: '😊' }
  if (sentiment >= 0.3) return { label: isRTL ? 'محايد' : 'Neutral', color: 'text-amber-600 bg-amber-50 border-amber-200', icon: '😐' }
  return { label: isRTL ? 'سلبي' : 'Negative', color: 'text-red-600 bg-red-50 border-red-200', icon: '😟' }
}

// ─── AI Brain Context Bar ───────────────────────────────────────────────────────

function AIBrainContextBar({ brainContext }: { brainContext: AIBrainContext }) {
  const { t, isRTL } = useTranslation()
  const sentimentInfo = getSentimentLabel(brainContext.sentiment, isRTL)

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white px-4 py-2.5 rounded-xl flex items-center gap-3 overflow-x-auto"
    >
      {/* Brain icon with pulse */}
      <div className="relative flex-shrink-0">
        <motion.div
          variants={pulseVariants}
          animate="pulse"
          className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center"
        >
          <Brain className="w-4.5 h-4.5 text-violet-400" />
        </motion.div>
        <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-slate-900 animate-pulse" />
      </div>

      {/* Customer name */}
      <div className="flex-shrink-0">
        <p className="text-[10px] text-slate-400 uppercase tracking-wider">{isRTL ? 'العميل' : 'Customer'}</p>
        <p className="text-xs font-semibold truncate max-w-[120px]">{brainContext.customerName || (isRTL ? 'غير معروف' : 'Unknown')}</p>
      </div>

      <Separator orientation="vertical" className="h-8 bg-slate-700" />

      {/* Active cases */}
      <div className="flex-shrink-0 flex items-center gap-1.5">
        <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
        <div>
          <p className="text-[10px] text-slate-400">{isRTL ? 'حالات نشطة' : 'Active Cases'}</p>
          <p className="text-xs font-bold">{brainContext.activeCases}</p>
        </div>
      </div>

      <Separator orientation="vertical" className="h-8 bg-slate-700" />

      {/* Sentiment */}
      <div className="flex-shrink-0 flex items-center gap-1.5">
        <span className="text-sm">{sentimentInfo.icon}</span>
        <div>
          <p className="text-[10px] text-slate-400">{isRTL ? 'المزاج' : 'Sentiment'}</p>
          <p className="text-xs font-semibold">{sentimentInfo.label}</p>
        </div>
      </div>

      <Separator orientation="vertical" className="h-8 bg-slate-700" />

      {/* Preferred channel */}
      <div className="flex-shrink-0 flex items-center gap-1.5">
        <Globe className="w-3.5 h-3.5 text-sky-400" />
        <div>
          <p className="text-[10px] text-slate-400">{isRTL ? 'القناة المفضلة' : 'Preferred'}</p>
          <p className="text-xs font-semibold capitalize">{brainContext.preferredChannel || 'WhatsApp'}</p>
        </div>
      </div>

      {brainContext.detectedIntent && (
        <>
          <Separator orientation="vertical" className="h-8 bg-slate-700" />
          <div className="flex-shrink-0 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-yellow-400" />
            <div>
              <p className="text-[10px] text-slate-400">{isRTL ? 'النية المكتشفة' : 'Detected Intent'}</p>
              <p className="text-xs font-semibold capitalize">{brainContext.detectedIntent}</p>
            </div>
          </div>
        </>
      )}

      {/* AI Brain knows indicator */}
      <div className="flex-1" />
      <Badge className="bg-violet-500/20 text-violet-300 border-violet-500/30 text-[10px] hover:bg-violet-500/20 flex-shrink-0">
        <Eye className="w-3 h-3 mr-1" />
        {isRTL ? 'الذكاء يدرك السياق' : 'AI Brain Aware'}
      </Badge>
    </motion.div>
  )
}

// ─── Auth Required Overlay ──────────────────────────────────────────────────────

function AuthRequiredOverlay() {
  const { t, isRTL } = useTranslation()

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center rounded-xl"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.3 }}
        className="text-center p-8 max-w-sm"
      >
        <div className="w-16 h-16 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center mx-auto mb-4">
          <Lock className="w-8 h-8 text-violet-600 dark:text-violet-400" />
        </div>
        <h3 className="text-lg font-semibold mb-2">
          {isRTL ? 'تسجيل الدخول مطلوب' : 'Login Required'}
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          {isRTL
            ? 'سجّل الدخول بهوية الإمارات للوصول إلى مركز التواصل'
            : 'Login with UAE PASS to access Communication Hub'}
        </p>
        <Badge className="bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-700 text-xs px-3 py-1.5">
          <Shield className="w-3.5 h-3.5 mr-1.5" />
          {isRTL ? 'هوية الإمارات' : 'UAE PASS'}
        </Badge>
      </motion.div>
    </motion.div>
  )
}

// ─── WhatsApp Chat Tab ──────────────────────────────────────────────────────────

function WhatsAppTab({ brainContext, onContextUpdate }: { brainContext: AIBrainContext; onContextUpdate: (updates: Partial<AIBrainContext>) => void }) {
  const { t, isRTL, language } = useTranslation()
  const { customerContext, chatSessionId } = useAppStore()
  const { userProfile } = useAuthStore()
  const customerName = getUserDisplayName(userProfile, language, customerContext?.name)

  const [messages, setMessages] = useState<WhatsAppMsg[]>([
    {
      id: 'wa-welcome',
      role: 'ai',
      content: language === 'ar'
        ? `مرحباً ${customerName}! أنا مساعد الوزارة الذكي. كيف يمكنني مساعدتك اليوم؟`
        : `Hello ${customerName}! I'm the Ministry's AI assistant. How can I help you today?`,
      timestamp: new Date(),
      status: 'read',
    },
  ])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [creatingCase, setCreatingCase] = useState<string | null>(null)
  const [showContextPanel, setShowContextPanel] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isTyping])

  const sendMessage = useCallback(async (text?: string) => {
    const trimmed = (text || input).trim()
    if (!trimmed || isTyping) return

    const userMsg: WhatsAppMsg = {
      id: `wa-user-${Date.now()}`,
      role: 'customer',
      content: trimmed,
      timestamp: new Date(),
      status: 'sending',
    }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setIsTyping(true)

    // Simulate delivery
    setTimeout(() => {
      setMessages((prev) =>
        prev.map((m) => m.id === userMsg.id ? { ...m, status: 'delivered' as const } : m)
      )
    }, 600)
    setTimeout(() => {
      setMessages((prev) =>
        prev.map((m) => m.id === userMsg.id ? { ...m, status: 'read' as const } : m)
      )
    }, 1200)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          sessionId: chatSessionId,
          language,
          customerId: customerContext?.id || userProfile?.sub,
          channel: 'whatsapp',
          customerName,
          customerEmail: userProfile?.email,
          customerPhone: userProfile?.mobile,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        const aiMsg: WhatsAppMsg = {
          id: `wa-ai-${Date.now()}`,
          role: 'ai',
          content: data.response,
          timestamp: new Date(),
          status: 'read',
          intent: data.intent,
          sentiment: data.sentiment,
          showCreateCase: data.intent === 'complaint',
          relatedCases: data.relatedCases,
        }
        setMessages((prev) => [...prev, aiMsg])

        // Update AI Brain context
        if (data.intent || data.sentiment !== undefined) {
          onContextUpdate({
            detectedIntent: data.intent,
            sentiment: data.sentiment ?? brainContext.sentiment,
            relatedCases: data.relatedCases ?? brainContext.relatedCases,
          })
        }
      } else {
        const aiMsg: WhatsAppMsg = {
          id: `wa-ai-err-${Date.now()}`,
          role: 'ai',
          content: t('errorOccurred'),
          timestamp: new Date(),
          status: 'read',
        }
        setMessages((prev) => [...prev, aiMsg])
      }
    } catch {
      const aiMsg: WhatsAppMsg = {
        id: `wa-ai-err-${Date.now()}`,
        role: 'ai',
        content: t('cannotConnect'),
        timestamp: new Date(),
        status: 'read',
      }
      setMessages((prev) => [...prev, aiMsg])
    } finally {
      setIsTyping(false)
    }
  }, [input, isTyping, chatSessionId, language, customerContext, userProfile, customerName, t, brainContext, onContextUpdate])

  const handleCreateCase = useCallback(async (msgId: string) => {
    setCreatingCase(msgId)
    try {
      const userMsgs = messages.filter((m) => m.role === 'customer')
      const lastUserMsg = userMsgs[userMsgs.length - 1]
      const res = await fetch('/api/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: customerContext?.id || userProfile?.sub,
          titleEn: lastUserMsg?.content.slice(0, 100) || t('newComplaint'),
          titleAr: lastUserMsg?.content.slice(0, 100) || t('newComplaint'),
          description: lastUserMsg?.content || '',
          priority: 'medium',
          category: 'General',
          channel: 'whatsapp',
          customerName,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msgId ? { ...m, showCreateCase: false, caseRef: data.referenceNumber } : m
          )
        )
        onContextUpdate({ activeCases: brainContext.activeCases + 1 })
      }
    } catch {
      // Silent failure
    } finally {
      setCreatingCase(null)
    }
  }, [messages, customerContext, userProfile, customerName, t, brainContext, onContextUpdate])

  const quickReplies = [
    t('quickCaseStatus'),
    t('quickComplaint'),
    t('exploreServices'),
    t('quickHelp'),
  ]

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString(isRTL ? 'ar-AE' : 'en-AE', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Compute AI Brain knowledge for this channel
  const lastAiIntent = useMemo(() => {
    const aiMsgs = messages.filter((m) => m.role === 'ai' && m.intent)
    return aiMsgs.length > 0 ? aiMsgs[aiMsgs.length - 1].intent : undefined
  }, [messages])

  const createdCases = useMemo(() => {
    return messages.filter((m) => m.caseRef).map((m) => m.caseRef!)
  }, [messages])

  return (
    <div className="flex flex-col h-full" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* WhatsApp header */}
      <div className="bg-[#25D366] text-white px-4 py-3 flex items-center gap-3 rounded-t-xl flex-shrink-0">
        <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center">
          <Bot className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold">{t('whatsappChat')}</h3>
          <p className="text-[11px] text-white/80 flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-white rounded-full inline-block" />
            {t('online')} &middot; {customerName}
          </p>
        </div>
        {/* AI Brain knows indicator */}
        <Badge className="bg-white/20 text-white border-0 text-[10px] hover:bg-white/20">
          <Brain className="w-3 h-3 mr-1" />
          {isRTL ? 'الذكاء يدرك' : 'AI Aware'}
        </Badge>
        <Badge className="bg-white/20 text-white border-0 text-[10px] hover:bg-white/20">
          <Sparkles className="w-3 h-3 mr-1" />
          {t('aiAgentBadge')}
        </Badge>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/10"
          onClick={() => setShowContextPanel(!showContextPanel)}
        >
          <Eye className="w-4 h-4" />
        </Button>
      </div>

      {/* Customer Context Panel (collapsible) */}
      <AnimatePresence>
        {showContextPanel && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden bg-white dark:bg-slate-900 border-b border-[#25D366]/20"
          >
            <div className="p-3 space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <Brain className="w-4 h-4 text-violet-500" />
                <span className="text-xs font-semibold">
                  {isRTL ? 'سياق الذكاء الاصطناعي' : 'AI Brain Context'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {lastAiIntent && (
                  <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2">
                    <p className="text-[10px] text-muted-foreground">{isRTL ? 'النية المكتشفة' : 'Detected Intent'}</p>
                    <p className="text-xs font-medium capitalize">{lastAiIntent}</p>
                  </div>
                )}
                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2">
                  <p className="text-[10px] text-muted-foreground">{isRTL ? 'المزاج الحالي' : 'Current Sentiment'}</p>
                  <p className="text-xs font-medium">{getSentimentLabel(brainContext.sentiment, isRTL).icon} {getSentimentLabel(brainContext.sentiment, isRTL).label}</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2">
                  <p className="text-[10px] text-muted-foreground">{isRTL ? 'الحالات النشطة' : 'Active Cases'}</p>
                  <p className="text-xs font-medium">{brainContext.activeCases}</p>
                </div>
                {createdCases.length > 0 && (
                  <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2">
                    <p className="text-[10px] text-muted-foreground">{isRTL ? 'حالات تم إنشاؤها' : 'Cases Created'}</p>
                    <p className="text-xs font-medium">{createdCases.join(', ')}</p>
                  </div>
                )}
              </div>
              {brainContext.relatedCases && brainContext.relatedCases.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-2">
                  <p className="text-[10px] text-amber-700 dark:text-amber-400">
                    {isRTL ? 'حالات مرتبطة عبر القنوات: ' : 'Cross-channel related cases: '}
                    {brainContext.relatedCases.join(', ')}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#e5ddd5] dark:bg-[#1a1a2e] custom-scrollbar"
        style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23000000\' fill-opacity=\'0.03\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
        }}
      >
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            variants={messageVariants}
            initial="hidden"
            animate="visible"
            className={`flex ${msg.role === 'customer' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-xl px-3.5 py-2.5 shadow-sm relative ${
                msg.role === 'customer'
                  ? 'bg-[#dcf8c6] dark:bg-[#005c4b] text-base-900 dark:text-white rounded-br-sm'
                  : 'bg-white dark:bg-[#1f2c33] text-base-900 dark:text-white rounded-bl-sm'
              }`}
            >
              {msg.role === 'ai' && (
                <div className="flex items-center gap-1 mb-1">
                  <Badge className="bg-[#25D366]/10 text-[#25D366] border-[#25D366]/20 text-[9px] px-1.5 py-0 hover:bg-[#25D366]/10">
                    <Bot className="w-2.5 h-2.5 mr-0.5" />
                    {t('aiAgentBadge')}
                  </Badge>
                </div>
              )}
              <p className="text-[13px] leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
              <div className={`flex items-center gap-1 mt-1 ${msg.role === 'customer' ? 'justify-end' : 'justify-start'}`}>
                <span className="text-[10px] text-base-400 dark:text-base-500">
                  {formatTime(msg.timestamp)}
                </span>
                {msg.role === 'customer' && (
                  msg.status === 'read' ? (
                    <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />
                  ) : msg.status === 'delivered' ? (
                    <CheckCheck className="w-3.5 h-3.5 text-base-400" />
                  ) : msg.status === 'sent' ? (
                    <Check className="w-3.5 h-3.5 text-base-400" />
                  ) : (
                    <Clock className="w-3 h-3 text-base-400" />
                  )
                )}
              </div>

              {/* Create Case button for complaint intent */}
              {msg.role === 'ai' && msg.showCreateCase && !msg.caseRef && (
                <div className="mt-2 pt-2 border-t border-base-100 dark:border-base-700">
                  <Button
                    size="sm"
                    onClick={() => handleCreateCase(msg.id)}
                    disabled={creatingCase === msg.id}
                    className="bg-[#25D366] hover:bg-[#1ebe57] text-white text-xs h-7 px-3"
                  >
                    {creatingCase === msg.id ? (
                      <><Loader2 className="w-3 h-3 mr-1 animate-spin" />{t('creatingCase')}</>
                    ) : (
                      <><Plus className="w-3 h-3 mr-1" />{t('createCaseAction')}</>
                    )}
                  </Button>
                </div>
              )}
              {msg.role === 'ai' && msg.caseRef && (
                <div className="mt-1.5 flex items-center gap-1 text-[11px] text-emerald-600">
                  <CheckCircle2 className="w-3 h-3" />
                  {t('caseCreatedRef')}: {msg.caseRef}
                </div>
              )}
              {/* Cross-reference to other cases */}
              {msg.role === 'ai' && msg.relatedCases && msg.relatedCases.length > 0 && (
                <div className="mt-1.5 flex items-center gap-1 text-[11px] text-amber-600">
                  <FolderOpen className="w-3 h-3" />
                  {isRTL ? 'حالات مرتبطة: ' : 'Related cases: '}{msg.relatedCases.join(', ')}
                </div>
              )}
            </div>
          </motion.div>
        ))}

        {/* Typing indicator */}
        {isTyping && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start"
          >
            <div className="bg-white dark:bg-[#1f2c33] rounded-xl rounded-bl-sm px-4 py-3 shadow-sm">
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-base-400 mr-2">{t('aiAgentTyping')}</span>
                <span className="w-1.5 h-1.5 bg-[#25D366] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-[#25D366] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-[#25D366] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </motion.div>
        )}

        {/* Quick replies */}
        {!isTyping && messages.length <= 2 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {quickReplies.map((reply) => (
              <button
                key={reply}
                onClick={() => sendMessage(reply)}
                className="text-xs bg-white dark:bg-[#1f2c33] text-[#25D366] border border-[#25D366]/30 rounded-full px-3 py-1.5 hover:bg-[#25D366]/5 transition-colors shadow-sm"
              >
                {reply}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="bg-[#f0f0f0] dark:bg-[#1a1a2e] border-t border-[#25D366]/20 p-3 flex items-center gap-2 rounded-b-xl flex-shrink-0">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          placeholder={t('chatPlaceholder')}
          disabled={isTyping}
          className="flex-1 h-9 text-sm bg-white dark:bg-[#2a3942] border-0 rounded-full focus-visible:ring-[#25D366]/30"
        />
        <Button
          onClick={() => sendMessage()}
          disabled={!input.trim() || isTyping}
          size="icon"
          className="h-9 w-9 bg-[#25D366] hover:bg-[#1ebe57] text-white rounded-full flex-shrink-0"
        >
          {isTyping ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </Button>
      </div>
    </div>
  )
}

// ─── Email Tab ──────────────────────────────────────────────────────────────────

function EmailTab({ brainContext, onContextUpdate }: { brainContext: AIBrainContext; onContextUpdate: (updates: Partial<AIBrainContext>) => void }) {
  const { t, isRTL, language } = useTranslation()
  const { customerContext, chatSessionId } = useAppStore()
  const { userProfile } = useAuthStore()
  const customerName = getUserDisplayName(userProfile, language, customerContext?.name)
  const customerEmail = getUserEmail(userProfile, customerContext?.email)

  const [showCompose, setShowCompose] = useState(false)
  const [emailFrom, setEmailFrom] = useState(customerEmail)
  const [emailTo, setEmailTo] = useState('support@moei.gov.ae')
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [sending, setSending] = useState(false)
  const [sentEmails, setSentEmails] = useState<EmailItem[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)

  // Update emailFrom when user profile changes
  useEffect(() => {
    if (customerEmail) {
      setEmailFrom(customerEmail)
    }
  }, [customerEmail])

  const templates = [
    {
      key: 'inquiry',
      label: t('exploreServices'),
      subject: isRTL ? 'استفسار عن خدمة' : 'Service Inquiry',
      body: isRTL
        ? 'السلام عليكم،\n\nأود الاستفسار عن...'
        : 'Dear MOEI Support,\n\nI would like to inquire about...',
    },
    {
      key: 'complaint',
      label: t('quickComplaint'),
      subject: isRTL ? 'تقديم شكوى' : 'File Complaint',
      body: isRTL
        ? 'السلام عليكم،\n\nأود تقديم شكوى بخصوص...'
        : 'Dear MOEI Support,\n\nI would like to file a complaint regarding...',
    },
    {
      key: 'followup',
      label: isRTL ? 'متابعة' : 'Follow Up',
      subject: isRTL ? 'متابعة طلب' : 'Follow Up on Request',
      body: isRTL
        ? 'السلام عليكم،\n\nأود المتابعة بخصوص طلب رقم...'
        : 'Dear MOEI Support,\n\nI would like to follow up on my request ref...',
    },
  ]

  const handleTemplate = useCallback((templateKey: string) => {
    const tmpl = templates.find((tp) => tp.key === templateKey)
    if (tmpl) {
      setSelectedTemplate(templateKey)
      setEmailSubject(tmpl.subject)
      setEmailBody(tmpl.body)
    }
  }, [templates])

  const handleSendEmail = useCallback(async () => {
    if (!emailSubject.trim() || !emailBody.trim()) return
    setSending(true)

    const emailItem: EmailItem = {
      id: `email-${Date.now()}`,
      from: emailFrom,
      fromName: customerName,
      to: emailTo,
      subject: emailSubject,
      body: emailBody,
      status: 'sending',
      timestamp: new Date(),
    }
    setSentEmails((prev) => [emailItem, ...prev])

    try {
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: emailFrom,
          fromName: customerName,
          to: emailTo,
          subject: emailSubject,
          html: emailBody.replace(/\n/g, '<br/>'),
          customerId: customerContext?.id || userProfile?.sub,
          customerName,
        }),
      })

      if (res.ok) {
        setSentEmails((prev) =>
          prev.map((e) => e.id === emailItem.id ? { ...e, status: 'sent' as const } : e)
        )

        // Use AI Brain for smarter auto-replies via /api/ai/email
        setTimeout(async () => {
          try {
            const aiRes = await fetch('/api/ai/email', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                message: emailBody,
                subject: emailSubject,
                sessionId: chatSessionId,
                language,
                customerId: customerContext?.id || userProfile?.sub,
                customerEmail: emailFrom,
                customerName,
              }),
            })
            if (aiRes.ok) {
              const aiData = await aiRes.json()
              setSentEmails((prev) =>
                prev.map((e) =>
                  e.id === emailItem.id
                    ? {
                        ...e,
                        aiReply: aiData.response,
                        aiReplyTimestamp: new Date(),
                      }
                    : e
                )
              )
              // Update AI Brain context
              if (aiData.intent) {
                onContextUpdate({ detectedIntent: aiData.intent })
              }
            } else {
              // Fallback reply
              setSentEmails((prev) =>
                prev.map((e) =>
                  e.id === emailItem.id
                    ? {
                        ...e,
                        aiReply: isRTL
                          ? 'شكراً لتواصلكم مع وزارة الطاقة والبنية التحتية. تم استلام رسالتكم وسيقوم فريقنا بالرد في أقرب وقت ممكن.'
                          : 'Thank you for contacting the Ministry of Energy & Infrastructure. Your message has been received and our team will respond shortly.',
                        aiReplyTimestamp: new Date(),
                      }
                    : e
                )
              )
            }
          } catch {
            // Fallback reply
            setSentEmails((prev) =>
              prev.map((e) =>
                e.id === emailItem.id
                  ? {
                      ...e,
                      aiReply: isRTL
                        ? 'شكراً لتواصلكم مع وزارة الطاقة والبنية التحتية. تم استلام رسالتكم وسيقوم فريقنا بالرد في أقرب وقت ممكن.'
                        : 'Thank you for contacting the Ministry of Energy & Infrastructure. Your message has been received and our team will respond shortly.',
                      aiReplyTimestamp: new Date(),
                    }
                  : e
              )
            )
          }
        }, 2500)
      } else {
        setSentEmails((prev) =>
          prev.map((e) => e.id === emailItem.id ? { ...e, status: 'failed' as const } : e)
        )
      }
    } catch {
      setSentEmails((prev) =>
        prev.map((e) => e.id === emailItem.id ? { ...e, status: 'failed' as const } : e)
      )
    } finally {
      setSending(false)
      setShowCompose(false)
      setEmailSubject('')
      setEmailBody('')
      setSelectedTemplate(null)
    }
  }, [emailFrom, emailTo, emailSubject, emailBody, customerContext, userProfile, customerName, isRTL, chatSessionId, language, onContextUpdate])

  const formatDate = (date: Date) => {
    return date.toLocaleDateString(isRTL ? 'ar-AE' : 'en-AE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="flex flex-col h-full" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Email header */}
      <div className="bg-gradient-to-r from-slate-700 to-slate-600 text-white px-4 py-3 flex items-center gap-3 rounded-t-xl flex-shrink-0">
        <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center">
          <Mail className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold">{t('emailChannel')}</h3>
          <p className="text-[11px] text-white/80">
            {customerName} &middot; {emailFrom || 'support@moei.gov.ae'}
          </p>
        </div>
        {/* AI Brain knows indicator */}
        <Badge className="bg-white/20 text-white border-0 text-[10px] hover:bg-white/20">
          <Brain className="w-3 h-3 mr-1" />
          {isRTL ? 'الذكاء يدرك' : 'AI Aware'}
        </Badge>
        <Button
          size="sm"
          onClick={() => setShowCompose(!showCompose)}
          className="bg-white/20 hover:bg-white/30 text-white border-0 text-xs"
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          {t('composeEmail')}
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4 bg-slate-50 dark:bg-[#0f172a] min-h-full">
          {/* Compose form */}
          <AnimatePresence>
            {showCompose && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="border-slate-200 dark:border-slate-700 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Mail className="w-4 h-4 text-slate-600" />
                      {t('composeEmail')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    {/* Templates */}
                    <div className="flex flex-wrap gap-1.5">
                      {templates.map((tmpl) => (
                        <button
                          key={tmpl.key}
                          onClick={() => handleTemplate(tmpl.key)}
                          className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                            selectedTemplate === tmpl.key
                              ? 'bg-slate-600 text-white border-slate-600'
                              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700'
                          }`}
                        >
                          {tmpl.label}
                        </button>
                      ))}
                    </div>

                    {/* From field (pre-filled with logged-in user's email) */}
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">
                        {isRTL ? 'من' : 'From'}
                      </label>
                      <Input
                        value={emailFrom}
                        onChange={(e) => setEmailFrom(e.target.value)}
                        className="h-8 text-sm bg-slate-50 dark:bg-slate-800"
                        placeholder={customerEmail || 'your.email@example.com'}
                      />
                      {userProfile && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                          <Shield className="w-3 h-3 text-violet-500" />
                          {isRTL ? 'معبأ تلقائياً من هوية الإمارات' : 'Auto-filled from UAE PASS'}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('to')}</label>
                      <Input
                        value={emailTo}
                        onChange={(e) => setEmailTo(e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('subject')}</label>
                      <Input
                        value={emailSubject}
                        onChange={(e) => setEmailSubject(e.target.value)}
                        placeholder={t('subjectPlaceholder')}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">{t('body')}</label>
                      <Textarea
                        value={emailBody}
                        onChange={(e) => setEmailBody(e.target.value)}
                        placeholder={t('bodyPlaceholder')}
                        rows={5}
                        className="text-sm resize-none"
                      />
                      <p className="text-[10px] text-muted-foreground mt-1">{t('ctrlEnterToSend')}</p>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setShowCompose(false)
                          setEmailSubject('')
                          setEmailBody('')
                          setSelectedTemplate(null)
                        }}
                      >
                        {t('cancel')}
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSendEmail}
                        disabled={!emailSubject.trim() || !emailBody.trim() || sending}
                        className="bg-slate-700 hover:bg-slate-800 text-white"
                      >
                        {sending ? (
                          <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />{t('loading')}</>
                        ) : (
                          <><Send className="w-3.5 h-3.5 mr-1" />{t('sendMessage')}</>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Sent emails list */}
          {sentEmails.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                <Mail className="w-7 h-7 text-slate-400" />
              </div>
              <p className="text-sm text-muted-foreground font-medium">{t('noEmails')}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('noEmailsDesc')}</p>
            </div>
          ) : (
            sentEmails.map((email) => (
              <motion.div
                key={email.id}
                variants={messageVariants}
                initial="hidden"
                animate="visible"
              >
                <Card className="border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{email.subject}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {isRTL ? 'من' : 'From'}: {email.fromName} &lt;{email.from}&gt; &middot; {isRTL ? 'إلى' : 'To'}: {email.to} &middot; {formatDate(email.timestamp)}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-[10px] flex-shrink-0 ${
                          email.status === 'sent'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : email.status === 'failed'
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {email.status === 'sending' && <Loader2 className="w-2.5 h-2.5 mr-1 animate-spin" />}
                        {t(email.status === 'sending' ? 'loading' : email.status === 'sent' ? 'sent' : 'failed')}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-3">{email.body}</p>

                    {/* AI auto-reply */}
                    {email.aiReply && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700"
                      >
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Badge className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 text-[9px] hover:bg-slate-100">
                            <Sparkles className="w-2.5 h-2.5 mr-0.5" />
                            {t('aiReply')}
                          </Badge>
                          {email.aiReplyTimestamp && (
                            <span className="text-[10px] text-muted-foreground">
                              {formatDate(email.aiReplyTimestamp)}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 rounded-lg p-2.5 whitespace-pre-wrap">
                          {email.aiReply}
                        </p>
                      </motion.div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

// ─── Compact Audio Visualizer for inline use ────────────────────────────────────

function CompactAudioVisualizer({
  state,
  audioLevel,
  color = '#7c3aed',
}: {
  state: VoiceAgentState
  audioLevel: number
  color?: string
}) {
  const barCount = 7
  return (
    <div className="flex items-center justify-center gap-1.5 h-16" style={{ color }}>
      {Array.from({ length: barCount }).map((_, i) => {
        let height = 0.15
        if (state === 'speaking') {
          const center = barCount / 2
          const dist = Math.abs(i - center) / center
          height = audioLevel * (1 - dist * 0.5) + Math.random() * 0.1
        } else if (state === 'thinking') {
          height = 0.25 + Math.sin(Date.now() / 200 + i) * 0.15
        } else if (state === 'listening') {
          height = 0.12 + Math.sin(Date.now() / 1000 + i * 0.5) * 0.05
        } else if (state === 'connecting') {
          height = 0.2 + Math.sin(Date.now() / 500 + i) * 0.1
        }
        return (
          <div
            key={i}
            className="w-2 rounded-full bg-current/20 transition-all duration-100"
            style={{ height: `${Math.max(8, Math.min(64, height * 64))}px` }}
          />
        )
      })}
    </div>
  )
}

// ─── Inline Voice Call Session (compact, stays in tab) ──────────────────────────

function InlineVoiceSession({ customerName }: { customerName: string }) {
  const { t, isRTL } = useTranslation()
  const agent = useVoiceAgentContext()
  const [chatOpen, setChatOpen] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const [animKey, setAnimKey] = useState(0)

  // Re-render visualizer periodically for animation
  useEffect(() => {
    const interval = setInterval(() => setAnimKey(k => k + 1), 100)
    return () => clearInterval(interval)
  }, [])

  // Auto-scroll transcript
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [agent.messages])

  const handleSendChat = useCallback(() => {
    const trimmed = chatInput.trim()
    if (!trimmed) return
    agent.sendChatMessage(trimmed)
    setChatInput('')
  }, [chatInput, agent])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendChat()
    }
  }, [handleSendChat])

  const stateLabel = useMemo(() => {
    switch (agent.state) {
      case 'connecting': return t('agentConnecting' as any)
      case 'listening': return t('agentListening' as any)
      case 'thinking': return t('agentThinking' as any)
      case 'speaking': return t('agentSpeaking' as any)
      default: return ''
    }
  }, [agent.state, t])

  const stateColor = useMemo(() => {
    switch (agent.state) {
      case 'listening': return 'text-emerald-500'
      case 'thinking': return 'text-amber-500'
      case 'speaking': return 'text-violet-500'
      default: return 'text-muted-foreground'
    }
  }, [agent.state])

  return (
    <div className="flex flex-col h-full" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Voice Call Header */}
      <div className="bg-gradient-to-r from-violet-600 to-purple-700 text-white px-4 py-3 flex items-center gap-3 rounded-t-xl flex-shrink-0">
        <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center animate-pulse">
          <Phone className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold">{t('callCenter')}</h3>
          <p className="text-[11px] text-white/80 flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full inline-block ${agent.state === 'listening' ? 'bg-emerald-400' : agent.state === 'speaking' ? 'bg-violet-300' : 'bg-amber-300'} animate-pulse`} />
            {stateLabel} &middot; {customerName}
          </p>
        </div>
        <Badge className="bg-white/20 text-white border-0 text-[10px] hover:bg-white/20">
          <Brain className="w-3 h-3 mr-1" />
          {t('aiAgent')}
        </Badge>
        {agent.providerStatus && (
          <div className="text-[9px] text-white/50 leading-tight text-right">
            <span>STT: {agent.providerStatus.stt === 'deepgram' ? '🎤' : '🔄'}</span>
            <span className="ml-1">TTS: {agent.providerStatus.tts === 'cartesia' ? '🔊' : '🔄'}</span>
          </div>
        )}
      </div>

      {/* Audio Visualizer + Transcript area */}
      <div className="flex-1 flex flex-col bg-violet-50/50 dark:bg-violet-950/20">
        {/* Compact visualizer */}
        <div className="flex-shrink-0 py-6 flex flex-col items-center justify-center border-b border-violet-100 dark:border-violet-900/30 bg-gradient-to-b from-violet-100/60 to-violet-50/30 dark:from-violet-900/20 dark:to-violet-950/10">
          <div className="relative mb-2">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
              <CompactAudioVisualizer key={animKey} state={agent.state} audioLevel={agent.agentAudioLevel} color="white" />
            </div>
            {/* Pulse ring when speaking/listening */}
            {(agent.state === 'speaking' || agent.state === 'listening') && (
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-violet-400/40"
                animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              />
            )}
          </div>
          <p className={`text-xs font-medium ${stateColor}`}>{stateLabel}</p>
        </div>

        {/* Transcript */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
          {agent.messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <MessageSquare className="w-8 h-8 text-violet-300 mb-2" />
              <p className="text-xs text-muted-foreground">
                {t('agentListening')}
              </p>
            </div>
          )}
          <AnimatePresence>
            {agent.messages.map((msg) => {
              const isUser = msg.role === 'user'
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-sm ${
                      isUser
                        ? 'bg-violet-600 text-white rounded-br-sm'
                        : 'bg-white dark:bg-violet-900/30 text-foreground rounded-bl-sm border border-violet-100 dark:border-violet-800/30'
                    }`}
                  >
                    {msg.text}
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
          {agent.state === 'thinking' && (
            <div className="flex justify-start">
              <div className="bg-white dark:bg-violet-900/30 rounded-2xl rounded-bl-sm px-4 py-2.5 border border-violet-100 dark:border-violet-800/30">
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          {/* Interim transcript from Deepgram */}
          {agent.interimTranscript && agent.state === 'listening' && (
            <div className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed bg-violet-600/50 text-white/70 rounded-br-sm italic">
                {agent.interimTranscript}
              </div>
            </div>
          )}
        </div>

        {/* Chat input (toggleable) */}
        <AnimatePresence>
          {chatOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="border-t border-violet-100 dark:border-violet-900/30 overflow-hidden"
            >
              <div className="p-2 flex items-center gap-2">
                <Input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t('chatPlaceholder')}
                  className="flex-1 h-8 text-sm border-violet-200 focus-visible:ring-violet-400/30"
                />
                <Button
                  size="icon"
                  onClick={handleSendChat}
                  disabled={!chatInput.trim()}
                  className="h-8 w-8 bg-violet-600 hover:bg-violet-700 text-white rounded-full flex-shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Control Bar */}
      <div className="bg-white dark:bg-card border-t border-violet-100 dark:border-violet-900/30 p-3 flex items-center gap-2 rounded-b-xl flex-shrink-0">
        <Button
          variant="outline"
          size="sm"
          onClick={() => agent.toggleMute()}
          className={`gap-1.5 ${!agent.isMuted ? 'border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100' : 'border-red-300 text-red-700 bg-red-50 hover:bg-red-100'}`}
        >
          {agent.isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          <span className="text-xs">{agent.isMuted ? t('mutedState') : t('micState')}</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setChatOpen(!chatOpen)}
          className={`gap-1.5 ${chatOpen ? 'border-violet-300 text-violet-700 bg-violet-50 hover:bg-violet-100' : ''}`}
        >
          <MessageSquare className="w-4 h-4" />
          <span className="text-xs">{t('chat')}</span>
        </Button>
        <div className="flex-1" />
        <Button
          size="sm"
          onClick={() => agent.stop()}
          className="gap-1.5 bg-red-600 hover:bg-red-700 text-white"
        >
          <PhoneOff className="w-4 h-4" />
          <span className="text-xs font-bold">{t('endCall')}</span>
        </Button>
      </div>

      {/* Error display */}
      {agent.error && (
        <div className="px-3 pb-2">
          <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700 dark:bg-amber-900/20 dark:border-amber-800/30 dark:text-amber-400">
            {agent.error}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Call Center (Voice) Tab ────────────────────────────────────────────────────

function CallCenterTabInner({ customerName, customerContext }: { customerName: string; customerContext: any }) {
  const { t, isRTL } = useTranslation()
  const agent = useVoiceAgentContext()
  const [isConnecting, setIsConnecting] = useState(false)

  const handleStartCall = useCallback(async () => {
    setIsConnecting(true)
    try {
      // Pass customer context to the voice agent session
      await agent.start()
    } catch (err) {
      console.error('[VoiceAgent] Failed to connect:', err)
    } finally {
      setIsConnecting(false)
    }
  }, [agent])

  if (agent.isConnected) {
    return <InlineVoiceSession customerName={customerName} />
  }

  return (
    <div className="h-full" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Customer info badge on welcome view */}
      {customerName && (
        <div className="px-4 pt-3">
          <div className="flex items-center gap-2 bg-violet-50 dark:bg-violet-900/20 rounded-lg p-2.5 border border-violet-100 dark:border-violet-800/30">
            <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-800 flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-violet-600 dark:text-violet-300" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-violet-900 dark:text-violet-100 truncate">{customerName}</p>
              <p className="text-[10px] text-violet-600 dark:text-violet-400">
                {isRTL ? 'السياق مشترك مع الذكاء الاصطناعي' : 'Context shared with AI Brain'}
              </p>
            </div>
            <Badge className="bg-violet-100 dark:bg-violet-800 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-700 text-[9px]">
              <Brain className="w-2.5 h-2.5 mr-0.5" />
              {isRTL ? 'مدرك' : 'Aware'}
            </Badge>
          </div>
        </div>
      )}
      <WelcomeView
        startButtonText={t('startCall')}
        tagline={t('speakWithAgent')}
        onStartCall={handleStartCall}
        isConnecting={isConnecting || agent.state === 'connecting'}
      />
      {agent.error && (
        <div className="px-4 pb-4">
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {agent.error}
          </div>
        </div>
      )}
    </div>
  )
}

function CallCenterTab({ customerName, customerContext }: { customerName: string; customerContext: any }) {
  const { isRTL } = useTranslation()

  return (
    <div className="h-full" dir={isRTL ? 'rtl' : 'ltr'}>
      <VoiceAgentProvider>
        <CallCenterTabInner customerName={customerName} customerContext={customerContext} />
      </VoiceAgentProvider>
    </div>
  )
}


// ─── Main Component ─────────────────────────────────────────────────────────────

function CustomerCommHub() {
  const { t, isRTL, language } = useTranslation()
  const { customerContext, chatSessionId } = useAppStore()
  const { isAuthenticated, userProfile } = useAuthStore()
  const [activeTab, setActiveTab] = useState('whatsapp')

  // Derive customer name from UAE PASS auth store
  const customerName = useMemo(
    () => getUserDisplayName(userProfile, language, customerContext?.name),
    [userProfile, language, customerContext?.name]
  )

  // Shared AI Brain context across all channels
  // Base context derived from profile (no setState-in-effect)
  const baseBrainContext: AIBrainContext = useMemo(() => ({
    customerName,
    activeCases: customerContext?.activeCases ?? 0,
    sentiment: customerContext?.sentiment ?? 0.5,
    preferredChannel: customerContext?.preferredChannel ?? 'whatsapp',
    detectedIntent: undefined,
    relatedCases: [],
    language,
  }), [customerName, customerContext, language])

  // Dynamic overrides (detected intent, sentiment from chat, etc.)
  const [brainOverrides, setBrainOverrides] = useState<Partial<AIBrainContext>>({})

  const brainContext: AIBrainContext = useMemo(() => ({
    ...baseBrainContext,
    ...brainOverrides,
  }), [baseBrainContext, brainOverrides])

  const handleContextUpdate = useCallback((updates: Partial<AIBrainContext>) => {
    setBrainOverrides((prev) => ({ ...prev, ...updates }))
  }, [])

  return (
    <div className={`w-full ${isRTL ? 'rtl font-arabic' : ''}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <Card className="border-0 shadow-lg overflow-hidden relative">
        <CardHeader className="pb-0 px-4 pt-4">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-brand-600" />
            {t('communicationHubTitle')}
          </CardTitle>

          {/* Customer context line with UAE PASS identity */}
          <div className="flex items-center gap-2 mt-1">
            {isAuthenticated && userProfile ? (
              <>
                <Badge className="bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-700 text-[10px]">
                  <Shield className="w-3 h-3 mr-1" />
                  UAE PASS
                </Badge>
                <p className="text-xs text-muted-foreground">
                  {customerName}
                  {customerContext && (
                    <> &middot; {t('activeCases')}: {customerContext.activeCases}</>
                  )}
                </p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                {isRTL ? 'لم يتم تسجيل الدخول' : 'Not logged in'}
              </p>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-4 pt-2">
          {/* AI Brain Context Bar */}
          {isAuthenticated && (
            <div className="mb-3">
              <AIBrainContextBar brainContext={brainContext} />
            </div>
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col">
            <TabsList className="w-full grid grid-cols-3 h-auto p-1 bg-base-100 rounded-xl">
              <TabsTrigger
                value="whatsapp"
                className="flex items-center gap-1.5 py-2.5 data-[state=active]:bg-[#25D366] data-[state=active]:text-white rounded-lg text-xs sm:text-sm transition-all data-[state=active]:shadow-sm"
              >
                <MessageCircle className="w-4 h-4" />
                <span className="hidden sm:inline">{t('whatsapp')}</span>
                <span className="sm:hidden">{t('waShort')}</span>
              </TabsTrigger>
              <TabsTrigger
                value="email"
                className="flex items-center gap-1.5 py-2.5 data-[state=active]:bg-slate-600 data-[state=active]:text-white rounded-lg text-xs sm:text-sm transition-all data-[state=active]:shadow-sm"
              >
                <Mail className="w-4 h-4" />
                <span className="hidden sm:inline">{t('emailChannel')}</span>
                <span className="sm:hidden">{t('emailShort')}</span>
              </TabsTrigger>
              <TabsTrigger
                value="call"
                className="flex items-center gap-1.5 py-2.5 data-[state=active]:bg-violet-600 data-[state=active]:text-white rounded-lg text-xs sm:text-sm transition-all data-[state=active]:shadow-sm"
              >
                <Phone className="w-4 h-4" />
                <span className="hidden sm:inline">{t('callCenter')}</span>
                <span className="sm:hidden">{t('callShort')}</span>
              </TabsTrigger>
            </TabsList>

            <div className="mt-3 rounded-xl overflow-hidden border border-base-200 dark:border-base-700 flex-1 flex flex-col relative">
              {/* Auth required overlay */}
              {!isAuthenticated && <AuthRequiredOverlay />}

              <AnimatePresence mode="wait">
                {activeTab === 'whatsapp' && (
                  <motion.div
                    key="whatsapp"
                    variants={tabContentVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="flex-1 flex flex-col"
                  >
                    <WhatsAppTab brainContext={brainContext} onContextUpdate={handleContextUpdate} />
                  </motion.div>
                )}
                {activeTab === 'email' && (
                  <motion.div
                    key="email"
                    variants={tabContentVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="flex-1 flex flex-col"
                  >
                    <EmailTab brainContext={brainContext} onContextUpdate={handleContextUpdate} />
                  </motion.div>
                )}
                {activeTab === 'call' && (
                  <motion.div
                    key="call"
                    variants={tabContentVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="flex-1 flex flex-col"
                  >
                    <CallCenterTab customerName={customerName} customerContext={customerContext} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </Tabs>

          {/* Shared session indicator */}
          {isAuthenticated && (
            <div className="mt-2 flex items-center justify-center gap-2 text-[10px] text-muted-foreground">
              <Brain className="w-3 h-3 text-violet-500" />
              <span>
                {isRTL
                  ? `جلسة مشتركة: ${chatSessionId.slice(0, 12)}... — الذكاء يحافظ على السياق عبر القنوات`
                  : `Shared session: ${chatSessionId.slice(0, 12)}... — AI Brain maintains context across channels`}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default CustomerCommHub
export { CustomerCommHub }
