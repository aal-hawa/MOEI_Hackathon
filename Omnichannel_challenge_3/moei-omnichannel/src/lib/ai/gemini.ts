/**
 * Gemini AI Provider - Google Gemini integration for MOEI
 * Uses @google/generative-ai SDK with the Gemini API key
 * Serves as the PRIMARY AI provider, with ZAI as fallback
 */

import { GoogleGenerativeAI, type GenerativeModel, type ChatSession } from '@google/generative-ai'
import { getMoeiConfig } from '@/lib/moei-config'

// ─── Singleton Instance ──────────────────────────────────────────────────────

let genAI: GoogleGenerativeAI | null = null
let chatModel: GenerativeModel | null = null
let flashModel: GenerativeModel | null = null

async function getGemini(): Promise<{ genAI: GoogleGenerativeAI; chatModel: GenerativeModel; flashModel: GenerativeModel }> {
  if (!genAI || !chatModel || !flashModel) {
    const config = await getMoeiConfig()
    const apiKey = config.apiKeys.gemini || config.apiKeys.recentechAI
    if (!apiKey) {
      throw new Error('API key is not set in moei-config.json or environment variables')
    }
    genAI = new GoogleGenerativeAI(apiKey)

    const requestOptions = { 
      baseUrl: config.endpoints.recentechAIGemini,
      customHeaders: {
        Authorization: `Bearer ${apiKey}`
      }
    }

    // Gemini 2.0 Flash for fast tasks (intent classification, sentiment, etc.)
    flashModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' }, requestOptions)

    // Gemini 2.5 Flash for chat completions (main AI responses)
    chatModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-preview-05-20' }, requestOptions)
  }
  return { genAI, chatModel, flashModel }
}

// ─── Chat Completion (OpenAI-compatible interface) ────────────────────────────

export interface GeminiMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface GeminiChatResponse {
  content: string
  model: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

/**
 * Generate a chat completion using Gemini.
 * Matches the interface pattern used by z-ai-web-dev-sdk for easy swapping.
 */
export async function geminiChatCompletion(
  messages: GeminiMessage[],
  options?: {
    model?: 'flash' | 'pro'
    temperature?: number
    maxOutputTokens?: number
    thinking?: { type: string }
  }
): Promise<GeminiChatResponse> {
  const { chatModel, flashModel } = await getGemini()
  const model = options?.model === 'pro' ? chatModel : flashModel

  // Separate system message from conversation
  const systemMessage = messages.find(m => m.role === 'system')?.content || ''
  const conversationMessages = messages.filter(m => m.role !== 'system')

  // Build Gemini history format
  const history = conversationMessages.slice(0, -1).map(m => ({
    role: m.role === 'assistant' ? 'model' as const : 'user' as const,
    parts: [{ text: m.content }],
  }))

  // The last user message is the current prompt
  const lastUserMessage = conversationMessages[conversationMessages.length - 1]
  if (!lastUserMessage || lastUserMessage.role !== 'user') {
    throw new Error('Last message must be from user')
  }

  // Start chat with history
  const chat = model.startChat({
    history,
    systemInstruction: systemMessage ? { parts: [{ text: systemMessage }] } : undefined,
    generationConfig: {
      temperature: options?.temperature ?? 0.7,
      maxOutputTokens: options?.maxOutputTokens ?? 2048,
    },
  })

  const result = await chat.sendMessage(lastUserMessage.content)
  const response = result.response
  const text = response.text()

  return {
    content: text,
    model: model.model || 'gemini-2.0-flash',
    usage: {
      promptTokens: response.usageMetadata?.promptTokenCount ?? 0,
      completionTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
      totalTokens: response.usageMetadata?.totalTokenCount ?? 0,
    },
  }
}

/**
 * Quick single-turn completion (no conversation history).
 * Useful for intent classification, sentiment analysis, etc.
 */
export async function geminiQuickComplete(
  prompt: string,
  systemPrompt?: string,
  options?: { temperature?: number; maxOutputTokens?: number }
): Promise<string> {
  const { flashModel } = await getGemini()

  const result = await flashModel.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
    generationConfig: {
      temperature: options?.temperature ?? 0.3,
      maxOutputTokens: options?.maxOutputTokens ?? 1024,
    },
  })

  return result.response.text()
}

// ─── Health Check ─────────────────────────────────────────────────────────────

let healthChecked = false
let geminiHealthy = false
let healthCheckTime = 0
const HEALTH_CHECK_TTL_MS = 5 * 60 * 1000 // Re-check every 5 minutes

export async function isGeminiAvailable(): Promise<boolean> {
  // Expire cached health check after 5 minutes
  if (healthChecked && Date.now() - healthCheckTime > HEALTH_CHECK_TTL_MS) {
    healthChecked = false
    geminiHealthy = false
  }

  if (healthChecked) return geminiHealthy

  try {
    const config = await getMoeiConfig()
    const apiKey = config.apiKeys.gemini || config.apiKeys.recentechAI
    if (!apiKey) {
      console.warn('[GEMINI] No API key configured')
      healthChecked = true
      healthCheckTime = Date.now()
      geminiHealthy = false
      return false
    }

    // Quick test
    const { flashModel } = await getGemini()
    const result = await flashModel.generateContent('Say "OK" in one word.')
    const text = result.response.text()
    geminiHealthy = text.length > 0
    healthChecked = true
    healthCheckTime = Date.now()
    console.log('[GEMINI] Health check passed:', text.trim())
    return geminiHealthy
  } catch (err: any) {
    console.error('[GEMINI] Health check failed:', err?.message || err)
    // Auto-reset on rate limit (429) so next call retries
    const is429 = err?.message?.includes('429') || err?.status === 429 || String(err).includes('RESOURCE_EXHAUSTED')
    if (is429) {
      console.warn('[GEMINI] Rate limited (429) — will retry on next call')
      healthChecked = false // Don't cache a 429 failure
    } else {
      healthChecked = true
    }
    healthCheckTime = Date.now()
    geminiHealthy = false
    return false
  }
}

// Reset health check (useful after config changes or rate limit cooldown)
export function resetGeminiHealthCheck(): void {
  healthChecked = false
  geminiHealthy = false
  healthCheckTime = 0
  // Also reset the singleton so it re-initializes with fresh config
  genAI = null
  chatModel = null
  flashModel = null
}
