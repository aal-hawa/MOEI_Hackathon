// External dependencies (shadcn/ui):
//   - Input from '@/components/ui/input'
//   - Badge from '@/components/ui/badge'
//   - Button from '@/components/ui/button'
//   - Select, SelectContent, SelectItem, SelectTrigger, SelectValue from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, X, SlidersHorizontal } from 'lucide-react'
import { ActiveFilterBadge } from './active-filter-badge'

interface FilterOption {
  value: string
  label: string
}

interface FilterConfig {
  key: string
  value: string
  onChange: (value: string) => void
  options: FilterOption[]
  placeholder?: string
}

interface ActiveFilter {
  key: string
  label: string
  onRemove: () => void
}

interface SearchFilterBarProps {
  searchValue: string
  onSearchChange: (value: string) => void
  searchPlaceholder?: string
  filters?: FilterConfig[]
  activeFilters?: ActiveFilter[]
  resultCount?: { filtered: number; total: number }  // e.g. "5 of 20 results"
  resultCountLabel?: string  // Custom label like "5 of 20 employees"
  onClearAll?: () => void
  className?: string
}

/**
 * Search + filter pattern with active filter badges.
 * Extracted from case-list.tsx and users-view.tsx.
 *
 * Renders: Search input → Filter dropdowns → Active filter badges
 */
export function SearchFilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search...',
  filters = [],
  activeFilters = [],
  resultCount,
  resultCountLabel,
  onClearAll,
  className,
}: SearchFilterBarProps) {
  const hasActiveFilters = activeFilters.length > 0 || searchValue.trim() !== ''

  return (
    <div className={cn('space-y-3', className)}>
      {/* Search + Filter Dropdowns */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            className="ps-9 pe-9"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {searchValue && (
            <button
              type="button"
              className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => onSearchChange('')}
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        {filters.map((filter) => (
          <Select key={filter.key} value={filter.value} onValueChange={filter.onChange}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder={filter.placeholder} />
            </SelectTrigger>
            <SelectContent>
              {filter.options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}
      </div>

      {/* Active Filters Indicator */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 text-sm flex-wrap">
          <SlidersHorizontal className="size-3.5 text-muted-foreground" />
          {resultCount && (
            <span className="text-muted-foreground">
              {resultCountLabel
                ? resultCountLabel
                : `${resultCount.filtered} of ${resultCount.total} results`}
            </span>
          )}
          {activeFilters.map((filter) => (
            <ActiveFilterBadge
              key={filter.key}
              label={filter.label}
              onRemove={filter.onRemove}
            />
          ))}
          {searchValue && (
            <ActiveFilterBadge
              label={`"${searchValue}"`}
              onRemove={() => onSearchChange('')}
            />
          )}
          {onClearAll && (
            <Button variant="ghost" size="sm" className="text-xs h-6 px-2 text-muted-foreground" onClick={onClearAll}>
              Clear all
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

