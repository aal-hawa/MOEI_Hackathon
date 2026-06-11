
import * as React from 'react'
import { CalendarIcon, ChevronDownIcon } from 'lucide-react'
import { format, startOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays, subWeeks, subMonths, subYears } from 'date-fns'
import { ar } from 'date-fns/locale'

import { t, type Language } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'

// ─── MOEI Gold Color Constants ──────────────────────────────────────────
const MOEI_GOLD = '#B68A35'

// ─── Types ──────────────────────────────────────────────────────────────
export interface DateFilterValue {
  startDate: Date | null
  endDate: Date | null
  filterType: string
}

export interface DateFilterProps {
  value: DateFilterValue
  onChange: (value: DateFilterValue) => void
  language?: Language
  className?: string
  compact?: boolean
}

// ─── Preset Filter Types ────────────────────────────────────────────────
type PresetFilterType =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'this_year'
  | 'last_year'
  | 'custom_date_range'
  | 'custom_month_range'
  | 'custom_year_range'

const PRESET_FILTERS: PresetFilterType[] = [
  'today',
  'yesterday',
  'this_week',
  'last_week',
  'this_month',
  'last_month',
  'this_year',
  'last_year',
  'custom_date_range',
  'custom_month_range',
  'custom_year_range',
]

// ─── Date Calculation Helpers ───────────────────────────────────────────
function getPresetDates(filterType: PresetFilterType): { start: Date; end: Date } {
  const now = new Date()
  const today = startOfDay(now)

  switch (filterType) {
    case 'today':
      return { start: today, end: today }

    case 'yesterday': {
      const yesterday = subDays(today, 1)
      return { start: yesterday, end: yesterday }
    }

    case 'this_week': {
      // Week starts on Sunday (UAE convention)
      return { start: startOfWeek(today, { weekStartsOn: 0 }), end: endOfWeek(today, { weekStartsOn: 0 }) }
    }

    case 'last_week': {
      const lastWeek = subWeeks(today, 1)
      return { start: startOfWeek(lastWeek, { weekStartsOn: 0 }), end: endOfWeek(lastWeek, { weekStartsOn: 0 }) }
    }

    case 'this_month':
      return { start: startOfMonth(today), end: endOfMonth(today) }

    case 'last_month': {
      const lastMonth = subMonths(today, 1)
      return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) }
    }

    case 'this_year':
      return { start: startOfYear(today), end: endOfYear(today) }

    case 'last_year': {
      const lastYear = subYears(today, 1)
      return { start: startOfYear(lastYear), end: endOfYear(lastYear) }
    }

    default:
      return { start: today, end: today }
  }
}

// ─── Year/Month Select Helpers ──────────────────────────────────────────
function generateYears(count: number = 10): number[] {
  const currentYear = new Date().getFullYear()
  return Array.from({ length: count }, (_, i) => currentYear - count + 1 + i).concat(currentYear + 1)
}

function generateMonths(): number[] {
  return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
}

// ─── Component ──────────────────────────────────────────────────────────
export function DateFilter({ value, onChange, language = 'en', className, compact = false }: DateFilterProps) {
  const isRtl = language === 'ar'
  const dateLocale = isRtl ? ar : undefined

  const [selectedPreset, setSelectedPreset] = React.useState<PresetFilterType | ''>(
    (value.filterType as PresetFilterType) || ''
  )
  const [customStart, setCustomStart] = React.useState<Date | undefined>(
    value.startDate ?? undefined
  )
  const [customEnd, setCustomEnd] = React.useState<Date | undefined>(
    value.endDate ?? undefined
  )

  // Custom month/year range state
  const [startYear, setStartYear] = React.useState<number>(new Date().getFullYear() - 1)
  const [startMonth, setStartMonth] = React.useState<number>(1)
  const [endYear, setEndYear] = React.useState<number>(new Date().getFullYear())
  const [endMonth, setEndMonth] = React.useState<number>(12)

  const [popoverOpen, setPopoverOpen] = React.useState(false)

  // Sync internal state from value prop
  React.useEffect(() => {
    if (value.filterType && PRESET_FILTERS.includes(value.filterType as PresetFilterType)) {
      setSelectedPreset(value.filterType as PresetFilterType)
    }
    if (value.startDate) setCustomStart(value.startDate)
    if (value.endDate) setCustomEnd(value.endDate)
  }, [value.filterType, value.startDate, value.endDate])

  // Apply preset
  const handlePresetChange = (preset: PresetFilterType) => {
    setSelectedPreset(preset)

    if (preset === 'custom_date_range' || preset === 'custom_month_range' || preset === 'custom_year_range') {
      // Don't apply immediately - user needs to pick dates
      return
    }

    const { start, end } = getPresetDates(preset)
    setCustomStart(start)
    setCustomEnd(end)
    onChange({ startDate: start, endDate: end, filterType: preset })
  }

  // Apply custom date range
  const handleApplyCustomDateRange = () => {
    if (customStart && customEnd) {
      onChange({
        startDate: startOfDay(customStart),
        endDate: startOfDay(customEnd),
        filterType: 'custom_date_range',
      })
      setPopoverOpen(false)
    }
  }

  // Apply custom month range
  const handleApplyMonthRange = () => {
    const start = startOfDay(new Date(startYear, startMonth - 1, 1))
    const end = endOfMonth(new Date(endYear, endMonth - 1, 1))
    onChange({ startDate: start, endDate: end, filterType: 'custom_month_range' })
    setPopoverOpen(false)
  }

  // Apply custom year range
  const handleApplyYearRange = () => {
    const start = startOfYear(new Date(startYear, 0, 1))
    const end = endOfYear(new Date(endYear, 0, 1))
    onChange({ startDate: start, endDate: end, filterType: 'custom_year_range' })
    setPopoverOpen(false)
  }

  // Clear filter
  const handleClear = () => {
    setSelectedPreset('')
    setCustomStart(undefined)
    setCustomEnd(undefined)
    onChange({ startDate: null, endDate: null, filterType: '' })
    setPopoverOpen(false)
  }

  // Display label for the current filter
  const getDisplayLabel = (): string => {
    if (!value.filterType || value.filterType === '') {
      return t('dateFilter.selectDateRange', language)
    }

    if (PRESET_FILTERS.includes(value.filterType as PresetFilterType) && !value.filterType.startsWith('custom_')) {
      return t(`dateFilter.${value.filterType}`, language)
    }

    if (value.startDate && value.endDate) {
      const fmt = language === 'ar' ? 'dd/MM/yyyy' : 'MMM dd, yyyy'
      return `${format(value.startDate, fmt, { locale: dateLocale })} – ${format(value.endDate, fmt, { locale: dateLocale })}`
    }

    return t('dateFilter.selectDateRange', language)
  }

  const years = generateYears(10)

  const monthLabels = generateMonths().map((m) => {
    const d = new Date(2000, m - 1, 1)
    return {
      value: m,
      label: language === 'ar'
        ? format(d, 'MMMM', { locale: ar })
        : format(d, 'MMMM'),
    }
  })

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'justify-between gap-2 font-normal',
            compact ? 'h-8 text-xs px-2' : 'h-9 text-sm px-3',
            value.filterType && 'border-[var(--moei-gold)]',
            className
          )}
          style={value.filterType ? { '--moei-gold': MOEI_GOLD, borderColor: MOEI_GOLD } as React.CSSProperties : undefined}
        >
          <CalendarIcon className={cn('shrink-0', compact ? 'h-3.5 w-3.5' : 'h-4 w-4')} style={{ color: value.filterType ? MOEI_GOLD : undefined }} />
          <span className="truncate">{getDisplayLabel()}</span>
          <ChevronDownIcon className="h-4 w-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0"
        align={isRtl ? 'end' : 'start'}
        sideOffset={4}
      >
        <div className={cn('p-4 space-y-3', isRtl && 'text-right')} dir={isRtl ? 'rtl' : 'ltr'}>
          {/* Preset Filters */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t('dateFilter.presets', language)}
            </p>
            <div className="grid grid-cols-2 gap-1">
              {PRESET_FILTERS.slice(0, 8).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={cn(
                    'text-xs px-2.5 py-1.5 rounded-md text-left transition-colors',
                    isRtl && 'text-right',
                    selectedPreset === preset
                      ? 'bg-primary text-primary-foreground font-medium'
                      : 'hover:bg-accent hover:text-accent-foreground'
                  )}
                  onClick={() => handlePresetChange(preset)}
                >
                  {t(`dateFilter.${preset}`, language)}
                </button>
              ))}
            </div>

            <div className="flex gap-1 pt-1">
              {(['custom_date_range', 'custom_month_range', 'custom_year_range'] as PresetFilterType[]).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={cn(
                    'text-xs px-2.5 py-1.5 rounded-md transition-colors flex-1',
                    isRtl && 'text-right',
                    selectedPreset === preset
                      ? 'font-medium'
                      : 'hover:bg-accent hover:text-accent-foreground',
                    selectedPreset === preset && 'text-white'
                  )}
                  style={selectedPreset === preset ? { backgroundColor: MOEI_GOLD } : undefined}
                  onClick={() => handlePresetChange(preset)}
                >
                  {t(`dateFilter.${preset}`, language)}
                </button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Custom Date Range Picker */}
          {selectedPreset === 'custom_date_range' && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {t('dateFilter.selectDateRange', language)}
              </p>

              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">{t('dateFilter.startDate', language)}</p>
                <Calendar
                  mode="single"
                  selected={customStart}
                  onSelect={setCustomStart}
                  locale={dateLocale}
                  className="rounded-md border mx-auto"
                />
              </div>

              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">{t('dateFilter.endDate', language)}</p>
                <Calendar
                  mode="single"
                  selected={customEnd}
                  onSelect={setCustomEnd}
                  locale={dateLocale}
                  disabled={(date) => customStart ? date < customStart : false}
                  className="rounded-md border mx-auto"
                />
              </div>

              <Button
                className="w-full text-white"
                size="sm"
                disabled={!customStart || !customEnd}
                style={{ backgroundColor: MOEI_GOLD }}
                onClick={handleApplyCustomDateRange}
              >
                {t('dateFilter.apply', language)}
              </Button>
            </div>
          )}

          {/* Custom Month Range Picker */}
          {selectedPreset === 'custom_month_range' && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {t('dateFilter.selectMonthRange', language)}
              </p>

              <div className="grid grid-cols-2 gap-3">
                {/* Start */}
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">{t('dateFilter.from', language)}</p>
                  <Select value={String(startYear)} onValueChange={(v) => setStartYear(Number(v))}>
                    <SelectTrigger className="w-full h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map((y) => (
                        <SelectItem key={y} value={String(y)}>{String(y)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={String(startMonth)} onValueChange={(v) => setStartMonth(Number(v))}>
                    <SelectTrigger className="w-full h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {monthLabels.map((m) => (
                        <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* End */}
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">{t('dateFilter.to', language)}</p>
                  <Select value={String(endYear)} onValueChange={(v) => setEndYear(Number(v))}>
                    <SelectTrigger className="w-full h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map((y) => (
                        <SelectItem key={y} value={String(y)}>{String(y)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={String(endMonth)} onValueChange={(v) => setEndMonth(Number(v))}>
                    <SelectTrigger className="w-full h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {monthLabels.map((m) => (
                        <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                className="w-full text-white"
                size="sm"
                style={{ backgroundColor: MOEI_GOLD }}
                onClick={handleApplyMonthRange}
              >
                {t('dateFilter.apply', language)}
              </Button>
            </div>
          )}

          {/* Custom Year Range Picker */}
          {selectedPreset === 'custom_year_range' && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {t('dateFilter.selectYearRange', language)}
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">{t('dateFilter.from', language)}</p>
                  <Select value={String(startYear)} onValueChange={(v) => setStartYear(Number(v))}>
                    <SelectTrigger className="w-full h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map((y) => (
                        <SelectItem key={y} value={String(y)}>{String(y)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">{t('dateFilter.to', language)}</p>
                  <Select value={String(endYear)} onValueChange={(v) => setEndYear(Number(v))}>
                    <SelectTrigger className="w-full h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map((y) => (
                        <SelectItem key={y} value={String(y)}>{String(y)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                className="w-full text-white"
                size="sm"
                style={{ backgroundColor: MOEI_GOLD }}
                onClick={handleApplyYearRange}
              >
                {t('dateFilter.apply', language)}
              </Button>
            </div>
          )}

          {/* Clear Button */}
          {value.filterType && (
            <>
              <Separator />
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-destructive hover:text-destructive"
                onClick={handleClear}
              >
                {t('dateFilter.clear', language)}
              </Button>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export default DateFilter
