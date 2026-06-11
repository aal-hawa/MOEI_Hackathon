'use client'

import { motion } from 'framer-motion'
import {
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  Timer,
  Bot,
  TrendingUp,
  TrendingDown,
  Percent,
  Users,
  FileCheck,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { t } from '@/lib/i18n'
import { useAppStore } from '@/lib/store'
import type { DashboardStats } from '@/lib/store'
import type { Language } from '@/lib/i18n'

interface StatsCardsProps {
  stats: DashboardStats | null
  loading: boolean
}

interface MetricCardData {
  key: string
  title: string
  value: string
  change: number
  icon: React.ElementType
  accentColor: string
  gradientFrom: string
  gradientTo: string
}

function getMetrics(stats: DashboardStats | null, language: Language): MetricCardData[] {
  return [
    {
      key: 'totalRequests',
      title: t('dashboard.totalRequests', language),
      value: stats ? stats.totalRequests.toLocaleString() : '0',
      change: 12.5,
      icon: FileText,
      accentColor: 'text-ae-gold-500',
      gradientFrom: 'from-ae-gold-50',
      gradientTo: 'to-transparent',
    },
    {
      key: 'pendingReview',
      title: t('dashboard.pendingReview', language),
      value: stats ? stats.pendingReview.toLocaleString() : '0',
      change: -3.2,
      icon: Clock,
      accentColor: 'text-ae-gold-400',
      gradientFrom: 'from-ae-gold-50',
      gradientTo: 'to-transparent',
    },
    {
      key: 'approvedThisMonth',
      title: t('dashboard.approvedThisMonth', language),
      value: stats ? stats.approvedThisMonth.toLocaleString() : '0',
      change: 8.7,
      icon: CheckCircle,
      accentColor: 'text-ae-green-600',
      gradientFrom: 'from-ae-green-50',
      gradientTo: 'to-transparent',
    },
    {
      key: 'rejectedThisMonth',
      title: t('dashboard.rejectedThisMonth', language),
      value: stats ? stats.rejectedThisMonth.toLocaleString() : '0',
      change: -2.1,
      icon: XCircle,
      accentColor: 'text-ae-red-600',
      gradientFrom: 'from-ae-red-50',
      gradientTo: 'to-transparent',
    },
    {
      key: 'avgProcessingTime',
      title: `${t('dashboard.avgProcessingTime', language)} (vs 5 Days)`,
      value: stats ? `${(stats.avgProcessingTime / 1000).toFixed(1)}s` : '0s',
      change: -99.9,
      icon: Timer,
      accentColor: 'text-ae-black-500',
      gradientFrom: 'from-ae-black-50',
      gradientTo: 'to-transparent',
    },
    {
      key: 'automationRate',
      title: t('dashboard.automationRate', language),
      value: stats ? `${stats.automationRate.toFixed(1)}%` : '0%',
      change: 5.4,
      icon: Bot,
      accentColor: 'text-ae-gold-500',
      gradientFrom: 'from-ae-gold-50',
      gradientTo: 'to-transparent',
    },
  ]
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
}

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 24,
    },
  },
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="overflow-hidden">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg" />
              <Skeleton className="h-3 w-12 sm:h-4 sm:w-16" />
            </div>
            <div className="mt-2 sm:mt-3 space-y-1.5 sm:space-y-2">
              <Skeleton className="h-3 w-16 sm:w-20" />
              <Skeleton className="h-5 w-12 sm:h-7 sm:w-16" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export function StatsCards({ stats, loading }: StatsCardsProps) {
  const { language } = useAppStore()

  if (loading) {
    return <LoadingSkeleton />
  }

  const metrics = getMetrics(stats, language)

  return (
    <motion.div
      className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {metrics.map((metric) => {
        const Icon = metric.icon
        const isPositive = metric.change >= 0

        return (
          <motion.div key={metric.key} variants={cardVariants}>
            <Card className={`overflow-hidden bg-gradient-to-br ${metric.gradientFrom} ${metric.gradientTo} border-0 shadow-sm hover:shadow-md transition-shadow`}>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div className={`flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-white/80 shadow-sm ${metric.accentColor}`}>
                    <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                  <div
                    className={`flex items-center gap-0.5 text-xs font-medium ${
                      isPositive ? 'text-ae-green-600' : 'text-ae-red-600'
                    }`}
                  >
                    {isPositive ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    <span>{Math.abs(metric.change)}%</span>
                  </div>
                </div>
                <div className="mt-2 sm:mt-3 min-w-0">
                  <p className="text-xs font-medium text-ae-black-400 truncate">
                    {metric.title}
                  </p>
                  <p className="mt-0.5 text-lg sm:text-2xl font-bold text-ae-black-700 tracking-tight break-words">
                    {metric.value}
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )
      })}
    </motion.div>
  )
}
