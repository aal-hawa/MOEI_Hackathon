import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { useAppStore } from '@/lib/store'
import { t } from '@/lib/i18n'

interface OnlineBadgeProps {
  className?: string
  showLabel?: boolean  // default true
  size?: 'sm' | 'md'   // sm for footer, md for header
}

/**
 * "System Online" pulse badge with green dot.
 * Extracted from index.tsx (header + footer), admin.tsx (header + footer), admin-login.tsx.
 *
 * md (header) — matches: border-ae-green-500/30 bg-ae-green-50/50 text-ae-green-700 shadow-sm backdrop-blur-sm px-3 py-1
 * sm (footer) — matches: text-[10px] h-5 px-1.5 border-ae-green-500 text-ae-green-600
 */
export function OnlineBadge({ className, showLabel = true, size = 'md' }: OnlineBadgeProps) {
  const { language } = useAppStore()

  if (size === 'sm') {
    return (
      <Badge
        variant="outline"
        className={cn(
          'text-[10px] h-5 px-1.5 border-ae-green-500 text-ae-green-600',
          className
        )}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-ae-green-500 me-1 pulse-live" />
        {showLabel && (isArOnlineLabel(language))}
      </Badge>
    )
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        'text-xs border-ae-green-500/30 bg-ae-green-50/50 text-ae-green-700 shadow-sm backdrop-blur-sm px-3 py-1',
        className
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-ae-green-500 me-1 pulse-live" />
      {showLabel && t('admin.header.systemOnline', language)}
    </Badge>
  )
}

function isArOnlineLabel(language: string): string {
  return language === 'ar' ? 'متصل' : 'Online'
}
