/**
 * Conversation Session Management Routes - Hono
 * 
 * Endpoints:
 *   GET  /conversations                     - List all active conversations
 *   GET  /conversations/:id                 - Get conversation detail with transcript and suggestions
 *   PUT  /conversations/:id/ai-mode         - Change AI mode for a conversation
 *   POST /conversations/:id/transfer        - Transfer conversation to another agent
 *   POST /conversations/:id/message         - Send message in a conversation
 *   GET  /conversations/:id/transcript      - Get STT transcript for a call
 *   POST /conversations/:id/transcript      - Add STT transcript chunk
 *   POST /conversations/:id/ai-suggest      - Get AI suggestion for employer
 *   POST /conversations/:id/translate       - Translate text between EN/AR
 *   PUT  /conversations/:id/close           - Close/end a conversation session (e.g., voice call ended)
 */

import { Hono } from 'hono'
import { db } from '../lib/db'

const app = new Hono()

// ─── GET /conversations ───────────────────────────────────────────────────────
// List all active conversations with customer info, agent info, AI mode
app.get('/conversations', async (c) => {
  try {
    const statusFilter = c.req.query('status')
    const channelFilter = c.req.query('channel')
    const agentFilter = c.req.query('agentId')

    const where: any = {}
    if (statusFilter) {
      where.status = statusFilter
    } else {
      // Default: show active/waiting + recently closed sessions (last 24h)
      // This ensures ended voice calls are still visible for review
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
      where.OR = [
        { status: { in: ['active', 'waiting'] } },
        { status: { in: ['closed', 'resolved'] }, endedAt: { gte: twentyFourHoursAgo } },
        { status: { in: ['closed', 'resolved'] }, updatedAt: { gte: twentyFourHoursAgo } },
      ]
    }
    if (channelFilter) where.channel = channelFilter
    if (agentFilter) where.agentId = agentFilter

    const sessions = await db.conversationSession.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: 50,
    })

    // Enrich with customer and agent info
    const enriched = await Promise.all(
      sessions.map(async (session) => {
        const customer = await db.customer.findUnique({
          where: { id: session.customerId },
          select: {
            id: true,
            nameEn: true,
            nameAr: true,
            email: true,
            phone: true,
            preferredLang: true,
            sentiment: true,
          },
        })

        const agent = session.agentId
          ? await db.agent.findUnique({
              where: { id: session.agentId },
              select: { id: true, name: true, nameAr: true, status: true },
            })
          : null

        // Check for voice recording
        let hasRecording = false
        let recordingDuration = 0
        if (session.channel === 'voice') {
          const recording = await db.voiceRecording.findUnique({
            where: { sessionId: session.id },
            select: { id: true, durationSeconds: true },
          })
          hasRecording = !!recording
          recordingDuration = recording?.durationSeconds || 0
        }

        // Compute unread count based on lastReadAt timestamp
        let unreadCount = 0
        try {
          if (session.lastReadAt) {
            // Count customer messages that arrived after the employer last read
            const transcript: any[] = session.transcript ? JSON.parse(session.transcript) : []
            const readTime = new Date(session.lastReadAt).getTime()
            unreadCount = transcript.filter((chunk: any) => {
              if (chunk.speaker !== 'customer') return false
              const chunkTime = chunk.timestamp ? new Date(chunk.timestamp).getTime() : 0
              return chunkTime > readTime
            }).length
            // Also check WAMessages for WhatsApp sessions
            if (session.channel === 'whatsapp' && unreadCount === 0) {
              const inboundWaMsgs = await db.wAMessage.count({
                where: {
                  conversationId: session.id,
                  isFromBusiness: false,
                  timestamp: { gte: session.lastReadAt.toISOString() },
                },
              })
              if (inboundWaMsgs > 0) unreadCount = inboundWaMsgs
            }
          } else {
            // Never read — count customer messages after the last agent/AI message
            const transcript: any[] = session.transcript ? JSON.parse(session.transcript) : []
            if (transcript.length > 0) {
              let lastAgentIdx = -1
              for (let i = transcript.length - 1; i >= 0; i--) {
                if (transcript[i].speaker === 'agent' || transcript[i].speaker === 'ai') {
                  lastAgentIdx = i
                  break
                }
              }
              unreadCount = transcript.filter((chunk: any, idx: number) =>
                chunk.speaker === 'customer' && idx > lastAgentIdx
              ).length
            }
            // Also check WAMessages for WhatsApp sessions
            if (session.channel === 'whatsapp' && unreadCount === 0) {
              const inboundWaMsgs = await db.wAMessage.count({
                where: {
                  conversationId: session.id,
                  isFromBusiness: false,
                  timestamp: { gte: session.updatedAt },
                },
              })
              if (inboundWaMsgs > 0) unreadCount = inboundWaMsgs
            }
          }
        } catch {
          // Non-critical: default to 0
        }

        return {
          id: session.id,
          customerId: session.customerId,
          customerName: customer?.nameEn || 'Unknown',
          customerNameAr: customer?.nameAr || '',
          channel: session.channel,
          status: session.status,
          aiMode: session.aiMode,
          language: session.language,
          intent: session.intent,
          sentiment: session.sentiment,
          caseId: session.caseId,
          serviceRequestId: session.serviceRequestId,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          customer,
          agent,
          hasRecording,
          recordingDuration,
          unreadCount,
        }
      })
    )

    return c.json({ conversations: enriched, count: enriched.length })
  } catch (error) {
    console.error('Conversations list error:', error)
    return c.json({ error: 'Failed to fetch conversations' }, 500)
  }
})

// ─── GET /conversations/:id ───────────────────────────────────────────────────
// Get conversation detail with full transcript and suggestions
app.get('/conversations/:id', async (c) => {
  try {
    const { id } = c.req.param()

    const session = await db.conversationSession.findUnique({
      where: { id },
      include: {
        agent: {
          select: { id: true, name: true, nameAr: true, email: true, status: true, role: true },
        },
      },
    })

    if (!session) {
      return c.json({ error: 'Conversation session not found' }, 404)
    }

    // Get customer info
    const customer = await db.customer.findUnique({
      where: { id: session.customerId },
      select: {
        id: true,
        nameEn: true,
        nameAr: true,
        email: true,
        phone: true,
        uaePassId: true,
        preferredLang: true,
        sentiment: true,
        emirate: true,
      },
    })

    // Get full transcript from STTTranscript table
    const transcriptChunks = await db.sTTTranscript.findMany({
      where: { sessionId: id },
      orderBy: { timestamp: 'asc' },
    })

    // Get interactions linked to the case
    let interactions: any[] = []
    if (session.caseId) {
      interactions = await db.interaction.findMany({
        where: { caseId: session.caseId },
        orderBy: { createdAt: 'asc' },
      })
    }

    return c.json({
      ...session,
      transcript: session.transcript ? JSON.parse(session.transcript) : [],
      aiSuggestions: session.aiSuggestions ? JSON.parse(session.aiSuggestions) : [],
      metadata: session.metadata ? JSON.parse(session.metadata) : {},
      customer,
      transcriptChunks,
      interactions,
    })
  } catch (error) {
    console.error('Conversation detail error:', error)
    return c.json({ error: 'Failed to fetch conversation' }, 500)
  }
})

// ─── PUT /conversations/:id/ai-mode ───────────────────────────────────────────
// Change AI mode for a conversation
app.put('/conversations/:id/ai-mode', async (c) => {
  try {
    const { id } = c.req.param()
    const body = await c.req.json()
    const { aiMode } = body

    const validModes = ['full_ai', 'ai_assist', 'llm_tts', 'human_only', 'ai_disabled']
    if (!aiMode || !validModes.includes(aiMode)) {
      return c.json({ error: `aiMode must be one of: ${validModes.join(', ')}` }, 400)
    }

    const session = await db.conversationSession.update({
      where: { id },
      data: { aiMode },
    })

    // Notify the agent
    if (session.agentId) {
      await db.employerNotification.create({
        data: {
          agentId: session.agentId,
          type: 'system',
          title: 'AI Mode Changed',
          titleAr: 'تم تغيير وضع الذكاء الاصطناعي',
          message: `AI mode for conversation ${id.slice(-8)} changed to ${aiMode}`,
          messageAr: `تم تغيير وضع الذكاء الاصطناعي للمحادثة ${id.slice(-8)} إلى ${aiMode}`,
          priority: 'normal',
          metadata: JSON.stringify({ sessionId: id, aiMode }),
        },
      })
    }

    return c.json({
      sessionId: session.id,
      aiMode: session.aiMode,
      updatedAt: session.updatedAt,
    })
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return c.json({ error: 'Conversation session not found' }, 404)
    }
    console.error('AI mode update error:', error)
    return c.json({ error: 'Failed to update AI mode' }, 500)
  }
})

// ─── POST /conversations/:id/transfer ─────────────────────────────────────────
// Transfer conversation to another agent
app.post('/conversations/:id/transfer', async (c) => {
  try {
    const { id } = c.req.param()
    const body = await c.req.json()
    const { targetAgentId, reason, priority } = body

    if (!targetAgentId) {
      return c.json({ error: 'targetAgentId is required' }, 400)
    }

    // Verify target agent exists
    const targetAgent = await db.agent.findUnique({ where: { id: targetAgentId } })
    if (!targetAgent) {
      return c.json({ error: 'Target agent not found' }, 404)
    }

    const session = await db.conversationSession.findUnique({ where: { id } })
    if (!session) {
      return c.json({ error: 'Conversation session not found' }, 404)
    }

    // Update session with new agent
    const updated = await db.conversationSession.update({
      where: { id },
      data: {
        agentId: targetAgentId,
        transferredFrom: session.agentId,
        transferredAt: new Date(),
        status: 'transferred',
      },
    })

    // Notify target agent
    await db.employerNotification.create({
      data: {
        agentId: targetAgentId,
        type: 'transfer',
        title: 'Conversation Transferred',
        titleAr: 'تم تحويل محادثة',
        message: `A ${session.channel} conversation has been transferred to you. Reason: ${reason || 'Not specified'}`,
        messageAr: `تم تحويل محادثة ${session.channel === 'voice' ? 'صوتية' : session.channel === 'whatsapp' ? 'واتساب' : 'نصية'} إليك. السبب: ${reason || 'غير محدد'}`,
        priority: 'high',
        link: `/conversations/${id}`,
        metadata: JSON.stringify({ sessionId: id, fromAgentId: session.agentId, reason, priority }),
      },
    })

    // Notify previous agent
    if (session.agentId) {
      await db.employerNotification.create({
        data: {
          agentId: session.agentId,
          type: 'transfer',
          title: 'Conversation Transferred Out',
          titleAr: 'تم تحويل محادثة منك',
          message: `Your ${session.channel} conversation was transferred to ${targetAgent.name}. Reason: ${reason || 'Not specified'}`,
          messageAr: `تم تحويل محادثتك ${session.channel === 'voice' ? 'الصوتية' : session.channel === 'whatsapp' ? 'عبر واتساب' : 'النصية'} إلى ${targetAgent.nameAr || targetAgent.name}. السبب: ${reason || 'غير محدد'}`,
          priority: 'normal',
          metadata: JSON.stringify({ sessionId: id, toAgentId: targetAgentId, reason, priority }),
        },
      })
    }

    return c.json({
      sessionId: updated.id,
      previousAgentId: session.agentId,
      newAgentId: targetAgentId,
      transferredAt: updated.transferredAt,
    })
  } catch (error) {
    console.error('Conversation transfer error:', error)
    return c.json({ error: 'Failed to transfer conversation' }, 500)
  }
})

// ─── POST /conversations/:id/message ──────────────────────────────────────────
// Send message in a conversation (from employer or AI)
// For WhatsApp sessions, also saves a WAMessage so customer sees reply in their WhatsApp view
app.post('/conversations/:id/message', async (c) => {
  try {
    const { id } = c.req.param()
    const body = await c.req.json()
    const { content, sender, language } = body

    if (!content) {
      return c.json({ error: 'content is required' }, 400)
    }
    if (!sender || !['agent', 'ai'].includes(sender)) {
      return c.json({ error: 'sender must be "agent" or "ai"' }, 400)
    }

    const session = await db.conversationSession.findUnique({ where: { id } })
    if (!session) {
      return c.json({ error: 'Conversation session not found' }, 404)
    }

    // Create interaction
    const interaction = await db.interaction.create({
      data: {
        customerId: session.customerId,
        caseId: session.caseId,
        channel: session.channel,
        type: 'message',
        direction: 'outbound',
        content,
        intent: session.intent || 'response',
        sentiment: session.sentiment,
        language: language || session.language || 'en',
        metadata: JSON.stringify({
          sessionId: id,
          sender,
          aiGenerated: sender === 'ai',
        }),
      },
    })

    // Update session transcript
    const currentTranscript = session.transcript ? JSON.parse(session.transcript) : []
    currentTranscript.push({
      speaker: sender,
      text: content,
      timestamp: new Date().toISOString(),
      language: language || session.language || 'en',
    })
    await db.conversationSession.update({
      where: { id },
      data: { transcript: JSON.stringify(currentTranscript) },
    })

    // For WhatsApp sessions, also save WAMessage so customer sees the reply in WhatsApp view
    if (session.channel === 'whatsapp') {
      try {
        const businessPhone = process.env.WA_BUSINESS_PHONE || '+9718006634'

        // Ensure business WAContact exists
        const businessContact = await db.wAContact.upsert({
          where: { phone: businessPhone },
          update: {},
          create: { name: 'MOEI Support', phone: businessPhone, isBusiness: true },
        })

        // Get customer phone
        let customerPhone = 'unknown'
        try {
          const customer = await db.customer.findUnique({
            where: { id: session.customerId },
            select: { phone: true },
          })
          if (customer?.phone) customerPhone = customer.phone
        } catch { /* use fallback */ }

        await db.wAMessage.create({
          data: {
            conversationId: id,
            toPhone: customerPhone,
            text: content,
            timestamp: new Date().toISOString(),
            status: 'sent',
            type: 'text',
            isFromBusiness: true,
            contact: { connect: { phone: businessPhone } },
          },
        })
      } catch (waErr) {
        console.error('Failed to save WAMessage for agent reply:', waErr)
      }
    }

    return c.json({
      messageId: interaction.id,
      content: interaction.content,
      sender,
      timestamp: interaction.createdAt,
    })
  } catch (error) {
    console.error('Conversation message error:', error)
    return c.json({ error: 'Failed to send message' }, 500)
  }
})

// ─── GET /conversations/:id/transcript ────────────────────────────────────────
// Get STT transcript for a call
app.get('/conversations/:id/transcript', async (c) => {
  try {
    const { id } = c.req.param()

    const session = await db.conversationSession.findUnique({ where: { id } })
    if (!session) {
      return c.json({ error: 'Conversation session not found' }, 404)
    }

    const transcriptChunks = await db.sTTTranscript.findMany({
      where: { sessionId: id },
      orderBy: { timestamp: 'asc' },
    })

    return c.json({
      sessionId: id,
      channel: session.channel,
      language: session.language,
      transcriptChunks,
      count: transcriptChunks.length,
    })
  } catch (error) {
    console.error('Transcript GET error:', error)
    return c.json({ error: 'Failed to fetch transcript' }, 500)
  }
})

// ─── POST /conversations/:id/transcript ───────────────────────────────────────
// Add STT transcript chunk
app.post('/conversations/:id/transcript', async (c) => {
  try {
    const { id } = c.req.param()
    const body = await c.req.json()
    const { speaker, text, language } = body

    if (!text) {
      return c.json({ error: 'text is required' }, 400)
    }
    if (!speaker || !['customer', 'agent', 'ai'].includes(speaker)) {
      return c.json({ error: 'speaker must be "customer", "agent", or "ai"' }, 400)
    }

    const session = await db.conversationSession.findUnique({ where: { id } })
    if (!session) {
      return c.json({ error: 'Conversation session not found' }, 404)
    }

    // Save to STTTranscript table
    const transcriptChunk = await db.sTTTranscript.create({
      data: {
        sessionId: id,
        speaker,
        text,
        language: language || session.language || 'en',
      },
    })

    // Also update session transcript JSON
    const currentTranscript = session.transcript ? JSON.parse(session.transcript) : []
    currentTranscript.push({
      speaker,
      text,
      timestamp: new Date().toISOString(),
      language: language || session.language || 'en',
    })
    await db.conversationSession.update({
      where: { id },
      data: { transcript: JSON.stringify(currentTranscript) },
    })

    return c.json({
      chunkId: transcriptChunk.id,
      speaker: transcriptChunk.speaker,
      text: transcriptChunk.text,
      timestamp: transcriptChunk.timestamp,
    }, 201)
  } catch (error) {
    console.error('Transcript POST error:', error)
    return c.json({ error: 'Failed to add transcript chunk' }, 500)
  }
})

// ─── POST /conversations/:id/ai-suggest ───────────────────────────────────────
// Get AI suggestion for employer
app.post('/conversations/:id/ai-suggest', async (c) => {
  try {
    const { id } = c.req.param()
    const body = await c.req.json()
    const { context, language } = body

    const session = await db.conversationSession.findUnique({ where: { id } })
    if (!session) {
      return c.json({ error: 'Conversation session not found' }, 404)
    }

    // Get transcript for context
    const recentTranscript = await db.sTTTranscript.findMany({
      where: { sessionId: id },
      orderBy: { timestamp: 'desc' },
      take: 10,
    })

    const transcriptText = recentTranscript
      .reverse()
      .map((t) => `${t.speaker}: ${t.text}`)
      .join('\n')

    const effectiveLanguage = language || session.language || 'en'

    // Use z-ai-web-dev-sdk for suggestion
    let suggestion = ''
    try {
      const { default: ZAI } = await import('z-ai-web-dev-sdk')
      const zai = await ZAI.create()

      const systemPrompt = effectiveLanguage === 'ar'
        ? `أنت مساعد ذكي لوكيل خدمة العملاء في وزارة الطاقة والبنية التحتية الإماراتية (MOEI).
بناءً على محادثة العميل أدناه، اقترح ردًا مناسبًا أو إجراءً يجب أن يتخذه الوكيل.
كن موجزاً ومهنياً. قدم اقتراحك فقط بدون شرح إضافي.
إذا كان الموقف يتطلب تصعيدًا، اقترح ذلك.`
        : `You are a smart assistant for a customer service agent at the UAE Ministry of Energy & Infrastructure (MOEI).
Based on the customer conversation below, suggest an appropriate response or action the agent should take.
Be concise and professional. Provide only your suggestion without additional explanation.
If the situation requires escalation, suggest that.`

      const userMessage = context
        ? `${effectiveLanguage === 'ar' ? 'سياق إضافي' : 'Additional context'}: ${context}\n\n${effectiveLanguage === 'ar' ? 'المحادثة' : 'Conversation'}:\n${transcriptText}`
        : `${effectiveLanguage === 'ar' ? 'المحادثة' : 'Conversation'}:\n${transcriptText}`

      const result = await zai.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        model: 'glm-4-flash',
      })
      suggestion = result.choices?.[0]?.message?.content || result.content || ''
    } catch {
      suggestion = effectiveLanguage === 'ar'
        ? 'يرجى مراجعة المحادثة والرد بشكل مناسب.'
        : 'Please review the conversation and respond appropriately.'
    }

    // Save suggestion to session
    const currentSuggestions = session.aiSuggestions ? JSON.parse(session.aiSuggestions) : []
    const newSuggestion = {
      id: `sug-${Date.now()}`,
      suggestion,
      language: effectiveLanguage,
      timestamp: new Date().toISOString(),
      context: context || null,
    }
    currentSuggestions.push(newSuggestion)
    await db.conversationSession.update({
      where: { id },
      data: { aiSuggestions: JSON.stringify(currentSuggestions) },
    })

    return c.json({
      suggestion: newSuggestion,
      language: effectiveLanguage,
    })
  } catch (error) {
    console.error('AI suggest error:', error)
    return c.json({ error: 'Failed to get AI suggestion' }, 500)
  }
})

// ─── POST /conversations/:id/translate ────────────────────────────────────────
// Translate text between EN/AR
app.post('/conversations/:id/translate', async (c) => {
  try {
    const { id } = c.req.param()
    const body = await c.req.json()
    const { text, from, to } = body

    if (!text) {
      return c.json({ error: 'text is required' }, 400)
    }
    if (!from || !to) {
      return c.json({ error: 'from and to languages are required' }, 400)
    }

    const session = await db.conversationSession.findUnique({ where: { id } })
    if (!session) {
      return c.json({ error: 'Conversation session not found' }, 404)
    }

    let translatedText = ''
    try {
      const { default: ZAI } = await import('z-ai-web-dev-sdk')
      const zai = await ZAI.create()

      const result = await zai.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: `You are a professional translator for the UAE Ministry of Energy & Infrastructure (MOEI). Translate the following text from ${from} to ${to}. Only output the translation, nothing else. Maintain a professional and formal tone appropriate for government communications.`,
          },
          { role: 'user', content: text },
        ],
        model: 'glm-4-flash',
      })
      translatedText = result.choices?.[0]?.message?.content || result.content || ''
    } catch {
      translatedText = text // Return original if translation fails
    }

    // Save translation to transcript if applicable
    if (translatedText && translatedText !== text) {
      await db.sTTTranscript.create({
        data: {
          sessionId: id,
          speaker: 'ai',
          text: `[Translation ${from}->to}]: ${text}`,
          language: to,
          translatedText,
          translatedLang: to,
        },
      })
    }

    return c.json({
      original: text,
      translated: translatedText,
      from,
      to,
    })
  } catch (error) {
    console.error('Translation error:', error)
    return c.json({ error: 'Failed to translate text' }, 500)
  }
})

// ─── GET /conversations/:id/messages ──────────────────────────────────────────
// Get chat messages for a conversation session (from transcript JSON)
app.get('/conversations/:id/messages', async (c) => {
  try {
    const { id } = c.req.param()

    const session = await db.conversationSession.findUnique({
      where: { id },
    })

    if (!session) {
      return c.json({ error: 'Conversation session not found' }, 404)
    }

    // Parse transcript from session
    const transcript = session.transcript ? JSON.parse(session.transcript) : []

    // Also try to get messages from interactions table as fallback
    const interactions = await db.interaction.findMany({
      where: {
        customerId: session.customerId,
        channel: session.channel,
        type: 'message',
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    })

    // Convert transcript to message format
    const messages = transcript.map((chunk: any, idx: number) => {
      // Map speaker to role
      let role: 'customer' | 'agent' | 'ai' = 'customer'
      if (chunk.speaker === 'ai') role = 'ai'
      else if (chunk.speaker === 'agent') role = 'agent'
      else role = 'customer'

      return {
        id: chunk.id || `msg-${id}-${idx}`,
        role,
        content: chunk.text || '',
        timestamp: chunk.timestamp || new Date().toISOString(),
        language: chunk.language || session.language || 'en',
      }
    })

    // If transcript is empty, try to build from interactions
    if (messages.length === 0 && interactions.length > 0) {
      for (const interaction of interactions) {
        messages.push({
          id: interaction.id,
          role: interaction.direction === 'inbound' ? 'customer' : (interaction.metadata && JSON.parse(interaction.metadata).aiGenerated ? 'ai' : 'agent'),
          content: interaction.content,
          timestamp: interaction.createdAt.toISOString(),
          language: interaction.language || session.language || 'en',
        })
      }
    }

    return c.json({
      messages,
      count: messages.length,
      sessionId: id,
      channel: session.channel,
    })
  } catch (error) {
    console.error('Messages GET error:', error)
    return c.json({ error: 'Failed to fetch messages' }, 500)
  }
})

// ─── GET /conversations/:id/suggestions ───────────────────────────────────────
// Get AI suggestions for a conversation session
app.get('/conversations/:id/suggestions', async (c) => {
  try {
    const { id } = c.req.param()

    const session = await db.conversationSession.findUnique({
      where: { id },
    })

    if (!session) {
      return c.json({ error: 'Conversation session not found' }, 404)
    }

    // Parse suggestions from session
    const rawSuggestions = session.aiSuggestions ? JSON.parse(session.aiSuggestions) : []

    // Convert to the format expected by conversation-detail
    const suggestions = rawSuggestions.map((s: any, idx: number) => ({
      id: s.id || `sug-${id}-${idx}`,
      text: s.suggestion || s.text || '',
      confidence: s.confidence || 0.7,
      type: s.type || 'response',
    }))

    return c.json({
      suggestions,
      count: suggestions.length,
      sessionId: id,
    })
  } catch (error) {
    console.error('Suggestions GET error:', error)
    return c.json({ error: 'Failed to fetch suggestions' }, 500)
  }
})

// ─── PUT /conversations/:id/read ─────────────────────────────────────────────
// Mark a conversation as read by the employer (updates lastReadAt timestamp)
app.put('/conversations/:id/read', async (c) => {
  try {
    const { id } = c.req.param()

    const session = await db.conversationSession.findUnique({ where: { id } })
    if (!session) {
      return c.json({ error: 'Conversation session not found' }, 404)
    }

    await db.conversationSession.update({
      where: { id },
      data: { lastReadAt: new Date() },
    })

    return c.json({ sessionId: id, lastReadAt: new Date().toISOString() })
  } catch (error) {
    console.error('Mark as read error:', error)
    return c.json({ error: 'Failed to mark as read' }, 500)
  }
})

// ─── PUT /conversations/:id/close ─────────────────────────────────────────────
// Close/end a conversation session (e.g., when a voice call disconnects)
app.put('/conversations/:id/close', async (c) => {
  try {
    const { id } = c.req.param()
    const body = await c.req.json().catch(() => ({}))
    const { reason } = body as { reason?: string }

    const session = await db.conversationSession.findUnique({ where: { id } })
    if (!session) {
      return c.json({ error: 'Conversation session not found' }, 404)
    }

    if (session.status === 'closed' || session.status === 'resolved') {
      return c.json({ error: 'Session is already closed', sessionId: id, status: session.status }, 400)
    }

    const updated = await db.conversationSession.update({
      where: { id },
      data: {
        status: 'closed',
        endedAt: new Date(),
      },
    })

    // For voice sessions, ensure recording metadata is set
    if (session.channel === 'voice') {
      try {
        const recording = await db.voiceRecording.findUnique({
          where: { sessionId: id },
        })
        if (recording) {
          const meta = JSON.parse(session.metadata || '{}')
          meta.hasRecording = true
          meta.recordingDuration = recording.durationSeconds
          await db.conversationSession.update({
            where: { id },
            data: { metadata: JSON.stringify(meta) },
          })
        }
      } catch {
        // Non-critical
      }
    }

    return c.json({
      sessionId: updated.id,
      status: updated.status,
      endedAt: updated.endedAt,
      reason: reason || null,
    })
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return c.json({ error: 'Conversation session not found' }, 404)
    }
    console.error('Session close error:', error)
    return c.json({ error: 'Failed to close session' }, 500)
  }
})

export const conversationRoutes = app
