
import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useAppStore } from '@/lib/store'
import { authFetch } from '@/lib/utils'
import { t } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import {
  Bot,
  Send,
  Trash2,
  Download,
  Sparkles,
  BarChart3,
  Clock,
  TrendingUp,
  AlertTriangle,
  LayoutDashboard,
  Loader2,
  X,
  GripVertical,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

// ── Types ────────────────────────────────────────────────────────────
interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  dataUsed?: any
}

interface AdminChatbotProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentView?: string
}

// ── Suggestion Chips ─────────────────────────────────────────────────
const SUGGESTION_KEYS = [
  { key: 'admin.chatbot.suggestDashboard', icon: LayoutDashboard },
  { key: 'admin.chatbot.suggestPending', icon: Clock },
  { key: 'admin.chatbot.suggestRisk', icon: AlertTriangle },
  { key: 'admin.chatbot.suggestTrends', icon: TrendingUp },
  { key: 'admin.chatbot.suggestHighRisk', icon: BarChart3 },
  { key: 'admin.chatbot.suggestAvgTime', icon: Clock },
]

// ── Component ────────────────────────────────────────────────────────
export default function AdminChatbot({ open, onOpenChange, currentView }: AdminChatbotProps) {
  const language = useAppStore((s) => s.language)
  const isAr = language === 'ar'

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [panelWidth, setPanelWidth] = useState(420)
  const [isResizing, setIsResizing] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const resizeRef = useRef<{ startX: number; startWidth: number }>({ startX: 0, startWidth: 0 })

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isLoading])

  // Focus input when panel opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [open])

  // ── Resize handler ────────────────────────────────────────────────
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
    resizeRef.current = { startX: e.clientX, startWidth: panelWidth }

    const handleMouseMove = (ev: MouseEvent) => {
      const delta = isAr ? ev.clientX - resizeRef.current.startX : resizeRef.current.startX - ev.clientX
      const newWidth = Math.max(340, Math.min(700, resizeRef.current.startWidth + delta))
      setPanelWidth(newWidth)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [panelWidth, isAr])

  // ── Send message ──────────────────────────────────────────────────
  const sendMessage = useCallback(async (messageText?: string) => {
    const text = (messageText || input).trim()
    if (!text || isLoading) return

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setIsLoading(true)

    try {
      // Build conversation context (last 10 messages)
      const context = messages.slice(-10).map((m) => ({
        role: m.role,
        content: m.content,
      }))

      const res = await authFetch('/api/admin-chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          context,
          language,
          currentView: currentView || 'dashboard',
        }),
      })

      if (!res.ok) {
        throw new Error('Failed to get response')
      }

      const data = (await res.json()) as { response: string; dataUsed?: any }

      const assistantMsg: ChatMessage = {
        id: `msg-${Date.now()}-ai`,
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
        dataUsed: data.dataUsed,
      }

      setMessages((prev) => [...prev, assistantMsg])
    } catch (error) {
      const errorMsg: ChatMessage = {
        id: `msg-${Date.now()}-err`,
        role: 'assistant',
        content: isAr
          ? 'عذراً، حدث خطأ أثناء معالجة طلبك. يرجى المحاولة لاحقاً.'
          : 'Sorry, an error occurred while processing your request. Please try again later.',
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMsg])
    } finally {
      setIsLoading(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [input, isLoading, messages, language, isAr])

  // ── Clear conversation ────────────────────────────────────────────
  const clearConversation = useCallback(() => {
    setMessages([])
  }, [])

  // ── Export conversation ────────────────────────────────────────────
  const exportConversation = useCallback(() => {
    const text = messages
      .map((m) => {
        const role = m.role === 'user' ? (isAr ? 'المستخدم' : 'User') : (isAr ? 'المساعد الذكي' : 'AI Assistant')
        const time = m.timestamp.toLocaleString()
        return `[${time}] ${role}:\n${m.content}`
      })
      .join('\n\n---\n\n')

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `szhp-chatbot-${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }, [messages, isAr])

  // ── Handle key press ──────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // ── Render data table ─────────────────────────────────────────────
  const renderDataUsed = (dataUsed: any) => {
    if (!dataUsed) return null

    const rows: { label: string; value: string }[] = []

    if (dataUsed.totalRequests !== undefined) {
      rows.push({ label: isAr ? 'إجمالي الطلبات' : 'Total Requests', value: dataUsed.totalRequests.toLocaleString() })
    }
    if (dataUsed.pendingCount !== undefined) {
      rows.push({ label: isAr ? 'قيد الانتظار' : 'Pending', value: dataUsed.pendingCount.toLocaleString() })
    }
    if (dataUsed.approvedCount !== undefined) {
      rows.push({ label: isAr ? 'تمت الموافقة' : 'Approved', value: dataUsed.approvedCount.toLocaleString() })
    }
    if (dataUsed.rejectedCount !== undefined) {
      rows.push({ label: isAr ? 'مرفوض' : 'Rejected', value: dataUsed.rejectedCount.toLocaleString() })
    }
    if (dataUsed.approvalRate !== undefined) {
      rows.push({ label: isAr ? 'معدل الموافقة' : 'Approval Rate', value: `${dataUsed.approvalRate}%` })
    }
    if (dataUsed.highRiskCount !== undefined) {
      rows.push({ label: isAr ? 'حالات عالية المخاطر' : 'High Risk', value: dataUsed.highRiskCount.toLocaleString() })
    }
    if (dataUsed.avgInstallment !== undefined) {
      rows.push({ label: isAr ? 'متوسط القسط' : 'Avg Installment', value: `AED ${dataUsed.avgInstallment.toLocaleString()}` })
    }
    if (dataUsed.totalArrears !== undefined) {
      rows.push({ label: isAr ? 'إجمالي المتأخرات' : 'Total Arrears', value: `AED ${dataUsed.totalArrears.toLocaleString()}` })
    }
    if (dataUsed.totalLoans !== undefined) {
      rows.push({ label: isAr ? 'القروض النشطة' : 'Active Loans', value: dataUsed.totalLoans.toLocaleString() })
    }
    if (dataUsed.totalOutstanding !== undefined) {
      rows.push({ label: isAr ? 'إجمالي المستحق' : 'Total Outstanding', value: `AED ${dataUsed.totalOutstanding.toLocaleString()}` })
    }

    if (rows.length === 0) return null

    return (
      <div className="mt-3 rounded-lg border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-500 border-b border-gray-200">
          {isAr ? 'البيانات المستخدمة' : 'Data Used'}
        </div>
        <div className="divide-y divide-gray-100">
          {rows.slice(0, 8).map((row, i) => (
            <div key={i} className="flex justify-between px-3 py-1.5 text-xs">
              <span className="text-gray-600">{row.label}</span>
              <span className="font-medium text-gray-900">{row.value}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ x: isAr ? -panelWidth : panelWidth, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: isAr ? -panelWidth : panelWidth, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 250 }}
          className="fixed top-0 h-full bg-white border-e border-gray-200 shadow-2xl z-[60] flex flex-col"
          style={{
            width: panelWidth,
            ...(isAr ? { left: 0 } : { right: 0 }),
          }}
        >
          {/* Resize Handle */}
          <div
            className={`absolute top-0 bottom-0 w-2 cursor-col-resize z-10 hover:bg-ae-gold-500/10 transition-colors ${isAr ? 'right-0' : 'left-0'}`}
            onMouseDown={handleResizeStart}
          >
            <div className={`absolute top-1/2 -translate-y-1/2 ${isAr ? 'right-0.5' : 'left-0.5'}`}>
              <GripVertical className="w-1 h-8 text-gray-300" />
            </div>
          </div>

          {/* Header */}
          <div className="shrink-0 border-b border-gray-200 px-4 py-3 flex items-center justify-between bg-gradient-to-r from-[#B68A35]/5 to-[#B68A35]/10">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#B68A35] flex items-center justify-center shadow-md">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  {t('admin.chatbot.title', language)}
                </h3>
                <p className="text-xs text-gray-500">
                  {t('admin.chatbot.subtitle', language)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-gray-500 hover:text-gray-700"
                    onClick={exportConversation}
                    title={t('admin.chatbot.export', language)}
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-gray-500 hover:text-red-500"
                    onClick={clearConversation}
                    title={t('admin.chatbot.clear', language)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-gray-500 hover:text-gray-700"
                onClick={() => onOpenChange(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Messages Area */}
          <ScrollArea className="flex-1" ref={scrollRef}>
            <div className="p-4 space-y-4">
              {/* Welcome message */}
              {messages.length === 0 && (
                <div className="text-center py-6">
                  <div className="w-14 h-14 rounded-2xl bg-[#B68A35]/10 flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="w-7 h-7 text-[#B68A35]" />
                  </div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-1">
                    {t('admin.chatbot.welcomeTitle', language)}
                  </h4>
                  <p className="text-xs text-gray-500 mb-6 leading-relaxed max-w-[280px] mx-auto">
                    {t('admin.chatbot.welcomeDesc', language)}
                  </p>

                  {/* Suggestion Chips */}
                  <div className="space-y-2 max-w-[340px] mx-auto">
                    {SUGGESTION_KEYS.map((suggestion) => {
                      const Icon = suggestion.icon
                      return (
                        <button
                          key={suggestion.key}
                          onClick={() => sendMessage(t(suggestion.key, language))}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-200 text-start text-sm text-gray-700 hover:bg-[#B68A35]/5 hover:border-[#B68A35]/30 transition-colors"
                        >
                          <Icon className="w-4 h-4 text-[#B68A35] shrink-0" />
                          <span className="truncate">{t(suggestion.key, language)}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Message bubbles */}
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-[#B68A35] text-white rounded-ee-sm'
                        : 'bg-gray-100 text-gray-800 rounded-es-sm'
                    }`}
                  >
                    {/* Render message content with proper line breaks */}
                    <div className="whitespace-pre-wrap break-words">
                      {msg.content}
                    </div>

                    {/* Data used indicator — only show for stats/data questions */}
                    {msg.role === 'assistant' && msg.dataUsed && msg.dataUsed._showDataPanel && renderDataUsed(msg.dataUsed)}

                    {/* Timestamp */}
                    <div className={`mt-1.5 text-[10px] ${msg.role === 'user' ? 'text-white/60' : 'text-gray-400'}`}>
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </motion.div>
              ))}

              {/* Typing indicator */}
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-start"
                >
                  <div className="bg-gray-100 rounded-2xl rounded-es-sm px-4 py-3 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-[#B68A35] animate-spin" />
                    <span className="text-sm text-gray-500">
                      {t('admin.chatbot.typing', language)}
                    </span>
                  </div>
                </motion.div>
              )}
            </div>
          </ScrollArea>

          {/* Quick suggestions when in conversation */}
          {messages.length > 0 && messages.length < 3 && (
            <div className="shrink-0 px-4 py-2 border-t border-gray-100">
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTION_KEYS.slice(0, 4).map((suggestion) => (
                  <button
                    key={suggestion.key}
                    onClick={() => sendMessage(t(suggestion.key, language))}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[#B68A35]/20 text-xs text-[#B68A35] hover:bg-[#B68A35]/5 transition-colors"
                  >
                    {t(suggestion.key, language)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input Area */}
          <div className="shrink-0 border-t border-gray-200 p-3 bg-gray-50/50">
            <div className="flex items-center gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('admin.chatbot.placeholder', language)}
                disabled={isLoading}
                className="flex-1 h-10 text-sm border-gray-200 focus:border-[#B68A35] focus:ring-[#B68A35]/20"
                dir={isAr ? 'rtl' : 'ltr'}
              />
              <Button
                onClick={() => sendMessage()}
                disabled={!input.trim() || isLoading}
                className="h-10 w-10 shrink-0 bg-[#B68A35] hover:bg-[#9A7429] text-white rounded-lg"
                size="icon"
              >
                <Send className={`w-4 h-4 ${isAr ? 'rotate-180' : ''}`} />
              </Button>
            </div>
            <p className="mt-1.5 text-[10px] text-gray-400 text-center">
              {t('admin.chatbot.disclaimer', language)}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
