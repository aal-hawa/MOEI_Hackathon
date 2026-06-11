'use client'

import React, { Component, createContext, useContext, useEffect } from 'react'
import { useVoiceAgent, type UseVoiceAgentReturn, type VoiceAgentState, type TranscriptMessage, type VoiceAgentConfig } from '@/hooks/useVoiceAgent'

const VoiceAgentContext = createContext<UseVoiceAgentReturn | null>(null)

export function useVoiceAgentContext(): UseVoiceAgentReturn {
  const context = useContext(VoiceAgentContext)
  if (!context) throw new Error('useVoiceAgentContext must be used within a VoiceAgentProvider')
  return context
}

export { type VoiceAgentState, type TranscriptMessage, type VoiceAgentConfig, type VoiceProviderStatus }

interface VoiceAgentProviderProps { children: React.ReactNode }

function VoiceAgentProviderInner({ children }: VoiceAgentProviderProps) {
  const agent = useVoiceAgent()

  // Set the default config with empty socketUrl — the hook uses Caddy gateway internally
  useEffect(() => {
    const voiceConfig: VoiceAgentConfig = {
      socketUrl: '',
      socketOptions: {
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        connectTimeout: 15000,
        sessionTimeout: 15000,
      },
    }
    agent.updateConfig(voiceConfig)
    // Only run once on mount
  }, [])

  return (
    <VoiceAgentContext.Provider value={agent}>
      {children}
    </VoiceAgentContext.Provider>
  )
}

// Error boundary to prevent white screen crash if voice agent throws
interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class VoiceAgentErrorBoundary extends Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[VoiceAgentErrorBoundary]', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="text-red-600">
              <path d="m15 9-6 6"/><path d="m9 9 6 6"/>
            </svg>
          </div>
          <h3 className="font-semibold text-base-900 mb-2">Voice Agent Error</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-md">
            The voice agent encountered an error. This might be due to microphone permissions or a connection issue.
          </p>
          <p className="text-xs text-muted-foreground mb-4">{this.state.error?.message}</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export function VoiceAgentProvider({ children }: VoiceAgentProviderProps) {
  return (
    <VoiceAgentErrorBoundary>
      <VoiceAgentProviderInner>{children}</VoiceAgentProviderInner>
    </VoiceAgentErrorBoundary>
  )
}
