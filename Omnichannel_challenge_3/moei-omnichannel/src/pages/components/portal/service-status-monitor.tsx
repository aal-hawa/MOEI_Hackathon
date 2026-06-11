'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  Zap,
  Droplets,
  Home,
  Globe,
  MessageSquare,
  Phone,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Bell,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { useTranslation } from '@/i18n'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

// ─── Types ───────────────────────────────────────────────────────────────────

type ServiceStatus = 'operational' | 'degraded' | 'down'

interface ServiceStatusEntry {
  id: string
  nameKey: string
  icon: React.ElementType
  status: ServiceStatus
  uptime: number
  lastIncidentHours: number | null // null means never
  color: string
}

// Removed generateInitialStatuses and simulateStatusChange

// ─── Status configuration ────────────────────────────────────────────────────

const statusConfig: Record<ServiceStatus, { labelKey: string; dotColor: string; bgColor: string; textColor: string }> = {
  operational: {
    labelKey: 'operational',
    dotColor: 'bg-emerald-500',
    bgColor: 'bg-emerald-50',
    textColor: 'text-emerald-700',
  },
  degraded: {
    labelKey: 'degraded',
    dotColor: 'bg-[#92722A]',
    bgColor: 'bg-[#92722A]/5',
    textColor: 'text-[#92722A]',
  },
  down: {
    labelKey: 'down',
    dotColor: 'bg-red-500',
    bgColor: 'bg-red-50',
    textColor: 'text-red-700',
  },
}

// ─── Animation variants ─────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.35, ease: 'easeOut' as const },
  }),
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ServiceStatusMonitor() {
  const { t, isRTL, language } = useTranslation()
  const [statuses, setStatuses] = useState<ServiceStatusEntry[]>([])
  const [subscribed, setSubscribed] = useState(false)
  const [lastRefresh, setLastRefresh] = useState(new Date())

  const fetchHealth = useCallback(() => {
    fetch('/api/system-health')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const ICON_MAP: Record<string, React.ElementType> = {
            Zap, Droplets, Home, Globe, MessageSquare, Phone, Activity
          }
          setStatuses(data.map((h: any) => ({
            id: h.id,
            nameKey: h.nameKey,
            icon: ICON_MAP[h.icon] || Activity,
            status: h.status as ServiceStatus,
            uptime: h.uptime,
            lastIncidentHours: h.lastIncidentHours,
            color: h.color
          })))
          setLastRefresh(new Date())
        }
      })
      .catch(console.error)
  }, [])

  useEffect(() => {
    fetchHealth()
    const interval = setInterval(fetchHealth, 30000) // every 30 seconds
    return () => clearInterval(interval)
  }, [fetchHealth])

  // Calculate overall status
  const overallStatus: ServiceStatus = (() => {
    if (statuses.some((s) => s.status === 'down')) return 'down'
    if (statuses.some((s) => s.status === 'degraded')) return 'degraded'
    return 'operational'
  })()

  const overallConfig = statusConfig[overallStatus]

  // Format last incident time
  const formatLastIncident = (hours: number | null): string => {
    if (hours === null) return t('never')
    if (hours < 1) return t('hoursAgo').replace('{count}', '<1')
    if (hours < 24) return t('hoursAgo').replace('{count}', String(Math.round(hours)))
    return t('daysAgo').replace('{count}', String(Math.round(hours / 24)))
  }

  // Format last refresh time
  const formatRefreshTime = (): string => {
    return lastRefresh.toLocaleTimeString(language === 'ar' ? 'ar-AE' : 'en-AE', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  const handleSubscribe = () => {
    setSubscribed(true)
    setTimeout(() => setSubscribed(false), 3000)
  }

  const handleRefresh = () => {
    fetchHealth()
  }

  return (
    <div className={`w-full ${isRTL ? 'rtl font-arabic' : ''}`} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* ── Overall Status Banner ──────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-xl p-4 mb-6 flex items-center justify-between ${overallConfig.bgColor} border border-current/10`}
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className={`w-3 h-3 rounded-full ${overallConfig.dotColor}`} />
            <div className={`absolute inset-0 w-3 h-3 rounded-full ${overallConfig.dotColor} animate-ping opacity-40`} />
          </div>
          <div>
            <h3 className={`font-semibold text-sm ${overallConfig.textColor}`}>
              {overallStatus === 'operational'
                ? t('allSystemsOperational')
                : overallStatus === 'degraded'
                  ? t('someServicesDegraded')
                  : t('majorOutage')}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5" suppressHydrationWarning>
              {t('lastUpdated')}: {formatRefreshTime()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs gap-1"
            onClick={handleRefresh}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('retry')}</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className={`h-8 text-xs gap-1 ${subscribed ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : ''}`}
            onClick={handleSubscribe}
            disabled={subscribed}
          >
            <Bell className="w-3.5 h-3.5" />
            {subscribed ? t('subscribedSuccess') : t('subscribeUpdates')}
          </Button>
        </div>
      </motion.div>

      {/* ── Service Status Grid ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {statuses.map((service, i) => {
          const StatusIcon = service.icon
          const config = statusConfig[service.status]

          return (
            <motion.div
              key={service.id}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={i}
            >
              <Card className="border-0 shadow-sm hover:shadow-md transition-all duration-300 bg-white group">
                <CardContent className="p-4">
                  {/* Service header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-lg ${config.bgColor} flex items-center justify-center`}>
                        <StatusIcon className={`w-4 h-4 ${config.textColor}`} />
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-base-900">
                          {t(service.nameKey as Parameters<typeof t>[0])}
                        </h4>
                      </div>
                    </div>

                    {/* Status dot with pulse for non-operational */}
                    <div className="relative flex items-center">
                      <motion.div
                        className={`w-2.5 h-2.5 rounded-full ${config.dotColor}`}
                        animate={service.status !== 'operational' ? { scale: [1, 1.3, 1] } : {}}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                    </div>
                  </div>

                  {/* Status badge */}
                  <Badge
                    variant="outline"
                    className={`text-[10px] mb-2 border-0 ${config.bgColor} ${config.textColor}`}
                  >
                    {t(config.labelKey as Parameters<typeof t>[0])}
                  </Badge>

                  {/* Stats row */}
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>
                      {t('uptime')}: <span className="font-medium text-base-700">{service.uptime}%</span>
                    </span>
                    <span>
                      {t('lastIncident')}: {formatLastIncident(service.lastIncidentHours)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

export { ServiceStatusMonitor }
