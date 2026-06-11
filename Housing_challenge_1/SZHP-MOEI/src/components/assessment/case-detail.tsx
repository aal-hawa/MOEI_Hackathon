'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import {
  User, Phone, Mail, CreditCard, Building2, Users, Shield, BookOpen,
  ArrowRight, CheckCircle2, XCircle, AlertTriangle, Clock, FileText,
  ChevronRight, Activity, Brain, Scale, ShieldCheck, ListChecks,
  History, RotateCcw, ArrowLeft, Loader2, Check, AlertOctagon,
  Download, Image as ImageIcon, Eye, Percent, FileCheck, ChevronDown, ChevronUp, TrendingUp, Heart
} from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { RequestData, AssessmentData, AuditLogData, UploadedFileData } from '@/lib/store'
import { useAppStore } from '@/lib/store'
import { cn, authFetch } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'
import { useSystemConfig } from '@/hooks/use-system-config'
import { t, getReasonCategoryLabel, getEmployerTypeLabel, getLoanTypeLabel, getAuditActionLabel, getStatusLabel, type Language } from '@/lib/i18n'

// ── Helpers ──────────────────────────────────────────────────────────────

function formatAED(amount: number): string {
  return new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency: 'AED',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount).replace('AED', 'AED').trim()
}

function parseJSON<T>(jsonStr: string | null | undefined, fallback: T): T {
  if (!jsonStr) return fallback
  try {
    return JSON.parse(jsonStr) as T
  } catch {
    return fallback
  }
}

function formatFileSize(bytes: number | string | undefined | null): string {
  const numBytes = typeof bytes === 'string' ? parseFloat(bytes) : (bytes ?? 0)
  if (isNaN(numBytes) || numBytes < 0) return '0 B'
  if (numBytes < 1024) return `${numBytes} B`
  if (numBytes < 1024 * 1024) return `${(numBytes / 1024).toFixed(1)} KB`
  return `${(numBytes / 1024 / 1024).toFixed(1)} MB`
}

function getDocTypeLabel(docType: string | undefined, lang: Language): string {
  switch (docType) {
    case 'salary_certificate': return t('form.salaryCertificate', lang)
    case 'rescheduling_agreement': return t('form.reschedulingAgreement', lang)
    default: return t('caseDetail.additionalDocument', lang)
  }
}

function getFileIcon(fileType: string) {
  if (fileType.startsWith('image/')) return <ImageIcon className="size-4 text-blue-500 shrink-0" />
  return <FileText className="size-4 text-ae-gold-500 shrink-0" />
}

function getRiskColor(score: number, thresholds?: { low: number; medium: number; high: number }): string {
  const low = thresholds?.low ?? 30
  const medium = thresholds?.medium ?? 60
  const high = thresholds?.high ?? 80
  if (score <= low) return 'text-ae-green-600'
  if (score <= medium) return 'text-amber-600'
  if (score <= high) return 'text-orange-600'
  return 'text-ae-red-600'
}

function getRiskStrokeColor(score: number, thresholds?: { low: number; medium: number; high: number }): string {
  const low = thresholds?.low ?? 30
  const medium = thresholds?.medium ?? 60
  const high = thresholds?.high ?? 80
  if (score <= low) return '#317A40'
  if (score <= medium) return '#D97706'
  if (score <= high) return '#EA580C'
  return '#D83731'
}

function getRiskBgClass(score: number, thresholds?: { low: number; medium: number; high: number }): string {
  const low = thresholds?.low ?? 30
  const medium = thresholds?.medium ?? 60
  const high = thresholds?.high ?? 80
  if (score <= low) return 'bg-ae-green-50 text-ae-green-700 border-ae-green-200'
  if (score <= medium) return 'bg-amber-50 text-amber-700 border-amber-200'
  if (score <= high) return 'bg-orange-50 text-orange-700 border-orange-200'
  return 'bg-ae-red-50 text-ae-red-700 border-ae-red-200'
}

function getDelayColor(days: number, thresholds?: { low: number; high: number }): string {
  const low = thresholds?.low ?? 90
  const high = thresholds?.high ?? 180
  if (days < low) return 'text-ae-green-600'
  if (days <= high) return 'text-amber-600'
  return 'text-ae-red-600'
}

function getDelayBgClass(days: number, thresholds?: { low: number; high: number }): string {
  const low = thresholds?.low ?? 90
  const high = thresholds?.high ?? 180
  if (days < low) return 'bg-ae-green-50 text-ae-green-700'
  if (days <= high) return 'bg-amber-50 text-amber-700'
  return 'bg-ae-red-50 text-ae-red-700'
}

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'approved': return 'bg-ae-green-100 text-ae-green-700 border-ae-green-200'
    case 'rejected': return 'bg-ae-red-100 text-ae-red-700 border-ae-red-200'
    case 'escalated': return 'bg-purple-100 text-purple-700 border-purple-200'
    case 'ai_assessed': return 'bg-ae-gold-100 text-ae-gold-700 border-ae-gold-200'
    case 'under_review': return 'bg-blue-100 text-blue-700 border-blue-200'
    case 'pending': return 'bg-gray-100 text-gray-700 border-gray-200'
    default: return 'bg-gray-100 text-gray-700 border-gray-200'
  }
}

function getPriorityBadgeClass(priority: string): string {
  switch (priority) {
    case 'critical': return 'bg-ae-red-100 text-ae-red-700 border-ae-red-200'
    case 'urgent': return 'bg-orange-100 text-orange-700 border-orange-200'
    default: return 'bg-gray-100 text-gray-600 border-gray-200'
  }
}

function getEligibilityBadgeClass(status: string): string {
  switch (status) {
    case 'eligible': return 'bg-ae-green-100 text-ae-green-700 border-ae-green-200'
    case 'conditionally_eligible': return 'bg-amber-100 text-amber-700 border-amber-200'
    case 'ineligible': return 'bg-ae-red-100 text-ae-red-700 border-ae-red-200'
    default: return 'bg-gray-100 text-gray-600 border-gray-200'
  }
}

// ── Sub-components ───────────────────────────────────────────────────────

function RiskScoreGauge({ score, confidence, lang, thresholds }: { score: number; confidence: number; lang: Language; thresholds: { low: number; medium: number; high: number } }) {
  const radius = 70
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const strokeColor = getRiskStrokeColor(score, thresholds)
  const colorClass = getRiskColor(score, thresholds)

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-44 h-44">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 160 160">
          <circle
            cx="80"
            cy="80"
            r={radius}
            stroke="currentColor"
            strokeWidth="10"
            fill="none"
            className="text-muted/30"
          />
          <motion.circle
            cx="80"
            cy="80"
            r={radius}
            stroke={strokeColor}
            strokeWidth="10"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-2xl sm:text-3xl font-bold ${colorClass}`}>{Math.round(score)}</span>
          <span className="text-xs text-muted-foreground">{t('caseDetail.riskScore', lang)}</span>
        </div>
      </div>
      <Badge
        variant="outline"
        className={`text-sm font-semibold px-3 py-1 border ${getRiskBgClass(score, thresholds)}`}
      >
        {score <= thresholds.low ? t('risk.lowShort', lang) : score <= thresholds.medium ? t('risk.mediumShort', lang) : score <= thresholds.high ? t('risk.highShort', lang) : t('risk.criticalShort', lang)}
      </Badge>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Activity className="size-3" />
        <span>{t('caseDetail.confidence', lang)}: {confidence.toFixed(1)}%</span>
      </div>
    </div>
  )
}

function ShapExplanation({ shapStr, lang }: { shapStr: string | null | undefined; lang: Language }) {
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

function GovernanceCompliance({ complianceStr, lang }: { complianceStr: string | null | undefined; lang: Language }) {
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

function RiskFactorsList({ riskFactorsStr, lang }: { riskFactorsStr: string | null | undefined; lang: Language }) {
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

function AuditTimeline({ logs, lang }: { logs: AuditLogData[]; lang: Language }) {
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
                      ? 'bg-purple-500'
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

function DetailSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="space-y-3">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="space-y-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardContent className="space-y-3">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────────────────

interface CaseDetailProps {
  caseData: RequestData | null
  loading: boolean
  onBack: () => void
  onStatusChange: () => void
}

export default function CaseDetail({ caseData, loading, onBack, onStatusChange }: CaseDetailProps) {
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [viewFile, setViewFile] = useState<{ url: string, type: string, name: string } | null>(null)
  const [moeiReasoningExpanded, setMoeiReasoningExpanded] = useState(false)
  const { language } = useAppStore()
  const { getNumber } = useSystemConfig()
  const maxDBR = getNumber('max_dbr_limit', 0.6)

  // Risk score thresholds from admin config
  const riskThresholds = {
    low: getNumber('risk_threshold_low', 30),
    medium: getNumber('risk_threshold_medium', 60),
    high: getNumber('risk_threshold_high', 80),
  }

  // Delay duration thresholds from admin config
  const delayThresholds = {
    low: getNumber('delay_low_risk_days', 90),
    high: getNumber('delay_high_risk_days', 180),
  }

  const handleDownloadFile = useCallback(async (storedName: string, originalName: string) => {
    try {
      const res = await authFetch(`/api/upload?file=${encodeURIComponent(storedName)}`)
      if (!res.ok) throw new Error('Download failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = originalName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      // Fallback: open in new tab
      window.open(`/api/upload?file=${encodeURIComponent(storedName)}`, '_blank')
    }
  }, [])

  const handleViewFile = useCallback(async (storedName: string, originalName: string, mimeType: string) => {
    try {
      const res = await authFetch(`/api/upload?file=${encodeURIComponent(storedName)}`)
      if (!res.ok) throw new Error('Failed to fetch file')
      const rawBlob = await res.blob()
      // Force the correct mime type on the blob so the browser knows exactly how to render it
      const blob = new Blob([rawBlob], { type: mimeType || 'application/pdf' })
      const url = URL.createObjectURL(blob)
      setViewFile({ url, type: mimeType, name: originalName })
    } catch {
      toast({ title: 'Error', description: 'Failed to load file preview', variant: 'destructive' })
    }
  }, [])

  if (loading || !caseData) {
    return <DetailSkeleton />
  }

  const assessment: AssessmentData | null = caseData.assessment ?? null
  const applicant = caseData.applicant
  const loan = caseData.loan
  const arrear = caseData.arrear
  const auditLogs = caseData.auditLogs ?? []

  const documents = parseJSON<string[]>(caseData.supportingDocuments, [])
  const uploadedFiles = parseJSON<UploadedFileData[]>(caseData.uploadedFiles, [])
  const pctPaid = loan ? Math.round(((loan.originalAmount - loan.remainingBalance) / loan.originalAmount) * 100) : 0
  
  const decisionRationale = assessment ? parseJSON<any>(assessment.decisionRationale, {}) : {}
  const documentSummaries = decisionRationale.document_summaries || []

  // Group uploaded files by docType
  const filesByDocType = uploadedFiles.reduce<Record<string, UploadedFileData[]>>((acc, file) => {
    const key = file.docType || 'additional'
    if (!acc[key]) acc[key] = []
    acc[key].push(file)
    return acc
  }, {})

  async function handleAction(action: 'approve' | 'reject' | 'escalate') {
    setActionLoading(action)
    try {
      const res = await authFetch(`/api/requests/${caseData.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (res.ok) {
        onStatusChange()
        toast({ title: `Request ${action}ed successfully` })
      } else {
        const err = await res.json().catch(() => ({}))
        toast({ title: `Failed to ${action}`, description: err.error || 'Unknown error', variant: 'destructive' })
      }
    } catch (err) {
      console.error('Failed to update status:', err)
      toast({ title: `Failed to ${action}`, description: 'Network error', variant: 'destructive' })
    } finally {
      setActionLoading(null)
    }
  }

  async function handleReRunAssessment() {
    setActionLoading('assess')
    try {
      const res = await authFetch(`/api/requests/${caseData.id}/assess`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (res.ok) {
        onStatusChange()
        toast({ title: 'Assessment re-run successfully' })
      } else {
        const err = await res.json().catch(() => ({}))
        toast({ title: 'Failed to re-run assessment', description: err.error || 'Unknown error', variant: 'destructive' })
      }
    } catch (err) {
      console.error('Failed to re-run assessment:', err)
      toast({ title: 'Failed to re-run assessment', description: 'Network error', variant: 'destructive' })
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="size-4 me-1" /> {t('caseDetail.back', language)}
          </Button>
          <div>
            <h2 className="text-base sm:text-xl font-bold flex items-center gap-2">
              {t('caseDetail.caseDetails', language)}
              <Badge variant="outline" className={`text-xs ${getStatusBadgeClass(caseData.status)}`}>
                {getStatusLabel(caseData.status, language)}
              </Badge>
            </h2>
            <p className="text-sm text-muted-foreground">ID: {caseData.id}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`text-xs ${getPriorityBadgeClass(caseData.priority)}`}>
            {caseData.priority.toUpperCase()}
          </Badge>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="size-3" />
            {t('caseDetail.created', language)} {format(new Date(caseData.createdAt), 'MMM d, yyyy HH:mm')}
          </span>
        </div>
      </div>

      {/* 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Left Column ── */}
        <div className="space-y-6">
          {/* Applicant Card */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <User className="size-4 text-ae-gold-500" />
                  {t('caseDetail.applicantInfo', language)}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground block text-xs">{t('caseDetail.nameEn', language)}</span>
                    <span className="font-medium">{applicant?.nameEn ?? '—'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">{t('caseDetail.nameAr', language)}</span>
                    <span className="font-medium" dir="rtl">{applicant?.nameAr ?? '—'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">{t('caseDetail.emiratesId', language)}</span>
                    <span className="font-medium flex items-center gap-1">
                      <CreditCard className="size-3 text-muted-foreground" />
                      {applicant?.emiratesId ?? '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">{t('caseDetail.monthlyIncome', language)}</span>
                    <span className="font-medium">{applicant ? formatAED(applicant.monthlyIncome) : '—'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">{t('caseDetail.phone', language)}</span>
                    <span className="font-medium flex items-center gap-1">
                      <Phone className="size-3 text-muted-foreground" />
                      {applicant?.phone ?? '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">{t('caseDetail.email', language)}</span>
                    <span className="font-medium flex items-center gap-1 truncate">
                      <Mail className="size-3 text-muted-foreground shrink-0" />
                      {applicant?.email ?? '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">{t('caseDetail.employer', language)}</span>
                    <span className="font-medium flex items-center gap-1">
                      <Building2 className="size-3 text-muted-foreground" />
                      {applicant?.employer ?? '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">{t('caseDetail.employerType', language)}</span>
                    <Badge variant="outline" className="text-xs">
                      {applicant ? getEmployerTypeLabel(applicant.employerType, language) : '—'}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">{t('caseDetail.familySize', language)}</span>
                    <span className="font-medium flex items-center gap-1">
                      <Users className="size-3 text-muted-foreground" />
                      {applicant?.familySize ?? '—'}
                    </span>
                  </div>
                </div>
                <Separator />
                <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                  <div className="flex items-center gap-1.5 text-sm">
                    {applicant?.isCitizen ? (
                      <CheckCircle2 className="size-4 text-ae-green-600" />
                    ) : (
                      <XCircle className="size-4 text-ae-red-500" />
                    )}
                    <span>{t('caseDetail.citizen', language)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm">
                    {applicant?.hasFamilyBook ? (
                      <CheckCircle2 className="size-4 text-ae-green-600" />
                    ) : (
                      <XCircle className="size-4 text-ae-red-500" />
                    )}
                    <span>{t('caseDetail.familyBook', language)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Loan Details Card */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CreditCard className="size-4 text-ae-gold-500" />
                  {t('caseDetail.loanDetails', language)}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground block text-xs">{t('caseDetail.originalAmount', language)}</span>
                    <span className="font-medium">{loan ? formatAED(loan.originalAmount) : '—'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">{t('caseDetail.remainingBalance', language)}</span>
                    <span className="font-bold text-ae-red-600">{loan ? formatAED(loan.remainingBalance) : '—'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">{t('caseDetail.monthlyInstallment', language)}</span>
                    <span className="font-medium">{loan ? formatAED(loan.monthlyInstallment) : '—'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">{t('caseDetail.duration', language)}</span>
                    <span className="font-medium">
                      {loan ? `${loan.loanDurationMonths} ${t('caseList.months', language)} (${loan.elapsedMonths} ${t('caseDetail.elapsed', language)})` : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">{t('caseDetail.loanType', language)}</span>
                    <Badge variant="outline" className="text-xs">
                      {loan ? getLoanTypeLabel(loan.loanType, language) : '—'}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">{t('caseDetail.disbursementDate', language)}</span>
                    <span className="font-medium">
                      {loan ? format(new Date(loan.disbursementDate), 'MMM d, yyyy') : '—'}
                    </span>
                  </div>
                </div>
                {/* Progress bar showing % paid */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{t('caseDetail.repaymentProgress', language)}</span>
                    <span>{pctPaid}% {t('caseDetail.paid', language)}</span>
                  </div>
                  <Progress value={pctPaid} className="h-2.5" />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Arrear Information Card */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="size-4 text-ae-red-500" />
                  {t('caseDetail.arrearInfo', language)}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="sm:col-span-2">
                    <span className="text-muted-foreground block text-xs">{t('caseDetail.totalOverdueAmount', language)}</span>
                    <span className="text-xl sm:text-2xl font-bold text-ae-red-600">
                      {arrear ? formatAED(arrear.totalOverdue) : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">{t('caseDetail.missedMonths', language)}</span>
                    <span className="font-medium">{arrear?.missedMonths ?? '—'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">{t('caseDetail.delayDuration', language)}</span>
                    <span className={`font-medium ${arrear ? getDelayColor(arrear.delayDays, delayThresholds) : ''}`}>
                      {arrear ? `${arrear.delayDays} ${t('caseDetail.days', language)}` : '—'}
                    </span>
                    {arrear && (
                      <Badge
                        variant="outline"
                        className={`ms-2 text-xs border-0 ${getDelayBgClass(arrear.delayDays, delayThresholds)}`}
                      >
                        {arrear.delayDays < delayThresholds.low ? t('caseDetail.short', language) : arrear.delayDays <= delayThresholds.high ? t('caseDetail.moderate', language) : t('caseDetail.extended', language)}
                      </Badge>
                    )}
                  </div>
                  {arrear?.reason && (
                    <div className="sm:col-span-2">
                      <span className="text-muted-foreground block text-xs">{t('caseDetail.reason', language)}</span>
                      <span className="font-medium">{getReasonCategoryLabel(arrear.reason, language)}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Request Details Card */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="size-4 text-ae-gold-500" />
                  {t('caseDetail.requestDetails', language)}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground block text-xs">{t('caseDetail.reasonCategory', language)}</span>
                    <Badge variant="outline" className="text-xs">
                      {getReasonCategoryLabel(caseData.reasonCategory, language)}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">{t('caseDetail.requestedDuration', language)}</span>
                    <span className="font-medium">{caseData.requestedDurationMonths} {t('caseList.months', language)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">{t('form.priority', language)}</span>
                    <Badge variant="outline" className={`text-xs ${getPriorityBadgeClass(caseData.priority)}`}>
                      {caseData.priority.toUpperCase()}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">{t('caseDetail.status', language)}</span>
                    <Badge variant="outline" className={`text-xs ${getStatusBadgeClass(caseData.status)}`}>
                      {getStatusLabel(caseData.status, language)}
                    </Badge>
                  </div>
                </div>

                {/* Detailed Reason */}
                <div>
                  <span className="text-muted-foreground block text-xs mb-1">{t('caseDetail.detailedReason', language)}</span>
                  <p className="text-sm bg-muted/50 rounded-md p-3">{caseData.reason || '—'}</p>
                </div>

                {/* Supporting Documents */}
                {(uploadedFiles.length > 0 || documents.length > 0) && (
                  <div>
                    <span className="text-muted-foreground block text-xs mb-2">{t('caseDetail.supportingDocuments', language)}</span>
                    {uploadedFiles.length > 0 ? (
                      <div className="space-y-3">
                        {Object.entries(filesByDocType).map(([docType, files]) => (
                          <div key={docType}>
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <FileText className="size-3.5 text-ae-gold-500" />
                              <span className="text-xs font-medium text-foreground">{getDocTypeLabel(docType, language)}</span>
                              <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                                {files.length}
                              </Badge>
                            </div>
                            <div className="space-y-1.5">
                              {files.map((file) => (
                                <div
                                  key={file.id}
                                  className="flex items-center gap-2 text-sm p-2 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors group"
                                >
                                  {getFileIcon(file.type)}
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium truncate text-xs">{file.originalName}</p>
                                    <p className="text-[10px] text-muted-foreground">{formatFileSize(file.size)}</p>
                                  </div>
                                  <div className="flex items-center">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                      onClick={() => handleViewFile(file.storedName, file.originalName, file.type)}
                                      title={t('form.view', language) || 'View'}
                                    >
                                      <Eye className="size-3.5 text-muted-foreground" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                      onClick={() => handleDownloadFile(file.storedName, file.originalName)}
                                      title={t('caseDetail.downloadFile', language)}
                                    >
                                      <Download className="size-3.5 text-muted-foreground" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {documents.map((doc, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm">
                            <Check className="size-3.5 text-ae-green-600" />
                            <span>{doc}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Notes */}
                {caseData.notes && !caseData.notes.includes('[SALARY_CERT_ANALYSIS]') && (
                  <div>
                    <span className="text-muted-foreground block text-xs mb-1">{t('caseDetail.notes', language)}</span>
                    <p className="text-sm bg-muted/50 rounded-md p-3">{caseData.notes}</p>
                  </div>
                )}

                {/* Salary Certificate Analysis */}
                {caseData.notes && caseData.notes.includes('[SALARY_CERT_ANALYSIS]') && (() => {
                  try {
                    const analysisStr = caseData.notes.split('[SALARY_CERT_ANALYSIS]')[1]
                    const analysis = JSON.parse(analysisStr)
                    const fields = analysis.extractedFields as Record<string, unknown> | undefined
                    return (
                      <div>
                        <span className="text-muted-foreground block text-xs mb-2 flex items-center gap-1.5">
                          <Brain className="size-3.5 text-ae-gold-500" />
                          {t('form.salaryCert.aiTitle', language)}
                        </span>
                        <div className="bg-muted/50 rounded-md p-3 space-y-2">
                          {/* Verification Status */}
                          <div className={cn(
                            'rounded-lg p-2 border text-xs',
                            analysis.verificationStatus === 'verified'
                              ? 'bg-green-50 border-green-200 text-green-700'
                              : analysis.verificationStatus === 'rejected'
                                ? 'bg-red-50 border-red-200 text-red-700'
                                : 'bg-amber-50 border-amber-200 text-amber-700'
                          )}>
                            {analysis.verificationStatus === 'verified' ? '✓ Verified' : analysis.verificationStatus === 'rejected' ? '✗ Rejected' : '⚠ Needs Review'}
                            {' '}({analysis.confidence}% {t('form.salaryCert.confidence', language).toLowerCase()})
                          </div>
                          {/* Extracted Fields */}
                          {fields && (
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                              {Object.entries(fields)
                                .filter(([, v]) => v !== null && v !== undefined && v !== '')
                                .map(([key, value]) => (
                                  <div key={key} className="flex gap-1">
                                    <span className="text-muted-foreground capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                                    <span className="font-medium">
                                      {typeof value === 'number' ? `AED ${value.toLocaleString()}` : typeof value === 'boolean' ? (value ? '✓' : '✗') : String(value)}
                                    </span>
                                  </div>
                                ))
                              }
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  } catch {
                    return (
                      <div>
                        <span className="text-muted-foreground block text-xs mb-1">{t('caseDetail.notes', language)}</span>
                        <p className="text-sm bg-muted/50 rounded-md p-3">{caseData.notes.replace(/\[SALARY_CERT_ANALYSIS\].*/s, '').trim()}</p>
                      </div>
                    )
                  }
                })()}

                <Separator />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="size-3" />
                    {t('caseDetail.created', language)}: {format(new Date(caseData.createdAt), 'MMM d, yyyy HH:mm')}
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="size-3" />
                    {t('caseDetail.updated', language)}: {format(new Date(caseData.updatedAt), 'MMM d, yyyy HH:mm')}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* ── Right Column ── */}
        <div className="space-y-6">
          {/* Risk Score Gauge */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Activity className="size-4 text-ae-gold-500" />
                  {t('caseDetail.aiRiskAssessment', language)}
                </CardTitle>
                <CardDescription>{t('caseDetail.automatedRiskResult', language)}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center">
                {assessment ? (
                  <RiskScoreGauge score={assessment.riskScore} confidence={assessment.confidenceScore} lang={language} thresholds={riskThresholds} />
                ) : (
                  <div className="flex flex-col items-center py-8 text-muted-foreground">
                    <Brain className="size-10 mb-2 opacity-40" />
                    <p className="text-sm">{t('caseDetail.noAssessment', language)}</p>
                    <p className="text-xs">{t('caseDetail.runAssessmentToSee', language)}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Recommendation Card */}
          {assessment && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Scale className="size-4 text-ae-gold-500" />
                    {t('caseDetail.recommendation', language)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Employer Advice */}
                  {decisionRationale.employer_advice && (
                    <>
                      <div className={`rounded-lg p-4 border flex items-start gap-3 ${
                        decisionRationale.employer_advice.toLowerCase().includes('approve') ? 'bg-ae-green-50/50 border-ae-green-200' :
                        decisionRationale.employer_advice.toLowerCase().includes('reject') ? 'bg-ae-red-50/50 border-ae-red-200' :
                        'bg-amber-50/50 border-amber-200'
                      }`}>
                        {decisionRationale.employer_advice.toLowerCase().includes('approve') ? (
                          <CheckCircle2 className="size-5 text-ae-green-600 mt-0.5 shrink-0" />
                        ) : decisionRationale.employer_advice.toLowerCase().includes('reject') ? (
                          <XCircle className="size-5 text-ae-red-600 mt-0.5 shrink-0" />
                        ) : (
                          <AlertTriangle className="size-5 text-amber-600 mt-0.5 shrink-0" />
                        )}
                        <div>
                          <p className={`text-base font-bold mb-1 ${
                            decisionRationale.employer_advice.toLowerCase().includes('approve') ? 'text-ae-green-700' :
                            decisionRationale.employer_advice.toLowerCase().includes('reject') ? 'text-ae-red-700' :
                            'text-amber-700'
                          }`}>
                            AI Advice: {decisionRationale.employer_advice.toUpperCase()}
                          </p>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {decisionRationale.reasoning}
                          </p>
                        </div>
                      </div>
                      <Separator />
                    </>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-muted/50 rounded-lg p-3 text-center">
                      <span className="text-xs text-muted-foreground block">{t('caseDetail.recommendedAmount', language)}</span>
                      <span className="text-base sm:text-lg font-bold text-ae-green-600">
                        {formatAED(assessment.recommendedAmount)}
                      </span>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3 text-center">
                      <span className="text-xs text-muted-foreground block">{t('caseDetail.durationMonths', language)}</span>
                      <span className="text-base sm:text-lg font-bold">{assessment.recommendedDuration} {t('caseList.months', language)}</span>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3 text-center">
                      <span className="text-xs text-muted-foreground block">{t('caseDetail.monthlyInstallment', language)}</span>
                      <span className="text-base sm:text-lg font-bold">{formatAED(assessment.recommendedInstallment)}</span>
                    </div>
                  </div>

                  <Separator />

                  {/* DBR comparison */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-sm">
                    <div className="flex-1">
                      <span className="text-xs text-muted-foreground block">{t('caseDetail.currentDBR', language)}</span>
                      <span className={`text-base sm:text-lg font-bold ${
                        assessment.debtBurdenRatio > maxDBR ? 'text-ae-red-600' : 'text-amber-600'
                      }`}>
                        {(assessment.debtBurdenRatio * 100).toFixed(1)}%
                      </span>
                    </div>
                    <ArrowRight className="size-5 text-muted-foreground rtl:rotate-180" />
                    <div className="flex-1 text-end">
                      <span className="text-xs text-muted-foreground block">{t('caseDetail.proposedDBR', language)}</span>
                      <span className={`text-base sm:text-lg font-bold ${
                        assessment.proposedDBR > maxDBR ? 'text-ae-red-600' : 'text-ae-green-600'
                      }`}>
                        {(assessment.proposedDBR * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  {/* AI Document Analysis */}
                  {documentSummaries && documentSummaries.length > 0 && (
                    <>
                      <Separator />
                      <div className="space-y-3">
                        <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                          <FileText className="size-3.5" />
                          AI Document Analysis
                        </span>
                        <div className="grid gap-2">
                          {documentSummaries.map((doc: any, i: number) => (
                            <div key={i} className="bg-muted/30 rounded-lg p-3 text-sm border">
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-medium text-foreground">{doc.fileName}</span>
                                {doc.verified !== undefined && (
                                  <Badge variant="outline" className={doc.verified ? 'text-ae-green-600 bg-ae-green-50' : 'text-amber-600 bg-amber-50'}>
                                    {doc.verified ? 'Verified' : 'Unverified'}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-muted-foreground text-xs leading-relaxed">{doc.summary}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Eligibility */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">{t('caseDetail.eligibility', language)}:</span>
                    <Badge variant="outline" className={`text-xs ${getEligibilityBadgeClass(assessment.eligibilityStatus)}`}>
                      {assessment.eligibilityStatus.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </div>

                  {assessment.requiresHumanReview && (
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 flex items-start gap-2">
                      <AlertTriangle className="size-4 text-purple-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-purple-700">{t('caseDetail.humanReviewRequired', language)}</p>
                        {assessment.humanReviewReason && (
                          <p className="text-xs text-purple-600 mt-0.5">{assessment.humanReviewReason}</p>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* ── MOEI Compliance Assessment Card ── */}
          {assessment && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <Card className="border-t-4 border-t-ae-green-500">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ShieldCheck className="size-4 text-ae-green-600" />
                    {t('caseDetail.moeiComplianceAssessment', language)}
                  </CardTitle>
                  <CardDescription>{t('landing.moei.description', language)}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Application Status with Green/Red Badge */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{t('caseDetail.applicationStatus', language)}</span>
                    <Badge variant="outline" className={`text-xs border-0 ${
                      assessment.applicationStatus === 'complete'
                        ? 'bg-ae-green-100 text-ae-green-700'
                        : assessment.applicationStatus === 'incomplete'
                          ? 'bg-ae-red-100 text-ae-red-700'
                          : 'bg-gray-100 text-gray-600'
                    }`}>{
                      assessment.applicationStatus === 'complete'
                        ? <span className="flex items-center gap-1"><CheckCircle2 className="size-3" />{t('form.complete', language)}</span>
                        : assessment.applicationStatus === 'incomplete'
                          ? <span className="flex items-center gap-1"><XCircle className="size-3" />{language === 'ar' ? 'غير مكتمل' : 'Incomplete'}</span>
                          : (assessment.applicationStatus || '—')
                    }</Badge>
                  </div>

                  <Separator />

                  {/* Income Analysis Card with Threshold Indicator */}
                  {assessment.incomeAnalysis && (() => {
                    const inc = parseJSON<{salary?: number; stability?: string; perMemberAverage?: number; householdTotal?: number}>(assessment.incomeAnalysis, {})
                    const perMemberValue = inc.perMemberAverage || caseData.incomePerFamilyMember || 0
                    const isBelowThreshold = perMemberValue > 0 && perMemberValue < 2500
                    return (
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5 text-sm font-semibold text-ae-black-700">
                          <TrendingUp className="size-4 text-ae-gold-500" />
                          {t('caseDetail.incomeAnalysis', language)}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-muted/50 rounded-lg p-2.5">
                            <span className="text-[10px] text-muted-foreground block">{t('caseDetail.salary', language)}</span>
                            <span className="text-sm font-bold">{inc.salary ? formatAED(inc.salary) : (applicant ? formatAED(applicant.monthlyIncome) : '—')}</span>
                          </div>
                          <div className="bg-muted/50 rounded-lg p-2.5">
                            <span className="text-[10px] text-muted-foreground block">{t('caseDetail.stability', language)}</span>
                            <span className="text-sm font-bold">{inc.stability || applicant?.incomeStability || '—'}</span>
                          </div>
                          <div className={`rounded-lg p-2.5 border ${isBelowThreshold ? 'bg-amber-50/50 border-amber-200' : 'bg-muted/50 border-transparent'}`}>
                            <span className="text-[10px] text-muted-foreground block">{t('caseDetail.incomePerMember', language)}</span>
                            <span className="text-sm font-bold">{perMemberValue ? formatAED(perMemberValue) : '—'}</span>
                            {perMemberValue > 0 && (
                              <Badge variant="outline" className={`text-[9px] h-4 px-1 mt-1 border-0 ${
                                isBelowThreshold ? 'bg-amber-100 text-amber-700' : 'bg-ae-green-100 text-ae-green-700'
                              }`}>
                                {isBelowThreshold ? t('caseDetail.incomePerMemberThreshold', language) : t('caseDetail.incomePerMemberAboveThreshold', language)}
                              </Badge>
                            )}
                          </div>
                          <div className="bg-muted/50 rounded-lg p-2.5">
                            <span className="text-[10px] text-muted-foreground block">{t('caseDetail.householdTotal', language)}</span>
                            <span className="text-sm font-bold">{inc.householdTotal ? formatAED(inc.householdTotal) : (applicant?.totalHouseholdIncome ? formatAED(applicant.totalHouseholdIncome) : '—')}</span>
                          </div>
                        </div>
                        {isBelowThreshold && (
                          <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 border border-amber-200">
                            <Heart className="size-3.5 text-amber-600 shrink-0" />
                            <span className="text-[11px] text-amber-700 font-medium">{t('caseDetail.lighterPlanRecommended', language)}</span>
                          </div>
                        )}
                      </div>
                    )
                  })()}

                  {/* Key Financial Metrics */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="bg-ae-red-50/50 rounded-lg p-2.5 text-center">
                      <span className="text-[10px] text-ae-red-600 block">{t('caseDetail.arrearsAmount', language)}</span>
                      <span className="text-sm font-bold text-ae-red-700">{arrear ? formatAED(arrear.totalOverdue) : '—'}</span>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-2.5 text-center">
                      <span className="text-[10px] text-muted-foreground block">{t('caseDetail.remainingLoanBalance', language)}</span>
                      <span className="text-sm font-bold">{loan ? formatAED(loan.remainingBalance) : '—'}</span>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-2.5 text-center">
                      <span className="text-[10px] text-muted-foreground block">{t('caseDetail.remainingPeriod', language)}</span>
                      <span className="text-sm font-bold">{loan ? `${loan.loanDurationMonths - loan.elapsedMonths} ${t('caseList.months', language)}` : '—'}</span>
                    </div>
                  </div>

                  <Separator />

                  {/* Proposed Deduction Rate with Visual Gauge */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-ae-black-700 flex items-center gap-1.5">
                        <Percent className="size-4 text-ae-green-600" />
                        {t('caseDetail.proposedDeductionRate', language)}
                      </span>
                      <span className="text-lg font-bold text-ae-green-600">
                        {assessment.proposedDeductionRate != null ? `${assessment.proposedDeductionRate.toFixed(1)}%` : (caseData.deductionRate != null ? `${caseData.deductionRate.toFixed(1)}%` : '—')}
                        <span className="text-xs text-muted-foreground font-normal ms-1">{t('caseDetail.ofIncome', language)}</span>
                      </span>
                    </div>
                    <div className="relative h-4 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          (assessment.proposedDeductionRate ?? caseData.deductionRate ?? 0) <= 20
                            ? 'bg-gradient-to-r from-ae-green-400 to-ae-green-500'
                            : 'bg-gradient-to-r from-amber-400 to-ae-red-500'
                        }`}
                        style={{ width: `${Math.min((assessment.proposedDeductionRate ?? caseData.deductionRate ?? 0) * 5, 100)}%` }}
                      />
                      {/* 20% marker */}
                      <div className="absolute top-0 h-full w-0.5 bg-ae-red-500 z-10" style={{ left: '20%' }} />
                      <div className="absolute top-0 h-full w-0.5 bg-ae-green-500/30 z-5" style={{ left: '10%' }} />
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-muted-foreground">0%</span>
                      <span className="text-ae-red-500 font-bold">20% {language === 'ar' ? 'حد' : 'limit'}</span>
                      <span className="text-muted-foreground">100%</span>
                    </div>
                  </div>

                  {/* Proposed Repayment Plan */}
                  <div className="space-y-2">
                    <div className="text-sm font-semibold text-ae-black-700 flex items-center gap-1.5">
                      <FileCheck className="size-4 text-ae-gold-500" />
                      {t('caseDetail.proposedRepaymentPlan', language)}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-ae-green-50/50 rounded-lg p-2.5 text-center border border-ae-green-100">
                        <span className="text-[10px] text-ae-green-600 block">{t('caseDetail.planDuration', language)}</span>
                        <span className="text-sm font-bold text-ae-green-700">{assessment.recommendedDuration} {t('caseList.months', language)}</span>
                      </div>
                      <div className="bg-ae-gold-50/50 rounded-lg p-2.5 text-center border border-ae-gold-100">
                        <span className="text-[10px] text-ae-gold-600 block">{t('caseDetail.planInstallment', language)}</span>
                        <span className="text-sm font-bold text-ae-gold-700">{formatAED(assessment.recommendedInstallment)}</span>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Compliance Checks with Green/Red Indicators */}
                  <div className="space-y-2">
                    <div className="text-sm font-semibold text-ae-black-700 flex items-center gap-1.5">
                      <ShieldCheck className="size-4 text-ae-green-600" />
                      {t('landing.compliance.badge', language)}
                    </div>
                    <div className={`flex items-center justify-between p-2.5 rounded-lg border ${
                      assessment.rule20PercentCompliance === 'pass' ? 'bg-ae-green-50/50 border-ae-green-200' : assessment.rule20PercentCompliance === 'fail' ? 'bg-ae-red-50/50 border-ae-red-200' : 'bg-muted/50 border-transparent'
                    }`}>
                      <div className="flex items-center gap-2">
                        <Percent className="size-4 text-ae-green-600" />
                        <div>
                          <span className="text-sm font-medium">{t('caseDetail.deductionRuleCompliance', language)}</span>
                          <p className="text-[10px] text-muted-foreground">{t('landing.moei.deductionRule.description', language)}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className={`text-xs border-0 ${
                        assessment.rule20PercentCompliance === 'pass' ? 'bg-ae-green-100 text-ae-green-700' : assessment.rule20PercentCompliance === 'fail' ? 'bg-ae-red-100 text-ae-red-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {assessment.rule20PercentCompliance === 'pass'
                          ? <span className="flex items-center gap-0.5"><CheckCircle2 className="size-3" />{t('caseDetail.pass', language)}</span>
                          : assessment.rule20PercentCompliance === 'fail'
                            ? <span className="flex items-center gap-0.5"><XCircle className="size-3" />{t('caseDetail.fail', language)}</span>
                            : '—'}
                      </Badge>
                    </div>
                    <div className={`flex items-center justify-between p-2.5 rounded-lg border ${
                      assessment.periodRuleCompliance === 'pass' ? 'bg-ae-green-50/50 border-ae-green-200' : assessment.periodRuleCompliance === 'fail' ? 'bg-ae-red-50/50 border-ae-red-200' : 'bg-muted/50 border-transparent'
                    }`}>
                      <div className="flex items-center gap-2">
                        <Clock className="size-4 text-ae-gold-500" />
                        <div>
                          <span className="text-sm font-medium">{t('caseDetail.periodRuleCompliance', language)}</span>
                          <p className="text-[10px] text-muted-foreground">{t('landing.moei.periodRule.description', language)}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className={`text-xs border-0 ${
                        assessment.periodRuleCompliance === 'pass' ? 'bg-ae-green-100 text-ae-green-700' : assessment.periodRuleCompliance === 'fail' ? 'bg-ae-red-100 text-ae-red-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {assessment.periodRuleCompliance === 'pass'
                          ? <span className="flex items-center gap-0.5"><CheckCircle2 className="size-3" />{t('caseDetail.pass', language)}</span>
                          : assessment.periodRuleCompliance === 'fail'
                            ? <span className="flex items-center gap-0.5"><XCircle className="size-3" />{t('caseDetail.fail', language)}</span>
                            : '—'}
                      </Badge>
                    </div>
                  </div>

                  <Separator />

                  {/* MOEI Recommendation */}
                  <div className="space-y-2">
                    <div className="text-sm font-semibold text-ae-black-700">{t('caseDetail.moeiRecommendation', language)}</div>
                    {assessment.moeiRecommendation ? (
                      <div className={`rounded-lg p-3 border flex items-start gap-3 ${
                        assessment.moeiRecommendation === 'approve' ? 'bg-ae-green-50/50 border-ae-green-200' :
                        assessment.moeiRecommendation === 'request_documents' ? 'bg-amber-50/50 border-amber-200' :
                        'bg-purple-50/50 border-purple-200'
                      }`}>
                        {assessment.moeiRecommendation === 'approve' ? (
                          <CheckCircle2 className="size-5 text-ae-green-600 mt-0.5 shrink-0" />
                        ) : assessment.moeiRecommendation === 'request_documents' ? (
                          <FileCheck className="size-5 text-amber-600 mt-0.5 shrink-0" />
                        ) : (
                          <Users className="size-5 text-purple-600 mt-0.5 shrink-0" />
                        )}
                        <div>
                          <p className={`text-sm font-bold ${
                            assessment.moeiRecommendation === 'approve' ? 'text-ae-green-700' :
                            assessment.moeiRecommendation === 'request_documents' ? 'text-amber-700' :
                            'text-purple-700'
                          }`}>
                            {assessment.moeiRecommendation === 'approve' ? t('caseDetail.approve', language) :
                             assessment.moeiRecommendation === 'request_documents' ? t('caseDetail.requestDocuments', language) :
                             t('caseDetail.referToEmployee', language)}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">—</p>
                    )}
                  </div>

                  {/* Reasoning (expandable) */}
                  {assessment.moeiReasoning && (
                    <div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-between text-xs"
                        onClick={() => setMoeiReasoningExpanded(!moeiReasoningExpanded)}
                      >
                        <span className="flex items-center gap-1.5">
                          <Brain className="size-3.5" />
                          {t('caseDetail.reasoning', language)}
                        </span>
                        {moeiReasoningExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                      </Button>
                      <AnimatePresence>
                        {moeiReasoningExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground leading-relaxed mt-1">
                              {assessment.moeiReasoning}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

        </div>
      </div>

      {/* ── Bottom Actions Bar ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="sticky bottom-0 z-10 bg-background/95 backdrop-blur border-t py-4 -mx-4 px-4 sm:-mx-6 sm:px-6 mt-6"
      >
        <div className="flex flex-wrap items-center gap-3">
          {/* Approve */}
          {['ai_assessed', 'under_review', 'pending'].includes(caseData.status) && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  className="bg-ae-green-600 hover:bg-ae-green-700 text-white"
                  disabled={actionLoading !== null}
                >
                  {actionLoading === 'approve' ? (
                    <Loader2 className="size-4 animate-spin me-1" />
                  ) : (
                    <CheckCircle2 className="size-4 me-1" />
                  )}
                  {t('caseDetail.approve', language)}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('caseDetail.confirmApprove', language)}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('caseDetail.confirmApproveDesc', language)}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('form.cancel', language)}</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-ae-green-600 hover:bg-ae-green-700 text-white"
                    onClick={() => handleAction('approve')}
                  >
                    {t('caseDetail.approve', language)}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {/* Reject */}
          {['ai_assessed', 'under_review', 'pending'].includes(caseData.status) && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  className="bg-ae-red-600 hover:bg-ae-red-700 text-white"
                  disabled={actionLoading !== null}
                >
                  {actionLoading === 'reject' ? (
                    <Loader2 className="size-4 animate-spin me-1" />
                  ) : (
                    <XCircle className="size-4 me-1" />
                  )}
                  {t('caseDetail.reject', language)}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('caseDetail.confirmReject', language)}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('caseDetail.confirmRejectDesc', language)}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('form.cancel', language)}</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-ae-red-600 hover:bg-ae-red-700 text-white"
                    onClick={() => handleAction('reject')}
                  >
                    {t('caseDetail.reject', language)}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {/* Escalate */}
          {['ai_assessed', 'under_review', 'pending', 'escalated'].includes(caseData.status) && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                  disabled={actionLoading !== null}
                >
                  {actionLoading === 'escalate' ? (
                    <Loader2 className="size-4 animate-spin me-1" />
                  ) : (
                    <AlertTriangle className="size-4 me-1" />
                  )}
                  {t('caseDetail.escalate', language)}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('caseDetail.confirmEscalate', language)}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('caseDetail.confirmEscalateDesc', language)}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('form.cancel', language)}</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                    onClick={() => handleAction('escalate')}
                  >
                    {t('caseDetail.escalate', language)}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          <div className="flex-1" />

          {/* Re-run Assessment */}
          <Button
            variant="outline"
            disabled={actionLoading !== null}
            onClick={handleReRunAssessment}
          >
            {actionLoading === 'assess' ? (
              <Loader2 className="size-4 animate-spin me-1" />
            ) : (
              <RotateCcw className="size-4 me-1" />
            )}
            {t('caseDetail.reRunAssessment', language)}
          </Button>

          {/* Back to Cases */}
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="size-4 me-1" />
            {t('caseDetail.back', language)}
          </Button>
        </div>
      </motion.div>

      {/* File Viewer Dialog */}
      <Dialog open={viewFile !== null} onOpenChange={(open) => !open && setViewFile(null)}>
        <DialogContent className="max-w-4xl w-[90vw] h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{viewFile?.name}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 bg-muted/20 rounded-md overflow-hidden flex items-center justify-center relative">
            {viewFile && (
              viewFile.type.startsWith('image/') ? (
                <img src={viewFile.url} alt={viewFile.name} className="max-w-full max-h-full object-contain" />
              ) : viewFile.type === 'application/pdf' ? (
                <iframe src={viewFile.url} className="w-full h-full border-0" title={viewFile.name} />
              ) : (
                <div className="text-center p-6 flex flex-col items-center">
                  <FileText className="size-16 text-muted-foreground/30 mb-4" />
                  <p className="text-muted-foreground mb-4">Preview not available for this file type.</p>
                  <Button onClick={() => {
                    handleDownloadFile(
                      new URL(viewFile.url, window.location.origin).searchParams.get('file') || '',
                      viewFile.name
                    )
                  }}>
                    <Download className="size-4 me-2" /> Download to view
                  </Button>
                </div>
              )
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
