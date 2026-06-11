'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  MessageCircle, Send, Check, CheckCheck, Clock, Phone, User, Loader2,
  Sparkles, ArrowLeft, Search, Brain, Bot, ToggleLeft, ToggleRight, Plus
} from 'lucide-react'
import { useAppStore, type WhatsAppMessage } from '@/store/app-store'
import { useTranslation } from '@/i18n'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'

// ─── Types ───────────────────────────────────────────────────────────────────

interface CustomerChat {
  customerId: string
  customerName: string
  customerPhone: string
  lastMessage: WhatsAppMessage
  unreadCount: number
  messages: WhatsAppMessage[]
  dbCustomerId?: string       // Real DB customer ID from API
  dbSessionId?: string       // Real DB conversation session ID from API
}

// ─── WhatsApp Templates ─────────────────────────────────────────────────────

const WHATSAPP_TEMPLATES = {
  greeting: '\u0627\u0644\u0633\u0644\u0627\u0645 \u0639\u0644\u064A\u0643\u0645\u060C \u0623\u0646\u0627 \u0648\u0643\u064A\u0644 \u062E\u062F\u0645\u0629 \u0627\u0644\u0639\u0645\u0644\u0627\u0621 \u0645\u0646 \u0648\u0632\u0627\u0631\u0629 \u0627\u0644\u0637\u0627\u0642\u0629 \u0648\u0627\u0644\u0628\u0646\u064A\u0629 \u0627\u0644\u062A\u062D\u062A\u064A\u0629. \u0643\u064A\u0641 \u064A\u0645\u0643\u0646\u0646\u064A \u0645\u0633\u0627\u0639\u062F\u062A\u0643\u0645 \u0627\u0644\u064A\u0648\u0645\u061F',
  followUp: '\u0646\u0639\u0645\u060C \u0623\u0648\u062F \u0645\u062A\u0627\u0628\u0639\u0629 \u0627\u0633\u062A\u0641\u0633\u0627\u0631\u0643\u0645 \u0627\u0644\u0633\u0627\u0628\u0642. \u0647\u0644 \u062A\u0645 \u062D\u0644 \u0627\u0644\u0645\u0634\u0643\u0644\u0629\u061F',
  resolution: '\u064A\u0633\u0639\u062F\u0646\u0627 \u0625\u0628\u0644\u0627\u063A\u0643\u0645 \u0628\u0623\u0646\u0647 \u062A\u0645 \u062D\u0644 \u0627\u0644\u0645\u0634\u0643\u0644\u0629. \u0647\u0644 \u062A\u062D\u062A\u0627\u062C\u0648\u0646 \u0625\u0644\u0649 \u0623\u064A \u0645\u0633\u0627\u0639\u062F\u0629 \u0623\u062E\u0631\u0649\u061F',
  escalation: '\u0633\u0623\u0642\u0648\u0645 \u0628\u062A\u062D\u0648\u064A\u0644\u0643 \u0625\u0644\u0649 \u0645\u0634\u0631\u0641 \u0645\u062A\u062E\u0635\u0635 \u0644\u0645\u0632\u064A\u062F \u0645\u0646 \u0627\u0644\u0645\u0633\u0627\u0639\u062F\u0629. \u064A\u0631\u062C\u0649 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631.',
} as const

type TemplateKey = keyof typeof WHATSAPP_TEMPLATES

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(date: Date): string {
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatRelativeTime(date: Date, t: (key: string) => string): string {
  const now = Date.now()
  const then = new Date(date).getTime()
  const diff = now - then

  if (diff < 60000) return t('justNow' as Parameters<typeof t>[0])
  if (diff < 3600000) return `${Math.floor(diff / 60000)}${t('minAgo' as Parameters<typeof t>[0])}`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}${t('hAgo' as Parameters<typeof t>[0])}`
  return new Date(date).toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function detectLanguage(text: string): 'en' | 'ar' {
  const arabicRegex = /[\u0600-\u06FF]/
  return arabicRegex.test(text) ? 'ar' : 'en'
}

function DeliveryStatusIcon({ status }: { status: WhatsAppMessage['status'] }) {
  switch (status) {
    case 'sent':
      return <Check className="h-3.5 w-3.5 text-muted-foreground/60" />
    case 'delivered':
      return <CheckCheck className="h-3.5 w-3.5 text-muted-foreground/60" />
    case 'read':
      return <CheckCheck className="h-3.5 w-3.5 text-uae-green-500" />
    case 'failed':
      return <Clock className="h-3.5 w-3.5 text-uae-red-400" />
    default:
      return null
  }
}

// Sample customers removed — use real data from API only

// ─── Default Export: WhatsAppPanel ───────────────────────────────────────────

export default function WhatsAppPanel() {
  const { t, isRTL } = useTranslation()
  const {
    whatsappMessages,
    whatsappUnread,
    addWhatsappMessage,
    resetWhatsappUnread,
  } = useAppStore()

  // State
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null)
  const [messageInput, setMessageInput] = useState('')
  const [customerInput, setCustomerInput] = useState('')
  const [sending, setIsSending] = useState(false)
  const [customerSending, setCustomerSending] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showTyping, setShowTyping] = useState(false)
  const [showAITyping, setShowAITyping] = useState(false)
  // AI auto-reply removed — pipe mode (no fake messages, no communication process only pipes)
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list')
  const chatEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const customerTextareaRef = useRef<HTMLTextAreaElement>(null)

  // Track DB IDs per customer chat (local ID -> DB IDs)
  const [dbIdMap, setDbIdMap] = useState<Record<string, { dbCustomerId: string; dbSessionId: string }>>({})

  // New conversation dialog
  const [showNewConvDialog, setShowNewConvDialog] = useState(false)
  const [newConvName, setNewConvName] = useState('')
  const [newConvPhone, setNewConvPhone] = useState('')

  // Group messages by customer
  const customerChats = useMemo<CustomerChat[]>(() => {
    const chatMap = new Map<string, CustomerChat>()

    // Sort messages by timestamp
    const sorted = [...whatsappMessages].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )

    for (const msg of sorted) {
      const existing = chatMap.get(msg.customerId)
      if (existing) {
        existing.messages.push(msg)
        // Update last message if this one is newer
        if (new Date(msg.timestamp).getTime() > new Date(existing.lastMessage.timestamp).getTime()) {
          existing.lastMessage = msg
        }
        // Count unread inbound messages
        if (msg.direction === 'inbound' && msg.status !== 'read') {
          existing.unreadCount += 1
        }
      } else {
        chatMap.set(msg.customerId, {
          customerId: msg.customerId,
          customerName: msg.customerName,
          customerPhone: msg.customerPhone,
          lastMessage: msg,
          unreadCount: msg.direction === 'inbound' && msg.status !== 'read' ? 1 : 0,
          messages: [msg],
        })
      }
    }

    // Convert to array and sort by last message time (most recent first)
    return Array.from(chatMap.values()).sort(
      (a, b) => new Date(b.lastMessage.timestamp).getTime() - new Date(a.lastMessage.timestamp).getTime()
    )
  }, [whatsappMessages])

  // Filter chats by search
  const filteredChats = useMemo(() => {
    if (!searchQuery.trim()) return customerChats
    const q = searchQuery.toLowerCase()
    return customerChats.filter(
      (c) =>
        c.customerName.toLowerCase().includes(q) ||
        c.customerPhone.includes(q) ||
        c.lastMessage.content.toLowerCase().includes(q)
    )
  }, [customerChats, searchQuery])

  // Get current selected chat
  const currentChat = useMemo(() => {
    if (!selectedCustomer) return null
    return customerChats.find((c) => c.customerId === selectedCustomer) || null
  }, [selectedCustomer, customerChats])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [currentChat?.messages.length, showAITyping, showTyping])

  // Auto-populate dbIdMap from messages that have DB IDs (from polling)
  useEffect(() => {
    const updates: Record<string, { dbCustomerId: string; dbSessionId: string }> = {}
    for (const msg of whatsappMessages) {
      // DB customer IDs are cuids (start with 'c' and are ~25 chars)
      const isDbId = msg.customerId && msg.customerId.startsWith('cmq') && msg.customerId.length > 15
      if (isDbId && !dbIdMap[msg.customerId]) {
        updates[msg.customerId] = {
          dbCustomerId: msg.customerId,
          dbSessionId: msg.conversationId || '',
        }
      }
    }
    if (Object.keys(updates).length > 0) {
      setDbIdMap(prev => ({ ...prev, ...updates }))
    }
  }, [whatsappMessages, dbIdMap])

  // Reset unread when selecting a customer
  useEffect(() => {
    if (selectedCustomer) {
      resetWhatsappUnread()
    }
  }, [selectedCustomer, resetWhatsappUnread])

  // Handle customer selection
  const handleSelectCustomer = useCallback((customerId: string) => {
    setSelectedCustomer(customerId)
    setMobileView('chat')
    setMessageInput('')
    setCustomerInput('')
  }, [])

  // Handle back to list (mobile)
  const handleBackToList = useCallback(() => {
    setMobileView('list')
    setSelectedCustomer(null)
  }, [])

  // Handle template button click
  const handleTemplate = useCallback((key: TemplateKey) => {
    setMessageInput(WHATSAPP_TEMPLATES[key])
    textareaRef.current?.focus()
  }, [])

  // ─── Start New Conversation ─────────────────────────────────────────────

  const handleStartNewConversation = useCallback(() => {
    setShowNewConvDialog(true)
  }, [])

  const handleCreateNewConversation = useCallback(() => {
    const name = newConvName.trim() || 'Customer'
    const phone = newConvPhone.trim() || '+971501234567'
    const localId = `wa-cust-${Date.now()}`

    // Add a placeholder first message so the chat appears in the list
    const welcomeMsg: WhatsAppMessage = {
      id: `wa-system-${Date.now()}`,
      customerId: localId,
      customerName: name,
      customerPhone: phone,
      content: 'Conversation started',
      direction: 'outbound',
      status: 'read',
      timestamp: new Date(),
      isTemplate: false,
    }
    addWhatsappMessage(welcomeMsg)

    // Select the new chat
    setSelectedCustomer(localId)
    setMobileView('chat')
    setMessageInput('')
    setCustomerInput('')

    // Reset dialog
    setNewConvName('')
    setNewConvPhone('')
    setShowNewConvDialog(false)
  }, [newConvName, newConvPhone, addWhatsappMessage])

  // ─── Send Customer (Inbound) Message ────────────────────────────────────

  const handleSendCustomerMessage = useCallback(async () => {
    if (!customerInput.trim() || !selectedCustomer || customerSending) return

    const content = customerInput.trim()
    setCustomerSending(true)
    setCustomerInput('')

    // Add as inbound customer message
    const inboundMsg: WhatsAppMessage = {
      id: `wa-in-${Date.now()}`,
      customerId: selectedCustomer,
      customerName: currentChat?.customerName || 'Unknown',
      customerPhone: currentChat?.customerPhone || '',
      content,
      direction: 'inbound',
      status: 'read',
      timestamp: new Date(),
      isTemplate: false,
    }
    addWhatsappMessage(inboundMsg)

    // ── PIPE MODE: Store message in DB, no AI response ──
    // "No fake messages, no communication process only pipes"
    {
      const detectedLang = detectLanguage(content)
      const sessionId = `wa-${selectedCustomer}`

      // Use DB customer ID if available
      const dbIds = dbIdMap[selectedCustomer]

      try {
        const res = await fetch('/api/ai/whatsapp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            message: content,
            language: detectedLang,
            customerId: dbIds?.dbCustomerId || undefined,
            customerName: currentChat?.customerName || 'Unknown',
          }),
        })

        if (res.ok) {
          const data = await res.json()

          // Store DB IDs for future messages
          if (data.customerId || data.conversationSessionId) {
            setDbIdMap((prev) => ({
              ...prev,
              [selectedCustomer]: {
                dbCustomerId: data.customerId || prev[selectedCustomer]?.dbCustomerId,
                dbSessionId: data.conversationSessionId || prev[selectedCustomer]?.dbSessionId,
              },
            }))
          }

          // PIPE MODE: No AI response added to chat
          // data.piped === true means the message was stored but no AI reply generated
          // The customer message already appears in the chat via the optimistic add above
        }
        // No fallback messages on error either — pipe mode
      } catch {
        // Network error — still no fallback message in pipe mode
        // The customer message already appears in the chat
      }
    }

    setCustomerSending(false)
  }, [customerInput, selectedCustomer, customerSending, currentChat, addWhatsappMessage, dbIdMap])

  // Send message via API (agent outbound)
  const handleSendMessage = useCallback(async () => {
    if (!messageInput.trim() || !selectedCustomer || sending) return

    const content = messageInput.trim()
    setIsSending(true)
    setMessageInput('')

    // Optimistically add to store
    const optimisticMsg: WhatsAppMessage = {
      id: `wa-out-${Date.now()}`,
      customerId: selectedCustomer,
      customerName: currentChat?.customerName || 'Unknown',
      customerPhone: currentChat?.customerPhone || '',
      content,
      direction: 'outbound',
      status: 'sent',
      timestamp: new Date(),
      isTemplate: Object.values(WHATSAPP_TEMPLATES).includes(content as typeof WHATSAPP_TEMPLATES[TemplateKey]),
    }
    addWhatsappMessage(optimisticMsg)

    try {
      const dbIds = dbIdMap[selectedCustomer]
      // Also try to get session ID from the current chat's messages
      const sessionFromMessages = currentChat?.messages.find(m => m.conversationId)?.conversationId
      const effectiveSessionId = dbIds?.dbSessionId || sessionFromMessages
      const effectiveCustomerId = dbIds?.dbCustomerId || selectedCustomer

      // 1. Save as WAMessage so it appears in real-time polling (GET /api/realtime/whatsapp)
      //    This is critical for the customer WhatsApp view to see the agent's response.
      if (effectiveSessionId) {
        await fetch('/api/realtime/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId: effectiveSessionId,
            customerId: effectiveCustomerId,
            message: content,
          }),
        })
      }

      // 2. Also save to ConversationSession transcript for admin conversation detail view
      if (effectiveSessionId) {
        await fetch(`/api/conversations/${effectiveSessionId}/message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content,
            sender: 'agent',
            language: 'en',
          }),
        })
      }

      // Update delivery status
      setTimeout(() => {
        useAppStore.getState().setWhatsappMessages(
          useAppStore.getState().whatsappMessages.map((m) =>
            m.id === optimisticMsg.id ? { ...m, status: 'delivered' as const } : m
          )
        )
      }, 1500)

      setTimeout(() => {
        useAppStore.getState().setWhatsappMessages(
          useAppStore.getState().whatsappMessages.map((m) =>
            m.id === optimisticMsg.id ? { ...m, status: 'read' as const } : m
          )
        )
      }, 4000)
    } catch {
      // Mark as failed
      useAppStore.getState().setWhatsappMessages(
        useAppStore.getState().whatsappMessages.map((m) =>
          m.id === optimisticMsg.id ? { ...m, status: 'failed' as const } : m
        )
      )
    }

    setIsSending(false)
  }, [messageInput, selectedCustomer, sending, currentChat, addWhatsappMessage, dbIdMap])

  // ─── Render: Chat List Item ──────────────────────────────────────────────

  const renderChatListItem = (chat: CustomerChat) => {
    const isSelected = selectedCustomer === chat.customerId
    const initials = chat.customerName
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase()

    return (
      <button
        key={chat.customerId}
        onClick={() => handleSelectCustomer(chat.customerId)}
        className={`
          w-full text-left p-3 rounded-xl transition-all duration-200 cursor-pointer group
          border hover:bg-uae-green-50/60
          ${isSelected
            ? 'bg-uae-green-50 border-uae-green-500/40 shadow-sm'
            : 'border-transparent hover:border-border'
          }
        `}
      >
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="relative shrink-0">
            <Avatar className="h-11 w-11">
              <AvatarFallback className="bg-uae-green-100 text-uae-green-700 text-sm font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            {/* WhatsApp green dot */}
            <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 bg-uae-green-500 rounded-full border-2 border-white" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-0.5">
              <span className="font-medium text-sm text-foreground truncate">
                {chat.customerName}
              </span>
              <span className="text-[11px] text-muted-foreground shrink-0">
                {formatRelativeTime(chat.lastMessage.timestamp, t)}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground truncate leading-relaxed">
                {chat.lastMessage.direction === 'outbound' && (
                  <DeliveryStatusIcon status={chat.lastMessage.status} />
                )}
                {' '}
                {chat.lastMessage.content}
              </p>
              {chat.unreadCount > 0 && (
                <Badge className="bg-uae-green-500 text-white text-[10px] h-5 min-w-[20px] flex items-center justify-center px-1.5 shrink-0">
                  {chat.unreadCount}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </button>
    )
  }

  // ─── Render: Chat Detail ─────────────────────────────────────────────────

  const renderChatDetail = () => {
    if (!currentChat) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
          <div className="bg-uae-green-50 rounded-full p-6 mb-4">
            <MessageCircle className="h-12 w-12 text-uae-green-400" />
          </div>
          <h3 className="text-lg font-medium mb-2 text-foreground">
            {t('whatsappChat' as Parameters<typeof t>[0])}
          </h3>
          <p className="text-sm text-center max-w-xs">
            {t('selectChatDesc' as Parameters<typeof t>[0])}
          </p>
        </div>
      )
    }

    const initials = currentChat.customerName
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase()

    return (
      <div className="flex flex-col h-full">
        {/* Chat Header */}
        <div className="px-4 py-3 border-b border-border bg-white">
          <div className="flex items-center gap-3">
            {/* Back button (mobile) */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden h-8 w-8 shrink-0"
              onClick={handleBackToList}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>

            {/* Avatar */}
            <div className="relative shrink-0">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-uae-green-100 text-uae-green-700 text-sm font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 bg-uae-green-500 rounded-full border-2 border-white" />
            </div>

            {/* Customer Info */}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm text-foreground truncate">
                {currentChat.customerName}
              </h3>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {currentChat.customerPhone}
              </p>
            </div>

            {/* Status badge */}
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="secondary" className="bg-uae-green-50 text-uae-green-700 border-uae-green-200 text-[10px] gap-1">
                <div className="h-1.5 w-1.5 bg-uae-green-500 rounded-full" />
                {t('online' as Parameters<typeof t>[0])}
              </Badge>
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 bg-base-50/50 custom-scrollbar">
          <div className="space-y-3 max-w-2xl mx-auto">
            {currentChat.messages.length === 0 && (
              <div className="text-center py-8">
                <MessageCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">{t('noMessagesYet' as Parameters<typeof t>[0])}</p>
              </div>
            )}

            {currentChat.messages.map((msg, idx) => {
              const isOutbound = msg.direction === 'outbound'
              const lang = detectLanguage(msg.content)

              return (
                <div
                  key={`${msg.id}-${idx}`}
                  className={`flex ${isOutbound ? 'justify-end' : 'justify-start'} animate-fade-in`}
                >
                  <div
                    className={`
                      max-w-[80%] sm:max-w-[70%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed
                      shadow-sm relative
                      ${msg.isAIAgent
                        ? 'bg-gradient-to-br from-blue-50 to-blue-100/80 text-foreground border border-blue-200 rounded-br-md'
                        : isOutbound
                          ? 'bg-brand-600 text-white rounded-br-md'
                          : 'bg-uae-green-50 text-foreground border border-uae-green-100 rounded-bl-md'
                      }
                    `}
                  >
                    {/* AI Agent badge */}
                    {msg.isAIAgent && (
                      <div className="flex items-center gap-1 mb-1">
                        <Badge className="bg-gradient-to-r from-blue-500 to-blue-600 text-white text-[9px] h-4 px-1.5 gap-0.5 font-medium border-0">
                          <Brain className="h-2.5 w-2.5" />
                          AI
                        </Badge>
                      </div>
                    )}

                    {/* Template badge */}
                    {msg.isTemplate && isOutbound && !msg.isAIAgent && (
                      <div className="flex items-center gap-1 mb-1 text-[10px] text-brand-200">
                        <Sparkles className="h-3 w-3" />
                        {t('template' as Parameters<typeof t>[0])}
                      </div>
                    )}

                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>

                    {/* Timestamp, language badge, and delivery status */}
                    <div className={`flex items-center gap-1.5 mt-1 ${isOutbound ? 'justify-end' : 'justify-start'}`}>
                      {/* Language badge */}
                      <Badge
                        variant="outline"
                        className={`
                          text-[8px] h-3.5 px-1 font-mono border-0 p-0 gap-0
                          ${msg.isAIAgent
                            ? 'bg-blue-200/60 text-blue-700'
                            : isOutbound
                              ? 'bg-white/20 text-white/70'
                              : 'bg-uae-green-200/60 text-uae-green-700'
                          }
                        `}
                      >
                        {lang.toUpperCase()}
                      </Badge>
                      <span className={`text-[10px] ${isOutbound ? (msg.isAIAgent ? 'text-blue-400' : 'text-brand-200') : 'text-muted-foreground'}`}>
                        {formatTime(msg.timestamp)}
                      </span>
                      {isOutbound && <DeliveryStatusIcon status={msg.status} />}
                    </div>
                  </div>
                </div>
              )
            })}

            {/* AI typing indicator */}
            {showAITyping && (
              <div className="flex justify-start animate-fade-in">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100/80 border border-blue-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-1.5">
                    <Brain className="h-3.5 w-3.5 text-blue-500 animate-pulse" />
                    <div className="flex gap-1">
                      <div className="h-1.5 w-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:0ms]" />
                      <div className="h-1.5 w-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:150ms]" />
                      <div className="h-1.5 w-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:300ms]" />
                    </div>
                    <span className="text-xs text-blue-600 ml-1 font-medium">
                      {t('aiAgentTyping' as Parameters<typeof t>[0])}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Customer typing indicator */}
            {showTyping && !showAITyping && (
              <div className="flex justify-start animate-fade-in">
                <div className="bg-uae-green-50 border border-uae-green-100 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-1.5">
                    <div className="flex gap-1">
                      <div className="h-1.5 w-1.5 bg-uae-green-400 rounded-full animate-bounce [animation-delay:0ms]" />
                      <div className="h-1.5 w-1.5 bg-uae-green-400 rounded-full animate-bounce [animation-delay:150ms]" />
                      <div className="h-1.5 w-1.5 bg-uae-green-400 rounded-full animate-bounce [animation-delay:300ms]" />
                    </div>
                    <span className="text-xs text-muted-foreground ml-1">
                      {t('typing' as Parameters<typeof t>[0])}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>
        </div>

        {/* Template Buttons */}
        <div className="px-4 pt-2 pb-1 border-t border-border bg-white">
          <div className="max-w-2xl mx-auto">
            <p className="text-[10px] text-muted-foreground font-medium mb-1.5 uppercase tracking-wider">
              {t('whatsappTemplates' as Parameters<typeof t>[0])}
            </p>
            <div className="flex gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
              {([
                { key: 'greeting' as TemplateKey, label: t('greetingTemplate' as Parameters<typeof t>[0]), icon: <MessageCircle className="h-3 w-3" /> },
                { key: 'followUp' as TemplateKey, label: t('followUpTemplate' as Parameters<typeof t>[0]), icon: <Clock className="h-3 w-3" /> },
                { key: 'resolution' as TemplateKey, label: t('resolutionTemplate' as Parameters<typeof t>[0]), icon: <CheckCheck className="h-3 w-3" /> },
                { key: 'escalation' as TemplateKey, label: t('escalationTemplate' as Parameters<typeof t>[0]), icon: <User className="h-3 w-3" /> },
              ]).map((tmpl) => (
                <Button
                  key={tmpl.key}
                  variant="outline"
                  size="sm"
                  className="h-7 text-[11px] gap-1 shrink-0 border-uae-green-200 text-uae-green-700 hover:bg-uae-green-50 hover:border-uae-green-300 px-2.5"
                  onClick={() => handleTemplate(tmpl.key)}
                >
                  {tmpl.icon}
                  {tmpl.label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Agent Message Input */}
        <div className="p-3 border-t border-border bg-white">
          <div className="max-w-2xl mx-auto flex gap-2 items-end">
            <Textarea
              ref={textareaRef}
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              placeholder={t('sendMessage' as Parameters<typeof t>[0]) + '...'}
              className="resize-none min-h-[40px] max-h-28 bg-base-50 border-border text-foreground placeholder:text-muted-foreground text-sm rounded-xl"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSendMessage()
                }
              }}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!messageInput.trim() || sending}
              className="bg-uae-green-600 hover:bg-uae-green-700 text-white shrink-0 self-end rounded-xl h-10 w-10 p-0"
              size="icon"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Simulate Customer Input */}
        <div className="p-3 border-t-2 border-dashed border-amber-300 bg-amber-50/40">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center gap-1.5 mb-1.5">
              <User className="h-3 w-3 text-amber-600" />
              <span className="text-[10px] font-semibold text-amber-700 uppercase tracking-wider">
                {t('simulateCustomer' as Parameters<typeof t>[0])}
              </span>

            </div>
            <div className="flex gap-2 items-end">
              <Textarea
                ref={customerTextareaRef}
                value={customerInput}
                onChange={(e) => setCustomerInput(e.target.value)}
                placeholder="Type as customer... / \u0627\u0643\u062A\u0628 \u0643\u0639\u0645\u0644..."
                className="resize-none min-h-[40px] max-h-28 bg-white border-amber-200 text-foreground placeholder:text-amber-400/70 text-sm rounded-xl focus-visible:ring-amber-300"
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSendCustomerMessage()
                  }
                }}
              />
              <Button
                onClick={handleSendCustomerMessage}
                disabled={!customerInput.trim() || customerSending}
                className="bg-amber-500 hover:bg-amber-600 text-white shrink-0 self-end rounded-xl h-10 w-10 p-0"
                size="icon"
              >
                {customerSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <User className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ─── Render: Main Layout ─────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-border shadow-sm overflow-hidden relative">
      {/* New Conversation Dialog */}
      {showNewConvDialog && (
        <div className="absolute inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center gap-2">
              <div className="bg-uae-green-100 rounded-lg p-2">
                <MessageCircle className="h-5 w-5 text-uae-green-600" />
              </div>
              <h3 className="font-semibold text-foreground">New WhatsApp Conversation</h3>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Customer Name</label>
                <Input
                  value={newConvName}
                  onChange={(e) => setNewConvName(e.target.value)}
                  placeholder="e.g. Ahmed Al Maktoum"
                  className="h-9 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Phone Number</label>
                <Input
                  value={newConvPhone}
                  onChange={(e) => setNewConvPhone(e.target.value)}
                  placeholder="+971501234567"
                  className="h-9 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowNewConvDialog(false)
                  setNewConvName('')
                  setNewConvPhone('')
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-uae-green-600 hover:bg-uae-green-700 text-white"
                onClick={handleCreateNewConversation}
              >
                Start Conversation
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Panel Header */}
      <div className="px-4 py-3 border-b border-border bg-gradient-to-r from-uae-green-600 to-uae-green-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="bg-white/20 rounded-lg p-1.5">
              <MessageCircle className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-white text-sm">
                {t('whatsappChannel' as Parameters<typeof t>[0])}
              </h2>
              <p className="text-[11px] text-uae-green-100">
                {filteredChats.length} {t('conversations' as Parameters<typeof t>[0])}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {whatsappUnread > 0 && (
              <Badge className="bg-white text-uae-green-700 text-xs font-bold h-6 min-w-[24px] flex items-center justify-center px-2">
                {whatsappUnread}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-white hover:bg-white/20 shrink-0"
              onClick={handleStartNewConversation}
              title="New Conversation"
            >
              <Plus className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-1.5 bg-white/20 rounded-full px-2.5 py-1">
              <div className="h-2 w-2 bg-uae-green-300 rounded-full animate-pulse" />
              <span className="text-[11px] text-white font-medium">{t('live' as Parameters<typeof t>[0])}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 flex min-h-0">
        {/* Chat List - hidden on mobile when in chat view */}
        <div
          className={`
            border-r border-border flex flex-col
            md:w-80 lg:w-96 md:flex md:shrink-0
            ${mobileView === 'chat' ? 'hidden md:flex' : 'flex w-full'}
          `}
        >
          {/* Search */}
          <div className="p-3 border-b border-border bg-white">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('searchConversations' as Parameters<typeof t>[0])}
                className="h-8 text-xs bg-base-50 border-border pl-8 rounded-lg"
              />
            </div>
          </div>

          {/* Chat List */}
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {filteredChats.length === 0 ? (
                <div className="p-8 text-center">
                  <MessageCircle className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground font-medium">{t('noConversations' as Parameters<typeof t>[0])}</p>
                  <p className="text-xs text-muted-foreground/60 mt-1 mb-4">
                    {t('noConversationsDesc' as Parameters<typeof t>[0])}
                  </p>
                  <Button
                    onClick={handleStartNewConversation}
                    className="bg-uae-green-600 hover:bg-uae-green-700 text-white gap-1.5"
                    size="sm"
                  >
                    <Plus className="h-4 w-4" />
                    {t('startTestConversation' as Parameters<typeof t>[0])}
                  </Button>
                </div>
              ) : (
                filteredChats.map(renderChatListItem)
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Chat Detail - full width on mobile when in chat view */}
        <div
          className={`
            flex-1 min-w-0 flex flex-col
            ${mobileView === 'list' ? 'hidden md:flex' : 'flex'}
          `}
        >
          {renderChatDetail()}
        </div>
      </div>
    </div>
  )
}
