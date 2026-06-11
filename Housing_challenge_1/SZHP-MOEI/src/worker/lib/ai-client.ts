/**
 * Multi-Provider AI Client for Cloudflare Workers
 * Ported from src/lib/ai-client.ts
 * Removed z-ai-web-dev-sdk dependency — all providers use direct fetch()
 * Reads AI model config from D1 instead of Prisma
 */

import type { Env, AIProviderConfig, ChatMessage, ChatCompletionResult, VisionResult } from '../types'
import { DbClient } from '../db/queries'
import { getConfigString } from './config'

// ── Provider Detection ──────────────────────────────────────────────
export function detectProvider(baseUrl: string): AIProviderConfig['provider'] {
  const url = baseUrl.toLowerCase()
  if (url.includes('recentech') || url.includes('42abudhabi424242') || url.includes('internal-api.z.ai')) return 'recentech'
  if (url.includes('generativelanguage.googleapis.com') || url.includes('gemini')) return 'gemini'
  if (url.includes('127.0.0.1:11434') || url.includes('ollama')) return 'ollama'
  if (url.includes('openai.com') || url.includes('api.openai.com')) return 'openai'
  return 'openai_compatible'
}

/**
 * SSRF Protection — Validate that a URL is safe to call from the server.
 */
function isPrivate172Range(hostname: string): boolean {
  const match = /^172\.(\d+)\./.exec(hostname)
  if (!match) return false
  const secondOctet = parseInt(match[1], 10)
  return secondOctet >= 16 && secondOctet <= 31
}

export function isUrlSafeForServerSideRequest(urlStr: string): boolean {
  try {
    const url = new URL(urlStr)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return false
    const hostname = url.hostname.toLowerCase()

    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      return url.port === '11434' || url.pathname.includes('ollama')
    }

    if (
      hostname.startsWith('10.') ||
      isPrivate172Range(hostname) ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('169.254.') ||
      hostname.startsWith('0.') ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.localhost')
    ) {
      return false
    }

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

// ── Get Active Model Config from D1 ─────────────────────────────────
export async function getActiveModelConfig(
  db: DbClient,
  kv: KVNamespace,
  type: 'llm' | 'vlm' = 'llm',
  envBaseUrl?: string,
  envApiKey?: string,
  envZaiToken?: string,
  envZaiUserId?: string,
  envZaiChatId?: string,
): Promise<AIProviderConfig> {
  try {
    const configKey = type === 'llm' ? 'default_llm_id' : 'default_vlm_id'
    const targetModelId = await getConfigString(db, kv, configKey, '')

    let activeModel: any = null

    if (targetModelId) {
      activeModel = await db.findModelById(targetModelId)
    }

    if (!activeModel) {
      activeModel = await db.findDefaultModel()
    }

    if (!activeModel) {
      activeModel = await db.findAnyActiveModel()
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
        isActive: !!activeModel.isActive,
        isDefault: !!activeModel.isDefault,
        capabilities: JSON.parse(activeModel.capabilities || '[]'),
        zaiToken: envZaiToken || undefined,
        zaiUserId: envZaiUserId || undefined,
        zaiChatId: envZaiChatId || undefined,
      }
    }
  } catch (err) {
    console.warn('Could not load AI model config from DB, using defaults:', err)
  }

  // Default: Recentech AI (compatible with recentech endpoint)
  return {
    provider: 'recentech',
    modelId: 'glm-4-flash',
    baseUrl: envBaseUrl || 'https://recentech-ai-worker.42abudhabi424242.workers.dev/v1',
    apiKey: envApiKey || 'rk_378538813a1da63282dbc24382a55cc8',
    maxTokens: 4096,
    temperature: 0.7,
    isActive: true,
    isDefault: true,
    capabilities: ['chat', 'vision'],
    zaiToken: envZaiToken || undefined,
    zaiUserId: envZaiUserId || undefined,
    zaiChatId: envZaiChatId || undefined,
  }
}

// ══════════════════════════════════════════════════════════════════════
// RECENTECH AI — Direct Fetch Implementation
// ══════════════════════════════════════════════════════════════════════

// ── Build Z.ai Auth Headers ─────────────────────────────────────────
function buildZaiHeaders(config: AIProviderConfig): Record<string, string> {
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${config.apiKey || ''}`,
    'Content-Type': 'application/json',
    'X-Z-AI-From': 'Z',
  }
  // Add Z.ai auth headers when available (required by internal-api.z.ai)
  if (config.zaiToken) headers['X-Token'] = config.zaiToken
  if (config.zaiUserId) headers['X-User-Id'] = config.zaiUserId
  if (config.zaiChatId) headers['X-Chat-Id'] = config.zaiChatId
  return headers
}

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
  // Only include thinking param for models that support it (GLM-5+)
  // GLM-4 models don't support the thinking parameter
  if (options?.thinking && (config.modelId.includes('glm-5') || config.modelId.includes('glm-5.1'))) {
    body.thinking = options.thinking
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: buildZaiHeaders(config),
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Recentech AI API error (${res.status}): ${error}`)
  }

  const data = await res.json() as any
  const content = data?.choices?.[0]?.message?.content || data?.data?.choices?.[0]?.message?.content || ''
  const usage = data?.usage || data?.data?.usage

  return { content, model: data?.model || config.modelId, usage, provider: 'recentech' }
}

async function recentechDirectVision(
  messages: Array<{ role: string; content: any }>,
  config: AIProviderConfig
): Promise<VisionResult> {
  const url = `${config.baseUrl}/chat/completions/vision`

  const res = await fetch(url, {
    method: 'POST',
    headers: buildZaiHeaders(config),
    body: JSON.stringify({ messages, model: config.modelId }),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Recentech AI Vision error (${res.status}): ${error}`)
  }

  const data = await res.json() as any
  const content = data?.choices?.[0]?.message?.content || data?.data?.choices?.[0]?.message?.content || ''

  return { content, model: data?.model || config.modelId, provider: 'recentech' }
}

// ══════════════════════════════════════════════════════════════════════
// OPENAI & OPENAI-COMPATIBLE
// ══════════════════════════════════════════════════════════════════════

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

  const data = await res.json() as any
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
      messages, model: config.modelId, max_tokens: config.maxTokens || 4096,
    }),
  })

  if (!res.ok) throw new Error(`Vision API error: ${res.status}`)
  const data = await res.json() as any
  return { content: data.choices?.[0]?.message?.content || '', model: data.model || config.modelId, provider: config.provider }
}

// ══════════════════════════════════════════════════════════════════════
// GOOGLE GEMINI
// ══════════════════════════════════════════════════════════════════════

async function geminiChat(messages: ChatMessage[], config: AIProviderConfig): Promise<ChatCompletionResult> {
  if (config.baseUrl.includes('recentech') || config.baseUrl.includes('42abudhabi424242') || config.baseUrl.includes('internal-api.z.ai')) {
    return geminiViaRecentech(messages, config)
  }

  const url = `${config.baseUrl.replace(/\/$/, '')}/models/${config.modelId}:generateContent?key=${config.apiKey || ''}`
  const contents = messages.filter(m => m.role !== 'system').map(m => ({
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
      generationConfig: { maxOutputTokens: config.maxTokens || 4096, temperature: config.temperature || 0.7 },
    }),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Gemini API error (${res.status}): ${error}`)
  }

  const data = await res.json() as any
  return { content: data.candidates?.[0]?.content?.parts?.[0]?.text || '', model: config.modelId, provider: 'gemini' }
}

async function geminiViaRecentech(messages: ChatMessage[], config: AIProviderConfig): Promise<ChatCompletionResult> {
  const baseUrl = config.baseUrl.replace(/\/v1$/, '').replace(/\/$/, '')
  const url = `${baseUrl}/gemini/v1beta/models/${config.modelId}:generateContent`
  const contents = messages.filter(m => m.role !== 'system').map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))
  const systemInstruction = messages.find(m => m.role === 'system')

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey || ''}`,
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

  const data = await res.json() as any
  return { content: data.candidates?.[0]?.content?.parts?.[0]?.text || '', model: config.modelId, provider: 'gemini' }
}

async function geminiVision(messages: Array<{ role: string; content: any }>, config: AIProviderConfig): Promise<VisionResult> {
  const result = await geminiChat(
    messages.map(m => ({
      role: m.role as any,
      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
    })),
    config
  )
  return { content: result.content, model: result.model, provider: 'gemini' }
}

// ══════════════════════════════════════════════════════════════════════
// OLLAMA (Local Models)
// ══════════════════════════════════════════════════════════════════════

async function ollamaChat(messages: ChatMessage[], config: AIProviderConfig): Promise<ChatCompletionResult> {
  const baseUrl = config.baseUrl.replace(/\/$/, '')
  const url = `${baseUrl}/api/chat`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.modelId,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      stream: false,
      options: { num_predict: config.maxTokens || 4096, temperature: config.temperature || 0.7 },
    }),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Ollama API error (${res.status}): ${error}`)
  }

  const data = await res.json() as any
  return { content: data.message?.content || '', model: data.model || config.modelId, provider: 'ollama' }
}

async function ollamaVision(messages: Array<{ role: string; content: any }>, config: AIProviderConfig): Promise<VisionResult> {
  const baseUrl = config.baseUrl.replace(/\/$/, '')
  const url = `${baseUrl}/api/chat`

  const ollamaMessages = messages.map(m => {
    if (typeof m.content === 'string') {
      return { role: m.role, content: m.content }
    }

    let textContent = ''
    const images: string[] = []

    for (const part of m.content) {
      if (part.type === 'text') textContent += part.text + '\n'
      else if (part.type === 'image_url' && part.image_url?.url) {
        const urlStr = part.image_url.url
        const base64Match = urlStr.match(/base64,(.+)$/)
        images.push(base64Match ? base64Match[1] : urlStr)
      }
    }

    return { role: m.role, content: textContent.trim(), ...(images.length > 0 ? { images } : {}) }
  })

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.modelId, messages: ollamaMessages, stream: false,
      options: { num_predict: config.maxTokens || 4096, temperature: config.temperature || 0.7 },
    }),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Ollama Vision API error (${res.status}): ${error}`)
  }

  const data = await res.json() as any
  return { content: data.message?.content || '', model: data.model || config.modelId, provider: 'ollama' }
}

// ══════════════════════════════════════════════════════════════════════
// UNIFIED API
// ══════════════════════════════════════════════════════════════════════

export async function chatCompletion(
  messages: ChatMessage[],
  config: AIProviderConfig,
  options?: { stream?: boolean; thinking?: { type: string } }
): Promise<ChatCompletionResult> {
  if (!isUrlSafeForServerSideRequest(config.baseUrl)) {
    throw new Error(`Blocked: AI model URL '${config.baseUrl}' targets an internal/private address.`)
  }

  switch (config.provider) {
    case 'recentech': return recentechDirectChat(messages, config, options)
    case 'openai':
    case 'openai_compatible': return openAICompatibleChat(messages, config)
    case 'gemini': return geminiChat(messages, config)
    case 'ollama': return ollamaChat(messages, config)
    default: return recentechDirectChat(messages, config, options)
  }
}

export async function visionCompletion(
  messages: Array<{ role: string; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }>,
  config: AIProviderConfig
): Promise<VisionResult> {
  switch (config.provider) {
    case 'recentech': return recentechDirectVision(messages as any, config)
    case 'openai':
    case 'openai_compatible': return openAICompatibleVision(messages as any, config)
    case 'gemini': return geminiVision(messages as any, config)
    case 'ollama': return ollamaVision(messages as any, config)
    default: return recentechDirectVision(messages as any, config)
  }
}

// ── Test Connection ─────────────────────────────────────────────────
export async function testConnection(config: AIProviderConfig): Promise<{
  success: boolean; message: string; responseTime?: number; model?: string
}> {
  const start = Date.now()

  try {
    switch (config.provider) {
      case 'ollama': {
        const baseUrl = config.baseUrl.replace(/\/$/, '')
        const res = await fetch(`${baseUrl}/api/tags`, { method: 'GET' })
        if (!res.ok) throw new Error(`Ollama not reachable: ${res.status}`)
        const data = await res.json() as any
        const models = data.models || []
        const modelExists = models.some((m: { name: string }) => m.name === config.modelId || m.name.startsWith(config.modelId))
        return {
          success: modelExists,
          message: modelExists
            ? `Ollama connected. Model "${config.modelId}" found.`
            : `Ollama connected, but model "${config.modelId}" not found.`,
          responseTime: Date.now() - start,
          model: config.modelId,
        }
      }
      case 'recentech': {
        const result = await chatCompletion(
          [{ role: 'user', content: 'Hello, respond with just "OK" to confirm connection.' }],
          config
        )
        return {
          success: true,
          message: `Recentech AI connected. Response: "${result.content.substring(0, 100)}"`,
          responseTime: Date.now() - start,
          model: result.model,
        }
      }
      case 'openai':
      case 'openai_compatible': {
        const result = await openAICompatibleChat(
          [{ role: 'user', content: 'Hello, respond with just "OK" to confirm connection.' }],
          config
        )
        return {
          success: true,
          message: `OpenAI-compatible API connected. Response: "${result.content.substring(0, 100)}"`,
          responseTime: Date.now() - start,
          model: result.model,
        }
      }
      case 'gemini': {
        const result = await geminiChat(
          [{ role: 'user', content: 'Hello, respond with just "OK" to confirm connection.' }],
          config
        )
        return {
          success: true,
          message: `Gemini API connected. Response: "${result.content.substring(0, 100)}"`,
          responseTime: Date.now() - start,
          model: result.model,
        }
      }
      default:
        return { success: false, message: `Unknown provider: ${config.provider}` }
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Connection failed',
      responseTime: Date.now() - start,
    }
  }
}
