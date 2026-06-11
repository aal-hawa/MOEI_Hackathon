'use client'

import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MapPin, Trophy, ChevronDown, ChevronUp, Clock, Star, Zap } from 'lucide-react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { useTranslation } from '@/i18n'

interface RegionData {
  key: string
  percentage: number
  interactions: number
  satisfaction: number
  topService: string
  avgResponseMin: number
}

const REGIONS: RegionData[] = [
  { key: 'abuDhabi', percentage: 0, interactions: 0, satisfaction: 0, topService: 'N/A', avgResponseMin: 0 },
  { key: 'dubai', percentage: 0, interactions: 0, satisfaction: 0, topService: 'N/A', avgResponseMin: 0 },
  { key: 'sharjah', percentage: 0, interactions: 0, satisfaction: 0, topService: 'N/A', avgResponseMin: 0 },
  { key: 'ajman', percentage: 0, interactions: 0, satisfaction: 0, topService: 'N/A', avgResponseMin: 0 },
  { key: 'rasAlKhaimah', percentage: 0, interactions: 0, satisfaction: 0, topService: 'N/A', avgResponseMin: 0 },
  { key: 'ummAlQuwain', percentage: 0, interactions: 0, satisfaction: 0, topService: 'N/A', avgResponseMin: 0 },
]

const BAR_COLORS = [
  '#0D9488', '#14B8A6', '#2DD4BF', '#5EEAD4', '#99F6E4', '#A7F3D0', '#D1FAE5',
]

// Simple UAE map silhouette SVG outline
function UAEMapSilhouette() {
  return (
    <svg
      viewBox="0 0 200 260"
      className="absolute inset-0 m-auto h-48 w-36 opacity-[0.06] dark:opacity-[0.08]"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M100 10 C60 10, 30 40, 25 80 C20 120, 30 150, 50 175 C65 195, 80 220, 90 245 L110 245 C120 220, 135 195, 150 175 C170 150, 180 120, 175 80 C170 40, 140 10, 100 10 Z"
        fill="currentColor"
        className="text-brand-600"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  )
}

// Custom tooltip for the chart
function GeoChartTooltip({ active, payload, t }: {
  active?: boolean
  payload?: { payload: { name: string; percentage: number; interactions: number }; fill: string }[]
  t: (key: string) => string
}) {
  if (!active || !payload?.length) return null
  const data = payload[0].payload
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2 shadow-lg">
      <p className="text-xs font-semibold text-foreground">{data.name}</p>
      <p className="text-xs text-muted-foreground">{data.percentage}% • {data.interactions.toLocaleString()}</p>
    </div>
  )
}

export default function GeoDistributionPanel() {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const [regions, setRegions] = useState<RegionData[]>(REGIONS)

  useEffect(() => {
    fetch('/api/dashboard/predictions')
      .then(res => res.json())
      .then(data => {
        if (data.geoDistribution) {
          setRegions(data.geoDistribution)
        }
      })
      .catch(err => console.error('Failed to fetch geo distribution', err))
  }, [])

  const chartData = useMemo(() =>
    regions.map((region, i) => ({
      name: t(region.key as Parameters<typeof t>[0]),
      percentage: region.percentage,
      interactions: region.interactions,
      fill: BAR_COLORS[i % BAR_COLORS.length],
    })), [regions, t])

  const topRegion = regions[0]

  return (
    <Card className="relative overflow-hidden py-4 shadow-sm hover-lift">
      {/* Teal gradient header accent */}
      <div className="h-1 bg-gradient-to-r from-brand-400 via-brand-600 to-teal-400" />

      {/* UAE Map silhouette background */}
      <UAEMapSilhouette />

      <CardHeader className="relative px-4 pb-0 pt-0">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <MapPin className="h-4 w-4 text-brand-600" />
              {t('geoTitle' as Parameters<typeof t>[0])}
            </CardTitle>
            <CardDescription className="text-xs">
              {t('geoDesc' as Parameters<typeof t>[0])}
            </CardDescription>
          </div>
          {/* Top Region highlight */}
          {topRegion && (
            <motion.div
              className="flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 dark:bg-brand-950/30 px-3 py-1.5"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
            >
              <Trophy className="h-4 w-4 text-brand-600" />
              <div>
                <p className="text-[10px] font-medium text-brand-700 dark:text-brand-400">
                  {t('topRegion' as Parameters<typeof t>[0])}
                </p>
                <p className="text-xs font-bold text-brand-800 dark:text-brand-300">
                  {t(topRegion.key as Parameters<typeof t>[0])} ({topRegion.percentage}%)
                </p>
              </div>
            </motion.div>
          )}
        </div>
      </CardHeader>

      <CardContent className="relative px-4 pt-3">
        {/* Horizontal bar chart */}
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
            >
              <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--color-base-400)' }} tickLine={false} axisLine={false} />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11, fill: 'var(--color-base-500)' }}
                tickLine={false}
                axisLine={false}
                width={90}
              />
              <Tooltip content={<GeoChartTooltip t={t} />} />
              <Bar dataKey="percentage" radius={[0, 4, 4, 0]} barSize={20}>
                {chartData.map((entry, index) => (
                  <Cell key={index} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Region Details expandable */}
        <div className="mt-3">
          <button
            className="flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 transition-colors"
            onClick={() => setExpanded(!expanded)}
            type="button"
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {t('regionDetails' as Parameters<typeof t>[0])}
          </button>

          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="mt-2 space-y-1.5 max-h-64 overflow-y-auto custom-scrollbar pr-1">
                  {regions.map((region, i) => (
                    <motion.div
                      key={region.key}
                      className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 text-xs"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      {/* Color dot */}
                      <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: BAR_COLORS[i] }} />
                      {/* Region name */}
                      <span className="font-medium text-foreground w-24 truncate">
                        {t(region.key as Parameters<typeof t>[0])}
                      </span>
                      {/* Stats */}
                      <div className="flex items-center gap-3 ml-auto text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Star className="h-3 w-3 text-camel-yellow" />
                          {region.satisfaction}
                        </span>
                        <span className="flex items-center gap-1">
                          <Zap className="h-3 w-3 text-brand-500" />
                          {region.topService}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-tech-blue" />
                          {region.avgResponseMin}m
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Legend for details */}
                <div className="flex items-center gap-4 mt-2 justify-center">
                  <span className="flex items-center gap-1 text-[9px] text-muted-foreground">
                    <Star className="h-2.5 w-2.5 text-camel-yellow" />
                    {t('avgSatisfaction' as Parameters<typeof t>[0])}
                  </span>
                  <span className="flex items-center gap-1 text-[9px] text-muted-foreground">
                    <Zap className="h-2.5 w-2.5 text-brand-500" />
                    {t('topService' as Parameters<typeof t>[0])}
                  </span>
                  <span className="flex items-center gap-1 text-[9px] text-muted-foreground">
                    <Clock className="h-2.5 w-2.5 text-tech-blue" />
                    {t('avgResponseTime' as Parameters<typeof t>[0])}
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </CardContent>
    </Card>
  )
}
