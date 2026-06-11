// No external shadcn/ui dependencies
import { cn } from '@/lib/utils'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
  label?: string
}

const sizeMap = {
  sm: 'w-5 h-5',
  md: 'w-8 h-8',
  lg: 'w-12 h-12',
} as const

/**
 * Gold spinner with optional label below.
 * Extracted from App.tsx (PageLoader) and admin.tsx (LoadingSpinner).
 */
export function LoadingSpinner({ size = 'md', className, label }: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className={cn(
          sizeMap[size],
          'border-2 border-ae-gold-500/30 border-t-ae-gold-500 rounded-full animate-spin',
          className
        )}
      />
      {label !== undefined && (
        <span className="text-sm text-muted-foreground">{label}</span>
      )}
    </div>
  )
}

/**
 * Full-screen centered loading spinner.
 * Extracted from App.tsx PageLoader fallback.
 */
export function PageLoader({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <LoadingSpinner size="md" label={label} />
    </div>
  )
}

