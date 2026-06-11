
import { motion } from 'framer-motion'
import { formatDistanceToNow } from 'date-fns'
import { Eye, User, CreditCard, Clock } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { t } from '@/lib/i18n'
import { useAppStore } from '@/lib/store'
import type { RequestData } from '@/lib/store'
import { formatAED, maskEmiratesId } from '@/lib/formatters'
import { getStatusBadgeClasses } from '@/lib/status-config'
import { getRiskConfig } from '@/lib/risk-config'

interface RecentCasesProps {
  cases: RequestData[]
  loading: boolean
  onSelectCase: (id: string) => void
}

// ── Helpers ──────────────────────────────────────────────────────────

function formatRelativeTime(dateStr: string | undefined | null): string {
  if (!dateStr) return 'N/A'
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true })
  } catch {
    return 'N/A'
  }
}

// ── Loading Skeleton ─────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-36" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-14 rounded-full" />
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ── Main Component ───────────────────────────────────────────────────

const rowVariants = {
  hidden: { opacity: 0, x: -8 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: i * 0.04,
      type: 'spring',
      stiffness: 300,
      damping: 24,
    },
  }),
}

export function RecentCases({ cases, loading, onSelectCase }: RecentCasesProps) {
  const { language } = useAppStore()

  if (loading) {
    return <LoadingSkeleton />
  }

  const displayCases = (cases || []).slice(0, 10)

  // Build translated labels based on current language
  const riskLabels: Record<string, string> = {
    low: t('risk.lowShort', language),
    medium: t('risk.mediumShort', language),
    high: t('risk.highShort', language),
    critical: t('risk.criticalShort', language),
  }

  const statusLabels: Record<string, string> = {
    pending: t('status.pending', language),
    under_review: t('status.under_review', language),
    ai_assessed: t('status.ai_assessed', language),
    approved: t('status.approved', language),
    rejected: t('status.rejected', language),
    escalated: t('status.escalated', language),
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24, delay: 0.2 }}
    >
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-ae-black-700">
            {t('dashboard.recentCases', language)}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-2 sm:px-6">
          {/* Mobile: Card layout */}
          <div className="block sm:hidden space-y-3 max-h-96 overflow-y-auto custom-scrollbar">
            {displayCases.length === 0 ? (
              <div className="h-24 flex items-center justify-center text-muted-foreground text-sm">
                {t('recentCases.noCases', language)}
              </div>
            ) : (
              displayCases.map((c, i) => {
                const riskLevel = c.assessment?.riskLevel || 'medium'
                const loanAmount = c.loan?.remainingBalance || c.loan?.originalAmount || 0

                return (
                  <motion.div
                    key={c.id}
                    custom={i}
                    variants={rowVariants}
                    initial="hidden"
                    animate="visible"
                    className="bg-muted/30 rounded-lg p-3 cursor-pointer hover:bg-ae-gold-50/50 transition-colors"
                    onClick={() => onSelectCase(c.id)}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0 flex-1 overflow-hidden">
                        <div className="flex items-center gap-1.5">
                          <User className="size-3.5 text-muted-foreground shrink-0" />
                          <span className="font-medium text-sm text-ae-black-700 truncate">
                            {c.applicant?.nameEn || 'Unknown'}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-ae-gold-500 hover:text-ae-gold-700 hover:bg-ae-gold-50 shrink-0"
                        onClick={(e) => {
                          e.stopPropagation()
                          onSelectCase(c.id)
                        }}
                      >
                        <Eye className="h-3.5 w-3.5 me-1" />
                        {t('recentCases.view', language)}
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                      <div className="flex items-center gap-1">
                        <CreditCard className="size-3 text-muted-foreground shrink-0" />
                        <span className="text-muted-foreground truncate">{maskEmiratesId(c.applicant?.emiratesId)}</span>
                      </div>
                      <div className="text-end font-medium text-ae-black-600">
                        {formatAED(loanAmount)}
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge
                          variant="outline"
                          className={`text-xs px-1.5 py-0 shrink-0 ${getRiskConfig(riskLevel).bgColor}`}
                        >
                          {riskLabels[riskLevel] || riskLevel}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`text-xs px-1.5 py-0 shrink-0 ${getStatusBadgeClasses(c.status).container}`}
                        >
                          {statusLabels[c.status] || c.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1 justify-end text-ae-black-400 shrink-0">
                        <Clock className="size-3 shrink-0" />
                        <span>{formatRelativeTime(c.createdAt)}</span>
                      </div>
                    </div>
                  </motion.div>
                )
              })
            )}
          </div>

          {/* Desktop: Table layout */}
          <div className="hidden sm:block overflow-x-auto max-h-96 overflow-y-auto custom-scrollbar">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-ae-black-400 font-medium">{t('recentCases.applicant', language)}</TableHead>
                  <TableHead className="text-ae-black-400 font-medium">{t('recentCases.emiratesId', language)}</TableHead>
                  <TableHead className="text-ae-black-400 font-medium text-end">{t('recentCases.amount', language)}</TableHead>
                  <TableHead className="text-ae-black-400 font-medium">{t('recentCases.risk', language)}</TableHead>
                  <TableHead className="text-ae-black-400 font-medium">{t('recentCases.status', language)}</TableHead>
                  <TableHead className="text-ae-black-400 font-medium">{t('recentCases.created', language)}</TableHead>
                  <TableHead className="text-ae-black-400 font-medium text-end">{t('recentCases.action', language)}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayCases.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="h-24 text-center text-muted-foreground"
                    >
                      {t('recentCases.noCases', language)}
                    </TableCell>
                  </TableRow>
                ) : (
                  displayCases.map((c, i) => {
                    const riskLevel = c.assessment?.riskLevel || 'medium'
                    const loanAmount = c.loan?.remainingBalance || c.loan?.originalAmount || 0

                    return (
                      <motion.tr
                        key={c.id}
                        custom={i}
                        variants={rowVariants}
                        initial="hidden"
                        animate="visible"
                        className="border-b transition-colors hover:bg-ae-gold-50/50 group cursor-pointer"
                        onClick={() => onSelectCase(c.id)}
                      >
                        <TableCell className="font-medium text-ae-black-700">
                          {c.applicant?.nameEn || 'Unknown'}
                        </TableCell>
                        <TableCell className="text-ae-black-400 font-mono text-xs">
                          {maskEmiratesId(c.applicant?.emiratesId)}
                        </TableCell>
                        <TableCell className="text-end font-medium text-ae-black-600">
                          {formatAED(loanAmount)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-xs px-1.5 py-0 ${getRiskConfig(riskLevel).bgColor}`}
                          >
                            {riskLabels[riskLevel] || riskLevel}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-xs px-1.5 py-0 ${getStatusBadgeClasses(c.status).container}`}
                          >
                            {statusLabels[c.status] || c.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-ae-black-400">
                          {formatRelativeTime(c.createdAt)}
                        </TableCell>
                        <TableCell className="text-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-ae-gold-500 hover:text-ae-gold-700 hover:bg-ae-gold-50 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation()
                              onSelectCase(c.id)
                            }}
                          >
                            <Eye className="h-3.5 w-3.5 me-1" />
                            {t('recentCases.view', language)}
                          </Button>
                        </TableCell>
                      </motion.tr>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
