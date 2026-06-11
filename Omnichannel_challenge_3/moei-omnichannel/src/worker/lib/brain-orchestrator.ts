/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║               MOEI BRAIN ORCHESTRATOR                           ║
 * ║           "Before & After" Pattern for Smart Brain              ║
 * ╠══════════════════════════════════════════════════════════════════╣
 * ║                                                                  ║
 * ║  The Orchestrator does NOT do AI thinking.                      ║
 * ║  It only orchestrates "before" (DB loads) and "after" (action   ║
 * ║  execution) around the Brain.                                    ║
 * ║                                                                  ║
 * ║  BEFORE (prepares context):                                      ║
 * ║    1. Takes raw message + customerId/phone/email                ║
 * ║    2. Loads full Customer profile from DB                        ║
 * ║    3. Loads all active ServiceRules from DB (with fields/actions)║
 * ║    4. Detects language                                           ║
 * ║    5. Passes everything to SmartBrain.think()                    ║
 * ║                                                                  ║
 * ║  AFTER (executes actions):                                       ║
 * ║    1. Receives BrainOutput (response, intent, matchedRule,      ║
 * ║       missingFields, actionReady, suggestedAction)               ║
 * ║    2. If actionReady and matchedRule: loads ServiceRuleActions   ║
 * ║       from DB and executes them dynamically                      ║
 * ║    3. Action execution is data-driven — reads actionType from DB ║
 * ║    4. Returns OrchestratorResult to the channel adapter          ║
 * ║                                                                  ║
 * ║  Like a conductor: the Orchestrator doesn't play instruments,    ║
 * ║  but it makes sure everyone plays at the right time.             ║
 * ║                                                                  ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

import { SmartBrain, type BrainOutput, type ChannelHints } from './brain'
import { db } from './db'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface OrchestratorInput {
  message: string
  channel: 'whatsapp' | 'web' | 'voice' | 'email'
  language?: 'ar' | 'en'
  customerId?: string
  customerPhone?: string
  customerEmail?: string
  sessionId?: string
  conversationHistory?: Array<{ speaker: string; text: string }>
  aiMode?: 'full_ai' | 'ai_assist' | 'llm_tts' | 'human_only' | 'ai_disabled'
}

export interface OrchestratorResult {
  response: string
  intent: string
  sentiment: number
  language: 'ar' | 'en'
  provider: 'gemini' | 'zai' | 'fallback'
  matchedRule?: { id: string; nameEn: string; nameAr: string; category: string }
  missingFields?: Array<{
    fieldKey: string
    labelEn: string
    labelAr: string
    fieldType: string
    required: boolean
  }>
  availableFields?: Record<string, string>
  actionReady: boolean
  suggestedAction?: string
  actionResults?: Array<{ actionType: string; success: boolean; details?: string }>
  channelId?: ChannelHints
  customerId?: string // so channels know which customer was found/created
}

// ─── Internal Types ─────────────────────────────────────────────────────────

interface CustomerProfile {
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

// ─── BEFORE: Load Customer Profile ─────────────────────────────────────────

/**
 * Load full customer profile from DB using any available identifier.
 * Tries: customerId → phone → email
 */
async function loadCustomerProfile(
  customerId?: string,
  customerPhone?: string,
  customerEmail?: string,
): Promise<CustomerProfile | null> {
  try {
    const includeOpts = {
      cases: {
        orderBy: { createdAt: 'desc' as const },
        take: 5,
        select: { id: true, referenceNumber: true, status: true, titleEn: true, category: true },
      },
      serviceRequests: {
        orderBy: { createdAt: 'desc' as const },
        take: 5,
        select: { id: true, referenceNumber: true, status: true },
      },
      bills: {
        orderBy: { createdAt: 'desc' as const },
        take: 5,
        select: { id: true, amount: true, status: true, dueDate: true, description: true },
      },
    }

    // Try by ID first (most reliable)
    if (customerId) {
      const customer = await db.customer.findUnique({
        where: { id: customerId },
        include: includeOpts,
      })
      if (customer) return mapCustomerToProfile(customer)
    }

    // Try by phone
    if (customerPhone) {
      const customer = await db.customer.findFirst({
        where: { phone: customerPhone },
        include: includeOpts,
      })
      if (customer) return mapCustomerToProfile(customer)
    }

    // Try by email
    if (customerEmail) {
      const customer = await db.customer.findFirst({
        where: { email: customerEmail },
        include: includeOpts,
      })
      if (customer) return mapCustomerToProfile(customer)
    }

    return null
  } catch (err) {
    console.error('[BrainOrchestrator] Failed to load customer profile:', err)
    return null
  }
}

function mapCustomerToProfile(customer: any): CustomerProfile {
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

// ─── AFTER: Execute Actions ─────────────────────────────────────────────────

/**
 * Generate a reference number in MOEI format.
 * Format: MOEI-{CATEGORY}-{YEAR}-{XXXX}
 */
function generateReferenceNumber(category: string): string {
  const categoryCode = category
    .split('_')
    .map(w => w.substring(0, 1).toUpperCase())
    .join('')
    .substring(0, 3)
  const year = new Date().getFullYear()
  const random = Math.floor(1000 + Math.random() * 9000)
  return `MOEI-${categoryCode}-${year}-${random}`
}

/**
 * Resolve a payload template by substituting available fields.
 * Template uses {{fieldKey}} placeholders.
 */
function resolvePayloadTemplate(
  template: string,
  availableFields: Record<string, string>,
): Record<string, string> {
  if (!template || template.trim() === '' || template === '{}') {
    return { ...availableFields }
  }

  try {
    let resolved = template
    for (const [key, value] of Object.entries(availableFields)) {
      resolved = resolved.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
    }
    return JSON.parse(resolved)
  } catch {
    // If template parsing fails, just return available fields
    return { ...availableFields }
  }
}

/**
 * Execute a single CREATE_RECORD action.
 * Creates a Case and/or ServiceRequest in the database.
 */
async function executeCreateRecord(
  customerId: string,
  customer: any,
  availableFields: Record<string, string>,
  payloadTemplate: string | null,
  language: 'ar' | 'en',
  matchedRule: { id: string; nameEn: string; nameAr: string; category: string },
): Promise<{ success: boolean; details?: string }> {
  try {
    const payload = resolvePayloadTemplate(payloadTemplate || '{}', availableFields)
    const ruleName = language === 'ar' ? matchedRule.nameAr : matchedRule.nameEn
    const referenceNumber = generateReferenceNumber(matchedRule.category)

    // Create a Case
    const newCase = await db.case.create({
      data: {
        referenceNumber,
        customerId,
        titleEn: matchedRule.nameEn,
        titleAr: matchedRule.nameAr || matchedRule.nameEn,
        description: JSON.stringify(payload),
        status: 'open',
        priority: 'medium',
        category: matchedRule.category,
        channel: payload['channel'] || 'web',
      },
    })

    // Try to find or link to a Service
    const service = await db.service.findFirst({
      where: { category: matchedRule.category, isActive: true },
    })

    if (service) {
      // Create a ServiceRequest linked to the service
      const srRef = generateReferenceNumber(matchedRule.category)
      await db.serviceRequest.create({
        data: {
          referenceNumber: srRef,
          customerId,
          serviceId: service.id,
          status: 'pending',
          data: JSON.stringify(payload),
        },
      })

      return {
        success: true,
        details: `Created case ${referenceNumber} and service request ${srRef} for "${ruleName}"`,
      }
    }

    return {
      success: true,
      details: `Created case ${referenceNumber} for "${ruleName}"`,
    }
  } catch (err) {
    console.error('[BrainOrchestrator] CREATE_RECORD failed:', err)
    return { success: false, details: `Failed to create record: ${err instanceof Error ? err.message : String(err)}` }
  }
}

/**
 * Execute a single UPDATE_STATUS action.
 * Updates a case status if caseId is provided in availableFields.
 */
async function executeUpdateStatus(
  customerId: string,
  availableFields: Record<string, string>,
  payloadTemplate: string | null,
): Promise<{ success: boolean; details?: string }> {
  try {
    const payload = resolvePayloadTemplate(payloadTemplate || '{}', availableFields)

    // Try to find a case to update
    const caseId = payload['caseId'] || availableFields['caseId']
    const newStatus = payload['status'] || payload['newStatus'] || 'in_progress'

    if (caseId) {
      await db.case.update({
        where: { id: caseId },
        data: { status: newStatus },
      })
      return { success: true, details: `Updated case ${caseId} status to "${newStatus}"` }
    }

    // Try to find by reference number
    const refNumber = payload['referenceNumber'] || availableFields['referenceNumber']
    if (refNumber) {
      await db.case.update({
        where: { referenceNumber: refNumber },
        data: { status: newStatus },
      })
      return { success: true, details: `Updated case ${refNumber} status to "${newStatus}"` }
    }

    // No case identifier — update the most recent open case for this customer
    const latestCase = await db.case.findFirst({
      where: { customerId, status: 'open' },
      orderBy: { createdAt: 'desc' },
    })

    if (latestCase) {
      await db.case.update({
        where: { id: latestCase.id },
        data: { status: newStatus },
      })
      return { success: true, details: `Updated latest case ${latestCase.referenceNumber} status to "${newStatus}"` }
    }

    return { success: false, details: 'No case found to update status for' }
  } catch (err) {
    console.error('[BrainOrchestrator] UPDATE_STATUS failed:', err)
    return { success: false, details: `Failed to update status: ${err instanceof Error ? err.message : String(err)}` }
  }
}

/**
 * Execute a SEND_EMAIL action — saves the email to DB (EmailMsg + EmailMessage).
 * In production, this would also call an SMTP service for actual delivery.
 */
async function executeSendEmail(
  customerId: string,
  customer: any,
  availableFields: Record<string, string>,
  payloadTemplate: string | null,
): Promise<{ success: boolean; details?: string }> {
  const payload = resolvePayloadTemplate(payloadTemplate || '{}', availableFields)
  const recipientEmail = customer?.email || payload['email'] || 'unknown'
  const subject = payload['subject'] || 'MOEI Notification'
  const body = payload['body'] || payload['message'] || payload['content'] || 'You have a notification from MOEI.'

  try {
    // Save to EmailMsg table (mailbox-style)
    const emailMsg = await db.emailMsg.create({
      data: {
        fromEmail: 'noreply@moei.gov.ae',
        fromName: 'MOEI - Ministry of Energy & Infrastructure',
        toEmails: JSON.stringify([recipientEmail]),
        subject,
        body,
        timestamp: new Date().toISOString(),
        folder: 'sent',
        direction: 'outbound',
        priority: 'normal',
        labels: JSON.stringify(['auto_notification']),
      },
    })

    // Save to EmailMessage table (CRM-style, linked to customer)
    if (customerId) {
      await db.emailMessage.create({
        data: {
          customerId,
          fromAddress: 'noreply@moei.gov.ae',
          toAddress: recipientEmail,
          subject,
          body,
          direction: 'outbound',
          status: 'sent',
          threadId: emailMsg.threadId,
          aiReplied: true,
          metadata: JSON.stringify({ actionType: 'SEND_EMAIL', payload }),
        },
      })
    }

    console.log(`[BrainOrchestrator] SEND_EMAIL saved to DB: to=${recipientEmail}, subject=${subject}`)

    return {
      success: true,
      details: `Email notification saved and queued for ${recipientEmail}`,
    }
  } catch (err) {
    console.error('[BrainOrchestrator] SEND_EMAIL DB save failed:', err)
    return {
      success: false,
      details: `Failed to save email: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

/**
 * Execute an API_CALL action (placeholder — log only).
 */
async function executeApiCall(
  customerId: string,
  endpoint: string | null,
  availableFields: Record<string, string>,
  payloadTemplate: string | null,
): Promise<{ success: boolean; details?: string }> {
  const payload = resolvePayloadTemplate(payloadTemplate || '{}', availableFields)
  const targetEndpoint = endpoint || 'no-endpoint-specified'

  // Placeholder: In production, this would make an HTTP request
  console.log(`[BrainOrchestrator] API_CALL to ${targetEndpoint}`, JSON.stringify(payload))

  return {
    success: true,
    details: `API call to ${targetEndpoint} logged (placeholder — not executed)`,
  }
}

/**
 * Load ServiceRuleActions from DB and execute them dynamically.
 * This is the core of the "AFTER" phase — data-driven action execution.
 */
async function executeActions(
  ruleId: string,
  customerId: string,
  customer: any,
  availableFields: Record<string, string>,
  language: 'ar' | 'en',
  matchedRule: { id: string; nameEn: string; nameAr: string; category: string },
): Promise<Array<{ actionType: string; success: boolean; details?: string }>> {
  try {
    // Load active actions for this rule, ordered by sortOrder
    const actions = await db.serviceRuleAction.findMany({
      where: { ruleId, isActive: true },
      orderBy: { sortOrder: 'asc' },
    })

    if (actions.length === 0) {
      console.log(`[BrainOrchestrator] No active actions found for rule ${ruleId}`)
      return []
    }

    const results: Array<{ actionType: string; success: boolean; details?: string }> = []

    for (const action of actions) {
      console.log(`[BrainOrchestrator] Executing action ${action.actionType} for rule ${ruleId}`)

      let result: { success: boolean; details?: string }

      switch (action.actionType) {
        case 'CREATE_RECORD':
          result = await executeCreateRecord(
            customerId,
            customer,
            availableFields,
            action.payloadTemplate,
            language,
            matchedRule,
          )
          break

        case 'UPDATE_STATUS':
          result = await executeUpdateStatus(
            customerId,
            availableFields,
            action.payloadTemplate,
          )
          break

        case 'SEND_EMAIL':
          result = await executeSendEmail(
            customerId,
            customer,
            availableFields,
            action.payloadTemplate,
          )
          break

        case 'API_CALL':
          result = await executeApiCall(
            customerId,
            action.endpoint,
            availableFields,
            action.payloadTemplate,
          )
          break

        default:
          console.warn(`[BrainOrchestrator] Unknown action type: ${action.actionType}`)
          result = {
            success: false,
            details: `Unknown action type: ${action.actionType}`,
          }
      }

      results.push({
        actionType: action.actionType,
        success: result.success,
        details: result.details,
      })
    }

    return results
  } catch (err) {
    console.error('[BrainOrchestrator] Action execution failed:', err)
    return [{
      actionType: 'unknown',
      success: false,
      details: `Action execution error: ${err instanceof Error ? err.message : String(err)}`,
    }]
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ║                    THE BRAIN ORCHESTRATOR                                ║
// ═══════════════════════════════════════════════════════════════════════════

export const BrainOrchestrator = {
  /**
   * The main entry point. Channel adapters call this ONE method.
   *
   * Flow:
   *   BEFORE: Load customer profile → Detect language → Pass to Brain
   *   BRAIN:  SmartBrain.think() does all the AI thinking
   *   AFTER:  If actionReady, execute ServiceRuleActions from DB
   */
  async handleMessage(input: OrchestratorInput): Promise<OrchestratorResult> {
    const {
      message,
      channel,
      language: inputLanguage,
      customerId,
      customerPhone,
      customerEmail,
      sessionId,
      conversationHistory,
      aiMode,
    } = input

    console.log(`[BrainOrchestrator] handleMessage: channel=${channel}, customerId=${customerId || 'none'}, phone=${customerPhone || 'none'}`)

    // ═══════════════════════════════════════════════════════════════════
    // ║  BEFORE: Prepare context for the Brain                           ║
    // ═══════════════════════════════════════════════════════════════════

    // 1. Load full Customer profile from DB
    const customer = await loadCustomerProfile(customerId, customerPhone, customerEmail)

    // 2. Detect language (use provided, or let Brain auto-detect)
    const language = inputLanguage || SmartBrain.detectLanguage(message)

    // 3. Pass everything to SmartBrain.think()
    //    The Brain does ALL the AI thinking — we just feed it context
    const brainInput = {
      message,
      channel,
      language,
      customerId: customer?.id || customerId,
      customerPhone: customer?.phone || customerPhone,
      customerEmail: customer?.email || customerEmail,
      sessionId,
      conversationHistory,
      aiMode,
    }

    let brainOutput: BrainOutput
    try {
      brainOutput = await SmartBrain.think(brainInput)
    } catch (err) {
      console.error('[BrainOrchestrator] SmartBrain.think() failed:', err)
      // Return a graceful fallback
      return {
        response: language === 'ar'
          ? 'أعتذر، أواجه صعوبة تقنية مؤقتة. يرجى المحاولة مرة أخرى أو التواصل مع موظف بشري.'
          : 'I apologize, I am experiencing a temporary technical difficulty. Please try again or contact a human agent.',
        intent: 'other',
        sentiment: 0.5,
        language,
        provider: 'fallback',
        actionReady: false,
        customerId: customer?.id,
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // ║  AFTER: Execute actions if ready                                  ║
    // ═══════════════════════════════════════════════════════════════════

    let actionResults: Array<{ actionType: string; success: boolean; details?: string }> | undefined

    if (brainOutput.actionReady && brainOutput.matchedRule) {
      console.log(`[BrainOrchestrator] Action ready! Executing actions for rule: ${brainOutput.matchedRule.nameEn}`)

      actionResults = await executeActions(
        brainOutput.matchedRule.id,
        customer?.id || customerId || '',
        customer,
        brainOutput.availableFields || {},
        language,
        brainOutput.matchedRule,
      )

      // Log the results
      for (const result of actionResults) {
        if (result.success) {
          console.log(`[BrainOrchestrator] Action ${result.actionType} succeeded: ${result.details}`)
        } else {
          console.warn(`[BrainOrchestrator] Action ${result.actionType} failed: ${result.details}`)
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // ║  Return the OrchestratorResult                                    ║
    // ═══════════════════════════════════════════════════════════════════

    return {
      response: brainOutput.response,
      intent: brainOutput.intent,
      sentiment: brainOutput.sentiment,
      language: brainOutput.language,
      provider: brainOutput.provider,
      matchedRule: brainOutput.matchedRule,
      missingFields: brainOutput.missingFields,
      availableFields: brainOutput.availableFields,
      actionReady: brainOutput.actionReady,
      suggestedAction: brainOutput.suggestedAction,
      actionResults,
      channelId: brainOutput.channelHints,
      customerId: customer?.id,
    }
  },
}

export default BrainOrchestrator
