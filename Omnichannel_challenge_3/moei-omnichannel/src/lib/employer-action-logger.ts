/**
 * Employer Action Logger Utility
 * 
 * Provides a simple function to log employer actions to the backend.
 * Used across the admin dashboard to track: viewing conversations,
 * sending messages, transfers, AI mode changes, settings changes, etc.
 */

import { useAppStore } from '@/store/app-store'

export type EmployerAction =
  | 'login'
  | 'logout'
  | 'view_conversation'
  | 'send_message'
  | 'transfer'
  | 'change_ai_mode'
  | 'update_settings'
  | 'create_rule'
  | 'edit_rule'
  | 'delete_rule'
  | 'send_uaepass_email'
  | 'uaepass_login'

interface LogActionParams {
  action: EmployerAction
  details?: Record<string, unknown>
  channel?: 'web' | 'whatsapp' | 'voice' | 'email'
  targetId?: string
}

/**
 * Log an employer action to the backend.
 * Silently fails if the request fails (non-critical).
 */
export async function logEmployerAction(params: LogActionParams): Promise<void> {
  const { currentAgent } = useAppStore.getState()
  if (!currentAgent) return // No agent logged in, skip logging

  try {
    await fetch('/api/employer-sessions/action?XTransformPort=3002', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: currentAgent.id,
        agentEmail: currentAgent.email,
        action: params.action,
        details: params.details || {},
        channel: params.channel || null,
        targetId: params.targetId || null,
      }),
    })
  } catch {
    // Silent — action logging is non-critical
  }
}
