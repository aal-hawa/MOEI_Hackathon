'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Server,
  Brain,
  MessageCircle,
  Phone,
  Globe,
  Mail,
  Database,
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { useTranslation } from '@/i18n'

// ─── Types ───────────────────────────────────────────────────────────────────
type HealthStatus = 'healthy' | 'degraded' | 'down'

interface ServiceHealth {
  id: string
  name: string
  icon: React.ElementType
  status: HealthStatus
  metrics: { label: string; value: string; trend?: 'up' | 'down' }[]
  latency: number
  uptime: number
  requestCount: number
  errorRate: number
  sparkData: number[]
}

interface Incident {
  id: string
  severity: 'critical' | 'warning' | 'info'
  service: string
  description: string
  timestamp: string
  duration: string
  resolved: boolean
}

// ─── Sparkline Component ─────────────────────────────────────────────────────
function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const w = 60
  const h = 20
  const pad = 2

  const points = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2)
    const y = h - pad - ((v - min) / range) * (h - pad * 2)
    return `${x},${y}`
  })

  return (
    <svg width={w} height={h} className="opacity-70">
      <path d={`M${points.join(' L')}`} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─── Status Dot ──────────────────────────────────────────────────────────────
function StatusDot({ status }: { status: HealthStatus }) {
  const colors: Record<HealthStatus, string> = {
    healthy: 'bg-uae-green-500',
    degraded: 'bg-camel-yellow',
    down: 'bg-uae-red-500',
  }
  const pulseClass = status === 'down' ? 'animate-ping' : status === 'degraded' ? 'animate-pulse' : ''

  return (
    <span className="relative flex h-3 w-3">
      {status !== 'healthy' && (
        <span className={`absolute inline-flex h-full w-full rounded-full ${colors[status]} opacity-75 ${pulseClass}`} />
      )}
      <span className={`relative inline-flex h-3 w-3 rounded-full ${colors[status]}`} />
    </span>
  )
}

// ─── Service Health Card ─────────────────────────────────────────────────────
function ServiceHealthCard({ service }: { service: ServiceHealth }) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const Icon = service.icon

  const statusLabel: Record<HealthStatus, string> = {
    healthy: t('systemHealthy'),
    degraded: t('systemDegraded'),
    down: t('systemDown'),
  }

  const sparkColor = service.status === 'healthy' ? '#16a34a' : service.status === 'degraded' ? '#eab308' : '#dc2626'

  return (
    <motion.div layout transition={{ duration: 0.2 }}>
      <Card
        className="py-3 cursor-pointer transition-shadow hover:shadow-md"
        onClick={() => setExpanded(!expanded)}
      >
        <CardContent className="px-4 pt-0">
          <div className="flex items-center gap-3">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
              service.status === 'healthy' ? 'bg-uae-green-50 dark:bg-uae-green-950/30' :
              service.status === 'degraded' ? 'bg-amber-50 dark:bg-amber-950/30' :
              'bg-uae-red-50 dark:bg-uae-red-950/30'
            }`}>
              <Icon className={`h-4 w-4 ${
                service.status === 'healthy' ? 'text-uae-green-600' :
                service.status === 'degraded' ? 'text-amber-600' :
                'text-uae-red-600'
              }`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-foreground truncate">{service.name}</p>
                <StatusDot status={service.status} />
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-[10px] text-muted-foreground">{service.latency}ms</span>
                <span className="text-[10px] text-muted-foreground">{service.uptime}%</span>
                <MiniSparkline data={service.sparkData} color={sparkColor} />
              </div>
            </div>
            <div className="shrink-0">
              {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </div>
          </div>

          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="mt-3 pt-3 border-t border-border">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant={service.status === 'healthy' ? 'secondary' : service.status === 'degraded' ? 'outline' : 'destructive'} className="text-[10px]">
                      {statusLabel[service.status]}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {t('requests')}: {service.requestCount.toLocaleString()} · {t('errorRate')}: {service.errorRate}%
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {service.metrics.map((m) => (
                      <div key={m.label} className="rounded-md border p-2 bg-muted/30">
                        <p className="text-[9px] text-muted-foreground">{m.label}</p>
                        <div className="flex items-center gap-1">
                          <p className="text-xs font-semibold text-foreground">{m.value}</p>
                          {m.trend === 'up' && <TrendingUp className="h-2.5 w-2.5 text-uae-green-500" />}
                          {m.trend === 'down' && <TrendingDown className="h-2.5 w-2.5 text-uae-red-500" />}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ─── Incident Timeline ───────────────────────────────────────────────────────
function IncidentTimeline({ incidents }: { incidents: Incident[] }) {
  const { t } = useTranslation()

  const severityColors: Record<string, string> = {
    critical: 'bg-uae-red-500',
    warning: 'bg-camel-yellow',
    info: 'bg-brand-500',
  }
  const severityBadgeVariant: Record<string, 'destructive' | 'secondary' | 'outline'> = {
    critical: 'destructive',
    warning: 'secondary',
    info: 'outline',
  }

  return (
    <Card className="py-4">
      <CardHeader className="px-4 pb-0 pt-0">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          {t('incidentTimeline')}
        </CardTitle>
        <CardDescription className="text-xs">{t('recentSystemIncidents')}</CardDescription>
      </CardHeader>
      <CardContent className="px-4 pt-2">
        <ScrollArea className="max-h-72">
          <div className="space-y-2">
            {incidents.map((inc) => (
              <div key={inc.id} className="flex items-start gap-3 p-2.5 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                <div className="flex flex-col items-center pt-0.5">
                  <div className={`h-2.5 w-2.5 rounded-full ${severityColors[inc.severity]}`} />
                  <div className="w-px flex-1 bg-border mt-1 min-h-3" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <Badge variant={severityBadgeVariant[inc.severity]} className="text-[9px] px-1.5 py-0">
                      {inc.severity === 'critical' ? t('critical') : inc.severity === 'warning' ? t('warning') : t('info')}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground font-medium">{inc.service}</span>
                    {inc.resolved && (
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-uae-green-600 border-uae-green-300">
                        {t('resolved')}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-foreground">{inc.description}</p>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" />{inc.timestamp}</span>
                    <span>{t('duration')}: {inc.duration}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

// ─── Uptime Summary Bar ──────────────────────────────────────────────────────
function UptimeSummaryBar() {
  const { t } = useTranslation()

  const segments = useMemo(() => {
    const uptime = 100
    const degraded = 0
    const downtime = 0
    return [
      { pct: uptime, color: 'bg-uae-green-500', label: t('uptime') },
      { pct: degraded, color: 'bg-camel-yellow', label: t('degraded') },
      { pct: downtime, color: 'bg-uae-red-500', label: t('downtime') },
    ]
  }, [t])

  return (
    <Card className="py-4">
      <CardHeader className="px-4 pb-0 pt-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-brand-600" />
            {t('uptimeSummary30d')}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-[10px]">
              {t('slaTarget')}: 99.9%
            </Badge>
            <Badge className="text-[10px] bg-uae-green-500/10 text-uae-green-600 border-uae-green-200">
              100% {t('actual')}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pt-3">
        <div className="h-6 w-full flex overflow-hidden rounded-full">
          {segments.map((seg, i) => (
            <div
              key={i}
              className={`${seg.color} transition-all duration-500 relative group`}
              style={{ width: `${seg.pct}%` }}
              title={`${seg.label}: ${seg.pct}%`}
            >
              {seg.pct > 5 && (
                <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white">
                  {seg.pct}%
                </span>
              )}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 mt-2 justify-center">
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded bg-uae-green-500" />
            <span className="text-[10px] text-muted-foreground">{t('uptime')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded bg-camel-yellow" />
            <span className="text-[10px] text-muted-foreground">{t('degraded')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded bg-uae-red-500" />
            <span className="text-[10px] text-muted-foreground">{t('downtime')}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Response Time Trend Chart ───────────────────────────────────────────────
function ResponseTimeTrend() {
  const { t } = useTranslation()

  const data = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => i)
    return hours.map((h) => ({
      hour: `${String(h).padStart(2, '0')}:00`,
      ai: 0,
      whatsapp: 0,
      voice: 0,
      web: 0,
      email: 0,
      db: 0,
    }))
  }, [])

  return (
    <Card className="py-4">
      <CardHeader className="px-4 pb-0 pt-0">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-brand-600" />
          {t('responseTimeTrend24h')}
        </CardTitle>
        <CardDescription className="text-xs">{t('avgResponseTimeAllServices')}</CardDescription>
      </CardHeader>
      <CardContent className="px-4 pt-2">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-base-100)" />
              <XAxis dataKey="hour" tick={{ fontSize: 9, fill: 'var(--color-base-400)' }} tickLine={false} axisLine={false} interval={3} />
              <YAxis tick={{ fontSize: 9, fill: 'var(--color-base-400)' }} tickLine={false} axisLine={false} width={30} unit="ms" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--color-base-50)',
                  border: '1px solid var(--color-base-200)',
                  borderRadius: '8px',
                  fontSize: '11px',
                }}
              />
              <Line type="monotone" dataKey="ai" stroke="#8B5CF6" strokeWidth={1.5} dot={false} name={t('aiLlmService')} />
              <Line type="monotone" dataKey="whatsapp" stroke="#22C55E" strokeWidth={1.5} dot={false} name={t('whatsappIntegration')} />
              <Line type="monotone" dataKey="voice" stroke="#286CFF" strokeWidth={1.5} dot={false} name={t('voiceTelephony')} />
              <Line type="monotone" dataKey="web" stroke="#F29F0E" strokeWidth={1.5} dot={false} name={t('webChatService')} />
              <Line type="monotone" dataKey="email" stroke="#EC4899" strokeWidth={1.5} dot={false} name={t('emailService')} />
              <Line type="monotone" dataKey="db" stroke="#0D9488" strokeWidth={1.5} dot={false} name={t('databaseService')} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function SystemHealthDashboard() {
  const { t } = useTranslation()

  const services: ServiceHealth[] = useMemo(() => [], [])

  const incidents: Incident[] = useMemo(() => [], [])

  const healthyCount = services.filter(s => s.status === 'healthy').length
  const degradedCount = services.filter(s => s.status === 'degraded').length
  const downCount = services.filter(s => s.status === 'down').length

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 dark:bg-brand-950/30">
          <Server className="h-4 w-4 text-brand-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">{t('systemHealthDashboard')}</h3>
          <p className="text-xs text-muted-foreground">{t('systemHealthDesc')}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Badge variant="secondary" className="text-[10px] gap-1">
            <CheckCircle2 className="h-3 w-3 text-uae-green-500" />{healthyCount} {t('healthy')}
          </Badge>
          {degradedCount > 0 && (
            <Badge variant="outline" className="text-[10px] gap-1 border-amber-300 text-amber-600">
              <AlertTriangle className="h-3 w-3" />{degradedCount} {t('degraded')}
            </Badge>
          )}
          {downCount > 0 && (
            <Badge variant="destructive" className="text-[10px] gap-1">
              <XCircle className="h-3 w-3" />{downCount} {t('down')}
            </Badge>
          )}
        </div>
      </div>

      {/* Service Health Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {services.map((service) => (
          <ServiceHealthCard key={service.id} service={service} />
        ))}
      </div>

      {/* Uptime Summary Bar */}
      <UptimeSummaryBar />

      {/* Two-column layout for incidents and response time */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <IncidentTimeline incidents={incidents} />
        <ResponseTimeTrend />
      </div>
    </div>
  )
}
