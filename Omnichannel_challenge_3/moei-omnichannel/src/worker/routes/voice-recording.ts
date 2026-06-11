/**
 * Voice Recording Routes - Hono
 * 
 * Endpoints:
 *   POST /voice/recording                - Create recording DB record (called by Voice Agent)
 *   GET  /voice/recording/:sessionId     - Get recording metadata
 *   GET  /voice/recording/:sessionId/audio - Serve WAV audio file
 */

import { Hono } from 'hono'
import { db } from '../lib/db'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const app = new Hono()

const RECORDINGS_DIR = resolve(process.cwd(), 'upload/voice-recordings')

// ─── POST /voice/recording ────────────────────────────────────────────────────
// Create a VoiceRecording DB record after the Voice Agent saves a WAV file
app.post('/voice/recording', async (c) => {
  try {
    const body = await c.req.json()
    const {
      sessionId,
      filePath,
      durationSeconds,
      fileSizeBytes,
      sampleRate,
      channels,
      format,
      hasCustomerAudio,
      hasAgentAudio,
      metadata,
    } = body

    if (!sessionId || !filePath) {
      return c.json({ error: 'sessionId and filePath are required' }, 400)
    }

    // Upsert: if a recording already exists for this session, update it
    const recording = await db.voiceRecording.upsert({
      where: { sessionId },
      create: {
        sessionId,
        filePath,
        durationSeconds: durationSeconds || 0,
        fileSizeBytes: fileSizeBytes || 0,
        sampleRate: sampleRate || 48000,
        channels: channels || 1,
        format: format || 'wav',
        hasCustomerAudio: hasCustomerAudio !== false,
        hasAgentAudio: hasAgentAudio !== false,
        metadata: metadata || '{}',
      },
      update: {
        filePath,
        durationSeconds: durationSeconds || 0,
        fileSizeBytes: fileSizeBytes || 0,
        sampleRate: sampleRate || 48000,
        hasCustomerAudio: hasCustomerAudio !== false,
        hasAgentAudio: hasAgentAudio !== false,
        metadata: metadata || '{}',
      },
    })

    // Also update the ConversationSession metadata with recording info
    try {
      const session = await db.conversationSession.findUnique({
        where: { id: sessionId },
      })
      if (session) {
        const meta = JSON.parse(session.metadata || '{}')
        meta.recordingUrl = filePath
        meta.hasRecording = true
        meta.recordingDuration = durationSeconds
        await db.conversationSession.update({
          where: { id: sessionId },
          data: { metadata: JSON.stringify(meta) },
        })
      }
    } catch (err) {
      // Non-critical — recording is saved even if metadata update fails
      console.warn('[VoiceRecording] Failed to update session metadata:', err)
    }

    return c.json({ success: true, recording })
  } catch (err) {
    console.error('[VoiceRecording] Error creating recording:', err)
    return c.json({ error: 'Failed to create recording' }, 500)
  }
})

// ─── GET /voice/recording/:sessionId ─────────────────────────────────────────
// Get recording metadata for a session
app.get('/voice/recording/:sessionId', async (c) => {
  try {
    const sessionId = c.req.param('sessionId')
    
    const recording = await db.voiceRecording.findUnique({
      where: { sessionId },
    })

    if (!recording) {
      return c.json({ error: 'Recording not found', hasRecording: false }, 404)
    }

    return c.json({ recording, hasRecording: true })
  } catch (err) {
    console.error('[VoiceRecording] Error fetching recording:', err)
    return c.json({ error: 'Failed to fetch recording' }, 500)
  }
})

// ─── GET /voice/recording/:sessionId/audio ───────────────────────────────────
// Serve the WAV audio file for playback
app.get('/voice/recording/:sessionId/audio', async (c) => {
  try {
    const sessionId = c.req.param('sessionId')
    
    const recording = await db.voiceRecording.findUnique({
      where: { sessionId },
    })

    if (!recording) {
      return c.json({ error: 'Recording not found' }, 404)
    }

    const fullPath = resolve(RECORDINGS_DIR, `${sessionId}.wav`)
    
    if (!existsSync(fullPath)) {
      return c.json({ error: 'Audio file not found on disk' }, 404)
    }

    const audioBuffer = readFileSync(fullPath)
    
    c.header('Content-Type', 'audio/wav')
    c.header('Content-Length', audioBuffer.byteLength.toString())
    c.header('Accept-Ranges', 'bytes')
    c.header('Cache-Control', 'public, max-age=3600')
    // Allow CORS for audio playback
    c.header('Access-Control-Allow-Origin', '*')
    
    return c.body(audioBuffer)
  } catch (err) {
    console.error('[VoiceRecording] Error serving audio:', err)
    return c.json({ error: 'Failed to serve audio' }, 500)
  }
})

export const voiceRecordingRoutes = app
