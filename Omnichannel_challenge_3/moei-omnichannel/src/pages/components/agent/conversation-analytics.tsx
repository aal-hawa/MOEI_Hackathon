'use client'

import { useMemo } from 'react'
import { Activity, Clock, Timer, ArrowRightLeft } from 'lucide-react'
import { useTranslation } from '@/i18n'
import { useAppStore } from '@/store/app-store'

export default function ConversationAnalytics() {
  const { t } = useTranslation()
  const activeConversations = useAppStore((s) => s.activeConversations)

  // Compute real-time stats from active conversations
  const stats = useMemo(() => {
    const total = activeConversations.length
    const avgDuration = total > 0
      ? Math.round(activeConversations.reduce((sum, c) => sum + c.duration, 0) / total)
      : 0
    const avgM = Math.floor(avgDuration / 60)
    const avgS = avgDuration % 60
    const transfers = activeConversations.filter(c => c.intent === 'complaint').length

    return [
      { label: t('totalConversations'), value: String(total), icon: Activity, color: 'text-ae-gold-600' },
      { label: t('avgHandleTime'), value: total > 0 ? `${avgM}:${avgS.toString().padStart(2, '0')}` : '--:--', icon: Timer, color: 'text-ae-black-500' },
      { label: t('firstResponseTime'), value: total > 0 ? `${Math.floor(avgDuration / 60)}:${(avgDuration % 60).toString().padStart(2, '0')}` : '--:--', icon: Clock, color: 'text-ae-black-500' },
      { label: t('transfers'), value: String(transfers), icon: ArrowRightLeft, color: 'text-ae-black-500' },
    ]
  }, [activeConversations, t])

  return (
    <div className="px-3 py-2.5 border-b border-ae-black-100 bg-white">
      <div className="flex items-center gap-1.5 mb-2">
        <Activity className="w-3.5 h-3.5 text-ae-gold-500" />
        <span className="text-[11px] font-semibold text-foreground">{t('analyticsTitle')}</span>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className="text-center p-1.5 rounded-md bg-ae-black-50/50">
              <Icon className={`w-3 h-3 mx-auto mb-0.5 ${stat.color}`} />
              <p className="text-sm font-bold text-foreground leading-none">{stat.value}</p>
              <p className="text-[8px] text-ae-black-400 mt-0.5 leading-tight truncate">{stat.label}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
