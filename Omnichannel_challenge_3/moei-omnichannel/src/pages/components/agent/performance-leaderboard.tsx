'use client'

import { useMemo, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Trophy,
  TrendingUp,
  TrendingDown,
  Star,
  Clock,
  CheckCircle2,
  Award,
  Crown,
  Medal,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { useTranslation } from '@/i18n'
import { useAppStore } from '@/store/app-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

// ─── Types ───────────────────────────────────────────────────────────────────

interface AgentPerformance {
  id: string
  name: string
  nameAr?: string
  email: string
  role: string
  status: string
  activeCases: number
  casesResolved: number
  activeCasesCount: number
  avgResolutionMin: number
  avgResponseSec: number
  avgResponseMin: number
  csatRating: number
}

interface AgentData {
  id: string
  nameKey: string
  displayName: string
  initials: string
  casesResolved: number
  avgResponseMin: number
  avgResponseSec: number
  csatRating: number
  trendUp: boolean
  trendValue: number
  sparkData: number[]
  isCurrentAgent: boolean
}

// ─── Mini Sparkline Component ──────────────────────────────────────────────

function MiniSparkline({ data, color, width = 56, height = 20 }: { data: number[]; color: string; width?: number; height?: number }) {
  if (data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const pad = 2

  const points = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (width - pad * 2)
    const y = height - pad - ((v - min) / range) * (height - pad * 2)
    return `${x},${y}`
  }).join(' ')

  return (
    <svg width={width} height={height} className="opacity-70 shrink-0">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ─── Rank Badge ────────────────────────────────────────────────────────────

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <Crown className="w-4 h-4 text-amber-500" />
  if (rank === 2) return <Medal className="w-4 h-4 text-gray-400" />
  if (rank === 3) return <Award className="w-4 h-4 text-amber-700" />
  return (
    <span className="w-5 h-5 rounded-full bg-base-200 text-[10px] font-bold flex items-center justify-center text-muted-foreground">
      {rank}
    </span>
  )
}

// ─── Generate deterministic sparkline data based on agent performance ──────
// Uses a simple seeded PRNG so the same agent always gets the same sparkline

function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

function generateSparkData(agentId: string, casesResolved: number, csatRating: number): number[] {
  // Create a numeric seed from agentId
  let seed = 0
  for (let i = 0; i < agentId.length; i++) seed = seed * 31 + agentId.charCodeAt(i)
  const rand = seededRandom(Math.abs(seed))

  const base = casesResolved > 0 ? casesResolved * 0.7 : 3
  const points: number[] = []
  for (let i = 0; i < 6; i++) {
    const variation = (rand() - 0.4) * base * 0.3
    points.push(Math.max(0, Math.round(base + variation + i * (csatRating > 3.5 ? 0.5 : -0.3))))
  }
  return points
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function PerformanceLeaderboard() {
  const { t } = useTranslation()
  const [isExpanded, setIsExpanded] = useState(false)
  const [performanceData, setPerformanceData] = useState<AgentPerformance[]>([])
  const [loading, setLoading] = useState(true)
  const currentAgent = useAppStore((s) => s.currentAgent)

  useEffect(() => {
    async function fetchPerformance() {
      try {
        const res = await fetch('/api/agents/performance?XTransformPort=3002')
        if (res.ok) {
          const data = await res.json()
          setPerformanceData(Array.isArray(data) ? data : [])
        }
      } catch (err) {
        console.error('Failed to fetch agent performance:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchPerformance()
  }, [])

  // Auto-expand removed: respects user choice

  const agents: AgentData[] = useMemo(() => {
    if (performanceData.length === 0) return []

    return performanceData.map((agent) => {
      const isCurrentAgent = currentAgent?.id === agent.id || currentAgent?.email === agent.email

      // Generate sparkline data from performance metrics
      const sparkData = generateSparkData(agent.id, agent.casesResolved, agent.csatRating)

      // Determine trend from spark data
      const firstHalf = sparkData.slice(0, 3).reduce((a, b) => a + b, 0) / 3
      const secondHalf = sparkData.slice(3).reduce((a, b) => a + b, 0) / 3
      const trendUp = secondHalf >= firstHalf
      const trendValue = firstHalf > 0 ? Math.round(Math.abs(secondHalf - firstHalf) / firstHalf * 100) : 0

      // Get initials from name
      const nameParts = agent.name.split(' ')
      const initials = nameParts.length >= 2
        ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
        : agent.name.slice(0, 2).toUpperCase()

      return {
        id: agent.id,
        nameKey: agent.name.toLowerCase().replace(/\s+/g, '_'),
        displayName: agent.name,
        initials,
        casesResolved: agent.casesResolved || agent.activeCases,
        avgResponseMin: agent.avgResponseMin || 0,
        avgResponseSec: agent.avgResponseSec ? agent.avgResponseSec % 60 : 0,
        csatRating: agent.csatRating || 0,
        trendUp,
        trendValue: Math.min(trendValue, 99),
        sparkData,
        isCurrentAgent,
      }
    })
  }, [performanceData, currentAgent])

  const currentAgentRank = agents.findIndex(a => a.isCurrentAgent) + 1

  // Find top performer name
  const topPerformerName = agents.length > 0 ? agents[0].displayName : ''

  return (
    <Card className="border-0 shadow-sm bg-gradient-to-b from-background to-brand-50/10 dark:from-background dark:to-brand-950/5 overflow-hidden">
      {/* Gradient top accent */}
      <div className="h-[2px] bg-gradient-to-r from-amber-400 via-brand-400 to-uae-green-400" />
      <CardHeader className="px-4 pb-2 pt-3">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center gap-2 group"
        >
          <Trophy className="h-4 w-4 text-amber-500" />
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            {t('leaderboardTitle')}
          </CardTitle>
          {agents.length > 0 && currentAgentRank > 0 && (
            <Badge variant="secondary" className="text-[9px]">
              {t('leaderboardYourRank')} #{currentAgentRank}
            </Badge>
          )}
          <div className="ml-auto flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground group-hover:text-foreground transition-colors">
              {isExpanded ? t('hideSkills') : t('showSkills')}
            </span>
            {isExpanded ? (
              <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </div>
        </button>
      </CardHeader>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <CardContent className="px-3 pb-3 pt-0">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <Trophy className="w-8 h-8 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">
              {t('loading')}
            </p>
          </div>
        ) : agents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <Trophy className="w-8 h-8 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">
              {t('noLeaderboardData')}
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-1.5 max-h-96 overflow-y-auto">
              {agents.map((agent, i) => (
                <motion.div
                  key={agent.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08, duration: 0.3 }}
                  className={`flex items-center gap-2 p-2 rounded-lg transition-all duration-200 ${
                    agent.isCurrentAgent
                      ? 'bg-brand-50 dark:bg-brand-950/30 ring-1 ring-brand-300 dark:ring-brand-700'
                      : 'hover:bg-muted/50'
                  }`}
                >
                  {/* Rank */}
                  <div className="w-6 flex justify-center shrink-0">
                    <RankBadge rank={i + 1} />
                  </div>

                  {/* Avatar */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                    agent.isCurrentAgent
                      ? 'bg-brand-600 text-white'
                      : 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'
                  }`}>
                    {agent.initials}
                  </div>

                  {/* Name + Stats */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-foreground truncate">
                        {agent.displayName}
                      </span>
                      {agent.isCurrentAgent && (
                        <Badge className="text-[8px] h-4 px-1 bg-brand-100 text-brand-700 border-brand-200 dark:bg-brand-900/40 dark:text-brand-300">
                          {t('leaderboardYou')}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-0.5">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        {agent.casesResolved}
                      </span>
                      <span className="flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        {agent.avgResponseMin}:{String(agent.avgResponseSec).padStart(2, '0')}
                      </span>
                      <span className="flex items-center gap-0.5">
                        <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
                        {agent.csatRating}
                      </span>
                    </div>
                  </div>

                  {/* Trend + Sparkline */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <MiniSparkline
                      data={agent.sparkData}
                      color={agent.trendUp ? '#16a34a' : '#dc2626'}
                    />
                    <div className={`flex items-center text-[10px] font-medium ${
                      agent.trendUp ? 'text-uae-green-600' : 'text-uae-red-600'
                    }`}>
                      {agent.trendUp ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : (
                        <TrendingDown className="w-3 h-3" />
                      )}
                      {agent.trendValue}%
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Footer summary */}
            <div className="mt-3 pt-2 border-t border-border/50 flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">
                {t('leaderboardUpdatedToday')}
              </span>
              {topPerformerName && (
                <div className="flex items-center gap-1">
                  <Trophy className="w-3 h-3 text-amber-500" />
                  <span className="text-[10px] font-medium text-foreground">
                    {t('leaderboardTopPerformer')}: {topPerformerName}
                  </span>
                </div>
              )}
            </div>
          </>
        )}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  )
}
