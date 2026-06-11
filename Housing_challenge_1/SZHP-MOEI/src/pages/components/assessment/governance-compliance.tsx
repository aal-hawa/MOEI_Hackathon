import React from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, XCircle, ShieldCheck, AlertOctagon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { t, type Language } from '@/lib/i18n'
import { parseJSON } from '@/lib/formatters'

// ── Component ────────────────────────────────────────────────────────────

export interface GovernanceComplianceProps {
  complianceStr: string | null | undefined
  lang: Language
}

export function GovernanceCompliance({ complianceStr, lang }: GovernanceComplianceProps) {
  const rawChecks = parseJSON<Array<Record<string, unknown>>>(complianceStr, [])

  // Normalize check structure - API returns {ruleCode, ruleName, passed, message, category}
  const checks = rawChecks.map((c) => ({
    rule: (c.ruleName || c.rule || c.ruleCode || 'Unknown') as string,
    passed: (c.passed ?? true) as boolean,
    description: (c.message || c.description || '') as string,
    category: (c.category || '') as string,
  }))

  if (checks.length === 0) {
    return (
      <div className="text-sm text-muted-foreground italic">
        {t('caseDetail.noGovernanceData', lang)}
      </div>
    )
  }

  const allPassed = checks.every((c) => c.passed)

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-3">
        {allPassed ? (
          <Badge className="bg-ae-green-100 text-ae-green-700 border-ae-green-200 border" variant="outline">
            <ShieldCheck className="size-3 me-1" /> {t('caseDetail.fullyCompliant', lang)}
          </Badge>
        ) : (
          <Badge className="bg-ae-red-100 text-ae-red-700 border-ae-red-200 border" variant="outline">
            <AlertOctagon className="size-3 me-1" /> {t('caseDetail.nonCompliant', lang)}
          </Badge>
        )}
      </div>
      {checks.map((check, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          className="flex items-start gap-2 text-sm"
        >
          {check.passed ? (
            <CheckCircle2 className="size-4 text-ae-green-600 mt-0.5 shrink-0" />
          ) : (
            <XCircle className="size-4 text-ae-red-500 mt-0.5 shrink-0" />
          )}
          <div>
            <span className="font-medium">{check.rule}</span>
            {check.description && (
              <p className="text-muted-foreground text-xs mt-0.5">{check.description}</p>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  )
}
