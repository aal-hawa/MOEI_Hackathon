import React, { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bot, X, Send, Sparkles, RotateCcw, ChevronDown } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { useAuthStore } from '@/lib/auth-store'
import { authFetch } from '@/lib/utils'
import { useSystemConfig } from '@/hooks/use-system-config'
import { t } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'

// ── Types ────────────────────────────────────────────────────────────
interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

// ── Constants ────────────────────────────────────────────────────────
const MOEI_GOLD = '#B68A35'
const MOEI_GOLD_LIGHT = '#D4A84A'
const MOEI_GOLD_BG = 'rgba(182, 138, 53, 0.08)'

// No longer need a constant API_URL since we use authFetch

// ── Component ────────────────────────────────────────────────────────
export function CustomerChatbot() {
  const { language } = useAppStore()
  const { userProfile } = useAuthStore()
  const { getBoolean } = useSystemConfig()

  // Check if customer chatbot is enabled via system config
  const isChatbotEnabled = getBoolean('customer_chatbot_enabled', true)
  if (!isChatbotEnabled) return null
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const isArabic = language === 'ar'

  // Quick action buttons — focused on new request guidance
  const quickActions = [
    { id: 'apply', label: isArabic ? 'كيف أتقدم بطلب إعادة الجدولة؟' : 'How to apply for rescheduling?', message: isArabic ? 'كيف أتقدم بطلب إعادة جدولة المتأخرات الإسكانية؟' : 'How to apply for rescheduling?' },
    { id: 'documents', label: isArabic ? 'ما المستندات المطلوبة؟' : 'What documents do I need?', message: isArabic ? 'ما هي المستندات المطلوبة لتقديم طلب إعادة الجدولة؟' : 'What documents do I need to submit a rescheduling request?' },
    { id: 'eligibility', label: isArabic ? 'ما هي معايير الأهلية؟' : 'What are the eligibility criteria?', message: isArabic ? 'ما هي معايير الأهلية لإعادة جدولة المتأخرات الإسكانية؟' : 'What are the eligibility criteria for housing arrears rescheduling?' },
    { id: 'dbr', label: isArabic ? 'ما هو حد نسبة عبء الدين؟' : 'What is the DBR limit?', message: isArabic ? 'ما هو الحد الأقصى لنسبة عبء الدين وكيف يؤثر على طلبي؟' : 'What is the DBR limit and how does it affect my request?' },
    { id: 'timeline', label: isArabic ? 'كم يستغرق الطلب؟' : 'How long does the process take?', message: isArabic ? 'كم يستغرق معالجة طلب إعادة الجدولة؟' : 'How long does the rescheduling process take?' },
    { id: 'deduction', label: isArabic ? 'ما هي قاعدة الخصم 20%؟' : 'What is the 20% deduction rule?', message: isArabic ? 'ما هي قاعدة الخصم 20% وكيف تؤثر على القسط الشهري؟' : 'What is the 20% deduction rule and how does it affect my monthly installment?' },
  ]

  // Initialize with welcome message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: t('chatbot.welcome', language),
        timestamp: new Date(),
      }])
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [isOpen])

  // Send message to API
  const sendMessage = useCallback(async (messageText: string) => {
    if (!messageText.trim() || isLoading) return

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: messageText.trim(),
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await authFetch('/api/customer-chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageText.trim(),
          context: 'customer-portal',
          language,
          emiratesId: userProfile?.idn || undefined,
          userName: userProfile?.fullnameEN || undefined,
          profileInfo: userProfile ? {
            name: userProfile.fullnameEN,
            nameAr: userProfile.fullnameAR,
            emiratesId: userProfile.idn,
            nationality: userProfile.nationalityEN,
            email: userProfile.email,
            mobile: userProfile.mobile,
            gender: userProfile.gender,
          } : undefined,
        }),
      })

      const data = await response.json() as { response: string }

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.response || t('chatbot.error', language),
        timestamp: new Date(),
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch {
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: t('chatbot.error', language),
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }, [isLoading, language, userProfile])

  // Handle form submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  // Handle quick action
  const handleQuickAction = (action: typeof quickActions[number]) => {
    sendMessage(action.message)
  }

  // Reset conversation
  const handleNewChat = () => {
    setMessages([{
      id: 'welcome-new',
      role: 'assistant',
      content: t('chatbot.welcome', language),
      timestamp: new Date(),
    }])
  }

  return (
    <>
      {/* Floating Button */}
      <motion.button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-50 flex items-center justify-center rounded-full shadow-lg hover:shadow-xl transition-shadow"
        style={{
          width: 56,
          height: 56,
          backgroundColor: MOEI_GOLD,
          display: isOpen ? 'none' : 'flex',
        }}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 1 }}
        aria-label="Open AI Chat"
      >
        {/* Pulsing ring */}
        <span
          className="absolute inset-0 rounded-full animate-ping opacity-30"
          style={{ backgroundColor: MOEI_GOLD }}
        />
        <Bot className="h-6 w-6 text-white relative z-10" />
        {/* AI Badge */}
        <span
          className="absolute -top-1 -right-1 text-[10px] font-bold text-white px-1.5 py-0.5 rounded-full z-10"
          style={{ backgroundColor: '#1a1a2e' }}
        >
          AI
        </span>
      </motion.button>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed bottom-4 right-4 z-50 flex flex-col rounded-2xl shadow-2xl overflow-hidden bg-white border"
            style={{
              width: 'calc(100vw - 2rem)',
              maxWidth: 400,
              height: 'calc(100vh - 6rem)',
              maxHeight: 600,
              direction: isArabic ? 'rtl' : 'ltr',
            }}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-3 text-white shrink-0"
              style={{ background: `linear-gradient(135deg, ${MOEI_GOLD}, ${MOEI_GOLD_LIGHT})` }}
            >
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Bot className="h-5 w-5" />
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold leading-tight">
                    {t('chatbot.title', language)}
                  </h3>
                  <p className="text-[11px] opacity-80 leading-tight">
                    {t('chatbot.subtitle', language)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/20"
                  onClick={handleNewChat}
                  title={t('chatbot.newChat', language)}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/20"
                  onClick={() => setIsOpen(false)}
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4" style={{ background: '#fafafa' }}>
              <div className="space-y-3">
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`flex ${msg.role === 'user' ? (isArabic ? 'justify-start' : 'justify-end') : (isArabic ? 'justify-end' : 'justify-start')}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                        msg.role === 'user'
                          ? 'text-white rounded-br-sm'
                          : 'text-gray-800 rounded-bl-sm border'
                      }`}
                      style={{
                        backgroundColor: msg.role === 'user' ? MOEI_GOLD : '#ffffff',
                        borderColor: msg.role === 'assistant' ? '#e5e7eb' : undefined,
                      }}
                    >
                      {msg.role === 'assistant' && (
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Sparkles className="h-3 w-3" style={{ color: MOEI_GOLD }} />
                          <span className="text-[10px] font-medium" style={{ color: MOEI_GOLD }}>
                            SZHP AI
                          </span>
                        </div>
                      )}
                      <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                    </div>
                  </motion.div>
                ))}

                {/* Typing indicator */}
                {isLoading && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${isArabic ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-3 w-3 animate-spin" style={{ color: MOEI_GOLD }} />
                        <span className="text-xs text-gray-500">
                          {t('chatbot.typing', language)}
                        </span>
                        <div className="flex gap-1">
                          <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: MOEI_GOLD, animationDelay: '0ms' }} />
                          <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: MOEI_GOLD, animationDelay: '150ms' }} />
                          <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: MOEI_GOLD, animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Quick Actions */}
            {messages.length <= 1 && !isLoading && (
              <div className="px-3 pb-2 shrink-0">
                <div className="flex flex-wrap gap-1.5">
                  {quickActions.map((action) => (
                    <button
                      key={action.id}
                      onClick={() => handleQuickAction(action)}
                      className="text-[11px] px-2.5 py-1.5 rounded-full border transition-colors hover:border-transparent"
                      style={{
                        borderColor: MOEI_GOLD,
                        color: MOEI_GOLD,
                        backgroundColor: 'transparent',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = MOEI_GOLD
                        e.currentTarget.style.color = '#ffffff'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent'
                        e.currentTarget.style.color = MOEI_GOLD
                      }}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input Area */}
            <form
              onSubmit={handleSubmit}
              className="flex items-center gap-2 p-3 border-t shrink-0 bg-white"
            >
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t('chatbot.placeholder', language)}
                disabled={isLoading}
                className="flex-1 h-9 text-sm border-gray-200 focus-visible:ring-0"
                style={{ direction: isArabic ? 'rtl' : 'ltr' }}
              />
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim() || isLoading}
                className="h-9 w-9 shrink-0 rounded-full"
                style={{
                  backgroundColor: input.trim() ? MOEI_GOLD : '#d1d5db',
                }}
              >
                <Send className={`h-4 w-4 text-white ${isArabic ? 'rotate-180' : ''}`} />
              </Button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
