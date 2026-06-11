import React from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { t, type Language } from '@/lib/i18n'
import { parseJSON } from '@/lib/formatters'

// ── Component ────────────────────────────────────────────────────────────

export interface RiskFactorsListProps {
  riskFactorsStr: string | null | undefined
  lang: Language
}

export function RiskFactorsList({ riskFactorsStr, lang }: RiskFactorsListProps) {
  const rawFactors = parseJSON<Array<Record<string, unknown>>>(riskFactorsStr, [])

  // Normalize factor structure - API returns {factor, severity, description}
  const factors = rawFactors.map((f) => ({
    factor: (f.factor || f.name || f.feature || 'Unknown') as string,
    severity: (f.severity || 'medium') as string,
    description: (f.description || '') as string,
  }))

  if (factors.length === 0) {
    return (
      <div className="text-sm text-muted-foreground italic">
        {t('caseDetail.noRiskFactors', lang)}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {factors.map((f, i) => {
        const severityClass =
          f.severity === 'high'
            ? 'bg-ae-red-100 text-ae-red-700'
            : f.severity === 'medium'
              ? 'bg-amber-100 text-amber-700'
              : 'bg-ae-green-100 text-ae-green-700'

        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06 }}
            className="flex items-center justify-between gap-2"
          >
            <div className="flex items-center gap-2 text-sm">
              <AlertTriangle className={`size-4 ${
                f.severity === 'high'
                  ? 'text-ae-red-500'
                  : f.severity === 'medium'
                    ? 'text-amber-500'
                    : 'text-ae-green-500'
              }`} />
              <span>{f.factor}</span>
            </div>
            <Badge variant="outline" className={`text-xs ${severityClass} border-0`}>
              {f.severity}
            </Badge>
          </motion.div>
        )
      })}
    </div>
  )
}
