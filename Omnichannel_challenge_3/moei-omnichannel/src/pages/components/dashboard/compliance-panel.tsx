'use client'

import { useMemo, useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Shield, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useTranslation } from '@/i18n'

interface SLAMetric {
  key: string
  value: number
  target: number
  unit?: string
}

const INITIAL_SLA_METRICS: SLAMetric[] = [
  { key: 'responseTimeSLA', value: 0, target: 90 },
  { key: 'resolutionTimeSLA', value: 0, target: 90 },
  { key: 'fcrTarget', value: 0, target: 80 },
  { key: 'csatTarget', value: 0, target: 85 },
]

const INITIAL_COMPLIANCE_SCORE = 0

function getProgressColor(value: number, target: number): string {
  const ratio = value / target
  if (ratio >= 1) return 'bg-uae-green-500'
  if (ratio >= 0.9) return 'bg-uae-green-400'
  if (ratio >= 0.7) return 'bg-camel-yellow'
  return 'bg-uae-red-500'
}

function getTextColor(value: number, target: number): string {
  const ratio = value / target
  if (ratio >= 1) return 'text-uae-green-600'
  if (ratio >= 0.9) return 'text-uae-green-500'
  if (ratio >= 0.7) return 'text-camel-yellow'
  return 'text-uae-red-600'
}

function getIcon(value: number, target: number) {
  const ratio = value / target
  if (ratio >= 1) return CheckCircle2
  if (ratio >= 0.7) return AlertTriangle
  return XCircle
}

function CircularGauge({ value, max, label, t }: {
  value: number
  max: number
  label: string
  t: (key: string) => string
}) {
  const percentage = Math.min((value / max) * 100, 100)
  const radius = 40
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (percentage / 100) * circumference
  const color = value >= 90 ? '#0D9488' : value >= 70 ? '#F29F0E' : '#D83731'

  return (
    <div className="flex flex-col items-center">
      <svg width={100} height={100} viewBox="0 0 100 100" className="-rotate-90">
        {/* Background circle */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="var(--color-base-100)"
          strokeWidth={8}
        />
        {/* Progress arc */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      {/* Center text */}
      <div className="absolute flex flex-col items-center justify-center" style={{ width: 100, height: 100 }}>
        <span className="text-lg font-bold text-foreground">{value}</span>
        <span className="text-[8px] text-muted-foreground">/100</span>
      </div>
      <span className="text-[10px] text-muted-foreground mt-1">{label}</span>
    </div>
  )
}

export default function CompliancePanel() {
  const { t } = useTranslation()
  const [slaMetrics, setSlaMetrics] = useState<SLAMetric[]>(INITIAL_SLA_METRICS)
  const [complianceScore, setComplianceScore] = useState(INITIAL_COMPLIANCE_SCORE)

  useEffect(() => {
    fetch('/api/dashboard/predictions')
      .then(res => res.json())
      .then(data => {
        if (data.complianceMetrics) {
          const m = data.complianceMetrics
          setComplianceScore(m.score)
          setSlaMetrics([
            { key: 'responseTimeSLA', value: m.responseTimeSLA, target: 90 },
            { key: 'resolutionTimeSLA', value: m.resolutionTimeSLA, target: 90 },
            { key: 'fcrTarget', value: m.fcrTarget, target: 80 },
            { key: 'csatTarget', value: m.csatTarget, target: 85 },
          ])
        }
      })
      .catch(err => console.error('Failed to fetch compliance metrics', err))
  }, [])

  const alertCount = useMemo(() =>
    slaMetrics.filter(m => m.value < m.target).length, [slaMetrics])

  return (
    <Card className="relative overflow-hidden py-4 shadow-sm hover-lift">
      {/* Gradient accent */}
      <div className="h-1 bg-gradient-to-r from-brand-600 via-uae-green-500 to-brand-400" />

      <CardHeader className="px-4 pb-0 pt-0">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Shield className="h-4 w-4 text-brand-600" />
              {t('complianceTitle' as Parameters<typeof t>[0])}
            </CardTitle>
            <CardDescription className="text-xs">
              {t('complianceTitle' as Parameters<typeof t>[0])}
            </CardDescription>
          </div>
          {/* Alert count */}
          {alertCount > 0 && (
            <motion.div
              className="flex items-center gap-1.5 rounded-full border border-uae-red-200 bg-uae-red-50 dark:bg-uae-red-950/30 px-2.5 py-1"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-uae-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-uae-red-500" />
              </span>
              <span className="text-[10px] font-medium text-uae-red-700 dark:text-uae-red-400">
                {alertCount} {t('alert' as Parameters<typeof t>[0])}
              </span>
            </motion.div>
          )}
        </div>
      </CardHeader>

      <CardContent className="px-4 pt-3">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Circular Gauge */}
          <div className="relative flex items-center justify-center shrink-0">
            <CircularGauge
              value={complianceScore}
              max={100}
              label={t('complianceScore' as Parameters<typeof t>[0])}
              t={t}
            />
          </div>

          {/* SLA Metrics */}
          <div className="flex-1 space-y-3">
            {slaMetrics.map((metric, i) => {
              const Icon = getIcon(metric.value, metric.target)
              const isBelow = metric.value < metric.target
              return (
                <motion.div
                  key={metric.key}
                  className="space-y-1"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Icon className={`h-3.5 w-3.5 ${isBelow ? 'text-uae-red-500' : 'text-uae-green-500'}`} />
                      <span className="text-xs font-medium text-foreground">
                        {t(metric.key as Parameters<typeof t>[0])}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold ${getTextColor(metric.value, metric.target)}`}>
                        {metric.value}%
                      </span>
                      <span className="text-[9px] text-muted-foreground">
                        {t('ofTarget' as Parameters<typeof t>[0])} {metric.target}%
                      </span>
                      {isBelow && (
                        <Badge variant="destructive" className="h-4 text-[8px] px-1.5 py-0">
                          {t('slaBelowTarget' as Parameters<typeof t>[0])}
                        </Badge>
                      )}
                      {!isBelow && (
                        <Badge variant="secondary" className="h-4 text-[8px] px-1.5 py-0 bg-uae-green-50 text-uae-green-700 dark:bg-uae-green-950/30 dark:text-uae-green-400">
                          {t('slaMet' as Parameters<typeof t>[0])}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="h-2 w-full overflow-hidden rounded-full bg-base-100 dark:bg-base-900/50">
                    <motion.div
                      className={`h-full rounded-full ${getProgressColor(metric.value, metric.target)}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${metric.value}%` }}
                      transition={{ duration: 0.8, delay: i * 0.1, ease: 'easeOut' }}
                    />
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
