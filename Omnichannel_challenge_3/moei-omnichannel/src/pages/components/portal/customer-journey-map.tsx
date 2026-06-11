'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  CheckCircle2,
  MessageSquareHeart,
  Compass,
  ClipboardList,
  Eye,
  Gift,
  FolderOpen,
} from 'lucide-react'
import { useTranslation } from '@/i18n'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

// ─── Types ───────────────────────────────────────────────────────────────────

interface JourneyStage {
  id: string
  iconKey: string
  titleKey: string
  descKey: string
  detailKey: string
  percentage: number
}

interface CaseRecord {
  id: string
  referenceNumber: string
  titleEn: string
  titleAr?: string
  description?: string
  status: string
  priority: string
  channel: string
  category?: string
  createdAt: string
  updatedAt?: string
  assignedAgent?: string
  resolvedAt?: string
}

interface CustomerJourneyMapProps {
  cases?: CaseRecord[]
  isAuthenticated?: boolean
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function CustomerJourneyMap({ cases = [], isAuthenticated = false }: CustomerJourneyMapProps) {
  const { t, isRTL } = useTranslation()
  const [selectedStage, setSelectedStage] = useState<string | null>(null)

  // Calculate journey progress based on actual user cases
  const { stages, currentStageIndex } = useMemo(() => {
    const defaultStages: JourneyStage[] = [
      { id: 'discover', iconKey: 'Compass', titleKey: 'journeyDiscover', descKey: 'journeyDiscoverDesc', detailKey: 'journeyDiscoverDetail', percentage: 0 },
      { id: 'apply', iconKey: 'ClipboardList', titleKey: 'journeyApply', descKey: 'journeyApplyDesc', detailKey: 'journeyApplyDetail', percentage: 0 },
      { id: 'track', iconKey: 'Eye', titleKey: 'journeyTrack', descKey: 'journeyTrackDesc', detailKey: 'journeyTrackDetail', percentage: 0 },
      { id: 'receive', iconKey: 'Gift', titleKey: 'journeyReceive', descKey: 'journeyReceiveDesc', detailKey: 'journeyReceiveDetail', percentage: 0 },
      { id: 'feedback', iconKey: 'MessageSquareHeart', titleKey: 'journeyFeedback', descKey: 'journeyFeedbackDesc', detailKey: 'journeyFeedbackDetail', percentage: 0 },
    ]

    // No cases → user is at the "Discover" stage with 0%
    if (!cases || cases.length === 0) {
      defaultStages[0].percentage = 20 // Partial discovery — they're on the portal
      return { stages: defaultStages, currentStageIndex: 0 }
    }

    const totalCases = cases.length
    const openCases = cases.filter(c => c.status === 'open').length
    const inProgressCases = cases.filter(c => c.status === 'in_progress').length
    const resolvedCases = cases.filter(c => c.status === 'resolved').length
    const escalatedCases = cases.filter(c => c.status === 'escalated').length
    const assignedCases = cases.filter(c => c.assignedAgent).length

    // Discover: user found the portal and services — always 100% if they have cases
    defaultStages[0].percentage = 100

    // Apply: based on whether they've submitted cases
    const applyProgress = Math.min(100, Math.round((totalCases / Math.max(totalCases, 1)) * 100))
    defaultStages[1].percentage = applyProgress

    // Track: based on whether cases are being tracked (assigned/in-progress)
    const trackProgress = totalCases > 0
      ? Math.round(((assignedCases + inProgressCases) / totalCases) * 100)
      : 0
    defaultStages[2].percentage = Math.min(trackProgress, 100)

    // Receive: based on resolved cases
    const receiveProgress = totalCases > 0
      ? Math.round((resolvedCases / totalCases) * 100)
      : 0
    defaultStages[3].percentage = Math.min(receiveProgress, 100)

    // Feedback: based on resolved cases (opportunity to give feedback)
    const feedbackProgress = resolvedCases > 0
      ? Math.min(80, Math.round((resolvedCases / totalCases) * 60)) // Partial since feedback is optional
      : 0
    defaultStages[4].percentage = feedbackProgress

    // Determine current stage based on the highest incomplete stage
    let currentStage = 0
    for (let i = 0; i < defaultStages.length; i++) {
      if (defaultStages[i].percentage > 0) {
        currentStage = i
      }
    }
    // If all stages have some progress but none complete, current is the first incomplete
    if (currentStage === 0 && defaultStages[0].percentage === 100) {
      currentStage = 1
    }
    // If Apply is complete but Track isn't done, current is Track
    if (defaultStages[1].percentage === 100 && defaultStages[2].percentage < 100) {
      currentStage = 2
    }
    // If Track is done but Receive isn't, current is Receive
    if (defaultStages[2].percentage === 100 && defaultStages[3].percentage < 100) {
      currentStage = 3
    }
    // If Receive is done, current is Feedback
    if (defaultStages[3].percentage === 100) {
      currentStage = 4
    }

    return { stages: defaultStages, currentStageIndex: currentStage }
  }, [cases])

  const iconMap: Record<string, React.ElementType> = {
    Compass,
    ClipboardList,
    Eye,
    Gift,
    MessageSquareHeart,
  }

  const getStatusColor = (index: number) => {
    if (index < currentStageIndex) return 'bg-uae-green-500 text-white'
    if (index === currentStageIndex) return 'bg-brand-600 text-white'
    return 'bg-base-200 text-base-400'
  }

  const getProgressColor = (index: number) => {
    if (index < currentStageIndex) return 'bg-uae-green-500'
    if (index === currentStageIndex) return 'bg-brand-600'
    return 'bg-base-200'
  }

  const getConnectorColor = (index: number) => {
    if (index < currentStageIndex) return 'bg-uae-green-500'
    if (index === currentStageIndex) return 'bg-gradient-to-r from-uae-green-500 to-brand-400'
    return 'bg-base-200'
  }

  // Show empty state when user has no cases
  if (!cases || cases.length === 0) {
    return (
      <Card className="border-0 shadow-sm bg-card">
        <CardContent className="p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-brand-50 flex items-center justify-center mx-auto mb-4">
            <FolderOpen className="w-8 h-8 text-brand-600" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">{t('journeyNoCasesTitle') || 'Start Your Service Journey'}</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
            {t('journeyNoCasesDesc') || 'You haven\'t submitted any service requests yet. Create your first case to begin tracking your journey with MOEI.'}
          </p>
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Compass className="w-3.5 h-3.5" />
            <span>{t('journeyDiscover') || 'Discover'} → {t('journeyApply') || 'Apply'} → {t('journeyTrack') || 'Track'} → {t('journeyReceive') || 'Receive'} → {t('journeyFeedback') || 'Feedback'}</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="w-full">
      {/* ── Case Summary Header ──────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Badge variant="outline" className="text-xs border-brand-300 text-brand-700">
          {cases.length} {cases.length === 1 ? (t('case') || 'case') : (t('cases') || 'cases')}
        </Badge>
        {cases.filter(c => c.status === 'open').length > 0 && (
          <Badge variant="outline" className="text-xs border-blue-300 text-blue-700">
            {cases.filter(c => c.status === 'open').length} {t('open') || 'open'}
          </Badge>
        )}
        {cases.filter(c => c.status === 'in_progress').length > 0 && (
          <Badge variant="outline" className="text-xs border-yellow-300 text-yellow-700">
            {cases.filter(c => c.status === 'in_progress').length} {t('inProgress') || 'in progress'}
          </Badge>
        )}
        {cases.filter(c => c.status === 'resolved').length > 0 && (
          <Badge variant="outline" className="text-xs border-green-300 text-green-700">
            {cases.filter(c => c.status === 'resolved').length} {t('resolved') || 'resolved'}
          </Badge>
        )}
        {cases.filter(c => c.status === 'escalated').length > 0 && (
          <Badge variant="outline" className="text-xs border-red-300 text-red-700">
            {cases.filter(c => c.status === 'escalated').length} {t('escalated') || 'escalated'}
          </Badge>
        )}
      </div>

      {/* ── Desktop Journey Map (horizontal) ──────────────────────────────── */}
      <div className="hidden md:block">
        <div className="flex items-start justify-between relative">
          {/* Connecting lines behind the cards */}
          <div className="absolute top-10 left-[10%] right-[10%] h-1 flex items-center z-0">
            {stages.slice(0, -1).map((_, i) => (
              <div
                key={`connector-${i}`}
                className={`flex-1 h-1 rounded-full mx-2 ${getConnectorColor(i)}`}
              >
                {/* Animated pulse on current connector */}
                {i === currentStageIndex && (
                  <motion.div
                    className="h-full w-4 rounded-full bg-brand-400"
                    animate={{ x: [0, 60, 0] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                    style={{ opacity: 0.6 }}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Stage cards */}
          {stages.map((stage, i) => {
            const Icon = iconMap[stage.iconKey]
            const isCurrent = i === currentStageIndex
            const isCompleted = i < currentStageIndex
            const isSelected = selectedStage === stage.id

            return (
              <motion.div
                key={stage.id}
                className="flex-1 z-10 relative"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.12, duration: 0.5 }}
              >
                <button
                  onClick={() => setSelectedStage(isSelected ? null : stage.id)}
                  className="w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-xl"
                >
                  <Card
                    className={`relative transition-all duration-300 cursor-pointer border-0 shadow-sm hover:shadow-md mx-1 ${
                      isCurrent ? 'ring-2 ring-brand-400 shadow-lg' : ''
                    } ${isSelected ? 'ring-2 ring-brand-500 shadow-lg' : ''} ${
                      isCompleted ? 'bg-uae-green-50/50 dark:bg-uae-green-950/20' : 'bg-card'
                    }`}
                  >
                    {/* Glow effect for current stage */}
                    {isCurrent && (
                      <div className="absolute inset-0 rounded-xl bg-brand-400/10 animate-pulse" />
                    )}

                    <CardContent className="p-4 flex flex-col items-center text-center relative z-10">
                      {/* Icon circle */}
                      <div
                        className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 transition-all duration-300 ${getStatusColor(i)} ${
                          isCurrent ? 'shadow-lg shadow-brand-400/30' : ''
                        }`}
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="w-6 h-6" />
                        ) : (
                          <Icon className="w-6 h-6" />
                        )}
                      </div>

                      {/* Title */}
                      <h4 className="text-sm font-semibold text-foreground mb-1">
                        {t(stage.titleKey as Parameters<typeof t>[0])}
                      </h4>

                      {/* Description */}
                      <p className="text-[11px] text-muted-foreground leading-tight mb-2">
                        {t(stage.descKey as Parameters<typeof t>[0])}
                      </p>

                      {/* Progress bar */}
                      <div className="w-full h-1.5 bg-base-100 rounded-full overflow-hidden mb-1">
                        <motion.div
                          className={`h-full rounded-full ${getProgressColor(i)}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${stage.percentage}%` }}
                          transition={{ delay: i * 0.12 + 0.3, duration: 0.8, ease: 'easeOut' }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground font-medium">
                        {stage.percentage}%
                      </span>

                      {/* Current badge */}
                      {isCurrent && (
                        <Badge className="mt-2 bg-brand-100 text-brand-700 border-brand-200 text-[9px]">
                          {t('journeyCurrentStage')}
                        </Badge>
                      )}
                      {isCompleted && (
                        <Badge className="mt-2 bg-uae-green-100 text-uae-green-700 border-uae-green-200 text-[9px]">
                          {t('journeyCompleted')}
                        </Badge>
                      )}
                    </CardContent>
                  </Card>
                </button>
              </motion.div>
            )
          })}
        </div>

        {/* Expanded detail panel */}
        <AnimatePresence>
          {selectedStage && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="mt-4 overflow-hidden"
            >
              <Card className="border-brand-200 bg-brand-50/30 dark:bg-brand-950/10 border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-brand-100 flex items-center justify-center shrink-0">
                      {(() => {
                        const stage = stages.find(s => s.id === selectedStage)
                        const Icon = stage ? iconMap[stage.iconKey] : Search
                        return <Icon className="w-5 h-5 text-brand-600" />
                      })()}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="text-sm font-semibold text-foreground">
                          {t((stages.find(s => s.id === selectedStage)?.titleKey || 'journeyDiscover') as Parameters<typeof t>[0])}
                        </h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => setSelectedStage(null)}
                        >
                          <span className="text-xs text-muted-foreground">✕</span>
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {t((stages.find(s => s.id === selectedStage)?.detailKey || 'journeyDiscoverDetail') as Parameters<typeof t>[0])}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <Progress
                          value={stages.find(s => s.id === selectedStage)?.percentage || 0}
                          className="h-2 flex-1"
                        />
                        <span className="text-xs font-medium text-brand-600">
                          {stages.find(s => s.id === selectedStage)?.percentage || 0}%
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Mobile Journey Map (vertical) ────────────────────────────────── */}
      <div className="md:hidden">
        <div className="relative pl-8">
          {/* Vertical line */}
          <div className="absolute left-3 top-2 bottom-2 w-1 bg-base-200 rounded-full">
            {/* Filled progress */}
            <motion.div
              className="w-full rounded-full bg-gradient-to-b from-uae-green-500 to-brand-600"
              initial={{ height: 0 }}
              animate={{ height: `${((currentStageIndex + 1) / stages.length) * 100}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
            />
          </div>

          {stages.map((stage, i) => {
            const Icon = iconMap[stage.iconKey]
            const isCurrent = i === currentStageIndex
            const isCompleted = i < currentStageIndex
            const isSelected = selectedStage === stage.id

            return (
              <motion.div
                key={stage.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1, duration: 0.4 }}
                className="relative mb-4 last:mb-0"
              >
                {/* Dot on the line */}
                <div
                  className={`absolute left-[-22px] w-7 h-7 rounded-full flex items-center justify-center z-10 ${
                    isCurrent ? 'bg-brand-600 shadow-lg shadow-brand-400/30' :
                    isCompleted ? 'bg-uae-green-500' : 'bg-base-200'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-4 h-4 text-white" />
                  ) : (
                    <Icon className="w-3.5 h-3.5 text-white" />
                  )}
                </div>

                {/* Card */}
                <button
                  onClick={() => setSelectedStage(isSelected ? null : stage.id)}
                  className="w-full text-left"
                >
                  <Card className={`transition-all duration-200 border-0 shadow-sm ${
                    isCurrent ? 'ring-1 ring-brand-400 shadow-md' : ''
                  } ${isCompleted ? 'bg-uae-green-50/50' : 'bg-card'}`}>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="text-sm font-semibold text-foreground">
                          {t(stage.titleKey as Parameters<typeof t>[0])}
                        </h4>
                        <span className="text-[10px] text-muted-foreground">{stage.percentage}%</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mb-2">
                        {t(stage.descKey as Parameters<typeof t>[0])}
                      </p>
                      <div className="w-full h-1 bg-base-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${getProgressColor(i)}`} style={{ width: `${stage.percentage}%` }} />
                      </div>

                      {/* Expanded detail on mobile */}
                      <AnimatePresence>
                        {isSelected && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                          >
                            <p className="text-xs text-muted-foreground mt-2 leading-relaxed border-t border-base-100 pt-2">
                              {t(stage.detailKey as Parameters<typeof t>[0])}
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </CardContent>
                  </Card>
                </button>
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
