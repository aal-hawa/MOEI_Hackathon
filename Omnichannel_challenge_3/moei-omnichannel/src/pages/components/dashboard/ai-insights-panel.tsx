'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  TrendingUp,
  AlertTriangle,
  Heart,
  Clock,
  Sparkles,
  ArrowRight,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useTranslation } from '@/i18n'
import { useToast } from '@/hooks/use-toast'

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
  }[]
  workforceRecommendation: {
    currentStaffing: number
    currentOnline: number
    recommendedStaffing: number
    peakHours: { start: string; end: string; recommendedAgents: number }[]
    averageCasesPerAgent: number
    predictedVolumeIncrease: number
    suggestedAction: string
  }
}

interface Insight {
  id: string
  icon: React.ElementType
  iconBg: string
  iconColor: string
  titleKey: string
  description: string
  confidence: number
  trend?: 'up' | 'down' | 'stable'
  severity?: 'high' | 'medium' | 'low'
  actionKey: string
  detailKey: string
  timeToImpact: string
  metricValue: string
}

function ConfidenceGauge({ value }: { value: number }) {
  const percentage = Math.min(value, 100)
  const color = percentage >= 80 ? '#0D9488' : percentage >= 60 ? '#F29F0E' : '#D83731'
  const angle = (percentage / 100) * 180

  return (
    <div className="flex items-center gap-1.5">
      <svg width={36} height={20} viewBox="0 0 36 20">
        <path d="M 4 18 A 14 14 0 0 1 32 18" fill="none" stroke="var(--color-base-200)" strokeWidth={3} strokeLinecap="round" />
        <path d="M 4 18 A 14 14 0 0 1 32 18" fill="none" stroke={color} strokeWidth={3} strokeLinecap="round"
          strokeDasharray={`${angle * 0.25} 200`} />
      </svg>
      <span className="text-[10px] font-medium" style={{ color }}>{percentage}%</span>
    </div>
  )
}

export default function AIInsightsPanel() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const [insights, setInsights] = useState<Insight[]>([])
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [predictions, setPredictions] = useState<PredictionData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchPredictions = useCallback(async () => {
    try {
      const provider = typeof window !== 'undefined' ? localStorage.getItem('ai_provider') || 'gemini' : 'gemini'
      const res = await fetch(`/api/dashboard/predictions?provider=${provider}`)
      if (res.ok) {
        const data = await res.json()
        setPredictions(data)
      }
    } catch (err) {
      console.error('Failed to fetch predictions for insights:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const buildInsights = useCallback((data: PredictionData | null): Insight[] => {
    const totalPredicted = data?.volumeForecast?.reduce((s, f) => s + f.predictedVolume, 0) || 0
    const avgConfidence = data?.volumeForecast?.length
      ? Math.round(data.volumeForecast.reduce((s, f) => s + f.confidence, 0) / data.volumeForecast.length * 100)
      : 0
    const escalationCount = data?.escalationRisks?.length || 0
    const highRisks = data?.escalationRisks?.filter(r => r.riskLevel === 'high').length || 0
    const volumeIncrease = data?.workforceRecommendation?.predictedVolumeIncrease || 0
    const extraAgents = data?.workforceRecommendation
      ? Math.max(0, data.workforceRecommendation.recommendedStaffing - data.workforceRecommendation.currentOnline)
      : 0

    return [
      {
        id: 'volume',
        icon: TrendingUp,
        iconBg: 'bg-brand-50',
        iconColor: 'text-brand-600',
        titleKey: 'predictedVolume',
        description: t('predictedVolumeDesc' as Parameters<typeof t>[0]).replace('{pct}', String(volumeIncrease)),
        confidence: avgConfidence,
        trend: 'up',
        actionKey: 'viewDetails',
        detailKey: 'insightDetailVolume',
        timeToImpact: `${2}${t('hoursShort' as Parameters<typeof t>[0])} ${30}${t('minutesShort' as Parameters<typeof t>[0])}`,
        metricValue: `${totalPredicted}`,
      },
      {
        id: 'escalation',
        icon: AlertTriangle,
        iconBg: 'bg-uae-red-50',
        iconColor: 'text-uae-red-600',
        titleKey: 'escalationRisk',
        description: t('escalationRiskDesc' as Parameters<typeof t>[0]).replace('{count}', String(escalationCount)),
        confidence: 78 + Math.min(highRisks * 3, 15),
        severity: highRisks > 2 ? 'high' : 'medium',
        actionKey: 'viewDetails',
        detailKey: 'insightDetailEscalation',
        timeToImpact: `${1}${t('hoursShort' as Parameters<typeof t>[0])} ${45}${t('minutesShort' as Parameters<typeof t>[0])}`,
        metricValue: `${escalationCount}`,
      },
      {
        id: 'sentiment',
        icon: Heart,
        iconBg: 'bg-uae-green-50',
        iconColor: 'text-uae-green-600',
        titleKey: 'sentimentTrend',
        description: t('sentimentTrendDesc' as Parameters<typeof t>[0]),
        confidence: 88,
        trend: 'up',
        actionKey: 'viewDetails',
        detailKey: 'insightDetailSentiment',
        timeToImpact: `${4}${t('hoursShort' as Parameters<typeof t>[0])}`,
        metricValue: '+5%',
      },
      {
        id: 'staffing',
        icon: Clock,
        iconBg: 'bg-amber-50',
        iconColor: 'text-amber-600',
        titleKey: 'staffingRecommendation',
        description: t('staffingRecommendationDesc' as Parameters<typeof t>[0]).replace('{count}', String(extraAgents)),
        confidence: 82,
        actionKey: 'viewDetails',
        detailKey: 'insightDetailStaffing',
        timeToImpact: `${1}${t('hoursShort' as Parameters<typeof t>[0])} ${15}${t('minutesShort' as Parameters<typeof t>[0])}`,
        metricValue: `+${extraAgents}`,
      },
    ]
  }, [t])

  const refreshInsights = useCallback(() => {
    setIsRefreshing(true)
    fetchPredictions().then(() => {
      setLastRefresh(new Date())
      setIsRefreshing(false)
    })
  }, [fetchPredictions])

  // Initial load & auto-refresh
  useEffect(() => {
    fetchPredictions()
  }, [fetchPredictions])

  useEffect(() => {
    if (predictions) {
      setInsights(buildInsights(predictions))
    }
  }, [predictions, buildInsights])

  useEffect(() => {
    const interval = setInterval(() => {
      fetchPredictions()
      setLastRefresh(new Date())
    }, 30000)
    return () => clearInterval(interval)
  }, [fetchPredictions])

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08 },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
    exit: { opacity: 0, y: -8, transition: { duration: 0.2 } },
  }

  return (
    <Card className="relative overflow-hidden border-brand-200/50 dark:border-brand-800/30 group">
      {/* Gradient Header Bar */}
      <div className="h-1.5 bg-gradient-to-r from-[#0D9488] via-[#0F766E] to-[#14B8A6]" />
      {/* Animated gradient border on hover */}
      <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none ring-1 ring-inset ring-brand-400/50" />
      {/* Glassmorphism background overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-brand-50/30 via-transparent to-teal-50/20 dark:from-brand-950/20 dark:via-transparent dark:to-teal-950/10 pointer-events-none" />
      <CardContent className="relative p-4 md:p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-brand-50 to-teal-50 dark:from-brand-900/50 dark:to-teal-900/50 border border-brand-200 dark:border-brand-700">
              <Sparkles className="w-3.5 h-3.5 text-brand-600" />
              <span className="text-xs font-semibold text-brand-700 dark:text-brand-300">{t('aiInsights')}</span>
            </div>
            <span className="text-[10px] text-muted-foreground" suppressHydrationWarning>
              {t('lastUpdated')}: {lastRefresh ? lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={refreshInsights}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
            {t('refresh')}
          </Button>
        </div>

        {/* Skeleton Loading */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-xl border p-3.5 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-muted animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-24 rounded bg-muted animate-pulse" />
                    <div className="h-2.5 w-full rounded bg-muted animate-pulse" />
                    <div className="h-2.5 w-3/4 rounded bg-muted animate-pulse" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Insights Grid */
          <AnimatePresence mode="wait">
            <motion.div
              className="grid grid-cols-1 md:grid-cols-2 gap-3"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              key={insights.map(i => `${i.id}-${i.confidence}`).join('|')}
            >
              {insights.map((insight) => {
                const Icon = insight.icon
                const isExpanded = expandedId === insight.id
                return (
                  <motion.div
                    key={insight.id}
                    variants={itemVariants}
                    layout
                    className="group"
                  >
                    <motion.div
                      className={`rounded-xl border p-3.5 transition-all duration-200 hover:shadow-md cursor-pointer ${
                        insight.severity === 'high'
                          ? 'border-uae-red-200 bg-uae-red-50/30 dark:bg-uae-red-950/20'
                          : insight.severity === 'medium'
                            ? 'border-amber-200 bg-amber-50/30 dark:bg-amber-950/20'
                            : 'border-border bg-card hover:border-brand-200 dark:hover:border-brand-700'
                      }`}
                      onClick={() => setExpandedId(isExpanded ? null : insight.id)}
                      whileHover={{ scale: 1.005 }}
                      whileTap={{ scale: 0.995 }}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`flex-shrink-0 w-9 h-9 rounded-lg ${insight.iconBg} flex items-center justify-center`}>
                          <Icon className={`w-4.5 h-4.5 ${insight.iconColor}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-sm font-semibold text-foreground">{t(insight.titleKey as Parameters<typeof t>[0])}</h4>
                            {insight.metricValue && (
                              <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-brand-300 text-brand-700 dark:border-brand-600 dark:text-brand-300 font-semibold">
                                {insight.metricValue}
                              </Badge>
                            )}
                            {insight.trend === 'up' && (
                              <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-uae-green-300 text-uae-green-700">
                                ↑
                              </Badge>
                            )}
                            {insight.trend === 'down' && (
                              <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-uae-red-300 text-uae-red-700">
                                ↓
                              </Badge>
                            )}
                            {insight.severity && (
                              <Badge
                                variant={insight.severity === 'high' ? 'destructive' : 'secondary'}
                                className="text-[9px] h-4 px-1.5"
                              >
                                {insight.severity === 'high' ? t('critical' as Parameters<typeof t>[0]) : insight.severity}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed mb-2 line-clamp-2">
                            {insight.description}
                          </p>

                          {/* Confidence Gauge + Time to Impact */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <ConfidenceGauge value={insight.confidence} />
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3 text-muted-foreground" />
                                <span className="text-[10px] text-muted-foreground">
                                  {t('timeToImpact' as Parameters<typeof t>[0])}: {insight.timeToImpact}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-muted-foreground">
                                {isExpanded ? t('collapseDetails' as Parameters<typeof t>[0]) : t('expandDetails' as Parameters<typeof t>[0])}
                              </span>
                              {isExpanded ? (
                                <ChevronUp className="w-3 h-3 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="w-3 h-3 text-muted-foreground" />
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Expandable Detail */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="mt-3 pt-3 border-t border-border/50">
                              <p className="text-xs text-muted-foreground leading-relaxed">
                                {t(insight.detailKey as Parameters<typeof t>[0])}
                              </p>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 text-[10px] px-1.5 gap-0.5 mt-2 text-brand-600 hover:text-brand-700"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  toast({
                                    title: t(insight.titleKey as Parameters<typeof t>[0]),
                                    description: t(insight.detailKey as Parameters<typeof t>[0]).slice(0, 100) + '...',
                                  })
                                }}
                              >
                                {t(insight.actionKey as Parameters<typeof t>[0])}
                                <ArrowRight className="w-2.5 h-2.5" />
                              </Button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  </motion.div>
                )
              })}
            </motion.div>
          </AnimatePresence>
        )}
      </CardContent>
    </Card>
  )
}
