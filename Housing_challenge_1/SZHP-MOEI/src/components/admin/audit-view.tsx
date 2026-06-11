'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAppStore } from '@/lib/store'
import { authFetch } from '@/lib/utils'
import { useAuthStore } from '@/lib/auth-store'
import { t } from '@/lib/i18n'
import { hasPermission, getRoleLabel } from '@/lib/rbac'
import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  FileText, Activity, Clock, User, Filter, ChevronDown, ChevronUp, Zap, Calendar, TrendingUp
} from 'lucide-react'

interface AuditLogEntry {
  id: string
  action: string
  category: string
  details: string | null
  affectedRecord: string | null
  previousValue: string | null
  newValue: string | null
  ipAddress: string | null
  performedByUserId: string
  createdAt: string
  user?: {
    id: string
    firstnameEN: string
    lastnameEN: string
    firstnameAR: string | null
    lastnameAR: string | null
    role: string
  }
}

interface AuditStats {
  actions24h: number
  actions7d: number
  actions30d: number
  mostActiveUser: { name: string; role: string; count: number } | null
}

const CATEGORIES = ['request', 'auth', 'user_management', 'settings', 'field_config', 'system', 'general']
const ACTIONS = ['login', 'logout', 'create', 'update', 'delete', 'approve', 'reject', 'escalate', 'assess', 'seed', 'register', 'activate', 'deactivate', 'viewed']

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
    if (action.includes('create') || action.includes('register') || action.includes('activate')) return 'bg-green-500/10 text-green-600 border-green-500/20'
    if (action.includes('delete') || action.includes('reject') || action.includes('deactivate')) return 'bg-red-500/10 text-red-600 border-red-500/20'
    if (action.includes('update') || action.includes('approve') || action.includes('assess')) return 'bg-blue-500/10 text-blue-600 border-blue-500/20'
    if (action.includes('login') || action.includes('logout') || action.includes('auth')) return 'bg-purple-500/10 text-purple-600 border-purple-500/20'
    if (action.includes('viewed')) return 'bg-teal-500/10 text-teal-600 border-teal-500/20'
    return 'bg-gray-500/10 text-gray-600 border-gray-500/20'
  }

  const formatJson = (val: string | null) => {
    if (!val) return null
    try {
      return JSON.stringify(JSON.parse(val), null, 2)
    } catch {
      return val
    }
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Zap className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-700">{stats?.actions24h ?? '-'}</div>
              <div className="text-xs text-blue-600">{t('admin.audit.actions24h', language)}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-purple-200 bg-purple-50/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Activity className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-700">{stats?.actions7d ?? '-'}</div>
              <div className="text-xs text-purple-600">{t('admin.audit.actions7d', language)}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-ae-gold-200 bg-ae-gold-50/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-ae-gold-500/10 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-ae-gold-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-ae-gold-700">{stats?.actions30d ?? '-'}</div>
              <div className="text-xs text-ae-gold-600">{t('admin.audit.actions30d', language)}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="text-lg font-bold text-green-700 truncate max-w-[80px] sm:max-w-[120px]">{stats?.mostActiveUser?.name || '-'}</div>
              <div className="text-xs text-green-600">{t('admin.audit.mostActive', language)}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      {showFilters && (
        <Card className="border-ae-gold-200">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
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
              <div>
                <Label className="text-xs">{t('admin.audit.filterDateFrom', language)}</Label>
                <Input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">{t('admin.audit.filterDateTo', language)}</Label>
                <Input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="mt-1" />
              </div>
              <div className="flex items-end">
                <Button variant="outline" onClick={() => { setFilterCategory(''); setFilterAction(''); setFilterDateFrom(''); setFilterDateTo(''); setFilterUser('') }} className="w-full">
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
            <Card key={i} className="animate-pulse"><CardContent className="p-4"><div className="h-12 bg-ae-black-100 rounded" /></CardContent></Card>
          ))}
        </div>
      ) : logs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-ae-black-400">
            <FileText className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium">{t('admin.audit.noLogs', language)}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2 max-h-[600px] overflow-y-auto custom-scrollbar">
          {logs.map((log) => {
            const isExpanded = expandedRows.has(log.id)
            return (
              <Card key={log.id} className="hover:shadow-sm transition-all">
                <CardContent className="p-3">
                  <div
                    className="flex items-center gap-3 cursor-pointer"
                    onClick={() => toggleRow(log.id)}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={`text-[10px] h-5 px-1.5 ${getActionBadgeColor(log.action)}`}>
                          {log.action}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] h-5 px-1.5 text-ae-black-400">
                          {getCategoryLabel(log.category)}
                        </Badge>
                        <span className="text-xs text-ae-black-400">
                          {new Date(log.createdAt).toLocaleString(isAr ? 'ar-AE' : 'en-US')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {log.user ? (
                          <span className="text-xs font-medium text-ae-black-600">
                            {isAr && log.user.firstnameAR ? `${log.user.firstnameAR} ${log.user.lastnameAR}` : `${log.user.firstnameEN} ${log.user.lastnameEN}`}
                          </span>
                        ) : (
                          <span className="text-xs text-ae-black-400">{log.performedByUserId?.substring(0, 8) || '-'}</span>
                        )}
                        {log.user?.role && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1">
                            {getRoleLabel(log.user.role, language)}
                          </Badge>
                        )}
                        {log.affectedRecord && (
                          <span className="text-[10px] text-ae-black-300">
                            → {log.affectedRecord.substring(0, 20)}{log.affectedRecord.length > 20 ? '...' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {log.ipAddress && (
                        <span className="text-[10px] text-ae-black-300">{log.ipAddress}</span>
                      )}
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-ae-black-300" /> : <ChevronDown className="w-4 h-4 text-ae-black-300" />}
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-ae-black-100 space-y-2">
                      {log.details && (
                        <div>
                          <span className="text-[10px] text-ae-black-400 uppercase">{t('admin.audit.details', language)}</span>
                          <p className="text-xs text-ae-black-600 mt-0.5 break-words">{log.details}</p>
                        </div>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {log.previousValue && (
                          <div>
                            <span className="text-[10px] text-ae-black-400 uppercase">{t('admin.audit.previousValue', language)}</span>
                            <pre className="text-[10px] text-ae-black-500 mt-0.5 p-2 rounded bg-red-50 border border-red-100 overflow-x-auto max-h-32">
                              {formatJson(log.previousValue)}
                            </pre>
                          </div>
                        )}
                        {log.newValue && (
                          <div>
                            <span className="text-[10px] text-ae-black-400 uppercase">{t('admin.audit.newValue', language)}</span>
                            <pre className="text-[10px] text-ae-black-500 mt-0.5 p-2 rounded bg-green-50 border border-green-100 overflow-x-auto max-h-32">
                              {formatJson(log.newValue)}
                            </pre>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-[10px] text-ae-black-300">
                        <span>{t('admin.audit.ipAddress', language)}: {log.ipAddress || '-'}</span>
                        <span>{t('admin.audit.affectedRecord', language)}: {log.affectedRecord || '-'}</span>
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
