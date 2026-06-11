
import { useEffect, useState, useCallback } from 'react'
import { useAppStore } from '@/lib/store'
import { authFetch } from '@/lib/utils'
import { useAuthStore } from '@/lib/auth-store'
import { t } from '@/lib/i18n'
import { getRoleLabel } from '@/lib/rbac'
import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  FileText, Activity, Clock, User, Filter, ChevronDown, ChevronUp, Zap, Calendar, TrendingUp,
  Eye, CheckCircle2, XCircle, ArrowUpRight, Brain, Plus, PenLine, Search
} from 'lucide-react'
import { StatsCard, StatsCardGrid, EmptyState } from '@/components/shared'
import { AdminDateFilter, type AdminDateFilterChange } from '@/components/shared/admin-date-filter'

interface AuditLogEntry {
  id: string
  requestId: string | null
  action: string
  category: string
  details: string | null
  affectedRecord: string | null
  previousValue: string | null
  newValue: string | null
  ipAddress: string | null
  performedBy: string | null
  performedByUserId: string | null
  createdAt: string
  employeeName: string | null
  employeeRole: string | null
  user?: {
    id: string
    firstnameEN: string
    lastnameEN: string
    firstnameAR: string | null
    lastnameAR: string | null
    role: string
  } | null
}

interface AuditStats {
  actions24h: number
  actions7d: number
  actions30d: number
  totalActions: number
  mostActiveUser: { name: string; role: string; count: number } | null
  actionBreakdown: { action: string; count: number }[]
  categoryBreakdown: { category: string; count: number }[]
}

const CATEGORIES = ['request', 'auth', 'user_management', 'settings', 'field_config', 'system', 'general']
const ACTIONS = [
  'login', 'logout', 'create', 'created', 'update', 'delete', 'approve', 'approved',
  'reject', 'rejected', 'escalate', 'escalated', 'assess', 'assessed', 'viewed',
  'status_change', 'seed', 'register', 'activate', 'deactivate',
  'pending', 'under_review', 'ai_assessed',
]

// Action type color coding
const ACTION_COLORS: Record<string, string> = {
  // Green: create/positive actions
  create: 'bg-green-500/10 text-green-700 border-green-500/20',
  created: 'bg-green-500/10 text-green-700 border-green-500/20',
  approve: 'bg-green-500/10 text-green-700 border-green-500/20',
  approved: 'bg-green-500/10 text-green-700 border-green-500/20',
  register: 'bg-green-500/10 text-green-700 border-green-500/20',
  activate: 'bg-green-500/10 text-green-700 border-green-500/20',
  // Red: delete/negative actions
  delete: 'bg-red-500/10 text-red-700 border-red-500/20',
  reject: 'bg-red-500/10 text-red-700 border-red-500/20',
  rejected: 'bg-red-500/10 text-red-700 border-red-500/20',
  deactivate: 'bg-red-500/10 text-red-700 border-red-500/20',
  // Blue: assess/review actions
  assess: 'bg-blue-500/10 text-blue-700 border-blue-500/20',
  assessed: 'bg-blue-500/10 text-blue-700 border-blue-500/20',
  ai_assessed: 'bg-blue-500/10 text-blue-700 border-blue-500/20',
  under_review: 'bg-blue-500/10 text-blue-700 border-blue-500/20',
  status_change: 'bg-blue-500/10 text-blue-700 border-blue-500/20',
  update: 'bg-blue-500/10 text-blue-700 border-blue-500/20',
  // Amber/gold: pending/escalate
  pending: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
  escalate: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
  escalated: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
  // Gray: view/login actions
  viewed: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
  login: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
  logout: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
}

// Action type icons mapping
const ACTION_ICONS: Record<string, React.ElementType> = {
  approve: CheckCircle2,
  approved: CheckCircle2,
  reject: XCircle,
  rejected: XCircle,
  escalate: ArrowUpRight,
  escalated: ArrowUpRight,
  assess: Brain,
  assessed: Brain,
  ai_assessed: Brain,
  viewed: Eye,
  create: Plus,
  created: Plus,
  update: PenLine,
  status_change: PenLine,
  pending: Clock,
  under_review: Eye,
}

export function AuditView() {
  const { language } = useAppStore()
  const { accessToken } = useAuthStore()
  const isAr = language === 'ar'

  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [stats, setStats] = useState<AuditStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [filterCategory, setFilterCategory] = useState('')
  const [filterAction, setFilterAction] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [filterUser, setFilterUser] = useState('')
  const [datePeriod, setDatePeriod] = useState('all')
  const [limit, setLimit] = useState(50)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [showFilters, setShowFilters] = useState(false)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterCategory) params.set('category', filterCategory)
      if (filterAction) params.set('action', filterAction)
      if (filterDateFrom) params.set('dateFrom', filterDateFrom)
      if (filterDateTo) params.set('dateTo', filterDateTo)
      if (filterUser) params.set('performedByUserId', filterUser)
      params.set('limit', String(limit))
      params.set('offset', '0')
      const res = await authFetch(`/api/audit-trail?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setLogs(Array.isArray(data) ? data : data.logs || data.auditLogs || [])
      }
    } catch (err) {
      console.error('Failed to fetch audit logs:', err)
    } finally {
      setLoading(false)
    }
  }, [filterCategory, filterAction, filterDateFrom, filterDateTo, filterUser, limit, accessToken])

  const fetchStats = useCallback(async () => {
    try {
      const res = await authFetch('/api/audit-trail/stats')
      if (res.ok) {
        const data = await res.json()
        setStats(data)
      }
    } catch (err) {
      console.error('Failed to fetch audit stats:', err)
    }
  }, [accessToken])

  useEffect(() => {
    fetchLogs()
    fetchStats()
  }, [fetchLogs, fetchStats])

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const getCategoryLabel = (cat: string) => {
    const key = `admin.audit.cat.${cat}` as const
    const val = t(key, language)
    return val === key ? cat : val
  }

  const getActionBadgeColor = (action: string) => {
    // Check exact match first
    if (ACTION_COLORS[action]) return ACTION_COLORS[action]
    // Partial match fallback
    const lowerAction = action.toLowerCase()
    for (const [key, color] of Object.entries(ACTION_COLORS)) {
      if (lowerAction.includes(key)) return color
    }
    return 'bg-gray-500/10 text-gray-600 border-gray-500/20'
  }

  const getActionIcon = (action: string): React.ElementType | null => {
    if (ACTION_ICONS[action]) return ACTION_ICONS[action]
    const lowerAction = action.toLowerCase()
    for (const [key, icon] of Object.entries(ACTION_ICONS)) {
      if (lowerAction.includes(key)) return icon
    }
    return null
  }

  const formatJson = (val: string | null) => {
    if (!val) return null
    try {
      const parsed = JSON.parse(val)
      if (typeof parsed === 'string') return parsed
      if (typeof parsed === 'object' && !Array.isArray(parsed)) {
        return Object.entries(parsed)
          .filter(([, v]) => v !== null && v !== undefined && v !== '')
          .map(([k, v]) => {
            // Humanize key names
            const humanKey = k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())
            return `${humanKey}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`
          })
          .join('\n')
      }
      return JSON.stringify(parsed, null, 2)
    } catch {
      return val
    }
  }

  const formatTimestamp = (ts: string | null | undefined) => {
    if (!ts) return '-'
    const normalized = ts.includes('T') ? ts : ts.replace(' ', 'T')
    const withTz = normalized.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(normalized) ? normalized : normalized + 'Z'
    const date = new Date(withTz)
    if (isNaN(date.getTime())) {
      const fallback = new Date(ts)
      if (isNaN(fallback.getTime())) return ts
      return fallback.toLocaleString(isAr ? 'ar-AE' : 'en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    }
    return date.toLocaleString(isAr ? 'ar-AE' : 'en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  const formatRelativeTime = (ts: string | null | undefined) => {
    if (!ts) return ''
    const normalized = ts.includes('T') ? ts : ts.replace(' ', 'T')
    const withTz = normalized.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(normalized) ? normalized : normalized + 'Z'
    const date = new Date(withTz)
    if (isNaN(date.getTime())) return ''
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return isAr ? 'الآن' : 'just now'
    if (diffMins < 60) return isAr ? `منذ ${diffMins} دقيقة` : `${diffMins}m ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return isAr ? `منذ ${diffHours} ساعة` : `${diffHours}h ago`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 7) return isAr ? `منذ ${diffDays} يوم` : `${diffDays}d ago`
    return ''
  }

  // Get display name for the performer
  const getPerformerName = (log: AuditLogEntry) => {
    if (log.employeeName) return log.employeeName
    if (log.user?.firstnameEN) {
      return isAr && log.user.firstnameAR
        ? `${log.user.firstnameAR} ${log.user.lastnameAR}`
        : `${log.user.firstnameEN} ${log.user.lastnameEN}`
    }
    // Fallback: try to clean up performedBy
    if (log.performedBy) {
      if (log.performedBy.startsWith('employee:')) return log.performedBy.replace('employee:', '')
      return log.performedBy.length > 20 ? log.performedBy.substring(0, 20) + '...' : log.performedBy
    }
    return isAr ? 'النظام' : 'System'
  }

  const getPerformerRole = (log: AuditLogEntry) => {
    if (log.employeeRole) return log.employeeRole
    if (log.user?.role) return log.user.role
    return null
  }

  // Render status transition visually
  const renderStatusTransition = (log: AuditLogEntry) => {
    if (!log.previousValue && !log.newValue) return null
    // Only show transition for status-like changes
    const isStatusAction = ['approved', 'rejected', 'escalated', 'pending', 'under_review', 'ai_assessed', 'status_change'].includes(log.action)
    if (!isStatusAction && !log.previousValue) return null

    const prevLabel = log.previousValue ? getStatusLabel(log.previousValue) : ''
    const newLabel = log.newValue ? getStatusLabel(log.newValue) : ''

    if (prevLabel && newLabel && prevLabel !== newLabel) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px]">
          <span className="px-1.5 py-0.5 rounded bg-red-50 text-red-600 border border-red-100 font-medium">{prevLabel}</span>
          <span className="text-ae-black-300">→</span>
          <span className="px-1.5 py-0.5 rounded bg-green-50 text-green-600 border border-green-100 font-medium">{newLabel}</span>
        </span>
      )
    }
    return null
  }

  // Status label helper
  const getStatusLabel = (status: string) => {
    const labels: Record<string, { en: string; ar: string }> = {
      pending: { en: 'Pending', ar: 'معلق' },
      under_review: { en: 'Under Review', ar: 'قيد المراجعة' },
      ai_assessed: { en: 'AI Assessed', ar: 'تم التقييم بالذكاء' },
      approved: { en: 'Approved', ar: 'موافق عليه' },
      rejected: { en: 'Rejected', ar: 'مرفوض' },
      escalated: { en: 'Escalated', ar: 'تصعيد' },
    }
    const entry = labels[status]
    if (entry) return isAr ? entry.ar : entry.en
    return status
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-ae-black-700">{t('admin.audit.title', language)}</h2>
          <p className="text-sm text-ae-black-400">{t('admin.audit.desc', language)}</p>
        </div>
        <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className="border-ae-gold-500 text-ae-gold-600 hover:bg-ae-gold-50">
          <Filter className="w-4 h-4 me-1" /> {isAr ? 'تصفية' : 'Filters'}
        </Button>
      </div>

      {/* Stats Cards */}
      <StatsCardGrid columns={4}>
        <StatsCard
          value={stats?.actions24h ?? '-'}
          label={t('admin.audit.actions24h', language)}
          icon={Zap}
          iconClassName="bg-blue-500/10"
          className="border-blue-200 bg-blue-50/50"
        />
        <StatsCard
          value={stats?.actions7d ?? '-'}
          label={t('admin.audit.actions7d', language)}
          icon={Activity}
          iconClassName="bg-purple-500/10"
          className="border-purple-200 bg-purple-50/50"
        />
        <StatsCard
          value={stats?.actions30d ?? '-'}
          label={t('admin.audit.actions30d', language)}
          icon={Calendar}
          iconClassName="bg-ae-gold-500/10"
          className="border-ae-gold-200 bg-ae-gold-50/50"
        />
        <StatsCard
          value={stats?.mostActiveUser?.name || '-'}
          label={t('admin.audit.mostActive', language)}
          icon={TrendingUp}
          iconClassName="bg-green-500/10"
          className="border-green-200 bg-green-50/50"
        />
      </StatsCardGrid>

      {/* Date Filter */}
      <AdminDateFilter onFilterChange={(filter: AdminDateFilterChange) => {
        setDatePeriod(filter.period)
        setFilterDateFrom(filter.dateFrom || '')
        setFilterDateTo(filter.dateTo || '')
      }} />

      {/* Filter Bar */}
      {showFilters && (
        <Card className="border-ae-gold-200">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <Label className="text-xs">{t('admin.audit.filterCategory', language)}</Label>
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="w-full mt-1"><SelectValue placeholder={t('admin.audit.allCategories', language)} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('admin.audit.allCategories', language)}</SelectItem>
                    {CATEGORIES.map(c => (
                      <SelectItem key={c} value={c}>{getCategoryLabel(c)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">{t('admin.audit.filterAction', language)}</Label>
                <Select value={filterAction} onValueChange={setFilterAction}>
                  <SelectTrigger className="w-full mt-1"><SelectValue placeholder={t('admin.audit.allActions', language)} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('admin.audit.allActions', language)}</SelectItem>
                    {ACTIONS.map(a => (
                      <SelectItem key={a} value={a}>{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button variant="outline" onClick={() => { setFilterCategory(''); setFilterAction(''); setFilterDateFrom(''); setFilterDateTo(''); setFilterUser(''); setDatePeriod('all') }} className="w-full">
                  {isAr ? 'مسح التصفية' : 'Clear Filters'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Audit Log Table */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => (
            <Card key={i} className="animate-pulse"><CardContent className="p-4"><div className="h-16 bg-ae-black-100 rounded" /></CardContent></Card>
          ))}
        </div>
      ) : logs.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={t('admin.audit.noLogs', language)}
        />
      ) : (
        <div className="space-y-2 max-h-[600px] overflow-y-auto custom-scrollbar">
          {logs.map((log) => {
            const isExpanded = expandedRows.has(log.id)
            const ActionIcon = getActionIcon(log.action)
            const statusTransition = renderStatusTransition(log)
            return (
              <Card key={log.id} className="hover:shadow-sm transition-all">
                <CardContent className="p-3">
                  <div
                    className="flex items-center gap-3 cursor-pointer"
                    onClick={() => toggleRow(log.id)}
                  >
                    {/* Action icon */}
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${getActionBadgeColor(log.action).split(' ').slice(0, 2).join(' ')}`}>
                      {ActionIcon ? <ActionIcon className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                    </div>

                    <div className="min-w-0 flex-1">
                      {/* Top row: action badge, category, timestamp */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={`text-[10px] h-5 px-1.5 font-medium ${getActionBadgeColor(log.action)}`}>
                          {log.action}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] h-5 px-1.5 text-ae-black-400">
                          {getCategoryLabel(log.category)}
                        </Badge>
                        {log.requestId && (
                          <span className="text-[10px] text-ae-gold-600 font-mono cursor-pointer hover:underline" title={log.requestId}>
                            #{log.requestId.substring(0, 8)}
                          </span>
                        )}
                        {/* Status transition */}
                        {statusTransition}
                        <span className="text-xs text-ae-black-400 ms-auto">
                          {formatTimestamp(log.createdAt)}
                          {formatRelativeTime(log.createdAt) && (
                            <span className="text-ae-black-300 ms-1">({formatRelativeTime(log.createdAt)})</span>
                          )}
                        </span>
                      </div>

                      {/* Bottom row: performer info */}
                      <div className="flex items-center gap-2 mt-1">
                        <User className="w-3 h-3 text-ae-black-300 shrink-0" />
                        <span className="text-xs font-medium text-ae-black-600">
                          {getPerformerName(log)}
                        </span>
                        {getPerformerRole(log) && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1">
                            {getRoleLabel(getPerformerRole(log)!, language)}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {log.ipAddress && (
                        <span className="text-[10px] text-ae-black-300 hidden sm:inline">{log.ipAddress}</span>
                      )}
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-ae-black-300" /> : <ChevronDown className="w-4 h-4 text-ae-black-300" />}
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-ae-black-100 space-y-3">
                      {/* Status transition (larger view) */}
                      {statusTransition && (
                        <div>
                          <span className="text-[10px] text-ae-black-400 uppercase font-medium">
                            {isAr ? 'تغيير الحالة' : 'Status Change'}
                          </span>
                          <div className="mt-1 flex items-center gap-2">
                            <span className="px-2 py-1 rounded bg-red-50 text-red-700 border border-red-100 text-xs font-medium">
                              {log.previousValue ? getStatusLabel(log.previousValue) : '-'}
                            </span>
                            <span className="text-ae-black-300">→</span>
                            <span className="px-2 py-1 rounded bg-green-50 text-green-700 border border-green-100 text-xs font-medium">
                              {log.newValue ? getStatusLabel(log.newValue) : '-'}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Details */}
                      {log.details && (
                        <div>
                          <span className="text-[10px] text-ae-black-400 uppercase font-medium">{t('admin.audit.details', language)}</span>
                          <div className="mt-1 p-2 rounded bg-ae-black-50 border border-ae-black-100">
                            <p className="text-xs text-ae-black-600 break-words whitespace-pre-wrap font-mono">{formatJson(log.details) || log.details}</p>
                          </div>
                        </div>
                      )}

                      {/* Previous / New values (non-status) */}
                      {(!statusTransition || (log.previousValue && !['approved', 'rejected', 'escalated', 'pending', 'under_review', 'ai_assessed', 'status_change'].includes(log.action))) && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {log.previousValue && (
                            <div>
                              <span className="text-[10px] text-ae-black-400 uppercase font-medium">{t('admin.audit.previousValue', language)}</span>
                              <pre className="text-[10px] text-ae-black-500 mt-0.5 p-2 rounded bg-red-50 border border-red-100 overflow-x-auto max-h-32 font-mono">
                                {formatJson(log.previousValue)}
                              </pre>
                            </div>
                          )}
                          {log.newValue && (
                            <div>
                              <span className="text-[10px] text-ae-black-400 uppercase font-medium">{t('admin.audit.newValue', language)}</span>
                              <pre className="text-[10px] text-ae-black-500 mt-0.5 p-2 rounded bg-green-50 border border-green-100 overflow-x-auto max-h-32 font-mono">
                                {formatJson(log.newValue)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Metadata row */}
                      <div className="flex items-center gap-4 text-[10px] text-ae-black-300 flex-wrap">
                        <span>{t('admin.audit.ipAddress', language)}: {log.ipAddress || '-'}</span>
                        <span>{t('admin.audit.affectedRecord', language)}: {log.affectedRecord || '-'}</span>
                        {log.requestId && (
                          <span>{isAr ? 'معرف الطلب' : 'Request ID'}: {log.requestId}</span>
                        )}
                        <span>{isAr ? 'بواسطة' : 'By'}: {log.performedBy || log.performedByUserId || '-'}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}

          {/* Load More */}
          {logs.length >= limit && (
            <div className="text-center py-4">
              <Button
                variant="outline"
                onClick={() => setLimit(prev => prev + 50)}
                className="border-ae-gold-500 text-ae-gold-600 hover:bg-ae-gold-50"
              >
                {t('admin.audit.loadMore', language)}
              </Button>
            </div>
          )}
        </div>
      )}
    </motion.div>
  )
}
