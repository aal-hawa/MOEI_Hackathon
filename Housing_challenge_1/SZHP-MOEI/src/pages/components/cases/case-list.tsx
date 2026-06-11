import { useCallback, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { format, formatDistanceToNow } from 'date-fns'
import {
  AlertTriangle,
  ArrowUpRight,
  Bot,
  Brain,
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  FileSearch,
  Filter,
  Gauge,
  GitBranch,
  Landmark,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
  XCircle,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/hooks/use-toast'
import { formatAED, maskEmiratesId } from '@/lib/formatters'
import { t } from '@/lib/i18n'
import type { RequestData } from '@/lib/store'
import { useAppStore } from '@/lib/store'
import { authFetch, cn } from '@/lib/utils'

interface CaseListProps {
  cases: RequestData[]
  loading: boolean
  onSelectCase: (id: string) => void
  onAssess: (id: string) => void
  onNewRequest: () => void
}

const statusLabels: Record<string, { en: string; ar: string }> = {
  all: { en: 'All Statuses', ar: 'جميع الحالات' },
  pending: { en: 'Pending', ar: 'قيد الانتظار' },
  under_review: { en: 'Under Review', ar: 'قيد المراجعة' },
  ai_assessed: { en: 'AI Assessed', ar: 'تم تقييمه بالذكاء الاصطناعي' },
  approved: { en: 'Approved', ar: 'معتمد' },
  rejected: { en: 'Rejected', ar: 'مرفوض' },
  escalated: { en: 'Escalated', ar: 'محال للمراجعة' },
}

const riskLabels: Record<string, { en: string; ar: string }> = {
  all: { en: 'All Risk Levels', ar: 'جميع مستويات المخاطر' },
  low: { en: 'Low', ar: 'منخفض' },
  medium: { en: 'Medium', ar: 'متوسط' },
  high: { en: 'High', ar: 'عال' },
  critical: { en: 'Critical', ar: 'حرج' },
}

function localized(record: Record<string, { en: string; ar: string }>, key: string, isAr: boolean) {
  return record[key]?.[isAr ? 'ar' : 'en'] ?? key.replace(/_/g, ' ')
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

function decisionIcon(status: string) {
  if (status === 'ai_assessed') return <Brain className="size-3.5" />
  if (status === 'escalated') return <ArrowUpRight className="size-3.5" />
  if (status === 'approved') return <CheckCircle2 className="size-3.5" />
  if (status === 'rejected') return <XCircle className="size-3.5" />
  return <Clock className="size-3.5" />
}

function proposedAmount(caseItem: RequestData) {
  return caseItem.assessment?.recommendedAmount ?? caseItem.arrear?.totalOverdue ?? 0
}

function proposedInstallment(caseItem: RequestData) {
  return caseItem.assessment?.recommendedInstallment ?? 0
}

function StatTile({ icon: Icon, label, value, tone }: { icon: typeof FileSearch; label: string; value: string | number; tone?: 'gold' | 'red' | 'green' | 'cyan' }) {
  return (
    <div className="moei-panel-flat rounded-md p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="moei-data-label">{label}</span>
        <Icon
          className={cn(
            'size-4',
            tone === 'red' && 'text-[var(--moei-danger)]',
            tone === 'green' && 'text-[var(--moei-success)]',
            tone === 'cyan' && 'text-[var(--moei-cyan)]',
            (!tone || tone === 'gold') && 'text-[var(--moei-gold)]'
          )}
        />
      </div>
      <div className="font-moei-mono mt-3 text-3xl font-bold text-[var(--moei-text)]">{value}</div>
    </div>
  )
}

export function CaseList({ cases, loading, onSelectCase, onAssess, onNewRequest }: CaseListProps) {
  const { language } = useAppStore()
  const isAr = language === 'ar'
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [riskFilter, setRiskFilter] = useState('all')

  const safeCases = cases || []

  const filteredCases = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return safeCases.filter((caseItem) => {
      const riskLevel = caseItem.assessment?.riskLevel || ''
      const matchesSearch = !query || [
        caseItem.id,
        caseItem.applicant?.nameEn,
        caseItem.applicant?.nameAr,
        caseItem.applicant?.emiratesId,
      ].some((value) => value?.toLowerCase().includes(query))
      const matchesStatus = statusFilter === 'all' || caseItem.status === statusFilter
      const matchesRisk = riskFilter === 'all' || riskLevel === riskFilter
      return matchesSearch && matchesStatus && matchesRisk
    })
  }, [riskFilter, safeCases, searchQuery, statusFilter])

  const stats = useMemo(() => {
    const total = safeCases.length
    const aiAssessed = safeCases.filter((caseItem) => caseItem.status === 'ai_assessed').length
    const escalated = safeCases.filter((caseItem) => caseItem.status === 'escalated').length
    const highRisk = safeCases.filter((caseItem) => ['high', 'critical'].includes(caseItem.assessment?.riskLevel || '')).length
    const automationRate = total > 0 ? Math.round((aiAssessed / total) * 100) : 0
    return { total, aiAssessed, escalated, highRisk, automationRate }
  }, [safeCases])

  const clearFilters = useCallback(() => {
    setSearchQuery('')
    setStatusFilter('all')
    setRiskFilter('all')
  }, [])

  const handleGenerateMock = async () => {
    try {
      const res = await authFetch('/api/system/generate-mock', { method: 'POST' })
      if (res.ok) {
        toast({ title: isAr ? 'تم إنشاء حالة تجريبية' : 'Synthetic case generated' })
        window.location.reload()
      } else {
        toast({ title: isAr ? 'فشل إنشاء الحالة' : 'Failed to generate mock case', variant: 'destructive' })
      }
    } catch {
      toast({ title: isAr ? 'خطأ في الاتصال' : 'Network error generating mock case', variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-5">
      <section className="moei-panel rounded-md p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[var(--moei-gold)]">
              <Landmark className="size-5" />
              <span className="text-xs font-extrabold uppercase">{isAr ? 'مركز عمليات التحصيل' : 'Finance Collection Operations'}</span>
            </div>
            <h1 className="mt-2 text-3xl font-black text-[var(--moei-text)]">
              {isAr ? 'لوحة قرارات إعادة جدولة المتأخرات' : 'Housing Arrears Rescheduling Command Board'}
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-[var(--moei-muted)]">
              {isAr
                ? 'استعراض فوري للحالات المقيمة بالذكاء الاصطناعي والحالات عالية المخاطر المحالة لموظف مختص.'
                : 'Instant view of AI-assessed cases, high-risk exceptions, proposed rescheduling plans, and officer actions.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={handleGenerateMock} variant="outline" className="moei-control gap-2 hover:bg-[var(--moei-gold-soft)]">
              <Bot className="size-4 text-[var(--moei-gold)]" />
              {isAr ? 'حالة تجريبية' : 'Mock Case'}
            </Button>
            <Button onClick={() => window.location.reload()} variant="outline" disabled={loading} className="moei-control gap-2 hover:bg-[var(--moei-gold-soft)]">
              <RefreshCw className={cn('size-4 text-[var(--moei-gold)]', loading && 'animate-spin')} />
              {isAr ? 'تحديث' : 'Refresh'}
            </Button>
            <Button onClick={onNewRequest} className="gap-2 bg-[var(--moei-gold)] text-[#081322] hover:bg-[#D7BB61]">
              <Plus className="size-4" />
              {t('caseList.newRequest', language)}
            </Button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-5">
          <StatTile icon={FileSearch} label={isAr ? 'إجمالي الحالات' : 'Total Cases'} value={stats.total} />
          <StatTile icon={Brain} label={isAr ? 'تقييم تلقائي' : 'AI Assessed'} value={stats.aiAssessed} tone="gold" />
          <StatTile icon={AlertTriangle} label={isAr ? 'محالة' : 'Escalated'} value={stats.escalated} tone="red" />
          <StatTile icon={Gauge} label={isAr ? 'مخاطر عالية' : 'High Risk'} value={stats.highRisk} tone="cyan" />
          <StatTile icon={ShieldCheck} label={isAr ? 'نسبة الأتمتة' : 'Automation'} value={`${stats.automationRate}%`} tone="green" />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 border-t border-[rgba(201,168,76,0.16)] pt-4 md:grid-cols-4">
          {[
            {
              label: isAr ? 'الزمن الحالي' : 'Current SLA',
              value: isAr ? '5 أيام عمل' : '5 working days',
            },
            {
              label: isAr ? 'زمن الوكيل' : 'Agent SLA',
              value: isAr ? 'فوري' : 'Instant',
            },
            {
              label: isAr ? 'الحوكمة' : 'Governance',
              value: isAr ? 'قواعد موحدة' : 'Unified rules',
            },
            {
              label: isAr ? 'الاستثناءات' : 'Exceptions',
              value: isAr ? 'إحالة بشرية' : 'Human handoff',
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-lg border border-[rgba(201,168,76,0.34)] bg-white/90 p-3 shadow-[0_10px_28px_rgba(91,68,20,0.07)]"
            >
              <div className="text-[0.68rem] font-extrabold uppercase text-[#8F6B22]">{item.label}</div>
              <div className="font-moei-mono mt-1 text-lg font-extrabold text-[#174236]">{item.value}</div>
            </div>
          ))}
        </div>

        <div className="mt-4 border-t border-[rgba(201,168,76,0.16)] pt-4">
          <div className="mb-3 flex items-center gap-2 text-[var(--moei-gold)]">
            <Brain className="size-4" />
            <span className="text-xs font-extrabold uppercase">{isAr ? 'طبقة الابتكار' : 'Innovation Layer'}</span>
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
            {[
              {
                icon: Brain,
                label: isAr ? 'وكيل قرار مستقل' : 'Autonomous Agent',
                value: isAr ? 'بيانات + قواعد + توصية' : 'Data + Rules + Recommendation',
                tone: 'text-[var(--moei-gold)]',
              },
              {
                icon: GitBranch,
                label: isAr ? 'توأم رقمي للقرار' : 'Decision Twin',
                value: isAr ? 'مسار الوصول للتوافق' : 'Route-to-green computed',
                tone: 'text-[var(--moei-cyan)]',
              },
              {
                icon: FileSearch,
                label: isAr ? 'ذكاء المستندات' : 'Document Intelligence',
                value: isAr ? 'راتب + دخل + أدلة' : 'Salary + income evidence',
                tone: 'text-[var(--moei-success)]',
              },
              {
                icon: ShieldCheck,
                label: isAr ? 'تدقيق قابل للتفسير' : 'Explainable Audit',
                value: isAr ? 'مخاطر + مبررات + إحالة' : 'Risk + rationale + handoff',
                tone: 'text-[var(--moei-danger)]',
              },
            ].map((item) => {
              const Icon = item.icon
              return (
                <div key={item.label} className="rounded-md border border-[rgba(201,168,76,0.14)] bg-[rgba(10,22,40,0.5)] p-3">
                  <div className="flex items-center gap-2">
                    <Icon className={cn('size-4', item.tone)} />
                    <div className="moei-data-label">{item.label}</div>
                  </div>
                  <div className="mt-2 text-sm font-extrabold text-[var(--moei-text)]">{item.value}</div>
                </div>
              )
            })}
          </div>

          <div className="mt-3 rounded-md border border-[rgba(201,168,76,0.18)] bg-[rgba(10,22,40,0.48)] p-3">
            <div className="mb-2 flex items-center gap-2 text-[var(--moei-muted)]">
              <ShieldCheck className="size-4 text-[var(--moei-gold)]" />
              <span className="text-xs font-extrabold uppercase">{isAr ? 'دليل التقييم 100 نقطة' : '100-Point Rubric Evidence'}</span>
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
              {[
                [isAr ? 'ذكاء القرار' : 'Decision AI', '25', isAr ? 'تقييم مستقل' : 'Autonomous assessment'],
                [isAr ? 'الحوكمة' : 'Governance', '25', isAr ? '20% + مدة + طلب نشط' : '20% + period + active request'],
                [isAr ? 'التكامل' : 'Integration', '20', isAr ? 'هوية + قرض + مستندات' : 'Identity + loan + docs'],
                [isAr ? 'الأثر' : 'Impact', '15', isAr ? '5 أيام إلى فوري' : '5 days to instant'],
                [isAr ? 'التفسير' : 'Explainability', '15', isAr ? 'توأم القرار' : 'Decision Twin'],
              ].map(([rubricLabel, points, proof]) => (
                <div key={rubricLabel} className="rounded border border-[rgba(201,168,76,0.12)] bg-[rgba(244,240,230,0.04)] p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[0.68rem] font-extrabold uppercase text-[var(--moei-muted)]">{rubricLabel}</span>
                    <span className="font-moei-mono text-sm font-black text-[var(--moei-gold)]">{points}</span>
                  </div>
                  <div className="mt-1 text-xs font-bold text-[var(--moei-text)]">{proof}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="moei-panel rounded-md p-4">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(260px,1fr)_210px_210px_auto]">
          <label className="relative block">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-[var(--moei-muted)]" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={isAr ? 'بحث بالاسم أو رقم الهوية أو رقم الحالة' : 'Search applicant, Emirates ID, or case ID'}
              className="moei-control h-11 w-full rounded-md ps-10 pe-3 text-sm"
            />
          </label>

          <label className="relative block">
            <Filter className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-[var(--moei-muted)]" />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="moei-control h-11 w-full appearance-none rounded-md ps-10 pe-3 text-sm"
            >
              {Object.keys(statusLabels).map((status) => (
                <option key={status} value={status}>{localized(statusLabels, status, isAr)}</option>
              ))}
            </select>
          </label>

          <label className="relative block">
            <Gauge className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-[var(--moei-muted)]" />
            <select
              value={riskFilter}
              onChange={(event) => setRiskFilter(event.target.value)}
              className="moei-control h-11 w-full appearance-none rounded-md ps-10 pe-3 text-sm"
            >
              {Object.keys(riskLabels).map((risk) => (
                <option key={risk} value={risk}>{localized(riskLabels, risk, isAr)}</option>
              ))}
            </select>
          </label>

          <Button
            variant="outline"
            onClick={clearFilters}
            className="moei-control h-11 gap-2 hover:bg-[var(--moei-danger-soft)] hover:text-[var(--moei-danger)]"
            disabled={statusFilter === 'all' && riskFilter === 'all' && !searchQuery}
          >
            <X className="size-4" />
            {isAr ? 'مسح' : 'Clear'}
          </Button>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 text-xs text-[var(--moei-muted)]">
          <span className="font-bold uppercase">
            {isAr ? `${filteredCases.length} من ${safeCases.length} نتيجة` : `${filteredCases.length} of ${safeCases.length} cases`}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="size-3.5 text-[var(--moei-gold)]" />
            {isAr ? 'مرتب حسب تاريخ الإنشاء' : 'Sorted by creation date'}
          </span>
        </div>
      </section>

      <section className="moei-panel overflow-hidden rounded-md">
        {loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="grid grid-cols-7 gap-4 rounded-md border border-[rgba(201,168,76,0.12)] p-4">
                {Array.from({ length: 7 }).map((__, cell) => (
                  <Skeleton key={cell} className="h-6 bg-[rgba(244,240,230,0.08)]" />
                ))}
              </div>
            ))}
          </div>
        ) : filteredCases.length === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center gap-3 p-8 text-center">
            <Search className="size-10 text-[var(--moei-gold)]" />
            <h3 className="text-xl font-extrabold text-[var(--moei-text)]">{isAr ? 'لا توجد حالات مطابقة' : 'No Matching Cases'}</h3>
            <p className="max-w-lg text-sm text-[var(--moei-muted)]">
              {isAr ? 'غير عوامل التصفية أو أنشئ طلبا جديدا لبدء التقييم.' : 'Adjust the filters or create a new request to initiate an instant AI assessment.'}
            </p>
            <Button onClick={clearFilters} variant="outline" className="moei-control">
              {isAr ? 'مسح عوامل التصفية' : 'Clear Filters'}
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-sm">
              <thead>
                <tr className="border-b border-[rgba(201,168,76,0.2)] bg-[rgba(10,22,40,0.56)] text-start text-[0.68rem] uppercase text-[var(--moei-muted)]">
                  <th className="px-4 py-3 text-start font-extrabold">{isAr ? 'الحالة' : 'Case'}</th>
                  <th className="px-4 py-3 text-start font-extrabold">{isAr ? 'المستفيد' : 'Applicant'}</th>
                  <th className="px-4 py-3 text-start font-extrabold">{isAr ? 'المسار' : 'Status'}</th>
                  <th className="px-4 py-3 text-start font-extrabold">{isAr ? 'المخاطر' : 'Risk'}</th>
                  <th className="px-4 py-3 text-end font-extrabold">{isAr ? 'المبلغ المقترح' : 'Proposed Amount'}</th>
                  <th className="px-4 py-3 text-end font-extrabold">{isAr ? 'القسط المقترح' : 'Installment'}</th>
                  <th className="px-4 py-3 text-start font-extrabold">{isAr ? 'التاريخ' : 'Date'}</th>
                  <th className="px-4 py-3 text-end font-extrabold">{isAr ? 'الإجراء' : 'Action'}</th>
                </tr>
              </thead>
              <tbody>
                {filteredCases.map((caseItem, index) => {
                  const canAssess = caseItem.status === 'pending' || caseItem.status === 'under_review'
                  const riskLevel = caseItem.assessment?.riskLevel || 'unscored'

                  return (
                    <motion.tr
                      key={caseItem.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.025 }}
                      className="group border-b border-[rgba(201,168,76,0.1)] bg-[rgba(16,31,53,0.34)] transition-colors hover:bg-[rgba(201,168,76,0.07)]"
                    >
                      <td className="px-4 py-4">
                        <button onClick={() => onSelectCase(caseItem.id)} className="text-start">
                          <span className="font-moei-mono block text-xs font-bold text-[var(--moei-gold)]">{caseItem.id}</span>
                          <span className="mt-1 block text-xs text-[var(--moei-muted)]">{maskEmiratesId(caseItem.applicant?.emiratesId || '')}</span>
                        </button>
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-bold text-[var(--moei-text)]">{caseItem.applicant?.nameEn || t('caseList.unknown', language)}</div>
                        <div className="mt-0.5 text-xs text-[var(--moei-muted)]" dir="rtl">{caseItem.applicant?.nameAr || ''}</div>
                      </td>
                      <td className="px-4 py-4">
                        <Badge variant="outline" className={cn('gap-1.5 border px-2.5 py-1 font-bold uppercase', statusBadgeClass(caseItem.status))}>
                          {decisionIcon(caseItem.status)}
                          {localized(statusLabels, caseItem.status, isAr)}
                        </Badge>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={cn('border px-2.5 py-1 font-bold uppercase', riskBadgeClass(riskLevel))}>
                            {riskLevel === 'unscored' ? (isAr ? 'غير مقيم' : 'Unscored') : localized(riskLabels, riskLevel, isAr)}
                          </Badge>
                          {caseItem.assessment && (
                            <span className="font-moei-mono text-xs text-[var(--moei-muted)]">{Math.round(caseItem.assessment.riskScore)}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-end">
                        <span className="font-moei-mono text-lg font-bold text-[var(--moei-text)]">{formatAED(proposedAmount(caseItem))}</span>
                      </td>
                      <td className="px-4 py-4 text-end">
                        <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                          <span className="font-moei-mono font-semibold text-[var(--moei-cyan)]">
                            {proposedInstallment(caseItem) > 0 ? formatAED(proposedInstallment(caseItem)) : '-'}
                          </span>
                          {caseItem.assessment && (
                            <span className="font-moei-mono text-xs text-[var(--moei-muted)]">{caseItem.assessment.recommendedDuration}m</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-moei-mono text-xs font-semibold text-[var(--moei-text)]">{format(new Date(caseItem.createdAt), 'dd MMM yyyy')}</div>
                        <div className="mt-0.5 text-xs text-[var(--moei-muted)]">{formatDistanceToNow(new Date(caseItem.createdAt), { addSuffix: true })}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          {canAssess && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onAssess(caseItem.id)}
                              className="moei-control gap-1.5 hover:bg-[var(--moei-gold-soft)]"
                            >
                              <Brain className="size-3.5 text-[var(--moei-gold)]" />
                              {isAr ? 'تقييم' : 'Assess'}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            onClick={() => onSelectCase(caseItem.id)}
                            className="gap-1.5 bg-[var(--moei-gold)] text-[#081322] hover:bg-[#D7BB61]"
                          >
                            <Eye className="size-3.5" />
                            {isAr ? 'فتح' : 'Open'}
                          </Button>
                        </div>
                      </td>
                    </motion.tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
