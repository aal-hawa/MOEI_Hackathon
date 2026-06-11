/**
 * MOEI API Worker - Cloudflare Worker Compatible Backend
 * 
 * This is the backend API server that handles ALL data mutations, database access,
 * and secrets. The frontend (src/pages/) calls this worker for all API operations.
 * 
 * Local dev: runs on port 3001 via @hono/node-server
 * Production: deploys as Cloudflare Worker
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'

// Route modules
import { serviceRulesRoutes } from './routes/service-rules'
import { serviceCategoriesRoutes } from './routes/service-categories'
import { customersRoutes } from './routes/customers'
import { casesRoutes } from './routes/cases'
import { chatRoutes } from './routes/chat'
import { dashboardRoutes } from './routes/dashboard'
import { agentsRoutes } from './routes/agents'
import { authRoutes } from './routes/auth'
import { feedbackRoutes } from './routes/feedback'
import { seedRoutes } from './routes/seed'
import { translationsRoutes } from './routes/translations'
import { notificationRoute } from './routes/notifications'
import { intentRoutes } from './routes/intent'
import { knowledgeRoutes } from './routes/knowledge'
import { serviceRuleTemplatesRoutes } from './routes/service-rule-templates'
import { serviceRuleAgentContextRoutes } from './routes/service-rule-agent-context'
import { realtimeRoutes } from './routes/realtime'
import { employerRoutes } from './routes/employer'
import { conversationRoutes } from './routes/conversations'
import { requestRoutes } from './routes/requests'
import { emailSendRoutes } from './routes/email-send'
import { voicePipelineRoutes } from './routes/voice-pipeline'
import { voiceAiRoutes } from './routes/voice-ai'
import { voiceRecordingRoutes } from './routes/voice-recording'
import { chatConfigRoutes } from './routes/chat-config'
import { portalRoutes } from './routes/portal'
import { systemHealthRoutes } from './routes/system-health'
import { whatsappAiRoutes } from './routes/whatsapp-ai'
import { emailAiRoutes } from './routes/email-ai'
import { emailInboxRoutes } from './routes/email-inbox'
import { aiProvidersRoutes } from './routes/ai-providers'
import { employerSessionRoutes } from './routes/employer-sessions'

// Auth middleware
import { authMiddleware } from './middleware/auth'
import { securityHeaders } from './middleware/security'

// ─── Create Hono App ──────────────────────────────────────────────────────────

const app = new Hono()

// ─── Global Middleware ─────────────────────────────────────────────────────────

// Logging
app.use('*', logger())

// CORS - Allow frontend to call this worker
app.use('*', cors({
  origin: ['http://localhost:3000', 'https://*.space-z.ai'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'X-Api-Key'],
  exposeHeaders: ['X-RateLimit-Remaining', 'X-Request-Id'],
  maxAge: 86400,
}))

// Security headers
app.use('*', securityHeaders())

// Auth middleware (checks auth on mutation endpoints)
app.use('/api/*', authMiddleware())

// ─── Health Check ──────────────────────────────────────────────────────────────

app.get('/api', (c) => {
  return c.json({
    service: 'MOEI API Worker',
    version: '4.0.0',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    architecture: 'pages/worker',
    endpoints: [
      '/api/service-rules',
      '/api/service-categories',
      '/api/customers',
      '/api/cases',
      '/api/chat',
      '/api/dashboard/kpis',
      '/api/agents',
      '/api/auth/status',
      '/api/feedback',
      '/api/translations',
      '/api/notifications',
      '/api/employer/*',
      '/api/conversations/*',
      '/api/requests/*',
      '/api/email/*',
      '/api/intent',
      '/api/knowledge',
      '/api/realtime/*',
      '/api/ai/voice/pipeline',
      '/api/ai/voice',
      '/api/chat-config',
      '/api/livekit/token',
      '/api/ai/chat',
      '/api/ai/vision',
      '/api/ai/tts',
      '/api/ai/asr',
      '/api/ai/image/gen',
      '/api/ai/image/edit',
      '/api/ai/image/search',
      '/api/ai/video/gen',
      '/api/ai/async/:id',
      '/api/ai/web-search',
      '/api/ai/page-reader',
      '/api/ai/health',
      '/api/ai/models',
    ],
  })
})

// ─── Mount Routes ──────────────────────────────────────────────────────────────

app.route('/api', serviceRulesRoutes)
app.route('/api', serviceCategoriesRoutes)
app.route('/api', customersRoutes)
app.route('/api', casesRoutes)
app.route('/api', chatRoutes)
app.route('/api', dashboardRoutes)
app.route('/api', agentsRoutes)
app.route('/api', authRoutes)
app.route('/api', feedbackRoutes)
app.route('/api', seedRoutes)
app.route('/api', translationsRoutes)
app.route('/api', notificationRoute)
app.route('/api', intentRoutes)
app.route('/api', knowledgeRoutes)
app.route('/api', serviceRuleTemplatesRoutes)
app.route('/api', serviceRuleAgentContextRoutes)
app.route('/api', realtimeRoutes)
app.route('/api', employerRoutes)
app.route('/api', conversationRoutes)
app.route('/api', requestRoutes)
app.route('/api', emailSendRoutes)
app.route('/api/ai', voicePipelineRoutes)
app.route('/api', voiceAiRoutes)
app.route('/api', voiceRecordingRoutes)
app.route('/api', chatConfigRoutes)
app.route('/api/portal', portalRoutes)
app.route('/api/system-health', systemHealthRoutes)
app.route('/api', whatsappAiRoutes)
app.route('/api', emailAiRoutes)
app.route('/api', emailInboxRoutes)
app.route('/api', aiProvidersRoutes)
app.route('/api', employerSessionRoutes)

// ─── Voice Agent Config ──────────────────────────────────────────────────────
// Returns configuration for the voice agent frontend (Socket.IO URL, branding, etc.)
app.get('/api/voice/config', (c) => {
  const deepgramKey = process.env.DEEPGRAM_API_KEY || ''
  const cartesiaKey = process.env.CARTESIA_API_KEY || ''
  return c.json({
    companyName: 'MOEI',
    pageTitle: 'MOEI Voice Agent',
    pageDescription: 'AI Voice Assistant for the Ministry of Energy & Infrastructure',
    startButtonText: 'Start Call',
    tagline: 'Chat live with the MOEI AI voice assistant',
    accent: '#0D9488',
    accentDark: '#14B8A6',
    supportsChatInput: true,
    supportsVideoInput: false,
    supportsScreenShare: false,
    audioVisualizerType: 'wave',
    audioVisualizerColor: '#0D9488',
    audioVisualizerColorDark: '#14B8A6',
    socketUrl: '',
    socketOptions: {
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      connectTimeout: 15000,
      sessionTimeout: 15000,
    },
    providers: {
      stt: deepgramKey ? 'deepgram' : 'zai-fallback',
      tts: cartesiaKey ? 'cartesia' : 'zai-fallback',
      llm: 'zai-sdk',
    },
    providerStatus: {
      deepgram: deepgramKey ? 'configured' : 'missing-key',
      cartesia: cartesiaKey ? 'configured' : 'missing-key',
    },
  })
})

// ─── Voice Provider API Keys (for voice-agent service to fetch) ──────────────
app.get('/api/voice/keys', (c) => {
  const secret = c.req.header('X-Voice-Agent-Secret') || c.req.query('secret') || ''
  // Simple internal auth - the voice-agent service must know the secret
  // In production, this would be a proper service-to-service auth
  const expectedSecret = process.env.VOICE_AGENT_SECRET || 'voice-agent-internal'
  if (secret !== expectedSecret) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  return c.json({
    deepgramApiKey: process.env.DEEPGRAM_API_KEY || '',
    cartesiaApiKey: process.env.CARTESIA_API_KEY || '',
  })
})

// ─── Voice Providers Proxy (forwards to voice-agent on port 3004) ────────────
// This allows the admin dashboard to call /api/voice-providers without XTransformPort
app.all('/api/voice-providers', async (c) => {
  const targetUrl = 'http://127.0.0.1:3004/api/voice-providers'
  const method = c.req.method
  const headers = new Headers()
  headers.set('Content-Type', c.req.header('Content-Type') || 'application/json')

  let body: ArrayBuffer | undefined
  if (!['GET', 'HEAD'].includes(method)) {
    body = await c.req.raw.arrayBuffer()
  }

  try {
    const res = await fetch(targetUrl, { method, headers, body })
    const contentType = res.headers.get('Content-Type') || 'application/json'
    const responseBody = await res.text()
    return c.json(JSON.parse(responseBody), res.status as any)
  } catch (err) {
    return c.json({
      error: 'Voice agent service unavailable',
      config: {
        stt: { primary: 'deepgram', fallback: 'zai' },
        tts: { primary: 'cartesia', fallback: 'deepgram' },
        llm: { primary: 'zai', fallback: 'gemini' },
        language: 'multi',
        maxSpeechDuration: 15000,
      },
      status: { deepgram: 'offline', cartesia: 'offline', zai: 'offline', geminiProxy: 'offline' },
      available: {
        stt: { deepgram: { name: 'Deepgram Nova-3', description: 'Real-time streaming STT, Arabic & English' }, cartesia: { name: 'Cartesia STT', description: 'Cartesia speech-to-text, Arabic & English' }, zai: { name: 'ZAI SDK ASR', description: 'ZAI SDK speech-to-text' } },
        tts: { cartesia: { name: 'Cartesia Sonic-3.5', description: 'Real-time streaming TTS, Arabic & English' }, deepgram: { name: 'Deepgram Aura TTS', description: 'Deepgram text-to-speech' }, zai: { name: 'ZAI SDK TTS', description: 'ZAI SDK text-to-speech' }, gemini: { name: 'Gemini TTS', description: 'Gemini Flash TTS' } },
        llm: { zai: { name: 'ZAI SDK Chat', description: 'ZAI SDK chat completions' }, gemini: { name: 'Gemini Flash', description: 'Gemini 2.5 Flash' } },
        languages: [{ code: 'multi', label: 'Auto-detect (English / العربية)' }, { code: 'ar', label: 'Arabic (العربية)' }, { code: 'en', label: 'English' }],
      },
    }, 503)
  }
})

// ─── LiveKit Token Stub (DEPRECATED - replaced by voice agent) ──────────────────
app.post('/api/livekit/token', (c) => {
  return c.json({
    token: '',
    url: '',
    message: 'LiveKit has been replaced by the MOEI Voice Agent. Use /api/voice/config instead.',
    available: false,
  })
})

app.get('/api/livekit/token', (c) => {
  return c.json({
    token: '',
    url: '',
    message: 'LiveKit has been replaced by the MOEI Voice Agent. Use /api/voice/config instead.',
    available: false,
  })
})

// ─── 404 Fallback ─────────────────────────────────────────────────────────────

app.notFound((c) => {
  return c.json({ error: 'Not Found', path: c.req.path }, 404)
})

// ─── Error Handler ────────────────────────────────────────────────────────────

app.onError((err, c) => {
  console.error('[Worker Error]', err)
  return c.json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  }, 500)
})

// ─── Start Server (Local Development) ─────────────────────────────────────────

const PORT = 3002

console.log(`🚀 MOEI API Worker running on http://localhost:${PORT}`)
console.log(`   Architecture: src/pages/ (frontend) + src/worker/ (backend)`)
console.log(`   API Base: http://localhost:${PORT}/api`)

// Export as Bun server config (auto-serves on the specified port)
// For Cloudflare Workers, just import and use `app` from above
const workerServer = {
  port: PORT,
  fetch: app.fetch,
}

export default workerServer

export type AppType = typeof app
