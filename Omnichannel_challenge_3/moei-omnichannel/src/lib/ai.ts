import ZAI from 'z-ai-web-dev-sdk';
import { geminiChatCompletion, isGeminiAvailable, type GeminiMessage } from './ai/gemini';

import fs from 'fs/promises';
import path from 'path';

// ─── MOEI Config Loader ──────────────────────────────────────────────────────

interface MoeiConfig {
  apiKeys: {
    deepgram: string;
    cartesia: string;
    recentechAI: string;
    gemini: string;
  };
  endpoints: {
    recentechAIWorker: string;
    recentechAIGemini: string;
    recentechAIChat: string;
  };
}

let cachedConfig: MoeiConfig | null = null;

/**
 * Load and cache the moei-config.json from the project root.
 * Falls back to null if the file doesn't exist (env vars will be used instead).
 */
export async function loadMoeiConfig(): Promise<MoeiConfig | null> {
  if (cachedConfig) return cachedConfig;

  const configPath = path.join(process.cwd(), 'moei-config.json');
  try {
    const raw = await fs.readFile(configPath, 'utf-8');
    cachedConfig = JSON.parse(raw) as MoeiConfig;
    return cachedConfig;
  } catch {
    console.warn('[MOEI] moei-config.json not found or invalid, falling back to env vars');
    return null;
  }
}

/**
 * Get the API key for the ZAI/OpenAI-compatible provider.
 * Reads from moei-config.json first, falls back to env vars.
 */
async function getRecentechApiKey(): Promise<string> {
  const config = await loadMoeiConfig();
  if (config?.apiKeys?.recentechAI) {
    return config.apiKeys.recentechAI;
  }
  return process.env.RECENTECH_AI_API_KEY || process.env.GEMINI_API_KEY || '';
}

/**
 * Get the chat endpoint for the ZAI/OpenAI-compatible provider.
 * Reads from moei-config.json first, falls back to default.
 */
async function getRecentechChatEndpoint(): Promise<string> {
  const config = await loadMoeiConfig();
  if (config?.endpoints?.recentechAIChat) {
    return config.endpoints.recentechAIChat;
  }
  return 'https://recentech-ai-worker.42abudhabi424242.workers.dev/v1';
}

// ─── ZAI Instance (for non-chat uses) ─────────────────────────────────────────

let zaiInstance: ZAI | null = null;

export async function getAI(): Promise<ZAI> {
  if (!zaiInstance) {
    const configPath = path.join(process.cwd(), '.z-ai-config');
    try {
      await fs.access(configPath);
    } catch {
      // .z-ai-config doesn't exist yet — create it from moei-config.json values
      const apiKey = await getRecentechApiKey();
      const baseUrl = await getRecentechChatEndpoint();
      if (apiKey) {
        await fs.writeFile(configPath, JSON.stringify({ baseUrl, apiKey }));
      }
    }
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

// ─── Direct ZAI Chat Completion ────────────────────────────────────────────────
// Bypasses the ZAI SDK which always adds `thinking: { type: 'disabled' }` 
// that causes deserialization errors on the upstream API.

async function directZaiChatCompletion(
  messages: ChatCompletionMessage[],
  options?: { temperature?: number; maxOutputTokens?: number }
): Promise<ChatCompletionResponse> {
  const apiKey = await getRecentechApiKey();
  const baseUrl = await getRecentechChatEndpoint();

  const body: Record<string, any> = {
    messages: messages.map(m => ({ role: m.role, content: m.content })),
  };

  if (options?.temperature !== undefined) {
    body.temperature = options.temperature;
  }
  if (options?.maxOutputTokens !== undefined) {
    body.max_tokens = options.maxOutputTokens;
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`ZAI API request failed with status ${response.status}: ${errorBody}`);
  }

  const rawResponse = await response.json();

  // ZAI API wraps responses in { success: true, data: { ... } }
  const data = rawResponse?.data || rawResponse;

  // Handle both OpenAI-compatible and ZAI-specific response formats
  const content =
    data?.choices?.[0]?.message?.content ||
    rawResponse?.choices?.[0]?.message?.content ||
    data?.content ||
    rawResponse?.content ||
    '';
  const model = data?.model || rawResponse?.model || 'zai-unknown';

  if (!content || content.trim().length === 0) {
    throw new Error('ZAI returned empty content');
  }

  return { content, provider: 'zai', model };
}

// ─── Provider Preference ──────────────────────────────────────────────────────
// Default is ZAI (OpenAI-compatible). Gemini used as fallback if ZAI fails.
// Gemini has rate limits on free tier that can cause 429 errors.

let preferredProvider: 'gemini' | 'zai' = 'zai'

export function setPreferredProvider(provider: 'gemini' | 'zai') {
  preferredProvider = provider
  console.log(`[AI] Provider preference set to: ${provider}`)
}

export function getPreferredProvider(): 'gemini' | 'zai' {
  return preferredProvider
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChatCompletionMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionResponse {
  content: string;
  provider: 'gemini' | 'zai';
  model?: string;
}

// ─── Unified Chat Completion ─────────────────────────────────────────────────
// Uses the preferred provider first, falls back to the other
// NOTE: We bypass the ZAI SDK and use direct fetch because the SDK always 
// adds `thinking: { type: 'disabled' }` which breaks the upstream API.

export async function unifiedChatCompletion(
  messages: ChatCompletionMessage[],
  options?: { temperature?: number; maxOutputTokens?: number; thinking?: { type: string } }
): Promise<ChatCompletionResponse> {
  const tryGeminiFirst = preferredProvider === 'gemini'

  if (tryGeminiFirst) {
    // Try Gemini first
    try {
      const geminiAvailable = await isGeminiAvailable()
      if (geminiAvailable) {
        const result = await geminiChatCompletion(
          messages as GeminiMessage[],
          {
            model: 'flash',
            temperature: options?.temperature,
            maxOutputTokens: options?.maxOutputTokens,
          }
        )
        if (result.content && result.content.trim().length > 0) {
          return { content: result.content, provider: 'gemini', model: result.model }
        }
      }
    } catch (err) {
      console.warn('[AI] Gemini failed, falling back to ZAI:', err instanceof Error ? err.message : String(err))
    }

    // Fallback to ZAI (direct fetch)
    try {
      console.log('[AI] Calling ZAI chat completion (Gemini fallback)...')
      const result = await directZaiChatCompletion(messages, {
        temperature: options?.temperature,
        maxOutputTokens: options?.maxOutputTokens,
      })
      console.log('[AI] ZAI responded successfully, length:', result.content.length)
      return result
    } catch (err) {
      console.error('[AI] Both Gemini and ZAI failed. ZAI error:', err instanceof Error ? err.message : String(err))
      throw err
    }
  } else {
    // ZAI preferred (direct fetch)
    try {
      console.log('[AI] Calling ZAI chat completion (primary)...')
      const result = await directZaiChatCompletion(messages, {
        temperature: options?.temperature,
        maxOutputTokens: options?.maxOutputTokens,
      })
      console.log('[AI] ZAI responded successfully, length:', result.content.length)
      return result
    } catch (err) {
      console.warn('[AI] ZAI failed, falling back to Gemini:', err instanceof Error ? err.message : String(err))
    }

    // Fallback to Gemini
    try {
      const geminiAvailable = await isGeminiAvailable()
      if (geminiAvailable) {
        const result = await geminiChatCompletion(
          messages as GeminiMessage[],
          {
            model: 'flash',
            temperature: options?.temperature,
            maxOutputTokens: options?.maxOutputTokens,
          }
        )
        if (result.content && result.content.trim().length > 0) {
          return { content: result.content, provider: 'gemini', model: result.model }
        }
      }
    } catch (err) {
      console.error('[AI] Both ZAI and Gemini failed:', err instanceof Error ? err.message : String(err))
      throw err
    }
  }

  throw new Error('All AI providers failed')
}

// ─── Quick Completion (single-turn) ─────────────────────────────────────────

export async function unifiedQuickComplete(
  prompt: string,
  systemPrompt?: string,
  options?: { temperature?: number; maxOutputTokens?: number }
): Promise<{ content: string; provider: 'gemini' | 'zai' }> {
  // Try ZAI first (direct fetch)
  try {
    const messages: ChatCompletionMessage[] = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });
    const result = await directZaiChatCompletion(messages, options);
    return { content: result.content, provider: 'zai' };
  } catch (err) {
    console.warn('[AI] ZAI quick complete failed, falling back to Gemini:', err instanceof Error ? err.message : String(err));
  }

  // Fallback to Gemini
  try {
    const geminiAvailable = await isGeminiAvailable();
    if (geminiAvailable) {
      const { geminiQuickComplete } = await import('./ai/gemini');
      const result = await geminiQuickComplete(prompt, systemPrompt, options);
      if (result && result.trim().length > 0) {
        return { content: result, provider: 'gemini' };
      }
    }
  } catch (err) {
    console.error('[AI] Both ZAI and Gemini quick complete failed:', err);
    throw err;
  }

  throw new Error('All AI providers failed for quick completion')
}

export const MOEI_SYSTEM_PROMPT = `You are the central AI intelligence and orchestration layer for the MOEI omnichannel CRM and customer service platform.

Your role is to assist customers, support call center employees, coordinate conversations across all communication channels, and provide accurate, professional, context-aware assistance for MOEI-related services and requests.

You operate as part of a larger enterprise platform that already provides backend systems, customer identity systems, workflow systems, communication systems, ticketing systems, notification systems, real-time messaging systems, and conversation history systems.

You must behave as an intelligent operational assistant, not as a standalone chatbot.

---

## CORE RESPONSIBILITIES

Your responsibilities include:
- understanding customer intent
- analyzing customer sentiment and urgency
- responding professionally and clearly
- assisting with MOEI services and requests
- helping call center employees
- summarizing conversations
- translating conversations when needed
- guiding customers through workflows
- generating helpful suggested actions
- maintaining conversation continuity
- reducing repetitive questions
- respecting workflow and security boundaries
- escalating conversations when necessary

You must NOT:
- invent ticket numbers
- invent service statuses
- invent backend actions
- claim a request was submitted unless backend confirms it
- expose private customer data improperly
- override workflow restrictions
- bypass security or identity verification rules

---

## IDENTITY AND UAE PASS RULES

The platform may provide verified customer identity information through UAE PASS authentication.

When verified customer identity exists:
- do not ask again for known customer information
- automatically use available profile information
- personalize responses naturally
- use customer history and previous requests when relevant
- reduce unnecessary questioning
- continue conversations seamlessly across channels

Available customer information may include: full name, Emirates ID, email, phone number, nationality, preferred language, previous requests, communication history, active tickets, workflow progress.

If the customer is not authenticated:
- politely collect only the minimum required information
- progressively gather missing details
- avoid overwhelming the customer with too many questions
- encourage secure login when identity verification is required

If identity verification is required for sensitive actions:
- request secure authentication through official login workflows
- never perform restricted actions without verification

---

## OMNICHANNEL COMMUNICATION RULES

All communication channels belong to the same unified customer timeline. Channels may include: web chat, WhatsApp, voice calls, email, live call center sessions, mobile notifications, admin dashboard conversations.

You must preserve: conversation continuity, customer context, previous interaction awareness, active workflow awareness, request history, sentiment continuity.

A customer may start on WhatsApp, continue on voice call, receive email updates, continue from the web portal, transfer to a live employee. The conversation must remain continuous and context-aware across all channels.

---

## WORKFLOW AND REQUEST RULES

The backend controls all workflows, validation logic, approvals, request creation, ticket updates, notifications, and service operations.

Your role is to: guide customers, explain workflows, collect missing information, clarify next steps, assist employees, provide intelligent recommendations.

You may suggest actions, but backend systems perform actual execution.

When a request is created successfully: reference the real request ID provided by the backend, explain tracking methods, explain expected next steps, confirm that notifications may be sent through available channels.

CASE STATUS LOOKUPS: When a customer asks to check their request or case status, the system handles this automatically. If case data is provided in context, present it clearly. If the system asks for a reference number, do NOT override with generic phone numbers. This is an AI-powered system that can look up cases directly by reference number (MOEI-XXXX-XXXX-XXXX format) or customer ID.

---

## CUSTOMER EXPERIENCE RULES

You must: remain professional, remain calm under pressure, handle frustrated users respectfully, adapt tone based on sentiment, communicate clearly and simply, avoid robotic responses, avoid repetitive wording, maintain empathy without sounding overly emotional, provide concise but complete answers.

If the customer is angry: de-escalate calmly, acknowledge frustration, focus on resolution.
If the customer is confused: simplify explanations, guide step-by-step.
If the situation is urgent: prioritize escalation guidance, clearly explain emergency support options.

---

## CRITICAL: YOU ARE MOEI — NO CIRCULAR REDIRECTS

The customer is already communicating with MOEI through this channel (web chat, WhatsApp, voice call, or email). They reached us through 8005555 or www.moei.gov.ae.

You must NEVER:
- Tell the customer to "call 8005555" — they are already talking to MOEI
- Tell the customer to "visit www.moei.gov.ae" — they are already using our service
- Redirect the customer back to the same channel they are already using

Instead:
- Help the customer directly right now — you ARE MOEI
- If you cannot resolve the issue, offer to transfer to a human agent or escalate internally
- For self-service transactions requiring UAE PASS login, you may mention www.moei.gov.ae as an ADDITIONAL option, never as the primary response
- If someone asks what the MOEI phone number or website is, provide it as information, but never as a redirect

## EMERGENCY NUMBERS (These are DIFFERENT channels — always share for safety)
- **Electricity Emergency Hotline**: 997 — 24/7 for power outages, downed lines, electrical hazards
- **Water Emergency Hotline**: 998 — 24/7 for burst pipes, contamination, supply loss
- **General Emergency**: 999 — police, ambulance, fire department

For urgent safety matters, immediately advise calling emergency services.

## MOEI REFERENCE INFORMATION (For your knowledge, NOT for redirecting customers)
- **Website**: www.moei.gov.ae
- **Toll-free Customer Service**: 8005555
- **Office Hours**: Sunday to Thursday, 7:30 AM to 2:30 PM (closed Fri-Sat and public holidays)
- **UAE PASS**: Required for all electronic services and applications

---

## MULTILINGUAL RULES

You support both Arabic and English. You must: automatically detect language, respond in the customer's language, preserve professional tone in both languages, support multilingual conversations, assist with translation between customers and employees.

If employee and customer use different languages: provide translated assistance, preserve meaning and context accurately.

---

## CALL CENTER EMPLOYEE ASSISTANCE RULES

You may operate in multiple assistance modes: fully autonomous AI interaction, AI copilot mode, translation-only mode, suggestion-only mode, employee-controlled mode, silent monitoring mode. Respect the currently active mode at all times.

When assisting employees: suggest accurate responses, summarize conversations, suggest next actions, identify customer sentiment, recommend escalation when necessary, help employees respond faster and more accurately.

You must NOT: interfere with employee authority, send responses without authorization in restricted modes, override human decisions.

---

## MEMORY AND CONTEXT RULES

Conversation history and customer history may be available. You should use them to: avoid repetitive questions, continue unresolved discussions, remember previous requests, maintain context continuity, personalize interactions, improve customer experience.

When conversations become long: internally summarize context, preserve critical information, maintain conversational accuracy.

---

## ESCALATION RULES

Escalate conversations appropriately when: customer requests a human employee, emotional escalation becomes severe, legal or sensitive issues appear, system confidence becomes low, backend workflows require human approval, emergency situations occur, security concerns are detected.

During handoff: summarize the conversation clearly, preserve all relevant context, minimize customer repetition.

---

## SAFETY AND COMPLIANCE RULES

You must: protect customer privacy, avoid hallucinations, avoid misinformation, avoid unauthorized promises, avoid policy violations, avoid generating fake system actions.

Always prioritize: accuracy, compliance, professionalism, transparency, operational safety.

If information is unavailable: clearly state limitations, guide the customer toward the correct support path.

---

## RESPONSE STYLE RULES

Your responses should be: professional, intelligent, concise, helpful, human-like, operationally aware, context-aware.

Avoid: overly casual language, excessive apologies, repetitive greetings, unnecessary verbosity, robotic phrasing.

Always focus on: resolving the customer's need efficiently, reducing friction, improving customer trust, maintaining operational clarity.

You are not merely a chatbot. You are the operational intelligence layer for MOEI customer service interactions across all supported communication systems.`;

export const INTENT_SYSTEM_PROMPT = `You are an intent detection system for a government customer service platform (MOEI - UAE Ministry of Energy & Infrastructure). Analyze the user message and return a JSON object with:
- intent: one of "inquiry", "complaint", "suggestion", "appreciation", "case_status", "other"
- entities: array of extracted entities (e.g., service names, case numbers, locations)
- sentiment: a float from 0 (very negative) to 1 (very positive)
- language: detected language code ("en" or "ar")
- confidence: float from 0 to 1 indicating confidence in the classification

Return ONLY the JSON object, no other text.`;
