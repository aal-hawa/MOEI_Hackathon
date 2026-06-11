/**
 * Voice Provider Errors API — Proxy to voice-agent service on port 3004
 *
 * Returns the provider error log for the admin dashboard.
 * This endpoint is NOT used by the customer-facing UI — admin only.
 */

import { NextRequest, NextResponse } from 'next/server'

const VOICE_AGENT_ERRORS_URL = 'http://127.0.0.1:3004/api/voice-providers/errors'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = searchParams.get('limit') || '50'
    const active = searchParams.get('active') || ''

    const url = `${VOICE_AGENT_ERRORS_URL}?limit=${limit}${active ? '&active=' + active : ''}`
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
    })
    clearTimeout(timeout)

    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    return NextResponse.json(
      {
        errors: [],
        total: 0,
        activeCount: 0,
        error: 'Voice agent service unavailable',
      },
      { status: 503 }
    )
  }
}
