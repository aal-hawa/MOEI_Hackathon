'use client'

import { useState, useEffect } from 'react'
import { LogIn, Loader2, Shield, User, Clock, Activity } from 'lucide-react'
import { useAppStore, type CurrentAgent } from '@/store/app-store'
import { useAuthStore } from '@/components/shared/lib/auth-store'
import { logEmployerAction } from '@/lib/employer-action-logger'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface SessionInfo {
  id: string
  loginAt: string
  logoutAt: string | null
  isActive: boolean
  actions: { id: string; action: string; createdAt: string; details: string }[]
}

// ─── Component ─────────────────────────────────────────────────────────────────

interface EmployerLoginDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const STORAGE_KEY = 'moei_current_agent'

export function EmployerLoginDialog({ open, onOpenChange }: EmployerLoginDialogProps) {
  const { language, setCurrentAgent, currentAgent } = useAppStore()
  const isAr = language === 'ar'
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null)
  const [recentActions, setRecentActions] = useState<{ id: string; action: string; createdAt: string; details: string; channel?: string | null }[]>([])

  // Restore login from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const agent: CurrentAgent = JSON.parse(stored)
        setCurrentAgent(agent)
      }
    } catch {
      // Ignore
    }
  }, [setCurrentAgent])

  // Fetch session info when profile is shown
  useEffect(() => {
    if (!open || !currentAgent) return
    const fetchSessionInfo = async () => {
      try {
        // Get session history
        const res = await fetch(`/api/employer-sessions/history?XTransformPort=3002&agentId=${currentAgent.id}&limit=1`)
        if (res.ok) {
          const data = await res.json()
          if (data.sessions?.length > 0) {
            setSessionInfo(data.sessions[0])
          }
        }
        // Get recent actions
        const actionsRes = await fetch(`/api/employer-sessions/actions?XTransformPort=3002&agentId=${currentAgent.id}&limit=10`)
        if (actionsRes.ok) {
          const actionsData = await actionsRes.json()
          setRecentActions(actionsData.actions || [])
        }
      } catch { /* silent */ }
    }
    fetchSessionInfo()
  }, [open, currentAgent])

  const handleLogin = async () => {
    if (!email.trim()) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/employer/login?XTransformPort=3002', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })

      if (res.ok) {
        const data = await res.json()
        const agent: CurrentAgent = {
          id: data.id || data.agentId || `agent-${Date.now()}`,
          name: data.name || data.agentName || email.split('@')[0],
          email: email.trim(),
          role: data.role || 'agent',
          avatar: data.avatar || undefined,
        }
        setCurrentAgent(agent)
        // Persist to localStorage
        localStorage.setItem(STORAGE_KEY, JSON.stringify(agent))
        toast.success(isAr ? `مرحباً ${agent.name}` : `Welcome, ${agent.name}`)
        onOpenChange(false)
        setEmail('')

        // Create session record
        try {
          const sessionRes = await fetch('/api/employer-sessions/login?XTransformPort=3002', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              agentId: agent.id,
              agentEmail: agent.email,
              userAgent: navigator.userAgent,
            }),
          })
          if (sessionRes.ok) {
            const sessionData = await sessionRes.json()
            if (sessionData.session?.id) {
              localStorage.setItem('moei_session_id', sessionData.session.id)
            }
          }
        } catch { /* silent */ }
      } else {
        setError(isAr ? 'فشل تسجيل الدخول. تحقق من البريد الإلكتروني.' : 'Login failed. Please check your email.')
      }
    } catch {
      setError(isAr ? 'خطأ في الاتصال. حاول مرة أخرى.' : 'Connection error. Please try again.')
    }
    setLoading(false)
  }

  const handleLogout = () => {
    // Log session logout
    const agent = useAppStore.getState().currentAgent
    if (agent) {
      const sessionId = localStorage.getItem('moei_session_id')
      try {
        fetch('/api/employer-sessions/logout?XTransformPort=3002', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agentId: agent.id, sessionId: sessionId || undefined }),
        })
      } catch { /* silent */ }
      // Also log via the centralized action logger
      logEmployerAction({ action: 'logout' })
    }
    setCurrentAgent(null)
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem('moei_session_id')
    // Also clear the Zustand auth store to fully log out
    useAuthStore.getState().logout()
    setSessionInfo(null)
    setRecentActions([])
    toast.info(isAr ? 'تم تسجيل الخروج' : 'Logged out')
  }

  // Format session duration
  const getSessionDuration = (loginAt: string, logoutAt: string | null): string => {
    const start = new Date(loginAt)
    const end = logoutAt ? new Date(logoutAt) : new Date()
    const diffMs = end.getTime() - start.getTime()
    const hours = Math.floor(diffMs / (1000 * 60 * 60))
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  // Action label helper
  const getActionLabel = (action: string): { en: string; ar: string; icon: string } => {
    const actionLabels: Record<string, { en: string; ar: string; icon: string }> = {
      login: { en: 'Logged in', ar: 'تسجيل الدخول', icon: '🔑' },
      logout: { en: 'Logged out', ar: 'تسجيل الخروج', icon: '🚪' },
      view_conversation: { en: 'Viewed conversation', ar: 'عرض محادثة', icon: '👁️' },
      send_message: { en: 'Sent message', ar: 'أرسل رسالة', icon: '💬' },
      transfer: { en: 'Transferred conversation', ar: 'نقل محادثة', icon: '↗️' },
      change_ai_mode: { en: 'Changed AI mode', ar: 'تغيير وضع الذكاء', icon: '🤖' },
      update_settings: { en: 'Updated settings', ar: 'تحديث الإعدادات', icon: '⚙️' },
      create_rule: { en: 'Created service rule', ar: 'إنشاء قاعدة خدمة', icon: '📝' },
      edit_rule: { en: 'Edited service rule', ar: 'تعديل قاعدة خدمة', icon: '✏️' },
      delete_rule: { en: 'Deleted service rule', ar: 'حذف قاعدة خدمة', icon: '🗑️' },
      send_uaepass_email: { en: 'Sent UAE PASS email', ar: 'إرسال بريد الهوية الرقمية', icon: '📧' },
      uaepass_login: { en: 'UAE PASS login', ar: 'تسجيل دخول الهوية الرقمية', icon: '🛡️' },
    }
    return actionLabels[action] || { en: action, ar: action, icon: '📋' }
  }

  // If already logged in, show profile instead
  if (currentAgent) {
    const initials = currentAgent.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md w-[calc(100%-1rem)] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-5 pt-5 pb-3 shrink-0 border-b">
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-ae-gold-500" />
              {isAr ? 'ملف الموظف' : 'Agent Profile'}
            </DialogTitle>
            <DialogDescription>
              {isAr ? 'أنت مسجل الدخول حالياً' : 'You are currently logged in'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
            <div className="flex flex-col items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="bg-ae-gold-500 text-white text-lg font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>

              <div className="text-center">
                <h3 className="font-semibold text-ae-black-800">{currentAgent.name}</h3>
                <p className="text-sm text-ae-black-400">{currentAgent.email}</p>
                <Badge className="mt-2 bg-ae-gold-100 text-ae-gold-700 border-ae-gold-200">
                  <User className="w-3 h-3 me-1" />
                  {currentAgent.role}
                </Badge>
              </div>

              {/* Session Info */}
              {sessionInfo && (
                <div className="w-full p-3 bg-ae-gold-50/50 border border-ae-gold-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-3.5 h-3.5 text-ae-gold-600" />
                    <span className="text-xs font-semibold text-ae-gold-700">
                      {isAr ? 'معلومات الجلسة' : 'Session Info'}
                    </span>
                    {sessionInfo.isActive && (
                      <Badge className="text-[8px] h-4 px-1.5 bg-green-100 text-green-700 border-green-200">
                        {isAr ? 'نشطة' : 'Active'}
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div>
                      <span className="text-ae-black-400">{isAr ? 'تسجيل الدخول:' : 'Login:'}</span>
                      <p className="text-ae-black-700">
                        {new Date(sessionInfo.loginAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div>
                      <span className="text-ae-black-400">{isAr ? 'المدة:' : 'Duration:'}</span>
                      <p className="text-ae-black-700">
                        {getSessionDuration(sessionInfo.loginAt, sessionInfo.logoutAt)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Recent Activity */}
              {recentActions.length > 0 && (
                <div className="w-full">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="w-3.5 h-3.5 text-ae-gold-600" />
                    <span className="text-xs font-semibold text-ae-gold-700">
                      {isAr ? 'النشاط الأخير' : 'Recent Activity'}
                    </span>
                  </div>
                  <ScrollArea className="max-h-40">
                    <div className="space-y-1.5">
                      {recentActions.slice(0, 5).map((act) => {
                        const label = getActionLabel(act.action)
                        return (
                          <div key={act.id} className="flex items-center gap-2 text-[10px] py-1">
                            <span>{label.icon}</span>
                            <span className="text-ae-black-700">{isAr ? label.ar : label.en}</span>
                            <span className="text-ae-black-300 ms-auto">
                              {new Date(act.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>

            <Button
              variant="outline"
              onClick={handleLogout}
              className="w-full mt-4 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 min-h-[44px]"
            >
              {isAr ? 'تسجيل الخروج' : 'Sign Out'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm w-[calc(100%-1rem)] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 shrink-0 border-b">
          <DialogTitle className="flex items-center gap-2">
            <LogIn className="w-5 h-5 text-ae-gold-500" />
            {isAr ? 'تسجيل دخول الموظف' : 'Employer Login'}
          </DialogTitle>
          <DialogDescription>
            {isAr
              ? 'أدخل بريدك الإلكتروني للوصول إلى لوحة التحكم'
              : 'Enter your email to access the agent dashboard'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="employer-email" className="text-sm">
              {isAr ? 'البريد الإلكتروني' : 'Email Address'}
            </Label>
            <Input
              id="employer-email"
              type="email"
              placeholder={isAr ? 'agent@moei.gov.ae' : 'agent@moei.gov.ae'}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleLogin()
              }}
              className="text-sm min-h-[44px]"
              autoComplete="email"
            />
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <Button
            onClick={handleLogin}
            disabled={!email.trim() || loading}
            className="w-full bg-ae-gold-500 hover:bg-ae-gold-600 text-white gap-2 min-h-[44px]"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogIn className="h-4 w-4" />
            )}
            {isAr ? 'تسجيل الدخول' : 'Sign In'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
