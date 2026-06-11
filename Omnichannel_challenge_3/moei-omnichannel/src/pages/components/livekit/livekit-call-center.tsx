'use client'

/**
 * LiveKit Call Center — Voice agent session using LiveKit's real-time framework
 * Uses LiveKit's agent-starter-react UI design adapted for MOEI
 * Provides real voice calls with STT → LLM → TTS pipeline via LiveKit + Gemini
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  RoomAudioRenderer,
  SessionProvider,
  useChat,
  useLocalParticipant,
  useRoomContext,
  useSession,
  useSessionContext,
  useSessionMessages,
  useVoiceAssistant,
} from '@livekit/components-react'
import { TokenSource, Track } from 'livekit-client'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mic,
  MicOff,
  PhoneOff,
  MessageSquare,
  Send,
  Loader2,
  PhoneCall,
  Volume2,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

// ─── Audio Visualizer ────────────────────────────────────────────────────────

function AudioVisualizer({ state, isRTL }: { state: string; isRTL: boolean }) {
  const barCount = 5
  const [highlighted, setHighlighted] = useState<number[]>([2])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const idxRef = useRef(0)

  useEffect(() => {
    const speeds: Record<string, number> = {
      connecting: 400,
      initializing: 800,
      listening: 300,
      thinking: 120,
      speaking: 80,
    }
    const speed = speeds[state] || 300

    if (timerRef.current) clearInterval(timerRef.current)

    timerRef.current = setInterval(() => {
      if (state === 'connecting' || state === 'listening') {
        idxRef.current = (idxRef.current + 1) % barCount
        setHighlighted([idxRef.current])
      } else if (state === 'thinking') {
        setHighlighted([
          Math.floor(Math.random() * barCount),
          Math.floor(Math.random() * barCount),
        ])
      } else if (state === 'speaking') {
        const center = Math.floor(barCount / 2)
        const spread = Math.random() > 0.5 ? 1 : 0
        setHighlighted(
          [center - spread, center, center + spread].filter((i) => i >= 0 && i < barCount)
        )
      } else {
        setHighlighted([Math.floor(barCount / 2)])
      }
    }, speed)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [state])

  const stateLabels: Record<string, { en: string; ar: string }> = {
    connecting: { en: 'Connecting...', ar: 'يتصل...' },
    initializing: { en: 'Initializing...', ar: 'يبدأ...' },
    listening: { en: 'Listening...', ar: 'يستمع...' },
    thinking: { en: 'Thinking...', ar: 'يفكر...' },
    speaking: { en: 'Speaking...', ar: 'يتحدث...' },
    disconnected: { en: 'Disconnected', ar: 'غير متصل' },
  }

  const label = stateLabels[state] || { en: 'Idle', ar: 'خامل' }

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex items-end justify-center gap-3 h-32">
        {Array.from({ length: barCount }).map((_, i) => {
          const isHighlighted = highlighted.includes(i)
          const height =
            state === 'speaking' && isHighlighted
              ? `${40 + Math.random() * 60}%`
              : isHighlighted
                ? '60%'
                : '15%'

          return (
            <motion.div
              key={i}
              animate={{
                height,
                backgroundColor: isHighlighted
                  ? state === 'speaking'
                    ? '#7c3aed'
                    : state === 'thinking'
                      ? '#f59e0b'
                      : '#6366f1'
                  : '#e2e8f0',
              }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="w-3 rounded-full bg-slate-200 dark:bg-slate-700"
              style={{ minHeight: '8px' }}
            />
          )
        })}
      </div>

      <motion.div
        key={state}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2"
      >
        <Badge
          variant="outline"
          className={`text-xs font-medium ${
            state === 'speaking'
              ? 'bg-violet-100 text-violet-700 border-violet-200'
              : state === 'thinking'
                ? 'bg-amber-100 text-amber-700 border-amber-200'
                : state === 'listening'
                  ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                  : 'bg-slate-100 text-slate-600 border-slate-200'
          }`}
        >
          {state === 'thinking' && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
          {isRTL ? label.ar : label.en}
        </Badge>
      </motion.div>
    </div>
  )
}

// ─── Chat Transcript ─────────────────────────────────────────────────────────

function ChatTranscript({ isRTL }: { isRTL: boolean }) {
  const session = useSessionContext()
  const { messages } = useSessionMessages(session)

  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <motion.div
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Volume2 className="w-8 h-8 text-violet-400 mx-auto mb-2" />
          </motion.div>
          <p className="text-xs text-muted-foreground">
            {isRTL ? 'في انتظار بدء المحادثة...' : 'Waiting for conversation to start...'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3 overflow-y-auto max-h-full custom-scrollbar p-2">
      {messages.map((msg, i) => {
        const isUser = msg.from?.isLocal
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                isUser
                  ? 'bg-violet-600 text-white rounded-br-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-foreground rounded-bl-sm'
              }`}
            >
              {msg.message}
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

// ─── Chat Input ──────────────────────────────────────────────────────────────

function ChatInput({ isRTL }: { isRTL: boolean }) {
  const [message, setMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const { send } = useChat()

  const handleSend = useCallback(async () => {
    if (!message.trim() || isSending) return
    try {
      setIsSending(true)
      await send(message.trim())
      setMessage('')
    } catch (err) {
      console.error('Failed to send message:', err)
    } finally {
      setIsSending(false)
    }
  }, [message, isSending, send])

  return (
    <div className="flex items-center gap-2 p-2 border-t border-violet-100 dark:border-violet-900/50">
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
          }
        }}
        placeholder={isRTL ? 'اكتب رسالتك...' : 'Type a message...'}
        disabled={isSending}
        className="flex-1 px-3 py-2 rounded-lg border border-violet-200 dark:border-violet-800 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:opacity-50"
        dir={isRTL ? 'rtl' : 'ltr'}
      />
      <Button
        onClick={handleSend}
        disabled={!message.trim() || isSending}
        size="icon"
        className="h-9 w-9 rounded-lg bg-violet-600 hover:bg-violet-700 text-white flex-shrink-0"
      >
        {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
      </Button>
    </div>
  )
}

// ─── Session View (Connected) ────────────────────────────────────────────────

function SessionView({ isRTL }: { isRTL: boolean }) {
  const session = useSessionContext()
  const [isMuted, setIsMuted] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const { localParticipant } = useLocalParticipant()
  const { state: agentState } = useVoiceAssistant()

  const handleToggleMute = useCallback(() => {
    const micTrack = localParticipant.getTrackPublication(Track.Source.Microphone)
    if (micTrack?.track) {
      micTrack.track.enabled = !micTrack.track.enabled
      setIsMuted(!micTrack.track.enabled)
    }
  }, [localParticipant, isMuted])

  const handleDisconnect = useCallback(() => {
    session.end()
  }, [session])

  return (
    <div className="flex flex-col h-full" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-700 to-purple-600 text-white px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center">
          <PhoneCall className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold">
            {isRTL ? 'مركز الاتصال الذكي' : 'AI Call Center'}
          </h3>
          <p className="text-[11px] text-white/80">{isRTL ? 'مكالمة نشطة' : 'Active Call'}</p>
        </div>
        <Badge className="bg-white/20 text-white border-0 text-[10px] hover:bg-white/20">
          <Sparkles className="w-3 h-3 mr-1" />
          {isRTL ? 'ذكاء اصطناعي' : 'AI'}
        </Badge>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-hidden bg-gradient-to-b from-violet-50/50 to-white dark:from-[#0f0a1e] dark:to-background flex flex-col min-h-0">
        <AnimatePresence mode="wait">
          {chatOpen ? (
            <motion.div
              key="chat"
              initial={{ opacity: 0, x: isRTL ? -20 : 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isRTL ? -20 : 20 }}
              className="flex-1 flex flex-col min-h-0"
            >
              <div className="flex-1 overflow-y-auto p-4">
                <ChatTranscript isRTL={isRTL} />
              </div>
              <ChatInput isRTL={isRTL} />
            </motion.div>
          ) : (
            <motion.div
              key="visualizer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center px-4"
            >
              <AudioVisualizer state={agentState || 'connecting'} isRTL={isRTL} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Control Bar */}
      <div className="p-4 border-t border-violet-100 dark:border-violet-900/50 bg-white dark:bg-[#0f0a1e] flex-shrink-0">
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={handleToggleMute}
            className={`h-12 w-12 rounded-full transition-all ${
              isMuted
                ? 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'
                : 'bg-violet-50 border-violet-200 text-violet-600 hover:bg-violet-100'
            }`}
            title={isMuted ? (isRTL ? 'إلغاء كتم' : 'Unmute') : isRTL ? 'كتم' : 'Mute'}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={() => setChatOpen(!chatOpen)}
            className={`h-12 w-12 rounded-full transition-all ${
              chatOpen
                ? 'bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100'
                : 'bg-violet-50 border-violet-200 text-violet-600 hover:bg-violet-100'
            }`}
            title={isRTL ? 'المحادثة' : 'Chat'}
          >
            <MessageSquare className="w-5 h-5" />
          </Button>

          <Button
            onClick={handleDisconnect}
            className="h-14 w-14 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30 transition-all"
            title={isRTL ? 'إنهاء المكالمة' : 'End Call'}
          >
            <PhoneOff className="w-6 h-6" />
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Welcome View ────────────────────────────────────────────────────────────

function WelcomeView({
  onStartCall,
  isConnecting,
  isRTL,
  error,
}: {
  onStartCall: () => void
  isConnecting: boolean
  isRTL: boolean
  error?: string | null
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center h-full text-center px-6"
    >
      <div className="relative mb-8">
        <motion.div
          className="absolute inset-0 w-28 h-28 rounded-full bg-violet-400/20"
          animate={{ scale: [1, 1.3, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <div className="relative w-28 h-28 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
          <PhoneCall className="w-12 h-12 text-white" />
        </div>
      </div>

      <h3 className="text-xl font-semibold text-foreground mb-2">
        {isRTL ? 'مركز الاتصال الذكي' : 'AI Call Center'}
      </h3>
      <p className="text-sm text-muted-foreground mb-8 max-w-xs">
        {isRTL
          ? 'تحدث مع المساعد الذكي لوزارة الطاقة والبنية التحتية'
          : "Speak with MOEI's AI-powered voice assistant"}
      </p>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 px-4 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg max-w-xs"
        >
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        </motion.div>
      )}

      <Button
        onClick={onStartCall}
        disabled={isConnecting}
        size="lg"
        className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white rounded-full px-10 h-14 shadow-lg shadow-violet-500/30 text-sm font-bold tracking-wider uppercase"
      >
        {isConnecting ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            {isRTL ? 'يتصل...' : 'Connecting...'}
          </>
        ) : (
          <>
            <PhoneCall className="w-5 h-5 mr-2" />
            {isRTL ? 'ابدأ المكالمة' : 'Start Call'}
          </>
        )}
      </Button>
    </motion.div>
  )
}

// ─── Main LiveKit Call Center Component ──────────────────────────────────────

interface LiveKitCallCenterProps {
  isRTL: boolean
  onClose?: () => void
}

export function LiveKitCallCenter({ isRTL, onClose = () => console.warn('Missing handler: LiveKitCallCenter.onClose') }: LiveKitCallCenterProps) {
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tokenSource = useMemo(() => {
    return TokenSource.custom(async (options) => {
      const resp = await fetch('/api/livekit/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantName: options?.participantName || 'customer',
          roomName: options?.roomName,
          participantIdentity: options?.participantIdentity,
          agentName: options?.agentName,
        }),
      })
      if (!resp.ok) throw new Error('Failed to get LiveKit token')
      return resp.json()
    })
  }, [])

  const session = useSession(tokenSource, { agentName: 'moei-voice-agent' })

  const handleStartCall = useCallback(async () => {
    setIsConnecting(true)
    setError(null)
    try {
      await session.start()
    } catch (err) {
      console.error('[LiveKit] Failed to connect:', err)
      setError(err instanceof Error ? err.message : 'Connection failed')
    } finally {
      setIsConnecting(false)
    }
  }, [session])

  const isConnected = session.isConnected

  return (
    <SessionProvider session={session}>
      <div className="h-full flex flex-col rounded-xl overflow-hidden border border-violet-100 dark:border-violet-900/50 shadow-lg">
        <AnimatePresence mode="wait">
          {!isConnected ? (
            <motion.div
              key="welcome"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1"
            >
              <WelcomeView
                onStartCall={handleStartCall}
                isConnecting={isConnecting}
                isRTL={isRTL}
                error={error}
              />
            </motion.div>
          ) : (
            <motion.div
              key="session"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 min-h-0"
            >
              <SessionView isRTL={isRTL} />
            </motion.div>
          )}
        </AnimatePresence>
        <RoomAudioRenderer />
      </div>
    </SessionProvider>
  )
}
