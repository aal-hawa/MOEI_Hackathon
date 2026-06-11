/**
 * Google Gemini TTS Provider - Natural Arabic & English Speech
 *
 * PRIMARY: Uses Gemini 2.5 Flash TTS model (works with AI Studio API key)
 *   - Supports Arabic (Aoede voice) and English (Charon/Puck/Kore voices)
 *   - Native multilingual output — far superior to ZAI SDK's Chinese-centric voices
 *
 * SECONDARY: Google Cloud TTS REST API (requires Cloud API key with TTS enabled)
 *   - 220+ voices across 40+ languages
 *   - Only available if user has a separate Google Cloud TTS API key
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import { getMoeiConfig } from '@/lib/moei-config'

// ─── Voice Configuration ──────────────────────────────────────────────────────

export interface GeminiTTSVoice {
  id: string
  name: string
  language: string
  gender: 'Male' | 'Female'
  description: string
}

/**
 * Gemini TTS voices — these work with the AI Studio API key
 * Gemini 2.5 Flash TTS supports multiple prebuilt voices
 */
export const GEMINI_TTS_VOICES: Record<string, GeminiTTSVoice> = {
  // Arabic-optimized voices
  'Aoede': { id: 'Aoede', name: 'Aoede', language: 'ar', gender: 'Female', description: 'Warm, professional Arabic female voice' },
  'Fenrir': { id: 'Fenrir', name: 'Fenrir', language: 'ar', gender: 'Male', description: 'Deep, authoritative Arabic male voice' },
  // English voices
  'Charon': { id: 'Charon', name: 'Charon', language: 'en', gender: 'Male', description: 'Clear, professional English male voice' },
  'Puck': { id: 'Puck', name: 'Puck', language: 'en', gender: 'Male', description: 'Friendly, conversational English male voice' },
  'Kore': { id: 'Kore', name: 'Kore', language: 'en', gender: 'Female', description: 'Warm, clear English female voice' },
  'Ledas': { id: 'Ledas', name: 'Ledas', language: 'en', gender: 'Female', description: 'Professional English female voice' },
  'Orus': { id: 'Orus', name: 'Orus', language: 'en', gender: 'Male', description: 'Confident English male voice' },
  'Zephyr': { id: 'Zephyr', name: 'Zephyr', language: 'en', gender: 'Female', description: 'Soft, empathetic English female voice' },
}

/** Default voices for each language */
export const DEFAULT_GEMINI_VOICES: Record<string, string> = {
  ar: 'Aoede',   // Arabic female — warm and professional
  en: 'Kore',    // English female — warm and clear
}

// ─── Google Cloud TTS voices (secondary, requires Cloud API key) ──────────────

export interface GoogleCloudTTSVoice {
  languageCode: string
  name: string
  ssmlGender: 'MALE' | 'FEMALE' | 'NEUTRAL'
}

export const GOOGLE_CLOUD_TTS_VOICES: Record<string, GoogleCloudTTSVoice> = {
  'ar-XA-Standard-A': { languageCode: 'ar-XA', name: 'ar-XA-Standard-A', ssmlGender: 'FEMALE' },
  'ar-XA-Standard-B': { languageCode: 'ar-XA', name: 'ar-XA-Standard-B', ssmlGender: 'MALE' },
  'ar-XA-Wavenet-A': { languageCode: 'ar-XA', name: 'ar-XA-Wavenet-A', ssmlGender: 'FEMALE' },
  'ar-XA-Wavenet-B': { languageCode: 'ar-XA', name: 'ar-XA-Wavenet-B', ssmlGender: 'MALE' },
  'en-US-Standard-C': { languageCode: 'en-US', name: 'en-US-Standard-C', ssmlGender: 'FEMALE' },
  'en-US-Standard-D': { languageCode: 'en-US', name: 'en-US-Standard-D', ssmlGender: 'MALE' },
  'en-US-Wavenet-C': { languageCode: 'en-US', name: 'en-US-Wavenet-C', ssmlGender: 'FEMALE' },
  'en-US-Wavenet-D': { languageCode: 'en-US', name: 'en-US-Wavenet-D', ssmlGender: 'MALE' },
  'en-US-Journey-D': { languageCode: 'en-US', name: 'en-US-Journey-D', ssmlGender: 'MALE' },
  'en-US-Journey-F': { languageCode: 'en-US', name: 'en-US-Journey-F', ssmlGender: 'FEMALE' },
  'en-GB-Wavenet-A': { languageCode: 'en-GB', name: 'en-GB-Wavenet-A', ssmlGender: 'FEMALE' },
  'en-GB-Wavenet-B': { languageCode: 'en-GB', name: 'en-GB-Wavenet-B', ssmlGender: 'MALE' },
}

// ─── TTS Request/Response ──────────────────────────────────────────────────────

export interface GoogleTTSRequest {
  text: string
  language?: 'en' | 'ar'
  voice?: string  // Override voice name
  speed?: number   // 0.25 to 4.0, default 1.0
}

export interface GoogleTTSResponse {
  success: boolean
  audioBuffer?: Buffer
  audioContent?: string  // base64 encoded
  error?: string
}

// ─── PRIMARY: Gemini 2.5 Flash TTS ────────────────────────────────────────────

let genAI: GoogleGenerativeAI | null = null

async function getGenAI(): Promise<GoogleGenerativeAI> {
  if (!genAI) {
    const config = await getMoeiConfig()
    const apiKey = config.apiKeys.gemini || config.apiKeys.recentechAI
    if (!apiKey) throw new Error('API key is not set in moei-config.json or environment variables')
    genAI = new GoogleGenerativeAI(apiKey)
  }
  return genAI
}

/**
 * Synthesize speech using Gemini's native TTS model.
 * This is the PRIMARY method — works with the AI Studio API key.
 * Supports Arabic (Aoede/Fenrir) and English (Kore/Charon/Puck/etc.)
 */
async function geminiNativeTTS(req: GoogleTTSRequest): Promise<GoogleTTSResponse> {
  const ai = await getGenAI()
  const config = await getMoeiConfig()
  const apiKey = config.apiKeys.gemini || config.apiKeys.recentechAI
  const lang = req.language || 'en'
  const voiceName = req.voice || DEFAULT_GEMINI_VOICES[lang] || DEFAULT_GEMINI_VOICES.en
  const voice = GEMINI_TTS_VOICES[voiceName]

  if (!voice) {
    return { success: false, error: `Unknown Gemini voice: ${voiceName}` }
  }

  try {
    // Use Gemini 2.5 Flash TTS model with config-based endpoint
    const requestOptions = { 
      baseUrl: config.endpoints.recentechAIGemini,
      customHeaders: { Authorization: `Bearer ${apiKey}` }
    }
    const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash-preview-tts' }, requestOptions)

    // Build the prompt based on language
    const prompt = lang === 'ar'
      ? req.text  // For Arabic, just pass the text directly
      : req.text  // For English, just pass the text directly

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: voiceName,
            },
          },
        },
      },
    })

    const response = result.response
    const candidate = response.candidates?.[0]
    const parts = candidate?.content?.parts

    if (parts && parts[0]?.inlineData) {
      const inlineData = parts[0].inlineData
      const audioBuffer = Buffer.from(inlineData.data || '', 'base64')
      return {
        success: true,
        audioBuffer,
        audioContent: inlineData.data,
      }
    }

    return { success: false, error: 'No audio data in Gemini TTS response' }
  } catch (error) {
    console.error('[GEMINI-TTS] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Gemini TTS failed',
    }
  }
}

// ─── SECONDARY: Google Cloud TTS REST API ─────────────────────────────────────

const CLOUD_TTS_API_URL = 'https://texttospeech.googleapis.com/v1/text:synthesize'

/**
 * Synthesize speech using Google Cloud Text-to-Speech REST API.
 * SECONDARY method — requires a separate Google Cloud API key with Cloud TTS enabled.
 * Falls back to this if Gemini native TTS is unavailable.
 */
async function googleCloudTTSSdk(req: GoogleTTSRequest): Promise<GoogleTTSResponse> {
  const config = await getMoeiConfig()
  // For Cloud TTS, use recentechAI key as fallback (no separate cloud key in config)
  const apiKey = config.apiKeys.recentechAI || config.apiKeys.gemini
  if (!apiKey) {
    return { success: false, error: 'No API key for Google Cloud TTS' }
  }

  const lang = req.language || 'en'
  // Map to Cloud TTS voice names
  const cloudVoiceMap: Record<string, string> = {
    ar: 'ar-XA-Wavenet-A',
    en: 'en-US-Journey-F',
  }
  const voiceName = cloudVoiceMap[lang] || cloudVoiceMap.en
  const voiceConfig = GOOGLE_CLOUD_TTS_VOICES[voiceName]

  if (!voiceConfig) {
    return { success: false, error: `Unknown Cloud TTS voice: ${voiceName}` }
  }

  try {
    const response = await fetch(`${CLOUD_TTS_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text: req.text },
        voice: {
          languageCode: voiceConfig.languageCode,
          name: voiceConfig.name,
          ssmlGender: voiceConfig.ssmlGender,
        },
        audioConfig: {
          audioEncoding: 'LINEAR16',
          speakingRate: req.speed || 1.0,
          sampleRateHertz: 24000,
          effectsProfileId: ['telephony-class-application'],
        },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.warn('[CLOUD-TTS] API error:', response.status, errorText.slice(0, 200))
      return { success: false, error: `Cloud TTS API error: ${response.status}` }
    }

    const data = await response.json()
    const audioContent = data.audioContent as string

    if (!audioContent) {
      return { success: false, error: 'No audio content in Cloud TTS response' }
    }

    const audioBuffer = Buffer.from(audioContent, 'base64')
    return { success: true, audioBuffer, audioContent }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Cloud TTS failed',
    }
  }
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

/**
 * Generate speech using Google TTS (Gemini native as primary, Cloud TTS as secondary)
 * This is the DEFAULT TTS provider — far better Arabic & English than ZAI SDK
 */
export async function googleTextToSpeech(req: GoogleTTSRequest): Promise<GoogleTTSResponse> {
  const config = await getMoeiConfig()
  const apiKey = config.apiKeys.gemini || config.apiKeys.recentechAI
  if (!apiKey) {
    return { success: false, error: 'API key not configured' }
  }

  // Try Gemini native TTS first (works with AI Studio key)
  const geminiResult = await geminiNativeTTS(req)
  if (geminiResult.success) {
    return geminiResult
  }

  console.warn('[GOOGLE-TTS] Gemini native TTS failed, trying Cloud TTS:', geminiResult.error)

  // Fall back to Google Cloud TTS (may not work with AI Studio key)
  const cloudResult = await googleCloudTTSSdk(req)
  if (cloudResult.success) {
    return cloudResult
  }

  // Both failed
  return {
    success: false,
    error: `Google TTS unavailable: Gemini(${geminiResult.error}), Cloud(${cloudResult.error})`,
  }
}

// ─── Health Check ──────────────────────────────────────────────────────────────

let ttsHealthChecked = false
let ttsHealthy = false

export async function isGoogleTTSAvailable(): Promise<boolean> {
  if (ttsHealthChecked) return ttsHealthy

  try {
    const config = await getMoeiConfig()
    const apiKey = config.apiKeys.gemini || config.apiKeys.recentechAI
    if (!apiKey) {
      ttsHealthChecked = true
      ttsHealthy = false
      return false
    }

    // Quick test with minimal text
    const result = await googleTextToSpeech({
      text: 'Hello',
      language: 'en',
      speed: 1.0,
    })

    ttsHealthy = result.success
    ttsHealthChecked = true

    if (ttsHealthy) {
      console.log('[GOOGLE-TTS] Health check passed')
    } else {
      console.warn('[GOOGLE-TTS] Health check failed:', result.error)
    }

    return ttsHealthy
  } catch (err) {
    console.error('[GOOGLE-TTS] Health check error:', err)
    ttsHealthChecked = true
    ttsHealthy = false
    return false
  }
}

export function resetGoogleTTSHealthCheck(): void {
  ttsHealthChecked = false
  ttsHealthy = false
}

// ─── List Available Voices ────────────────────────────────────────────────────

export function getAvailableVoices(language?: 'en' | 'ar'): Array<{ id: string; name: string; gender: string; lang: string }> {
  const geminiVoices = Object.entries(GEMINI_TTS_VOICES)
    .filter(([, v]) => {
      if (!language) return true
      return v.language === language || v.language === 'both'
    })
    .map(([id, v]) => ({
      id,
      name: `${v.name} (${v.description})`,
      gender: v.gender,
      lang: v.language,
    }))

  const cloudVoices = Object.entries(GOOGLE_CLOUD_TTS_VOICES)
    .filter(([id]) => {
      if (!language) return true
      return id.startsWith(language === 'ar' ? 'ar-XA' : 'en-')
    })
    .map(([id, v]) => ({
      id,
      name: id.replace(/-/g, ' ').replace(/Standard|Wavenet|Journey/g, (m) => ` ${m}`),
      gender: v.ssmlGender.charAt(0) + v.ssmlGender.slice(1).toLowerCase(),
      lang: v.languageCode,
    }))

  return [...geminiVoices, ...cloudVoices]
}
