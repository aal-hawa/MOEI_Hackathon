'use client'

import { cn } from '@/lib/utils'

interface UaeCardProps {
  children: React.ReactNode
  /** Optional card title rendered in the header area */
  title?: string
  /** Optional icon next to the title */
  icon?: React.ComponentType<{ className?: string }>
  /** Right-side actions in the card header */
  actions?: React.ReactNode
  /** Additional class names for the outer card element */
  className?: string
  /** Additional class names for the inner content area */
  contentClassName?: string
  /** If true, no inner padding — child controls its own spacing */
  noPadding?: boolean
  /** Gold top border accent (default true) */
  goldBorder?: boolean
}

/**
 * UAE DLS Card wrapper — white background, subtle border, gentle shadow,
 * rounded corners, and an optional gold top-border accent.
 *
 * Pattern: `.uae-card` utility with gold top-border accent.
 * Follows TDRA DLS 3.0 card style guidelines.
 */
export function UaeCard({
  children,
  title,
  icon: Icon,
  actions,
  className,
  contentClassName,
  noPadding = false,
  goldBorder = true,
}: UaeCardProps) {
  return (
    <div
      className={cn(
        'bg-white border border-ae-black-100 shadow-sm rounded-xl overflow-hidden',
        goldBorder && 'border-t-[3px] border-t-ae-gold-400',
        className
      )}
    >
      {/* Card Header — only rendered when title or actions are provided */}
      {(title || actions) && (
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-ae-black-100/60 bg-ae-gold-50/40">
          <div className="flex items-center gap-2.5">
            {Icon && (
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-ae-gold-100">
                <Icon className="w-4 h-4 text-ae-gold-600" />
              </div>
            )}
            {title && (
              <h3 className="text-base font-semibold text-ae-black-700">{title}</h3>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      {/* Card Content */}
      <div
        className={cn(
          noPadding ? '' : 'px-6 py-5',
          contentClassName
        )}
      >
        {children}
      </div>
    </div>
  )
}
