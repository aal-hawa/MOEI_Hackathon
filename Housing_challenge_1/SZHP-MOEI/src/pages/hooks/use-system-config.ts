import { useState, useCallback, useSyncExternalStore } from 'react'
import { authFetch, apiFetch } from '@/lib/utils'

/**
 * Client-side hook to read system config values from the /api/system-config endpoint.
 * Used by both public-facing pages (landing, new-request) and admin pages.
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

let globalConfigsMap: Record<string, SystemConfigItem> = {}
let cacheTimestamp = 0
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes
let fetchPromise: Promise<void> | null = null
let version = 0

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
    const publicRes = await apiFetch('/api/system-config?public=true')
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
    try {
      let token: string | null = null
      try {
        const raw = sessionStorage.getItem('szhp-auth-storage')
        if (raw) {
          const parsed = JSON.parse(raw)
          token = parsed?.state?.accessToken ?? null
        }
      } catch {
        // ignore
      }
      if (token) {
        const fullRes = await authFetch('/api/system-config')
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
      }
    } catch {
      // Full fetch failed — public configs are still available
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
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  if (typeof window !== 'undefined') {
    ensureLoaded()
  }

  const getNumber = useCallback((key: string, fallback: number): number => {
    const config = globalConfigsMap[key]
    if (!config) return fallback
    const num = parseFloat(config.configValue)
    return isNaN(num) ? fallback : num
  }, [])

  const getBoolean = useCallback((key: string, fallback: boolean): boolean => {
    const config = globalConfigsMap[key]
    if (!config) return fallback
    return config.configValue === 'true'
  }, [])

  const getString = useCallback((key: string, fallback: string): string => {
    const config = globalConfigsMap[key]
    return config ? config.configValue : fallback
  }, [])

  const getPercentage = useCallback((key: string, fallback: number): number => {
    const val = getNumber(key, fallback)
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
