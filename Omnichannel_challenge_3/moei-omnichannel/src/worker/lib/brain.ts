/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║              MOEI SMART BRAIN — DB-FIRST AI BRAIN               ║
 * ║          The ONE Brain for ALL Communication Channels            ║
 * ╠══════════════════════════════════════════════════════════════════╣
 * ║                                                                  ║
 * ║  Architecture:                                                   ║
 * ║                                                                  ║
 * ║    Channel (WhatsApp)  ─┐                                        ║
 * ║    Channel (Web Chat)  ─┼─► Smart Brain ─► Response ─► Channel   ║
 * ║    Channel (Voice)     ─┤                                        ║
 * ║    Channel (Email)     ─┘                                        ║
 * ║                                                                  ║
 * ║  Like a human: one brain, many hands.                            ║
 * ║  The brain doesn't care which channel the message came from.     ║
 * ║  It thinks the same way regardless.                              ║
 * ║  Channels only handle formatting and delivery.                   ║
 * ║                                                                  ║
 * ║  THIS IS A TRULY SMART AI BRAIN.                                 ║
 * ║  - DB-First: Loads customer profile, rules, cases BEFORE AI     ║
 * ║  - Service Rule Aware: Knows mandatory fields & gaps             ║
 * ║  - Action-Ready: Detects when all fields are present             ║
 * ║  - Conversational: AI naturally asks for missing fields          ║
 * ║                                                                  ║
 * ║  Flow:                                                           ║
 * ║    1. Detect language (local utility)                            ║
 * ║    2. Load customer context from DB                              ║
 * ║    3. AI classifies intent & matches ServiceRule                 ║
 * ║    4. If matched: check fields → ask or act                      ║
 * ║    5. If no match: general AI response with KB                   ║
 * ║    6. Return structured output                                   ║
 * ║                                                                  ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Usage:
 *   import { SmartBrain } from '../lib/brain'
 *   const result = await SmartBrain.think({
 *     message: 'I need help with electricity',
 *     channel: 'whatsapp',
 *     language: 'en',
 *     customerId: 'clx123...',
 *     conversationHistory: [...],
 *   })
 *   console.log(result.response)       // The AI response
 *   console.log(result.intent)         // AI-detected intent
 *   console.log(result.sentiment)      // AI-analyzed sentiment
 *   console.log(result.matchedRule)    // Matched service rule (if any)
 *   console.log(result.missingFields)  // Fields the customer still needs to provide
 *   console.log(result.actionReady)    // true if all mandatory fields are present
 */

import { unifiedChatCompletion, type ChatCompletionMessage } from '../../lib/ai'
import { MOEI_SYSTEM_PROMPTS } from '../../lib/ai/moei-agent'
import { searchKnowledgeBase } from '../../lib/moei-knowledge-base'
import { db } from './db'

// ─── Types ──────────────────────────────────────────────────────────────────

export type ChannelType = 'whatsapp' | 'web' | 'voice' | 'email'
export type LanguageType = 'ar' | 'en'

export interface BrainInput {
  /** The customer's message text */
  message: string
  /** Which channel this message came from */
  channel: ChannelType
  /** Detected or provided language */
  language?: LanguageType
  /** Customer ID from DB (primary lookup) */
  customerId?: string
  /** Phone number to look up customer */
  customerPhone?: string
  /** Email to look up customer */
  customerEmail?: string
  /** Conversation session ID */
  sessionId?: string
  /** Override context (if no DB access) — backward compatible */
  customerContext?: string
  /** Recent conversation transcript: [{speaker, text}] */
  conversationHistory?: Array<{ speaker: string; text: string }>
  /** Optional: AI mode override */
  aiMode?: 'full_ai' | 'ai_assist' | 'llm_tts' | 'human_only' | 'ai_disabled'
}

export interface BrainOutput {
  /** The AI-generated response */
  response: string
  /** AI-detected intent */
  intent: string
  /** AI-analyzed sentiment score 0-1 */
  sentiment: number
  /** Detected language */
  language: LanguageType
  /** Which AI provider was used */
  provider: 'gemini' | 'zai' | 'fallback'
  /** Channel-specific formatting hints */
  channelHints: ChannelHints
  /** Matched service rule (if customer intent maps to one) */
  matchedRule?: {
    id: string
    nameEn: string
    nameAr: string
    category: string
  }
  /** Mandatory fields the customer still needs to provide */
  missingFields?: Array<{
    fieldKey: string
    labelEn: string
    labelAr: string
    fieldType: string
    required: boolean
  }>
  /** Fields we already have from customer profile */
  availableFields?: Record<string, string>
  /** true if all mandatory fields are present and the action can proceed */
  actionReady: boolean
  /** Suggested next action e.g. "create_complaint", "track_status", "apply_service" */
  suggestedAction?: string
}

export interface ChannelHints {
  /** For voice: should TTS speak slowly? */
  speakSlowly?: boolean
  /** For WhatsApp: keep response under 1024 chars? */
  concise?: boolean
  /** For email: should response include formal greeting/signature? */
  formal?: boolean
  /** AI-detected urgency level */
  urgency: 'low' | 'medium' | 'high' | 'critical'
}

// ─── Internal Types for DB-loaded Context ───────────────────────────────────

interface CustomerContext {
  id: string
  nameEn: string
  nameAr: string | null
  email: string | null
  phone: string | null
  uaePassId: string | null
  preferredLang: string
  emirate: string | null
  nationality: string | null
  gender: string | null
  dateOfBirth: string | null
  emiratesId: string | null
  passportNumber: string | null
  familyBookNum: string | null
  addressAr: string | null
  addressEn: string | null
  occupation: string | null
  employer: string | null
  monthlyIncome: string | null
  propertyOwned: string | null
  propertyType: string | null
  isUaeNational: boolean
  isVerified: boolean
  sentiment: number
  cases: Array<{
    id: string
    referenceNumber: string
    status: string
    titleEn: string
    category: string | null
  }>
  serviceRequests: Array<{
    id: string
    referenceNumber: string
    status: string
  }>
  bills: Array<{
    id: string
    amount: number
    status: string
    dueDate: string | null
    description: string
  }>
}

interface ServiceRuleContext {
  id: string
  nameEn: string
  nameAr: string
  category: string
  descriptionEn: string | null
  descriptionAr: string | null
  feeAmount: string | null
  feeCurrency: string
  processingTimeEn: string | null
  processingTimeAr: string | null
  agentInstructionsEn: string | null
  agentInstructionsAr: string | null
  requiredActions: string
  eligibilityEn: string | null
  eligibilityAr: string | null
  requiredDocumentsEn: string | null
  requiredDocumentsAr: string | null
  fields: Array<{
    id: string
    fieldKey: string
    labelEn: string
    labelAr: string
    fieldType: string
    required: boolean
    forActions: string
    placeholderEn: string | null
    placeholderAr: string | null
    optionsEn: string | null
    optionsAr: string | null
    customerProfileKey?: string | null  // DB-driven field mapping
  }>
}

// ─── Language Detection (Fast Local Utility) ────────────────────────────────
// This is NOT "thinking" — it's just routing the message to the right language.
// Like a receptionist knowing which language to greet in.

function detectLanguage(text: string): LanguageType {
  if (!text || text.trim().length === 0) return 'en'
  const arabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/
  const latinRegex = /[a-zA-Z]/
  let arabicCount = 0
  let latinCount = 0
  for (const char of text) {
    if (arabicRegex.test(char)) arabicCount++
    if (latinRegex.test(char)) latinCount++
  }
  const totalScriptChars = arabicCount + latinCount
  if (totalScriptChars === 0) return 'en'
  const arabicRatio = arabicCount / totalScriptChars
  if (arabicRatio > 0.3) return 'ar'
  if (arabicRatio > 0.15 && /ال|في|من|إلى|على|هذا|هذه|أنا|أريد|هل|نعم|لا|شكر|مرحب|سلام/.test(text)) return 'ar'
  if (arabicRatio > 0.05 && text.length < 30 && arabicCount > 0) return 'ar'
  return 'en'
}

// ─── Channel Formatting Instructions ────────────────────────────────────────
// These are NOT "thinking" — they're formatting hints, like telling someone
// to speak louder in a noisy room. The BRAIN (AI) does the actual thinking.

const CHANNEL_FORMATTING: Record<ChannelType, { en: string; ar: string }> = {
  whatsapp: {
    en: 'FORMAT: WhatsApp messaging. Keep responses concise for mobile. Use short paragraphs. Be direct and professional. Do NOT use emojis — this is a government ministry.',
    ar: 'التنسيق: رسائل واتساب. حافظ على الردود موجزة للهاتف المحمول. استخدم فقرات قصيرة. كن مباشراً ومهنياً. لا تستخدم الرموز التعبيرية — هذه وزارة حكومية.',
  },
  web: {
    en: 'FORMAT: Web Chat. Provide clear, structured responses. Use bullet points for multi-step information. Be professional and thorough.',
    ar: 'التنسيق: دردشة إلكترونية. قدم ردوداً واضحة ومنظمة. استخدم نقاط التعداد للمعلومات متعددة الخطوات. كن مهنياً وشاملاً.',
  },
  voice: {
    en: 'FORMAT: Voice Call. Speak naturally as if talking on the phone. Keep responses conversational and short — the customer is listening, not reading. Avoid bullet points or numbered lists.',
    ar: 'التنسيق: مكالمة صوتية. تحدث بشكل طبيعي كما لو كنت تتحدث على الهاتف. حافظ على الردود قصيرة — العميل يستمع وليس يقرأ. تجنب نقاط التعداد والقوائم.',
  },
  email: {
    en: 'FORMAT: Email. Use formal business correspondence style. Include a clear subject reference. Structure with paragraphs. Be thorough and professional.',
    ar: 'التنسيق: بريد إلكتروني. استخدم أسلوب المراسلات التجارية الرسمية. اذكر مرجع الموضوع بوضوح. نظم الرد بفقرات. كن شاملاً ومهنياً.',
  },
}

// ─── Knowledge Base Search ──────────────────────────────────────────────────

function searchKBContext(message: string, language: LanguageType, maxArticles: number = 3): string {
  try {
    const articles = searchKnowledgeBase(message, maxArticles)
    if (articles.length === 0) return ''

    return articles
      .map((a, i) => {
        const title = language === 'ar' ? a.titleAr : a.titleEn
        const content = language === 'ar' ? a.contentAr : a.contentEn
        return `[${i + 1}] ${title} (${a.category}):\n${content.slice(0, 500)}`
      })
      .join('\n\n')
  } catch {
    return ''
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ║                    DB-FIRST: LOAD CUSTOMER CONTEXT                       ║
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Load customer profile from DB using any available identifier.
 * Tries: customerId → uaePassId → phone → email
 */
async function loadCustomer(input: BrainInput): Promise<CustomerContext | null> {
  try {
    // Try by ID first (most reliable)
    if (input.customerId) {
      const customer = await db.customer.findUnique({
        where: { id: input.customerId },
        include: {
          cases: { orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, referenceNumber: true, status: true, titleEn: true, category: true } },
          serviceRequests: { orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, referenceNumber: true, status: true } },
          bills: { orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, amount: true, status: true, dueDate: true, description: true } },
        },
      })
      if (customer) return mapCustomerToContext(customer)
    }

    // Try by phone
    if (input.customerPhone) {
      const customer = await db.customer.findFirst({
        where: { phone: input.customerPhone },
        include: {
          cases: { orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, referenceNumber: true, status: true, titleEn: true, category: true } },
          serviceRequests: { orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, referenceNumber: true, status: true } },
          bills: { orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, amount: true, status: true, dueDate: true, description: true } },
        },
      })
      if (customer) return mapCustomerToContext(customer)
    }

    // Try by email
    if (input.customerEmail) {
      const customer = await db.customer.findFirst({
        where: { email: input.customerEmail },
        include: {
          cases: { orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, referenceNumber: true, status: true, titleEn: true, category: true } },
          serviceRequests: { orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, referenceNumber: true, status: true } },
          bills: { orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, amount: true, status: true, dueDate: true, description: true } },
        },
      })
      if (customer) return mapCustomerToContext(customer)
    }

    return null
  } catch (err) {
    console.error('[SmartBrain] Failed to load customer from DB:', err)
    return null
  }
}

function mapCustomerToContext(customer: any): CustomerContext {
  return {
    id: customer.id,
    nameEn: customer.nameEn || '',
    nameAr: customer.nameAr,
    email: customer.email,
    phone: customer.phone,
    uaePassId: customer.uaePassId,
    preferredLang: customer.preferredLang || 'en',
    emirate: customer.emirate,
    nationality: customer.nationality,
    gender: customer.gender,
    dateOfBirth: customer.dateOfBirth,
    emiratesId: customer.emiratesId,
    passportNumber: customer.passportNumber,
    familyBookNum: customer.familyBookNum,
    addressAr: customer.addressAr,
    addressEn: customer.addressEn,
    occupation: customer.occupation,
    employer: customer.employer,
    monthlyIncome: customer.monthlyIncome,
    propertyOwned: customer.propertyOwned,
    propertyType: customer.propertyType,
    isUaeNational: customer.isUaeNational,
    isVerified: customer.isVerified,
    sentiment: customer.sentiment,
    cases: customer.cases || [],
    serviceRequests: customer.serviceRequests || [],
    bills: customer.bills || [],
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ║              DB-FIRST: MATCH SERVICE RULE FROM INTENT                    ║
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Use AI to classify intent and match it to a ServiceRule from DB.
 * Returns the matched rule (if any) along with the AI-detected intent.
 */
async function classifyIntentAndMatchRule(
  message: string,
  language: LanguageType,
  customerContext: CustomerContext | null,
): Promise<{ intent: string; matchedRule: ServiceRuleContext | null; suggestedAction: string | null }> {
  try {
    // Load all active service rules from DB
    const rules = await db.serviceRule.findMany({
      where: { isActive: true },
      include: {
        fields: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
    })

    if (rules.length === 0) {
      // No service rules configured — use AI-only classification
      return await classifyIntentWithAI(message, language)
    }

    // Build a concise rule catalog for the AI to pick from
    const ruleCatalog = rules.map(r => {
      const actions = safeJsonParse<string[]>(r.requiredActions, [])
      const fieldKeys = r.fields.map(f => f.fieldKey)
      return {
        id: r.id,
        nameEn: r.nameEn,
        nameAr: r.nameAr,
        category: r.category,
        actions,
        fieldKeys,
      }
    })

    // Ask AI to classify intent AND match to a rule
    const classifyPrompt = language === 'ar'
      ? `صنّف نية العميل واطابقها مع قاعدة خدمة.

رسالة العميل: "${message}"

قواعد الخدمة المتاحة:
${ruleCatalog.map((r, i) => `${i + 1}. [${r.id}] ${r.nameAr || r.nameEn} (التصنيف: ${r.category}, الإجراءات: ${r.actions.join('/')})`).join('\n')}

أجب فقط بصيغة JSON:
{
  "intent": "الفئة المناسبة من: inquiry, complaint, suggestion, appreciation, case_status, service_request, emergency, billing, electricity, water, housing, petroleum, transport, sustainability, other",
  "matchedRuleId": "معرّف القاعدة المطابقة أو null",
  "suggestedAction": "الإجراء المقترح مثل: create_complaint, track_status, apply_service, search, add, edit, delete أو null"
}

إذا لم تتطابق أي قاعدة، اضبط matchedRuleId على null.`
      : `Classify the customer intent and match it to a service rule.

Customer message: "${message}"

Available service rules:
${ruleCatalog.map((r, i) => `${i + 1}. [${r.id}] ${r.nameEn} (Category: ${r.category}, Actions: ${r.actions.join('/')})`).join('\n')}

Respond ONLY in JSON format:
{
  "intent": "The appropriate category from: inquiry, complaint, suggestion, appreciation, case_status, service_request, emergency, billing, electricity, water, housing, petroleum, transport, sustainability, other",
  "matchedRuleId": "The matched rule ID or null",
  "suggestedAction": "Suggested action like: create_complaint, track_status, apply_service, search, add, edit, delete or null"
}

If no rule matches, set matchedRuleId to null.`

    const result = await unifiedChatCompletion(
      [
        { role: 'system', content: 'You are an intent classification and rule matching system. Respond ONLY with valid JSON.' },
        { role: 'user', content: classifyPrompt },
      ],
      { temperature: 0.2, maxOutputTokens: 512 },
    )

    const jsonMatch = result.content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])

      // Extract distinct intents from DB service rules (dynamic, no hardcoded list)
      const dbIntents = rules.map(r => r.category).filter(Boolean)
      const knownIntents = [...new Set([...dbIntents, 'inquiry', 'complaint', 'case_status', 'service_request', 'emergency', 'other', 'default'])]
      const intent = knownIntents.includes(parsed.intent) ? parsed.intent : 'other'

      // Find the matched rule in our DB results
      let matchedRule: ServiceRuleContext | null = null
      if (parsed.matchedRuleId) {
        const found = rules.find(r => r.id === parsed.matchedRuleId)
        if (found) {
          matchedRule = {
            id: found.id,
            nameEn: found.nameEn,
            nameAr: found.nameAr,
            category: found.category,
            descriptionEn: found.descriptionEn,
            descriptionAr: found.descriptionAr,
            feeAmount: found.feeAmount,
            feeCurrency: found.feeCurrency,
            processingTimeEn: found.processingTimeEn,
            processingTimeAr: found.processingTimeAr,
            agentInstructionsEn: found.agentInstructionsEn,
            agentInstructionsAr: found.agentInstructionsAr,
            requiredActions: found.requiredActions,
            eligibilityEn: found.eligibilityEn,
            eligibilityAr: found.eligibilityAr,
            requiredDocumentsEn: found.requiredDocumentsEn,
            requiredDocumentsAr: found.requiredDocumentsAr,
            fields: found.fields.map(f => ({
              id: f.id,
              fieldKey: f.fieldKey,
              labelEn: f.labelEn,
              labelAr: f.labelAr,
              fieldType: f.fieldType,
              required: f.required,
              forActions: f.forActions,
              placeholderEn: f.placeholderEn,
              placeholderAr: f.placeholderAr,
              optionsEn: f.optionsEn,
              optionsAr: f.optionsAr,
              customerProfileKey: f.customerProfileKey,
            })),
          }
        }
      }

      return {
        intent,
        matchedRule,
        suggestedAction: parsed.suggestedAction || null,
      }
    }
  } catch (err) {
    console.error('[SmartBrain] Intent classification + rule matching failed:', err)
  }

  // Fallback: AI-only classification without rule matching
  return await classifyIntentWithAI(message, language)
}

/**
 * Fallback: classify intent using AI without rule matching.
 */
async function classifyIntentWithAI(
  message: string,
  language: LanguageType,
): Promise<{ intent: string; matchedRule: null; suggestedAction: null }> {
  try {
    const prompt = language === 'ar'
      ? `صنّف نية العميل وأجب فقط بصيغة JSON:
{"intent": "الفئة من: inquiry, complaint, suggestion, appreciation, case_status, service_request, emergency, billing, electricity, water, housing, petroleum, transport, sustainability, other"}

رسالة العميل: "${message}"`
      : `Classify the customer intent and respond ONLY in JSON format:
{"intent": "One of: inquiry, complaint, suggestion, appreciation, case_status, service_request, emergency, billing, electricity, water, housing, petroleum, transport, sustainability, other"}

Customer message: "${message}"`

    const result = await unifiedChatCompletion(
      [
        { role: 'system', content: 'You are an intent classification system. Respond ONLY with valid JSON.' },
        { role: 'user', content: prompt },
      ],
      { temperature: 0.2, maxOutputTokens: 256 },
    )

    const jsonMatch = result.content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      const knownIntents = ['inquiry', 'complaint', 'suggestion', 'appreciation', 'case_status', 'service_request', 'emergency', 'billing', 'other', 'default']
      return {
        intent: knownIntents.includes(parsed.intent) ? parsed.intent : 'other',
        matchedRule: null,
        suggestedAction: null,
      }
    }
  } catch {
    // Silent fallback
  }

  return { intent: 'other', matchedRule: null, suggestedAction: null }
}

// ═══════════════════════════════════════════════════════════════════════════
// ║            DB-FIRST: RESOLVE FIELDS FROM CUSTOMER PROFILE                ║
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Map customer profile fields to service rule field keys.
 * Returns { availableFields, missingFields } based on the rule's mandatory fields.
 */
function resolveFieldsFromProfile(
  rule: ServiceRuleContext,
  customer: CustomerContext | null,
  suggestedAction: string | null,
): {
  availableFields: Record<string, string>
  missingFields: Array<{
    fieldKey: string
    labelEn: string
    labelAr: string
    fieldType: string
    required: boolean
  }>
} {
  const availableFields: Record<string, string> = {}
  const missingFields: Array<{
    fieldKey: string
    labelEn: string
    labelAr: string
    fieldType: string
    required: boolean
  }> = []

  const actionNeeded = suggestedAction || 'add'

  // Build a flat lookup from the customer object using their profile keys
  const customerRecord: Record<string, any> = customer ? {
    id: customer.id,
    nameEn: customer.nameEn,
    nameAr: customer.nameAr,
    email: customer.email,
    phone: customer.phone,
    uaePassId: customer.uaePassId,
    preferredLang: customer.preferredLang,
    emirate: customer.emirate,
    nationality: customer.nationality,
    gender: customer.gender,
    dateOfBirth: customer.dateOfBirth,
    emiratesId: customer.emiratesId,
    passportNumber: customer.passportNumber,
    familyBookNum: customer.familyBookNum,
    addressAr: customer.addressAr,
    addressEn: customer.addressEn,
    occupation: customer.occupation,
    employer: customer.employer,
    monthlyIncome: customer.monthlyIncome,
    propertyOwned: customer.propertyOwned,
    propertyType: customer.propertyType,
    isUaeNational: customer.isUaeNational,
    isVerified: customer.isVerified,
  } : {}

  // Auto-mapping: common fieldKey → customer profile key mappings
  // This ensures fields are auto-resolved even if customerProfileKey isn't explicitly set
  const autoFieldMapping: Record<string, string> = {
    name: 'nameEn',
    nameEn: 'nameEn',
    nameAr: 'nameAr',
    fullName: 'nameEn',
    customerName: 'nameEn',
    email: 'email',
    emailAddress: 'email',
    phone: 'phone',
    phoneNumber: 'phone',
    mobile: 'phone',
    emiratesId: 'emiratesId',
    eid: 'emiratesId',
    emirate: 'emirate',
    city: 'emirate',
    nationality: 'nationality',
    gender: 'gender',
    dateOfBirth: 'dateOfBirth',
    dob: 'dateOfBirth',
    passportNumber: 'passportNumber',
    passport: 'passportNumber',
    familyBookNum: 'familyBookNum',
    familyBook: 'familyBookNum',
    address: 'addressEn',
    addressEn: 'addressEn',
    addressAr: 'addressAr',
    occupation: 'occupation',
    job: 'occupation',
    employer: 'employer',
    company: 'employer',
    monthlyIncome: 'monthlyIncome',
    income: 'monthlyIncome',
    salary: 'monthlyIncome',
    propertyOwned: 'propertyOwned',
    propertyType: 'propertyType',
    uaePassId: 'uaePassId',
    isUaeNational: 'isUaeNational',
    isVerified: 'isVerified',
  }

  for (const field of rule.fields) {
    const fieldActions = safeJsonParse<string[]>(field.forActions, [])
    const isRelevantForAction = fieldActions.length === 0 || fieldActions.includes(actionNeeded)
    if (!isRelevantForAction) continue

    let value: string | null = null

    // DB-driven: use customerProfileKey from the field definition
    const profileKey = (field as any).customerProfileKey as string | null | undefined
    if (profileKey && profileKey.trim() !== '' && customer) {
      const rawValue = customerRecord[profileKey]
      if (rawValue !== null && rawValue !== undefined && String(rawValue).trim() !== '' && String(rawValue).trim() !== 'N/A') {
        value = String(rawValue)
      }
    }

    // Auto-mapping fallback: try to match fieldKey to a customer profile key
    if (!value && customer) {
      const autoKey = autoFieldMapping[field.fieldKey]
      if (autoKey) {
        const rawValue = customerRecord[autoKey]
        if (rawValue !== null && rawValue !== undefined && String(rawValue).trim() !== '' && String(rawValue).trim() !== 'N/A') {
          value = String(rawValue)
        }
      }

      // Second fallback: try direct match (fieldKey exists as a key in customerRecord)
      if (!value && field.fieldKey in customerRecord) {
        const rawValue = customerRecord[field.fieldKey]
        if (rawValue !== null && rawValue !== undefined && String(rawValue).trim() !== '' && String(rawValue).trim() !== 'N/A') {
          value = String(rawValue)
        }
      }
    }

    if (value) {
      availableFields[field.fieldKey] = value
    } else if (field.required) {
      missingFields.push({
        fieldKey: field.fieldKey,
        labelEn: field.labelEn,
        labelAr: field.labelAr,
        fieldType: field.fieldType,
        required: field.required,
      })
    }
  }

  return { availableFields, missingFields }
}

// ═══════════════════════════════════════════════════════════════════════════
// ║          DB-FIRST: LOOK UP CASES/STATUS FOR TRACKING                     ║
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Load case/status data for tracking requests.
 * Used when customer wants to track or check status.
 */
async function loadCaseStatusContext(
  customer: CustomerContext | null,
  message: string,
  language: LanguageType,
): Promise<string> {
  const parts: string[] = []

  // If we have a customer with cases, include them
  if (customer && customer.cases.length > 0) {
    const caseInfo = customer.cases.map(c =>
      language === 'ar'
        ? `- القضية ${c.referenceNumber}: ${c.titleEn} — الحالة: ${c.status}`
        : `- Case ${c.referenceNumber}: ${c.titleEn} — Status: ${c.status}`
    ).join('\n')
    parts.push(language === 'ar'
      ? `قضايا العميل الحالية:\n${caseInfo}`
      : `Customer's current cases:\n${caseInfo}`)
  }

  // If we have service requests, include them
  if (customer && customer.serviceRequests.length > 0) {
    const reqInfo = customer.serviceRequests.map(r =>
      language === 'ar'
        ? `- طلب ${r.referenceNumber} — الحالة: ${r.status}`
        : `- Request ${r.referenceNumber} — Status: ${r.status}`
    ).join('\n')
    parts.push(language === 'ar'
      ? `طلبات الخدمة الحالية:\n${reqInfo}`
      : `Current service requests:\n${reqInfo}`)
  }

  // If we have bills, include pending/overdue ones
  if (customer && customer.bills.length > 0) {
    const pendingBills = customer.bills.filter(b => b.status === 'pending' || b.status === 'overdue')
    if (pendingBills.length > 0) {
      const billInfo = pendingBills.map(b =>
        language === 'ar'
          ? `- فاتورة: ${b.description} — المبلغ: ${b.amount} درهم — الحالة: ${b.status}`
          : `- Bill: ${b.description} — Amount: AED ${b.amount} — Status: ${b.status}`
      ).join('\n')
      parts.push(language === 'ar'
        ? `الفواتير المعلقة:\n${billInfo}`
        : `Pending bills:\n${billInfo}`)
    }
  }

  // Try to extract reference number from the message and look it up
  const refMatch = message.match(/MOEI-\d{4}-\d{2}-\d{2}-\d{4}/i) ||
                   message.match(/MOEI-\d{8}-\d{4}/i) ||
                   message.match(/\b[A-Z]{2,4}-\d{4,}-\d{4,}/i)

  if (refMatch) {
    const refNum = refMatch[0]
    try {
      const caseByRef = await db.case.findUnique({
        where: { referenceNumber: refNum },
        select: { id: true, referenceNumber: true, status: true, titleEn: true, titleAr: true, category: true, priority: true, createdAt: true, updatedAt: true, resolution: true },
      })
      if (caseByRef) {
        parts.push(language === 'ar'
          ? `تفاصيل القضية بالرقم المرجعي ${refNum}:\n- العنوان: ${caseByRef.titleAr || caseByRef.titleEn}\n- الحالة: ${caseByRef.status}\n- الأولوية: ${caseByRef.priority}\n- التصنيف: ${caseByRef.category || 'غير محدد'}\n- تاريخ الإنشاء: ${caseByRef.createdAt ? new Date(caseByRef.createdAt).toLocaleDateString('ar-AE') : 'غير متوفر'}\n- آخر تحديث: ${caseByRef.updatedAt ? new Date(caseByRef.updatedAt).toLocaleDateString('ar-AE') : 'غير متوفر'}\n${caseByRef.resolution ? `- الحل: ${caseByRef.resolution}` : ''}`
          : `Case details for reference ${refNum}:\n- Title: ${caseByRef.titleEn}\n- Status: ${caseByRef.status}\n- Priority: ${caseByRef.priority}\n- Category: ${caseByRef.category || 'N/A'}\n- Created: ${caseByRef.createdAt ? new Date(caseByRef.createdAt).toLocaleDateString('en-AE') : 'N/A'}\n- Last Updated: ${caseByRef.updatedAt ? new Date(caseByRef.updatedAt).toLocaleDateString('en-AE') : 'N/A'}\n${caseByRef.resolution ? `- Resolution: ${caseByRef.resolution}` : ''}`)
      }

      const requestByRef = await db.serviceRequest.findUnique({
        where: { referenceNumber: refNum },
        select: { id: true, referenceNumber: true, status: true, data: true, createdAt: true, updatedAt: true },
      })
      if (requestByRef) {
        parts.push(language === 'ar'
          ? `طلب الخدمة بالرقم المرجعي ${refNum}:\n- الحالة: ${requestByRef.status}\n- تاريخ الإنشاء: ${requestByRef.createdAt ? new Date(requestByRef.createdAt).toLocaleDateString('ar-AE') : 'غير متوفر'}\n- آخر تحديث: ${requestByRef.updatedAt ? new Date(requestByRef.updatedAt).toLocaleDateString('ar-AE') : 'غير متوفر'}`
          : `Service request for reference ${refNum}:\n- Status: ${requestByRef.status}\n- Created: ${requestByRef.createdAt ? new Date(requestByRef.createdAt).toLocaleDateString('en-AE') : 'N/A'}\n- Last Updated: ${requestByRef.updatedAt ? new Date(requestByRef.updatedAt).toLocaleDateString('en-AE') : 'N/A'}`)
      }
    } catch {
      // DB lookup failed — that's OK
    }
  }

  // If no customer but they mentioned Emirates ID, try to look up by that
  if (!customer) {
    const eidMatch = message.match(/\b784-\d{4}-\d{7}\b/)
    if (eidMatch) {
      try {
        const customerByEid = await db.customer.findFirst({
          where: { emiratesId: eidMatch[0] },
          include: {
            cases: { orderBy: { createdAt: 'desc' }, take: 5, select: { referenceNumber: true, status: true, titleEn: true } },
            serviceRequests: { orderBy: { createdAt: 'desc' }, take: 5, select: { referenceNumber: true, status: true } },
          },
        })
        if (customerByEid) {
          const caseList = customerByEid.cases.map(c => `${c.referenceNumber} (${c.status})`).join(', ') || 'None'
          const reqList = customerByEid.serviceRequests.map(r => `${r.referenceNumber} (${r.status})`).join(', ') || 'None'
          parts.push(language === 'ar'
            ? `تم العثور على عميل بالهوية الإماراتية:\n- الاسم: ${customerByEid.nameAr || customerByEid.nameEn}\n- القضايا: ${caseList}\n- طلبات الخدمة: ${reqList}`
            : `Found customer by Emirates ID:\n- Name: ${customerByEid.nameEn}\n- Cases: ${caseList}\n- Service Requests: ${reqList}`)
        }
      } catch {
        // DB lookup failed
      }
    }
  }

  return parts.join('\n\n')
}

// ═══════════════════════════════════════════════════════════════════════════
// ║                 BUILD CUSTOMER CONTEXT STRING                            ║
// ═══════════════════════════════════════════════════════════════════════════

function buildCustomerContextString(
  customer: CustomerContext | null,
  language: LanguageType,
): string {
  if (!customer) return ''

  const isAr = language === 'ar'
  const lines: string[] = []

  lines.push(isAr ? 'سياق العميل:' : 'CUSTOMER CONTEXT:')

  // Identity
  lines.push(isAr
    ? `- الاسم: ${customer.nameAr || customer.nameEn}`
    : `- Name: ${customer.nameEn}${customer.nameAr ? ` / ${customer.nameAr}` : ''}`)
  lines.push(isAr
    ? `- اللغة المفضلة: ${customer.preferredLang === 'ar' ? 'العربية' : 'English'}`
    : `- Preferred Language: ${customer.preferredLang === 'ar' ? 'Arabic' : 'English'}`)

  if (customer.email && !customer.email.startsWith('session-') && !customer.email.startsWith('wa-')) {
    lines.push(isAr ? `- البريد الإلكتروني: ${customer.email}` : `- Email: ${customer.email}`)
  }
  if (customer.phone) {
    lines.push(isAr ? `- الهاتف: ${customer.phone}` : `- Phone: ${customer.phone}`)
  }
  if (customer.uaePassId) {
    lines.push(isAr ? `- معرّف UAE PASS: ${customer.uaePassId}` : `- UAE PASS ID: ${customer.uaePassId}`)
  }
  if (customer.emiratesId) {
    lines.push(isAr ? `- الهوية الإماراتية: ${customer.emiratesId}` : `- Emirates ID: ${customer.emiratesId}`)
  }
  if (customer.emirate) {
    lines.push(isAr ? `- الإمارة: ${customer.emirate}` : `- Emirate: ${customer.emirate}`)
  }
  if (customer.nationality) {
    lines.push(isAr ? `- الجنسية: ${customer.nationality}` : `- Nationality: ${customer.nationality}`)
  }
  if (customer.gender) {
    lines.push(isAr ? `- الجنس: ${customer.gender === 'male' ? 'ذكر' : customer.gender === 'female' ? 'أنثى' : customer.gender}` : `- Gender: ${customer.gender}`)
  }
  if (customer.dateOfBirth) {
    lines.push(isAr ? `- تاريخ الميلاد: ${customer.dateOfBirth}` : `- Date of Birth: ${customer.dateOfBirth}`)
  }
  if (customer.occupation) {
    lines.push(isAr ? `- المهنة: ${customer.occupation}` : `- Occupation: ${customer.occupation}`)
  }
  if (customer.employer) {
    lines.push(isAr ? `- جهة العمل: ${customer.employer}` : `- Employer: ${customer.employer}`)
  }
  if (customer.monthlyIncome) {
    lines.push(isAr ? `- الدخل الشهري: ${customer.monthlyIncome}` : `- Monthly Income: ${customer.monthlyIncome}`)
  }
  if (customer.propertyOwned) {
    lines.push(isAr ? `- ملكية عقار: ${customer.propertyOwned}` : `- Property Owned: ${customer.propertyOwned}`)
  }
  if (customer.propertyType) {
    lines.push(isAr ? `- نوع العقار: ${customer.propertyType}` : `- Property Type: ${customer.propertyType}`)
  }
  if (customer.addressEn) {
    lines.push(isAr ? `- العنوان: ${customer.addressAr || customer.addressEn}` : `- Address: ${customer.addressEn}`)
  }
  if (customer.isUaeNational) {
    lines.push(isAr ? `- مواطن إماراتي: نعم` : `- UAE National: Yes`)
  }
  if (customer.isVerified) {
    lines.push(isAr ? `- الحالة: موثق عبر UAE PASS ✓` : `- Status: UAE PASS Verified ✓`)
  }

  // Cases
  if (customer.cases.length > 0) {
    const caseList = customer.cases.map(c =>
      isAr ? `${c.referenceNumber} (${c.status})` : `${c.referenceNumber} (${c.status})`
    ).join(', ')
    lines.push(isAr ? `- القضايا: ${customer.cases.length} (${caseList})` : `- Cases: ${customer.cases.length} (${caseList})`)
  }

  // Service requests
  if (customer.serviceRequests.length > 0) {
    const reqList = customer.serviceRequests.map(r => `${r.referenceNumber} (${r.status})`).join(', ')
    lines.push(isAr ? `- طلبات الخدمة: ${reqList}` : `- Service Requests: ${reqList}`)
  }

  return lines.join('\n')
}

// ═══════════════════════════════════════════════════════════════════════════
// ║         BUILD SERVICE RULE CONTEXT FOR AI PROMPT                         ║
// ═══════════════════════════════════════════════════════════════════════════

function buildServiceRulePromptContext(
  rule: ServiceRuleContext,
  availableFields: Record<string, string>,
  missingFields: Array<{
    fieldKey: string
    labelEn: string
    labelAr: string
    fieldType: string
    required: boolean
  }>,
  actionReady: boolean,
  language: LanguageType,
): string {
  const isAr = language === 'ar'
  const actions = safeJsonParse<string[]>(rule.requiredActions, [])
  const fee = rule.feeAmount ? `${rule.feeAmount} ${rule.feeCurrency}` : (isAr ? 'غير محدد' : 'N/A')
  const processing = isAr ? (rule.processingTimeAr || rule.processingTimeEn || 'N/A') : (rule.processingTimeEn || 'N/A')

  const parts: string[] = []

  // Rule header
  parts.push(isAr
    ? `قاعدة الخدمة المطابقة: "${rule.nameAr || rule.nameEn}"`
    : `SERVICE RULE MATCHED: "${rule.nameEn}"`)
  parts.push(isAr
    ? `التصنيف: ${rule.category} | الإجراءات: ${actions.join(', ') || 'غير محدد'}`
    : `Category: ${rule.category} | Actions available: ${actions.join(', ') || 'N/A'}`)
  parts.push(isAr
    ? `الرسوم: ${fee} | مدة المعالجة: ${processing}`
    : `Fee: ${fee} | Processing: ${processing}`)

  // Agent-specific instructions
  const agentInstructions = isAr ? rule.agentInstructionsAr : rule.agentInstructionsEn
  if (agentInstructions && agentInstructions.trim()) {
    parts.push(isAr
      ? `تعليمات الوكيل: ${agentInstructions}`
      : `Agent Instructions: ${agentInstructions}`)
  }

  // Required documents
  const requiredDocs = isAr ? rule.requiredDocumentsAr : rule.requiredDocumentsEn
  if (requiredDocs && requiredDocs.trim()) {
    parts.push(isAr
      ? `المستندات المطلوبة: ${requiredDocs}`
      : `Required Documents: ${requiredDocs}`)
  }

  // Eligibility
  const eligibility = isAr ? rule.eligibilityAr : rule.eligibilityEn
  if (eligibility && eligibility.trim()) {
    parts.push(isAr
      ? `الأهلية: ${eligibility}`
      : `Eligibility: ${eligibility}`)
  }

  // Available fields from profile
  if (Object.keys(availableFields).length > 0) {
    const fieldLines = Object.entries(availableFields).map(([key, value]) => {
      // Find the field label
      const fieldDef = rule.fields.find(f => f.fieldKey === key)
      const label = isAr ? (fieldDef?.labelAr || key) : (fieldDef?.labelEn || key)
      return `- ${label}: ${value} ✓`
    }).join('\n')
    parts.push(isAr
      ? `بيانات ملف العميل المتاحة:\n${fieldLines}`
      : `CUSTOMER PROFILE DATA AVAILABLE:\n${fieldLines}`)
  }

  // Missing mandatory fields
  if (missingFields.length > 0) {
    const missingLines = missingFields.map(f => {
      const label = isAr ? f.labelAr : f.labelEn
      const placeholder = isAr
        ? (rule.fields.find(rf => rf.fieldKey === f.fieldKey)?.placeholderAr || '')
        : (rule.fields.find(rf => rf.fieldKey === f.fieldKey)?.placeholderEn || '')
      const hint = placeholder ? ` (${placeholder})` : ''
      return `- ${label} (${f.fieldKey})${hint}`
    }).join('\n')
    parts.push(isAr
      ? `الحقول الإلزامية المفقودة (اطلبها بشكل طبيعي):\n${missingLines}`
      : `MISSING MANDATORY FIELDS (ask for these naturally):\n${missingLines}`)

    // CRITICAL instruction for the AI
    parts.push(isAr
      ? `تعليمات: العميل يريد استخدام هذه الخدمة. لديك بعض معلوماته بالفعل. اسأل بشكل طبيعي عن الحقول المفقودة فقط (${missingFields.map(f => f.labelAr).join('، ')}). لا تسرد الحقول كنموذج. اسأل بشكل محادثي، واحد أو اثنين في كل مرة. بالعربية إذا كان العميل يتحدث العربية.`
      : `INSTRUCTIONS: The customer wants to use this service. You already have some of their information. Ask naturally for ONLY the missing fields (${missingFields.map(f => f.labelEn).join(', ')}). Do NOT list them like a form. Ask conversationally, one or two at a time. In Arabic if the customer speaks Arabic.`)
  } else if (actionReady) {
    // All fields are present — the action can proceed
    parts.push(isAr
      ? `جميع الحقول الإلزامية متوفرة. يمكنك تأكيد الإجراء للعميل. قدم ملخصاً واطلب التأكيد.`
      : `ALL MANDATORY FIELDS ARE PRESENT. You can proceed with the action. Provide a summary and ask the customer to confirm.`)
  }

  return parts.join('\n\n')
}

// ─── The Brain Response Parser ──────────────────────────────────────────────

interface ParsedBrainResponse {
  response: string
  intent: string
  sentiment: number
  urgency: 'low' | 'medium' | 'high' | 'critical'
}

function parseBrainResponse(raw: string, language: LanguageType): ParsedBrainResponse {
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0])

      const knownIntents = ['inquiry', 'complaint', 'suggestion', 'appreciation', 'case_status', 'service_request', 'emergency', 'billing', 'electricity', 'water', 'housing', 'petroleum', 'transport', 'sustainability', 'other', 'default']
      const intent = knownIntents.includes(parsed.intent) ? parsed.intent : 'other'
      const sentiment = typeof parsed.sentiment === 'number'
        ? Math.max(0, Math.min(1, parsed.sentiment))
        : 0.5
      const validUrgencies: Array<'low' | 'medium' | 'high' | 'critical'> = ['low', 'medium', 'high', 'critical']
      const urgency = validUrgencies.includes(parsed.urgency) ? parsed.urgency : 'low'
      const response = parsed.response || parsed.reply || parsed.answer || ''

      if (response.trim().length > 0) {
        return { response: response.trim(), intent, sentiment, urgency }
      }
    } catch {
      // JSON parse failed, fall through
    }
  }

  return {
    response: raw.trim(),
    intent: 'other',
    sentiment: 0.5,
    urgency: 'low',
  }
}

// ─── Utility ────────────────────────────────────────────────────────────────

function safeJsonParse<T>(jsonStr: string | null | undefined, fallback: T): T {
  if (!jsonStr || jsonStr.trim() === '') return fallback
  try {
    return JSON.parse(jsonStr) as T
  } catch {
    return fallback
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ║                         THE SMART BRAIN                                  ║
// ═══════════════════════════════════════════════════════════════════════════

export const SmartBrain = {
  /**
   * The core thinking method. ALL channels call this ONE method.
   *
   * DB-First Flow:
   *   1. Detect language (local utility)
   *   2. Load customer context from DB
   *   3. AI classifies intent and matches to ServiceRule
   *   4. If matched: resolve fields → ask or act
   *   5. If no match: general AI response with KB
   *   6. Return structured output with action context
   */
  async think(input: BrainInput): Promise<BrainOutput> {
    const { message, channel } = input

    // ── Step 1: Detect language (fast local utility) ──────────────────────
    const language = input.language || detectLanguage(message)

    // ── Step 2: Load customer context from DB ─────────────────────────────
    const customer = await loadCustomer(input)

    // ── Step 3: If customer wants to track status, load case data ─────────
    // Quick local check for tracking-related messages before the expensive AI call
    const lowerMessage = message.toLowerCase()
    const isTrackingRequest = /\b(track|status|follow.?up|check|متابعة|حالة|تتبع|استعلام)\b/i.test(lowerMessage)
    let caseStatusContext = ''
    if (isTrackingRequest || input.customerContext?.includes('track') || input.customerContext?.includes('status')) {
      caseStatusContext = await loadCaseStatusContext(customer, message, language)
    }

    // ── Step 4: AI classifies intent and matches to ServiceRule ───────────
    const { intent, matchedRule, suggestedAction } = await classifyIntentAndMatchRule(
      message,
      language,
      customer,
    )

    // ── Step 5: Resolve fields from customer profile ──────────────────────
    let availableFields: Record<string, string> = {}
    let missingFields: Array<{
      fieldKey: string
      labelEn: string
      labelAr: string
      fieldType: string
      required: boolean
    }> = []
    let actionReady = false
    let serviceRulePromptContext = ''

    if (matchedRule) {
      const resolved = resolveFieldsFromProfile(matchedRule, customer, suggestedAction)
      availableFields = resolved.availableFields
      missingFields = resolved.missingFields
      actionReady = missingFields.length === 0

      // Build the rich service rule context for the AI prompt
      serviceRulePromptContext = buildServiceRulePromptContext(
        matchedRule,
        availableFields,
        missingFields,
        actionReady,
        language,
      )
    }

    // ── Step 6: Search knowledge base for real information ────────────────
    const kbContext = searchKBContext(message, language, 3)

    // ── Step 7: Build conversation context ────────────────────────────────
    let conversationContext = ''
    if (input.conversationHistory && input.conversationHistory.length > 0) {
      const last10 = input.conversationHistory.slice(-10)
      conversationContext = last10
        .map(t => `${t.speaker === 'customer' ? 'Customer' : 'AI'}: ${t.text}`)
        .join('\n')
    }

    // ── Step 8: Build the full system prompt ──────────────────────────────
    const basePrompt = language === 'ar' ? MOEI_SYSTEM_PROMPTS.ar : MOEI_SYSTEM_PROMPTS.en
    const channelFormatting = CHANNEL_FORMATTING[channel]?.[language] || CHANNEL_FORMATTING.whatsapp[language]

    // JSON format instruction for the AI
    const jsonFormatInstruction = language === 'ar'
      ? `
أنت MUST أن ترد بصيغة JSON فقط بالتنسيق التالي:
{
  "response": "ردك المهني الكامل على العميل هنا",
  "intent": "الفئة المناسبة من: inquiry, complaint, suggestion, appreciation, case_status, service_request, emergency, billing, electricity, water, housing, petroleum, transport, sustainability, other",
  "sentiment": 0.0-1.0,
  "urgency": "low أو medium أو high أو critical"
}

حقل "response" هو ردك الفعلي الذي يراه العميل — اجعله مهنياً ومفيداً.
حقل "intent" هو تصنيفك لنية العميل.
حقل "sentiment" هو تحليلك لمشاعر العميل من 0 (سلبي جداً) إلى 1 (إيجابي جداً).
حقل "urgency" هو تقييمك لمستوى الاستعجال.
`
      : `
You MUST respond in JSON format only with this structure:
{
  "response": "Your full professional response to the customer here",
  "intent": "The appropriate category from: inquiry, complaint, suggestion, appreciation, case_status, service_request, emergency, billing, electricity, water, housing, petroleum, transport, sustainability, other",
  "sentiment": 0.0-1.0,
  "urgency": "low or medium or high or critical"
}

The "response" field is your actual reply that the customer sees — make it professional and helpful.
The "intent" field is your classification of the customer's intent.
The "sentiment" field is your analysis of customer sentiment from 0 (very negative) to 1 (very positive).
The "urgency" field is your assessment of urgency level.
`

    // Assemble the full system prompt with all context layers
    let fullSystemPrompt = `${basePrompt}

---

${channelFormatting}`

    // Customer context (from DB or override)
    if (customer) {
      const customerStr = buildCustomerContextString(customer, language)
      if (customerStr) {
        fullSystemPrompt += `

---

${customerStr}

CRITICAL RULE: You already have this customer's information above. Do NOT ask the customer for any details that are already shown in their profile (name, Emirates ID, email, phone, nationality, etc.). Use the profile data directly. If a service rule says a field is "missing" but the information exists in the customer context above, use it from the context — do NOT ask the customer for it again.`
      }
    } else if (input.customerContext) {
      fullSystemPrompt += `

---

${input.customerContext}`
    }

    // Service rule context (THE KEY INNOVATION)
    if (serviceRulePromptContext) {
      fullSystemPrompt += `

---

${serviceRulePromptContext}`
    }

    // Case/status context (for tracking requests)
    if (caseStatusContext) {
      fullSystemPrompt += `

---

CASE/STATUS LOOKUP RESULTS (use this to tell the customer their status directly):
${caseStatusContext}`
    }

    // Knowledge base context
    if (kbContext) {
      fullSystemPrompt += `

---

RELEVANT KNOWLEDGE BASE ARTICLES (use this information to provide accurate, specific answers):
${kbContext}`
    }

    // Conversation history
    if (conversationContext) {
      fullSystemPrompt += `

---

CONVERSATION HISTORY (recent messages):
${conversationContext}`
    }

    // JSON format instruction (always last)
    fullSystemPrompt += `

---

${jsonFormatInstruction}`

    // ── Step 9: Call the AI — THIS is the thinking ────────────────────────
    let rawAIOutput = ''
    let provider: BrainOutput['provider'] = 'fallback'

    try {
      const messages: ChatCompletionMessage[] = [
        { role: 'system', content: fullSystemPrompt },
        { role: 'user', content: message },
      ]

      const result = await unifiedChatCompletion(messages, {
        temperature: 0.5,
        maxOutputTokens: 2048,
      })
      rawAIOutput = result.content
      provider = result.provider
    } catch (aiErr) {
      console.error('[SmartBrain] AI generation failed:', aiErr)

      const fallbackResponse = language === 'ar'
        ? 'أعتذر، أواجه صعوبة تقنية مؤقتة. سأقوم بتحويلك لموظف بشري لمساعدتك فوراً.'
        : 'I apologize, I am experiencing a temporary technical difficulty. I will transfer you to a human agent who can assist you right away.'

      return {
        response: fallbackResponse,
        intent: intent || 'other',
        sentiment: 0.5,
        language,
        provider: 'fallback',
        channelHints: {
          urgency: 'medium',
          speakSlowly: false,
          concise: channel === 'whatsapp',
          formal: channel === 'email',
        },
        matchedRule: matchedRule ? {
          id: matchedRule.id,
          nameEn: matchedRule.nameEn,
          nameAr: matchedRule.nameAr,
          category: matchedRule.category,
        } : undefined,
        missingFields: missingFields.length > 0 ? missingFields : undefined,
        availableFields: Object.keys(availableFields).length > 0 ? availableFields : undefined,
        actionReady,
        suggestedAction: suggestedAction || undefined,
      }
    }

    // ── Step 10: Parse the AI response ────────────────────────────────────
    const parsed = parseBrainResponse(rawAIOutput, language)

    // ── Step 11: Build channel hints ──────────────────────────────────────
    const channelHints: ChannelHints = {
      urgency: parsed.urgency,
      speakSlowly: channel === 'voice' && (parsed.urgency === 'critical' || parsed.urgency === 'high'),
      concise: channel === 'whatsapp',
      formal: channel === 'email',
    }

    // ── Step 12: Return the complete structured output ─────────────────────
    return {
      response: parsed.response,
      intent: parsed.intent !== 'other' ? parsed.intent : (intent || 'other'),
      sentiment: parsed.sentiment,
      language,
      provider,
      channelHints,
      matchedRule: matchedRule ? {
        id: matchedRule.id,
        nameEn: matchedRule.nameEn,
        nameAr: matchedRule.nameAr,
        category: matchedRule.category,
      } : undefined,
      missingFields: missingFields.length > 0 ? missingFields : undefined,
      availableFields: Object.keys(availableFields).length > 0 ? availableFields : undefined,
      actionReady,
      suggestedAction: suggestedAction || undefined,
    }
  },

  // Expose language detection as a utility (channels may need it independently)
  detectLanguage,
}

export default SmartBrain
