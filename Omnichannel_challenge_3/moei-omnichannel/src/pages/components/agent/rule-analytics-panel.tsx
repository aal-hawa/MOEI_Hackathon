'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  BarChart3,
  Zap,
  Home,
  Fuel,
  Truck,
  Leaf,
  Settings,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileText,
  Brain,
  Shield,
  Target,
  TrendingUp,
  Loader2,
  RefreshCw,
  Trash2,
  Filter,
  Calendar,
  Clock,
  Activity,
  MousePointerClick,
  RotateCcw,
  Inbox,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAppStore } from '@/store/app-store'
import { useTranslation } from '@/i18n'
import { api } from '@/lib/api-client'

// ─── Types ───────────────────────────────────────────────────────────────────

interface RuleAnalytics {
  totalHits: number
  hitCounts: Array<{ ruleId: string; hits: number }>
  channelDistribution: Array<{ channel: string; count: number }>
  effectiveness: {
    helpful: number
    notHelpful: number
    rate: number | null
  }
  responseTime: {
    avgMs: number | null
    minMs: number | null
    maxMs: number | null
  }
  trends: Array<{ date: string; hits: number }>
  intentDistribution: Array<{ intent: string | null; count: number }>
}

interface RuleStats {
  totalRules: number
  activeRules: number
  inactiveRules: number
  rulesPerCategory: Record<string, { total: number; active: number }>
  rulesWithFields: number
  rulesWithoutFields: number
  rulesWithInstructions: number
  rulesWithoutInstructions: number
  categories: string[]
  analytics: RuleAnalytics
}

interface ServiceRule {
  id: string
  nameEn: string
  nameAr: string
  category: string
  priority: string
  isActive: boolean
  fields: Array<{ id?: string; fieldKey: string; labelEn: string; labelAr: string; fieldType: string; required: boolean }>
  tags: string[]
  updatedAt: string
}

// ─── Category Config ─────────────────────────────────────────────────────────

const CATEGORIES = [
  { key: 'electricity_water', icon: Zap, labelEn: 'Electricity & Water', labelAr: 'الكهرباء والمياه', color: 'bg-amber-500', lightColor: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  { key: 'housing', icon: Home, labelEn: 'Housing', labelAr: 'الإسكان', color: 'bg-sky-500', lightColor: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' },
  { key: 'petroleum', icon: Fuel, labelEn: 'Petroleum', labelAr: 'البترول', color: 'bg-red-500', lightColor: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  { key: 'transport', icon: Truck, labelEn: 'Transport', labelAr: 'النقل', color: 'bg-emerald-500', lightColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  { key: 'sustainability', icon: Leaf, labelEn: 'Sustainability', labelAr: 'الاستدامة', color: 'bg-teal-500', lightColor: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' },
  { key: 'general', icon: Settings, labelEn: 'General', labelAr: 'عام', color: 'bg-gray-500', lightColor: 'bg-gray-100 text-gray-700 dark:bg-gray-800/30 dark:text-gray-400' },
]

// ─── Empty State Component ────────────────────────────────────────────────────

function EmptyState({ icon: Icon, title, description, isAr }: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  isAr: boolean
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
        <Icon className="h-8 w-8 text-muted-foreground/50" />
      </div>
      <h3 className="text-sm font-medium text-muted-foreground mb-1">{title}</h3>
      <p className="text-xs text-muted-foreground/70 text-center max-w-[250px]">{description}</p>
    </div>
  )
}

// ─── Analytics Panel ──────────────────────────────────────────────────────────

export default function RuleAnalyticsPanel() {
  const { language } = useAppStore()
  const { t } = useTranslation()
  const isAr = language === 'ar'

  const [stats, setStats] = useState<RuleStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Rules list for hit count display
  const [rules, setRules] = useState<ServiceRule[]>([])

  // Filter state
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')

  // Reset confirmation
  const [resetTarget, setResetTarget] = useState<{ type: 'all' | 'category' | 'rule'; value: string } | null>(null)
  const [resetting, setResetting] = useState(false)

  // Toast state
  const [toasts, setToasts] = useState<Array<{ id: string; type: 'success' | 'error'; message: string }>>([])

  const addToast = useCallback((type: 'success' | 'error', message: string) => {
    const id = `toast-${Date.now()}`
    setToasts(prev => [...prev, { id, type, message }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 4000)
  }, [])

  // Build query params
  const buildParams = useCallback(() => {
    const params = new URLSearchParams()
    if (filterCategory && filterCategory !== 'all') params.set('category', filterCategory)
    if (dateFrom) params.set('dateFrom', dateFrom)
    if (dateTo) params.set('dateTo', dateTo)
    return params.toString()
  }, [filterCategory, dateFrom, dateTo])

  // Fetch analytics data
  const fetchStats = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = buildParams()
      const url = `/service-rules/_analytics${params ? `?${params}` : ''}`
      const res = await api.get(url)
      if (!res.ok) throw new Error(isAr ? 'فشل في تحميل البيانات' : 'Failed to fetch analytics')
      const data: RuleStats = await res.json()
      setStats(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [buildParams, isAr])

  // Fetch rules list
  const fetchRules = useCallback(async () => {
    try {
      const res = await api.get('/service-rules')
      if (res.ok) {
        const data = await res.json()
        setRules(data)
      }
    } catch {
      // Silent fail
    }
  }, [])

  useEffect(() => {
    fetchStats()
    fetchRules()
  }, [fetchStats, fetchRules])

  // Coverage score
  const coverageScore = stats
    ? Math.round(
        ((stats.rulesWithInstructions / Math.max(stats.totalRules, 1)) * 0.4 +
        (stats.rulesWithFields / Math.max(stats.totalRules, 1)) * 0.3 +
        (stats.activeRules / Math.max(stats.totalRules, 1)) * 0.3) * 100
      )
    : 0

  const getCoverageColor = (score: number) => {
    if (score >= 80) return 'text-uae-green-600'
    if (score >= 50) return 'text-amber-600'
    return 'text-uae-red-600'
  }

  const getCoverageLabel = (score: number) => {
    if (score >= 80) return isAr ? 'ممتاز' : 'Excellent'
    if (score >= 60) return isAr ? 'جيد' : 'Good'
    if (score >= 40) return isAr ? 'متوسط' : 'Fair'
    return isAr ? 'يحتاج تحسين' : 'Needs Improvement'
  }

  // Handle reset analytics
  const handleReset = async () => {
    if (!resetTarget) return
    setResetting(true)
    try {
      const params = new URLSearchParams()
      if (resetTarget.type === 'category') params.set('category', resetTarget.value)
      else if (resetTarget.type === 'rule') params.set('ruleId', resetTarget.value)

      const res = await api.delete(`/service-rules/_analytics?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        addToast('success', isAr ? `تم حذف ${data.deletedCount} سجل` : `Deleted ${data.deletedCount} records`)
        fetchStats()
      } else {
        addToast('error', isAr ? 'فشل في حذف البيانات' : 'Failed to delete analytics')
      }
    } catch {
      addToast('error', isAr ? 'خطأ في الاتصال' : 'Connection error')
    } finally {
      setResetting(false)
      setResetTarget(null)
    }
  }

  // Find rule name by ID
  const getRuleName = (ruleId: string) => {
    const rule = rules.find(r => r.id === ruleId)
    return rule ? (isAr ? rule.nameAr : rule.nameEn) : ruleId.slice(0, 8) + '...'
  }

  // Get max trend value for scaling
  const maxTrendHits = stats?.analytics.trends
    ? Math.max(...stats.analytics.trends.map(t => t.hits), 1)
    : 1

  // Loading state
  if (loading) {
    return (
      <div className="h-full flex flex-col p-6 space-y-6" dir={isAr ? 'rtl' : 'ltr'}>
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-ae-gold-500" />
          <h2 className="text-lg font-bold">{isAr ? 'تحليلات القواعد' : 'Rule Analytics'}</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-48 rounded-lg" />
        <Skeleton className="h-36 rounded-lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8" dir={isAr ? 'rtl' : 'ltr'}>
        <AlertTriangle className="h-10 w-10 text-uae-red-500 mb-4" />
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" size="sm" className="mt-4 gap-2" onClick={fetchStats}>
          <RefreshCw className="h-3.5 w-3.5" />
          {isAr ? 'إعادة المحاولة' : 'Retry'}
        </Button>
      </div>
    )
  }

  if (!stats) return null

  const analytics = stats.analytics
  const hasAnalytics = analytics.totalHits > 0

  return (
    <div className="h-full flex flex-col" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Toast Container */}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg border ${
                toast.type === 'success'
                  ? 'bg-uae-green-50 text-uae-green-700 border-uae-green-200 dark:bg-uae-green-900/30 dark:text-uae-green-400'
                  : 'bg-uae-red-50 text-uae-red-700 border-uae-red-200 dark:bg-uae-red-900/30 dark:text-uae-red-400'
              }`}
            >
              {toast.type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
              <span className="text-sm flex-1">{toast.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Header with Filters */}
      <div className="px-4 sm:px-6 py-4 border-b border-border bg-gradient-to-r from-background to-ae-gold-500/5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-ae-gold-500" />
            <div>
              <h2 className="text-lg font-bold text-foreground">
                {isAr ? 'تحليلات القواعد' : 'Rule Analytics'}
              </h2>
              <p className="text-xs text-muted-foreground">
                {isAr
                  ? 'مراقبة استخدام القواعد والفعالية والاتجاهات'
                  : 'Monitor rule usage, effectiveness, and trends'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Category Filter */}
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="h-8 text-[11px] w-[140px]">
                <Filter className="h-3 w-3 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{isAr ? 'كل الفئات' : 'All Categories'}</SelectItem>
                {CATEGORIES.map(cat => (
                  <SelectItem key={cat.key} value={cat.key}>
                    {isAr ? cat.labelAr : cat.labelEn}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Date From */}
            <div className="flex items-center gap-1">
              <Label className="text-[10px] text-muted-foreground whitespace-nowrap">{isAr ? 'من' : 'From'}</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-8 text-[11px] w-[130px]"
              />
            </div>
            {/* Date To */}
            <div className="flex items-center gap-1">
              <Label className="text-[10px] text-muted-foreground whitespace-nowrap">{isAr ? 'إلى' : 'To'}</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-8 text-[11px] w-[130px]"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="text-xs gap-1.5 h-8"
              onClick={() => { setDateFrom(''); setDateTo(''); setFilterCategory('all') }}
            >
              <RotateCcw className="h-3 w-3" />
              {isAr ? 'إعادة تعيين' : 'Reset'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs gap-1.5 h-8"
              onClick={() => { fetchStats(); fetchRules() }}
            >
              <RefreshCw className="h-3 w-3" />
              {isAr ? 'تحديث' : 'Refresh'}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar space-y-6">
        {/* Coverage Score + Key Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Coverage Score */}
          <Card className="col-span-2 sm:col-span-1 border-ae-gold-200 dark:border-ae-gold-800/30">
            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
              <div className={`text-4xl font-bold ${getCoverageColor(coverageScore)}`}>
                {coverageScore}%
              </div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase mt-1">
                {isAr ? 'درجة التغطية' : 'Coverage Score'}
              </p>
              <Badge className={`mt-1.5 text-[9px] ${coverageScore >= 60 ? 'bg-uae-green-100 text-uae-green-700 dark:bg-uae-green-900/30 dark:text-uae-green-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                {getCoverageLabel(coverageScore)}
              </Badge>
            </CardContent>
          </Card>

          {/* Total Rules */}
          <Card>
            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
              <FileText className="h-5 w-5 text-brand-500 mb-1" />
              <div className="text-2xl font-bold text-foreground">{stats.totalRules}</div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase">
                {isAr ? 'إجمالي القواعد' : 'Total Rules'}
              </p>
            </CardContent>
          </Card>

          {/* Active Rules */}
          <Card>
            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
              <CheckCircle2 className="h-5 w-5 text-uae-green-500 mb-1" />
              <div className="text-2xl font-bold text-uae-green-600">{stats.activeRules}</div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase">
                {isAr ? 'قواعد نشطة' : 'Active Rules'}
              </p>
              <span className="text-[9px] text-muted-foreground">
                {stats.totalRules > 0 ? Math.round((stats.activeRules / stats.totalRules) * 100) : 0}% {isAr ? 'نشط' : 'active'}
              </span>
            </CardContent>
          </Card>

          {/* Total Hits */}
          <Card>
            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
              <MousePointerClick className="h-5 w-5 text-purple-500 mb-1" />
              <div className="text-2xl font-bold text-purple-600">{analytics.totalHits}</div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase">
                {isAr ? 'إجمالي الاستخدام' : 'Total Hits'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quality Indicators */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Shield className="h-4 w-4 text-ae-gold-500" />
              {isAr ? 'مؤشرات الجودة' : 'Quality Indicators'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium flex items-center gap-1.5">
                  <Brain className="h-3.5 w-3.5 text-purple-500" />
                  {isAr ? 'قواعد مع تعليمات الوكيل' : 'Rules with Agent Instructions'}
                </span>
                <span className="text-muted-foreground">
                  {stats.rulesWithInstructions}/{stats.totalRules}
                </span>
              </div>
              <Progress value={stats.totalRules > 0 ? (stats.rulesWithInstructions / stats.totalRules) * 100 : 0} className="h-2" />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium flex items-center gap-1.5">
                  <Target className="h-3.5 w-3.5 text-blue-500" />
                  {isAr ? 'قواعد مع حقول البيانات' : 'Rules with Data Fields'}
                </span>
                <span className="text-muted-foreground">
                  {stats.rulesWithFields}/{stats.totalRules}
                </span>
              </div>
              <Progress value={stats.totalRules > 0 ? (stats.rulesWithFields / stats.totalRules) * 100 : 0} className="h-2" />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-uae-green-500" />
                  {isAr ? 'معدل التفعيل' : 'Activation Rate'}
                </span>
                <span className="text-muted-foreground">
                  {stats.activeRules}/{stats.totalRules}
                </span>
              </div>
              <Progress value={stats.totalRules > 0 ? (stats.activeRules / stats.totalRules) * 100 : 0} className="h-2" />
            </div>
          </CardContent>
        </Card>

        {/* Analytics Data Section */}
        {!hasAnalytics ? (
          <Card className="border-dashed">
            <EmptyState
              icon={Activity}
              title={isAr ? 'لا توجد بيانات تحليلات' : 'No Analytics Data'}
              description={isAr
                ? 'لم يتم تسجيل أي استخدام للقواعد بعد. ستظهر البيانات هنا عندما يتفاعل العملاء مع القواعد.'
                : 'No rule usage has been recorded yet. Data will appear here when customers interact with rules.'}
              isAr={isAr}
            />
          </Card>
        ) : (
          <>
            {/* Effectiveness + Response Time */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Effectiveness */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Target className="h-4 w-4 text-ae-gold-500" />
                    {isAr ? 'فعالية القواعد' : 'Rule Effectiveness'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {analytics.effectiveness.rate !== null ? (
                    <>
                      <div className="flex items-center justify-center">
                        <div className="relative w-28 h-28">
                          <svg className="w-28 h-28 transform -rotate-90" viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="42" stroke="currentColor" strokeWidth="8" fill="none" className="text-muted/30" />
                            <circle cx="50" cy="50" r="42" stroke="currentColor" strokeWidth="8" fill="none"
                              strokeDasharray={`${analytics.effectiveness.rate * 2.64} ${264 - analytics.effectiveness.rate * 2.64}`}
                              className={analytics.effectiveness.rate >= 70 ? 'text-uae-green-500' : analytics.effectiveness.rate >= 40 ? 'text-amber-500' : 'text-uae-red-500'}
                            />
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-2xl font-bold">{analytics.effectiveness.rate}%</span>
                            <span className="text-[9px] text-muted-foreground uppercase">{isAr ? 'فعال' : 'Effective'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-center">
                        <div className="p-2 rounded-lg bg-uae-green-50 dark:bg-uae-green-900/20">
                          <div className="text-lg font-bold text-uae-green-600">{analytics.effectiveness.helpful}</div>
                          <div className="text-[9px] text-muted-foreground uppercase">{isAr ? 'مفيد' : 'Helpful'}</div>
                        </div>
                        <div className="p-2 rounded-lg bg-uae-red-50 dark:bg-uae-red-900/20">
                          <div className="text-lg font-bold text-uae-red-600">{analytics.effectiveness.notHelpful}</div>
                          <div className="text-[9px] text-muted-foreground uppercase">{isAr ? 'غير مفيد' : 'Not Helpful'}</div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-6">
                      {isAr ? 'لا توجد بيانات فعالية بعد' : 'No effectiveness data yet'}
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Response Time */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Clock className="h-4 w-4 text-ae-gold-500" />
                    {isAr ? 'وقت الاستجابة' : 'Response Time'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {analytics.responseTime.avgMs !== null ? (
                    <div className="space-y-4">
                      <div className="flex flex-col items-center justify-center">
                        <div className="text-4xl font-bold text-foreground">
                          {analytics.responseTime.avgMs >= 1000
                            ? `${(analytics.responseTime.avgMs / 1000).toFixed(1)}s`
                            : `${analytics.responseTime.avgMs}ms`}
                        </div>
                        <span className="text-[10px] text-muted-foreground uppercase mt-1">
                          {isAr ? 'متوسط وقت الاستجابة' : 'Avg Response Time'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-center">
                        <div className="p-2 rounded-lg bg-uae-green-50 dark:bg-uae-green-900/20">
                          <div className="text-sm font-bold text-uae-green-600">
                            {analytics.responseTime.minMs !== null
                              ? analytics.responseTime.minMs >= 1000
                                ? `${(analytics.responseTime.minMs / 1000).toFixed(1)}s`
                                : `${analytics.responseTime.minMs}ms`
                              : '-'}
                          </div>
                          <div className="text-[9px] text-muted-foreground uppercase">{isAr ? 'أسرع' : 'Fastest'}</div>
                        </div>
                        <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20">
                          <div className="text-sm font-bold text-amber-600">
                            {analytics.responseTime.maxMs !== null
                              ? analytics.responseTime.maxMs >= 1000
                                ? `${(analytics.responseTime.maxMs / 1000).toFixed(1)}s`
                                : `${analytics.responseTime.maxMs}ms`
                              : '-'}
                          </div>
                          <div className="text-[9px] text-muted-foreground uppercase">{isAr ? 'أبطأ' : 'Slowest'}</div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-6">
                      {isAr ? 'لا توجد بيانات وقت استجابة بعد' : 'No response time data yet'}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Hit Counts by Rule */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <MousePointerClick className="h-4 w-4 text-ae-gold-500" />
                    {isAr ? 'عدد مرات الاستخدام لكل قاعدة' : 'Rule Hit Counts'}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-[10px] h-7 px-2 gap-1 text-uae-red-500 hover:bg-uae-red-500/10"
                    onClick={() => setResetTarget({ type: 'all', value: '' })}
                  >
                    <Trash2 className="h-3 w-3" />
                    {isAr ? 'مسح الكل' : 'Clear All'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {analytics.hitCounts.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    {isAr ? 'لا توجد بيانات استخدام' : 'No hit data available'}
                  </p>
                ) : (
                  <ScrollArea className="max-h-[300px]">
                    <div className="space-y-2">
                      {analytics.hitCounts.slice(0, 20).map((hc) => {
                        const rule = rules.find(r => r.id === hc.ruleId)
                        const cat = CATEGORIES.find(c => c.key === rule?.category)
                        const maxHits = analytics.hitCounts[0]?.hits || 1
                        const pct = Math.round((hc.hits / maxHits) * 100)
                        return (
                          <div key={hc.ruleId} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30">
                            <div className={`w-7 h-7 rounded flex items-center justify-center shrink-0 ${cat?.lightColor || 'bg-gray-100 text-gray-700'}`}>
                              {cat ? <cat.icon className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-medium truncate">{getRuleName(hc.ruleId)}</span>
                                <span className="text-xs font-bold text-foreground shrink-0">{hc.hits}</span>
                              </div>
                              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                <div className="h-full rounded-full bg-purple-500 transition-all" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 shrink-0 text-muted-foreground hover:text-uae-red-500 hover:bg-uae-red-500/10"
                              onClick={() => setResetTarget({ type: 'rule', value: hc.ruleId })}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )
                      })}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            {/* Category Distribution + Channel Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Category Distribution */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-ae-gold-500" />
                    {isAr ? 'توزيع الفئات' : 'Category Distribution'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {CATEGORIES.map(cat => {
                    const catStats = stats.rulesPerCategory[cat.key]
                    const total = catStats?.total || 0
                    const active = catStats?.active || 0
                    const percentage = stats.totalRules > 0 ? Math.round((total / stats.totalRules) * 100) : 0
                    const Icon = cat.icon
                    return (
                      <div key={cat.key} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded flex items-center justify-center ${cat.lightColor}`}>
                              <Icon className="h-3.5 w-3.5" />
                            </div>
                            <span className="text-xs font-medium">{isAr ? cat.labelAr : cat.labelEn}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-muted-foreground">
                              {active}/{total} {isAr ? 'نشط' : 'active'}
                            </span>
                            <Badge className="text-[9px] px-1.5 py-0 bg-muted text-muted-foreground">{percentage}%</Badge>
                          </div>
                        </div>
                        <div className="flex gap-0.5 h-2 rounded-full overflow-hidden bg-muted">
                          <div className={`${cat.color} rounded-l-full transition-all`} style={{ width: `${stats.totalRules > 0 ? (active / stats.totalRules) * 100 : 0}%` }} />
                          <div className={`${cat.color} opacity-30 transition-all`} style={{ width: `${stats.totalRules > 0 ? ((total - active) / stats.totalRules) * 100 : 0}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>

              {/* Channel Distribution */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Activity className="h-4 w-4 text-ae-gold-500" />
                    {isAr ? 'توزيع القنوات' : 'Channel Distribution'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {analytics.channelDistribution.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      {isAr ? 'لا توجد بيانات قنوات' : 'No channel data'}
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {analytics.channelDistribution.map(ch => {
                        const channelLabels: Record<string, { en: string; ar: string; color: string }> = {
                          web: { en: 'Web', ar: 'الويب', color: 'bg-blue-500' },
                          whatsapp: { en: 'WhatsApp', ar: 'واتساب', color: 'bg-green-500' },
                          email: { en: 'Email', ar: 'البريد', color: 'bg-amber-500' },
                          voice: { en: 'Voice', ar: 'الصوت', color: 'bg-teal-500' },
                        }
                        const info = channelLabels[ch.channel] || { en: ch.channel, ar: ch.channel, color: 'bg-gray-500' }
                        const pct = analytics.totalHits > 0 ? Math.round((ch.count / analytics.totalHits) * 100) : 0
                        return (
                          <div key={ch.channel} className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium">{isAr ? info.ar : info.en}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold">{ch.count}</span>
                                <Badge className="text-[9px] px-1.5 py-0 bg-muted text-muted-foreground">{pct}%</Badge>
                              </div>
                            </div>
                            <div className="h-2 rounded-full overflow-hidden bg-muted">
                              <div className={`${info.color} h-full rounded-full transition-all`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Time-Based Trends */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-ae-gold-500" />
                  {isAr ? 'اتجاهات الاستخدام' : 'Usage Trends'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {analytics.trends.length === 0 || analytics.trends.every(t => t.hits === 0) ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    {isAr ? 'لا توجد بيانات اتجاهات' : 'No trend data available'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {/* Simple bar chart for trends */}
                    <div className="flex items-end gap-[2px] h-32 overflow-hidden">
                      {analytics.trends.filter(t => t.hits > 0).slice(-30).map((trend, idx) => (
                        <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full">
                          <div
                            className="w-full bg-purple-500/80 rounded-t-sm transition-all hover:bg-purple-500 min-h-[2px]"
                            style={{ height: `${(trend.hits / maxTrendHits) * 100}%` }}
                            title={`${trend.date}: ${trend.hits} ${isAr ? 'استخدام' : 'hits'}`}
                          />
                        </div>
                      ))}
                    </div>
                    {analytics.trends.filter(t => t.hits > 0).length > 0 && (
                      <div className="flex items-center justify-between text-[9px] text-muted-foreground">
                        <span>
                          {analytics.trends.filter(t => t.hits > 0)[0]?.date}
                        </span>
                        <span>
                          {analytics.trends.filter(t => t.hits > 0).slice(-1)[0]?.date}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Recommendations */}
        <Card className="border-blue-200 dark:border-blue-800/40 bg-blue-50/30 dark:bg-blue-900/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              {isAr ? 'توصيات التحسين' : 'Improvement Recommendations'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {stats.rulesWithoutInstructions > 0 && (
                <li className="flex items-start gap-2 text-xs text-blue-700 dark:text-blue-300">
                  <span className="mt-0.5">•</span>
                  {isAr
                    ? `أضف تعليمات الوكيل إلى ${stats.rulesWithoutInstructions} قاعدة لتحسين دقة الاستجابة`
                    : `Add agent instructions to ${stats.rulesWithoutInstructions} rules to improve response accuracy`}
                </li>
              )}
              {stats.rulesWithoutFields > 0 && (
                <li className="flex items-start gap-2 text-xs text-blue-700 dark:text-blue-300">
                  <span className="mt-0.5">•</span>
                  {isAr
                    ? `حدد حقول البيانات لـ ${stats.rulesWithoutFields} قاعدة لتمكين جمع المعلومات`
                    : `Define data fields for ${stats.rulesWithoutFields} rules to enable information collection`}
                </li>
              )}
              {stats.inactiveRules > 0 && (
                <li className="flex items-start gap-2 text-xs text-blue-700 dark:text-blue-300">
                  <span className="mt-0.5">•</span>
                  {isAr
                    ? `راجع ${stats.inactiveRules} قاعدة غير نشطة وقم بتفعيلها إذا لزم الأمر`
                    : `Review ${stats.inactiveRules} inactive rules and activate them if needed`}
                </li>
              )}
              {!hasAnalytics && (
                <li className="flex items-start gap-2 text-xs text-blue-700 dark:text-blue-300">
                  <span className="mt-0.5">•</span>
                  {isAr
                    ? 'ابدأ باستخدام القواعد في المحادثات لإنشاء بيانات التحليلات'
                    : 'Start using rules in conversations to generate analytics data'}
                </li>
              )}
              {coverageScore >= 80 && (
                <li className="flex items-start gap-2 text-uae-green-700 dark:text-uae-green-300">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  {isAr
                    ? 'درجة التغطية ممتازة! نظام القواعد يعمل بشكل جيد.'
                    : 'Coverage score is excellent! The rules system is performing well.'}
                </li>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Reset Confirmation Dialog */}
      <AlertDialog open={resetTarget !== null} onOpenChange={(open) => { if (!open) setResetTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isAr ? 'تأكيد الحذف' : 'Confirm Deletion'}</AlertDialogTitle>
            <AlertDialogDescription>
              {resetTarget?.type === 'all'
                ? (isAr ? 'هل أنت متأكد من حذف جميع بيانات التحليلات؟ لا يمكن التراجع عن هذا الإجراء.' : 'Are you sure you want to delete all analytics data? This cannot be undone.')
                : resetTarget?.type === 'category'
                  ? (isAr ? `هل أنت متأكد من حذف بيانات تحليلات فئة "${resetTarget.value}"؟` : `Delete analytics for category "${resetTarget.value}"?`)
                  : (isAr ? `هل أنت متأكد من حذف بيانات تحليلات هذه القاعدة؟` : `Delete analytics for this rule?`)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetting}>{isAr ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReset}
              disabled={resetting}
              className="bg-uae-red-600 hover:bg-uae-red-700 text-white"
            >
              {resetting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : null}
              {isAr ? 'حذف' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
