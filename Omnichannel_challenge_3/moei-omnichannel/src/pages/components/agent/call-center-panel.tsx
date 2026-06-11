'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Phone,
  PhoneOff,
  PhoneIncoming,
  PhoneOutgoing,
  Mic,
  MicOff,
  Pause,
  Play,
  ArrowRightLeft,
  Clock,
  User,
  Loader2,
  Volume2,
  VolumeX,
  AlertTriangle,
  Brain,
  Bot,
  Sparkles,
  Link,
  Headphones,
  Info,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAppStore, type ActiveCall } from '@/store/app-store'
import { useTranslation } from '@/i18n'
import { useRealtime } from '@/hooks/use-realtime'
import { VoiceAgentProvider, useVoiceAgentContext, type VoiceAgentState } from '@/components/voice/voice-agent-provider'
import { SessionView } from '@/components/voice/session-view'
import { WelcomeView } from '@/components/voice/welcome-view'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function formatTimeAgo(date: Date): string {
  const now = Date.now()
  const diffMs = now - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

function getSentimentColor(sentiment: number): string {
  if (sentiment >= 0.65) return 'text-uae-green-600'
  if (sentiment >= 0.35) return 'text-amber-500'
  return 'text-uae-red-600'
}

function getSentimentBarColor(sentiment: number): string {
  if (sentiment >= 0.65) return '[&>div]:bg-uae-green-500'
  if (sentiment >= 0.35) return '[&>div]:bg-amber-400'
  return '[&>div]:bg-uae-red-500'
}

function getSentimentLabel(sentiment: number, t: (key: string) => string): string {
  if (sentiment >= 0.65) return t('sentimentPositive' as Parameters<typeof t>[0])
  if (sentiment >= 0.35) return t('sentimentNeutral' as Parameters<typeof t>[0])
  return t('sentimentNegative' as Parameters<typeof t>[0])
}

function getEmotionBadgeColor(emotion: string): string {
  switch (emotion) {
    case 'angry': return 'bg-red-100 text-red-700 border-red-300'
    case 'frustrated': return 'bg-orange-100 text-orange-700 border-orange-300'
    case 'confused': return 'bg-yellow-100 text-yellow-700 border-yellow-300'
    case 'calm': return 'bg-green-100 text-green-700 border-green-300'
    case 'satisfied': return 'bg-emerald-100 text-emerald-700 border-emerald-300'
    case 'urgent': return 'bg-red-200 text-red-800 border-red-400'
    default: return 'bg-gray-100 text-gray-700 border-gray-300'
  }
}

function getEmotionIcon(emotion: string) {
  switch (emotion) {
    case 'angry': return '😤'
    case 'frustrated': return '😣'
    case 'confused': return '😕'
    case 'calm': return '😌'
    case 'satisfied': return '😊'
    case 'urgent': return '🚨'
    default: return '😐'
  }
}

// Voice agent state label helper
function getVoiceStateLabel(state: VoiceAgentState): string {
  switch (state) {
    case 'disconnected': return 'Disconnected'
    case 'connecting': return 'Connecting...'
    case 'connected': return 'Connected'
    case 'listening': return 'Listening'
    case 'thinking': return 'Thinking'
    case 'speaking': return 'Speaking'
    default: return state
  }
}

function getVoiceStateColor(state: VoiceAgentState): string {
  switch (state) {
    case 'disconnected': return 'bg-muted-foreground/40'
    case 'connecting': return 'bg-amber-500 animate-pulse'
    case 'connected': return 'bg-uae-green-500 animate-pulse'
    case 'listening': return 'bg-uae-green-500 animate-pulse'
    case 'thinking': return 'bg-amber-500 animate-pulse'
    case 'speaking': return 'bg-blue-500 animate-pulse'
    default: return 'bg-muted-foreground/40'
  }
}

function getStatusBadge(status: ActiveCall['status'], t: (key: string) => string, isAIHandled?: boolean) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {(() => {
        switch (status) {
          case 'ringing':
            return <Badge className="bg-blue-500 hover:bg-blue-600 text-white text-[10px] gap-1"><PhoneIncoming className="h-3 w-3" />{t('ringing' as Parameters<typeof t>[0])}</Badge>
          case 'answered':
            return <Badge className="bg-uae-green-500 hover:bg-uae-green-600 text-white text-[10px] gap-1"><Phone className="h-3 w-3" />{t('activeCall' as Parameters<typeof t>[0])}</Badge>
          case 'on-hold':
            return <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-[10px] gap-1"><Pause className="h-3 w-3" />{t('callOnHold' as Parameters<typeof t>[0])}</Badge>
          case 'transferring':
            return <Badge className="bg-purple-500 hover:bg-purple-600 text-white text-[10px] gap-1"><ArrowRightLeft className="h-3 w-3" />{t('callTransferring' as Parameters<typeof t>[0])}</Badge>
          case 'ended':
            return <Badge variant="secondary" className="text-[10px] gap-1"><PhoneOff className="h-3 w-3" />{t('ended' as Parameters<typeof t>[0])}</Badge>
          default:
            return null
        }
      })()}
      {isAIHandled && (
        <Badge className="bg-blue-500 hover:bg-blue-600 text-white text-[10px] gap-1 animate-pulse">
          <Brain className="h-3 w-3" />
          {t('aiActive' as Parameters<typeof t>[0])}
        </Badge>
      )}
    </div>
  )
}

// ─── Transcript Speaker Legend ──────────────────────────────────────────────

function TranscriptSpeakerLegend() {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-3 px-1 py-1.5 text-[10px] text-muted-foreground flex-wrap">
      <span className="flex items-center gap-1">
        <span className="h-2 w-2 rounded-full bg-blue-500" />
        {t('customer' as Parameters<typeof t>[0]) || 'Customer'}
      </span>
      <span className="flex items-center gap-1">
        <span className="h-2 w-2 rounded-full bg-amber-500" />
        AI
      </span>
      <span className="flex items-center gap-1">
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
        Agent
      </span>
      <span className="flex items-center gap-1">
        <span className="h-2 w-2 rounded-full bg-gray-400" />
        System
      </span>
      <span className="flex items-center gap-1">
        <span className="h-2 w-2 rounded-full bg-purple-400" />
        AI Thinking
      </span>
    </div>
  )
}

// ─── Transcript Line Renderer ────────────────────────────────────────────────

function TranscriptLine({ line }: { line: string }) {
  const { t } = useTranslation()
  const isTranslated = line.includes('[TRANSLATED]')
  const cleanLine = line.replace('[TRANSLATED]', '').trim()

  if (cleanLine.startsWith('[CUSTOMER]')) {
    return (
      <div className="flex gap-2 items-start animate-in fade-in slide-in-from-bottom-1 duration-300 rounded-md border-l-[3px] border-blue-500 bg-blue-50/60 px-2.5 py-1.5">
        <User className="h-3.5 w-3.5 text-blue-600 shrink-0 mt-0.5" />
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[10px] font-semibold text-blue-700">Customer</span>
          </div>
          <p className="text-sm text-foreground leading-relaxed">
            {cleanLine.replace('[CUSTOMER]', '').trim()}
          </p>
          {isTranslated && (
            <p className="text-[10px] text-blue-600 font-medium italic mt-0.5">
              (Translated to Employer Language)
            </p>
          )}
        </div>
      </div>
    )
  }
  if (cleanLine.startsWith('[AI]')) {
    return (
      <div className="flex gap-2 items-start animate-in fade-in slide-in-from-bottom-1 duration-300 rounded-md border-l-[3px] border-amber-500 bg-amber-50/60 px-2.5 py-1.5">
        <Sparkles className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[10px] font-semibold text-amber-700">AI Assistant</span>
          </div>
          <p className="text-sm text-amber-900 leading-relaxed">
            {cleanLine.replace('[AI]', '').trim()}
          </p>
        </div>
      </div>
    )
  }
  if (cleanLine.startsWith('[AGENT]')) {
    return (
      <div className="flex gap-2 items-start animate-in fade-in slide-in-from-bottom-1 duration-300 rounded-md border-l-[3px] border-emerald-500 bg-emerald-50/60 px-2.5 py-1.5">
        <Headphones className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[10px] font-semibold text-emerald-700">You (Agent)</span>
          </div>
          <p className="text-sm text-foreground leading-relaxed">
            {cleanLine.replace('[AGENT]', '').trim()}
          </p>
        </div>
      </div>
    )
  }
  if (cleanLine.startsWith('[SYSTEM]')) {
    return (
      <div className="flex gap-2 items-start animate-in fade-in slide-in-from-bottom-1 duration-300 rounded-md border-l-[3px] border-gray-400 bg-gray-50/60 px-2.5 py-1.5">
        <Bot className="h-3.5 w-3.5 text-gray-500 shrink-0 mt-0.5" />
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[10px] font-semibold text-gray-500">System</span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed italic">
            {cleanLine.replace('[SYSTEM]', '').trim()}
          </p>
        </div>
      </div>
    )
  }
  if (cleanLine === '[AI_THINKING]') {
    return (
      <div className="flex gap-2 items-start animate-in fade-in slide-in-from-bottom-1 duration-300 rounded-md border-l-[3px] border-purple-400 bg-purple-50/60 px-2.5 py-1.5">
        <Brain className="h-3.5 w-3.5 text-purple-500 shrink-0 mt-0.5 animate-pulse" />
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[10px] font-semibold text-purple-600 animate-pulse">AI Thinking...</span>
          </div>
          <p className="text-sm text-purple-500 leading-relaxed italic animate-pulse">
            {t('aiThinking' as Parameters<typeof t>[0])}
          </p>
        </div>
      </div>
    )
  }
  return (
    <div className="flex gap-2 items-start animate-in fade-in slide-in-from-bottom-1 duration-300">
      <span className="text-sm text-foreground leading-relaxed">
        {cleanLine}
      </span>
    </div>
  )
}

// ─── AI Voice Agent Inner (uses context) ─────────────────────────────────────

function AIVoiceAgentInner({ callId, mode, employerLanguage }: { callId: string, mode: string, employerLanguage: string }) {
  const { t } = useTranslation()
  const agent = useVoiceAgentContext()
  const updateActiveCall = useAppStore((s) => s.updateActiveCall)

  const handleStart = useCallback(async () => {
    updateActiveCall(callId, { isAIHandled: true })
    await agent.start()
  }, [callId, updateActiveCall, agent])

  const handleStop = useCallback(() => {
    updateActiveCall(callId, { isAIHandled: false })
    agent.stop()
  }, [callId, updateActiveCall, agent])

  if (!agent.isConnected) {
    return (
      <div className="space-y-3">
        <WelcomeView
          startButtonText={t('enableAIVoiceAgent' as Parameters<typeof t>[0])}
          tagline={t('aiVoiceAgent' as Parameters<typeof t>[0])}
          onStartCall={handleStart}
          isConnecting={agent.state === 'connecting'}
        />
        {agent.error && (
          <div className="p-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
            {agent.error}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3 animate-in slide-in-from-top-2 duration-200">
      {/* Connection Status + Disable Button */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 flex-1">
          <div className={`h-2 w-2 rounded-full ${getVoiceStateColor(agent.state)}`} />
          <span className="text-xs text-muted-foreground">
            {getVoiceStateLabel(agent.state)}
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 border-blue-300 text-blue-600 hover:bg-blue-50 h-7 text-xs"
          onClick={handleStop}
        >
          <Sparkles className="h-3 w-3" />
          Disable
        </Button>
      </div>

      {/* Voice Agent Session View */}
      <div className="h-[280px] rounded-xl overflow-hidden border border-blue-100">
        <SessionView
          audioVisualizerColor="#3b82f6"
          supportsChatInput={true}
          preConnectMessage="Agent is listening, ask a question"
        />
      </div>
    </div>
  )
}

// ─── Incoming Call Alert ─────────────────────────────────────────────────────

function IncomingCallAlert({
  call,
  onAnswer,
  onDecline,
}: {
  call: ActiveCall
  onAnswer: () => void
  onDecline: () => void
}) {
  const { t } = useTranslation()
  const [countdown, setCountdown] = useState(30)

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          onDecline()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [onDecline])

  return (
    <div className="animate-in fade-in slide-in-from-top-4 duration-500">
      <Card className="border-blue-500/40 bg-gradient-to-br from-blue-50 to-brand-50 shadow-lg shadow-blue-500/10 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="absolute -inset-16 rounded-full bg-blue-400/20 animate-ping" style={{ animationDuration: '2s' }} />
            <div className="absolute -inset-12 rounded-full bg-blue-400/15 animate-ping" style={{ animationDuration: '2s', animationDelay: '0.5s' }} />
          </div>
        </div>

        <CardContent className="p-6 relative z-10">
          <div className="flex flex-col items-center text-center gap-4">
            <div className="relative">
              <div className="h-16 w-16 rounded-full bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
                <PhoneIncoming className="h-8 w-8 text-white animate-pulse" />
              </div>
              <div className="absolute -inset-2 rounded-full border-2 border-blue-400/50 animate-ping" style={{ animationDuration: '1.5s' }} />
            </div>

            <div>
              <p className="text-lg font-bold text-blue-700 mb-1">
                {t('incomingCall' as Parameters<typeof t>[0])}
              </p>
              <p className="text-xl font-semibold text-foreground">
                {call.customerName}
              </p>
              <p className="text-sm text-muted-foreground flex items-center justify-center gap-1.5 mt-1">
                <Phone className="h-3.5 w-3.5" />
                {call.customerPhone}
              </p>
              <div className="flex items-center justify-center gap-2 mt-2">
                {call.direction === 'inbound' ? (
                  <Badge variant="outline" className="text-xs gap-1 border-blue-300 text-blue-600">
                    <PhoneIncoming className="h-3 w-3" />
                    {t('inbound' as Parameters<typeof t>[0])}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs gap-1 border-brand-300 text-brand-600">
                    <PhoneOutgoing className="h-3 w-3" />
                    {t('outbound' as Parameters<typeof t>[0])}
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground">
                  {countdown}{t('secondsRemaining' as Parameters<typeof t>[0])}
                </span>
              </div>
            </div>

            <div className="flex gap-4 mt-2">
              <Button
                onClick={onAnswer}
                className="bg-uae-green-500 hover:bg-uae-green-600 text-white px-8 py-6 text-base font-semibold gap-2 shadow-lg shadow-uae-green-500/30 transition-all duration-200 hover:scale-105"
                size="lg"
              >
                <Phone className="h-5 w-5" />
                {t('answerCall' as Parameters<typeof t>[0])}
              </Button>
              <Button
                onClick={onDecline}
                variant="destructive"
                className="px-8 py-6 text-base font-semibold gap-2 shadow-lg shadow-uae-red-500/20 transition-all duration-200 hover:scale-105"
                size="lg"
              >
                <PhoneOff className="h-5 w-5" />
                {t('decline' as Parameters<typeof t>[0])}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Active Call View ────────────────────────────────────────────────────────

function ActiveCallView({
  call,
  callTimer,
  callNotes,
  setCallNotes,
  isMuted: isCallMuted,
  isOnHold,
  showTransfer,
  transferTarget,
  setTransferTarget,
  onToggleMute,
  onToggleHold,
  onTransfer,
  onEndCall,
  onToggleTransfer,
}: {
  call: ActiveCall
  callTimer: number
  callNotes: string
  setCallNotes: (notes: string) => void
  isMuted: boolean
  isOnHold: boolean
  showTransfer: boolean
  transferTarget: string
  setTransferTarget: (target: string) => void
  onToggleMute: () => void
  onToggleHold: () => void
  onTransfer: () => void
  onEndCall: () => void
  onToggleTransfer: () => void
}) {
  const { t } = useTranslation()
  const transcriptEndRef = useRef<HTMLDivElement>(null)

  // AI Voice Agent & Translation state
  const [callMode, setCallMode] = useState<'100_ai' | 'ai_assist' | 'human_only' | 'tts_only'>('human_only')
  const [employerLanguage, setEmployerLanguage] = useState<'en' | 'ar'>('en')
  
  const isAIAgentEnabled = callMode !== 'human_only'

  const updateActiveCall = useAppStore((s) => s.updateActiveCall)

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [call.transcript?.length])

  // Toggle AI agent (Legacy support for the prop, just toggles 100_ai)
  const handleToggleAI = useCallback(() => {
    setCallMode((prev) => prev === 'human_only' ? '100_ai' : 'human_only')
  }, [])

  // Handle end call
  const handleEndCall = useCallback(() => {
    setCallMode('human_only')
    onEndCall()
  }, [onEndCall])

  const sentiment = call.sentiment ?? 0.5

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Customer Info Header */}
      <Card className="border-border shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar className={`h-14 w-14 border-2 ${isAIAgentEnabled ? 'border-blue-400' : 'border-brand-600/30'}`}>
                <AvatarFallback className={`text-lg font-semibold ${isAIAgentEnabled ? 'bg-blue-100 text-blue-700' : 'bg-brand-100 text-brand-700'}`}>
                  {call.customerName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              {isAIAgentEnabled && (
                <div className="absolute -inset-1 rounded-full border-2 border-blue-400/50 animate-ping" style={{ animationDuration: '2s' }} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-semibold text-foreground truncate">
                  {call.customerName}
                </h3>
                {getStatusBadge(call.status, t, isAIAgentEnabled)}
              </div>
              <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" />
                  {call.customerPhone}
                </span>
                <span className="flex items-center gap-1">
                  {call.direction === 'inbound' ? (
                    <PhoneIncoming className="h-3.5 w-3.5 text-blue-500" />
                  ) : (
                    <PhoneOutgoing className="h-3.5 w-3.5 text-brand-500" />
                  )}
                  {call.direction === 'inbound' ? t('inbound' as Parameters<typeof t>[0]) : t('outbound' as Parameters<typeof t>[0])}
                </span>
              </div>
            </div>

            <div className="text-right shrink-0">
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-brand-500" />
                <span className="text-2xl font-mono font-bold text-foreground tabular-nums">
                  {formatTimer(callTimer)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t('callDuration' as Parameters<typeof t>[0])}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Call Controls */}
      <Card className="border-border shadow-sm">
        <CardContent className="p-3">
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <Button
              variant={isCallMuted ? 'default' : 'outline'}
              size="sm"
              className={`gap-1.5 ${isCallMuted ? 'bg-red-500 hover:bg-red-600 text-white' : 'border-border hover:bg-red-50 hover:border-red-300 hover:text-red-600'}`}
              onClick={onToggleMute}
            >
              {isCallMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              {isCallMuted ? t('unmuteCall' as Parameters<typeof t>[0]) : t('muteCall' as Parameters<typeof t>[0])}
            </Button>

            <Button
              variant={isOnHold ? 'default' : 'outline'}
              size="sm"
              className={`gap-1.5 ${isOnHold ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'border-border hover:bg-amber-50 hover:border-amber-300 hover:text-amber-600'}`}
              onClick={onToggleHold}
            >
              {isOnHold ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              {isOnHold ? t('resumeCall' as Parameters<typeof t>[0]) : t('holdCall' as Parameters<typeof t>[0])}
            </Button>

            <Button
              variant={showTransfer ? 'default' : 'outline'}
              size="sm"
              className={`gap-1.5 ${showTransfer ? 'bg-purple-500 hover:bg-purple-600 text-white' : 'border-border hover:bg-purple-50 hover:border-purple-300 hover:text-purple-600'}`}
              onClick={onToggleTransfer}
            >
              <ArrowRightLeft className="h-4 w-4" />
              {t('transferCall' as Parameters<typeof t>[0])}
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-border hover:bg-brand-50 hover:border-brand-300 hover:text-brand-600"
              onClick={() => {
                toast.success('UAE PASS Link Sent', {
                  description: 'A UAE PASS login link has been sent to the customer.',
                  action: {
                    label: 'View Link',
                    onClick: () => window.open('/uaepass?returnUrl=/simulator?channel=email', '_blank'),
                  },
                });
              }}
            >
              <Link className="h-4 w-4" />
              Send UAE PASS Link
            </Button>

            <Button
              variant="destructive"
              size="sm"
              className="gap-1.5 bg-uae-red-500 hover:bg-uae-red-600 shadow-sm"
              onClick={handleEndCall}
            >
              <PhoneOff className="h-4 w-4" />
              {t('endCall' as Parameters<typeof t>[0])}
            </Button>
          </div>

          {showTransfer && (
            <div className="mt-3 flex gap-2 animate-in slide-in-from-top-2 duration-200">
              <Input
                value={transferTarget}
                onChange={(e) => setTransferTarget(e.target.value)}
                placeholder={t('targetAgentPlaceholder' as Parameters<typeof t>[0])}
                className="h-9 text-sm border-border bg-white"
                onKeyDown={(e) => e.key === 'Enter' && onTransfer()}
              />
              <Button
                size="sm"
                onClick={onTransfer}
                disabled={!transferTarget.trim()}
                className="bg-purple-500 hover:bg-purple-600 text-white shrink-0"
              >
                <ArrowRightLeft className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Voice Agent Section — Socket.IO voice agent */}
      <Card className="border-blue-200 shadow-sm bg-gradient-to-b from-blue-50/50 to-white">
        <CardHeader className="p-3 pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Brain className="h-4 w-4 text-blue-500" />
            {t('aiVoiceAgent' as Parameters<typeof t>[0])}
            <Badge
              variant={isAIAgentEnabled ? 'default' : 'secondary'}
              className={`text-[10px] ml-2 gap-1 ${isAIAgentEnabled ? 'bg-blue-500 hover:bg-blue-600 text-white' : ''}`}
            >
              {isAIAgentEnabled ? t('enabled' as Parameters<typeof t>[0]) : t('disabled' as Parameters<typeof t>[0])}
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <select
              value={callMode}
              onChange={(e) => setCallMode(e.target.value as any)}
              className="text-xs border rounded p-1 bg-white"
            >
              <option value="100_ai">100% AI Handled</option>
              <option value="ai_assist">Human + AI Assist</option>
              <option value="tts_only">LLM + TTS Only</option>
              <option value="human_only">Human Only</option>
            </select>
            <select
              value={employerLanguage}
              onChange={(e) => setEmployerLanguage(e.target.value as any)}
              className="text-xs border rounded p-1 bg-white"
            >
              <option value="en">Translate to English</option>
              <option value="ar">Translate to Arabic</option>
            </select>
          </div>
        </CardHeader>
        <CardContent className="p-3 pt-1">
          {callMode === 'human_only' ? (
            <div className="text-center text-xs text-muted-foreground p-4">
              AI Agent is currently disabled. You are handling this call.
            </div>
          ) : (
            <VoiceAgentProvider>
              <AIVoiceAgentInner callId={call.id} mode={callMode} employerLanguage={employerLanguage} />
            </VoiceAgentProvider>
          )}
        </CardContent>
      </Card>

      {/* Live Transcript */}
      <Card className="border-border shadow-sm flex-1 min-h-0 flex flex-col">
        <CardHeader className="p-3 pb-2 shrink-0">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Volume2 className="h-4 w-4 text-blue-500" />
            {t('liveTranscript' as Parameters<typeof t>[0])}
            <Badge variant="secondary" className="text-[10px] ml-auto">
              {(call.transcript?.length || 0)} {t('entries' as Parameters<typeof t>[0])}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0 flex-1 min-h-0">
          {/* Speaker Legend */}
          <TranscriptSpeakerLegend />
          <ScrollArea className="h-full max-h-64">
            {(call.transcript && call.transcript.length > 0) ? (
              <div className="space-y-1.5">
                {call.transcript.map((line, idx) => (
                  <div key={idx} className="flex gap-2 items-start">
                    <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5 font-mono w-8 text-right">
                      {formatTimer(Math.max(0, callTimer - (call.transcript!.length - idx) * 5))}
                    </span>
                    <TranscriptLine line={line} />
                  </div>
                ))}
                <div ref={transcriptEndRef} />
              </div>
            ) : (
              <div className="flex items-center justify-center h-24 text-muted-foreground">
                <div className="text-center">
                  <Volume2 className="h-6 w-6 mx-auto mb-1 opacity-40" />
                  <p className="text-xs">{t('listening' as Parameters<typeof t>[0])}</p>
                </div>
              </div>
            )}
          </ScrollArea>
          {/* Text input is now handled by the voice agent's built-in chat */}
        </CardContent>
      </Card>

      {/* Sentiment + Notes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card className="border-border shadow-sm">
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-xs font-medium flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-brand-500" />
              {t('callSentiment' as Parameters<typeof t>[0])}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-1 space-y-2">
            <div className="flex items-center justify-between">
              <span className={`text-sm font-medium ${getSentimentColor(sentiment)}`}>
                {getSentimentLabel(sentiment, t)}
              </span>
              <span className="text-xs text-muted-foreground">
                {(sentiment * 100).toFixed(0)}%
              </span>
            </div>
            <Progress
              value={sentiment * 100}
              className={`h-2 ${getSentimentBarColor(sentiment)}`}
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{t('sentimentNegative' as Parameters<typeof t>[0])}</span>
              <span>{t('sentimentNeutral' as Parameters<typeof t>[0])}</span>
              <span>{t('sentimentPositive' as Parameters<typeof t>[0])}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm flex flex-col">
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-xs font-medium flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="h-3.5 w-3.5 text-brand-500" />
                {t('callNotes' as Parameters<typeof t>[0])}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-[10px] bg-uae-green-50 text-uae-green-700 border-uae-green-200 hover:bg-uae-green-100"
                onClick={async () => {
                  try {
                    const res = await fetch('/api/cases', {
                      method: 'POST',
                      body: JSON.stringify({ customerId: call.customerId, titleEn: callNotes || 'Voice Call Request', channel: 'voice' }),
                      headers: { 'Content-Type': 'application/json' }
                    })
                    const data = await res.json()
                    if (data.success) {
                      toast.success(`Request Created: ${data.case.referenceNumber}`, {
                        description: `Email sent to customer regarding ${data.case.referenceNumber}`,
                      })
                      setCallNotes('')
                    }
                  } catch (e) {
                    toast.error('Failed to create request')
                  }
                }}
              >
                Create Request
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-1 flex-1">
            <Textarea
              value={callNotes}
              onChange={(e) => setCallNotes(e.target.value)}
              placeholder={t('addCallNotes' as Parameters<typeof t>[0]) + " (Then click Create Request)"}
              className="h-full min-h-[72px] text-xs resize-none bg-white border-border"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ─── Call Queue ──────────────────────────────────────────────────────────────

function CallQueue({ calls }: { calls: ActiveCall[] }) {
  const { t } = useTranslation()
  const queueCalls = calls.filter((c) => c.status === 'ringing')

  if (queueCalls.length === 0) {
    return null
  }

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="p-3 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Clock className="h-4 w-4 text-amber-500" />
          {t('callQueue' as Parameters<typeof t>[0])}
          <Badge variant="secondary" className="text-[10px] ml-auto">
            {queueCalls.length} {t('callsWaiting' as Parameters<typeof t>[0]).toLowerCase()}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-1">
        <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
          {queueCalls.map((call, idx) => (
            <div
              key={`${call.id}-${idx}`}
              className="flex items-center gap-3 p-2 rounded-lg bg-amber-50 border border-amber-200/50"
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-amber-100 text-amber-700 text-xs">
                  {call.customerName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {call.customerName}
                </p>
                <p className="text-xs text-muted-foreground">{call.customerPhone}</p>
              </div>
              <PhoneIncoming className="h-4 w-4 text-amber-500 animate-pulse" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Recent Call History ─────────────────────────────────────────────────────

function CallHistory() {
  const { t } = useTranslation()
  const [recentCalls, setRecentCalls] = useState<Array<{ name: string; duration: string; time: string; direction: 'inbound' | 'outbound' }>>([])

  useEffect(() => {
    // Fetch real resolved/ended voice sessions from the database
    const fetchRecentCalls = async () => {
      try {
        const res = await fetch('/api/realtime/calls/history?XTransformPort=3002')
        if (res.ok) {
          const data = await res.json()
          const calls = (data.calls || []).slice(0, 5).map((call: { customerName?: string; duration?: number; createdAt?: string; direction?: string }) => {
            const durationSec = call.duration || 0
            const mins = Math.floor(durationSec / 60)
            const secs = durationSec % 60
            const durationStr = `${mins}:${secs.toString().padStart(2, '0')}`
            const timeAgo = call.createdAt ? formatTimeAgo(new Date(call.createdAt)) : ''
            return {
              name: call.customerName || 'Unknown',
              duration: durationStr,
              time: timeAgo,
              direction: (call.direction || 'inbound') as 'inbound' | 'outbound',
            }
          })
          setRecentCalls(calls)
        }
      } catch {
        // Silently fail — will show empty state
      }
    }
    fetchRecentCalls()
    const interval = setInterval(fetchRecentCalls, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="p-3 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <PhoneOff className="h-4 w-4 text-muted-foreground" />
          {t('recentCalls' as Parameters<typeof t>[0])}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-1">
        {recentCalls.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-3">
            {t('noRecentCalls' as Parameters<typeof t>[0]) || 'No recent calls'}
          </p>
        ) : (
          <div className="space-y-2">
            {recentCalls.map((call, idx) => (
              <div key={idx} className="flex items-center gap-3 text-sm">
                {call.direction === 'inbound' ? (
                  <PhoneIncoming className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                ) : (
                  <PhoneOutgoing className="h-3.5 w-3.5 text-brand-500 shrink-0" />
                )}
                <span className="flex-1 truncate text-foreground">{call.name}</span>
                <span className="text-xs text-muted-foreground shrink-0">{call.duration}</span>
                <span className="text-[10px] text-muted-foreground shrink-0">{call.time}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyState() {
  const { t } = useTranslation()
  const kpis = useAppStore((s) => s.kpis)
  const queueStatus = useAppStore((s) => s.queueStatus)

  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <div className="relative mb-6">
        <div className="h-20 w-20 rounded-full bg-brand-50 flex items-center justify-center">
          <Phone className="h-10 w-10 text-brand-500/60" />
        </div>
        <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-uae-green-500 flex items-center justify-center">
          <div className="h-2 w-2 rounded-full bg-white" />
        </div>
      </div>
      <h3 className="text-xl font-semibold text-foreground mb-2">
        {t('noActiveCalls' as Parameters<typeof t>[0])}
      </h3>
      <p className="text-sm text-muted-foreground max-w-xs mb-6">
        {t('noActiveCallsDesc' as Parameters<typeof t>[0])}
      </p>

      <div className="grid grid-cols-3 gap-4 w-full max-w-sm">
        <div className="text-center p-3 rounded-lg bg-brand-50 border border-brand-100">
          <p className="text-xl font-bold text-brand-600">{kpis.totalInteractions || 0}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{t('callsToday' as Parameters<typeof t>[0])}</p>
        </div>
        <div className="text-center p-3 rounded-lg bg-brand-50 border border-brand-100">
          <p className="text-xl font-bold text-brand-600">{queueStatus.voice.avgWait || 0}s</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{t('avgWait' as Parameters<typeof t>[0])}</p>
        </div>
        <div className="text-center p-3 rounded-lg bg-brand-50 border border-brand-100">
          <p className="text-xl font-bold text-brand-600">{queueStatus.voice.activeAgents || 0}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{t('agentsOnline' as Parameters<typeof t>[0])}</p>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function CallCenterPanel() {
  const { t } = useTranslation()
  const { emit } = useRealtime()
  const {
    activeCalls,
    currentCallId,
    setCurrentCallId,
    updateActiveCall,
    removeActiveCall,
  } = useAppStore()

  // Call timer
  const [callTimer, setCallTimer] = useState(0)

  // Call controls state
  const [isMuted, setIsMuted] = useState(false)
  const [isOnHold, setIsOnHold] = useState(false)
  const [showTransfer, setShowTransfer] = useState(false)
  const [transferTarget, setTransferTarget] = useState('')
  const [callNotes, setCallNotes] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  // Find the current active call (answered or on-hold)
  const currentCall = activeCalls.find(
    (c) => c.id === currentCallId && (c.status === 'answered' || c.status === 'on-hold' || c.status === 'transferring')
  )

  // Find any ringing call
  const ringingCall = activeCalls.find((c) => c.status === 'ringing' && !currentCall)

  // All queue calls
  const queueCalls = activeCalls.filter(
    (c) => c.status === 'ringing' && c.id !== ringingCall?.id
  )

  // Timer effect - reset when call changes, otherwise tick every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCallTimer((prev) => currentCall ? prev + 1 : 0)
    }, 1000)
    return () => clearInterval(interval)
  }, [currentCall?.id, currentCall])

  // Answer a ringing call
  const handleAnswerCall = useCallback(() => {
    if (!ringingCall) return
    updateActiveCall(ringingCall.id, { status: 'answered' })
    setCurrentCallId(ringingCall.id)
    setIsMuted(false)
    setIsOnHold(false)
    setCallTimer(0)
  }, [ringingCall, updateActiveCall, setCurrentCallId])

  // Decline a ringing call
  const handleDeclineCall = useCallback(() => {
    if (!ringingCall) return
    removeActiveCall(ringingCall.id)
    setCurrentCallId(null)
  }, [ringingCall, removeActiveCall, setCurrentCallId])

  // Toggle mute
  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => !prev)
  }, [])

  // Toggle hold
  const handleToggleHold = useCallback(() => {
    if (!currentCall) return
    const newStatus = isOnHold ? 'answered' : 'on-hold'
    updateActiveCall(currentCall.id, { status: newStatus as ActiveCall['status'] })
    setIsOnHold((prev) => !prev)
  }, [currentCall, isOnHold, updateActiveCall])

  // Transfer call
  const handleTransfer = useCallback(() => {
    if (!currentCall || !transferTarget.trim()) return
    updateActiveCall(currentCall.id, { status: 'transferring' })
    emit('call:transfer', { callId: currentCall.id, target: transferTarget })
    setIsProcessing(true)
    setTimeout(() => {
      removeActiveCall(currentCall.id)
      setCurrentCallId(null)
      setShowTransfer(false)
      setTransferTarget('')
      setIsProcessing(false)
    }, 2000)
  }, [currentCall, transferTarget, updateActiveCall, removeActiveCall, setCurrentCallId, emit])

  // End call
  const handleEndCall = useCallback(() => {
    if (!currentCall) return
    updateActiveCall(currentCall.id, { status: 'ended' })
    emit('call:end', { callId: currentCall.id })
    setTimeout(() => {
      removeActiveCall(currentCall.id)
      setCurrentCallId(null)
    }, 500)
  }, [currentCall, updateActiveCall, removeActiveCall, setCurrentCallId, emit])

  // Toggle transfer dialog
  const handleToggleTransfer = useCallback(() => {
    setShowTransfer((prev) => !prev)
  }, [])

  // ─── Render ──────────────────────────────────────────────────────────────

  // If we have an active call, show the call view
  if (currentCall) {
    return (
      <div className="h-full overflow-y-auto custom-scrollbar p-4">
        <ActiveCallView
          call={currentCall}
          callTimer={callTimer}
          callNotes={callNotes}
          setCallNotes={setCallNotes}
          isMuted={isMuted}
          isOnHold={isOnHold}
          showTransfer={showTransfer}
          transferTarget={transferTarget}
          setTransferTarget={setTransferTarget}
          onToggleMute={handleToggleMute}
          onToggleHold={handleToggleHold}
          onTransfer={handleTransfer}
          onEndCall={handleEndCall}
          onToggleTransfer={handleToggleTransfer}
        />
      </div>
    )
  }

  // If we have a ringing call, show the incoming call alert
  if (ringingCall) {
    return (
      <div className="h-full overflow-y-auto custom-scrollbar p-4">
        <IncomingCallAlert
          call={ringingCall}
          onAnswer={handleAnswerCall}
          onDecline={handleDeclineCall}
        />
        <CallQueue calls={queueCalls} />
      </div>
    )
  }

  // Otherwise show empty state with history
  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-4">
      <EmptyState />
      <div className="mt-4 space-y-4">
        <CallQueue calls={activeCalls} />
        <CallHistory />
      </div>
    </div>
  )
}
