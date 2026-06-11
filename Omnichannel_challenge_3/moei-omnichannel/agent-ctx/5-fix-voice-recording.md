# Task 5: Add multi-voice labels to voice recording/transcript

## Agent: fix-voice-recording

## Changes Made

### 1. Enhanced TranscriptLine (call-center-panel.tsx)
- [CUSTOMER]: Blue left border, User icon, "Customer" label, blue-50 bg
- [AI]: Amber left border, Sparkles icon, "AI Assistant" label, amber-50 bg
- [AGENT]: Green left border, Headphones icon, "You (Agent)" label, emerald-50 bg
- [SYSTEM]: Gray left border, Bot icon, "System" label, gray-50 bg
- [AI_THINKING]: Purple left border, Brain icon (animated), "AI Thinking..." label (animated), purple-50 bg

### 2. Added TranscriptSpeakerLegend component
- Color-coded dots: blue=Customer, amber=AI, green=Agent, gray=System, purple=AI Thinking
- Added above transcript scroll area in ActiveCallView

### 3. Updated SttTranscriptView (stt-transcript-view.tsx)
- Customer: blue-50 bg + blue-300 border + border-l-[3px] border-l-blue-500 + blue-100 badge
- AI: amber-50 bg + amber-300 border + border-l-[3px] border-l-amber-500 + amber-100 badge
- Agent: emerald-50 bg + emerald-300 border + border-l-[3px] border-l-emerald-500 + emerald-100 badge
- Agent label: "You (Agent)" instead of "Agent"
- Added speaker legend above transcript chunks with i18n support

### 4. Enhanced Recording Player (conversation-detail.tsx)
- Clickable progress bar for audio seeking
- Speaker timeline visualization bar with colored segments
- Speaker legend with color-coded circles
- Added Circle icon import from lucide-react

### 5. Added [AGENT] Speaker Support
- voice-ai.ts: accepts `sender` parameter ('customer' | 'agent')
- voice agent chat-message handler: emits transcript with role 'employer'
- useVoiceAgent.ts: TranscriptMessage.role includes 'employer'
- session-view.tsx: employer messages in green with "You (Agent)" label
- callSmartBrain() in voice agent: passes sender='agent' for chat messages

## Files Modified
- src/pages/components/agent/call-center-panel.tsx
- src/components/agent/stt-transcript-view.tsx
- src/components/agent/conversation-detail.tsx
- src/worker/voice-agent/index.ts
- src/worker/routes/voice-ai.ts
- src/pages/hooks/useVoiceAgent.ts
- src/pages/components/voice/session-view.tsx
