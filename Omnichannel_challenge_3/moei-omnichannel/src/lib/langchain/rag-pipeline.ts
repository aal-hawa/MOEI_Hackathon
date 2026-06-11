/**
 * MOEI RAG Pipeline - Retrieval Augmented Generation
 * Enhanced with MOEI Knowledge Base, LLM-based intent classification,
 * language detection, and co-pilot suggestion generation
 * Uses LangChain.js for orchestration + ChromaDB for vector search
 * + z-ai-web-dev-sdk for LLM generation
 */

import { similaritySearchWithScore, initializeVectorStore } from './chromadb'
import { generateReferenceNumber } from '@/lib/security'
import { db } from '@/lib/db'
import {
  moeiKnowledgeBase,
  searchKnowledgeBase,
  getArticlesByCategory,
  type KnowledgeArticle,
} from '@/lib/moei-knowledge-base'
import { unifiedChatCompletion, unifiedQuickComplete, type ChatCompletionMessage } from '@/lib/ai'

// ─── Types ─────────────────────────────────────────────────────────────────

export interface RAGQuery {
  query: string
  language?: 'en' | 'ar'
  customerId?: string
  channel?: 'whatsapp' | 'voice' | 'email' | 'web'
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
}

export interface RAGResponse {
  answer: string
  sources: Array<{ content: string; category: string; score: number }>
  intent: string
  language: 'en' | 'ar'
  referenceNumber?: string
  caseCreated?: boolean
  sentiment?: SentimentResult
  suggestedActions?: string[]
  relatedArticles?: Array<{ id: string; titleEn: string; titleAr: string; category: string }>
}

export type MOEIIntent =
  | 'inquiry'
  | 'complaint'
  | 'suggestion'
  | 'appreciation'
  | 'case_status'
  | 'service_request'
  | 'emergency'
  | 'billing'
  | 'other'

export interface SentimentResult {
  score: number       // 0-1
  emotion: EmotionCategory
  urgency: UrgencyLevel
  recommendedAction: string
}

export type EmotionCategory = 'calm' | 'frustrated' | 'angry' | 'satisfied' | 'confused'
export type UrgencyLevel = 'low' | 'medium' | 'high' | 'critical'

export interface CoPilotSuggestion {
  nextBestAction: string
  suggestedResponse: string
  knowledgeArticles: Array<{ id: string; titleEn: string; titleAr: string; category: string }>
  sentiment: SentimentResult
  escalationRecommended: boolean
}

// AI provider is now unified via @/lib/ai (Gemini primary, ZAI fallback)

// ─── Retry Utility ──────────────────────────────────────────────────────────

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error: unknown) {
      lastError = error
      const is429 = error instanceof Error && (
        error.message.includes('429') || error.message.includes('Too many requests')
      )
      const is400 = error instanceof Error && (
        error.message.includes('400') || error.message.includes('参数非法')
      )
      if (is400) throw error
      if (!is429 && attempt > 0) throw error
      if (attempt < maxRetries && is429) {
        const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 500
        console.warn(`[RETRY] Rate limited, waiting ${Math.round(delay)}ms before attempt ${attempt + 1}/${maxRetries}`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  throw lastError
}

// ─── Language Detection ────────────────────────────────────────────────────

/**
 * Detects Arabic vs English with high accuracy
 * Uses Unicode range analysis, Arabic character ratio, and digraph patterns
 */
export function detectLanguage(text: string): 'en' | 'ar' {
  if (!text || text.trim().length === 0) return 'en'

  const arabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/
  const latinRegex = /[a-zA-Z]/

  let arabicCount = 0
  let latinCount = 0

  for (const char of text) {
    if (arabicRegex.test(char)) arabicCount++
    if (latinRegex.test(char)) latinCount++
  }

  const totalScriptChars = arabicCount + latinCount
  if (totalScriptChars === 0) return 'en'

  // If more than 30% of script characters are Arabic, classify as Arabic
  const arabicRatio = arabicCount / totalScriptChars

  // Also check for Arabic-specific patterns (definite article "ال", common prefixes)
  const arabicPatterns = /\bال|في|من|إلى|على|هذا|هذه|التي|الذي|كان|كانت\b/
  const hasArabicPatterns = arabicPatterns.test(text)

  if (arabicRatio > 0.3 || (arabicRatio > 0.15 && hasArabicPatterns)) {
    return 'ar'
  }

  return 'en'
}

// ─── Keyword-based Intent Detection (Fast Fallback) ────────────────────────

function detectIntentKeywords(query: string, language: 'en' | 'ar'): MOEIIntent {
  const q = query.toLowerCase()

  // Emergency detection (highest priority)
  const emergencyKeywords = language === 'ar'
    ? ['طوارئ', 'تسرب غاز', 'حريق', 'خطر', 'انفجار', 'صعقة كهربائية', 'انقطاع كبير', 'تلوث مياه']
    : ['emergency', 'gas leak', 'fire', 'danger', 'explosion', 'electrical hazard', 'electrocution', 'power outage', 'contamination']
  if (emergencyKeywords.some(k => q.includes(k))) return 'emergency'

  // Complaint detection
  const complaintKeywords = language === 'ar'
    ? ['شكوى', 'اشتكي', 'مشكلة', 'غير راض', 'سيء', 'ضعيف', 'متضايق', 'ظلم', 'إهمال']
    : ['complaint', 'complain', 'problem', 'not satisfied', 'terrible', 'awful', 'unhappy', 'frustrated', 'unacceptable', 'disappointed']
  if (complaintKeywords.some(k => q.includes(k))) return 'complaint'

  // Billing detection
  const billingKeywords = language === 'ar'
    ? ['فاتورة', 'فواتير', 'دفع', 'رسوم', 'تعرفة', 'مبلغ', 'محاسب', 'تحصيل']
    : ['bill', 'billing', 'payment', 'fee', 'tariff', 'charge', 'invoice', 'pay', 'cost', 'rate']
  if (billingKeywords.some(k => q.includes(k))) return 'billing'

  // Case status detection
  // Priority check: if a MOEI reference number pattern is in the message, always treat as case_status
  if (/MOEI-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}/i.test(q)) return 'case_status'

  const statusKeywords = language === 'ar'
    ? ['حالة', 'متابعة', 'رقم مرجعي', 'تقدم', 'ماذا حدث', 'moie-', 'moie', 'حالة الطلب', 'حالة طلبي', 'تحقق من حالة', 'أين طلبي', 'متى يتم']
    : ['status', 'track', 'reference', 'progress', 'what happened', 'moie-', 'moie', 'case number', 'request status', 'check my', 'my case', 'my request', 'where is my', 'when will', 'how long', 'update on', 'follow up', 'lookup', 'look up']
  if (statusKeywords.some(k => q.includes(k))) return 'case_status'

  // Service request detection
  const serviceKeywords = language === 'ar'
    ? ['طلب', 'أريد', 'احتاج', 'توصيل', 'فصل', 'تصريح', 'ترخيص', 'تقديم']
    : ['request', 'apply', 'need', 'connect', 'disconnect', 'permit', 'license', 'i want', 'how to']
  if (serviceKeywords.some(k => q.includes(k))) return 'service_request'

  // Suggestion detection
  const suggestionKeywords = language === 'ar'
    ? ['اقتراح', 'أقترح', 'تحسين', 'تطوير']
    : ['suggestion', 'suggest', 'improve', 'improvement', 'recommend']
  if (suggestionKeywords.some(k => q.includes(k))) return 'suggestion'

  // Appreciation detection
  const appreciationKeywords = language === 'ar'
    ? ['شكراً', 'ممتاز', 'رائع', 'شكر', 'مميز', 'جيد جداً']
    : ['thank', 'thanks', 'great', 'excellent', 'wonderful', 'appreciate', 'good job']
  if (appreciationKeywords.some(k => q.includes(k))) return 'appreciation'

  return 'inquiry'
}

// ─── LLM-based Intent Classification ──────────────────────────────────────

/**
 * Uses the LLM to classify the message intent with MOEI-specific categories.
 * Falls back to keyword detection if LLM fails.
 */
export async function classifyIntent(
  query: string,
  language: 'en' | 'ar'
): Promise<{ intent: MOEIIntent; confidence: number }> {
  // First, do fast keyword detection
  const keywordIntent = detectIntentKeywords(query, language)

  try {
    const prompt = language === 'ar'
      ? `صنّف نية رسالة العميل التالية إلى واحدة من الفئات التالية فقط:
- inquiry: استفسار عام عن خدمات الوزارة
- complaint: شكوى أو عدم رضا
- suggestion: اقتراح للتحسين
- appreciation: شكر أو تقدير
- case_status: متابعة حالة قضية أو طلب
- service_request: طلب خدمة محدد
- emergency: حالة طوارئ تتطلب تدخلاً فورياً
- billing: استفسار أو مشكلة متعلقة بالفواتير أو المدفوعات
- other: أي شيء آخر

رسالة العميل: "${query}"

أجب فقط بالكائن JSON التالي: {"intent": "الفئة", "confidence": 0.0-1.0}`
      : `Classify the following customer message intent into one of these categories:
- inquiry: general inquiry about MOEI services
- complaint: complaint or dissatisfaction
- suggestion: suggestion for improvement
- appreciation: thanks or praise
- case_status: following up on a case or request status
- service_request: requesting a specific service
- emergency: emergency requiring immediate intervention
- billing: inquiry or issue related to bills or payments
- other: anything else

Customer message: "${query}"

Respond ONLY with this JSON object: {"intent": "category", "confidence": 0.0-1.0}`

    const completion = await unifiedQuickComplete(prompt, undefined, { temperature: 0.3, maxOutputTokens: 256 })

    const content = completion.content
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      const validIntents: MOEIIntent[] = ['inquiry', 'complaint', 'suggestion', 'appreciation', 'case_status', 'service_request', 'emergency', 'billing', 'other']
      if (validIntents.includes(parsed.intent)) {
        return {
          intent: parsed.intent,
          confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.7,
        }
      }
    }

    // LLM response was unparseable, return keyword-based with lower confidence
    return { intent: keywordIntent, confidence: 0.5 }
  } catch (error) {
    console.warn('LLM intent classification failed, using keyword fallback:', error)
    return { intent: keywordIntent, confidence: 0.6 }
  }
}

// ─── Knowledge Base Context Builder ────────────────────────────────────────

/**
 * Search the local MOEI knowledge base for relevant articles
 * and format them as context for the LLM
 */
function searchAndFormatKnowledgeContext(
  query: string,
  language: 'en' | 'ar',
  maxArticles: number = 5
): { context: string; articles: KnowledgeArticle[] } {
  // Search using the knowledge base utility
  const relevantArticles = searchKnowledgeBase(query, maxArticles)

  if (relevantArticles.length === 0) {
    return { context: '', articles: [] }
  }

  const context = relevantArticles
    .map((article, i) => {
      const title = language === 'ar' ? article.titleAr : article.titleEn
      const content = language === 'ar' ? article.contentAr : article.contentEn
      return `[Article ${i + 1} - ${article.category}] ${title}\n${content.slice(0, 600)}`
    })
    .join('\n\n---\n\n')

  return { context, articles: relevantArticles }
}

// ─── Sentiment Analysis (Local + LLM-enhanced) ────────────────────────────

/**
 * Analyzes sentiment of the message. Uses keyword patterns for speed
 * with optional LLM enhancement for ambiguous cases.
 */
export function analyzeSentimentLocal(
  text: string,
  language: 'en' | 'ar'
): SentimentResult {
  const t = text.toLowerCase()

  // Score calculation based on positive/negative keywords
  const positiveKeywords = language === 'ar'
    ? ['شكر', 'ممتاز', 'رائع', 'جيد', 'مميز', 'سعيد', 'مؤيد', 'أقدر', 'مذهل']
    : ['thank', 'great', 'excellent', 'good', 'wonderful', 'happy', 'appreciate', 'amazing', 'perfect', 'love']
  const negativeKeywords = language === 'ar'
    ? ['سيء', 'ضعيف', 'متضايق', 'غاضب', 'ظلم', 'إهمال', 'رافض', 'فاشل', 'مزعج', 'محبط']
    : ['bad', 'terrible', 'awful', 'angry', 'unfair', 'neglect', 'refuse', 'failed', 'annoying', 'frustrated', 'unacceptable', 'worst']
  const urgentKeywords = language === 'ar'
    ? ['طوارئ', 'عاجل', 'فوراً', 'خطر', 'حريق', 'تسرب', 'انفجار', 'حياة']
    : ['emergency', 'urgent', 'immediately', 'danger', 'fire', 'leak', 'explosion', 'life', 'critical', 'asap']

  let positiveScore = 0
  let negativeScore = 0
  let urgentScore = 0

  for (const kw of positiveKeywords) {
    if (t.includes(kw)) positiveScore += 1
  }
  for (const kw of negativeKeywords) {
    if (t.includes(kw)) negativeScore += 1
  }
  for (const kw of urgentKeywords) {
    if (t.includes(kw)) urgentScore += 2
  }

  // Compute sentiment score: 0 (very negative) to 1 (very positive)
  const totalSignal = positiveScore + negativeScore + urgentScore
  let score: number
  if (totalSignal === 0) {
    score = 0.5 // neutral
  } else {
    score = Math.max(0, Math.min(1, 0.5 + (positiveScore - negativeScore - urgentScore) * 0.1))
  }

  // Determine emotion
  let emotion: EmotionCategory
  if (urgentScore >= 2) {
    emotion = 'angry'
  } else if (negativeScore >= 2) {
    emotion = 'frustrated'
  } else if (negativeScore >= 1 && positiveScore === 0) {
    emotion = 'confused'
  } else if (positiveScore >= 2) {
    emotion = 'satisfied'
  } else {
    emotion = 'calm'
  }

  // Determine urgency
  let urgency: UrgencyLevel
  if (urgentScore >= 3) {
    urgency = 'critical'
  } else if (urgentScore >= 1 || negativeScore >= 3) {
    urgency = 'high'
  } else if (negativeScore >= 1) {
    urgency = 'medium'
  } else {
    urgency = 'low'
  }

  // Recommended action
  let recommendedAction: string
  if (language === 'ar') {
    if (urgency === 'critical') recommendedAction = 'تحويل فوري إلى فريق الطوارئ أو المشرف'
    else if (emotion === 'angry' || emotion === 'frustrated') recommendedAction = 'عرض التعاطف ومحاولة حل المشكلة بسرعة'
    else if (urgency === 'high') recommendedAction = 'التصعيد إلى وكيل بشري'
    else recommendedAction = 'الاستمرار في المحادثة العادية'
  } else {
    if (urgency === 'critical') recommendedAction = 'Escalate immediately to emergency team or supervisor'
    else if (emotion === 'angry' || emotion === 'frustrated') recommendedAction = 'Show empathy and attempt quick resolution'
    else if (urgency === 'high') recommendedAction = 'Escalate to human agent'
    else recommendedAction = 'Continue normal conversation flow'
  }

  return { score, emotion, urgency, recommendedAction }
}

// ─── Co-Pilot Suggestion Generator ────────────────────────────────────────

/**
 * Generates next-best-action suggestions for human agents
 * based on conversation context and the last customer message.
 */
export async function generateCoPilotSuggestion(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  customerId?: string,
  language: 'en' | 'ar' = 'en'
): Promise<CoPilotSuggestion> {
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')
  const queryText = lastUserMsg?.content || ''

  // 1. Analyze sentiment
  const sentiment = analyzeSentimentLocal(queryText, language)

  // 2. Classify intent
  const { intent } = await classifyIntent(queryText, language)

  // 3. Search knowledge base for relevant articles
  const relevantArticles = searchKnowledgeBase(queryText, 3)
  const articlesForResponse = relevantArticles.map(a => ({
    id: a.id,
    titleEn: a.titleEn,
    titleAr: a.titleAr,
    category: a.category,
  }))

  // 4. Build context for LLM
  const conversationContext = messages
    .slice(-10)
    .map(m => `${m.role === 'user' ? 'Customer' : 'Agent'}: ${m.content}`)
    .join('\n')

  const kbContext = relevantArticles
    .map((a, i) => `[${i + 1}] ${language === 'ar' ? a.titleAr : a.titleEn}: ${(language === 'ar' ? a.contentAr : a.contentEn).slice(0, 400)}`)
    .join('\n\n')

  const escalationRecommended =
    sentiment.urgency === 'critical' ||
    sentiment.emotion === 'angry' ||
    (intent === 'complaint' && sentiment.score < 0.3)

  try {
    const prompt = language === 'ar'
      ? `أنت مساعد ذكي لوكيل خدمة عملاء بشري في وزارة الطاقة والبنية التحتية الإماراتية. بناءً على المحادثة التالية، قدم:

1. nextBestAction: أفضل إجراء تالي للوكيل البشري (جملة واحدة)
2. suggestedResponse: رد مقترح يمكن للوكيل استخدامه (2-3 جمل مهنية)
3. escalationRecommended: هل يجب التصعيد؟ (true/false)

سياق المعرفة:
${kbContext || 'لا توجد مقالات ذات صلة'}

المحادثة:
${conversationContext}

النية المكتشفة: ${intent}
المشاعر: ${sentiment.emotion} (درجة: ${sentiment.score.toFixed(2)})
الاستعجال: ${sentiment.urgency}

أجب فقط بصيغة JSON: {"nextBestAction": "...", "suggestedResponse": "...", "escalationRecommended": true/false}`
      : `You are an AI co-pilot assisting a human customer service agent at the UAE Ministry of Energy & Infrastructure (MOEI). Based on the conversation below, provide:

1. nextBestAction: The best next action for the human agent (one sentence)
2. suggestedResponse: A suggested response the agent can use (2-3 professional sentences)
3. escalationRecommended: Should this be escalated? (true/false)

Knowledge Context:
${kbContext || 'No relevant articles found'}

Conversation:
${conversationContext}

Detected Intent: ${intent}
Sentiment: ${sentiment.emotion} (score: ${sentiment.score.toFixed(2)})
Urgency: ${sentiment.urgency}

Respond ONLY in JSON format: {"nextBestAction": "...", "suggestedResponse": "...", "escalationRecommended": true/false}`

    const completion = await unifiedQuickComplete(prompt, undefined, { temperature: 0.3, maxOutputTokens: 512 })

    const content = completion.content
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        nextBestAction: parsed.nextBestAction || sentiment.recommendedAction,
        suggestedResponse: parsed.suggestedResponse || '',
        knowledgeArticles: articlesForResponse,
        sentiment,
        escalationRecommended: typeof parsed.escalationRecommended === 'boolean'
          ? parsed.escalationRecommended
          : escalationRecommended,
      }
    }
  } catch (error) {
    console.warn('Co-pilot LLM generation failed, using fallback:', error)
  }

  // Fallback: use local analysis
  return {
    nextBestAction: sentiment.recommendedAction,
    suggestedResponse: '',
    knowledgeArticles: articlesForResponse,
    sentiment,
    escalationRecommended,
  }
}

// ─── RAG System Prompt Builder ────────────────────────────────────────────

function buildRAGSystemPrompt(
  language: 'en' | 'ar',
  intent: string,
  context: string,
  kbContext: string
): string {
  const combinedContext = [context, kbContext].filter(Boolean).join('\n\n---\n\n')

  if (language === 'ar') {
    return `أنت وكيل خدمة عملاء بالذكاء الاصطناعي لوزارة الطاقة والبنية التحتية في الإمارات العربية المتحدة (MOEI).

## مهم: أنت الوزارة — لا تُعد توجيه العملاء لنفس القناة
العميل يتواصل بالفعل مع الوزارة عبر 8005555 أو www.moei.gov.ae. لا تُخبره "اتصل على 8005555" أو "زر الموقع" — هو يستخدم خدمتنا بالفعل. ساعده مباشرة بدلاً من ذلك.

## أرقام الطوارئ (قنوات مختلفة — شاركها للسلامة):
- طوارئ الكهرباء: 997 (24/7)
- طوارئ المياه: 998 (24/7)
- الطوارئ العامة: 999

## معلومات مرجعية عن الوزارة (لمعرفتك، وليس لتوجيه العملاء):
- الموقع: www.moei.gov.ae
- الرقم المجاني: 8005555
- ساعات العمل: الأحد - الخميس، 7:30 صباحاً - 2:30 مساءً
- يجب استخدام UAE PASS لجميع الخدمات الإلكترونية

## السياق المسترجع من قاعدة المعرفة:
${combinedContext || 'لا توجد معلومات محددة متاحة.'}

## القواعد المهمة:
- أجب بناءً على السياق المسترجع فقط
- إذا لم تجد الإجابة في السياق، قل ذلك بصدق واعرض المساعدة المباشرة أو التصعيد لموظف بشري
- لا تختلق أرقاماً مرجعية - سيوفرها النظام (تنسيق MOEI-XXXX-XXXX-XXXX)
- للحالات الطارئة المتعلقة بالسلامة، وجّه للاتصال بخدمات الطوارئ فوراً (997 للكهرباء، 998 للمياه، 999 للشرطة)
- كن مهنياً ومتعاطفاً ومحترماً - أنت تمثل وزارة حكومية
- أجب باللغة العربية
- لا تُعد توجيه العملاء إلى 8005555 أو www.moei.gov.ae — هم بالفعل على اتصال بالوزارة

## النية المكتشفة: ${intent}`
  }

  return `You are an AI customer service agent for the UAE Ministry of Energy & Infrastructure (MOEI).

## CRITICAL: YOU ARE MOEI — NO CIRCULAR REDIRECTS
The customer is already communicating with MOEI through this channel. They reached us via 8005555 or www.moei.gov.ae. NEVER tell them to "call 8005555" or "visit www.moei.gov.ae" — they are already here. Help them directly instead.

## Emergency Numbers (These are DIFFERENT channels — always share for safety):
- Electricity Emergency: 997 (24/7)
- Water Emergency: 998 (24/7)
- General Emergency: 999

## MOEI Reference Information (For your knowledge, NOT for redirecting customers):
- Website: www.moei.gov.ae
- Toll-free: 8005555
- Office Hours: Sunday - Thursday, 7:30 AM - 2:30 PM
- UAE PASS is required for all electronic services

## Retrieved Knowledge Base Context:
${combinedContext || 'No specific information available.'}

## Important Rules:
- Answer based ONLY on the retrieved context
- If the answer is not in the context, say so honestly and offer to help directly or escalate to a human agent
- NEVER invent reference numbers - the system will provide them (format: MOEI-XXXX-XXXX-XXXX)
- For emergencies, DIRECT customer to call emergency services IMMEDIATELY (997 electricity, 998 water, 999 police)
- Be professional, empathetic, and respectful — you represent a UAE government ministry
- Keep responses concise but complete
- NEVER redirect customers to 8005555 or www.moei.gov.ae — they are already in contact with MOEI

## Detected Intent: ${intent}`
}

// ─── Main RAG Pipeline ────────────────────────────────────────────────────

export async function processRAGQuery(req: RAGQuery): Promise<RAGResponse> {
  const language = req.language || detectLanguage(req.query)
  const { intent } = await classifyIntent(req.query, language)
  const sentiment = analyzeSentimentLocal(req.query, language)

  // 1. Initialize vector store (from DB articles)
  await initializeVectorStore()

  // 2. Retrieve relevant documents from vector store
  const relevantDocs = await similaritySearchWithScore(req.query, 5, 0.2)

  // 3. Search local MOEI knowledge base for additional context
  const { context: kbContext, articles: kbArticles } = searchAndFormatKnowledgeContext(
    req.query,
    language,
    5
  )

  // 4. Build context from vector store documents
  const vectorContext = relevantDocs
    .map((doc, i) => `[Source ${i + 1} - ${doc.metadata.category}]: ${doc.content.slice(0, 500)}`)
    .join('\n\n')

  // 5. Handle emergency intent immediately
  if (intent === 'emergency') {
    return {
      answer: language === 'ar'
        ? '⚠️ حالة طوارئ! يرجى الاتصال فوراً بخدمات الطوارئ:\n• 997 للطوارئ الكهربائية\n• 998 لطوارئ المياه\n• 999 للشرطة والإسعاف\n\nلا تنتظر ردنا للحوادث الطارئة. سلامتك أولوية قصوى.'
        : '⚠️ EMERGENCY! Please call emergency services immediately:\n• 997 for electricity emergencies\n• 998 for water emergencies\n• 999 for police/ambulance\n\nDo not wait for our response for urgent safety matters. Your safety is our top priority.',
      sources: relevantDocs,
      intent: 'emergency',
      language,
      sentiment,
      suggestedActions: language === 'ar'
        ? ['اتصل بـ 997/998/999 فوراً', 'ابتعد عن منطقة الخطر', 'أبلغ الجيران']
        : ['Call 997/998/999 immediately', 'Stay away from danger zone', 'Alert nearby residents'],
      relatedArticles: kbArticles.slice(0, 2).map(a => ({
        id: a.id,
        titleEn: a.titleEn,
        titleAr: a.titleAr,
        category: a.category,
      })),
    }
  }

  // 6. Handle case status lookup
  if (intent === 'case_status') {
    // Try to extract reference number from message (MOEI-XXXX-XXXX-XXXX format)
    const refMatch = req.query.match(/MOEI-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}/i)

    if (refMatch) {
      // Reference number provided — look it up directly
      const caseData = await db.case.findUnique({
        where: { referenceNumber: refMatch[0].toUpperCase() },
        select: {
          referenceNumber: true,
          titleEn: true,
          titleAr: true,
          status: true,
          priority: true,
          category: true,
          channel: true,
          createdAt: true,
          updatedAt: true,
          resolvedAt: true,
        },
      })
      if (caseData) {
        const statusLabels: Record<string, { en: string; ar: string }> = {
          open: { en: 'Open', ar: 'مفتوحة' },
          in_progress: { en: 'In Progress', ar: 'قيد التنفيذ' },
          resolved: { en: 'Resolved', ar: 'تم الحل' },
          closed: { en: 'Closed', ar: 'مغلقة' },
          escalated: { en: 'Escalated', ar: 'تم التصعيد' },
        }
        const statusLabel = statusLabels[caseData.status] || { en: caseData.status, ar: caseData.status }
        const priorityLabels: Record<string, { en: string; ar: string }> = {
          low: { en: 'Low', ar: 'منخفضة' },
          medium: { en: 'Medium', ar: 'متوسطة' },
          high: { en: 'High', ar: 'عالية' },
          critical: { en: 'Critical', ar: 'حرجة' },
        }
        const priorityLabel = priorityLabels[caseData.priority] || { en: caseData.priority, ar: caseData.priority }

        const statusMsg = language === 'ar'
          ? `📋 تفاصيل القضية:\n\n` +
            `🔹 الرقم المرجعي: ${caseData.referenceNumber}\n` +
            `📌 الموضوع: ${caseData.titleAr || caseData.titleEn}\n` +
            `📊 الحالة: ${statusLabel.ar}\n` +
            `⚡ الأولوية: ${priorityLabel.ar}\n` +
            `${caseData.category ? `📁 الفئة: ${caseData.category}\n` : ''}` +
            `📅 تاريخ الإنشاء: ${caseData.createdAt.toLocaleDateString('ar-AE')}\n` +
            `🔄 آخر تحديث: ${(caseData.updatedAt ? new Date(caseData.updatedAt) : caseData.createdAt).toLocaleDateString('ar-AE')}\n\n` +
            (caseData.status === 'resolved'
              ? `✅ تم حل قضيتك. هل تحتاج مساعدة إضافية؟`
              : caseData.status === 'in_progress'
                ? `⏳ قضيتك قيد التنفيذ. سأعمل على متابعتها لك. هل تريد أن أنقللك لموظف بشري للمتابعة؟`
                : caseData.status === 'escalated'
                  ? `🔴 تم تصعيد قضيتك لأولوية أعلى. سيتواصل معك فريقنا قريباً.`
                  : `🔵 قضيتك مفتوحة وجاري العمل عليها. هل تريد أي مساعدة إضافية؟`)
          : `📋 Case Details:\n\n` +
            `🔹 Reference: ${caseData.referenceNumber}\n` +
            `📌 Subject: ${caseData.titleEn}\n` +
            `📊 Status: ${statusLabel.en}\n` +
            `⚡ Priority: ${priorityLabel.en}\n` +
            `${caseData.category ? `📁 Category: ${caseData.category}\n` : ''}` +
            `📅 Created: ${caseData.createdAt.toLocaleDateString('en-AE')}\n` +
            `🔄 Last Updated: ${(caseData.updatedAt ? new Date(caseData.updatedAt) : caseData.createdAt).toLocaleDateString('en-AE')}\n\n` +
            (caseData.status === 'resolved'
              ? `✅ Your case has been resolved. Do you need any further assistance?`
              : caseData.status === 'in_progress'
                ? `⏳ Your case is currently in progress. I can help you follow up on it. Would you like me to transfer you to a human agent?`
                : caseData.status === 'escalated'
                  ? `🔴 Your case has been escalated for priority handling. Our team will contact you soon.`
                  : `🔵 Your case is open and being processed. Do you need any further assistance?`)

        return {
          answer: statusMsg,
          sources: [],
          intent: 'case_status',
          language,
          sentiment,
          suggestedActions: language === 'ar'
            ? ['متابعة القضية', 'طلب التحدث مع موظف بشري']
            : ['Follow up on this case', 'Request to speak with a human agent'],
        }
      } else {
        // Reference number not found
        return {
          answer: language === 'ar'
            ? `لم أتمكن من العثور على قضية بالرقم المرجعي ${refMatch[0].toUpperCase()}. يرجى التأكد من الرقم والمحاولة مرة أخرى. هل تريد أن أساعدك في شيء آخر؟`
            : `I couldn't find a case with reference number ${refMatch[0].toUpperCase()}. Please verify the number and try again. Can I help you with anything else?`,
          sources: [],
          intent: 'case_status',
          language,
          sentiment,
          suggestedActions: language === 'ar'
            ? ['تحقق من الرقم المرجعي', 'طلب المساعدة من موظف بشري']
            : ['Verify your reference number', 'Request help from a human agent'],
        }
      }
    }

    // No reference number provided — try to look up by customerId, or ask for reference number
    if (req.customerId) {
      try {
        const customerCases = await db.case.findMany({
          where: { customerId: req.customerId },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            referenceNumber: true,
            titleEn: true,
            titleAr: true,
            status: true,
            priority: true,
            category: true,
            createdAt: true,
            updatedAt: true,
          },
        })

        if (customerCases.length > 0) {
          const statusLabels: Record<string, { en: string; ar: string }> = {
            open: { en: 'Open', ar: 'مفتوحة' },
            in_progress: { en: 'In Progress', ar: 'قيد التنفيذ' },
            resolved: { en: 'Resolved', ar: 'تم الحل' },
            closed: { en: 'Closed', ar: 'مغلقة' },
            escalated: { en: 'Escalated', ar: 'تم التصعيد' },
          }

          const casesList = customerCases.map((c, i) => {
            const sl = statusLabels[c.status] || { en: c.status, ar: c.status }
            return language === 'ar'
              ? `${i + 1}. ${c.referenceNumber} — ${c.titleAr || c.titleEn} — ${sl.ar} — ${c.createdAt.toLocaleDateString('ar-AE')}`
              : `${i + 1}. ${c.referenceNumber} — ${c.titleEn} — ${sl.en} — ${c.createdAt.toLocaleDateString('en-AE')}`
          }).join('\n')

          const summary = language === 'ar'
            ? `📋 إليك قضاياك الحالية (${customerCases.length} قضايا):\n\n${casesList}\n\n` +
              `أدخل الرقم المرجعي المحدد (مثل MOEI-XXXX-XXXX-XXXX) للحصول على تفاصيل كاملة عن أي قضية، أو اطلب التحدث مع موظف بشري للمساعدة.`
            : `📋 Here are your current cases (${customerCases.length} cases):\n\n${casesList}\n\n` +
              `Enter the specific reference number (e.g., MOEI-XXXX-XXXX-XXXX) for full details on any case, or ask to speak with a human agent for assistance.`

          return {
            answer: summary,
            sources: [],
            intent: 'case_status',
            language,
            sentiment,
            suggestedActions: language === 'ar'
              ? ['أدخل رقم مرجعي للتفاصيل', 'طلب التحدث مع موظف بشري']
              : ['Enter a reference number for details', 'Ask to speak with a human agent'],
          }
        }
      } catch (dbError) {
        console.error('Failed to look up cases by customerId:', dbError)
      }
    }

    // No reference number and no customer ID / no cases found — ask for reference number
    return {
      answer: language === 'ar'
        ? `لمعرفة حالة طلبك، يرجى تزويدي برقمك المرجعي (التنسيق: MOEI-XXXX-XXXX-XXXX).\n\n` +
          `يمكنك العثور على الرقم المرجعي في:\n` +
          `• رسالة التأكيد التي تلقيتها عند تقديم الطلب\n` +
          `• البريد الإلكتروني التأكيدي\n` +
          `• البوابة الإلكترونية\n\n` +
          `أو يمكنك طلب التحدث مع موظف بشري وسيساعدك في المتابعة.`
        : `To check your request status, please provide your reference number (format: MOEI-XXXX-XXXX-XXXX).\n\n` +
          `You can find your reference number in:\n` +
          `• The confirmation message you received when submitting your request\n` +
          `• Your confirmation email\n` +
          `• The online services portal\n\n` +
          `Alternatively, you can ask to speak with a human agent and they will help you follow up.`,
      sources: [],
      intent: 'case_status',
      language,
      sentiment,
      suggestedActions: language === 'ar'
        ? ['أدخل الرقم المرجعي', 'طلب التحدث مع موظف بشري']
        : ['Enter your reference number', 'Ask to speak with a human agent'],
    }
  }

  // 7. Generate AI response with combined RAG context
  const systemPrompt = buildRAGSystemPrompt(language, intent, vectorContext, kbContext)

  const messages: ChatCompletionMessage[] = [
    { role: 'system', content: systemPrompt },
    ...(req.conversationHistory || []).slice(-10).map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user', content: req.query },
  ]

  try {
    const completion = await unifiedChatCompletion(messages, {
      temperature: 0.7,
      maxOutputTokens: 2048,
    })

    const answer = completion.content ||
      (language === 'ar' ? 'أعتذر، لم أتمكن من معالجة طلبك. يرجى المحاولة مرة أخرى أو اطلب التحدث مع موظف بشري.' : 'I apologize, I was unable to process your request. Please try again or ask to speak with a human agent.')

    // 8. If complaint intent and customer ID provided, create a case with priority based on urgency
    let referenceNumber: string | undefined
    let caseCreated = false

    if ((intent === 'complaint' || (intent === 'billing' && sentiment.score < 0.4)) && req.customerId) {
      // Determine priority based on urgency
      let priority: 'low' | 'medium' | 'high' | 'critical' = 'medium'
      if (sentiment.urgency === 'critical') priority = 'critical'
      else if (sentiment.urgency === 'high') priority = 'high'
      else if (sentiment.urgency === 'low') priority = 'low'

      referenceNumber = generateReferenceNumber()
      try {
        await db.case.create({
          data: {
            referenceNumber,
            customerId: req.customerId,
            titleEn: req.query.slice(0, 200),
            titleAr: req.query.slice(0, 200),
            description: req.query,
            status: 'open',
            priority,
            category: intent === 'billing' ? 'Billing' : 'Complaint',
            channel: req.channel || 'web',
          },
        })
        caseCreated = true
      } catch (error) {
        console.error('Failed to create case from complaint:', error)
        referenceNumber = undefined
      }
    }

    // Build suggested actions based on intent
    const suggestedActions = buildSuggestedActions(intent, language, caseCreated)

    return {
      answer: caseCreated && referenceNumber
        ? `${answer}\n\n${language === 'ar' ? `📋 تم إنشاء قضية برقم مرجعي: ${referenceNumber}. يمكنك متابعة حالة قضيتك باستخدام هذا الرقم أو طلب التحدث مع موظف بشري.` : `📋 A case has been created with reference number: ${referenceNumber}. You can track your case using this number or ask to speak with a human agent for updates.`}`
        : answer,
      sources: relevantDocs,
      intent,
      language,
      referenceNumber,
      caseCreated,
      sentiment,
      suggestedActions,
      relatedArticles: kbArticles.slice(0, 3).map(a => ({
        id: a.id,
        titleEn: a.titleEn,
        titleAr: a.titleAr,
        category: a.category,
      })),
    }
  } catch (error) {
    console.error('RAG pipeline error:', error)
    return {
      answer: language === 'ar'
        ? 'أعتذر عن الخطأ. يرجى المحاولة مرة أخرى أو طلب التحدث مع موظف بشري.'
        : 'I apologize for the error. Please try again or ask to speak with a human agent.',
      sources: [],
      intent,
      language,
      sentiment,
      suggestedActions: language === 'ar'
        ? ['حاول مرة أخرى', 'طلب التحدث مع موظف بشري']
        : ['Try again', 'Ask to speak with a human agent'],
    }
  }
}

// ─── Suggested Actions Builder ─────────────────────────────────────────────

function buildSuggestedActions(
  intent: string,
  language: 'en' | 'ar',
  caseCreated: boolean
): string[] {
  if (language === 'ar') {
    switch (intent) {
      case 'complaint':
        return caseCreated
          ? ['تابع قضيتك بالرقم المرجعي', 'طلب التحدث مع موظف بشري']
          : ['تقديم شكوى رسمية', 'طلب المساعدة المباشرة']
      case 'billing':
        return ['تحقق من فاتورتك', 'الدفع الإلكتروني عبر البوابة', 'طلب المساعدة في النزاعات']
      case 'service_request':
        return ['تقديم طلب عبر البوابة الإلكترونية', 'زيارة أقرب مركز خدمة', 'التأكد من وجود UAE PASS']
      case 'case_status':
        return ['أدخل الرقم المرجعي للمتابعة', 'طلب التحدث مع موظف بشري']
      case 'emergency':
        return ['اتصل بـ 997 (كهرباء) أو 998 (مياه) فوراً', 'ابتعد عن منطقة الخطر']
      case 'suggestion':
        return ['تقديم اقتراح', 'طلب المساعدة المباشرة']
      default:
        return ['تصفح الخدمات المتاحة', 'طلب المساعدة المباشرة']
    }
  }

  switch (intent) {
    case 'complaint':
      return caseCreated
        ? ['Track your case with the reference number', 'Ask to speak with a human agent']
        : ['Submit a formal complaint', 'Get direct assistance']
    case 'billing':
      return ['Check your bill online', 'Pay via the online portal', 'Get help with billing disputes']
    case 'service_request':
      return ['Apply online via the portal', 'Visit nearest service center', 'Ensure you have UAE PASS ready']
    case 'case_status':
      return ['Enter reference number to track', 'Ask to speak with a human agent']
    case 'emergency':
      return ['Call 997 (electricity) or 998 (water) immediately', 'Stay away from danger area']
    case 'suggestion':
      return ['Submit a suggestion', 'Get direct assistance']
    default:
      return ['Browse available services', 'Get direct assistance']
  }
}
