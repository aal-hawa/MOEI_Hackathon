'use client'

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  Clock,
  Target,
  Star,
  ArrowDownRight,
  AlertTriangle,
  FolderOpen,
  Users,
  TrendingUp,
  TrendingDown,
  Phone,
  MessageCircle,
  Globe,
  AlertCircle,
  Zap,
  UserCheck,
  Download,
  Filter,
  Brain,
  Bell,
  UserPlus,
  ArrowUp,
  Eye,
  FileText,
  ChevronLeft,
  RotateCcw,
  X,
  CalendarDays,
  BarChart3,
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
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  AreaChart,
  Area,
  ComposedChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { useTranslation } from '@/i18n'
import { useAppStore } from '@/store/app-store'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'
import AIInsightsPanel from '@/components/dashboard/ai-insights-panel'
import CSATAnalyticsPanel from '@/components/dashboard/csat-analytics-panel'
import SystemHealthDashboard from '@/components/dashboard/system-health-dashboard'
import AIPerformancePanel from '@/components/dashboard/ai-performance-panel'
import GeoDistributionPanel from '@/components/dashboard/geo-distribution-panel'
import CompliancePanel from '@/components/dashboard/compliance-panel'
import AIQualityDashboard from '@/components/dashboard/ai-quality-dashboard'
import AILeadershipAdvisor from '@/components/dashboard/ai-leadership-advisor'

// ─── Animated Counter Hook ───────────────────────────────────────────────────
function useAnimatedCounter(target: number, duration = 800) {
  const [value, setValue] = useState(0)
  const prevTarget = useRef(target)

  useEffect(() => {
    if (prevTarget.current === target && value !== 0) return
    prevTarget.current = target

    const start = value
    const diff = target - start
    if (diff === 0) return

    const startTime = performance.now()
    let rafId: number

    const animate = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(start + diff * eased))

      if (progress < 1) {
        rafId = requestAnimationFrame(animate)
      }
    }

    rafId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafId)
  }, [target])

  return value
}

// ─── Skeleton Component ────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <Card className="relative overflow-hidden py-4">
      <CardContent className="flex items-start gap-4 px-4 pt-0">
        <div className="h-11 w-11 shrink-0 rounded-lg bg-muted animate-pulse" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-6 w-20 rounded bg-muted animate-pulse" />
          <div className="h-3 w-28 rounded bg-muted animate-pulse" />
          <div className="h-3 w-16 rounded bg-muted animate-pulse" />
        </div>
      </CardContent>
    </Card>
  )
}

function SkeletonChart() {
  return (
    <Card className="py-4">
      <CardHeader className="px-4 pb-0 pt-0">
        <div className="h-5 w-32 rounded bg-muted animate-pulse mb-1" />
        <div className="h-3 w-48 rounded bg-muted animate-pulse" />
      </CardHeader>
      <CardContent className="px-4 pt-4">
        <div className="h-72 rounded-lg bg-muted/50 animate-pulse" />
      </CardContent>
    </Card>
  )
}

// ─── Types ───────────────────────────────────────────────────────────────────
interface KPIConfig {
  key: string
  translationKey: 'totalInteractions' | 'avgResolutionTime' | 'firstContactResolution' | 'csat' | 'selfServiceDeflection' | 'escalationRate' | 'activeCasesCount' | 'agentsOnline'
  icon: React.ElementType
  format: (v: number) => string
  color: string
  bgColor: string
  trendKey: string
  sparkColor: string
}

interface PredictionData {
  volumeForecast: {
    hour: string
    predictedVolume: number
    confidence: number
  }[]
  escalationRisks: {
    caseId: string
    title: string
    customerName: string
    riskLevel: 'high' | 'medium' | 'low'
    riskReason: string
    sentiment: number
    daysOpen: number
    caseRef?: string
  }[]
  workforceRecommendation: {
    currentStaffing: number
    currentOnline: number
    recommendedStaffing: number
    peakHours: { start: string; end: string; recommendedAgents: number }[]
    averageCasesPerAgent: number
    predictedVolumeIncrease: number
    suggestedAction: string
    channelBreakdown?: { channel: string; current: number; recommended: number }[]
  }
}

// ─── Sparkline Component ─────────────────────────────────────────────────────
function Sparkline({ data, color, width = 80, height = 28 }: { data: number[]; color: string; width?: number; height?: number }) {
  if (data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const padding = 2

  const points = data.map((v, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2)
    const y = height - padding - ((v - min) / range) * (height - padding * 2)
    return `${x},${y}`
  })

  const pathD = `M${points.join(' L')}`

  return (
    <svg width={width} height={height} className="opacity-60">
      <path d={pathD} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─── Gauge Chart Component ───────────────────────────────────────────────────
function GaugeChart({ value, max, label, color }: { value: number; max: number; label: string; color: string }) {
  const percentage = Math.min((value / max) * 100, 100)
  const angle = (percentage / 100) * 180

  return (
    <div className="flex flex-col items-center">
      <svg width={100} height={60} viewBox="0 0 100 60">
        <path d="M 10 55 A 40 40 0 0 1 90 55" fill="none" stroke="var(--color-base-100)" strokeWidth={8} strokeLinecap="round" />
        <path d="M 10 55 A 40 40 0 0 1 90 55" fill="none" stroke={color} strokeWidth={8} strokeLinecap="round"
          strokeDasharray={`${angle * 0.7} 200`} />
        <text x="50" y="50" textAnchor="middle" className="fill-foreground text-sm font-bold" fontSize="14">{value}</text>
      </svg>
      <span className="text-[10px] text-muted-foreground mt-0.5">{label}</span>
    </div>
  )
}

// ─── Mini Comparison Bar ────────────────────────────────────────────────────
function MiniComparisonBar({ current, previous, color }: { current: number; previous: number; color: string }) {
  const maxVal = Math.max(current, previous, 1)
  return (
    <div className="flex items-end gap-1 h-6">
      <div className="flex flex-col items-center gap-px">
        <div className="w-3 rounded-t-sm bg-muted-foreground/20" style={{ height: `${(previous / maxVal) * 20}px` }} />
        <span className="text-[7px] text-muted-foreground">{previous}</span>
      </div>
      <div className="flex flex-col items-center gap-px">
        <div className="w-3 rounded-t-sm" style={{ height: `${(current / maxVal) * 20}px`, backgroundColor: color }} />
        <span className="text-[7px] font-medium text-foreground">{current}</span>
      </div>
    </div>
  )
}

// ─── KPI Card Component with Sparkline + Comparison ──────────────────────────
function KPICard({
  config,
  value,
  trend,
  isLive,
  sparkData,
  compareMode,
  comparisonPeriod,
  previousValue,
}: {
  config: KPIConfig
  value: number
  trend: number
  isLive: boolean
  sparkData: number[]
  compareMode: boolean
  comparisonPeriod: 'daily' | 'weekly' | 'monthly'
  previousValue: number
}) {
  const { t } = useTranslation()
  const animatedValue = useAnimatedCounter(
    config.key === 'csat' ? Math.round(value * 10) : Math.round(value)
  )
  const Icon = config.icon
  const displayValue =
    config.key === 'csat'
      ? `${(animatedValue / 10).toFixed(1)}/5.0`
      : config.format(config.key === 'csat' ? value : animatedValue)

  const isPositiveTrend = trend > 0
  const isNegativeTrend = trend < 0
  const isGoodTrend = config.key === 'escalationRate' || config.key === 'avgResolutionTime'
    ? isNegativeTrend
    : isPositiveTrend

  const pctChange = previousValue > 0 ? Math.round(((value - previousValue) / previousValue) * 100) : 0
  const isImprovement = config.key === 'escalationRate' || config.key === 'avgResolutionTime'
    ? pctChange < 0
    : pctChange > 0

  return (
    <Card className="relative overflow-hidden py-4 transition-all hover:shadow-md">
      {/* Gradient top accent with shimmer */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-brand-400 to-transparent opacity-50 kpi-shimmer-line" />
      {isLive && (
        <span className="absolute top-3 right-3 flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-uae-green-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-uae-green-600" />
        </span>
      )}
      <CardContent className="flex items-start gap-4 px-4 pt-0">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${config.bgColor}`}
        >
          <Icon className={`h-5 w-5 ${config.color}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between">
            <div>
              <motion.p
                className="text-2xl font-bold tracking-tight text-foreground"
                key={`${config.key}-${value}`}
                initial={{ opacity: 0.7, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
              >
                {displayValue}
              </motion.p>
              <p className="mt-0.5 text-xs font-medium text-muted-foreground truncate">
                {t(config.translationKey)}
              </p>
            </div>
            <div className="shrink-0 mt-1 flex items-center gap-2">
              {compareMode && previousValue > 0 && (
                <MiniComparisonBar current={value} previous={previousValue} color={config.sparkColor} />
              )}
              <Sparkline data={sparkData} color={config.sparkColor} />
            </div>
          </div>
          {trend !== 0 && (
            <div className="mt-1 flex items-center gap-1">
              {isGoodTrend ? (
                <TrendingUp className="h-3 w-3 text-uae-green-600" />
              ) : (
                <TrendingDown className="h-3 w-3 text-uae-red-600" />
              )}
              <span
                className={`text-[11px] font-medium ${
                  isGoodTrend ? 'text-uae-green-600' : 'text-uae-red-600'
                }`}
              >
                {trend > 0 ? '+' : ''}
                {trend}%
              </span>
              <ArrowUp className={`h-3 w-3 ${isGoodTrend ? 'text-uae-green-600 rotate-0' : 'text-uae-red-600 rotate-180'}`} />
              {compareMode && pctChange !== 0 && (
                <span className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full ${
                  isImprovement
                    ? 'bg-uae-green-50 text-uae-green-700 dark:bg-uae-green-950/30 dark:text-uae-green-400'
                    : 'bg-uae-red-50 text-uae-red-700 dark:bg-uae-red-950/30 dark:text-uae-red-400'
                }`}>
                  {t('vsPrevious' as Parameters<typeof t>[0])} {pctChange > 0 ? '+' : ''}{pctChange}%
                </span>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Queue Channel Card ──────────────────────────────────────────────────────
function QueueChannelCard({
  channel,
  data,
  icon: Icon,
}: {
  channel: string
  data: { waiting: number; avgWait: number; activeAgents: number }
  icon: React.ElementType
}) {
  const { t } = useTranslation()
  const channelTranslations: Record<string, string> = {
    'Voice': t('voice' as Parameters<typeof t>[0]),
    'WhatsApp': t('whatsapp' as Parameters<typeof t>[0]),
    'Web': t('webChat' as Parameters<typeof t>[0]),
  }
  const maxCapacity = 50
  const load = Math.min((data.waiting / maxCapacity) * 100, 100)
  const loadColor =
    data.avgWait < 120
      ? 'bg-uae-green-500'
      : data.avgWait < 300
        ? 'bg-camel-yellow'
        : 'bg-uae-red-500'
  const statusColor =
    data.avgWait < 120
      ? 'text-uae-green-600'
      : data.avgWait < 300
        ? 'text-camel-yellow'
        : 'text-uae-red-600'

  const formatWait = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return s > 0 ? `${m}m ${s}s` : `${m}m`
  }

  return (
    <Card className="py-4 transition-shadow hover:shadow-sm">
      <CardHeader className="px-4 pb-0 pt-0">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-brand-600" />
          <CardTitle className="text-sm font-semibold">{channelTranslations[channel] || channel}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-4 pt-2">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-lg font-bold text-foreground">{data.waiting}</p>
            <p className="text-[10px] text-muted-foreground">{t('waiting')}</p>
          </div>
          <div>
            <p className={`text-lg font-bold ${statusColor}`}>
              {formatWait(data.avgWait)}
            </p>
            <p className="text-[10px] text-muted-foreground">{t('avgWait')}</p>
          </div>
          <div>
            <p className="text-lg font-bold text-foreground">
              {data.activeAgents}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {t('agentsOnline')}
            </p>
          </div>
        </div>
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">{t('queueLoad' as Parameters<typeof t>[0])}</span>
            <span className="text-[10px] font-medium text-muted-foreground">
              {Math.round(load)}%
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-base-100">
            <div
              className={`h-full rounded-full transition-all duration-500 ${loadColor}`}
              style={{ width: `${load}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Custom Tooltip for Charts ───────────────────────────────────────────────
function ChartTooltip({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean
  payload?: { name: string; value: number; color: string }[]
  label?: string
  formatter?: (name: string, value: number) => string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2 shadow-lg">
      <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-xs font-medium" style={{ color: entry.color }}>
          {formatter ? formatter(entry.name, entry.value) : `${entry.name}: ${entry.value}`}
        </p>
      ))}
    </div>
  )
}

// ─── Sentiment Heatmap Component ─────────────────────────────────────────────
function SentimentHeatmap() {
  const { t } = useTranslation()
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const hours = Array.from({ length: 24 }, (_, i) => i)

  const heatmapData = useMemo(() => {
    const data: Record<string, Record<string, number>> = {}
    days.forEach((day, di) => {
      data[day] = {}
      hours.forEach((h) => {
        data[day][String(h)] = 0
      })
    })
    return data
  }, [])

  const getColor = (value: number) => {
    if (value >= 0.7) return 'bg-uae-green-500'
    if (value >= 0.55) return 'bg-uae-green-300'
    if (value >= 0.45) return 'bg-camel-yellow'
    if (value >= 0.3) return 'bg-orange-400'
    return 'bg-uae-red-500'
  }

  const getOpacity = (value: number) => 0.3 + (value * 0.7)

  return (
    <Card className="py-4">
      <CardHeader className="px-4 pb-0 pt-0">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Activity className="h-4 w-4 text-brand-600" />
          {t('sentimentHeatmap' as Parameters<typeof t>[0])}
        </CardTitle>
        <CardDescription className="text-xs">
          {t('sentimentByHourAndDay' as Parameters<typeof t>[0])}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4 pt-2 overflow-x-auto">
        <div className="min-w-[600px]">
          <div className="flex items-center mb-1">
            <div className="w-10 shrink-0" />
            {hours.filter((_, i) => i % 3 === 0).map((h) => (
              <div key={h} className="flex-1 text-center text-[9px] text-muted-foreground">
                {String(h).padStart(2, '0')}
              </div>
            ))}
          </div>
          {days.map((day) => (
            <div key={day} className="flex items-center mb-0.5">
              <div className="w-10 shrink-0 text-[10px] text-muted-foreground font-medium pr-1">
                {day}
              </div>
              <div className="flex flex-1 gap-px">
                {hours.map((h) => (
                  <div
                    key={h}
                    className={`flex-1 h-5 rounded-[2px] ${getColor(heatmapData[day][String(h)])}`}
                    style={{ opacity: getOpacity(heatmapData[day][String(h)]) }}
                    title={`${day} ${String(h).padStart(2, '0')}:00 — Sentiment: ${(heatmapData[day][String(h)] * 100).toFixed(0)}%`}
                  />
                ))}
              </div>
            </div>
          ))}
          <div className="flex items-center gap-3 mt-3 justify-center">
            <div className="flex items-center gap-1">
              <div className="h-3 w-3 rounded bg-uae-red-500" />
              <span className="text-[9px] text-muted-foreground">{t('negative' as Parameters<typeof t>[0])}</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-3 w-3 rounded bg-orange-400" />
              <span className="text-[9px] text-muted-foreground">{t('lowSentiment' as Parameters<typeof t>[0])}</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-3 w-3 rounded bg-camel-yellow" />
              <span className="text-[9px] text-muted-foreground">{t('neutral' as Parameters<typeof t>[0])}</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-3 w-3 rounded bg-uae-green-300" />
              <span className="text-[9px] text-muted-foreground">{t('positive' as Parameters<typeof t>[0])}</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-3 w-3 rounded bg-uae-green-500" />
              <span className="text-[9px] text-muted-foreground">{t('veryPositive' as Parameters<typeof t>[0])}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Channel Deep Dive Panel ────────────────────────────────────────────────
function ChannelDeepDive({ channel, onBack, t }: {
  channel: { name: string; value: number; color: string }
  onBack: () => void
  t: (key: string) => string
}) {
  const volumeData = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => ({
      hour: `${String(8 + i).padStart(2, '0')}:00`,
      volume: Math.round(channel.value / 12 + (Math.sin(i * 0.8) * channel.value * 0.1)),
    })), [channel.value])

  const topIntents = useMemo(() => [], [])

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="py-4">
        <CardHeader className="px-4 pb-0 pt-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onBack}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: channel.color }} />
              <CardTitle className="text-base font-semibold">
                {channel.name} — {t('channelDeepDive' as Parameters<typeof t>[0])}
              </CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 pt-3">
          {/* Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="rounded-lg border p-3 bg-card">
              <p className="text-[10px] text-muted-foreground">{t('volumeTrend' as Parameters<typeof t>[0])}</p>
              <p className="text-lg font-bold text-foreground">{channel.value}</p>
              <p className="text-[10px] text-muted-foreground">—</p>
            </div>
            <div className="rounded-lg border p-3 bg-card">
              <p className="text-[10px] text-muted-foreground">{t('avgHandleTime' as Parameters<typeof t>[0])}</p>
              <p className="text-lg font-bold text-foreground">—</p>
              <p className="text-[10px] text-muted-foreground">—</p>
            </div>
            <div className="rounded-lg border p-3 bg-card">
              <p className="text-[10px] text-muted-foreground">{t('satisfactionScore' as Parameters<typeof t>[0])}</p>
              <p className="text-lg font-bold text-foreground">—/5</p>
              <p className="text-[10px] text-muted-foreground">—</p>
            </div>
            <div className="rounded-lg border p-3 bg-card">
              <p className="text-[10px] text-muted-foreground">{t('activeConversations' as Parameters<typeof t>[0])}</p>
              <p className="text-[10px] text-muted-foreground">{t('now' as Parameters<typeof t>[0]) || 'now'}</p>
            </div>
          </div>

          {/* Volume Trend Chart */}
          <div className="h-48 mb-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={volumeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-base-100)" />
                <XAxis dataKey="hour" tick={{ fontSize: 9, fill: 'var(--color-base-400)' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 9, fill: 'var(--color-base-400)' }} tickLine={false} axisLine={false} width={25} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="volume" fill={channel.color} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Top Intents */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">{t('topIntents' as Parameters<typeof t>[0])}</p>
            <div className="space-y-2">
              {topIntents.map((intent) => (
                <div key={intent.name} className="flex items-center gap-2">
                  <span className="text-[11px] text-foreground w-24 truncate">{intent.name}</span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${intent.pct}%`, backgroundColor: channel.color }} />
                  </div>
                  <span className="text-[10px] text-muted-foreground w-8 text-right">{intent.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ─── Escalation Risk Card ────────────────────────────────────────────────────
function EscalationRiskCard({ risk, t, onAutoAssign, onNotify }: {
  risk: PredictionData['escalationRisks'][0]
  t: (key: string) => string
  onAutoAssign: () => void
  onNotify: () => void
}) {
  const isCritical = risk.riskLevel === 'high'
  const riskGlow = isCritical
    ? 'shadow-[0_0_12px_rgba(216,55,49,0.3)] border-uae-red-300'
    : risk.riskLevel === 'medium'
      ? 'shadow-[0_0_12px_rgba(245,158,11,0.25)] border-amber-300'
      : 'shadow-[0_0_8px_rgba(234,179,8,0.15)] border-yellow-200'

  return (
    <div className={`rounded-lg border p-3 transition-colors ${riskGlow} ${
      risk.riskLevel === 'high'
        ? 'bg-uae-red-50 dark:bg-uae-red-950/20'
        : risk.riskLevel === 'medium'
          ? 'bg-amber-50 dark:bg-amber-950/20'
          : 'bg-yellow-50 dark:bg-yellow-950/20'
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            {/* Pulsing urgency for critical */}
            {isCritical && (
              <span className="flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-2.5 w-2.5 animate-ping rounded-full bg-uae-red-500 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-uae-red-600" />
              </span>
            )}
            <p className="text-sm font-medium text-foreground truncate">
              {risk.customerName}
            </p>
            <Badge
              variant={risk.riskLevel === 'high' ? 'destructive' : 'secondary'}
              className="shrink-0 text-[10px]"
            >
              {isCritical ? t('critical' as Parameters<typeof t>[0]) : risk.riskLevel === 'medium' ? t('medium') : t('low')}
            </Badge>
          </div>
          {risk.caseRef && (
            <p className="text-[10px] text-brand-600 font-mono">{risk.caseRef}</p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">{risk.riskReason}</p>
          {/* Timeline */}
          <div className="flex items-center gap-1.5 mt-1.5">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">
              {t('detectedAt' as Parameters<typeof t>[0])}: {risk.daysOpen}d {t('open' as Parameters<typeof t>[0]) || 'open'} • {t('urgencyLevel' as Parameters<typeof t>[0])}: {risk.riskLevel}
            </span>
          </div>
          {/* Risk Trend Mini Sparkline */}
          <div className="mt-1.5">
            <p className="text-[9px] text-muted-foreground mb-0.5">{t('riskTrend' as Parameters<typeof t>[0])}</p>
            <svg width="80" height="16" className="opacity-70">
              <polyline
                points={(() => {
                  const pts = [0, 0, 0, 0, 0, 0]
                  return pts.map((v, i) => `${2 + (i / (pts.length - 1)) * 76},${14 - v * 14}`).join(' ')
                })()}
                fill="none"
                stroke={isCritical ? '#D83731' : '#F29F0E'}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
      </div>
      <div className="flex gap-1.5 mt-2">
        <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 gap-1" onClick={onAutoAssign}>
          <UserPlus className="h-3 w-3" />
          {t('autoAssign' as Parameters<typeof t>[0])}
        </Button>
        <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 gap-1" onClick={onNotify}>
          <Bell className="h-3 w-3" />
          {t('sendNotification' as Parameters<typeof t>[0])}
        </Button>
        <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 gap-1">
          <ArrowUp className="h-3 w-3" />
          {t('prioritize' as Parameters<typeof t>[0])}
        </Button>
      </div>
    </div>
  )
}

// ─── Shift Schedule Gantt ──────────────────────────────────────────────────
function ShiftScheduleGantt({ shifts }: { shifts: any[] }) {
  const { t } = useTranslation()

  const channelColors: Record<string, string> = {
    WhatsApp: '#2DD4BF',
    Voice: '#286CFF',
    Web: '#F29F0E',
  }

  const hours = Array.from({ length: 16 }, (_, i) => i + 7) // 7AM to 10PM

  // Coverage gaps detection
  const gaps = useMemo(() => {
    const coverageByHour: Record<number, string[]> = {}
    hours.forEach(h => { coverageByHour[h] = [] })
    shifts.forEach(s => {
      for (let h = s.start; h < s.end; h++) {
        if (coverageByHour[h]) coverageByHour[h].push(s.channel)
      }
    })
    const result: { hour: number; missing: string[] }[] = []
    hours.forEach(h => {
      const missing = ['WhatsApp', 'Voice', 'Web'].filter(ch => !coverageByHour[h]?.includes(ch))
      if (missing.length > 0) result.push({ hour: h, missing })
    })
    return result
  }, [shifts, hours])

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <div className="min-w-[600px]">
          {/* Hour labels */}
          <div className="flex items-center mb-1">
            <div className="w-20 shrink-0" />
            {hours.filter((_, i) => i % 2 === 0).map((h) => (
              <div key={h} className="flex-1 text-center text-[9px] text-muted-foreground">
                {String(h).padStart(2, '0')}:00
              </div>
            ))}
          </div>
          {/* Agent rows */}
          {shifts.map((shift, i) => {
            const leftPct = ((shift.start - 7) / 16) * 100
            const widthPct = ((shift.end - shift.start) / 16) * 100
            return (
              <div key={i} className="flex items-center mb-1">
                <div className="w-20 shrink-0 text-[10px] text-muted-foreground font-medium pr-2 truncate">
                  {shift.agent}
                </div>
                <div className="flex-1 relative h-5 bg-muted/30 rounded">
                  <div
                    className="absolute h-full rounded"
                    style={{
                      left: `${leftPct}%`,
                      width: `${widthPct}%`,
                      backgroundColor: channelColors[shift.channel] || '#888',
                      opacity: 0.7,
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
      {/* Coverage Gaps */}
      {gaps.length > 0 && (
        <div className="rounded-lg border border-uae-red-200 bg-uae-red-50 dark:bg-uae-red-950/20 p-2.5">
          <p className="text-[10px] font-medium text-uae-red-700 dark:text-uae-red-400 mb-1">
            {t('coverageGaps' as Parameters<typeof t>[0])}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {gaps.slice(0, 4).map((g, i) => (
              <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-uae-red-100 dark:bg-uae-red-900/30 text-uae-red-600 dark:text-uae-red-400">
                {String(g.hour).padStart(2, '0')}:00 — {g.missing.join(', ')} {t('agentsNeeded' as Parameters<typeof t>[0])}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Section Header with Teal Accent ────────────────────────────────────────
function SectionHeader({ title, icon: Icon }: { title: string; icon?: React.ElementType }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="h-5 w-1 rounded-full bg-brand-600" />
      {Icon && <Icon className="h-4 w-4 text-brand-600" />}
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────
const kpiConfigs: KPIConfig[] = [
  {
    key: 'totalInteractions',
    translationKey: 'totalInteractions',
    icon: Activity,
    format: (v) => v.toLocaleString(),
    color: 'text-brand-600',
    bgColor: 'bg-brand-50',
    trendKey: 'totalInteractions',
    sparkColor: '#0D9488',
  },
  {
    key: 'avgResolutionTime',
    translationKey: 'avgResolutionTime',
    icon: Clock,
    format: (v) => `${(v / 1).toFixed(1)}h`,
    color: 'text-tech-blue',
    bgColor: 'bg-blue-50',
    trendKey: 'avgResolutionTime',
    sparkColor: '#286CFF',
  },
  {
    key: 'firstContactResolution',
    translationKey: 'firstContactResolution',
    icon: Target,
    format: (v) => `${v}%`,
    color: 'text-uae-green-600',
    bgColor: 'bg-uae-green-50',
    trendKey: 'firstContactResolution',
    sparkColor: '#3F8E50',
  },
  {
    key: 'csat',
    translationKey: 'csat',
    icon: Star,
    format: () => '',
    color: 'text-camel-yellow',
    bgColor: 'bg-amber-50',
    trendKey: 'csat',
    sparkColor: '#F29F0E',
  },
  {
    key: 'selfServiceDeflection',
    translationKey: 'selfServiceDeflection',
    icon: ArrowDownRight,
    format: (v) => `${v}%`,
    color: 'text-lavender',
    bgColor: 'bg-purple-50',
    trendKey: 'selfServiceDeflection',
    sparkColor: '#8B5CF6',
  },
  {
    key: 'escalationRate',
    translationKey: 'escalationRate',
    icon: AlertTriangle,
    format: (v) => `${v}%`,
    color: 'text-uae-red-600',
    bgColor: 'bg-uae-red-50',
    trendKey: 'escalationRate',
    sparkColor: '#D83731',
  },
  {
    key: 'activeCases',
    translationKey: 'activeCasesCount',
    icon: FolderOpen,
    format: (v) => v.toLocaleString(),
    color: 'text-sunset-orange',
    bgColor: 'bg-orange-50',
    trendKey: 'activeCases',
    sparkColor: '#F97316',
  },
  {
    key: 'agentsOnline',
    translationKey: 'agentsOnline',
    icon: Users,
    format: (v) => v.toString(),
    color: 'text-mint',
    bgColor: 'bg-teal-50',
    trendKey: 'agentsOnline',
    sparkColor: '#2DD4BF',
  },
]

function generateSparkData(key: string): number[] {
  return Array.from({ length: 12 }, () => 0)
}

function generatePreviousData(key: string): number {
  return 0
}

const PIE_COLORS = ['#286CFF', '#2DD4BF', '#F29F0E']

export default function ExecutiveDashboard() {
  const { t } = useTranslation()
  const { emit } = useRealtime()
  const { toast } = useToast()

  // Store data
  const kpis = useAppStore((s) => s.kpis)
  const queueStatus = useAppStore((s) => s.queueStatus)
  const sentimentTimeline = useAppStore((s) => s.sentimentTimeline)

  // Local state
  const [channelData, setChannelData] = useState<
    { channel: string; interactions: number }[]
  >([])
  const [predictions, setPredictions] = useState<PredictionData | null>(null)
  const [kpisLoading, setKpiLoading] = useState(true)
  const [predictionsLoading, setPredictionsLoading] = useState(true)
  const [isLive, setIsLive] = useState(false)

  // Filter state
  const [timeRange, setTimeRange] = useState('24h')
  const [channelFilter, setChannelFilter] = useState('all')
  const [regionFilter, setRegionFilter] = useState('all')

  // Compare mode
  const [compareMode, setCompareMode] = useState(false)
  const [comparisonPeriod, setComparisonPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily')

  // Channel deep dive
  const [selectedChannel, setSelectedChannel] = useState<{ name: string; value: number; color: string } | null>(null)

  // Workforce auto-optimize
  const [autoOptimized, setAutoOptimized] = useState(false)

  // Export state
  const [isExporting, setIsExporting] = useState(false)

  // Sparkline data for each KPI
  const sparkDataMap = useMemo(() => {
    const map: Record<string, number[]> = {}
    kpiConfigs.forEach((config) => {
      map[config.key] = kpis.trends?.[config.key] || generateSparkData(config.key)
    })
    return map
  }, [kpis.trends])

  // Previous period values for comparison
  const previousValues = useMemo(() => {
    const map: Record<string, number> = {}
    kpiConfigs.forEach((config) => {
      map[config.key] = generatePreviousData(config.key)
    })
    return map
  }, [])

  // Trends
  const prevKpis = useRef(kpis)
  const [trends, setTrends] = useState<Record<string, number>>({})

  // AI Predictions
  const aiPredictions = useMemo(() => [
    {
      id: 'p1',
      icon: TrendingUp,
      color: 'text-brand-600',
      bgColor: 'bg-brand-50',
      text: t('aiPredictionVolume' as Parameters<typeof t>[0]),
    },
    {
      id: 'p2',
      icon: AlertTriangle,
      color: 'text-uae-red-600',
      bgColor: 'bg-uae-red-50',
      text: t('aiPredictionEscalation' as Parameters<typeof t>[0]),
    },
    {
      id: 'p3',
      icon: UserPlus,
      color: 'text-tech-blue',
      bgColor: 'bg-blue-50',
      text: t('aiPredictionStaffing' as Parameters<typeof t>[0]),
    },
  ], [t])

  // CSV Export
  const handleExport = useCallback(async (format: 'csv' | 'pdf') => {
    setIsExporting(true)
    try {
      if (format === 'csv') {
        const res = await fetch('/api/dashboard/export')
        if (res.ok) {
          const blob = await res.blob()
          const url = window.URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `MOEI_Dashboard_Report_${new Date().toISOString().slice(0, 10)}.csv`
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          window.URL.revokeObjectURL(url)
          toast({
            title: t('exportSuccess' as Parameters<typeof t>[0]),
            description: t('exportSuccessDesc' as Parameters<typeof t>[0]),
          })
        } else {
          toast({ title: t('error'), description: t('exportFailed' as Parameters<typeof t>[0]) || 'Export failed' })
        }
      } else {
        // PDF summary - generate a simple text summary download
        const summaryLines = [
          t('execDashboardSummary' as Parameters<typeof t>[0]) || 'MOEI Executive Dashboard Summary',
          `${t('date' as Parameters<typeof t>[0]) || 'Date'}: ${new Date().toLocaleDateString()}`,
          '',
          `${t('kpis' as Parameters<typeof t>[0]) || 'KPIs'}:`,
          `  ${t('totalInteractions' as Parameters<typeof t>[0]) || 'Total Interactions'}: ${kpis.totalInteractions}`,
          `  ${t('avgResolutionTime' as Parameters<typeof t>[0]) || 'Avg Resolution Time'}: ${kpis.avgResolutionTime}h`,
          `  ${t('firstContactResolution' as Parameters<typeof t>[0]) || 'First Contact Resolution'}: ${kpis.firstContactResolution}%`,
          `  ${t('csat' as Parameters<typeof t>[0]) || 'CSAT'}: ${kpis.csat}/5.0`,
          `  ${t('escalationRate' as Parameters<typeof t>[0]) || 'Escalation Rate'}: ${kpis.escalationRate}%`,
          `  ${t('activeCasesCount' as Parameters<typeof t>[0]) || 'Active Cases'}: ${kpis.activeCases}`,
          `  ${t('agentsOnline' as Parameters<typeof t>[0]) || 'Agents Online'}: ${kpis.agentsOnline}`,
          '',
          `${t('escalationRisks' as Parameters<typeof t>[0]) || 'Escalation Risks'}:`,
          ...(predictions?.escalationRisks?.map(r => `  - ${r.customerName}: ${r.riskLevel} (${r.riskReason})`) || [`  ${t('none' as Parameters<typeof t>[0]) || 'None'}`]),
          '',
          `${t('workforce' as Parameters<typeof t>[0]) || 'Workforce'}:`,
          `  ${t('currentOnline' as Parameters<typeof t>[0]) || 'Current Online'}: ${predictions?.workforceRecommendation?.currentOnline || kpis.agentsOnline}`,
          `  ${t('recommended' as Parameters<typeof t>[0]) || 'Recommended'}: ${predictions?.workforceRecommendation?.recommendedStaffing || 'N/A'}`,
          `  ${t('predictedVolumeIncrease' as Parameters<typeof t>[0]) || 'Predicted Volume Increase'}: +${predictions?.workforceRecommendation?.predictedVolumeIncrease || 15}%`,
        ]
        const blob = new Blob([summaryLines.join('\n')], { type: 'text/plain' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `MOEI_Dashboard_Summary_${new Date().toISOString().slice(0, 10)}.txt`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
        toast({
          title: t('exportSuccess' as Parameters<typeof t>[0]),
          description: t('exportSuccessDesc' as Parameters<typeof t>[0]),
        })
      }
    } catch {
      toast({ title: t('error'), description: t('exportFailed' as Parameters<typeof t>[0]) || 'Export failed' })
    } finally {
      setIsExporting(false)
    }
  }, [kpis, predictions, toast, t])

  // Fetch KPIs
  const fetchKPIs = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/kpis')
      if (res.ok) {
        const data = await res.json()
        useAppStore.getState().setKpis({
          totalInteractions: data.totalInteractions || 0,
          avgResolutionTime: data.avgResolutionTime || 0,
          firstContactResolution: data.firstContactResolution || 0,
          csat: data.csat || 0,
          selfServiceDeflection: data.selfServiceDeflection || 0,
          escalationRate: data.escalationRate || 0,
          activeCases: data.activeCases || 0,
          agentsOnline: data.agentsOnline || 0,
          channelBreakdown: data.channelBreakdown,
          sentimentTrend: data.sentimentTrend,
          trends: data.trends,
        })
        if (data.channelBreakdown) {
          const channelLabels: Record<string, string> = {
            voice: t('voice' as Parameters<typeof t>[0]),
            whatsapp: t('whatsapp' as Parameters<typeof t>[0]),
            web: t('webChat' as Parameters<typeof t>[0]),
            email: t('email' as Parameters<typeof t>[0]) || 'Email',
          }
          const chartData = Object.entries(data.channelBreakdown).map(
            ([ch, count]) => ({
              channel: channelLabels[ch] || ch,
              interactions: count as number,
            })
          )
          const mainChannels = [t('voice' as Parameters<typeof t>[0]), t('whatsapp' as Parameters<typeof t>[0]), t('webChat' as Parameters<typeof t>[0])]
          for (const ch of mainChannels) {
            if (!chartData.find((d) => d.channel === ch)) {
              chartData.push({ channel: ch, interactions: 0 })
            }
          }
          setChannelData(chartData)
        }
      }
    } catch (err) {
      console.error('Failed to fetch KPIs:', err)
    } finally {
      setKpiLoading(false)
    }
  }, [t])

  // Fetch predictions
  const fetchPredictions = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/predictions')
      if (res.ok) {
        const data = await res.json()
        setPredictions(data)
      }
    } catch (err) {
      console.error('Failed to fetch predictions:', err)
    } finally {
      setPredictionsLoading(false)
    }
  }, [])

  // Compute trends
  useEffect(() => {
    const newTrends: Record<string, number> = {}
    const prev = prevKpis.current
    if (prev.totalInteractions > 0) {
      newTrends.totalInteractions = Math.round(((kpis.totalInteractions - prev.totalInteractions) / prev.totalInteractions) * 100)
      newTrends.avgResolutionTime = prev.avgResolutionTime ? Math.round(((kpis.avgResolutionTime - prev.avgResolutionTime) / prev.avgResolutionTime) * 100) : 0
      newTrends.firstContactResolution = prev.firstContactResolution ? Math.round(((kpis.firstContactResolution - prev.firstContactResolution) / prev.firstContactResolution) * 100) : 0
      newTrends.csat = prev.csat ? Math.round(((kpis.csat - prev.csat) / prev.csat) * 100) : 0
      newTrends.selfServiceDeflection = prev.selfServiceDeflection ? Math.round(((kpis.selfServiceDeflection - prev.selfServiceDeflection) / prev.selfServiceDeflection) * 100) : 0
      newTrends.escalationRate = prev.escalationRate ? Math.round(((kpis.escalationRate - prev.escalationRate) / prev.escalationRate) * 100) : 0
      newTrends.activeCases = prev.activeCases ? Math.round(((kpis.activeCases - prev.activeCases) / prev.activeCases) * 100) : 0
      newTrends.agentsOnline = prev.agentsOnline ? Math.round(((kpis.agentsOnline - prev.agentsOnline) / prev.agentsOnline) * 100) : 0
    }
    setTrends(newTrends)
    prevKpis.current = kpis
  }, [kpis])

  // Initial data fetch
  useEffect(() => {
    fetchKPIs()
    fetchPredictions()
    const timer = setTimeout(() => setIsLive(true), 3000)
    return () => clearTimeout(timer)
  }, [fetchKPIs, fetchPredictions])

  useEffect(() => {
    const interval = setInterval(fetchPredictions, 60000)
    return () => clearInterval(interval)
  }, [fetchPredictions])

  useEffect(() => {
    const interval = setInterval(fetchKPIs, 30000)
    return () => clearInterval(interval)
  }, [fetchKPIs])

  // Sentiment data
  const sentimentData =
    sentimentTimeline.length > 0
      ? sentimentTimeline
      : Array.from({ length: 24 }, (_, i) => ({
          time: `${String(i).padStart(2, '0')}:00`,
          positive: 0,
          neutral: 0,
          negative: 0,
        }))

  // Volume forecast chart data
  const volumeData = predictions?.volumeForecast
    ? predictions.volumeForecast.map((f) => {
        const date = new Date(f.hour)
        return {
          hour: `${String(date.getHours()).padStart(2, '0')}:00`,
          predicted: f.predictedVolume,
          upper: Math.round(f.predictedVolume * (1 + (1 - f.confidence) / 2)),
          lower: Math.round(f.predictedVolume * (1 - (1 - f.confidence) / 2)),
        }
      })
    : []

  // Channel data for pie/donut chart
  const hasStoreChannelData = kpis.channelBreakdown && Object.keys(kpis.channelBreakdown).length > 0
  const activeChannelData = hasStoreChannelData 
    ? Object.entries(kpis.channelBreakdown!).map(([ch, count]) => ({ channel: ch, interactions: count as number }))
    : channelData

  const pieData =
    activeChannelData.length > 0
      ? activeChannelData.map((d) => {
          const channelLabels: Record<string, string> = {
            voice: t('voice' as Parameters<typeof t>[0]),
            whatsapp: t('whatsapp' as Parameters<typeof t>[0]),
            web: t('webChat' as Parameters<typeof t>[0]),
          }
          return {
            name: channelLabels[d.channel] || d.channel,
            value: d.interactions || 0,
          }
        })
      : [
          { name: t('whatsapp' as Parameters<typeof t>[0]), value: 0 },
          { name: t('voice' as Parameters<typeof t>[0]), value: 0 },
          { name: t('webChat' as Parameters<typeof t>[0]), value: 0 },
        ]

  const totalInteractions = pieData.reduce((sum, d) => sum + d.value, 0)

  // KPI values from store
  const kpiValues: Record<string, number> = {
    totalInteractions: kpis.totalInteractions,
    avgResolutionTime: kpis.avgResolutionTime,
    firstContactResolution: kpis.firstContactResolution,
    csat: kpis.csat,
    selfServiceDeflection: kpis.selfServiceDeflection,
    escalationRate: kpis.escalationRate,
    activeCases: kpis.activeCases,
    agentsOnline: kpis.agentsOnline,
  }

  // Workforce channel breakdown
  const workforceChannels = predictions?.workforceRecommendation?.channelBreakdown || [
    { channel: t('whatsapp' as Parameters<typeof t>[0]), current: 4, recommended: 6 },
    { channel: t('voice' as Parameters<typeof t>[0]), current: 5, recommended: 5 },
    { channel: t('webChat' as Parameters<typeof t>[0]), current: 3, recommended: 4 },
  ]

  return (
    <div className="space-y-6 bg-background p-4 md:p-6">
      {/* ── Section: Header with Filters ─────────────────────────────────── */}
      <section>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground">
              {t('executiveDashboard')}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t('realtimeOverview' as Parameters<typeof t>[0])}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {isLive && (
              <Badge variant="outline" className="gap-1.5 border-uae-green-300 text-uae-green-700">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-uae-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-uae-green-500" />
                </span>
                {t('liveIndicator' as Parameters<typeof t>[0])}
              </Badge>
            )}
            {/* Compare Mode Toggle */}
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-border bg-card">
              <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground">{t('compareMode' as Parameters<typeof t>[0])}</span>
              <Switch
                checked={compareMode}
                onCheckedChange={setCompareMode}
                className="scale-75"
              />
              {compareMode && (
                <Select value={comparisonPeriod} onValueChange={(v) => setComparisonPeriod(v as 'daily' | 'weekly' | 'monthly')}>
                  <SelectTrigger className="h-6 w-[80px] text-[10px] border-0 p-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">{t('daily' as Parameters<typeof t>[0])}</SelectItem>
                    <SelectItem value="weekly">{t('weekly' as Parameters<typeof t>[0])}</SelectItem>
                    <SelectItem value="monthly">{t('monthly' as Parameters<typeof t>[0])}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            {/* Export Dropdown */}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={isExporting}
              onClick={() => handleExport('csv')}
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t('exportCSV' as Parameters<typeof t>[0])}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={isExporting}
              onClick={() => handleExport('pdf')}
            >
              <FileText className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t('exportPDFSummary' as Parameters<typeof t>[0])}</span>
            </Button>
          </div>
        </div>

        {/* Quick Filters Bar */}
        <Card className="py-2">
          <CardContent className="px-3 py-1">
            <div className="flex items-center gap-3 flex-wrap">
              <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="h-7 w-[100px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1h">{t('last1h' as Parameters<typeof t>[0])}</SelectItem>
                  <SelectItem value="6h">{t('last6h' as Parameters<typeof t>[0])}</SelectItem>
                  <SelectItem value="24h">{t('last24h' as Parameters<typeof t>[0])}</SelectItem>
                  <SelectItem value="7d">{t('last7d' as Parameters<typeof t>[0])}</SelectItem>
                  <SelectItem value="30d">{t('last30d' as Parameters<typeof t>[0])}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={channelFilter} onValueChange={setChannelFilter}>
                <SelectTrigger className="h-7 w-[110px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('allChannels' as Parameters<typeof t>[0])}</SelectItem>
                  <SelectItem value="whatsapp">{t('whatsapp' as Parameters<typeof t>[0])}</SelectItem>
                  <SelectItem value="voice">{t('voice' as Parameters<typeof t>[0])}</SelectItem>
                  <SelectItem value="web">{t('webChat' as Parameters<typeof t>[0])}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={regionFilter} onValueChange={setRegionFilter}>
                <SelectTrigger className="h-7 w-[110px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('allRegions' as Parameters<typeof t>[0])}</SelectItem>
                  <SelectItem value="abudhabi">{t('abuDhabi' as Parameters<typeof t>[0])}</SelectItem>
                  <SelectItem value="dubai">{t('dubai' as Parameters<typeof t>[0])}</SelectItem>
                  <SelectItem value="sharjah">{t('sharjah' as Parameters<typeof t>[0])}</SelectItem>
                  <SelectItem value="others">{t('others' as Parameters<typeof t>[0])}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ── Tab Navigation ──────────────────────────────────────────────── */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-muted/50 p-1 h-auto">
          <TabsTrigger value="overview" className="text-xs sm:text-sm gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm py-2">
            <Eye className="h-3.5 w-3.5" />
            {t('execOverview' as Parameters<typeof t>[0])}
          </TabsTrigger>
          <TabsTrigger value="analytics" className="text-xs sm:text-sm gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm py-2">
            <BarChart3 className="h-3.5 w-3.5" />
            {t('execAnalytics' as Parameters<typeof t>[0])}
          </TabsTrigger>
          <TabsTrigger value="operations" className="text-xs sm:text-sm gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm py-2">
            <Zap className="h-3.5 w-3.5" />
            {t('execOperations' as Parameters<typeof t>[0])}
          </TabsTrigger>
          <TabsTrigger value="system" className="text-xs sm:text-sm gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm py-2">
            <Activity className="h-3.5 w-3.5" />
            {t('execSystem' as Parameters<typeof t>[0])}
          </TabsTrigger>
        </TabsList>

        {/* ── Tab: Overview ─────────────────────────────────────────────── */}
        <TabsContent value="overview" className="mt-6 space-y-6">
          <SectionHeader title={t('aiInsights' as Parameters<typeof t>[0])} icon={Brain} />
          <AIInsightsPanel />
          <AILeadershipAdvisor />

          {/* ── Section: KPI Cards with Sparklines ────────────────────────── */}
      <section>
        <AnimatePresence mode="wait">
          {kpisLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-4 lg:gap-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : (
            <motion.div
              className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-4 lg:gap-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              {kpiConfigs.map((config) => (
                <KPICard
                  key={config.key}
                  config={config}
                  value={kpiValues[config.key] || 0}
                  trend={trends[config.key] || 0}
                  isLive={isLive}
                  sparkData={sparkDataMap[config.key] || []}
                  compareMode={compareMode}
                  comparisonPeriod={comparisonPeriod}
                  previousValue={previousValues[config.key] || 0}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* ── Section: Charts ───────────────────────────────────────────── */}
      <section className="grid gap-4 md:grid-cols-2 lg:gap-6">
        {/* Sentiment Trends */}
        <Card className="py-4 shadow-sm">
          <div className="h-0.5 bg-gradient-to-r from-uae-green-400 via-camel-yellow to-uae-red-400 opacity-40" />
          <CardHeader className="px-4 pb-0 pt-0">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              {t('sentimentTrends')}
              {isLive && (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-uae-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-uae-green-500" />
                </span>
              )}
            </CardTitle>
            <CardDescription className="text-xs">
              {t('last24hSentiment' as Parameters<typeof t>[0])}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-2 pt-2">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sentimentData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="gradPositive" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3F8E50" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3F8E50" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradNeutral" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F29F0E" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#F29F0E" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradNegative" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#D83731" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#D83731" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-base-100)" />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'var(--color-base-400)' }} tickLine={false} axisLine={{ stroke: 'var(--color-base-100)' }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--color-base-400)' }} tickLine={false} axisLine={false} width={30} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
                  <Area type="monotone" dataKey="positive" name={t('sentimentPositive' as Parameters<typeof t>[0])} stroke="#3F8E50" strokeWidth={2} fill="url(#gradPositive)" />
                  <Area type="monotone" dataKey="neutral" name={t('sentimentNeutral' as Parameters<typeof t>[0])} stroke="#F29F0E" strokeWidth={2} fill="url(#gradNeutral)" />
                  <Area type="monotone" dataKey="negative" name={t('sentimentNegative' as Parameters<typeof t>[0])} stroke="#D83731" strokeWidth={2} fill="url(#gradNegative)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Channel Distribution - Donut/Pie Chart with Deep Dive */}
        <Card className="py-4 shadow-sm">
          <div className="h-0.5 bg-gradient-to-r from-tech-blue via-mint to-camel-yellow opacity-40" />
          <CardHeader className="px-4 pb-0 pt-0">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  {t('channelPerformance')}
                  {isLive && (
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-uae-green-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-uae-green-500" />
                    </span>
                  )}
                </CardTitle>
                <CardDescription className="text-xs">
                  {t('interactionsPerChannelToday' as Parameters<typeof t>[0])} • {t('clickToExplore' as Parameters<typeof t>[0])}
                </CardDescription>
              </div>
              {selectedChannel && (
                <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1" onClick={() => setSelectedChannel(null)}>
                  <X className="h-3 w-3" />
                  {t('backToOverview' as Parameters<typeof t>[0])}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="px-2 pt-2">
            <AnimatePresence mode="wait">
              {selectedChannel ? (
                <ChannelDeepDive
                  key={selectedChannel.name}
                  channel={selectedChannel}
                  onBack={() => setSelectedChannel(null)}
                  t={t}
                />
              ) : (
                <motion.div
                  className="h-72"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={95}
                        paddingAngle={3}
                        dataKey="value"
                        nameKey="name"
                        cursor="pointer"
                        onClick={(_, index) => {
                          setSelectedChannel({
                            name: pieData[index].name,
                            value: pieData[index].value,
                            color: PIE_COLORS[index % PIE_COLORS.length],
                          })
                        }}
                        label={({ name, value }) => {
                          const pct = totalInteractions > 0 ? Math.round((value / totalInteractions) * 100) : 0
                          return `${name}: ${pct}%`
                        }}
                        labelLine={{ stroke: 'var(--color-base-400)', strokeWidth: 1 }}
                      >
                        {pieData.map((_entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={PIE_COLORS[index % PIE_COLORS.length]}
                            className="cursor-pointer transition-transform hover:scale-105"
                          />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number, name: string) => [`${value} ${t('interactions' as Parameters<typeof t>[0])}`, name]} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </section>

        </TabsContent>

        {/* ── Tab: Analytics ────────────────────────────────────────────── */}
        <TabsContent value="analytics" className="mt-6 space-y-6">
          <SectionHeader title={t('aiPerformanceInsights' as Parameters<typeof t>[0])} icon={Brain} />
          <AIPerformancePanel />

          <SectionHeader title={t('channelPerformance' as Parameters<typeof t>[0])} icon={BarChart3} />
          <GeoDistributionPanel />

          <SectionHeader title={t('sentimentHeatmap' as Parameters<typeof t>[0])} icon={Activity} />
          <SentimentHeatmap />

          <SectionHeader title={t('csatAnalytics' as Parameters<typeof t>[0])} icon={Star} />
          <CSATAnalyticsPanel />

          <SectionHeader title={t('aiResponseQuality' as Parameters<typeof t>[0])} icon={Zap} />
          <AIQualityDashboard />
        </TabsContent>

        {/* ── Tab: Operations ───────────────────────────────────────────── */}
        <TabsContent value="operations" className="mt-6 space-y-6">
          <SectionHeader title={t('queueStatus')} icon={Phone} />
          <div className="grid gap-4 sm:grid-cols-3">
            <QueueChannelCard channel="Voice" data={queueStatus.voice} icon={Phone} />
            <QueueChannelCard channel="WhatsApp" data={queueStatus.whatsapp} icon={MessageCircle} />
            <QueueChannelCard channel="Web" data={queueStatus.web} icon={Globe} />
          </div>

          <SectionHeader title={t('aiPredictions' as Parameters<typeof t>[0])} icon={Brain} />
          <Card className="py-4 shadow-sm">
            <div className="h-0.5 bg-gradient-to-r from-brand-400 via-brand-600 to-brand-400 opacity-40" />
            <CardHeader className="px-4 pb-0 pt-0">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Brain className="h-4 w-4 text-brand-600" />
                {t('aiPredictions' as Parameters<typeof t>[0])}
                {isLive && (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-uae-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-uae-green-500" />
                  </span>
                )}
              </CardTitle>
              <CardDescription className="text-xs">
                {t('aiPredictionsDesc' as Parameters<typeof t>[0])}
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 pt-2">
              <div className="grid gap-3 sm:grid-cols-3">
                {aiPredictions.map((pred) => {
                  const PredIcon = pred.icon
                  return (
                    <motion.div
                      key={pred.id}
                      className={`rounded-lg border p-3 ${pred.bgColor} border-current/10`}
                      whileHover={{ scale: 1.02 }}
                      transition={{ duration: 0.15 }}
                    >
                      <div className="flex items-start gap-2">
                        <PredIcon className={`h-4 w-4 ${pred.color} shrink-0 mt-0.5`} />
                        <p className="text-xs text-foreground leading-relaxed">{pred.text}</p>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          <SectionHeader title={t('predictiveAnalytics')} icon={TrendingUp} />
          <div className="grid gap-4 md:grid-cols-2 lg:gap-6">
            {/* Volume Forecast */}
            <Card className="py-4 shadow-sm">
              <div className="h-0.5 bg-gradient-to-r from-amber-400 via-amber-600 to-amber-400 opacity-40" />
              <CardHeader className="px-4 pb-0 pt-0">
                <CardTitle className="text-base font-semibold">
                  {t('volumeForecast')}
                </CardTitle>
                <CardDescription className="text-xs">
                  {t('predictedVolumeWithConfidence' as Parameters<typeof t>[0])}
                </CardDescription>
              </CardHeader>
              <CardContent className="px-2 pt-2">
                {predictionsLoading ? (
                  <div className="flex h-72 items-center justify-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
                      <p className="text-xs text-muted-foreground">{t('loading')}</p>
                    </div>
                  </div>
                ) : (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={volumeData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                        <defs>
                          <linearGradient id="gradConfidence" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#92722A" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#92722A" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-base-100)" />
                        <XAxis dataKey="hour" tick={{ fontSize: 10, fill: 'var(--color-base-400)' }} tickLine={false} axisLine={{ stroke: 'var(--color-base-100)' }} interval="preserveStartEnd" />
                        <YAxis tick={{ fontSize: 10, fill: 'var(--color-base-400)' }} tickLine={false} axisLine={false} width={30} />
                        <Tooltip content={<ChartTooltip />} />
                        <Legend iconType="line" iconSize={10} wrapperStyle={{ fontSize: '11px' }} />
                        <Area type="monotone" dataKey="upper" name={t('confidenceUpper' as Parameters<typeof t>[0])} stroke="transparent" fill="url(#gradConfidence)" fillOpacity={1} />
                        <Area type="monotone" dataKey="lower" name={t('confidenceLower' as Parameters<typeof t>[0])} stroke="#92722A" strokeWidth={0} strokeOpacity={0} fill="var(--color-background)" fillOpacity={0.9} />
                        <Line type="monotone" dataKey="predicted" name={t('predictedVolume' as Parameters<typeof t>[0])} stroke="#92722A" strokeWidth={2.5} dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: '#92722A' }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Escalation Risks & Workforce */}
            <Card className="py-4 shadow-sm">
              <CardHeader className="px-4 pb-0 pt-0">
                <Tabs defaultValue="risks" className="w-full">
                  <div className="flex items-center justify-between">
                    <TabsList className="h-8">
                      <TabsTrigger value="risks" className="text-xs px-3">
                        <AlertCircle className="mr-1 h-3 w-3" />
                        {t('escalationRisks')}
                      </TabsTrigger>
                      <TabsTrigger value="workforce" className="text-xs px-3">
                        <UserCheck className="mr-1 h-3 w-3" />
                        {t('workforcePlanning')}
                      </TabsTrigger>
                    </TabsList>
                  </div>
                  <TabsContent value="risks" className="mt-3">
                    <div className="max-h-96 space-y-2 overflow-y-auto custom-scrollbar pr-1">
                      {predictionsLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
                        </div>
                      ) : predictions?.escalationRisks && predictions.escalationRisks.length > 0 ? (
                        predictions.escalationRisks.map((risk) => (
                          <EscalationRiskCard
                            key={risk.caseId}
                            risk={{ ...risk, caseRef: risk.caseId.startsWith('MOEI') ? risk.caseId : `MOEI-${risk.caseId.slice(0, 4).toUpperCase()}` }}
                            t={t}
                            onAutoAssign={() => {
                              toast({
                                title: t('autoAssignSuccess' as Parameters<typeof t>[0]),
                                description: t('autoAssignDesc' as Parameters<typeof t>[0]),
                              })
                            }}
                            onNotify={() => {
                              toast({
                                title: t('notificationSent' as Parameters<typeof t>[0]),
                                description: t('notificationSentDesc' as Parameters<typeof t>[0]),
                              })
                            }}
                          />
                        ))
                      ) : (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                          <Zap className="mb-2 h-8 w-8 text-uae-green-400" />
                          <p className="text-sm font-medium text-uae-green-600">{t('noEscalationRisks' as Parameters<typeof t>[0])}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{t('allCasesNormal' as Parameters<typeof t>[0])}</p>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                  <TabsContent value="workforce" className="mt-3">
                    {predictions?.workforceRecommendation ? (
                      <div className="space-y-4">
                        {/* Staffing Overview with Gauges */}
                        <div className="flex items-center justify-around">
                          <GaugeChart
                            value={predictions.workforceRecommendation.currentOnline}
                            max={20}
                            label={t('currentOnline' as Parameters<typeof t>[0])}
                            color="#0D9488"
                          />
                          <GaugeChart
                            value={predictions.workforceRecommendation.recommendedStaffing}
                            max={20}
                            label={t('recommended' as Parameters<typeof t>[0])}
                            color="#286CFF"
                          />
                        </div>

                        {/* Shift Schedule Gantt */}
                        <div>
                          <p className="mb-2 text-xs font-medium text-muted-foreground flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" />
                            {t('shiftSchedule' as Parameters<typeof t>[0])}
                          </p>
                          <ShiftScheduleGantt shifts={predictions?.shifts || []} />
                        </div>

                        {/* Channel Breakdown */}
                        <div>
                          <p className="mb-2 text-xs font-medium text-muted-foreground">
                            {t('channelStaffing' as Parameters<typeof t>[0])}
                          </p>
                          <div className="space-y-2">
                            {workforceChannels.map((ch, i) => (
                              <div key={i} className="flex items-center gap-3 rounded-lg bg-base-50 dark:bg-base-900/30 px-3 py-2">
                                <span className="text-xs text-foreground w-20 truncate">{ch.channel}</span>
                                <div className="flex-1">
                                  <div className="flex items-center gap-1">
                                    <span className="text-[10px] text-muted-foreground">{t('current' as Parameters<typeof t>[0])}: {ch.current}</span>
                                    <span className="text-[10px] text-muted-foreground">→</span>
                                    <span className="text-[10px] text-brand-600 font-medium">{t('recommended' as Parameters<typeof t>[0])}: {ch.recommended}</span>
                                  </div>
                                  <Progress value={Math.min((ch.current / ch.recommended) * 100, 100)} className="h-1.5 mt-1" />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Cases per Agent */}
                        <div>
                          <div className="mb-1.5 flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">{t('avgCasesPerAgent' as Parameters<typeof t>[0])}</span>
                            <span className="text-xs font-semibold text-foreground">{predictions.workforceRecommendation.averageCasesPerAgent}</span>
                          </div>
                          <Progress value={Math.min((predictions.workforceRecommendation.averageCasesPerAgent / 10) * 100, 100)} className="h-2" />
                          <p className="mt-1 text-[10px] text-muted-foreground">{t('targetCasesPerAgent' as Parameters<typeof t>[0])}</p>
                        </div>

                        {/* Predicted Volume Increase */}
                        <div className="flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 dark:bg-brand-950/20 p-3">
                          <TrendingUp className="h-4 w-4 text-brand-600" />
                          <p className="text-xs font-medium text-brand-800 dark:text-brand-300">
                            +{predictions.workforceRecommendation.predictedVolumeIncrease}% {t('volumeIncreasePredicted' as Parameters<typeof t>[0])}
                          </p>
                        </div>

                        {/* Peak Hours */}
                        <div>
                          <p className="mb-2 text-xs font-medium text-muted-foreground">{t('peakHourStaffing' as Parameters<typeof t>[0])}</p>
                          <div className="space-y-2">
                            {predictions.workforceRecommendation.peakHours.map((peak, i) => (
                              <div key={i} className="flex items-center justify-between rounded-lg bg-base-50 dark:bg-base-900/30 px-3 py-2">
                                <span className="text-xs text-muted-foreground">{peak.start} – {peak.end}</span>
                                <Badge variant="outline" className="text-[10px]">{peak.recommendedAgents} {t('agents' as Parameters<typeof t>[0])}</Badge>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Auto-Optimize / Recalculate Button */}
                        <Button
                          className="w-full gap-2"
                          variant={autoOptimized ? 'default' : 'outline'}
                          onClick={() => {
                            setAutoOptimized(true)
                            toast({
                              title: autoOptimized ? t('recalculate' as Parameters<typeof t>[0]) : t('autoOptimize' as Parameters<typeof t>[0]),
                              description: autoOptimized ? t('recalculateDesc' as Parameters<typeof t>[0]) : t('autoOptimizeDesc' as Parameters<typeof t>[0]),
                            })
                          }}
                        >
                          {autoOptimized ? (
                            <><RotateCcw className="h-4 w-4" />{t('recalculate' as Parameters<typeof t>[0])}</>
                          ) : (
                            <><Zap className="h-4 w-4" />{t('autoOptimize' as Parameters<typeof t>[0])}</>
                          )}
                        </Button>

                        {/* Suggested Action */}
                        <div className={`rounded-lg border p-3 ${
                          predictions.workforceRecommendation.averageCasesPerAgent > 10
                            ? 'border-uae-red-200 bg-uae-red-50 dark:bg-uae-red-950/20'
                            : predictions.workforceRecommendation.averageCasesPerAgent > 6
                              ? 'border-amber-200 bg-amber-50 dark:bg-amber-950/20'
                              : 'border-uae-green-200 bg-uae-green-50 dark:bg-uae-green-950/20'
                        }`}>
                          <p className="text-xs font-medium text-foreground">
                            {predictions.workforceRecommendation.suggestedAction}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center py-8">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardHeader>
            </Card>
          </div>
        </TabsContent>

        {/* ── Tab: System ───────────────────────────────────────────────── */}
        <TabsContent value="system" className="mt-6 space-y-6">
          <SectionHeader title={t('systemHealth' as Parameters<typeof t>[0])} icon={Activity} />
          <SystemHealthDashboard />

          <SectionHeader title={t('compliance' as Parameters<typeof t>[0])} icon={FileText} />
          <CompliancePanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}
