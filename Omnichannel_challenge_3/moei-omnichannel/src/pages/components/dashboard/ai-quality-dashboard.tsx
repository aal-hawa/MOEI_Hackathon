'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  ShieldCheck,
  Target,
  Zap,
  Brain,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Sparkles,
  Lightbulb,
  ArrowUpRight,
} from 'lucide-react'
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { useTranslation } from '@/i18n'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'

// ─── Types ───────────────────────────────────────────────────────────────────

interface QualityMetric {
  id: string
  titleKey: string
  value: number
  trendUp: boolean
  trendValue: number
  target: number
  icon: React.ElementType
  color: string
  bgColor: string
}

interface EscalationCategory {
  nameKey: string
  value: number
  color: string
}

interface LearningInsight {
  id: string
  titleKey: string
  descKey: string
  icon: React.ElementType
  color: string
  priority: 'high' | 'medium' | 'low'
}

// ─── Circular Progress SVG ─────────────────────────────────────────────────

function CircularProgress({ value, size = 72, strokeWidth = 6, color }: {
  value: number
  size?: number
  strokeWidth?: number
  color: string
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (value / 100) * circumference
  const center = size / 2

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      {/* Background circle */}
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="var(--color-base-100, #e5e7eb)"
        strokeWidth={strokeWidth}
      />
      {/* Progress arc */}
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 1s ease-out' }}
      />
      {/* Target line */}
      <line
        x1={center}
        y1={strokeWidth / 2}
        x2={center}
        y2={size - strokeWidth / 2}
        stroke="var(--color-muted-foreground, #9ca3af)"
        strokeWidth="1"
        strokeDasharray="3 3"
        opacity="0.4"
        className="rotate-90"
        style={{ transformOrigin: 'center' }}
      />
    </svg>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AIQualityDashboard() {
  const { t } = useTranslation()

  // Quality metrics with circular progress
  const metrics: QualityMetric[] = useMemo(() => [
    {
      id: 'accuracy',
      titleKey: 'aiqAccuracy',
      value: 0,
      trendUp: true,
      trendValue: 0,
      target: 90,
      icon: Target,
      color: '#0D9488', // teal
      bgColor: 'bg-teal-50 dark:bg-teal-950/20',
    },
    {
      id: 'relevance',
      titleKey: 'aiqRelevance',
      value: 0,
      trendUp: true,
      trendValue: 0,
      target: 85,
      icon: Sparkles,
      color: '#3F8E50', // green
      bgColor: 'bg-green-50 dark:bg-green-950/20',
    },
    {
      id: 'responsiveness',
      titleKey: 'aiqResponsiveness',
      value: 0,
      trendUp: false,
      trendValue: 0,
      target: 95,
      icon: Zap,
      color: '#286CFF', // blue
      bgColor: 'bg-blue-50 dark:bg-blue-950/20',
    },
    {
      id: 'safety',
      titleKey: 'aiqSafety',
      value: 0,
      trendUp: true,
      trendValue: 0,
      target: 99,
      icon: ShieldCheck,
      color: '#F29F0E', // yellow
      bgColor: 'bg-yellow-50 dark:bg-yellow-950/20',
    },
  ], [])

  // Line chart data: AI model performance over 7 days
  const lineChartData: any[] = useMemo(() => [], [])

  // Pie chart data: AI Escalation Reasons
  const escalationCategories: EscalationCategory[] = useMemo(() => [], [])

  const pieData = escalationCategories.map(cat => ({
    name: t(cat.nameKey as Parameters<typeof t>[0]),
    value: cat.value,
    color: cat.color,
  }))

  // AI Learning Insights
  const insights: LearningInsight[] = useMemo(() => [], [])

  return (
    <div className="space-y-6">
      {/* ── Section Header ──────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center gap-2"
      >
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
          <Brain className="w-4 h-4 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-foreground">{t('aiqTitle')}</h3>
          <p className="text-xs text-muted-foreground">{t('aiqSubtitle')}</p>
        </div>
      </motion.div>

      {/* ── 4 Metric Cards with Circular Progress ──────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric, i) => {
          const Icon = metric.icon
          return (
            <motion.div
              key={metric.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1, duration: 0.4 }}
            >
              <Card className={`relative overflow-hidden border-0 shadow-sm backdrop-blur-sm ${metric.bgColor}`}>
                {/* Glassmorphism overlay */}
                <div className="absolute inset-0 bg-white/30 dark:bg-white/5 pointer-events-none" />
                <CardContent className="p-4 relative z-10">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Icon className={`w-4 h-4`} style={{ color: metric.color }} />
                        <span className="text-xs font-medium text-muted-foreground">
                          {t(metric.titleKey as Parameters<typeof t>[0])}
                        </span>
                      </div>
                      <p className="text-2xl font-bold text-foreground">{metric.value}%</p>
                      <div className="flex items-center gap-1 mt-1">
                        {metric.trendUp ? (
                          <TrendingUp className="w-3 h-3 text-uae-green-600" />
                        ) : (
                          <TrendingDown className="w-3 h-3 text-uae-red-600" />
                        )}
                        <span className={`text-[10px] font-medium ${metric.trendUp ? 'text-uae-green-600' : 'text-uae-red-600'}`}>
                          {metric.trendUp ? '+' : '-'}{metric.trendValue}%
                        </span>
                        <span className="text-[9px] text-muted-foreground ml-1">
                          {t('aiqTarget')}: {metric.target}%
                        </span>
                      </div>
                    </div>
                    <CircularProgress value={metric.value} color={metric.color} size={56} strokeWidth={5} />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>

      {/* ── Charts Row ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* AI Model Performance Line Chart */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
        >
          <Card className="border-0 shadow-sm backdrop-blur-sm bg-card/80">
            <CardHeader className="px-4 pb-2 pt-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-brand-600" />
                {t('aiqModelPerformance')}
              </CardTitle>
              <CardDescription className="text-[11px]">{t('aiqModelPerformanceDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={lineChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-base-100, #e5e7eb)" />
                    <XAxis dataKey="day" tick={{ fontSize: 9, fill: 'var(--color-base-400, #9ca3af)' }} tickLine={false} axisLine={false} />
                    <YAxis domain={[88, 100]} tick={{ fontSize: 9, fill: 'var(--color-base-400, #9ca3af)' }} tickLine={false} axisLine={false} width={30} />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--color-card, white)',
                        border: '1px solid var(--color-border, #e5e7eb)',
                        borderRadius: '8px',
                        fontSize: '10px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '9px' }} />
                    <Line type="monotone" dataKey="accuracy" stroke="#0D9488" strokeWidth={2} dot={{ r: 2 }} name={t('aiqAccuracy')} />
                    <Line type="monotone" dataKey="relevance" stroke="#3F8E50" strokeWidth={2} dot={{ r: 2 }} name={t('aiqRelevance')} />
                    <Line type="monotone" dataKey="responsiveness" stroke="#286CFF" strokeWidth={2} dot={{ r: 2 }} name={t('aiqResponsiveness')} />
                    <Line type="monotone" dataKey="safety" stroke="#F29F0E" strokeWidth={2} dot={{ r: 2 }} name={t('aiqSafety')} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* AI Escalation Reasons Pie Chart */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}
        >
          <Card className="border-0 shadow-sm backdrop-blur-sm bg-card/80">
            <CardHeader className="px-4 pb-2 pt-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                {t('aiqEscalationReasons')}
              </CardTitle>
              <CardDescription className="text-[11px]">{t('aiqEscalationReasonsDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              <div className="h-56 flex items-center">
                <div className="w-1/2 h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={70}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: 'var(--color-card, white)',
                          border: '1px solid var(--color-border, #e5e7eb)',
                          borderRadius: '8px',
                          fontSize: '10px',
                        }}
                        formatter={(value: number) => [`${value}%`, '']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-1/2 space-y-2 pl-2">
                  {escalationCategories.map((cat) => (
                    <div key={cat.nameKey} className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                      <span className="text-[10px] text-foreground flex-1 truncate">
                        {t(cat.nameKey as Parameters<typeof t>[0])}
                      </span>
                      <span className="text-[10px] font-medium text-muted-foreground">{cat.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ── AI Learning Insights ───────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.4 }}
      >
        <Card className="border-0 shadow-sm backdrop-blur-sm bg-card/80">
          <CardHeader className="px-4 pb-2 pt-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-amber-500" />
              {t('aiqLearningInsights')}
            </CardTitle>
            <CardDescription className="text-[11px]">{t('aiqLearningInsightsDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {insights.map((insight, i) => {
                const Icon = insight.icon
                const priorityColors = {
                  high: 'border-l-uae-red-500',
                  medium: 'border-l-amber-500',
                  low: 'border-l-uae-green-500',
                }
                const priorityBadge = {
                  high: 'bg-uae-red-100 text-uae-red-700 dark:bg-uae-red-950/30 dark:text-uae-red-400',
                  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400',
                  low: 'bg-uae-green-100 text-uae-green-700 dark:bg-uae-green-950/30 dark:text-uae-green-400',
                }

                return (
                  <motion.div
                    key={insight.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 + i * 0.1, duration: 0.3 }}
                    className={`rounded-lg border border-l-4 ${priorityColors[insight.priority]} bg-card p-3`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-7 h-7 rounded-md flex items-center justify-center ${insight.color}`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <h5 className="text-xs font-semibold text-foreground flex-1">
                        {t(insight.titleKey as Parameters<typeof t>[0])}
                      </h5>
                      <Badge className={`text-[8px] h-4 px-1 ${priorityBadge[insight.priority]}`}>
                        {t(`aiqPriority${insight.priority.charAt(0).toUpperCase() + insight.priority.slice(1)}` as Parameters<typeof t>[0])}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {t(insight.descKey as Parameters<typeof t>[0])}
                    </p>
                  </motion.div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
