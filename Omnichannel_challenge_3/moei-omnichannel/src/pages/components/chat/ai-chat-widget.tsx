'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageCircle,
  X,
  Send,
  Bot,
  User,
  Loader2,
  Sparkles,
  Phone,
  History,
  Trash2,
} from 'lucide-react'
import { useAppStore } from '@/store/app-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useTranslation } from '@/i18n'

// ─── Auth Storage Key (same as customer portal) ──────────────────────────────
const AUTH_STORAGE_KEY = 'moei-chat-auth'

// ─── Default Fallbacks (used when API is unreachable) ────────────────────────
const DEFAULT_WELCOME = 'Hello! I am the AI assistant for the Ministry of Energy & Infrastructure. How can I help you today?'

const DEFAULT_FALLBACKS: Record<string, string> = {
  electricity: 'For electricity services, I can help you with new connections, billing inquiries, outage reports, and meter readings. Please provide your account number or Emirates ID for faster assistance.',
  water: 'For water services, I can assist with water connection requests, leak reports, billing questions, and conservation tips. Please share your account details. For urgent water safety issues, please call 998 immediately.',
  housing: 'For housing services, I can help with housing applications, maintenance requests, Sheikh Zayed Housing Programme inquiries, and rental support. Please provide your application reference number if available.',
  complaint: 'I understand you\'d like to file a complaint. I\'ll help you create a case right away. Please describe your issue in detail, including any reference numbers.',
  case: 'To check your case status, please provide your case reference number (e.g., MOEI-XXXX). I can look it up for you right now.',
  help: 'I can help you with: Electricity & Water services, Housing programmes, Petroleum services, Transport services, Case status tracking, Filing complaints, and General inquiries. What would you like help with?',
  default: 'Thank you for your message. I\'m here to assist you with Ministry of Energy & Infrastructure services including electricity, water, housing, petroleum, and transport. Could you please specify which service you need help with?',
}

// ─── Chat Config from API ────────────────────────────────────────────────────
// Maps chat-config keys to fallback intent keys
const CONFIG_KEY_TO_INTENT: Record<string, string> = {
  welcome_message: 'welcome',
  fallback_default: 'default',
  fallback_electricity: 'electricity',
  fallback_water: 'water',
  fallback_housing: 'housing',
  fallback_complaint: 'complaint',
  fallback_case: 'case',
  fallback_help: 'help',
}

interface ChatConfigEntry {
  key: string
  valueEn: string
  valueAr?: string | null
  isActive: boolean
}

// Fetch and cache chat config from API
let chatConfigCache: Record<string, string> | null = null
let chatConfigPromise: Promise<Record<string, string>> | null = null

async function getChatConfig(): Promise<Record<string, string>> {
  if (chatConfigCache) return chatConfigCache
  if (chatConfigPromise) return chatConfigPromise

  chatConfigPromise = (async () => {
    try {
      const res = await fetch('/api/chat-config')
      if (res.ok) {
        const configs: ChatConfigEntry[] = await res.json()
        const result: Record<string, string> = {}
        for (const cfg of configs) {
          if (!cfg.isActive) continue
          const intentKey = CONFIG_KEY_TO_INTENT[cfg.key]
          if (intentKey) {
            result[intentKey] = cfg.valueEn || ''
          }
        }
        chatConfigCache = result
        return result
      }
    } catch {
      // API unreachable - use defaults
    }
    chatConfigCache = {}
    return {}
  })()

  return chatConfigPromise
}

// Invalidate cache (called when admin updates config)
export function invalidateChatConfigCache() {
  chatConfigCache = null
  chatConfigPromise = null
}

function detectIntent(message: string): string {
  const lower = message.toLowerCase()
  if (/electric|power|outage|meter|connection/i.test(lower)) return 'electricity'
  if (/water|leak|pipe|sewage/i.test(lower)) return 'water'
  if (/house|rent|maintain|building|sheikh zayed/i.test(lower)) return 'housing'
  if (/complaint|complain|issue|problem|unsatisfied/i.test(lower)) return 'complaint'
  if (/case|status|reference|track|MOEI-/i.test(lower)) return 'case'
  if (/help|assist|support|service/i.test(lower)) return 'help'
  return 'default'
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  intent?: string
  fromHistory?: boolean
}

// ─── Helper: Get auth data from localStorage ─────────────────────────────────
function getAuthData(): { customerId?: string; name?: string; email?: string } | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) return null
    const auth = JSON.parse(raw)
    return { customerId: auth.customerId, name: auth.name, email: auth.email }
  } catch {
    return null
  }
}

export default function AIChatWidget() {
  const {
    chatOpen,
    setChatOpen,
    chatSessionId,
    isChatLoading,
    setIsChatLoading,
  } = useAppStore()

  const { isRTL, language } = useTranslation()

  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([])
  const [showWelcome, setShowWelcome] = useState(true)
  const [welcomeMessage, setWelcomeMessage] = useState(DEFAULT_WELCOME)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [showHistoryBanner, setShowHistoryBanner] = useState(false)

  // Get customer ID from localStorage for brain context
  const getCustomerId = useCallback((): string | undefined => {
    return getAuthData()?.customerId
  }, [])

  // Fetch welcome message from API on mount
  useEffect(() => {
    getChatConfig().then((config) => {
      if (config.welcome) {
        setWelcomeMessage(config.welcome)
      }
    })
  }, [])

  // Personalize welcome with customer name
  useEffect(() => {
    const auth = getAuthData()
    if (auth?.name) {
      const firstName = auth.name.split(' ')[0]
      setWelcomeMessage(prev => {
        // Don't re-personalize if already done
        if (prev.includes(firstName)) return prev
        return `Hello ${firstName}! I am the AI assistant for the Ministry of Energy & Infrastructure. How can I help you today?`
      })
    }
  }, [chatOpen])

  // Load chat history from DB when chat opens (if authenticated)
  useEffect(() => {
    if (!chatOpen || historyLoaded) return
    
    const auth = getAuthData()
    const customerId = auth?.customerId
    
    if (customerId) {
      // Load conversation history from DB
      fetch(`/api/conversations?customerId=${customerId}&channel=web&limit=10`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data) && data.length > 0) {
            // Get the most recent session's transcript
            const latestSession = data[0]
            if (latestSession?.transcript) {
              try {
                const transcript = JSON.parse(latestSession.transcript)
                if (Array.isArray(transcript) && transcript.length > 0) {
                  const historyMessages: ChatMessage[] = transcript
                    .filter((t: any) => t.speaker === 'customer' || t.speaker === 'ai')
                    .map((t: any, i: number) => ({
                      id: `history-${i}`,
                      role: t.speaker === 'customer' ? 'user' as const : 'assistant' as const,
                      content: t.text,
                      timestamp: new Date(t.timestamp || Date.now()),
                      fromHistory: true,
                    }))
                  
                  if (historyMessages.length > 0) {
                    setShowHistoryBanner(true)
                    setLocalMessages([
                      {
                        id: 'welcome',
                        role: 'assistant',
                        content: welcomeMessage,
                        timestamp: new Date(),
                      },
                      ...historyMessages,
                    ])
                    setShowWelcome(false)
                  }
                }
              } catch {
                // Failed to parse transcript — start fresh
              }
            }
          }
          setHistoryLoaded(true)
        })
        .catch(() => {
          setHistoryLoaded(true)
        })
    } else {
      setHistoryLoaded(true)
    }
  }, [chatOpen, historyLoaded, welcomeMessage])

  // Initialize with welcome message when chat opens (if no history)
  useEffect(() => {
    if (chatOpen && localMessages.length === 0 && historyLoaded) {
      setLocalMessages([{
        id: 'welcome',
        role: 'assistant',
        content: welcomeMessage,
        timestamp: new Date(),
      }])
    }
  }, [chatOpen, localMessages.length, welcomeMessage, historyLoaded])

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [localMessages, isChatLoading])

  // Focus input when chat opens
  useEffect(() => {
    if (chatOpen) {
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [chatOpen])

  // Listen for auth changes to reload history
  useEffect(() => {
    const handleStorageChange = () => {
      setHistoryLoaded(false)
    }
    const handleLogout = () => {
      setLocalMessages([])
      setHistoryLoaded(false)
      setShowHistoryBanner(false)
      setShowWelcome(true)
    }
    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('moei-logout', handleLogout)
    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('moei-logout', handleLogout)
    }
  }, [])

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim()
    if (!trimmed || isChatLoading) return

    setShowWelcome(false)

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
    }
    setLocalMessages((prev) => [...prev, userMsg])
    setInput('')
    setIsChatLoading(true)

    // Small delay for natural feel
    const delay = new Promise<void>((resolve) => setTimeout(resolve, 600 + Math.random() * 400))

    try {
      // Pass customerId to the brain so it can load the same customer context
      // as WhatsApp, Email, and Voice channels
      const customerId = getCustomerId()

      const resPromise = fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          sessionId: chatSessionId,
          language: language === 'ar' ? 'ar' : 'en',
          customerId, // Same brain as WhatsApp/Email/Voice — passes customer ID
        }),
      })

      const [_, res] = await Promise.all([delay, resPromise])

      if (res.ok) {
        const data = await res.json()
        if (data.response) {
          setLocalMessages((prev) => [...prev, {
            id: `ai-${Date.now()}`,
            role: 'assistant',
            content: data.response,
            timestamp: new Date(),
            intent: data.intent,
          }])
        } else {
          // API returned but no response — use fallback
          getFallbackResponse(trimmed)
        }
      } else {
        // API error — use fallback
        getFallbackResponse(trimmed)
      }
    } catch {
      // Network error — use fallback
      getFallbackResponse(trimmed)
    } finally {
      setIsChatLoading(false)
    }
  }, [input, isChatLoading, chatSessionId, setIsChatLoading, getCustomerId, language])

  const getFallbackResponse = useCallback((message: string) => {
    const intent = detectIntent(message)
    getChatConfig().then((config) => {
      const response = config[intent] || DEFAULT_FALLBACKS[intent] || DEFAULT_FALLBACKS.default
      setLocalMessages((prev) => [...prev, {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: response,
        timestamp: new Date(),
        intent,
      }])
    })
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // Clear chat history
  const handleClearHistory = useCallback(() => {
    setLocalMessages([{
      id: 'welcome',
      role: 'assistant',
      content: welcomeMessage,
      timestamp: new Date(),
    }])
    setShowWelcome(true)
    setShowHistoryBanner(false)
  }, [welcomeMessage])

  // Quick reply suggestions
  const quickReplies = [
    'Check Case Status',
    'Electricity Services',
    'File a Complaint',
    'I Need Help',
  ]

  // Handle quick reply click
  const handleQuickReply = useCallback((reply: string) => {
    const trimmed = reply.trim()
    if (!trimmed) return
    setShowWelcome(false)
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
    }
    setLocalMessages((prev) => [...prev, userMsg])
    setInput('')
    setIsChatLoading(true)

    const delay = new Promise<void>((resolve) => setTimeout(resolve, 600 + Math.random() * 400))
    const customerId = getCustomerId()

    Promise.all([
      delay,
      fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          sessionId: chatSessionId,
          language: language === 'ar' ? 'ar' : 'en',
          customerId,
        }),
      }),
    ])
      .then(async ([_, res]) => {
        if (res.ok) {
          const data = await res.json()
          if (data.response) {
            setLocalMessages((prev) => [...prev, {
              id: `ai-${Date.now()}`,
              role: 'assistant',
              content: data.response,
              timestamp: new Date(),
              intent: data.intent,
            }])
            return
          }
        }
        // Fallback
        const intent = detectIntent(trimmed)
        getChatConfig().then((config) => {
          const response = config[intent] || DEFAULT_FALLBACKS[intent] || DEFAULT_FALLBACKS.default
          setLocalMessages((prev) => [...prev, {
            id: `ai-${Date.now()}`,
            role: 'assistant',
            content: response,
            timestamp: new Date(),
            intent,
          }])
        })
      })
      .catch(() => {
        const intent = detectIntent(trimmed)
        const response = DEFAULT_FALLBACKS[intent] || DEFAULT_FALLBACKS.default
        setLocalMessages((prev) => [...prev, {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: response,
          timestamp: new Date(),
          intent,
        }])
      })
      .finally(() => setIsChatLoading(false))
  }, [chatSessionId, setIsChatLoading, getCustomerId, language])

  // Check if user is authenticated
  const authData = getAuthData()
  const isLoggedIn = !!authData?.customerId

  return (
    <>
      {/* Floating Chat Button */}
      <AnimatePresence>
        {!chatOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setChatOpen(true)}
            className={`fixed bottom-6 ${isRTL ? 'left-6' : 'right-6'} z-50 w-14 h-14 bg-gradient-to-br from-[#b8860b] to-[#d4af37] text-white rounded-full shadow-lg hover:shadow-xl transition-shadow flex items-center justify-center`}
            aria-label="Chat with MOEI"
          >
            <MessageCircle className="w-6 h-6" />
            {/* Notification dot */}
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Window */}
      <AnimatePresence>
        {chatOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={`fixed bottom-4 ${isRTL ? 'left-4' : 'right-4'} z-50 w-[380px] max-w-[calc(100vw-2rem)] h-[560px] max-h-[calc(100vh-4rem)] bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/50 flex flex-col overflow-hidden`}
          >
            {/* Header */}
            <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#b8860b] to-[#d4af37] flex items-center justify-center shadow-inner">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">MOEI AI Assistant</h3>
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] text-green-600 font-medium flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block" />
                      Online
                    </p>
                    {isLoggedIn && (
                      <span className="text-[9px] text-[#92722A] font-medium bg-[#92722A]/10 px-1.5 py-0.5 rounded-full">
                        Same AI as WhatsApp & Email
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {localMessages.length > 1 && (
                  <button
                    onClick={handleClearHistory}
                    className="w-8 h-8 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 flex items-center justify-center transition-colors"
                    title="Clear chat"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => {
                    if (localMessages.length > 0) {
                      window.open('tel:997')
                    }
                  }}
                  className="w-8 h-8 rounded-full hover:bg-gray-100 text-gray-500 flex items-center justify-center transition-colors"
                  title="Emergency: 997 (Electricity) / 998 (Water) / 999 (Police)"
                >
                  <Phone className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setChatOpen(false)}
                  className="w-8 h-8 rounded-full hover:bg-gray-100 text-gray-500 flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Chat History Banner */}
            {showHistoryBanner && (
              <div className="bg-[#92722A]/5 border-b border-[#92722A]/10 px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="w-3.5 h-3.5 text-[#92722A]" />
                  <span className="text-[11px] text-[#7A6124] font-medium">Continuing from your previous conversation</span>
                </div>
                <button
                  onClick={handleClearHistory}
                  className="text-[10px] text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Start fresh
                </button>
              </div>
            )}

            {/* Login prompt for unauthenticated users */}
            {!isLoggedIn && localMessages.length <= 1 && (
              <div className="bg-amber-50 border-b border-amber-100 px-4 py-2.5">
                <p className="text-[11px] text-amber-700">
                  💡 <strong>Tip:</strong> Login with UAE PASS for personalized responses and case tracking.
                </p>
              </div>
            )}

            {/* Messages Area */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4 bg-gray-50/30">
              {localMessages.map((msg) => {
                const isAI = msg.role === 'assistant'
                return (
                  <motion.div
                    key={msg.id}
                    initial={msg.fromHistory ? { opacity: 0.6 } : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex items-end gap-2 ${isAI ? 'justify-start' : 'justify-end'}`}
                  >
                    {isAI && (
                      <div className="w-7 h-7 bg-gradient-to-br from-[#b8860b] to-[#d4af37] rounded-full flex items-center justify-center flex-shrink-0 shadow-sm">
                        <Bot className="w-3.5 h-3.5 text-white" />
                      </div>
                    )}
                    <div className="max-w-[80%]">
                      {isAI && (
                        <p className="text-[10px] text-gray-400 mb-1 ml-1 font-medium">
                          {msg.fromHistory ? 'Assistant (previous)' : 'Assistant'}
                        </p>
                      )}
                      <div
                        className={`px-4 py-2.5 text-sm leading-relaxed whitespace-pre-line shadow-sm ${
                          isAI
                            ? `bg-white text-gray-700 border border-gray-100 rounded-2xl rounded-bl-sm ${msg.fromHistory ? 'opacity-80' : ''}`
                            : 'bg-gradient-to-r from-[#b8860b] to-[#d4af37] text-white font-medium rounded-2xl rounded-br-sm'
                        }`}
                      >
                        <p>{msg.content}</p>
                      </div>
                    </div>
                  </motion.div>
                )
              })}

              {/* Loading indicator */}
              {isChatLoading && (
                <div className="flex items-end gap-2 justify-start">
                  <div className="w-7 h-7 bg-gradient-to-br from-[#b8860b] to-[#d4af37] rounded-full flex items-center justify-center flex-shrink-0 shadow-sm">
                    <Bot className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 mb-1 ml-1 font-medium">Assistant</p>
                    <div className="bg-white border border-gray-100 text-gray-700 px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm">
                      <div className="flex gap-1.5 items-center h-4">
                        <span className="w-1.5 h-1.5 bg-[#b8860b]/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 bg-[#b8860b]/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 bg-[#b8860b]/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Quick replies */}
              {showWelcome && localMessages.length <= 1 && !isChatLoading && (
                <div className="flex flex-wrap gap-2 mt-2 ml-9">
                  {quickReplies.map((reply) => (
                    <button
                      key={reply}
                      onClick={() => handleQuickReply(reply)}
                      className="text-[11px] font-medium bg-white text-[#b8860b] border border-[#b8860b]/30 rounded-full px-3 py-1.5 hover:bg-[#b8860b]/5 hover:border-[#b8860b] transition-all shadow-sm"
                    >
                      {reply}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="bg-white border-t border-gray-100 p-3 flex items-center gap-2 flex-shrink-0">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isLoggedIn ? `Ask anything about MOEI services...` : "Type your message..."}
                disabled={isChatLoading}
                className="flex-1 h-10 text-sm border-gray-200 bg-gray-50/50 rounded-xl focus-visible:ring-[#b8860b]/30 focus-visible:border-[#b8860b]/50"
              />
              <Button
                onClick={sendMessage}
                disabled={!input.trim() || isChatLoading}
                size="icon"
                className="h-10 w-10 bg-gradient-to-r from-[#b8860b] to-[#d4af37] hover:from-[#a0750a] hover:to-[#b8952b] text-white rounded-xl shadow-sm flex-shrink-0 transition-all"
              >
                {isChatLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export { AIChatWidget }
