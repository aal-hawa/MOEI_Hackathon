'use client'

import { useMemo, useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Brain, Zap, Clock, Heart, TrendingUp } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { useTranslation } from '@/i18n'

const DONUT_COLORS = ['#0D9488', '#94A3B8']

export default function AIPerformancePanel() {
  const { t } = useTranslation()

  // Dynamic state
  // Dynamic state (zero-state fallback when no data is provided from backend)
  const [metricsData, setMetricsData] = useState({
    resolutionRate: '0%',
    avgResponseTime: '0.0s',
    handoffRate: '0%',
    customerSatisfaction: '0.0/5',
    learningProgress: 0,
    donutData: [
      { name: 'AI Resolution', value: 0 },
      { name: 'Human Resolution', value: 0 },
    ],
    trendData: [
      { day: 'Mon', score: 0 },
      { day: 'Tue', score: 0 },
      { day: 'Wed', score: 0 },
      { day: 'Thu', score: 0 },
      { day: 'Fri', score: 0 },
      { day: 'Sat', score: 0 },
      { day: 'Sun', score: 0 },
    ]
  })

  // AI Performance metrics
  const metrics = useMemo(() => [
    {
      key: 'aiResolutionRate',
      value: metricsData.resolutionRate,
      icon: Zap,
      color: 'text-brand-600',
      bgColor: 'bg-brand-50',
    },
    {
      key: 'aiAvgResponseTime',
      value: metricsData.avgResponseTime,
      icon: Clock,
      color: 'text-tech-blue',
      bgColor: 'bg-blue-50',
    },
    {
      key: 'aiHandoffRate',
      value: metricsData.handoffRate,
      icon: TrendingUp,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
    },
    {
      key: 'aiCustomerSatisfaction',
      value: metricsData.customerSatisfaction,
      icon: Heart,
      color: 'text-uae-green-600',
      bgColor: 'bg-uae-green-50',
    },
  ], [metricsData])

  // AI vs Human donut data
  const donutData = useMemo(() => [
    { name: t('aiResolution'), value: metricsData.donutData[0].value },
    { name: t('humanResolution'), value: metricsData.donutData[1].value },
  ], [metricsData, t])

  // AI Performance trend over last 7 days
  const trendData = metricsData.trendData

  const learningProgress = metricsData.learningProgress

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.06 },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 8 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.25 } },
  }

  return (
    <Card className="relative overflow-hidden group">
      {/* Teal gradient header bar */}
      <div className="h-1 bg-gradient-to-r from-teal-400 via-brand-500 to-teal-600" />
      <CardContent className="relative p-4 md:p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-teal-50 to-brand-50 dark:from-teal-900/40 dark:to-brand-900/40 border border-teal-200 dark:border-teal-700">
              <Brain className="w-3.5 h-3.5 text-brand-600" />
              <span className="text-xs font-semibold text-brand-700 dark:text-brand-300">
                {t('aiPerformanceInsights')}
              </span>
            </div>
          </div>
          <Badge variant="outline" className="text-[9px] h-5 px-1.5 border-teal-300 text-teal-700 dark:border-teal-600 dark:text-teal-300">
            {t('aiPerformanceScore')}
          </Badge>
        </div>

        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Left: Metric Cards */}
          <motion.div className="grid grid-cols-2 gap-2" variants={itemVariants}>
            {metrics.map((metric) => {
              const Icon = metric.icon
              return (
                <div
                  key={metric.key}
                  className="rounded-lg border border-border bg-card p-2.5 hover:shadow-sm transition-shadow"
                >
                  <div className={`inline-flex h-6 w-6 items-center justify-center rounded-md ${metric.bgColor} mb-1.5`}>
                    <Icon className={`h-3 w-3 ${metric.color}`} />
                  </div>
                  <p className="text-lg font-bold text-foreground leading-tight">{metric.value}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{t(metric.key as Parameters<typeof t>[0])}</p>
                </div>
              )
            })}
          </motion.div>

          {/* Center: AI vs Human Donut Chart */}
          <motion.div className="flex flex-col items-center justify-center" variants={itemVariants}>
            <p className="text-[10px] font-medium text-muted-foreground mb-1">
              {t('aiVsHumanResolution')}
            </p>
            <div className="w-full h-40 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={60}
                    paddingAngle={4}
                    dataKey="value"
                    nameKey="name"
                    strokeWidth={0}
                  >
                    {donutData.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string) => [`${value}%`, name]}
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid var(--color-border)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                      fontSize: '11px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Center label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xl font-bold text-foreground">{metricsData.resolutionRate}</span>
                <span className="text-[9px] text-muted-foreground">{t('aiResolution')}</span>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-brand-500" />
                <span className="text-[9px] text-muted-foreground">{t('aiResolution')}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-slate-400" />
                <span className="text-[9px] text-muted-foreground">{t('humanResolution')}</span>
              </div>
            </div>
          </motion.div>

          {/* Right: Performance Trend + Learning Progress */}
          <motion.div className="flex flex-col gap-3" variants={itemVariants}>
            {/* Trend Chart */}
            <div className="flex-1">
              <p className="text-[10px] font-medium text-muted-foreground mb-1">
                {t('aiPerformanceTrend')}
              </p>
              <div className="h-24">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 2, right: 4, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradAIPerf" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0D9488" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#0D9488" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 8, fill: 'var(--color-base-400)' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      domain={[70, 90]}
                      tick={{ fontSize: 8, fill: 'var(--color-base-400)' }}
                      tickLine={false}
                      axisLine={false}
                      width={22}
                    />
                    <Tooltip
                      formatter={(value: number) => [`${value}%`, t('aiPerformanceScore')]}
                      contentStyle={{
                        borderRadius: '8px',
                        border: '1px solid var(--color-border)',
                        fontSize: '10px',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="score"
                      stroke="#0D9488"
                      strokeWidth={2}
                      fill="url(#gradAIPerf)"
                      dot={{ r: 2.5, fill: '#0D9488', strokeWidth: 0 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* AI Learning Progress Bar */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-medium text-muted-foreground">
                  {t('aiLearningProgress')}
                </span>
                <span className="text-[10px] font-bold text-brand-600">{learningProgress}%</span>
              </div>
              <Progress value={learningProgress} className="h-2" />
              <p className="text-[9px] text-muted-foreground mt-0.5">
                {t('improvementOverTime')}
              </p>
            </div>
          </motion.div>
        </motion.div>
      </CardContent>
    </Card>
  )
}
