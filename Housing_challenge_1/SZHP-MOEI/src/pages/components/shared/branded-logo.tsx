import { cn } from '@/lib/utils'
import { Shield } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { t } from '@/lib/i18n'

interface BrandedLogoProps {
  variant?: 'full' | 'compact' | 'icon-only'
  size?: 'sm' | 'md' | 'lg'
  className?: string
  showMinistry?: boolean  // show "Ministry of Energy & Infrastructure" subtitle
  title?: string          // override default title text
  subtitle?: string       // override default subtitle text
  titleClassName?: string // override default title styling
  subtitleClassName?: string // override default subtitle styling
}

/**
 * Shield + organization name pattern.
 * Extracted from index.tsx (header + footer), admin.tsx (sidebar), admin-login.tsx.
 *
 * variant=full: Shield icon + title + subtitle (header)
 * variant=compact: Shield icon + title only (sidebar)
 * variant=icon-only: Just the Shield icon (mobile)
 *
 * Gold background: bg-ae-gold-500 for icon container
 */
export function BrandedLogo({ variant = 'full', size = 'md', className, showMinistry = false, title: titleOverride, subtitle: subtitleOverride, titleClassName, subtitleClassName }: BrandedLogoProps) {
  const { language } = useAppStore()

  const iconSizes = {
    sm: { container: 'w-8 h-8 rounded-lg', icon: 'w-4 h-4' },
    md: { container: 'w-10 h-10 rounded-lg', icon: 'w-5 h-5' },
    lg: { container: 'w-14 h-14 rounded-xl', icon: 'w-7 h-7' },
  } as const

  const s = iconSizes[size]

  if (variant === 'icon-only') {
    return (
      <div
        className={cn('bg-ae-gold-500 flex items-center justify-center', s.container, className)}
        role="img"
        aria-label="SZHP Logo"
      >
        <Shield className={cn('text-white', s.icon)} aria-hidden="true" />
      </div>
    )
  }

  // variant === 'compact' | 'full'
  const textSizes = {
    sm: { title: 'text-xs', subtitle: 'text-[8px]' },
    md: { title: 'text-sm', subtitle: 'text-[10px]' },
    lg: { title: 'text-2xl', subtitle: 'text-sm' },
  } as const

  const ts = textSizes[size]

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div
        className={cn('bg-ae-gold-500 flex items-center justify-center shrink-0', s.container)}
        role="img"
        aria-label="SZHP Logo"
      >
        <Shield className={cn('text-white', s.icon)} aria-hidden="true" />
      </div>
      <div className="overflow-hidden whitespace-nowrap">
        <div className={cn('font-bold text-ae-black-700', ts.title, titleClassName)}>
          {titleOverride ?? t('admin.szhpAdmin', language)}
        </div>
        {(variant === 'full' || showMinistry) && (
          <div className={cn('text-ae-black-400', ts.subtitle, subtitleClassName)}>
            {subtitleOverride ?? t('admin.adminDashboard', language)}
          </div>
        )}
      </div>
    </div>
  )
}
