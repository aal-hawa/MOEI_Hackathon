/**
 * System Config with KV Cache
 * Ported from src/lib/config.ts
 * Uses Cloudflare KV for caching instead of in-memory
 */

import type { Env } from '../types'
import { DbClient } from '../db/queries'

const CACHE_TTL = 300 // 5 minutes in seconds for KV

const CONFIG_CACHE_KEY = 'szhp:system_config'

/**
 * Load all active configs from D1, using KV as a cache layer
 */
async function loadConfigs(db: DbClient, kv: KVNamespace): Promise<Record<string, string>> {
  // Try KV cache first
  try {
    const cached = await kv.get(CONFIG_CACHE_KEY, 'json')
    if (cached && typeof cached === 'object') {
      return cached as Record<string, string>
    }
  } catch {
    // KV miss or error, proceed to D1
  }

  // Load from D1
  try {
    const result = await db.findActiveConfigs()
    const configs: Record<string, string> = {}
    for (const row of (result.results || [])) {
      configs[(row as any).configKey] = (row as any).configValue
    }

    // Store in KV with TTL
    try {
      await kv.put(CONFIG_CACHE_KEY, JSON.stringify(configs), { expirationTtl: CACHE_TTL })
    } catch {
      // KV write failure is non-critical
    }

    return configs
  } catch {
    console.warn('Could not load system configs from D1, using defaults')
    return {}
  }
}

/**
 * Invalidate the config cache in KV
 */
export async function invalidateConfigCache(kv: KVNamespace): Promise<void> {
  try {
    await kv.delete(CONFIG_CACHE_KEY)
  } catch {
    // Non-critical
  }
}

/**
 * Get a config value as a number
 */
export async function getConfigNumber(db: DbClient, kv: KVNamespace, key: string, fallback: number): Promise<number> {
  const configs = await loadConfigs(db, kv)
  const value = configs[key]
  if (value === undefined) return fallback
  const num = parseFloat(value)
  return isNaN(num) ? fallback : num
}

/**
 * Get a config value as a boolean
 */
export async function getConfigBoolean(db: DbClient, kv: KVNamespace, key: string, fallback: boolean): Promise<boolean> {
  const configs = await loadConfigs(db, kv)
  const value = configs[key]
  if (value === undefined) return fallback
  return value === 'true'
}

/**
 * Get a config value as a string
 */
export async function getConfigString(db: DbClient, kv: KVNamespace, key: string, fallback: string): Promise<string> {
  const configs = await loadConfigs(db, kv)
  return configs[key] ?? fallback
}

/**
 * Get all configs as a flat object
 */
export async function getAllConfigs(db: DbClient, kv: KVNamespace): Promise<Record<string, string>> {
  return loadConfigs(db, kv)
}
