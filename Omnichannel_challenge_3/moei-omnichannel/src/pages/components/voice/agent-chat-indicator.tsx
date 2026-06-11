'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

const motionAnimationProps = {
  variants: {
    hidden: {
      opacity: 0,
      scale: 0.1,
      transition: {
        duration: 0.1,
        ease: 'linear' as const,
      },
    },
    visible: {
      opacity: [0.5, 1],
      scale: [1, 1.2],
      transition: {
        type: 'spring' as const,
        bounce: 0,
        duration: 0.5,
        repeat: Infinity,
        repeatType: 'mirror' as const,
      },
    },
  },
  initial: 'hidden',
  animate: 'visible',
  exit: 'hidden',
}

const sizeClasses: Record<string, string> = {
  sm: 'size-2.5',
  md: 'size-4',
  lg: 'size-6',
}

export interface AgentChatIndicatorProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

/**
 * An animated indicator that shows the agent is processing or thinking.
 * Displays as a pulsing dot, typically used in chat interfaces.
 */
export function AgentChatIndicator({
  size = 'md',
  className,
}: AgentChatIndicatorProps) {
  return (
    <motion.span
      {...motionAnimationProps}
      className={cn(
        'bg-muted-foreground inline-block rounded-full',
        sizeClasses[size] || sizeClasses.md,
        className
      )}
    />
  )
}
