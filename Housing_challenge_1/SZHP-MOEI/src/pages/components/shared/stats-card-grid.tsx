import { cn } from '@/lib/utils'

interface StatsCardGridProps {
  children: React.ReactNode
  columns?: 2 | 3 | 4 | 5 | 6  // default 4
  className?: string
}

const columnClasses: Record<number, string> = {
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
  5: 'lg:grid-cols-5',
  6: 'lg:grid-cols-6',
}

/**
 * Responsive grid wrapper for StatsCard components.
 * Extracted from dashboard, audit, users, models views.
 *
 * Responsive grid: grid-cols-2 lg:grid-cols-{columns}
 * gap-4 or gap-6
 */
export function StatsCardGrid({ children, columns = 4, className }: StatsCardGridProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-2 sm:grid-cols-2 gap-4',
        columnClasses[columns],
        className
      )}
    >
      {children}
    </div>
  )
}
