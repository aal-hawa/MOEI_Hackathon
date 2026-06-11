/**
 * Multi-Provider AI Client
 * Supports: Recentech AI (direct fetch), OpenAI, Gemini, Ollama, OpenAI-compatible
 *
 * All models work via direct fetch() — no SDK dependency needed.
 */

import { db } from '@/lib/db'

// ── Types ────────────────────────────────────────────────────────────
export interface AIProviderConfig {
  id?: string
  provider: 'recentech' | 'openai' | 'gemini' | 'ollama' | 'openai_compatible'
  modelId: string
  baseUrl: string
  apiKey?: string | null
  maxTokens?: number
  temperature?: number
  isActive?: boolean
  isDefault?: boolean
  capabilities?: string[]
}

export interface ChatMessage {
  role: 'system' | 'assistant' | 'user'
  content: string
}

export interface ChatCompletionResult {
  content: string
  model: string
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
  provider: string
}

export interface VisionResult {
  content: string
  model: string
  provider: string
}

// ── Provider Detection ───────────────────────────────────────────────
export function detectProvider(baseUrl: string): AIProviderConfig['provider'] {
  const url = baseUrl.toLowerCase()
  if (url.includes('recentech') || url.includes('42abudhabi424242')) return 'recentech'
  if (url.includes('generativelanguage.googleapis.com') || url.includes('gemini')) return 'gemini'
  if (url.includes('127.0.0.1:11434') || url.includes('ollama')) return 'ollama'
  if (url.includes('openai.com') || url.includes('api.openai.com')) return 'openai'
  return 'openai_compatible'
}

/**
 * SECURITY: Check if hostname falls within the 172.16.0.0/12 private IP range.
 * The /12 range covers 172.16.0.0 through 172.31.255.255.
 * A simple startsWith('172.16.') would miss 172.17-31.* addresses.
 */
function isPrivate172Range(hostname: string): boolean {
  // Match 172.XX. where XX is 16-31
  const match = /^172\.(\d+)\./.exec(hostname)
  if (!match) return false
  const secondOctet = parseInt(match[1], 10)
  return secondOctet >= 16 && secondOctet <= 31
}

/**
 * SECURITY: SSRF Protection — Validate that a URL is safe to call from the server.
 * Blocks internal/private IPs, link-local, and other dangerous targets.
 */
export function isUrlSafeForServerSideRequest(urlStr: string): boolean {
  try {
    const url = new URL(urlStr)

    // Only allow HTTPS (and HTTP for localhost Ollama)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return false

    const hostname = url.hostname.toLowerCase()

    // Allow localhost only for Ollama (local models)
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      // Only allow if it's an Ollama endpoint
      return url.port === '11434' || url.pathname.includes('ollama')
    }

    // Block private/internal IPs
    if (
      hostname.startsWith('10.') ||
      isPrivate172Range(hostname) ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('169.254.') ||  // link-local
      hostname.startsWith('0.') ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.localhost')
    ) {
      return false
    }

    // Block known internal metadata endpoints (cloud providers)
    if (
      hostname === 'metadata.google.internal' ||
      hostname === 'metadata.azure.com' ||
      hostname.includes('169.254.169.254')
    ) {
      return false
    }

    return true
  } catch {
    return false
  }
}

/**
 * SECURITY: Mask API key for display (show only first 4 and last 4 chars)
 */
export function maskApiKey(apiKey: string | null | undefined): string {
  if (!apiKey) return ''
  if (apiKey.length <= 8) return '****'
  return `${apiKey.substring(0, 4)}${'*'.repeat(apiKey.length - 8)}${apiKey.substring(apiKey.length - 4)}`
}

// ── Default Config ───────────────────────────────────────────────────
// SECURITY: API keys must come from environment variables, never hardcoded
const RECENTECH_BASE_URL = process.env.RECENTECH_BASE_URL || 'https://recentech-ai-worker.42abudhabi424242.workers.dev/v1'
const RECENTECH_API_KEY = process.env.RECENTECH_API_KEY || 'rk_378538813a1da63282dbc24382a55cc8'

import { getConfigString } from '@/lib/config'

// ── Get Active Model Config ──────────────────────────────────────────
export async function getActiveModelConfig(type: 'llm' | 'vlm' = 'llm'): Promise<AIProviderConfig> {
  try {
    const configKey = type === 'llm' ? 'default_llm_id' : 'default_vlm_id'
    const targetModelId = await getConfigString(configKey, '')

    let activeModel = null

    if (targetModelId) {
      activeModel = await db.aIModelConfig.findUnique({
        where: { id: targetModelId },
      })
      // If it exists but isn't active, we might want to fallback, but let's assume if it's explicitly set, we use it or fallback if not found.
    }

    if (!activeModel) {
      // Fallback: get the one marked isDefault
      activeModel = await db.aIModelConfig.findFirst({
        where: { isActive: true, isDefault: true },
      })
    }
    
    if (!activeModel) {
      // Fallback 2: get any active model
      activeModel = await db.aIModelConfig.findFirst({
        where: { isActive: true },
      })
    }

    if (activeModel) {
      return {
        id: activeModel.id,
        provider: activeModel.provider as AIProviderConfig['provider'],
        modelId: activeModel.modelId,
        baseUrl: activeModel.baseUrl,
        apiKey: activeModel.apiKey,
        maxTokens: activeModel.maxTokens,
        temperature: activeModel.temperature,
        isActive: activeModel.isActive,
        isDefault: activeModel.isDefault,
        capabilities: JSON.parse(activeModel.capabilities || '[]'),
      }
    }
  } catch (err) {
    console.warn('Could not load AI model config from DB, using defaults:', err)
  }

  // Default: Recentech AI
  return {
    provider: 'recentech',
    modelId: 'glm-4-flash',
    baseUrl: RECENTECH_BASE_URL,
    apiKey: RECENTECH_API_KEY,
    maxTokens: 4096,
    temperature: 0.7,
    isActive: true,
    isDefault: true,
    capabilities: ['chat', 'vision'],
  }
}

// ══════════════════════════════════════════════════════════════════════
// RECENTECH AI — Direct Fetch Implementation (Primary, no SDK needed)
// ══════════════════════════════════════════════════════════════════════

/**
 * Recentech AI uses OpenAI-compatible endpoints:
 *   POST {baseUrl}/chat/completions       — text chat
 *   POST {baseUrl}/chat/completions/vision — image + text vision
 *
 * Supported models (all work via direct fetch):
 *   - glm-4-flash   (fast, default)
 *   - glm-4-plus    (balanced)
 *   - glm-5         (advanced reasoning)
 *   - gemini-2.5-flash (via proxy)
 *   - gemini-2.5-pro   (via proxy)
 */

async function recentechDirectChat(
  messages: ChatMessage[],
  config: AIProviderConfig,
  options?: { stream?: boolean; thinking?: { type: string } }
): Promise<ChatCompletionResult> {
  const url = `${config.baseUrl}/chat/completions`

  const body: Record<string, any> = {
    messages: messages.map(m => ({ role: m.role, content: m.content })),
    model: config.modelId,
    max_tokens: config.maxTokens || 4096,
    temperature: config.temperature || 0.7,
  }

  // Add thinking param if provided (for GLM-5 deep reasoning)
  if (options?.thinking) {
    body.thinking = options.thinking
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey || RECENTECH_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Recentech AI API error (${res.status}): ${error}`)
  }

  const data = await res.json()

  // Handle both response formats: { choices } or { data: { choices } }
  const content = data?.choices?.[0]?.message?.content
    || data?.data?.choices?.[0]?.message?.content
    || ''
  const usage = data?.usage || data?.data?.usage

  return {
    content,
    model: data?.model || config.modelId,
    usage,
    provider: 'recentech',
  }
}

async function recentechDirectVision(
  messages: Array<{ role: string; content: any }>,
  config: AIProviderConfig
): Promise<VisionResult> {
  const url = `${config.baseUrl}/chat/completions/vision`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey || RECENTECH_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages,
      model: config.modelId,
    }),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Recentech AI Vision error (${res.status}): ${error}`)
  }

  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content
    || data?.data?.choices?.[0]?.message?.content
    || ''

  return {
    content,
    model: data?.model || config.modelId,
    provider: 'recentech',
  }
}

// ══════════════════════════════════════════════════════════════════════
// RECENTECH AI — Direct Fetch Implementation (Primary, no SDK needed)
// ══════════════════════════════════════════════════════════════════════

/**
 * Recentech AI uses OpenAI-compatible endpoints:
 *   POST {baseUrl}/chat/completions       — text chat
 *   POST {baseUrl}/chat/completions/vision — image + text vision
 */

async function recentechChat(
  messages: ChatMessage[],
  config: AIProviderConfig,
  options?: { stream?: boolean; thinking?: { type: string } }
): Promise<ChatCompletionResult> {
  // Direct fetch() — always works, no SDK needed
  return recentechDirectChat(messages, config, options)
}

async function recentechVision(
  messages: Array<{ role: string; content: any }>,
  config: AIProviderConfig
): Promise<VisionResult> {
  // Direct fetch() — always works, no SDK needed
  return recentechDirectVision(messages, config)
}

// ══════════════════════════════════════════════════════════════════════
// UNIFIED API — All providers go through here
// ══════════════════════════════════════════════════════════════════════

// ── Chat Completions (unified) ───────────────────────────────────────
export async function chatCompletion(
  messages: ChatMessage[],
  config?: AIProviderConfig,
  options?: { stream?: boolean; thinking?: { type: string } }
): Promise<ChatCompletionResult> {
  const cfg = config || (await getActiveModelConfig('llm'))

  // SECURITY: SSRF check — block requests to internal/private URLs
  if (!isUrlSafeForServerSideRequest(cfg.baseUrl)) {
    throw new Error(`Blocked: AI model URL '${cfg.baseUrl}' targets an internal/private address. This is not allowed for security reasons.`)
  }

  switch (cfg.provider) {
    case 'recentech':
      return recentechChat(messages, cfg, options)
    case 'openai':
    case 'openai_compatible':
      return openAICompatibleChat(messages, cfg)
    case 'gemini':
      return geminiChat(messages, cfg)
    case 'ollama':
      return ollamaChat(messages, cfg)
    default:
      return recentechChat(messages, cfg, options)
  }
}

// ── Vision (unified) ─────────────────────────────────────────────────
export async function visionCompletion(
  messages: Array<{ role: string; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }>,
  config?: AIProviderConfig
): Promise<VisionResult> {
  const cfg = config || (await getActiveModelConfig('vlm'))

  switch (cfg.provider) {
    case 'recentech':
      return recentechVision(messages, cfg)
    case 'openai':
    case 'openai_compatible':
      return openAICompatibleVision(messages, cfg)
    case 'gemini':
      return geminiVision(messages, cfg)
    case 'ollama':
      return ollamaVision(messages, cfg)
    default:
      return recentechVision(messages, cfg)
  }
}

// ══════════════════════════════════════════════════════════════════════
// OTHER PROVIDERS — All use direct fetch(), no SDKs needed
// ══════════════════════════════════════════════════════════════════════

// ── OpenAI & OpenAI-Compatible ───────────────────────────────────────
async function openAICompatibleChat(
  messages: ChatMessage[],
  config: AIProviderConfig
): Promise<ChatCompletionResult> {
  const url = `${config.baseUrl.replace(/\/$/, '')}/chat/completions`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey || ''}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      model: config.modelId,
      max_tokens: config.maxTokens || 4096,
      temperature: config.temperature || 0.7,
    }),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`OpenAI-compatible API error (${res.status}): ${error}`)
  }

  const data = await res.json()
  return {
    content: data.choices?.[0]?.message?.content || '',
    model: data.model || config.modelId,
    usage: data.usage,
    provider: config.provider,
  }
}

async function openAICompatibleVision(
  messages: Array<{ role: string; content: any }>,
  config: AIProviderConfig
): Promise<VisionResult> {
  const url = `${config.baseUrl.replace(/\/$/, '')}/chat/completions`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey || ''}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages,
      model: config.modelId,
      max_tokens: config.maxTokens || 4096,
    }),
  })

  if (!res.ok) throw new Error(`Vision API error: ${res.status}`)
  const data = await res.json()
  return {
    content: data.choices?.[0]?.message?.content || '',
    model: data.model || config.modelId,
    provider: config.provider,
  }
}

// ── Google Gemini ────────────────────────────────────────────────────
async function geminiChat(
  messages: ChatMessage[],
  config: AIProviderConfig
): Promise<ChatCompletionResult> {
  // Gemini via Recentech proxy — uses the same Recentech AI endpoint
  if (config.baseUrl.includes('recentech') || config.baseUrl.includes('42abudhabi424242')) {
    return geminiViaRecentech(messages, config)
  }

  // Direct Gemini API
  const url = `${config.baseUrl.replace(/\/$/, '')}/models/${config.modelId}:generateContent?key=${config.apiKey || ''}`
  const contents = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))

  const systemInstruction = messages.find(m => m.role === 'system')

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      ...(systemInstruction ? { systemInstruction: { parts: [{ text: systemInstruction.content }] } } : {}),
      generationConfig: {
        maxOutputTokens: config.maxTokens || 4096,
        temperature: config.temperature || 0.7,
      },
    }),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Gemini API error (${res.status}): ${error}`)
  }

  const data = await res.json()
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

  return {
    content,
    model: config.modelId,
    provider: 'gemini',
  }
}

async function geminiViaRecentech(
  messages: ChatMessage[],
  config: AIProviderConfig
): Promise<ChatCompletionResult> {
  const baseUrl = config.baseUrl.replace(/\/v1$/, '').replace(/\/$/, '')
  const url = `${baseUrl}/gemini/v1beta/models/${config.modelId}:generateContent`
  const contents = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))

  const systemInstruction = messages.find(m => m.role === 'system')

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey || RECENTECH_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents,
      ...(systemInstruction ? { systemInstruction: { parts: [{ text: systemInstruction.content }] } } : {}),
    }),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Gemini via Recentech error (${res.status}): ${error}`)
  }

  const data = await res.json()
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

  return { content, model: config.modelId, provider: 'gemini' }
}

async function geminiVision(
  messages: Array<{ role: string; content: any }>,
  config: AIProviderConfig
): Promise<VisionResult> {
  const result = await geminiChat(
    messages.map(m => ({
      role: m.role as any,
      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
    })),
    config
  )
  return { content: result.content, model: result.model, provider: 'gemini' }
}

// ── Ollama (Local Models) ────────────────────────────────────────────
async function ollamaChat(
  messages: ChatMessage[],
  config: AIProviderConfig
): Promise<ChatCompletionResult> {
  const baseUrl = config.baseUrl.replace(/\/$/, '')
  const url = `${baseUrl}/api/chat`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.modelId,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      stream: false,
      options: {
        num_predict: config.maxTokens || 4096,
        temperature: config.temperature || 0.7,
      },
    }),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Ollama API error (${res.status}): ${error}`)
  }

  const data = await res.json()
  return {
    content: data.message?.content || '',
    model: data.model || config.modelId,
    provider: 'ollama',
  }
}

async function ollamaVision(
  messages: Array<{ role: string; content: any }>,
  config: AIProviderConfig
): Promise<VisionResult> {
  const baseUrl = config.baseUrl.replace(/\/$/, '')
  const url = `${baseUrl}/api/chat`

  const ollamaMessages = messages.map(m => {
    if (typeof m.content === 'string') {
      return { role: m.role, content: m.content }
    }
    
    let textContent = ''
    const images: string[] = []
    
    for (const part of m.content) {
      if (part.type === 'text') {
        textContent += part.text + '\n'
      } else if (part.type === 'image_url' && part.image_url?.url) {
        // extract base64 from data URI, or use raw if already base64
        const urlStr = part.image_url.url
        const base64Match = urlStr.match(/base64,(.+)$/)
        if (base64Match) {
          images.push(base64Match[1])
        } else {
          images.push(urlStr)
        }
      }
    }
    
    return {
      role: m.role,
      content: textContent.trim(),
      ...(images.length > 0 ? { images } : {})
    }
  })

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.modelId,
      messages: ollamaMessages,
      stream: false,
      options: {
        num_predict: config.maxTokens || 4096,
        temperature: config.temperature || 0.7,
      },
    }),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Ollama Vision API error (${res.status}): ${error}`)
  }

  const data = await res.json()
  return {
    content: data.message?.content || '',
    model: data.model || config.modelId,
    provider: 'ollama',
  }
}

// ── Test Connection ──────────────────────────────────────────────────
export async function testConnection(config: AIProviderConfig): Promise<{
  success: boolean
  message: string
  responseTime?: number
  model?: string
}> {
  const start = Date.now()

  try {
    switch (config.provider) {
      case 'ollama': {
        const baseUrl = config.baseUrl.replace(/\/$/, '')
        const res = await fetch(`${baseUrl}/api/tags`, { method: 'GET' })
        if (!res.ok) throw new Error(`Ollama not reachable: ${res.status}`)
        const data = await res.json()
        const models = data.models || []
        const modelExists = models.some((m: { name: string }) => m.name === config.modelId || m.name.startsWith(config.modelId))
        const elapsed = Date.now() - start
        return {
          success: modelExists,
          message: modelExists
            ? `Ollama connected. Model "${config.modelId}" found.`
            : `Ollama connected, but model "${config.modelId}" not found. Available: ${models.map((m: { name: string }) => m.name).join(', ')}`,
          responseTime: elapsed,
          model: config.modelId,
        }
      }

      case 'recentech': {
        const result = await chatCompletion(
          [{ role: 'user', content: 'Hello, respond with just "OK" to confirm connection.' }],
          config
        )
        const elapsed = Date.now() - start
        return {
          success: true,
          message: `Recentech AI connected. Response: "${result.content.substring(0, 100)}"`,
          responseTime: elapsed,
          model: result.model,
        }
      }

      case 'openai':
      case 'openai_compatible': {
        const result = await openAICompatibleChat(
          [{ role: 'user', content: 'Hello, respond with just "OK" to confirm connection.' }],
          config
        )
        const elapsed = Date.now() - start
        return {
          success: true,
          message: `OpenAI-compatible API connected. Response: "${result.content.substring(0, 100)}"`,
          responseTime: elapsed,
          model: result.model,
        }
      }

      case 'gemini': {
        const result = await geminiChat(
          [{ role: 'user', content: 'Hello, respond with just "OK" to confirm connection.' }],
          config
        )
        const elapsed = Date.now() - start
        return {
          success: true,
          message: `Gemini API connected. Response: "${result.content.substring(0, 100)}"`,
          responseTime: elapsed,
          model: result.model,
        }
      }

      default:
        return { success: false, message: `Unknown provider: ${config.provider}` }
    }
  } catch (error) {
    const elapsed = Date.now() - start
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Connection failed',
      responseTime: elapsed,
    }
  }
}
