// External dependencies (shadcn/ui):
//   - Badge from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

interface SectionHeadingProps {
  badge?: string          // Badge text above title
  badgeClassName?: string // Custom badge styling
  title: string           // Main heading text
  titleAs?: 'h2' | 'h3'  // Heading level, default h2
  description?: string    // Subtitle/description text
  className?: string
  align?: 'left' | 'center'  // default center
}

/**
 * Badge + Title + Description section heading.
 * Extracted from index.tsx (6+ sections).
 *
 * Renders: Badge (optional) → Title (bold) → Description (muted)
 * Center-aligned by default with proper spacing.
 */
export function SectionHeading({
  badge,
  badgeClassName,
  title,
  titleAs: TitleTag = 'h2',
  description,
  className,
  align = 'center',
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        'mb-16 animate-fade-in-up',
        align === 'center' && 'text-center',
        className
      )}
    >
      {badge && (
        <Badge
          className={cn(
            'mb-4',
            align === 'center' && 'mx-auto',
            badgeClassName
          )}
        >
          {badge}
        </Badge>
      )}
      <TitleTag className="text-3xl sm:text-4xl lg:text-5xl font-bold text-ae-black-800 mb-4">
        {title}
      </TitleTag>
      {description && (
        <p
          className={cn(
            'text-gray-500 max-w-3xl font-medium',
            align === 'center' && 'mx-auto',
            'text-lg sm:text-xl'
          )}
        >
          {description}
        </p>
      )}
    </div>
  )
}

