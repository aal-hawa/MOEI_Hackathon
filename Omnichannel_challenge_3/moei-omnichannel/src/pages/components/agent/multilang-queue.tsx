'use client'

import { useMemo, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Globe, AlertTriangle, Users, ChevronDown, ChevronUp } from 'lucide-react'
import { useTranslation } from '@/i18n'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface LanguageQueueItem {
  id: string
  nameKey: string
  flag: string
  queuePercent: number
  availableAgents: number
  queueCount: number
  barColor: string
  bgColor: string
}

interface AgentData {
  id: string
  name: string
  languages?: string // JSON: ["en","ar"]
  status: string
}

interface ConversationData {
  id: string
  language?: string
  channel?: string
  status?: string
}

// Language config mapping
const languageConfig: Record<string, { nameKey: string; flag: string; barColor: string; bgColor: string }> = {
  en: {
    nameKey: 'english',
    flag: '🇬🇧',
    barColor: 'bg-blue-500',
    bgColor: 'bg-blue-50/60 dark:bg-blue-950/20',
  },
  ar: {
    nameKey: 'arabic',
    flag: '🇦🇪',
    barColor: 'bg-brand-500',
    bgColor: 'bg-brand-50/60 dark:bg-brand-950/20',
  },
  fr: {
    nameKey: 'french',
    flag: '🇫🇷',
    barColor: 'bg-purple-500',
    bgColor: 'bg-purple-50/60 dark:bg-purple-950/20',
  },
  ur: {
    nameKey: 'urdu',
    flag: '🇵🇰',
    barColor: 'bg-green-500',
    bgColor: 'bg-green-50/60 dark:bg-green-950/20',
  },
  hi: {
    nameKey: 'hindi',
    flag: '🇮🇳',
    barColor: 'bg-orange-500',
    bgColor: 'bg-orange-50/60 dark:bg-orange-950/20',
  },
  tl: {
    nameKey: 'tagalog',
    flag: '🇵🇭',
    barColor: 'bg-amber-500',
    bgColor: 'bg-amber-50/60 dark:bg-amber-950/20',
  },
}

// Fallback for unknown languages
const defaultLangConfig = {
  nameKey: 'other',
  flag: '🌐',
  barColor: 'bg-gray-500',
  bgColor: 'bg-gray-50/60 dark:bg-gray-950/20',
}

export default function MultilangQueue() {
  const { t } = useTranslation()
  const [isExpanded, setIsExpanded] = useState(false)
  const [agents, setAgents] = useState<AgentData[]>([])
  const [conversations, setConversations] = useState<ConversationData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const [agentsRes, convosRes] = await Promise.all([
          fetch('/api/agents?XTransformPort=3002'),
          fetch('/api/conversations?XTransformPort=3002'),
        ])

        if (agentsRes.ok) {
          const data = await agentsRes.json()
          setAgents(Array.isArray(data) ? data : [])
        }

        if (convosRes.ok) {
          const data = await convosRes.json()
          // Conversations API returns { conversations: [...], count: N }
          const convList = data?.conversations || (Array.isArray(data) ? data : [])
          setConversations(convList)
        }
      } catch (err) {
        console.error('Failed to fetch data for multilang queue:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // Compute language distribution from conversations
  const languageQueueCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const conv of conversations) {
      const lang = (conv.language || 'en').toLowerCase().trim().slice(0, 2)
      counts[lang] = (counts[lang] || 0) + 1
    }
    return counts
  }, [conversations])

  // Compute available agents per language
  const agentsPerLanguage = useMemo(() => {
    const counts: Record<string, number> = {}
    let bilingual = 0

    for (const agent of agents) {
      let langs: string[] = []
      try {
        if (agent.languages) {
          langs = JSON.parse(agent.languages)
        }
      } catch {
        langs = ['en']
      }

      // Only count available/busy agents (not offline)
      const isAvailable = agent.status === 'available' || agent.status === 'busy'
      if (!isAvailable) continue

      for (const lang of langs) {
        const normalized = lang.toLowerCase().trim().slice(0, 2)
        counts[normalized] = (counts[normalized] || 0) + 1
      }

      // Check if bilingual (both en and ar)
      const normalizedLangs = langs.map(l => l.toLowerCase().trim().slice(0, 2))
      if (normalizedLangs.includes('en') && normalizedLangs.includes('ar')) {
        bilingual++
      }
    }

    return { counts, bilingual }
  }, [agents])

  const bilingualAgents = agentsPerLanguage.bilingual

  // Build language queue items
  const languages: LanguageQueueItem[] = useMemo(() => {
    // Gather all languages from both agents and conversations
    const allLangs = new Set<string>()
    for (const lang of Object.keys(agentsPerLanguage.counts)) allLangs.add(lang)
    for (const lang of Object.keys(languageQueueCounts)) allLangs.add(lang)

    if (allLangs.size === 0) return []

    const totalConversations = Math.max(conversations.length, 1)

    const items = Array.from(allLangs)
      .map(lang => {
        const config = languageConfig[lang] || { ...defaultLangConfig, nameKey: lang }
        const availableAgents = agentsPerLanguage.counts[lang] || 0
        const queueCount = languageQueueCounts[lang] || 0
        const queuePercent = Math.round((queueCount / totalConversations) * 100)

        return {
          id: lang,
          nameKey: config.nameKey,
          flag: config.flag,
          queuePercent: Math.max(queuePercent, availableAgents > 0 ? 5 : 0), // min 5% if agents available
          availableAgents,
          queueCount,
          barColor: config.barColor,
          bgColor: config.bgColor,
        }
      })
      .sort((a, b) => b.queueCount - a.queueCount)

    return items
  }, [agentsPerLanguage.counts, languageQueueCounts, conversations.length])

  // Check for language gaps (more customers than agents for a language)
  const hasLanguageGap = useMemo(() => {
    return languages.some((lang) => {
      return lang.availableAgents < lang.queueCount && lang.id !== 'other'
    })
  }, [languages])

  return (
    <Card className="border-0 shadow-sm overflow-hidden">
      {/* Gradient accent top */}
      <div className="h-1 bg-gradient-to-r from-brand-500 via-blue-400 to-purple-500" />

      <CardContent className="p-3">
        {/* Header - Clickable */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between gap-2 group"
        >
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-brand-600" />
            <h3 className="text-sm font-semibold text-foreground">{t('queueTitle')}</h3>
            {hasLanguageGap && (
              <Badge variant="destructive" className="text-[9px] h-5 gap-1">
                <AlertTriangle className="w-2.5 h-2.5" />
                {t('languageGap')}
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

        {/* Language queue bars - Collapsible */}
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
                  <div className="flex items-center justify-center py-6 px-4 rounded-lg bg-muted/30 border border-border/30">
                    <p className="text-xs text-muted-foreground">{t('loading')}</p>
                  </div>
                ) : languages.length === 0 ? (
                  <div className="flex items-center justify-center py-6 px-4 rounded-lg bg-muted/30 border border-border/30">
                    <p className="text-xs text-muted-foreground">{t('noData')}</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2.5">
                      {languages.map((lang, i) => {
                        const hasGap = lang.availableAgents < lang.queueCount && lang.id !== 'other'

                        return (
                          <motion.div
                            key={lang.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.08, duration: 0.25 }}
                            className={`rounded-lg p-2.5 ${lang.bgColor} border border-border/30`}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm">{lang.flag}</span>
                                <span className="text-xs font-medium text-foreground">
                                  {t(lang.nameKey as Parameters<typeof t>[0])}
                                </span>
                                {hasGap && (
                                  <AlertTriangle className="w-3 h-3 text-amber-500" />
                                )}
                              </div>
                              <span className="text-xs font-bold text-foreground">{lang.queuePercent}%</span>
                            </div>

                            {/* Progress bar */}
                            <div className="h-2 bg-white/60 dark:bg-background/40 rounded-full overflow-hidden">
                              <motion.div
                                className={`h-full rounded-full ${lang.barColor}`}
                                initial={{ width: 0 }}
                                animate={{ width: `${lang.queuePercent}%` }}
                                transition={{ delay: i * 0.1, duration: 0.5 }}
                              />
                            </div>

                            {/* Available agents */}
                            <div className="flex items-center gap-1 mt-1.5">
                              <Users className="w-3 h-3 text-muted-foreground" />
                              <span className="text-[10px] text-muted-foreground">
                                {t('availableAgents')}: {lang.availableAgents}
                              </span>
                              {(lang.id === 'ar' || lang.id === 'en') && bilingualAgents > 0 && (
                                <span className="text-[10px] text-muted-foreground">
                                  + {bilingualAgents} {t('bilingual')}
                                </span>
                              )}
                              {lang.queueCount > 0 && (
                                <span className="text-[10px] text-muted-foreground ml-1">
                                  ({lang.queueCount} {t('conversations')})
                                </span>
                              )}
                            </div>
                          </motion.div>
                        )
                      })}
                    </div>

                    {/* Bilingual agents note */}
                    {bilingualAgents > 0 && (
                      <div className="mt-2.5 px-2.5 py-2 rounded-lg bg-muted/40 border border-border/30 flex items-center gap-2">
                        <Users className="w-3.5 h-3.5 text-brand-600 flex-shrink-0" />
                        <p className="text-[10px] text-muted-foreground">
                          {bilingualAgents} {t('bilingual')} {t('availableAgents').toLowerCase()} — {t('arabic')} & {t('english')}
                        </p>
                      </div>
                    )}

                    {/* Language gap warning */}
                    {hasLanguageGap && (
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-2.5 px-2.5 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/30 flex items-center gap-2"
                      >
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                        <p className="text-[10px] text-amber-700 dark:text-amber-400">
                          {t('languageGap')}: {languages.filter(l => l.availableAgents < l.queueCount && l.id !== 'other').map(l => t(l.nameKey as Parameters<typeof t>[0])).join(', ')} — consider reassigning {t('bilingual').toLowerCase()} agents
                        </p>
                      </motion.div>
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
