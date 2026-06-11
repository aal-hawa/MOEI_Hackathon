/**
 * Voice Provider API Keys Route — Proxy to voice-agent service on port 3004
 *
 * PUT /api/voice-providers/api-keys
 * Body: { provider: 'deepgram' | 'cartesia', apiKey: string }
 */

import { NextRequest, NextResponse } from 'next/server'

const VOICE_AGENT_URL = 'http://127.0.0.1:3004/api/voice-providers/api-keys'

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
    console.warn('[VoiceProviders] Voice agent service unavailable for API key save:', error instanceof Error ? error.message : error)
    return NextResponse.json(
      { success: false, error: 'Voice agent service unavailable — could not save API key' },
      { status: 503 }
    )
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
