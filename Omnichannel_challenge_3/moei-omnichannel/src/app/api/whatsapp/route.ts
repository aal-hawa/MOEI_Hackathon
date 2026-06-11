import { NextRequest, NextResponse } from 'next/server';

// WhatsApp Business API Route - Wraps Cloudflare Worker handler
// This allows the same worker logic to run in both Next.js and Cloudflare Workers

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...data } = body;

    switch (action) {
      case 'send': {
        // Simulate sending WhatsApp message
        const { to, type, text, templateId, templateParameters } = data;
        
        if (!to) {
          return NextResponse.json(
            { success: false, error: 'Recipient phone number is required' },
            { status: 400 }
          );
        }

        // In production, this would call the WhatsApp Business Cloud API
        return NextResponse.json({
          success: true,
          data: {
            messageId: `wamid_${Date.now()}`,
            to,
            type,
            status: 'sent',
            timestamp: new Date().toISOString(),
          },
          message: 'Message sent successfully',
        });
      }

      case 'webhook': {
        // Process webhook event
        return NextResponse.json({
          success: true,
          processed: 0,
          message: 'Webhook processed',
        });
      }

      case 'templates': {
        // Return templates (in production, fetch from WhatsApp API)
        return NextResponse.json({
          success: true,
          data: [],
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  switch (action) {
    case 'templates': {
      return NextResponse.json({
        success: true,
        data: [],
      });
    }

    case 'webhook': {
      const mode = searchParams.get('hub.mode');
      const token = searchParams.get('hub.verify_token');
      const challenge = searchParams.get('hub.challenge');

      if (mode === 'subscribe') {
        return new Response(challenge || '', { status: 200 });
      }
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    default:
      return NextResponse.json(
        { success: false, error: 'Invalid action' },
        { status: 400 }
      );
  }
}
