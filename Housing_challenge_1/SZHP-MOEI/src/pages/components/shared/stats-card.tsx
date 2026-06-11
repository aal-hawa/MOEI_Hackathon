import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface StatsCardProps {
  icon?: React.ComponentType<{ className?: string }>
  iconClassName?: string     // Color classes for icon container
  value: string | number
  label: string
  description?: string
  trend?: { value: number; label: string }  // Optional trend indicator
  className?: string
}

/**
 * Stat card pattern used across dashboard, audit, users, models views.
 * Extracted from stats-cards.tsx, audit-view.tsx, users-view.tsx, models-view.tsx.
 *
 * Renders: Icon (colored bg) → Value (large bold) → Label → Trend (optional)
 *
 * Common pattern in audit/users views:
 *  <Card className="border-X bg-X/50">
 *    <CardContent className="p-4 flex items-center gap-3">
 *      <div className="w-10 h-10 rounded-lg bg-X/10 flex items-center justify-center">
 *        <Icon className="w-5 h-5 text-X" />
 *      </div>
 *      <div>
 *        <div className="text-2xl font-bold text-X">{value}</div>
 *        <div className="text-xs text-X">{label}</div>
 *      </div>
 *    </CardContent>
 *  </Card>
 */
export function StatsCard({
  icon: Icon,
  iconClassName,
  value,
  label,
  description,
  trend,
  className,
}: StatsCardProps) {
  return (
    <Card className={className}>
      <CardContent className="p-4 flex items-center gap-3">
        {Icon && (
          <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', iconClassName)}>
            <Icon className="w-5 h-5" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-xl sm:text-2xl font-bold truncate">{value}</div>
          <div className="text-xs truncate">{label}</div>
          {description && (
            <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{description}</div>
          )}
          {trend && (
            <div
              className={cn(
                'flex items-center gap-0.5 text-xs font-medium mt-1',
                trend.value >= 0 ? 'text-ae-green-600' : 'text-ae-red-600'
              )}
            >
              {trend.value >= 0 ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              <span>{Math.abs(trend.value)}%</span>
              {trend.label && <span className="text-muted-foreground ms-1">{trend.label}</span>}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
