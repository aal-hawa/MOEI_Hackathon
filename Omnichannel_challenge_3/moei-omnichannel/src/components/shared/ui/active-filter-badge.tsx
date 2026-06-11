// External dependencies (shadcn/ui):
//   - Badge from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { X } from 'lucide-react'

interface ActiveFilterBadgeProps {
  label: string
  onRemove: () => void
  className?: string
}

/**
 * Badge with X close button for active filters.
 * Extracted from case-list.tsx and users-view.tsx.
 *
 * Uses Badge variant="secondary" + X icon
 */
export function ActiveFilterBadge({ label, onRemove, className }: ActiveFilterBadgeProps) {
  return (
    <Badge variant="secondary" className={cn('text-xs gap-1', className)}>
      {label}
      <X className="size-3 cursor-pointer" onClick={onRemove} />
    </Badge>
  )
}

