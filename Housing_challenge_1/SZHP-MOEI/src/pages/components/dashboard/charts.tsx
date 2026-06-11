
import { useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  BarChart,
  Bar,
  LineChart,
  Line,
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
import type { Language } from '@/lib/i18n'
import { useAppStore } from '@/lib/store'
import type { DashboardStats } from '@/lib/store'
import {
  AE_GOLD_300, AE_GOLD_400, AE_GOLD_500, AE_GOLD_700,
  AE_GREEN_500, AE_GREEN_600, AE_RED_600,
  STATUS_CHART_COLORS,
} from '@/lib/constants'
import { RISK_CONFIG } from '@/lib/risk-config'

interface ChartsProps {
  stats: DashboardStats | null
  loading: boolean
}

// ── Chart config builders (dynamic, language-aware) ──────────────────
function buildTrendChartConfig(language: Language): ChartConfig {
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

function buildRiskChartConfig(language: Language): ChartConfig {
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

function buildStatusChartConfig(language: Language): ChartConfig {
  return {
    pending: {
      label: t('status.pending', language),
      color: STATUS_CHART_COLORS.pending,
    },
    under_review: {
      label: t('status.under_review', language),
      color: STATUS_CHART_COLORS.under_review,
    },
    ai_assessed: {
      label: t('status.ai_assessed', language),
      color: STATUS_CHART_COLORS.ai_assessed,
    },
    approved: {
      label: t('status.approved', language),
      color: STATUS_CHART_COLORS.approved,
    },
    rejected: {
      label: t('status.rejected', language),
      color: STATUS_CHART_COLORS.rejected,
    },
    escalated: {
      label: t('status.escalated', language),
      color: STATUS_CHART_COLORS.escalated,
    },
  }
}

function buildGenderChartConfig(language: Language): ChartConfig {
  return {
    male: {
      label: language === 'ar' ? 'ذكر' : 'Male',
      color: '#3B82F6',
    },
    female: {
      label: language === 'ar' ? 'أنثى' : 'Female',
      color: AE_GOLD_500,
    },
  }
}

function buildAgeChartConfig(): ChartConfig {
  return {
    count: {
      label: 'Count',
      color: AE_GOLD_500,
    },
  }
}

function buildResponseTimeChartConfig(language: Language): ChartConfig {
  return {
    avgHours: {
      label: t('chart.avgResponseHours', language),
      color: AE_GOLD_700,
    },
  }
}

// ── Gender color map ──────────────────────────────────────────────
const GENDER_COLORS: Record<string, string> = {
  male: '#3B82F6',
  Male: '#3B82F6',
  M: '#3B82F6',
  female: AE_GOLD_500,
  Female: AE_GOLD_500,
  F: AE_GOLD_500,
}

// ── Age group color map ──────────────────────────────────────────
const AGE_GROUP_COLORS: Record<string, string> = {
  '18-24': AE_GREEN_500,
  '25-34': AE_GOLD_400,
  '35-44': AE_GOLD_500,
  '45-54': AE_GOLD_700,
  '55+': AE_RED_600,
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

// ── Monthly Trend Chart ──────────────────────────────────────────────
function MonthlyTrendChart({ data }: { data: DashboardStats['monthlyTrend'] }) {
  const { language } = useAppStore()
  const trendChartConfig = useMemo(() => buildTrendChartConfig(language), [language])

  const chartData = (data || []).map((item) => ({
    month: item.month,
    requests: item.requests,
    approved: item.approved,
    rejected: item.rejected,
  }))

  if (chartData.length === 0) {
    return (
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm sm:text-base font-semibold text-ae-black-700">
            {t('dashboard.monthlyTrend', language)}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[200px] sm:h-[280px]">
          <p className="text-ae-black-400 text-sm">{language === 'ar' ? 'لا توجد بيانات بعد' : 'No data yet'}</p>
        </CardContent>
      </Card>
    )
  }

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

// ── Risk Distribution Chart ──────────────────────────────────────────
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
                  fill={RISK_CONFIG[entry.riskLevel]?.chartColor || AE_GOLD_300}
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

// ── Status Distribution Chart ────────────────────────────────────────
function StatusDistributionChart({ data }: { data: DashboardStats['statusDistribution'] }) {
  const { language } = useAppStore()
  const statusChartConfig = useMemo(() => buildStatusChartConfig(language), [language])

  const chartData = (data || []).map((item) => ({
    status: t(`status.${item.status}`, language),
    count: item.count,
    statusKey: item.status,
    fill: STATUS_CHART_COLORS[item.status] || AE_GOLD_300,
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

// ── Gender Distribution Chart ────────────────────────────────────────
function GenderDistributionChart({ data }: { data: DashboardStats['genderDistribution'] }) {
  const { language } = useAppStore()
  const genderChartConfig = useMemo(() => buildGenderChartConfig(language), [language])

  const genderLabelMap: Record<string, string> = {
    male: language === 'ar' ? 'ذكر' : 'Male',
    Male: language === 'ar' ? 'ذكر' : 'Male',
    M: language === 'ar' ? 'ذكر' : 'Male',
    female: language === 'ar' ? 'أنثى' : 'Female',
    Female: language === 'ar' ? 'أنثى' : 'Female',
    F: language === 'ar' ? 'أنثى' : 'Female',
  }

  const chartData = (data || []).map((item) => ({
    name: genderLabelMap[item.gender] || item.gender,
    value: item.count,
    genderKey: item.gender,
  }))

  if (chartData.length === 0) {
    return (
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm sm:text-base font-semibold text-ae-black-700">
            {t('dashboard.genderDistribution', language)}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[220px] sm:h-[280px]">
          <p className="text-ae-black-400 text-sm">{language === 'ar' ? 'لا توجد بيانات بعد' : 'No data yet'}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm sm:text-base font-semibold text-ae-black-700">
          {t('dashboard.genderDistribution', language)}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 sm:px-6">
        <ChartContainer config={genderChartConfig} className="h-[220px] sm:h-[280px] w-full">
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
                  fill={GENDER_COLORS[entry.genderKey] || AE_GOLD_300}
                />
              ))}
            </Pie>
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent nameKey="genderKey" />} />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

// ── Age Distribution Chart ──────────────────────────────────────────
function AgeDistributionChart({ data }: { data: DashboardStats['ageDistribution'] }) {
  const { language } = useAppStore()
  const ageChartConfig = useMemo(() => buildAgeChartConfig(), [language])

  const chartData = (data || []).map((item) => ({
    ageGroup: item.ageGroup,
    count: item.count,
    fill: AGE_GROUP_COLORS[item.ageGroup] || AE_GOLD_300,
  }))

  if (chartData.length === 0) {
    return (
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm sm:text-base font-semibold text-ae-black-700">
            {t('dashboard.ageDistribution', language)}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[220px] sm:h-[280px]">
          <p className="text-ae-black-400 text-sm">{language === 'ar' ? 'لا توجد بيانات بعد' : 'No data yet'}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm sm:text-base font-semibold text-ae-black-700">
          {t('dashboard.ageDistribution', language)}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 sm:px-6">
        <ChartContainer config={ageChartConfig} className="h-[220px] sm:h-[280px] w-full">
          <BarChart
            data={chartData}
            margin={{ top: 10, right: 5, left: -10, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" vertical={false} />
            <XAxis
              dataKey="ageGroup"
              tickLine={false}
              axisLine={false}
              tickMargin={4}
              className="text-xs"
            />
            <YAxis tickLine={false} axisLine={false} tickMargin={4} className="text-xs" width={35} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar
              dataKey="count"
              radius={[4, 4, 0, 0]}
              maxBarSize={48}
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

// ── Response Time Trend Chart ──────────────────────────────────────
function ResponseTimeTrendChart({ data }: { data: DashboardStats['responseTimeTrend'] }) {
  const { language } = useAppStore()
  const responseTimeChartConfig = useMemo(() => buildResponseTimeChartConfig(language), [language])

  const chartData = (data || []).map((item) => ({
    month: item.month,
    avgHours: Math.round((item.avgHours || 0) * 10) / 10,
  }))

  if (chartData.length === 0) {
    return (
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm sm:text-base font-semibold text-ae-black-700">
            {t('dashboard.responseTimeTrend', language)}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[220px] sm:h-[280px]">
          <p className="text-ae-black-400 text-sm">{language === 'ar' ? 'لا توجد بيانات بعد' : 'No data yet'}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm sm:text-base font-semibold text-ae-black-700">
          {t('dashboard.responseTimeTrend', language)}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 sm:px-6">
        <ChartContainer config={responseTimeChartConfig} className="h-[220px] sm:h-[280px] w-full">
          <LineChart
            data={chartData}
            margin={{ top: 10, right: 5, left: -10, bottom: 0 }}
          >
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
            <Line
              type="monotone"
              dataKey="avgHours"
              stroke={AE_GOLD_700}
              strokeWidth={2}
              dot={{ r: 4, fill: AE_GOLD_700 }}
              activeDot={{ r: 6, fill: AE_GOLD_700 }}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

// ── Animation Variants ───────────────────────────────────────────────
const containerVariants: Record<string, Record<string, any>> = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
}

const itemVariants: Record<string, Record<string, any>> = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring' as const,
      stiffness: 300,
      damping: 24,
    },
  },
}

// ── Main Charts Component ────────────────────────────────────────────
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

      {/* Gender + Age charts in 2-column grid */}
      <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2">
        <motion.div variants={itemVariants}>
          <GenderDistributionChart data={stats?.genderDistribution || []} />
        </motion.div>
        <motion.div variants={itemVariants}>
          <AgeDistributionChart data={stats?.ageDistribution || []} />
        </motion.div>
      </div>

      {/* Response Time Trend - Full width */}
      <motion.div variants={itemVariants}>
        <ResponseTimeTrendChart data={stats?.responseTimeTrend || []} />
      </motion.div>
    </motion.div>
  )
}
