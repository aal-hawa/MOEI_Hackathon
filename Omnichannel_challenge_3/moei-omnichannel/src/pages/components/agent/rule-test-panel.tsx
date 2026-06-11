'use client'

import { useState, useCallback } from 'react'
import {
  Play,
  Loader2,
  Sparkles,
  Brain,
  Send,
  AlertTriangle,
  CheckCircle2,
  X,
  Filter,
  MessageSquare,
  Zap,
  Shield,
  TrendingUp,
  BarChart3,
  Target,
  Info,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useAppStore } from '@/store/app-store'
import { useTranslation } from '@/i18n'

// ─── Types ───────────────────────────────────────────────────────────────────

interface RuleTestResult {
  response: string
  rulesUsed: Array<{ id: string; nameEn: string; nameAr: string; category: string }>
  language: 'en' | 'ar'
  intent: string
  sentiment: {
    score: number
    emotion: string
    urgency: string
    recommendedAction: string
  }
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
}

// ─── Category Config ─────────────────────────────────────────────────────────

const CATEGORIES = [
  { key: 'electricity_water', labelEn: 'Electricity & Water', labelAr: 'الكهرباء والمياه', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  { key: 'housing', labelEn: 'Housing', labelAr: 'الإسكان', color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' },
  { key: 'petroleum', labelEn: 'Petroleum', labelAr: 'البترول', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  { key: 'transport', labelEn: 'Transport', labelAr: 'النقل', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  { key: 'sustainability', labelEn: 'Sustainability', labelAr: 'الاستدامة', color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' },
  { key: 'general', labelEn: 'General', labelAr: 'عام', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800/30 dark:text-gray-400' },
]

// ─── Sentiment Helpers ────────────────────────────────────────────────────────

function getSentimentColor(score: number): string {
  if (score >= 0.65) return 'text-uae-green-600'
  if (score >= 0.35) return 'text-amber-600'
  return 'text-uae-red-600'
}

function getSentimentBg(score: number): string {
  if (score >= 0.65) return 'bg-uae-green-500'
  if (score >= 0.35) return 'bg-amber-500'
  return 'bg-uae-red-500'
}

function getUrgencyBadge(urgency: string) {
  const styles: Record<string, string> = {
    low: 'bg-uae-green-100 text-uae-green-700 dark:bg-uae-green-900/30 dark:text-uae-green-400',
    medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    critical: 'bg-uae-red-100 text-uae-red-700 dark:bg-uae-red-900/30 dark:text-uae-red-400',
  }
  return styles[urgency] || styles.low
}

function getIntentBadge(intent: string) {
  const styles: Record<string, string> = {
    inquiry: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    complaint: 'bg-uae-red-100 text-uae-red-700 dark:bg-uae-red-900/30 dark:text-uae-red-400',
    service_request: 'bg-uae-green-100 text-uae-green-700 dark:bg-uae-green-900/30 dark:text-uae-green-400',
    case_status: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    emergency: 'bg-red-200 text-red-800 dark:bg-red-900/50 dark:text-red-300',
    billing: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    suggestion: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
    appreciation: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    other: 'bg-gray-100 text-gray-700 dark:bg-gray-800/30 dark:text-gray-400',
  }
  return styles[intent] || styles.other
}

// ─── Rule Test Panel ──────────────────────────────────────────────────────────

export default function RuleTestPanel() {
  const { language } = useAppStore()
  const { t } = useTranslation()
  const isAr = language === 'ar'

  // Test state
  const [testMessage, setTestMessage] = useState('')
  const [testCategory, setTestCategory] = useState<string>('all')
  const [testLanguage, setTestLanguage] = useState<string>('auto')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<RuleTestResult | null>(null)
  const [testError, setTestError] = useState<string | null>(null)

  // Quick test presets
  const QUICK_TESTS = [
    { labelEn: 'Electricity bill inquiry', labelAr: 'استفسار عن فاتورة الكهرباء', category: 'electricity_water' },
    { labelEn: 'Apply for housing loan', labelAr: 'التقدم لقرض إسكاني', category: 'housing' },
    { labelEn: 'Report power outage', labelAr: 'الإبلاغ عن انقطاع الكهرباء', category: 'electricity_water' },
    { labelEn: 'New water connection', labelAr: 'توصيل مياه جديد', category: 'electricity_water' },
    { labelEn: 'Petroleum license renewal', labelAr: 'تجديد رخصة البترول', category: 'petroleum' },
    { labelEn: 'Solar energy permit', labelAr: 'تصريح الطاقة الشمسية', category: 'sustainability' },
    { labelEn: 'Transport vehicle permit', labelAr: 'تصريح مركبة نقل', category: 'transport' },
    { labelEn: 'Check my case status', labelAr: 'التحقق من حالة قضيتي', category: 'general' },
    { labelEn: 'Angry complaint about water quality', labelAr: 'شكوى غاضبة عن جودة المياه', category: 'electricity_water' },
    { labelEn: 'Thank you for excellent service', labelAr: 'شكراً على الخدمة الممتازة', category: 'general' },
  ]

  const handleTest = useCallback(async () => {
    if (!testMessage.trim()) return

    setTesting(true)
    setTestError(null)
    setTestResult(null)

    try {
      const body: Record<string, unknown> = {
        message: testMessage,
      }

      if (testLanguage !== 'auto') {
        body.language = testLanguage
      }
      if (testCategory !== 'all') {
        body.category = testCategory
      }

      const res = await fetch('/api/service-rules/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Test failed')
      }

      const result: RuleTestResult = await res.json()
      setTestResult(result)
    } catch (err) {
      setTestError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setTesting(false)
    }
  }, [testMessage, testCategory, testLanguage])

  const handleQuickTest = (preset: typeof QUICK_TESTS[number]) => {
    setTestMessage(isAr ? preset.labelAr : preset.labelEn)
    setTestCategory(preset.category)
  }

  return (
    <div className="h-full flex flex-col" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="px-4 sm:px-6 py-4 border-b border-border bg-gradient-to-r from-background to-purple-500/5">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-purple-500" />
          <div>
            <h2 className="text-lg font-bold text-foreground">
              {isAr ? 'اختبار قواعد الذكاء الاصطناعي' : 'AI Rule Testing'}
            </h2>
            <p className="text-xs text-muted-foreground">
              {isAr
                ? 'اختبر كيف يستجيب وكيل الذكاء الاصطناعي مع القواعد النشطة'
                : 'Test how the AI agent responds with active service rules'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar space-y-6">
        {/* Test Input Section */}
        <Card className="border-purple-200 dark:border-purple-800/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-purple-500" />
              {isAr ? 'رسالة الاختبار' : 'Test Message'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Test message input */}
            <div className="space-y-2">
              <Textarea
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                placeholder={isAr
                  ? 'أدخل رسالة العميل للاختبار...'
                  : 'Enter a customer message to test...'}
                className="min-h-[80px] text-sm"
                dir={isAr ? 'rtl' : 'ltr'}
              />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
              <div className="flex-1 min-w-[140px]">
                <Select value={testCategory} onValueChange={setTestCategory}>
                  <SelectTrigger className="text-xs h-8">
                    <Filter className="h-3 w-3 mr-1" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{isAr ? 'جميع الفئات' : 'All Categories'}</SelectItem>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat.key} value={cat.key}>
                        {isAr ? cat.labelAr : cat.labelEn}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-[120px]">
                <Select value={testLanguage} onValueChange={setTestLanguage}>
                  <SelectTrigger className="text-xs h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">{isAr ? 'تلقائي' : 'Auto Detect'}</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="ar">العربية</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleTest}
                disabled={!testMessage.trim() || testing}
                className="bg-purple-600 hover:bg-purple-700 text-white gap-2 text-xs h-8"
              >
                {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                {isAr ? 'تشغيل الاختبار' : 'Run Test'}
              </Button>
            </div>

            {/* Quick Test Presets */}
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                {isAr ? 'اختبارات سريعة' : 'Quick Tests'}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_TESTS.map((preset, i) => (
                  <button
                    key={i}
                    onClick={() => handleQuickTest(preset)}
                    className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-900/20 dark:text-purple-400 dark:hover:bg-purple-900/30 transition-colors border border-purple-200/60 dark:border-purple-800/30"
                  >
                    {isAr ? preset.labelAr : preset.labelEn}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Error Display */}
        {testError && (
          <Card className="border-uae-red-200 dark:border-uae-red-800/40 bg-uae-red-50/50 dark:bg-uae-red-900/10">
            <CardContent className="p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-uae-red-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-sm text-uae-red-700 dark:text-uae-red-400">
                  {isAr ? 'فشل الاختبار' : 'Test Failed'}
                </h4>
                <p className="text-xs text-uae-red-600/80 dark:text-uae-red-400/80 mt-1">{testError}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Test Result */}
        {testResult && (
          <div className="space-y-4">
            {/* AI Response */}
            <Card className="border-purple-200 dark:border-purple-800/40">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-500" />
                  {isAr ? 'استجابة وكيل الذكاء الاصطناعي' : 'AI Agent Response'}
                  <Badge className="ml-auto text-[9px] bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                    {testResult.language === 'ar' ? 'العربية' : 'English'}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-muted/50 rounded-lg p-4 text-sm leading-relaxed whitespace-pre-wrap">
                  {testResult.response}
                </div>
              </CardContent>
            </Card>

            {/* Analysis Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Intent */}
              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[10px] font-medium text-muted-foreground uppercase">
                      {isAr ? 'النية' : 'Intent'}
                    </span>
                  </div>
                  <Badge className={`${getIntentBadge(testResult.intent)} text-xs px-2.5 py-0.5 capitalize`}>
                    {testResult.intent}
                  </Badge>
                </CardContent>
              </Card>

              {/* Sentiment */}
              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[10px] font-medium text-muted-foreground uppercase">
                      {isAr ? 'المشاعر' : 'Sentiment'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${getSentimentBg(testResult.sentiment.score)}`}
                        style={{ width: `${testResult.sentiment.score * 100}%` }}
                      />
                    </div>
                    <span className={`text-xs font-bold ${getSentimentColor(testResult.sentiment.score)}`}>
                      {(testResult.sentiment.score * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <Badge className={`${getUrgencyBadge(testResult.sentiment.urgency)} text-[9px] px-1.5 capitalize`}>
                      {testResult.sentiment.urgency}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground capitalize">{testResult.sentiment.emotion}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Rules Used */}
              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[10px] font-medium text-muted-foreground uppercase">
                      {isAr ? 'القواعد المستخدمة' : 'Rules Used'}
                    </span>
                  </div>
                  <span className="text-lg font-bold text-foreground">{testResult.rulesUsed.length}</span>
                  <span className="text-xs text-muted-foreground ml-1">
                    {isAr ? 'قاعدة نشطة' : 'active rules'}
                  </span>
                </CardContent>
              </Card>
            </div>

            {/* Recommended Action */}
            {testResult.sentiment.recommendedAction && (
              <Card className="border-blue-200 dark:border-blue-800/40 bg-blue-50/30 dark:bg-blue-900/10">
                <CardContent className="p-3 flex items-start gap-2">
                  <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400 uppercase">
                      {isAr ? 'الإجراء الموصى به' : 'Recommended Action'}
                    </span>
                    <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
                      {testResult.sentiment.recommendedAction}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Rules Applied */}
            {testResult.rulesUsed.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold flex items-center gap-2">
                    <Zap className="h-3.5 w-3.5 text-ae-gold-500" />
                    {isAr ? 'القواعد المطبقة على هذا الاختبار' : 'Rules Applied to This Test'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto custom-scrollbar">
                    {testResult.rulesUsed.map((rule) => {
                      const cat = CATEGORIES.find(c => c.key === rule.category)
                      return (
                        <TooltipProvider key={rule.id}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge
                                className={`${cat?.color || 'bg-gray-100 text-gray-700'} text-[9px] px-2 py-0.5 cursor-help`}
                              >
                                {isAr ? rule.nameAr : rule.nameEn}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs">{isAr ? rule.nameAr : rule.nameEn}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {isAr ? cat?.labelAr : cat?.labelEn}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Loading State */}
        {testing && !testResult && (
          <Card className="border-purple-200 dark:border-purple-800/40">
            <CardContent className="p-8 flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 text-purple-500 animate-spin" />
              <p className="text-sm text-muted-foreground">
                {isAr ? 'يقوم وكيل الذكاء الاصطناعي بمعالجة رسالتك...' : 'AI agent is processing your message...'}
              </p>
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full bg-purple-400 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
