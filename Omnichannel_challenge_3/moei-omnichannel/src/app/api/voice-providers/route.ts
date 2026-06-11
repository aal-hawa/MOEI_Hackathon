/**
 * Voice Providers API Route — Direct proxy to voice-agent service on port 3004
 *
 * This route handles the /api/voice-providers endpoint directly within Next.js,
 * bypassing the Hono worker. This ensures the admin dashboard Voice Pipeline
 * config works even when the worker is not running.
 *
 * When the voice-agent service is unavailable, it returns fallback data so
 * the UI can still show the provider selectors with default config.
 */

import { NextRequest, NextResponse } from 'next/server'

const VOICE_AGENT_URL = 'http://127.0.0.1:3004/api/voice-providers'

const FALLBACK_CONFIG = {
  config: {
    stt: { primary: 'deepgram', fallback: 'zai' },
    tts: { primary: 'cartesia', fallback: 'zai', languageProviders: { ar: { primary: 'cartesia', fallback: 'zai' }, en: { primary: 'cartesia', fallback: 'deepgram' } } },
    llm: { primary: 'zai', fallback: 'gemini' },
    language: 'multi',
    maxSpeechDuration: 15000,
  },
  status: { deepgram: 'offline', cartesia: 'offline', zai: 'offline', geminiProxy: 'offline' },
  available: {
    stt: {
      deepgram: { name: 'Deepgram Nova-3', description: 'Real-time streaming STT with interim results, Arabic & English' },
      cartesia: { name: 'Cartesia STT', description: 'Cartesia speech-to-text (batch mode), Arabic & English' },
      zai: { name: 'ZAI SDK ASR', description: 'ZAI SDK speech-to-text (batch mode)' },
    },
    tts: {
      cartesia: { name: 'Cartesia Sonic-3.5', description: 'Real-time streaming TTS with low latency, Arabic & English voices' },
      deepgram: { name: 'Deepgram Aura TTS', description: 'Deepgram text-to-speech (batch mode)' },
      zai: { name: 'ZAI SDK TTS', description: 'ZAI SDK text-to-speech (batch mode)' },
      gemini: { name: 'Gemini TTS', description: 'Gemini Flash TTS via proxy worker' },
    },
    llm: {
      zai: { name: 'ZAI SDK Chat', description: 'ZAI SDK chat completions' },
      gemini: { name: 'Gemini Flash', description: 'Gemini 2.5 Flash via proxy worker' },
    },
    languages: [
      { code: 'multi', label: 'Auto-detect (English / العربية)' },
      { code: 'ar', label: 'Arabic (العربية)' },
      { code: 'en', label: 'English' },
    ],
  },
}

export async function GET(request: NextRequest) {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    const response = await fetch(VOICE_AGENT_URL, {
      method: 'GET',
      signal: controller.signal,
    })
    clearTimeout(timeout)

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.warn('[VoiceProviders] Voice agent service unavailable:', error instanceof Error ? error.message : error)
    return NextResponse.json(
      {
        ...FALLBACK_CONFIG,
        error: 'Voice agent service unavailable',
      },
      { status: 503 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.text()
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    const response = await fetch(VOICE_AGENT_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: controller.signal,
    })
    clearTimeout(timeout)

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.warn('[VoiceProviders] Voice agent service unavailable for PUT:', error instanceof Error ? error.message : error)

    // When the service is offline, save config to localStorage on the client side
    // by returning a "deferred" response
    try {
      const newConfig = JSON.parse(await request.text())
      return NextResponse.json(
        {
          success: false,
          error: 'Voice agent service unavailable — config will be applied when the service reconnects',
          config: {
            ...FALLBACK_CONFIG.config,
            ...newConfig,
          },
        },
        { status: 503 }
      )
    } catch {
      return NextResponse.json(
        { error: 'Voice agent service unavailable' },
        { status: 503 }
      )
    }
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
