'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  ArrowRight,
  MessageSquare,
  Phone,
  Globe,
  Inbox,
  ExternalLink,
  Plus,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Bell,
  Flame,
  Home,
  FileSearch,
  Clock,
  User,
  Sparkles,
  ChevronDown,
  ChevronRight,
  BookOpen,
  Lock,
  LogOut,
  Fingerprint,
} from 'lucide-react'
import { useTranslation } from '@/i18n'
import { useAppStore } from '@/store/app-store'
import { useAuthStore } from '@/components/shared/lib/auth-store'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import ServiceStatusMonitor from '@/components/portal/service-status-monitor'
import AIDocumentAnalysis from '@/components/portal/ai-document-analysis'
import SatisfactionSurvey from '@/components/portal/satisfaction-survey'
import EmergencyContacts from '@/components/portal/emergency-contacts'
import CustomerJourneyMap from '@/components/portal/customer-journey-map'
import {
  ServiceRequestProgressTracker,
  AppointmentScheduler,
  PaymentsSection,
  FeedbackRatingSystem,
  SectionHeader,
  ToastContainer,
  BackToTopButton,
  GlassmorphismSearchBox,
  PortalSkeleton,
  emitToast,
  fadeUp as sectionFadeUp,
  stagger as sectionStagger,
} from '@/components/portal/portal-enhancements'
import { MoeiPageLayout } from '@/components/shared/layouts/moei-page-layout'
import { UAEPassLoginDialog } from '@/components/shared/ui/uaepass-login-dialog'
import { MOCK_USERS, type MockUserProfile } from '@/components/shared/lib/uaepass-mock'

// ─── Types ───────────────────────────────────────────────────────────────────

interface CaseRecord {
  id: string
  referenceNumber: string
  titleEn: string
  titleAr?: string
  description?: string
  status: string
  priority: string
  channel: string
  category?: string
  createdAt: string
  updatedAt?: string
  assignedAgent?: string
  resolvedAt?: string
  customer?: {
    id: string
    nameEn: string
    nameAr?: string
  }
}

interface KnowledgeResult {
  id: string
  title: string
  content: string
  category: string
  tags: string[]
}

interface NotificationItem {
  id: string
  type: 'case_update' | 'new_message' | 'payment'
  titleKey: string
  params: Record<string, string>
  time: Date
  read: boolean
}

// ─── Status / Priority badge helpers ─────────────────────────────────────────

const statusConfig: Record<string, { labelKey: 'open' | 'inProgress' | 'resolved' | 'escalated'; className: string }> = {
  open: { labelKey: 'open', className: 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100' },
  in_progress: { labelKey: 'inProgress', className: 'bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100' },
  resolved: { labelKey: 'resolved', className: 'bg-green-100 text-green-800 border-green-200 hover:bg-green-100' },
  escalated: { labelKey: 'escalated', className: 'bg-red-100 text-red-800 border-red-200 hover:bg-red-100' },
}

const priorityConfig: Record<string, { labelKey: 'high' | 'medium' | 'low'; className: string }> = {
  high: { labelKey: 'high', className: 'bg-red-100 text-red-800 border-red-200 hover:bg-red-100' },
  medium: { labelKey: 'medium', className: 'bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100' },
  low: { labelKey: 'low', className: 'bg-green-100 text-green-800 border-green-200 hover:bg-green-100' },
}

const channelIcon: Record<string, React.ElementType> = {
  whatsapp: MessageSquare,
  voice: Phone,
  web: Globe,
  email: Inbox,
}

// ─── Animation variants ─────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: 'easeOut' as const },
  }),
}

const stagger = {
  visible: { transition: { staggerChildren: 0.08 } },
}

// ─── Case Timeline Component ────────────────────────────────────────────────

function CaseTimeline({ caseRecord, language }: { caseRecord: CaseRecord; language: string }) {
  const { t } = useTranslation()
  const createdDate = new Date(caseRecord.createdAt)
  const updatedDate = caseRecord.updatedAt ? new Date(caseRecord.updatedAt) : null
  const resolvedDate = caseRecord.resolvedAt ? new Date(caseRecord.resolvedAt) : null

  const formatDate = (d: Date) =>
    d.toLocaleDateString(language === 'ar' ? 'ar-AE' : 'en-AE', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    })

  type StepKey = 'created' | 'assigned' | 'inProgress' | 'resolved'
  const steps: { key: StepKey; labelKey: string; icon: React.ElementType; date?: Date | null; done: boolean }[] = [
    { key: 'created', labelKey: 'timelineCreated', icon: Plus, date: createdDate, done: true },
    { key: 'assigned', labelKey: 'timelineAssigned', icon: User, date: caseRecord.assignedAgent ? createdDate : null, done: !!caseRecord.assignedAgent },
    { key: 'inProgress', labelKey: 'timelineInProgress', icon: Clock, date: updatedDate && caseRecord.status !== 'open' ? updatedDate : null, done: ['in_progress', 'resolved', 'escalated'].includes(caseRecord.status) },
    { key: 'resolved', labelKey: 'timelineResolved', icon: CheckCircle2, date: resolvedDate, done: caseRecord.status === 'resolved' },
  ]

  return (
    <div className="relative pl-6">
      {/* Vertical line */}
      <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-base-200" />
      {steps.map((step, i) => {
        const Icon = step.icon
        return (
          <div key={step.key} className="relative flex items-start gap-3 pb-4 last:pb-0">
            <div className={`absolute left-[-18px] w-6 h-6 rounded-full flex items-center justify-center z-10 ${
              step.done ? 'bg-[#92722A] text-white' : 'bg-base-200 text-base-400'
            }`}>
              <Icon className="w-3 h-3" />
            </div>
            <div className="ml-4">
              <p className={`text-sm font-medium ${step.done ? 'text-base-900' : 'text-base-400'}`}>
                {t(step.labelKey as Parameters<typeof t>[0])}
              </p>
              {step.date && (
                <p className="text-xs text-muted-foreground mt-0.5">{formatDate(step.date)}</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Notification Center Component ───────────────────────────────────────────

function NotificationCenter({ language, cases }: { language: string; cases: CaseRecord[] }) {
  const { t } = useTranslation()
  const kpis = useAppStore((s) => s.kpis)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [open, setOpen] = useState(false)

  // Generate notifications from actual user cases (not fake data)
  useEffect(() => {
    const items: NotificationItem[] = []

    if (cases && cases.length > 0) {
      cases.slice(0, 5).forEach((c, i) => {
        const createdDate = new Date(c.createdAt)
        const timeDiff = Date.now() - createdDate.getTime()

        if (c.status === 'in_progress') {
          items.push({
            id: `notif-${c.id}-progress`,
            type: 'case_update',
            titleKey: 'notificationCaseUpdate',
            params: { ref: c.referenceNumber, status: t('inProgress') },
            time: c.updatedAt ? new Date(c.updatedAt) : createdDate,
            read: timeDiff > 3600000,
          })
        } else if (c.status === 'resolved') {
          items.push({
            id: `notif-${c.id}-resolved`,
            type: 'case_update',
            titleKey: 'notificationCaseUpdate',
            params: { ref: c.referenceNumber, status: t('resolved') },
            time: c.resolvedAt ? new Date(c.resolvedAt) : createdDate,
            read: true,
          })
        } else if (c.status === 'escalated') {
          items.push({
            id: `notif-${c.id}-escalated`,
            type: 'case_update',
            titleKey: 'notificationCaseUpdate',
            params: { ref: c.referenceNumber, status: t('escalated') },
            time: c.updatedAt ? new Date(c.updatedAt) : createdDate,
            read: false,
          })
        } else {
          items.push({
            id: `notif-${c.id}-open`,
            type: 'new_message',
            titleKey: 'notificationNewMessage',
            params: { ref: c.referenceNumber },
            time: createdDate,
            read: timeDiff > 7200000,
          })
        }
      })
    }

    // Sort by time, newest first
    items.sort((a, b) => b.time.getTime() - a.time.getTime())
    setNotifications(items)
  }, [language, t, cases])

  const unreadCount = notifications.filter((n) => !n.read).length
  const formatNotifTime = (d: Date) => {
    const diff = Date.now() - d.getTime()
    if (diff < 60000) return t('justNow')
    if (diff < 3600000) return `${Math.floor(diff / 60000)}${t('minAgo')}`
    return `${Math.floor(diff / 3600000)}${t('hAgo')}`
  }

  const getNotifText = (n: NotificationItem) =>
    t(n.titleKey as Parameters<typeof t>[0]).replace(/\{(\w+)\}/g, (_, k) => n.params[k] || '')

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-uae-red-500 text-white text-[9px] font-bold flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h4 className="text-sm font-semibold">{t('notificationBell')}</h4>
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="text-xs text-[#92722A] hover:text-[#7A6124] font-medium">
              {t('markAllRead')}
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto custom-scrollbar">
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">{t('noNotifications')}</div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`px-4 py-3 border-b last:border-0 hover:bg-base-50 transition-colors ${!n.read ? 'bg-[#92722A]/5' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${!n.read ? 'bg-[#92722A]' : 'bg-transparent'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">{getNotifText(n)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{formatNotifTime(n.time)}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────

// ─── Auth Storage Key (same as AI chat widget) ──────────────────────────────

const AUTH_STORAGE_KEY = 'moei-chat-auth'

// ─── Login Required Overlay Component ────────────────────────────────────────

function LoginRequiredOverlay({ onLogin }: { onLogin: () => void }) {
  const { t } = useTranslation()

  const handleLoginClick = () => {
    onLogin()
  }

  return (
    <div className="relative">
      <div className="blur-[6px] opacity-40 pointer-events-none select-none" aria-hidden="true">
        {/* Blurred placeholder content */}
        <div className="h-48 rounded-xl bg-muted/30" />
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm rounded-xl">
        <div className="text-center p-6">
          <div className="w-12 h-12 rounded-full bg-[#92722A]/10 flex items-center justify-center mx-auto mb-3">
            <Lock className="w-6 h-6 text-[#92722A]" />
          </div>
          <h3 className="text-lg font-semibold mb-1">{t('loginRequired')}</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-[260px]">{t('loginRequiredDesc')}</p>
          <Button onClick={handleLoginClick} className="bg-[#92722A] hover:bg-[#7A6124] text-white gap-1.5">
            <Fingerprint className="w-4 h-4" />
            {t('loginToAccess')}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function CustomerPortal() {
  const { t, isRTL, language } = useTranslation()
  const { customerContext, setChatOpen, setCustomerContext } = useAppStore()
  const { userProfile } = useAuthStore()

  // Auth state - uses same localStorage key as AI chat widget
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authUser, setAuthUser] = useState<{ name: string; email: string; customerId?: string } | null>(null)

  // Check auth from BOTH localStorage AND useAuthStore on mount & listen for changes
  // CRITICAL: Keep both auth systems in sync so CustomerCommHub (uses useAuthStore)
  // always reflects the same state as the portal header (uses localStorage)
  useEffect(() => {
    const checkAuth = () => {
      try {
        // First check localStorage (moei-chat-auth)
        const raw = localStorage.getItem(AUTH_STORAGE_KEY)
        if (raw) {
          const auth = JSON.parse(raw)
          setIsAuthenticated(true)
          setAuthUser({ name: auth.name, email: auth.email, customerId: auth.customerId })

          // SYNC TO Zustand: If localStorage has auth but Zustand doesn't, sync it
          // This is the key fix for existing sessions where user logged in before
          const zustandState = useAuthStore.getState()
          if (!zustandState.isAuthenticated && auth.customerId) {
            // Find matching mock user profile or create a basic one
            const matchingProfile = Object.values(MOCK_USERS).find(
              (p) => p.idn === auth.customerId || p.fullnameEN === auth.name
            )
            if (matchingProfile) {
              zustandState.loginWithMockUser(matchingProfile)
            } else {
              // Create a minimal profile from localStorage data
              const minimalProfile: MockUserProfile = {
                sub: auth.customerId || 'unknown',
                idn: auth.customerId || '',
                firstnameEN: auth.name?.split(' ')[0] || '',
                lastnameEN: auth.name?.split(' ').slice(1).join(' ') || '',
                firstnameAR: '',
                lastnameAR: '',
                fullnameEN: auth.name || '',
                fullnameAR: '',
                email: auth.email || '',
                mobile: '',
                nationalityEN: 'UAE',
                nationalityAR: 'الإمارات',
                gender: 'male',
                dob: '1990-01-01',
                role: 'citizen',
                sopLevel: 'sop2',
              }
              zustandState.loginWithMockUser(minimalProfile)
            }
          }
          return
        }
        // Fallback: check Zustand auth store (used by CustomerCommHub)
        const zustandAuth = useAuthStore.getState()
        if (zustandAuth.isAuthenticated && zustandAuth.userProfile) {
          const profile = zustandAuth.userProfile
          setIsAuthenticated(true)
          setAuthUser({
            name: profile.fullnameEN,
            email: profile.email,
            customerId: profile.idn || zustandAuth.selectedMockUserId || undefined,
          })
          // Also sync to localStorage for consistency
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
            name: profile.fullnameEN,
            email: profile.email,
            customerId: profile.idn || zustandAuth.selectedMockUserId,
          }))
          return
        }
        setIsAuthenticated(false)
        setAuthUser(null)
      } catch {
        setIsAuthenticated(false)
        setAuthUser(null)
      }
    }
    checkAuth()
    // Listen for storage changes (e.g. when user logs in via chat widget)
    window.addEventListener('storage', checkAuth)
    // Listen for logout event from chat widget
    const handlePortalLogout = () => {
      setIsAuthenticated(false)
      setAuthUser(null)
      setCases([])
    }
    window.addEventListener('moei-logout', handlePortalLogout)
    // Also poll periodically since same-tab localStorage changes don't fire storage event
    const interval = setInterval(checkAuth, 2000)
    return () => {
      window.removeEventListener('storage', checkAuth)
      window.removeEventListener('moei-logout', handlePortalLogout)
      clearInterval(interval)
    }
  }, [])

  const [cases, setCases] = useState<CaseRecord[]>([])
  const [casesLoading, setCasesLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<KnowledgeResult[]>([])
  const [searching, setSearching] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  // Smart search state
  const [aiAnswer, setAiAnswer] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiRelatedServices, setAiRelatedServices] = useState<KnowledgeResult[]>([])
  const [showAiPanel, setShowAiPanel] = useState(false)

  // Case timeline
  const [expandedCase, setExpandedCase] = useState<string | null>(null)

  // Quick actions
  const [refLookupValue, setRefLookupValue] = useState('')
  const [refLookupResult, setRefLookupResult] = useState<CaseRecord | null>(null)
  const [refLookupLoading, setRefLookupLoading] = useState(false)
  const [refLookupError, setRefLookupError] = useState(false)

  // New case dialog
  const [newCaseOpen, setNewCaseOpen] = useState(false)
  const [newCaseTitle, setNewCaseTitle] = useState('')
  const [newCaseDesc, setNewCaseDesc] = useState('')
  const [newCasePriority, setNewCasePriority] = useState('medium')
  const [creatingCase, setCreatingCase] = useState(false)
  const [caseCreated, setCaseCreated] = useState(false)
  const [caseError, setCaseError] = useState('')

  // Login Dialog state
  const [loginDialogOpen, setLoginDialogOpen] = useState(false)

  // Service Status collapsible state
  const [showServiceStatus, setShowServiceStatus] = useState(false)

  const handleMockUaePassLogin = (profile: MockUserProfile) => {
    const auth = {
      name: profile.fullnameEN,
      email: profile.email || `${profile.idn}@example.com`,
      customerId: profile.idn,
    }
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth))
    setIsAuthenticated(true)
    setAuthUser(auth)
    window.dispatchEvent(new Event('storage'))

    // ALSO sync to the Zustand auth store (used by CustomerCommHub)
    // This is critical: CustomerCommHub reads from useAuthStore, not from localStorage
    try {
      useAuthStore.getState().loginWithMockUser(profile)
    } catch (e) {
      console.warn('Failed to sync auth to Zustand store:', e)
    }

    // Sync customer to DB and resolve the real Customer.id (CUID)
    // This ensures /api/cases?customerId=X works with both IDN and CUID
    fetch('/api/customers/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idn: profile.idn,
        sub: profile.sub,
        fullnameEN: profile.fullnameEN,
        fullnameAR: profile.fullnameAR,
        email: profile.email,
        mobile: profile.mobile,
        gender: profile.gender,
        dob: profile.dob,
        nationalityEN: profile.nationalityEN,
      }),
    })
      .then(res => res.ok ? res.json() : null)
      .then(customer => {
        if (customer?.id) {
          // Update auth with the real DB customer ID
          const updatedAuth = { ...auth, customerId: customer.id }
          setAuthUser(updatedAuth)
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updatedAuth))
        }
      })
      .catch(() => { /* non-critical, API still resolves IDN on the fly */ })
  }

  // Fetch cases on mount - filtered by authenticated user
  const fetchCases = useCallback(async (category?: string) => {
    setCasesLoading(true)
    try {
      // Only fetch cases belonging to the logged-in user
      const cid = authUser?.customerId
      const params = new URLSearchParams()
      if (cid) {
        params.set('customerId', cid)
      } else {
        // Not properly authenticated with a customer ID — show no cases
        setCases([])
        setCasesLoading(false)
        return
      }
      const cat = category || selectedCategory
      if (!cat) {
        // Show all statuses for the user's own cases (not just open)
      }
      const url = `/api/cases?${params.toString()}`
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        let filtered = Array.isArray(data) ? data : []
        if (cat) {
          filtered = filtered.filter((c: CaseRecord) =>
            c.category?.toLowerCase().includes(cat.toLowerCase()) ||
            c.titleEn?.toLowerCase().includes(cat.toLowerCase())
          )
        }
        setCases(filtered)
        // Update customerContext.activeCases with real count
        const activeCount = filtered.filter((c: CaseRecord) => c.status !== 'resolved').length
        if (customerContext && customerContext.activeCases !== activeCount) {
          setCustomerContext({ ...customerContext, activeCases: activeCount })
        }
      } else {
        setCases([])
      }
    } catch {
      setCases([])
    } finally {
      setCasesLoading(false)
    }
  }, [selectedCategory, authUser?.customerId, customerContext, setCustomerContext])

  // Fetch cases only when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchCases()
    }
  }, [isAuthenticated, fetchCases])

  // ─── Smart search: AI-powered ──────────────────────────────────────────
  const handleSmartSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setShowSearch(false)
      setSearchResults([])
      setAiAnswer('')
      setShowAiPanel(false)
      return
    }
    setSearching(true)
    setShowSearch(true)
    setShowAiPanel(true)

    // Fetch knowledge results
    try {
      const res = await fetch(`/api/knowledge?q=${encodeURIComponent(searchQuery)}&lang=${language}`)
      if (res.ok) {
        const data = await res.json()
        const results = Array.isArray(data) ? data : []
        setSearchResults(results)
        setAiRelatedServices(results.slice(0, 3))
      } else {
        setSearchResults([])
      }
    } catch {
      setSearchResults([])
    } finally {
      setSearching(false)
    }

    // Fetch AI answer
    setAiLoading(true)
    setAiAnswer('')
    try {
      const chatRes = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: searchQuery,
          sessionId: `smart-search-${Date.now()}`,
          language,
        }),
      })
      if (chatRes.ok) {
        const chatData = await chatRes.json()
        setAiAnswer(chatData.response || '')
      }
    } catch {
      setAiAnswer('')
    } finally {
      setAiLoading(false)
    }
  }, [searchQuery, language])

  // Handle service card click
  const handleServiceClick = useCallback((category: string) => {
    setSelectedCategory(category)
    fetchCases(category)
  }, [fetchCases])

  // Logout handler
  const handleLogout = useCallback(() => {
    localStorage.removeItem(AUTH_STORAGE_KEY)
    setIsAuthenticated(false)
    setAuthUser(null)
    setCases([])
    setCustomerContext({
      id: '',
      name: '',
      email: undefined,
      preferredLang: language,
      preferredChannel: 'web',
      sentiment: 0.5,
      activeCases: 0,
    })
    // Also clear the Zustand auth store (used by CustomerCommHub)
    try {
      useAuthStore.getState().logout()
    } catch (e) {
      console.warn('Failed to clear Zustand auth store:', e)
    }
    // Notify the chat widget to also log out
    window.dispatchEvent(new CustomEvent('moei-logout'))
  }, [language, setCustomerContext])

  // Create new case
  const handleCreateCase = useCallback(async () => {
    if (!newCaseTitle.trim()) return
    setCreatingCase(true)
    setCaseError('')
    try {
      const customerId = customerContext?.id || authUser?.customerId
      if (!customerId) {
        setCaseError('Please log in first to create a case.')
        setCreatingCase(false)
        return
      }
      const res = await fetch('/api/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titleEn: newCaseTitle,
          description: newCaseDesc,
          priority: newCasePriority,
          channel: 'web',
          category: selectedCategory || 'General',
          customerId,
          email: authUser?.email,
          name: authUser?.name,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        // Sync real customerId back if API resolved/created one
        if (data.customerId && data.customerId !== customerId) {
          if (authUser) {
            const updated = { ...authUser, customerId: data.customerId }
            setAuthUser(updated)
            try {
              const raw = localStorage.getItem(AUTH_STORAGE_KEY)
              if (raw) {
                const parsed = JSON.parse(raw)
                parsed.customerId = data.customerId
                localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(parsed))
              }
            } catch { /* ignore */ }
          }
          setCustomerContext({ ...customerContext, id: data.customerId } as typeof customerContext)
        }
        setCaseCreated(true)
        setNewCaseTitle('')
        setNewCaseDesc('')
        // Update active cases count immediately
        const newActiveCount = (customerContext?.activeCases || 0) + 1
        if (customerContext) {
          setCustomerContext({ ...customerContext, activeCases: newActiveCount })
        }
        setTimeout(() => {
          setCaseCreated(false)
          setNewCaseOpen(false)
          fetchCases()
        }, 1500)
      } else {
        const errData = await res.json().catch(() => null)
        const errMsg = errData?.error || 'Failed to create case. Please try again.'
        setCaseError(errMsg)
      }
    } catch {
      setCaseError('Network error. Please check your connection and try again.')
    } finally {
      setCreatingCase(false)
    }
  }, [newCaseTitle, newCaseDesc, newCasePriority, selectedCategory, customerContext, authUser, fetchCases, setCustomerContext])

  // Reference number lookup
  const handleRefLookup = useCallback(async () => {
    if (!refLookupValue.trim()) return
    setRefLookupLoading(true)
    setRefLookupError(false)
    try {
      const res = await fetch(`/api/cases/lookup?ref=${encodeURIComponent(refLookupValue)}`)
      if (res.ok) {
        const data = await res.json()
        // The lookup API returns referenceNumber instead of id (security: no id exposed)
        if (data && (data.referenceNumber || data.id)) {
          // Ensure the data has an id for internal use
          const caseData = { ...data, id: data.id || data.referenceNumber } as CaseRecord
          setRefLookupResult(caseData)
        } else {
          setRefLookupResult(null)
          setRefLookupError(true)
        }
      } else {
        setRefLookupResult(null)
        setRefLookupError(true)
      }
    } catch {
      setRefLookupResult(null)
      setRefLookupError(true)
    } finally {
      setRefLookupLoading(false)
    }
  }, [refLookupValue])

  // Customer context is set ONLY after user authenticates through the chat widget.
  // The chat widget stores auth in localStorage key 'moei-chat-auth', and the
  // customer page wrapper (src/app/customer/page.tsx) reads that on mount to
  // populate the store. Nothing is auto-loaded from the API here.

  // Derive the channel label from translation keys
  const getChannelLabel = (ch: string) => {
    const map: Record<string, string> = {
      whatsapp: t('whatsapp'),
      voice: t('voice'),
      web: t('webChat'),
      email: t('emailChannel'),
    }
    return map[ch] || ch
  }

  // Derive the cross-channel label
  const channelInfo = (() => {
    if (!customerContext) return null
    const ch = customerContext.preferredChannel
    return {
      label: getChannelLabel(ch),
      Icon: channelIcon[ch] || Globe,
    }
  })()

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <MoeiPageLayout
      title={{ en: t('appName') || 'MOEI Portal', ar: t('appName') || 'MOEI Portal' }}
      activeRoute="customer"
      showUaePass={true}
      uaePassUser={isAuthenticated && authUser ? { name: authUser.name } : null}
      onUaePassClick={() => { setLoginDialogOpen(true) }}
      onLogout={handleLogout}
      headerActions={
        <div className="flex items-center gap-2">
          <NotificationCenter language={language} cases={cases} />
        </div>
      }
      contentClassName="max-w-7xl"
    >
      {/* ── Hero Section (Search & Quick Action) ──────────────────────────────────────────────────── */}
      <section className="relative w-full overflow-hidden rounded-2xl mb-8 bg-gradient-to-b from-[#92722A] to-[#6B5520] shadow-xl">
        <div className="relative z-10 px-4 sm:px-6 lg:px-8 pt-6 pb-12 sm:pt-8 sm:pb-16">

          {/* Hero text + smart search */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={stagger}
            className="max-w-2xl"
          >
            <motion.h1
              variants={fadeUp}
              custom={0}
              className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight mb-4"
            >
              {t('heroTitle')}
            </motion.h1>

            <motion.p
              variants={fadeUp}
              custom={1}
              className="text-base sm:text-lg text-white/75 mb-8 leading-relaxed"
            >
              {t('heroSubtitle')}
            </motion.p>

            <motion.div variants={fadeUp} custom={2} className="relative max-w-lg">
              <GlassmorphismSearchBox
                value={searchQuery}
                onChange={(v) => {
                  setSearchQuery(v)
                  if (!v.trim()) {
                    setShowSearch(false)
                    setSearchResults([])
                    setAiAnswer('')
                    setShowAiPanel(false)
                  }
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleSmartSearch()}
                placeholder={t('smartSearchPlaceholder')}
              />
            </motion.div>

            {/* Smart Search Results - AI Enhanced */}
            <AnimatePresence>
              {showAiPanel && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mt-3 max-w-2xl bg-card rounded-xl shadow-xl border border-base-200 dark:border-border overflow-hidden z-40 relative"
                >
                  {/* AI Quick Answer */}
                  {aiLoading ? (
                    <div className="p-4 border-b border-base-100">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-4 h-4 text-[#92722A] animate-pulse" />
                        <span className="text-xs font-semibold text-[#7A6124]">{t('aiQuickAnswer')}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin text-[#92722A]" />
                        {t('aiThinking')}
                      </div>
                    </div>
                  ) : aiAnswer ? (
                    <div className="p-4 border-b border-base-100">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-4 h-4 text-[#92722A]" />
                        <span className="text-xs font-semibold text-[#7A6124]">{t('aiQuickAnswer')}</span>
                      </div>
                      <p className="text-sm text-foreground leading-relaxed">{aiAnswer}</p>
                    </div>
                  ) : null}

                  {/* Related Articles */}
                  {searchResults.length > 0 && (
                    <div className="border-b border-base-100">
                      <div className="px-4 pt-3 pb-1">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('relatedArticles')}</span>
                      </div>
                      <div className="max-h-48 overflow-y-auto custom-scrollbar">
                        {searchResults.map((result) => (
                          <button
                            key={result.id}
                            className="w-full text-left p-3 hover:bg-[#92722A]/5 border-b border-base-50 last:border-0 transition-colors"
                            onClick={() => {
                              setChatOpen(true)
                              setShowSearch(false)
                              setShowAiPanel(false)
                            }}
                          >
                            <div className="flex items-start gap-2">
                              <BookOpen className="w-3.5 h-3.5 text-[#92722A] mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="text-sm font-medium text-foreground">{result.title}</p>
                                <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{result.content?.slice(0, 120)}</p>
                                <Badge variant="outline" className="mt-1 text-[9px]">{result.category}</Badge>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Footer: Search results count & close */}
                  <div className="p-3 bg-base-50 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{searching ? t('searching') : `${searchResults.length} ${t('relatedArticles').toLowerCase()}`}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-[#92722A] hover:text-[#7A6124] h-7"
                      onClick={() => { setShowSearch(false); setShowAiPanel(false); setSearchQuery('') }}
                    >
                      <X className="w-3 h-3 mr-1" />
                      {t('close')}
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </section>

      <main className="flex-1 bg-base-50 dark:bg-background overflow-y-auto relative z-0">
        <div className="space-y-0">
        {/* Toast container */}
        <ToastContainer />

        {/* ══ 2. Quick Communication Bar (Compact Horizontal) ════════════════════════ */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-2 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
          >
            <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto pb-1 scrollbar-none">
              {/* WhatsApp */}
              <button
                onClick={() => {
                  if (isAuthenticated) {
                    useAppStore.getState().setPageView('whatsapp')
                  } else {
                    setLoginDialogOpen(true)
                  }
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366] hover:text-white transition-all text-sm font-medium whitespace-nowrap shrink-0 shadow-sm hover:shadow-md"
              >
                <MessageSquare className="w-4 h-4" />
                <span>WhatsApp</span>
              </button>

              {/* Email */}
              <button
                onClick={() => {
                  if (isAuthenticated) {
                    useAppStore.getState().setPageView('email')
                  } else {
                    setLoginDialogOpen(true)
                  }
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-700 hover:text-white transition-all text-sm font-medium whitespace-nowrap shrink-0 shadow-sm hover:shadow-md"
              >
                <Inbox className="w-4 h-4" />
                <span>Email</span>
              </button>

              {/* Call */}
              <button
                onClick={() => {
                  if (isAuthenticated) {
                    useAppStore.getState().setPageView('voice-call')
                  } else {
                    setLoginDialogOpen(true)
                  }
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-600 hover:text-white transition-all text-sm font-medium whitespace-nowrap shrink-0 shadow-sm hover:shadow-md"
              >
                <Phone className="w-4 h-4" />
                <span>Call</span>
              </button>

              {/* Chat */}
              <button
                onClick={() => setChatOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#92722A]/10 text-[#92722A] hover:bg-[#92722A] hover:text-white transition-all text-sm font-medium whitespace-nowrap shrink-0 shadow-sm hover:shadow-md"
              >
                <Sparkles className="w-4 h-4" />
                <span>{t('aiAssistant') || 'AI Chat'}</span>
              </button>

              {/* Login button (only for unauthenticated - when not in header) */}
              {!isAuthenticated && (
                <button
                  onClick={() => setLoginDialogOpen(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#92722A] text-white hover:bg-[#7A6124] transition-all text-sm font-semibold whitespace-nowrap shrink-0 shadow-sm hover:shadow-md ml-auto"
                >
                  <Fingerprint className="w-4 h-4" />
                  UAE PASS Login
                </button>
              )}
            </div>
          </motion.div>
        </section>

        {/* Divider */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="border-t border-border/50" />
        </div>

        {/* ══ 3. Smart Services - Service Category Search ══════════════════════════ */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-4 relative z-10">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-40px' }}
            variants={stagger}
          >
            <motion.div variants={fadeUp} custom={0} className="mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#92722A]/10 flex items-center justify-center">
                  <Sparkles className="w-4.5 h-4.5 text-[#92722A]" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-foreground">{t('askAQuestion') || 'Ask a Question'}</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">{t('smartServicesDesc') || 'Select a service category to get started'}</p>
                </div>
              </div>
            </motion.div>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {[
                { key: 'Electricity', icon: Flame, color: 'text-uae-red-600 bg-uae-red-50 dark:bg-uae-red-900/20', label: t('electricity') || 'Electricity' },
                { key: 'Housing', icon: Home, color: 'text-[#92722A] bg-[#92722A]/10', label: t('housing') || 'Housing' },
                { key: 'Water', icon: Globe, color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20', label: t('water') || 'Water' },
                { key: 'Billing', icon: FileSearch, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20', label: t('billing') || 'Billing' },
                { key: 'Permits', icon: BookOpen, color: 'text-violet-600 bg-violet-50 dark:bg-violet-900/20', label: t('permits') || 'Permits' },
                { key: 'General', icon: Search, color: 'text-slate-600 bg-slate-100 dark:bg-slate-800', label: t('general') || 'General' },
              ].map((svc) => {
                const SvcIcon = svc.icon
                const isActive = selectedCategory === svc.key
                return (
                  <motion.button
                    key={svc.key}
                    variants={fadeUp}
                    custom={1}
                    onClick={() => {
                      setSelectedCategory(svc.key)
                      // Open chat to ask about this service category
                      setChatOpen(true)
                      window.dispatchEvent(new CustomEvent('moei-open-chat', { detail: { category: svc.key } }))
                    }}
                    className={`flex flex-col items-center justify-center gap-2.5 p-4 rounded-xl border transition-all duration-200 text-center group min-h-[80px] ${
                      isActive
                        ? 'border-[#92722A] bg-[#92722A]/5 shadow-md ring-1 ring-[#92722A]/20'
                        : 'border-transparent bg-card shadow-sm hover:shadow-md hover:border-[#92722A]/20'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${svc.color} group-hover:scale-110 transition-transform`}>
                      <SvcIcon className="w-5 h-5" />
                    </div>
                    <span className={`text-xs font-semibold leading-tight ${isActive ? 'text-[#92722A]' : 'text-foreground'}`}>{svc.label}</span>
                  </motion.button>
                )
              })}
            </div>

            {/* Active category indicator */}
            {selectedCategory && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 flex items-center gap-2"
              >
                <span className="text-xs text-muted-foreground">{t('filteringBy') || 'Filtering by'}:</span>
                <Badge variant="outline" className="border-[#92722A]/25 text-[#7A6124]">
                  {selectedCategory}
                  <button onClick={() => setSelectedCategory(null)} className="ml-1 hover:text-uae-red-600">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              </motion.div>
            )}
          </motion.div>
        </section>

        {/* ══ 4. Floating UAE PASS Login Card (for unauthenticated users) ══════════ */}
        {!isAuthenticated && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.4 }}
            className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3"
          >
            <Card className="bg-gradient-to-r from-[#92722A]/10 via-[#92722A]/5 to-transparent border border-[#92722A]/20 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-[#92722A] flex items-center justify-center shrink-0">
                    <Fingerprint className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-foreground">{t('loginWithUaePass') || 'Sign in with UAE PASS'}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t('loginCardDesc') || 'Access your cases, track requests, and manage services'}</p>
                  </div>
                </div>
                <Button
                  onClick={() => setLoginDialogOpen(true)}
                  className="bg-[#92722A] hover:bg-[#7A6124] text-white gap-1.5 shrink-0"
                  size="sm"
                >
                  <Fingerprint className="w-4 h-4" />
                  <span className="hidden sm:inline">{t('loginToAccess')}</span>
                  <span className="sm:hidden">{t('loginToAccess')}</span>
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ══ 5. Quick Action Cards ═══════════════════════════════════════════════ */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-2 relative z-10">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={stagger}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Check Request Status */}
              <motion.div variants={fadeUp} custom={0}>
                <Card className="border-0 shadow-md hover:shadow-lg hover:scale-[1.02] transition-all duration-300 bg-card card-hover-glow ripple-effect">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-xl bg-[#92722A]/5 flex items-center justify-center">
                        <FileSearch className="w-5 h-5 text-[#92722A]" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-base-900">{t('checkRequestStatus')}</h3>
                        <p className="text-[11px] text-muted-foreground">{t('checkRequestStatusDesc')}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={refLookupValue}
                        onChange={(e) => { setRefLookupValue(e.target.value); setRefLookupResult(null); setRefLookupError(false) }}
                        placeholder="MOEI-XXXX-XXXX"
                        className="h-8 text-xs flex-1"
                      />
                      <Button
                        size="sm"
                        className="h-8 text-xs bg-[#92722A] hover:bg-[#7A6124] text-white"
                        onClick={handleRefLookup}
                        disabled={refLookupLoading}
                      >
                        {refLookupLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : t('lookup')}
                      </Button>
                    </div>
                    {refLookupResult && (
                      <div className="mt-3 p-3 bg-uae-green-50/50 border border-uae-green-200 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-sm text-uae-green-800 font-mono">{refLookupResult.referenceNumber}</span>
                          <Badge className={statusConfig[refLookupResult.status]?.className || statusConfig.open.className}>
                            {t((statusConfig[refLookupResult.status] || statusConfig.open).labelKey)}
                          </Badge>
                        </div>
                        <p className="text-xs text-foreground font-medium mb-1">{refLookupResult.titleEn}</p>
                        {refLookupResult.category && (
                          <Badge variant="outline" className="text-[10px] mb-2">{refLookupResult.category}</Badge>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span>{t('priority')}: <Badge className={priorityConfig[refLookupResult.priority]?.className || priorityConfig.medium.className}>{t((priorityConfig[refLookupResult.priority] || priorityConfig.medium).labelKey)}</Badge></span>
                          <span>{t('channel')}: {getChannelLabel(refLookupResult.channel)}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {t('created')}: {new Date(refLookupResult.createdAt).toLocaleDateString(language === 'ar' ? 'ar-AE' : 'en-AE')}
                        </div>
                        {/* Simple timeline */}
                        <div className="mt-2 pt-2 border-t border-uae-green-200">
                          <CaseTimeline caseRecord={refLookupResult} language={language} />
                        </div>
                      </div>
                    )}
                    {refLookupError && (
                      <p className="mt-2 text-xs text-uae-red-600">{t('notFound')}</p>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* Report Power Outage */}
              <motion.div variants={fadeUp} custom={1}>
                <Card className="border-0 shadow-md hover:shadow-lg hover:scale-[1.02] transition-all duration-300 bg-card border-l-4 border-l-uae-red-500 card-hover-glow ripple-effect">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-xl bg-uae-red-50 flex items-center justify-center">
                        <Flame className="w-5 h-5 text-uae-red-600" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-base-900">{t('reportPowerOutage')}</h3>
                        <p className="text-[11px] text-muted-foreground">{t('reportPowerOutageDesc')}</p>
                      </div>
                    </div>
                    <a
                      href="tel:997"
                      className="w-full h-8 text-xs bg-uae-red-600 hover:bg-uae-red-700 text-white gap-1.5 inline-flex items-center justify-center rounded-md font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      {t('emergencyNumber')}
                    </a>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Zayed Housing Program - Login Required */}
              <motion.div variants={fadeUp} custom={2}>
                <Card className="border-0 shadow-md hover:shadow-lg hover:scale-[1.02] transition-all duration-300 bg-card border-l-4 border-l-[#92722A] card-hover-glow ripple-effect">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-xl bg-[#92722A]/10 flex items-center justify-center">
                        <Home className="w-5 h-5 text-[#92722A]" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-base-900">{t('zayedHousingProgram')}</h3>
                        <p className="text-[11px] text-muted-foreground">{t('zayedHousingProgramDesc')}</p>
                      </div>
                    </div>
                    {isAuthenticated ? (
                      <Button
                        variant="outline"
                        className="w-full h-8 text-xs border-[#92722A]/30 text-[#92722A] hover:bg-[#92722A] hover:text-white gap-1.5 transition-all"
                        onClick={() => { setSelectedCategory('Housing'); fetchCases('Housing') }}
                      >
                        <Search className="w-3.5 h-3.5" />
                        {t('viewHousingServices')}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        className="w-full h-8 text-xs border-[#92722A]/30 text-[#92722A] hover:bg-[#92722A] hover:text-white gap-1.5 transition-all"
                        onClick={() => { setChatOpen(true); window.dispatchEvent(new CustomEvent('moei-open-chat')) }}
                      >
                        <Lock className="w-3.5 h-3.5" />
                        {t('loginToAccess')}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* Service Catalog */}
              <motion.div variants={fadeUp} custom={3}>
                <Card className="border-0 shadow-md hover:shadow-lg hover:scale-[1.02] transition-all duration-300 bg-card card-hover-glow ripple-effect">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-xl bg-[#92722A]/10 flex items-center justify-center">
                        <Globe className="w-5 h-5 text-[#92722A]" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-base-900">{t('serviceCatalog')}</h3>
                        <p className="text-[11px] text-muted-foreground">{t('serviceCatalogDesc')}</p>
                      </div>
                    </div>
                    <a
                      href="https://www.moei.gov.ae/en/services/Pages/default.aspx"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full h-8 text-xs border-[#92722A]/30 text-[#92722A] hover:bg-[#92722A] hover:text-white gap-1.5 inline-flex items-center justify-center rounded-md font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border bg-background"
                    >
                      <Globe className="w-3.5 h-3.5" />
                      {t('browseServices')}
                      <ExternalLink className="w-3 h-3 ml-1" />
                    </a>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </motion.div>
        </section>

        {/* ══ 6. My Cases Section (MOVED UP - most useful feature) ══════════════════ */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={stagger}
          >
            <motion.div variants={fadeUp} custom={0} className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-base-900 flex items-center gap-2">
                  {t('trackYourCases')}
                  {!isAuthenticated && <Lock className="w-5 h-5 text-[#92722A]" />}
                  {isAuthenticated && selectedCategory && (
                    <Badge variant="outline" className="ml-2 text-xs border-[#92722A]/25 text-[#7A6124]">
                      {selectedCategory}
                      <button onClick={() => { setSelectedCategory(null); fetchCases() }} className="ml-1 hover:text-uae-red-600">
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  )}
                </h2>
                <p className="text-muted-foreground mt-1 text-sm sm:text-base">{t('trackCasesDesc')}</p>
                <div className="w-16 h-1 text-[#92722A] rounded-full mt-3" />
              </div>
              {isAuthenticated && (
                <Button
                  onClick={() => setNewCaseOpen(true)}
                  className="bg-[#92722A] hover:bg-[#7A6124] text-white gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">{t('newCase')}</span>
                </Button>
              )}
            </motion.div>

            <motion.div variants={fadeUp} custom={1}>
              {isAuthenticated ? (
              <Card className="border-0 shadow-sm overflow-hidden">
                <CardContent className="p-0">
                  {casesLoading ? (
                    <div className="p-6 space-y-4">
                      {Array.from({ length: 4 }).map((_, idx) => (
                        <div key={idx} className="flex items-center gap-4">
                          <Skeleton className="h-4 w-24 rounded" />
                          <Skeleton className="h-4 w-40 rounded" />
                          <Skeleton className="h-5 w-16 rounded-full" />
                          <Skeleton className="h-5 w-14 rounded-full" />
                          <Skeleton className="h-4 w-20 rounded" />
                          <Skeleton className="h-4 w-24 rounded" />
                        </div>
                      ))}
                    </div>
                  ) : cases.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                      <div className="w-16 h-16 rounded-full bg-base-100 flex items-center justify-center mb-4">
                        <Inbox className="w-8 h-8 text-base-400" />
                      </div>
                      <p className="text-base-600 font-medium text-base">{t('noCases')}</p>
                      <p className="text-muted-foreground text-sm mt-1">{t('trackCasesDesc')}</p>
                      <Button
                        onClick={() => setNewCaseOpen(true)}
                        variant="outline"
                        className="mt-4 border-[#92722A]/25 text-[#7A6124] hover:bg-[#92722A]/5"
                      >
                        <Plus className="w-4 h-4 mr-1.5" />
                        {t('createCaseButton')}
                      </Button>
                    </div>
                  ) : (
                    <div className="divide-y divide-base-100">
                      {cases.map((c) => {
                        const sCfg = statusConfig[c.status] || statusConfig.open
                        const pCfg = priorityConfig[c.priority] || priorityConfig.medium
                        const ChIcon = channelIcon[c.channel] || Globe
                        const isExpanded = expandedCase === c.id

                        return (
                          <div key={c.id} className="group">
                            <div
                              className="flex items-center gap-4 px-4 sm:px-6 py-3 hover:bg-base-50 transition-colors cursor-pointer"
                              onClick={() => setExpandedCase(isExpanded ? null : c.id)}
                            >
                              <div className="flex-shrink-0">
                                <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                              </div>
                              <span className="font-mono text-xs text-[#7A6124] font-semibold whitespace-nowrap">{c.referenceNumber || (c.id.length > 8 ? `${c.id.slice(0, 8)}…` : c.id)}</span>
                              <span className="font-medium text-sm max-w-[200px] truncate flex-1">{language === 'ar' && c.titleAr ? c.titleAr : c.titleEn}</span>
                              <Badge variant="outline" className={`text-[11px] px-2 py-0.5 ${sCfg.className}`}>{t(sCfg.labelKey)}</Badge>
                              <Badge variant="outline" className={`text-[11px] px-2 py-0.5 hidden sm:inline-flex ${pCfg.className}`}>{t(pCfg.labelKey)}</Badge>
                              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hidden md:inline-flex"><ChIcon className="w-3.5 h-3.5" />{getChannelLabel(c.channel)}</span>
                              <span className="text-xs text-muted-foreground whitespace-nowrap hidden lg:inline">{new Date(c.createdAt).toLocaleDateString(language === 'ar' ? 'ar-AE' : 'en-AE', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                            </div>
                            {/* Expanded Timeline */}
                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.3 }}
                                  className="overflow-hidden"
                                >
                                  <div className="px-6 pb-4 pl-14 sm:pl-16">
                                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{t('caseTimeline')}</h4>
                                    <CaseTimeline caseRecord={c} language={language} />
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
              ) : (
                <LoginRequiredOverlay onLogin={() => setLoginDialogOpen(true)} />
              )}
            </motion.div>
          </motion.div>
        </section>

        {/* ══ 7. Customer Journey Map (Login Required) ══════════════════════════════ */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={stagger}
          >
            <motion.div variants={fadeUp} custom={0} className="mb-6">
              <h2 className="text-2xl sm:text-3xl font-bold text-base-900 flex items-center gap-2">
                {t('journeyMapTitle')}
                {!isAuthenticated && <Lock className="w-5 h-5 text-[#92722A]" />}
              </h2>
              <p className="text-muted-foreground mt-1 text-sm sm:text-base">{t('journeyMapDesc')}</p>
              <div className="w-16 h-1 text-[#92722A] rounded-full mt-3" />
            </motion.div>

            <motion.div variants={fadeUp} custom={1}>
              {isAuthenticated ? (
                <CustomerJourneyMap cases={cases} isAuthenticated={isAuthenticated} />
              ) : (
                <LoginRequiredOverlay onLogin={() => setLoginDialogOpen(true)} />
              )}
            </motion.div>
          </motion.div>
        </section>

        {/* ══ 8. Service Status (COLLAPSIBLE - collapsed by default) ═══════════════ */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={stagger}
          >
            <motion.div variants={fadeUp} custom={0}>
              <button
                onClick={() => setShowServiceStatus(!showServiceStatus)}
                className="w-full flex items-center justify-between p-4 rounded-xl bg-card border border-base-200 dark:border-border shadow-sm hover:shadow-md transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-base font-semibold text-foreground">{t('serviceStatus')}</h3>
                    <p className="text-xs text-muted-foreground">{t('serviceStatusDesc')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] border-emerald-200 text-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400">
                    {showServiceStatus ? (t('collapse') || 'Collapse') : (t('viewServiceStatus') || 'View Status')}
                  </Badge>
                  <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform duration-300 ${showServiceStatus ? 'rotate-180' : ''}`} />
                </div>
              </button>
            </motion.div>

            <AnimatePresence>
              {showServiceStatus && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-hidden"
                >
                  <div className="mt-4">
                    <ServiceStatusMonitor />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </section>

        {/* ══ 9. Cross-Channel Context Banner (only when authenticated) ═══════════ */}
        {isAuthenticated && customerContext && channelInfo && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-2 relative z-20"
          >
            <div className="bg-[#92722A]/5 border border-[#92722A]/15 rounded-xl p-3 flex items-start gap-3 shadow-sm">
              <div className="flex-shrink-0 w-9 h-9 rounded-full bg-[#92722A] flex items-center justify-center">
                <channelInfo.Icon className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#5A4518]">
                  {t('continuingFrom')} {channelInfo.label}
                </p>
                <p className="text-xs text-[#7A6124]/70 mt-0.5">
                  {customerContext.name} &middot; {t('activeCases')}: {customerContext.activeCases}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-[#7A6124] border-[#92722A]/25 hover:bg-[#92722A]/10 text-xs"
                onClick={() => setChatOpen(true)}
              >
                {t('chatWithUs')}
              </Button>
            </div>
          </motion.div>
        )}

        {/* ══ 10. Emergency Contacts (Compact - inline) ═════════════════════════════ */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={stagger}
          >
            <motion.div variants={fadeUp} custom={0}>
              <EmergencyContacts />
            </motion.div>
          </motion.div>
        </section>

        {/* ══ 11. Communication Channels (Detailed Version - secondary) ═════════════ */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={stagger}
          >
            <motion.div variants={fadeUp} custom={0} className="mb-6">
              <h2 className="text-2xl sm:text-3xl font-bold text-base-900 flex items-center gap-2">
                {t('commHub')}
                {!isAuthenticated && <Lock className="w-5 h-5 text-[#92722A]" />}
              </h2>
              <p className="text-muted-foreground mt-1 text-sm sm:text-base">{t('commHubDesc')}</p>
              <div className="w-16 h-1 text-[#92722A] rounded-full mt-3" />
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* WhatsApp Card */}
              <motion.div variants={fadeUp} custom={0}>
                <Card
                  className={`border-0 shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer group ${
                    isAuthenticated ? 'hover:scale-[1.03]' : 'opacity-70'
                  }`}
                  onClick={() => {
                    if (isAuthenticated) {
                      useAppStore.getState().setPageView('whatsapp')
                    } else {
                      setLoginDialogOpen(true)
                    }
                  }}
                >
                  <CardContent className="p-6 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-[#25D366]/10 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                      <MessageSquare className="w-8 h-8 text-[#25D366]" />
                    </div>
                    <h3 className="text-lg font-semibold mb-1">WhatsApp</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {isAuthenticated
                        ? `Chat as ${authUser?.name || userProfile?.fullnameEN || 'User'}`
                        : 'Login with UAE PASS to chat'}
                    </p>
                    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                      isAuthenticated
                        ? 'bg-[#25D366] text-white group-hover:bg-[#1ebe57]'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {isAuthenticated ? (
                        <>
                          Open WhatsApp
                          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </>
                      ) : (
                        <>
                          <Fingerprint className="w-4 h-4" />
                          Login Required
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Email Card */}
              <motion.div variants={fadeUp} custom={1}>
                <Card
                  className={`border-0 shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer group ${
                    isAuthenticated ? 'hover:scale-[1.03]' : 'opacity-70'
                  }`}
                  onClick={() => {
                    if (isAuthenticated) {
                      useAppStore.getState().setPageView('email')
                    } else {
                      setLoginDialogOpen(true)
                    }
                  }}
                >
                  <CardContent className="p-6 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                      <Inbox className="w-8 h-8 text-slate-600 dark:text-slate-300" />
                    </div>
                    <h3 className="text-lg font-semibold mb-1">Email</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {isAuthenticated
                        ? `Send as ${authUser?.email || userProfile?.email || 'User'}`
                        : 'Login with UAE PASS to email'}
                    </p>
                    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                      isAuthenticated
                        ? 'bg-slate-700 text-white group-hover:bg-slate-800'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {isAuthenticated ? (
                        <>
                          Open Email
                          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </>
                      ) : (
                        <>
                          <Fingerprint className="w-4 h-4" />
                          Login Required
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Call Card */}
              <motion.div variants={fadeUp} custom={2}>
                <Card
                  className={`border-0 shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer group ${
                    isAuthenticated ? 'hover:scale-[1.03]' : 'opacity-70'
                  }`}
                  onClick={() => {
                    if (isAuthenticated) {
                      useAppStore.getState().setPageView('voice-call')
                    } else {
                      setLoginDialogOpen(true)
                    }
                  }}
                >
                  <CardContent className="p-6 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                      <Phone className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <h3 className="text-lg font-semibold mb-1">Call Center</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {isAuthenticated
                        ? `Call as ${authUser?.name || userProfile?.fullnameEN || 'User'}`
                        : 'Login with UAE PASS to call'}
                    </p>
                    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                      isAuthenticated
                        ? 'bg-emerald-600 text-white group-hover:bg-emerald-700'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {isAuthenticated ? (
                        <>
                          Open Call Center
                          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </>
                      ) : (
                        <>
                          <Fingerprint className="w-4 h-4" />
                          Login Required
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </motion.div>
        </section>

        </div>
      </main>

      {/* ── Satisfaction Survey Floating Button ──────────────────────────────── */}
      <SatisfactionSurvey />

      {/* ── Back To Top Button ──────────────────────────────────────────── */}
      <BackToTopButton />

      {/* ── New Case Dialog ──────────────────────────────────────────────── */}
      <Dialog open={newCaseOpen} onOpenChange={setNewCaseOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {caseCreated ? (
                <><CheckCircle2 className="w-5 h-5 text-uae-green-600" />{t('caseCreatedSuccess')}</>
              ) : (
                <><Plus className="w-5 h-5 text-[#92722A]" />{t('createNewCase') || 'Create New Case'}</>
              )}
            </DialogTitle>
            <DialogDescription>
              {caseCreated ? t('caseSubmitted') : (t('createNewCaseDesc') || 'Submit a new service request case')}
            </DialogDescription>
          </DialogHeader>
          {caseCreated ? (
            <div className="py-4 text-center">
              <CheckCircle2 className="w-12 h-12 text-uae-green-600 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">{t('caseSubmitted')}</p>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div>
                <label className="text-sm font-medium mb-1.5 block">{t('title')}</label>
                <Input
                  value={newCaseTitle}
                  onChange={(e) => setNewCaseTitle(e.target.value)}
                  placeholder={t('caseTitlePlaceholder')}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">{t('caseDescription')}</label>
                <Textarea
                  value={newCaseDesc}
                  onChange={(e) => setNewCaseDesc(e.target.value)}
                  placeholder={t('caseDescriptionPlaceholder')}
                  rows={3}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">{t('casePriority')}</label>
                <div className="flex gap-2">
                  {(['low', 'medium', 'high'] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setNewCasePriority(p)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        newCasePriority === p
                          ? p === 'high' ? 'bg-uae-red-50 border-uae-red-300 text-uae-red-700'
                            : p === 'medium' ? 'bg-amber-50 border-amber-300 text-amber-700'
                              : 'bg-uae-green-50 border-uae-green-300 text-uae-green-700'
                          : 'bg-card border-base-200 text-muted-foreground hover:bg-base-50'
                      }`}
                    >
                      {t(p)}
                    </button>
                  ))}
                </div>
              </div>
              {selectedCategory && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className="border-[#92722A]/25 text-[#7A6124]">{selectedCategory}</Badge>
                  <span>{t('category')}</span>
                </div>
              )}
            </div>
          )}
          {caseError && (
            <div className="flex items-center gap-2 p-3 bg-uae-red-50 border border-uae-red-200 rounded-lg">
              <AlertCircle className="w-4 h-4 text-uae-red-600 flex-shrink-0" />
              <p className="text-xs text-uae-red-700">{caseError}</p>
            </div>
          )}
          {!caseCreated && (
            <DialogFooter>
              <Button variant="outline" onClick={() => { setNewCaseOpen(false); setCaseError('') }}>{t('cancel')}</Button>
              <Button
                onClick={handleCreateCase}
                disabled={!newCaseTitle.trim() || creatingCase}
                className="bg-[#92722A] hover:bg-[#7A6124] text-white"
              >
                {creatingCase ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                {t('submitCase')}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <UAEPassLoginDialog 
        open={loginDialogOpen} 
        onOpenChange={setLoginDialogOpen} 
        onLogin={handleMockUaePassLogin} 
      />
    </MoeiPageLayout>
  )
}

export { CustomerPortal }
