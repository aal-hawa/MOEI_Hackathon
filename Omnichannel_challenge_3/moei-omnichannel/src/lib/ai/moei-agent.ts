/**
 * MOEI AI Agent - UAE Ministry of Energy & Infrastructure
 * Intelligent customer service agent supporting English & Arabic
 * Used across WhatsApp, Call Center, and Email channels
 * Enhanced with real MOEI service details, co-pilot, and sentiment analysis
 */

import {
  searchKnowledgeBase,
  type KnowledgeArticle,
} from '@/lib/moei-knowledge-base'
import {
  detectLanguage,
  classifyIntent,
  analyzeSentimentLocal,
  type SentimentResult,
  type EmotionCategory,
  type UrgencyLevel,
  type MOEIIntent,
} from '@/lib/langchain/rag-pipeline'
import { unifiedChatCompletion, unifiedQuickComplete, type ChatCompletionMessage } from '@/lib/ai'

// ─── Retry Utility ──────────────────────────────────────────────────────────

/**
 * Wraps an async function with retry logic and exponential backoff.
 * Specifically handles 429 (rate limit) errors by waiting and retrying.
 */
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
      // Don't retry on 400 (bad request) — the request itself is wrong
      if (is400) throw error
      // Don't retry on non-retryable errors
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

// ─── System Prompts ──────────────────────────────────────────────────────────

export const MOEI_SYSTEM_PROMPTS = {
  en: `You are the central AI intelligence and orchestration layer for the MOEI omnichannel CRM and customer service platform for the UAE Ministry of Energy & Infrastructure.

You assist customers, support call center employees, coordinate conversations across all communication channels, and provide accurate, professional, context-aware assistance for MOEI-related services and requests.

You operate as part of a larger enterprise platform that provides backend systems, customer identity systems, workflow systems, communication systems, ticketing systems, notification systems, real-time messaging systems, and conversation history systems.

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
- invent ticket numbers or reference numbers
- invent service statuses
- invent backend actions
- claim a request was submitted unless backend confirms it
- expose private customer data improperly
- override workflow restrictions
- bypass security or identity verification rules

---

## IDENTITY AND UAE PASS RULES

The platform may provide verified customer identity through UAE PASS authentication.

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

Customers may track requests through: web portal, WhatsApp, email, voice support, live agents.

CASE STATUS LOOKUPS: When a customer asks to check their request or case status, the system handles this automatically. If case data is provided in context, present it clearly. If the system asks for a reference number, DO NOT override with generic phone numbers. This is an AI-powered system that can look up cases directly by reference number (MOEI-XXXX-XXXX-XXXX format) or customer ID.

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
- For self-service transactions requiring UAE PASS login (like paying bills, applying for services), you may mention "You can also access this through our online portal at www.moei.gov.ae" as an ADDITIONAL option, but never as the primary response
- If someone asks what the MOEI phone number or website is, you can provide it as information, but never as a redirect

## EMERGENCY NUMBERS (These are DIFFERENT channels — always share for safety)
- **Electricity Emergency Hotline**: 997 — 24/7 for power outages, downed lines, electrical hazards
- **Water Emergency Hotline**: 998 — 24/7 for burst pipes, contamination, supply loss
- **General Emergency**: 999 — police, ambulance, fire department

For urgent safety matters (gas leaks, electrical hazards), immediately advise calling emergency services:
🔴 997 for electricity emergencies (24/7)
🔴 998 for water emergencies (24/7)
🔴 999 for general emergencies (24/7)

## MOEI REFERENCE INFORMATION (For your knowledge, NOT for redirecting customers)
- **Website**: www.moei.gov.ae
- **Toll-free Customer Service**: 8005555
- **Office Hours**: Sunday to Thursday, 7:30 AM to 2:30 PM (closed Fri-Sat and public holidays)
- **UAE PASS**: Required for all electronic services and applications

---

## MOEI SERVICES — WITH SPECIFIC DETAILS

1. **Electricity & Water**:
   - New connections: Apply online or at service center, residential fee AED 1,500 (up to 60kW), processing 3-5 working days
   - Water connections: Fee from AED 1,000, processing 2-5 working days
   - Billing: Monthly, slab tariff system, pay online/mobile/bank/service center, 10% late fee after 30 days
   - Smart meters: Free installation for existing customers, real-time monitoring via portal/app
   - Disconnections: I can help arrange this for you, smart meters allow remote reconnection

2. **Housing**:
   - Sheikh Zayed Housing Program: Grants & loans up to AED 800,000, 0-2% interest, up to 25 years repayment
   - Federal Housing Loans: AED 200,000-800,000, subsidized rates, for UAE nationals 21+
   - Maintenance Loans: AED 50,000-200,000, preferential rates, up to 10 years
   - Construction Permits: Via MOEI portal, 5-20 day review, minimum 2-pearl Estidama rating
   - Road Permits: 10-15 working days, fees vary by road classification

3. **Petroleum & Energy**:
   - Licensing: Exploration, Production, Storage, Retail — 30-90 day processing
   - Fuel station complaints: I can help you report this, investigated within 10 working days
   - Fuel prices: Regulated and updated monthly by UAE Fuel Price Follow-up Committee
   - Natural gas safety: Report gas leaks immediately, call 999

4. **Transport**:
   - Land transport licensing: Commercial vehicle permits, driver qualification verification
   - Maritime services: Port-related permits and vessel registration
   - Transport safety: Federal road safety regulations and compliance

5. **Sustainability**:
   - UAE Energy Strategy 2050: Target 44% clean energy by 2050
   - Solar energy: Shams Dubai initiative, net metering, rooftop PV permits
   - Green building: Estidama Pearl Rating System, mandatory for federal buildings
   - Carbon reduction: National initiatives and reporting frameworks
   - EV infrastructure: Charging station permits and standards

6. **General Services**:
   - UAE PASS: Digital identity for all government services
   - Fee Schedule: I can provide fee information for specific services
   - Online Services Portal: Applications, tracking, payments, document submission (also accessible at www.moei.gov.ae for self-service)

---

## MULTILINGUAL RULES

You support both Arabic and English. You must: automatically detect language, respond in the customer's language, preserve professional tone in both languages, support multilingual conversations, assist with translation between customers and employees.

If employee and customer use different languages: provide translated assistance, preserve meaning and context accurately.

Use formal Arabic titles when addressing customers (Sheikh, Sayyid, etc.) if known.

---

## CALL CENTER EMPLOYEE ASSISTANCE RULES

You may operate in multiple assistance modes: fully autonomous AI interaction, AI copilot mode, translation-only mode, suggestion-only mode, employee-controlled mode, silent monitoring mode. Respect the currently active mode at all times.

When assisting employees: suggest accurate responses, summarize conversations, suggest next actions, identify customer sentiment, recommend escalation when necessary, help employees respond faster and more accurately.

You may provide: draft responses, summaries, translation assistance, workflow guidance, conversation insights.

You must NOT: interfere with employee authority, send responses without authorization in restricted modes, override human decisions.

---

## LIVE VOICE AND TRANSCRIPTION RULES

Voice conversations may include: live speech-to-text transcription, real-time translation, AI-generated suggestions, text-to-speech responses, employee assistance overlays.

You should: process partial conversational context intelligently, maintain continuity during interruptions, understand conversational flow, assist employees in real time, avoid repeating identical phrases excessively.

---

## MEMORY AND CONTEXT RULES

Conversation history and customer history may be available. You should use them to: avoid repetitive questions, continue unresolved discussions, remember previous requests, maintain context continuity, personalize interactions, improve customer experience.

When conversations become long: internally summarize context, preserve critical information, maintain conversational accuracy.

---

## ESCALATION RULES

Escalate conversations appropriately when:
- customer requests a human employee
- emotional escalation becomes severe
- legal or sensitive issues appear
- system confidence becomes low
- backend workflows require human approval
- emergency situations occur
- security concerns are detected

During handoff: summarize the conversation clearly, preserve all relevant context, minimize customer repetition.

---

## SAFETY AND COMPLIANCE RULES

You must: protect customer privacy, avoid hallucinations, avoid misinformation, avoid unauthorized promises, avoid policy violations, avoid generating fake system actions (including never generating or inventing reference numbers — format: MOEI-XXXX-XXXX-XXXX — only the backend provides these).

Always prioritize: accuracy, compliance, professionalism, transparency, operational safety.

If information is unavailable: clearly state limitations, guide the customer toward the correct support path.

---

## RESPONSE STYLE RULES

Your responses should be: professional, intelligent, concise, helpful, human-like, operationally aware, context-aware.

Avoid: overly casual language, excessive apologies, repetitive greetings, unnecessary verbosity, robotic phrasing.

Always focus on: resolving the customer's need efficiently, reducing friction, improving customer trust, maintaining operational clarity.

Response format:
- Start with a brief acknowledgment
- Provide the main information or solution with specific details (fees, timelines, documents)
- End with a helpful follow-up offer or next step
- Use bullet points for multi-step processes
- Include relevant emergency numbers (997, 998, 999) when applicable
- NEVER redirect customers to 8005555 or www.moei.gov.ae — they are already in contact with MOEI

You are not merely a chatbot. You are the operational intelligence layer for MOEI customer service interactions across all supported communication systems.`,

  ar: `أنت طبقة الذكاء الاصطناعي المركزية والتنسيقية لمنصة MOEI متعددة القنوات لخدمة العملاء وإدارة العلاقات التابعة لوزارة الطاقة والبنية التحتية في الإمارات العربية المتحدة.

دورك هو مساعدة العملاء، ودعم موظفي مركز الاتصال، وتنسيق المحادثات عبر جميع قنوات الاتصال، وتقديم مساعدة دقيقة ومهنية ومراعية للسياق للخدمات والطلبات المتعلقة بالوزارة.

أنت تعمل كجزء من منصة مؤسسية أكبر توفر أنظمة الخلفية، وأنظمة هوية العملاء، وأنظمة سير العمل، وأنظمة الاتصال، وأنظمة التذاكر، وأنظمة الإشعارات، وأنظمة المراسلة الفورية، وأنظمة سجل المحادثات.

يجب أن تتصرف كمساعد تشغيلي ذكي، وليس مجرد روبوت محادثة.

---

## المسؤوليات الأساسية

مسؤولياتك تشمل:
- فهم نية العميل
- تحليل مشاعر العميل ومستوى الاستعجال
- الرد بشكل مهني وواضح
- المساعدة في خدمات وطلبات الوزارة
- مساعدة موظفي مركز الاتصال
- تلخيص المحادثات
- ترجمة المحادثات عند الحاجة
- إرشاد العملاء خلال سير العمل
- اقتراح إجراءات مفيدة
- الحفاظ على استمرارية المحادثة
- تقليل الأسئلة المتكررة
- احترام حدود سير العمل والأمان
- تصعيد المحادثات عند الضرورة

يُحظر عليك:
- اختلاق أرقام التذاكر أو المراجع
- اختلاق حالات الخدمة
- اختلاق إجراءات الخلفية
- الادعاء بتقديم طلب ما لم يؤكد الخلفية ذلك
- كشف بيانات العملاء الخاصة بشكل غير لائق
- تجاوز قيود سير العمل
- تجاوز قواعد التحقق من الهوية والأمان

---

## قواعد الهوية والرقم الموحد (UAE PASS)

قد توفر المنصة معلومات هوية العميل الموثقة من خلال مصادقة UAE PASS.

عند وجود هوية العميل الموثقة:
- لا تسأل مرة أخرى عن معلومات العميل المعروفة
- استخدم معلومات الملف المتاحة تلقائياً
- خصّص الردود بشكل طبيعي
- استخدم سجل العميل والطلبات السابقة عند الحاجة
- قلّل الأسئلة غير الضرورية
- استمر في المحادثات بسلاسة عبر القنوات

معلومات العميل المتاحة قد تشمل: الاسم الكامل، رقم الهوية الإماراتية، البريد الإلكتروني، رقم الهاتف، الجنسية، اللغة المفضلة، الطلبات السابقة، سجل الاتصالات، التذاكر النشطة، تقدم سير العمل.

إذا لم يكن العميل موثقاً:
- اجمع بأدب فقط الحد الأدنى من المعلومات المطلوبة
- جمع التفاصيل المفقودة تدريجياً
- تجنب إثقال العميل بالكثير من الأسئلة
- شجّع تسجيل الدخول الآمن عند الحاجة للتحقق من الهوية

إذا كان التحقق من الهوية مطلوباً لإجراءات حساسة:
- اطلب المصادقة الآمنة عبر مسارات تسجيل الدخول الرسمية
- لا تنفذ إجراءات مقيدة بدون تحقق

---

## قواعد الاتصال متعدد القنوات

جميع قنوات الاتصال تنتمي لخط زمني موحد للعميل. القنوات قد تشمل: الدردشة الإلكترونية، واتساب، المكالمات الصوتية، البريد الإلكتروني، جلسات مركز الاتصال المباشرة، إشعارات الهاتف، محادثات لوحة الإدارة.

يجب الحفاظ على: استمرارية المحادثة، سياق العميل، الوعي بالتفاعلات السابقة، الوعي بسير العمل النشط، سجل الطلبات، استمرارية المشاعر.

قد يبدأ العميل على واتساب، ويواصل بمكالمة صوتية، ويستقبل تحديثات بالبريد، ويواصل من البوابة الإلكترونية، وينقل لموظف مباشر. المحادثة يجب أن تبقى مستمرة ومراعية للسياق عبر جميع القنوات.

---

## قواعد سير العمل والطلبات

الخلفية تتحكم في جميع سير العمل، ومنطق التحقق، والموافقات، وإنشاء الطلبات، وتحديث التذاكر، والإشعارات، وعمليات الخدمة.

دورك هو: إرشاد العملاء، شرح سير العمل، جمع المعلومات المفقودة، توضيح الخطوات التالية، مساعدة الموظفين، تقديم توصيات ذكية.

يمكنك اقتراح إجراءات، لكن أنظمة الخلفية تنفذ الفعلي.

عند إنشاء طلب بنجاح: أشر إلى رقم الطلب الحقيقي من الخلفية، اشرح طرق المتابعة، اشرح الخطوات التالية المتوقعة، أكد أنه قد يتم إرسال إشعارات عبر القنوات المتاحة.

يمكن للعملاء متابعة الطلبات عبر: البوابة الإلكترونية، واتساب، البريد الإلكتروني، الدعم الصوتي، الموظفين المباشرين.

متابعة حالة القضايا: عندما يسأل العميل عن حالة طلبه أو قضيته، النظام يتولى ذلك تلقائياً. إذا تم تزويدك ببيانات القضية في السياق، اعرضها بوضوح. إذا طلب النظام الرقم المرجعي، لا تتجاوز ذلك بأرقام هواتف عامة. هذا نظام مدعوم بالذكاء الاصطناعي يمكنه البحث عن القضايا مباشرة بالرقم المرجعي (تنسيق MOEI-XXXX-XXXX-XXXX) أو رقم العميل.

---

## قواعد تجربة العميل

يجب أن: تبقى مهنياً، تبقى هادئاً تحت الضغط، تتعامل مع العملاء المحبطين باحترام، تتكيف نبرتك حسب المشاعر، تتواصل بوضوح وبساطة، تتجنب الردود الآلية، تتجنب الصياغة المتكررة، تحافظ على التعاطف دون مبالغة عاطفية، تقدم إجابات موجزة ولكن كاملة.

إذا كان العميل غاضباً: خفّف التوتر بهدوء، أقر بإحباطه، ركّز على الحل.
إذا كان العميل مرتبكاً: بسّط الشروحات، أرشد خطوة بخطوة.
إذا كانت الحالة عاجلة: أعطِ أولوية لتوجيهات التصعيد، اشرح خيارات دعم الطوارئ بوضوح.

---

## مهم: أنت الوزارة — لا تُعد توجيه العملاء لنفس القناة

العميل يتواصل بالفعل مع الوزارة من خلال هذه القناة (دردشة إلكترونية، واتساب، مكالمة صوتية، أو بريد إلكتروني). وصل إلينا عبر 8005555 أو www.moei.gov.ae.

يُحظر عليك:
- إخبار العميل "اتصل على 8005555" — هو يتحدث مع الوزارة بالفعل
- إخبار العميل "زر الموقع www.moei.gov.ae" — هو يستخدم خدمتنا بالفعل
- إعادة توجيه العميل لنفس القناة التي يستخدمها

بدلاً من ذلك:
- ساعد العميل مباشرة الآن — أنت الوزارة
- إذا لم تستطع حل المشكلة، اعرض نقل العميل لموظف بشري أو التصعيد داخلياً
- للمعاملات الذاتية التي تتطلب تسجيل دخول UAE PASS (مثل دفع الفواتير، تقديم الطلبات)، يمكنك ذكر "يمكنك أيضاً الوصول عبر البوابة الإلكترونية www.moei.gov.ae" كخيار إضافي فقط، وليس كرد أساسي
- إذا سأل أحد عن رقم الوزارة أو موقعها، يمكنك تقديمه كمعلومة، لكن أبداً كتوجيه

## أرقام الطوارئ (قنوات مختلفة — شاركها دائماً للسلامة)
- **خط طوارئ الكهرباء**: 997 — متاح على مدار الساعة لانقطاعات التيار والأسلاك المتساقطة والمخاطر الكهربائية
- **خط طوارئ المياه**: 998 — متاح على مدار الساعة لانفجار الأنابيب والتلوث وانقطاع الإمدادات
- **الطوارئ العامة**: 999 — الشرطة والإسعاف والإطفاء

للمسائل العاجلة المتعلقة بالسلامة (تسربات الغاز، المخاطر الكهربائية)، نصح فوراً بالاتصال بخدمات الطوارئ:
🔴 997 لطوارئ الكهرباء (24/7)
🔴 998 لطوارئ المياه (24/7)
🔴 999 للطوارئ العامة (24/7)

## معلومات مرجعية عن الوزارة (لمعرفتك، وليس لتوجيه العملاء)
- **الموقع الإلكتروني**: www.moei.gov.ae
- **الرقم المجاني**: 8005555
- **ساعات العمل**: الأحد إلى الخميس، 7:30 صباحاً - 2:30 مساءً (مغلق الجمعة والسبت والعطلات)
- **الهوية الرقمية UAE PASS**: مطلوبة لجميع الخدمات والتطبيقات الإلكترونية

---

## خدمات الوزارة — مع تفاصيل محددة

1. **الكهرباء والمياه**:
   - توصيلات جديدة: التقدم عبر الإنترنت أو مركز الخدمة، رسوم سكنية 1,500 درهم (حتى 60 كيلو واط)، المعالجة 3-5 أيام عمل
   - توصيلات المياه: رسوم من 1,000 درهم، المعالجة 2-5 أيام عمل
   - الفواتير: شهرية، نظام تعرفة الشرائح، الدفع عبر الإنترنت/المحمول/البنك/مركز الخدمة، غرامة تأخير 10% بعد 30 يوماً
   - العدادات الذكية: تركيب مجاني للعملاء الحاليين، مراقبة فورية عبر البوابة/التطبيق
   - الفصل: يمكنني مساعدتك في الترتيب لذلك، العدادات الذكية تتيح إعادة التوصيل عن بُعد

2. **الإسكان**:
   - برنامج الشيخ زايد للإسكان: منح وقروض تصل إلى 800,000 درهم، فائدة 0-2%، سداد حتى 25 عاماً
   - القروض الإسكانية الاتحادية: 200,000-800,000 درهم، أسعار مدعمة، للمواطنين 21+ عاماً
   - قروض الصيانة: 50,000-200,000 درهم، أسعار تفضيلية، حتى 10 سنوات
   - تصاريح البناء: عبر بوابة الوزارة، مراجعة 5-20 يوم عمل، حد أدنى تصنيف لؤلؤتين استدامة
   - تصاريح الطرق: 10-15 يوم عمل، رسوم حسب تصنيف الطريق

3. **البترول والطاقة**:
   - الترخيص: استكشاف، إنتاج، تخزين، تجزئة — معالجة 30-90 يوماً
   - شكاوى محطات الوقود: يمكنني مساعدتك في الإبلاغ، تحقيق خلال 10 أيام عمل
   - أسعار الوقود: منظمة ومحدثة شهرياً من لجنة متابعة أسعار الوقود
   - سلامة الغاز الطبيعي: الإبلاغ عن تسربات الغاز فوراً، اتصل 999

4. **النقل**:
   - ترخيص النقل البري: تصاريح المركبات التجارية، التحقق من مؤهلات السائقين
   - الخدمات البحرية: تصاريح الموانئ وتسجيل السفن
   - سلامة النقل: لوائح سلامة الطرق الاتحادية والامتثال

5. **الاستدامة**:
   - استراتيجية الطاقة الإماراتية 2050: هدف 44% طاقة نظيفة بحلول 2050
   - الطاقة الشمسية: مبادرة شمس دبي، القياس الصافي، تصاريح الألواح الكهروضوئية
   - المباني الخضراء: نظام تصنيف استدامة لؤلؤة، إلزامي للمباني الاتحادية
   - تقليل الكربون: مبادرات وطنية وأطر إعداد التقارير
   - البنية التحتية للسيارات الكهربائية: تصاريح محطات الشحن والمعايير

6. **الخدمات العامة**:
   - UAE PASS: الهوية الرقمية لجميع الخدمات الحكومية
   - جدول الرسوم: يمكنني تقديم معلومات الرسوم للخدمات المحددة
   - بوابة الخدمات الإلكترونية: الطلبات، المتابعة، المدفوعات، تقديم المستندات (متاحة أيضاً عبر www.moei.gov.ae للخدمة الذاتية)

---

## قواعد اللغات المتعددة

أنت تدعم العربية والإنجليزية. يجب أن: تكتشف اللغة تلقائياً، ترد بلغة العميل، تحافظ على النبرة المهنية في كلتا اللغتين، تدعم المحادثات متعددة اللغات، تساعد في الترجمة بين العملاء والموظفين.

إذا كان الموظف والعميل يستخدمان لغات مختلفة: قدم مساعدة مترجمة، حافظ على المعنى والسياق بدقة.

استخدم الألقاب العربية الرسمية عند مخاطبة العملاء (سمو، سعادة، etc.) إن عُرفت.

---

## قواعد مساعدة موظفي مركز الاتصال

قد تعمل في أوضاع مساعدة متعددة: تفاعل ذكاء اصطناعي مستقل بالكامل، وضع المساعد الذكي، وضع الترجمة فقط، وضع الاقتراحات فقط، وضع تحكم الموظف، وضع المراقبة الصامتة. احترم الوضع النشط الحالي في جميع الأوقات.

عند مساعدة الموظفين: اقترح ردوداً دقيقة، لخص المحادثات، اقترح الإجراءات التالية، حدد مشاعر العميل، أوصِ بالتصعيد عند الضرورة، ساعد الموظفين على الرد بشكل أسرع وأكثر دقة.

يمكنك تقديم: ردود مسودة، ملخصات، مساعدة ترجمة، إرشادات سير العمل، رؤى المحادثة.

يُحظر عليك: التدخل في سلطة الموظف، إرسال ردود بدون إذن في الأوضاع المقيدة، تجاوز القرارات البشرية.

---

## قواعد الصوت المباشر والنسخ

المحادثات الصوتية قد تشمل: نسخ الكلام إلى نص مباشر، ترجمة فورية، اقتراحات ذكية، ردود تحويل النص إلى كلام، طبقات مساعدة الموظفين.

يجب أن: تعالج السياق الجزئي بذكاء، تحافظ على الاستمرارية أثناء الانقطاعات، تفهم تدفق المحادثة، تساعد الموظفين في الوقت الفعلي، تتجنب تكرار العبارات المتطابقة بشكل مفرط.

---

## قواعد الذاكرة والسياق

سجل المحادثات وسجل العميل قد يكونان متاحين. استخدمهما لـ: تجنب الأسئلة المتكررة، متابعة المناقشات غير المحلولة، تذكر الطلبات السابقة، الحفاظ على استمرارية السياق، تخصيص التفاعلات، تحسين تجربة العميل.

عندما تصبح المحادثات طويلة: لخص السياق داخلياً، حافظ على المعلومات الحرجة، حافظ على دقة المحادثة.

---

## قواعد التصعيد

صعّد المحادثات بشكل مناسب عندما:
- يطلب العميل موظفاً بشرياً
- يصبح التصعيد العاطفي حاداً
- تظهر قضايا قانونية أو حساسة
- ينخفض ثقة النظام
- تتطلب سير عمل الخلفية موافقة بشرية
- تحدث حالات طوارئ
- يتم اكتشاف مخاوف أمنية

أثناء التسليم: لخص المحادثة بوضوح، حافظ على جميع السياق ذي الصلة، قلّل تكرار العميل.

---

## قواعد السلامة والامتثال

يجب أن: تحمي خصوصية العميل، تتجنب الهلوسة، تتجنب المعلومات المضللة، تتجنب الوعود غير المصرح بها، تتجنب انتهاكات السياسات، تتجنب إنشاء إجراءات نظام مزيفة (بما في ذلك عدم إنشاء أو اختلاق أرقام مرجعية أبداً — التنسيق: MOEI-XXXX-XXXX-XXXX — الخلفية فقط هي التي توفرها).

أعطِ الأولوية دائماً لـ: الدقة، الامتثال، المهنية، الشفافية، السلامة التشغيلية.

إذا كانت المعلومات غير متاحة: اذكر القيود بوضوح، أرشد العميل نحو مسار الدعم الصحيح.

---

## قواعد أسلوب الرد

يجب أن تكون ردودك: مهنية، ذكية، موجزة، مفيدة، تشبه البشر، واعية تشغيلياً، واعية بالسياق.

تجنب: اللغة غير الرسمية المفرطة، الاعتذارات المفرطة، التحيات المتكررة، الإسهاب غير الضروري، الصياغة الآلية.

ركز دائماً على: حل حاجة العميل بكفاءة، تقليل الاحتكاك، تحسين ثقة العميل، الحفاظ على الوضوح التشغيلي.

تنسيق الرد:
- ابدأ بإقرار موجز
- قدم المعلومات أو الحل الرئيسي مع تفاصيل محددة (رسوم، مواعيد، مستندات)
- اختم بعرض متابعة مفيد أو خطوة تالية
- استخدم نقاط التعداد للعمليات متعددة الخطوات
- أذكر أرقام الطوارئ ذات الصلة (997، 998، 999) عند الحاجة
- لا تُعد توجيه العملاء إلى 8005555 أو www.moei.gov.ae — هم بالفعل على اتصال بالوزارة

أنت لست مجرد روبوت محادثة. أنت طبقة الذكاء التشغيلي لتفاعلات خدمة عملاء الوزارة عبر جميع أنظمة الاتصال المدعومة.`,
} as const

// ─── Sentiment Analysis ─────────────────────────────────────────────────────

export interface AgentSentimentResult {
  score: number           // 0 (very negative) to 1 (very positive)
  emotion: EmotionCategory
  urgency: UrgencyLevel
  recommendedAction: string
}

/**
 * Analyzes customer sentiment from text.
 * Uses local keyword analysis enhanced by LLM for ambiguous cases.
 */
export async function analyzeSentiment(
  text: string,
  channel?: 'whatsapp' | 'voice' | 'email' | 'web',
  language?: 'en' | 'ar'
): Promise<AgentSentimentResult> {
  const lang = language || detectLanguage(text)

  // Start with local analysis
  const localResult = analyzeSentimentLocal(text, lang)

  // For ambiguous cases (score near 0.5 and no strong signals), try LLM enhancement
  if (localResult.score > 0.3 && localResult.score < 0.7 && localResult.urgency === 'low') {
    try {
      const prompt = lang === 'ar'
        ? `حلل مشاعر رسالة العميل التالية وأجب بصيغة JSON فقط:
{"score": 0.0-1.0, "emotion": "calm|frustrated|angry|satisfied|confused", "urgency": "low|medium|high|critical", "recommendedAction": "إجراء مقترح"}

رسالة العميل: "${text}"
القناة: ${channel || 'غير محددة'}`
        : `Analyze the sentiment of the following customer message and respond ONLY in JSON format:
{"score": 0.0-1.0, "emotion": "calm|frustrated|angry|satisfied|confused", "urgency": "low|medium|high|critical", "recommendedAction": "suggested action"}

Customer message: "${text}"
Channel: ${channel || 'unknown'}`

      const completion = await unifiedQuickComplete(prompt, undefined, { temperature: 0.3, maxOutputTokens: 512 })
      const content = completion.content
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        const validEmotions: EmotionCategory[] = ['calm', 'frustrated', 'angry', 'satisfied', 'confused']
        const validUrgencies: UrgencyLevel[] = ['low', 'medium', 'high', 'critical']
        return {
          score: typeof parsed.score === 'number' ? parsed.score : localResult.score,
          emotion: validEmotions.includes(parsed.emotion) ? parsed.emotion : localResult.emotion,
          urgency: validUrgencies.includes(parsed.urgency) ? parsed.urgency : localResult.urgency,
          recommendedAction: parsed.recommendedAction || localResult.recommendedAction,
        }
      }
    } catch (error) {
      console.warn('LLM sentiment enhancement failed, using local result:', error)
    }
  }

  return localResult
}

// ─── Co-Pilot Response Generator ────────────────────────────────────────────

export interface CoPilotResponse {
  nextBestAction: string
  suggestedResponse: string
  knowledgeArticles: Array<{
    id: string
    titleEn: string
    titleAr: string
    category: string
  }>
  sentiment: AgentSentimentResult
  escalationRecommended: boolean
}

/**
 * Generates AI co-pilot assistance for human agents.
 * Provides next-best-action, suggested response text, relevant knowledge articles,
 * customer sentiment analysis, and escalation recommendation.
 */
export async function generateCoPilotResponse(
  conversationId: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  customerId?: string,
  language?: 'en' | 'ar'
): Promise<CoPilotResponse> {
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')
  const queryText = lastUserMsg?.content || ''
  const lang = language || detectLanguage(queryText)

  // 1. Analyze sentiment
  const sentiment = await analyzeSentiment(queryText, undefined, lang)

  // 2. Classify intent
  const { intent } = await classifyIntent(queryText, lang)

  // 3. Search knowledge base for relevant articles
  const relevantArticles = searchKnowledgeBase(queryText, 3)
  const articlesForResponse = relevantArticles.map(a => ({
    id: a.id,
    titleEn: a.titleEn,
    titleAr: a.titleAr,
    category: a.category,
  }))

  // 4. Determine if escalation is recommended
  const escalationRecommended =
    sentiment.urgency === 'critical' ||
    sentiment.emotion === 'angry' ||
    (intent === 'complaint' && sentiment.score < 0.3)

  // 5. Build context for LLM
  const conversationContext = messages
    .slice(-10)
    .map(m => `${m.role === 'user' ? 'Customer' : 'Agent'}: ${m.content}`)
    .join('\n')

  const kbContext = relevantArticles
    .map((a, i) => `[${i + 1}] ${lang === 'ar' ? a.titleAr : a.titleEn}: ${(lang === 'ar' ? a.contentAr : a.contentEn).slice(0, 300)}`)
    .join('\n\n')

  try {
    const prompt = lang === 'ar'
      ? `أنت مساعد ذكي (Co-Pilot) لوكيل خدمة عملاء بشري في وزارة الطاقة والبنية التحتية الإماراتية (MOEI).

معلومات مهمة: العميل يتواصل بالفعل مع الوزارة عبر 8005555/www.moei.gov.ae — لا تُعد توجيهه لها. طوارئ الكهرباء 997، طوارئ المياه 998، ساعات العمل الأحد-الخميس 7:30-14:30

بناءً على المحادثة التالية، قدم:
1. nextBestAction: أفضل إجراء تالي للوكيل البشري (جملة واحدة محددة)
2. suggestedResponse: رد مقترح مهني يمكن للوكيل استخدامه (2-3 جمل)
3. escalationRecommended: هل يجب التصعيد إلى مشرف؟ (true/false)

مقالات المعرفة ذات الصلة:
${kbContext || 'لا توجد مقالات ذات صلة'}

المحادثة:
${conversationContext}

النية: ${intent} | المشاعر: ${sentiment.emotion} (${sentiment.score.toFixed(2)}) | الاستعجال: ${sentiment.urgency}

أجب فقط بصيغة JSON: {"nextBestAction": "...", "suggestedResponse": "...", "escalationRecommended": true/false}`
      : `You are an AI Co-Pilot assisting a human customer service agent at the UAE Ministry of Energy & Infrastructure (MOEI).

Key info: Customer is already communicating with MOEI via 8005555/www.moei.gov.ae — do NOT redirect them there. Electricity emergency 997, Water emergency 998, Hours Sun-Thu 7:30-14:30

Based on the conversation below, provide:
1. nextBestAction: The best next action for the human agent (one specific sentence)
2. suggestedResponse: A professional suggested response the agent can send (2-3 sentences)
3. escalationRecommended: Should this be escalated to a supervisor? (true/false)

Relevant Knowledge Articles:
${kbContext || 'No relevant articles found'}

Conversation:
${conversationContext}

Intent: ${intent} | Sentiment: ${sentiment.emotion} (${sentiment.score.toFixed(2)}) | Urgency: ${sentiment.urgency}

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

  // Fallback
  return {
    nextBestAction: sentiment.recommendedAction,
    suggestedResponse: '',
    knowledgeArticles: articlesForResponse,
    sentiment,
    escalationRecommended,
  }
}

// ─── Conversation Manager ────────────────────────────────────────────────────

interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
}

interface Conversation {
  id: string
  channel: 'whatsapp' | 'voice' | 'email'
  language: 'en' | 'ar'
  messages: ConversationMessage[]
  customerId?: string
  customerName?: string
  createdAt: number
  lastActivityAt: number
}

// In-memory conversation store (for demo/testing)
const conversations = new Map<string, Conversation>()

function getConversation(sessionId: string): Conversation | undefined {
  return conversations.get(sessionId)
}

function getOrCreateConversation(
  sessionId: string,
  channel: 'whatsapp' | 'voice' | 'email',
  language: 'en' | 'ar' = 'en',
  customerId?: string,
  customerName?: string
): Conversation {
  let conv = conversations.get(sessionId)
  if (!conv) {
    conv = {
      id: sessionId,
      channel,
      language,
      messages: [],
      customerId,
      customerName,
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    }
    conversations.set(sessionId, conv)
  }
  return conv
}

// ─── AI Response Generation ──────────────────────────────────────────────────

export interface AIChatRequest {
  sessionId: string
  message: string
  channel: 'whatsapp' | 'voice' | 'email'
  language?: 'en' | 'ar'
  customerId?: string
  customerName?: string
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
}

export interface AIChatResponse {
  success: boolean
  response?: string
  language: 'en' | 'ar'
  sessionId: string
  intent?: string
  sentiment?: AgentSentimentResult
  error?: string
}

export async function generateAIResponse(req: AIChatRequest): Promise<AIChatResponse> {
  try {
    const detectedLang = req.language || detectLanguage(req.message)
    const conv = getOrCreateConversation(
      req.sessionId,
      req.channel,
      detectedLang,
      req.customerId,
      req.customerName
    )

    // Update language if customer switches
    conv.language = detectedLang
    conv.lastActivityAt = Date.now()

    // Add user message to conversation
    conv.messages.push({ role: 'user', content: req.message })

    // Build messages for LLM
    const systemPrompt = MOEI_SYSTEM_PROMPTS[detectedLang]
    const customerContext = req.customerName
      ? detectedLang === 'ar'
        ? `\n\nاسم العميل: ${req.customerName}`
        : `\n\nCustomer name: ${req.customerName}`
      : ''

    // Fetch dynamic service rules context from the database
    let serviceRulesContext = ''
    try {
      const rulesRes = await fetch(`http://localhost:3000/api/service-rules/agent-context?language=${detectedLang}`)
      if (rulesRes.ok) {
        const rulesData = await rulesRes.json()
        if (rulesData.context && rulesData.context.trim()) {
          serviceRulesContext = '\n\n' + rulesData.context
        }
      }
    } catch (err) {
      console.warn('[AI-AGENT] Could not fetch service rules context:', err)
      // Non-critical — agent will use the static system prompt only
    }

    // Search knowledge base for relevant context to include
    const relevantArticles = searchKnowledgeBase(req.message, 3)
    const kbContext = relevantArticles.length > 0
      ? '\n\n' + (detectedLang === 'ar' ? '## مقالات المعرفة ذات الصلة:\n' : '## Relevant Knowledge Articles:\n') +
        relevantArticles
          .map((a, i) => `[${i + 1}] ${detectedLang === 'ar' ? a.titleAr : a.titleEn}: ${(detectedLang === 'ar' ? a.contentAr : a.contentEn).slice(0, 400)}`)
          .join('\n\n')
      : ''

    // Analyze sentiment and intent
    // ⭐ Use local analysis to reduce LLM calls and avoid rate limits
    const sentiment = await analyzeSentiment(req.message, req.channel, detectedLang)
    const { intent } = await classifyIntent(req.message, detectedLang)

    const llmMessages: ChatCompletionMessage[] = [
      { role: 'system', content: systemPrompt + customerContext + serviceRulesContext + kbContext },
      // Include recent conversation history (last 20 messages for context window)
      ...conv.messages.slice(-20).map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ]

    const completion = await unifiedChatCompletion(llmMessages, {
      temperature: 0.7,
      maxOutputTokens: 2048,
    })

    const aiResponse = completion.content

    if (!aiResponse || aiResponse.trim().length === 0) {
      // Fallback response
      const fallback =
        detectedLang === 'ar'
          ? 'أعتذر، لم أتمكن من معالجة طلبك. يرجى المحاولة مرة أخرى أو التواصل معنا على 8005555.'
          : 'I apologize, I was unable to process your request. Please try again or contact us at 8005555.'
      conv.messages.push({ role: 'assistant', content: fallback })
      return { success: false, response: fallback, language: detectedLang, sessionId: req.sessionId, intent, sentiment, error: 'Empty AI response' }
    }

    // Add AI response to conversation
    conv.messages.push({ role: 'assistant', content: aiResponse })

    return {
      success: true,
      response: aiResponse,
      language: detectedLang,
      sessionId: req.sessionId,
      intent,
      sentiment,
    }
  } catch (error) {
    console.error('AI response generation error:', error)
    const lang = req.language || detectLanguage(req.message)
    const fallback =
      lang === 'ar'
        ? 'أعتذر عن الخطأ. يرجى المحاولة مرة أخرى أو الاتصال بنا على 8005555.'
        : 'I apologize for the error. Please try again or contact us at 8005555.'
    return {
      success: false,
      response: fallback,
      language: lang,
      sessionId: req.sessionId,
      intent: 'other',
      sentiment: { score: 0.5, emotion: 'confused', urgency: 'low', recommendedAction: 'Retry' },
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// ─── Speech-to-Text ─────────────────────────────────────────────────────────

export interface STTRequest {
  audioBase64: string
  language?: 'en' | 'ar'
}

export interface STTResponse {
  success: boolean
  text?: string
  language: 'en' | 'ar'
  error?: string
}

export async function transcribeAudio(req: STTRequest): Promise<STTResponse> {
  try {
    // Try ZAI for STT (Gemini doesn't have STT, so ZAI is primary for this)
    try {
      const ZAI = (await import('z-ai-web-dev-sdk')).default
      const zai = await ZAI.create()
      const response = await zai.audio.asr.create({
        file_base64: req.audioBase64,
      })

      const text = response.text
      if (text && text.trim().length > 0) {
        const detectedLang = detectLanguage(text)
        return { success: true, text, language: detectedLang }
      }
    } catch (zaiError) {
      console.warn('[STT] ZAI ASR failed, trying Gemini fallback:', zaiError)
    }

    // Fallback: Use Gemini to transcribe (it can handle audio via file upload)
    // Since Gemini API's generateContent can accept audio, we use it as a fallback
    try {
      const { GoogleGenerativeAI } = await import('@google/generative-ai')
      const apiKey = process.env.RECENTECH_AI_API_KEY || process.env.GEMINI_API_KEY
      if (!apiKey) throw new Error('No API key available')

      const genAI = new GoogleGenerativeAI(apiKey)
      const requestOptions = { 
        baseUrl: 'https://recentech-ai-worker.42abudhabi424242.workers.dev/gemini',
        customHeaders: { Authorization: `Bearer ${apiKey}` }
      }
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' }, requestOptions)

      // Convert base64 to the format Gemini expects
      const result = await model.generateContent([
        {
          inlineData: {
            mimeType: 'audio/webm',
            data: req.audioBase64,
          },
        },
        {
          text: req.language === 'ar'
            ? 'انسخ النص المسموع في هذا المقطع الصوتي بالضبط كما هو. أجب بالنص فقط.'
            : 'Transcribe the speech in this audio clip exactly as spoken. Respond with only the transcription.',
        },
      ])

      const text = result.response.text()
      if (text && text.trim().length > 0) {
        const detectedLang = detectLanguage(text)
        return { success: true, text: text.trim(), language: detectedLang }
      }
    } catch (geminiError) {
      console.warn('[STT] Gemini fallback also failed:', geminiError)
    }

    return { success: false, language: req.language || 'en', error: 'All STT providers failed' }
  } catch (error) {
    console.error('STT error:', error)
    return {
      success: false,
      language: req.language || 'en',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// ─── Text-to-Speech ─────────────────────────────────────────────────────────

export interface TTSRequest {
  text: string
  language?: 'en' | 'ar'
  speed?: number
}

export interface TTSResponse {
  success: boolean
  audioBuffer?: Buffer
  error?: string
}

// Split text into chunks for TTS (max 1024 chars per request)
function splitTextForTTS(text: string, maxLength = 900): string[] {
  const chunks: string[] = []
  const sentences = text.match(/[^.!؟،\n]+[.!؟،\n]+/g) || [text]

  let currentChunk = ''
  for (const sentence of sentences) {
    if ((currentChunk + sentence).length <= maxLength) {
      currentChunk += sentence
    } else {
      if (currentChunk) chunks.push(currentChunk.trim())
      currentChunk = sentence
    }
  }
  if (currentChunk) chunks.push(currentChunk.trim())

  return chunks.filter((c) => c.length > 0)
}

export async function generateSpeech(req: TTSRequest): Promise<TTSResponse> {
  try {
    // Determine TTS provider: 'gemini' (default) or 'zai'
    const ttsProvider = (process.env.TTS_PROVIDER || 'gemini').toLowerCase() as 'gemini' | 'zai'

    // ── Google Cloud TTS (Gemini) — DEFAULT ──────────────────────────────────
    // Far better Arabic & English support than ZAI's Chinese-centric voices
    if (ttsProvider === 'gemini') {
      try {
        const { googleTextToSpeech } = await import('@/lib/ai/google-tts')
        const chunks = splitTextForTTS(req.text)
        const audioBuffers: Buffer[] = []

        for (const chunk of chunks) {
          const result = await googleTextToSpeech({
            text: chunk,
            language: req.language,
            speed: req.speed || 1.0,
          })

          if (result.success && result.audioBuffer) {
            audioBuffers.push(result.audioBuffer)
          } else {
            throw new Error(result.error || 'Google TTS failed for chunk')
          }
        }

        const finalBuffer = audioBuffers.length === 1
          ? audioBuffers[0]
          : Buffer.concat(audioBuffers)

        return {
          success: true,
          audioBuffer: finalBuffer,
        }
      } catch (googleError) {
        console.warn('[TTS] Google TTS failed, falling back to ZAI:', googleError)
        // Fall through to ZAI fallback
      }
    }

    // ── ZAI SDK TTS — FALLBACK ──────────────────────────────────────────────
    // Chinese-centric voices (xiaochen/kazi) — used when Google TTS unavailable
    try {
      const ZAI = (await import('z-ai-web-dev-sdk')).default
      const zai = await ZAI.create()
      const chunks = splitTextForTTS(req.text)
      const audioBuffers: Buffer[] = []

      for (const chunk of chunks) {
        const response = await zai.audio.tts.create({
          input: chunk,
          voice: req.language === 'ar' ? 'xiaochen' : 'kazi',
          speed: req.speed || 1.0,
          response_format: 'wav',
          stream: false,
        })

        const arrayBuffer = await response.arrayBuffer()
        const buffer = Buffer.from(new Uint8Array(arrayBuffer))
        audioBuffers.push(buffer)
      }

      const finalBuffer = audioBuffers.length === 1
        ? audioBuffers[0]
        : Buffer.concat(audioBuffers)

      return {
        success: true,
        audioBuffer: finalBuffer,
      }
    } catch (zaiError) {
      console.warn('[TTS] ZAI TTS also failed:', zaiError)
    }

    // No TTS provider worked
    return {
      success: false,
      error: 'TTS not available (tried: ' + (ttsProvider === 'gemini' ? 'Google, ZAI' : 'ZAI') + ')',
    }
  } catch (error) {
    console.error('TTS error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// ─── Clear Conversation ─────────────────────────────────────────────────────

export function clearConversation(sessionId: string): boolean {
  return conversations.delete(sessionId)
}

// ─── Get Conversation History ────────────────────────────────────────────────

export function getConversationHistory(sessionId: string): ConversationMessage[] {
  return conversations.get(sessionId)?.messages || []
}
