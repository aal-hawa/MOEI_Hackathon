'use client'

import React, { useState } from 'react'
import { Calendar, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAppStore } from '@/lib/store'

// ─── Types ────────────────────────────────────────────────────────────
export interface AdminDateFilterChange {
  period: string
  dateFrom?: string
  dateTo?: string
}

interface AdminDateFilterProps {
  onFilterChange: (filter: AdminDateFilterChange) => void
  className?: string
}

// ─── Preset Periods ──────────────────────────────────────────────────
type PresetPeriod = 'all' | 'today' | 'this_week' | 'this_month' | 'this_year' | 'custom'

const MOEI_GOLD = '#B68A35'

// ─── Date Helpers ────────────────────────────────────────────────────
function getDateRange(period: PresetPeriod): { dateFrom: string; dateTo: string } | null {
  const now = new Date()
  const today = now.toISOString().split('T')[0]

  switch (period) {
    case 'today':
      return { dateFrom: today, dateTo: today }

    case 'this_week': {
      const startOfWeek = new Date(now)
      startOfWeek.setDate(now.getDate() - now.getDay()) // Sunday
      const endOfWeek = new Date(startOfWeek)
      endOfWeek.setDate(startOfWeek.getDate() + 6)
      return {
        dateFrom: startOfWeek.toISOString().split('T')[0],
        dateTo: endOfWeek.toISOString().split('T')[0],
      }
    }

    case 'this_month':
      return {
        dateFrom: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`,
        dateTo: today,
      }

    case 'this_year':
      return {
        dateFrom: `${now.getFullYear()}-01-01`,
        dateTo: today,
      }

    default:
      return null
  }
}

// ─── Component ────────────────────────────────────────────────────────
export function AdminDateFilter({ onFilterChange, className }: AdminDateFilterProps) {
  const { language } = useAppStore()
  const isAr = language === 'ar'

  const [selectedPeriod, setSelectedPeriod] = useState<PresetPeriod>('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const presets: Array<{ value: PresetPeriod; labelEN: string; labelAR: string }> = [
    { value: 'all', labelEN: 'All', labelAR: 'الكل' },
    { value: 'today', labelEN: 'Today', labelAR: 'اليوم' },
    { value: 'this_week', labelEN: 'This Week', labelAR: 'هذا الأسبوع' },
    { value: 'this_month', labelEN: 'This Month', labelAR: 'هذا الشهر' },
    { value: 'this_year', labelEN: 'This Year', labelAR: 'هذه السنة' },
    { value: 'custom', labelEN: 'Custom', labelAR: 'مخصص' },
  ]

  const handlePresetClick = (period: PresetPeriod) => {
    setSelectedPeriod(period)

    if (period === 'all') {
      setCustomFrom('')
      setCustomTo('')
      onFilterChange({ period: 'all' })
      return
    }

    if (period === 'custom') {
      // Don't apply yet — user needs to fill in dates
      return
    }

    const range = getDateRange(period)
    if (range) {
      setCustomFrom(range.dateFrom)
      setCustomTo(range.dateTo)
      onFilterChange({ period, dateFrom: range.dateFrom, dateTo: range.dateTo })
    }
  }

  const handleApplyCustom = () => {
    if (customFrom && customTo) {
      onFilterChange({ period: 'custom', dateFrom: customFrom, dateTo: customTo })
    }
  }

  const handleClear = () => {
    setSelectedPeriod('all')
    setCustomFrom('')
    setCustomTo('')
    onFilterChange({ period: 'all' })
  }

  return (
    <div className={`flex flex-col gap-2 ${className || ''}`}>
      {/* Preset Buttons */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <Calendar className="w-4 h-4 text-ae-gold-600 shrink-0" />
        {presets.map((preset) => (
          <Button
            key={preset.value}
            variant={selectedPeriod === preset.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => handlePresetClick(preset.value)}
            className={
              selectedPeriod === preset.value
                ? 'bg-ae-gold-500 hover:bg-ae-gold-600 text-white text-xs h-7 px-2.5'
                : 'text-xs h-7 px-2.5 text-ae-black-500 hover:text-ae-black-700'
            }
          >
            {isAr ? preset.labelAR : preset.labelEN}
          </Button>
        ))}
      </div>

      {/* Custom Date Range */}
      {selectedPeriod === 'custom' && (
        <div className="flex items-center gap-2 flex-wrap bg-ae-gold-50/50 border border-ae-gold-200/50 rounded-lg p-2.5">
          <div className="flex items-center gap-1.5">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">
              {isAr ? 'من' : 'From'}
            </Label>
            <Input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="h-8 text-xs w-[150px] border-ae-gold-200 focus-visible:ring-ae-gold-300"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">
              {isAr ? 'إلى' : 'To'}
            </Label>
            <Input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="h-8 text-xs w-[150px] border-ae-gold-200 focus-visible:ring-ae-gold-300"
            />
          </div>
          <Button
            size="sm"
            onClick={handleApplyCustom}
            disabled={!customFrom || !customTo}
            className="bg-ae-gold-500 hover:bg-ae-gold-600 text-white text-xs h-8 px-3"
          >
            {isAr ? 'تطبيق' : 'Apply'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="text-xs h-8 px-2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-3 h-3 me-1" />
            {isAr ? 'مسح' : 'Clear'}
          </Button>
        </div>
      )}
    </div>
  )
}

export default AdminDateFilter
