'use client'

import { useState, useCallback, useSyncExternalStore } from 'react'

/**
 * Client-side hook to read system config values from the /api/system-config endpoint.
 * Used by both public-facing pages (landing, new-request) and admin pages.
 *
 * Strategy:
 *  1. First fetches public configs via ?public=true (no auth required)
 *  2. Then attempts to fetch ALL configs (requires admin auth)
 *  3. If the full fetch succeeds, use it (admin gets everything)
 *  4. If the full fetch fails (401), keep the public configs
 *  5. Either way, the landing page and public pages get the values they need
 */

interface SystemConfigItem {
  configKey: string
  configValue: string
  valueType: string
  category: string
  unit: string | null
  labelEN: string
  labelAR: string
  min: number | null
  max: number | null
  isPublic: boolean
}

// ── Global Store with External Store Pattern ──────────────────────────────────
// This follows the React useSyncExternalStore pattern for safe concurrent rendering

let globalConfigsMap: Record<string, SystemConfigItem> = {}
let cacheTimestamp = 0
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes
let fetchPromise: Promise<void> | null = null
let version = 0 // Incremented to trigger re-renders

type Listener = () => void
let listeners: Listener[] = []

function emitChange() {
  version++
  for (const listener of listeners) {
    listener()
  }
}

function subscribe(listener: Listener): () => void {
  listeners = [...listeners, listener]
  return () => {
    listeners = listeners.filter((l) => l !== listener)
  }
}

function getSnapshot() {
  return version
}

function getServerSnapshot() {
  return 0
}

async function doFetchConfigs(): Promise<void> {
  try {
    // Step 1: Always fetch public configs first (no auth required)
    const publicRes = await fetch('/api/system-config?public=true')
    if (publicRes.ok) {
      const publicData = await publicRes.json()
      const publicConfigs: SystemConfigItem[] = publicData.configs || []
      const map: Record<string, SystemConfigItem> = {}
      for (const c of publicConfigs) {
        map[c.configKey] = c
      }
      globalConfigsMap = map
      cacheTimestamp = Date.now()
      emitChange()
    }

    // Step 2: Try fetching ALL configs (requires admin auth)
    // If this succeeds, it overrides the public set with the complete set
    // Use authFetch so the token is sent for admin users
    try {
      let token: string | null = null
      try {
        const raw = localStorage.getItem('szhp-auth-storage')
        if (raw) {
          const parsed = JSON.parse(raw)
          token = parsed?.state?.accessToken ?? null
        }
      } catch {
        // ignore
      }
      // Only attempt full fetch if user has a token (admin or logged-in citizen)
      if (token) {
        const headers: Record<string, string> = {}
        headers['Authorization'] = `Bearer ${token}`
        const fullRes = await fetch('/api/system-config', { headers })
        if (fullRes.ok) {
          const fullData = await fullRes.json()
          const fullConfigs: SystemConfigItem[] = fullData.configs || []
          const map: Record<string, SystemConfigItem> = {}
          for (const c of fullConfigs) {
            map[c.configKey] = c
          }
          globalConfigsMap = map
          cacheTimestamp = Date.now()
          emitChange()
        }
        // If full fetch returns 401, that's expected for unauthenticated users —
        // we already have the public configs from step 1, so nothing more to do.
      }
    } catch {
      // Full fetch failed (network error, etc.) — public configs are still available
    }
  } catch (err) {
    console.warn('Failed to fetch system configs:', err)
  }
}

function ensureLoaded(): void {
  const now = Date.now()
  if (Object.keys(globalConfigsMap).length > 0 && now - cacheTimestamp < CACHE_TTL) {
    return
  }
  if (!fetchPromise) {
    fetchPromise = doFetchConfigs().finally(() => {
      fetchPromise = null
    })
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useSystemConfig() {
  // Subscribe to version changes so we re-render when configs load
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  // Trigger initial fetch (idempotent)
  if (typeof window !== 'undefined') {
    ensureLoaded()
  }

  // Get a config value as a number
  const getNumber = useCallback((key: string, fallback: number): number => {
    const config = globalConfigsMap[key]
    if (!config) return fallback
    const num = parseFloat(config.configValue)
    return isNaN(num) ? fallback : num
  }, [])

  // Get a config value as a boolean
  const getBoolean = useCallback((key: string, fallback: boolean): boolean => {
    const config = globalConfigsMap[key]
    if (!config) return fallback
    return config.configValue === 'true'
  }, [])

  // Get a config value as a string
  const getString = useCallback((key: string, fallback: string): string => {
    const config = globalConfigsMap[key]
    return config ? config.configValue : fallback
  }, [])

  // Get a percentage value (stored as decimal, displayed as whole number)
  const getPercentage = useCallback((key: string, fallback: number): number => {
    const val = getNumber(key, fallback)
    // If stored as decimal (e.g. 0.6 for 60%), convert to percentage
    if (val <= 1) return Math.round(val * 100)
    return val
  }, [getNumber])

  return {
    configs: globalConfigsMap,
    loading: Object.keys(globalConfigsMap).length === 0,
    getNumber,
    getBoolean,
    getString,
    getPercentage,
    reload: useCallback(() => {
      cacheTimestamp = 0
      doFetchConfigs()
    }, []),
  }
}
