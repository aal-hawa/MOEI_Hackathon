import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'

interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>  // Lucide icon component
  title: string
  description?: string
  action?: React.ReactNode  // Optional action button
  className?: string
}

/**
 * "No data" empty state pattern.
 * Extracted from case-list.tsx, users-view.tsx, audit-view.tsx.
 *
 * Renders centered: Icon → Title → Description → Action
 * Light background, muted colors
 */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <Card className={className}>
      <CardContent className="flex flex-col items-center justify-center py-12">
        {Icon && (
          <div className="rounded-full bg-muted p-4 mb-4">
            <Icon className="size-8 text-muted-foreground" />
          </div>
        )}
        <h3 className="text-lg font-semibold mb-1">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground mb-4">
            {description}
          </p>
        )}
        {action}
      </CardContent>
    </Card>
  )
}
