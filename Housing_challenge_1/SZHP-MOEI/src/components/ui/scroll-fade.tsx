'use client'

import { useState, useRef, useCallback, useEffect, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * ScrollFade — Wraps a scrollable container with gradient fade indicators
 * at top and bottom edges. The gradients disappear when scrolled to extent.
 *
 * Usage:
 * <ScrollFade>
 *   <ScrollArea className="flex-1">...content...</ScrollArea>
 * </ScrollFade>
 *
 * Or for any scrollable div:
 * <ScrollFade>
 *   <div className="overflow-y-auto">...content...</div>
 * </ScrollFade>
 */
export function ScrollFade({
  children,
  className,
  fadeSize = 40,
  color = 'var(--background)',
  ...props
}: {
  children: ReactNode
  className?: string
  fadeSize?: number
  color?: string
} & React.HTMLAttributes<HTMLDivElement>) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [showTopFade, setShowTopFade] = useState(false)
  const [showBottomFade, setShowBottomFade] = useState(false)

  const checkScroll = useCallback(() => {
    const el = containerRef.current
    if (!el) return

    // Find the actual scrollable element — could be the container itself or a child ScrollArea viewport
    const scrollEl = findScrollElement(el)
    if (!scrollEl) return

    const { scrollTop, scrollHeight, clientHeight } = scrollEl
    const atTop = scrollTop <= 2
    const atBottom = scrollTop + clientHeight >= scrollHeight - 2

    setShowTopFade(!atTop)
    setShowBottomFade(!atBottom)
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    // Check initial state
    checkScroll()

    // Observe the scrollable element
    const scrollEl = findScrollElement(el)
    if (scrollEl) {
      scrollEl.addEventListener('scroll', checkScroll, { passive: true })
      // Also observe resize
      const observer = new ResizeObserver(checkScroll)
      observer.observe(scrollEl)

      return () => {
        scrollEl.removeEventListener('scroll', checkScroll)
        observer.disconnect()
      }
    }
  }, [checkScroll, children])

  return (
    <div ref={containerRef} className={cn('relative grid [grid-template-rows:1fr] overflow-hidden', className)} {...props}>
      {/* Top fade gradient */}
      <div
        className={cn(
          'pointer-events-none absolute top-0 left-0 right-0 z-10 transition-opacity duration-200',
          showTopFade ? 'opacity-100' : 'opacity-0'
        )}
        style={{
          height: `${fadeSize}px`,
          background: `linear-gradient(to bottom, ${color} 0%, transparent 100%)`,
        }}
      />
      <div className="min-h-0 overflow-hidden">
        {children}
      </div>
      {/* Bottom fade gradient */}
      <div
        className={cn(
          'pointer-events-none absolute bottom-0 left-0 right-0 z-10 transition-opacity duration-200',
          showBottomFade ? 'opacity-100' : 'opacity-0'
        )}
        style={{
          height: `${fadeSize}px`,
          background: `linear-gradient(to top, ${color} 0%, transparent 100%)`,
        }}
      />
    </div>
  )
}

/** Find the actual scrollable element — either the element itself or a ScrollArea viewport child */
function findScrollElement(el: HTMLElement): HTMLElement | null {
  // If the element itself is scrollable
  if (el.scrollHeight > el.clientHeight) return el

  // Look for ScrollArea viewport (Radix sets data-radix-scroll-area-viewport)
  const viewport = el.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null
  if (viewport && viewport.scrollHeight > viewport.clientHeight) return viewport

  // Look for any scrollable child with overflow-y-auto
  const scrollChild = el.querySelector('[class*="overflow-y-auto"], [class*="overflow-auto"]') as HTMLElement | null
  if (scrollChild && scrollChild.scrollHeight > scrollChild.clientHeight) return scrollChild

  // Fallback to the element itself
  return el
}
