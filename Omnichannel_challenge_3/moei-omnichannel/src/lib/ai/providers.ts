/**
 * Unified AI Providers — Recentech AI Worker Integration
 * 
 * Direct-fetch wrapper for ALL capabilities exposed by the
 * Recentech AI Worker (https://recentech-ai-worker.42abudhabi424242.workers.dev).
 *
 * Why direct fetch instead of the ZAI SDK?
 *   The SDK always injects `thinking: { type: 'disabled' }` which causes
 *   deserialization errors on the upstream API.  We bypass it entirely.
 *
 * All responses from the worker are wrapped in { success, data } — this
 * module unwraps automatically.
 */

import { loadMoeiConfig } from '@/lib/ai'

// ─── Config helpers ──────────────────────────────────────────────────────────

async function getApiKey(): Promise<string> {
  const config = await loadMoeiConfig()
  return config?.apiKeys?.recentechAI
    || process.env.RECENTECH_AI_API_KEY
    || ''
}

async function getBaseUrl(): Promise<string> {
  const config = await loadMoeiConfig()
  return config?.endpoints?.recentechAIChat
    || 'https://recentech-ai-worker.42abudhabi424242.workers.dev/v1'
}

async function getWorkerUrl(): Promise<string> {
  const config = await loadMoeiConfig()
  return config?.endpoints?.recentechAIWorker
    || 'https://recentech-ai-worker.42abudhabi424242.workers.dev'
}

// ─── Internal fetch helper ───────────────────────────────────────────────────

async function providerFetch<T = unknown>(
  path: string,
  options: {
    method?: string
    body?: Record<string, unknown>
    query?: Record<string, string>
    expectBlob?: boolean
  } = {},
): Promise<T> {
  const apiKey = await getApiKey()
  const base = path.startsWith('/v1') ? '' : await getBaseUrl()
  const workerBase = await getWorkerUrl()

  // Decide which base to use
  let urlBase: string
  if (path.startsWith('/health')) {
    urlBase = workerBase
  } else if (path.startsWith('/v1')) {
    urlBase = workerBase
  } else {
    urlBase = base
  }

  const url = new URL(`${urlBase}${path}`)
  if (options.query) {
    Object.entries(options.query).forEach(([k, v]) => url.searchParams.set(k, v))
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  }

  const fetchOpts: RequestInit = {
    method: options.method || (options.body ? 'POST' : 'GET'),
    headers,
  }
  if (options.body) {
    fetchOpts.body = JSON.stringify(options.body)
  }

  const response = await fetch(url.toString(), fetchOpts)

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Provider API error ${response.status}: ${text}`)
  }

  // Binary response (TTS audio, image data)
  if (options.expectBlob) {
    return response.arrayBuffer() as unknown as T
  }

  const raw = await response.json()

  // Unwrap { success, data } envelope
  const data = raw?.data ?? raw

  // For function invocations, the result is nested under result
  if (data?.result !== undefined && data?.success !== false) {
    return data.result as T
  }

  return data as T
}

// ─── Available Models ────────────────────────────────────────────────────────

export const PROVIDER_MODELS = {
  llm: {
    'glm-5.1':     'Latest, advanced reasoning',
    'glm-5':       'High-quality generation',
    'glm-5-turbo': 'Fast responses',
    'glm-5-plus':  'Complex reasoning',
    'glm-4-plus':  'Default — general purpose',
    'glm-4-flash': 'Ultra-fast, simple tasks',
    'glm-4-long':  'Long documents',
    'glm-4':       'Standard generation',
    'glm-4-air':   'Lightweight tasks',
  },
  vlm: {
    'glm-4v':      'Basic image understanding',
    'glm-4v-plus': 'Default — enhanced analysis',
    'glm-5v':      'Advanced visual understanding',
    'glm-5.1v':    'Latest vision model',
  },
  gemini: {
    'gemini-2.5-flash': 'Fast, general purpose',
    'gemini-2.5-pro':   'Complex reasoning',
    'gemini-2.0-flash': 'Fast responses',
  },
} as const

export type LlmModel = keyof typeof PROVIDER_MODELS.llm
export type VlmModel = keyof typeof PROVIDER_MODELS.vlm
export type GeminiModel = keyof typeof PROVIDER_MODELS.gemini

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface VisionContent {
  type: 'text' | 'image_url'
  text?: string
  image_url?: { url: string }
}

export interface VisionMessage {
  role: 'user' | 'assistant'
  content: VisionContent[] | string
}

export interface ChatCompletionResult {
  content: string
  model: string
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
}

export interface VisionCompletionResult {
  content: string
  model: string
}

export interface TTSResult {
  audioBuffer: ArrayBuffer
  contentType: string
}

export interface ASRResult {
  text: string
  language?: string
  confidence?: number
}

export interface ImageGenerationResult {
  url: string
  revised_prompt?: string
}

export interface ImageEditResult {
  url: string
}

export interface ImageSearchResult {
  images: Array<{ url: string; title?: string; source?: string }>
}

export interface VideoGenerationResult {
  id: string
  status: string
}

export interface AsyncResultQuery {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  result?: Record<string, unknown>
  error?: string
}

export interface WebSearchResult {
  results: Array<{
    title: string
    url: string
    snippet: string
  }>
}

export interface PageReaderResult {
  content: string
  title?: string
  url?: string
}

export interface HealthCheckResult {
  status: string
  service: string
  version: string
  providers: Record<string, { configured: boolean; baseUrl: string }>
  auth: { database: string; apiKeyCount: number }
}

// ─── LLM Chat Completion ────────────────────────────────────────────────────

export async function providerChatCompletion(
  messages: ChatMessage[],
  options?: {
    model?: LlmModel
    temperature?: number
    maxOutputTokens?: number
    stream?: boolean
  },
): Promise<ChatCompletionResult> {
  const body: Record<string, unknown> = {
    messages: messages.map(m => ({ role: m.role, content: m.content })),
    model: options?.model || 'glm-4-flash',
  }
  if (options?.temperature !== undefined) body.temperature = options.temperature
  if (options?.maxOutputTokens !== undefined) body.max_tokens = options.maxOutputTokens
  if (options?.stream !== undefined) body.stream = options.stream

  const data = await providerFetch<Record<string, unknown>>('/v1/chat/completions', { body })

  const content =
    (data?.choices as any[])?.[0]?.message?.content
    || (data as any)?.content
    || ''
  const model = (data?.model as string) || 'unknown'

  if (!content || (typeof content === 'string' && content.trim().length === 0)) {
    throw new Error('Provider returned empty content')
  }

  return {
    content,
    model,
    usage: data?.usage as ChatCompletionResult['usage'],
  }
}

// ─── VLM Vision ─────────────────────────────────────────────────────────────

export async function providerVision(
  messages: VisionMessage[],
  options?: {
    model?: VlmModel
    stream?: boolean
    temperature?: number
  },
): Promise<VisionCompletionResult> {
  const body: Record<string, unknown> = {
    messages,
    model: options?.model || 'glm-4v-plus',
  }
  if (options?.stream !== undefined) body.stream = options.stream
  if (options?.temperature !== undefined) body.temperature = options.temperature

  const data = await providerFetch<Record<string, unknown>>('/v1/chat/completions/vision', { body })

  const content =
    (data?.choices as any[])?.[0]?.message?.content
    || (data as any)?.content
    || ''

  return {
    content,
    model: (data?.model as string) || options?.model || 'glm-4v-plus',
  }
}

// ─── TTS (Text-to-Speech) ───────────────────────────────────────────────────

export async function providerTTS(
  input: string,
  options?: {
    voice?: string
    response_format?: 'mp3' | 'wav' | 'pcm'
    speed?: number
  },
): Promise<TTSResult> {
  const apiKey = await getApiKey()
  const base = await getBaseUrl()

  const response = await fetch(`${base}/audio/tts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      input,
      voice: options?.voice || 'tongtong',
      response_format: options?.response_format || 'wav',
      speed: options?.speed || 1.0,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`TTS API error ${response.status}: ${text}`)
  }

  const contentType = response.headers.get('Content-Type') || 'audio/mpeg'
  const audioBuffer = await response.arrayBuffer()

  return { audioBuffer, contentType }
}

// ─── ASR (Speech-to-Text) ───────────────────────────────────────────────────

export async function providerASR(
  fileBase64: string,
  options?: {
    language?: string
  },
): Promise<ASRResult> {
  const data = await providerFetch<Record<string, unknown>>('/v1/audio/asr', {
    body: {
      file_base64: fileBase64,
      language: options?.language || 'en',
    },
  })

  return {
    text: (data?.text as string) || '',
    language: data?.language as string | undefined,
    confidence: data?.confidence as number | undefined,
  }
}

// ─── Image Generation ───────────────────────────────────────────────────────

export async function providerImageGeneration(
  prompt: string,
  options?: {
    size?: string
    model?: string
    n?: number
  },
): Promise<ImageGenerationResult> {
  const data = await providerFetch<Record<string, unknown>>('/v1/images/generations', {
    body: {
      prompt,
      size: options?.size || '1344x768',
      model: options?.model,
      n: options?.n || 1,
    },
  })

  // OpenAI-compatible: data[].url or data[0].url
  const images = data?.data as Array<{ url: string; revised_prompt?: string }> | undefined
  if (images && images.length > 0) {
    return { url: images[0].url, revised_prompt: images[0].revised_prompt }
  }

  // Fallback: url directly
  return {
    url: (data?.url as string) || (data as any)?.images?.[0]?.url || '',
  }
}

// ─── Image Editing ──────────────────────────────────────────────────────────

export async function providerImageEdit(
  prompt: string,
  image: string,
  options?: {
    model?: string
  },
): Promise<ImageEditResult> {
  const data = await providerFetch<Record<string, unknown>>('/v1/images/generations/edit', {
    body: {
      prompt,
      image,
      model: options?.model,
    },
  })

  const images = data?.data as Array<{ url: string }> | undefined
  if (images && images.length > 0) {
    return { url: images[0].url }
  }

  return { url: (data?.url as string) || '' }
}

// ─── Image Search ───────────────────────────────────────────────────────────

export async function providerImageSearch(
  query: string,
  options?: {
    count?: number
  },
): Promise<ImageSearchResult> {
  const data = await providerFetch<Record<string, unknown>>('/v1/images/search', {
    body: {
      query,
      count: options?.count || 5,
    },
  })

  // Handle array of images or nested result
  const images = (data?.images || data?.data || data) as Array<Record<string, unknown>>
  if (Array.isArray(images)) {
    return {
      images: images.map(img => ({
        url: (img.url as string) || '',
        title: img.title as string | undefined,
        source: img.source as string | undefined,
      })),
    }
  }

  return { images: [] }
}

// ─── Video Generation ───────────────────────────────────────────────────────

export async function providerVideoGeneration(
  prompt: string,
  options?: {
    duration?: number
    fps?: number
  },
): Promise<VideoGenerationResult> {
  const data = await providerFetch<Record<string, unknown>>('/v1/video/generation', {
    body: {
      prompt,
      duration: options?.duration || 5,
      fps: options?.fps || 30,
    },
  })

  return {
    id: (data?.id as string) || '',
    status: (data?.status as string) || 'pending',
  }
}

// ─── Async Result Query ─────────────────────────────────────────────────────

export async function providerAsyncResult(id: string): Promise<AsyncResultQuery> {
  const data = await providerFetch<Record<string, unknown>>('/v1/async-result', {
    query: { id },
  })

  return {
    id: (data?.id as string) || id,
    status: (data?.status as AsyncResultQuery['status']) || 'pending',
    result: data?.result as Record<string, unknown> | undefined,
    error: data?.error as string | undefined,
  }
}

// ─── Web Search ─────────────────────────────────────────────────────────────

export async function providerWebSearch(
  query: string,
  options?: {
    num?: number
  },
): Promise<WebSearchResult> {
  const data = await providerFetch<Record<string, unknown>>('/v1/functions/invoke', {
    body: {
      function_name: 'web_search',
      arguments: {
        query,
        num: options?.num || 10,
      },
    },
  })

  // Results may be nested under result or directly
  const results = (Array.isArray(data) ? data : (data?.results || data?.data || [])) as Array<Record<string, unknown>>

  return {
    results: results.map(r => ({
      title: (r.title as string) || '',
      url: (r.url as string) || (r.link as string) || '',
      snippet: (r.snippet as string) || (r.description as string) || '',
    })),
  }
}

// ─── Page Reader ────────────────────────────────────────────────────────────

export async function providerPageReader(url: string): Promise<PageReaderResult> {
  const data = await providerFetch<Record<string, unknown>>('/v1/functions/invoke', {
    body: {
      function_name: 'page_reader',
      arguments: { url },
    },
  })

  return {
    content: (data?.content as string) || (typeof data === 'string' ? data : JSON.stringify(data)),
    title: data?.title as string | undefined,
    url: data?.url as string | undefined,
  }
}

// ─── Health Check ───────────────────────────────────────────────────────────

export async function providerHealthCheck(): Promise<HealthCheckResult> {
  const apiKey = await getApiKey()
  const workerBase = await getWorkerUrl()

  const response = await fetch(`${workerBase}/health`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  })

  if (!response.ok) {
    throw new Error(`Health check failed: ${response.status}`)
  }

  return response.json() as Promise<HealthCheckResult>
}

// ─── Convenience: Quick Chat (single-turn) ──────────────────────────────────

export async function providerQuickChat(
  prompt: string,
  systemPrompt?: string,
  options?: { model?: LlmModel; temperature?: number; maxOutputTokens?: number },
): Promise<ChatCompletionResult> {
  const messages: ChatMessage[] = []
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt })
  messages.push({ role: 'user', content: prompt })
  return providerChatCompletion(messages, options)
}
