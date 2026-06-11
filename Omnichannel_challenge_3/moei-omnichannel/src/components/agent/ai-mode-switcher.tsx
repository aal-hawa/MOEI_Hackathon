'use client'

import { useState } from 'react'
import { Bot, Hand, Volume2, User, Ban, Loader2, Check, ChevronDown, ChevronUp } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AI_MODE_CONFIG,
  AI_MODE_ORDER,
  AI_MODE_I18N,
  type AiMode,
} from '@/components/agent/ai-mode-config'
import { useAppStore } from '@/store/app-store'
import { logEmployerAction } from '@/lib/employer-action-logger'

// ─── Icon Resolver ─────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ElementType> = {
  Bot,
  Hand,
  Volume2,
  User,
  Ban,
}

function getIcon(iconName: string): React.ElementType {
  return ICON_MAP[iconName] || Bot
}

// ─── Component ─────────────────────────────────────────────────────────────────

interface AiModeSwitcherProps {
  sessionId: string
  currentMode: AiMode
  language?: string
}

export function AiModeSwitcher({ sessionId, currentMode, language = 'en' }: AiModeSwitcherProps) {
  const isAr = language === 'ar'
  const [mode, setMode] = useState<AiMode>(currentMode)
  const [changing, setChanging] = useState(false)
  const [justChanged, setJustChanged] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const { conversationSessions, setConversationSessions } = useAppStore()

  const handleModeChange = async (newMode: AiMode) => {
    if (newMode === mode) return
    setChanging(true)
    try {
      const res = await fetch(`/api/conversations/${sessionId}/ai-mode?XTransformPort=3002`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aiMode: newMode }),
      })
      if (res.ok) {
        setMode(newMode)
        setJustChanged(true)
        setTimeout(() => setJustChanged(false), 2000)
        // Optimistically update the store so conversation list badge updates immediately
        setConversationSessions(
          conversationSessions.map((s) =>
            s.id === sessionId ? { ...s, aiMode: newMode } : s
          )
        )
        // Log AI mode change
        logEmployerAction({
          action: 'change_ai_mode',
          details: { sessionId, fromMode: mode, toMode: newMode },
          targetId: sessionId,
        })
      }
    } catch {
      // Silently fail
    }
    setChanging(false)
  }

  const currentConfig = AI_MODE_CONFIG[mode]
  const CurrentIcon = getIcon(currentConfig.iconName)

  return (
    <div className="space-y-2">
      {/* Header Row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold text-ae-black-400 uppercase tracking-wider">
            {isAr ? AI_MODE_I18N.headerLabel.ar : AI_MODE_I18N.headerLabel.en}
          </span>
          {changing && <Loader2 className="w-3 h-3 animate-spin text-ae-gold-500" />}
          {justChanged && (
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-0.5 text-[10px] text-green-600"
            >
              <Check className="w-3 h-3" />
              {isAr ? AI_MODE_I18N.updated.ar : AI_MODE_I18N.updated.en}
            </motion.span>
          )}
        </div>

        {/* Current Mode Badge (click to expand/collapse) */}
        <motion.button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-all cursor-pointer"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <span className="text-sm">{currentConfig.emoji}</span>
          <span>{isAr ? currentConfig.labelAr : currentConfig.labelEn}</span>
          {expanded ? (
            <ChevronUp className="w-3 h-3 opacity-50" />
          ) : (
            <ChevronDown className="w-3 h-3 opacity-50" />
          )}
        </motion.button>
      </div>

      {/* Expanded Mode Selector */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="p-2 rounded-xl border border-ae-black-100 bg-ae-black-50/30 space-y-1">
              {AI_MODE_ORDER.map((modeId) => {
                const config = AI_MODE_CONFIG[modeId]
                const isActive = mode === modeId
                const Icon = getIcon(config.iconName)

                return (
                  <motion.button
                    key={config.id}
                    onClick={() => handleModeChange(config.id)}
                    disabled={changing}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-start transition-all duration-200 cursor-pointer ${
                      isActive
                        ? config.activeColor
                        : config.color
                    } ${changing ? 'opacity-60 cursor-wait' : ''}`}
                    whileHover={!changing ? { scale: 1.01, x: 2 } : {}}
                    whileTap={!changing ? { scale: 0.99 } : {}}
                    layout
                  >
                    {/* Icon/Emoji */}
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/20 shrink-0">
                      <span className="text-lg">{config.emoji}</span>
                    </div>

                    {/* Label + Description */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        <span className="text-[12px] font-semibold">
                          {isAr ? config.labelAr : config.labelEn}
                        </span>
                      </div>
                      <p className="text-[10px] opacity-70 mt-0.5 leading-tight">
                        {isAr ? config.descAr : config.descEn}
                      </p>
                    </div>

                    {/* Active Indicator */}
                    {isActive && (
                      <motion.div
                        layoutId="ai-mode-check"
                        className="shrink-0"
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      >
                        <div className="w-5 h-5 rounded-full bg-white/25 flex items-center justify-center">
                          <Check className="w-3 h-3" />
                        </div>
                      </motion.div>
                    )}
                  </motion.button>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Current mode description (always visible) */}
      {!expanded && (
        <motion.p
          key={mode}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-1.5 text-[10px] text-ae-black-400 pl-1"
        >
          <CurrentIcon className="w-3 h-3" />
          {isAr ? currentConfig.descAr : currentConfig.descEn}
        </motion.p>
      )}
    </div>
  )
}
