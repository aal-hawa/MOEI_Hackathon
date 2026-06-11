# Task 3-a: Fix footer sticky positioning and add read/unread indicators

## Summary
Fixed two issues on the Agent Dashboard:
1. Footer not being sticky - added `shrink-0` to footer, removed `pb-16 md:pb-0` mobile nav padding
2. Added read/unread message indicators to Active Conversations panel

## Files Modified
- `src/components/shared/layouts/moei-page-layout.tsx` - Added `shrink-0` to MoeiFooter
- `src/pages/views/Admin.tsx` - Removed `pb-16 md:pb-0` from content area
- `src/pages/store/app-store.ts` - Added `unreadCount` field to ConversationSession, added `markSessionRead` action
- `src/components/agent/conversation-panel.tsx` - Added unread indicator UI, bold name for unread, mark-as-read on click
- `src/worker/routes/conversations.ts` - Added unreadCount computation in GET /conversations response

## Key Decisions
- unreadCount computed server-side from transcript: customer messages after last agent/AI message
- WhatsApp sessions also check WAMessage table for additional unread messages
- Unread indicator uses blue dot + count badge as specified
- markSessionRead is a client-side optimistic update (sets unreadCount to 0 immediately)
