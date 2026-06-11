import React from 'react'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { Clock, User } from 'lucide-react'

import type { AuditLogData } from '@/lib/store'
import { t, getAuditActionLabel, type Language } from '@/lib/i18n'
import { parseJSON } from '@/lib/formatters'

// ── Component ────────────────────────────────────────────────────────────

export interface AuditTimelineProps {
  logs: AuditLogData[]
  lang: Language
}

export function AuditTimeline({ logs, lang }: AuditTimelineProps) {
  if (!logs || logs.length === 0) {
    return (
      <div className="text-sm text-muted-foreground italic">
        {t('caseDetail.noAuditTrail', lang)}
      </div>
    )
  }

  return (
    <div className="relative space-y-0">
      {logs.map((log, i) => {
        const details = parseJSON<Record<string, unknown>>(log.details, {})
        return (
          <motion.div
            key={log.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06 }}
            className="flex gap-3 pb-4 last:pb-0"
          >
            {/* Timeline connector */}
            <div className="flex flex-col items-center">
              <div className={`size-3 rounded-full mt-1.5 shrink-0 ${
                log.action === 'approved'
                  ? 'bg-ae-green-500'
                  : log.action === 'rejected'
                    ? 'bg-ae-red-500'
                    : log.action === 'escalated'
                      ? 'bg-ae-red-500'
                      : 'bg-ae-gold-500'
              }`} />
              {i < logs.length - 1 && (
                <div className="w-px flex-1 bg-border mt-1" />
              )}
            </div>
            {/* Content */}
            <div className="flex-1 min-w-0 pb-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">{getAuditActionLabel(log.action, lang)}</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                <span className="flex items-center gap-1">
                  <Clock className="size-3" />
                  {format(new Date(log.timestamp), 'MMM d, yyyy HH:mm')}
                </span>
                <span className="flex items-center gap-1">
                  <User className="size-3" />
                  {log.performedBy}
                </span>
              </div>
              {Object.keys(details).length > 0 && (
                <div className="text-xs text-muted-foreground mt-1 bg-muted/50 rounded px-2 py-1">
                  {Object.entries(details).map(([k, v]) => (
                    <span key={k} className="me-3">
                      <span className="font-medium">{k}:</span> {String(v)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
