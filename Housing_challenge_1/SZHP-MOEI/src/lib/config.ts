import { db } from '@/lib/db'

/**
 * Helper to read system config values from the database.
 * Falls back to default values if DB is unavailable.
 */

// Cache for system configs (refreshed every 5 minutes)
let configCache: Record<string, string> = {}
let cacheExpiry = 0
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

async function loadConfigs(): Promise<Record<string, string>> {
  const now = Date.now()
  if (Object.keys(configCache).length > 0 && now < cacheExpiry) {
    return configCache
  }

  try {
    const configs = await db.systemConfig.findMany({
      where: { isActive: true },
      select: { configKey: true, configValue: true },
    })

    configCache = {}
    for (const c of configs) {
      configCache[c.configKey] = c.configValue
    }
    cacheExpiry = now + CACHE_TTL
  } catch {
    console.warn('Could not load system configs from DB, using defaults')
  }

  return configCache
}

// Invalidate cache when admin updates configs
export function invalidateConfigCache() {
  configCache = {}
  cacheExpiry = 0
}

/**
 * Get a config value as a number
 */
export async function getConfigNumber(key: string, fallback: number): Promise<number> {
  const configs = await loadConfigs()
  const value = configs[key]
  if (value === undefined) return fallback
  const num = parseFloat(value)
  return isNaN(num) ? fallback : num
}

/**
 * Get a config value as a boolean
 */
export async function getConfigBoolean(key: string, fallback: boolean): Promise<boolean> {
  const configs = await loadConfigs()
  const value = configs[key]
  if (value === undefined) return fallback
  return value === 'true'
}

/**
 * Get a config value as a string
 */
export async function getConfigString(key: string, fallback: string): Promise<string> {
  const configs = await loadConfigs()
  return configs[key] ?? fallback
}

/**
 * Get all configs as a flat object
 */
export async function getAllConfigs(): Promise<Record<string, string>> {
  return loadConfigs()
}
