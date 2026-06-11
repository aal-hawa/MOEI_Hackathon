import React from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, XCircle } from 'lucide-react'

import { t, type Language } from '@/lib/i18n'
import { parseJSON } from '@/lib/formatters'

// ── Component ────────────────────────────────────────────────────────────

export interface ShapExplanationProps {
  shapStr: string | null | undefined
  lang: Language
}

export function ShapExplanation({ shapStr, lang }: ShapExplanationProps) {
  const rawFactors = parseJSON<Array<Record<string, unknown>>>(shapStr, [])

  // Normalize factor structure - API returns {feature, value, contribution, description}
  const factors = rawFactors.map((f) => ({
    name: (f.feature || f.name || f.factor || 'Unknown') as string,
    direction: (((f.value ?? f.contribution ?? f.magnitude ?? 0) as number) >= 0 ? 'negative' : 'positive') as string,
    magnitude: Math.abs((f.value ?? f.contribution ?? f.magnitude ?? 0) as number),
    description: (f.description || '') as string,
  }))

  if (factors.length === 0) {
    return (
      <div className="text-sm text-muted-foreground italic">
        {t('caseDetail.noShapAvailable', lang)}
      </div>
    )
  }

  const maxMagnitude = Math.max(...factors.map((f) => Math.abs(f.magnitude)), 1)

  return (
    <div className="space-y-3">
      {factors.map((factor, i) => {
        const isPositive = factor.direction === 'positive'
        const widthPercent = (Math.abs(factor.magnitude) / maxMagnitude) * 100

        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08 }}
            className="space-y-1"
          >
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5">
                {isPositive ? (
                  <CheckCircle2 className="size-3.5 text-ae-green-600" />
                ) : (
                  <XCircle className="size-3.5 text-ae-red-500" />
                )}
                <span className="font-medium">{factor.name}</span>
              </span>
              <span className="text-muted-foreground text-xs">
                {factor.value ?? `${isPositive ? '+' : '-'}${Math.abs(factor.magnitude).toFixed(2)}`}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted/50 overflow-hidden">
              <motion.div
                className={`h-full rounded-full factor-bar ${
                  isPositive ? 'bg-ae-green-500' : 'bg-ae-red-500'
                }`}
                style={{ '--factor-width': `${widthPercent}%` } as React.CSSProperties}
                initial={{ width: 0 }}
                animate={{ width: `${widthPercent}%` }}
                transition={{ duration: 0.8, delay: i * 0.08, ease: 'easeOut' }}
              />
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
