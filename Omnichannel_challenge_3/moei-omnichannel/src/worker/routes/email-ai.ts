/**
 * Email AI Route - Sends email message to AI and returns response
 * POST /api/ai/email
 *
 * Flow (mirrors whatsapp-ai.ts exactly):
 * 1. Receive customer email message
 * 2. Find/create customer + session in DB
 * 3. Save inbound message to transcript + interaction + EmailMsg + EmailMessage
 * 4. Call BrainOrchestrator to get AI response (channel: 'email')
 * 5. Save AI response to transcript + interaction + EmailMsg
 * 6. Return AI response to customer
 *
 * ONE BRAIN for all channels — this is just the email adapter.
 */

import { Hono } from 'hono'
import { sanitizeInput } from '../lib/edge-security'
import { db } from '../lib/db'
import { BrainOrchestrator } from '../lib/brain-orchestrator'

const app = new Hono()

app.post('/ai/email', async (c) => {
  try {
    const body = await c.req.json()
    const {
      message, subject, sessionId, language,
      customerId, customerName, customerNameAr,
      customerEmail, customerPhone,
      uaePassId, emiratesId, nationality, gender,
      dateOfBirth, isVerified,
    } = body as {
      message: string
      subject?: string
      sessionId?: string
      language?: string
      customerId?: string
      customerName?: string
      customerNameAr?: string
      customerEmail?: string
      customerPhone?: string
      uaePassId?: string
      emiratesId?: string
      nationality?: string
      gender?: string
      dateOfBirth?: string
      isVerified?: boolean
    }

    if (!message) {
      return c.json({ error: 'message is required' }, 400)
    }

    const sanitizedMessage = sanitizeInput(message, 4000)
    const effectiveSessionId = sessionId || `em-${Date.now()}`
    const effectiveLanguage = language || 'en'
    const effectiveSubject = subject || 'Inquiry'

    let savedCustomerId = customerId
    let conversationSessionId: string | null = null

    // ── Find or create customer using email/phone/uaePassId ──
    try {
      if (!savedCustomerId) {
        let existingCustomer = await db.customer.findFirst({
          where: {
            OR: [
              ...(customerEmail ? [{ email: customerEmail }] : []),
              ...(customerPhone ? [{ phone: customerPhone }] : []),
              ...(uaePassId ? [{ uaePassId }] : []),
              ...(emiratesId ? [{ emiratesId }] : []),
            ],
          },
        })

        if (existingCustomer) {
          savedCustomerId = existingCustomer.id
          // Update any missing fields from UAE PASS profile
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
          // Create new customer with all profile info
          const newCustomer = await db.customer.create({
            data: {
              nameEn: customerName || 'Email Customer',
              nameAr: customerNameAr || null,
              email: customerEmail || `em-${effectiveSessionId.replace('em-', '').slice(0, 16)}@moei.ae`,
              phone: customerPhone || null,
              uaePassId: uaePassId || null,
              emiratesId: emiratesId || null,
              nationality: nationality || null,
              gender: gender || null,
              dateOfBirth: dateOfBirth || null,
              isVerified: isVerified || false,
              preferredLang: effectiveLanguage,
              preferredChannel: 'email',
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
    try {
      if (savedCustomerId) {
        const existingSession = await db.conversationSession.findFirst({
          where: {
            customerId: savedCustomerId,
            status: { in: ['active', 'waiting'] },
            channel: 'email',
          },
          orderBy: { createdAt: 'desc' },
        })

        if (existingSession) {
          conversationSessionId = existingSession.id
          const currentTranscript = existingSession.transcript ? JSON.parse(existingSession.transcript) : []
          currentTranscript.push({
            speaker: 'customer',
            text: sanitizedMessage,
            timestamp: new Date().toISOString(),
            language: effectiveLanguage,
            subject: effectiveSubject,
          })
          await db.conversationSession.update({
            where: { id: existingSession.id },
            data: {
              transcript: JSON.stringify(currentTranscript),
              updatedAt: new Date(),
            },
          })
        } else {
          const newSession = await db.conversationSession.create({
            data: {
              customerId: savedCustomerId,
              channel: 'email',
              status: 'active',
              aiMode: 'full_ai',
              language: effectiveLanguage,
              transcript: JSON.stringify([{
                speaker: 'customer',
                text: sanitizedMessage,
                timestamp: new Date().toISOString(),
                language: effectiveLanguage,
                subject: effectiveSubject,
              }]),
              metadata: JSON.stringify({
                sessionId: effectiveSessionId,
                customerName: customerName || 'Email Customer',
                customerEmail: customerEmail || '',
                subject: effectiveSubject,
                source: 'email',
              }),
            },
          })
          conversationSessionId = newSession.id
        }
      }
    } catch (sessionErr) {
      console.error('Failed to create/update Email ConversationSession:', sessionErr)
    }

    // ── Save inbound interaction ──
    try {
      if (savedCustomerId) {
        await db.interaction.create({
          data: {
            customerId: savedCustomerId,
            channel: 'email',
            type: 'message',
            direction: 'inbound',
            content: sanitizedMessage,
            language: effectiveLanguage,
            metadata: JSON.stringify({ subject: effectiveSubject }),
          },
        })
      }
    } catch {
      // Interaction save is optional
    }

    // ── Save inbound customer email as EmailMsg ──
    let inboundEmailMsgId: string | null = null
    try {
      const emailMsg = await db.emailMsg.create({
        data: {
          fromEmail: customerEmail || 'unknown@unknown.com',
          fromName: customerName || 'Unknown',
          toEmails: JSON.stringify(['moei@moei.gov.ae']),
          subject: effectiveSubject,
          body: sanitizedMessage,
          timestamp: new Date().toISOString(),
          folder: 'inbox',
          labels: JSON.stringify(['inbox']),
        },
      })
      inboundEmailMsgId = emailMsg.id

      // Also save to EmailMessage table
      if (savedCustomerId) {
        await db.emailMessage.create({
          data: {
            customerId: savedCustomerId,
            fromAddress: customerEmail || 'unknown@unknown.com',
            toAddress: 'moei@moei.gov.ae',
            subject: effectiveSubject,
            body: sanitizedMessage,
            direction: 'inbound',
            status: 'received',
            threadId: emailMsg.threadId,
          },
        })
      }
    } catch (emailMsgErr) {
      console.error('Failed to save inbound EmailMsg:', emailMsgErr)
    }

    // ═══════════════════════════════════════════════════════════════
    // ║  CALL BRAIN ORCHESTRATOR — Send message to AI, get response  ║
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
          // Take the last 20 messages for context (before the current one was added)
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
        channel: 'email',
        language: effectiveLanguage as 'ar' | 'en',
        customerId: savedCustomerId,
        customerPhone: customerPhone,
        customerEmail: customerEmail,
        sessionId: effectiveSessionId,
        conversationHistory,
        aiMode: 'full_ai',
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

      // ── Save AI response to session transcript ──
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
          }
        } catch (transcriptErr) {
          console.error('Failed to update transcript with AI response:', transcriptErr)
        }

        // ── Save AI response as outbound interaction ──
        try {
          await db.interaction.create({
            data: {
              customerId: savedCustomerId || 'unknown',
              channel: 'email',
              type: 'message',
              direction: 'outbound',
              content: aiResponse,
              intent: aiIntent,
              sentiment: aiSentiment,
              language: effectiveLanguage,
              metadata: JSON.stringify({
                sessionId: effectiveSessionId,
                aiGenerated: true,
                provider: aiProvider,
                subject: `Re: ${effectiveSubject}`,
              }),
            },
          })
        } catch {
          // Interaction save is optional
        }

        // ── Save AI response as EmailMsg (so customer sees it in inbox) ──
        try {
          await db.emailMsg.create({
            data: {
              fromEmail: 'moei@moei.gov.ae',
              fromName: effectiveLanguage === 'ar' ? 'دعم وزارة الطاقة' : 'MOEI Support',
              toEmails: JSON.stringify([customerEmail || 'unknown']),
              subject: effectiveSubject.startsWith('Re:') ? effectiveSubject : `Re: ${effectiveSubject}`,
              body: aiResponse,
              timestamp: new Date().toISOString(),
              folder: 'sent',
              direction: 'outbound',
            },
          })
        } catch (emailErr) {
          console.error('Failed to save AI response EmailMsg:', emailErr)
        }
      }
    } catch (aiErr) {
      console.error('BrainOrchestrator failed for email:', aiErr)
      aiResponse = effectiveLanguage === 'ar'
        ? 'أعتذر، أواجه صعوبة تقنية مؤقتة. يرجى المحاولة مرة أخرى.'
        : 'I apologize, I am experiencing a temporary technical difficulty. Please try again.'
    }

    // ═══════════════════════════════════════════════════════════════
    // ║  Return AI response to customer                               ║
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
      subject: effectiveSubject,
    })
  } catch (error) {
    console.error('Email AI route error:', error)
    return c.json({
      response: 'I apologize, I am experiencing a temporary technical difficulty. Please try again.',
      intent: 'default',
      sentiment: 0.5,
      sessionId: `em-${Date.now()}`,
      language: 'en',
    })
  }
})

export const emailAiRoutes = app
