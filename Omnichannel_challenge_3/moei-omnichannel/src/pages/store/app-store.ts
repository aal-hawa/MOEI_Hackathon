import { create } from 'zustand'

export type Language = 'en' | 'ar' | 'fr' | 'pt' | 'es' | 'ur' | 'hi' | 'zh'

export const LANGUAGE_LABELS: Record<Language, { native: string; english: string }> = {
  en: { native: 'English', english: 'English' },
  ar: { native: 'العربية', english: 'Arabic' },
  fr: { native: 'Français', english: 'French' },
  pt: { native: 'Português', english: 'Portuguese' },
  es: { native: 'Español', english: 'Spanish' },
  ur: { native: 'اردو', english: 'Urdu' },
  hi: { native: 'हिन्दी', english: 'Hindi' },
  zh: { native: '中文', english: 'Chinese' },
}

export const RTL_LANGUAGES: Language[] = ['ar', 'ur']
// ViewMode removed — routing is now handled by Next.js App Router pages

interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  intent?: string
  sentiment?: number
  channel?: string
}

interface CustomerContext {
  id: string
  name: string
  email?: string
  phone?: string
  preferredLang: string
  preferredChannel: string
  sentiment: number
  activeCases: number
}

export interface Conversation {
  id: string
  customerId: string
  customerName: string
  channel: string
  intent: string
  sentiment: number
  duration: number
  messages: number
  language: string
  alert?: boolean
  alertType?: string
}

interface KPIs {
  totalInteractions: number
  avgResolutionTime: number
  firstContactResolution: number
  csat: number
  selfServiceDeflection: number
  escalationRate: number
  activeCases: number
  agentsOnline: number
  channelBreakdown?: Record<string, number>
  sentimentTrend?: { date: string; value: number }[]
  trends?: Record<string, number[]>
}

interface QueueStatus {
  voice: { waiting: number; avgWait: number; activeAgents: number }
  whatsapp: { waiting: number; avgWait: number; activeAgents: number }
  web: { waiting: number; avgWait: number; activeAgents: number }
}

export interface WhatsAppMessage {
  id: string
  customerId: string
  customerName: string
  customerPhone: string
  content: string
  direction: 'inbound' | 'outbound'
  status: 'sent' | 'delivered' | 'read' | 'failed'
  timestamp: Date
  isTemplate: boolean
  isAIAgent?: boolean
  conversationId?: string  // DB session ID for API calls
}

export interface EmailMessage {
  id: string
  customerId: string | null
  fromAddress: string
  toAddress: string
  subject: string
  body: string
  direction: 'inbound' | 'outbound'
  status: string
  threadId: string | null
  aiReplied: boolean
  createdAt: Date
}

export interface ActiveCall {
  id: string
  customerId: string
  customerName: string
  customerPhone: string
  direction: 'inbound' | 'outbound'
  status: 'ringing' | 'answered' | 'on-hold' | 'transferring' | 'ended'
  duration: number
  startedAt: Date
  agentId?: string
  transcript?: string[]
  sentiment?: number
  isAIHandled?: boolean
}

// ─── Employer / Agent State Types ──────────────────────────────────────────────

export interface CurrentAgent {
  id: string
  name: string
  email: string
  role: string
  avatar?: string
}

export type NotificationType = 'email' | 'whatsapp' | 'voice' | 'transfer' | 'system' | 'request_created'

export interface EmployerNotification {
  id: string
  type: NotificationType
  title: string
  message: string
  timestamp: Date
  read: boolean
  link?: string
}

export interface ConversationSession {
  id: string
  customerName: string
  channel: 'web' | 'whatsapp' | 'voice' | 'email'
  language: string
  aiMode: 'full_ai' | 'ai_assist' | 'llm_tts' | 'human_only' | 'ai_disabled'
  sentiment: number
  duration: number
  status: 'active' | 'waiting' | 'transferred' | 'closed' | 'resolved'
  customerId?: string
  hasRecording?: boolean
  recordingDuration?: number
  unreadCount?: number
}

export type AiMode = 'full_ai' | 'ai_assist' | 'llm_tts' | 'human_only' | 'ai_disabled'

export interface TranscriptChunk {
  id: string
  speaker: 'customer' | 'agent' | 'ai'
  text: string
  textTranslation?: string
  language: string
  timestamp: Date
}

export interface AiSuggestion {
  id: string
  text: string
  confidence: number
  type: 'response' | 'action' | 'knowledge'
}

type PageView = 'home' | 'customer' | 'admin' | 'executive' | 'voice-call' | 'whatsapp' | 'email' | 'departments'

interface AppState {
  // UI State
  language: Language
  pageView: PageView
  currentView: string
  sidebarOpen: boolean
  sidebarCollapsed: boolean
  chatOpen: boolean

  // Customer State
  customerContext: CustomerContext | null
  chatMessages: ChatMessage[]
  chatSessionId: string
  isChatLoading: boolean

  // Agent State
  activeConversations: Conversation[]
  selectedConversation: string | null
  copilotSuggestions: string[]

  // Executive State
  kpis: KPIs
  queueStatus: QueueStatus
  sentimentTimeline: { time: string; positive: number; neutral: number; negative: number }[]

  // WhatsApp State
  whatsappMessages: WhatsAppMessage[]
  whatsappUnread: number

  // Call Center State
  activeCalls: ActiveCall[]
  currentCallId: string | null

  // Email State
  emailMessages: EmailMessage[]
  emailUnread: number

  // Employer / Agent State
  currentAgent: CurrentAgent | null
  employerNotifications: EmployerNotification[]
  employerUnreadCount: number
  conversationSessions: ConversationSession[]
  selectedSessionId: string | null
  sessionTranscript: TranscriptChunk[]
  aiSuggestions: AiSuggestion[]

  // Actions
  setPageView: (view: PageView) => void
  setView: (view: string) => void
  setLanguage: (lang: Language) => void
  toggleSidebar: () => void
  toggleChat: () => void
  setChatOpen: (open: boolean) => void
  setCustomerContext: (ctx: CustomerContext | null) => void
  addChatMessage: (msg: ChatMessage) => void
  setChatMessages: (msgs: ChatMessage[]) => void
  setChatSessionId: (id: string) => void
  setIsChatLoading: (loading: boolean) => void
  setActiveConversations: (convs: Conversation[]) => void
  setSelectedConversation: (id: string | null) => void
  setCopilotSuggestions: (suggestions: string[]) => void
  setKpis: (kpis: KPIs) => void
  setQueueStatus: (status: QueueStatus) => void
  setSentimentTimeline: (timeline: { time: string; positive: number; neutral: number; negative: number }[]) => void

  // WhatsApp Actions
  setWhatsappMessages: (messages: WhatsAppMessage[]) => void
  addWhatsappMessage: (message: WhatsAppMessage) => void
  setWhatsappUnread: (count: number) => void
  incrementWhatsappUnread: () => void
  resetWhatsappUnread: () => void

  // Call Center Actions
  setActiveCalls: (calls: ActiveCall[]) => void
  addActiveCall: (call: ActiveCall) => void
  updateActiveCall: (id: string, updates: Partial<ActiveCall>) => void
  removeActiveCall: (id: string) => void
  setCurrentCallId: (id: string | null) => void

  // Email Actions
  setEmailMessages: (messages: EmailMessage[]) => void
  addEmailMessage: (message: EmailMessage) => void
  setEmailUnread: (count: number) => void
  incrementEmailUnread: () => void

  // Employer / Agent Actions
  setCurrentAgent: (agent: CurrentAgent | null) => void
  setEmployerNotifications: (notifications: EmployerNotification[]) => void
  addNotification: (notification: EmployerNotification) => void
  markNotificationRead: (id: string) => void
  setConversationSessions: (sessions: ConversationSession[]) => void
  setSelectedSessionId: (id: string | null) => void
  setSessionTranscript: (chunks: TranscriptChunk[]) => void
  setAiSuggestions: (suggestions: AiSuggestion[]) => void
  markSessionRead: (sessionId: string) => void
  incrementEmployerUnread: () => void
  resetEmployerUnread: () => void
  setEmployerUnreadCount: (count: number) => void
}

export const useAppStore = create<AppState>((set) => ({
  language: 'en',
  pageView: 'home' as PageView,
  currentView: 'dashboard',
  sidebarOpen: false,
  sidebarCollapsed: false,
  chatOpen: false,
  customerContext: null,
  chatMessages: [],
  chatSessionId: `session-${Date.now()}`,
  isChatLoading: false,
  activeConversations: [],
  selectedConversation: null,
  copilotSuggestions: [],
  kpis: {
    totalInteractions: 0,
    avgResolutionTime: 0,
    firstContactResolution: 0,
    csat: 0,
    selfServiceDeflection: 0,
    escalationRate: 0,
    activeCases: 0,
    agentsOnline: 0,
  },
  queueStatus: {
    voice: { waiting: 0, avgWait: 0, activeAgents: 0 },
    whatsapp: { waiting: 0, avgWait: 0, activeAgents: 0 },
    web: { waiting: 0, avgWait: 0, activeAgents: 0 },
  },
  sentimentTimeline: [],

  // WhatsApp State
  whatsappMessages: [],
  whatsappUnread: 0,

  // Call Center State
  activeCalls: [],
  currentCallId: null,

  // Email State
  emailMessages: [],
  emailUnread: 0,

  // Employer / Agent State
  currentAgent: null,
  employerNotifications: [],
  employerUnreadCount: 0,
  conversationSessions: [],
  selectedSessionId: null,
  sessionTranscript: [],
  aiSuggestions: [],

  setPageView: (pageView) => set({ pageView }),
  setView: (currentView) => set({ currentView }),
  setLanguage: (language) => set({ language }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen, sidebarCollapsed: !s.sidebarCollapsed })),
  toggleChat: () => set((s) => ({ chatOpen: !s.chatOpen })),
  setChatOpen: (chatOpen) => set({ chatOpen }),
  setCustomerContext: (customerContext) => set({ customerContext }),
  addChatMessage: (msg) => set((s) => ({ chatMessages: [...s.chatMessages, msg] })),
  setChatMessages: (chatMessages) => set({ chatMessages }),
  setChatSessionId: (chatSessionId) => set({ chatSessionId }),
  setIsChatLoading: (isChatLoading) => set({ isChatLoading }),
  setActiveConversations: (activeConversations) => set({ activeConversations }),
  setSelectedConversation: (selectedConversation) => set({ selectedConversation }),
  setCopilotSuggestions: (copilotSuggestions) => set({ copilotSuggestions }),
  setKpis: (kpis) => set({ kpis }),
  setQueueStatus: (queueStatus) => set({ queueStatus }),
  setSentimentTimeline: (sentimentTimeline) => set({ sentimentTimeline }),

  // WhatsApp Actions
  setWhatsappMessages: (whatsappMessages) => set({ whatsappMessages }),
  addWhatsappMessage: (message) => set((s) => {
    // Deduplicate by ID to prevent React key warnings
    if (s.whatsappMessages.some((m) => m.id === message.id)) return s
    return { whatsappMessages: [...s.whatsappMessages, message] }
  }),
  setWhatsappUnread: (whatsappUnread) => set({ whatsappUnread }),
  incrementWhatsappUnread: () => set((s) => ({ whatsappUnread: s.whatsappUnread + 1 })),
  resetWhatsappUnread: () => set({ whatsappUnread: 0 }),

  // Call Center Actions
  setActiveCalls: (activeCalls) => set({ activeCalls }),
  addActiveCall: (call) => set((s) => ({ activeCalls: [...s.activeCalls, call] })),
  updateActiveCall: (id, updates) => set((s) => ({
    activeCalls: s.activeCalls.map((call) => call.id === id ? { ...call, ...updates } : call),
  })),
  removeActiveCall: (id) => set((s) => ({
    activeCalls: s.activeCalls.filter((call) => call.id !== id),
  })),
  setCurrentCallId: (currentCallId) => set({ currentCallId }),

  // Email Actions
  setEmailMessages: (emailMessages) => set({ emailMessages }),
  addEmailMessage: (message) => set((s) => ({ emailMessages: [...s.emailMessages, message] })),
  setEmailUnread: (emailUnread) => set({ emailUnread }),
  incrementEmailUnread: () => set((s) => ({ emailUnread: s.emailUnread + 1 })),

  // Employer / Agent Actions
  setCurrentAgent: (currentAgent) => set({ currentAgent }),
  setEmployerNotifications: (employerNotifications) => set({
    employerNotifications,
    employerUnreadCount: employerNotifications.filter(n => !n.read).length,
  }),
  addNotification: (notification) => set((s) => ({
    employerNotifications: [notification, ...s.employerNotifications],
    employerUnreadCount: s.employerUnreadCount + 1,
  })),
  markNotificationRead: (id) => set((s) => ({
    employerNotifications: s.employerNotifications.map((n) =>
      n.id === id ? { ...n, read: true } : n
    ),
    employerUnreadCount: Math.max(0, s.employerUnreadCount - (s.employerNotifications.find(n => n.id === id && !n.read) ? 1 : 0)),
  })),
  setConversationSessions: (conversationSessions) => set({ conversationSessions }),
  setSelectedSessionId: (selectedSessionId) => set({ selectedSessionId }),
  setSessionTranscript: (sessionTranscript) => set({ sessionTranscript }),
  setAiSuggestions: (aiSuggestions) => set({ aiSuggestions }),
  markSessionRead: (sessionId) => set((s) => ({
    conversationSessions: s.conversationSessions.map((session) =>
      session.id === sessionId ? { ...session, unreadCount: 0 } : session
    ),
  })),
  incrementEmployerUnread: () => set((s) => ({ employerUnreadCount: s.employerUnreadCount + 1 })),
  resetEmployerUnread: () => set({ employerUnreadCount: 0 }),
  setEmployerUnreadCount: (employerUnreadCount) => set({ employerUnreadCount }),
}))
