'use client'

import { useRef, useEffect, useMemo } from 'react'
import { User, Bot, Headphones, Languages, ChevronDown, ChevronUp, Volume2 } from 'lucide-react'
import type { TranscriptChunk } from '@/store/app-store'
import { useAppStore } from '@/store/app-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { motion, AnimatePresence } from 'framer-motion'

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getSpeakerIcon(speaker: TranscriptChunk['speaker']) {
  switch (speaker) {
    case 'customer': return User
    case 'agent': return Headphones
    case 'ai': return Bot
    default: return User
  }
}

function getSpeakerEmoji(speaker: TranscriptChunk['speaker']): string {
  switch (speaker) {
    case 'customer': return '\u{1F9D1}'
    case 'agent': return '\u{1F464}'
    case 'ai': return '\u{1F916}'
    default: return '\u{1F9D1}'
  }
}

function getSpeakerLabel(speaker: TranscriptChunk['speaker'], isAr: boolean, agentName?: string): string {
  const labels: Record<string, { en: string; ar: string }> = {
    customer: { en: 'Customer', ar: 'العميل' },
    agent: { en: agentName || 'Employer', ar: agentName ? `الموظف: ${agentName}` : 'الموظف' },
    ai: { en: 'AI Agent', ar: 'وكيل الذكاء' },
  }
  const info = labels[speaker] || labels.customer
  return isAr ? info.ar : info.en
}

function getSpeakerColor(speaker: TranscriptChunk['speaker'], isActive?: boolean): string {
  const activeRing = isActive ? 'ring-2 ring-offset-1 ring-blue-400 shadow-md' : ''
  switch (speaker) {
    case 'customer': return `bg-blue-50 border-blue-300 border-l-[3px] border-l-blue-500 ${activeRing}`
    case 'agent': return `bg-amber-50 border-amber-300 border-l-[3px] border-l-amber-500 ${activeRing}`
    case 'ai': return `bg-purple-50 border-purple-300 border-l-[3px] border-l-purple-500 ${activeRing}`
    default: return `bg-gray-50 border-gray-300 border-l-[3px] border-l-gray-400 ${activeRing}`
  }
}

function getSpeakerBadgeColor(speaker: TranscriptChunk['speaker']): string {
  switch (speaker) {
    case 'customer': return 'bg-blue-100 text-blue-700'
    case 'agent': return 'bg-amber-100 text-amber-700'
    case 'ai': return 'bg-purple-100 text-purple-700'
    default: return 'bg-gray-100 text-gray-700'
  }
}

function getSpeakerAvatarBg(speaker: TranscriptChunk['speaker']): string {
  switch (speaker) {
    case 'customer': return 'bg-blue-500 text-white'
    case 'agent': return 'bg-amber-500 text-white'
    case 'ai': return 'bg-purple-500 text-white'
    default: return 'bg-gray-400 text-white'
  }
}

function getSpeakerAvatarLetter(speaker: TranscriptChunk['speaker']): string {
  switch (speaker) {
    case 'customer': return 'C'
    case 'agent': return 'E' // Employer
    case 'ai': return 'AI'
    default: return '?'
  }
}

function getLanguageFlag(lang: string): string {
  switch (lang) {
    case 'ar': return '🇦🇪'
    case 'en': return '🇬🇧'
    default: return '🌐'
  }
}

// ─── Compute active speaker based on audio time ──────────────────────────────

function computeActiveSpeakerIndex(
  transcript: TranscriptChunk[],
  audioCurrentTime: number,
  audioDuration: number
): number {
  if (transcript.length === 0 || audioDuration <= 0) return -1

  const sessionStart = new Date(transcript[0].timestamp).getTime()
  let activeIdx = -1

  for (let i = 0; i < transcript.length; i++) {
    const chunkTime = new Date(transcript[i].timestamp).getTime()
    const offsetSec = (chunkTime - sessionStart) / 1000
    if (offsetSec <= audioCurrentTime) {
      activeIdx = i
    } else {
      break
    }
  }

  return activeIdx
}

// ─── Component ─────────────────────────────────────────────────────────────────

interface SttTranscriptViewProps {
  transcript: TranscriptChunk[]
  showTranslation: boolean
  onToggleTranslation: () => void
  /** Current audio playback time in seconds — used to highlight active speaker */
  audioCurrentTime?: number
  /** Total audio duration in seconds */
  audioDuration?: number
  /** Whether audio is currently playing */
  isAudioPlaying?: boolean
}

export function SttTranscriptView({
  transcript,
  showTranslation,
  onToggleTranslation,
  audioCurrentTime = 0,
  audioDuration = 0,
  isAudioPlaying = false,
}: SttTranscriptViewProps) {
  const { language, currentAgent } = useAppStore()
  const isAr = language === 'ar'
  const scrollRef = useRef<HTMLDivElement>(null)

  // Compute which transcript chunk is currently "speaking" based on audio time
  const activeSpeakerIndex = useMemo(() => {
    if (!isAudioPlaying || audioDuration <= 0) return -1
    return computeActiveSpeakerIndex(transcript, audioCurrentTime, audioDuration)
  }, [transcript, audioCurrentTime, audioDuration, isAudioPlaying])

  // Auto-scroll to latest chunk
  useEffect(() => {
    // If playing, scroll to active speaker; otherwise scroll to bottom
    if (activeSpeakerIndex >= 0) {
      const el = scrollRef.current
      if (el) {
        const activeEl = el.querySelector(`[data-chunk-idx="${activeSpeakerIndex}"]`)
        if (activeEl) {
          activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }
    } else {
      const el = scrollRef.current
      if (el) el.scrollTop = el.scrollHeight
    }
  }, [transcript.length, activeSpeakerIndex])

  // Count speakers
  const speakerCounts = useMemo(() => {
    const counts: Record<string, number> = { customer: 0, agent: 0, ai: 0 }
    transcript.forEach((c) => { counts[c.speaker] = (counts[c.speaker] || 0) + 1 })
    return counts
  }, [transcript])

  if (transcript.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-ae-black-300">
        <Headphones className="h-8 w-8 mb-2 opacity-30" />
        <p className="text-xs">{isAr ? 'لا يوجد نص بعد' : 'No transcript yet'}</p>
        <p className="text-[10px] text-ae-black-200 mt-1">
          {isAr
            ? 'سيظهر النص عندما تبدأ المكالمة'
            : 'Transcript will appear here when the call starts'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* Translation Toggle */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] gap-1 border-ae-gold-200 text-ae-gold-600">
            <Headphones className="w-3 h-3" />
            {isAr ? 'نسخ صوتي مباشر' : 'Live STT Transcript'}
          </Badge>
          <span className="text-[10px] text-ae-black-300">
            {transcript.length} {isAr ? 'أجزاء' : 'chunks'}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-[10px] gap-1"
          onClick={onToggleTranslation}
        >
          <Languages className="w-3 h-3" />
          {showTranslation ? (isAr ? 'إخفاء الترجمة' : 'Hide Translation') : (isAr ? 'عرض الترجمة' : 'Show Translation')}
          {showTranslation ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </Button>
      </div>

      {/* Speaker Legend with chunk counts */}
      <div className="flex items-center gap-3 px-1 py-1.5 text-[10px] text-muted-foreground flex-wrap bg-ae-black-50/50 rounded-lg">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
          <User className="w-3 h-3" />
          {isAr ? 'العميل' : 'Customer'}
          {speakerCounts.customer > 0 && <span className="text-ae-black-300">({speakerCounts.customer})</span>}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-purple-500" />
          <Bot className="w-3 h-3" />
          {isAr ? 'وكيل الذكاء' : 'AI Agent'}
          {speakerCounts.ai > 0 && <span className="text-ae-black-300">({speakerCounts.ai})</span>}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
          <Headphones className="w-3 h-3" />
          {isAr ? 'الموظف' : 'Employer'}
          {speakerCounts.agent > 0 && <span className="text-ae-black-300">({speakerCounts.agent})</span>}
        </span>
      </div>

      {/* Currently playing indicator */}
      {isAudioPlaying && activeSpeakerIndex >= 0 && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 px-2 py-1.5 bg-blue-50 border border-blue-200 rounded-lg"
        >
          <Volume2 className="w-3.5 h-3.5 text-blue-500 animate-pulse" />
          <span className="text-[10px] font-medium text-blue-700">
            {isAr ? 'يتحدث الآن:' : 'Now speaking:'} {getSpeakerLabel(transcript[activeSpeakerIndex]?.speaker, isAr, currentAgent?.name)}
          </span>
        </motion.div>
      )}

      {/* Transcript chunks */}
      <div ref={scrollRef} className="max-h-64 overflow-y-auto custom-scrollbar space-y-2">
        <AnimatePresence mode="popLayout">
          {transcript.map((chunk, idx) => {
            const SpeakerIcon = getSpeakerIcon(chunk.speaker)
            const isLatest = idx === transcript.length - 1
            const isActive = idx === activeSpeakerIndex

            return (
              <motion.div
                key={chunk.id}
                data-chunk-idx={idx}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, delay: isLatest ? 0.05 : 0 }}
                className={`rounded-lg border px-3 py-2 transition-all duration-300 ${
                  getSpeakerColor(chunk.speaker, isActive)
                } ${isLatest && !isActive ? 'ring-1 ring-blue-300' : ''}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {/* Speaker avatar circle */}
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[7px] font-bold shrink-0 ${getSpeakerAvatarBg(chunk.speaker)}`}>
                    {getSpeakerAvatarLetter(chunk.speaker)}
                  </div>
                  <Badge className={`text-[8px] px-1.5 py-0 h-4 gap-0.5 ${getSpeakerBadgeColor(chunk.speaker)}`}>
                    <SpeakerIcon className="w-2.5 h-2.5" />
                    {getSpeakerLabel(chunk.speaker, isAr, chunk.speaker === 'agent' ? currentAgent?.name : undefined)}
                  </Badge>
                  {/* Active speaker indicator */}
                  {isActive && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="flex items-center gap-0.5"
                    >
                      <Volume2 className="w-3 h-3 text-blue-500" />
                      <span className="text-[8px] text-blue-500 font-medium">
                        {isAr ? 'يتحدث' : 'speaking'}
                      </span>
                    </motion.div>
                  )}
                  <span className="text-[9px]" title={chunk.language}>
                    {getLanguageFlag(chunk.language)}
                  </span>
                  <span className="text-[9px] text-ae-black-300 ms-auto">
                    {new Date(chunk.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                </div>
                <p className={`text-sm leading-relaxed ${
                  isActive ? 'text-ae-black-900 font-medium' : 'text-ae-black-700'
                }`}>
                  {chunk.text}
                </p>
                {showTranslation && chunk.textTranslation && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="text-xs text-ae-black-400 mt-1 pt-1 border-t border-ae-black-100/50 italic"
                  >
                    {chunk.textTranslation}
                  </motion.p>
                )}
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}
