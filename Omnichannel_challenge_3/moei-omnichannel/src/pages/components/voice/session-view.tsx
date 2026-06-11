'use client'

import React, { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Mic, MicOff, PhoneOff, MessageSquareText, Send, Loader } from 'lucide-react'
import { useVoiceAgentContext, type VoiceAgentState } from '@/components/voice/voice-agent-provider'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Toggle } from '@/components/ui/toggle'
import { AgentChatIndicator } from '@/components/voice/agent-chat-indicator'
import { Shimmer } from '@/components/voice/shimmer'

const BOTTOM_VIEW_MOTION_PROPS = {
  initial: { opacity: 0, translateY: '100%' },
  animate: { opacity: 1, translateY: '0%' },
  exit: { opacity: 0, translateY: '100%' },
  transition: { duration: 0.3, delay: 0.5, ease: 'easeOut' },
}

const CHAT_MOTION_PROPS = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { delay: 0.2, ease: 'easeOut', duration: 0.3 } },
  exit: { opacity: 0, transition: { ease: 'easeOut', duration: 0.3 } },
}

const SHIMMER_MOTION_PROPS = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { ease: 'easeIn' as const, duration: 0.5, delay: 0.8 } },
  exit: { opacity: 0, transition: { ease: 'easeIn' as const, duration: 0.5, delay: 0 } },
}

function Fade({ top = false, bottom = false, className }: { top?: boolean; bottom?: boolean; className?: string }) {
  return (
    <div
      className={cn(
        'from-background pointer-events-none h-4 bg-linear-to-b to-transparent',
        top && 'bg-linear-to-b',
        bottom && 'bg-linear-to-t',
        className
      )}
    />
  )
}

// Simple audio visualizer based on audio level
function SimpleAudioVisualizer({
  state,
  audioLevel,
  color,
  className,
}: {
  state: VoiceAgentState
  audioLevel: number
  color?: string
  className?: string
}) {
  const barCount = 5
  const bars = Array.from({ length: barCount }, (_, i) => {
    let height = 0.1
    if (state === 'speaking') {
      const center = barCount / 2
      const dist = Math.abs(i - center) / center
      height = audioLevel * (1 - dist * 0.5) + Math.random() * 0.1
    } else if (state === 'thinking') {
      height = 0.2 + Math.sin(Date.now() / 200 + i) * 0.15
    } else if (state === 'listening') {
      height = 0.1 + Math.sin(Date.now() / 1000 + i * 0.5) * 0.05
    } else if (state === 'connecting') {
      height = 0.15 + Math.sin(Date.now() / 500 + i) * 0.1
    }
    return Math.max(0.05, Math.min(1, height))
  })

  return (
    <div
      data-lk-state={state}
      style={{ color } as React.CSSProperties}
      className={cn('flex items-center justify-center gap-4', className)}
    >
      {bars.map((height, idx) => (
        <div
          key={idx}
          data-lk-index={idx}
          style={{ height: `${height * 100}%`, transition: 'height 0.1s ease-out' }}
          className="w-[64px] min-h-[16px] rounded-full bg-current/10 transition-colors duration-250 ease-linear"
        />
      ))}
    </div>
  )
}

// Chat input component
function AgentChatInput({ chatOpen, onSend, className }: { chatOpen: boolean; onSend?: (message: string) => void; className?: string }) {
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [isSending, setIsSending] = useState(false)
  const [message, setMessage] = useState('')
  const isDisabled = isSending || message.trim().length === 0

  const handleSend = async () => {
    if (isDisabled) return
    try {
      setIsSending(true)
      await onSend?.(message.trim())
      setMessage('')
    } catch (error) {
      console.error(error)
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  useEffect(() => {
    if (chatOpen) return
    inputRef.current?.focus()
  }, [chatOpen])

  return (
    <div className={cn('mb-3 flex grow items-end gap-2 rounded-md pl-1 text-sm', className)}>
      <textarea
        autoFocus
        ref={inputRef}
        value={message}
        disabled={!chatOpen || isSending}
        placeholder="Type something..."
        onKeyDown={handleKeyDown}
        onChange={(e) => setMessage(e.target.value)}
        className="max-h-16 min-h-8 flex-1 resize-none py-2 [scrollbar-width:thin] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 field-sizing-content"
      />
      <Button
        size="icon"
        type="button"
        disabled={isDisabled}
        variant={isDisabled ? 'secondary' : 'default'}
        title={isSending ? 'Sending...' : 'Send'}
        onClick={handleSend}
        className="self-end disabled:cursor-not-allowed"
      >
        {isSending ? <Loader className="animate-spin" /> : <Send />}
      </Button>
    </div>
  )
}

export interface SessionViewProps {
  audioVisualizerColor?: string
  supportsChatInput?: boolean
  preConnectMessage?: string
  className?: string
}

export function SessionView({
  audioVisualizerColor,
  supportsChatInput = true,
  preConnectMessage = 'Agent is listening, ask it a question',
  className,
}: SessionViewProps) {
  const agent = useVoiceAgentContext()
  const [chatOpen, setChatOpen] = useState(false)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const [animKey, setAnimKey] = useState(0)

  // Auto-open chat if no microphone is available
  useEffect(() => {
    if (agent.isConnected && !agent.hasMic) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setChatOpen(true)
    }
  }, [agent.isConnected, agent.hasMic])

  // Re-render visualizer periodically for animation
  useEffect(() => {
    const interval = setInterval(() => setAnimKey(k => k + 1), 100)
    return () => clearInterval(interval)
  }, [])

  // Auto-scroll transcript on new messages
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
    }
  }, [agent.messages])

  const handleDisconnect = () => {
    agent.stop()
  }

  return (
    <section className={cn('bg-background relative z-10 h-full w-full overflow-hidden', className)}>
      <Fade top className="absolute inset-x-4 top-0 z-10 h-40" />

      {/* Transcript */}
      <div className="absolute top-0 bottom-[135px] flex w-full flex-col md:bottom-[170px]">
        <AnimatePresence>
          {chatOpen && (
            <motion.div
              {...CHAT_MOTION_PROPS}
              className="flex h-full w-full flex-col gap-4 space-y-3 transition-opacity duration-300 ease-out"
            >
              <div className="mx-auto w-full max-w-2xl px-4 pt-40 md:px-6">
                <div className="space-y-3 overflow-y-auto max-h-full custom-scrollbar" ref={scrollAreaRef}>
                  {agent.messages.map((msg) => {
                    const isUser = msg.role === 'user'
                    const isEmployer = msg.role === 'employer'
                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                        className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                            isUser
                              ? 'bg-brand-600 text-white rounded-br-sm'
                              : isEmployer
                              ? 'bg-emerald-600 text-white rounded-br-sm'
                              : 'bg-muted text-foreground rounded-bl-sm'
                          }`}
                        >
                          {isEmployer && (
                            <span className="text-[9px] font-semibold opacity-80 block mb-0.5">You (Agent)</span>
                          )}
                          {msg.text}
                        </div>
                      </motion.div>
                    )
                  })}
                  <AnimatePresence>
                    {agent.state === 'thinking' && (
                      <div className="flex justify-start">
                        <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-2.5">
                          <AgentChatIndicator size="sm" />
                        </div>
                      </div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Audio Visualizer */}
      <div className="absolute inset-x-0 top-8 bottom-32 z-50 md:top-12 md:bottom-40">
        <div className="relative mx-auto h-full max-w-2xl px-4 md:px-0">
          <div className="grid h-full w-full place-content-center">
            <AnimatePresence mode="popLayout">
              <motion.div
                key="agent"
                layoutId="agent"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, scale: chatOpen ? 0.2 : 1 }}
                transition={{
                  type: 'spring',
                  stiffness: 675,
                  damping: 75,
                  mass: 1,
                  delay: chatOpen ? 0 : 0.15,
                }}
                className={cn('relative aspect-square h-auto', chatOpen ? 'h-[90px]' : 'h-[300px] md:h-[450px]')}
              >
                <SimpleAudioVisualizer
                  key={animKey}
                  state={agent.state}
                  audioLevel={agent.agentAudioLevel}
                  color={audioVisualizerColor}
                  className={cn(
                    'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
                    'bg-background rounded-[50px] border border-transparent transition-[border,drop-shadow]',
                    chatOpen && 'border-input shadow-2xl/10 delay-200',
                    chatOpen ? 'h-[90px] w-[90px]' : 'h-[300px] w-[300px] md:h-[450px] md:w-[450px]'
                  )}
                />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Bottom Controls */}
      <motion.div
        initial={BOTTOM_VIEW_MOTION_PROPS.initial}
        animate={BOTTOM_VIEW_MOTION_PROPS.animate}
        exit={BOTTOM_VIEW_MOTION_PROPS.exit}
        transition={BOTTOM_VIEW_MOTION_PROPS.transition}
        className="absolute inset-x-3 bottom-0 z-50 md:inset-x-12"
      >
        {/* Pre-connect message */}
        <AnimatePresence>
          {agent.messages.length === 0 && (
            <motion.div
              {...SHIMMER_MOTION_PROPS}
              className="pointer-events-none mx-auto block w-full max-w-2xl pb-4 text-center text-sm font-semibold"
            >
              <Shimmer duration={2}>
                {preConnectMessage}
              </Shimmer>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="bg-background relative mx-auto max-w-2xl pb-3 md:pb-12">
          <Fade bottom className="absolute inset-x-0 top-0 h-4 -translate-y-full" />

          {/* Control Bar */}
          <div
            aria-label="Voice assistant controls"
            className="bg-background border-input/50 dark:border-muted flex flex-col border p-3 drop-shadow-md/3 rounded-[31px]"
          >
            {/* Chat Input */}
            <motion.div
              initial={{ height: 0, opacity: 0, marginBottom: 0 }}
              animate={chatOpen ? { height: 'auto', opacity: 1, marginBottom: 12 } : { height: 0, opacity: 0, marginBottom: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              inert={!chatOpen}
              className="border-input/50 flex w-full items-start overflow-hidden border-b"
            >
              <AgentChatInput
                chatOpen={chatOpen}
                onSend={agent.sendChatMessage}
                className="[&_button]:rounded-full"
              />
            </motion.div>

            <div className="flex gap-1">
              <div className="flex grow gap-1">
                {/* Toggle Microphone */}
                <Toggle
                  variant="default"
                  aria-label="Toggle microphone"
                  pressed={!agent.isMuted}
                  onPressedChange={agent.toggleMute}
                  className={cn(
                    'rounded-full',
                    !agent.isMuted
                      ? 'data-[state=on]:bg-emerald-500/20 data-[state=on]:border-emerald-700/10 data-[state=on]:text-emerald-700 dark:data-[state=on]:text-emerald-300'
                      : 'data-[state=off]:bg-accent data-[state=off]:text-destructive data-[state=off]:border-border'
                  )}
                >
                  {agent.isMuted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
                </Toggle>

                {/* Toggle Transcript */}
                {supportsChatInput && (
                  <Toggle
                    variant="default"
                    aria-label="Toggle transcript"
                    pressed={chatOpen}
                    onPressedChange={setChatOpen}
                    className={cn(
                      'rounded-full',
                      'data-[state=on]:bg-emerald-500/20 data-[state=on]:border-emerald-700/10 data-[state=on]:text-emerald-700 dark:data-[state=on]:text-emerald-300'
                    )}
                  >
                    <MessageSquareText className="size-4" />
                  </Toggle>
                )}
              </div>

              {/* Disconnect */}
              <Button
                onClick={handleDisconnect}
                disabled={!agent.isConnected}
                variant="ghost"
                className="bg-destructive/10 dark:bg-destructive/10 text-destructive hover:bg-destructive/20 dark:hover:bg-destructive/20 focus:bg-destructive/20 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/4 rounded-full font-mono text-xs font-bold tracking-wider"
              >
                <PhoneOff className="size-4 mr-1" />
                <span className="hidden md:inline">END CALL</span>
                <span className="inline md:hidden">END</span>
              </Button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Info/Error display */}
      <AnimatePresence>
        {agent.error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={cn(
              'absolute bottom-36 left-1/2 -translate-x-1/2 z-[100] max-w-md rounded-lg px-4 py-2 text-sm',
              agent.hasMic
                ? 'bg-destructive/10 text-destructive'
                : 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
            )}
          >
            {agent.error}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
