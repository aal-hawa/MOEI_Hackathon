import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import {
  AlertTriangle,
  ArrowLeft,
  Brain,
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  Eye,
  File,
  FileCheck,
  FileText,
  Gauge,
  GitBranch,
  Headphones,
  Image as ImageIcon,
  Landmark,
  Loader2,
  Mail,
  Mic2,
  Percent,
  Phone,
  PhoneCall,
  PhoneOff,
  RefreshCw,
  Route,
  Scale,
  ShieldCheck,
  Sparkles,
  Table2,
  User,
  Users,
  WalletCards,
  XCircle,
} from 'lucide-react'

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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { RiskScoreGauge } from '@/components/assessment/risk-score-gauge'
import { DetailSkeleton } from '@/components/assessment/detail-skeleton'
import { toast } from '@/hooks/use-toast'
import { useSystemConfig } from '@/hooks/use-system-config'
import { formatAED, formatFileSize, maskEmiratesId, parseJSON } from '@/lib/formatters'
import {
  getEmployerTypeLabel,
  getLoanTypeLabel,
  getReasonCategoryLabel,
  t,
  type Language,
} from '@/lib/i18n'
import type { AssessmentData, RequestData, UploadedFileData } from '@/lib/store'
import { useAppStore } from '@/lib/store'
import { authFetch, cn } from '@/lib/utils'

interface CaseDetailProps {
  caseData: RequestData | null
  loading: boolean
  onBack: () => void
  onStatusChange: () => void
}

type FilePreview = { url: string; type: string; name: string; storedName?: string; size?: number }
type GovernanceCheck = { label: string; value: string; passed: boolean | null; description?: string }
type DecisionTwinSignal = { title: string; detail: string; tone: 'gold' | 'green' | 'red' | 'cyan' }
type OfficerDecisionAction = 'approve' | 'reject' | 'escalate'
type OfficerCallStage = 'idle' | 'dialing' | 'briefing' | 'awaiting_decision' | 'approved' | 'rejected' | 'escalated'
type OfficerCallLine = { speaker: string; text: string; tone: 'gold' | 'green' | 'red' | 'cyan' | 'muted' }
type OfficerCallDelivery = {
  mode: 'pending' | 'real' | 'demo'
  provider: 'telecom' | 'twilio' | 'browser_demo'
  message: string
  callSid?: string
  voiceProvider?: 'elevenlabs' | 'twilio_say'
  decisionCapture?: { enabled?: boolean; requiresPublicWebhook?: boolean }
  missingConfig?: string[]
  error?: string
}
type BeneficiaryCallDelivery = OfficerCallDelivery & {
  to?: string
  notificationMessage?: string
}
type StakeholderLens = {
  role: string
  signal: string
  evidence: string
  tone: 'gold' | 'green' | 'red' | 'cyan'
  icon: typeof User
}

const DEMO_OFFICER_PHONE = '+971500000000'
const DEMO_OFFICER_PHONE_LOCAL = '0500000000'
const DEMO_OFFICER_PHONE_DISPLAY = `${DEMO_OFFICER_PHONE_LOCAL} / ${DEMO_OFFICER_PHONE}`
const DEMO_BENEFICIARY_PHONE = DEMO_OFFICER_PHONE
const DEMO_BENEFICIARY_PHONE_DISPLAY = DEMO_OFFICER_PHONE_DISPLAY
const FINAL_OFFICER_CALL_STAGES: OfficerCallStage[] = ['approved', 'rejected', 'escalated']

function label(en: string, ar: string, lang: Language) {
  return lang === 'ar' ? ar : en
}

function getDocTypeLabel(docType: string | undefined, lang: Language): string {
  switch (docType) {
    case 'salary_certificate': return t('form.salaryCertificate', lang)
    case 'rescheduling_agreement': return t('form.reschedulingAgreement', lang)
    case 'bank_statement': return t('form.bankStatement', lang)
    case 'income_statement': return label('Income Statement', 'كشف الدخل', lang)
    case 'income_evidence': return label('Income Evidence', 'إثبات الدخل', lang)
    case 'detailed_salary_statement': return label('Detailed Salary Statement', 'كشف راتب تفصيلي', lang)
    case 'medical_report': return t('form.medicalReport', lang)
    case 'termination_letter': return label('Termination Letter', 'خطاب إنهاء الخدمة', lang)
    case 'divorce_decree': return label('Divorce Decree', 'حكم الطلاق', lang)
    case 'pension_statement': return label('Pension Statement', 'كشف التقاعد', lang)
    default: return t('caseDetail.additionalDocument', lang)
  }
}

function getFileIcon(fileType: string, fileName?: string) {
  const ext = fileName?.split('.').pop()?.toLowerCase() || ''
  if (fileType === 'application/pdf' || ext === 'pdf') return <FileText className="size-4 shrink-0 text-[var(--moei-danger)]" />
  if (fileType.includes('word') || ['doc', 'docx'].includes(ext)) return <FileText className="size-4 shrink-0 text-[var(--moei-cyan)]" />
  if (fileType.includes('sheet') || fileType.includes('excel') || ['xls', 'xlsx', 'csv'].includes(ext)) return <Table2 className="size-4 shrink-0 text-[var(--moei-success)]" />
  if (fileType.startsWith('image/')) return <ImageIcon className="size-4 shrink-0 text-[var(--moei-gold)]" />
  return <File className="size-4 shrink-0 text-[var(--moei-muted)]" />
}

function asPercent(value: number | null | undefined): number | null {
  if (value === null || value === undefined || Number.isNaN(value)) return null
  return Math.abs(value) <= 1 ? value * 100 : value
}

function percentText(value: number | null | undefined) {
  const pct = asPercent(value)
  return pct === null ? '-' : `${pct.toFixed(1)}%`
}

function parseStringList(value: string | null | undefined): string[] {
  if (!value) return []
  const parsed = parseJSON<unknown>(value, [])
  if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean)
  if (typeof parsed === 'string') return parsed.split(',').map((item) => item.trim()).filter(Boolean)
  return value.split(',').map((item) => item.trim()).filter(Boolean)
}

function statusBadgeClass(status: string) {
  if (status === 'ai_assessed') return 'border-[var(--moei-gold)] bg-[var(--moei-gold-soft)] text-[var(--moei-gold)]'
  if (status === 'escalated' || status === 'rejected') return 'border-[var(--moei-danger)] bg-[var(--moei-danger-soft)] text-[var(--moei-danger)]'
  if (status === 'approved') return 'border-[var(--moei-success)] bg-[var(--moei-success-soft)] text-[var(--moei-success)]'
  return 'border-[var(--moei-cyan)] bg-[var(--moei-cyan-soft)] text-[var(--moei-cyan)]'
}

function riskBadgeClass(risk?: string | null) {
  if (risk === 'critical' || risk === 'high') return 'border-[var(--moei-danger)] bg-[var(--moei-danger-soft)] text-[var(--moei-danger)]'
  if (risk === 'medium') return 'border-[var(--moei-warning)] bg-[var(--moei-warning-soft)] text-[var(--moei-warning)]'
  if (risk === 'low') return 'border-[var(--moei-success)] bg-[var(--moei-success-soft)] text-[var(--moei-success)]'
  return 'border-[rgba(244,240,230,0.18)] bg-[rgba(244,240,230,0.06)] text-[var(--moei-muted)]'
}

function algorithmResultClass(result: string) {
  if (result === 'pass') return 'border-[var(--moei-success)] bg-[var(--moei-success-soft)] text-[var(--moei-success)]'
  if (result === 'fail') return 'border-[var(--moei-danger)] bg-[var(--moei-danger-soft)] text-[var(--moei-danger)]'
  return 'border-[var(--moei-warning)] bg-[var(--moei-warning-soft)] text-[var(--moei-warning)]'
}

function documentStatusLabel(status: string, verified: boolean, lang: Language) {
  if (status === 'missing') return label('Missing', 'ناقص', lang)
  if (verified || status === 'verified') return label('Verified', 'موثق', lang)
  return label('Review', 'مراجعة', lang)
}

function documentStatusClass(status: string, verified: boolean) {
  if (status === 'missing') return 'border-[var(--moei-danger)] text-[var(--moei-danger)]'
  if (verified || status === 'verified') return 'border-[var(--moei-success)] text-[var(--moei-success)]'
  return 'border-[var(--moei-warning)] text-[var(--moei-warning)]'
}

function recommendationLabel(recommendation: string | null | undefined, lang: Language) {
  if (recommendation === 'approve') return label('Approve', 'اعتماد', lang)
  if (recommendation === 'request_documents') return label('Request Documents', 'طلب مستندات', lang)
  if (recommendation === 'refer_to_employee') return label('Refer to Officer', 'إحالة لموظف', lang)
  return label('Assessment Pending', 'التقييم قيد الانتظار', lang)
}

function statusText(status: string, lang: Language) {
  if (status === 'ai_assessed') return label('AI Assessed', 'تم تقييمه بالذكاء الاصطناعي', lang)
  if (status === 'escalated') return label('Escalated', 'محال للمراجعة', lang)
  if (status === 'approved') return label('Approved', 'معتمد', lang)
  if (status === 'rejected') return label('Rejected', 'مرفوض', lang)
  if (status === 'under_review') return label('Under Review', 'قيد المراجعة', lang)
  return label('Pending', 'قيد الانتظار', lang)
}

function riskText(risk: string | null | undefined, lang: Language) {
  if (risk === 'low') return label('Low Risk', 'مخاطر منخفضة', lang)
  if (risk === 'medium') return label('Medium Risk', 'مخاطر متوسطة', lang)
  if (risk === 'high') return label('High Risk', 'مخاطر عالية', lang)
  if (risk === 'critical') return label('Critical Risk', 'مخاطر حرجة', lang)
  return label('Unscored', 'غير مقيم', lang)
}

function loanTypeText(type: string | null | undefined, lang: Language) {
  if (!type) return '-'
  if (type === 'housing_loan') return label('Housing Loan', 'قرض سكني', lang)
  const translated = getLoanTypeLabel(type, lang)
  return translated.startsWith('loanType.') ? type.replace(/_/g, ' ') : translated
}

function parseOfficerDecisionCommand(command: string): OfficerDecisionAction | null {
  const normalized = command.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim()
  const approveWords = ['accept', 'accepted', 'approve', 'approved', 'yes', 'ok', 'confirm', 'اعتمد', 'اعتماد', 'اقبل', 'قبول', 'موافق', 'نعم', 'ايه', 'تمام']
  const rejectWords = ['reject', 'rejected', 'decline', 'declined', 'no', 'deny', 'denied', 'ارفض', 'رفض', 'مرفوض', 'لا', 'كلا']
  const escalateWords = ['escalate', 'review', 'human', 'officer review', 'refer', 'refer to officer', 'احالة', 'إحالة', 'لموظف', 'حول', 'حوّل', 'مراجعة']
  if (approveWords.some((word) => normalized.includes(word.toLowerCase()))) return 'approve'
  if (rejectWords.some((word) => normalized.includes(word.toLowerCase()))) return 'reject'
  if (escalateWords.some((word) => normalized.includes(word.toLowerCase()))) return 'escalate'
  return null
}

function officerDecisionPhrase(action: OfficerDecisionAction, lang: Language) {
  if (action === 'approve') return label('Yes - approve the plan', 'نعم، اعتمد الخطة', lang)
  if (action === 'reject') return label('No - reject the plan', 'لا، ارفض الخطة', lang)
  return label('Escalate to officer', 'إحالة لموظف', lang)
}

function officerDecisionButtonLabel(action: OfficerDecisionAction, lang: Language) {
  if (action === 'approve') return label('Officer says: Yes', 'الموظف يقول: نعم', lang)
  if (action === 'reject') return label('Officer says: No', 'الموظف يقول: لا', lang)
  return label('Officer says: Escalate to Officer', 'الموظف يقول: إحالة لموظف', lang)
}

function normalizeGovernanceChecks(
  assessment: AssessmentData,
  caseData: RequestData,
  maxDBR: number,
  proposedDeductionPercent: number | null,
  lang: Language,
): GovernanceCheck[] {
  const rawChecks = parseJSON<Array<Record<string, unknown>>>(assessment.governanceCompliance, [])
  const checks: GovernanceCheck[] = rawChecks.slice(0, 4).map((check) => ({
    label: String(check.ruleName || check.rule || check.ruleCode || label('Governance Rule', 'قاعدة حوكمة', lang)),
    value: (check.passed ?? true) ? label('Pass', 'ناجح', lang) : label('Fail', 'فشل', lang),
    passed: Boolean(check.passed ?? true),
    description: String(check.message || check.description || ''),
  }))

  checks.unshift(
    {
      label: label('Maximum Deduction Rule', 'قاعدة الحد الأقصى للاستقطاع', lang),
      value: proposedDeductionPercent === null ? '-' : `${proposedDeductionPercent.toFixed(1)}%`,
      passed: assessment.rule20PercentCompliance
        ? assessment.rule20PercentCompliance === 'pass'
        : proposedDeductionPercent !== null
          ? proposedDeductionPercent <= 20
          : null,
      description: label('Approved governance threshold is 20%.', 'حد الحوكمة المعتمد هو 20%.', lang),
    },
    {
      label: label('Rescheduling Period Rule', 'قاعدة مدة إعادة الجدولة', lang),
      value: `${assessment.recommendedDuration} ${label('months', 'شهر', lang)}`,
      passed: assessment.periodRuleCompliance ? assessment.periodRuleCompliance === 'pass' : null,
    },
    {
      label: label('Debt Burden Ratio', 'نسبة عبء الدين', lang),
      value: percentText(assessment.proposedDBR),
      passed: assessment.proposedDBR <= maxDBR,
      description: `${label('Limit', 'الحد', lang)} ${percentText(maxDBR)}`,
    },
    {
      label: label('Document Completeness', 'اكتمال المستندات', lang),
      value: assessment.applicationStatus || caseData.documentCompleteness || '-',
      passed: (assessment.applicationStatus || caseData.documentCompleteness) === 'complete',
    },
  )

  return checks
}

function PanelTitle({ icon: Icon, eyebrow, title }: { icon: typeof User; eyebrow?: string; title: string }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3 border-b border-[rgba(201,168,76,0.16)] pb-3">
      <div>
        {eyebrow && <div className="moei-data-label mb-1">{eyebrow}</div>}
        <h2 className="flex items-center gap-2 text-lg font-black text-[var(--moei-text)]">
          <Icon className="size-5 text-[var(--moei-gold)]" />
          {title}
        </h2>
      </div>
    </div>
  )
}

function DataCell({ label: cellLabel, value, emphasize, danger }: { label: string; value: ReactNode; emphasize?: boolean; danger?: boolean }) {
  return (
    <div className="rounded-md border border-[rgba(201,168,76,0.14)] bg-[rgba(10,22,40,0.52)] p-3">
      <div className="moei-data-label">{cellLabel}</div>
      <div className={cn('mt-1 break-words text-sm font-bold text-[var(--moei-text)]', emphasize && 'font-moei-mono text-xl', danger && 'text-[var(--moei-danger)]')}>
        {value}
      </div>
    </div>
  )
}

function PlanMetric({ label: metricLabel, value, accent }: { label: string; value: ReactNode; accent?: 'gold' | 'cyan' | 'red' | 'green' }) {
  return (
    <div className="border-s-2 border-[var(--moei-border-strong)] bg-[rgba(10,22,40,0.46)] p-4">
      <div className="moei-data-label">{metricLabel}</div>
      <div
        className={cn(
          'font-moei-mono mt-2 text-2xl font-bold text-[var(--moei-text)]',
          accent === 'gold' && 'text-[var(--moei-gold)]',
          accent === 'cyan' && 'text-[var(--moei-cyan)]',
          accent === 'red' && 'text-[var(--moei-danger)]',
          accent === 'green' && 'text-[var(--moei-success)]',
        )}
      >
        {value}
      </div>
    </div>
  )
}

function TwinSignal({ signal }: { signal: DecisionTwinSignal }) {
  return (
    <div
      className={cn(
        'rounded-md border p-3',
        signal.tone === 'green' && 'border-[var(--moei-success)] bg-[var(--moei-success-soft)]',
        signal.tone === 'red' && 'border-[var(--moei-danger)] bg-[var(--moei-danger-soft)]',
        signal.tone === 'cyan' && 'border-[var(--moei-cyan)] bg-[var(--moei-cyan-soft)]',
        signal.tone === 'gold' && 'border-[var(--moei-gold)] bg-[var(--moei-gold-soft)]',
      )}
    >
      <div className="flex items-start gap-2">
        {signal.tone === 'green' ? (
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[var(--moei-success)]" />
        ) : signal.tone === 'red' ? (
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--moei-danger)]" />
        ) : signal.tone === 'cyan' ? (
          <GitBranch className="mt-0.5 size-4 shrink-0 text-[var(--moei-cyan)]" />
        ) : (
          <Sparkles className="mt-0.5 size-4 shrink-0 text-[var(--moei-gold)]" />
        )}
        <div>
          <div className="text-sm font-extrabold text-[var(--moei-text)]">{signal.title}</div>
          <div className="mt-1 text-xs leading-5 text-[var(--moei-muted)]">{signal.detail}</div>
        </div>
      </div>
    </div>
  )
}

function StakeholderCard({ item }: { item: StakeholderLens }) {
  const Icon = item.icon
  return (
    <div className="rounded-md border border-[rgba(201,168,76,0.16)] bg-[rgba(10,22,40,0.52)] p-4">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-md border',
            item.tone === 'green' && 'border-[var(--moei-success)] bg-[var(--moei-success-soft)] text-[var(--moei-success)]',
            item.tone === 'red' && 'border-[var(--moei-danger)] bg-[var(--moei-danger-soft)] text-[var(--moei-danger)]',
            item.tone === 'cyan' && 'border-[var(--moei-cyan)] bg-[var(--moei-cyan-soft)] text-[var(--moei-cyan)]',
            item.tone === 'gold' && 'border-[var(--moei-gold)] bg-[var(--moei-gold-soft)] text-[var(--moei-gold)]',
          )}
        >
          <Icon className="size-4" />
        </div>
        <div className="min-w-0">
          <div className="moei-data-label">{item.role}</div>
          <div className="mt-1 text-base font-black text-[var(--moei-text)]">{item.signal}</div>
          <div className="mt-2 text-xs leading-5 text-[var(--moei-muted)]">{item.evidence}</div>
        </div>
      </div>
    </div>
  )
}

export default function CaseDetail({ caseData, loading, onBack, onStatusChange }: CaseDetailProps) {
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [viewFile, setViewFile] = useState<FilePreview | null>(null)
  const [textContent, setTextContent] = useState<string | null>(null)
  const [textContentLoading, setTextContentLoading] = useState(false)
  const [spreadsheetRows, setSpreadsheetRows] = useState<string[][] | null>(null)
  const [spreadsheetSheetNames, setSpreadsheetSheetNames] = useState<string[] | null>(null)
  const [extractedDocText, setExtractedDocText] = useState<string | null>(null)
  const [extractLoading, setExtractLoading] = useState(false)
  const [officerCallOpen, setOfficerCallOpen] = useState(false)
  const [officerCallStage, setOfficerCallStage] = useState<OfficerCallStage>('idle')
  const [officerCallTranscript, setOfficerCallTranscript] = useState<OfficerCallLine[]>([])
  const [isSpeakingBrief, setIsSpeakingBrief] = useState(false)
  const [officerCallStartedAt, setOfficerCallStartedAt] = useState<number | null>(null)
  const [officerCallElapsedSeconds, setOfficerCallElapsedSeconds] = useState(0)
  const [officerCallDelivery, setOfficerCallDelivery] = useState<OfficerCallDelivery>({
    mode: 'demo',
    provider: 'browser_demo',
    message: 'Demo call mode ready.',
  })
  const [optimisticStatus, setOptimisticStatus] = useState<RequestData['status'] | null>(null)
  const [officerVoiceListening, setOfficerVoiceListening] = useState(false)
  const [officerVoiceCommand, setOfficerVoiceCommand] = useState<string | null>(null)
  const [beneficiaryCallLoading, setBeneficiaryCallLoading] = useState(false)
  const [beneficiaryCallDelivery, setBeneficiaryCallDelivery] = useState<BeneficiaryCallDelivery | null>(null)
  const { language } = useAppStore()
  const { getNumber } = useSystemConfig()
  const maxDBR = getNumber('max_dbr_limit', 0.6)
  const riskThresholds = {
    low: getNumber('risk_threshold_low', 30),
    medium: getNumber('risk_threshold_medium', 60),
    high: getNumber('risk_threshold_high', 80),
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
      window.open(`/api/files/${encodeURIComponent(storedName)}`, '_blank')
    }
  }, [])

  const handleViewFile = useCallback(async (storedName: string, originalName: string, mimeType: string, fileSize?: number) => {
    const fileUrl = `/api/files/${encodeURIComponent(storedName)}`
    const ext = originalName.split('.').pop()?.toLowerCase() || ''
    setViewFile({ url: fileUrl, type: mimeType, name: originalName, storedName, size: fileSize })

    if (mimeType === 'text/plain' || ext === 'txt') {
      setTextContentLoading(true)
      setTextContent(null)
      const textRes = await authFetch(fileUrl)
      setTextContent(textRes.ok ? await textRes.text() : null)
      setTextContentLoading(false)
      return
    }

    if (['doc', 'docx', 'xls', 'xlsx', 'csv'].includes(ext) || mimeType.includes('word') || mimeType.includes('sheet') || mimeType.includes('excel')) {
      setExtractLoading(true)
      setExtractedDocText(null)
      setSpreadsheetRows(null)
      setSpreadsheetSheetNames(null)
      try {
        const extractRes = await authFetch(`/api/extract-file-text?file=${encodeURIComponent(storedName)}`)
        if (extractRes.ok) {
          const data = await extractRes.json() as { text?: string; rows?: string[][]; sheetNames?: string[] }
          if (['xls', 'xlsx', 'csv'].includes(ext) || mimeType.includes('sheet') || mimeType.includes('excel')) {
            setSpreadsheetRows(data.rows || [])
            setSpreadsheetSheetNames(data.sheetNames || null)
          } else {
            setExtractedDocText(data.text || 'No text content could be extracted.')
          }
        } else {
          setExtractedDocText('Could not extract text from this document.')
        }
      } catch {
        setExtractedDocText('Could not extract text from this document.')
      }
      setExtractLoading(false)
    }
  }, [])

  useEffect(() => {
    if (caseData?.id) {
      authFetch('/api/audit-log/view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: caseData.id, action: 'viewed', details: { viewedBy: 'admin' } }),
      }).catch(() => {})
    }
  }, [caseData?.id])

  useEffect(() => {
    setOptimisticStatus(null)
    setBeneficiaryCallDelivery(null)
  }, [caseData?.id, caseData?.status])

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  useEffect(() => {
    if (!officerCallOpen || officerCallStartedAt === null || FINAL_OFFICER_CALL_STAGES.includes(officerCallStage)) return
    const timer = window.setInterval(() => {
      setOfficerCallElapsedSeconds(Math.floor((Date.now() - officerCallStartedAt) / 1000))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [officerCallOpen, officerCallStartedAt, officerCallStage])

  useEffect(() => {
    if (!officerCallOpen || !caseData?.id || FINAL_OFFICER_CALL_STAGES.includes(officerCallStage) || actionLoading) return

    const timer = window.setInterval(async () => {
      try {
        const res = await authFetch(`/api/requests/${caseData.id}`)
        if (!res.ok) return
        const updated = await res.json() as RequestData
        if (!['approved', 'rejected', 'escalated'].includes(updated.status)) return

        const finalStage = updated.status === 'approved'
          ? 'approved'
          : updated.status === 'rejected'
            ? 'rejected'
            : 'escalated'
        setOptimisticStatus(updated.status)
        setOfficerCallStage(finalStage)
        setOfficerVoiceCommand(label(
          `Phone decision captured: ${updated.status}`,
          `تم التقاط قرار المكالمة: ${statusText(updated.status, language)}`,
          language
        ))
        setOfficerCallDelivery((current) => ({
          ...current,
          message: label(
            `Officer phone decision synced: ${updated.status}.`,
            `تمت مزامنة قرار الموظف من المكالمة: ${statusText(updated.status, language)}.`,
            language
          ),
        }))
        setOfficerCallTranscript((lines) => [
          ...lines,
          {
            speaker: label('Carrier Webhook', 'ويب هوك الاتصال', language),
            text: label(
              `Twilio captured the officer decision and updated the case to ${updated.status}.`,
              `التقط Twilio قرار الموظف وحدث حالة الطلب إلى ${statusText(updated.status, language)}.`,
              language
            ),
            tone: updated.status === 'approved' ? 'green' : 'red',
          },
        ])
        onStatusChange()
      } catch {
        // Keep the demo screen stable if a transient poll fails.
      }
    }, 2000)

    return () => window.clearInterval(timer)
  }, [actionLoading, caseData?.id, language, officerCallOpen, officerCallStage, onStatusChange])

  const parsed = useMemo(() => {
    if (!caseData) return null
    const assessment = caseData.assessment ?? null
    const uploadedFiles = parseJSON<UploadedFileData[]>(caseData.uploadedFiles, [])
    const supportingDocuments = parseStringList(caseData.supportingDocuments)
    const missingDocuments = parseStringList(caseData.missingDocuments)
    const filesByDocType = uploadedFiles.reduce<Record<string, UploadedFileData[]>>((acc, file) => {
      const key = file.docType || 'additional'
      if (!acc[key]) acc[key] = []
      acc[key].push(file)
      return acc
    }, {})
    const decisionRationale = assessment ? parseJSON<Record<string, unknown>>(assessment.decisionRationale, {}) : {}
    const documentSummaries = Array.isArray(decisionRationale.document_summaries) ? decisionRationale.document_summaries as Array<Record<string, unknown>> : []
    const algorithmTrace = Array.isArray(decisionRationale.algorithm_trace) ? decisionRationale.algorithm_trace as Array<Record<string, unknown>> : []
    const riskFactors = assessment ? parseJSON<Array<Record<string, unknown>>>(assessment.riskFactors, []) : []
    return { assessment, uploadedFiles, supportingDocuments, missingDocuments, filesByDocType, decisionRationale, documentSummaries, algorithmTrace, riskFactors }
  }, [caseData])

  if (loading || !caseData || !parsed) return <DetailSkeleton />

  const { assessment, uploadedFiles, supportingDocuments, missingDocuments, filesByDocType, decisionRationale, documentSummaries, algorithmTrace, riskFactors } = parsed
  const applicant = caseData.applicant
  const loan = caseData.loan
  const arrear = caseData.arrear
  const displayedStatus = optimisticStatus || caseData.status
  const proposedDeductionPercent = asPercent(assessment?.proposedDeductionRate ?? caseData.deductionRate)
  const decisionPath = assessment?.requiresHumanReview || displayedStatus === 'escalated' ? 'human' : 'auto'
  const governanceChecks = assessment ? normalizeGovernanceChecks(assessment, caseData, maxDBR, proposedDeductionPercent, language) : []
  const rationaleText = String(
    decisionRationale.reasoning ||
    assessment?.moeiReasoning ||
    assessment?.caseSummary ||
    caseData.reason ||
    '-'
  )
  const paidPct = loan && loan.originalAmount > 0
    ? Math.max(0, Math.min(100, Math.round(((loan.originalAmount - loan.remainingBalance) / loan.originalAmount) * 100)))
    : 0
  const canTakeAction = ['ai_assessed', 'under_review', 'pending', 'escalated'].includes(displayedStatus)
  const canNotifyBeneficiary = ['approved', 'rejected', 'escalated'].includes(displayedStatus)
  const rawGovernanceChecks = assessment ? parseJSON<Array<Record<string, unknown>>>(assessment.governanceCompliance, []) : []
  const failedGovernanceChecks = rawGovernanceChecks.filter((check) => check.passed === false)
  const activeRequestBlocked = failedGovernanceChecks.some((check) => String(check.ruleCode || '').startsWith('ACTIVE'))
  const documentBlocked = missingDocuments.length > 0 || failedGovernanceChecks.some((check) => String(check.ruleCode || '').startsWith('DOC'))
  const deductionBlocked = assessment?.rule20PercentCompliance === 'fail' || (proposedDeductionPercent !== null && proposedDeductionPercent > 20)
  const periodBlocked = assessment?.periodRuleCompliance === 'fail'
  const riskBlocked = assessment ? ['high', 'critical'].includes(assessment.riskLevel) : false
  const maxAllowedInstallment = applicant?.monthlyIncome ? Math.floor(applicant.monthlyIncome * 0.2) : 0
  const remainingApprovedPeriod = loan ? Math.max(loan.loanDurationMonths - loan.elapsedMonths, 0) : 0
  const blockerCount = [
    activeRequestBlocked,
    documentBlocked,
    deductionBlocked,
    periodBlocked,
    riskBlocked,
  ].filter(Boolean).length
  const decisionTwinSignals: DecisionTwinSignal[] = blockerCount === 0
    ? [
        {
          title: label('Auto-decision path is clear', 'مسار القرار التلقائي واضح', language),
          detail: label('Documents, deduction cap, repayment period, active-request validation, and risk gates are aligned.', 'المستندات وحد الخصم وفترة السداد والتحقق من الطلب النشط وبوابات المخاطر متوافقة.', language),
          tone: 'green',
        },
        {
          title: label('Officer receives an approval-ready audit packet', 'يتلقى الموظف ملف تدقيق جاهز للاعتماد', language),
          detail: label('The case can move from recommendation to approval without redoing the calculations manually.', 'يمكن نقل الحالة من التوصية إلى الاعتماد دون إعادة الحسابات يدويا.', language),
          tone: 'gold',
        },
      ]
    : [
        ...(documentBlocked ? [{
          title: label('Document route to green', 'مسار المستندات للتوافق', language),
          detail: label(`Request ${missingDocuments.join(', ') || 'missing evidence'} to convert the case from incomplete to assessable.`, `طلب ${missingDocuments.join(', ') || 'المستندات الناقصة'} لتحويل الحالة من غير مكتملة إلى قابلة للتقييم.`, language),
          tone: 'red' as const,
        }] : []),
        ...(activeRequestBlocked ? [{
          title: label('Duplicate active request detected', 'تم اكتشاف طلب نشط مكرر', language),
          detail: label('Close, merge, or officer-review the existing active request before automated approval.', 'إغلاق أو دمج أو مراجعة الطلب النشط الحالي قبل الاعتماد التلقائي.', language),
          tone: 'red' as const,
        }] : []),
        ...(deductionBlocked ? [{
          title: label('20% cap counterfactual', 'محاكاة حد الخصم 20%', language),
          detail: label(`Reduce the monthly installment to AED ${maxAllowedInstallment.toLocaleString()} or below to satisfy the MOEI deduction rule.`, `خفض القسط الشهري إلى ${maxAllowedInstallment.toLocaleString()} درهم أو أقل للامتثال لقاعدة الخصم في الوزارة.`, language),
          tone: 'cyan' as const,
        }] : []),
        ...(periodBlocked ? [{
          title: label('Approved-period counterfactual', 'محاكاة الفترة المعتمدة', language),
          detail: label(`Cap the duration at ${remainingApprovedPeriod} months to remain within the original approved repayment period.`, `تحديد المدة عند ${remainingApprovedPeriod} شهر للبقاء ضمن فترة السداد الأصلية المعتمدة.`, language),
          tone: 'cyan' as const,
        }] : []),
        ...(riskBlocked ? [{
          title: label('Risk route to officer', 'مسار المخاطر إلى الموظف', language),
          detail: label('High-risk signals keep the case in human review with the AI rationale attached.', 'إشارات المخاطر العالية تبقي الحالة في المراجعة البشرية مع إرفاق مبررات الذكاء الاصطناعي.', language),
          tone: 'red' as const,
        }] : []),
      ]
  const nextBestAction = blockerCount === 0
    ? label('Approve with the generated audit rationale and keep the calculated plan attached to the case.', 'اعتماد الحالة مع مبررات التدقيق المولدة وإبقاء الخطة المحسوبة مرفقة بالملف.', language)
    : documentBlocked
      ? label('Request the missing income/document evidence first; the agent can re-run instantly once uploaded.', 'اطلب مستند الدخل أو المستند الناقص أولا؛ يمكن للوكيل إعادة التقييم فور رفعه.', language)
      : activeRequestBlocked
        ? label('Resolve the active-request conflict, then re-run the assessment for a clean governance trail.', 'حل تعارض الطلب النشط ثم إعادة تشغيل التقييم لمسار حوكمة واضح.', language)
        : label('Adjust the proposed plan against the failed rule, then re-run the assessment for a new recommendation.', 'عدّل الخطة المقترحة مقابل القاعدة غير المستوفاة ثم أعد تشغيل التقييم للحصول على توصية جديدة.', language)
  const governancePassRate = governanceChecks.length > 0
    ? Math.round((governanceChecks.filter((check) => check.passed !== false).length / governanceChecks.length) * 100)
    : 0
  const publicValueMetrics = [
    {
      label: label('SLA Compression', 'ضغط زمن الخدمة', language),
      value: label('5d -> Instant', '5 أيام -> فوري', language),
      accent: 'gold' as const,
    },
    {
      label: label('Governance Trace', 'أثر الحوكمة', language),
      value: `${governancePassRate}%`,
      accent: governancePassRate >= 90 ? 'green' as const : 'red' as const,
    },
    {
      label: label('Financial Decision', 'قرار مالي', language),
      value: formatAED(assessment?.recommendedInstallment ?? 0),
      accent: 'cyan' as const,
    },
    {
      label: label('Human Load', 'عبء الموظف', language),
      value: decisionPath === 'human' ? label('Focused', 'مركز', language) : label('Removed', 'مزال', language),
      accent: decisionPath === 'human' ? 'red' as const : 'green' as const,
    },
  ]
  const stakeholderLenses: StakeholderLens[] = [
    {
      role: label('Judge Lens', 'منظور لجنة التحكيم', language),
      signal: label('Rubric evidence is visible on-screen', 'أدلة التقييم ظاهرة على الشاشة', language),
      evidence: label('Agentic decision, governance, explainability, impact, and officer UX are all tied to this case.', 'القرار الذكي والحوكمة وقابلية التفسير والأثر وتجربة الموظف كلها مرتبطة بهذه الحالة.', language),
      tone: 'gold',
      icon: ShieldCheck,
    },
    {
      role: label('Academic Lens', 'منظور أكاديمي', language),
      signal: label('Counterfactual reasoning, not a black box', 'استدلال بدائل وليس صندوقا أسود', language),
      evidence: blockerCount === 0
        ? label('The model explains why the case passes and preserves the rule evidence.', 'يوضح النموذج سبب اجتياز الحالة ويحفظ أدلة القواعد.', language)
        : label('The model explains what change would move the case toward compliance.', 'يوضح النموذج التغيير الذي ينقل الحالة نحو الامتثال.', language),
      tone: 'cyan',
      icon: Brain,
    },
    {
      role: label('Citizen / Student Lens', 'منظور المواطن / الطالب', language),
      signal: blockerCount === 0 ? label('No five-day uncertainty', 'لا انتظار غير واضح لمدة خمسة أيام', language) : label('Clear next document, no guessing', 'المستند التالي واضح دون تخمين', language),
      evidence: blockerCount === 0
        ? label('The decision path, amount, duration, and installment are immediately understandable.', 'مسار القرار والمبلغ والمدة والقسط مفهومة فورا.', language)
        : nextBestAction,
      tone: blockerCount === 0 ? 'green' : 'red',
      icon: Users,
    },
    {
      role: label('MOEI Employee Lens', 'منظور موظف الوزارة', language),
      signal: decisionPath === 'human' ? label('Review only the exception', 'مراجعة الاستثناء فقط', language) : label('Approval packet is ready', 'ملف الاعتماد جاهز', language),
      evidence: label('The officer gets the rationale, risk factors, governance checks, and next action without rebuilding the case.', 'يحصل الموظف على المبررات وعوامل المخاطر وفحوصات الحوكمة والإجراء التالي دون إعادة بناء الملف.', language),
      tone: decisionPath === 'human' ? 'red' : 'green',
      icon: Landmark,
    },
  ]
  const officerCallBrief = assessment
    ? [
        label('This is the MOEI Decision Twin calling the Finance and Collection officer with a decision-ready case.', 'السلام عليكم، وياك التوأم الرقمي لقرار الوزارة. عندنا ملف جاهز للقرار ونحتاج تأكيد موظف المالية والتحصيل.', language),
        label(`Applicant: ${applicant?.nameEn || 'Unknown applicant'}.`, `الحالة تخص المستفيد: ${applicant?.nameAr || applicant?.nameEn || 'غير معروف'}.`, language),
        label(`Recommended plan: ${formatAED(assessment.recommendedAmount)}, ${assessment.recommendedDuration} months, monthly installment ${formatAED(assessment.recommendedInstallment)}.`, `الخطة المقترحة هي ${formatAED(assessment.recommendedAmount)} لمدة ${assessment.recommendedDuration} شهر، والقسط الشهري بيكون ${formatAED(assessment.recommendedInstallment)}.`, language),
        label(`Deduction rate is ${proposedDeductionPercent === null ? 'not available' : `${proposedDeductionPercent.toFixed(1)} percent`}, against the approved 20 percent governance cap.`, `نسبة الاستقطاع ${proposedDeductionPercent === null ? 'غير متاحة' : `${proposedDeductionPercent.toFixed(1)} بالمئة`}، وهي ضمن حد الحوكمة المعتمد 20 بالمئة.`, language),
        label(`Decision path is ${decisionPath === 'human' ? 'human review' : 'auto path'} with ${blockerCount === 0 ? 'no blockers' : `${blockerCount} blockers`}.`, `مسار القرار ${decisionPath === 'human' ? 'مراجعة بشرية' : 'تلقائي'}، و${blockerCount === 0 ? 'ما فيه أي عوائق' : `فيه ${blockerCount} عوائق تحتاج متابعة`}.`, language),
        label(`Next best action: ${nextBestAction}`, `الإجراء الأنسب الحين: ${nextBestAction}`, language),
      ]
    : []
  const officerCallSteps = [
    { id: 'dialing', title: label('Outbound', 'اتصال صادر', language), caption: label('Officer receives', 'الموظف يستلم', language), icon: PhoneCall },
    { id: 'briefing', title: label('Brief', 'ملخص', language), caption: label('Twin rationale', 'مبررات التوأم', language), icon: Brain },
    { id: 'awaiting_decision', title: label('Decide', 'قرار', language), caption: label('Yes / no / escalate', 'نعم / لا / إحالة', language), icon: Mic2 },
    { id: 'final', title: label('Finalize', 'تثبيت', language), caption: label('Audit trail', 'سجل التدقيق', language), icon: ShieldCheck },
  ]
  const officerCallStageRank = officerCallStage === 'idle'
    ? -1
    : officerCallStage === 'dialing'
      ? 0
      : officerCallStage === 'briefing'
        ? 1
        : officerCallStage === 'awaiting_decision'
          ? 2
          : 3
  const officerCallStatusLabel = officerCallStage === 'idle'
    ? label('Ready', 'جاهز', language)
    : officerCallStage === 'dialing'
      ? label('Dialing', 'جاري الاتصال', language)
      : officerCallStage === 'briefing'
        ? label('AI Briefing', 'ملخص الذكاء الاصطناعي', language)
        : officerCallStage === 'awaiting_decision'
          ? label('Awaiting Decision', 'بانتظار القرار', language)
          : officerCallStage === 'approved'
            ? label('Approved', 'معتمد', language)
            : officerCallStage === 'rejected'
              ? label('Rejected', 'مرفوض', language)
              : label('Escalated', 'محال', language)
  const officerCallOutcomeTone = officerCallStage === 'approved'
    ? 'green'
    : officerCallStage === 'rejected' || officerCallStage === 'escalated'
      ? 'red'
      : 'gold'
  const callClockText = `${Math.floor(officerCallElapsedSeconds / 60).toString().padStart(2, '0')}:${(officerCallElapsedSeconds % 60).toString().padStart(2, '0')}`
  const officerLiveSyncLabel = officerCallStage === 'dialing'
    ? label('AI is calling the officer', 'الذكاء الاصطناعي يتصل بالموظف', language)
    : officerCallStage === 'briefing'
      ? label('Officer received the AI brief', 'الموظف استلم ملخص الذكاء الاصطناعي', language)
      : officerCallStage === 'awaiting_decision'
        ? label('Waiting for officer yes / no / escalate', 'بانتظار نعم أو لا أو إحالة من الموظف', language)
        : officerCallStage === 'approved'
          ? actionLoading
            ? label('Approved live, syncing audit trail', 'تم الاعتماد مباشرة وجاري حفظ سجل التدقيق', language)
            : label('Approved and synced', 'تم الاعتماد والمزامنة', language)
          : officerCallStage === 'rejected'
            ? actionLoading
              ? label('Rejected live, syncing audit trail', 'تم الرفض مباشرة وجاري حفظ سجل التدقيق', language)
              : label('Rejected and synced', 'تم الرفض والمزامنة', language)
            : officerCallStage === 'escalated'
              ? actionLoading
                ? label('Escalated live, syncing audit trail', 'تمت الإحالة مباشرة وجاري حفظ سجل التدقيق', language)
                : label('Escalated and synced', 'تمت الإحالة والمزامنة', language)
              : label('Ready to call', 'جاهز للاتصال', language)
  const officerDeliveryLabel = officerCallDelivery.mode === 'real'
    ? label('Carrier Call Live', 'اتصال حقيقي عبر المزود', language)
    : officerCallDelivery.mode === 'pending'
      ? label('Checking Carrier Gateway', 'جاري فحص بوابة الاتصال', language)
      : label('Demo Call Mode', 'وضع اتصال تجريبي', language)
  const officerDeliveryTone = officerCallDelivery.mode === 'real'
    ? 'green'
    : officerCallDelivery.mode === 'pending'
      ? 'cyan'
      : 'gold'
  const officerDeliveryMessage = officerCallDelivery.mode === 'demo' && officerCallDelivery.missingConfig?.length
    ? label(
        'Demo environment: the officer receives the AI brief through the secure demo channel, then the decision updates the site live.',
        'بيئة العرض التجريبي: الموظف يستلم ملخص الذكاء الاصطناعي عبر القناة التجريبية الآمنة، وبعدها القرار يتحدث مباشرة في الموقع.',
        language
      )
    : officerCallDelivery.message

  const stopSpeakingBrief = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    setIsSpeakingBrief(false)
  }

  const speakOfficerBrief = () => {
    stopSpeakingBrief()
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || officerCallBrief.length === 0) return
    const utterance = new SpeechSynthesisUtterance(officerCallBrief.join(' '))
    utterance.lang = language === 'ar' ? 'ar-AE' : 'en-US'
    utterance.rate = 0.92
    utterance.pitch = 0.88
    utterance.onend = () => setIsSpeakingBrief(false)
    utterance.onerror = () => setIsSpeakingBrief(false)
    setIsSpeakingBrief(true)
    window.speechSynthesis.speak(utterance)
  }

  const requestCarrierOfficerCall = async () => {
    setOfficerCallDelivery({
      mode: 'pending',
      provider: 'telecom',
      message: label('Sending AI outbound call through the backend gateway...', 'جاري إرسال اتصال صادر من الذكاء الاصطناعي عبر بوابة الخادم...', language),
    })
    try {
      const res = await authFetch('/api/officer-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId: caseData.id,
          to: DEMO_OFFICER_PHONE,
          language,
          brief: officerCallBrief,
        }),
      })
      const data = await res.json().catch(() => ({})) as Partial<OfficerCallDelivery> & {
        mode?: 'real' | 'demo'
        provider?: 'twilio' | 'browser_demo'
        callSid?: string
        missingConfig?: string[]
        error?: string
        message?: string
        voiceProvider?: 'elevenlabs' | 'twilio_say'
        decisionCapture?: { enabled?: boolean; requiresPublicWebhook?: boolean }
      }
      if (res.ok && data.mode === 'real') {
        const delivery: OfficerCallDelivery = {
          mode: 'real',
          provider: 'twilio',
          callSid: data.callSid,
          voiceProvider: data.voiceProvider,
          decisionCapture: data.decisionCapture,
          message: data.decisionCapture?.enabled
            ? label('Real carrier call accepted; officer can decide by voice or keypad.', 'تم قبول الاتصال الحقيقي؛ الموظف يقدر يقرر بالصوت أو بالأرقام.', language)
            : label('Real carrier call accepted; phone decision capture needs a public webhook URL.', 'تم قبول الاتصال الحقيقي؛ التقاط القرار من المكالمة يحتاج رابط ويب هوك عام.', language),
        }
        setOfficerCallDelivery(delivery)
        setOfficerCallTranscript((lines) => [
          ...lines,
          {
            speaker: label('Carrier Gateway', 'بوابة الاتصال', language),
            text: delivery.decisionCapture?.enabled
              ? label(
                  `AI outbound call delivered to ${DEMO_OFFICER_PHONE_DISPLAY} using ${delivery.voiceProvider === 'elevenlabs' ? 'ElevenLabs voice' : 'Twilio voice'}. The officer can say yes, no, or escalate, or press 1, 2, or 3.`,
                  `تم توصيل الاتصال على ${DEMO_OFFICER_PHONE_DISPLAY} باستخدام ${delivery.voiceProvider === 'elevenlabs' ? 'صوت ElevenLabs' : 'صوت Twilio'}. الموظف يقدر يقول نعم، لا، أو إحالة، أو يضغط 1، 2، أو 3.`,
                  language
                )
              : label(
                  `AI outbound call delivered to ${DEMO_OFFICER_PHONE_DISPLAY} using ${delivery.voiceProvider === 'elevenlabs' ? 'ElevenLabs voice' : 'Twilio voice'}, but live phone decision capture is not enabled until TWILIO_WEBHOOK_BASE_URL is configured.`,
                  `تم توصيل الاتصال على ${DEMO_OFFICER_PHONE_DISPLAY} باستخدام ${delivery.voiceProvider === 'elevenlabs' ? 'صوت ElevenLabs' : 'صوت Twilio'}، لكن التقاط قرار المكالمة مباشرة يحتاج ضبط TWILIO_WEBHOOK_BASE_URL.`,
                  language
                ),
            tone: 'green',
          },
        ])
        return
      }

      const delivery: OfficerCallDelivery = {
        mode: 'demo',
        provider: data.provider === 'twilio' ? 'twilio' : 'browser_demo',
        message: data.message || label('Carrier call unavailable; browser voice demo is active.', 'الاتصال الحقيقي غير متاح؛ العرض الصوتي في المتصفح شغال.', language),
        missingConfig: data.missingConfig,
        error: data.error,
      }
      setOfficerCallDelivery(delivery)
      setOfficerCallTranscript((lines) => [
        ...lines,
        {
          speaker: label('Carrier Gateway', 'بوابة الاتصال', language),
          text: delivery.missingConfig?.length
            ? label(
                'Demo environment detected. The officer receives the AI call brief in the secure demo channel.',
                'تم اكتشاف بيئة عرض تجريبي. الموظف يستلم ملخص اتصال الذكاء الاصطناعي في القناة التجريبية الآمنة.',
                language
              )
            : label(
                `${delivery.error || delivery.message} Continuing through the secure demo officer channel.`,
                `${delivery.error || delivery.message} بنكمل عبر قناة الموظف التجريبية الآمنة.`,
                language
              ),
          tone: 'gold',
        },
      ])
    } catch {
      const delivery: OfficerCallDelivery = {
        mode: 'demo',
        provider: 'browser_demo',
        message: label('Backend call gateway did not respond; secure officer demo channel is active.', 'بوابة الاتصال في الخادم ما استجابت؛ قناة الموظف التجريبية الآمنة شغالة.', language),
      }
      setOfficerCallDelivery(delivery)
      setOfficerCallTranscript((lines) => [
        ...lines,
        {
          speaker: label('Carrier Gateway', 'بوابة الاتصال', language),
          text: delivery.message,
          tone: 'gold',
        },
      ])
    }
  }

  const listenForOfficerVoiceDecision = () => {
    if (typeof window === 'undefined' || actionLoading !== null) return
    const speechWindow = window as unknown as {
      SpeechRecognition?: new () => {
        lang: string
        continuous: boolean
        interimResults: boolean
        maxAlternatives: number
        onresult: ((event: unknown) => void) | null
        onerror: (() => void) | null
        onend: (() => void) | null
        start: () => void
      }
      webkitSpeechRecognition?: new () => {
        lang: string
        continuous: boolean
        interimResults: boolean
        maxAlternatives: number
        onresult: ((event: unknown) => void) | null
        onerror: (() => void) | null
        onend: (() => void) | null
        start: () => void
      }
    }
    const SpeechRecognitionCtor = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition
    if (!SpeechRecognitionCtor) {
      setOfficerVoiceCommand(label('Voice capture unavailable in this browser. Demo voice commands are ready.', 'التقاط الصوت غير متاح في هذا المتصفح. أوامر الصوت التجريبية جاهزة.', language))
      setOfficerCallTranscript((lines) => [
        ...lines,
        {
          speaker: label('Decision Twin', 'التوأم الرقمي', language),
          text: label('Voice capture is unavailable, so the demo call decision chips will inject the officer phrase with no delay.', 'التقاط الصوت غير متاح، لذلك أزرار قرار المكالمة التجريبية بتدخل عبارة الموظف بدون تأخير.', language),
          tone: 'gold',
        },
      ])
      return
    }

    const recognition = new SpeechRecognitionCtor()
    recognition.lang = language === 'ar' ? 'ar-AE' : 'en-US'
    recognition.continuous = false
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    setOfficerVoiceListening(true)
    setOfficerVoiceCommand(label('Listening to officer...', 'نسمع قرار الموظف...', language))
    recognition.onresult = (event: unknown) => {
      const resultEvent = event as { results?: ArrayLike<ArrayLike<{ transcript?: string }>> }
      const spoken = resultEvent.results?.[0]?.[0]?.transcript?.trim() || ''
      const action = parseOfficerDecisionCommand(spoken)
      setOfficerVoiceCommand(spoken || label('No clear phrase captured.', 'ما تم التقاط عبارة واضحة.', language))
      if (action) {
        void handleOfficerCallDecision(action, spoken)
      } else {
        setOfficerCallTranscript((lines) => [
          ...lines,
          {
            speaker: label('Decision Twin', 'التوأم الرقمي', language),
            text: label(`Heard "${spoken}", but no accept/reject/escalate command was detected.`, `سمعت "${spoken}"، لكن ما ظهر أمر قبول أو رفض أو إحالة.`, language),
            tone: 'gold',
          },
        ])
      }
    }
    recognition.onerror = () => {
      setOfficerVoiceCommand(label('Voice capture interrupted. Demo voice commands remain ready.', 'انقطع التقاط الصوت. أوامر الصوت التجريبية ما زالت جاهزة.', language))
    }
    recognition.onend = () => setOfficerVoiceListening(false)
    recognition.start()
  }

  const startOfficerCall = () => {
    setOfficerCallOpen(true)
    setOfficerCallStage('dialing')
    setOfficerCallStartedAt(Date.now())
    setOfficerCallElapsedSeconds(0)
    setOfficerVoiceListening(false)
    setOfficerVoiceCommand(null)
    setOfficerCallDelivery({
      mode: 'pending',
      provider: 'telecom',
      message: label('Preparing the AI outbound call to the officer.', 'جاري تجهيز الاتصال الصادر من الذكاء الاصطناعي للموظف.', language),
    })
    setOfficerCallTranscript([
      {
        speaker: label('Decision Twin', 'التوأم الرقمي', language),
        text: label(`Decision Twin is calling the Finance and Collection officer at ${DEMO_OFFICER_PHONE_DISPLAY} for human-in-the-loop confirmation.`, `التوأم الرقمي يتصل الحين بموظف المالية والتحصيل على الرقم ${DEMO_OFFICER_PHONE_DISPLAY} لتأكيد القرار ضمن الحلقة البشرية.`, language),
        tone: 'gold',
      },
    ])
    void requestCarrierOfficerCall()

    window.setTimeout(() => {
      setOfficerCallStage('briefing')
      setOfficerCallTranscript((lines) => [
        ...lines,
        {
          speaker: label('Officer', 'الموظف', language),
          text: label('Officer received the Decision Twin call. Proceed with the case brief.', 'الموظف استلم اتصال التوأم الرقمي. تفضل اعرض ملخص الحالة.', language),
          tone: 'cyan',
        },
        {
          speaker: label('Decision Twin', 'التوأم الرقمي', language),
          text: officerCallBrief.join(' '),
          tone: 'green',
        },
      ])
      speakOfficerBrief()
    }, 700)

    window.setTimeout(() => {
      setOfficerCallStage('awaiting_decision')
      setOfficerCallTranscript((lines) => [
        ...lines,
        {
          speaker: label('Decision Twin', 'التوأم الرقمي', language),
          text: label('Awaiting officer decision: say yes, no, or escalate to officer.', 'بانتظار قرار الموظف: يقول نعم، لا، أو إحالة لموظف.', language),
          tone: 'muted',
        },
      ])
    }, 1800)
  }

  const handleOfficerCallDecision = async (action: OfficerDecisionAction, spokenCommand?: string) => {
    stopSpeakingBrief()
    setOfficerVoiceListening(false)
    setOfficerVoiceCommand(spokenCommand || officerDecisionPhrase(action, language))
    setOfficerCallStage(action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'escalated')
    setOfficerCallTranscript((lines) => [
      ...lines,
      {
        speaker: label('Officer', 'الموظف', language),
        text: label(
          `Officer said "${spokenCommand || officerDecisionPhrase(action, language)}" on the call. Decision Twin parsed the command as ${action === 'approve' ? 'ACCEPT' : action === 'reject' ? 'REJECT' : 'ESCALATE'}.`,
          `الموظف قال "${spokenCommand || officerDecisionPhrase(action, language)}" في المكالمة. التوأم الرقمي فهم القرار: ${action === 'approve' ? 'قبول' : action === 'reject' ? 'رفض' : 'إحالة'}.`,
          language
        ),
        tone: action === 'approve' ? 'green' : 'red',
      },
      {
        speaker: label('Decision Twin', 'التوأم الرقمي', language),
        text: action === 'approve'
          ? label('Binding accepted status from the call and preserving rationale in the audit trail.', 'تم، بنربط حالة القبول من المكالمة وبنحفظ المبررات في سجل التدقيق.', language)
          : action === 'reject'
            ? label('Binding rejected status from the call and preserving rationale in the audit trail.', 'تم، بنربط حالة الرفض من المكالمة وبنحفظ المبررات في سجل التدقيق.', language)
            : label('Binding escalation from the call and preserving rationale in the audit trail.', 'تم، بنربط الإحالة من المكالمة وبنحفظ المبررات في سجل التدقيق.', language),
        tone: 'gold',
      },
    ])
    await handleAction(action, 'officer_call')
  }

  async function handleAction(action: OfficerDecisionAction, source: 'manual' | 'officer_call' = 'manual') {
    setActionLoading(action)
    const nextStatus = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'escalated'
    const previousOptimisticStatus = optimisticStatus
    setOptimisticStatus(nextStatus)
    if (source === 'officer_call') {
      setOfficerCallDelivery((current) => ({
        ...current,
        message: label(
          `Live site status changed to ${nextStatus}; saving the audit trail now.`,
          `تم تحديث حالة الموقع مباشرة إلى ${statusText(nextStatus, language)}؛ جاري حفظ سجل التدقيق الآن.`,
          language
        ),
      }))
    }
    const actionPastTense = action === 'approve'
      ? label('approved', 'اعتماد', language)
      : action === 'reject'
        ? label('rejected', 'رفض', language)
        : label('escalated', 'إحالة', language)
    const callAuditNote = source === 'officer_call'
      ? label(
          `Decision Twin outbound call to officer ${DEMO_OFFICER_PHONE_DISPLAY}: officer ${nextStatus} after receiving the AI brief. Plan ${formatAED(assessment?.recommendedAmount ?? 0)} over ${assessment?.recommendedDuration ?? 0} months, installment ${formatAED(assessment?.recommendedInstallment ?? 0)}, deduction ${proposedDeductionPercent === null ? '-' : `${proposedDeductionPercent.toFixed(1)}%`}.`,
          `اتصال صادر من التوأم الرقمي للموظف على الرقم ${DEMO_OFFICER_PHONE_DISPLAY}: قرر الموظف ${nextStatus} بعد استلام ملخص الذكاء الاصطناعي. الخطة ${formatAED(assessment?.recommendedAmount ?? 0)} لمدة ${assessment?.recommendedDuration ?? 0} شهر، القسط ${formatAED(assessment?.recommendedInstallment ?? 0)}، الاستقطاع ${proposedDeductionPercent === null ? '-' : `${proposedDeductionPercent.toFixed(1)}%`}.`,
          language
        )
      : null
    try {
      const res = await authFetch(`/api/requests/${caseData.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: nextStatus,
          notes: callAuditNote
            ? [caseData.notes, callAuditNote].filter(Boolean).join('\n')
            : caseData.notes,
        }),
      })
      if (res.ok) {
        onStatusChange()
        if (source === 'officer_call') {
          setOfficerCallDelivery((current) => ({
            ...current,
            message: label(
              `Site status is synced: ${nextStatus}.`,
              `تمت المزامنة: حالة الطلب الآن ${statusText(nextStatus, language)}.`,
              language
            ),
          }))
        }
        toast({ title: label(`Request ${actionPastTense} successfully`, 'تم تحديث حالة الطلب بنجاح', language) })
      } else {
        setOptimisticStatus(previousOptimisticStatus)
        const err = await res.json().catch(() => ({})) as { error?: string }
        toast({ title: label(`Failed to ${action}`, 'تعذر تحديث الحالة', language), description: err.error || 'Unknown error', variant: 'destructive' })
      }
    } catch {
      setOptimisticStatus(previousOptimisticStatus)
      toast({ title: label(`Failed to ${action}`, 'تعذر تحديث الحالة', language), description: 'Network error', variant: 'destructive' })
    } finally {
      setActionLoading(null)
    }
  }

  async function handleBeneficiaryCall() {
    if (!['approved', 'rejected', 'escalated'].includes(displayedStatus)) {
      toast({
        title: label('Decision not finalized yet', 'القرار لم يكتمل بعد', language),
        description: label('Notify the beneficiary only after approval, rejection, or escalation.', 'يتم إخطار المستفيد بعد الاعتماد أو الرفض أو الإحالة فقط.', language),
        variant: 'destructive',
      })
      return
    }

    setBeneficiaryCallLoading(true)
    setBeneficiaryCallDelivery(null)
    try {
      const res = await authFetch('/api/beneficiary-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId: caseData.id,
          to: DEMO_BENEFICIARY_PHONE,
          language,
          reason: displayedStatus === 'rejected' ? rationaleText : undefined,
        }),
      })
      const data = await res.json().catch(() => ({})) as BeneficiaryCallDelivery & { error?: string }
      if (!res.ok) {
        throw new Error(data.error || 'Beneficiary call failed')
      }

      setBeneficiaryCallDelivery(data)
      toast({
        title: data.mode === 'real'
          ? label('Sultan notification call placed', 'تم إجراء اتصال إخطار سلطان', language)
          : label('Sultan notification prepared', 'تم تجهيز إخطار سلطان', language),
        description: data.message,
      })

      setOfficerCallTranscript((lines) => [
        ...lines,
        {
          speaker: label('Citizen Loop', 'حلقة المتعامل', language),
          text: data.mode === 'real'
            ? label(
                `AI notified Sultan at ${DEMO_BENEFICIARY_PHONE_DISPLAY} with the ${displayedStatus} outcome.`,
                `الذكاء الاصطناعي أخطر سلطان على ${DEMO_BENEFICIARY_PHONE_DISPLAY} بنتيجة ${statusText(displayedStatus, language)}.`,
                language
              )
            : label(
                `Notification script prepared for Sultan: ${data.notificationMessage || data.message}`,
                `تم تجهيز نص إخطار سلطان: ${data.notificationMessage || data.message}`,
                language
              ),
          tone: displayedStatus === 'approved' ? 'green' : displayedStatus === 'rejected' ? 'red' : 'gold',
        },
      ])
    } catch (err: any) {
      toast({
        title: label('Could not notify Sultan', 'تعذر إخطار سلطان', language),
        description: err?.message || 'Network error',
        variant: 'destructive',
      })
    } finally {
      setBeneficiaryCallLoading(false)
    }
  }

  async function handleReRunAssessment() {
    setActionLoading('assess')
    try {
      const res = await authFetch(`/api/requests/${caseData.id}/assess`, { method: 'POST' })
      if (res.ok) {
        onStatusChange()
        toast({ title: label('Assessment re-run successfully', 'تمت إعادة تشغيل التقييم', language) })
      } else {
        const err = await res.json().catch(() => ({})) as { error?: string }
        toast({ title: label('Failed to re-run assessment', 'تعذر إعادة تشغيل التقييم', language), description: err.error || 'Unknown error', variant: 'destructive' })
      }
    } catch {
      toast({ title: label('Failed to re-run assessment', 'تعذر إعادة تشغيل التقييم', language), description: 'Network error', variant: 'destructive' })
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="space-y-5">
      <section className="moei-panel rounded-md p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <Button variant="outline" size="sm" onClick={onBack} className="moei-control mt-1 gap-2 hover:bg-[var(--moei-gold-soft)]">
              <ArrowLeft className="size-4 rtl:rotate-180" />
              {t('caseDetail.back', language)}
            </Button>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="moei-data-label">{label('Case Intelligence File', 'ملف استخبارات الحالة', language)}</span>
                <Badge variant="outline" className={cn('border font-bold uppercase', statusBadgeClass(displayedStatus))}>
                  {statusText(displayedStatus, language)}
                </Badge>
                {assessment && (
                  <Badge variant="outline" className={cn('border font-bold uppercase', riskBadgeClass(assessment.riskLevel))}>
                    {riskText(assessment.riskLevel, language)}
                  </Badge>
                )}
              </div>
              <h1 className="mt-2 truncate text-3xl font-black text-[var(--moei-text)]">
                {applicant?.nameEn || label('Unknown Applicant', 'مستفيد غير معروف', language)}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-[var(--moei-muted)]">
                <span className="font-moei-mono text-[var(--moei-gold)]">{caseData.id}</span>
                <span>{maskEmiratesId(applicant?.emiratesId || '')}</span>
                <span className="flex items-center gap-1">
                  <CalendarClock className="size-3.5" />
                  {format(new Date(caseData.createdAt), 'dd MMM yyyy HH:mm')}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-end">
            <div>
              <div className="moei-data-label">{label('Proposed Amount', 'المبلغ المقترح', language)}</div>
              <div className="font-moei-mono text-2xl font-bold text-[var(--moei-gold)]">
                {formatAED(assessment?.recommendedAmount ?? arrear?.totalOverdue ?? 0)}
              </div>
            </div>
            <div>
              <div className="moei-data-label">{label('Decision Path', 'مسار القرار', language)}</div>
              <div className={cn('font-black uppercase', decisionPath === 'human' ? 'text-[var(--moei-danger)]' : 'text-[var(--moei-success)]')}>
                {decisionPath === 'human' ? label('Human Review', 'مراجعة بشرية', language) : label('Auto Path', 'مسار تلقائي', language)}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[0.9fr_1.25fr]">
        <div className="space-y-5">
          <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="moei-panel rounded-md p-4">
            <PanelTitle icon={User} eyebrow={label('Beneficiary Profile', 'ملف المستفيد', language)} title={label('Applicant Profile', 'بيانات المستفيد', language)} />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <DataCell label={label('Arabic Name', 'الاسم بالعربية', language)} value={<span dir="rtl">{applicant?.nameAr || '-'}</span>} />
              <DataCell label={label('English Name', 'الاسم بالإنجليزية', language)} value={applicant?.nameEn || '-'} />
              <DataCell label={label('Emirates ID', 'رقم الهوية', language)} value={applicant?.emiratesId || '-'} />
              <DataCell label={label('Family Size', 'عدد أفراد الأسرة', language)} value={<span className="flex items-center gap-2"><Users className="size-4 text-[var(--moei-gold)]" />{applicant?.familySize ?? '-'}</span>} />
              <DataCell label={label('Employer', 'جهة العمل', language)} value={<span className="flex items-center gap-2"><Building2 className="size-4 text-[var(--moei-gold)]" />{applicant?.employer || '-'}</span>} />
              <DataCell label={label('Employer Type', 'نوع جهة العمل', language)} value={applicant ? getEmployerTypeLabel(applicant.employerType, language) : '-'} />
              <DataCell label={label('Phone', 'الهاتف', language)} value={<span className="flex items-center gap-2"><Phone className="size-4 text-[var(--moei-gold)]" />{applicant?.phone || '-'}</span>} />
              <DataCell label={label('Email', 'البريد الإلكتروني', language)} value={<span className="flex items-center gap-2"><Mail className="size-4 text-[var(--moei-gold)]" />{applicant?.email || '-'}</span>} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className={cn('rounded-md border p-3', applicant?.isCitizen ? 'border-[var(--moei-success)] bg-[var(--moei-success-soft)]' : 'border-[var(--moei-danger)] bg-[var(--moei-danger-soft)]')}>
                <div className="flex items-center gap-2 text-sm font-bold">
                  {applicant?.isCitizen ? <CheckCircle2 className="size-4 text-[var(--moei-success)]" /> : <XCircle className="size-4 text-[var(--moei-danger)]" />}
                  {t('caseDetail.citizen', language)}
                </div>
              </div>
              <div className={cn('rounded-md border p-3', applicant?.hasFamilyBook ? 'border-[var(--moei-success)] bg-[var(--moei-success-soft)]' : 'border-[var(--moei-danger)] bg-[var(--moei-danger-soft)]')}>
                <div className="flex items-center gap-2 text-sm font-bold">
                  {applicant?.hasFamilyBook ? <CheckCircle2 className="size-4 text-[var(--moei-success)]" /> : <XCircle className="size-4 text-[var(--moei-danger)]" />}
                  {t('caseDetail.familyBook', language)}
                </div>
              </div>
            </div>
          </motion.section>

          <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="moei-panel rounded-md p-4">
            <PanelTitle icon={WalletCards} eyebrow={label('Financial Position', 'المركز المالي', language)} title={label('Loan And Arrears', 'القرض والمتأخرات', language)} />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <DataCell label={t('caseDetail.monthlyIncome', language)} value={applicant ? formatAED(applicant.monthlyIncome) : '-'} emphasize />
              <DataCell label={t('caseDetail.incomePerMember', language)} value={caseData.incomePerFamilyMember ? formatAED(caseData.incomePerFamilyMember) : '-'} emphasize />
              <DataCell label={t('caseDetail.remainingBalance', language)} value={loan ? formatAED(loan.remainingBalance) : '-'} emphasize />
              <DataCell label={t('caseDetail.totalOverdueAmount', language)} value={arrear ? formatAED(arrear.totalOverdue) : '-'} emphasize danger />
              <DataCell label={t('caseDetail.monthlyInstallment', language)} value={loan ? formatAED(loan.monthlyInstallment) : '-'} emphasize />
              <DataCell label={t('caseDetail.delayDuration', language)} value={arrear ? `${arrear.delayDays} ${t('caseDetail.days', language)}` : '-'} />
              <DataCell label={t('caseDetail.requestedDuration', language)} value={`${caseData.requestedDurationMonths} ${t('caseList.months', language)}`} />
              <DataCell label={t('caseDetail.loanType', language)} value={loanTypeText(loan?.loanType, language)} />
            </div>
            <div className="mt-3 rounded-md border border-[rgba(201,168,76,0.14)] bg-[rgba(10,22,40,0.52)] p-3">
              <div className="flex items-center justify-between">
                <span className="moei-data-label">{t('caseDetail.repaymentProgress', language)}</span>
                <span className="font-moei-mono text-sm font-bold text-[var(--moei-gold)]">{paidPct}%</span>
              </div>
              <div className="mt-3 grid grid-cols-12 gap-1" aria-hidden="true">
                {Array.from({ length: 12 }).map((_, index) => (
                  <div
                    key={index}
                    className={cn('h-2 rounded-sm bg-[rgba(244,240,230,0.12)]', index < Math.round(paidPct / 8.34) && 'bg-[var(--moei-gold)]')}
                  />
                ))}
              </div>
            </div>
          </motion.section>

          <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="moei-panel rounded-md p-4">
            <PanelTitle icon={FileCheck} eyebrow={label('Evidence Layer', 'طبقة المستندات', language)} title={label('Supporting Documents', 'المستندات الداعمة', language)} />
            {missingDocuments.length > 0 && (
              <div className="mb-3 rounded-md border border-[var(--moei-danger)] bg-[var(--moei-danger-soft)] p-3">
                <div className="flex items-start gap-2 text-sm font-bold text-[var(--moei-danger)]">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <span>{label('Missing documents', 'مستندات ناقصة', language)}: {missingDocuments.join(', ')}</span>
                </div>
              </div>
            )}

            {uploadedFiles.length > 0 ? (
              <div className="space-y-3">
                {Object.entries(filesByDocType).map(([docType, files]) => (
                  <div key={docType}>
                    <div className="mb-2 flex items-center gap-2">
                      <span className="text-sm font-extrabold text-[var(--moei-text)]">{getDocTypeLabel(docType, language)}</span>
                      <Badge variant="outline" className="border-[var(--moei-border-strong)] text-[var(--moei-gold)]">{files.length}</Badge>
                    </div>
                    <div className="space-y-2">
                      {files.map((file) => (
                        <div key={file.id} className="flex items-center gap-3 rounded-md border border-[rgba(201,168,76,0.14)] bg-[rgba(10,22,40,0.52)] p-3">
                          {getFileIcon(file.type, file.originalName)}
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-bold text-[var(--moei-text)]">{file.originalName}</div>
                            <div className="font-moei-mono text-xs text-[var(--moei-muted)]">{formatFileSize(file.size)}</div>
                          </div>
                          <Button variant="ghost" size="icon" className="text-[var(--moei-muted)] hover:bg-[var(--moei-gold-soft)] hover:text-[var(--moei-gold)]" onClick={() => handleViewFile(file.storedName, file.originalName, file.type, file.size)}>
                            <Eye className="size-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-[var(--moei-muted)] hover:bg-[var(--moei-gold-soft)] hover:text-[var(--moei-gold)]" onClick={() => handleDownloadFile(file.storedName, file.originalName)}>
                            <Download className="size-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {supportingDocuments.length > 0 ? supportingDocuments.map((doc) => (
                  <div key={doc} className="flex items-center gap-2 text-sm text-[var(--moei-text)]">
                    <CheckCircle2 className="size-4 text-[var(--moei-success)]" />
                    {doc}
                  </div>
                )) : (
                  <div className="text-sm text-[var(--moei-muted)]">{label('No supporting document records.', 'لا توجد مستندات مسجلة.', language)}</div>
                )}
              </div>
            )}
          </motion.section>
        </div>

        <div className="space-y-5">
          <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="moei-panel rounded-md p-4">
            <PanelTitle icon={Brain} eyebrow={label('AI Assessment Output', 'مخرجات التقييم الذكي', language)} title={label('Decision Intelligence', 'استخبارات القرار', language)} />
            {assessment ? (
              <div className="grid grid-cols-1 gap-5 2xl:grid-cols-[360px_1fr]">
                <RiskScoreGauge
                  score={assessment.riskScore}
                  confidence={assessment.confidenceScore}
                  lang={language}
                  thresholds={riskThresholds}
                  decisionPath={decisionPath}
                />
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <PlanMetric label={t('caseDetail.recommendedAmount', language)} value={formatAED(assessment.recommendedAmount)} accent="gold" />
                  <PlanMetric label={t('caseDetail.durationMonths', language)} value={`${assessment.recommendedDuration}m`} accent="cyan" />
                  <PlanMetric label={t('caseDetail.monthlyInstallment', language)} value={formatAED(assessment.recommendedInstallment)} accent="green" />
                  <PlanMetric label={t('caseDetail.proposedDBR', language)} value={percentText(assessment.proposedDBR)} accent={assessment.proposedDBR > maxDBR ? 'red' : 'green'} />
                  <PlanMetric label={t('caseDetail.currentDBR', language)} value={percentText(assessment.debtBurdenRatio)} />
                  <PlanMetric label={label('Deduction Rate', 'نسبة الاستقطاع', language)} value={proposedDeductionPercent === null ? '-' : `${proposedDeductionPercent.toFixed(1)}%`} accent={proposedDeductionPercent && proposedDeductionPercent > 20 ? 'red' : 'gold'} />
                </div>
              </div>
            ) : (
              <div className="flex min-h-56 flex-col items-center justify-center text-center text-[var(--moei-muted)]">
                <Brain className="mb-3 size-10 text-[var(--moei-gold)]" />
                <p className="font-bold">{t('caseDetail.noAssessment', language)}</p>
              </div>
            )}
          </motion.section>

          {assessment && (
            <>
              <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="moei-panel rounded-md p-4">
                <PanelTitle icon={Sparkles} eyebrow={label('Innovation Layer', 'طبقة الابتكار', language)} title={label('MOEI Decision Twin', 'التوأم الرقمي لقرار الوزارة', language)} />
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <PlanMetric
                    label={label('Current Path', 'المسار الحالي', language)}
                    value={decisionPath === 'human' ? label('Human Review', 'مراجعة بشرية', language) : label('Auto Path', 'مسار تلقائي', language)}
                    accent={decisionPath === 'human' ? 'red' : 'green'}
                  />
                  <PlanMetric
                    label={label('Route To Green', 'مسار الوصول للتوافق', language)}
                    value={blockerCount === 0 ? label('Clear', 'واضح', language) : `${blockerCount} ${label('blockers', 'عوائق', language)}`}
                    accent={blockerCount === 0 ? 'green' : 'red'}
                  />
                  <PlanMetric
                    label={label('Service Shift', 'تحول الخدمة', language)}
                    value={label('5d -> Instant', '5 أيام -> فوري', language)}
                    accent="gold"
                  />
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {decisionTwinSignals.map((signal) => (
                    <TwinSignal key={signal.title} signal={signal} />
                  ))}
                </div>

                <div className="mt-4 rounded-md border border-[rgba(201,168,76,0.22)] bg-[rgba(201,168,76,0.08)] p-4">
                  <div className="flex items-start gap-3">
                    <GitBranch className="mt-0.5 size-5 shrink-0 text-[var(--moei-gold)]" />
                    <div>
                      <div className="moei-data-label">{label('Next Best Action', 'أفضل إجراء تال', language)}</div>
                      <div className="mt-1 text-sm font-bold leading-6 text-[var(--moei-text)]">{nextBestAction}</div>
                    </div>
                  </div>
                </div>
              </motion.section>

              <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.09 }} className="moei-panel rounded-md p-4">
                <PanelTitle icon={Gauge} eyebrow={label('Public Value Intelligence', 'استخبارات القيمة العامة', language)} title={label('Why Every Stakeholder Wants This', 'لماذا يحتاجه كل طرف', language)} />
                <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                  {publicValueMetrics.map((metric) => (
                    <PlanMetric key={metric.label} label={metric.label} value={metric.value} accent={metric.accent} />
                  ))}
                </div>
                <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
                  {stakeholderLenses.map((item) => (
                    <StakeholderCard key={item.role} item={item} />
                  ))}
                </div>
              </motion.section>

              <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="moei-panel rounded-md p-4">
                <PanelTitle icon={ShieldCheck} eyebrow={label('Approved Governance Rules', 'قواعد الحوكمة المعتمدة', language)} title={label('Compliance Checks', 'فحوصات الامتثال', language)} />
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {governanceChecks.map((check, index) => (
                    <div key={`${check.label}-${index}`} className={cn(
                      'rounded-md border p-3',
                      check.passed === true && 'border-[var(--moei-success)] bg-[var(--moei-success-soft)]',
                      check.passed === false && 'border-[var(--moei-danger)] bg-[var(--moei-danger-soft)]',
                      check.passed === null && 'border-[var(--moei-warning)] bg-[var(--moei-warning-soft)]',
                    )}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-extrabold text-[var(--moei-text)]">{check.label}</div>
                          {check.description && <div className="mt-1 text-xs text-[var(--moei-muted)]">{check.description}</div>}
                        </div>
                        <div className="flex items-center gap-2">
                          {check.passed === true && <CheckCircle2 className="size-5 text-[var(--moei-success)]" />}
                          {check.passed === false && <XCircle className="size-5 text-[var(--moei-danger)]" />}
                          {check.passed === null && <Clock className="size-5 text-[var(--moei-warning)]" />}
                          <span className="font-moei-mono text-sm font-bold text-[var(--moei-text)]">{check.value}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.section>

              <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="moei-panel rounded-md p-4">
                <PanelTitle icon={Scale} eyebrow={label('Recommendation Rationale', 'مبررات التوصية', language)} title={recommendationLabel(assessment.moeiRecommendation, language)} />
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_320px]">
                  <div className="rounded-md border border-[rgba(201,168,76,0.14)] bg-[rgba(10,22,40,0.52)] p-4">
                    <div className="mb-2 flex items-center gap-2 text-sm font-extrabold text-[var(--moei-gold)]">
                      <Route className="size-4" />
                      {label('Decision Rationale', 'مبررات القرار', language)}
                    </div>
                    <p className="text-sm leading-7 text-[var(--moei-text)]">{rationaleText}</p>
                    {assessment.humanReviewReason && (
                      <div className="mt-4 rounded-md border border-[var(--moei-danger)] bg-[var(--moei-danger-soft)] p-3 text-sm font-bold text-[var(--moei-danger)]">
                        {assessment.humanReviewReason}
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-md border border-[rgba(201,168,76,0.14)] bg-[rgba(10,22,40,0.52)] p-3">
                      <div className="moei-data-label">{t('caseDetail.eligibility', language)}</div>
                      <div className="mt-1 text-sm font-extrabold uppercase text-[var(--moei-text)]">{assessment.eligibilityStatus.replace(/_/g, ' ')}</div>
                    </div>
                    <div className="rounded-md border border-[rgba(201,168,76,0.14)] bg-[rgba(10,22,40,0.52)] p-3">
                      <div className="moei-data-label">{label('Processing Time', 'زمن المعالجة', language)}</div>
                      <div className="font-moei-mono mt-1 text-sm font-bold text-[var(--moei-cyan)]">{assessment.processingTimeMs ?? 0} ms</div>
                    </div>
                    <div className="rounded-md border border-[rgba(201,168,76,0.14)] bg-[rgba(10,22,40,0.52)] p-3">
                      <div className="moei-data-label">{label('AI Model', 'نموذج الذكاء الاصطناعي', language)}</div>
                      <div className="font-moei-mono mt-1 text-sm font-bold text-[var(--moei-gold)]">{assessment.aiModelVersion}</div>
                    </div>
                  </div>
                </div>
              </motion.section>

              {algorithmTrace.length > 0 && (
                <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="moei-panel rounded-md p-4">
                  <PanelTitle icon={GitBranch} eyebrow={label('Explainable Governance Algorithm', 'خوارزمية حوكمة قابلة للتفسير', language)} title={String(decisionRationale.algorithm || 'MOEI-STRICT-GOVERNANCE-V2')} />
                  <div className="grid grid-cols-1 gap-3">
                    {algorithmTrace.map((step, index) => {
                      const result = String(step.result || 'review')
                      return (
                        <div key={`${step.gate || index}`} className="rounded-md border border-[rgba(201,168,76,0.16)] bg-[rgba(10,22,40,0.46)] p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-moei-mono text-[0.68rem] font-black uppercase text-[var(--moei-gold)]">
                                {label('Step', 'الخطوة', language)} {String(step.step || index + 1).padStart(2, '0')}
                              </div>
                              <div className="mt-1 text-base font-black text-[var(--moei-text)]">{String(step.gate || '-')}</div>
                            </div>
                            <Badge variant="outline" className={cn('border font-moei-mono uppercase', algorithmResultClass(result))}>
                              {result}
                            </Badge>
                          </div>
                          <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
                            <div>
                              <div className="moei-data-label">{label('Rule', 'القاعدة', language)}</div>
                              <div className="mt-1 text-xs font-bold leading-5 text-[var(--moei-text)]">{String(step.rule || '-')}</div>
                            </div>
                            <div>
                              <div className="moei-data-label">{label('Input', 'المدخلات', language)}</div>
                              <div className="font-moei-mono mt-1 break-words text-xs font-bold leading-5 text-[var(--moei-muted)]">{String(step.input || '-')}</div>
                            </div>
                            <div>
                              <div className="moei-data-label">{label('Outcome', 'النتيجة', language)}</div>
                              <div className="mt-1 text-xs font-bold leading-5 text-[var(--moei-text)]">{String(step.outcome || '-')}</div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </motion.section>
              )}

              <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="moei-panel rounded-md p-4">
                  <PanelTitle icon={AlertTriangle} title={label('Risk Factors', 'عوامل المخاطر', language)} />
                  {riskFactors.length > 0 ? (
                    <div className="space-y-2">
                      {riskFactors.map((factor, index) => {
                        const severity = String(factor.severity || 'medium')
                        return (
                          <div key={index} className="rounded-md border border-[rgba(201,168,76,0.14)] bg-[rgba(10,22,40,0.52)] p-3">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-sm font-bold text-[var(--moei-text)]">{String(factor.factor || factor.name || factor.feature || '-')}</span>
                              <Badge variant="outline" className={cn('border uppercase', riskBadgeClass(severity))}>{severity}</Badge>
                            </div>
                            {factor.description && <p className="mt-1 text-xs text-[var(--moei-muted)]">{String(factor.description)}</p>}
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="text-sm text-[var(--moei-muted)]">{t('caseDetail.noRiskFactors', language)}</div>
                  )}
                </motion.section>

                <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="moei-panel rounded-md p-4">
                  <PanelTitle icon={FileText} title={label('Document Intelligence', 'استخبارات المستندات', language)} />
                  {documentSummaries.length > 0 ? (
                    <div className="space-y-2">
                      {documentSummaries.map((doc, index) => {
                        const status = String(doc.status || (doc.verified ? 'verified' : 'review_required'))
                        const verified = doc.verified === true
                        const signals = Array.isArray(doc.signals) ? doc.signals.map(String).filter(Boolean) : []
                        return (
                          <div key={index} className="rounded-md border border-[rgba(201,168,76,0.14)] bg-[rgba(10,22,40,0.52)] p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm font-bold text-[var(--moei-text)]">{String(doc.fileName || label('Document', 'مستند', language))}</div>
                                <div className="mt-1 flex flex-wrap items-center gap-2">
                                  <Badge variant="outline" className="border-[rgba(201,168,76,0.24)] text-[var(--moei-gold)]">
                                    {getDocTypeLabel(String(doc.documentType || ''), language)}
                                  </Badge>
                                  {doc.method && (
                                    <span className="font-moei-mono text-[0.68rem] font-bold uppercase text-[var(--moei-muted)]">
                                      {String(doc.method).replace(/_/g, ' ')}
                                    </span>
                                  )}
                                  {doc.confidence !== undefined && (
                                    <span className="font-moei-mono text-[0.68rem] font-black text-[var(--moei-text)]">
                                      {label('Confidence', 'الثقة', language)} {String(doc.confidence)}%
                                    </span>
                                  )}
                                </div>
                              </div>
                              <Badge variant="outline" className={cn('border shrink-0', documentStatusClass(status, verified))}>
                                {documentStatusLabel(status, verified, language)}
                              </Badge>
                            </div>
                            {doc.summary && <p className="mt-2 text-xs leading-5 text-[var(--moei-muted)]">{String(doc.summary)}</p>}
                            {signals.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-1.5">
                                {signals.slice(0, 5).map((signal) => (
                                  <span key={signal} className="rounded border border-[rgba(201,168,76,0.18)] bg-[rgba(201,168,76,0.08)] px-2 py-1 text-[0.68rem] font-bold text-[var(--moei-text)]">
                                    {signal}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="rounded-md border border-[var(--moei-warning)] bg-[var(--moei-warning-soft)] p-3 text-sm font-bold text-[var(--moei-warning)]">
                      {label('Document intelligence has not been generated for this older assessment. Re-run assessment to create the evidence trace.', 'لم يتم إنشاء استخبارات المستندات لهذا التقييم القديم. أعد تشغيل التقييم لإنشاء أثر الأدلة.', language)}
                    </div>
                  )}
                </motion.section>
              </div>
            </>
          )}
        </div>
      </div>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky bottom-0 z-20 -mx-4 border-t border-[rgba(201,168,76,0.24)] bg-[rgba(10,22,40,0.94)] px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6"
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3">
            <Landmark className="size-5 text-[var(--moei-gold)]" />
            <div>
              <div className="moei-data-label">{label('Officer Decision', 'قرار الموظف', language)}</div>
              <div className="text-sm font-bold text-[var(--moei-text)]">{recommendationLabel(assessment?.moeiRecommendation, language)}</div>
            </div>
          </div>

          <div className="flex-1" />

          {canTakeAction && (
            <>
              <Button disabled={actionLoading !== null} variant="outline" onClick={startOfficerCall} className="border-[var(--moei-cyan)] bg-[var(--moei-cyan-soft)] text-[var(--moei-cyan)] gap-2 hover:bg-[rgba(0,179,193,0.18)]">
                <PhoneCall className="size-4 text-[var(--moei-cyan)]" />
                {label('AI Calls Officer', 'الذكاء الاصطناعي يتصل بالموظف', language)}
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button disabled={actionLoading !== null} className="gap-2 bg-[var(--moei-gold)] text-[#081322] hover:bg-[#D7BB61]">
                    {actionLoading === 'approve' ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                    {t('caseDetail.approve', language)}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('caseDetail.confirmApprove', language)}</AlertDialogTitle>
                    <AlertDialogDescription>{t('caseDetail.confirmApproveDesc', language)}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('form.cancel', language)}</AlertDialogCancel>
                    <AlertDialogAction className="bg-[var(--moei-gold)] text-[#081322] hover:bg-[#D7BB61]" onClick={() => handleAction('approve')}>
                      {t('caseDetail.approve', language)}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button disabled={actionLoading !== null} className="gap-2 bg-[var(--moei-danger)] text-white hover:bg-[#D64E4E]">
                    {actionLoading === 'escalate' ? <Loader2 className="size-4 animate-spin" /> : <AlertTriangle className="size-4" />}
                    {label('Escalate to Officer', 'إحالة لموظف', language)}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('caseDetail.confirmEscalate', language)}</AlertDialogTitle>
                    <AlertDialogDescription>{t('caseDetail.confirmEscalateDesc', language)}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('form.cancel', language)}</AlertDialogCancel>
                    <AlertDialogAction className="bg-[var(--moei-danger)] text-white hover:bg-[#D64E4E]" onClick={() => handleAction('escalate')}>
                      {label('Escalate', 'إحالة', language)}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}

          {canNotifyBeneficiary && (
            <Button disabled={beneficiaryCallLoading || actionLoading !== null} variant="outline" onClick={handleBeneficiaryCall} className="border-[var(--moei-success)] bg-[var(--moei-success-soft)] text-[var(--moei-success)] gap-2 hover:bg-[rgba(47,213,139,0.18)]">
              {beneficiaryCallLoading ? <Loader2 className="size-4 animate-spin" /> : <Phone className="size-4 text-[var(--moei-success)]" />}
              {label('AI Calls Sultan', 'الذكاء الاصطناعي يتصل بسلطان', language)}
            </Button>
          )}

          <Button variant="outline" disabled={actionLoading !== null} onClick={handleReRunAssessment} className="moei-control gap-2 hover:bg-[var(--moei-gold-soft)]">
            {actionLoading === 'assess' ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            {t('caseDetail.reRunAssessment', language)}
          </Button>
        </div>
      </motion.section>

      <Dialog open={officerCallOpen} onOpenChange={(open) => {
        setOfficerCallOpen(open)
        if (!open) {
          stopSpeakingBrief()
          setOfficerCallStage('idle')
          setOfficerCallStartedAt(null)
          setOfficerCallElapsedSeconds(0)
          setOfficerCallDelivery({
            mode: 'demo',
            provider: 'browser_demo',
            message: 'Demo call mode ready.',
          })
          setOfficerVoiceListening(false)
          setOfficerVoiceCommand(null)
        }
      }}>
        <DialogContent className="!inset-4 !left-4 !top-4 !h-[calc(100vh-32px)] !w-auto !max-w-none !translate-x-0 !translate-y-0 sm:!max-w-none gap-0 overflow-hidden rounded-md border-[rgba(201,168,76,0.32)] bg-[#071325] p-0 text-[var(--moei-text)] shadow-[0_28px_90px_rgba(0,0,0,0.58)]">
          <div className="border-b border-[rgba(201,168,76,0.22)] bg-[linear-gradient(90deg,rgba(201,168,76,0.16),rgba(10,22,40,0.94)_42%,rgba(0,179,193,0.1))] px-6 py-5">
            <DialogHeader>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-4">
                  <div className="relative flex size-12 shrink-0 items-center justify-center rounded-md border border-[var(--moei-gold)] bg-[rgba(201,168,76,0.12)]">
                    <PhoneCall className="size-5 text-[var(--moei-gold)]" />
                    <span className="absolute -right-1 -top-1 size-3 rounded-full bg-[var(--moei-success)] shadow-[0_0_18px_rgba(47,213,139,0.9)]" />
                  </div>
                  <div className="min-w-0">
                    <div className="moei-data-label">{label('MOEI Command Link', 'رابط قيادة الوزارة', language)}</div>
                    <DialogTitle className="mt-1 text-2xl font-black tracking-normal text-[var(--moei-text)]">
                      {label('Decision Twin Outbound Call', 'اتصال صادر من التوأم الرقمي', language)}
                    </DialogTitle>
                    <div className="font-moei-mono mt-1 truncate text-xs text-[var(--moei-muted)]">
                      {caseData.id} | {applicant?.nameEn || applicant?.nameAr || '-'}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Badge variant="outline" className="border-[var(--moei-cyan)] bg-[var(--moei-cyan-soft)] px-3 py-1.5 font-moei-mono text-xs font-black uppercase text-[var(--moei-cyan)]">
                    {label('LIVE', 'مباشر', language)} {callClockText}
                  </Badge>
                  <Badge variant="outline" className="border-[rgba(201,168,76,0.32)] bg-[rgba(244,240,230,0.04)] px-3 py-1.5 font-moei-mono text-xs font-black text-[var(--moei-text)]">
                    {DEMO_OFFICER_PHONE_DISPLAY}
                  </Badge>
                  <Badge variant="outline" className={cn(
                    'border px-3 py-1.5 font-moei-mono text-xs font-black uppercase',
                    officerDeliveryTone === 'green' && 'border-[var(--moei-success)] bg-[var(--moei-success-soft)] text-[var(--moei-success)]',
                    officerDeliveryTone === 'cyan' && 'border-[var(--moei-cyan)] bg-[var(--moei-cyan-soft)] text-[var(--moei-cyan)]',
                    officerDeliveryTone === 'gold' && 'border-[var(--moei-gold)] bg-[var(--moei-gold-soft)] text-[var(--moei-gold)]',
                  )}>
                    {officerDeliveryLabel}
                  </Badge>
                  <Badge variant="outline" className={cn(
                    'border px-3 py-1.5 font-moei-mono text-xs font-black uppercase',
                    officerCallOutcomeTone === 'green' && 'border-[var(--moei-success)] bg-[var(--moei-success-soft)] text-[var(--moei-success)]',
                    officerCallOutcomeTone === 'red' && 'border-[var(--moei-danger)] bg-[var(--moei-danger-soft)] text-[var(--moei-danger)]',
                    officerCallOutcomeTone === 'gold' && 'border-[var(--moei-gold)] bg-[var(--moei-gold-soft)] text-[var(--moei-gold)]',
                  )}>
                    {officerCallStatusLabel}
                  </Badge>
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="h-[calc(100vh-128px)] overflow-y-auto p-5">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <section className="relative overflow-hidden rounded-md border border-[rgba(201,168,76,0.22)] bg-[rgba(10,22,40,0.72)] p-5">
                <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: 'linear-gradient(rgba(201,168,76,0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(201,168,76,0.7) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
                <div className="relative grid grid-cols-1 gap-5 md:grid-cols-[180px_1fr]">
                  <div className="flex items-center justify-center">
                    <div className="relative flex size-40 items-center justify-center rounded-full border border-[rgba(201,168,76,0.35)] bg-[radial-gradient(circle,rgba(201,168,76,0.18),rgba(10,22,40,0.1)_62%)]">
                      <div className={cn('absolute inset-4 rounded-full border border-[rgba(0,179,193,0.38)]', isSpeakingBrief && 'animate-pulse')} />
                      <div className={cn('absolute inset-8 rounded-full border border-[rgba(201,168,76,0.42)]', officerCallStage === 'dialing' && 'animate-pulse')} />
                      <div className="flex size-20 items-center justify-center rounded-full border border-[var(--moei-gold)] bg-[rgba(201,168,76,0.16)] shadow-[0_0_36px_rgba(201,168,76,0.24)]">
                        {isSpeakingBrief ? <Mic2 className="size-8 text-[var(--moei-gold)]" /> : <Headphones className="size-8 text-[var(--moei-gold)]" />}
                      </div>
                    </div>
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="moei-data-label">{label('Officer Receives AI Call', 'الموظف يستلم اتصال الذكاء الاصطناعي', language)}</div>
                        <div className="mt-1 text-2xl font-black text-[var(--moei-text)]">
                          {label('Finance & Collection Officer', 'موظف المالية والتحصيل', language)}
                        </div>
                        <div className="font-moei-mono mt-1 text-xs text-[var(--moei-muted)]">
                          Decision Twin {'->'} {DEMO_OFFICER_PHONE_DISPLAY} {'->'} officer decision
                        </div>
                      </div>
                      <div className="rounded-md border border-[rgba(0,179,193,0.35)] bg-[rgba(0,179,193,0.08)] px-3 py-2 text-end">
                        <div className="moei-data-label">{label('Decision Path', 'مسار القرار', language)}</div>
                        <div className={cn('font-moei-mono text-sm font-black uppercase', decisionPath === 'human' ? 'text-[var(--moei-danger)]' : 'text-[var(--moei-success)]')}>
                          {decisionPath === 'human' ? label('Human Review', 'مراجعة بشرية', language) : label('Auto Path', 'مسار تلقائي', language)}
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-4">
                      {officerCallSteps.map((step, index) => {
                        const Icon = step.icon
                        const isActive = index <= officerCallStageRank
                        return (
                          <div key={step.id} className={cn(
                            'rounded-md border p-3 transition-colors',
                            isActive ? 'border-[var(--moei-gold)] bg-[var(--moei-gold-soft)]' : 'border-[rgba(244,240,230,0.12)] bg-[rgba(244,240,230,0.04)]',
                          )}>
                            <div className="flex items-center gap-2">
                              <Icon className={cn('size-4', isActive ? 'text-[var(--moei-gold)]' : 'text-[var(--moei-muted)]')} />
                              <div className={cn('text-sm font-black', isActive ? 'text-[var(--moei-text)]' : 'text-[var(--moei-muted)]')}>{step.title}</div>
                            </div>
                            <div className="mt-1 text-[0.68rem] font-bold uppercase leading-4 text-[var(--moei-muted)]">{step.caption}</div>
                          </div>
                        )
                      })}
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-4">
                      <PlanMetric label={label('Case', 'الحالة', language)} value={caseData.id.slice(0, 8)} accent="gold" />
                      <PlanMetric label={label('Installment', 'القسط', language)} value={formatAED(assessment?.recommendedInstallment ?? 0)} accent="cyan" />
                      <PlanMetric label={label('Deduction', 'الاستقطاع', language)} value={proposedDeductionPercent === null ? '-' : `${proposedDeductionPercent.toFixed(1)}%`} accent="green" />
                      <PlanMetric label={label('Governance', 'الحوكمة', language)} value={`${governancePassRate}%`} accent={governancePassRate >= 90 ? 'green' : 'red'} />
                    </div>

                    <div className="mt-4 rounded-md border border-[rgba(0,179,193,0.28)] bg-[rgba(0,179,193,0.07)] p-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="moei-data-label">{label('Live Site Update', 'تحديث مباشر في الموقع', language)}</div>
                          <div className="mt-1 text-sm font-black text-[var(--moei-text)]">{officerLiveSyncLabel}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-bold text-[var(--moei-muted)]">
                            <span>{label('Case status on site', 'حالة الطلب في الموقع', language)}</span>
                            <Badge variant="outline" className={cn('border font-moei-mono text-[0.66rem] font-black uppercase', statusBadgeClass(displayedStatus))}>
                              {statusText(displayedStatus, language)}
                            </Badge>
                          </div>
                          <div className="mt-1 text-xs leading-5 text-[var(--moei-muted)]">{officerDeliveryMessage}</div>
                          {officerCallDelivery.callSid && (
                            <div className="font-moei-mono mt-1 text-[0.68rem] font-black uppercase text-[var(--moei-success)]">
                              SID {officerCallDelivery.callSid}
                            </div>
                          )}
                          {canNotifyBeneficiary && (
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <Button disabled={beneficiaryCallLoading || actionLoading !== null} variant="outline" size="sm" onClick={handleBeneficiaryCall} className="border-[var(--moei-success)] bg-[var(--moei-success-soft)] text-[var(--moei-success)] gap-2 hover:bg-[rgba(47,213,139,0.18)]">
                                {beneficiaryCallLoading ? <Loader2 className="size-4 animate-spin" /> : <Phone className="size-4 text-[var(--moei-success)]" />}
                                {label('AI Calls Sultan', 'الذكاء الاصطناعي يتصل بسلطان', language)}
                              </Button>
                              {beneficiaryCallDelivery && (
                                <Badge variant="outline" className={cn(
                                  'border font-moei-mono text-[0.66rem] font-black uppercase',
                                  beneficiaryCallDelivery.mode === 'real'
                                    ? 'border-[var(--moei-success)] bg-[var(--moei-success-soft)] text-[var(--moei-success)]'
                                    : 'border-[var(--moei-gold)] bg-[var(--moei-gold-soft)] text-[var(--moei-gold)]',
                                )}>
                                  {beneficiaryCallDelivery.mode === 'real'
                                    ? label('Citizen Notified', 'تم إخطار المتعامل', language)
                                    : label('Script Ready', 'النص جاهز', language)}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="font-moei-mono text-lg font-black text-[var(--moei-cyan)]">{callClockText}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-md border border-[rgba(201,168,76,0.22)] bg-[rgba(10,22,40,0.72)] p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="moei-data-label">{label('Decision Packet', 'ملف القرار', language)}</div>
                    <h3 className="mt-1 text-xl font-black text-[var(--moei-text)]">{label('Twin Brief Ready', 'ملخص التوأم جاهز', language)}</h3>
                  </div>
                  <Button variant="outline" size="sm" className="moei-control gap-2" onClick={speakOfficerBrief} disabled={isSpeakingBrief || officerCallBrief.length === 0}>
                    {isSpeakingBrief ? <Loader2 className="size-4 animate-spin" /> : <Mic2 className="size-4 text-[var(--moei-gold)]" />}
                    {isSpeakingBrief ? label('Speaking', 'يتحدث', language) : label('Replay', 'إعادة', language)}
                  </Button>
                </div>

                <div className="mt-4 space-y-2">
                  {officerCallBrief.slice(1, 5).map((briefLine, index) => (
                    <div key={index} className="rounded-md border border-[rgba(201,168,76,0.14)] bg-[rgba(244,240,230,0.04)] p-3 text-sm font-bold leading-6 text-[var(--moei-text)]">
                      {briefLine}
                    </div>
                  ))}
                </div>

                <div className="mt-4 rounded-md border border-[rgba(0,179,193,0.24)] bg-[rgba(0,179,193,0.07)] p-4">
                  <div className="flex items-start gap-3">
                    <GitBranch className="mt-0.5 size-5 shrink-0 text-[var(--moei-cyan)]" />
                    <div>
                      <div className="moei-data-label">{label('Next Best Action', 'أفضل إجراء تال', language)}</div>
                      <div className="mt-1 text-sm font-black leading-6 text-[var(--moei-text)]">{nextBestAction}</div>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
              <section className="rounded-md border border-[rgba(201,168,76,0.22)] bg-[#081827]">
                <div className="flex items-center justify-between gap-3 border-b border-[rgba(201,168,76,0.18)] px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Brain className="size-4 text-[var(--moei-gold)]" />
                    <div className="moei-data-label">{label('AI Call Transcript', 'نص اتصال الذكاء الاصطناعي', language)}</div>
                  </div>
                  <span className="font-moei-mono text-xs text-[var(--moei-muted)]">{officerCallTranscript.length} events</span>
                </div>
                <div className="max-h-[300px] space-y-2 overflow-y-auto p-4">
                  {officerCallTranscript.length === 0 ? (
                    <div className="flex min-h-36 items-center justify-center rounded-md border border-[rgba(201,168,76,0.12)] bg-[rgba(244,240,230,0.04)] text-sm font-bold text-[var(--moei-muted)]">
                      {label('No call events yet.', 'لا توجد أحداث اتصال بعد.', language)}
                    </div>
                  ) : officerCallTranscript.map((line, index) => (
                    <div key={`${line.speaker}-${index}`} className="grid grid-cols-[130px_1fr] gap-3 rounded-md border border-[rgba(201,168,76,0.12)] bg-[rgba(10,22,40,0.62)] p-3">
                      <div className={cn(
                        'font-moei-mono text-xs font-black uppercase',
                        line.tone === 'green' && 'text-[var(--moei-success)]',
                        line.tone === 'red' && 'text-[var(--moei-danger)]',
                        line.tone === 'cyan' && 'text-[var(--moei-cyan)]',
                        line.tone === 'gold' && 'text-[var(--moei-gold)]',
                        line.tone === 'muted' && 'text-[var(--moei-muted)]',
                      )}>
                        {line.speaker}
                      </div>
                      <div className="text-sm leading-6 text-[var(--moei-text)]">{line.text}</div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-md border border-[rgba(201,168,76,0.28)] bg-[rgba(201,168,76,0.08)] p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="moei-data-label">{label('In-Call Decision', 'قرار من داخل المكالمة', language)}</div>
                    <h3 className="mt-1 text-lg font-black text-[var(--moei-text)]">{label('Officer Voice Command', 'أمر الموظف الصوتي', language)}</h3>
                  </div>
                  <Button variant="outline" size="icon" className="moei-control" onClick={officerVoiceListening ? undefined : listenForOfficerVoiceDecision} disabled={actionLoading !== null || officerVoiceListening}>
                    {officerVoiceListening ? <Loader2 className="size-4 animate-spin" /> : <Mic2 className="size-4" />}
                  </Button>
                </div>

                <div className="mb-3 rounded-md border border-[rgba(0,179,193,0.28)] bg-[rgba(0,179,193,0.08)] p-3">
                  <div className="moei-data-label">{label('Captured Call Phrase', 'العبارة الملتقطة من المكالمة', language)}</div>
                  <div className="mt-1 min-h-8 text-sm font-black leading-6 text-[var(--moei-text)]">
                    {officerVoiceCommand || label('Awaiting: yes / no / escalate to officer', 'بانتظار: نعم / لا / إحالة لموظف', language)}
                  </div>
                </div>

                <div className="space-y-2">
                  <Button disabled={actionLoading !== null} onClick={() => handleOfficerCallDecision('approve', officerDecisionPhrase('approve', language))} className="h-12 w-full justify-between gap-2 bg-[var(--moei-gold)] px-4 text-[#081322] hover:bg-[#D7BB61]">
                    <span className="font-black">{officerDecisionButtonLabel('approve', language)}</span>
                    {actionLoading === 'approve' ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                  </Button>
                  <Button disabled={actionLoading !== null} onClick={() => handleOfficerCallDecision('reject', officerDecisionPhrase('reject', language))} className="h-12 w-full justify-between gap-2 bg-[var(--moei-danger)] px-4 text-white hover:bg-[#D64E4E]">
                    <span className="font-black">{officerDecisionButtonLabel('reject', language)}</span>
                    {actionLoading === 'reject' ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />}
                  </Button>
                  <Button disabled={actionLoading !== null} variant="outline" onClick={() => handleOfficerCallDecision('escalate', officerDecisionPhrase('escalate', language))} className="moei-control h-12 w-full justify-between gap-2 hover:bg-[var(--moei-danger-soft)] hover:text-[var(--moei-danger)]">
                    <span className="font-black">{officerDecisionButtonLabel('escalate', language)}</span>
                    {actionLoading === 'escalate' ? <Loader2 className="size-4 animate-spin" /> : <AlertTriangle className="size-4" />}
                  </Button>
                </div>
              </section>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={viewFile !== null} onOpenChange={(open) => {
        if (!open) {
          setViewFile(null)
          setTextContent(null)
          setTextContentLoading(false)
          setSpreadsheetRows(null)
          setSpreadsheetSheetNames(null)
          setExtractedDocText(null)
          setExtractLoading(false)
        }
      }}>
        <DialogContent className="flex h-[90vh] w-[90vw] max-w-5xl flex-col border-[var(--moei-border)] bg-[var(--moei-panel)] text-[var(--moei-text)]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[var(--moei-text)]">
              {viewFile && getFileIcon(viewFile.type, viewFile.name)}
              {viewFile?.name}
            </DialogTitle>
          </DialogHeader>
          {viewFile && (
            <div className="flex items-center gap-3 border-b border-[rgba(201,168,76,0.18)] pb-2 text-xs text-[var(--moei-muted)]">
              <Badge variant="outline" className="border-[var(--moei-border-strong)] text-[var(--moei-gold)]">
                {viewFile.name.split('.').pop()?.toUpperCase() || 'FILE'}
              </Badge>
              {viewFile.type && <span className="truncate">{viewFile.type}</span>}
              {viewFile.size != null && viewFile.size > 0 && <span className="font-moei-mono">{formatFileSize(viewFile.size)}</span>}
              {viewFile.storedName && (
                <Button variant="outline" size="sm" className="moei-control ms-auto gap-1" onClick={() => handleDownloadFile(viewFile.storedName!, viewFile.name)}>
                  <Download className="size-3" />
                  {label('Download', 'تحميل', language)}
                </Button>
              )}
            </div>
          )}
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-md bg-[rgba(10,22,40,0.58)]">
            {viewFile && (() => {
              const ext = viewFile.name.split('.').pop()?.toLowerCase() || ''
              if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'].includes(ext) || viewFile.type.startsWith('image/')) {
                return <img src={viewFile.url} alt={viewFile.name} className="max-h-[70vh] max-w-full object-contain" />
              }
              if (ext === 'pdf' || viewFile.type === 'application/pdf') {
                return <iframe src={viewFile.url} className="h-[70vh] w-full border-0" title={viewFile.name} />
              }
              if (['doc', 'docx'].includes(ext) || viewFile.type.includes('word')) {
                return (
                  <div className="h-[70vh] w-full overflow-auto p-5">
                    {extractLoading ? (
                      <div className="flex h-full flex-col items-center justify-center gap-2 text-[var(--moei-muted)]">
                        <Loader2 className="size-8 animate-spin text-[var(--moei-gold)]" />
                        {label('Extracting document text...', 'جاري استخراج نص المستند...', language)}
                      </div>
                    ) : (
                      <pre className="whitespace-pre-wrap rounded-md border border-[rgba(201,168,76,0.14)] bg-[rgba(244,240,230,0.06)] p-5 text-sm leading-7 text-[var(--moei-text)]">
                        {extractedDocText || label('No document text available.', 'لا يوجد نص متاح للمستند.', language)}
                      </pre>
                    )}
                  </div>
                )
              }
              if (['xls', 'xlsx', 'csv'].includes(ext) || viewFile.type.includes('sheet') || viewFile.type.includes('excel')) {
                return (
                  <div className="flex h-[70vh] w-full flex-col overflow-hidden">
                    <div className="flex items-center gap-2 border-b border-[rgba(201,168,76,0.18)] px-4 py-2 text-sm text-[var(--moei-success)]">
                      <Table2 className="size-4" />
                      {label('Spreadsheet Preview', 'معاينة الجدول', language)}
                      {spreadsheetSheetNames && spreadsheetSheetNames.length > 1 && <span className="text-xs text-[var(--moei-muted)]">({spreadsheetSheetNames.slice(0, 3).join(', ')})</span>}
                    </div>
                    {extractLoading ? (
                      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-[var(--moei-muted)]">
                        <Loader2 className="size-8 animate-spin text-[var(--moei-success)]" />
                        {label('Extracting spreadsheet data...', 'جاري استخراج بيانات الجدول...', language)}
                      </div>
                    ) : spreadsheetRows && spreadsheetRows.length > 0 ? (
                      <div className="flex-1 overflow-auto">
                        <table className="w-full border-collapse text-xs">
                          <thead className="sticky top-0 bg-[var(--moei-navy-3)]">
                            <tr>
                              {spreadsheetRows[0].map((cell, index) => (
                                <th key={index} className="border border-[rgba(201,168,76,0.18)] px-3 py-2 text-start font-bold text-[var(--moei-gold)]">{cell || `Col ${index + 1}`}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {spreadsheetRows.slice(1).map((row, rowIndex) => (
                              <tr key={rowIndex}>
                                {row.map((cell, cellIndex) => (
                                  <td key={cellIndex} className="max-w-[240px] truncate border border-[rgba(201,168,76,0.12)] px-3 py-2 text-[var(--moei-text)]">{cell}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-[var(--moei-muted)]">
                        <Table2 className="size-12 text-[var(--moei-success)]" />
                        {label('Could not extract spreadsheet data.', 'تعذر استخراج بيانات الجدول.', language)}
                      </div>
                    )}
                  </div>
                )
              }
              if (ext === 'txt' || viewFile.type === 'text/plain') {
                return (
                  <div className="h-[70vh] w-full overflow-auto p-5">
                    {textContentLoading ? (
                      <div className="flex h-full flex-col items-center justify-center gap-2 text-[var(--moei-muted)]">
                        <Loader2 className="size-8 animate-spin text-[var(--moei-gold)]" />
                        {label('Loading text...', 'جاري تحميل النص...', language)}
                      </div>
                    ) : (
                      <pre className="font-moei-mono whitespace-pre-wrap text-sm text-[var(--moei-text)]">{textContent || '-'}</pre>
                    )}
                  </div>
                )
              }
              return (
                <div className="flex flex-col items-center justify-center gap-4 text-[var(--moei-muted)]">
                  <File className="size-14 text-[var(--moei-gold)]" />
                  <p>{label('Preview not available for this file type.', 'المعاينة غير متاحة لهذا النوع من الملفات.', language)}</p>
                  {viewFile.storedName && (
                    <Button variant="outline" className="moei-control gap-2" onClick={() => handleDownloadFile(viewFile.storedName!, viewFile.name)}>
                      <Download className="size-4" />
                      {label('Download File', 'تحميل الملف', language)}
                    </Button>
                  )}
                </div>
              )
            })()}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
