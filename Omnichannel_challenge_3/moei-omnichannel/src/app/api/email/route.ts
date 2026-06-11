import { NextRequest, NextResponse } from 'next/server';

// Email API Route - Wraps Cloudflare Worker handler

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...data } = body;

    switch (action) {
      case 'send': {
        const { to, subject, body: emailBody, priority } = data;

        if (!to || !subject) {
          return NextResponse.json(
            { success: false, error: 'Recipient and subject are required' },
            { status: 400 }
          );
        }

        // In production, this would use SMTP or an email service API
        return NextResponse.json({
          success: true,
          data: {
            messageId: `email_${Date.now()}`,
            to,
            subject,
            status: 'sent',
            timestamp: new Date().toISOString(),
          },
          message: 'Email sent successfully',
        });
      }

      case 'search': {
        return NextResponse.json({
          success: true,
          data: [],
          message: 'Search results',
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
    case 'folders': {
      return NextResponse.json({
        success: true,
        data: [
          { id: 'f_inbox', name: 'Inbox', icon: 'inbox', count: 0, type: 'inbox' },
          { id: 'f_sent', name: 'Sent', icon: 'send', count: 0, type: 'sent' },
          { id: 'f_drafts', name: 'Drafts', icon: 'file-edit', count: 0, type: 'drafts' },
          { id: 'f_starred', name: 'Starred', icon: 'star', count: 0, type: 'custom' },
          { id: 'f_archive', name: 'Archive', icon: 'archive', count: 0, type: 'archive' },
          { id: 'f_spam', name: 'Spam', icon: 'alert-triangle', count: 0, type: 'spam' },
          { id: 'f_trash', name: 'Trash', icon: 'trash', count: 0, type: 'trash' },
        ],
      });
    }

    default:
      return NextResponse.json(
        { success: false, error: 'Invalid action' },
        { status: 400 }
      );
  }
}
