/**
 * Voice Agent Socket.IO Service v3.2
 * 
 * Real-time voice agent service that handles:
 * - WebSocket connections via Socket.IO
 * - Audio streaming: Mic → STT → LLM → TTS → Playback
 * - VAD (Voice Activity Detection) with Deepgram's built-in endpointing
 * - Barge-in detection and interruption
 * - DEBOUNCED speech processing — accumulates is_final transcripts and waits
 *   for the user to finish speaking before sending to LLM (prevents fragmentation)
 * - TTS interruption — cancels previous TTS when new speech is processed
 * - Text chat input
 * - Configurable STT/TTS/LLM providers with primary/fallback
 * - HTTP API for provider configuration
 * 
 * Provider Options:
 * - STT: deepgram (Deepgram Nova-3), cartesia (Cartesia STT batch), zai (ZAI SDK ASR)
 * - TTS: cartesia (Cartesia Sonic-3.5), deepgram (Deepgram Aura TTS batch), zai (ZAI SDK TTS), gemini (Gemini TTS via proxy)
 * - LLM: zai (ZAI SDK chat), gemini (Gemini via proxy worker)
 * 
 * Default Config:
 * - STT: primary=deepgram, fallback=zai
 * - TTS: primary=cartesia, fallback=deepgram
 * - LLM: primary=zai, fallback=gemini
 * 
 * Port: 3004
 */

import { Server } from 'socket.io'
import { createServer } from 'http'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { resolve } from 'path'

// ─── Load .env file ──────────────────────────────────────────────────────────

function loadEnvFile() {
  const envPath = resolve(import.meta.dir || __dirname || '.', '../../../.env')
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIndex = trimmed.indexOf('=')
      if (eqIndex === -1) continue
      const key = trimmed.slice(0, eqIndex).trim()
      let value = trimmed.slice(eqIndex + 1).trim()
      // Remove surrounding quotes
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      if (!process.env[key]) {
        process.env[key] = value
      }
    }
    console.log('[VoiceAgent] Loaded .env file from root')
  }
}

loadEnvFile()

// ─── Configuration ────────────────────────────────────────────────────────────

const PORT = 3004
let geminiBaseUrl = 'https://recentech-ai-worker.42abudhabi424242.workers.dev/gemini'
let geminiApiKey = process.env.RECENTECH_AI_API_KEY || ''
const CONFIG_PATH = resolve(import.meta.dir || __dirname || '.', 'provider-config.json')
const MOEI_CONFIG_PATH = resolve(import.meta.dir || __dirname || '.', '../../../moei-config.json')
const ENV_PATH = resolve(import.meta.dir || __dirname || '.', '../../../.env')

// Raw provider config data (includes nested API keys, models, voices, etc.)
let rawProviderData: any = null
// Raw moei-config data (secondary source for API keys and endpoints)
let rawMoeiConfig: any = null

// API Keys — mutable so they can be updated via API without restart
// Initialized from env vars, then overridden from provider-config.json
let deepgramApiKey = process.env.DEEPGRAM_API_KEY || ''
let cartesiaApiKey = process.env.CARTESIA_API_KEY || ''

// Getters for API keys (used throughout the service)
function getDeepgramKey(): string { return deepgramApiKey }
function getCartesiaKey(): string { return cartesiaApiKey }

// Deepgram STT config — defaults, overridden from provider-config.json via helpers below
const DEEPGRAM_MODEL = 'nova-3'
const DEEPGRAM_ENCODING = 'linear16'
const DEEPGRAM_SAMPLE_RATE = 48000

// Cartesia TTS config — defaults, overridden from provider-config.json via helpers below
const CARTESIA_MODEL = 'sonic-3.5'
const CARTESIA_VOICE_ID = '6ccbfb76-1fc6-48f7-b71d-91ac6298247b' // Default multilingual voice (supports EN + AR)
const CARTESIA_SAMPLE_RATE = 44100
const CARTESIA_VERSION = '2026-03-01'

// ─── Provider Config Helpers ─────────────────────────────────────────────────
// Read model/key/voice settings from rawProviderData with fallback to defaults

function getDeepgramSttModel(): string {
  return rawProviderData?.stt?.deepgram?.model || DEEPGRAM_MODEL
}
function getDeepgramSttSampleRate(): number {
  return rawProviderData?.stt?.deepgram?.sampleRate || DEEPGRAM_SAMPLE_RATE
}
function getCartesiaTtsModel(): string {
  return rawProviderData?.tts?.cartesia?.model || CARTESIA_MODEL
}
function getCartesiaTtsSampleRate(): number {
  return rawProviderData?.tts?.cartesia?.sampleRate || CARTESIA_SAMPLE_RATE
}
function getCartesiaVoiceId(lang: string): string {
  const voices = rawProviderData?.tts?.cartesia?.voices
  if (voices && voices[lang]) return voices[lang]
  return CARTESIA_VOICE_ID // fallback to default multilingual voice
}
function getDeepgramTtsModel(): string {
  return rawProviderData?.tts?.deepgram?.model || 'aura-asteria-en'
}
function getDeepgramTtsApiKey(): string {
  // TTS-specific deepgram key, falls back to STT deepgram key
  return rawProviderData?.tts?.deepgram?.apiKey || getDeepgramKey()
}

// ─── Arabic Detection Utility ─────────────────────────────────────────────────

function containsArabic(text: string): boolean {
  // Arabic Unicode ranges: main Arabic block, Arabic Supplement, Arabic Extended-A, Arabic Presentation Forms
  const arabicPattern = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/
  return arabicPattern.test(text)
}

function getArabicRatio(text: string): number {
  let arabicCount = 0
  let totalChars = 0
  for (const ch of text) {
    const code = ch.codePointAt(0)
    if (!code) continue
    // Skip spaces, punctuation, numbers
    if (/\s|[\d.,!?;:'"()\-]/.test(ch)) continue
    totalChars++
    if ((code >= 0x0600 && code <= 0x06FF) || (code >= 0x0750 && code <= 0x077F) ||
        (code >= 0x08A0 && code <= 0x08FF) || (code >= 0xFB50 && code <= 0xFDFF) ||
        (code >= 0xFE70 && code <= 0xFEFF)) {
      arabicCount++
    }
  }
  return totalChars > 0 ? arabicCount / totalChars : 0
}

function detectTTSLanguage(text: string): string {
  const ratio = getArabicRatio(text)
  // If more than 30% Arabic characters, use Arabic TTS
  if (ratio > 0.3) {
    return 'ar'
  }
  return 'en'
}

// Voice Agent config
const VAD_ENERGY_THRESHOLD = 200
const VAD_CONSECUTIVE_SILENCE_CHUNKS = 10
const MAX_SPEECH_DURATION = 15000

const BARGE_IN_BASE_THRESHOLD = 600
const BARGE_IN_ECHO_MULTIPLIER = 2.5
const BARGE_IN_RMS_SPIKE_RATIO = 1.8
const BARGE_IN_DETECT_CHUNKS = 2
const BARGE_IN_CONFIRM_DURATION_MS = 600
const BARGE_IN_CANCEL_SILENCE_CHUNKS = 3
const TTS_GRACE_PERIOD_MS = 1500

const MAX_HISTORY = 20
const PCM_SEND_CHUNK_SIZE = 8192
const SAMPLE_RATE_CLIENT = 48000

// ─── Speech Endpointer Debounce ────────────────────────────────────────────────
// Deepgram sends `is_final` events after each silence pause (determined by the
// `endpointing` param). A single utterance like "I want to ask about my ... water
// bill" may produce multiple `is_final` transcripts separated by brief pauses.
// Without debouncing, each fragment is sent to the LLM separately, causing
// fragmented responses and poor UX.
//
// DEBOUNCE_DELAY_MS controls how long we wait after the LAST `is_final` before
// processing the accumulated text. If another `is_final` arrives during the
// wait, the timer resets. This ensures we collect the full utterance before
// sending to the LLM.
//
// The delay should be proportional to the Deepgram endpointing value.
// With endpointing=800ms, a debounce of ~1200ms gives good results:
// the user must be silent for 800ms (Deepgram) + 1200ms (debounce) = 2s total
// before processing starts.
const DEBOUNCE_DELAY_MS = 1200 // Wait after last is_final before processing

/**
 * Calculate the Deepgram `endpointing` parameter from the configured
 * maxSpeechDuration. This controls how long Deepgram waits for silence
 * before sending an `is_final` transcript.
 *
 * Strategy:
 * - Minimum 600ms (responsive for short utterances)
 * - Maximum 2000ms (don't wait too long between fragments)
 * - Scale with maxSpeechDuration: longer listening = longer endpointing
 *   so the agent doesn't cut off users mid-thought
 */
function getEndpointingMs(): number {
  const maxDur = providerConfig.maxSpeechDuration || MAX_SPEECH_DURATION
  // Scale: 5s→600ms, 10s→800ms, 15s→1000ms, 20s→1200ms, 25s→1500ms, 30s→2000ms
  const scaled = Math.round(400 + (maxDur - 5000) * (1600 / 25000))
  return Math.min(2000, Math.max(600, scaled))
}

const BASE_SYSTEM_PROMPT = `You are the central AI intelligence and orchestration layer for the MOEI omnichannel CRM and customer service platform for the UAE Ministry of Energy & Infrastructure. Your name is MOEI Assistant.

You assist customers, support call center employees, coordinate conversations across all communication channels, and provide accurate, professional, context-aware assistance for MOEI-related services and requests.

You operate as part of a larger enterprise platform. You must behave as an intelligent operational assistant, not as a standalone chatbot.

CORE RESPONSIBILITIES:
- Understand customer intent, analyze sentiment and urgency
- Respond professionally, clearly, and concisely for voice interaction
- Assist with MOEI services: electricity, water, housing, petroleum, transport, sustainability
- Guide customers through workflows and collect missing information
- Maintain conversation continuity across channels (WhatsApp, Voice, Web, Email)
- Escalate when necessary

You must NOT: invent ticket/reference numbers, invent service statuses, claim a request was submitted unless backend confirms, expose private customer data, bypass security or identity verification.

IDENTITY AND UAE PASS RULES:
When verified customer identity exists: do not ask again for known information, personalize responses, use customer history. If not authenticated: collect minimum required information progressively. Encourage secure login for sensitive actions.

KEY CONTACT INFO (REFERENCE ONLY — DO NOT REDIRECT CUSTOMERS TO THESE):
- Website: www.moei.gov.ae
- Toll-free: 8005555 (office hours)
- Electricity Emergency: 997 (24/7)
- Water Emergency: 998 (24/7)
- General Emergency: 999
- Office Hours: Sun-Thu, 7:30 AM - 2:30 PM
- UAE PASS required for electronic services

CRITICAL: The customer is already talking to MOEI. NEVER tell them to "call 8005555" or "visit www.moei.gov.ae" — they are already here. Help them directly instead. Only share emergency numbers (997/998/999) as those are different channels for physical safety.

SERVICE DETAILS:
1. Electricity & Water: New connections AED 1,500 (3-5 days), water AED 1,000 (2-5 days), monthly billing with slab tariff, smart meters free
2. Housing: Sheikh Zayed Program up to AED 800,000 (0-2% interest), federal loans AED 200K-800K, maintenance loans AED 50K-200K
3. Petroleum: Licensing 30-90 days, fuel prices updated monthly, gas leaks call 999
4. Transport: Commercial vehicle permits, maritime permits, federal road safety
5. Sustainability: UAE Energy Strategy 2050 (44% clean energy), Shams Dubai solar, Estidama Pearl Rating

VOICE-SPECIFIC RULES:
- Keep responses concise and conversational (2-3 sentences max per turn)
- Do not use emojis, asterisks, markdown, or special characters
- Speak clearly and naturally for text-to-speech
- For urgent safety matters, advise calling emergency numbers (997/998/999) — these are DIFFERENT channels for physical safety
- NEVER redirect to 8005555 or www.moei.gov.ae — the customer is already talking to MOEI
- If customer is angry: de-escalate calmly, acknowledge frustration, focus on resolution
- If confused: simplify, guide step-by-step
- Process partial transcriptions intelligently, maintain continuity during interruptions
- Avoid repeating identical phrases excessively

OMNICHANNEL RULES:
All channels belong to the same unified customer timeline. Preserve conversation continuity, customer context, previous interaction awareness, and sentiment continuity across channels.

WORKFLOW AND REQUEST RULES:
The backend controls all workflows. Your role is to guide customers, explain workflows, collect missing information, clarify next steps. You may suggest actions but backend performs execution. Reference real request IDs from backend only.

ESCALATION: Escalate when customer requests human, severe emotional escalation, legal/sensitive issues, low confidence, or emergencies.

SAFETY: Never hallucinate, never invent reference numbers (format: MOEI-XXXX-XXXX-XXXX — only backend provides these), never make unauthorized promises, protect customer privacy.

You are the operational intelligence layer for MOEI customer service across all communication systems.`

/**
 * Get the system prompt with language-specific instructions.
 * Now supports per-session language detection for smart language switching.
 * 
 * Priority: sessionDetectedLanguage > providerConfig.language > 'multi'
 * 
 * When language is explicitly set to 'ar' or 'en', adds a strong instruction
 * to the LLM to respond in that language. When 'multi' (auto-detect), the LLM
 * should respond in the same language the user speaks.
 */
function getSystemPrompt(sessionDetectedLanguage?: string): string {
  // Priority: session-level detected language > global config
  const lang = sessionDetectedLanguage || providerConfig.language || 'multi'
  if (lang === 'ar') {
    return BASE_SYSTEM_PROMPT + '\n\nIMPORTANT: You MUST respond in Arabic (العربية). The user is speaking Arabic, so all your responses must be in Arabic. Do not respond in English unless the user explicitly switches to English. You are equally fluent in both Arabic and English. Use formal Arabic titles when addressing customers (سمو, سعادة, etc.) if known.'
  } else if (lang === 'en') {
    return BASE_SYSTEM_PROMPT + '\n\nIMPORTANT: You MUST respond in English. The user is speaking English, so all your responses must be in English. You are equally fluent in both Arabic and English.'
  } else {
    // 'multi' — auto-detect
    return BASE_SYSTEM_PROMPT + '\n\nIMPORTANT: You MUST respond in the same language the user speaks. If the user speaks Arabic, respond in Arabic. If the user speaks English, respond in English. You are equally fluent in both Arabic and English. Use formal Arabic titles when addressing Arabic-speaking customers (سمو, سعادة, etc.) if known.'
  }
}

// ─── Provider Config System ──────────────────────────────────────────────────

interface LanguageProviderConfig {
  primary: string
  fallback: string
}

interface ProviderConfig {
  stt: { primary: string; fallback: string }
  tts: { primary: string; fallback: string; languageProviders?: Record<string, LanguageProviderConfig> }
  llm: { primary: string; fallback: string }
  language: string // 'multi' | 'ar' | 'en'
  maxSpeechDuration: number // in milliseconds, default 15000
}

const VALID_LANGUAGES = ['multi', 'ar', 'en']
const LANGUAGE_LABELS: Record<string, string> = {
  multi: 'Auto-detect (Arabic/English)',
  ar: 'Arabic (العربية)',
  en: 'English',
}

// ─── Deepgram STT Language Strategy for UAE ────────────────────────────────
// Deepgram streaming STT does NOT support language auto-detection.
// Deepgram's "language=multi" only supports 10 languages (EN,ES,FR,DE,HI,RU,PT,JA,IT,NL)
// and does NOT include Arabic.
//
// For UAE MOEI context (Arabic is primary language):
//   "ar"    → Deepgram language=ar (Arabic model, 17 dialects including ar-AE)
//   "en"    → Deepgram language=en (English model)
//   "multi" → Deepgram language=ar (Arabic model as default for UAE)
//             + ZAI SDK STT fallback for English-heavy speech
//             This is because language=multi excludes Arabic,
//             and Arabic is the primary language in UAE.
function getDeepgramSTTLanguage(): string {
  const lang = providerConfig.language || 'multi'
  if (lang === 'ar') return 'ar'
  if (lang === 'en') return 'en'
  // For "multi" (auto-detect): Use Arabic model for UAE context
  // Arabic model also handles some English code-switching
  // If English-only speech is not recognized well, ZAI SDK fallback handles it
  return 'ar'
}

// Default language-to-TTS-provider mapping — admin can override via config panel
// Deepgram TTS does NOT support Arabic (only EN, ES, NL, FR, DE, IT, JA)
// Cartesia supports Arabic natively (Sonic-3.5)
// Gemini TTS supports Arabic but may have regional restrictions
// ZAI SDK supports Arabic TTS
const DEFAULT_LANGUAGE_PROVIDERS: Record<string, LanguageProviderConfig> = {
  ar: { primary: 'cartesia', fallback: 'zai' },       // Arabic: Cartesia (Sonic-3.5) → ZAI SDK
  en: { primary: 'cartesia', fallback: 'deepgram' },   // English: Cartesia → Deepgram Aura
}

const DEFAULT_PROVIDER_CONFIG: ProviderConfig = {
  stt: { primary: 'deepgram', fallback: 'zai' },
  tts: { primary: 'cartesia', fallback: 'zai', languageProviders: DEFAULT_LANGUAGE_PROVIDERS },
  llm: { primary: 'zai', fallback: 'gemini' },
  language: 'multi',
  maxSpeechDuration: 15000,
}

/**
 * Get the TTS provider config for a specific language.
 * If the admin has configured languageProviders for this language, use those.
 * Otherwise, fall back to the global tts primary/fallback.
 * This allows the admin to choose which TTS provider to use per language,
 * e.g., route Arabic to Cartesia/Gemini (which support Arabic) instead of
 * Deepgram (which doesn't support Arabic).
 */
function getTTSProvidersForLanguage(lang: string): { primary: string; fallback: string } {
  // Check languageProviders from config (admin-configurable)
  const langProviders = providerConfig.tts.languageProviders
  if (langProviders && langProviders[lang]) {
    return langProviders[lang]
  }
  // Fallback to global tts config
  return { primary: providerConfig.tts.primary, fallback: providerConfig.tts.fallback }
}

/**
 * Detect the language for TTS routing based on text content and config setting.
 * When config language is 'multi', auto-detects from text.
 * When config language is 'ar' or 'en', uses that directly.
 */
function getTTSLanguage(text: string): string {
  if (providerConfig.language === 'ar' || providerConfig.language === 'en') {
    return providerConfig.language
  }
  // 'multi' — auto-detect from text
  return detectTTSLanguage(text)
}

// Legacy alias — use getDeepgramSTTLanguage() for proper UAE language handling
function getDeepgramLanguage(): string {
  return getDeepgramSTTLanguage()
}

// ─── Smart Language Detection for Session ──────────────────────────────────────
// Detects the language of incoming text and triggers pipeline reconfiguration
// when a language change is detected. This is the core of the "smart language" feature:
//
// Flow: User speaks Arabic → STT transcribes → detect Arabic text →
//   1. Update session.detectedLanguage = 'ar'
//   2. Reconnect Deepgram with language=ar (if currently using 'en')
//   3. LLM gets Arabic-optimized system prompt
//   4. TTS routes to Arabic-capable provider (Cartesia/Gemini)
//
// Same flow in reverse for English. This enables seamless mid-conversation switching.

/**
 * Detect language from text content using Arabic character ratio analysis.
 * Returns 'ar' for Arabic, 'en' for English.
 * Uses the same algorithm as detectTTSLanguage() but also considers
 * common Arabic conversational patterns for higher accuracy.
 */
function detectLanguageFromText(text: string): 'ar' | 'en' {
  if (!text || text.trim().length === 0) return 'en'
  const ratio = getArabicRatio(text)
  // Also check for common Arabic conversational words/phrases
  const arabicPatterns = /(?:ال|في|من|إلى|على|هذا|هذه|أنا|أريد|هل|نعم|لا|شكر|مرحب|سلام|أهلا|كيف|لماذا|متى|أين|ما|عفوا|مع|عن|حتى|بعد|قبل|كل|بعض|أي|بين|ذلك|هؤلاء|أولئك|ذي|التي|الذي|كان|كانت|يكون|تكون|لدي|عندي|فقط|أيضا|الآن|هنا|هناك|ثم|أو)/
  const hasArabicWords = arabicPatterns.test(text)
  
  // If >30% Arabic chars, it's Arabic
  if (ratio > 0.3) return 'ar'
  // If 15-30% Arabic chars AND has Arabic patterns, it's Arabic
  if (ratio > 0.15 && hasArabicWords) return 'ar'
  // If any Arabic chars at all in a short text, likely Arabic
  if (ratio > 0.05 && text.length < 30 && containsArabic(text)) return 'ar'
  
  return 'en'
}

/**
 * Check if a language switch is needed and handle the reconfiguration.
 * This is called after each STT transcript is processed.
 *
 * When a language change is detected:
 * 1. Update session.detectedLanguage
 * 2. Reconnect Deepgram STT with the correct language model
 * 3. Notify the client via 'language-detected' event
 * 4. Log the switch for analytics
 *
 * Returns true if a language switch occurred.
 */
async function handleLanguageDetection(
  session: SessionState,
  text: string,
  socket: any
): Promise<boolean> {
  // Only do smart language detection in 'multi' mode
  // If the admin explicitly set 'ar' or 'en', respect that
  if (providerConfig.language !== 'multi') return false
  
  const newLang = detectLanguageFromText(text)
  
  // No change needed
  if (newLang === session.detectedLanguage) return false
  
  // ── Language switch detected! ──
  const oldLang = session.detectedLanguage
  session.detectedLanguage = newLang
  session.languageSwitchCount++
  session.lastLanguageSwitchTime = Date.now()
  
  console.log(`[SmartLang] Language switch: ${oldLang} → ${newLang} (switch #${session.languageSwitchCount}) — text: "${text.substring(0, 60)}..."`)
  
  // Notify client about the detected language
  socket.emit('language-detected', {
    language: newLang,
    previousLanguage: oldLang,
    switchCount: session.languageSwitchCount,
  })
  
  // ── Reconnect Deepgram STT with the correct language ──
  // Deepgram streaming STT requires a specific language parameter.
  // When the user switches from Arabic to English (or vice versa),
  // we need to close the current Deepgram stream and open a new one
  // with the correct language model.
  if (session.deepgramReady && session.deepgramStream) {
    const targetSTTLang = newLang === 'ar' ? 'ar' : 'en'
    
    if (targetSTTLang !== session.deepgramSTTLanguage) {
      console.log(`[SmartLang] Reconnecting Deepgram STT: ${session.deepgramSTTLanguage} → ${targetSTTLang}`)
      
      // Close the old stream
      try {
        session.deepgramStream.close()
      } catch (e) {
        // Ignore close errors
      }
      
      // Temporarily override the STT language for this session
      session.deepgramSTTLanguage = targetSTTLang
      
      // Create a new Deepgram stream with the correct language
      try {
        // We need to create the stream with the specific language
        // Temporarily set providerConfig.language to match, then restore
        const savedLang = providerConfig.language
        // Use a hack: temporarily set to the target language so getDeepgramSTTLanguage returns it
        // This is safe because we restore it immediately after creating the stream
        providerConfig.language = targetSTTLang
        
        const newStream = createDeepgramStream(session.clientSampleRate)
        
        // Restore the global config
        providerConfig.language = savedLang
        
        // Set up transcript handlers on the new stream
        newStream.onTranscript((transcript, isFinal) => {
          if (isFinal) {
            console.log(`[Deepgram] FINAL (${targetSTTLang}): "${transcript}"`)
            session.accumulatedTranscript += (session.accumulatedTranscript ? ' ' : '') + transcript
            session.deepgramInterimTranscript = ''
            
            if (session.transcriptDebounceTimer) {
              clearTimeout(session.transcriptDebounceTimer)
              session.transcriptDebounceTimer = null
            }
            
            session.transcriptDebounceTimer = setTimeout(() => {
              session.transcriptDebounceTimer = null
              const fullText = session.accumulatedTranscript.trim()
              session.accumulatedTranscript = ''
              session.deepgramFinalTranscript = ''
              
              if (!fullText || session.isProcessing) return
              
              // Check for language switch again
              handleLanguageDetection(session, fullText, socket).then(() => {
                console.log(`[Deepgram] Debounce complete — processing: "${fullText}"`)
                processTextFromSTT(fullText)
              })
            }, DEBOUNCE_DELAY_MS)
          } else {
            session.deepgramInterimTranscript = transcript
            socket.emit('transcript-interim', { text: transcript })
          }
        })
        
        newStream.onSpeechStarted(() => {
          if (!session.isSpeechActive) {
            session.isSpeechActive = true
            session.deepgramSpeechActive = true
            session.speechStartTime = Date.now()
            session.deepgramAudioBuffer = []
            socket.emit('user-speech-started')
          }
        })
        
        // Wait for connection
        let retries = 15
        while (!newStream.isReady() && retries > 0) {
          await new Promise(r => setTimeout(r, 200))
          retries--
        }
        
        session.deepgramReady = newStream.isReady()
        session.deepgramStream = newStream
        
        if (session.deepgramReady) {
          console.log(`[SmartLang] Deepgram reconnected with language=${targetSTTLang}`)
        } else {
          console.warn(`[SmartLang] Deepgram reconnection failed for language=${targetSTTLang}, will use ZAI fallback`)
        }
      } catch (err) {
        console.error('[SmartLang] Deepgram reconnection error:', err)
        session.deepgramReady = false
      }
    }
  }
  
  return true
}

const VALID_STT_PROVIDERS = ['deepgram', 'cartesia', 'zai']
const VALID_TTS_PROVIDERS = ['cartesia', 'deepgram', 'zai', 'gemini']
const VALID_LLM_PROVIDERS = ['zai', 'gemini']

function loadProviderConfig(): ProviderConfig {
  try {
    if (existsSync(CONFIG_PATH)) {
      const data = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'))
      // Store raw data for access to nested provider config (API keys, models, etc.)
      rawProviderData = data
      // Merge with defaults to ensure all fields exist
      let maxSpeechDuration = DEFAULT_PROVIDER_CONFIG.maxSpeechDuration
      if (typeof data.maxSpeechDuration === 'number') {
        maxSpeechDuration = Math.min(30000, Math.max(5000, data.maxSpeechDuration))
      }
      // Parse languageProviders from config, merging with defaults
      const languageProviders: Record<string, LanguageProviderConfig> = {
        ...DEFAULT_LANGUAGE_PROVIDERS,
        ...(data.tts?.languageProviders || {}),
      }
      // Validate each language provider entry
      for (const [lang, prov] of Object.entries(languageProviders)) {
        if (!VALID_TTS_PROVIDERS.includes(prov.primary)) {
          console.warn(`[VoiceAgent] Invalid languageProviders[${lang}].primary: ${prov.primary}, using default`)
          languageProviders[lang] = DEFAULT_LANGUAGE_PROVIDERS[lang] || { primary: providerConfig?.tts?.primary || 'cartesia', fallback: 'deepgram' }
        }
        if (prov.fallback && !VALID_TTS_PROVIDERS.includes(prov.fallback)) {
          console.warn(`[VoiceAgent] Invalid languageProviders[${lang}].fallback: ${prov.fallback}, using default`)
          prov.fallback = DEFAULT_LANGUAGE_PROVIDERS[lang]?.fallback || 'deepgram'
        }
      }
      return {
        stt: { ...DEFAULT_PROVIDER_CONFIG.stt, ...data.stt },
        tts: {
          primary: data.tts?.primary || DEFAULT_PROVIDER_CONFIG.tts.primary,
          fallback: data.tts?.fallback || DEFAULT_PROVIDER_CONFIG.tts.fallback,
          languageProviders,
        },
        llm: { ...DEFAULT_PROVIDER_CONFIG.llm, ...data.llm },
        language: data.language && VALID_LANGUAGES.includes(data.language) ? data.language : DEFAULT_PROVIDER_CONFIG.language,
        maxSpeechDuration,
      }
    }
  } catch (err) {
    console.error('[VoiceAgent] Failed to load provider config:', err)
  }
  return { ...DEFAULT_PROVIDER_CONFIG }
}

function saveProviderConfig(): void {
  try {
    writeFileSync(CONFIG_PATH, JSON.stringify(providerConfig, null, 2))
    console.log('[VoiceAgent] Provider config saved to', CONFIG_PATH)
  } catch (err) {
    console.error('[VoiceAgent] Failed to save provider config:', err)
  }
}

function saveApiKey(provider: string, key: string): boolean {
  try {
    const envVarName = provider === 'deepgram' ? 'DEEPGRAM_API_KEY' : provider === 'cartesia' ? 'CARTESIA_API_KEY' : null
    if (!envVarName) return false

    // Update in-memory
    process.env[envVarName] = key
    if (provider === 'deepgram') {
      deepgramApiKey = key
      // Also update rawProviderData so helpers reflect the new key
      if (rawProviderData) {
        if (!rawProviderData.stt) rawProviderData.stt = { primary: 'deepgram', fallback: 'zai' }
        if (!rawProviderData.stt.deepgram) rawProviderData.stt.deepgram = {}
        rawProviderData.stt.deepgram.apiKey = key
        if (!rawProviderData.tts) rawProviderData.tts = { primary: 'cartesia', fallback: 'deepgram' }
        if (!rawProviderData.tts.deepgram) rawProviderData.tts.deepgram = {}
        rawProviderData.tts.deepgram.apiKey = key
      }
    }
    if (provider === 'cartesia') {
      cartesiaApiKey = key
      // Also update rawProviderData so helpers reflect the new key
      if (rawProviderData) {
        if (!rawProviderData.tts) rawProviderData.tts = { primary: 'cartesia', fallback: 'deepgram' }
        if (!rawProviderData.tts.cartesia) rawProviderData.tts.cartesia = {}
        rawProviderData.tts.cartesia.apiKey = key
      }
    }

    // Update .env file
    let envContent = ''
    if (existsSync(ENV_PATH)) {
      envContent = readFileSync(ENV_PATH, 'utf-8')
    }

    const lines = envContent.split('\n')
    let found = false
    const updatedLines = lines.map(line => {
      const trimmed = line.trim()
      if (trimmed.startsWith(envVarName + '=')) {
        found = true
        return `${envVarName}=${key}`
      }
      return line
    })

    if (!found) {
      // Remove trailing newline issues
      if (updatedLines.length > 0 && updatedLines[updatedLines.length - 1] !== '') {
        updatedLines.push('')
      }
      updatedLines.push(`${envVarName}=${key}`)
    }

    writeFileSync(ENV_PATH, updatedLines.join('\n'))
    refreshProviderStatus()
    console.log(`[VoiceAgent] API key saved for ${provider}`)
    return true
  } catch (err) {
    console.error(`[VoiceAgent] Failed to save API key for ${provider}:`, err)
    return false
  }
}

let providerConfig: ProviderConfig = loadProviderConfig()
console.log('[VoiceAgent] Loaded provider config:', JSON.stringify(providerConfig))

// Extract API keys and config from raw provider data (takes priority over env vars)
// Also reads from moei-config.json as a secondary source
try {
  if (existsSync(MOEI_CONFIG_PATH)) {
    rawMoeiConfig = JSON.parse(readFileSync(MOEI_CONFIG_PATH, 'utf-8'))
    console.log('[VoiceAgent] Loaded moei-config.json from project root')
  }
} catch (err) {
  console.warn('[VoiceAgent] Failed to load moei-config.json:', err)
}

if (rawProviderData) {
  // Deepgram STT API key
  if (rawProviderData.stt?.deepgram?.apiKey) {
    deepgramApiKey = rawProviderData.stt.deepgram.apiKey
    console.log('[VoiceAgent] Deepgram STT API key loaded from provider-config.json')
  }
  // Cartesia TTS API key
  if (rawProviderData.tts?.cartesia?.apiKey) {
    cartesiaApiKey = rawProviderData.tts.cartesia.apiKey
    console.log('[VoiceAgent] Cartesia TTS API key loaded from provider-config.json')
  }
  // Gemini LLM API key and base URL
  if (rawProviderData.llm?.gemini?.apiKey) {
    geminiApiKey = rawProviderData.llm.gemini.apiKey
    console.log('[VoiceAgent] Gemini API key loaded from provider-config.json')
  }
  if (rawProviderData.llm?.gemini?.baseUrl) {
    geminiBaseUrl = rawProviderData.llm.gemini.baseUrl
    console.log('[VoiceAgent] Gemini base URL loaded from provider-config.json')
  }
}

// Fallback: read from moei-config.json if keys still not set
if (rawMoeiConfig) {
  if (!deepgramApiKey && rawMoeiConfig.apiKeys?.deepgram) {
    deepgramApiKey = rawMoeiConfig.apiKeys.deepgram
    console.log('[VoiceAgent] Deepgram API key loaded from moei-config.json')
  }
  if (!cartesiaApiKey && rawMoeiConfig.apiKeys?.cartesia) {
    cartesiaApiKey = rawMoeiConfig.apiKeys.cartesia
    console.log('[VoiceAgent] Cartesia API key loaded from moei-config.json')
  }
  if (!geminiApiKey && rawMoeiConfig.apiKeys?.gemini) {
    geminiApiKey = rawMoeiConfig.apiKeys.gemini
    console.log('[VoiceAgent] Gemini API key loaded from moei-config.json')
  } else if (!geminiApiKey && rawMoeiConfig.apiKeys?.recentechAI) {
    geminiApiKey = rawMoeiConfig.apiKeys.recentechAI
    console.log('[VoiceAgent] Gemini API key (recentechAI) loaded from moei-config.json')
  }
  if (rawMoeiConfig.endpoints?.recentechAIGemini) {
    // Only override if not already set from provider-config.json
    if (geminiBaseUrl === 'https://recentech-ai-worker.42abudhabi424242.workers.dev/gemini') {
      geminiBaseUrl = rawMoeiConfig.endpoints.recentechAIGemini
      console.log('[VoiceAgent] Gemini base URL loaded from moei-config.json')
    }
  }
}

// ─── Provider Status ──────────────────────────────────────────────────────────

function refreshProviderStatus(): void {
  providerStatus.deepgram = deepgramApiKey ? 'configured' : 'missing-key'
  providerStatus.cartesia = cartesiaApiKey ? 'configured' : 'missing-key'
  providerStatus.geminiProxy = geminiApiKey ? 'configured' : 'missing-key'
}

const providerStatus: Record<string, string> = {
  deepgram: deepgramApiKey ? 'configured' : 'missing-key',
  cartesia: cartesiaApiKey ? 'configured' : 'missing-key',
  zai: 'pending', // will be checked on init
  geminiProxy: geminiApiKey ? 'configured' : 'missing-key',
}

// ─── Provider Error Log ────────────────────────────────────────────────────────
// Tracks errors for each provider so the admin dashboard can display them.
// NOT shown to customers — only accessible via /api/voice-providers/errors endpoint.

interface ProviderErrorEntry {
  id: string
  provider: string       // 'cartesia' | 'deepgram' | 'zai' | 'gemini'
  category: string       // 'tts' | 'stt' | 'llm'
  error: string          // error message
  timestamp: string      // ISO 8601
  sessionId?: string     // Socket.IO session ID
  fallbackUsed?: string  // which fallback provider was used instead
  resolved: boolean      // whether the provider recovered
}

const providerErrors: ProviderErrorEntry[] = []
const MAX_ERRORS = 100 // keep last 100 errors

function logProviderError(params: {
  provider: string
  category: string
  error: string
  sessionId?: string
  fallbackUsed?: string
}): void {
  const entry: ProviderErrorEntry = {
    id: `err-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    provider: params.provider,
    category: params.category,
    error: params.error,
    timestamp: new Date().toISOString(),
    sessionId: params.sessionId,
    fallbackUsed: params.fallbackUsed,
    resolved: false,
  }
  providerErrors.unshift(entry) // newest first
  if (providerErrors.length > MAX_ERRORS) providerErrors.length = MAX_ERRORS
  console.warn(`[ProviderErrorLog] ${params.category}/${params.provider}: ${params.error}${params.fallbackUsed ? ` → fallback: ${params.fallbackUsed}` : ''}`)
}

function markProviderRecovered(provider: string, category: string): void {
  for (const err of providerErrors) {
    if (err.provider === provider && err.category === category && !err.resolved) {
      err.resolved = true
    }
  }
}

function getProviderErrors(limit: number = 50): ProviderErrorEntry[] {
  return providerErrors.slice(0, limit)
}

function getActiveProviderErrors(): ProviderErrorEntry[] {
  return providerErrors.filter(e => !e.resolved)
}

// Available providers info for API
const availableProviders = {
  stt: {
    deepgram: { name: 'Deepgram Nova-3', description: 'Real-time streaming STT with interim results, Arabic & English' },
    cartesia: { name: 'Cartesia STT', description: 'Cartesia speech-to-text (batch mode), Arabic & English' },
    zai: { name: 'ZAI SDK ASR', description: 'ZAI SDK speech-to-text (batch mode)' },
  },
  tts: {
    cartesia: { name: 'Cartesia Sonic-3.5', description: 'Real-time streaming TTS, Arabic & English voices' },
    deepgram: { name: 'Deepgram Aura TTS', description: 'Deepgram TTS (7 langs: EN/ES/NL/FR/DE/IT/JA — no Arabic)' },
    zai: { name: 'ZAI SDK TTS', description: 'ZAI SDK text-to-speech (batch mode)' },
    gemini: { name: 'Gemini TTS', description: 'Gemini Flash TTS via proxy worker' },
  },
  llm: {
    zai: { name: 'ZAI SDK Chat', description: 'ZAI SDK chat completions' },
    gemini: { name: 'Gemini Flash', description: 'Gemini 2.5 Flash via proxy worker' },
  },
  languages: Object.entries(LANGUAGE_LABELS).map(([code, label]) => ({ code, label })),
}

// ─── Retry Utility ────────────────────────────────────────────────────────────

async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  maxRetries: number = 3,
  baseDelay: number = 2000,
): Promise<T> {
  let lastError: Error | null = null
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      const is429 = lastError.message.includes('429') || lastError.message.includes('RESOURCE_EXHAUSTED') || lastError.message.includes('rate limit')
      const is502 = lastError.message.includes('502')
      
      if ((is429 || is502) && attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt - 1)
        console.warn(`[VoiceAgent] ${label} attempt ${attempt}/${maxRetries} failed (${lastError.message}). Retrying in ${delay}ms...`)
        await new Promise(r => setTimeout(r, delay))
      } else {
        throw lastError
      }
    }
  }
  throw lastError || new Error(`${label} failed after ${maxRetries} retries`)
}

// ─── ZAI Instance (lazy singleton) ──────────────────────────────────────────

let zaiInstance: any = null
let zaiInitPromise: Promise<any> | null = null

async function getZAI(): Promise<any> {
  if (zaiInstance) return zaiInstance
  if (zaiInitPromise) return zaiInitPromise

  zaiInitPromise = (async () => {
    let lastError: Error | null = null
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`[ZAI] Initializing SDK (attempt ${attempt}/3)...`)
        const ZAI = (await import('z-ai-web-dev-sdk')).default
        const instance = await ZAI.create()
        console.log('[ZAI] SDK initialized successfully')
        zaiInstance = instance
        providerStatus.zai = 'available'
        return instance
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
        console.error(`[ZAI] Init attempt ${attempt} failed:`, lastError.message)
        if (attempt < 3) await new Promise(r => setTimeout(r, 2000 * attempt))
      }
    }
    zaiInitPromise = null
    providerStatus.zai = 'failed'
    throw lastError || new Error('ZAI SDK initialization failed')
  })()

  return zaiInitPromise
}

// ─── WAV Helpers ─────────────────────────────────────────────────────────────

function createWavHeader(dataLength: number, sampleRate: number, numChannels: number = 1, bitsPerSample: number = 16): ArrayBuffer {
  const header = new ArrayBuffer(44)
  const view = new DataView(header)
  const writeString = (offset: number, str: string) => { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)) }
  writeString(0, 'RIFF')
  view.setUint32(4, 36 + dataLength, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, (sampleRate * numChannels * bitsPerSample) / 8, true)
  view.setUint16(32, (numChannels * bitsPerSample) / 8, true)
  view.setUint16(34, bitsPerSample, true)
  writeString(36, 'data')
  view.setUint32(40, dataLength, true)
  return header
}

// ─── Call Recording ──────────────────────────────────────────────────────────
// Saves full call recording (customer + agent audio) as a WAV file when the
// call ends. The recording is saved to upload/voice-recordings/ and a
// VoiceRecording DB record is created via the Hono worker API.

const RECORDINGS_DIR = resolve(import.meta.dir || __dirname || '.', '../../../upload/voice-recordings')
const MAX_RECORDING_SIZE = 100 * 1024 * 1024 // 100MB max recording

async function saveCallRecording(session: SessionState): Promise<void> {
  try {
    const sessionId = session.brainSessionId
    if (!sessionId) {
      console.log('[Recording] No brain session ID, skipping recording save')
      return
    }

    const customerChunks = session.customerRecordingBuffer
    const agentChunks = session.agentRecordingBuffer
    
    if (customerChunks.length === 0 && agentChunks.length === 0) {
      console.log('[Recording] No audio data recorded, skipping')
      return
    }

    // Calculate total size
    const customerSize = customerChunks.reduce((sum, buf) => sum + buf.byteLength, 0)
    const agentSize = agentChunks.reduce((sum, buf) => sum + buf.byteLength, 0)
    const totalPcmSize = customerSize + agentSize
    
    if (totalPcmSize > MAX_RECORDING_SIZE) {
      console.warn(`[Recording] Recording too large (${(totalPcmSize / 1024 / 1024).toFixed(1)}MB), skipping`)
      return
    }

    // Combine all PCM data (customer audio first, then agent audio interleaved would be
    // ideal but since they're at different sample rates, we save customer audio as the
    // primary recording and store agent audio separately)
    // For simplicity: concatenate customer PCM, then agent PCM (both at 48kHz 16-bit mono)
    // The customer audio IS the call from the customer's perspective.
    // Agent TTS audio is at a different sample rate (44100 or 24000) so we only save
    // customer mic audio as the primary recording.

    // Use customer audio as the main recording
    const pcmData = new Uint8Array(customerSize)
    let offset = 0
    for (const buf of customerChunks) {
      pcmData.set(new Uint8Array(buf), offset)
      offset += buf.byteLength
    }

    const sampleRate = session.clientSampleRate || 48000
    const wavHeader = createWavHeader(pcmData.byteLength, sampleRate, 1, 16)
    const wavBuffer = Buffer.concat([Buffer.from(wavHeader), Buffer.from(pcmData.buffer, pcmData.byteOffset, pcmData.byteLength)])

    // Ensure recordings directory exists
    if (!existsSync(RECORDINGS_DIR)) {
      mkdirSync(RECORDINGS_DIR, { recursive: true })
    }

    const fileName = `${sessionId}.wav`
    const filePath = resolve(RECORDINGS_DIR, fileName)
    writeFileSync(filePath, wavBuffer)

    const durationSeconds = (Date.now() - session.callStartTime) / 1000
    
    console.log(`[Recording] Saved call recording: ${fileName} (${(wavBuffer.byteLength / 1024).toFixed(1)}KB, ${durationSeconds.toFixed(1)}s)`)

    // Notify Hono worker to create VoiceRecording DB record
    try {
      const response = await fetch(`http://localhost:3002/api/voice/recording?XTransformPort=3002`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          filePath: `/voice-recordings/${fileName}`,
          durationSeconds,
          fileSizeBytes: wavBuffer.byteLength,
          sampleRate,
          channels: 1,
          format: 'wav',
          hasCustomerAudio: customerChunks.length > 0,
          hasAgentAudio: agentChunks.length > 0,
          metadata: JSON.stringify({
            customerAudioBytes: customerSize,
            agentAudioBytes: agentSize,
            provider: providerConfig.tts.primary,
            language: session.detectedLanguage,
          }),
        }),
      })
      if (response.ok) {
        console.log(`[Recording] DB record created for session ${sessionId}`)
      } else {
        console.warn(`[Recording] Failed to create DB record: ${response.status}`)
      }
    } catch (err) {
      console.warn(`[Recording] Failed to notify Hono worker:`, err instanceof Error ? err.message : String(err))
    }
  } catch (err) {
    console.error('[Recording] Error saving call recording:', err)
  }
}

function parseWav(wavBuffer: ArrayBuffer): { sampleRate: number; numChannels: number; bitsPerSample: number; pcmData: ArrayBuffer } {
  const view = new DataView(wavBuffer)
  let offset = 12
  let sampleRate = 24000
  let numChannels = 1
  let bitsPerSample = 16

  while (offset < wavBuffer.byteLength - 8) {
    const chunkId = String.fromCharCode(view.getUint8(offset), view.getUint8(offset + 1), view.getUint8(offset + 2), view.getUint8(offset + 3))
    const chunkSize = view.getUint32(offset + 4, true)
    if (chunkId === 'fmt ') {
      numChannels = view.getUint16(offset + 10, true)
      sampleRate = view.getUint32(offset + 12, true)
      bitsPerSample = view.getUint16(offset + 22, true)
      offset += 8 + chunkSize
    } else if (chunkId === 'data') {
      const pcmData = wavBuffer.slice(offset + 8, offset + 8 + chunkSize)
      return { sampleRate, numChannels, bitsPerSample, pcmData }
    } else {
      offset += 8 + chunkSize
    }
  }
  throw new Error('WAV: no data chunk found')
}

// ─── Bun Socket.IO Binary Helper ────────────────────────────────────────────

function toArrayBuffer(data: ArrayBuffer | Uint8Array | Buffer): ArrayBuffer {
  if (data instanceof ArrayBuffer) return data
  if (ArrayBuffer.isView(data)) {
    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
  }
  return new Uint8Array(data as unknown as ArrayLike<number>).buffer
}

// ─── VAD Utility ─────────────────────────────────────────────────────────────

function calculateRMS(rawData: ArrayBuffer | Uint8Array | Buffer): number {
  const buffer = toArrayBuffer(rawData)
  const view = new DataView(buffer)
  const sampleCount = Math.floor(buffer.byteLength / 2)
  if (sampleCount === 0) return 0
  let sum = 0
  for (let i = 0; i < sampleCount; i++) {
    const sample = view.getInt16(i * 2, true)
    sum += sample * sample
  }
  return Math.sqrt(sum / sampleCount)
}

function splitTextIntoChunks(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) return [text]
  const chunks: string[] = []
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text]
  let currentChunk = ''
  for (const sentence of sentences) {
    if ((currentChunk + sentence).length <= maxLength) { currentChunk += sentence }
    else { if (currentChunk) chunks.push(currentChunk.trim()); currentChunk = sentence }
  }
  if (currentChunk) chunks.push(currentChunk.trim())
  return chunks
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 11) + Date.now().toString(36)
}

// ─── Deepgram Streaming STT ──────────────────────────────────────────────────

function createDeepgramStream(sampleRate: number): {
  send: (audio: ArrayBuffer | Uint8Array | Buffer) => void
  onTranscript: (callback: (text: string, isFinal: boolean) => void) => void
  onSpeechStarted: (callback: () => void) => void
  onSpeechEnded: (callback: () => void) => void
  finalize: () => void
  close: () => void
  isReady: () => boolean
} {
  const transcriptCallbacks: Array<(text: string, isFinal: boolean) => void> = []
  const speechStartedCallbacks: Array<() => void> = []
  const speechEndedCallbacks: Array<() => void> = []
  let ready = false
  let ws: WebSocket | null = null
  let keepAliveInterval: ReturnType<typeof setInterval> | null = null

  const sttLanguage = getDeepgramSTTLanguage()
  console.log(`[Deepgram] Creating stream with config language=${providerConfig.language}, STT language=${sttLanguage}`)

  // ─── Deepgram STT Language Parameters ───
  // CRITICAL: Deepgram streaming STT does NOT support detect_language=true
  //   - detect_language only works for pre-recorded audio, NOT streaming
  //   - Setting detect_language=true with a language param OVERRIDES the language
  //
  // Language modes:
  //   "ar"  → language=ar (Arabic monolingual, supports 17 dialects including ar-AE)
  //   "en"  → language=en (English monolingual)
  //   "multi" → language=multi (multilingual: EN/ES/FR/DE/HI/RU/PT/JA/IT/NL — NO Arabic!)
  //
  // For UAE context where Arabic is primary:
  //   "auto" → language=ar (Arabic model also handles some English code-switching)
  //            Falls back to ZAI SDK if needed for pure English
  const params: Record<string, string> = {
    model: getDeepgramSttModel(),
    encoding: DEEPGRAM_ENCODING,
    sample_rate: String(sampleRate || getDeepgramSttSampleRate()),
    interim_results: 'true',
    punctuate: 'true',
    smart_format: 'true',
    vad_events: 'true',
    endpointing: String(getEndpointingMs()),
  }

  // Set language parameter based on STT language
  // IMPORTANT: Do NOT set detect_language=true — it doesn't work with streaming
  // and it OVERRIDES the language parameter when both are set
  // getDeepgramSTTLanguage() returns: "ar" for Arabic/auto-detect, "en" for English
  params.language = sttLanguage
  const url = `wss://api.deepgram.com/v1/listen?` + new URLSearchParams(params).toString()

  try {
    ws = new WebSocket(url, ['token', getDeepgramKey()])

    ws.addEventListener('open', () => {
      console.log('[Deepgram] WebSocket connected')
      ready = true
      // Keep alive every 5 seconds
      keepAliveInterval = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'KeepAlive' }))
        }
      }, 5000)
    })

    ws.addEventListener('message', (event) => {
      try {
        const msg = JSON.parse(event.data as string)
        if (msg.type === 'Results') {
          const transcript = msg.channel?.alternatives?.[0]?.transcript?.trim()
          if (transcript) {
            const isFinal = msg.is_final
            for (const cb of transcriptCallbacks) cb(transcript, isFinal)
          }
        } else if (msg.type === 'SpeechStarted') {
          for (const cb of speechStartedCallbacks) cb()
        } else if (msg.type === 'Metadata') {
          console.log('[Deepgram] Session metadata received')
        }
      } catch (e) {
        // Ignore parse errors
      }
    })

    ws.addEventListener('error', (event) => {
      console.error('[Deepgram] WebSocket error:', event)
      ready = false
    })

    ws.addEventListener('close', (event) => {
      console.log(`[Deepgram] WebSocket closed (code=${event.code})`)
      ready = false
      if (keepAliveInterval) { clearInterval(keepAliveInterval); keepAliveInterval = null }
    })
  } catch (err) {
    console.error('[Deepgram] Failed to create WebSocket:', err)
  }

  return {
    send: (audio) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(audio as any)
      }
    },
    onTranscript: (cb) => transcriptCallbacks.push(cb),
    onSpeechStarted: (cb) => speechStartedCallbacks.push(cb),
    onSpeechEnded: (cb) => speechEndedCallbacks.push(cb),
    finalize: () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        try { ws.send(JSON.stringify({ type: 'Finalize' })) } catch { /* ignore */ }
      }
    },
    close: () => {
      if (keepAliveInterval) { clearInterval(keepAliveInterval); keepAliveInterval = null }
      if (ws) {
        try {
          ws.send(JSON.stringify({ type: 'CloseStream' }))
        } catch { /* ignore */ }
        ws.close()
        ws = null
      }
      ready = false
    },
    isReady: () => ready,
  }
}

// ─── Cartesia Streaming TTS ──────────────────────────────────────────────────

function createCartesiaStream(): {
  synthesize: (text: string, contextId: string, isLast: boolean) => void
  onAudioChunk: (callback: (audioBytes: Uint8Array, contextId: string) => void) => void
  onDone: (callback: (contextId: string) => void) => void
  onError: (callback: (message: string) => void) => void
  cancel: (contextId: string) => void
  close: () => void
  isReady: () => boolean
  reconnect: () => void
} {
  const audioChunkCallbacks: Array<(audioBytes: Uint8Array, contextId: string) => void> = []
  const doneCallbacks: Array<(contextId: string) => void> = []
  const errorCallbacks: Array<(message: string) => void> = []
  let ready = false
  let ws: WebSocket | null = null
  let activeContextId: string | null = null
  // Track completed contexts to avoid cancelling them (causes "context ID does not exist" error)
  const completedContextIds = new Set<string>()
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let isClosed = false // Set to true when .close() is called explicitly

  function connect(): void {
    if (isClosed) return
    const url = `wss://api.cartesia.ai/tts/websocket?api_key=${getCartesiaKey()}&cartesia_version=${CARTESIA_VERSION}`
    try {
      ws = new WebSocket(url)

      ws.addEventListener('open', () => {
        console.log('[Cartesia] WebSocket connected')
        ready = true
        // Clear completed contexts on reconnect — old IDs are invalid on new connection
        completedContextIds.clear()
      })

      ws.addEventListener('message', (event) => {
        try {
          const msg = JSON.parse(event.data as string)
          switch (msg.type) {
            case 'chunk':
              const audioBytes = Buffer.from(msg.data, 'base64')
              for (const cb of audioChunkCallbacks) cb(audioBytes, msg.context_id)
              break
            case 'done':
              // Mark this context as completed so we don't try to cancel it later
              completedContextIds.add(msg.context_id)
              // Clean up old entries to prevent memory leak
              if (completedContextIds.size > 50) {
                const entries = Array.from(completedContextIds)
                for (let i = 0; i < entries.length - 20; i++) completedContextIds.delete(entries[i])
              }
              for (const cb of doneCallbacks) cb(msg.context_id)
              break
            case 'error':
              // Filter out "context ID does not exist" errors from cancel race conditions
              // These are harmless — the context already completed or was cancelled
              const errMsg = msg.message || ''
              if (errMsg.includes('context ID does not exist') || errMsg.includes('already been cancelled')) {
                console.warn(`[Cartesia] Benign cancel error (ignored): ${errMsg}`)
                // Do NOT propagate to errorCallbacks — this is not a real TTS failure
                return
              }
              console.error('[Cartesia] Error:', msg.message)
              for (const cb of errorCallbacks) cb(msg.message)
              break
          }
        } catch (e) {
          // Ignore parse errors
        }
      })

      ws.addEventListener('error', (event) => {
        console.error('[Cartesia] WebSocket error:', event)
        ready = false
      })

      ws.addEventListener('close', (event) => {
        console.log(`[Cartesia] WebSocket closed (code=${event.code})`)
        ready = false
        // Auto-reconnect after delay (unless explicitly closed)
        if (!isClosed) {
          console.log('[Cartesia] Scheduling auto-reconnect in 2s...')
          reconnectTimer = setTimeout(() => {
            if (!isClosed) {
              console.log('[Cartesia] Auto-reconnecting...')
              connect()
            }
          }, 2000)
        }
      })
    } catch (err) {
      console.error('[Cartesia] Failed to create WebSocket:', err)
      // Retry connection after delay
      if (!isClosed) {
        reconnectTimer = setTimeout(() => {
          if (!isClosed) connect()
        }, 3000)
      }
    }
  }

  // Initial connection
  connect()

  return {
    synthesize: (text, contextId, isLast) => {
      activeContextId = contextId
      // Remove from completed set since we're reusing or starting a new context
      completedContextIds.delete(contextId)
      if (ws && ws.readyState === WebSocket.OPEN) {
        // Auto-detect language from text content for Arabic support
        const detectedLang = detectTTSLanguage(text)
        // Override: if language config is explicitly 'ar' or 'en', use that instead
        const configLang = providerConfig.language
        const finalLang = configLang === 'ar' ? 'ar' : configLang === 'en' ? 'en' : detectedLang
        
        console.log(`[Cartesia] Synthesizing: lang=${finalLang}, text="${text.substring(0, 50)}..."`)
        ws.send(JSON.stringify({
          transcript: text,
          continue: !isLast,
          context_id: contextId,
          model_id: getCartesiaTtsModel(),
          voice: { mode: 'id', id: getCartesiaVoiceId(finalLang) },
          output_format: {
            container: 'raw',
            encoding: 'pcm_s16le',
            sample_rate: getCartesiaTtsSampleRate(),
          },
          language: finalLang,
          max_buffer_delay_ms: 0, // Lowest latency
        }))
      }
    },
    onAudioChunk: (cb) => audioChunkCallbacks.push(cb),
    onDone: (cb) => doneCallbacks.push(cb),
    onError: (cb) => errorCallbacks.push(cb),
    cancel: (contextId?: string) => {
      const targetContextId = contextId || activeContextId
      // Don't cancel contexts that have already completed — causes "context ID does not exist" error
      if (targetContextId && completedContextIds.has(targetContextId)) {
        console.log(`[Cartesia] Skipping cancel for completed context: ${targetContextId}`)
        activeContextId = null
        return
      }
      if (ws && ws.readyState === WebSocket.OPEN && targetContextId) {
        try {
          ws.send(JSON.stringify({ context_id: targetContextId, cancel: true }))
        } catch {
          // Ignore send errors on cancelled/closing WebSocket
        }
        activeContextId = null
      }
    },
    close: () => {
      isClosed = true
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
      if (ws) { ws.close(); ws = null }
      ready = false
    },
    isReady: () => ready,
    reconnect: () => {
      isClosed = false
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
      if (ws) { ws.close(); ws = null }
      ready = false
      connect()
    },
  }
}

// ─── STT Providers ────────────────────────────────────────────────────────────

async function zaiSTT(base64Audio: string): Promise<string> {
  return withRetry(async () => {
    const zai = await getZAI()
    const asrResponse = await zai.audio.asr.create({ file_base64: base64Audio })
    return asrResponse.text?.trim() || ''
  }, 'ZAI-STT')
}

async function cartesiaSTT(base64Audio: string): Promise<string> {
  // Cartesia does not provide an STT API endpoint.
  throw new Error('Cartesia STT is not supported. Please use ZAI or Deepgram for STT.')
}

// ─── TTS Providers ────────────────────────────────────────────────────────────

async function zaiTTS(text: string): Promise<{ pcmData: ArrayBuffer; sampleRate: number; numChannels: number; bitsPerSample: number }> {
  return withRetry(async () => {
    const zai = await getZAI()
    const ttsResponse = await zai.audio.tts.create({
      input: text,
      voice: 'tongtong',
      speed: 1.0,
      response_format: 'wav',
      stream: false,
    })
    const arrayBuffer = await ttsResponse.arrayBuffer()
    return parseWav(arrayBuffer)
  }, 'ZAI-TTS')
}

async function deepgramTTS(text: string): Promise<{ pcmData: ArrayBuffer; sampleRate: number }> {
  // Deepgram Aura/Aura-2 TTS supports: EN, ES, NL, FR, DE, IT, JA (7 languages)
  // Arabic is NOT supported — if Arabic text reaches here, it will fail at the API level.
  // The admin configures language-to-provider mapping (languageProviders) to route
  // Arabic text to a provider that supports it (e.g., Cartesia, Gemini, ZAI).
  // No hardcoded language checks — the admin decides which provider to use per language.
  return withRetry(async () => {
    console.log(`[DeepgramTTS] Synthesizing: text="${text.substring(0, 50)}..."`)
    // Deepgram TTS API requires model/encoding/sample_rate as URL query params,
    // and the body must contain ONLY { text } or { url } — mixing causes PAYLOAD_ERROR.
    const params = new URLSearchParams({
      model: getDeepgramTtsModel(),
      encoding: 'linear16',
      sample_rate: '24000',
    })
    const response = await fetch(`https://api.deepgram.com/v1/speak?${params.toString()}`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${getDeepgramTtsApiKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    })
    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      throw new Error(`Deepgram TTS API error: ${response.status} ${errorText}`)
    }
    const audioBuffer = await response.arrayBuffer()
    return { pcmData: audioBuffer, sampleRate: 24000 }
  }, 'Deepgram-TTS')
}

async function geminiTTS(text: string, voiceName?: string): Promise<ArrayBuffer> {
  // Gemini TTS supports 70+ languages including Arabic
  // Voice selection: Aoede/Fenrir for Arabic, Kore/Charon/Puck for English
  // All Gemini voices are multilingual — they auto-detect the input language
  const isArabic = containsArabic(text)
  const selectedVoice = voiceName || (isArabic ? 'Aoede' : 'Kore')
  console.log(`[GeminiTTS] lang=${isArabic ? 'ar' : 'en'}, voice=${selectedVoice}, text="${text.substring(0, 50)}..."`)

  // The Gemini proxy accepts auth via query param or Authorization: Bearer header.
  // Direct Google API requires x-goog-api-key header, but the proxy forwards
  // to Google from its own region, so we use ?key= query param for compatibility.
  const url = `${geminiBaseUrl}/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${encodeURIComponent(geminiApiKey)}`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: selectedVoice },
          },
        },
      },
    }),
  })
  if (!response.ok) {
    const errText = await response.text().catch(() => '')
    throw new Error(`Gemini TTS API error: ${response.status} ${errText}`)
  }
  const data = await response.json()
  const audioData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data
  if (!audioData) throw new Error('No audio data in Gemini TTS response')
  return Buffer.from(audioData, 'base64')
}

// ─── LLM Providers ────────────────────────────────────────────────────────────

async function zaiLLM(messages: Array<{ role: string; content: string }>): Promise<string> {
  return withRetry(async () => {
    const zai = await getZAI()
    const chatMessages = messages.map(m => ({
      role: m.role === 'assistant' ? 'assistant' as const : 'user' as const,
      content: m.content,
    }))
    const completion = await zai.chat.completions.create({
      messages: chatMessages,
    })
    return completion.choices?.[0]?.message?.content?.trim() || ''
  }, 'ZAI-LLM')
}

async function geminiLLM(messages: Array<{ role: string; content: string }>): Promise<string> {
  // Build conversation contents for Gemini API
  // System prompt is stored as an assistant message; user/assistant alternate
  // Find the system message — it's the first assistant message that starts with the base prompt
  // (We check for multiple language variants since smart language detection may change the prompt)
  const systemMessage = messages.find(m => m.role === 'assistant' && (
    m.content.startsWith('You are the central AI intelligence') ||
    m.content.startsWith('You are the AI assistant for the Ministry')
  ))
  const conversationMessages = systemMessage 
    ? messages.filter(m => m !== systemMessage) 
    : messages

  // Build conversation contents for Gemini
  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = []
  
  for (const msg of conversationMessages) {
    // Gemini uses 'user' and 'model' roles; our 'assistant' maps to 'model'
    const geminiRole = msg.role === 'assistant' ? 'model' : 'user'
    // Merge consecutive same-role messages (Gemini requires alternating roles)
    const lastEntry = contents[contents.length - 1]
    if (lastEntry && lastEntry.role === geminiRole) {
      lastEntry.parts[0].text += '\n' + msg.content
    } else {
      contents.push({ role: geminiRole, parts: [{ text: msg.content }] })
    }
  }

  // If no contents (shouldn't happen), create a minimal one
  if (contents.length === 0) {
    contents.push({ role: 'user', parts: [{ text: 'Hello' }] })
  }

  // Gemini requires the first content to be from 'user' role
  if (contents[0].role !== 'user') {
    contents.unshift({ role: 'user', parts: [{ text: 'Please respond.' }] })
  }

  const body: any = {
    contents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 2048,
    },
  }

  // Add system instruction if we have one
  if (systemMessage) {
    body.systemInstruction = {
      parts: [{ text: systemMessage.content }],
    }
  }

  const url = `${geminiBaseUrl}/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(geminiApiKey)}`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(`Gemini LLM API error: ${response.status} ${errorText}`)
  }

  const data = await response.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ''
  return text
}

/**
 * Call LLM with primary/fallback based on provider config.
 * Returns the response text, or throws if both providers fail.
 * 
 * KEEP as fallback — used when Smart Brain is unreachable.
 */
async function callLLMWithFallback(messages: Array<{ role: string; content: string }>): Promise<string> {
  const primary = providerConfig.llm.primary
  const fallback = providerConfig.llm.fallback

  // Try primary LLM
  try {
    console.log(`[VoiceAgent] LLM: trying primary=${primary}`)
    if (primary === 'zai') {
      const result = await zaiLLM(messages)
      markProviderRecovered('zai', 'llm')
      return result
    } else if (primary === 'gemini') {
      const result = await geminiLLM(messages)
      markProviderRecovered('gemini', 'llm')
      return result
    } else {
      console.warn(`[VoiceAgent] Unknown LLM provider: ${primary}, falling back`)
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.warn(`[VoiceAgent] Primary LLM (${primary}) failed: ${errMsg}`)
    logProviderError({
      provider: primary,
      category: 'llm',
      error: errMsg,
      fallbackUsed: fallback,
    })
  }

  // Try fallback LLM
  console.log(`[VoiceAgent] LLM: trying fallback=${fallback}`)
  if (fallback === 'zai') {
    return await zaiLLM(messages)
  } else if (fallback === 'gemini') {
    return await geminiLLM(messages)
  }

  throw new Error(`No LLM provider available (primary=${primary}, fallback=${fallback})`)
}

// ─── Smart Brain via BrainOrchestrator ──────────────────────────────────────────
// The Voice Agent calls the Hono worker's /api/ai/voice endpoint which uses
// BrainOrchestrator — the SAME Smart Brain that serves WhatsApp and Email.
// This ensures all channels share the same customer profiles, service rules,
// knowledge base, action execution, and conversation continuity.

const HONO_WORKER_URL = 'http://127.0.0.1:3002'

interface BrainResponse {
  response: string
  intent: string
  sentiment: number
  sessionId: string
  language: string
  conversationSessionId: string | null
  customerId: string | null
  provider: string
}

async function callSmartBrain(
  userText: string,
  session: SessionState,
  sender?: 'customer' | 'agent',
): Promise<{ text: string; customerId: string | null; conversationSessionId: string | null }> {
  const payload: Record<string, any> = {
    message: userText,
    sessionId: session.brainVoiceSessionId,
    language: session.detectedLanguage,
    aiMode: 'full_ai',
  }

  // If the message is from the agent/employer (typed via chat), pass sender info
  if (sender) {
    payload.sender = sender
  }

  // Send customer/session IDs if we have them from previous turns
  if (session.brainCustomerId) {
    payload.customerId = session.brainCustomerId
  }
  if (session.brainSessionId) {
    payload.conversationSessionId = session.brainSessionId
  }

  try {
    const response = await fetch(`${HONO_WORKER_URL}/api/ai/voice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      throw new Error(`Smart Brain HTTP ${response.status}: ${errorText}`)
    }

    const data = await response.json() as BrainResponse
    console.log(`[SmartBrain] Response: intent=${data.intent}, sentiment=${data.sentiment}, provider=${data.provider}`)

    return {
      text: data.response,
      customerId: data.customerId,
      conversationSessionId: data.conversationSessionId,
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error(`[SmartBrain] Failed: ${errMsg}`)
    throw err
  }
}

// ─── Session State ───────────────────────────────────────────────────────────

interface SessionState {
  audioBuffer: ArrayBuffer[]
  isSpeechActive: boolean
  lastSpeechTime: number
  speechStartTime: number
  consecutiveSilenceChunks: number
  bargeInDetectChunks: number
  isProcessing: boolean
  isTtsStreaming: boolean
  isClientPlaying: boolean
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
  isMuted: boolean
  clientSampleRate: number
  echoLevelSamples: number[]
  echoBaseline: number
  lastRmsValues: number[]
  isPotentialBargeIn: boolean
  potentialBargeInStartTime: number
  potentialBargeInAudioBuffer: ArrayBuffer[]
  potentialBargeInSilenceChunks: number
  ttsStartTime: number
  // Deepgram streaming STT
  deepgramStream: ReturnType<typeof createDeepgramStream> | null
  deepgramReady: boolean
  deepgramFinalTranscript: string
  deepgramInterimTranscript: string
  // Audio buffer for ZAI fallback when Deepgram STT quality is poor (multi mode)
  deepgramAudioBuffer: ArrayBuffer[]
  deepgramSpeechActive: boolean
  // Cartesia streaming TTS
  cartesiaStream: ReturnType<typeof createCartesiaStream> | null
  cartesiaReady: boolean
  // Speech endpointer debounce — accumulate is_final transcripts and wait for user to finish
  transcriptDebounceTimer: ReturnType<typeof setTimeout> | null
  accumulatedTranscript: string
  // TTS context tracking — for cancelling previous TTS when new one starts
  activeTtsContextId: string | null
  // ── Smart Language Detection ──
  // Tracks the detected language for this session, enabling dynamic
  // STT/TTS/LLM switching when the user changes language mid-conversation.
  detectedLanguage: string       // 'ar' | 'en' — the currently active detected language
  deepgramSTTLanguage: string    // the language currently configured for the Deepgram stream
  languageSwitchCount: number    // how many times the language has switched (for analytics)
  lastLanguageSwitchTime: number // timestamp of the last language switch
  // ── Smart Brain Integration ──
  // Tracks the customer/session IDs returned by BrainOrchestrator so that
  // subsequent voice turns are linked to the same customer and conversation
  // session as WhatsApp and Email.
  brainCustomerId: string | null  // Customer ID from BrainOrchestrator
  brainSessionId: string | null   // ConversationSession ID from BrainOrchestrator
  brainVoiceSessionId: string     // Voice session ID sent to BrainOrchestrator
  // ── Call Recording ──
  // Accumulates ALL customer mic PCM for the full call recording
  customerRecordingBuffer: ArrayBuffer[]
  // Accumulates ALL agent/AI TTS PCM for the full call recording
  agentRecordingBuffer: ArrayBuffer[]
  // Track call start time for duration calculation
  callStartTime: number
}

function createSessionState(): SessionState {
  return {
    audioBuffer: [],
    isSpeechActive: false,
    lastSpeechTime: 0,
    speechStartTime: 0,
    consecutiveSilenceChunks: 0,
    bargeInDetectChunks: 0,
    isProcessing: false,
    isTtsStreaming: false,
    isClientPlaying: false,
    conversationHistory: [],
    isMuted: false,
    clientSampleRate: SAMPLE_RATE_CLIENT,
    echoLevelSamples: [],
    echoBaseline: 0,
    lastRmsValues: [],
    isPotentialBargeIn: false,
    potentialBargeInStartTime: 0,
    potentialBargeInAudioBuffer: [],
    potentialBargeInSilenceChunks: 0,
    ttsStartTime: 0,
    deepgramStream: null,
    deepgramReady: false,
    deepgramFinalTranscript: '',
    deepgramInterimTranscript: '',
    deepgramAudioBuffer: [],
    deepgramSpeechActive: false,
    cartesiaStream: null,
    cartesiaReady: false,
    transcriptDebounceTimer: null,
    accumulatedTranscript: '',
    activeTtsContextId: null,
    // Smart language detection — defaults to the global config language, or 'ar' for multi mode
    detectedLanguage: providerConfig.language === 'en' ? 'en' : 'ar',
    deepgramSTTLanguage: getDeepgramSTTLanguage(),
    languageSwitchCount: 0,
    lastLanguageSwitchTime: 0,
    // Smart Brain integration — linked to same Brain as WhatsApp/Email
    brainCustomerId: null,
    brainSessionId: null,
    brainVoiceSessionId: `vc-${Date.now()}`,
    customerRecordingBuffer: [],
    agentRecordingBuffer: [],
    callStartTime: Date.now(),
  }
}

function getBargeInThreshold(session: SessionState): number {
  if (session.echoBaseline > 0) return Math.max(BARGE_IN_BASE_THRESHOLD, session.echoBaseline * BARGE_IN_ECHO_MULTIPLIER)
  return BARGE_IN_BASE_THRESHOLD
}

function isRmsSpike(session: SessionState, currentRms: number): boolean {
  if (session.lastRmsValues.length < 3) return false
  const recentAvg = session.lastRmsValues.slice(-3).reduce((a, b) => a + b, 0) / 3
  if (recentAvg < 50) return false
  return currentRms > recentAvg * BARGE_IN_RMS_SPIKE_RATIO
}

// ─── Determine active providers for a session ────────────────────────────────

function shouldUseDeepgram(): boolean {
  // Initialize Deepgram STT if it's the primary OR fallback AND we have a key.
  // Even when it's the fallback, having the WebSocket ready allows instant
  // failover if ZAI ASR doesn't work for the selected language.
  const isPrimary = providerConfig.stt.primary === 'deepgram'
  const isFallback = providerConfig.stt.fallback === 'deepgram'
  return (isPrimary || isFallback) && !!getDeepgramKey()
}

function shouldUseCartesia(): boolean {
  // Initialize Cartesia TTS if it's the primary OR fallback for any language AND we have a key.
  // The languageProviders may specify cartesia for Arabic/English even if the global
  // tts.primary is different. Always init if cartesia is used anywhere.
  const isGlobalPrimary = providerConfig.tts.primary === 'cartesia'
  const isGlobalFallback = providerConfig.tts.fallback === 'cartesia'
  const isLangProvider = Object.values(providerConfig.tts.languageProviders || {})
    .some(lp => lp.primary === 'cartesia' || lp.fallback === 'cartesia')
  return (isGlobalPrimary || isGlobalFallback || isLangProvider) && !!getCartesiaKey()
}

// ─── HTTP Server + Socket.IO ─────────────────────────────────────────────────
// Create HTTP server first (without callback), then attach Socket.IO,
// then add our API handler. This ensures Socket.IO's handler runs first
// (for WebSocket upgrades and client library), and our API handler runs
// after (for HTTP REST endpoints).

const httpServer = createServer()

// Attach Socket.IO to the HTTP server (adds its request listener first)
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 30000,
  pingInterval: 10000,
})

// Add our API request handler (runs AFTER Socket.IO's handler)
httpServer.on('request', (req, res) => {
  // Skip if headers already sent by Socket.IO
  if (res.headersSent) return
  
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  
  // Only handle /api/voice-providers routes
  if (!url.pathname.startsWith('/api/voice-providers')) return

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  // PUT /api/voice-providers/api-keys — Save API key
  if (req.method === 'PUT' && url.pathname === '/api/voice-providers/api-keys') {
    let body = ''
    req.on('data', (chunk: any) => { body += chunk })
    req.on('end', () => {
      if (res.headersSent) return
      try {
        const { provider, apiKey } = JSON.parse(body)
        if (!provider || !apiKey) {
          res.setHeader('Content-Type', 'application/json')
          res.writeHead(400)
          res.end(JSON.stringify({ error: 'Missing provider or apiKey' }))
          return
        }
        const validProviders = ['deepgram', 'cartesia']
        if (!validProviders.includes(provider)) {
          res.setHeader('Content-Type', 'application/json')
          res.writeHead(400)
          res.end(JSON.stringify({ error: `Invalid provider. Must be one of: ${validProviders.join(', ')}` }))
          return
        }
        const success = saveApiKey(provider, apiKey)
        if (success) {
          res.setHeader('Content-Type', 'application/json')
          res.writeHead(200)
          res.end(JSON.stringify({ success: true, provider, status: providerStatus }))
        } else {
          res.setHeader('Content-Type', 'application/json')
          res.writeHead(500)
          res.end(JSON.stringify({ error: 'Failed to save API key' }))
        }
      } catch (err) {
        res.setHeader('Content-Type', 'application/json')
        res.writeHead(400)
        res.end(JSON.stringify({ error: 'Invalid JSON body' }))
      }
    })
    return
  }

  // GET /api/voice-providers/errors — Provider error log for admin dashboard
  if (req.method === 'GET' && url.pathname === '/api/voice-providers/errors') {
    const limit = parseInt(url.searchParams.get('limit') || '50', 10)
    const activeOnly = url.searchParams.get('active') === 'true'
    const errors = activeOnly ? getActiveProviderErrors() : getProviderErrors(limit)
    res.setHeader('Content-Type', 'application/json')
    res.writeHead(200)
    res.end(JSON.stringify({
      errors,
      total: providerErrors.length,
      activeCount: providerErrors.filter(e => !e.resolved).length,
    }))
    return
  }

  // GET - return current config and status
  if (req.method === 'GET') {
    const responseData = {
      config: providerConfig,
      status: providerStatus,
      available: availableProviders,
      activeErrors: getActiveProviderErrors().length,
    }
    res.setHeader('Content-Type', 'application/json')
    res.writeHead(200)
    res.end(JSON.stringify(responseData))
    return
  }

  // PUT - update provider config
  if (req.method === 'PUT') {
    let body = ''
    req.on('data', (chunk: any) => { body += chunk })
    req.on('end', () => {
      // Double-check headers not sent (could happen with slow connections)
      if (res.headersSent) return
      try {
        const newConfig = JSON.parse(body)
        
        // Validate and update config
        if (newConfig.stt) {
          if (newConfig.stt.primary && VALID_STT_PROVIDERS.includes(newConfig.stt.primary)) {
            providerConfig.stt.primary = newConfig.stt.primary
          }
          if (newConfig.stt.fallback && VALID_STT_PROVIDERS.includes(newConfig.stt.fallback)) {
            providerConfig.stt.fallback = newConfig.stt.fallback
          }
        }
        if (newConfig.tts) {
          if (newConfig.tts.primary && VALID_TTS_PROVIDERS.includes(newConfig.tts.primary)) {
            providerConfig.tts.primary = newConfig.tts.primary
          }
          if (newConfig.tts.fallback && VALID_TTS_PROVIDERS.includes(newConfig.tts.fallback)) {
            providerConfig.tts.fallback = newConfig.tts.fallback
          }
          // Update language-specific TTS provider mapping (admin configurable)
          if (newConfig.tts.languageProviders && typeof newConfig.tts.languageProviders === 'object') {
            if (!providerConfig.tts.languageProviders) {
              providerConfig.tts.languageProviders = { ...DEFAULT_LANGUAGE_PROVIDERS }
            }
            for (const [lang, prov] of Object.entries(newConfig.tts.languageProviders)) {
              const p = prov as { primary?: string; fallback?: string }
              if (p.primary && VALID_TTS_PROVIDERS.includes(p.primary)) {
                if (!providerConfig.tts.languageProviders[lang]) {
                  providerConfig.tts.languageProviders[lang] = { primary: p.primary, fallback: p.fallback || 'deepgram' }
                } else {
                  providerConfig.tts.languageProviders[lang].primary = p.primary
                  if (p.fallback && VALID_TTS_PROVIDERS.includes(p.fallback)) {
                    providerConfig.tts.languageProviders[lang].fallback = p.fallback
                  }
                }
              }
            }
          }
        }
        if (newConfig.llm) {
          if (newConfig.llm.primary && VALID_LLM_PROVIDERS.includes(newConfig.llm.primary)) {
            providerConfig.llm.primary = newConfig.llm.primary
          }
          if (newConfig.llm.fallback && VALID_LLM_PROVIDERS.includes(newConfig.llm.fallback)) {
            providerConfig.llm.fallback = newConfig.llm.fallback
          }
        }
        // Update language setting
        if (newConfig.language && VALID_LANGUAGES.includes(newConfig.language)) {
          providerConfig.language = newConfig.language
        }

        // Update maxSpeechDuration with validation (min 5000, max 30000)
        if (typeof newConfig.maxSpeechDuration === 'number') {
          providerConfig.maxSpeechDuration = Math.min(30000, Math.max(5000, newConfig.maxSpeechDuration))
        }

        // Save to file
        saveProviderConfig()

        console.log(`[VoiceAgent] Provider config updated: STT=${providerConfig.stt.primary}/${providerConfig.stt.fallback}, TTS=${providerConfig.tts.primary}/${providerConfig.tts.fallback}, LLM=${providerConfig.llm.primary}/${providerConfig.llm.fallback}, maxSpeechDuration=${providerConfig.maxSpeechDuration}`)

        res.setHeader('Content-Type', 'application/json')
        res.writeHead(200)
        res.end(JSON.stringify({
          success: true,
          config: providerConfig,
        }))
      } catch (err) {
        res.setHeader('Content-Type', 'application/json')
        res.writeHead(400)
        res.end(JSON.stringify({ error: 'Invalid JSON body' }))
      }
    })
    return
  }

  // Method not allowed
  res.writeHead(405)
  res.end('Method Not Allowed')
})

httpServer.listen(PORT, () => {
  console.log(`[VoiceAgent] HTTP + Socket.IO server listening on port ${PORT}`)
  console.log(`[VoiceAgent] HTTP API available at /api/voice-providers`)
  console.log(`[VoiceAgent] Provider config: STT=${providerConfig.stt.primary}/${providerConfig.stt.fallback}, TTS=${providerConfig.tts.primary}/${providerConfig.tts.fallback}, LLM=${providerConfig.llm.primary}/${providerConfig.llm.fallback}, Language=${providerConfig.language}, maxSpeechDuration=${providerConfig.maxSpeechDuration}`)
  console.log(`[VoiceAgent] Provider status: Deepgram=${providerStatus.deepgram}, Cartesia=${providerStatus.cartesia}, ZAI=${providerStatus.zai}, GeminiProxy=${providerStatus.geminiProxy}`)
})

// ─── Socket.IO Connection Handler ────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log(`[VoiceAgent] Client connected: ${socket.id}`)
  const session = createSessionState()

  // Send provider status to client with full config (primary/fallback)
  socket.emit('provider-status', {
    stt: { primary: providerConfig.stt.primary, fallback: providerConfig.stt.fallback, active: shouldUseDeepgram() ? 'deepgram' : 'zai' },
    tts: { primary: providerConfig.tts.primary, fallback: providerConfig.tts.fallback, active: shouldUseCartesia() ? 'cartesia' : providerConfig.tts.primary },
    llm: { primary: providerConfig.llm.primary, fallback: providerConfig.llm.fallback, active: providerConfig.llm.primary },
    language: providerConfig.language,
    detectedLanguage: session.detectedLanguage, // Smart language detection initial state
  })

  socket.on('start-session', async (msg: { sampleRate?: number }) => {
    if (msg.sampleRate) session.clientSampleRate = msg.sampleRate

    // Initialize Deepgram streaming STT if primary STT is deepgram and key is available
    if (shouldUseDeepgram()) {
      try {
        const dgStream = createDeepgramStream(session.clientSampleRate)
        session.deepgramStream = dgStream

        // Handle transcripts from Deepgram — DEBOUNCED to avoid processing fragments
        // Deepgram sends is_final after each silence pause (determined by endpointing param).
        // A single utterance may produce multiple is_final events. We accumulate them
        // and only process when the debounce timer expires (user has truly stopped speaking).
        dgStream.onTranscript((text, isFinal) => {
          if (isFinal) {
            console.log(`[Deepgram] FINAL: "${text}"`)
            // Accumulate the final transcript
            session.accumulatedTranscript += (session.accumulatedTranscript ? ' ' : '') + text
            session.deepgramInterimTranscript = ''

            // Cancel any existing debounce timer — reset the wait
            if (session.transcriptDebounceTimer) {
              clearTimeout(session.transcriptDebounceTimer)
              session.transcriptDebounceTimer = null
            }

            // Start a new debounce timer — process when user stops speaking
            session.transcriptDebounceTimer = setTimeout(() => {
              session.transcriptDebounceTimer = null
              const fullText = session.accumulatedTranscript.trim()
              session.accumulatedTranscript = ''
              session.deepgramFinalTranscript = ''

              if (!fullText || session.isProcessing) return

              // ── Smart STT Fallback for "multi" (auto-detect) mode ──
              // When using Deepgram language=ar in multi mode, English speech
              // may produce garbled/poor transcripts. Detect this and try ZAI ASR.
              if (providerConfig.language === 'multi' && !containsArabic(fullText) && fullText.length < 20) {
                const audioBuffer = session.deepgramAudioBuffer
                session.deepgramAudioBuffer = []
                if (audioBuffer.length > 0 && providerConfig.stt.fallback === 'zai') {
                  console.log(`[VoiceAgent] Multi-mode: short English transcript "${fullText}" from Arabic model — trying ZAI ASR fallback`)
                  processTextFromSTTWithZaiFallback(fullText, audioBuffer)
                  return
                }
              }

              console.log(`[Deepgram] Debounce complete — processing: "${fullText}"`)
              processTextFromSTT(fullText)
            }, DEBOUNCE_DELAY_MS)
          } else {
            session.deepgramInterimTranscript = text
            // Send interim transcript to client for real-time feedback
            socket.emit('transcript-interim', { text })
          }
        })

        dgStream.onSpeechStarted(() => {
          if (!session.isSpeechActive) {
            session.isSpeechActive = true
            session.deepgramSpeechActive = true
            session.speechStartTime = Date.now()
            session.deepgramAudioBuffer = [] // Reset audio buffer for new speech
            socket.emit('user-speech-started')
          }
        })

        // Wait for connection (up to 3 seconds)
        let retries = 15
        while (!dgStream.isReady() && retries > 0) {
          await new Promise(r => setTimeout(r, 200))
          retries--
        }
        session.deepgramReady = dgStream.isReady()
        console.log(`[VoiceAgent] Deepgram STT ${session.deepgramReady ? 'ready' : 'NOT ready'}`)
        
        // If Deepgram failed to connect, fall back to local VAD
        if (!session.deepgramReady && providerConfig.stt.fallback === 'zai') {
          console.log('[VoiceAgent] Deepgram failed, will use local VAD + ZAI ASR as fallback')
        }
      } catch (err) {
        console.error('[VoiceAgent] Deepgram init failed:', err)
        session.deepgramReady = false
      }
    } else {
      console.log(`[VoiceAgent] STT: using local VAD + ${providerConfig.stt.primary === 'zai' ? 'ZAI ASR' : providerConfig.stt.primary} (Deepgram not primary or no key)`)
    }

    // Initialize Cartesia streaming TTS if primary TTS is cartesia and key is available
    if (shouldUseCartesia()) {
      try {
        const cartStream = createCartesiaStream()
        session.cartesiaStream = cartStream

        cartStream.onAudioChunk((audioBytes, contextId) => {
          if (!session.isTtsStreaming || isPlaybackInterruptedRef) return
          
          // Send audio format info on first chunk of context
          socket.emit('agent-audio-format', {
            sampleRate: getCartesiaTtsSampleRate(),
            numChannels: 1,
            bitsPerSample: 16,
          })

          // Send audio in chunks
          let offset = 0
          while (offset < audioBytes.byteLength && session.isTtsStreaming) {
            const end = Math.min(offset + PCM_SEND_CHUNK_SIZE, audioBytes.byteLength)
            const chunk = audioBytes.slice(offset, end)
            session.agentRecordingBuffer.push(chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength))
            socket.emit('agent-audio', chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength))
            const rms = calculateRMS(chunk)
            const level = Math.min(1, rms / 3000)
            socket.emit('audio-level', { level })
            offset = end
          }
        })

        cartStream.onDone((contextId) => {
          // Check if all contexts are done
          // For now, we handle this in the streamTtsToClient function
        })

        cartStream.onError((message) => {
          console.error('[Cartesia] TTS Error:', message)
          logProviderError({
            provider: 'cartesia',
            category: 'tts',
            error: message,
            sessionId: socket.id,
            fallbackUsed: providerConfig.tts.fallback,
          })
          // Note: we don't emit this error to the customer — admin-only via error log
        })

        // Wait for Cartesia WebSocket connection with proper retry logic
        // (500ms is often not enough — Cartesia can take 1-3s to establish WebSocket)
        let cartesiaRetries = 15 // 15 × 200ms = 3s max wait
        while (!cartStream.isReady() && cartesiaRetries > 0) {
          await new Promise(r => setTimeout(r, 200))
          cartesiaRetries--
        }
        session.cartesiaReady = cartStream.isReady()
        console.log(`[VoiceAgent] Cartesia TTS ${session.cartesiaReady ? 'ready' : 'NOT ready'} (waited ${(15 - cartesiaRetries) * 200}ms)`)
        if (session.cartesiaReady) {
          markProviderRecovered('cartesia', 'tts')
        }
      } catch (err) {
        console.error('[VoiceAgent] Cartesia init failed:', err)
        session.cartesiaReady = false
      }
    } else {
      console.log(`[VoiceAgent] TTS: using ${providerConfig.tts.primary} (Cartesia not primary or no key)`)
    }

    socket.emit('session-started')
    console.log(`[VoiceAgent] Session started for ${socket.id} (sampleRate=${session.clientSampleRate}, dg=${session.deepgramReady}, cart=${session.cartesiaReady})`)
  })

  socket.on('update-sample-rate', (msg: { sampleRate: number }) => {
    if (msg.sampleRate) session.clientSampleRate = msg.sampleRate
  })

  // Track playback interruption state outside of session for Cartesia callback
  let isPlaybackInterruptedRef = false

  socket.on('audio-data', (data: ArrayBuffer | Uint8Array | Buffer) => {
    if (session.isMuted) return
    const buffer = toArrayBuffer(data)
    // Record customer mic audio for call recording
    session.customerRecordingBuffer.push(buffer)
    const rms = calculateRMS(buffer)
    const now = Date.now()

    // Forward audio to Deepgram if streaming STT is active
    if (session.deepgramReady && session.deepgramStream) {
      session.deepgramStream.send(buffer)
      
      // Buffer audio for potential ZAI ASR fallback (multi-mode English detection)
      // Only buffer during active speech, and limit buffer size
      if (session.isSpeechActive || session.deepgramSpeechActive) {
        session.deepgramAudioBuffer.push(buffer)
        // Limit buffer to ~10 seconds of audio at 48kHz 16-bit mono = ~960KB
        const maxBufferSize = 960 * 1024
        const totalSize = session.deepgramAudioBuffer.reduce((sum, b) => sum + b.byteLength, 0)
        if (totalSize > maxBufferSize) {
          // Remove oldest chunks
          let removedSize = 0
          while (session.deepgramAudioBuffer.length > 1 && removedSize < totalSize - maxBufferSize) {
            removedSize += session.deepgramAudioBuffer.shift()!.byteLength
          }
        }
      }
      
      if (session.isSpeechActive && session.speechStartTime > 0) {
        const speechDuration = now - session.speechStartTime
        if (speechDuration > (providerConfig.maxSpeechDuration || MAX_SPEECH_DURATION)) {
          console.log(`[Deepgram] Forcing finalize due to max duration (${speechDuration}ms)`)
          session.deepgramStream.finalize()
          session.isSpeechActive = false
          session.speechStartTime = 0
          // Immediately process any accumulated text — don't wait for debounce
          if (session.transcriptDebounceTimer) {
            clearTimeout(session.transcriptDebounceTimer)
            session.transcriptDebounceTimer = null
          }
          const fullText = session.accumulatedTranscript.trim()
          session.accumulatedTranscript = ''
          session.deepgramFinalTranscript = ''
          if (fullText && !session.isProcessing) {
            console.log(`[Deepgram] Max duration reached — processing accumulated: "${fullText}"`)
            processTextFromSTT(fullText)
          }
        }
      }

      // When using Deepgram streaming, we rely on its endpointing
      // But still do barge-in detection for echo suppression
      if (session.isClientPlaying) {
        session.lastRmsValues.push(rms)
        if (session.lastRmsValues.length > 10) session.lastRmsValues = session.lastRmsValues.slice(-10)

        const bargeInThreshold = getBargeInThreshold(session)
        const ttsElapsed = now - session.ttsStartTime
        const inGracePeriod = ttsElapsed < TTS_GRACE_PERIOD_MS

        if (rms < bargeInThreshold) {
          session.echoLevelSamples.push(rms)
          if (session.echoLevelSamples.length > 50) session.echoLevelSamples = session.echoLevelSamples.slice(-50)
          session.echoBaseline = session.echoLevelSamples.reduce((a, b) => a + b, 0) / session.echoLevelSamples.length
        }

        const aboveThreshold = rms > bargeInThreshold
        const spikeDetected = isRmsSpike(session, rms)
        const isUserSpeech = aboveThreshold || spikeDetected
        const isActionable = inGracePeriod ? (aboveThreshold && spikeDetected) : isUserSpeech

        if (session.isPotentialBargeIn) {
          if (isActionable) {
            session.potentialBargeInSilenceChunks = 0
            const potentialDuration = now - session.potentialBargeInStartTime
            if (potentialDuration >= BARGE_IN_CONFIRM_DURATION_MS) {
              console.log(`[VAD] BARGE-IN CONFIRMED`)
              session.isTtsStreaming = false
              session.isClientPlaying = false
              session.isPotentialBargeIn = false
              isPlaybackInterruptedRef = true
              // Cancel Cartesia context
              if (session.cartesiaReady && session.cartesiaStream) {
                session.cartesiaStream.cancel()
              }
              session.bargeInDetectChunks = 0
              socket.emit('agent-speaking-interrupted')
              socket.emit('audio-level', { level: 0 })
              // Clear Deepgram transcript buffer and debounce timer to avoid processing old audio
              session.deepgramFinalTranscript = ''
              session.deepgramInterimTranscript = ''
              session.accumulatedTranscript = ''
              if (session.transcriptDebounceTimer) {
                clearTimeout(session.transcriptDebounceTimer)
                session.transcriptDebounceTimer = null
              }
            }
          } else {
            session.potentialBargeInSilenceChunks++
            if (session.potentialBargeInSilenceChunks >= BARGE_IN_CANCEL_SILENCE_CHUNKS) {
              session.isPotentialBargeIn = false
              session.potentialBargeInSilenceChunks = 0
              session.bargeInDetectChunks = 0
            }
          }
          return
        }

        if (isActionable) {
          session.bargeInDetectChunks++
          if (session.bargeInDetectChunks >= BARGE_IN_DETECT_CHUNKS) {
            session.isPotentialBargeIn = true
            session.potentialBargeInStartTime = now
            session.potentialBargeInSilenceChunks = 0
          }
        } else {
          if (session.bargeInDetectChunks > 0) session.bargeInDetectChunks = 0
        }

        if (session.isClientPlaying) return
      }
      return // Deepgram handles VAD, no need for local VAD
    }

    // ── Fallback: Local VAD (when Deepgram not available or not primary) ──
    session.lastRmsValues.push(rms)
    if (session.lastRmsValues.length > 10) session.lastRmsValues = session.lastRmsValues.slice(-10)

    // ── Echo suppression + barge-in ──
    if (session.isClientPlaying) {
      const bargeInThreshold = getBargeInThreshold(session)
      const ttsElapsed = now - session.ttsStartTime
      const inGracePeriod = ttsElapsed < TTS_GRACE_PERIOD_MS

      if (rms < bargeInThreshold) {
        session.echoLevelSamples.push(rms)
        if (session.echoLevelSamples.length > 50) session.echoLevelSamples = session.echoLevelSamples.slice(-50)
        session.echoBaseline = session.echoLevelSamples.reduce((a, b) => a + b, 0) / session.echoLevelSamples.length
      }

      const aboveThreshold = rms > bargeInThreshold
      const spikeDetected = isRmsSpike(session, rms)
      const isUserSpeech = aboveThreshold || spikeDetected
      const isActionable = inGracePeriod ? (aboveThreshold && spikeDetected) : isUserSpeech

      if (session.isPotentialBargeIn) {
        if (isActionable) {
          session.potentialBargeInAudioBuffer.push(buffer)
          session.potentialBargeInSilenceChunks = 0
          const potentialDuration = now - session.potentialBargeInStartTime
          if (potentialDuration >= BARGE_IN_CONFIRM_DURATION_MS) {
            console.log(`[VAD] BARGE-IN CONFIRMED`)
            session.isTtsStreaming = false
            session.isClientPlaying = false
            session.isPotentialBargeIn = false
            isPlaybackInterruptedRef = true
            session.isSpeechActive = false
            session.audioBuffer = []
            session.consecutiveSilenceChunks = 0
            session.bargeInDetectChunks = 0
            socket.emit('agent-speaking-interrupted')
            socket.emit('audio-level', { level: 0 })
            session.isSpeechActive = true
            session.speechStartTime = session.potentialBargeInStartTime
            session.lastSpeechTime = now
            session.audioBuffer = [...session.potentialBargeInAudioBuffer, buffer]
            session.potentialBargeInAudioBuffer = []
            socket.emit('user-speech-started')
          }
        } else {
          session.potentialBargeInSilenceChunks++
          session.potentialBargeInAudioBuffer.push(buffer)
          if (session.potentialBargeInSilenceChunks >= BARGE_IN_CANCEL_SILENCE_CHUNKS) {
            session.isPotentialBargeIn = false
            session.potentialBargeInAudioBuffer = []
            session.potentialBargeInSilenceChunks = 0
            session.bargeInDetectChunks = 0
          }
        }
        return
      }

      if (isActionable) {
        session.bargeInDetectChunks++
        if (session.bargeInDetectChunks >= BARGE_IN_DETECT_CHUNKS) {
          session.isPotentialBargeIn = true
          session.potentialBargeInStartTime = now
          session.potentialBargeInAudioBuffer = [buffer]
          session.potentialBargeInSilenceChunks = 0
        }
      } else {
        if (session.bargeInDetectChunks > 0) session.bargeInDetectChunks = 0
      }

      if (session.isClientPlaying) return
    }

    // ── Normal VAD ──
    if (session.isSpeechActive && session.speechStartTime > 0) {
      const speechDuration = now - session.speechStartTime
      if (speechDuration > (providerConfig.maxSpeechDuration || MAX_SPEECH_DURATION)) {
        endSpeech('max duration')
        return
      }
    }

    if (rms > VAD_ENERGY_THRESHOLD) {
      if (!session.isSpeechActive) {
        session.isSpeechActive = true
        session.speechStartTime = now
        socket.emit('user-speech-started')
      }
      session.lastSpeechTime = now
      session.consecutiveSilenceChunks = 0
      session.audioBuffer.push(buffer)
    } else if (session.isSpeechActive) {
      session.audioBuffer.push(buffer)
      session.consecutiveSilenceChunks++
      if (session.consecutiveSilenceChunks >= VAD_CONSECUTIVE_SILENCE_CHUNKS) {
        endSpeech('silence detected')
      }
    }
  })

  // ── Cancel any ongoing TTS playback ──
  // Called before starting new TTS to ensure the previous response is interrupted.
  // This handles the case where the user speaks while the agent is still talking,
  // or when a new LLM response comes in while the previous TTS is still playing.
  function cancelOngoingTTS() {
    if (session.isTtsStreaming || session.isClientPlaying) {
      console.log('[VoiceAgent] Cancelling ongoing TTS playback for new response')
      session.isTtsStreaming = false
      session.isClientPlaying = false
      isPlaybackInterruptedRef = true
      // Cancel Cartesia TTS context if active
      if (session.cartesiaReady && session.cartesiaStream) {
        session.cartesiaStream.cancel()
      }
      session.activeTtsContextId = null
      socket.emit('agent-speaking-interrupted')
      socket.emit('audio-level', { level: 0 })
    }
  }

  // ── Process text from STT (works for both Deepgram and local VAD) ──
  async function processTextFromSTT(userText: string) {
    if (session.isProcessing || !userText) return

    // Cancel any ongoing TTS before processing new speech
    cancelOngoingTTS()

    session.isProcessing = true
    // Clear audio buffer after processing (no longer needed for fallback)
    session.deepgramAudioBuffer = []

    try {
      console.log(`[VoiceAgent] STT: "${userText}"`)
      
      // ── Smart Language Detection ──
      // Detect language from the user's text and switch pipeline if needed
      await handleLanguageDetection(session, userText, socket)
      
      socket.emit('transcript', { id: generateId(), role: 'user', text: userText })

      session.conversationHistory.push({ role: 'user', content: userText })
      if (session.conversationHistory.length > MAX_HISTORY) session.conversationHistory = session.conversationHistory.slice(-MAX_HISTORY)

      socket.emit('agent-thinking')

      // ═══════════════════════════════════════════════════════════════
      // ║  SMART BRAIN — Same Brain as WhatsApp and Email               ║
      // ═══════════════════════════════════════════════════════════════
      // Primary: Call BrainOrchestrator via /api/ai/voice
      // Fallback: Use direct LLM (callLLMWithFallback) if Brain is down
      let agentText = ''

      try {
        const brainResult = await callSmartBrain(userText, session)
        agentText = brainResult.text

        // Update session with Brain-returned IDs for continuity
        if (brainResult.customerId) session.brainCustomerId = brainResult.customerId
        if (brainResult.conversationSessionId) session.brainSessionId = brainResult.conversationSessionId

        console.log(`[SmartBrain] Voice response (lang=${session.detectedLanguage}): "${agentText.substring(0, 100)}..."`)
      } catch (brainErr) {
        // Fallback: Use direct LLM if Smart Brain is unreachable
        console.warn(`[VoiceAgent] Smart Brain unavailable, falling back to direct LLM: ${brainErr instanceof Error ? brainErr.message : brainErr}`)
        const messages = [{ role: 'assistant' as const, content: getSystemPrompt(session.detectedLanguage) }, ...session.conversationHistory]
        agentText = await callLLMWithFallback(messages)
        console.log(`[VoiceAgent] Fallback LLM response (lang=${session.detectedLanguage}): "${agentText.substring(0, 100)}..."`)
      }

      if (!agentText) { session.isProcessing = false; return }

      session.conversationHistory.push({ role: 'assistant', content: agentText })
      if (session.conversationHistory.length > MAX_HISTORY) session.conversationHistory = session.conversationHistory.slice(-MAX_HISTORY)

      socket.emit('transcript', { id: generateId(), role: 'agent', text: agentText })

      // TTS — streamTtsToClient already uses detectTTSLanguage() internally,
      // so Arabic text will automatically route to Arabic-capable TTS providers
      await streamTtsToClient(agentText)
    } catch (error) {
      console.error('[VoiceAgent] Processing error:', error)
      socket.emit('error', { message: error instanceof Error ? error.message : 'Processing failed' })
    } finally {
      session.isProcessing = false
    }
  }

  // ── Process STT with ZAI ASR fallback (for multi-mode English detection) ──
  // When Deepgram's Arabic model returns a short English-only transcript that
  // looks garbled, we try ZAI ASR with the buffered audio. If ZAI gives a
  // better result, we use it instead.
  async function processTextFromSTTWithZaiFallback(deepgramText: string, audioBuffers: ArrayBuffer[]) {
    if (session.isProcessing) return

    // Cancel any ongoing TTS before processing new speech
    cancelOngoingTTS()

    session.isProcessing = true

    try {
      // Try ZAI ASR as fallback
      let zaiText = ''
      try {
        const totalLength = audioBuffers.reduce((sum, buf) => sum + buf.byteLength, 0)
        const pcmData = new Uint8Array(totalLength)
        let offset = 0
        for (const buf of audioBuffers) { pcmData.set(new Uint8Array(buf), offset); offset += buf.byteLength }

        const wavSampleRate = session.clientSampleRate || SAMPLE_RATE_CLIENT
        const wavHeader = createWavHeader(pcmData.length, wavSampleRate)
        const wavBuffer = new Uint8Array(44 + pcmData.length)
        wavBuffer.set(new Uint8Array(wavHeader), 0)
        wavBuffer.set(pcmData, 44)

        const base64Audio = Buffer.from(wavBuffer).toString('base64')
        zaiText = await zaiSTT(base64Audio)
        console.log(`[VoiceAgent] ZAI ASR fallback: "${zaiText}" (Deepgram was: "${deepgramText}")`)
      } catch (err) {
        console.warn('[VoiceAgent] ZAI ASR fallback failed:', err instanceof Error ? err.message : err)
      }

      // Use ZAI result if it's longer/better, otherwise use Deepgram
      const bestText = zaiText.length > deepgramText.length ? zaiText : deepgramText
      if (!bestText.trim()) { session.isProcessing = false; return }

      // ── Smart Language Detection ──
      await handleLanguageDetection(session, bestText, socket)

      socket.emit('transcript', { id: generateId(), role: 'user', text: bestText })

      session.conversationHistory.push({ role: 'user', content: bestText })
      if (session.conversationHistory.length > MAX_HISTORY) session.conversationHistory = session.conversationHistory.slice(-MAX_HISTORY)

      socket.emit('agent-thinking')

      // ═══════════════════════════════════════════════════════════════
      // ║  SMART BRAIN — Same Brain as WhatsApp and Email               ║
      // ═══════════════════════════════════════════════════════════════
      let agentText = ''

      try {
        const brainResult = await callSmartBrain(bestText, session)
        agentText = brainResult.text

        // Update session with Brain-returned IDs for continuity
        if (brainResult.customerId) session.brainCustomerId = brainResult.customerId
        if (brainResult.conversationSessionId) session.brainSessionId = brainResult.conversationSessionId

        console.log(`[SmartBrain] Voice response (lang=${session.detectedLanguage}): "${agentText.substring(0, 100)}..."`)
      } catch (brainErr) {
        // Fallback: Use direct LLM if Smart Brain is unreachable
        console.warn(`[VoiceAgent] Smart Brain unavailable (ZAI fallback), using direct LLM: ${brainErr instanceof Error ? brainErr.message : brainErr}`)
        const messages = [{ role: 'assistant' as const, content: getSystemPrompt(session.detectedLanguage) }, ...session.conversationHistory]
        agentText = await callLLMWithFallback(messages)
        console.log(`[VoiceAgent] Fallback LLM response (lang=${session.detectedLanguage}): "${agentText.substring(0, 100)}..."`)
      }

      if (!agentText) { session.isProcessing = false; return }

      session.conversationHistory.push({ role: 'assistant', content: agentText })
      if (session.conversationHistory.length > MAX_HISTORY) session.conversationHistory = session.conversationHistory.slice(-MAX_HISTORY)

      socket.emit('transcript', { id: generateId(), role: 'agent', text: agentText })

      await streamTtsToClient(agentText)
    } catch (error) {
      console.error('[VoiceAgent] Processing error (ZAI fallback):', error)
      socket.emit('error', { message: error instanceof Error ? error.message : 'Processing failed' })
    } finally {
      session.isProcessing = false
    }
  }

  // ── Local VAD: end speech and process ──
  function endSpeech(reason: string) {
    if (!session.isSpeechActive) return
    const duration = Date.now() - session.speechStartTime
    console.log(`[VAD] Speech ENDED (${reason}, duration=${duration}ms, chunks=${session.audioBuffer.length})`)
    session.isSpeechActive = false
    session.consecutiveSilenceChunks = 0
    processLocalVADSpeech()
  }

  // ── Process speech using local VAD (when Deepgram not primary/available) ──
  async function processLocalVADSpeech() {
    if (session.isProcessing) return
    if (session.audioBuffer.length === 0) return
    session.isProcessing = true

    try {
      const totalLength = session.audioBuffer.reduce((sum, buf) => sum + buf.byteLength, 0)
      const pcmData = new Uint8Array(totalLength)
      let offset = 0
      for (const buf of session.audioBuffer) { pcmData.set(new Uint8Array(buf), offset); offset += buf.byteLength }
      session.audioBuffer = []

      console.log(`[VoiceAgent] Processing speech: ${pcmData.length} bytes`)

      const wavSampleRate = session.clientSampleRate || SAMPLE_RATE_CLIENT
      const wavHeader = createWavHeader(pcmData.length, wavSampleRate)
      const wavBuffer = new Uint8Array(44 + pcmData.length)
      wavBuffer.set(new Uint8Array(wavHeader), 0)
      wavBuffer.set(pcmData, 44)

      const base64Audio = Buffer.from(wavBuffer).toString('base64')

      // STT with primary/fallback based on config
      let userText = ''
      const sttPrimary = providerConfig.stt.primary
      const sttFallback = providerConfig.stt.fallback

      try {
        console.log(`[VoiceAgent] STT: trying primary=${sttPrimary}`)
        if (sttPrimary === 'zai') {
          userText = await zaiSTT(base64Audio)
        } else if (sttPrimary === 'cartesia') {
          userText = await cartesiaSTT(base64Audio)
        } else if (sttPrimary === 'deepgram') {
          // Deepgram streaming should have been used; if we're here it means
          // Deepgram wasn't available, so fall through to fallback
          console.warn('[VoiceAgent] Deepgram primary not available for batch STT, using fallback')
        }
      } catch (err) {
        console.warn(`[VoiceAgent] Primary STT (${sttPrimary}) failed: ${err instanceof Error ? err.message : err}`)
      }

      // If primary failed or returned empty, try fallback
      if (!userText && sttFallback) {
        console.log(`[VoiceAgent] STT: trying fallback=${sttFallback}`)
        if (sttFallback === 'zai') {
          userText = await zaiSTT(base64Audio)
        } else if (sttFallback === 'cartesia') {
          userText = await cartesiaSTT(base64Audio)
        }
      }

      if (!userText) { session.isProcessing = false; return }

      await processTextFromSTT(userText)
    } catch (error) {
      console.error('[VoiceAgent] Processing error:', error)
      socket.emit('error', { message: error instanceof Error ? error.message : 'Processing failed' })
      session.isProcessing = false
    }
  }

  // ── TTS Streaming with language-based provider selection ──
  // The admin configures language-to-provider mapping via languageProviders.
  // When text is Arabic, it routes to the Arabic-configured provider (e.g., Cartesia/Gemini)
  // instead of Deepgram (which doesn't support Arabic). No hardcoded routing — admin decides.
  async function streamTtsToClient(text: string) {
    session.isTtsStreaming = true
    session.isClientPlaying = true
    session.bargeInDetectChunks = 0
    session.echoLevelSamples = []
    session.isPotentialBargeIn = false
    session.potentialBargeInAudioBuffer = []
    session.potentialBargeInSilenceChunks = 0
    session.ttsStartTime = Date.now()
    isPlaybackInterruptedRef = false
    socket.emit('agent-speaking-start')

    try {
      // Detect language and get language-specific TTS providers
      const lang = getTTSLanguage(text)
      const { primary: ttsPrimary, fallback: ttsFallback } = getTTSProvidersForLanguage(lang)
      console.log(`[VoiceAgent] TTS: lang=${lang}, primary=${ttsPrimary}, fallback=${ttsFallback}`)

      // Sync Cartesia ready state with actual WebSocket state
      const isCartesiaActuallyReady = session.cartesiaStream?.isReady() ?? false
      if (session.cartesiaReady !== isCartesiaActuallyReady) {
        session.cartesiaReady = isCartesiaActuallyReady
        console.log(`[VoiceAgent] Cartesia ready state synced: ${isCartesiaActuallyReady}`)
      }

      // Try to reconnect Cartesia if it's not ready but should be used
      if (ttsPrimary === 'cartesia' && !isCartesiaActuallyReady && session.cartesiaStream) {
        console.log('[VoiceAgent] Cartesia not ready — attempting reconnect...')
        session.cartesiaStream.reconnect()
        // Wait up to 3s for reconnection
        let retries = 15
        while (!session.cartesiaStream.isReady() && retries > 0) {
          await new Promise(r => setTimeout(r, 200))
          retries--
        }
        session.cartesiaReady = session.cartesiaStream.isReady()
        if (session.cartesiaReady) {
          console.log('[VoiceAgent] Cartesia reconnected successfully')
        } else {
          console.warn('[VoiceAgent] Cartesia reconnect failed, using fallback')
        }
      }
      // Also try reconnect if fallback is cartesia and not ready
      if (ttsFallback === 'cartesia' && !isCartesiaActuallyReady && session.cartesiaStream) {
        console.log('[VoiceAgent] Cartesia (fallback) not ready — attempting reconnect...')
        session.cartesiaStream.reconnect()
        let retries = 10
        while (!session.cartesiaStream.isReady() && retries > 0) {
          await new Promise(r => setTimeout(r, 200))
          retries--
        }
        session.cartesiaReady = session.cartesiaStream.isReady()
      }

      // Try primary TTS provider (language-specific)
      try {
        console.log(`[VoiceAgent] TTS: trying primary=${ttsPrimary} (lang=${lang})`)
        if (ttsPrimary === 'cartesia' && session.cartesiaReady && session.cartesiaStream) {
          await streamCartesiaTTS(text)
          markProviderRecovered('cartesia', 'tts')
        } else if (ttsPrimary === 'deepgram') {
          await streamDeepgramTTS(text)
          markProviderRecovered('deepgram', 'tts')
        } else if (ttsPrimary === 'zai') {
          await streamZAITTS(text)
          markProviderRecovered('zai', 'tts')
        } else if (ttsPrimary === 'gemini') {
          await streamGeminiTTS(text)
          markProviderRecovered('gemini', 'tts')
        } else if (ttsPrimary === 'cartesia') {
          // Cartesia was primary but not ready - fall through to fallback
          console.warn('[VoiceAgent] Cartesia primary but not ready, using fallback')
          logProviderError({
            provider: 'cartesia',
            category: 'tts',
            error: 'Cartesia WebSocket not ready in time (connection timeout)',
            sessionId: socket.id,
            fallbackUsed: ttsFallback,
          })
          throw new Error('Cartesia not ready')
        } else {
          throw new Error(`Unknown TTS provider: ${ttsPrimary}`)
        }
      } catch (primaryErr) {
        // Primary TTS failed, try fallback (language-specific)
        const errMsg = primaryErr instanceof Error ? primaryErr.message : String(primaryErr)
        console.warn(`[VoiceAgent] Primary TTS (${ttsPrimary}) failed for lang=${lang}: ${errMsg}`)
        // Log the error for admin dashboard visibility
        logProviderError({
          provider: ttsPrimary,
          category: 'tts',
          error: errMsg,
          sessionId: socket.id,
          fallbackUsed: ttsFallback,
        })
        console.log(`[VoiceAgent] TTS: trying fallback=${ttsFallback} (lang=${lang})`)
        
        if (ttsFallback === 'cartesia' && session.cartesiaReady && session.cartesiaStream) {
          await streamCartesiaTTS(text)
        } else if (ttsFallback === 'deepgram') {
          await streamDeepgramTTS(text)
        } else if (ttsFallback === 'zai') {
          await streamZAITTS(text)
        } else if (ttsFallback === 'gemini') {
          await streamGeminiTTS(text)
        } else {
          throw new Error(`No TTS provider available for lang=${lang} (primary=${ttsPrimary}, fallback=${ttsFallback})`)
        }
      }
    } catch (error) {
      console.error('[VoiceAgent] TTS error:', error)
      socket.emit('error', { message: error instanceof Error ? error.message : 'TTS failed' })
    } finally {
      session.isTtsStreaming = false
      socket.emit('agent-speaking-end')
      socket.emit('audio-level', { level: 0 })
    }
  }

  // ── Cartesia streaming TTS ──
  async function streamCartesiaTTS(text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!session.cartesiaStream) { reject(new Error('Cartesia not available')); return }

      const contextId = generateId()
      let resolved = false

      const doneHandler = (cid: string) => {
        if (cid === contextId && !resolved) {
          resolved = true
          resolve()
        }
      }

      const errorHandler = (message: string) => {
        if (!resolved) {
          resolved = true
          reject(new Error(message))
        }
      }

      session.cartesiaStream!.onDone(doneHandler)
      session.cartesiaStream!.onError(errorHandler)

      // Send the full text at once (can be chunked for very long text)
      const textChunks = splitTextIntoChunks(text, 1000)
      
      if (textChunks.length === 1) {
        session.cartesiaStream!.synthesize(text, contextId, true)
      } else {
        // Send chunks incrementally
        for (let i = 0; i < textChunks.length; i++) {
          if (!session.isTtsStreaming) break
          const isLast = i === textChunks.length - 1
          session.cartesiaStream!.synthesize(textChunks[i], contextId, isLast)
        }
      }

      // Timeout after 30 seconds
      setTimeout(() => {
        if (!resolved) {
          resolved = true
          resolve() // Don't reject, just resolve
        }
      }, 30000)
    })
  }

  // ── ZAI TTS (batch mode, chunked) ──
  async function streamZAITTS(text: string) {
    const textChunks = splitTextIntoChunks(text, 1000)

    for (const textChunk of textChunks) {
      if (!session.isTtsStreaming) break

      const wavInfo = await zaiTTS(textChunk)
      socket.emit('agent-audio-format', {
        sampleRate: wavInfo.sampleRate,
        numChannels: wavInfo.numChannels,
        bitsPerSample: wavInfo.bitsPerSample,
      })

      let pcmOffset = 0
      while (pcmOffset < wavInfo.pcmData.byteLength && session.isTtsStreaming) {
        const end = Math.min(pcmOffset + PCM_SEND_CHUNK_SIZE, wavInfo.pcmData.byteLength)
        const chunk = wavInfo.pcmData.slice(pcmOffset, end)
        session.agentRecordingBuffer.push(chunk.buffer ? chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength) : chunk)
        socket.emit('agent-audio', chunk)
        const rms = calculateRMS(chunk)
        const level = Math.min(1, rms / 3000)
        socket.emit('audio-level', { level })
        pcmOffset = end
        await new Promise(r => setTimeout(r, 20))
      }
    }
  }

  // ── Deepgram TTS (batch mode, chunked) ──
  async function streamDeepgramTTS(text: string) {
    const textChunks = splitTextIntoChunks(text, 1000)

    for (const textChunk of textChunks) {
      if (!session.isTtsStreaming) break

      const ttsResult = await deepgramTTS(textChunk)
      socket.emit('agent-audio-format', { sampleRate: ttsResult.sampleRate, numChannels: 1, bitsPerSample: 16 })

      let pcmOffset = 0
      while (pcmOffset < ttsResult.pcmData.byteLength && session.isTtsStreaming) {
        const end = Math.min(pcmOffset + PCM_SEND_CHUNK_SIZE, ttsResult.pcmData.byteLength)
        const chunk = ttsResult.pcmData.slice(pcmOffset, end)
        session.agentRecordingBuffer.push(chunk.buffer ? chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength) : chunk)
        socket.emit('agent-audio', chunk)
        const rms = calculateRMS(chunk)
        const level = Math.min(1, rms / 3000)
        socket.emit('audio-level', { level })
        pcmOffset = end
        await new Promise(r => setTimeout(r, 20))
      }
    }
  }

  // ── Gemini TTS (batch mode, chunked) ──
  async function streamGeminiTTS(text: string) {
    const textChunks = splitTextIntoChunks(text, 1000)

    for (const textChunk of textChunks) {
      if (!session.isTtsStreaming) break

      const pcmBuffer = await geminiTTS(textChunk)
      socket.emit('agent-audio-format', { sampleRate: 24000, numChannels: 1, bitsPerSample: 16 })

      let pcmOffset = 0
      while (pcmOffset < pcmBuffer.byteLength && session.isTtsStreaming) {
        const end = Math.min(pcmOffset + PCM_SEND_CHUNK_SIZE, pcmBuffer.byteLength)
        const chunk = pcmBuffer.slice(pcmOffset, end)
        session.agentRecordingBuffer.push(chunk.buffer ? chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength) : chunk)
        socket.emit('agent-audio', chunk)
        const rms = calculateRMS(chunk)
        const level = Math.min(1, rms / 3000)
        socket.emit('audio-level', { level })
        pcmOffset = end
        await new Promise(r => setTimeout(r, 20))
      }
    }
  }

  // ── Chat Message Handler ──
  socket.on('chat-message', async (msg: { text: string }) => {
    const text = msg.text?.trim()
    if (!text) return
    console.log(`[VoiceAgent] Chat: "${text}"`)

    session.isTtsStreaming = false
    isPlaybackInterruptedRef = true
    session.isClientPlaying = false
    if (session.cartesiaReady && session.cartesiaStream) { session.cartesiaStream.cancel() }
    // Clear debounce timer since we're switching to chat input
    if (session.transcriptDebounceTimer) {
      clearTimeout(session.transcriptDebounceTimer)
      session.transcriptDebounceTimer = null
    }
    session.accumulatedTranscript = ''
    socket.emit('agent-speaking-interrupted')
    socket.emit('audio-level', { level: 0 })

    socket.emit('transcript', { id: generateId(), role: 'employer', text })

    session.conversationHistory.push({ role: 'user', content: text })
    if (session.conversationHistory.length > MAX_HISTORY) session.conversationHistory = session.conversationHistory.slice(-MAX_HISTORY)

    socket.emit('agent-thinking')

    try {
      // ── Smart Language Detection for chat messages too ──
      await handleLanguageDetection(session, text, socket)
      
      // ═══════════════════════════════════════════════════════════════
      // ║  SMART BRAIN — Same Brain as WhatsApp and Email               ║
      // ═══════════════════════════════════════════════════════════════
      let agentText = ''

      try {
        const brainResult = await callSmartBrain(text, session, 'agent')
        agentText = brainResult.text
        if (brainResult.customerId) session.brainCustomerId = brainResult.customerId
        if (brainResult.conversationSessionId) session.brainSessionId = brainResult.conversationSessionId
        console.log(`[SmartBrain] Voice chat response (lang=${session.detectedLanguage}): "${agentText.substring(0, 100)}..."`)
      } catch (brainErr) {
        // Fallback: Use direct LLM if Smart Brain is unreachable
        console.warn(`[VoiceAgent] Smart Brain unavailable (chat), using direct LLM: ${brainErr instanceof Error ? brainErr.message : brainErr}`)
        const messages = [{ role: 'assistant' as const, content: getSystemPrompt(session.detectedLanguage) }, ...session.conversationHistory]
        agentText = await callLLMWithFallback(messages)
        console.log(`[VoiceAgent] Fallback LLM chat response (lang=${session.detectedLanguage}): "${agentText.substring(0, 100)}..."`)
      }

      if (!agentText) return

      session.conversationHistory.push({ role: 'assistant', content: agentText })
      if (session.conversationHistory.length > MAX_HISTORY) session.conversationHistory = session.conversationHistory.slice(-MAX_HISTORY)

      socket.emit('transcript', { id: generateId(), role: 'agent', text: agentText })
      await streamTtsToClient(agentText)
    } catch (error) {
      console.error('[VoiceAgent] Chat error:', error)
      socket.emit('error', { message: error instanceof Error ? error.message : 'Chat failed' })
    }
  })

  socket.on('mute-toggle', (msg: { muted: boolean }) => {
    session.isMuted = msg.muted
    if (msg.muted) { session.audioBuffer = []; session.isSpeechActive = false }
  })

  socket.on('client-playback-ended', () => {
    session.isClientPlaying = false
    session.bargeInDetectChunks = 0
    session.isPotentialBargeIn = false
    session.potentialBargeInAudioBuffer = []
    session.potentialBargeInSilenceChunks = 0
  })

  socket.on('stop-session', () => {
    session.isTtsStreaming = false
    isPlaybackInterruptedRef = true
    // Clear debounce timer to prevent processing after stop
    if (session.transcriptDebounceTimer) {
      clearTimeout(session.transcriptDebounceTimer)
      session.transcriptDebounceTimer = null
    }
    session.accumulatedTranscript = ''
    if (session.deepgramStream) { session.deepgramStream.close(); session.deepgramStream = null; session.deepgramReady = false }
    if (session.cartesiaStream) { session.cartesiaStream.cancel(); session.cartesiaStream = null; session.cartesiaReady = false }
    if (session.audioBuffer.length > 0 && session.isSpeechActive) {
      session.isSpeechActive = false
      processLocalVADSpeech()
    }
  })

  socket.on('disconnect', (reason: string) => {
    console.log(`[VoiceAgent] Client disconnected: ${socket.id} (${reason})`)
    session.isTtsStreaming = false
    isPlaybackInterruptedRef = true
    // Clear debounce timer to prevent processing after disconnect
    if (session.transcriptDebounceTimer) {
      clearTimeout(session.transcriptDebounceTimer)
      session.transcriptDebounceTimer = null
    }
    session.accumulatedTranscript = ''
    if (session.deepgramStream) { session.deepgramStream.close(); session.deepgramStream = null }
    if (session.cartesiaStream) { session.cartesiaStream.close(); session.cartesiaStream = null }

    // ── Save call recording ──
    saveCallRecording(session)

    // ── Close the ConversationSession in DB ──
    if (session.brainSessionId) {
      const closeSession = async () => {
        try {
          await fetch(`${HONO_WORKER_URL}/api/conversations/${session.brainSessionId}/close?XTransformPort=3002`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: 'call_ended' }),
          })
          console.log(`[VoiceAgent] Session ${session.brainSessionId} closed in DB`)
        } catch (err) {
          console.warn(`[VoiceAgent] Failed to close session in DB:`, err instanceof Error ? err.message : String(err))
        }
      }
      closeSession() // Fire and forget — don't block disconnect
    }
  })
})

// ─── Process Error Handlers ──────────────────────────────────────────────────

process.on('uncaughtException', (err) => {
  console.error('[VoiceAgent] UNCAUGHT EXCEPTION:', err)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('[VoiceAgent] UNHANDLED REJECTION:', reason)
})
