'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  MessageCircle,
  Phone,
  Globe,
  Mail,
  Clock,
  Send,
  ArrowUpRight,
  Activity,
  Languages,
  Bot,
  User,
  Sparkles,
  Loader2,
  MessageSquare,
  Play,
  Pause,
  Volume2,
  Download,
  Headphones,
  Circle,
} from 'lucide-react'
import { useAppStore, type TranscriptChunk, type AiSuggestion } from '@/store/app-store'
import { type AiMode } from '@/components/agent/ai-mode-config'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { AiModeSwitcher } from '@/components/agent/ai-mode-switcher'
import { TransferDialog } from '@/components/agent/transfer-dialog'
import { SttTranscriptView } from '@/components/agent/stt-transcript-view'
import { SendUaepassEmailDialog } from '@/components/agent/send-uaepass-email-dialog'
import { logEmployerAction } from '@/lib/employer-action-logger'
import { motion, AnimatePresence } from 'framer-motion'

// ─── Helpers ───────────────────────────────────────────────────────────────────

function ChannelIconElement({ channel, className }: { channel: string; className?: string }) {
  switch (channel) {
    case 'whatsapp': return <MessageCircle className={className} />
    case 'voice': return <Phone className={className} />
    case 'web': return <Globe className={className} />
    case 'email': return <Mail className={className} />
    default: return <MessageSquare className={className} />
  }
}

function getChannelLabel(channel: string, isAr: boolean): string {
  const labels: Record<string, { en: string; ar: string }> = {
    whatsapp: { en: 'WhatsApp', ar: 'واتساب' },
    voice: { en: 'Voice Call', ar: 'مكالمة صوتية' },
    web: { en: 'Web Chat', ar: 'دردشة ويب' },
    email: { en: 'Email', ar: 'بريد إلكتروني' },
  }
  const info = labels[channel]
  return info ? (isAr ? info.ar : info.en) : channel
}

function getLanguageFlag(lang: string): string {
  switch (lang) {
    case 'ar': return '🇦🇪'
    case 'en': return '🇬🇧'
    default: return '🌐'
  }
}

function getSentimentLabel(sentiment: number, isAr: boolean): string {
  if (sentiment >= 0.65) return isAr ? 'إيجابي' : 'Positive'
  if (sentiment >= 0.35) return isAr ? 'محايد' : 'Neutral'
  return isAr ? 'سلبي' : 'Negative'
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

interface ChatMessage {
  id: string
  role: 'customer' | 'agent' | 'ai'
  content: string
  timestamp: Date
  language?: string
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function ConversationDetail() {
  const {
    conversationSessions,
    selectedSessionId,
    sessionTranscript,
    setSessionTranscript,
    aiSuggestions,
    setAiSuggestions,
    language,
  } = useAppStore()

  const isAr = language === 'ar'
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [transferOpen, setTransferOpen] = useState(false)
  const [uaepassOpen, setUaepassOpen] = useState(false)
  const [showTranslation, setShowTranslation] = useState(false)
  const [recordingInfo, setRecordingInfo] = useState<{ hasRecording: boolean; durationSeconds: number; filePath: string } | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [audioCurrentTime, setCurrentTime] = useState(0)
  const [audioDuration, setAudioDuration] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const prevSessionIdRef = useRef<string | null>(null)

  const session = conversationSessions.find((s) => s.id === selectedSessionId) || null

  // Fetch messages/transcript for selected session
  useEffect(() => {
    if (!selectedSessionId) return
    // Reset when session changes
    if (prevSessionIdRef.current !== selectedSessionId) {
      prevSessionIdRef.current = selectedSessionId
      requestAnimationFrame(() => setChatMessages([]))
    }

    let cancelled = false

    const fetchMessages = async () => {
      try {
        const res = await fetch(`/api/conversations/${selectedSessionId}/messages?XTransformPort=3002`)
        if (res.ok && !cancelled) {
          const data = await res.json()
          const msgs: ChatMessage[] = (data.messages || data || []).map((m: Record<string, unknown>) => ({
            id: m.id as string || `msg-${Date.now()}-${Math.random()}`,
            role: (m.role as ChatMessage['role']) || 'customer',
            content: (m.content as string) || '',
            timestamp: new Date((m.timestamp as string) || Date.now()),
            language: m.language as string | undefined,
          }))
          if (!cancelled) {
            setChatMessages(msgs)
            setSessionTranscript([])
          }
        }
      } catch {
        // Silently fail
      }
    }

    const fetchTranscript = async () => {
      try {
        const res = await fetch(`/api/conversations/${selectedSessionId}/transcript?XTransformPort=3002`)
        if (res.ok && !cancelled) {
          const data = await res.json()
          const chunks: TranscriptChunk[] = (data.transcriptChunks || data.transcript || data || []).map((c: Record<string, unknown>) => ({
            id: c.id as string || `chunk-${Date.now()}`,
            speaker: c.speaker as TranscriptChunk['speaker'],
            text: c.text as string || '',
            textTranslation: (c.textTranslation as string | undefined) || (c.translatedText as string | undefined),
            language: c.language as string || 'en',
            timestamp: new Date((c.timestamp as string) || Date.now()),
          }))
          if (!cancelled) {
            // If STTTranscript table has data, use it directly
            if (chunks.length > 0) {
              setSessionTranscript(chunks)
              setChatMessages([])
            } else {
              // Fallback: use /messages endpoint which reads from session transcript JSON
              // This handles cases where STTTranscript wasn't populated (e.g., older sessions)
              try {
                const msgRes = await fetch(`/api/conversations/${selectedSessionId}/messages?XTransformPort=3002`)
                if (msgRes.ok && !cancelled) {
                  const msgData = await msgRes.json()
                  const msgs: ChatMessage[] = (msgData.messages || []).map((m: Record<string, unknown>) => ({
                    id: m.id as string || `msg-${Date.now()}-${Math.random()}`,
                    role: (m.role as ChatMessage['role']) || 'customer',
                    content: (m.content as string) || '',
                    timestamp: new Date((m.timestamp as string) || Date.now()),
                    language: m.language as string | undefined,
                  }))
                  // Convert chat messages to transcript chunks format for SttTranscriptView
                  const fallbackChunks: TranscriptChunk[] = msgs.map((m, idx) => ({
                    id: `chunk-fb-${idx}`,
                    speaker: m.role as TranscriptChunk['speaker'],
                    text: m.content,
                    language: m.language || 'en',
                    timestamp: m.timestamp,
                  }))
                  if (!cancelled) {
                    setSessionTranscript(fallbackChunks)
                    setChatMessages([])
                  }
                }
              } catch {
                // If fallback also fails, show empty transcript
                setSessionTranscript([])
                setChatMessages([])
              }
            }
          }
        }
      } catch {
        // Silently fail
      }
    }

    const fetchSuggestions = async () => {
      try {
        const res = await fetch(`/api/conversations/${selectedSessionId}/suggestions?XTransformPort=3002`)
        if (res.ok && !cancelled) {
          const data = await res.json()
          const suggestions: AiSuggestion[] = (data.suggestions || data || []).map((s: Record<string, unknown>) => ({
            id: s.id as string || `sug-${Date.now()}`,
            text: s.text as string || '',
            confidence: (s.confidence as number) || 0.5,
            type: (s.type as AiSuggestion['type']) || 'response',
          }))
          if (!cancelled) setAiSuggestions(suggestions)
        }
      } catch {
        // Silently fail
      }
    }

    // Initial fetch
    if (session?.channel === 'voice') {
      fetchTranscript()
    } else {
      fetchMessages()
    }
    fetchSuggestions()

    // Poll every 5 seconds for new messages (so admin sees customer WhatsApp messages in real-time)
    const interval = setInterval(() => {
      if (session?.channel === 'voice') {
        fetchTranscript()
      } else {
        fetchMessages()
      }
    }, 5000)

    return () => { cancelled = true; clearInterval(interval) }
  }, [selectedSessionId, session?.channel, setSessionTranscript, setAiSuggestions])

  // Fetch voice recording info
  useEffect(() => {
    if (!selectedSessionId || session?.channel !== 'voice') {
      // Not a voice session — clear recording info immediately
      setRecordingInfo(null)
      // Also stop any playing audio
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ''
        audioRef.current = null
        setIsPlaying(false)
        setCurrentTime(0)
        setAudioDuration(0)
      }
      return
    }

    // Clear stale recording info immediately when switching sessions,
    // before the async fetch completes
    setRecordingInfo(null)
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
      audioRef.current = null
      setIsPlaying(false)
      setCurrentTime(0)
      setAudioDuration(0)
    }

    let cancelled = false
    const fetchRecording = async () => {
      try {
        const res = await fetch(`/api/voice/recording/${selectedSessionId}?XTransformPort=3002`)
        if (res.ok && !cancelled) {
          const data = await res.json()
          if (data.hasRecording && data.recording) {
            setRecordingInfo({
              hasRecording: true,
              durationSeconds: data.recording.durationSeconds || 0,
              filePath: data.recording.filePath,
            })
          } else {
            setRecordingInfo(null)
          }
        }
      } catch {
        // Silently fail
      }
    }
    fetchRecording()
    const interval = setInterval(fetchRecording, 15000) // Poll every 15s for active calls
    return () => { cancelled = true; clearInterval(interval) }
  }, [selectedSessionId, session?.channel])

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ''
      }
    }
  }, [])

  const togglePlayPause = () => {
    if (!audioRef.current) {
      const audio = new Audio(`/api/voice/recording/${selectedSessionId}/audio?XTransformPort=3002`)
      audio.addEventListener('play', () => setIsPlaying(true))
      audio.addEventListener('pause', () => setIsPlaying(false))
      audio.addEventListener('ended', () => { setIsPlaying(false); setCurrentTime(0) })
      audio.addEventListener('timeupdate', () => setCurrentTime(audio.currentTime))
      audio.addEventListener('loadedmetadata', () => setAudioDuration(audio.duration))
      audio.play()
      audioRef.current = audio
    } else if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
  }

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  // Auto-scroll to bottom
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [chatMessages.length, sessionTranscript.length])

  // Send message — uses /api/conversations/:id/message (handles both transcript + WAMessage for WhatsApp)
  const handleSend = useCallback(async () => {
    if (!message.trim() || !selectedSessionId || !session) return
    setSending(true)

    const sentContent = message
    const newMsg: ChatMessage = {
      id: `agent-${Date.now()}`,
      role: 'agent',
      content: message,
      timestamp: new Date(),
      language: isAr ? 'ar' : 'en',
    }
    setChatMessages((prev) => [...prev, newMsg])
    setMessage('')

    try {
      // Single endpoint handles: transcript update + interaction + WAMessage (for WhatsApp)
      await fetch(`/api/conversations/${selectedSessionId}/message?XTransformPort=3002`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: sentContent,
          sender: 'agent',
          language: session.language || 'en',
        }),
      })
    } catch {
      // Silent
    }
    setSending(false)

    // Log send message action
    logEmployerAction({
      action: 'send_message',
      details: { sessionId: selectedSessionId, channel: session?.channel },
      channel: session?.channel as 'web' | 'whatsapp' | 'voice' | 'email' | undefined,
      targetId: selectedSessionId,
    })
  }, [message, selectedSessionId, session, isAr])

  // Use AI suggestion
  const handleUseSuggestion = (suggestion: AiSuggestion) => {
    setMessage(suggestion.text)
  }

  // No session selected
  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-ae-black-300 p-8 bg-white border border-ae-black-100 rounded-xl">
        <div className="bg-ae-black-50 rounded-full p-6 mb-4">
          <MessageSquare className="h-12 w-12 opacity-40" />
        </div>
        <h3 className="text-lg font-medium mb-2 text-ae-black-600">
          {isAr ? 'لم يتم اختيار محادثة' : 'No Conversation Selected'}
        </h3>
        <p className="text-sm text-center max-w-xs text-ae-black-400">
          {isAr
            ? 'اختر محادثة من القائمة لعرض التفاصيل'
            : 'Select a conversation from the list to view details'}
        </p>
      </div>
    )
  }

  const isTextChannel = session.channel !== 'voice'
  const initials = session.customerName.split(' ').map((n) => n[0]).join('').slice(0, 2)

  return (
    <div className="flex flex-col h-full min-h-0 bg-white border border-ae-black-100 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-ae-black-100 bg-gradient-to-r from-ae-gold-50/30 to-white">
        <div className="flex items-center gap-3">
          {/* Customer Avatar */}
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-ae-gold-500 text-white text-sm font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>

          {/* Customer Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-ae-black-800 truncate">{session.customerName}</h3>
              <Badge variant="secondary" className="gap-1 text-[10px] shrink-0">
                <ChannelIconElement channel={session.channel} className="w-3 h-3" />
                {getChannelLabel(session.channel, isAr)}
              </Badge>
              <span className="text-sm" title={session.language}>
                {getLanguageFlag(session.language)}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-0.5 text-[11px] text-ae-black-400">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDuration(session.duration)}
              </span>
              <span className="flex items-center gap-1">
                <Activity className="w-3 h-3" />
                {getSentimentLabel(session.sentiment, isAr)}
              </span>
              <span className="flex items-center gap-1">
                <Languages className="w-3 h-3" />
                {session.language === 'ar' ? (isAr ? 'عربي' : 'Arabic') : (isAr ? 'إنجليزي' : 'EN')}
              </span>
              {/* Call status for voice sessions */}
              {session.channel === 'voice' && (
                <Badge className={`text-[8px] px-1.5 py-0 h-4 ${
                  session.status === 'active'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {session.status === 'active'
                    ? (isAr ? 'مكالمة جارية' : 'Live Call')
                    : (isAr ? 'انتهت المكالمة' : 'Call Ended')}
                </Badge>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Open Email Inbox for email conversations */}
            {session.channel === 'email' && (
              <Button
                size="sm"
                variant="outline"
                className="text-[10px] h-7 gap-1 border-orange-200 text-orange-600 hover:bg-orange-50"
                onClick={() => useAppStore.getState().setView('email')}
              >
                <Mail className="w-3 h-3" />
                {isAr ? 'صندوق البريد' : 'Email Inbox'}
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="text-[10px] h-7 gap-1 border-orange-200 text-orange-600 hover:bg-orange-50"
              onClick={() => setTransferOpen(true)}
            >
              <ArrowUpRight className="w-3 h-3" />
              {isAr ? 'نقل' : 'Transfer'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-[10px] h-7 gap-1 border-ae-gold-200 text-ae-gold-600 hover:bg-ae-gold-50"
              onClick={() => setUaepassOpen(true)}
            >
              <Mail className="w-3 h-3" />
              {isAr ? 'هوية الإمارات' : 'UAE PASS'}
            </Button>
          </div>
        </div>

        {/* AI Mode Switcher */}
        <div className="shrink-0 mt-3">
          <AiModeSwitcher
            sessionId={session.id}
            currentMode={session.aiMode}
            language={session.language}
          />
        </div>
      </div>

      {/* Message/Transcript Area — flex-1 with min-h-0 for proper internal scroll */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-4 bg-ae-black-50/20">
        {isTextChannel ? (
          /* Text Chat Messages */
          <div className="space-y-3 max-w-2xl mx-auto">
            <AnimatePresence mode="popLayout">
              {chatMessages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex ${msg.role === 'agent' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      msg.role === 'customer'
                        ? 'bg-gradient-to-br from-ae-gold-50 to-ae-gold-100/50 text-ae-black-800 rounded-bl-md'
                        : msg.role === 'agent'
                        ? 'bg-ae-gold-500 text-white rounded-br-md'
                        : 'bg-ae-black-50/50 text-ae-black-800 border border-ae-black-100 rounded-bl-md'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      {msg.role === 'ai' && (
                        <Badge variant="secondary" className="text-[8px] h-3.5 px-1 gap-0.5 bg-ae-gold-100 text-ae-gold-700">
                          <Bot className="w-2.5 h-2.5" />
                          {isAr ? 'ذكاء' : 'AI'}
                        </Badge>
                      )}
                      {msg.role === 'agent' && (
                        <Badge variant="secondary" className="text-[8px] h-3.5 px-1 gap-0.5 bg-ae-gold-200 text-ae-gold-800">
                          <User className="w-2.5 h-2.5" />
                          {isAr ? 'موظف' : 'Agent'}
                        </Badge>
                      )}
                      {msg.role === 'customer' && (
                        <Badge variant="outline" className="text-[8px] h-3.5 px-1">
                          {isAr ? 'عميل' : 'Customer'}
                        </Badge>
                      )}
                      {msg.language && (
                        <span className="text-[9px] opacity-50">{msg.language === 'ar' ? (isAr ? 'عربي' : 'Arabic') : (isAr ? 'إنجليزي' : 'EN')}</span>
                      )}
                    </div>
                    <p>{msg.content}</p>
                    <p className="text-[10px] mt-1 opacity-50">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {chatMessages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-ae-black-300">
                <MessageSquare className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-xs">{isAr ? 'لا توجد رسائل بعد' : 'No messages yet'}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Voice Call Recording Player */}
            {recordingInfo?.hasRecording && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-r from-teal-50 to-teal-100/50 border border-teal-200 rounded-xl p-4"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-teal-500 flex items-center justify-center">
                    <Headphones className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-teal-800">
                      {isAr ? 'تسجيل المكالمة' : 'Call Recording'}
                    </h4>
                    <p className="text-[10px] text-teal-600">
                      {recordingInfo.durationSeconds > 0
                        ? `${formatTime(recordingInfo.durationSeconds)} ${isAr ? 'مدة التسجيل' : 'duration'}`
                        : isAr ? 'جاري المعالجة...' : 'Processing...'
                      }
                    </p>
                  </div>
                  <a
                    href={`/api/voice/recording/${selectedSessionId}/audio?XTransformPort=3002`}
                    download
                    className="h-8 w-8 rounded-lg bg-teal-200 hover:bg-teal-300 flex items-center justify-center transition-colors"
                    title={isAr ? 'تنزيل التسجيل' : 'Download recording'}
                  >
                    <Download className="w-4 h-4 text-teal-700" />
                  </a>
                </div>

                {/* Audio Progress Bar */}
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={togglePlayPause}
                      className="h-9 w-9 rounded-full bg-teal-500 hover:bg-teal-600 flex items-center justify-center transition-colors shrink-0"
                    >
                      {isPlaying ? (
                        <Pause className="w-4 h-4 text-white" />
                      ) : (
                        <Play className="w-4 h-4 text-white ml-0.5" />
                      )}
                    </button>
                    <div className="flex-1">
                      <div
                        className="h-2 bg-teal-200 rounded-full overflow-hidden cursor-pointer relative"
                        onClick={(e) => {
                          if (!audioRef.current || !audioDuration) return
                          const rect = e.currentTarget.getBoundingClientRect()
                          const x = e.clientX - rect.left
                          const pct = x / rect.width
                          audioRef.current.currentTime = pct * audioDuration
                          setCurrentTime(pct * audioDuration)
                        }}
                      >
                        <div
                          className="h-full bg-teal-500 rounded-full transition-all duration-300"
                          style={{ width: `${audioDuration > 0 ? (audioCurrentTime / audioDuration) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-[10px] text-teal-600 font-mono shrink-0">
                      {formatTime(audioCurrentTime)} / {formatTime(audioDuration || recordingInfo.durationSeconds)}
                    </span>
                  </div>

                  {/* Speaker Timeline Segments */}
                  {sessionTranscript.length > 0 && audioDuration > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
                        <span>{isAr ? 'المتحدثون' : 'Speakers'}</span>
                        <span className="flex items-center gap-1"><Circle className="w-2 h-2 fill-blue-500 text-blue-500" />{isAr ? 'عميل' : 'Customer'}</span>
                        <span className="flex items-center gap-1"><Circle className="w-2 h-2 fill-purple-500 text-purple-500" />AI</span>
                        <span className="flex items-center gap-1"><Circle className="w-2 h-2 fill-amber-500 text-amber-500" />{isAr ? 'موظف' : 'Agent'}</span>
                      </div>
                      <div className="h-3 bg-gray-100 rounded-full overflow-hidden flex">
                        {sessionTranscript.map((chunk, idx) => {
                          const chunkStart = new Date(chunk.timestamp).getTime()
                          const sessionStart = sessionTranscript[0]?.timestamp ? new Date(sessionTranscript[0].timestamp).getTime() : chunkStart
                          const chunkOffset = Math.max(0, (chunkStart - sessionStart) / 1000)
                          const chunkPct = audioDuration > 0 ? (chunkOffset / audioDuration) * 100 : 0
                          // Estimate segment width based on text length (rough approximation)
                          const estimatedWidth = Math.min(15, Math.max(3, chunk.text.length / 3))
                          const speakerColor = chunk.speaker === 'customer' ? 'bg-blue-400' : chunk.speaker === 'ai' ? 'bg-purple-400' : 'bg-amber-400'
                          return (
                            <div
                              key={chunk.id}
                              className={`h-full ${speakerColor} opacity-70 first:rounded-l-full last:rounded-r-full`}
                              style={{
                                marginLeft: idx === 0 ? `${chunkPct}%` : '1px',
                                width: `${estimatedWidth}%`,
                                minWidth: '2%',
                                maxWidth: '20%',
                              }}
                              title={`${chunk.speaker === 'customer' ? 'Customer' : chunk.speaker === 'ai' ? 'AI' : 'Agent'}: ${chunk.text.slice(0, 50)}...`}
                            />
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Waiting for recording (active call) */}
            {!recordingInfo?.hasRecording && session?.channel === 'voice' && (
              <div className="bg-teal-50/50 border border-teal-100 rounded-lg px-3 py-2 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
                <span className="text-[11px] text-teal-600">
                  {isAr ? 'سيكون التسجيل الصوتي متاحاً بعد انتهاء المكالمة' : 'Audio recording will be available after the call ends'}
                </span>
              </div>
            )}

            {/* Voice Transcript View */}
            <SttTranscriptView
              transcript={sessionTranscript}
              showTranslation={showTranslation}
              onToggleTranslation={() => setShowTranslation(!showTranslation)}
              audioCurrentTime={audioCurrentTime}
              audioDuration={audioDuration || recordingInfo?.durationSeconds || 0}
              isAudioPlaying={isPlaying}
            />
          </div>
        )}
      </div>

      {/* AI Suggestions Panel */}
      {aiSuggestions.length > 0 && (
        <div className="shrink-0 px-4 py-2 border-t border-ae-black-100 bg-ae-gold-50/20">
          <div className="flex items-center gap-2 mb-1.5">
            <Sparkles className="w-3.5 h-3.5 text-ae-gold-500" />
            <span className="text-[10px] font-semibold text-ae-gold-600 uppercase tracking-wider">
              {isAr ? 'اقتراحات الذكاء الاصطناعي' : 'AI Suggestions'}
            </span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {aiSuggestions.map((suggestion) => (
              <motion.button
                key={suggestion.id}
                onClick={() => handleUseSuggestion(suggestion)}
                className="shrink-0 text-start px-3 py-2 rounded-lg bg-white border border-ae-gold-200 hover:border-ae-gold-400 hover:bg-ae-gold-50 transition-colors max-w-[250px]"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <p className="text-[11px] text-ae-black-700 line-clamp-2">{suggestion.text}</p>
                <div className="flex items-center gap-1 mt-1">
                  <Badge
                    variant="outline"
                    className={`text-[8px] px-1 py-0 h-3 ${
                      suggestion.type === 'response'
                        ? 'border-green-200 text-green-600'
                        : suggestion.type === 'action'
                        ? 'border-amber-200 text-amber-600'
                        : 'border-teal-200 text-teal-600'
                    }`}
                  >
                    {suggestion.type}
                  </Badge>
                  <span className="text-[8px] text-ae-black-300">
                    {(suggestion.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* Message Input (for text channels) */}
      {isTextChannel && (
        <div className="shrink-0 px-4 py-3 border-t border-ae-black-100 bg-white">
          <div className="flex items-center gap-2">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={isAr ? 'اكتب رسالتك...' : 'Type your message...'}
              className="flex-1 min-h-[40px] max-h-[80px] text-sm resize-none border-ae-black-100 focus:border-ae-gold-300"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
            />
            <Button
              onClick={handleSend}
              disabled={!message.trim() || sending}
              className="h-10 w-10 p-0 bg-ae-gold-500 hover:bg-ae-gold-600 text-white rounded-lg shrink-0"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}

      {/* Transfer Dialog */}
      <TransferDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        sessionId={session.id}
        customerName={session.customerName}
      />

      {/* UAE PASS Email Dialog */}
      <SendUaepassEmailDialog
        open={uaepassOpen}
        onOpenChange={setUaepassOpen}
        customerName={session.customerName}
        customerId={session.customerId}
      />
    </div>
  )
}
