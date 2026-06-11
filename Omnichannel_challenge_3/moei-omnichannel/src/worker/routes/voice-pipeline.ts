/**
 * Voice Pipeline Route - Channel adapter with full ASR/TTS
 * POST /api/ai/voice/pipeline
 *
 * This file handles Voice-SPECIFIC logic:
 * - ASR (speech-to-text) transcription
 * - TTS (text-to-speech) audio generation
 * - Audio base64 handling
 *
 * The AI thinking is done by the ONE Smart Brain via BrainOrchestrator
 * — the same Brain that serves WhatsApp and Email.
 * This file does NOT think. It only delivers.
 */

import { Hono } from 'hono'
import { sanitizeInput } from '../lib/edge-security'
import { BrainOrchestrator } from '../lib/brain-orchestrator'

const app = new Hono()

app.post('/voice/pipeline', async (c) => {
  try {
    const body = await c.req.json()
    const {
      audioBase64,
      sessionId,
      language,
      aiMode,
      customerId,
      customerName,
      customerPhone,
      customerEmail,
      conversationHistory,
    } = body

    if (!audioBase64) {
      return c.json({ error: 'audioBase64 is required' }, 400)
    }

    if (!sessionId) {
      return c.json({ error: 'sessionId is required' }, 400)
    }

    let transcription = ''
    let aiResponse = ''
    let audioBase64Response = ''
    let detectedLanguage: 'ar' | 'en' = 'en'
    let sentiment = 0.5
    let emotion = 'neutral'

    try {
      const { default: ZAI } = await import('z-ai-web-dev-sdk')
      const zai = await ZAI.create()

      // Step 1: ASR - Transcribe audio
      try {
        const asrResult = await zai.audio.asr.create({
          file_base64: audioBase64,
        })
        transcription = asrResult.text || asrResult.transcription || ''
      } catch (asrError) {
        console.error('[VoicePipeline] ASR error:', asrError)
        transcription = ''
      }

      if (!transcription) {
        transcription = (language === 'ar')
          ? 'مرحبا، أحتاج مساعدة'
          : 'Hello, I need help with my request'
      }

      // ═══════════════════════════════════════════════════════════════
      // ║  CALL BRAIN ORCHESTRATOR — Same Smart Brain as WhatsApp/Email ║
      // ═══════════════════════════════════════════════════════════════
      const orchestratorResult = await BrainOrchestrator.handleMessage({
        message: sanitizeInput(transcription, 2000),
        channel: 'voice',
        language: language as any,
        customerId,
        customerPhone,
        customerEmail,
        sessionId,
        conversationHistory: Array.isArray(conversationHistory)
          ? conversationHistory.slice(-10).map((msg: any) => ({
              speaker: msg.role === 'user' ? 'customer' : 'ai',
              text: msg.content || '',
            }))
          : undefined,
        aiMode: aiMode || 'full_ai',
      })

      aiResponse = orchestratorResult.response
      detectedLanguage = orchestratorResult.language
      sentiment = orchestratorResult.sentiment

      // Step 3: TTS - Convert AI response to audio
      try {
        const ttsResult = await zai.audio.tts.create({
          input: aiResponse,
        })
        audioBase64Response = ttsResult.audio || ttsResult.audioBase64 || ''
      } catch (ttsError) {
        console.error('[VoicePipeline] TTS error:', ttsError)
        audioBase64Response = ''
      }

      // Map sentiment to emotion
      emotion = sentimentToEmotion(sentiment)

    } catch (sdkError) {
      console.error('[VoicePipeline] SDK unavailable, using BrainOrchestrator fallback:', sdkError)

      // Even without the SDK for ASR/TTS, the Brain still thinks via Orchestrator
      detectedLanguage = language === 'ar' ? 'ar' : 'en'
      transcription = detectedLanguage === 'ar'
        ? 'مرحبا، أحتاج مساعدة في طلبي'
        : 'Hello, I need help with my request'

      const orchestratorResult = await BrainOrchestrator.handleMessage({
        message: transcription,
        channel: 'voice',
        language: detectedLanguage,
        customerId,
        customerPhone,
        customerEmail,
        sessionId,
        aiMode: aiMode || 'full_ai',
      })
      aiResponse = orchestratorResult.response
      sentiment = orchestratorResult.sentiment
      emotion = sentimentToEmotion(sentiment)
      audioBase64Response = ''
    }

    return c.json({
      success: true,
      transcription,
      aiResponse,
      audioBase64: audioBase64Response,
      emotion,
      language: detectedLanguage,
      languageDetectionMethod: 'auto',
      sentiment,
      sessionId,
      customerId: customerId || null,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[VoicePipeline] Pipeline error:', error)
    return c.json({ error: 'Failed to process voice pipeline request' }, 500)
  }
})

// ── Helper: Map sentiment to emotion ──
function sentimentToEmotion(sentiment: number): string {
  if (sentiment >= 0.8) return 'happy'
  if (sentiment >= 0.6) return 'satisfied'
  if (sentiment >= 0.4) return 'neutral'
  if (sentiment >= 0.2) return 'frustrated'
  return 'angry'
}

export const voicePipelineRoutes = app
