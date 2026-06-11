/**
 * MOEI Configuration Loader
 * Reads moei-config.json from the project root and caches it in memory.
 * Falls back to environment variables if the config file is unavailable.
 */

import fs from 'fs/promises'
import path from 'path'

export interface MoeiConfig {
  apiKeys: {
    recentechAI: string
    gemini: string
    deepgram?: string
    cartesia?: string
  }
  endpoints: {
    recentechAIWorker: string
    recentechAIGemini: string
    recentechAIChat: string
  }
  voice?: {
    stt?: Record<string, unknown>
    tts?: Record<string, unknown>
  }
  llm?: Record<string, unknown>
  database?: Record<string, unknown>
}

let cachedConfig: MoeiConfig | null = null

export async function getMoeiConfig(): Promise<MoeiConfig> {
  if (cachedConfig) return cachedConfig
  try {
    const configPath = path.join(process.cwd(), 'moei-config.json')
    const raw = await fs.readFile(configPath, 'utf-8')
    cachedConfig = JSON.parse(raw) as MoeiConfig
    return cachedConfig
  } catch {
    // Fallback to env vars
    return {
      apiKeys: {
        recentechAI: process.env.RECENTECH_AI_API_KEY || process.env.GEMINI_API_KEY || '',
        gemini: process.env.RECENTECH_AI_API_KEY || process.env.GEMINI_API_KEY || '',
      },
      endpoints: {
        recentechAIWorker: 'https://recentech-ai-worker.42abudhabi424242.workers.dev',
        recentechAIGemini: 'https://recentech-ai-worker.42abudhabi424242.workers.dev/gemini',
        recentechAIChat: 'https://recentech-ai-worker.42abudhabi424242.workers.dev/v1',
      },
    }
  }
}
