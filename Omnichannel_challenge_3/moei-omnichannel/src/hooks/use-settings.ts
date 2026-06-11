'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAppStore } from '@/pages/store/app-store'

// ─── Settings Types ──────────────────────────────────────────────────────────

export interface UserSettings {
  fontSize: 'small' | 'medium' | 'large'
  highContrast: boolean
  reducedMotion: boolean
  screenReaderOpt: boolean

  // Notifications
  newMessageNotif: boolean
  caseAssignmentNotif: boolean
  escalationAlerts: boolean
  shiftReminders: boolean
  aiSuggestionNotif: boolean
  dailySummaryEmail: boolean
  criticalIncidentAlerts: boolean

  // Dashboard
  defaultView: string
  autoRefresh: string
  compactMode: boolean
  showAISuggestions: boolean
  soundNotifications: boolean
  notificationSound: string
}

const SETTINGS_KEY = 'moei_user_settings'

const DEFAULT_SETTINGS: UserSettings = {
  fontSize: 'medium',
  highContrast: false,
  reducedMotion: false,
  screenReaderOpt: false,

  newMessageNotif: true,
  caseAssignmentNotif: true,
  escalationAlerts: true,
  shiftReminders: true,
  aiSuggestionNotif: false,
  dailySummaryEmail: true,
  criticalIncidentAlerts: true,

  defaultView: 'agent',
  autoRefresh: '15',
  compactMode: false,
  showAISuggestions: true,
  soundNotifications: true,
  notificationSound: 'chime',
}

// ─── CSS Class Helpers ────────────────────────────────────────────────────────

const FONT_SIZE_CLASSES: Record<UserSettings['fontSize'], string> = {
  small: 'text-sm',
  medium: 'text-base',
  large: 'text-lg',
}

function applySettingsToBody(settings: UserSettings) {
  if (typeof document === 'undefined') return

  const body = document.body

  // Remove all possible setting classes first
  Object.values(FONT_SIZE_CLASSES).forEach((cls) => body.classList.remove(cls))
  body.classList.remove('high-contrast', 'reduced-motion', 'sr-optimized')

  // Apply current settings
  body.classList.add(FONT_SIZE_CLASSES[settings.fontSize])

  if (settings.highContrast) {
    body.classList.add('high-contrast')
  }

  if (settings.reducedMotion) {
    body.classList.add('reduced-motion')
  }

  if (settings.screenReaderOpt) {
    body.classList.add('sr-optimized')
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSettings() {
  const currentAgent = useAppStore((s) => s.currentAgent)
  const [settings, setSettingsState] = useState<UserSettings>(DEFAULT_SETTINGS)
  const [isLoaded, setIsLoaded] = useState(false)

  // Load settings from localStorage on mount
  useEffect(() => {
    const loadSettings = () => {
      try {
        const stored = localStorage.getItem(SETTINGS_KEY)
        if (stored) {
          const parsed = JSON.parse(stored)
          setSettingsState((prev) => ({
            ...prev,
            ...parsed,
          }))
        }
      } catch {
        // Ignore parse errors
      }
      setIsLoaded(true)
    }
    requestAnimationFrame(loadSettings)
  }, [])

  // Detect prefers-reduced-motion as default
  useEffect(() => {
    if (!isLoaded) return
    try {
      const stored = localStorage.getItem(SETTINGS_KEY)
      if (!stored) {
        // No stored settings — check OS preference
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        if (prefersReducedMotion) {
          requestAnimationFrame(() => {
            setSettingsState((prev) => ({ ...prev, reducedMotion: true }))
          })
        }
      }
    } catch {
      // Ignore
    }
  }, [isLoaded])

  // Apply CSS classes whenever settings change
  useEffect(() => {
    if (!isLoaded) return
    applySettingsToBody(settings)
  }, [settings, isLoaded])

  // Update a single setting
  const updateSetting = useCallback(<K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    setSettingsState((prev) => {
      const next = { ...prev, [key]: value }
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
      } catch {
        // Ignore storage errors
      }
      return next
    })
  }, [])

  // Batch update multiple settings
  const updateSettings = useCallback((updates: Partial<UserSettings>) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...updates }
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
      } catch {
        // Ignore storage errors
      }
      return next
    })
  }, [])

  // Reset to defaults
  const resetSettings = useCallback(() => {
    setSettingsState(DEFAULT_SETTINGS)
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(DEFAULT_SETTINGS))
    } catch {
      // Ignore storage errors
    }
  }, [])

  // Persist settings to backend (employer-settings API)
  const persistToBackend = useCallback(async () => {
    if (!currentAgent) return false
    try {
      const res = await fetch(`/api/employer-settings/${currentAgent.id}?XTransformPort=3002`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      return res.ok
    } catch {
      return false
    }
  }, [currentAgent, settings])

  return {
    settings,
    isLoaded,
    updateSetting,
    updateSettings,
    resetSettings,
    persistToBackend,
  }
}
