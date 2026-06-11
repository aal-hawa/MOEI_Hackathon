'use client'

import { useMemo, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { formatDistanceToNow } from 'date-fns'
import {
  Search,
  Plus,
  Brain,
  Eye,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowUpRight,
  X,
  SlidersHorizontal,
  Bot,
  RefreshCw,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/hooks/use-toast'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { RequestData } from '@/lib/store'
import { useAppStore } from '@/lib/store'
import { t, getStatusLabel, getRiskLabel, getReasonCategoryLabel } from '@/lib/i18n'

// ─── Helpers ───────────────────────────────────────────────
const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)

const maskEmiratesId = (id: string) => {
  if (!id) return ''
  const parts = id.split('-')
  if (parts.length === 4) {
    return `${parts[0]}-****-*******-${parts[3]}`
  }
  if (id.length > 8) {
    return id.slice(0, 3) + '****' + id.slice(-4)
  }
  return id
}

// ─── Status Config ─────────────────────────────────────────
const STATUS_CONFIG: Record<string, { color: string; bgColor: string; icon: React.ElementType }> = {
  pending: { color: 'text-ae-gold-700', bgColor: 'bg-ae-gold-100 border-ae-gold-200', icon: Clock },
  under_review: { color: 'text-blue-700', bgColor: 'bg-blue-100 border-blue-200', icon: Eye },
  ai_assessed: { color: 'text-purple-700', bgColor: 'bg-purple-100 border-purple-200', icon: Brain },
  approved: { color: 'text-ae-green-700', bgColor: 'bg-ae-green-100 border-ae-green-200', icon: CheckCircle2 },
  rejected: { color: 'text-ae-red-700', bgColor: 'bg-ae-red-100 border-ae-red-200', icon: XCircle },
  escalated: { color: 'text-purple-700', bgColor: 'bg-purple-100 border-purple-200', icon: ArrowUpRight },
}

const RISK_CONFIG: Record<string, { color: string; bgColor: string }> = {
  low: { color: 'text-ae-green-700', bgColor: 'bg-ae-green-100 border-ae-green-200' },
  medium: { color: 'text-ae-gold-700', bgColor: 'bg-ae-gold-100 border-ae-gold-200' },
  high: { color: 'text-orange-700', bgColor: 'bg-orange-100 border-orange-200' },
  critical: { color: 'text-ae-red-700', bgColor: 'bg-ae-red-100 border-ae-red-200' },
}

// ─── Props ─────────────────────────────────────────────────
interface CaseListProps {
  cases: RequestData[]
  loading: boolean
  onSelectCase: (id: string) => void
  onAssess: (id: string) => void
  onNewRequest: () => void
}

// ─── Component ─────────────────────────────────────────────
export function CaseList({ cases, loading, onSelectCase, onAssess, onNewRequest }: CaseListProps) {
  const { language } = useAppStore()
  const isAr = language === 'ar'

  // ─── Local Filter State ────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [riskFilter, setRiskFilter] = useState('all')
  const [reasonFilter, setReasonFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // ─── Client-side Filtering ─────────────────────────────
  const filteredCases = useMemo(() => {
    let result = cases

    // Search by name or Emirates ID
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      result = result.filter((c) => {
        const nameEn = c.applicant?.nameEn?.toLowerCase() || ''
        const nameAr = c.applicant?.nameAr?.toLowerCase() || ''
        const eid = c.applicant?.emiratesId?.toLowerCase() || ''
        return nameEn.includes(q) || nameAr.includes(q) || eid.includes(q)
      })
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((c) => c.status === statusFilter)
    }

    // Risk filter
    if (riskFilter !== 'all') {
      result = result.filter((c) => c.assessment?.riskLevel === riskFilter)
    }

    // Reason category filter
    if (reasonFilter !== 'all') {
      result = result.filter((c) => c.reasonCategory === reasonFilter)
    }

    // Date range filter
    if (dateFrom) {
      const fromDate = new Date(dateFrom)
      result = result.filter((c) => new Date(c.createdAt) >= fromDate)
    }
    if (dateTo) {
      const toDate = new Date(dateTo)
      toDate.setHours(23, 59, 59, 999) // Include the entire end day
      result = result.filter((c) => new Date(c.createdAt) <= toDate)
    }

    return result
  }, [cases, searchQuery, statusFilter, riskFilter, reasonFilter, dateFrom, dateTo])

  // ─── Stats (based on all cases, not filtered) ──────────
  const stats = useMemo(() => {
    const total = cases.length
    const pending = cases.filter((c) => c.status === 'pending').length
    const approved = cases.filter((c) => c.status === 'approved').length
    const rejected = cases.filter((c) => c.status === 'rejected').length
    const escalated = cases.filter((c) => c.status === 'escalated').length
    return { total, pending, approved, rejected, escalated }
  }, [cases])

  const activeFilterCount = [statusFilter !== 'all', riskFilter !== 'all', reasonFilter !== 'all', searchQuery.trim() !== '', dateFrom !== '', dateTo !== ''].filter(Boolean).length

  const clearAllFilters = useCallback(() => {
    setSearchQuery('')
    setStatusFilter('all')
    setRiskFilter('all')
    setReasonFilter('all')
    setDateFrom('')
    setDateTo('')
  }, [])

  const handleGenerateMock = async () => {
    try {
      const res = await authFetch('/api/system/generate-mock', { method: 'POST' })
      if (res.ok) {
        toast({ title: 'Success', description: 'Generated a new synthetic hackathon case!' })
        fetchRequests() // Refresh list
      } else {
        toast({ title: 'Error', description: 'Failed to generate mock case', variant: 'destructive' })
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Network error generating mock case', variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">{t('caseList.title', language)}</h2>
          <p className="text-sm text-muted-foreground">{t('caseList.subtitle', language)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            className="border-primary/20 text-primary hover:bg-primary/10"
            onClick={handleGenerateMock}
          >
            <Bot className="size-4 me-2" />
            Generate Mock Case
          </Button>
          <Button onClick={() => fetchRequests()} variant="outline" size="sm" disabled={loading}>
            <RefreshCw className={`size-4 me-2 ${loading ? 'animate-spin' : ''}`} />
            {t('form.refresh', language)}
          </Button>
          <Button
            onClick={onNewRequest}
            className="bg-ae-gold-500 hover:bg-ae-gold-600 text-white gap-2 shrink-0"
          >
            <Plus className="size-4" />
            {t('caseList.newRequest', language)}
          </Button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder={t('caseList.searchPlaceholder', language)}
              className="ps-9 pe-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setSearchQuery('')}
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder={t('caseList.allStatuses', language)} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('caseList.allStatuses', language)}</SelectItem>
              <SelectItem value="pending">{getStatusLabel('pending', language)}</SelectItem>
              <SelectItem value="under_review">{getStatusLabel('under_review', language)}</SelectItem>
              <SelectItem value="ai_assessed">{getStatusLabel('ai_assessed', language)}</SelectItem>
              <SelectItem value="approved">{getStatusLabel('approved', language)}</SelectItem>
              <SelectItem value="rejected">{getStatusLabel('rejected', language)}</SelectItem>
              <SelectItem value="escalated">{getStatusLabel('escalated', language)}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={riskFilter} onValueChange={setRiskFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder={t('caseList.allRisks', language)} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('caseList.allRisks', language)}</SelectItem>
              <SelectItem value="low">{getRiskLabel('low', language)}</SelectItem>
              <SelectItem value="medium">{getRiskLabel('medium', language)}</SelectItem>
              <SelectItem value="high">{getRiskLabel('high', language)}</SelectItem>
              <SelectItem value="critical">{getRiskLabel('critical', language)}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={reasonFilter} onValueChange={setReasonFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder={isAr ? 'جميع الأسباب' : 'All Reasons'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isAr ? 'جميع الأسباب' : 'All Reasons'}</SelectItem>
              <SelectItem value="job_loss">{getReasonCategoryLabel('job_loss', language)}</SelectItem>
              <SelectItem value="medical">{getReasonCategoryLabel('medical', language)}</SelectItem>
              <SelectItem value="salary_cut">{getReasonCategoryLabel('salary_cut', language)}</SelectItem>
              <SelectItem value="divorce">{getReasonCategoryLabel('divorce', language)}</SelectItem>
              <SelectItem value="retirement">{getReasonCategoryLabel('retirement', language)}</SelectItem>
              <SelectItem value="other">{getReasonCategoryLabel('other', language)}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Date Range Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Label className="text-xs text-muted-foreground">{isAr ? 'من تاريخ' : 'From Date'}</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="mt-1"
            />
          </div>
          <div className="flex-1">
            <Label className="text-xs text-muted-foreground">{isAr ? 'إلى تاريخ' : 'To Date'}</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>

        {/* Active Filters Indicator */}
        {activeFilterCount > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <SlidersHorizontal className="size-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">
              {isAr ? `${filteredCases.length} من ${cases.length} نتيجة` : `${filteredCases.length} of ${cases.length} results`}
            </span>
            {statusFilter !== 'all' && (
              <Badge variant="secondary" className="text-xs gap-1">
                {getStatusLabel(statusFilter, language)}
                <X className="size-3 cursor-pointer" onClick={() => setStatusFilter('all')} />
              </Badge>
            )}
            {riskFilter !== 'all' && (
              <Badge variant="secondary" className="text-xs gap-1">
                {getRiskLabel(riskFilter, language)}
                <X className="size-3 cursor-pointer" onClick={() => setRiskFilter('all')} />
              </Badge>
            )}
            {reasonFilter !== 'all' && (
              <Badge variant="secondary" className="text-xs gap-1">
                {getReasonCategoryLabel(reasonFilter, language)}
                <X className="size-3 cursor-pointer" onClick={() => setReasonFilter('all')} />
              </Badge>
            )}
            {searchQuery && (
              <Badge variant="secondary" className="text-xs gap-1">
                &quot;{searchQuery}&quot;
                <X className="size-3 cursor-pointer" onClick={() => setSearchQuery('')} />
              </Badge>
            )}
            {dateFrom && (
              <Badge variant="secondary" className="text-xs gap-1">
                {isAr ? 'من' : 'From'}: {dateFrom}
                <X className="size-3 cursor-pointer" onClick={() => setDateFrom('')} />
              </Badge>
            )}
            {dateTo && (
              <Badge variant="secondary" className="text-xs gap-1">
                {isAr ? 'إلى' : 'To'}: {dateTo}
                <X className="size-3 cursor-pointer" onClick={() => setDateTo('')} />
              </Badge>
            )}
            <Button variant="ghost" size="sm" className="text-xs h-6 px-2 text-muted-foreground" onClick={clearAllFilters}>
              {isAr ? 'مسح الكل' : 'Clear all'}
            </Button>
          </div>
        )}
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">{t('caseList.totalCases', language)}</p>
          <p className="text-xl font-bold text-ae-black-700">{stats.total}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">{t('caseList.pending', language)}</p>
          <div className="flex items-center gap-1.5">
            <div className="size-2 rounded-full bg-ae-gold-500" />
            <p className="text-xl font-bold text-ae-gold-600">{stats.pending}</p>
          </div>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">{t('caseList.approved', language)}</p>
          <div className="flex items-center gap-1.5">
            <div className="size-2 rounded-full bg-ae-green-500" />
            <p className="text-xl font-bold text-ae-green-600">{stats.approved}</p>
          </div>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">{t('caseList.rejected', language)}</p>
          <div className="flex items-center gap-1.5">
            <div className="size-2 rounded-full bg-ae-red-500" />
            <p className="text-xl font-bold text-ae-red-600">{stats.rejected}</p>
          </div>
        </div>
        <div className="rounded-lg border bg-card p-3 col-span-2 sm:col-span-1">
          <p className="text-xs text-muted-foreground">{t('caseList.escalated', language)}</p>
          <div className="flex items-center gap-1.5">
            <div className="size-2 rounded-full bg-purple-500" />
            <p className="text-xl font-bold text-purple-600">{stats.escalated}</p>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="size-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                    <Skeleton className="h-6 w-20 rounded-full" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                  <div className="flex gap-2">
                    <Skeleton className="h-8 w-24" />
                    <Skeleton className="h-8 w-32" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State - No cases at all */}
      {!loading && cases.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-muted p-4 mb-4">
              <AlertTriangle className="size-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-1">{t('caseList.noCases', language)}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {t('caseList.noCasesDesc', language)}
            </p>
            <Button onClick={onNewRequest} className="bg-ae-gold-500 hover:bg-ae-gold-600 text-white gap-2">
              <Plus className="size-4" />
              {t('caseList.createNewRequest', language)}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* No results after filtering */}
      {!loading && cases.length > 0 && filteredCases.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-muted p-4 mb-4">
              <Search className="size-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-1">{isAr ? 'لا توجد نتائج' : 'No results found'}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {isAr ? 'لا توجد حالات تطابق عوامل التصفية الحالية' : 'No cases match the current filters'}
            </p>
            <Button variant="outline" onClick={clearAllFilters} className="gap-2">
              <X className="size-4" />
              {isAr ? 'مسح جميع الفلاتر' : 'Clear all filters'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Case Cards */}
      {!loading && filteredCases.length > 0 && (
        <div className="space-y-4">
          {filteredCases.map((caseItem, index) => {
            const statusConf = STATUS_CONFIG[caseItem.status] || STATUS_CONFIG.pending
            const riskConf = caseItem.assessment ? RISK_CONFIG[caseItem.assessment.riskLevel] : null
            const StatusIcon = statusConf.icon
            const canAssess = caseItem.status === 'pending' || caseItem.status === 'under_review'

            return (
              <motion.div
                key={caseItem.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: index * 0.05 }}
              >
                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 space-y-4">
                    {/* Top Row: Applicant info + Status */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex size-10 items-center justify-center rounded-full bg-ae-gold-100 text-ae-gold-700 font-semibold text-sm shrink-0">
                          {caseItem.applicant?.nameEn?.charAt(0) || '?'}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-ae-black-700 truncate">
                            {caseItem.applicant?.nameEn || t('caseList.unknown', language)}
                          </h3>
                          <p className="text-sm text-muted-foreground truncate" dir="rtl">
                            {caseItem.applicant?.nameAr || ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {caseItem.isViewed === false && (
                          <Badge variant="default" className="bg-ae-gold-500 hover:bg-ae-gold-600 text-white border-0 gap-1 animate-pulse">
                            <div className="size-1.5 rounded-full bg-white" />
                            {isAr ? 'جديد' : 'New'}
                          </Badge>
                        )}
                        <Badge variant="outline" className={cn('gap-1', statusConf.bgColor, statusConf.color)}>
                          <StatusIcon className="size-3" />
                          {getStatusLabel(caseItem.status, language)}
                        </Badge>
                        {riskConf && caseItem.assessment && (
                          <Badge variant="outline" className={cn('gap-1', riskConf.bgColor, riskConf.color)}>
                            {getRiskLabel(caseItem.assessment.riskLevel, language)}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Details Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">{t('caseList.emiratesId', language)}</p>
                        <p className="font-medium">{maskEmiratesId(caseItem.applicant?.emiratesId || '')}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">{t('caseList.loanBalance', language)}</p>
                        <p className="font-medium">
                          {formatCurrency(caseItem.loan?.originalAmount || 0)} / {formatCurrency(caseItem.loan?.remainingBalance || 0)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">{t('caseList.overdue', language)}</p>
                        <p className="font-medium text-ae-red-600">
                          {caseItem.arrear ? formatCurrency(caseItem.arrear.totalOverdue) : 'N/A'}
                          {caseItem.arrear && caseItem.arrear.delayDays > 0 && (
                            <span className="text-muted-foreground font-normal"> ({caseItem.arrear.delayDays}d)</span>
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">{t('caseList.rescheduleDuration', language)}</p>
                        <p className="font-medium">{caseItem.requestedDurationMonths} {t('caseList.months', language)}</p>
                      </div>
                    </div>

                    {/* Footer Row */}
                    <div className="flex items-center justify-between pt-2 border-t">
                      <p className="text-xs text-muted-foreground" title={new Date(caseItem.createdAt).toLocaleString(isAr ? 'ar-AE' : 'en-US')}>
                        {formatDistanceToNow(new Date(caseItem.createdAt), { addSuffix: true })} · {new Date(caseItem.createdAt).toLocaleString(isAr ? 'ar-AE' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <div className="flex items-center gap-2">
                        {canAssess && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onAssess(caseItem.id)}
                            className="gap-1.5 text-ae-gold-600 border-ae-gold-200 hover:bg-ae-gold-50"
                          >
                            <Brain className="size-3.5" />
                            {t('caseList.runAiAssessment', language)}
                          </Button>
                        )}
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => onSelectCase(caseItem.id)}
                          className="gap-1.5 bg-ae-gold-500 hover:bg-ae-gold-600 text-white"
                        >
                          <Eye className="size-3.5" />
                          {t('caseList.viewDetails', language)}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
