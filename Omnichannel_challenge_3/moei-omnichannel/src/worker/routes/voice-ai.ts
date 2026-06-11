/**
 * Voice AI Route - Sends voice message to AI and returns response
 * POST /api/ai/voice
 *
 * This is the Voice channel adapter that uses the SAME Smart Brain
 * as WhatsApp and Email channels via BrainOrchestrator.
 *
 * Flow (mirrors whatsapp-ai.ts and email-ai.ts):
 * 1. Receive transcribed voice message from Voice Agent service
 * 2. Find/create customer + session in DB
 * 3. Save inbound message to transcript + STTTranscript + interaction
 * 4. Call BrainOrchestrator to get AI response
 * 5. Save AI response to transcript + STTTranscript + interaction
 * 6. Return AI response to Voice Agent for TTS playback
 *
 * ONE BRAIN for all channels — this is just the voice adapter.
 */

import { Hono } from 'hono'
import { sanitizeInput } from '../lib/edge-security'
import { db } from '../lib/db'
import { BrainOrchestrator } from '../lib/brain-orchestrator'

const app = new Hono()

app.post('/ai/voice', async (c) => {
  try {
    const body = await c.req.json()
    const {
      message, sessionId, language,
      customerId, customerName, customerNameAr,
      customerPhone, customerEmail,
      uaePassId, emiratesId, nationality, gender,
      dateOfBirth, isVerified, aiMode,
      conversationSessionId: existingConversationSessionId,
      sender,
    } = body as {
      message: string
      sessionId?: string
      language?: string
      customerId?: string
      customerName?: string
      customerNameAr?: string
      customerPhone?: string
      customerEmail?: string
      uaePassId?: string
      emiratesId?: string
      nationality?: string
      gender?: string
      dateOfBirth?: string
      isVerified?: boolean
      aiMode?: 'full_ai' | 'ai_assist' | 'llm_tts' | 'human_only' | 'ai_disabled'
      conversationSessionId?: string
      sender?: 'customer' | 'agent'
    }

    if (!message) {
      return c.json({ error: 'message is required' }, 400)
    }

    const sanitizedMessage = sanitizeInput(message, 2000)
    const effectiveSessionId = sessionId || `vc-${Date.now()}`
    const effectiveLanguage = language || 'en'
    const effectiveAiMode = aiMode || 'full_ai'
    const effectiveSender = sender || 'customer' // Default to customer if not specified

    let savedCustomerId = customerId
    let conversationSessionId: string | null = null

    // ── Find or create customer using phone/email/uaePassId ──
    try {
      if (!savedCustomerId) {
        let existingCustomer = await db.customer.findFirst({
          where: {
            OR: [
              ...(customerPhone ? [{ phone: customerPhone }] : []),
              ...(customerEmail ? [{ email: customerEmail }] : []),
              ...(uaePassId ? [{ uaePassId }] : []),
              ...(emiratesId ? [{ emiratesId }] : []),
            ],
          },
        })

        if (existingCustomer) {
          savedCustomerId = existingCustomer.id
          // Update any missing fields from profile
          const updates: Record<string, any> = {}
          if (!existingCustomer.phone && customerPhone) updates.phone = customerPhone
          if (!existingCustomer.email && customerEmail) updates.email = customerEmail
          if (!existingCustomer.uaePassId && uaePassId) updates.uaePassId = uaePassId
          if (!existingCustomer.emiratesId && emiratesId) updates.emiratesId = emiratesId
          if (!existingCustomer.nameAr && customerNameAr) updates.nameAr = customerNameAr
          if (!existingCustomer.nationality && nationality) updates.nationality = nationality
          if (!existingCustomer.gender && gender) updates.gender = gender
          if (!existingCustomer.dateOfBirth && dateOfBirth) updates.dateOfBirth = dateOfBirth
          if (!existingCustomer.isVerified && isVerified) updates.isVerified = true
          if (Object.keys(updates).length > 0) {
            await db.customer.update({ where: { id: existingCustomer.id }, data: updates })
          }
        } else {
          // Create new customer
          const newCustomer = await db.customer.create({
            data: {
              nameEn: customerName || 'Voice Customer',
              nameAr: customerNameAr || null,
              email: customerEmail || `vc-${effectiveSessionId.replace('vc-', '').slice(0, 16)}@moei.ae`,
              phone: customerPhone || null,
              uaePassId: uaePassId || null,
              emiratesId: emiratesId || null,
              nationality: nationality || null,
              gender: gender || null,
              dateOfBirth: dateOfBirth || null,
              isVerified: isVerified || false,
              preferredLang: effectiveLanguage,
              preferredChannel: 'voice',
              sentiment: 0.5,
            },
          })
          savedCustomerId = newCustomer.id
        }
      }
    } catch {
      // Customer creation is optional
    }

    // ── Find or create ConversationSession ──
    // Priority: 1) By conversationSessionId from voice agent, 2) By customerId + channel + active status
    try {
      if (savedCustomerId) {
        let existingSession = null

        // First try to find by the conversationSessionId passed from voice agent
        if (existingConversationSessionId) {
          try {
            existingSession = await db.conversationSession.findUnique({
              where: { id: existingConversationSessionId },
            })
            // Verify this session belongs to the same customer and is still relevant
            if (existingSession && existingSession.customerId !== savedCustomerId) {
              existingSession = null // Mismatch, will search by customer instead
            }
          } catch {
            // Ignore, fall through to customer-based search
          }
        }

        // Fallback: find by customer + channel + active status
        if (!existingSession) {
          existingSession = await db.conversationSession.findFirst({
            where: {
              customerId: savedCustomerId,
              status: { in: ['active', 'waiting'] },
              channel: 'voice',
            },
            orderBy: { createdAt: 'desc' },
          })
        }

        if (existingSession) {
          conversationSessionId = existingSession.id
          const currentTranscript = existingSession.transcript ? JSON.parse(existingSession.transcript) : []
          currentTranscript.push({
            speaker: effectiveSender,
            text: sanitizedMessage,
            timestamp: new Date().toISOString(),
            language: effectiveLanguage,
          })
          await db.conversationSession.update({
            where: { id: existingSession.id },
            data: {
              transcript: JSON.stringify(currentTranscript),
              status: 'active', // Ensure it's active
              updatedAt: new Date(),
            },
          })

          // Save customer STT chunk to STTTranscript table for voice transcript view
          try {
            await db.sTTTranscript.create({
              data: {
                sessionId: existingSession.id,
                speaker: effectiveSender,
                text: sanitizedMessage,
                language: effectiveLanguage,
              },
            })
          } catch (sttErr) {
            console.error('Failed to save customer STT transcript chunk:', sttErr)
          }
        } else {
          const newSession = await db.conversationSession.create({
            data: {
              customerId: savedCustomerId,
              channel: 'voice',
              status: 'active',
              aiMode: effectiveAiMode,
              language: effectiveLanguage,
              transcript: JSON.stringify([{
                speaker: effectiveSender,
                text: sanitizedMessage,
                timestamp: new Date().toISOString(),
                language: effectiveLanguage,
              }]),
              metadata: JSON.stringify({
                sessionId: effectiveSessionId,
                customerName: customerName || 'Voice Customer',
                source: 'voice',
              }),
            },
          })
          conversationSessionId = newSession.id

          // Save customer STT chunk to STTTranscript table for voice transcript view
          try {
            await db.sTTTranscript.create({
              data: {
                sessionId: newSession.id,
                speaker: effectiveSender,
                text: sanitizedMessage,
                language: effectiveLanguage,
              },
            })
          } catch (sttErr) {
            console.error('Failed to save customer STT transcript chunk:', sttErr)
          }
        }
      }
    } catch (sessionErr) {
      console.error('Failed to create/update Voice ConversationSession:', sessionErr)
    }

    // ── Save inbound interaction ──
    try {
      if (savedCustomerId) {
        await db.interaction.create({
          data: {
            customerId: savedCustomerId,
            caseId: (await db.conversationSession.findUnique({ where: { id: conversationSessionId! }, select: { caseId: true } }))?.caseId,
            channel: 'voice',
            type: 'message',
            direction: 'inbound',
            content: sanitizedMessage,
            language: effectiveLanguage,
            metadata: JSON.stringify({
              sessionId: effectiveSessionId,
              conversationSessionId,
              sender: effectiveSender,
              source: 'voice',
            }),
          },
        })
      }
    } catch {
      // Interaction save is optional
    }

    // ═══════════════════════════════════════════════════════════════
    // ║  CALL BRAIN ORCHESTRATOR — Same Smart Brain as WhatsApp/Email ║
    // ═══════════════════════════════════════════════════════════════

    let aiResponse = ''
    let aiIntent = 'inquiry'
    let aiSentiment = 0.5
    let aiProvider: 'gemini' | 'zai' | 'fallback' = 'fallback'

    // ── Load conversation history from DB transcript ──
    let conversationHistory: Array<{ speaker: string; text: string }> = []
    try {
      if (conversationSessionId) {
        const session = await db.conversationSession.findUnique({
          where: { id: conversationSessionId },
          select: { transcript: true },
        })
        if (session?.transcript) {
          const transcript = JSON.parse(session.transcript)
          const historyEntries = transcript.slice(0, -1).slice(-20)
          conversationHistory = historyEntries.map((entry: any) => ({
            speaker: entry.speaker === 'customer' ? 'customer' : 'ai',
            text: entry.text || '',
          })).filter((entry: any) => entry.text.trim().length > 0)
        }
      }
    } catch (historyErr) {
      console.error('Failed to load conversation history:', historyErr)
    }

    try {
      const result = await BrainOrchestrator.handleMessage({
        message: sanitizedMessage,
        channel: 'voice',
        language: effectiveLanguage as 'ar' | 'en',
        customerId: savedCustomerId,
        customerPhone: customerPhone,
        customerEmail: customerEmail,
        sessionId: effectiveSessionId,
        conversationHistory,
        aiMode: effectiveAiMode,
      })

      aiResponse = result.response
      aiIntent = result.intent
      aiSentiment = result.sentiment
      aiProvider = result.provider

      // Build response with action results if any
      if (result.actionResults && result.actionResults.length > 0) {
        const createActions = result.actionResults.filter(a => a.actionType === 'CREATE_RECORD' && a.success)
        if (createActions.length > 0) {
          for (const action of createActions) {
            const refMatch = action.details?.match(/case (MOEI-[\w-]+)/)
            if (refMatch) {
              if (effectiveLanguage === 'ar') {
                aiResponse += `\n\nتم إنشاء طلب الخدمة تلقائياً.\nالرقم المرجعي: ${refMatch[1]}\nيمكنك متابعة حالة طلبك باستخدام هذا الرقم.`
              } else {
                aiResponse += `\n\nA service request has been automatically created for you.\nReference Number: ${refMatch[1]}\nYou can track your request status using this reference number.`
              }
            }
          }
        }
      }

      // ── Save AI response to session transcript + STTTranscript + interaction ──
      if (conversationSessionId) {
        try {
          const session = await db.conversationSession.findUnique({ where: { id: conversationSessionId } })
          if (session) {
            const currentTranscript = session.transcript ? JSON.parse(session.transcript) : []
            currentTranscript.push({
              speaker: 'ai',
              text: aiResponse,
              timestamp: new Date().toISOString(),
              language: effectiveLanguage,
            })
            await db.conversationSession.update({
              where: { id: conversationSessionId },
              data: {
                transcript: JSON.stringify(currentTranscript),
                intent: aiIntent !== 'default' ? aiIntent : session.intent,
                sentiment: aiSentiment,
                updatedAt: new Date(),
              },
            })

            // Save AI response as STT transcript chunk for voice transcript view
            try {
              await db.sTTTranscript.create({
                data: {
                  sessionId: conversationSessionId,
                  speaker: 'ai',
                  text: aiResponse,
                  language: effectiveLanguage,
                },
              })
            } catch (sttErr) {
              console.error('Failed to save AI STT transcript chunk:', sttErr)
            }
          }
        } catch (transcriptErr) {
          console.error('Failed to update transcript with AI response:', transcriptErr)
        }

        // ── Save AI response as outbound interaction ──
        try {
          await db.interaction.create({
            data: {
              customerId: savedCustomerId || 'unknown',
              caseId: (await db.conversationSession.findUnique({ where: { id: conversationSessionId }, select: { caseId: true } }))?.caseId,
              channel: 'voice',
              type: 'message',
              direction: 'outbound',
              content: aiResponse,
              intent: aiIntent,
              sentiment: aiSentiment,
              language: effectiveLanguage,
              metadata: JSON.stringify({
                sessionId: effectiveSessionId,
                conversationSessionId,
                aiGenerated: true,
                provider: aiProvider,
                source: 'voice',
              }),
            },
          })
        } catch {
          // Interaction save is optional
        }
      }
    } catch (aiErr) {
      console.error('BrainOrchestrator failed for voice:', aiErr)
      aiResponse = effectiveLanguage === 'ar'
        ? 'أعتذر، أواجه صعوبة تقنية مؤقتة. يرجى المحاولة مرة أخرى.'
        : 'I apologize, I am experiencing a temporary technical difficulty. Please try again.'
    }

    // ═══════════════════════════════════════════════════════════════
    // ║  Return AI response to Voice Agent for TTS playback             ║
    // ═══════════════════════════════════════════════════════════════

    return c.json({
      response: aiResponse,
      intent: aiIntent,
      sentiment: aiSentiment,
      sessionId: effectiveSessionId,
      language: effectiveLanguage,
      conversationSessionId,
      customerId: savedCustomerId,
      provider: aiProvider,
    })
  } catch (error) {
    console.error('Voice AI route error:', error)
    return c.json({
      response: 'I apologize, I am experiencing a temporary technical difficulty. Please try again.',
      intent: 'default',
      sentiment: 0.5,
      sessionId: `vc-${Date.now()}`,
      language: 'en',
    })
  }
})

export const voiceAiRoutes = app
