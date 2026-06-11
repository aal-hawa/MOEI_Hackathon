/**
 * AI Providers API Route — Recentech AI Worker Proxy
 *
 * Exposes ALL Recentech AI capabilities as Hono API endpoints
 * that the frontend can call without knowing the provider details.
 *
 * POST /api/ai/chat          → LLM Chat Completion
 * POST /api/ai/vision        → VLM Vision
 * POST /api/ai/tts           → Text-to-Speech (returns audio)
 * POST /api/ai/asr           → Speech-to-Text
 * POST /api/ai/image/gen     → Image Generation
 * POST /api/ai/image/edit    → Image Editing
 * POST /api/ai/image/search  → Image Search
 * POST /api/ai/video/gen     → Video Generation (async)
 * GET  /api/ai/async/:id     → Async Result Query
 * POST /api/ai/web-search    → Web Search
 * POST /api/ai/page-reader   → Page Reader
 * GET  /api/ai/health        → Provider Health Check
 * GET  /api/ai/models        → Available Models
 */

import { Hono } from 'hono'
import {
  providerChatCompletion,
  providerVision,
  providerTTS,
  providerASR,
  providerImageGeneration,
  providerImageEdit,
  providerImageSearch,
  providerVideoGeneration,
  providerAsyncResult,
  providerWebSearch,
  providerPageReader,
  providerHealthCheck,
  PROVIDER_MODELS,
  type LlmModel,
  type VlmModel,
} from '@/lib/ai/providers'

export const aiProvidersRoutes = new Hono()

// ─── LLM Chat Completion ────────────────────────────────────────────────────

aiProvidersRoutes.post('/ai/chat', async (c) => {
  try {
    const body = await c.req.json()
    const { messages, model, temperature, maxOutputTokens } = body

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return c.json({ error: 'messages array is required' }, 400)
    }

    const result = await providerChatCompletion(
      messages.map((m: any) => ({ role: m.role, content: m.content })),
      {
        model: model as LlmModel | undefined,
        temperature,
        maxOutputTokens,
      },
    )

    return c.json({ success: true, data: result })
  } catch (err: any) {
    console.error('[AI/chat]', err.message)
    return c.json({ error: err.message }, 502)
  }
})

// ─── VLM Vision ─────────────────────────────────────────────────────────────

aiProvidersRoutes.post('/ai/vision', async (c) => {
  try {
    const body = await c.req.json()
    const { messages, model, temperature } = body

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return c.json({ error: 'messages array is required' }, 400)
    }

    const result = await providerVision(messages, {
      model: model as VlmModel | undefined,
      temperature,
    })

    return c.json({ success: true, data: result })
  } catch (err: any) {
    console.error('[AI/vision]', err.message)
    return c.json({ error: err.message }, 502)
  }
})

// ─── TTS (Text-to-Speech) ───────────────────────────────────────────────────

aiProvidersRoutes.post('/ai/tts', async (c) => {
  try {
    const body = await c.req.json()
    const { input, voice, response_format, speed } = body

    if (!input || typeof input !== 'string') {
      return c.json({ error: 'input text is required' }, 400)
    }

    const result = await providerTTS(input, {
      voice,
      response_format,
      speed,
    })

    // Return audio as binary response
    c.header('Content-Type', result.contentType)
    return c.body(result.audioBuffer)
  } catch (err: any) {
    console.error('[AI/tts]', err.message)
    return c.json({ error: err.message }, 502)
  }
})

// ─── ASR (Speech-to-Text) ───────────────────────────────────────────────────

aiProvidersRoutes.post('/ai/asr', async (c) => {
  try {
    const body = await c.req.json()
    const { file_base64, language } = body

    if (!file_base64 || typeof file_base64 !== 'string') {
      return c.json({ error: 'file_base64 is required' }, 400)
    }

    const result = await providerASR(file_base64, { language })
    return c.json({ success: true, data: result })
  } catch (err: any) {
    console.error('[AI/asr]', err.message)
    return c.json({ error: err.message }, 502)
  }
})

// ─── Image Generation ───────────────────────────────────────────────────────

aiProvidersRoutes.post('/ai/image/gen', async (c) => {
  try {
    const body = await c.req.json()
    const { prompt, size, model, n } = body

    if (!prompt || typeof prompt !== 'string') {
      return c.json({ error: 'prompt is required' }, 400)
    }

    const result = await providerImageGeneration(prompt, { size, model, n })
    return c.json({ success: true, data: result })
  } catch (err: any) {
    console.error('[AI/image/gen]', err.message)
    return c.json({ error: err.message }, 502)
  }
})

// ─── Image Editing ──────────────────────────────────────────────────────────

aiProvidersRoutes.post('/ai/image/edit', async (c) => {
  try {
    const body = await c.req.json()
    const { prompt, image, model } = body

    if (!prompt || !image) {
      return c.json({ error: 'prompt and image are required' }, 400)
    }

    const result = await providerImageEdit(prompt, image, { model })
    return c.json({ success: true, data: result })
  } catch (err: any) {
    console.error('[AI/image/edit]', err.message)
    return c.json({ error: err.message }, 502)
  }
})

// ─── Image Search ───────────────────────────────────────────────────────────

aiProvidersRoutes.post('/ai/image/search', async (c) => {
  try {
    const body = await c.req.json()
    const { query, count } = body

    if (!query || typeof query !== 'string') {
      return c.json({ error: 'query is required' }, 400)
    }

    const result = await providerImageSearch(query, { count })
    return c.json({ success: true, data: result })
  } catch (err: any) {
    console.error('[AI/image/search]', err.message)
    return c.json({ error: err.message }, 502)
  }
})

// ─── Video Generation ───────────────────────────────────────────────────────

aiProvidersRoutes.post('/ai/video/gen', async (c) => {
  try {
    const body = await c.req.json()
    const { prompt, duration, fps } = body

    if (!prompt || typeof prompt !== 'string') {
      return c.json({ error: 'prompt is required' }, 400)
    }

    const result = await providerVideoGeneration(prompt, { duration, fps })
    return c.json({ success: true, data: result })
  } catch (err: any) {
    console.error('[AI/video/gen]', err.message)
    return c.json({ error: err.message }, 502)
  }
})

// ─── Async Result Query ─────────────────────────────────────────────────────

aiProvidersRoutes.get('/ai/async/:id', async (c) => {
  try {
    const id = c.req.param('id')
    if (!id) {
      return c.json({ error: 'task id is required' }, 400)
    }

    const result = await providerAsyncResult(id)
    return c.json({ success: true, data: result })
  } catch (err: any) {
    console.error('[AI/async]', err.message)
    return c.json({ error: err.message }, 502)
  }
})

// ─── Web Search ─────────────────────────────────────────────────────────────

aiProvidersRoutes.post('/ai/web-search', async (c) => {
  try {
    const body = await c.req.json()
    const { query, num } = body

    if (!query || typeof query !== 'string') {
      return c.json({ error: 'query is required' }, 400)
    }

    const result = await providerWebSearch(query, { num })
    return c.json({ success: true, data: result })
  } catch (err: any) {
    console.error('[AI/web-search]', err.message)
    return c.json({ error: err.message }, 502)
  }
})

// ─── Page Reader ────────────────────────────────────────────────────────────

aiProvidersRoutes.post('/ai/page-reader', async (c) => {
  try {
    const body = await c.req.json()
    const { url } = body

    if (!url || typeof url !== 'string') {
      return c.json({ error: 'url is required' }, 400)
    }

    const result = await providerPageReader(url)
    return c.json({ success: true, data: result })
  } catch (err: any) {
    console.error('[AI/page-reader]', err.message)
    return c.json({ error: err.message }, 502)
  }
})

// ─── Health Check ───────────────────────────────────────────────────────────

aiProvidersRoutes.get('/ai/health', async (c) => {
  try {
    const result = await providerHealthCheck()
    return c.json({ success: true, data: result })
  } catch (err: any) {
    console.error('[AI/health]', err.message)
    return c.json({ error: err.message, connected: false }, 502)
  }
})

// ─── Available Models ───────────────────────────────────────────────────────

aiProvidersRoutes.get('/ai/models', async (c) => {
  return c.json({ success: true, data: PROVIDER_MODELS })
})
