'use client'

import { useEffect } from 'react'

export function SuppressWarnings() {
  useEffect(() => {
    const originalConsoleError = console.error
    console.error = (...args: any[]) => {
      if (
        typeof args[0] === 'string' &&
        (args[0].includes('Encountered a script tag while rendering React component') ||
         args[0].includes('Scripts inside React components are never executed'))
      ) {
        return
      }
      originalConsoleError.apply(console, args as any)
    }

    return () => {
      console.error = originalConsoleError
    }
  }, [])

  return null
}
