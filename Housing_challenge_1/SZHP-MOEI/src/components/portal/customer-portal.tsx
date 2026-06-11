'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuthStore } from '@/lib/auth-store'
import { useAppStore } from '@/lib/store'
import { t, getStatusLabel } from '@/lib/i18n'
import { authFetch } from '@/lib/utils'
import { useSystemConfig } from '@/hooks/use-system-config'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, FileText, Clock, CheckCircle2, XCircle, AlertTriangle,
  MessageSquare, Send, Bot, Sparkles, ChevronRight, Home,
  Wallet, CreditCard, TrendingDown, Upload, X, HelpCircle,
  ChevronLeft, User, Bell, LogOut, Globe, Shield
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'

type CustomerView = 'overview' | 'new-request' | 'my-requests' | 'request-detail' | 'profile'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export function CustomerPortal() {
  const { userProfile, userRole, mockExtraData, logout } = useAuthStore()
  const { language, setLanguage } = useAppStore()
  const { getPercentage, getNumber } = useSystemConfig()
  const dbrMaxPct = getPercentage('max_dbr_limit', 60)
  const maxFileSizeMB = getNumber('max_file_upload_size_mb', 10)
  const isAr = language === 'ar'
  const [currentView, setCurrentView] = useState<CustomerView>('overview')
  const [myRequests, setMyRequests] = useState<any[]>([])
  const [requestsLoading, setRequestsLoading] = useState(true)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [aiMessages, setAiMessages] = useState<ChatMessage[]>([])
  const [aiInput, setAiInput] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Form state
  const [formStep, setFormStep] = useState(0)
  const [formData, setFormData] = useState({
    monthlyIncome: mockExtraData?.monthlyIncome?.toString() || '',
    employer: mockExtraData?.employer || '',
    employerType: mockExtraData?.employerType || '',
    familySize: mockExtraData?.familySize?.toString() || '',
    remainingBalance: '',
    monthlyInstallment: '',
    totalOverdue: '',
    requestedDuration: '',
    reasonCategory: '',
    reason: '',
    supportingDocuments: [] as string[],
  })

  const formSteps = [
    { key: 'personal', label: t('form.section.personal', language) },
    { key: 'financial', label: t('form.section.financial', language) },
    { key: 'loan', label: t('form.section.loan', language) },
    { key: 'documents', label: t('form.section.documents', language) },
    { key: 'review', label: t('form.section.review', language) },
  ]

  // Fetch user's requests
  const fetchMyRequests = useCallback(async () => {
    setRequestsLoading(true)
    try {
      const res = await authFetch('/api/requests')
      if (res.ok) {
        const data = await res.json()
        setMyRequests(Array.isArray(data) ? data.slice(0, 5) : (data.data ? [data.data] : [])) // Show recent 5
      }
    } catch (err) {
      console.error('Failed to fetch requests:', err)
    } finally {
      setRequestsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMyRequests()
  }, [fetchMyRequests])

  // Initialize AI assistant
  useEffect(() => {
    if (aiMessages.length === 0) {
      setAiMessages([{
        id: '1',
        role: 'assistant',
        content: t('ai.welcome', language),
        timestamp: new Date(),
      }])
    }
  }, [language, aiMessages.length])

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [aiMessages])

  // Send AI message
  const sendAiMessage = async (message?: string, action?: string) => {
    const msg = message || aiInput
    if (!msg.trim() && !action) return

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: msg,
      timestamp: new Date(),
    }
    setAiMessages(prev => [...prev, userMsg])
    setAiInput('')
    setAiLoading(true)

    try {
      const res = await authFetch('/api/ai-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          formData,
          action: action || 'chat',
          language,
        }),
      })
      const data = await res.json()
      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response || data.error || t('portal.processingError', language),
        timestamp: new Date(),
      }
      setAiMessages(prev => [...prev, assistantMsg])
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: t('portal.errorOccurred', language),
        timestamp: new Date(),
      }
      setAiMessages(prev => [...prev, errorMsg])
    } finally {
      setAiLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-ae-green-500/10 text-ae-green-600 border-ae-green-500/20'
      case 'rejected': return 'bg-ae-red-500/10 text-ae-red-600 border-ae-red-500/20'
      case 'escalated': return 'bg-amber-500/10 text-amber-600 border-amber-500/20'
      case 'ai_assessed': return 'bg-blue-500/10 text-blue-600 border-blue-500/20'
      case 'under_review': return 'bg-purple-500/10 text-purple-600 border-purple-500/20'
      default: return 'bg-ae-black-100 text-ae-black-500 border-ae-black-200'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle2 className="w-3.5 h-3.5" />
      case 'rejected': return <XCircle className="w-3.5 h-3.5" />
      case 'escalated': return <AlertTriangle className="w-3.5 h-3.5" />
      default: return <Clock className="w-3.5 h-3.5" />
    }
  }

  const calculateDBR = () => {
    const income = parseFloat(formData.monthlyIncome) || 0
    const installment = parseFloat(formData.monthlyInstallment) || 0
    if (income <= 0) return 0
    return Math.round((installment / income) * 10000) / 100
  }

  const userName = isAr && userProfile?.fullnameAR ? userProfile.fullnameAR : userProfile?.fullnameEN || ''

  return (
    <div className="min-h-screen flex flex-col bg-background" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Customer Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b">
        <div className="flex items-center justify-between px-4 sm:px-6 h-16">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-ae-gold-400 to-ae-gold-600 flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-ae-black-700">
                {t('portal.szhp', language)}
              </h1>
              <p className="text-[10px] text-ae-black-400">
                {t('portal.reschedulingPortal', language)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setLanguage(isAr ? 'en' : 'ar')} aria-label={isAr ? 'Switch to English' : 'التبديل إلى العربية'}>
              <Globe className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Notifications">
              <Bell className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-2 ms-2 ps-2 border-s">
              <div className="w-8 h-8 rounded-full bg-ae-gold-500/10 flex items-center justify-center">
                <User className="w-4 h-4 text-ae-gold-600" />
              </div>
              <span className="text-sm font-medium text-ae-black-700 hidden sm:block">{userName}</span>
              <Button variant="ghost" size="icon" onClick={logout} aria-label="Logout">
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-background border-b px-4 sm:px-6">
        <div className="flex gap-1 overflow-x-auto no-scrollbar">
          {[
            { id: 'overview', icon: Home, label: t('portal.overview', language) },
            { id: 'new-request', icon: Plus, label: t('portal.newRequestShort', language) },
            { id: 'my-requests', icon: FileText, label: t('portal.myRequests', language) },
            { id: 'profile', icon: User, label: t('portal.profileShort', language) },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setCurrentView(tab.id as CustomerView)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                currentView === tab.id
                  ? 'text-ae-gold-600 border-ae-gold-500'
                  : 'text-ae-black-400 border-transparent hover:text-ae-black-600 hover:border-ae-black-200'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 p-4 sm:p-6 max-w-[1600px] mx-auto w-full">
        <AnimatePresence mode="wait">
          {/* Overview */}
          {currentView === 'overview' && (
            <motion.div key="overview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
              {/* Welcome */}
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-ae-black-700">
                  {t('portal.welcome', language)}, {userName}
                </h2>
                <p className="text-ae-black-400 mt-1">
                  {t('portal.accountSummary', language)}
                </p>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { icon: Wallet, label: t('portal.activeLoans', language), value: mockExtraData?.hasActiveLoan ? '1' : '0', color: 'text-ae-gold-500' },
                  { icon: CreditCard, label: t('portal.monthlyPayment', language), value: t('portal.notAvailable', language), color: 'text-blue-500' },
                  { icon: TrendingDown, label: t('portal.arrears', language), value: t('portal.notAvailable', language), color: 'text-ae-red-500' },
                  { icon: FileText, label: t('portal.myRequests', language), value: String(myRequests.length), color: 'text-ae-green-500' },
                ].map((stat) => (
                  <Card key={stat.label}>
                    <CardContent className="p-4">
                      <stat.icon className={`w-5 h-5 ${stat.color} mb-2`} />
                      <div className="text-lg font-bold text-ae-black-700">{stat.value}</div>
                      <div className="text-xs text-ae-black-400">{stat.label}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    {t('portal.quickActions', language)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Button
                    onClick={() => setCurrentView('new-request')}
                    className="h-14 bg-ae-gold-500 hover:bg-ae-gold-600 text-white justify-start"
                  >
                    <Plus className="w-5 h-5 me-2" />
                    {t('portal.newRequest', language)}
                  </Button>
                  <Button
                    onClick={() => setCurrentView('my-requests')}
                    variant="outline"
                    className="h-14 justify-start"
                  >
                    <FileText className="w-5 h-5 me-2" />
                    {t('portal.myRequests', language)}
                  </Button>
                </CardContent>
              </Card>

              {/* Recent Requests */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">{t('portal.myRequests', language)}</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setCurrentView('my-requests')}>
                    {t('portal.viewAll', language)} <ChevronRight className="w-4 h-4" />
                  </Button>
                </CardHeader>
                <CardContent>
                  {requestsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="w-6 h-6 border-2 border-ae-gold-500 rounded-full border-t-transparent animate-spin" />
                    </div>
                  ) : myRequests.length === 0 ? (
                    <div className="text-center py-8 text-ae-black-400">
                      <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">{t('portal.noRequests', language)}</p>
                      <p className="text-xs mt-1">{t('portal.noRequests.desc', language)}</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {myRequests.slice(0, 3).map((req: any) => (
                        <div key={req.id} className="flex items-center justify-between p-3 rounded-lg bg-ae-black-50">
                          <div>
                            <div className="text-sm font-medium text-ae-black-700">{req.reasonCategory}</div>
                            <div className="text-xs text-ae-black-400">
                              {new Date(req.createdAt).toLocaleDateString(isAr ? 'ar-AE' : 'en-US')}
                            </div>
                          </div>
                          <Badge variant="outline" className={`${getStatusColor(req.status)} text-xs`}>
                            {getStatusIcon(req.status)}
                            <span className="ms-1">{getStatusLabel(req.status, language)}</span>
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* New Request Form */}
          {currentView === 'new-request' && (
            <motion.div key="new-request" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <h2 className="text-xl font-bold text-ae-black-700">
                  {t('portal.newRequest', language)}
                </h2>
                <Button variant="ghost" size="sm" onClick={() => setCurrentView('overview')}>
                  {t('common.back', language)}
                </Button>
              </div>

              {/* Step Indicator */}
              <div className="flex items-center gap-2">
                {formSteps.map((step, i) => (
                  <div key={step.key} className="flex items-center gap-2 flex-1">
                    <div className={`flex items-center gap-2 ${i <= formStep ? 'text-ae-gold-600' : 'text-ae-black-300'}`}>
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                        i < formStep ? 'bg-ae-gold-500 text-white' :
                        i === formStep ? 'bg-ae-gold-500/10 text-ae-gold-600 border-2 border-ae-gold-500' :
                        'bg-ae-black-100 text-ae-black-400'
                      }`}>
                        {i < formStep ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                      </div>
                      <span className="text-xs font-medium hidden sm:block">{step.label}</span>
                    </div>
                    {i < formSteps.length - 1 && (
                      <div className={`flex-1 h-0.5 ${i < formStep ? 'bg-ae-gold-500' : 'bg-ae-black-200'}`} />
                    )}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Form */}
                <div className="lg:col-span-2">
                  <Card>
                    <CardContent className="p-4 sm:p-6">
                      <AnimatePresence mode="wait">
                        {/* Step 0: Personal Info */}
                        {formStep === 0 && (
                          <motion.div key="step0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                            <h3 className="font-semibold text-ae-black-700">{t('form.section.personal', language)}</h3>
                            <p className="text-xs text-ae-black-400">{t('portal.autoFilled', language)}</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <Label className="text-sm">{t('form.fullName', language)}</Label>
                                <Input value={userProfile?.fullnameEN || ''} disabled className="bg-ae-black-50" />
                              </div>
                              <div>
                                <Label className="text-sm">{t('form.emiratesId', language)}</Label>
                                <Input value={userProfile?.idn || ''} disabled className="bg-ae-black-50" />
                              </div>
                              <div>
                                <Label className="text-sm">{t('form.phone', language)}</Label>
                                <Input value={userProfile?.mobile || ''} disabled className="bg-ae-black-50" />
                              </div>
                              <div>
                                <Label className="text-sm">{t('form.email', language)}</Label>
                                <Input value={userProfile?.email || ''} disabled className="bg-ae-black-50" />
                              </div>
                            </div>
                          </motion.div>
                        )}

                        {/* Step 1: Financial Info */}
                        {formStep === 1 && (
                          <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                            <h3 className="font-semibold text-ae-black-700">{t('form.section.financial', language)}</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <Label className="text-sm">{t('form.monthlyIncome', language)}</Label>
                                <Input
                                  type="number"
                                  value={formData.monthlyIncome}
                                  onChange={(e) => setFormData(prev => ({ ...prev, monthlyIncome: e.target.value }))}
                                  placeholder={t('portal.monthlyIncomePlaceholder', language)}
                                />
                              </div>
                              <div>
                                <Label className="text-sm">{t('form.employer', language)}</Label>
                                <Input
                                  value={formData.employer}
                                  onChange={(e) => setFormData(prev => ({ ...prev, employer: e.target.value }))}
                                  placeholder={t('portal.employerNamePlaceholder', language)}
                                />
                              </div>
                              <div>
                                <Label className="text-sm">{t('form.employerType', language)}</Label>
                                <Select value={formData.employerType} onValueChange={(v) => setFormData(prev => ({ ...prev, employerType: v }))}>
                                  <SelectTrigger><SelectValue placeholder={t('portal.selectType', language)} /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="government">{t('form.government', language)}</SelectItem>
                                    <SelectItem value="semi-government">{t('form.semiGovernment', language)}</SelectItem>
                                    <SelectItem value="private">{t('form.private', language)}</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label className="text-sm">{t('form.familySize', language)}</Label>
                                <Input
                                  type="number"
                                  value={formData.familySize}
                                  onChange={(e) => setFormData(prev => ({ ...prev, familySize: e.target.value }))}
                                  placeholder={t('portal.familySizePlaceholder', language)}
                                />
                              </div>
                            </div>

                            {/* DBR Calculator */}
                            <div className="p-4 rounded-lg bg-ae-gold-50 border border-ae-gold-200">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-ae-gold-700">{t('form.dbr', language)}</span>
                                <span className="text-sm font-bold text-ae-gold-600">{calculateDBR()}%</span>
                              </div>
                              <Progress value={Math.min(calculateDBR(), 100)} className="h-2" />
                              <div className="flex justify-between mt-1">
                                <span className="text-[10px] text-ae-black-400">0%</span>
                                <span className="text-[10px] text-ae-red-500">{dbrMaxPct}% {t('portal.limit', language)}</span>
                              </div>
                            </div>
                          </motion.div>
                        )}

                        {/* Step 2: Loan Details */}
                        {formStep === 2 && (
                          <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                            <h3 className="font-semibold text-ae-black-700">{t('form.section.loan', language)}</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <Label className="text-sm">{t('form.remainingBalance', language)}</Label>
                                <Input type="number" value={formData.remainingBalance} onChange={(e) => setFormData(prev => ({ ...prev, remainingBalance: e.target.value }))} />
                              </div>
                              <div>
                                <Label className="text-sm">{t('form.monthlyInstallment', language)}</Label>
                                <Input type="number" value={formData.monthlyInstallment} onChange={(e) => setFormData(prev => ({ ...prev, monthlyInstallment: e.target.value }))} />
                              </div>
                              <div>
                                <Label className="text-sm">{t('form.requestedDuration', language)}</Label>
                                <Input type="number" value={formData.requestedDuration} onChange={(e) => setFormData(prev => ({ ...prev, requestedDuration: e.target.value }))} placeholder={t('portal.inMonths', language)} />
                              </div>
                              <div>
                                <Label className="text-sm">{t('form.reasonCategory', language)}</Label>
                                <Select value={formData.reasonCategory} onValueChange={(v) => setFormData(prev => ({ ...prev, reasonCategory: v }))}>
                                  <SelectTrigger><SelectValue placeholder={t('portal.selectReason', language)} /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="job_loss">{t('form.jobLoss', language)}</SelectItem>
                                    <SelectItem value="medical">{t('form.medical', language)}</SelectItem>
                                    <SelectItem value="salary_cut">{t('form.salaryCut', language)}</SelectItem>
                                    <SelectItem value="divorce">{t('form.divorce', language)}</SelectItem>
                                    <SelectItem value="retirement">{t('form.retirement', language)}</SelectItem>
                                    <SelectItem value="other">{t('form.other', language)}</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="sm:col-span-2">
                                <Label className="text-sm">{t('form.reason', language)}</Label>
                                <Textarea
                                  value={formData.reason}
                                  onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                                  rows={3}
                                  placeholder={t('portal.reschedulingReasonPlaceholder', language)}
                                />
                              </div>
                            </div>
                          </motion.div>
                        )}

                        {/* Step 3: Documents */}
                        {formStep === 3 && (
                          <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                            <h3 className="font-semibold text-ae-black-700">{t('form.section.documents', language)}</h3>
                            <div className="border-2 border-dashed border-ae-black-200 rounded-xl p-8 text-center">
                              <Upload className="w-10 h-10 text-ae-black-300 mx-auto mb-3" />
                              <p className="text-sm text-ae-black-500">{t('portal.dragFilesOrClick', language)}</p>
                              <p className="text-xs text-ae-black-400 mt-1">{isAr ? `PDF, JPG, PNG (${t('portal.limit', language)} ${maxFileSizeMB} MB)` : `PDF, JPG, PNG (Max ${maxFileSizeMB}MB)`}</p>
                              <Button variant="outline" size="sm" className="mt-3">
                                {t('portal.chooseFiles', language)}
                              </Button>
                            </div>
                            <div className="space-y-2">
                              <p className="text-xs font-medium text-ae-black-500">{t('portal.requiredDocuments', language)}</p>
                              {[
                                t('portal.recentSalaryCertificate', language),
                                t('portal.bankStatements3Months', language),
                                t('portal.employerLetter', language),
                                ...(formData.reasonCategory === 'medical' ? [t('portal.medicalReport', language)] : []),
                                ...(formData.reasonCategory === 'job_loss' ? [t('portal.terminationLetter', language)] : []),
                              ].map((doc, i) => (
                                <div key={i} className="flex items-center gap-2 text-xs text-ae-black-500">
                                  <div className="w-4 h-4 rounded border border-ae-black-300" />
                                  {doc}
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}

                        {/* Step 4: Review */}
                        {formStep === 4 && (
                          <motion.div key="step4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                            <h3 className="font-semibold text-ae-black-700">{t('form.section.review', language)}</h3>
                            <div className="space-y-3">
                              {Object.entries({
                                [t('form.fullName', language)]: userProfile?.fullnameEN,
                                [t('form.emiratesId', language)]: userProfile?.idn,
                                [t('form.monthlyIncome', language)]: formData.monthlyIncome ? `AED ${formData.monthlyIncome}` : '',
                                [t('form.employer', language)]: formData.employer,
                                [t('form.employerType', language)]: formData.employerType,
                                [t('form.familySize', language)]: formData.familySize,
                                [t('form.remainingBalance', language)]: formData.remainingBalance ? `AED ${formData.remainingBalance}` : '',
                                [t('form.monthlyInstallment', language)]: formData.monthlyInstallment ? `AED ${formData.monthlyInstallment}` : '',
                                [t('form.requestedDuration', language)]: formData.requestedDuration ? `${formData.requestedDuration} ${t('common.months', language)}` : '',
                                [t('form.reasonCategory', language)]: formData.reasonCategory,
                              }).filter(([, v]) => v).map(([key, value]) => (
                                <div key={key} className="flex justify-between py-2 border-b border-ae-black-100">
                                  <span className="text-sm text-ae-black-500">{key}</span>
                                  <span className="text-sm font-medium text-ae-black-700">{value}</span>
                                </div>
                              ))}
                            </div>
                            <div className="p-3 rounded-lg bg-ae-green-50 border border-ae-green-200">
                              <p className="text-xs text-ae-green-700">
                                {t('portal.termsAgreement', language)}
                              </p>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Navigation Buttons */}
                      <div className="flex justify-between mt-6">
                        <Button
                          variant="outline"
                          onClick={() => setFormStep(prev => Math.max(0, prev - 1))}
                          disabled={formStep === 0}
                        >
                          {isAr ? <ChevronRight className="w-4 h-4 ms-1" /> : <ChevronLeft className="w-4 h-4 me-1" />}
                          {t('form.previous', language)}
                        </Button>
                        {formStep < formSteps.length - 1 ? (
                          <Button onClick={() => setFormStep(prev => prev + 1)} className="bg-ae-gold-500 hover:bg-ae-gold-600 text-white">
                            {t('form.next', language)}
                            {isAr ? <ChevronLeft className="w-4 h-4 me-1" /> : <ChevronRight className="w-4 h-4 ms-1" />}
                          </Button>
                        ) : (
                          <Button
                            onClick={async () => {
                              setSubmitLoading(true)
                              try {
                                const res = await authFetch('/api/requests', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    applicantId: '',
                                    loanId: '',
                                    requestedDurationMonths: parseInt(formData.requestedDuration) || 180,
                                    reason: formData.reason,
                                    reasonCategory: formData.reasonCategory,
                                    supportingDocuments: JSON.stringify(formData.supportingDocuments),
                                  }),
                                })
                                if (res.ok) {
                                  setCurrentView('my-requests')
                                  fetchMyRequests()
                                }
                              } catch (err) {
                                console.error('Submit error:', err)
                              } finally {
                                setSubmitLoading(false)
                              }
                            }}
                            disabled={submitLoading}
                            className="bg-ae-green-500 hover:bg-ae-green-600 text-white"
                          >
                            {submitLoading ? t('portal.submitting', language) || 'Submitting...' : t('form.submit', language)}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* AI Assistant Sidebar */}
                <div className="lg:col-span-1">
                  <Card className="sticky top-24">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-ae-gold-400 to-ae-gold-600 flex items-center justify-center">
                          <Bot className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <CardTitle className="text-sm">{t('ai.assistant', language)}</CardTitle>
                          <p className="text-[10px] text-ae-black-400">{t('ai.assistant.desc', language)}</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <ScrollArea className="h-64 px-4">
                        <div className="space-y-3 py-2">
                          {aiMessages.map((msg) => (
                            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-[85%] rounded-lg px-3 py-2 text-xs ${
                                msg.role === 'user'
                                  ? 'bg-ae-gold-500 text-white'
                                  : 'bg-ae-black-100 text-ae-black-700'
                              }`}>
                                {msg.content}
                              </div>
                            </div>
                          ))}
                          {aiLoading && (
                            <div className="flex justify-start">
                              <div className="bg-ae-black-100 rounded-lg px-3 py-2 text-xs text-ae-black-400">
                                {t('ai.typing', language)}
                              </div>
                            </div>
                          )}
                          <div ref={chatEndRef} />
                        </div>
                      </ScrollArea>

                      {/* Quick Actions */}
                      <div className="px-4 py-2 flex gap-1 flex-wrap">
                        {[
                          { key: 'checkForm', icon: Sparkles, action: 'check_form' },
                          { key: 'missingDocs', icon: HelpCircle, action: 'missing_docs' },
                          { key: 'estimateTerms', icon: Wallet, action: 'estimate_terms' },
                        ].map((qa) => (
                          <Button
                            key={qa.key}
                            variant="outline"
                            size="sm"
                            className="h-7 text-[10px]"
                            onClick={() => sendAiMessage('', qa.action)}
                          >
                            <qa.icon className="w-3 h-3 me-1" />
                            {t(`ai.${qa.key}`, language)}
                          </Button>
                        ))}
                      </div>

                      {/* Input */}
                      <div className="p-3 border-t">
                        <form
                          onSubmit={(e) => { e.preventDefault(); sendAiMessage() }}
                          className="flex gap-2"
                        >
                          <Input
                            value={aiInput}
                            onChange={(e) => setAiInput(e.target.value)}
                            placeholder={t('portal.typeMessage', language)}
                            className="text-xs h-9"
                          />
                          <Button type="submit" size="icon" className="h-9 w-9 bg-ae-gold-500 hover:bg-ae-gold-600 shrink-0">
                            <Send className="w-4 h-4" />
                          </Button>
                        </form>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </motion.div>
          )}

          {/* My Requests */}
          {currentView === 'my-requests' && (
            <motion.div key="my-requests" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <h2 className="text-xl font-bold text-ae-black-700">{t('portal.myRequests', language)}</h2>
                <Button onClick={() => setCurrentView('new-request')} className="bg-ae-gold-500 hover:bg-ae-gold-600 text-white">
                  <Plus className="w-4 h-4 me-1" /> {t('portal.newRequest', language)}
                </Button>
              </div>
              {myRequests.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <FileText className="w-16 h-16 mx-auto mb-4 text-ae-black-200" />
                    <h3 className="text-lg font-medium text-ae-black-700">{t('portal.noRequests', language)}</h3>
                    <p className="text-sm text-ae-black-400 mt-1">{t('portal.noRequests.desc', language)}</p>
                    <Button onClick={() => setCurrentView('new-request')} className="mt-4 bg-ae-gold-500 hover:bg-ae-gold-600 text-white">
                      <Plus className="w-4 h-4 me-1" /> {t('portal.newRequest', language)}
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {myRequests.map((req: any) => (
                    <Card key={req.id} className="hover:shadow-md transition-shadow cursor-pointer">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-ae-black-700">{req.reasonCategory}</span>
                              <Badge variant="outline" className={`${getStatusColor(req.status)} text-xs`}>
                                {getStatusIcon(req.status)}
                                <span className="ms-1">{getStatusLabel(req.status, language)}</span>
                              </Badge>
                            </div>
                            <p className="text-xs text-ae-black-400 mt-1 truncate">{req.reason}</p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-ae-black-400">
                              <span>{t('portal.requestId', language)}: {req.id.slice(-8)}</span>
                              <span>{t('portal.submittedOn', language)}: {new Date(req.createdAt).toLocaleDateString(isAr ? 'ar-AE' : 'en-US')}</span>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-ae-black-300 shrink-0" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* Profile */}
          {currentView === 'profile' && (
            <motion.div key="profile" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              <h2 className="text-xl font-bold text-ae-black-700">{t('portal.profile', language)}</h2>
              <Card>
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 rounded-full bg-ae-gold-500/10 flex items-center justify-center">
                      <User className="w-8 h-8 text-ae-gold-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-ae-black-700">{userName}</h3>
                      <p className="text-sm text-ae-black-400">{userProfile?.email}</p>
                      <Badge variant="outline" className="mt-1 text-xs">
                        {t('portal.verification', language)}: {userProfile?.sopLevel?.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                  <Separator className="mb-4" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    {[
                      { label: t('form.emiratesId', language), value: userProfile?.idn },
                      { label: t('form.phone', language), value: userProfile?.mobile },
                      { label: t('form.email', language), value: userProfile?.email },
                      { label: t('portal.nationality', language), value: isAr ? userProfile?.nationalityAR : userProfile?.nationalityEN },
                      { label: t('portal.dateOfBirth', language), value: userProfile?.dob },
                      { label: t('portal.gender', language), value: userProfile?.gender === 'male' ? t('portal.male', language) : t('portal.female', language) },
                    ].map((item) => (
                      <div key={item.label}>
                        <p className="text-ae-black-400 text-xs">{item.label}</p>
                        <p className="font-medium text-ae-black-700">{item.value || '--'}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t bg-background/50 backdrop-blur-sm px-4 sm:px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-ae-black-400">
        <div className="flex items-center gap-2">
          <Shield className="w-3 h-3 text-ae-gold-500" />
          <span>{t('portal.szhpPortal', language)}</span>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-ae-green-500 text-ae-green-600">
            <span className="w-1.5 h-1.5 rounded-full bg-ae-green-500 me-1 pulse-live" />
            {t('portal.online', language)}
          </Badge>
          <span>v2.0.0</span>
        </div>
      </footer>
    </div>
  )
}
