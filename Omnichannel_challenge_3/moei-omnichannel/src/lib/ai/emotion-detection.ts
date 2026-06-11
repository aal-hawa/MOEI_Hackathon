/**
 * MOEI Emotion Detection - Keyword-based emotion analysis
 * Extracted from voice-call-service for reuse in the REST pipeline API.
 * Supports English and Arabic keyword matching with optional LLM enhancement.
 */

import { unifiedQuickComplete } from '@/lib/ai'

// ─── Types ──────────────────────────────────────────────────────────────────

export type Emotion = 'angry' | 'frustrated' | 'calm' | 'satisfied' | 'confused' | 'urgent'

export interface EmotionResult {
  emotion: Emotion
  confidence: number
}

// ─── Keyword Database ───────────────────────────────────────────────────────

const EMOTION_KEYWORDS: Record<Emotion, { en: string[]; ar: string[] }> = {
  angry: {
    en: ['angry', 'furious', 'outraged', 'disgusted', 'unacceptable', 'ridiculous', 'worst', 'terrible service', 'complaint', 'manager', 'supervisor', 'lawyer'],
    ar: ['غاضب', 'غضبان', 'مستاء', 'غير مقبول', 'فضيعة', 'أسوأ', 'خدمة سيئة', 'شكوى', 'مدير', 'مشرف', 'محامي', 'سأشتكي'],
  },
  frustrated: {
    en: ['frustrated', 'annoyed', 'tired of', 'sick of', 'again', 'still waiting', 'no one helped', 'keeps happening', 'already called', 'nothing happened'],
    ar: ['محبط', 'متعب', 'مللت', 'مرة أخرى', 'ما زلت أنتظر', 'لم يساعدني أحد', 'يستمر', 'اتصلت بالفعل', 'لم يحدث شيء'],
  },
  calm: {
    en: ['thank you', 'please', 'help me', 'i would like', 'could you', 'appreciate', 'kindly'],
    ar: ['شكراً', 'لو سمحت', 'ساعدني', 'أود', 'هل يمكنك', 'أقدر', 'تفضل'],
  },
  satisfied: {
    en: ['great', 'excellent', 'perfect', 'wonderful', 'very helpful', 'thank you so much', 'appreciate it', 'resolved', 'that works'],
    ar: ['ممتاز', 'رائع', 'مثالي', 'مفيد جداً', 'شكراً جزيلاً', 'أقدر ذلك', 'تم الحل', 'هذا يعمل'],
  },
  confused: {
    en: ['confused', "don't understand", 'not sure', 'what do you mean', 'unclear', 'how does', 'where do i', "i don't know how"],
    ar: ['مرتبك', 'لا أفهم', 'لست متأكداً', 'ماذا تقصد', 'غير واضح', 'كيف', 'أين', 'لا أعرف كيف'],
  },
  urgent: {
    en: ['urgent', 'emergency', 'immediately', 'right now', 'asap', 'danger', 'leak', 'explosion', 'fire', 'hazard', 'power outage', 'no water'],
    ar: ['عاجل', 'طوارئ', 'فوراً', 'الآن', 'خطر', 'تسرب', 'انفجار', 'حريق', 'خطر', 'انقطاع التيار', 'لا ماء'],
  },
}

// ─── AI Mode Type & Prompt Injections ───────────────────────────────────────

export type AIMode = 'customer_support' | 'sales' | 'calm' | 'escalation' | 'technical' | 'friendly'

export const MODE_INJECTIONS: Record<AIMode, { en: string; ar: string }> = {
  customer_support: {
    en: `\n\n## Current Mode: Customer Support\nFocus on resolving the customer's issue efficiently. Ask clarifying questions if needed. Prioritize first-contact resolution. Be solution-oriented and guide the customer step by step.`,
    ar: `\n\n## الوضع الحالي: خدمة العملاء\nركز على حل مشكلة العميل بكفاءة. اطرح أسئلة توضيحية إذا لزم الأمر. أعطِ الأولوية للحل من أول اتصال. كن موجهاً نحو الحل وأرشد العميل خطوة بخطوة.`,
  },
  sales: {
    en: `\n\n## Current Mode: Sales\nFocus on presenting MOEI services positively. Highlight benefits, value propositions, and ease of access. Mention relevant promotions or new services. Guide toward application or enrollment where appropriate.`,
    ar: `\n\n## الوضع الحالي: المبيعات\nركز على تقديم خدمات الوزارة بشكل إيجابي. أبرز الفوائد وقيمة الخدمات وسهولة الوصول إليها. اذكر العروض أو الخدمات الجديدة ذات الصلة. وجّه نحو التقديم أو التسجيل حيثما كان ذلك مناسباً.`,
  },
  calm: {
    en: `\n\n## Current Mode: Calm & Reassuring\nThe customer appears distressed. Use a very gentle, reassuring tone. Acknowledge their feelings explicitly. Speak slowly and clearly. Avoid technical jargon. Offer concrete next steps. Reassure them that their concern is being taken seriously.`,
    ar: `\n\n## الوضع الحالي: هادئ ومطمئن\nيبدو أن العميل متضايق. استخدم نبرة لطيفة جداً ومطمئنة. أقر بمشاعرهم صراحةً. تحدث ببطء ووضوح. تجنب المصطلحات التقنية. اعرض خطوات محددة تالية. طمئنهم بأن مخاوفهم تؤخذ على محمل الجد.`,
  },
  escalation: {
    en: `\n\n## Current Mode: Escalation Handling\nThe situation requires de-escalation. Stay extremely calm and professional. Do not argue. Validate the customer's frustration. Apologize for the inconvenience. Offer immediate escalation to a supervisor if the customer requests it. Provide a concrete reference or next step.`,
    ar: `\n\n## الوضع الحالي: التعامل مع التصعيد\nالوضع يتطلب تهدئة الأمر. ابقَ هادئاً ومهنياً للغاية. لا تجادل. أكد على إحباط العميل. اعتذر عن الإزعاج. اعرض التصعيد الفوري إلى مشرف إذا طلب العميل ذلك. قدم مرجعاً محدداً أو خطوة تالية.`,
  },
  technical: {
    en: `\n\n## Current Mode: Technical Support\nProvide detailed technical information. Use precise terminology but explain complex concepts clearly. Walk through troubleshooting steps methodically. Reference specific systems, portals, or processes by name. Provide exact URLs, reference numbers, or form names.`,
    ar: `\n\n## الوضع الحالي: الدعم الفني\nقدم معلومات فنية مفصلة. استخدم مصطلحات دقيقة لكن اشرح المفاهيم المعقدة بوضوح. اتبع خطوات استكشاف الأخطاء وإصلاحها بشكل منهجي. أشر إلى أنظمة أو بوابات أو عمليات محددة بالاسم. قدم عناوين URL أو أرقام مرجعية أو أسماء نماذج دقيقة.`,
  },
  friendly: {
    en: `\n\n## Current Mode: Friendly & Approachable\nUse a warm, conversational tone. Be personable while maintaining professionalism. Use the customer's name if known. Show genuine interest in helping. Keep things light but respectful.`,
    ar: `\n\n## الوضع الحالي: ودود وودود\nاستخدم نبرة دافئة وحوارية. كن ودوداً مع الحفاظ على المهنية. استخدم اسم العميل إن كان معروفاً. أظهر اهتماماً حقيقياً بالمساعدة. حافظ على الأمور خفيفة ولكن محترمة.`,
  },
}

// ─── Sentiment Mapping ──────────────────────────────────────────────────────

const EMOTION_TO_SENTIMENT: Record<Emotion, number> = {
  angry: 0.1,
  frustrated: 0.2,
  confused: 0.35,
  calm: 0.6,
  satisfied: 0.85,
  urgent: 0.25,
}

/**
 * Map an emotion to a sentiment score (0 = very negative, 1 = very positive)
 */
export function emotionToSentiment(emotion: Emotion): number {
  return EMOTION_TO_SENTIMENT[emotion] ?? 0.5
}

// ─── Language Detection Helper ──────────────────────────────────────────────

function detectLanguage(text: string): 'en' | 'ar' {
  const arabicMatches = text.match(/[\u0600-\u06FF]/g)
  const arabicCharCount = arabicMatches ? arabicMatches.length : 0
  const totalChars = text.replace(/\s/g, '').length
  if (totalChars === 0) return 'en'
  return arabicCharCount / totalChars > 0.3 ? 'ar' : 'en'
}

// ─── Keyword-based Emotion Detection ────────────────────────────────────────

/**
 * Detect emotion from text using keyword matching.
 * Fast and deterministic — suitable for real-time use.
 */
export function detectEmotionFromText(
  text: string,
  language?: 'en' | 'ar'
): EmotionResult {
  const lowerText = text.toLowerCase()
  const hasArabic = /[\u0600-\u06FF]/.test(text)
  const lang = language || (hasArabic ? 'ar' : 'en')

  let bestEmotion: Emotion = 'calm'
  let bestScore = 0

  for (const [emotion, keywords] of Object.entries(EMOTION_KEYWORDS)) {
    const relevantKeywords = keywords[lang as 'en' | 'ar']
    let matchCount = 0
    for (const keyword of relevantKeywords) {
      if (lowerText.includes(keyword.toLowerCase()) || text.includes(keyword)) {
        matchCount++
      }
    }
    const score = matchCount / Math.max(relevantKeywords.length, 1)
    if (matchCount > 0 && score > bestScore) {
      bestScore = score
      bestEmotion = emotion as Emotion
    }
  }

  // If no strong signal, default to calm
  if (bestScore === 0) {
    return { emotion: 'calm', confidence: 0.6 }
  }

  return {
    emotion: bestEmotion,
    confidence: Math.min(0.95, 0.5 + bestScore * 2),
  }
}

// AI provider is now unified via @/lib/ai (Gemini primary, ZAI fallback)

// ─── LLM-enhanced Emotion Detection ────────────────────────────────────────

/**
 * Detect emotion using keywords first, then optionally enhance with LLM
 * for ambiguous cases (low keyword confidence).
 */
export async function detectEmotion(
  text: string,
  language?: 'en' | 'ar'
): Promise<EmotionResult> {
  const detectedLang = language || detectLanguage(text)

  // Start with fast keyword-based detection
  const localResult = detectEmotionFromText(text, detectedLang)

  // If high confidence from keywords, use it directly
  if (localResult.confidence > 0.8) {
    return localResult
  }

  // For ambiguous cases, try LLM enhancement
  try {
    const prompt = detectedLang === 'ar'
      ? `حلل مشاعر رسالة العميل التالية وأجب بصيغة JSON فقط:
{"emotion": "angry|frustrated|calm|satisfied|confused|urgent", "confidence": 0.0-1.0}

رسالة العميل: "${text}"`
      : `Analyze the emotion of the following customer message and respond ONLY in JSON format:
{"emotion": "angry|frustrated|calm|satisfied|confused|urgent", "confidence": 0.0-1.0}

Customer message: "${text}"`

    const completion = await unifiedQuickComplete(prompt, undefined, { temperature: 0.3, maxOutputTokens: 128 })

    const content = completion.content
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      const validEmotions: Emotion[] = ['angry', 'frustrated', 'calm', 'satisfied', 'confused', 'urgent']
      if (validEmotions.includes(parsed.emotion)) {
        return {
          emotion: parsed.emotion,
          confidence: typeof parsed.confidence === 'number'
            ? Math.min(1, Math.max(0, parsed.confidence))
            : localResult.confidence,
        }
      }
    }
  } catch (error) {
    console.warn('[EMOTION] LLM emotion detection failed, using local result:', error)
  }

  return localResult
}
