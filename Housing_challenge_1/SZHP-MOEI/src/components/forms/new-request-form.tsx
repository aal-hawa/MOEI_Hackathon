'use client'

import { useState, useRef, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User,
  Landmark,
  Brain,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Sparkles,
  Upload,
  Trash2,
  XCircle,
  ShieldCheck,
  Fingerprint,
  LogIn,
  LogOut,
  Dice5,
  Lock,
  ChevronLeft,
  ChevronRight,
  FileText,
  ShieldAlert,
  Info,
  Bot,
  Eye,
  BarChart3,
  AlertTriangle,
  Calendar,
  Globe2,
  Send,
  Paperclip,
  Database,
  Users,
  TrendingDown,
  Heart,
  Home,
  Building2,
  Activity,
  GitCompareArrows,
  Scale,
} from 'lucide-react'
import { toast } from 'sonner'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

import { cn, authFetch } from '@/lib/utils'

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}
import { useAppStore } from '@/lib/store'
import { useAuthStore } from '@/lib/auth-store'
import { t } from '@/lib/i18n'
import { useSystemConfig } from '@/hooks/use-system-config'
import { MOCK_USERS, generateRandomMockUser, type MockUserProfile, MOCK_HOUSING_ASSISTANCE_FILES, type HousingAssistanceFile } from '@/lib/uaepass-mock'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ScrollFade } from '@/components/ui/scroll-fade'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// ─── MOEI Color Constants ────────────────────────────────────
const MOEI_GOLD = '#B68A35'
const MOEI_GOLD_DARK = '#9A7429'
const MOEI_GOLD_LIGHT = '#D4A84B'
const MOEI_GREEN = '#4CAF50'
const MOEI_RED = '#DC2626'

// ─── Zod Schemas ───────────────────────────────────────────
const identitySchema = z.object({
  emiratesId: z.string().optional().or(z.literal('')),
  nameEn: z.string().optional().or(z.literal('')),
  nameAr: z.string().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  email: z.string().email('Invalid email').or(z.literal('')).optional(),
})

const housingSchema = z.object({
  housingAssistanceNumber: z.string().min(1, 'Housing assistance file is required'),
  requestType: z.enum(['reschedule_arrears', 'postpone_instalment', 'reduce_instalment']),
  reason: z.string().max(2000, 'Reason must be under 2000 characters').optional().or(z.literal('')),
})

const fullFormSchema = identitySchema.merge(housingSchema).extend({
  maritalStatus: z.string().optional(),
  spouseIncome: z.coerce.number().optional(),
  numberOfChildren: z.coerce.number().optional(),
  housingType: z.string().optional(),
  incomeStability: z.string().optional(),
  previousIncome: z.coerce.number().optional(),
})
type FullFormValues = z.infer<typeof fullFormSchema>

// ─── Request Type Options ──────────────────────────────────
const REQUEST_TYPES = [
  { value: 'reschedule_arrears' as const, labelKey: 'form.rescheduleArrears', criteriaKey: 'form.reschedulingCriteria' },
  { value: 'postpone_instalment' as const, labelKey: 'form.postponeInstalment', criteriaKey: 'form.postponementCriteria' },
  { value: 'reduce_instalment' as const, labelKey: 'form.reduceInstalment', criteriaKey: 'form.reductionCriteria' },
]

// ─── Helpers ───────────────────────────────────────────────
const formatEmiratesId = (value: string): string => {
  const digits = value.replace(/\D/g, '')
  if (digits.length === 15) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 14)}-${digits.slice(14)}`
  }
  if (/^\d{3}-\d{4}-\d{7}-\d{1}$/.test(value)) return value
  return value
}

const normalizePhoneNumber = (value: string): string => {
  const digits = value.replace(/\D/g, '')
  if (digits.startsWith('00971') && digits.length >= 13) return '0' + digits.slice(5)
  if (digits.startsWith('971') && digits.length >= 12) return '0' + digits.slice(3)
  if (digits.startsWith('5') && digits.length === 9) return '0' + digits
  if (digits.startsWith('05') && digits.length === 10) return digits
  return value
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)

// 3-step wizard (MOEI style)
const MOEI_STEPS = [
  { id: 1, titleKey: 'moei.step1.title', descKey: 'moei.step1.desc', icon: Fingerprint },
  { id: 2, titleKey: 'moei.step2.title', descKey: 'moei.step2.desc', icon: FileText },
  { id: 3, titleKey: 'moei.step3.title', descKey: 'moei.step3.desc', icon: Paperclip },
  { id: 4, titleKey: 'moei.step4.title', descKey: 'moei.step4.desc', icon: Brain },
]

type MockProfileId = keyof typeof MOCK_USERS

// ─── UAE PASS Login Dialog (MOEI-styled) ────────────────────
function UAEPassLoginDialog({
  open,
  onOpenChange,
  onLogin,
  language,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onLogin: (profile: MockUserProfile) => void
  language: 'en' | 'ar'
}) {
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null)
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [authMode, setAuthMode] = useState<'mock' | 'production'>('mock')
  const isAr = language === 'ar'

  const handleMockLogin = (profileId: string) => {
    setIsLoggingIn(true)
    const profile = MOCK_USERS[profileId as MockProfileId]
    if (profile) {
      setTimeout(() => {
        onLogin(profile)
        setIsLoggingIn(false)
        onOpenChange(false)
      }, 600)
    }
  }

  const handleRandomLogin = () => {
    setIsLoggingIn(true)
    const randomProfile = generateRandomMockUser()
    setTimeout(() => {
      onLogin(randomProfile)
      setIsLoggingIn(false)
      onOpenChange(false)
    }, 600)
  }

  const handleUAEPassLogin = () => {
    setIsLoggingIn(true)
    setTimeout(() => {
      const profile = MOCK_USERS['ahmed-citizen']
      onLogin(profile)
      setIsLoggingIn(false)
      onOpenChange(false)
    }, 1000)
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'citizen': return <User className="w-4 h-4" />
      case 'employee': return <Landmark className="w-4 h-4" />
      case 'admin': return <ShieldAlert className="w-4 h-4" />
      default: return <User className="w-4 h-4" />
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'citizen': return 'text-green-700 bg-green-50 border-green-200'
      case 'employee': return 'text-[#B68A35] bg-amber-50 border-amber-200'
      case 'admin': return 'text-[#B68A35] bg-amber-50 border-amber-200'
      default: return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'citizen': return t('login.mock.citizen', language)
      case 'employee': return t('login.mock.employee', language)
      case 'admin': return t('login.mock.admin', language)
      default: return role
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* MOEI-styled header */}
        <div className="px-6 pt-6 pb-4 border-b shrink-0" style={{ background: `linear-gradient(135deg, ${MOEI_GOLD}, ${MOEI_GOLD_DARK})` }}>
          <DialogTitle className="flex items-center gap-3 text-white">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <Fingerprint className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-bold text-lg">{t('form.uaepass.signIn', language)}</div>
              <div className="text-white/80 text-xs font-normal">{t('form.uaepass.autoFill', language)}</div>
            </div>
          </DialogTitle>
          <DialogDescription className="sr-only">{t('form.uaepass.signIn', language)} - {t('form.uaepass.autoFill', language)}</DialogDescription>
        </div>

        <ScrollFade className="flex-1 min-h-0">
          <ScrollArea className="h-full px-6 py-4">
            <div className="space-y-4 pb-2">
              {/* UAE PASS Button */}
              <Button
                onClick={handleUAEPassLogin}
                disabled={isLoggingIn}
                className="w-full h-12 text-white rounded-xl font-semibold shadow-lg"
                style={{ backgroundColor: '#3F8E50' }}
              >
                {isLoggingIn ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Fingerprint className="w-5 h-5 me-2" />
                    {t('form.uaepass.signIn', language)}
                  </>
                )}
              </Button>

              {/* Auth mode toggle */}
              <div className="flex items-center justify-center gap-2">
                <Label className="text-xs text-gray-500">{t('form.uaepass.mock', language)}</Label>
                <Switch
                  checked={authMode === 'production'}
                  onCheckedChange={(checked) => setAuthMode(checked ? 'production' : 'mock')}
                />
                <Label className="text-xs text-gray-500">{t('form.uaepass.production', language)}</Label>
              </div>

              {/* Mock Section */}
              <AnimatePresence>
                {authMode === 'mock' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <Separator className="flex-1" />
                      <span className="text-xs text-gray-400 uppercase">{t('form.uaepass.orSelectProfile', language)}</span>
                      <Separator className="flex-1" />
                    </div>

                    <Button
                      onClick={handleRandomLogin}
                      disabled={isLoggingIn}
                      variant="outline"
                      className="w-full h-10 mb-3 border-dashed rounded-lg hover:bg-amber-50 hover:border-amber-400 text-amber-700 text-sm"
                    >
                      <Dice5 className="w-4 h-4 me-2" />
                      {t('login.mock.random', language)}
                    </Button>

                    <ScrollFade className="mb-3" fadeSize={24}>
                      <div className="space-y-2 max-h-[240px] overflow-y-auto custom-scrollbar pe-1">
                        {Object.entries(MOCK_USERS).map(([key, profile]) => (
                          <div
                            key={key}
                            onClick={() => setSelectedProfile(key)}
                            className={cn(
                              'flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-all',
                              selectedProfile === key
                                ? 'border-amber-400 bg-amber-50/50 shadow-sm'
                                : 'border-transparent hover:bg-gray-50 hover:border-gray-200'
                            )}
                          >
                            <div className={cn(
                              'w-9 h-9 rounded-full flex items-center justify-center shrink-0',
                              profile.role === 'admin' ? 'bg-amber-100 text-amber-700' :
                              profile.role === 'employee' ? 'bg-amber-100 text-amber-700' :
                              'bg-green-100 text-green-700'
                            )}>
                              {getRoleIcon(profile.role)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm text-gray-800 truncate">
                                {isAr && profile.fullnameAR ? profile.fullnameAR : profile.fullnameEN}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <Badge variant="outline" className={cn('text-[10px] h-4 px-1.5', getRoleColor(profile.role))}>
                                  {getRoleLabel(profile.role)}
                                </Badge>
                                <span className="text-[10px] text-gray-400">{profile.idn}</span>
                              </div>
                            </div>
                            <div className="shrink-0">
                              {selectedProfile === key ? (
                                <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: MOEI_GOLD }}>
                                  <CheckCircle2 className="w-3 h-3 text-white" />
                                </div>
                              ) : (
                                <div className="w-5 h-5 rounded-full border-2 border-gray-200" />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollFade>

                    <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200">
                      <div className="flex items-start gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-[11px] text-amber-700">
                          {t('form.uaepass.mockMode', language)}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Production Mode */}
              <AnimatePresence>
                {authMode === 'production' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                      <div className="flex items-start gap-2">
                        <ShieldCheck className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-medium text-green-800">
                            {t('form.uaepass.productionMode', language)}
                          </p>
                          <p className="text-[11px] text-green-700 mt-0.5">
                            {t('form.uaepass.productionDesc', language)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </ScrollArea>
        </ScrollFade>

        {/* Sticky footer */}
        <DialogFooter className="px-6 py-4 border-t bg-gray-50/50 shrink-0">
          <AnimatePresence>
            {authMode === 'mock' && selectedProfile && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                className="w-full"
              >
                <Button
                  onClick={() => handleMockLogin(selectedProfile)}
                  disabled={isLoggingIn}
                  className="w-full h-10 text-white font-semibold rounded-lg"
                  style={{ backgroundColor: MOEI_GOLD }}
                >
                  {isLoggingIn ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <LogIn className="w-4 h-4 me-2" />
                      {t('login.mock.login', language)}
                    </>
                  )}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── DBR Traffic Light Component ─────────────────────────────
function DBRTrafficLight({ dbr, label, language }: { dbr: number; label: string; language: 'en' | 'ar' }) {
  const { getPercentage } = useSystemConfig()
  const dbrHealthyPct = getPercentage('dbr_healthy_limit', 35)
  const dbrMaxPct = getPercentage('max_dbr_limit', 60)

  const getColor = () => {
    if (dbr < dbrHealthyPct) return { bg: 'bg-green-500', ring: 'ring-green-200', text: 'text-green-700', barBg: 'bg-green-100', barFill: 'bg-green-500' }
    if (dbr <= dbrMaxPct) return { bg: 'bg-amber-500', ring: 'ring-amber-200', text: 'text-amber-700', barBg: 'bg-amber-100', barFill: 'bg-amber-500' }
    return { bg: 'bg-red-500', ring: 'ring-red-200', text: 'text-red-700', barBg: 'bg-red-100', barFill: 'bg-red-500' }
  }

  const c = getColor()

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <div className="flex items-center gap-2">
          <div className={cn('w-3 h-3 rounded-full ring-2', c.bg, c.ring)} />
          <span className={cn('text-lg font-bold', c.text)}>{dbr.toFixed(1)}%</span>
        </div>
      </div>
      <div className={cn('w-full rounded-full h-2.5 overflow-hidden', c.barBg)}>
        <motion.div
          className={cn('h-full rounded-full', c.barFill)}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(dbr, 100)}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-gray-400">
        <span>0%</span>
        <span className="text-green-500">{dbrHealthyPct}%</span>
        <span className="text-amber-500">{dbrMaxPct}%</span>
        <span>100%</span>
      </div>
    </div>
  )
}

// ─── AI Eligibility Badge ────────────────────────────────────
function AIEligibilityBadge({ proposedDBR, language }: { proposedDBR: number; language: 'en' | 'ar' }) {
  const { getPercentage } = useSystemConfig()
  const dbrMaxPct = getPercentage('max_dbr_limit', 60)

  let status: 'eligible' | 'marginal' | 'ineligible' = 'eligible'
  if (proposedDBR > dbrMaxPct) status = 'ineligible'
  else if (proposedDBR > 35) status = 'marginal'

  const config = {
    eligible: { icon: CheckCircle2, bg: 'bg-green-50 border-green-200', text: 'text-green-700', badge: 'bg-green-100 text-green-700 border-green-200', labelKey: 'moei.ai.eligible' },
    marginal: { icon: AlertTriangle, bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700 border-amber-200', labelKey: 'moei.ai.marginal' },
    ineligible: { icon: AlertCircle, bg: 'bg-red-50 border-red-200', text: 'text-red-700', badge: 'bg-red-100 text-red-700 border-red-200', labelKey: 'moei.ai.ineligible' },
  }[status]

  const Icon = config.icon

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn('rounded-xl border p-3 flex items-center gap-3', config.bg)}
    >
      <div className={cn('w-8 h-8 rounded-full flex items-center justify-center', config.badge)}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Bot className="w-3.5 h-3.5 text-amber-600" />
          <span className="text-[10px] font-semibold text-amber-600 uppercase">AI</span>
        </div>
        <p className={cn('text-sm font-semibold', config.text)}>
          {t(config.labelKey, language)}
        </p>
      </div>
    </motion.div>
  )
}

// ─── Main Form Component ─────────────────────────────────────
interface NewRequestFormProps {
  onSuccess: () => void
}

export function NewRequestForm({ onSuccess }: NewRequestFormProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showUAEPassDialog, setShowUAEPassDialog] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ id: string; originalName: string; storedName: string; size: number; type: string; uploadedAt: string; docType?: string }>>([])
  const [isUploading, setIsUploading] = useState(false)
  const [aiAnalysisResult, setAiAnalysisResult] = useState<Record<string, unknown> | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [salaryCertAnalysis, setSalaryCertAnalysis] = useState<Record<string, unknown> | null>(null)
  const [isAnalyzingSalaryCert, setIsAnalyzingSalaryCert] = useState(false)
  const [directDebitAgreement, setDirectDebitAgreement] = useState(false)
  const [selectedLoanDetails, setSelectedLoanDetails] = useState<HousingAssistanceFile | null>(null)
  const [refNumber] = useState(() => `SZHP-${Date.now().toString(36).toUpperCase()}`)
  const [medicalReportAnalysis, setMedicalReportAnalysis] = useState<Record<string, unknown> | null>(null)
  const [isAnalyzingMedicalReport, setIsAnalyzingMedicalReport] = useState(false)
  const [salaryBankCrossCheck, setSalaryBankCrossCheck] = useState<Record<string, unknown> | null>(null)
  const [isCrossChecking, setIsCrossChecking] = useState(false)
  const [documentAuthenticityDeclaration, setDocumentAuthenticityDeclaration] = useState(false)

  const { language } = useAppStore()
  const { isAuthenticated, userRole, userProfile, mockExtraData, _hasHydrated, loginWithMockUser, logout } = useAuthStore()
  const isAr = language === 'ar'

  const uaepassOriginalValues = useRef<{
    emiratesId: string
    nameEn: string
    nameAr: string
    phone: string
    email: string
  } | null>(null)

  const isCitizenUAEPass = isAuthenticated && userRole === 'citizen' && userProfile !== null
  const isUAEPassLocked = isCitizenUAEPass

  const renderLockedBadge = () => (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-0.5 ms-1.5 cursor-help">
            <Lock className="size-3 text-green-600" />
            <Badge className="text-[9px] bg-green-50 text-green-700 border-green-200 h-4 px-1 gap-0.5">
              <ShieldCheck className="size-2.5" />
              {t('form.uaepass.lockedShort', language)}
            </Badge>
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[260px] text-xs">
          {t('form.uaepass.locked', language)}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )

  const form = useForm<FullFormValues>({
    resolver: zodResolver(fullFormSchema),
    defaultValues: {
      emiratesId: '',
      nameEn: '',
      nameAr: '',
      phone: '',
      email: '',
      housingAssistanceNumber: '',
      requestType: 'reschedule_arrears' as 'reschedule_arrears' | 'postpone_instalment' | 'reduce_instalment',
      reason: '',
    },
    mode: 'onChange',
  })

  // ─── Rehydrate form from persisted UAE PASS profile on mount ──
  useEffect(() => {
    if (!_hasHydrated) return
    if (isCitizenUAEPass && !uaepassOriginalValues.current && userProfile) {
      const emiratesIdValue = userProfile.idn || ''
      const nameEnValue = userProfile.fullnameEN || ''
      const nameArValue = userProfile.fullnameAR || ''
      const phoneValue = userProfile.mobile ? normalizePhoneNumber(userProfile.mobile.replace('+971', '0')) : ''
      const emailValue = userProfile.email || ''

      form.setValue('emiratesId', emiratesIdValue, { shouldValidate: true })
      form.setValue('nameEn', nameEnValue, { shouldValidate: true })
      form.setValue('nameAr', nameArValue, { shouldValidate: true })
      form.setValue('phone', phoneValue, { shouldValidate: true })
      form.setValue('email', emailValue, { shouldValidate: true })

      uaepassOriginalValues.current = {
        emiratesId: emiratesIdValue,
        nameEn: nameEnValue,
        nameAr: nameArValue,
        phone: phoneValue,
        email: emailValue,
      }
    }
  }, [_hasHydrated, isAuthenticated, userProfile, form])

  // Scroll to top when step changes
  useEffect(() => {
    // A small timeout ensures the DOM has updated and rendered the new step content before scrolling
    const timer = setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      // If there is a scrollable container inside the layout instead of window, we try to scroll it too
      const mainContent = document.getElementById('main-content')
      if (mainContent) {
        mainContent.scrollTo({ top: 0, behavior: 'smooth' })
      }
    }, 50)
    return () => clearTimeout(timer)
  }, [currentStep])

  // ─── Disconnect UAE PASS ───────────────────────────────
  const handleDisconnectUAEPass = () => {
    logout()
    uaepassOriginalValues.current = null
    form.reset()
    setAiAnalysisResult(null)
    setDirectDebitAgreement(false)
    setCurrentStep(1)
    toast.info(t('form.uaepass.disconnected', language))
  }

  const handleUAEPassLogin = async (profile: MockUserProfile) => {
    await loginWithMockUser(profile)

    const emiratesIdValue = profile.idn
    const nameEnValue = profile.fullnameEN
    const nameArValue = profile.fullnameAR
    const phoneValue = normalizePhoneNumber(profile.mobile.replace('+971', '0'))
    const emailValue = profile.email || ''

    form.setValue('emiratesId', emiratesIdValue, { shouldValidate: true })
    form.setValue('nameEn', nameEnValue, { shouldValidate: true })
    form.setValue('nameAr', nameArValue, { shouldValidate: true })
    form.setValue('phone', phoneValue, { shouldValidate: true })
    form.setValue('email', emailValue, { shouldValidate: true })

    uaepassOriginalValues.current = {
      emiratesId: emiratesIdValue,
      nameEn: nameEnValue,
      nameAr: nameArValue,
      phone: phoneValue,
      email: emailValue,
    }

    toast.success(t('form.uaepass.loginSuccess', language), { description: t('form.uaepass.loginSuccessDesc', language) })
  }

  // ─── Watched fields ──────────────────────────────────
  const requestType = form.watch('requestType')
  const housingAssistanceNumber = form.watch('housingAssistanceNumber')
  const maritalStatus = form.watch('maritalStatus')
  const incomeStability = form.watch('incomeStability')

  const { getNumber, getString, getBoolean } = useSystemConfig()
  const maxFileSizeMB = getNumber('max_file_upload_size_mb', 10)
  const aiAnalysisMode = getString('ai_analysis_mode', 'optional')
  const isAiAnalysisRequired = aiAnalysisMode === 'required'
  const isSalaryCertRequired = getBoolean('salary_certificate_required', true)

  // ─── Step validation ─────────────────────────────────
  // Only UAE PASS (step 1) and Salary Certificate (step 3) are mandatory
  const validateStep = async (step: number): Promise<boolean> => {
    switch (step) {
      case 1:
        // Only require UAE PASS login — all fields are optional
        if (!isUAEPassLocked) {
          toast.error(t('form.validationError', language), { description: t('form.uaepass.signInPrompt', language) })
          return false
        }
        return true
      case 2: {
        // Housing assistance number is mandatory
        const han = form.getValues('housingAssistanceNumber')
        if (!han || han.trim() === '') {
          toast.error(t('form.validationError', language), { description: isAr ? 'يرجى اختيار ملف المساعدة السكنية أو إدخال رقمه' : 'Please select a housing assistance file or enter its number' })
          return false
        }
        return true
      }
      case 3: 
        // Only salary certificate is mandatory
        const hasSalary = uploadedFiles.some(f => f.docType === 'salary_certificate')
        if (!hasSalary) {
          toast.error(t('form.validationError', language), { description: t('form.salaryCertificate', language) + ' ' + (isAr ? 'مطلوب' : 'is required') })
          return false
        }
        return true
    }
    return true
  }

  const handleNext = async () => {
    const valid = await validateStep(currentStep)
    if (valid) setCurrentStep((prev) => Math.min(prev + 1, 4))
  }

  const handleBack = () => setCurrentStep((prev) => Math.max(prev - 1, 1))
  const handleGoToStep = (step: number) => { if (step < currentStep) setCurrentStep(step) }

  // ─── File upload ───────────────────────────────────────
  const handleFileUpload = async (
    files: FileList,
    docType?: string,
    onFileUploaded?: (fileData: { id: string; originalName: string; storedName: string; size: number; type: string; uploadedAt: string; docType?: string }) => void
  ) => {
    setIsUploading(true)
    try {
      for (const file of Array.from(files)) {
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
        if (!allowedTypes.includes(file.type)) {
          toast.error(t('form.upload.invalidType', language), { description: file.name })
          continue
        }
        if (file.size > maxFileSizeMB * 1024 * 1024) {
          toast.error(t('form.upload.tooLarge', language), { description: `${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)` })
          continue
        }
        const formData = new FormData()
        formData.append('file', file)
        const res = await authFetch('/api/upload', { method: 'POST', body: formData })
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}))
          throw new Error(errorData.error || 'Upload failed')
        }
        const fileData = await res.json()
        // API returns { data: { id, originalName, storedName, size, type, uploadedAt } }
        const raw = fileData?.data && typeof fileData.data === 'object' ? fileData.data : fileData
        const parsedSize = typeof raw.size === 'number' ? raw.size : Number(raw.size)
        const safeSize = !isNaN(parsedSize) && parsedSize >= 0 ? parsedSize : (file.size || 0)
        const uploadedFile = { ...raw, id: raw.id || generateId(), size: safeSize, docType }
        setUploadedFiles((prev) => [...prev, uploadedFile])
        toast.success(t('form.upload.success', language), { description: file.name })
        // Invoke callback immediately with the uploaded file data
        onFileUploaded?.(uploadedFile)
      }
    } catch (err) {
      toast.error(t('form.upload.fail', language), { description: err instanceof Error ? err.message : t('form.upload.failDesc', language) })
    } finally {
      setIsUploading(false)
    }
  }

  const handleRemoveFile = async (fileId: string, storedName: string) => {
    try {
      await authFetch(`/api/upload?file=${encodeURIComponent(storedName)}`, { method: 'DELETE' })
      setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId))
      toast.info(t('form.upload.removed', language))
    } catch {
      setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId))
    }
  }

  const formatFileSize = (bytes: number | undefined | null | string) => {
    const numBytes = typeof bytes === 'string' ? parseFloat(bytes) : bytes
    if (numBytes == null || isNaN(numBytes) || numBytes < 0) return '0 B'
    if (numBytes < 1024) return `${numBytes} B`
    if (numBytes < 1024 * 1024) return `${(numBytes / 1024).toFixed(1)} KB`
    return `${(numBytes / 1024 / 1024).toFixed(1)} MB`
  }

  // ─── AI Pre-Submission Analysis ────────────────────────
  const runAIAnalysis = async () => {
    setIsAnalyzing(true)
    setAiAnalysisResult(null)
    try {
      const values = form.getValues()
      const payload = {
        applicant: {
          emiratesId: values.emiratesId || '',
          nameEn: values.nameEn || null,
          nameAr: values.nameAr || '',
          phone: values.phone || '',
          email: values.email || null,
          monthlyIncome: mockExtraData?.monthlyIncome || 0,
          employer: mockExtraData?.employer || null,
          employerType: mockExtraData?.employerType || 'government',
          familySize: mockExtraData?.familySize ?? 1,
          hasFamilyBook: mockExtraData?.nationalityEN === 'Emirati',
        },
        loan: selectedLoanDetails ? {
          originalAmount: selectedLoanDetails.originalAmount,
          remainingBalance: selectedLoanDetails.remainingBalance,
          monthlyInstallment: selectedLoanDetails.monthlyInstallment,
          loanDurationMonths: selectedLoanDetails.loanDurationMonths,
          elapsedMonths: selectedLoanDetails.elapsedMonths,
          loanType: selectedLoanDetails.loanType,
          totalOverdue: selectedLoanDetails.totalOverdue,
          missedMonths: selectedLoanDetails.missedMonths,
          delayDays: selectedLoanDetails.delayDays,
        } : {
          originalAmount: 0,
          remainingBalance: 0,
          monthlyInstallment: 0,
          loanDurationMonths: 0,
          elapsedMonths: 0,
          loanType: 'housing_loan',
          totalOverdue: 0,
          missedMonths: 0,
          delayDays: 0,
        },
        request: {
          requestedDurationMonths: 120,
          reason: values.reason || null,
          reasonCategory: values.requestType || 'other',
          priority: 'normal',
          supportingDocuments: uploadedFiles.map(f => f.docType || f.originalName),
          notes: `Housing Assistance Number: ${values.housingAssistanceNumber}`,
        },
        uploadedFiles,
      }
      const res = await authFetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) { const errorData = await res.json().catch(() => ({})); throw new Error(errorData.error || 'Analysis failed') }
      const { data } = await res.json()
      setAiAnalysisResult(data)
      toast.success(t('form.ai.analysisComplete', language), { description: t('form.ai.analysisCompleteDesc', language) })
    } catch (err) {
      toast.error(t('form.ai.analysisFailed', language), { description: err instanceof Error ? err.message : t('form.ai.analysisFailedDesc', language) })
    } finally {
      setIsAnalyzing(false)
    }
  }

  // ─── AI Salary Certificate Analysis ────────────────────
  const runSalaryCertAnalysis = async (fileName: string) => {
    setIsAnalyzingSalaryCert(true)
    setSalaryCertAnalysis(null)
    try {
      const res = await authFetch('/api/analyze-salary-certificate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName, language }),
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Salary certificate analysis failed')
      }
      const responseData = await res.json()
      // API returns { data: { isSalaryCertificate, confidence, ... } }
      const data = responseData?.data && typeof responseData.data === 'object' && !Array.isArray(responseData.data) ? responseData.data : responseData
      const defaultResult = { isSalaryCertificate: true, confidence: 0, recommendation: 'review' }
      const safeData = data && typeof data === 'object' && !Array.isArray(data) ? { ...defaultResult, ...data } : defaultResult
      setSalaryCertAnalysis(safeData)
      const isCert = safeData.isSalaryCertificate !== false
      const confidence = Number(safeData.confidence) || 0
      if (isCert && confidence > 50) {
        toast.success(t('form.salaryCert.verified', language), { description: t('form.salaryCert.verifiedDesc', language) })
      } else if (isCert) {
        toast.info(t('form.salaryCert.needsReview', language), { description: t('form.salaryCert.needsReviewDesc', language) })
      } else {
        toast.error(t('form.salaryCert.notDetected', language), { description: t('form.salaryCert.notDetectedDesc', language) })
      }

      // Auto-fill form fields from extracted salary certificate data
      if (safeData.extractedFields) {
        const fields = safeData.extractedFields as Record<string, unknown>
        // If employer type extracted, update mock extra data indirectly
        if (fields.totalSalary && Number(fields.totalSalary) > 0) {
          // We can't directly set mockExtraData, but the extracted data is shown in the UI
        }
      }
    } catch (err) {
      toast.error(t('form.salaryCert.analysisFailed', language), { description: err instanceof Error ? err.message : t('form.salaryCert.analysisFailedDesc', language) })
    } finally {
      setIsAnalyzingSalaryCert(false)
    }
  }

  // ─── AI Medical Report Analysis ────────────────────────
  const runMedicalReportAnalysis = async (fileName: string) => {
    setIsAnalyzingMedicalReport(true)
    setMedicalReportAnalysis(null)
    try {
      const res = await authFetch('/api/analyze-medical-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName, language }),
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Medical report analysis failed')
      }
      const responseData = await res.json()
      const data = responseData?.data && typeof responseData.data === 'object' && !Array.isArray(responseData.data) ? responseData.data : responseData
      const defaultResult = { isMedicalReport: true, confidence: 0, recommendation: 'review' }
      const safeData = data && typeof data === 'object' && !Array.isArray(data) ? { ...defaultResult, ...data } : defaultResult
      setMedicalReportAnalysis(safeData)
      const isReport = safeData.isMedicalReport !== false
      const confidence = Number(safeData.confidence) || 0
      if (isReport && confidence > 50) {
        toast.success(t('form.medicalReport.verified', language))
      } else if (isReport) {
        toast.info(t('form.medicalReport.needsReview', language))
      } else {
        toast.error(t('form.medicalReport.rejected', language))
      }
    } catch (err) {
      toast.error(t('form.salaryCert.analysisFailed', language), { description: err instanceof Error ? err.message : 'Medical report analysis failed' })
    } finally {
      setIsAnalyzingMedicalReport(false)
    }
  }

  // ─── Salary-Bank Cross-Check ──────────────────────────
  const runSalaryBankCrossCheck = async () => {
    if (!salaryCertAnalysis) return
    setIsCrossChecking(true)
    try {
      const bankFiles = uploadedFiles.filter(f => f.docType === 'bank_statement')
      const res = await authFetch('/api/cross-check-salary-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salaryCertData: salaryCertAnalysis,
          bankStatementFiles: bankFiles.map(f => f.storedName),
          language,
        }),
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Cross-check failed')
      }
      const responseData = await res.json()
      const data = responseData?.data && typeof responseData.data === 'object' && !Array.isArray(responseData.data) ? responseData.data : responseData
      const safeData = data && typeof data === 'object' && !Array.isArray(data) ? data : {}
      setSalaryBankCrossCheck(safeData)
    } catch (err) {
      toast.error(t('form.salaryCert.analysisFailed', language), { description: err instanceof Error ? err.message : 'Cross-check failed' })
      setSalaryBankCrossCheck({ error: true, message: err instanceof Error ? err.message : 'Cross-check failed' })
    } finally {
      setIsCrossChecking(false)
    }
  }

  // Auto-trigger cross-check when both salary cert and bank statement are available
  useEffect(() => {
    const hasBankStatement = uploadedFiles.some(f => f.docType === 'bank_statement')
    if (salaryCertAnalysis && hasBankStatement && !salaryBankCrossCheck && !isCrossChecking) {
      runSalaryBankCrossCheck()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salaryCertAnalysis, uploadedFiles])

  // ─── Submit ────────────────────────────────────────────
  const onSubmit = async () => {
    setIsSubmitting(true)
    try {
      const values = form.getValues()
      // Direct mapping: requestType is the primary category (no lossy conversion)
      // Only UAE PASS and Salary Certificate are mandatory — all other fields optional
      const payload = {
        applicant: {
          emiratesId: values.emiratesId || '',
          nameEn: values.nameEn || null,
          nameAr: values.nameAr || '',
          phone: values.phone || '',
          email: values.email || null,
          monthlyIncome: mockExtraData?.monthlyIncome || 0,
          employer: mockExtraData?.employer || null,
          employerType: mockExtraData?.employerType || null,
          familySize: mockExtraData?.familySize ?? 1,
          hasFamilyBook: mockExtraData?.nationalityEN === 'Emirati',
        },
        loan: selectedLoanDetails ? {
          originalAmount: selectedLoanDetails.originalAmount,
          remainingBalance: selectedLoanDetails.remainingBalance,
          monthlyInstallment: selectedLoanDetails.monthlyInstallment,
          loanDurationMonths: selectedLoanDetails.loanDurationMonths,
          elapsedMonths: selectedLoanDetails.elapsedMonths,
          loanType: selectedLoanDetails.loanType,
          totalOverdue: selectedLoanDetails.totalOverdue,
          missedMonths: selectedLoanDetails.missedMonths,
          delayDays: selectedLoanDetails.delayDays,
        } : {
          originalAmount: 0,
          remainingBalance: 0,
          monthlyInstallment: 0,
          loanDurationMonths: 0,
          elapsedMonths: 0,
          loanType: 'housing_loan',
          totalOverdue: 0,
          missedMonths: 0,
          delayDays: 0,
        },
        request: {
          requestedDurationMonths: 120,
          reason: values.reason || '',
          reasonCategory: values.requestType || 'other',
          priority: 'normal',
          supportingDocuments: uploadedFiles.map(f => f.docType || f.originalName),
          notes: values.housingAssistanceNumber ? `Housing Assistance Number: ${values.housingAssistanceNumber}` : '',
          uploadedFiles,
          housingAssistanceNumber: values.housingAssistanceNumber || '',
          requestType: values.requestType || null,
          salaryCertAnalysis: salaryCertAnalysis || null,
        },
      }
      const res = await authFetch('/api/requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) { const errorData = await res.json().catch(() => ({})); throw new Error(errorData.error || 'Failed to submit request') }
      toast.success(t('form.submitSuccess', language), { description: t('form.submitSuccessDesc', language) })
      onSuccess()
    } catch (err) {
      toast.error(t('form.submitFail', language), { description: err instanceof Error ? err.message : t('form.submitFailDesc', language) })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmitRequest = async () => {
    // Mandatory checks: UAE PASS authentication, Housing Assistance File, Salary Certificate
    
    // 1. UAE PASS is mandatory
    if (!isUAEPassLocked) {
      toast.error(t('form.validationError', language), { description: t('form.uaepass.signInPrompt', language) })
      setCurrentStep(1)
      return
    }

    // 2. Housing Assistance File is mandatory
    const han = form.getValues('housingAssistanceNumber')
    if (!han || han.trim() === '') {
      toast.error(t('form.validationError', language), { description: isAr ? 'يرجى اختيار ملف المساعدة السكنية أو إدخال رقمه' : 'Please select a housing assistance file or enter its number' })
      setCurrentStep(2)
      return
    }

    // UAE PASS Integrity Check (still validate integrity of auto-filled data)
    if (uaepassOriginalValues.current) {
      const current = form.getValues()
      const original = uaepassOriginalValues.current
      const mismatches: string[] = []
      if (current.emiratesId !== original.emiratesId) mismatches.push('Emirates ID')
      if ((current.nameEn || '') !== original.nameEn) mismatches.push('Name (EN)')
      if (current.nameAr !== original.nameAr) mismatches.push('Name (AR)')
      if (current.phone !== original.phone) mismatches.push('Phone')
      if ((current.email || '') !== original.email) mismatches.push('Email')

      if (mismatches.length > 0) {
        toast.error(t('form.uaepass.integrityFail', language), { description: t('form.uaepass.integrityFailDesc', language), duration: 6000 })
        form.setValue('emiratesId', original.emiratesId, { shouldValidate: true })
        form.setValue('nameEn', original.nameEn, { shouldValidate: true })
        form.setValue('nameAr', original.nameAr, { shouldValidate: true })
        form.setValue('phone', original.phone, { shouldValidate: true })
        form.setValue('email', original.email, { shouldValidate: true })
        return
      }

      try {
        const verifyRes = await authFetch('/api/verify-identity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ original: uaepassOriginalValues.current, current: { emiratesId: current.emiratesId, nameEn: current.nameEn || '', nameAr: current.nameAr, phone: current.phone, email: current.email || '' } }),
        })
        if (!verifyRes.ok) {
          const errData = await verifyRes.json().catch(() => ({}))
          toast.error(t('form.uaepass.integrityFail', language), { description: errData.error || t('form.uaepass.integrityFailDesc', language), duration: 6000 })
          form.setValue('emiratesId', original.emiratesId, { shouldValidate: true })
          form.setValue('nameEn', original.nameEn, { shouldValidate: true })
          form.setValue('nameAr', original.nameAr, { shouldValidate: true })
          form.setValue('phone', original.phone, { shouldValidate: true })
          form.setValue('email', original.email, { shouldValidate: true })
          return
        }
      } catch {
        console.warn('Backend identity verification failed (network error), proceeding with client-only check')
      }
    }

    // 2. Salary Certificate is mandatory
    const currentSalaryCerts = uploadedFiles.filter(f => f.docType === 'salary_certificate')
    if (currentSalaryCerts.length === 0) {
      setCurrentStep(3)
      toast.error(t('form.validationError', language), { description: t('form.salaryCertificate', language) + ' ' + (isAr ? 'مطلوب' : 'is required') })
      return
    }

    // All other fields are optional — proceed with submission
    await onSubmit()
  }

  // ─── MOEI Step Indicator ────────────────────────────────
  const renderStepIndicator = () => (
    <div className="mb-8">
      <div className="flex items-center justify-center">
        {MOEI_STEPS.map((step, index) => {
          const StepIcon = step.icon
          const isActive = currentStep === step.id
          const isCompleted = currentStep > step.id
          return (
            <div key={step.id} className="flex items-center">
              <button
                type="button"
                onClick={() => handleGoToStep(step.id)}
                className={cn(
                  'flex flex-col items-center gap-1.5 transition-all',
                  isCompleted && 'cursor-pointer'
                )}
              >
                <div
                  className={cn(
                    'w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-md',
                    isActive && 'ring-4 ring-amber-200',
                    isCompleted && 'ring-2 ring-green-200'
                  )}
                  style={{
                    backgroundColor: isCompleted ? MOEI_GREEN : isActive ? MOEI_GOLD : '#E5E7EB',
                  }}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-5 h-5 text-white" />
                  ) : (
                    <StepIcon className="w-5 h-5 text-white" />
                  )}
                </div>
                <span className={cn(
                  'text-[10px] sm:text-xs font-medium text-center max-w-[80px] sm:max-w-[100px] leading-tight',
                  isActive ? 'text-amber-800' : isCompleted ? 'text-green-700' : 'text-gray-400'
                )}>
                  {t(step.titleKey, language)}
                </span>
              </button>
              {index < MOEI_STEPS.length - 1 && (
                <div className={cn(
                  'w-8 sm:w-16 h-0.5 mx-2 transition-colors rounded-full',
                  currentStep > step.id ? 'bg-green-400' : 'bg-gray-200'
                )} />
              )}
            </div>
          )
        })}
      </div>
      {/* Step description */}
      <motion.p
        key={currentStep}
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-4 text-center text-sm text-gray-500"
      >
        {t('form.step', language)} {currentStep} {t('form.of', language)} {MOEI_STEPS.length} — {t(MOEI_STEPS[currentStep - 1].descKey, language)}
      </motion.p>
    </div>
  )

  // ─── MOEI-styled field wrapper ──────────────────────────
  const RequiredStar = () => <span className="text-red-500 ms-0.5">*</span>

  const moeiInputClass = cn(
    'rounded-lg border-gray-200 focus:border-amber-400 focus:ring-amber-400/30',
    'transition-all duration-200'
  )

  // ─── Identity info row component ──────────────────────
  const IdentityRow = ({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) => (
    <div className="flex items-center gap-2 py-1.5">
      {icon && <span className="text-gray-400 shrink-0">{icon}</span>}
      <span className="text-xs text-gray-500 shrink-0 min-w-[80px]">{label}</span>
      <span className="text-sm font-medium text-gray-800 flex-1 text-end" dir={isAr ? 'rtl' : 'ltr'}>{value || '--'}</span>
    </div>
  )

  // ─── Step 1: UAE PASS Authentication ──────────────────────
  const renderStep1 = () => (
    <motion.div
      key="step1"
      initial={{ opacity: 0, x: isAr ? -20 : 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: isAr ? 20 : -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* UAE PASS Login Banner (when not authenticated as citizen) */}
      {!isCitizenUAEPass && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/50 p-6"
        >
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: '#3F8E50' }}>
              <Fingerprint className="w-8 h-8 text-white" />
            </div>
            <div>
              <p className="font-bold text-gray-800 text-lg">{t('form.uaepass.signInPrompt', language)}</p>
              <p className="text-sm text-gray-500 mt-1">{t('form.uaepass.signInPromptDesc', language)}</p>
            </div>
            <Button
              type="button"
              onClick={() => setShowUAEPassDialog(true)}
              className="text-white font-semibold rounded-lg px-8 h-11"
              style={{ backgroundColor: '#3F8E50' }}
            >
              <Fingerprint className="w-5 h-5 me-2" />
              {t('form.uaepass.button', language)}
            </Button>
          </div>
        </motion.div>
      )}

      {/* Identity Card (when authenticated as citizen) */}
      {isCitizenUAEPass && userProfile && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {/* Verified Banner */}
          <div className="rounded-xl border border-green-200 bg-green-50 p-3 flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-green-600 shrink-0" />
            <p className="text-sm text-green-700 flex-1">
              {t('form.uaepass.authenticated', language)} — {isAr && userProfile.fullnameAR ? userProfile.fullnameAR : userProfile.fullnameEN}
            </p>
            <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">
              {t('form.uaepass.verified', language)}
            </Badge>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleDisconnectUAEPass}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 h-7 px-2 text-xs gap-1"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('form.uaepass.disconnect', language)}</span>
            </Button>
          </div>

          {/* Identity Card */}
          <Card className="rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4" style={{ backgroundColor: `${MOEI_GOLD}15` }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User className="w-5 h-5" style={{ color: MOEI_GOLD }} />
                  <h3 className="font-bold text-gray-800">{t('form.identityCard', language)}</h3>
                </div>
                <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px] gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  {t('form.uaepass.verified', language)}
                </Badge>
              </div>
            </div>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1">
                <IdentityRow
                  label={t('form.emiratesId', language)}
                  value={formatEmiratesId(userProfile.idn || '')}
                  icon={<Fingerprint className="w-3.5 h-3.5" />}
                />
                <IdentityRow
                  label={t('form.phone', language)}
                  value={userProfile.mobile ? normalizePhoneNumber(userProfile.mobile.replace('+971', '0')) : ''}
                  icon={<span className="text-xs">📱</span>}
                />
                <IdentityRow
                  label={t('form.fullNameEn', language)}
                  value={userProfile.fullnameEN || ''}
                  icon={<User className="w-3.5 h-3.5" />}
                />
                <IdentityRow
                  label={t('form.fullNameAr', language)}
                  value={userProfile.fullnameAR || ''}
                  icon={<User className="w-3.5 h-3.5" />}
                />
                <IdentityRow
                  label={t('form.email', language)}
                  value={userProfile.email || ''}
                  icon={<span className="text-xs">✉</span>}
                />
                <IdentityRow
                  label={t('form.nationality', language)}
                  value={mockExtraData?.nationalityEN || '--'}
                  icon={<Globe2 className="w-3.5 h-3.5" />}
                />
                <IdentityRow
                  label={t('form.dateOfBirth', language)}
                  value={mockExtraData?.dob || '--'}
                  icon={<Calendar className="w-3.5 h-3.5" />}
                />
                <IdentityRow
                  label={t('form.gender', language)}
                  value={mockExtraData?.gender === 'male' ? t('form.male', language) : mockExtraData?.gender === 'female' ? t('form.female', language) : '--'}
                  icon={<User className="w-3.5 h-3.5" />}
                />
              </div>

              {/* Lock notice */}
              <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-2">
                <Lock className="w-4 h-4 text-green-600" />
                <p className="text-xs text-gray-500">{t('form.uaepass.locked', language)}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

    </motion.div>
  )

  // ─── Step 2: Housing Assistance Details ────────────────────
  const renderStep2 = () => (
    <motion.div
      key="step2"
      initial={{ opacity: 0, x: isAr ? -20 : 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: isAr ? 20 : -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <Card className="rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4" style={{ backgroundColor: `${MOEI_GOLD}15` }}>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5" style={{ color: MOEI_GOLD }} />
            <h3 className="font-bold text-gray-800">{t('moei.step2.title', language)}</h3>
          </div>
        </div>
        <CardContent className="p-6 space-y-5">
          {/* Smart Housing Assistance Selection */}
          <FormField
            control={form.control}
            name="housingAssistanceNumber"
            render={({ field }) => {
              const mockFiles = isCitizenUAEPass && userProfile?.idn ? MOCK_HOUSING_ASSISTANCE_FILES[userProfile.idn] || [] : []
              const showDropdown = mockFiles.length > 0
              const isManualEntry = field.value && !mockFiles.some(f => f.housingAssistanceNumber === field.value) && field.value !== ''
              const isOtherSelected = field.value === 'other' || isManualEntry

              return (
                <FormItem>
                  <FormLabel className="text-gray-700 font-medium">
                    {t('form.housingAssistanceNumber', language)}
                    <Badge className="ms-2 text-[9px] bg-red-50 text-red-600 border-red-200 h-4 px-1.5">
                      *
                    </Badge>
                  </FormLabel>
                  
                  {showDropdown ? (
                    <div className="space-y-3">
                      <Select 
                        value={isOtherSelected ? 'other' : field.value} 
                        onValueChange={(val) => {
                          if (val === 'other') {
                            field.onChange('')
                            setSelectedLoanDetails(null)
                          } else {
                            field.onChange(val)
                            const file = mockFiles.find(f => f.housingAssistanceNumber === val)
                            if (file) setSelectedLoanDetails(file)
                          }
                        }}
                      >
                        <FormControl>
                          <SelectTrigger className={moeiInputClass}>
                            <SelectValue placeholder={isAr ? 'اختر ملف المساعدة السكنية' : 'Select your housing assistance file'} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {mockFiles.map(file => (
                            <SelectItem key={file.housingAssistanceNumber} value={file.housingAssistanceNumber}>
                              {file.housingAssistanceNumber} ({isAr ? 'قرض نشط' : 'Active Loan'})
                            </SelectItem>
                          ))}
                          <SelectItem key="other" value="other">{isAr ? 'أخرى (إدخال يدوي)' : 'Other (Enter manually)'}</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      {isOtherSelected && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                          <FormControl>
                            <Input
                              placeholder={isAr ? 'أدخل رقم طلب المساعدة السكنية' : 'e.g. SZHP-2024-12345'}
                              className={moeiInputClass}
                              value={field.value !== 'other' ? field.value : ''}
                              onChange={(e) => {
                                field.onChange(e.target.value)
                                setSelectedLoanDetails(null)
                              }}
                            />
                          </FormControl>
                        </motion.div>
                      )}
                    </div>
                  ) : (
                    <FormControl>
                      <Input
                        placeholder={isAr ? 'أدخل رقم طلب المساعدة السكنية' : 'e.g. SZHP-2024-12345'}
                        className={moeiInputClass}
                        {...field}
                        onChange={(e) => {
                          field.onChange(e)
                          setSelectedLoanDetails(null)
                        }}
                      />
                    </FormControl>
                  )}
                  <p className="text-xs text-gray-400">{t('form.housingAssistanceNumberDesc', language)}</p>
                  <FormMessage />

                  {/* Smart Summary Card */}
                  <AnimatePresence>
                    {selectedLoanDetails && field.value === selectedLoanDetails.housingAssistanceNumber && (
                      <motion.div
                        initial={{ opacity: 0, y: -10, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-3 overflow-hidden"
                      >
                        <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 relative overflow-hidden">
                          <div className="absolute top-0 left-0 w-1 h-full bg-blue-400" />
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <Database className="w-4 h-4 text-blue-600" />
                              <span className="text-sm font-semibold text-blue-900">{isAr ? 'بيانات القرض المسترجعة' : 'Retrieved Loan Data'}</span>
                            </div>
                            <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-[10px]">
                              {isAr ? 'موثق' : 'Verified'}
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-white rounded-lg p-2.5 shadow-sm border border-blue-50">
                              <p className="text-[10px] text-gray-500 mb-0.5">{isAr ? 'المبلغ المتبقي' : 'Remaining Balance'}</p>
                              <p className="text-sm font-bold text-gray-900">{formatCurrency(selectedLoanDetails.remainingBalance)}</p>
                            </div>
                            <div className="bg-white rounded-lg p-2.5 shadow-sm border border-blue-50">
                              <p className="text-[10px] text-gray-500 mb-0.5">{isAr ? 'القسط الشهري' : 'Monthly Installment'}</p>
                              <p className="text-sm font-bold text-gray-900">{formatCurrency(selectedLoanDetails.monthlyInstallment)}</p>
                            </div>
                            <div className="bg-white rounded-lg p-2.5 shadow-sm border border-blue-50">
                              <p className="text-[10px] text-gray-500 mb-0.5">{isAr ? 'تاريخ الإصدار' : 'Issue Date'}</p>
                              <p className="text-sm font-bold text-gray-900">{selectedLoanDetails.issueDate}</p>
                            </div>
                            <div className="bg-white rounded-lg p-2.5 shadow-sm border border-blue-50">
                              <p className="text-[10px] text-gray-500 mb-0.5">{isAr ? 'المتأخرات' : 'Total Overdue'}</p>
                              <p className={cn("text-sm font-bold", selectedLoanDetails.totalOverdue > 0 ? "text-red-600" : "text-green-600")}>
                                {formatCurrency(selectedLoanDetails.totalOverdue)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </FormItem>
              )
            }}
          />

          {/* Request Type */}
          <FormField
            control={form.control}
            name="requestType"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-gray-700 font-medium">
                  {t('form.requestType', language)}
                    <Badge className="ms-2 text-[9px] bg-amber-50 text-amber-700 border-amber-200 h-4 px-1.5">
                      {isAr ? 'افتراضي: جدولة المتأخرات' : 'Default: Reschedule Arrears'}
                    </Badge>
                </FormLabel>
                <Select onValueChange={field.onChange} value={field.value || 'reschedule_arrears'}>
                  <FormControl>
                    <SelectTrigger className="rounded-lg border-gray-200">
                      <SelectValue placeholder={t('form.selectRequestType', language)} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {REQUEST_TYPES.map((rt) => (
                      <SelectItem key={rt.value} value={rt.value}>
                        {t(rt.labelKey, language)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Eligibility Criteria based on request type */}
          {requestType && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3"
            >
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4" style={{ color: MOEI_GOLD }} />
                <h4 className="font-semibold text-gray-800 text-sm">{t('form.eligibilityCriteria', language)}</h4>
              </div>

              {/* Specific criteria for selected type */}
              <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: MOEI_GOLD }}>
                    <CheckCircle2 className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800">
                      {t(REQUEST_TYPES.find(rt => rt.value === requestType)?.labelKey || '', language)}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      {t(REQUEST_TYPES.find(rt => rt.value === requestType)?.criteriaKey || '', language)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Common conditions */}
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                  <span>{t('form.oncePerYear', language)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Landmark className="w-4 h-4 text-gray-400 shrink-0" />
                  <span>{t('form.processingTime', language)}</span>
                </div>
              </div>
            </motion.div>
          )}

          {/* Reason for Request */}
          <FormField
            control={form.control}
            name="reason"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-gray-700 font-medium">
                  {t('form.reason', language)}
                  <Badge className="ms-2 text-[9px] bg-gray-50 text-gray-500 border-gray-200 h-4 px-1.5">
                    {t('form.optional', language)}
                  </Badge>
                </FormLabel>
                <FormControl>
                  <textarea
                    placeholder={isAr
                      ? 'اشرح سبب طلب إعادة الجدولة، على سبيل المثال: انخفاض الدخل، فقدان الوظيفة، التزامات طبية...'
                      : 'Explain why you need rescheduling, e.g. income decrease, job loss, medical obligations...'}
                    className={cn(
                      moeiInputClass,
                      'w-full min-h-[100px] resize-y rounded-lg border border-gray-200 bg-background px-3 py-2 text-sm',
                      'placeholder:text-gray-400 focus:border-amber-400 focus:ring-amber-400/30 focus:outline-none focus:ring-2'
                    )}
                    {...field}
                  />
                </FormControl>
                <p className="text-xs text-gray-400">{t('form.reasonDesc', language)}</p>
                <FormMessage />
              </FormItem>
            )}
          />
          {/* ── Family & Income Details (MOEI) ── */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-4 h-4" style={{ color: MOEI_GOLD }} />
              <h4 className="font-semibold text-gray-800 text-sm">{t('form.section.familyIncome', language)}</h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Marital Status */}
              <FormField
                control={form.control}
                name="maritalStatus"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-700 font-medium text-sm">{t('form.maritalStatus', language)}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className={moeiInputClass}>
                          <SelectValue placeholder={t('form.maritalStatus.placeholder', language)} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="single">{t('form.maritalStatus.single', language)}</SelectItem>
                        <SelectItem value="married">{t('form.maritalStatus.married', language)}</SelectItem>
                        <SelectItem value="divorced">{t('form.maritalStatus.divorced', language)}</SelectItem>
                        <SelectItem value="widowed">{t('form.maritalStatus.widowed', language)}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Spouse Income (shown only if married) */}
              {maritalStatus === 'married' && (
              <FormField
                control={form.control}
                name="spouseIncome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-700 font-medium text-sm">
                      {t('form.spouseIncome', language)}
                      <span className="text-xs text-gray-400 ms-1">({t('form.optional', language)})</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder={t('form.spouseIncome.placeholder', language)}
                        className={moeiInputClass}
                        {...field}
                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                      />
                    </FormControl>
                    <p className="text-[10px] text-gray-400">{t('form.spouseIncome.hint', language)}</p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              )}

              {/* Number of Children */}
              <FormField
                control={form.control}
                name="numberOfChildren"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-700 font-medium text-sm">{t('form.numberOfChildren', language)}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder={t('form.numberOfChildren.placeholder', language)}
                        className={moeiInputClass}
                        {...field}
                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Housing Type */}
              <FormField
                control={form.control}
                name="housingType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-700 font-medium text-sm">{t('form.housingType', language)}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className={moeiInputClass}>
                          <SelectValue placeholder={t('form.housingType.placeholder', language)} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="apartment">{t('form.housingType.apartment', language)}</SelectItem>
                        <SelectItem value="villa">{t('form.housingType.villa', language)}</SelectItem>
                        <SelectItem value="land">{t('form.housingType.land', language)}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Income Stability */}
              <FormField
                control={form.control}
                name="incomeStability"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-700 font-medium text-sm">{t('form.incomeStability', language)}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className={moeiInputClass}>
                          <SelectValue placeholder={t('form.incomeStability.placeholder', language)} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="stable">{t('form.incomeStability.stable', language)}</SelectItem>
                        <SelectItem value="reduced">{t('form.incomeStability.reduced', language)}</SelectItem>
                        <SelectItem value="lost">{t('form.incomeStability.lost', language)}</SelectItem>
                        <SelectItem value="variable">{t('form.incomeStability.variable', language)}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Previous Income (shown only if income is reduced or lost) */}
              {(incomeStability === 'reduced' || incomeStability === 'lost') && (
              <FormField
                control={form.control}
                name="previousIncome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-700 font-medium text-sm">
                      {t('form.previousIncome', language)}
                      <span className="text-xs text-gray-400 ms-1">({t('form.optional', language)})</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder={t('form.previousIncome.placeholder', language)}
                        className={moeiInputClass}
                        {...field}
                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                      />
                    </FormControl>
                    <p className="text-[10px] text-gray-400">{t('form.previousIncome.hint', language)}</p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )

  // ─── Step 3: Documents & AI Review ────────────────────────
  const renderStep3 = () => {
    const salaryCertFiles = uploadedFiles.filter(f => f.docType === 'salary_certificate')
    const bankStatementFiles = uploadedFiles.filter(f => f.docType === 'bank_statement')
    const medicalReportFiles = uploadedFiles.filter(f => f.docType === 'medical_report')
    const reschedulingFiles = uploadedFiles.filter(f => f.docType === 'rescheduling_agreement')
    const additionalFiles = uploadedFiles.filter(f => f.docType === 'additional' || (!f.docType))
    const needsReschedulingAgreement = requestType === 'reschedule_arrears'
    const hasSalaryCert = salaryCertFiles.length > 0
    const hasBankStatement = bankStatementFiles.length > 0
    const hasMedicalReport = medicalReportFiles.length > 0
    const hasReschedulingAgreement = !needsReschedulingAgreement || reschedulingFiles.length > 0

    return (
      <motion.div
        key="step3"
        initial={{ opacity: 0, x: isAr ? -20 : 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: isAr ? 20 : -20 }}
        transition={{ duration: 0.3 }}
        className="space-y-6"
      >
        {/* Document Uploads */}
        <Card className="rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4" style={{ backgroundColor: `${MOEI_GOLD}15` }}>
            <div className="flex items-center gap-2">
              <Upload className="w-5 h-5" style={{ color: MOEI_GOLD }} />
              <h3 className="font-bold text-gray-800">{t('form.upload.title', language)}</h3>
            </div>
          </div>
          <CardContent className="p-6 space-y-5">
            {/* Salary Certificate Upload */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-500" />
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    {t('form.salaryCertificate', language)} <RequiredStar />
                  </p>
                  <p className="text-xs text-gray-500">{t('form.salaryCertificateDesc', language)}</p>
                </div>
              </div>

              {/* Salary cert file list */}
              {salaryCertFiles.length > 0 && (
                <div className="space-y-2">
                  {salaryCertFiles.map((file) => (
                    <div key={file.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-green-100 bg-green-50/50">
                      <FileText className="w-4 h-4 text-green-600 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-700 truncate">{file.originalName}</p>
                        <p className="text-xs text-gray-400">{formatFileSize(file.size)}</p>
                      </div>
                      <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(file.id, file.storedName)}
                        className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const input = document.createElement('input')
                  input.type = 'file'
                  input.accept = '.pdf,.jpg,.jpeg,.png,.webp,.doc,.docx'
                  input.onchange = (e) => {
                    const files = (e.target as HTMLInputElement).files
                    if (files) {
                      // Auto-trigger AI analysis after salary cert upload (if AI analysis is enabled)
                      handleFileUpload(
                        files,
                        'salary_certificate',
                        aiAnalysisMode !== 'off'
                          ? (uploadedFile) => {
                              // Small delay to let state settle, then trigger analysis
                              setTimeout(() => {
                                runSalaryCertAnalysis(uploadedFile.storedName)
                              }, 300)
                            }
                          : undefined
                      )
                    }
                  }
                  input.click()
                }}
                disabled={isUploading}
                className={cn(
                  'w-full h-20 border-2 border-dashed rounded-xl transition-colors',
                  hasSalaryCert
                    ? 'border-green-300 bg-green-50/30 hover:bg-green-50 text-green-700'
                    : 'border-amber-300 bg-amber-50/30 hover:bg-amber-50 text-amber-700'
                )}
              >
                {isUploading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : hasSalaryCert ? (
                  <div className="flex flex-col items-center gap-1">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="text-xs">{t('form.upload.uploaded', language)} — {t('form.upload.dropzone', language)}</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <Upload className="w-5 h-5" />
                    <span className="text-xs">{t('form.upload.dropzone', language)}</span>
                  </div>
                )}
              </Button>
            </div>

            {/* Bank Statement Upload */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-500" />
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    {t('form.bankStatement', language)}
                    <Badge className="ms-2 text-[9px] bg-gray-50 text-gray-500 border-gray-200 h-4 px-1.5">
                      {t('form.additionalDocs.optional', language)}
                    </Badge>
                  </p>
                  <p className="text-xs text-gray-500">{t('form.bankStatementDesc', language)}</p>
                </div>
              </div>

              {/* Bank statement file list */}
              {bankStatementFiles.length > 0 && (
                <div className="space-y-2">
                  {bankStatementFiles.map((file) => (
                    <div key={file.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-blue-100 bg-blue-50/50">
                      <Building2 className="w-4 h-4 text-blue-600 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-700 truncate">{file.originalName}</p>
                        <p className="text-xs text-gray-400">{formatFileSize(file.size)}</p>
                      </div>
                      <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(file.id, file.storedName)}
                        className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const input = document.createElement('input')
                  input.type = 'file'
                  input.accept = '.pdf,.jpg,.jpeg,.png,.webp,.doc,.docx'
                  input.multiple = true
                  input.onchange = (e) => {
                    const files = (e.target as HTMLInputElement).files
                    if (files) handleFileUpload(files, 'bank_statement')
                  }
                  input.click()
                }}
                disabled={isUploading}
                className={cn(
                  'w-full h-20 border-2 border-dashed rounded-xl transition-colors',
                  hasBankStatement
                    ? 'border-blue-300 bg-blue-50/30 hover:bg-blue-50 text-blue-700'
                    : 'border-blue-300 bg-blue-50/30 hover:bg-blue-50 text-blue-700'
                )}
              >
                {isUploading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : hasBankStatement ? (
                  <div className="flex flex-col items-center gap-1">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="text-xs">{t('form.upload.uploaded', language)} — {t('form.upload.dropzone', language)}</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <Building2 className="w-5 h-5" />
                    <span className="text-xs">{t('form.upload.dropzone', language)}</span>
                  </div>
                )}
              </Button>
            </div>

            {/* Rescheduling Agreement Upload (only for reschedule type) */}
            {needsReschedulingAgreement && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-gray-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {t('form.reschedulingAgreement', language)}
                      <Badge className="ms-2 text-[9px] bg-gray-50 text-gray-500 border-gray-200 h-4 px-1.5">
                        {t('form.additionalDocs.optional', language)}
                      </Badge>
                    </p>
                    <p className="text-xs text-gray-500">{t('form.reschedulingAgreementDesc', language)}</p>
                  </div>
                </div>

                {reschedulingFiles.length > 0 && (
                  <div className="space-y-2">
                    {reschedulingFiles.map((file) => (
                      <div key={file.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-green-100 bg-green-50/50">
                        <FileText className="w-4 h-4 text-green-600 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-700 truncate">{file.originalName}</p>
                          <p className="text-xs text-gray-400">{formatFileSize(file.size)}</p>
                        </div>
                        <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                        <button
                          type="button"
                          onClick={() => handleRemoveFile(file.id, file.storedName)}
                          className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const input = document.createElement('input')
                    input.type = 'file'
                    input.accept = '.pdf,.jpg,.jpeg,.png,.webp,.doc,.docx'
                    input.onchange = (e) => {
                      const files = (e.target as HTMLInputElement).files
                      if (files) handleFileUpload(files, 'rescheduling_agreement')
                    }
                    input.click()
                  }}
                  disabled={isUploading}
                  className={cn(
                    'w-full h-20 border-2 border-dashed rounded-xl transition-colors',
                    hasReschedulingAgreement
                      ? 'border-green-300 bg-green-50/30 hover:bg-green-50 text-green-700'
                      : 'border-amber-300 bg-amber-50/30 hover:bg-amber-50 text-amber-700'
                  )}
                >
                  {isUploading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : hasReschedulingAgreement ? (
                    <div className="flex flex-col items-center gap-1">
                      <CheckCircle2 className="w-5 h-5" />
                      <span className="text-xs">{t('form.upload.uploaded', language)} — {t('form.upload.dropzone', language)}</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <Upload className="w-5 h-5" />
                      <span className="text-xs">{t('form.upload.dropzone', language)}</span>
                    </div>
                  )}
                </Button>
              </div>
            )}

            {/* Medical Report Upload */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-rose-500" />
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    {t('form.medicalReport', language)}
                    <Badge className="ms-2 text-[9px] bg-rose-50 text-rose-600 border-rose-200 h-4 px-1.5">
                      {t('form.additionalDocs.optional', language)}
                    </Badge>
                  </p>
                  <p className="text-xs text-gray-500">{t('form.medicalReportDesc', language)}</p>
                </div>
              </div>

              {/* Medical report file list */}
              {medicalReportFiles.length > 0 && (
                <div className="space-y-2">
                  {medicalReportFiles.map((file) => (
                    <div key={file.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-rose-100 bg-rose-50/50">
                      <Heart className="w-4 h-4 text-rose-600 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-700 truncate">{file.originalName}</p>
                        <p className="text-xs text-gray-400">{formatFileSize(file.size)}</p>
                      </div>
                      <CheckCircle2 className="w-4 h-4 text-rose-600 shrink-0" />
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(file.id, file.storedName)}
                        className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const input = document.createElement('input')
                  input.type = 'file'
                  input.accept = '.pdf,.jpg,.jpeg,.png,.webp,.doc,.docx'
                  input.onchange = (e) => {
                    const files = (e.target as HTMLInputElement).files
                    if (files) {
                      handleFileUpload(files, 'medical_report', (uploadedFile) => {
                        setTimeout(() => {
                          runMedicalReportAnalysis(uploadedFile.storedName)
                        }, 300)
                      })
                    }
                  }
                  input.click()
                }}
                disabled={isUploading}
                className={cn(
                  'w-full h-20 border-2 border-dashed rounded-xl transition-colors',
                  hasMedicalReport
                    ? 'border-rose-300 bg-rose-50/30 hover:bg-rose-50 text-rose-700'
                    : 'border-rose-300 bg-rose-50/30 hover:bg-rose-50 text-rose-700'
                )}
              >
                {isUploading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : hasMedicalReport ? (
                  <div className="flex flex-col items-center gap-1">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="text-xs">{t('form.upload.uploaded', language)} — {t('form.upload.dropzone', language)}</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <Heart className="w-5 h-5" />
                    <span className="text-xs">{t('form.upload.dropzone', language)}</span>
                  </div>
                )}
              </Button>
            </div>

            {/* Additional Documents Upload (Optional) */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-gray-500" />
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    {t('form.additionalDocs.title', language)}
                    <Badge className="ms-2 text-[9px] bg-gray-50 text-gray-500 border-gray-200 h-4 px-1.5">
                      {t('form.additionalDocs.optional', language)}
                    </Badge>
                  </p>
                  <p className="text-xs text-gray-500">{t('form.additionalDocs.desc', language)}</p>
                </div>
              </div>

              {/* Additional files list */}
              {additionalFiles.length > 0 && (
                <div className="space-y-2">
                  {additionalFiles.map((file) => (
                    <div key={file.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-blue-100 bg-blue-50/50">
                      <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-700 truncate">{file.originalName}</p>
                        <p className="text-xs text-gray-400">{formatFileSize(file.size)}</p>
                      </div>
                      <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(file.id, file.storedName)}
                        className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const input = document.createElement('input')
                  input.type = 'file'
                  input.accept = '.pdf,.jpg,.jpeg,.png,.webp,.doc,.docx'
                  input.multiple = true
                  input.onchange = (e) => {
                    const files = (e.target as HTMLInputElement).files
                    if (files) handleFileUpload(files, 'additional')
                  }
                  input.click()
                }}
                disabled={isUploading}
                className="w-full h-16 border-2 border-dashed border-gray-300 bg-gray-50/30 hover:bg-gray-50 text-gray-500 hover:text-gray-600 rounded-xl transition-colors"
              >
                {isUploading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <Paperclip className="w-4 h-4" />
                    <span className="text-xs">{t('form.additionalDocs.dropzone', language)}</span>
                  </div>
                )}
              </Button>
            </div>

            {/* Upload format notice */}
            <p className="text-xs text-gray-400">{t('form.upload.formats', language)} • {t('form.upload.maxSize', language)}</p>
          </CardContent>
        </Card>

        {/* Document Authenticity Declaration (Optional) */}
        <Card className="rounded-xl border border-gray-200 bg-gray-50/30 shadow-sm overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="font-semibold text-sm text-gray-800">
                    {t('form.documentAuthenticity.title', language)}
                  </h4>
                  <Badge className="text-[9px] bg-gray-50 text-gray-500 border-gray-200 h-4 px-1.5">
                    {t('form.additionalDocs.optional', language)}
                  </Badge>
                </div>
                <label className="flex items-start gap-3 cursor-pointer">
                  <Checkbox
                    checked={documentAuthenticityDeclaration}
                    onCheckedChange={(checked) => setDocumentAuthenticityDeclaration(checked as boolean)}
                    className="data-[state=checked]:bg-gray-600 data-[state=checked]:border-gray-600 mt-0.5"
                  />
                  <p className="text-xs text-gray-700 leading-relaxed">
                    {t('form.documentAuthenticity.text', language)}
                  </p>
                </label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI Salary Certificate Analysis Results */}
        {hasSalaryCert && (
          <Card className="rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4" style={{ background: `linear-gradient(135deg, ${MOEI_GOLD}, ${MOEI_GOLD_DARK})` }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Brain className="w-5 h-5 text-white" />
                  <h3 className="font-bold text-white">{t('form.salaryCert.aiTitle', language)}</h3>
                </div>
                <div className="flex items-center gap-2">
                  {isAiAnalysisRequired && (
                    <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px]">
                      {t('form.salaryCert.required', language)}
                    </Badge>
                  )}
                  {isAnalyzingSalaryCert ? (
                    <Badge className="bg-white/20 text-white border-white/30 text-[10px] flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      {t('form.salaryCert.analyzing', language)}
                    </Badge>
                  ) : salaryCertAnalysis ? (
                    <Button
                      type="button"
                      onClick={() => {
                        const certFile = salaryCertFiles[salaryCertFiles.length - 1]
                        if (certFile) runSalaryCertAnalysis(certFile.storedName)
                      }}
                      variant="outline"
                      className="bg-white/20 border-white/30 text-white hover:bg-white/30 rounded-lg"
                    >
                      <Sparkles className="w-4 h-4 me-2" />
                      {t('form.salaryCert.reAnalyze', language)}
                    </Button>
                  ) : (
                    <Badge className="bg-white/20 text-white border-white/30 text-[10px] flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      {t('form.salaryCert.autoAnalyzing', language)}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <CardContent className="p-6">
              {isAnalyzingSalaryCert && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-4 py-8">
                  <div className="relative">
                    <Loader2 className="w-10 h-10 animate-spin" style={{ color: MOEI_GOLD }} />
                    <Brain className="w-5 h-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ color: MOEI_GOLD }} />
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-gray-800">{t('form.salaryCert.analyzing', language)}</p>
                    <p className="text-xs text-gray-500 mt-1">{t('form.salaryCert.analyzingDesc', language)}</p>
                  </div>
                  <Progress value={66} className="w-48 h-1.5" />
                </motion.div>
              )}

              {salaryCertAnalysis && !isAnalyzingSalaryCert && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                  {/* Verification Status */}
                  {(() => {
                    // Derive verificationStatus from recommendation since API returns recommendation, not verificationStatus
                    const recommendation = String(salaryCertAnalysis.recommendation || 'review')
                    const verificationStatus = recommendation === 'accept' ? 'verified'
                      : recommendation === 'reject' ? 'rejected'
                      : 'needs_review'
                    return (
                  <div className={cn(
                    'rounded-xl p-4 border',
                    verificationStatus === 'verified'
                      ? 'bg-green-50 border-green-200'
                      : verificationStatus === 'rejected'
                        ? 'bg-red-50 border-red-200'
                        : 'bg-amber-50 border-amber-200'
                  )}>
                    <div className="flex items-center gap-2 mb-2">
                      {verificationStatus === 'verified' ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      ) : verificationStatus === 'rejected' ? (
                        <XCircle className="w-5 h-5 text-red-600" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-amber-600" />
                      )}
                      <span className="font-semibold text-gray-800">
                        {verificationStatus === 'verified'
                          ? t('form.salaryCert.verified', language)
                          : verificationStatus === 'rejected'
                            ? t('form.salaryCert.rejected', language)
                            : t('form.salaryCert.needsReview', language)
                        }
                      </span>
                      <Badge variant="outline" className="text-xs ms-auto">
                        {t('form.salaryCert.confidence', language)}: {Number(salaryCertAnalysis.confidence) || 0}%
                      </Badge>
                    </div>
                    {salaryCertAnalysis?.isSalaryCertificate === false && (
                      <p className="text-sm text-red-700">{t('form.salaryCert.notSalaryCert', language)}</p>
                    )}
                  </div>
                    )
                  })()}

                  {/* Extracted Fields */}
                  {salaryCertAnalysis.extractedFields && (
                    <div className="rounded-lg border border-gray-100 p-4">
                      <h4 className="font-semibold text-sm text-gray-800 flex items-center gap-2 mb-3">
                        <FileText className="w-4 h-4" style={{ color: MOEI_GOLD }} />
                        {t('form.salaryCert.extractedFields', language)}
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                        {(() => {
                          const f = salaryCertAnalysis.extractedFields as Record<string, unknown>
                          const fieldLabels: Array<{ key: string; label: string; prefix?: string }> = [
                            { key: 'employeeNameEn', label: t('form.fullNameEn', language) },
                            { key: 'employeeNameAr', label: t('form.fullNameAr', language) },
                            { key: 'emiratesId', label: t('form.emiratesId', language) },
                            { key: 'jobTitle', label: t('form.salaryCert.jobTitle', language) },
                            { key: 'nationality', label: t('form.nationality', language) },
                            { key: 'employerNameEn', label: t('form.salaryCert.employerEn', language) },
                            { key: 'employerNameAr', label: t('form.salaryCert.employerAr', language) },
                            { key: 'employerType', label: t('form.salaryCert.employerType', language) },
                            { key: 'basicSalary', label: t('form.salaryCert.basicSalary', language), prefix: 'AED ' },
                            { key: 'housingAllowance', label: t('form.salaryCert.housingAllowance', language), prefix: 'AED ' },
                            { key: 'transportAllowance', label: t('form.salaryCert.transportAllowance', language), prefix: 'AED ' },
                            { key: 'totalSalary', label: t('form.salaryCert.totalSalary', language), prefix: 'AED ' },
                            { key: 'employmentStartDate', label: t('form.salaryCert.startDate', language) },
                            { key: 'contractType', label: t('form.salaryCert.contractType', language) },
                            { key: 'certificateIssueDate', label: t('form.salaryCert.issueDate', language) },
                            { key: 'hasEmployerStamp', label: t('form.salaryCert.hasStamp', language) },
                          ]
                          return fieldLabels
                            .filter(fl => f[fl.key] !== null && f[fl.key] !== undefined && f[fl.key] !== '')
                            .map(fl => (
                              <div key={fl.key} className="flex items-start gap-2 text-sm">
                                <span className="text-gray-400 min-w-[100px] shrink-0">{fl.label}</span>
                                <span className="font-medium text-gray-700">
                                  {fl.prefix && typeof f[fl.key] === 'number'
                                    ? `${fl.prefix}${Number(f[fl.key]).toLocaleString()}`
                                    : fl.key === 'hasEmployerStamp'
                                      ? (f[fl.key] ? '✓' : '✗')
                                      : String(f[fl.key])
                                  }
                                </span>
                              </div>
                            ))
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Issues */}
                  {salaryCertAnalysis.issues && Array.isArray(salaryCertAnalysis.issues) && salaryCertAnalysis.issues.length > 0 && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                      <p className="text-xs font-semibold text-amber-700 mb-1">{t('form.salaryCert.issues', language)}</p>
                      <ul className="text-xs text-amber-600 space-y-0.5">
                        {salaryCertAnalysis.issues.map((issue: unknown, i: number) => (
                          <li key={i}>• {String(issue)}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </motion.div>
              )}

              {!salaryCertAnalysis && !isAnalyzingSalaryCert && (
                <div className="text-center py-6">
                  <Brain className="w-12 h-12 mx-auto text-gray-200 mb-3" />
                  <p className="text-sm text-gray-500">{t('form.salaryCert.autoDesc', language)}</p>
                  {isAiAnalysisRequired && (
                    <Badge className="mt-2 bg-red-50 text-red-700 border-red-200 text-xs">
                      {t('form.salaryCert.requiredBadge', language)}
                    </Badge>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Salary & Bank Statement Cross-Check */}
        {hasSalaryCert && hasBankStatement && (
          <Card className="rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4" style={{ background: `linear-gradient(135deg, #2563EB, #1D4ED8)` }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GitCompareArrows className="w-5 h-5 text-white" />
                  <h3 className="font-bold text-white">{t('form.salaryBankCrossCheck.title', language)}</h3>
                </div>
                <div className="flex items-center gap-2">
                  {isCrossChecking ? (
                    <Badge className="bg-white/20 text-white border-white/30 text-[10px] flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      {t('form.salaryBankCrossCheck.checking', language)}
                    </Badge>
                  ) : salaryBankCrossCheck ? (
                    <Button
                      type="button"
                      onClick={() => runSalaryBankCrossCheck()}
                      variant="outline"
                      className="bg-white/20 border-white/30 text-white hover:bg-white/30 rounded-lg"
                    >
                      <Sparkles className="w-4 h-4 me-2" />
                      {t('form.salaryCert.reAnalyze', language)}
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
            <CardContent className="p-6">
              {isCrossChecking && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-4 py-8">
                  <div className="relative">
                    <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
                    <GitCompareArrows className="w-5 h-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-blue-600" />
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-gray-800">{t('form.salaryBankCrossCheck.checking', language)}</p>
                    <p className="text-xs text-gray-500 mt-1">{t('form.salaryBankCrossCheck.desc', language)}</p>
                  </div>
                  <Progress value={66} className="w-48 h-1.5" />
                </motion.div>
              )}

              {salaryBankCrossCheck && !isCrossChecking && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                  {(() => {
                    const certSalary = Number(salaryBankCrossCheck.certSalary) || 0
                    const bankSalary = Number(salaryBankCrossCheck.bankSalary) || 0
                    const discrepancyPct = Number(salaryBankCrossCheck.discrepancyPct) || (certSalary > 0 ? Math.abs(certSalary - bankSalary) / certSalary * 100 : 0)
                    const status: 'consistent' | 'minor' | 'major' = discrepancyPct < 5 ? 'consistent' : discrepancyPct < 10 ? 'minor' : 'major'
                    const statusConfig = {
                      consistent: { icon: CheckCircle2, bg: 'bg-green-50 border-green-200', text: 'text-green-700', labelKey: 'form.salaryBankCrossCheck.consistent' },
                      minor: { icon: AlertTriangle, bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', labelKey: 'form.salaryBankCrossCheck.minorDiscrepancy' },
                      major: { icon: XCircle, bg: 'bg-red-50 border-red-200', text: 'text-red-700', labelKey: 'form.salaryBankCrossCheck.majorDiscrepancy' },
                    }[status]
                    const Icon = statusConfig.icon
                    return (
                  <div className={cn('rounded-xl p-4 border', statusConfig.bg)}>
                    <div className="flex items-center gap-2 mb-3">
                      <Icon className="w-5 h-5" />
                      <span className={cn('font-semibold', statusConfig.text)}>
                        {t(statusConfig.labelKey, language)}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="rounded-lg bg-white/60 p-3 border border-gray-100">
                        <p className="text-xs text-gray-500 mb-1">{t('form.salaryBankCrossCheck.certSalary', language)}</p>
                        <p className="text-lg font-bold text-gray-800">{formatCurrency(certSalary)}</p>
                      </div>
                      <div className="rounded-lg bg-white/60 p-3 border border-gray-100">
                        <p className="text-xs text-gray-500 mb-1">{t('form.salaryBankCrossCheck.bankSalary', language)}</p>
                        <p className="text-lg font-bold text-gray-800">{formatCurrency(bankSalary)}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <Badge variant="outline" className={cn('text-xs', statusConfig.text)}>
                        {t('form.salaryBankCrossCheck.discrepancy', language)}: {discrepancyPct.toFixed(1)}%
                      </Badge>
                    </div>
                  </div>
                    )
                  })()}

                  {salaryBankCrossCheck.note && (
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                      <div className="flex items-start gap-2">
                        <Info className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-semibold text-blue-700">{t('form.salaryBankCrossCheck.note', language)}</p>
                          <p className="text-xs text-blue-600">{String(salaryBankCrossCheck.note)}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {!salaryBankCrossCheck && !isCrossChecking && (
                <div className="text-center py-6">
                  <GitCompareArrows className="w-12 h-12 mx-auto text-gray-200 mb-3" />
                  <p className="text-sm text-gray-500">{t('form.salaryBankCrossCheck.noData', language)}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* AI Medical Report Analysis Results */}
        {hasMedicalReport && (
          <Card className="rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4" style={{ background: `linear-gradient(135deg, #E11D48, #BE123C)` }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-white" />
                  <h3 className="font-bold text-white">{t('form.medicalReport.aiTitle', language)}</h3>
                </div>
                <div className="flex items-center gap-2">
                  {isAnalyzingMedicalReport ? (
                    <Badge className="bg-white/20 text-white border-white/30 text-[10px] flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      {t('form.medicalReport.analyzing', language)}
                    </Badge>
                  ) : medicalReportAnalysis ? (
                    <Button
                      type="button"
                      onClick={() => {
                        const reportFile = medicalReportFiles[medicalReportFiles.length - 1]
                        if (reportFile) runMedicalReportAnalysis(reportFile.storedName)
                      }}
                      variant="outline"
                      className="bg-white/20 border-white/30 text-white hover:bg-white/30 rounded-lg"
                    >
                      <Sparkles className="w-4 h-4 me-2" />
                      {t('form.salaryCert.reAnalyze', language)}
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
            <CardContent className="p-6">
              {isAnalyzingMedicalReport && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-4 py-8">
                  <div className="relative">
                    <Loader2 className="w-10 h-10 animate-spin text-rose-600" />
                    <Activity className="w-5 h-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-rose-600" />
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-gray-800">{t('form.medicalReport.analyzing', language)}</p>
                  </div>
                  <Progress value={66} className="w-48 h-1.5" />
                </motion.div>
              )}

              {medicalReportAnalysis && !isAnalyzingMedicalReport && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                  {(() => {
                    const recommendation = String(medicalReportAnalysis.recommendation || 'review')
                    const verificationStatus = recommendation === 'accept' ? 'verified'
                      : recommendation === 'reject' ? 'rejected'
                      : 'needs_review'
                    return (
                  <div className={cn(
                    'rounded-xl p-4 border',
                    verificationStatus === 'verified'
                      ? 'bg-green-50 border-green-200'
                      : verificationStatus === 'rejected'
                        ? 'bg-red-50 border-red-200'
                        : 'bg-amber-50 border-amber-200'
                  )}>
                    <div className="flex items-center gap-2 mb-2">
                      {verificationStatus === 'verified' ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      ) : verificationStatus === 'rejected' ? (
                        <XCircle className="w-5 h-5 text-red-600" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-amber-600" />
                      )}
                      <span className="font-semibold text-gray-800">
                        {verificationStatus === 'verified'
                          ? t('form.medicalReport.verified', language)
                          : verificationStatus === 'rejected'
                            ? t('form.medicalReport.rejected', language)
                            : t('form.medicalReport.needsReview', language)
                        }
                      </span>
                      <Badge variant="outline" className="text-xs ms-auto">
                        {t('form.medicalReport.confidence', language)}: {Number(medicalReportAnalysis.confidence) || 0}%
                      </Badge>
                    </div>
                  </div>
                    )
                  })()}

                  {/* Validation Checks */}
                  <div className="rounded-lg border border-gray-100 p-4">
                    <h4 className="font-semibold text-sm text-gray-800 flex items-center gap-2 mb-3">
                      <Scale className="w-4 h-4 text-rose-600" />
                      {t('form.salaryCert.validationChecks', language)}
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                      {(() => {
                        const checks = [
                          { key: 'hasQrCode', label: t('form.medicalReport.qrCode', language) },
                          { key: 'hasHealthcareAuthority', label: t('form.medicalReport.healthcareAuthority', language) },
                          { key: 'hasDoctorLicense', label: t('form.medicalReport.doctorLicense', language) },
                          { key: 'hasPatientInfo', label: t('form.salaryCert.employeeDetailsComplete', language) },
                          { key: 'hasDiagnosis', label: t('form.salaryCert.salaryComplete', language) },
                          { key: 'hasDateRange', label: t('form.salaryCert.hasValidityStatement', language) },
                        ]
                        return checks.map(check => {
                          const val = medicalReportAnalysis[check.key]
                          const detected = val === true || val === 'true' || val === 'detected'
                          const notDetected = val === false || val === 'false' || val === 'not_detected'
                          return (
                            <div key={check.key} className="flex items-center gap-2 text-sm">
                              {detected ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />
                              ) : notDetected ? (
                                <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                              ) : (
                                <AlertCircle className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                              )}
                              <span className="text-gray-600">{check.label}</span>
                              <span className={cn('text-xs ms-auto', detected ? 'text-green-600' : notDetected ? 'text-red-500' : 'text-gray-400')}>
                                {detected ? t('form.medicalReport.detected', language) : notDetected ? t('form.medicalReport.notDetected', language) : '—'}
                              </span>
                            </div>
                          )
                        })
                      })()}
                    </div>
                  </div>

                  {/* Issues */}
                  {medicalReportAnalysis.issues && Array.isArray(medicalReportAnalysis.issues) && medicalReportAnalysis.issues.length > 0 && (
                    <div className="rounded-lg border border-rose-200 bg-rose-50 p-3">
                      <p className="text-xs font-semibold text-rose-700 mb-1">{t('form.medicalReport.issues', language)}</p>
                      <ul className="text-xs text-rose-600 space-y-0.5">
                        {medicalReportAnalysis.issues.map((issue: unknown, i: number) => (
                          <li key={i}>• {String(issue)}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </motion.div>
              )}

              {!medicalReportAnalysis && !isAnalyzingMedicalReport && (
                <div className="text-center py-6">
                  <Activity className="w-12 h-12 mx-auto text-gray-200 mb-3" />
                  <p className="text-sm text-gray-500">{t('form.salaryCert.autoDesc', language)}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </motion.div>
    )
  }

  // ─── Step 4: Review & Submit ────────────────────────
  const renderStep4 = () => {
    return (
      <motion.div
        key="step4"
        initial={{ opacity: 0, x: isAr ? -20 : 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: isAr ? 20 : -20 }}
        transition={{ duration: 0.3 }}
        className="space-y-6"
      >

        {/* Review Summary */}
        <Card className="rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4" style={{ backgroundColor: `${MOEI_GOLD}15` }}>
            <div className="flex items-center gap-2">
              <Eye className="w-5 h-5" style={{ color: MOEI_GOLD }} />
              <h3 className="font-bold text-gray-800">{t('moei.reviewAll', language)}</h3>
            </div>
          </div>
          <CardContent className="p-6 space-y-4">
            {/* Applicant summary */}
            <div className="rounded-lg border border-gray-100 p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-sm text-gray-800 flex items-center gap-2">
                  <User className="w-4 h-4" style={{ color: MOEI_GOLD }} />
                  {t('moei.reviewSection.applicant', language)}
                </h4>
                <Button variant="ghost" size="sm" onClick={() => setCurrentStep(1)} className="text-xs" style={{ color: MOEI_GOLD }}>
                  {t('form.review.edit', language)}
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <div><span className="text-gray-400">{t('form.emiratesId', language)}:</span> <span className="text-gray-700">{form.getValues('emiratesId')}</span></div>
                <div><span className="text-gray-400">{t('form.fullNameAr', language)}:</span> <span className="text-gray-700" dir="rtl">{form.getValues('nameAr')}</span></div>
                <div><span className="text-gray-400">{t('form.phone', language)}:</span> <span className="text-gray-700">{form.getValues('phone')}</span></div>
                <div><span className="text-gray-400">{t('form.email', language)}:</span> <span className="text-gray-700">{form.getValues('email') || '--'}</span></div>
              </div>
            </div>

            {/* Request summary */}
            <div className="rounded-lg border border-gray-100 p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-sm text-gray-800 flex items-center gap-2">
                  <FileText className="w-4 h-4" style={{ color: MOEI_GOLD }} />
                  {t('moei.reviewSection.request', language)}
                </h4>
                <Button variant="ghost" size="sm" onClick={() => setCurrentStep(2)} className="text-xs" style={{ color: MOEI_GOLD }}>
                  {t('form.review.edit', language)}
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <div><span className="text-gray-400">{t('form.housingAssistanceNumber', language)}:</span> <span className="text-gray-700">{housingAssistanceNumber || '--'}</span></div>
                <div><span className="text-gray-400">{t('form.requestType', language)}:</span> <span className="text-gray-700">{requestType ? t(REQUEST_TYPES.find(rt => rt.value === requestType)?.labelKey || '', language) : '--'}</span></div>
              </div>
              {form.getValues('reason') && (
                <div className="mt-2 pt-2 border-t border-gray-100">
                  <span className="text-gray-400 text-sm">{t('form.reason', language)}:</span>
                  <p className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap">{form.getValues('reason')}</p>
                </div>
              )}
            </div>

            {/* Documents summary */}
            {uploadedFiles.length > 0 && (
              <div className="rounded-lg border border-gray-100 p-4">
                <h4 className="font-semibold text-sm text-gray-800 flex items-center gap-2 mb-2">
                  <Upload className="w-4 h-4" style={{ color: MOEI_GOLD }} />
                  {t('form.upload.title', language)} ({uploadedFiles.length})
                </h4>
                <div className="space-y-1">
                  {uploadedFiles.map((file) => (
                    <div key={file.id} className="flex items-center gap-2 text-sm">
                      <FileText className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span className="text-gray-700 truncate">{file.originalName}</span>
                      <span className="text-gray-400 text-xs">({formatFileSize(file.size)})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* MOEI Reference Number */}
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">{t('moei.referenceNumber', language)}</p>
                <p className="font-mono font-bold text-gray-800">{refNumber}</p>
              </div>
              <Badge className="text-[10px] bg-gray-100 text-gray-500 border-gray-200">{t('moei.autoGenerated', language)}</Badge>
            </div>

            {/* Submission Date */}
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">{t('moei.submissionDate', language)}</p>
                <p className="font-bold text-gray-800">{new Date().toLocaleDateString(isAr ? 'ar-AE' : 'en-AE', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>
            </div>

            {/* Direct Debit Agreement checkbox (Optional) */}
            <div className="rounded-xl border border-gray-200 bg-gray-50/30 p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox
                  checked={directDebitAgreement}
                  onCheckedChange={(checked) => setDirectDebitAgreement(checked as boolean)}
                  className="data-[state=checked]:bg-gray-600 data-[state=checked]:border-gray-600 mt-0.5"
                />
                <div>
                  <span className="text-sm text-gray-700 font-medium">{t('form.directDebitAgreement', language)}</span>
                  <Badge className="ms-2 text-[9px] bg-gray-50 text-gray-500 border-gray-200 h-4 px-1.5">
                    {t('form.additionalDocs.optional', language)}
                  </Badge>
                  <p className="text-xs text-gray-500 mt-0.5">{t('form.directDebitAgreementDesc', language)}</p>
                </div>
              </label>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  // ─── Main Render ───────────────────────────────────────
  return (
    <>
      <UAEPassLoginDialog
        open={showUAEPassDialog}
        onOpenChange={setShowUAEPassDialog}
        onLogin={handleUAEPassLogin}
        language={language}
      />

      {renderStepIndicator()}

      <Form {...form}>
        <form onSubmit={(e) => e.preventDefault()}>
          <AnimatePresence mode="wait">
            {currentStep === 1 && renderStep1()}
            {currentStep === 2 && renderStep2()}
            {currentStep === 3 && renderStep3()}
            {currentStep === 4 && renderStep4()}
          </AnimatePresence>

          {/* Navigation Buttons (MOEI style) */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-100">
            <div>
              {currentStep > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                  className="rounded-lg border-gray-200 hover:border-amber-400 hover:text-amber-700"
                >
                  {isAr ? <ChevronRight className="w-4 h-4 me-1" /> : <ChevronLeft className="w-4 h-4 me-1" />}
                  {t('form.previous', language)}
                </Button>
              )}
            </div>
            <div>
              {currentStep < 4 ? (
                <Button
                  type="button"
                  onClick={handleNext}
                  className="text-white font-semibold rounded-lg px-6"
                  style={{ backgroundColor: MOEI_GOLD }}
                >
                  {t('form.next', language)}
                  {isAr ? <ChevronLeft className="w-4 h-4 ms-1" /> : <ChevronRight className="w-4 h-4 ms-1" />}
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleSubmitRequest}
                  disabled={isSubmitting}
                  className={cn(
                    "font-semibold rounded-lg px-8 h-12 w-full sm:w-auto text-lg transition-all",
                    "bg-[#3F8E50] hover:bg-[#317A40] text-white shadow-lg"
                  )}
                >
                  {isSubmitting ? (
                    <Loader2 className="w-5 h-5 animate-spin me-2" />
                  ) : (
                    <Send className="w-5 h-5 me-2" />
                  )}
                  {t('form.submit', language)}
                </Button>
              )}
            </div>
          </div>
        </form>
      </Form>
    </>
  )
}
