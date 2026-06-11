'use client'

import { useState, useEffect } from 'react'
import { ArrowRightLeft, Search, Loader2, Check, AlertCircle, Flag } from 'lucide-react'
import { useAppStore } from '@/store/app-store'
import { useIsMobile } from '@/hooks/use-mobile'
import { logEmployerAction } from '@/lib/employer-action-logger'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import { motion } from 'framer-motion'
import { toast } from 'sonner'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface AgentInfo {
  id: string
  name: string
  email: string
  status: 'online' | 'busy' | 'offline' | 'on_break'
  activeCases: number
  skills: string[]
  languages: string[]
  avatar?: string
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email)
}

function safeParseJSON(value: unknown, fallback: string[] = []): string[] {
  if (Array.isArray(value)) return value
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value || '[]')
      return Array.isArray(parsed) ? parsed : fallback
    } catch {
      return fallback
    }
  }
  return fallback
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'online': return 'bg-green-500'
    case 'busy': return 'bg-amber-500'
    case 'on_break': return 'bg-orange-500'
    default: return 'bg-gray-400'
  }
}

function getStatusLabel(status: string, isAr: boolean): string {
  const labels: Record<string, { en: string; ar: string }> = {
    online: { en: 'Online', ar: 'متصل' },
    busy: { en: 'Busy', ar: 'مشغول' },
    offline: { en: 'Offline', ar: 'غير متصل' },
    on_break: { en: 'On Break', ar: 'في استراحة' },
  }
  const info = labels[status] || labels.offline
  return isAr ? info.ar : info.en
}

function getLanguageFlag(lang: string): string {
  switch (lang) {
    case 'ar': return '🇦🇪'
    case 'en': return '🇬🇧'
    case 'fr': return '🇫🇷'
    case 'ur': return '🇵🇰'
    case 'hi': return '🇮🇳'
    default: return '🌐'
  }
}

// ─── Component ─────────────────────────────────────────────────────────────────

interface TransferDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sessionId: string
  customerName: string
}

export function TransferDialog({ open, onOpenChange, sessionId, customerName }: TransferDialogProps) {
  const { language, currentAgent, setConversationSessions } = useAppStore()
  const isAr = language === 'ar'
  const isMobile = useIsMobile()

  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [priority, setPriority] = useState<'normal' | 'high' | 'urgent'>('normal')
  const [transferring, setTransferring] = useState(false)
  const [transferError, setTransferError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  // Reset all state when dialog closes
  const resetForm = () => {
    setSelectedAgent(null)
    setReason('')
    setPriority('normal')
    setSearch('')
    setFetchError(null)
    setTransferError(null)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      requestAnimationFrame(() => {
        resetForm()
      })
    }
    onOpenChange(nextOpen)
  }

  // Fetch available agents (excluding current agent)
  useEffect(() => {
    if (!open) return
    let cancelled = false
    const fetchAgents = async () => {
      setLoading(true)
      setFetchError(null)
      try {
        const res = await fetch('/api/employer/agents?XTransformPort=3002')
        if (!res.ok) {
          throw new Error(isAr ? 'فشل تحميل بيانات الموظفين' : 'Failed to load agents')
        }
        if (!cancelled) {
          const data = await res.json()
          const rawAgents = data.agents || data || []
          const agentList: AgentInfo[] = rawAgents
            .map((a: Record<string, unknown>) => ({
              id: a.id as string,
              name: (a.name as string) || 'Agent',
              email: (a.email as string) || '',
              status: (a.status as AgentInfo['status']) || 'offline',
              activeCases: (a.activeCases as number) || 0,
              skills: safeParseJSON(a.skills),
              languages: safeParseJSON(a.languages, ['en']),
              avatar: a.avatar as string | undefined,
            }))
            // Filter out the current agent — you shouldn't transfer to yourself
            .filter((a: AgentInfo) => a.id !== currentAgent?.id)
          setAgents(agentList)
        }
      } catch (err) {
        if (!cancelled) {
          setAgents([])
          setFetchError(
            err instanceof Error
              ? err.message
              : (isAr ? 'فشل تحميل بيانات الموظفين' : 'Failed to load agents')
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchAgents()
    return () => { cancelled = true }
  }, [open, currentAgent?.id, isAr])

  // Filter agents by search
  const filteredAgents = search.trim()
    ? agents.filter((a) =>
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        a.skills.some((s) => s.toLowerCase().includes(search.toLowerCase())) ||
        a.languages.some((l) => l.toLowerCase().includes(search.toLowerCase())) ||
        (a.email && a.email.toLowerCase().includes(search.toLowerCase()))
      )
    : agents

  // Validate selected agent email (if available)
  const selectedAgentInfo = agents.find((a) => a.id === selectedAgent)
  const hasEmailIssue = selectedAgentInfo && selectedAgentInfo.email && !isValidEmail(selectedAgentInfo.email)

  // Transfer
  const handleTransfer = async () => {
    if (!selectedAgent) return
    setTransferError(null)
    setTransferring(true)
    try {
      const res = await fetch(`/api/conversations/${sessionId}/transfer?XTransformPort=3002`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetAgentId: selectedAgent,
          reason: reason.trim() || undefined,
          priority,
        }),
      })
      if (res.ok) {
        toast.success(isAr ? 'تم نقل المحادثة بنجاح' : 'Conversation transferred successfully')
        onOpenChange(false)
        resetForm()

        // Update local conversation store to reflect transferred status
        const { conversationSessions, setConversationSessions: updateSessions } = useAppStore.getState()
        updateSessions(
          conversationSessions.map((s) =>
            s.id === sessionId ? { ...s, status: 'transferred' as const } : s
          )
        )

        // Log transfer action
        logEmployerAction({
          action: 'transfer',
          details: { sessionId, targetAgentId: selectedAgent, reason, priority },
          targetId: sessionId,
        })
      } else {
        const data = await res.json().catch(() => ({}))
        const errorMsg = data.error || (isAr ? 'فشل نقل المحادثة' : 'Failed to transfer conversation')
        setTransferError(errorMsg)
        toast.error(errorMsg)
      }
    } catch {
      const errorMsg = isAr ? 'خطأ في الاتصال بالخادم. يرجى المحاولة مرة أخرى.' : 'Network error. Please try again.'
      setTransferError(errorMsg)
      toast.error(errorMsg)
    }
    setTransferring(false)
  }

  // ─── Agent Card Component (responsive) ─────────────────────────────────────
  const renderAgentCard = (agent: AgentInfo) => {
    const isSelected = selectedAgent === agent.id
    const initials = agent.name.split(' ').map((n) => n[0]).join('').slice(0, 2)

    return (
      <motion.button
        key={agent.id}
        onClick={() => {
          setSelectedAgent(agent.id)
          setTransferError(null)
        }}
        className={`w-full text-start px-3 sm:px-4 py-3 flex items-center gap-3 transition-colors ${
          isSelected
            ? 'bg-ae-gold-50 border-l-[3px] border-l-ae-gold-500'
            : 'hover:bg-ae-black-50/50'
        }`}
        whileHover={!isMobile ? { x: 2 } : undefined}
        transition={{ duration: 0.1 }}
      >
        {/* Avatar */}
        <div className="relative shrink-0">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-ae-gold-100 text-ae-gold-700 text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white ${getStatusColor(agent.status)}`} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-ae-black-800 truncate">
              {agent.name}
            </span>
            <Badge variant="outline" className="text-[8px] px-1.5 py-0 h-4">
              {getStatusLabel(agent.status, isAr)}
            </Badge>
          </div>
          {/* On mobile: show only name and status; on desktop: show extra info */}
          {!isMobile && (
            <>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-ae-black-400">
                  {agent.activeCases} {isAr ? 'قضايا' : 'cases'}
                </span>
                {agent.languages.map((lang) => (
                  <span key={lang} className="text-[10px]">{getLanguageFlag(lang)}</span>
                ))}
              </div>
              {agent.skills.length > 0 && (
                <div className="flex items-center gap-1 mt-1 flex-wrap">
                  {agent.skills.slice(0, 3).map((skill) => (
                    <Badge key={skill} variant="secondary" className="text-[8px] px-1.5 py-0 h-3.5">
                      {skill}
                    </Badge>
                  ))}
                  {agent.skills.length > 3 && (
                    <span className="text-[8px] text-ae-black-300">+{agent.skills.length - 3}</span>
                  )}
                </div>
              )}
            </>
          )}
          {/* Mobile: compact info */}
          {isMobile && (
            <div className="flex items-center gap-1.5 mt-0.5">
              {agent.languages.map((lang) => (
                <span key={lang} className="text-[10px]">{getLanguageFlag(lang)}</span>
              ))}
              <span className="text-[10px] text-ae-black-400">
                {agent.activeCases} {isAr ? 'قضايا' : 'cases'}
              </span>
            </div>
          )}
        </div>

        {/* Selection indicator */}
        {isSelected && (
          <Check className="w-4 h-4 text-ae-gold-500 shrink-0" />
        )}
      </motion.button>
    )
  }

  // ─── Shared Content ────────────────────────────────────────────────────────
  const dialogTitleContent = (
    <>
      <ArrowRightLeft className="w-5 h-5 text-ae-gold-500" />
      {isAr ? 'نقل المحادثة' : 'Transfer Conversation'}
    </>
  )

  const dialogDesc = isAr
    ? `نقل محادثة ${customerName} إلى موظف آخر`
    : `Transfer ${customerName}'s conversation to another agent`

  const bodyContent = (
    <div className="space-y-4 p-4 sm:p-6">
      {/* Fetch error */}
      {fetchError && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{fetchError}</span>
        </div>
      )}

      {/* Transfer error */}
      {transferError && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{transferError}</span>
        </div>
      )}

      {/* Email warning for selected agent */}
      {hasEmailIssue && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{isAr ? 'بريد الموظف غير صالح' : 'Agent email address appears invalid'}</span>
        </div>
      )}

      {/* Search */}
      <div className="relative w-full">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ae-black-300" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={isAr ? 'بحث عن موظف...' : 'Search agents...'}
          className="ps-8 h-10 text-sm w-full"
        />
      </div>

      {/* Agent List */}
      <ScrollArea className="h-56 border border-ae-black-100 rounded-lg">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-ae-gold-500" />
          </div>
        ) : filteredAgents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-ae-black-300">
            <AlertCircle className="h-6 w-6 mb-2 opacity-40" />
            <p className="text-xs">
              {fetchError
                ? (isAr ? 'فشل تحميل الموظفين' : 'Failed to load agents')
                : (isAr ? 'لا يوجد موظفون متاحون' : 'No agents available')
              }
            </p>
          </div>
        ) : (
          <div className="divide-y divide-ae-black-50">
            {filteredAgents.map((agent) => renderAgentCard(agent))}
          </div>
        )}
      </ScrollArea>

      {/* Priority */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-ae-black-600">
          <Flag className="w-3 h-3 inline me-1" />
          {isAr ? 'الأولوية' : 'Priority'}
        </Label>
        <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
          <SelectTrigger className="h-10 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="normal">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                {isAr ? 'عادي' : 'Normal'}
              </div>
            </SelectItem>
            <SelectItem value="high">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                {isAr ? 'مرتفع' : 'High'}
              </div>
            </SelectItem>
            <SelectItem value="urgent">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-red-500" />
                {isAr ? 'عاجل' : 'Urgent'}
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Reason */}
      <div>
        <label className="text-xs font-medium text-ae-black-600 mb-1 block">
          {isAr ? 'سبب النقل (اختياري)' : 'Transfer reason (optional)'}
        </label>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={isAr ? 'أدخل سبب النقل...' : 'Enter reason for transfer...'}
          className="text-sm min-h-[60px] max-h-[80px] resize-none"
          rows={2}
        />
      </div>
    </div>
  )

  const footerContent = (
    <div className="flex flex-col-reverse sm:flex-row gap-2 w-full">
      <Button
        variant="outline"
        onClick={() => onOpenChange(false)}
        className="text-sm min-h-[44px] w-full sm:w-auto"
      >
        {isAr ? 'إلغاء' : 'Cancel'}
      </Button>
      <Button
        onClick={handleTransfer}
        disabled={!selectedAgent || transferring}
        className="text-sm bg-ae-gold-500 hover:bg-ae-gold-600 text-white gap-1.5 min-h-[44px] w-full sm:w-auto"
      >
        {transferring ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ArrowRightLeft className="h-4 w-4" />
        )}
        {isAr ? 'نقل' : 'Transfer'}
      </Button>
    </div>
  )

  // ─── Mobile: Sheet (slide up from bottom) ──────────────────────────────────
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent side="bottom" className="w-full max-h-[92vh] flex flex-col p-0 gap-0 rounded-t-2xl overflow-hidden">
          <SheetHeader className="px-4 pt-4 pb-3 shrink-0 border-b">
            <SheetTitle className="flex items-center gap-2 text-base">
              {dialogTitleContent}
            </SheetTitle>
            <SheetDescription className="text-xs">
              {dialogDesc}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 min-h-0 overflow-y-auto">
            {bodyContent}
          </div>

          <SheetFooter className="px-4 py-4 border-t shrink-0">
            {footerContent}
          </SheetFooter>
        </SheetContent>
      </Sheet>
    )
  }

  // ─── Desktop: Dialog ───────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-full max-w-lg max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3 shrink-0 border-b">
          <DialogTitle className="flex items-center gap-2">
            {dialogTitleContent}
          </DialogTitle>
          <DialogDescription>
            {dialogDesc}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {bodyContent}
        </div>

        <DialogFooter className="px-4 sm:px-6 py-4 border-t shrink-0">
          {footerContent}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
