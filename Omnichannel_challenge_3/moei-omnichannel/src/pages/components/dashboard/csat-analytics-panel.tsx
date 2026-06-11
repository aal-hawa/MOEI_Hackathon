'use client'

import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Star,
  TrendingUp,
  TrendingDown,
  MessageCircle,
  Users,
  BarChart3,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  ThumbsDown,
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
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts'
import { useTranslation } from '@/i18n'
import { useAppStore } from '@/store/app-store'

// ─── Data Generators ────────────────────────────────────────────────────────

// Removed static data generators

// ─── Custom Tooltip ──────────────────────────────────────────────────────────
function CSATTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2 shadow-lg">
      <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-xs font-medium" style={{ color: entry.color }}>
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function CSATAnalyticsPanel() {
  const { t } = useTranslation()
  const kpis = useAppStore((s) => s.kpis)
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d')
  const [expandedFeedback, setExpandedFeedback] = useState<string | null>(null)

  const periodDays = period === '7d' ? 7 : period === '30d' ? 30 : 90
  const [csatTrendData, setCsatTrendData] = useState<any[]>([])
  const [channelCSATData, setChannelCSATData] = useState<any[]>([])
  const [feedbackKeywords, setFeedbackKeywords] = useState<any[]>([])
  const [recentFeedbackData, setRecentFeedbackData] = useState<any[]>([])
  const [improvementAreasData, setImprovementAreasData] = useState<any[]>([])

  useEffect(() => {
    fetch(`/api/dashboard/csat?period=${period}`)
      .then(res => res.json())
      .then(data => {
        if (!data.error) {
          setCsatTrendData(data.csatTrendData || [])
          setChannelCSATData(data.channelCSATData || [])
          setFeedbackKeywords(data.feedbackKeywords || [])
          setImprovementAreasData(data.improvementAreasData || [])
          setRecentFeedbackData(data.recentFeedbackData || [])
        }
      })
      .catch(console.error)
  }, [period])

  const avgScore = useMemo(() => {
    if (!csatTrendData.length) return 0
    const sum = csatTrendData.reduce((a, b) => a + b.score, 0)
    return Math.round((sum / csatTrendData.length) * 10) / 10
  }, [csatTrendData])

  const sentimentColor = (val: number) => {
    if (val >= 0.7) return 'bg-uae-green-500'
    if (val >= 0.4) return 'bg-camel-yellow'
    return 'bg-uae-red-500'
  }

  const wordColor = (sentiment: 'positive' | 'neutral' | 'negative') => {
    if (sentiment === 'positive') return 'bg-uae-green-50 text-uae-green-700 border-uae-green-200 dark:bg-uae-green-950/30 dark:text-uae-green-400 dark:border-uae-green-800'
    if (sentiment === 'neutral') return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800'
    return 'bg-uae-red-50 text-uae-red-700 border-uae-red-200 dark:bg-uae-red-950/30 dark:text-uae-red-400 dark:border-uae-red-800'
  }

  const wordSize = (count: number) => {
    const max = Math.max(...feedbackKeywords.map(k => k.count))
    const min = Math.min(...feedbackKeywords.map(k => k.count))
    const ratio = (count - min) / (max - min)
    return `${0.7 + ratio * 0.6}rem`
  }

  const severityColor = (severity: 'high' | 'medium' | 'low') => {
    if (severity === 'high') return 'bg-uae-red-500'
    if (severity === 'medium') return 'bg-camel-yellow'
    return 'bg-uae-green-500'
  }

  const barChannelData = useMemo(() =>
    channelCSATData.map(ch => ({
      channel: ch.channel,
      score: ch.score,
      fill: ch.color,
    })), [])

  return (
    <section>
      {/* Section header with star icon and gradient accent */}
      <div className="mb-4 flex items-center gap-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/30">
            <Star className="h-4 w-4 text-amber-600" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">{t('csatAnalytics')}</h3>
            <p className="text-[11px] text-muted-foreground">{t('csatAnalyticsDesc')}</p>
          </div>
        </div>
        <div className="ml-auto h-0.5 flex-1 bg-gradient-to-r from-amber-400/40 to-transparent rounded" />
      </div>

      {/* 1. CSAT Score Overview - Top row with 4 metric cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {/* Overall CSAT */}
        <Card className="py-3 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400 opacity-50" />
          <CardContent className="px-4 pt-0">
            <div className="flex items-center gap-2 mb-2">
              <Star className="h-4 w-4 text-amber-500" />
              <span className="text-[11px] font-medium text-muted-foreground">{t('overallCSAT')}</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <motion.span
                className="text-2xl font-bold text-foreground"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                {kpis.csat.toFixed(1)}
              </motion.span>
              <span className="text-sm text-muted-foreground">/5.0</span>
            </div>
            <div className="flex items-center gap-0.5 mt-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`h-3 w-3 ${i < Math.round(kpis.csat) ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/30'}`}
                />
              ))}
              <TrendingUp className="h-3 w-3 text-uae-green-600 ml-1" />
              <span className="text-[10px] text-uae-green-600">+0.2</span>
            </div>
          </CardContent>
        </Card>

        {/* NPS Score */}
        <Card className="py-3 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-brand-400 via-brand-500 to-brand-400 opacity-50" />
          <CardContent className="px-4 pt-0">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="h-4 w-4 text-brand-600" />
              <span className="text-[11px] font-medium text-muted-foreground">{t('npsScore')}</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-brand-600">0</span>
            </div>
            <div className="flex items-center gap-1.5 mt-1.5">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-uae-green-500" />
                <span className="text-[9px] text-muted-foreground">{t('promoters')} 0%</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-camel-yellow" />
                <span className="text-[9px] text-muted-foreground">{t('passives')} 0%</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-uae-red-500" />
                <span className="text-[9px] text-muted-foreground">{t('detractors')} 0%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Response Rate */}
        <Card className="py-3 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-400 via-purple-500 to-purple-400 opacity-50" />
          <CardContent className="px-4 pt-0">
            <div className="flex items-center gap-2 mb-2">
              <MessageCircle className="h-4 w-4 text-purple-600" />
              <span className="text-[11px] font-medium text-muted-foreground">{t('responseRate')}</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-foreground">0%</span>
            </div>
            <div className="flex items-center gap-1 mt-1">
              <span className="text-[10px] text-muted-foreground">0%</span>
              <span className="text-[9px] text-muted-foreground ml-0.5">vs last month</span>
            </div>
          </CardContent>
        </Card>

        {/* Total Responses */}
        <Card className="py-3 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-teal-400 via-teal-500 to-teal-400 opacity-50" />
          <CardContent className="px-4 pt-0">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-teal-600" />
              <span className="text-[11px] font-medium text-muted-foreground">{t('totalResponses')}</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-foreground">0</span>
            </div>
            <div className="flex items-center gap-1 mt-1">
              <span className="text-[10px] text-muted-foreground">0</span>
              <span className="text-[9px] text-muted-foreground ml-0.5">this month</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 2. CSAT Trend Chart + 3. Channel-wise CSAT */}
      <div className="grid gap-4 md:grid-cols-2 mb-4">
        {/* CSAT Trend Area Chart */}
        <Card className="py-4 shadow-sm">
          <CardHeader className="px-4 pb-0 pt-0">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold">{t('csatTrend')}</CardTitle>
                <CardDescription className="text-[11px]">{t('csatTrendDesc')}</CardDescription>
              </div>
              <div className="flex items-center gap-1">
                {(['7d', '30d', '90d'] as const).map((p) => (
                  <Button
                    key={p}
                    variant={period === p ? 'default' : 'ghost'}
                    size="sm"
                    className={`h-6 text-[10px] px-2 ${period === p ? 'bg-brand-600 text-white' : 'text-muted-foreground'}`}
                    onClick={() => setPeriod(p)}
                  >
                    {t(`period${p.charAt(0).toUpperCase() + p.slice(1)}` as Parameters<typeof t>[0])}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-4 pt-3">
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={csatTrendData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="csatGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0D9488" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#0D9488" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-base-100)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 9, fill: 'var(--color-base-400)' }}
                    tickLine={false}
                    axisLine={false}
                    interval={period === '7d' ? 0 : period === '30d' ? 4 : 9}
                  />
                  <YAxis
                    domain={[3, 5]}
                    tick={{ fontSize: 9, fill: 'var(--color-base-400)' }}
                    tickLine={false}
                    axisLine={false}
                    width={30}
                  />
                  <Tooltip content={<CSATTooltip />} />
                  <ReferenceLine y={avgScore} stroke="#0D9488" strokeDasharray="4 4" strokeOpacity={0.5} />
                  <Area
                    type="monotone"
                    dataKey="score"
                    stroke="#0D9488"
                    strokeWidth={2}
                    fill="url(#csatGradient)"
                    name={t('csat')}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Channel-wise CSAT Horizontal Bar Chart */}
        <Card className="py-4 shadow-sm">
          <CardHeader className="px-4 pb-0 pt-0">
            <CardTitle className="text-sm font-semibold">{t('channelCSAT')}</CardTitle>
            <CardDescription className="text-[11px]">{t('channelCSATDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pt-3">
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barChannelData} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-base-100)" horizontal={false} />
                  <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 9, fill: 'var(--color-base-400)' }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="channel" tick={{ fontSize: 10, fill: 'var(--color-base-400)' }} tickLine={false} axisLine={false} width={70} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const data = payload[0]
                      return (
                        <div className="rounded-lg border border-border bg-background px-3 py-2 shadow-lg">
                          <p className="text-xs font-medium" style={{ color: data.payload.fill }}>
                            {data.payload.channel}: {data.value}/5.0
                          </p>
                        </div>
                      )
                    }}
                  />
                  <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={20}>
                    {barChannelData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 4. Feedback Word Cloud + 6. Improvement Areas */}
      <div className="grid gap-4 md:grid-cols-2 mb-4">
        {/* Feedback Word Cloud */}
        <Card className="py-4 shadow-sm">
          <CardHeader className="px-4 pb-0 pt-0">
            <CardTitle className="text-sm font-semibold">{t('feedbackThemes')}</CardTitle>
            <CardDescription className="text-[11px]">{t('feedbackThemesDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pt-3">
            <div className="flex flex-wrap gap-2 items-center justify-center min-h-[140px]">
              {feedbackKeywords.map((kw, index) => (
                <motion.span
                  key={`${kw.word}-${index}`}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: Math.random() * 0.3 }}
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-medium ${wordColor(kw.sentiment)}`}
                  style={{ fontSize: wordSize(kw.count) }}
                >
                  {kw.word}
                </motion.span>
              ))}
            </div>
            <div className="flex items-center gap-4 mt-3 justify-center">
              <div className="flex items-center gap-1">
                <div className="h-2.5 w-2.5 rounded-full bg-uae-green-500" />
                <span className="text-[9px] text-muted-foreground">{t('positive')}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-2.5 w-2.5 rounded-full bg-camel-yellow" />
                <span className="text-[9px] text-muted-foreground">{t('neutral')}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-2.5 w-2.5 rounded-full bg-uae-red-500" />
                <span className="text-[9px] text-muted-foreground">{t('negative')}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Improvement Areas */}
        <Card className="py-4 shadow-sm">
          <CardHeader className="px-4 pb-0 pt-0">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              {t('improvementAreas')}
            </CardTitle>
            <CardDescription className="text-[11px]">{t('improvementAreasDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pt-3">
            <div className="space-y-3">
              {improvementAreasData.map((area, i) => (
                <motion.div
                  key={`${area.category}-${i}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-center gap-3 rounded-lg border p-3 bg-card hover:shadow-sm transition-shadow"
                >
                  {/* Severity indicator */}
                  <div className="flex flex-col items-center gap-1">
                    <div className={`w-3 h-3 rounded-full ${severityColor(area.severity)}`} />
                    {area.severity === 'high' && (
                      <span className="flex h-2 w-2">
                        <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-uae-red-400 opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-uae-red-500" />
                      </span>
                    )}
                  </div>
                  {/* Area details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-foreground">{t(area.category as Parameters<typeof t>[0])}</span>
                      <span className="text-sm font-bold text-foreground">{area.avgScore}/5</span>
                    </div>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden mb-1">
                      <div
                        className={`h-full rounded-full ${area.severity === 'high' ? 'bg-uae-red-500' : area.severity === 'medium' ? 'bg-camel-yellow' : 'bg-uae-green-500'}`}
                        style={{ width: `${(area.avgScore / 5) * 100}%` }}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      {area.trend < 0 ? (
                        <TrendingDown className="h-3 w-3 text-uae-red-600" />
                      ) : (
                        <TrendingUp className="h-3 w-3 text-uae-green-600" />
                      )}
                      <span className={`text-[10px] ${area.trend < 0 ? 'text-uae-red-600' : 'text-uae-green-600'}`}>
                        {area.trend > 0 ? '+' : ''}{area.trend}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {area.mentions} {t('mentions')}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 5. Recent Feedback List */}
      <Card className="py-4 shadow-sm">
        <CardHeader className="px-4 pb-0 pt-0">
          <CardTitle className="text-sm font-semibold">{t('recentFeedback')}</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pt-2">
          <div className="max-h-80 overflow-y-auto custom-scrollbar space-y-1.5">
            {recentFeedbackData.map((fb) => (
              <motion.div
                key={fb.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-lg border p-3 hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={() => setExpandedFeedback(expandedFeedback === fb.id ? null : fb.id)}
              >
                <div className="flex items-center gap-2">
                  {/* Sentiment dot */}
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${sentimentColor(fb.sentiment)}`} />
                  {/* Name */}
                  <span className="text-xs font-medium text-foreground min-w-0 truncate">
                    {fb.name}
                  </span>
                  {/* Rating stars */}
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`h-2.5 w-2.5 ${i < fb.rating ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/20'}`} />
                    ))}
                  </div>
                  {/* Channel badge */}
                  <Badge variant="outline" className="text-[9px] h-4 px-1.5 flex-shrink-0">
                    {fb.channel}
                  </Badge>
                  {/* Date */}
                  <span className="text-[10px] text-muted-foreground ml-auto flex-shrink-0">{fb.date}</span>
                  {/* Expand icon */}
                  {expandedFeedback === fb.id ? (
                    <ChevronUp className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  ) : (
                    <ChevronDown className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  )}
                </div>
                {/* Comment excerpt */}
                <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1">
                  {fb.comment}
                </p>
                {/* Expanded full comment */}
                <AnimatePresence>
                  {expandedFeedback === fb.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <p className="text-xs text-foreground mt-2 p-2 rounded-md bg-muted/50 border">
                        {fb.comment}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
