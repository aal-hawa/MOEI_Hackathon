'use client'

import { cn } from '@/lib/utils'

interface PageHeaderProps {
  /** Main title text */
  title: string
  /** Optional subtitle / description */
  description?: string
  /** Breadcrumb parent label (e.g. "Admin") */
  breadcrumb?: string
  /** Optional icon rendered before the title */
  icon?: React.ComponentType<{ className?: string }>
  /** Right-side actions */
  actions?: React.ReactNode
  className?: string
}

/**
 * MOEI Page Header with breadcrumb-style title, gold accent underline,
 * and optional description. Follows UAE TDRA DLS 3.0 visual identity.
 *
 * Renders: Breadcrumb → Icon + Title (gold gradient) → Gold underline → Description
 */
export function PageHeader({
  title,
  description,
  breadcrumb,
  icon: Icon,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('mb-8', className)}>
      {/* Breadcrumb */}
      {breadcrumb && (
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-xs font-medium text-ae-black-300 uppercase tracking-wider">
            {breadcrumb}
          </span>
          <span className="text-ae-black-200">/</span>
          <span className="text-xs font-semibold text-ae-gold-500 uppercase tracking-wider">
            {title}
          </span>
        </div>
      )}

      {/* Title Row */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-ae-gold-50 border border-ae-gold-200/60">
              <Icon className="w-5 h-5 text-ae-gold-600" />
            </div>
          )}
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gradient-gold tracking-tight">
              {title}
            </h1>
          </div>
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>

      {/* Gold accent underline */}
      <div className="mt-3 flex items-center gap-3">
        <div className="h-[3px] w-16 bg-gradient-to-r from-ae-gold-400 via-ae-gold-500 to-ae-gold-400 rounded-full" />
        <div className="h-px flex-1 bg-ae-gold-100" />
      </div>

      {/* Description */}
      {description && (
        <p className="mt-3 text-sm text-ae-black-400 max-w-2xl leading-relaxed">
          {description}
        </p>
      )}
    </div>
  )
}
