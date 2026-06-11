'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Brain, ChevronDown, ChevronUp, AlertTriangle, GraduationCap } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useTranslation } from '@/i18n'

interface Skill {
  key: string
  level: number
  levelKey: string
  agentCount: number
  totalAgents: number
}

interface AgentData {
  id: string
  name: string
  skills?: string // JSON: ["electricity","water","housing"]
}

// Map skill values from DB to translation keys
// DB stores compound keys like "electricity_water" and simple keys like "housing"
const skillKeyMap: Record<string, string> = {
  // Compound keys from DB
  electricity_water: 'electricityWater',
  housing_infra: 'housingInfra',
  petroleum_energy: 'petroleumEnergy',
  transport_maritime: 'transportMaritime',
  // Simple keys
  electricity: 'electricityWater',
  water: 'waterServices',
  housing: 'housingInfra',
  petroleum: 'petroleumEnergy',
  transport: 'transportMaritime',
  sustainability: 'catSustainability',
  infrastructure: 'infrastructureServices',
  general: 'catGeneralServices',
  digital: 'catDigital',
  digital_services: 'catDigital',
}

const levelKeys = ['beginner', 'intermediate', 'advanced', 'expert'] as const

function getLevelKey(level: number): string {
  if (level >= 90) return 'expert'
  if (level >= 80) return 'advanced'
  if (level >= 70) return 'intermediate'
  return 'beginner'
}

export default function AgentSkillsMatrix() {
  const { t } = useTranslation()
  const [isExpanded, setIsExpanded] = useState(false)
  const [agents, setAgents] = useState<AgentData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchAgents() {
      try {
        const res = await fetch('/api/agents?XTransformPort=3002')
        if (res.ok) {
          const data = await res.json()
          setAgents(Array.isArray(data) ? data : [])
        }
      } catch (err) {
        console.error('Failed to fetch agents for skills matrix:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchAgents()
  }, [])

  const skills: Skill[] = useMemo(() => {
    if (agents.length === 0) return []

    const skillCounts: Record<string, number> = {}
    const totalAgents = agents.length

    // Parse skills from all agents
    for (const agent of agents) {
      let agentSkills: string[] = []
      try {
        if (agent.skills) {
          agentSkills = JSON.parse(agent.skills)
        }
      } catch {
        agentSkills = []
      }

      for (const skill of agentSkills) {
        const normalized = skill.toLowerCase().trim()
        skillCounts[normalized] = (skillCounts[normalized] || 0) + 1
      }
    }

    // Build skill array sorted by agent count descending
    const result = Object.entries(skillCounts)
      .map(([key, count]) => {
        const percentage = Math.round((count / totalAgents) * 100)
        // Team proficiency: maps coverage % to proficiency level
        // 100% coverage → 95 (expert), 66% → 70 (intermediate), 33% → 35 (beginner/gap)
        const level = Math.min(95, Math.max(5, Math.round(percentage * 0.95)))
        return {
          key: skillKeyMap[key] || key,
          level,
          levelKey: getLevelKey(level),
          agentCount: count,
          totalAgents,
        }
      })
      .sort((a, b) => b.agentCount - a.agentCount)

    return result
  }, [agents])

  const getBarColor = (level: number): string => {
    if (level >= 90) return 'bg-uae-green-500'
    if (level >= 80) return 'bg-tech-blue'
    if (level >= 70) return 'bg-amber-500'
    return 'bg-orange-500'
  }

  const getTrackColor = (level: number): string => {
    if (level >= 90) return 'bg-uae-green-100 dark:bg-uae-green-900/30'
    if (level >= 80) return 'bg-blue-100 dark:bg-blue-900/30'
    if (level >= 70) return 'bg-amber-100 dark:bg-amber-900/30'
    return 'bg-orange-100 dark:bg-orange-900/30'
  }

  const getLevelBadgeVariant = (level: number): 'default' | 'secondary' | 'outline' => {
    if (level >= 90) return 'default'
    if (level >= 80) return 'secondary'
    return 'outline'
  }

  const skillsBelowThreshold = skills.filter(s => s.level < 80)

  return (
    <Card className="relative overflow-hidden border-0 rounded-none shadow-none">
      {/* Gradient accent top border */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-400 via-teal-400 to-brand-600" />
      <CardContent className="p-3 pt-2">
        {/* Header */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between gap-2 group"
        >
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-gradient-to-r from-brand-50 to-teal-50 dark:from-brand-900/40 dark:to-teal-900/40 border border-brand-200 dark:border-brand-700">
              <Brain className="w-3 h-3 text-brand-600" />
              <span className="text-[11px] font-semibold text-brand-700 dark:text-brand-300">
                {t('agentSkillsMatrix')}
              </span>
            </div>
            {skillsBelowThreshold.length > 0 && (
              <Badge variant="outline" className="text-[8px] h-4 px-1 border-amber-300 text-amber-700 dark:border-amber-600 dark:text-amber-400 gap-0.5">
                <AlertTriangle className="h-2 w-2" />
                {skillsBelowThreshold.length} {t('skillGapIndicator')}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
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

        {/* Skills Content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-3">
                {loading ? (
                  <div className="flex items-center justify-center py-4">
                    <span className="text-[11px] text-muted-foreground">{t('loading')}</span>
                  </div>
                ) : skills.length === 0 ? (
                  <div className="flex items-center justify-center py-4">
                    <span className="text-[11px] text-muted-foreground">{t('noData')}</span>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2.5">
                      {skills.map((skill) => (
                        <div key={skill.key} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-medium text-foreground">
                              {t(skill.key as Parameters<typeof t>[0])}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <Badge
                                variant={getLevelBadgeVariant(skill.level)}
                                className="text-[8px] h-3.5 px-1"
                              >
                                {t(skill.levelKey as Parameters<typeof t>[0])}
                              </Badge>
                              <span className="text-[10px] font-bold text-muted-foreground w-8 text-right">
                                {skill.level}%
                              </span>
                            </div>
                          </div>
                          <div className={`h-1.5 rounded-full overflow-hidden ${getTrackColor(skill.level)}`}>
                            <motion.div
                              className={`h-full rounded-full ${getBarColor(skill.level)}`}
                              initial={{ width: 0 }}
                              animate={{ width: `${skill.level}%` }}
                              transition={{ duration: 0.6, delay: 0.1 }}
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] text-muted-foreground">
                              {skill.agentCount}/{skill.totalAgents} {t('agents')}
                            </span>
                          </div>
                          {/* Skill Gap indicator */}
                          {skill.level < 80 && (
                            <motion.div
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              className="flex items-center gap-1 pl-0.5"
                            >
                              <GraduationCap className="h-2.5 w-2.5 text-amber-500" />
                              <span className="text-[9px] text-amber-600 dark:text-amber-400">
                                {t('trainingRecommended')}
                              </span>
                            </motion.div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Skill Gap Summary */}
                    {skillsBelowThreshold.length > 0 && (
                      <div className="mt-3 p-2 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                        <div className="flex items-center gap-1.5 mb-1">
                          <AlertTriangle className="h-3 w-3 text-amber-600" />
                          <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                            {t('skillGapIndicator')}
                          </span>
                        </div>
                        <p className="text-[9px] text-amber-600 dark:text-amber-400 leading-relaxed">
                          {t('skillGapDesc')} — {skillsBelowThreshold.map(s => t(s.key as Parameters<typeof t>[0])).join(', ')}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  )
}
