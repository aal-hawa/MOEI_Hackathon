import { NextRequest, NextResponse } from 'next/server';

/**
 * MOEI Chat API — Next.js Route Handler
 *
 * This is the primary chat endpoint that the frontend calls.
 * It proxies to the BrainOrchestrator which handles:
 *   BEFORE: Customer profile loading, language detection
 *   BRAIN: SmartBrain.think() — AI thinking
 *   AFTER: Dynamic action execution (CREATE_RECORD, SEND_EMAIL, etc.)
 *
 * Supports two request formats:
 * 1. MOEI Chat: { message, sessionId, language, customerId }
 * 2. WhatsApp Sim: { messages, contactName, conversationContext }
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // ── Format 1: MOEI Chat (from ai-chat-widget.tsx) ──
    if (body.message && !body.messages) {
      const { message, sessionId, language, customerId } = body as {
        message: string;
        sessionId?: string;
        language?: string;
        customerId?: string;
      };

      if (!message || message.trim().length === 0) {
        return NextResponse.json(
          { success: false, error: 'Message is required' },
          { status: 400 }
        );
      }

      // Forward to the worker's BrainOrchestrator-powered chat endpoint
      const workerPort = process.env.WORKER_PORT || '3002';
      const workerUrl = `http://localhost:${workerPort}/api/chat`;

      const workerRes = await fetch(workerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message.trim(),
          sessionId: sessionId || `session-${Date.now()}`,
          language: language || 'en',
          customerId: customerId || undefined,
        }),
      });

      if (workerRes.ok) {
        const data = await workerRes.json();
        return NextResponse.json(data);
      }

      // If worker fails, try direct BrainOrchestrator fallback
      console.error('[Chat API] Worker failed:', workerRes.status, await workerRes.text().catch(() => ''));

      return NextResponse.json({
        response: language === 'ar'
          ? 'مرحباً بك في وزارة الطاقة والبنية التحتية. كيف يمكنني مساعدتك اليوم؟'
          : 'Welcome to the Ministry of Energy and Infrastructure. How can I assist you today?',
        intent: 'default',
        sentiment: 0.5,
        sessionId: sessionId || `session-${Date.now()}`,
        language: language || 'en',
      });
    }

    // ── Format 2: WhatsApp Simulation (from whatsapp panel) ──
    if (body.messages && Array.isArray(body.messages)) {
      // Proxy to the worker's WhatsApp AI endpoint
      const workerPort = process.env.WORKER_PORT || '3002';
      const workerUrl = `http://localhost:${workerPort}/api/ai/chat`;

      const workerRes = await fetch(workerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (workerRes.ok) {
        const data = await workerRes.json();
        return NextResponse.json(data);
      }

      return NextResponse.json(
        { success: false, error: 'Worker unavailable' },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Invalid request format. Provide "message" or "messages".' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[Chat API] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
