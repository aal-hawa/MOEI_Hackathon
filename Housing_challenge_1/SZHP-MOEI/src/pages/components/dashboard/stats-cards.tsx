
import { motion } from 'framer-motion'
import {
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  Timer,
  Bot,
  Users,
  Gauge,
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
  subtitle?: string
  icon: React.ElementType
  accentColor: string
  gradientFrom: string
  gradientTo: string
}

function formatProcessingTime(seconds: number): string {
  if (seconds <= 0) return '0s'
  const days = seconds / 86400
  const hours = seconds / 3600
  if (days >= 1) return `${days.toFixed(1)}d`
  if (hours >= 1) return `${hours.toFixed(1)}h`
  return `${seconds.toFixed(0)}s`
}

function formatResponseTime(hours: number): string {
  if (hours <= 0) return '0h'
  if (hours >= 24) {
    const days = hours / 24
    return `${days.toFixed(1)}d`
  }
  return `${hours.toFixed(1)}h`
}

function getGenderSplitText(stats: DashboardStats | null): { value: string; subtitle: string } {
  if (!stats?.genderDistribution || stats.genderDistribution.length === 0) {
    return { value: '0', subtitle: 'M / F' }
  }
  const male = stats.genderDistribution.find(g => g.gender?.toLowerCase() === 'male')?.count || 0
  const female = stats.genderDistribution.find(g => g.gender?.toLowerCase() === 'female')?.count || 0
  return { value: `${male + female}`, subtitle: `M${male} / F${female}` }
}

function getMetrics(stats: DashboardStats | null, language: Language): MetricCardData[] {
  const genderSplit = getGenderSplitText(stats)

  return [
    {
      key: 'totalRequests',
      title: t('dashboard.totalRequests', language),
      value: stats ? stats.totalRequests.toLocaleString() : '0',
      icon: FileText,
      accentColor: 'text-ae-gold-500',
      gradientFrom: 'from-ae-gold-50',
      gradientTo: 'to-transparent',
    },
    {
      key: 'pendingReview',
      title: t('dashboard.pendingReview', language),
      value: stats ? stats.pendingReview.toLocaleString() : '0',
      icon: Clock,
      accentColor: 'text-ae-gold-400',
      gradientFrom: 'from-ae-gold-50',
      gradientTo: 'to-transparent',
    },
    {
      key: 'approvedThisMonth',
      title: t('dashboard.approvedThisMonth', language),
      value: stats ? stats.approvedThisMonth.toLocaleString() : '0',
      icon: CheckCircle,
      accentColor: 'text-ae-green-600',
      gradientFrom: 'from-ae-green-50',
      gradientTo: 'to-transparent',
    },
    {
      key: 'rejectedThisMonth',
      title: t('dashboard.rejectedThisMonth', language),
      value: stats ? stats.rejectedThisMonth.toLocaleString() : '0',
      icon: XCircle,
      accentColor: 'text-ae-red-600',
      gradientFrom: 'from-ae-red-50',
      gradientTo: 'to-transparent',
    },
    {
      key: 'avgProcessingTime',
      title: t('dashboard.avgProcessingTime', language),
      value: stats ? formatProcessingTime(stats.avgProcessingTime) : '0s',
      icon: Timer,
      accentColor: 'text-ae-black-500',
      gradientFrom: 'from-ae-black-50',
      gradientTo: 'to-transparent',
    },
    {
      key: 'automationRate',
      title: t('dashboard.automationRate', language),
      value: stats ? `${stats.automationRate.toFixed(1)}%` : '0%',
      icon: Bot,
      accentColor: 'text-ae-gold-500',
      gradientFrom: 'from-ae-gold-50',
      gradientTo: 'to-transparent',
    },
    {
      key: 'avgResponseTime',
      title: t('dashboard.avgResponseTime', language),
      value: stats ? formatResponseTime(stats.avgResponseTimeHours || 0) : '0h',
      icon: Gauge,
      accentColor: 'text-ae-gold-700',
      gradientFrom: 'from-ae-gold-50',
      gradientTo: 'to-transparent',
    },
    {
      key: 'genderSplit',
      title: t('dashboard.genderSplit', language),
      value: genderSplit.value,
      subtitle: genderSplit.subtitle,
      icon: Users,
      accentColor: 'text-ae-gold-500',
      gradientFrom: 'from-ae-gold-50',
      gradientTo: 'to-transparent',
    },
  ]
}

const containerVariants: Record<string, Record<string, any>> = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
}

const cardVariants: Record<string, Record<string, any>> = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring' as const,
      stiffness: 300,
      damping: 24,
    },
  },
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <Card key={i} className="overflow-hidden">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg" />
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
      className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {metrics.map((metric) => {
        const Icon = metric.icon

        return (
          <motion.div key={metric.key} variants={cardVariants}>
            <Card className={`overflow-hidden bg-gradient-to-br ${metric.gradientFrom} ${metric.gradientTo} border-0 shadow-sm hover:shadow-md transition-shadow`}>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div className={`flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-white/80 shadow-sm ${metric.accentColor}`}>
                    <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                </div>
                <div className="mt-2 sm:mt-3 min-w-0">
                  <p className="text-xs font-medium text-ae-black-400 truncate">
                    {metric.title}
                  </p>
                  <p className="mt-0.5 text-lg sm:text-2xl font-bold text-ae-black-700 tracking-tight break-words">
                    {metric.value}
                  </p>
                  {metric.subtitle && (
                    <p className="text-xs text-ae-black-400 mt-0.5">
                      {metric.subtitle}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )
      })}
    </motion.div>
  )
}
