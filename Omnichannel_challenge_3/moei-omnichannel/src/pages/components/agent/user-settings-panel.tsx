'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User,
  Bell,
  LayoutDashboard,
  Eye,
  Upload,
  Mail,
  MessageCircle,
  AlertTriangle,
  Clock,
  Sparkles,
  FileText,
  Siren,
  Monitor,
  Volume2,
  Settings,
  Save,
  RotateCcw,
  Activity,
  Shield,
  LogIn,
  LogOut,
  ArrowRightLeft,
  Bot,
  Send,
  Briefcase,
  MessageSquare,
  Globe,
  Check,
  Edit3,
  Loader2,
  Zap,
  ThermometerSun,
  Target,
  Brain,
  BookOpen,
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useTranslation } from '@/i18n'
import { useAppStore } from '@/store/app-store'
import { useToast } from '@/hooks/use-toast'
import { invalidateChatConfigCache } from '@/components/chat/ai-chat-widget'
import { useSettings } from '@/hooks/use-settings'
import { logEmployerAction } from '@/lib/employer-action-logger'

// ─── Action metadata ────────────────────────────────────────────────────────

// ─── Chat Config Labels ────────────────────────────────────────────────────
const CONFIG_LABELS: Record<string, { en: string; icon: React.ElementType; color: string }> = {
  welcome_message: { en: 'Welcome Message', icon: Sparkles, color: 'text-brand-600 bg-brand-50 dark:bg-brand-950/30' },
  fallback_default: { en: 'Default Response', icon: MessageSquare, color: 'text-slate-600 bg-slate-50 dark:bg-slate-950/30' },
  fallback_electricity: { en: 'Electricity', icon: Zap, color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30' },
  fallback_water: { en: 'Water', icon: ThermometerSun, color: 'text-teal-600 bg-teal-50 dark:bg-teal-950/30' },
  fallback_housing: { en: 'Housing', icon: BookOpen, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30' },
  fallback_complaint: { en: 'Complaint', icon: Target, color: 'text-red-600 bg-red-50 dark:bg-red-950/30' },
  fallback_case: { en: 'Case Status', icon: FileText, color: 'text-violet-600 bg-violet-50 dark:bg-violet-950/30' },
  fallback_help: { en: 'Help', icon: Brain, color: 'text-brand-600 bg-brand-50 dark:bg-brand-950/30' },
}

interface ChatConfigItem {
  id: string
  key: string
  valueEn: string
  valueAr: string | null
  description: string | null
  isActive: boolean
  updatedAt: string
}

const ACTION_META: Record<string, {
  en: string; ar: string; icon: React.ElementType; color: string
}> = {
  login: { en: 'Logged in', ar: 'تسجيل الدخول', icon: LogIn, color: 'text-green-600' },
  logout: { en: 'Logged out', ar: 'تسجيل الخروج', icon: LogOut, color: 'text-gray-500' },
  view_conversation: { en: 'Viewed conversation', ar: 'عرض محادثة', icon: Eye, color: 'text-blue-600' },
  send_message: { en: 'Sent message', ar: 'أرسل رسالة', icon: Send, color: 'text-teal-600' },
  transfer: { en: 'Transferred conversation', ar: 'نقل محادثة', icon: ArrowRightLeft, color: 'text-orange-600' },
  change_ai_mode: { en: 'Changed AI mode', ar: 'تغيير وضع الذكاء', icon: Bot, color: 'text-purple-600' },
  update_settings: { en: 'Updated settings', ar: 'تحديث الإعدادات', icon: Settings, color: 'text-gray-600' },
  create_rule: { en: 'Created service rule', ar: 'إنشاء قاعدة خدمة', icon: FileText, color: 'text-emerald-600' },
  edit_rule: { en: 'Edited service rule', ar: 'تعديل قاعدة خدمة', icon: FileText, color: 'text-amber-600' },
  delete_rule: { en: 'Deleted service rule', ar: 'حذف قاعدة خدمة', icon: FileText, color: 'text-red-600' },
  send_uaepass_email: { en: 'Sent UAE PASS email', ar: 'إرسال بريد الهوية', icon: Shield, color: 'text-green-600' },
  uaepass_login: { en: 'UAE PASS login', ar: 'تسجيل دخول الهوية', icon: Shield, color: 'text-green-700' },
}

// ─── Toggle Row Component ────────────────────────────────────────────────────
function ToggleRow({
  icon: Icon,
  label,
  description,
  checked,
  onCheckedChange,
}: {
  icon: React.ElementType
  label: string
  description: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5">
      <div className="flex items-start gap-2.5 min-w-0">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-muted flex-shrink-0 mt-0.5">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground leading-tight">{label}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{description}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} className="flex-shrink-0 mt-1" />
    </div>
  )
}

// ─── Chat Widget Section (Moved from AI Config panel) ────────────────────────
function ChatWidgetSection({ isAr }: { isAr: boolean }) {
  const [configs, setConfigs] = useState<ChatConfigItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editValueEn, setEditValueEn] = useState('')
  const [editValueAr, setEditValueAr] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)
  const [langTab, setLangTab] = useState<'en' | 'ar'>('en')

  const fetchConfigs = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/chat-config')
      if (res.ok) {
        const data = await res.json()
        setConfigs(data)
      }
    } catch (error) {
      console.error('Failed to fetch chat config:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchConfigs() }, [fetchConfigs])

  const handleEdit = (config: ChatConfigItem) => {
    setEditingKey(config.key)
    setEditValueEn(config.valueEn)
    setEditValueAr(config.valueAr || '')
    setSaveSuccess(null)
  }

  const handleSave = async () => {
    if (!editingKey) return
    setSaving(true)
    try {
      const res = await fetch(`/api/chat-config/${editingKey}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          valueEn: editValueEn,
          valueAr: editValueAr || null,
        }),
      })
      if (res.ok) {
        invalidateChatConfigCache()
        setSaveSuccess(editingKey)
        await fetchConfigs()
        setTimeout(() => setSaveSuccess(null), 3000)
      }
    } catch (error) {
      console.error('Failed to save chat config:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setEditingKey(null)
    setEditValueEn('')
    setEditValueAr('')
    setSaveSuccess(null)
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="px-4 pb-2 pt-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-teal-600" />
          {isAr ? 'أداة الدردشة' : 'Chat Widget'}
        </CardTitle>
        <CardDescription className="text-[11px]">
          {isAr
            ? 'تكوين رسالة الترحيب وردود الذكاء الاصطناعي البديلة المعروضة للعملاء'
            : 'Configure the welcome message and AI fallback responses shown to customers in the chat widget.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="ml-2 text-xs text-muted-foreground">
              {isAr ? 'جاري التحميل...' : 'Loading messages...'}
            </span>
          </div>
        ) : (
          <ScrollArea className="max-h-[360px]">
            <div className="space-y-2">
              {configs.map((config) => {
                const labelInfo = CONFIG_LABELS[config.key] || { en: config.key, icon: MessageSquare, color: 'text-muted-foreground bg-muted' }
                const Icon = labelInfo.icon
                const isEditing = editingKey === config.key
                const isSaved = saveSuccess === config.key

                return (
                  <motion.div
                    key={config.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`rounded-lg border transition-all ${
                      isEditing ? 'ring-2 ring-brand-500/30 border-brand-300 shadow-sm' : 'hover:bg-muted/30'
                    } ${!config.isActive ? 'opacity-50' : ''}`}
                  >
                    {/* Config row header */}
                    <div className="flex items-center gap-2 p-2.5">
                      <div className={`flex h-7 w-7 items-center justify-center rounded-md ${labelInfo.color}`}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-medium text-foreground">{labelInfo.en}</p>
                          {config.key === 'welcome_message' && (
                            <Badge className="text-[8px] px-1.5 py-0 h-3.5 bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300 border-0">
                              {isAr ? 'الأولى' : 'SHOWN FIRST'}
                            </Badge>
                          )}
                          {isSaved && (
                            <motion.span
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="text-[10px] text-emerald-600 flex items-center gap-0.5"
                            >
                              <Check className="h-3 w-3" /> {isAr ? 'تم الحفظ' : 'Saved'}
                            </motion.span>
                          )}
                        </div>
                        {config.description && (
                          <p className="text-[9px] text-muted-foreground mt-0.5 truncate">{config.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {!isEditing && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            title="Edit"
                            onClick={() => handleEdit(config)}
                          >
                            <Edit3 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Preview (when not editing) */}
                    {!isEditing && (
                      <div className="px-2.5 pb-2.5">
                        <div className="rounded-md bg-muted/30 dark:bg-muted/20 px-3 py-2">
                          <p className="text-[11px] text-foreground leading-relaxed line-clamp-2">{config.valueEn}</p>
                          {config.valueAr && (
                            <p className="text-[11px] text-muted-foreground leading-relaxed mt-1 line-clamp-2" dir="rtl">{config.valueAr}</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Edit mode */}
                    <AnimatePresence>
                      {isEditing && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-2.5 pb-2.5 space-y-2">
                            {/* Language tabs */}
                            <Tabs value={langTab} onValueChange={(v) => setLangTab(v as 'en' | 'ar')}>
                              <TabsList className="h-7 w-full">
                                <TabsTrigger value="en" className="text-[10px] flex-1 gap-1">
                                  <Globe className="h-3 w-3" /> English
                                </TabsTrigger>
                                <TabsTrigger value="ar" className="text-[10px] flex-1 gap-1">
                                  <Globe className="h-3 w-3" /> العربية
                                </TabsTrigger>
                              </TabsList>
                            </Tabs>

                            {/* English textarea */}
                            {langTab === 'en' && (
                              <textarea
                                value={editValueEn}
                                onChange={(e) => setEditValueEn(e.target.value)}
                                className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                placeholder="Enter English message..."
                              />
                            )}

                            {/* Arabic textarea */}
                            {langTab === 'ar' && (
                              <textarea
                                value={editValueAr}
                                onChange={(e) => setEditValueAr(e.target.value)}
                                className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                placeholder="أدخل الرسالة العربية..."
                                dir="rtl"
                              />
                            )}

                            {/* Action buttons */}
                            <div className="flex items-center gap-2 justify-end">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-[10px]"
                                onClick={handleCancel}
                              >
                                {isAr ? 'إلغاء' : 'Cancel'}
                              </Button>
                              <Button
                                size="sm"
                                className="h-7 text-[10px] gap-1 bg-brand-600 hover:bg-brand-700 text-white"
                                disabled={saving || !editValueEn.trim()}
                                onClick={handleSave}
                              >
                                {saving ? (
                                  <><Loader2 className="h-3 w-3 animate-spin" /> {isAr ? 'حفظ...' : 'Saving...'}</>
                                ) : (
                                  <><Save className="h-3 w-3" /> {isAr ? 'حفظ' : 'Save'}</>
                                )}
                              </Button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function UserSettingsPanel() {
  const { t } = useTranslation()
  const language = useAppStore((s) => s.language)
  const setLanguage = useAppStore((s) => s.setLanguage)
  const currentAgent = useAppStore((s) => s.currentAgent)
  const { toast } = useToast()
  const { settings, isLoaded, updateSetting, updateSettings, resetSettings, persistToBackend } = useSettings()

  // Profile state — initialized from currentAgent
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')

  // Sync profile fields from currentAgent when it changes
  useEffect(() => {
    if (currentAgent) {
      setName((prev) => prev || currentAgent.name)
      setEmail((prev) => prev || currentAgent.email)
    }
  }, [currentAgent])

  // Activity Log state
  const [activityLog, setActivityLog] = useState<{
    id: string; action: string; createdAt: string; details: string; channel?: string | null; targetId?: string | null
  }[]>([])
  const [sessionHistory, setSessionHistory] = useState<{
    id: string; loginAt: string; logoutAt: string | null; isActive: boolean;
  }[]>([])

  // Fetch activity log and session history
  useEffect(() => {
    if (!currentAgent) return
    const fetchData = async () => {
      try {
        const [actionsRes, sessionsRes] = await Promise.all([
          fetch(`/api/employer-sessions/actions?XTransformPort=3002&agentId=${currentAgent.id}&limit=50`),
          fetch(`/api/employer-sessions/history?XTransformPort=3002&agentId=${currentAgent.id}&limit=5`),
        ])
        if (actionsRes.ok) {
          const data = await actionsRes.json()
          setActivityLog(data.actions || [])
        }
        if (sessionsRes.ok) {
          const data = await sessionsRes.json()
          setSessionHistory(data.sessions || [])
        }
      } catch { /* silent */ }
    }
    fetchData()
    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [currentAgent])

  // Load settings from backend on first agent load
  useEffect(() => {
    if (!currentAgent || !isLoaded) return
    const fetchSettings = async () => {
      try {
        const res = await fetch(`/api/employer-settings/${currentAgent.id}?XTransformPort=3002`)
        if (res.ok) {
          const data = await res.json()
          if (data.settings) {
            const backend = data.settings
            // Map backend fields to our settings, only override if localStorage doesn't already have custom values
            const storedRaw = localStorage.getItem('moei_user_settings')
            if (!storedRaw) {
              // No local overrides — use backend values
              updateSettings({
                fontSize: backend.fontSize || 'medium',
                highContrast: backend.highContrast || false,
                reducedMotion: backend.reducedMotion || false,
                screenReaderOpt: backend.screenReaderOpt || false,
                newMessageNotif: backend.newMessageNotif ?? true,
                caseAssignmentNotif: backend.caseAssignmentNotif ?? true,
                escalationAlerts: backend.escalationAlerts ?? true,
                shiftReminders: backend.shiftReminders ?? true,
                aiSuggestionNotif: backend.aiSuggestionNotif ?? false,
                dailySummaryEmail: backend.dailySummaryEmail ?? true,
                criticalIncidentAlerts: backend.criticalIncidentAlerts ?? true,
                compactMode: backend.compactMode ?? false,
                showAISuggestions: backend.showAISuggestions ?? true,
                soundNotifications: backend.soundNotifications ?? true,
                notificationSound: backend.notificationSound || 'chime',
                defaultView: backend.defaultView || 'agent',
                autoRefresh: backend.autoRefreshInterval || '15',
              })
            }
          }
        }
      } catch { /* silent */ }
    }
    fetchSettings()
  }, [currentAgent, isLoaded, updateSettings])

  const handleSave = async () => {
    // Persist to localStorage (already done by useSettings on each change)
    // Also persist to backend
    const ok = await persistToBackend()

    toast({
      title: t('settingsSaved'),
      description: ok ? '' : (language === 'ar' ? 'تم الحفظ محلياً فقط' : 'Saved locally only'),
    })

    // Log settings change
    logEmployerAction({
      action: 'update_settings',
      details: { section: 'general', fontSize: settings.fontSize, highContrast: settings.highContrast, reducedMotion: settings.reducedMotion },
    })
  }

  const handleReset = () => {
    resetSettings()
    setName(currentAgent?.name || '')
    setEmail(currentAgent?.email || '')
    toast({
      title: t('settingsReset'),
      description: '',
    })
  }

  const isAr = language === 'ar'

  // Don't render until settings are loaded from localStorage
  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-brand-50/50 to-transparent dark:from-brand-950/20">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-100 dark:bg-brand-900/30">
            <Settings className="h-4 w-4 text-brand-600" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">{t('settings')}</h2>
            <p className="text-[10px] text-muted-foreground">Manage your preferences</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="ghost" className="h-7 text-[10px] px-2 gap-1" onClick={handleReset}>
            <RotateCcw className="h-3 w-3" />
            {t('settingsReset')}
          </Button>
          <Button size="sm" className="h-7 text-[10px] px-2.5 gap-1 bg-brand-600 hover:bg-brand-700" onClick={handleSave}>
            <Save className="h-3 w-3" />
            {t('save')}
          </Button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
        {/* 1. Profile Settings */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="shadow-sm">
            <CardHeader className="px-4 pb-2 pt-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <User className="h-4 w-4 text-brand-600" />
                {t('userProfile')}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              {/* Avatar */}
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-14 h-14 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-brand-700 text-lg font-bold">
                    {name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <Button
                    size="icon"
                    variant="outline"
                    className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-background"
                  >
                    <Upload className="h-3 w-3" />
                  </Button>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{name || currentAgent?.name}</p>
                  <Badge variant="secondary" className="text-[9px] mt-0.5">
                    <Briefcase className="w-2.5 h-2.5 me-1" />
                    {currentAgent?.role || 'Senior Agent'}
                  </Badge>
                </div>
              </div>

              <Separator />

              {/* Name */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{t('agentName')}</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 text-sm" />
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{t('agentEmail')}</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} className="h-8 text-sm" type="email" />
              </div>

              {/* Language + Timezone row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">{t('languagePreference')}</Label>
                  <Select value={language} onValueChange={(v) => setLanguage(v as 'en' | 'ar')}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="ar">العربية</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">{t('timezone')}</Label>
                  <Select defaultValue="gst4">
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gst4">GST+4 (UAE)</SelectItem>
                      <SelectItem value="gst3">GST+3</SelectItem>
                      <SelectItem value="utc0">UTC</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* 2. Notification Preferences */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="shadow-sm">
            <CardHeader className="px-4 pb-2 pt-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Bell className="h-4 w-4 text-amber-500" />
                {t('notificationPreferences')}
              </CardTitle>
              <CardDescription className="text-[11px]">Configure how you receive alerts</CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <ToggleRow
                icon={MessageCircle}
                label={t('newMessageNotif')}
                description={t('newMessageNotifDesc')}
                checked={settings.newMessageNotif}
                onCheckedChange={(v) => updateSetting('newMessageNotif', v)}
              />
              <ToggleRow
                icon={FileText}
                label={t('caseAssignmentNotif')}
                description={t('caseAssignmentNotifDesc')}
                checked={settings.caseAssignmentNotif}
                onCheckedChange={(v) => updateSetting('caseAssignmentNotif', v)}
              />
              <ToggleRow
                icon={AlertTriangle}
                label={t('escalationAlerts')}
                description={t('escalationAlertsDesc')}
                checked={settings.escalationAlerts}
                onCheckedChange={(v) => updateSetting('escalationAlerts', v)}
              />
              <ToggleRow
                icon={Clock}
                label={t('shiftReminders')}
                description={t('shiftRemindersDesc')}
                checked={settings.shiftReminders}
                onCheckedChange={(v) => updateSetting('shiftReminders', v)}
              />
              <ToggleRow
                icon={Sparkles}
                label={t('aiSuggestionNotif')}
                description={t('aiSuggestionNotifDesc')}
                checked={settings.aiSuggestionNotif}
                onCheckedChange={(v) => updateSetting('aiSuggestionNotif', v)}
              />
              <ToggleRow
                icon={Mail}
                label={t('dailySummaryEmail')}
                description={t('dailySummaryEmailDesc')}
                checked={settings.dailySummaryEmail}
                onCheckedChange={(v) => updateSetting('dailySummaryEmail', v)}
              />
              <ToggleRow
                icon={Siren}
                label={t('criticalIncidentAlerts')}
                description={t('criticalIncidentAlertsDesc')}
                checked={settings.criticalIncidentAlerts}
                onCheckedChange={(v) => updateSetting('criticalIncidentAlerts', v)}
              />
            </CardContent>
          </Card>
        </motion.div>

        {/* 3. Dashboard Preferences */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="shadow-sm">
            <CardHeader className="px-4 pb-2 pt-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <LayoutDashboard className="h-4 w-4 text-brand-600" />
                {t('dashboardPreferences')}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              {/* Default View */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{t('defaultView')}</Label>
                <Select value={settings.defaultView} onValueChange={(v) => updateSetting('defaultView', v)}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hub">{t('hub')}</SelectItem>
                    <SelectItem value="agent">{t('agentDashboard')}</SelectItem>
                    <SelectItem value="executive">{t('executiveDashboard')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Auto-refresh interval */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{t('autoRefreshInterval')}</Label>
                <Select value={settings.autoRefresh} onValueChange={(v) => updateSetting('autoRefresh', v)}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">{t('interval5s')}</SelectItem>
                    <SelectItem value="15">{t('interval15s')}</SelectItem>
                    <SelectItem value="30">{t('interval30s')}</SelectItem>
                    <SelectItem value="manual">{t('intervalManual')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Toggle switches */}
              <ToggleRow
                icon={Monitor}
                label={t('compactMode')}
                description=""
                checked={settings.compactMode}
                onCheckedChange={(v) => {
                  updateSetting('compactMode', v)
                  // Also apply compact-mode class to body
                  if (typeof document !== 'undefined') {
                    document.body.classList.toggle('compact-mode', v)
                  }
                }}
              />
              <ToggleRow
                icon={Sparkles}
                label={t('showAISuggestions')}
                description=""
                checked={settings.showAISuggestions}
                onCheckedChange={(v) => updateSetting('showAISuggestions', v)}
              />
              <ToggleRow
                icon={Volume2}
                label={t('soundNotifications')}
                description=""
                checked={settings.soundNotifications}
                onCheckedChange={(v) => updateSetting('soundNotifications', v)}
              />

              {/* Notification sound selection */}
              {settings.soundNotifications && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-1.5 pl-10">
                  <Label className="text-xs font-medium">{t('notificationSound')}</Label>
                  <Select value={settings.notificationSound} onValueChange={(v) => updateSetting('notificationSound', v)}>
                    <SelectTrigger className="h-8 text-sm w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="chime">{t('soundChime')}</SelectItem>
                      <SelectItem value="bell">{t('soundBell')}</SelectItem>
                      <SelectItem value="popup">{t('soundPopup')}</SelectItem>
                      <SelectItem value="none">{t('soundNone')}</SelectItem>
                    </SelectContent>
                  </Select>
                </motion.div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* 4. Accessibility Settings */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="shadow-sm">
            <CardHeader className="px-4 pb-2 pt-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Eye className="h-4 w-4 text-purple-600" />
                {t('accessibilitySettings')}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <ToggleRow
                icon={Eye}
                label={t('highContrastMode')}
                description={t('highContrastModeDesc')}
                checked={settings.highContrast}
                onCheckedChange={(v) => updateSetting('highContrast', v)}
              />
              <ToggleRow
                icon={Monitor}
                label={t('reducedMotion')}
                description={t('reducedMotionDesc')}
                checked={settings.reducedMotion}
                onCheckedChange={(v) => updateSetting('reducedMotion', v)}
              />
              <ToggleRow
                icon={User}
                label={t('screenReaderOpt')}
                description={t('screenReaderOptDesc')}
                checked={settings.screenReaderOpt}
                onCheckedChange={(v) => updateSetting('screenReaderOpt', v)}
              />

              {/* Font size selector */}
              <div className="space-y-1.5 pt-2 pl-10">
                <Label className="text-xs font-medium">{t('fontSize')}</Label>
                <div className="flex items-center gap-2">
                  {(['small', 'medium', 'large'] as const).map((size) => (
                    <Button
                      key={size}
                      variant={settings.fontSize === size ? 'default' : 'outline'}
                      size="sm"
                      className={`h-7 text-[10px] px-3 ${settings.fontSize === size ? 'bg-brand-600 text-white' : ''}`}
                      onClick={() => updateSetting('fontSize', size)}
                    >
                      {t(`fontSize${size.charAt(0).toUpperCase() + size.slice(1)}` as Parameters<typeof t>[0])}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* 5. Chat Widget — Moved from AI Config panel */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}>
          <ChatWidgetSection isAr={isAr} />
        </motion.div>

        {/* 6. Activity Log */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <Card className="shadow-sm">
            <CardHeader className="px-4 pb-2 pt-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4 text-ae-gold-600" />
                {isAr ? 'سجل النشاط' : 'Activity Log'}
              </CardTitle>
              <CardDescription className="text-[11px]">
                {isAr ? 'سجل إجراءاتك الأخيرة وجلساتك' : 'Your recent actions and sessions'}
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              {/* Session History */}
              {sessionHistory.length > 0 && (
                <div>
                  <Label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    {isAr ? 'جلسات العمل' : 'Work Sessions'}
                  </Label>
                  <div className="mt-1.5 space-y-1.5">
                    {sessionHistory.slice(0, 3).map((session) => {
                      const loginTime = new Date(session.loginAt)
                      const duration = session.logoutAt
                        ? Math.round((new Date(session.logoutAt).getTime() - loginTime.getTime()) / (1000 * 60))
                        : Math.round((Date.now() - loginTime.getTime()) / (1000 * 60))
                      const hours = Math.floor(duration / 60)
                      const mins = duration % 60
                      return (
                        <div key={session.id} className="flex items-center gap-2 text-[11px] p-2 bg-muted/50 rounded-lg">
                          <div className={`h-2 w-2 rounded-full ${session.isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                          <span className="text-muted-foreground">
                            {loginTime.toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </span>
                          <span className="text-foreground">
                            {loginTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className="text-muted-foreground">
                            ({hours > 0 ? `${hours}h ` : ''}{mins}m)
                          </span>
                          {session.isActive && (
                            <Badge className="text-[8px] h-3.5 px-1 bg-green-100 text-green-700 border-green-200">
                              {isAr ? 'نشطة' : 'Active'}
                            </Badge>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <Separator />

              {/* Action Log */}
              <div>
                <Label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  {isAr ? 'الإجراءات الأخيرة' : 'Recent Actions'}
                </Label>
                <ScrollArea className="mt-1.5 max-h-60">
                  {activityLog.length === 0 ? (
                    <div className="flex flex-col items-center py-6 text-muted-foreground">
                      <Activity className="h-6 w-6 mb-1 opacity-30" />
                      <p className="text-[10px]">{isAr ? 'لا توجد إجراءات مسجلة بعد' : 'No actions recorded yet'}</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {activityLog.map((entry) => {
                        const meta = ACTION_META[entry.action] || {
                          en: entry.action,
                          ar: entry.action,
                          icon: Activity,
                          color: 'text-gray-500',
                        }
                        const Icon = meta.icon
                        // Parse details for extra context
                        let detailStr = ''
                        try {
                          const d = JSON.parse(entry.details || '{}')
                          if (d.targetAgentId) detailStr = `→ ${d.targetAgentId.slice(-6)}`
                          if (d.aiMode) detailStr = `→ ${d.aiMode}`
                          if (d.channel) detailStr = `(${d.channel})`
                          if (d.section) detailStr = `(${d.section})`
                        } catch { /* no details */ }

                        return (
                          <div key={entry.id} className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted/50 text-[11px]">
                            <Icon className={`w-3.5 h-3.5 shrink-0 ${meta.color}`} />
                            <span className="text-foreground">{isAr ? meta.ar : meta.en}</span>
                            {detailStr && (
                              <span className="text-muted-foreground truncate">{detailStr}</span>
                            )}
                            {entry.channel && (
                              <Badge variant="outline" className="text-[7px] h-3 px-1">
                                {entry.channel}
                              </Badge>
                            )}
                            <span className="text-muted-foreground ms-auto shrink-0">
                              {new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
