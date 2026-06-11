import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/ai-config — Load AI feature settings from DB, fallback to defaults
export async function GET() {
  try {
    let settings = await db.aIFeatureSettings.findFirst()

    if (!settings) {
      settings = await db.aIFeatureSettings.create({
        data: {},
      })
    }

    return NextResponse.json(settings)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Failed to load AI config:', message)
    return NextResponse.json(
      {
        enableRAG: true,
        enableSentiment: true,
        enableIntent: true,
        enableAutoCase: false,
        aiProvider: 'google',
        aiModel: 'gemini-2.5-flash',
        temperature: 0.7,
        maxTokens: 2048,
        responseLanguage: 'auto',
      },
      { status: 200 }
    )
  }
}

// PUT /api/ai-config — Save AI feature settings
export async function PUT(request: NextRequest) {
  try {
    const bodyText = await request.text()
    const body = JSON.parse(bodyText)

    const data: Record<string, boolean | string | number> = {}
    if (typeof body.enableRAG === 'boolean') data.enableRAG = body.enableRAG
    if (typeof body.enableSentiment === 'boolean') data.enableSentiment = body.enableSentiment
    if (typeof body.enableIntent === 'boolean') data.enableIntent = body.enableIntent
    if (typeof body.enableAutoCase === 'boolean') data.enableAutoCase = body.enableAutoCase
    if (typeof body.aiProvider === 'string') data.aiProvider = body.aiProvider
    if (typeof body.aiModel === 'string') data.aiModel = body.aiModel
    if (typeof body.temperature === 'number') data.temperature = body.temperature
    if (typeof body.maxTokens === 'number') data.maxTokens = body.maxTokens
    if (typeof body.responseLanguage === 'string') data.responseLanguage = body.responseLanguage

    // Upsert: find first record or create, then update
    let settings = await db.aIFeatureSettings.findFirst()

    if (settings) {
      settings = await db.aIFeatureSettings.update({
        where: { id: settings.id },
        data,
      })
    } else {
      settings = await db.aIFeatureSettings.create({
        data,
      })
    }

    return NextResponse.json(settings)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('Failed to save AI config:', message)
    return NextResponse.json({ error: 'Failed to save AI config', details: message }, { status: 500 })
  }
}
