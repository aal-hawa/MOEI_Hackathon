import { motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, Cpu, Route } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { type RiskThresholds } from '@/lib/business/risk-thresholds'
import { t, type Language } from '@/lib/i18n'

function getRiskLevel(score: number, thresholds: RiskThresholds): 'low' | 'medium' | 'high' | 'critical' {
  if (score <= thresholds.low) return 'low'
  if (score <= thresholds.medium) return 'medium'
  if (score <= thresholds.high) return 'high'
  return 'critical'
}

function getRiskColor(level: string) {
  if (level === 'critical' || level === 'high') return 'var(--moei-danger)'
  if (level === 'medium') return 'var(--moei-warning)'
  return 'var(--moei-success)'
}

export interface RiskScoreGaugeProps {
  score: number
  confidence: number
  lang: Language
  thresholds: RiskThresholds
  decisionPath?: 'auto' | 'human'
}

export function RiskScoreGauge({ score, confidence, lang, thresholds, decisionPath }: RiskScoreGaugeProps) {
  const riskLevel = getRiskLevel(score, thresholds)
  const gaugeValue = Math.max(0, Math.min(100, confidence))
  const arcLength = 220
  const arcOffset = arcLength - (gaugeValue / 100) * arcLength
  const isHuman = decisionPath === 'human'
  const color = isHuman ? 'var(--moei-danger)' : getRiskColor(riskLevel)
  const riskLabel =
    riskLevel === 'low'
      ? t('risk.lowShort', lang)
      : riskLevel === 'medium'
        ? t('risk.mediumShort', lang)
        : riskLevel === 'high'
          ? t('risk.highShort', lang)
          : t('risk.criticalShort', lang)

  return (
    <div className="w-full">
      <div className="relative mx-auto h-44 w-72 max-w-full">
        <svg viewBox="0 0 280 170" className="h-full w-full overflow-visible">
          <path
            d="M40 140 A100 100 0 0 1 240 140"
            fill="none"
            stroke="rgba(244,240,230,0.12)"
            strokeWidth="16"
            strokeLinecap="round"
            pathLength={arcLength}
          />
          <motion.path
            d="M40 140 A100 100 0 0 1 240 140"
            fill="none"
            stroke={color}
            strokeWidth="16"
            strokeLinecap="round"
            pathLength={arcLength}
            strokeDasharray={arcLength}
            initial={{ strokeDashoffset: arcLength }}
            animate={{ strokeDashoffset: arcOffset }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
          />
          {[0, 1, 2, 3, 4].map((tick) => {
            const angle = 180 - tick * 45
            const rad = (angle * Math.PI) / 180
            const x1 = 140 + Math.cos(rad) * 82
            const y1 = 140 - Math.sin(rad) * 82
            const x2 = 140 + Math.cos(rad) * 96
            const y2 = 140 - Math.sin(rad) * 96
            return (
              <line
                key={tick}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="rgba(201,168,76,0.34)"
                strokeWidth="2"
                strokeLinecap="round"
              />
            )
          })}
        </svg>

        <div className="absolute inset-x-0 bottom-1 flex flex-col items-center">
          <div className="font-moei-mono text-5xl font-bold leading-none" style={{ color }}>
            {Math.round(gaugeValue)}
            <span className="text-2xl">%</span>
          </div>
          <div className="mt-1 text-xs font-bold uppercase text-[var(--moei-muted)]">
            {lang === 'ar' ? 'ثقة الذكاء الاصطناعي' : 'AI Confidence'}
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-md border border-[rgba(201,168,76,0.18)] bg-[rgba(10,22,40,0.58)] p-3">
          <div className="flex items-center gap-2 text-[var(--moei-muted)]">
            <Cpu className="size-4 text-[var(--moei-gold)]" />
            <span className="text-xs font-bold uppercase">{lang === 'ar' ? 'درجة المخاطر' : 'Risk Score'}</span>
          </div>
          <div className="mt-2 flex items-end justify-between gap-2">
            <span className="font-moei-mono text-3xl font-bold text-[var(--moei-text)]">{Math.round(score)}</span>
            <Badge
              variant="outline"
              className={cn(
                'border text-xs',
                riskLevel === 'low' && 'border-[var(--moei-success)] bg-[var(--moei-success-soft)] text-[var(--moei-success)]',
                riskLevel === 'medium' && 'border-[var(--moei-warning)] bg-[var(--moei-warning-soft)] text-[var(--moei-warning)]',
                (riskLevel === 'high' || riskLevel === 'critical') && 'border-[var(--moei-danger)] bg-[var(--moei-danger-soft)] text-[var(--moei-danger)]'
              )}
            >
              {riskLabel}
            </Badge>
          </div>
        </div>

        <div className="rounded-md border border-[rgba(201,168,76,0.18)] bg-[rgba(10,22,40,0.58)] p-3">
          <div className="flex items-center gap-2 text-[var(--moei-muted)]">
            <Route className="size-4 text-[var(--moei-gold)]" />
            <span className="text-xs font-bold uppercase">{lang === 'ar' ? 'مسار القرار' : 'Decision Path'}</span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            {isHuman ? (
              <AlertTriangle className="size-5 text-[var(--moei-danger)]" />
            ) : (
              <CheckCircle2 className="size-5 text-[var(--moei-success)]" />
            )}
            <span className={cn('text-sm font-extrabold uppercase', isHuman ? 'text-[var(--moei-danger)]' : 'text-[var(--moei-gold)]')}>
              {isHuman ? (lang === 'ar' ? 'مراجعة بشرية' : 'Human Review') : (lang === 'ar' ? 'مسار تلقائي' : 'Auto Path')}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
