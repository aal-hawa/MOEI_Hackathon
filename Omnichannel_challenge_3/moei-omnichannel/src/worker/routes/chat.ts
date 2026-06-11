/**
 * Chat Route - Ultra-thin channel adapter
 * POST /api/chat
 *
 * This file handles Web Chat-SPECIFIC logic only:
 * - Validate input
 * - Call BrainOrchestrator (which handles Before/After)
 * - Save Interaction records to DB
 * - Manage ConversationSession
 * - Return response
 *
 * ALL AI thinking and action execution is done by BrainOrchestrator.
 */

import { Hono } from 'hono'
import { sanitizeInput } from '../lib/edge-security'
import { db } from '../lib/db'
import { BrainOrchestrator, type OrchestratorResult } from '../lib/brain-orchestrator'

const app = new Hono()

app.post('/chat', async (c) => {
  try {
    const body = await c.req.json()
    const { message, sessionId, language, customerId } = body

    if (!message) {
      return c.json({ error: 'message is required' }, 400)
    }

    const sanitizedMessage = sanitizeInput(message, 2000)
    const effectiveSessionId = sessionId || `session-${Date.now()}`

    // ═══════════════════════════════════════════════════════════════
    // ║  ONE CALL TO BRAIN ORCHESTRATOR                                ║
    // ║  It handles: DB loads → AI thinking → Action execution         ║
    // ═══════════════════════════════════════════════════════════════
    const result = await BrainOrchestrator.handleMessage({
      message: sanitizedMessage,
      channel: 'web',
      language: language as any,
      customerId,
      sessionId: effectiveSessionId,
    })

    // ── Save interactions to DB ──
    let savedCustomerId = result.customerId || customerId
    // Do NOT create fake "Session User" customers — only save if we have a real customer ID

    try {
      if (savedCustomerId) {
        // Save inbound interaction
        await db.interaction.create({
          data: {
            customerId: savedCustomerId,
            channel: 'web',
            type: 'message',
            direction: 'inbound',
            content: sanitizedMessage,
            intent: result.intent,
            sentiment: result.sentiment,
            language: result.language,
          },
        })

        // Save outbound interaction
        await db.interaction.create({
          data: {
            customerId: savedCustomerId,
            channel: 'web',
            type: 'message',
            direction: 'outbound',
            content: result.response,
            intent: result.intent,
            sentiment: result.sentiment,
            language: result.language,
            metadata: JSON.stringify({
              sessionId: effectiveSessionId,
              aiGenerated: true,
              provider: result.provider,
              actionReady: result.actionReady,
              actionResults: result.actionResults,
            }),
          },
        })

        // Update ConversationSession
        try {
          const existingSession = await db.conversationSession.findFirst({
            where: { customerId: savedCustomerId, status: { in: ['active', 'waiting'] }, channel: 'web' },
            orderBy: { createdAt: 'desc' },
          })

          const transcriptChunk = [
            { speaker: 'customer', text: sanitizedMessage, timestamp: new Date().toISOString(), language: result.language },
            { speaker: 'ai', text: result.response, timestamp: new Date().toISOString(), language: result.language },
          ]

          if (existingSession) {
            const currentTranscript = existingSession.transcript ? JSON.parse(existingSession.transcript) : []
            currentTranscript.push(...transcriptChunk)
            await db.conversationSession.update({
              where: { id: existingSession.id },
              data: {
                intent: result.intent !== 'default' ? result.intent : existingSession.intent,
                sentiment: result.sentiment,
                language: result.language,
                transcript: JSON.stringify(currentTranscript),
              },
            })
          } else {
            await db.conversationSession.create({
              data: {
                customerId: savedCustomerId,
                channel: 'web',
                status: 'active',
                aiMode: 'full_ai',
                language: result.language,
                intent: result.intent !== 'default' ? result.intent : null,
                sentiment: result.sentiment,
                transcript: JSON.stringify(transcriptChunk),
                metadata: JSON.stringify({ sessionId: effectiveSessionId }),
              },
            })
          }
        } catch (sessionErr) {
          console.error('Failed to create/update ConversationSession:', sessionErr)
        }
      }
    } catch {
      // DB save failed - that's OK, the chat still works
    }

    // Build response — append action results if any
    let aiResponse = result.response
    if (result.actionResults && result.actionResults.length > 0) {
      const createActions = result.actionResults.filter(a => a.actionType === 'CREATE_RECORD' && a.success)
      if (createActions.length > 0) {
        // Extract reference numbers from action details
        for (const action of createActions) {
          const refMatch = action.details?.match(/case (MOEI-[\w-]+)/)
          if (refMatch) {
            if (result.language === 'ar') {
              aiResponse += `\n\nتم إنشاء طلب الخدمة تلقائياً.\nالرقم المرجعي: ${refMatch[1]}\nيمكنك متابعة حالة طلبك باستخدام هذا الرقم.`
            } else {
              aiResponse += `\n\nA service request has been automatically created for you.\nReference Number: ${refMatch[1]}\nYou can track your request status using this reference number.`
            }
          }
        }
      }
    }

    return c.json({
      response: aiResponse,
      intent: result.intent,
      sentiment: result.sentiment,
      sessionId: effectiveSessionId,
      language: result.language,
      languageDetectionMethod: 'auto',
      ...(result.matchedRule ? { matchedRule: result.matchedRule } : {}),
      ...(result.actionReady ? { actionReady: true } : {}),
      ...(result.actionResults?.length ? { actionResults: result.actionResults } : {}),
    })
  } catch (error) {
    console.error('Chat API error:', error)
    return c.json({
      response: 'Welcome to the Ministry of Energy and Infrastructure. How can I assist you today?',
      intent: 'default',
      sentiment: 0.5,
      sessionId: `session-${Date.now()}`,
      language: 'en',
    })
  }
})

export const chatRoutes = app
