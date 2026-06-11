'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { t } from '@/lib/i18n'
import { useAppStore } from '@/lib/store'
import type { DashboardStats } from '@/lib/store'

interface ChartsProps {
  stats: DashboardStats | null
  loading: boolean
}

// ── Chart color constants ────────────────────────────────────────────
const AE_GOLD_500 = '#B68A35'
const AE_GREEN_600 = '#317A40'
const AE_RED_600 = '#D83731'
const AE_GREEN_500 = '#3F8E50'
const AE_GOLD_700 = '#7C5E24'
const AE_GOLD_400 = '#C9A34E'
const AE_GOLD_300 = '#D7BC6D'

// ── Color maps (static, no translation needed) ───────────────────────
const RISK_COLORS: Record<string, string> = {
  low: AE_GREEN_500,
  medium: AE_GOLD_500,
  high: AE_GOLD_700,
  critical: AE_RED_600,
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#EAB308',
  under_review: '#3B82F6',
  ai_assessed: AE_GOLD_400,
  approved: AE_GREEN_600,
  rejected: AE_RED_600,
  escalated: '#8B5CF6',
}

// ── Chart config builders (dynamic, language-aware) ──────────────────
function buildTrendChartConfig(language: ReturnType<typeof useAppStore>['language']): ChartConfig {
  return {
    requests: {
      label: t('chart.requests', language),
      color: AE_GOLD_500,
    },
    approved: {
      label: t('chart.approved', language),
      color: AE_GREEN_600,
    },
    rejected: {
      label: t('chart.rejected', language),
      color: AE_RED_600,
    },
  }
}

function buildRiskChartConfig(language: ReturnType<typeof useAppStore>['language']): ChartConfig {
  return {
    low: {
      label: t('chart.low', language),
      color: AE_GREEN_500,
    },
    medium: {
      label: t('chart.medium', language),
      color: AE_GOLD_500,
    },
    high: {
      label: t('chart.high', language),
      color: AE_GOLD_700,
    },
    critical: {
      label: t('chart.critical', language),
      color: AE_RED_600,
    },
  }
}

function buildStatusChartConfig(language: ReturnType<typeof useAppStore>['language']): ChartConfig {
  return {
    pending: {
      label: t('status.pending', language),
      color: STATUS_COLORS.pending,
    },
    under_review: {
      label: t('status.under_review', language),
      color: STATUS_COLORS.under_review,
    },
    ai_assessed: {
      label: t('status.ai_assessed', language),
      color: STATUS_COLORS.ai_assessed,
    },
    approved: {
      label: t('status.approved', language),
      color: STATUS_COLORS.approved,
    },
    rejected: {
      label: t('status.rejected', language),
      color: STATUS_COLORS.rejected,
    },
    escalated: {
      label: t('status.escalated', language),
      color: STATUS_COLORS.escalated,
    },
  }
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3 sm:space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] sm:h-[280px] w-full" />
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[200px] sm:h-[280px] w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[200px] sm:h-[280px] w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function MonthlyTrendChart({ data }: { data: DashboardStats['monthlyTrend'] }) {
  const { language } = useAppStore()
  const trendChartConfig = useMemo(() => buildTrendChartConfig(language), [language])

  const chartData = (data || []).map((item) => ({
    month: item.month,
    requests: item.requests,
    approved: item.approved,
    rejected: item.rejected,
  }))

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm sm:text-base font-semibold text-ae-black-700">
          {t('dashboard.monthlyTrend', language)}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 sm:px-6">
        <ChartContainer config={trendChartConfig} className="h-[200px] sm:h-[280px] w-full">
          <AreaChart
            data={chartData}
            margin={{ top: 10, right: 5, left: -10, bottom: 0 }}
          >
            <defs>
              <linearGradient id="fillRequests" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={AE_GOLD_500} stopOpacity={0.3} />
                <stop offset="95%" stopColor={AE_GOLD_500} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="fillApproved" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={AE_GREEN_600} stopOpacity={0.3} />
                <stop offset="95%" stopColor={AE_GREEN_600} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="fillRejected" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={AE_RED_600} stopOpacity={0.3} />
                <stop offset="95%" stopColor={AE_RED_600} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              className="text-xs"
              interval="preserveStartEnd"
            />
            <YAxis tickLine={false} axisLine={false} tickMargin={4} className="text-xs" width={40} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Area
              type="monotone"
              dataKey="requests"
              stroke={AE_GOLD_500}
              fill="url(#fillRequests)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="approved"
              stroke={AE_GREEN_600}
              fill="url(#fillApproved)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="rejected"
              stroke={AE_RED_600}
              fill="url(#fillRejected)"
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

function RiskDistributionChart({ data }: { data: DashboardStats['riskDistribution'] }) {
  const { language } = useAppStore()
  const riskChartConfig = useMemo(() => buildRiskChartConfig(language), [language])

  const riskLabelMap: Record<string, string> = {
    low: t('chart.low', language),
    medium: t('chart.medium', language),
    high: t('chart.high', language),
    critical: t('chart.critical', language),
  }

  const chartData = (data || []).map((item) => ({
    name: riskLabelMap[item.riskLevel] || item.riskLevel,
    value: item.count,
    riskLevel: item.riskLevel,
  }))

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm sm:text-base font-semibold text-ae-black-700">
          {t('dashboard.riskDistribution', language)}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 sm:px-6">
        <ChartContainer config={riskChartConfig} className="h-[220px] sm:h-[280px] w-full">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={70}
              paddingAngle={4}
              dataKey="value"
              nameKey="name"
              stroke="none"
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={RISK_COLORS[entry.riskLevel] || AE_GOLD_300}
                />
              ))}
            </Pie>
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent nameKey="riskLevel" />} />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

function StatusDistributionChart({ data }: { data: DashboardStats['statusDistribution'] }) {
  const { language } = useAppStore()
  const statusChartConfig = useMemo(() => buildStatusChartConfig(language), [language])

  const chartData = (data || []).map((item) => ({
    status: t(`status.${item.status}`, language),
    count: item.count,
    statusKey: item.status,
    fill: STATUS_COLORS[item.status] || AE_GOLD_300,
  }))

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm sm:text-base font-semibold text-ae-black-700">
          {t('dashboard.statusDistribution', language)}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 sm:px-6">
        <ChartContainer config={statusChartConfig} className="h-[220px] sm:h-[280px] w-full">
          <BarChart
            data={chartData}
            margin={{ top: 10, right: 5, left: -10, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" vertical={false} />
            <XAxis
              dataKey="status"
              tickLine={false}
              axisLine={false}
              tickMargin={4}
              className="text-xs"
              interval={0}
              angle={-30}
              textAnchor="end"
              height={50}
            />
            <YAxis tickLine={false} axisLine={false} tickMargin={4} className="text-xs" width={35} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar
              dataKey="count"
              radius={[4, 4, 0, 0]}
              maxBarSize={36}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 24,
    },
  },
}

export function Charts({ stats, loading }: ChartsProps) {
  if (loading) {
    return <LoadingSkeleton />
  }

  return (
    <motion.div
      className="space-y-3 sm:space-y-4"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Monthly Trend - Full width on top */}
      <motion.div variants={itemVariants}>
        <MonthlyTrendChart data={stats?.monthlyTrend || []} />
      </motion.div>

      {/* Risk + Status charts in 2-column grid */}
      <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2">
        <motion.div variants={itemVariants}>
          <RiskDistributionChart data={stats?.riskDistribution || []} />
        </motion.div>
        <motion.div variants={itemVariants}>
          <StatusDistributionChart data={stats?.statusDistribution || []} />
        </motion.div>
      </div>
    </motion.div>
  )
}
