---
Task ID: 13, 14, 15
Agent: Main Agent
Task: AI Models - Add providers/models, move Chat Messages, save features to backend

Work Log:

**Task 13: Add more AI providers and famous models**
- Replaced static AI_PROVIDERS array with dynamic `buildAIProviders()` function that checks localStorage for API keys
- Added `apiKeyStorageKey` field to AIProviderDef interface for per-provider key storage
- Expanded OpenAI models: added GPT-4 Turbo, o1, o1-mini (total 6 models)
- Expanded Anthropic models: added Claude 3.5 Haiku, Claude 3 Opus with proper API model IDs (total 3 models)
- Expanded Google models: added Gemini 1.5 Flash (total 4 models)
- Expanded Meta models: added Llama 3.1 405B with proper API model IDs (total 3 models)
- Expanded Mistral models: added Codestral (total 3 models)
- Updated DeepSeek model IDs to match API conventions: deepseek-chat, deepseek-reasoner
- Added `configured` field that dynamically checks `localStorage.getItem('api_key_{provider}')`
- Z AI and Google are always marked as "Configured" (server-side keys)
- Grouped providers visually: "Configured" section and "Available (API key required)" section
- Extracted ProviderButton into its own sub-component for reusability

**Task 14: Move Chat Messages from AI Config panel to Settings panel**
- Removed "Chat Messages" tab from AI Config Panel (was Tab 2 of 5)
- Changed tab grid from `grid-cols-5` to `grid-cols-4`
- Created ChatWidgetSection component in user-settings-panel.tsx
- Added full i18n support (Arabic/English) for the Chat Widget section
- Added all necessary imports (MessageSquare, Globe, Check, Edit3, Loader2, etc.)
- Added ChatConfigItem interface and CONFIG_LABELS constant
- Added invalidateChatConfigCache import for cache invalidation
- ChatWidgetSection includes: loading state, config listing, edit mode with EN/AR tabs, save/cancel buttons
- Placed ChatWidgetSection as section 5 (between Accessibility and Activity Log) in Settings panel

**Task 15: Save AI feature settings to backend**
- Created AIFeatureSettings Prisma model with fields: enableRAG, enableSentiment, enableIntent, enableAutoCase, aiProvider, aiModel, temperature, maxTokens, responseLanguage
- Ran `bun run db:push` to sync schema
- Created `/api/ai-config` API route with GET and PUT handlers
  - GET: Returns settings from DB, creates defaults if none exist
  - PUT: Updates settings with partial data, supports upsert
- Updated AIModelSettings to load from backend on mount (falls back to localStorage)
- Added debounced `saveToBackend()` that saves all settings changes to the API
- Added `savingToBackend` state with spinner indicator
- AI feature descriptions were already present in AI_FEATURES constant (RAG, Sentiment, Intent, Auto Case)
- Both localStorage AND backend are synced on every change (dual persistence)

**Lint Check:**
- Ran `bun run lint` - all errors are pre-existing (not from our changes)
- No new errors introduced in ai-config-panel.tsx, user-settings-panel.tsx, or ai-config/route.ts

Stage Summary:
- AI Providers expanded from 12 models to 21 models across 7 providers
- Provider "configured" status dynamically checks localStorage for API keys
- Providers visually grouped into "Configured" and "Available" sections
- Chat Messages moved from AI Config panel (Tab 2) to Settings panel (Section 5: Chat Widget)
- AI Config panel now has 4 tabs: AI Models, Voice Pipeline, Knowledge, Analytics
- AI feature settings (RAG, Sentiment, Intent, Auto Case) + model settings saved to backend via /api/ai-config
- Settings load from backend on mount with localStorage fallback
- All changes save to both localStorage and backend (debounced, 800ms)
