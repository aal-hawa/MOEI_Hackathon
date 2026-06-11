/**
 * MOEI LangGraph Agent - Stateful Agent Orchestration
 * Uses LangGraph.js for multi-step reasoning and stateful conversations
 * Orchestrates: Intent Detection → RAG Retrieval → Action Execution → Response
 */

import { StateGraph, Annotation, END, START } from '@langchain/langgraph'
import { processRAGQuery, type RAGQuery, type RAGResponse } from './rag-pipeline'
import { generateReferenceNumber, isValidReferenceNumber } from '@/lib/security'
import { db } from '@/lib/db'

// ─── State Definition ──────────────────────────────────────────────────────

const AgentState = Annotation.Root({
  query: Annotation<string>,
  language: Annotation<'en' | 'ar'>,
  customerId: Annotation<string | undefined>,
  channel: Annotation<string>,
  conversationHistory: Annotation<Array<{ role: 'user' | 'assistant'; content: string }>>,
  
  // Intermediate state
  intent: Annotation<string>,
  retrievedContext: Annotation<string>,
  referenceNumber: Annotation<string | undefined>,
  caseId: Annotation<string | undefined>,
  
  // Final output
  response: Annotation<string>,
  sources: Annotation<Array<{ content: string; category: string; score: number }>>,
  actionTaken: Annotation<string>,
  error: Annotation<string | undefined>,
})

export type AgentStateType = typeof AgentState.State

// ─── Graph Nodes ───────────────────────────────────────────────────────────

/**
 * Node 1: Classify the user's intent
 */
async function classifyIntent(state: AgentStateType): Promise<Partial<AgentStateType>> {
  const q = state.query.toLowerCase()
  const lang = state.language
  
  let intent = 'inquiry'
  
  // Emergency (highest priority)
  const emergencyKW = lang === 'ar'
    ? ['طوارئ', 'تسرب غاز', 'حريق', 'خطر']
    : ['emergency', 'gas leak', 'fire', 'danger', 'hazard']
  if (emergencyKW.some(k => q.includes(k))) intent = 'emergency'
  
  // Complaint
  const complaintKW = lang === 'ar'
    ? ['شكوى', 'اشتكي', 'مشكلة', 'متضايق']
    : ['complaint', 'complain', 'problem', 'frustrated']
  if (intent === 'inquiry' && complaintKW.some(k => q.includes(k))) intent = 'complaint'
  
  // Case status
  const statusKW = lang === 'ar'
    ? ['حالة', 'متابعة', 'رقم مرجعي']
    : ['status', 'track', 'reference', 'moei-']
  if (intent === 'inquiry' && statusKW.some(k => q.includes(k))) intent = 'case_status'
  
  // Service request
  const serviceKW = lang === 'ar'
    ? ['طلب', 'أريد', 'احتاج', 'توصيل']
    : ['request', 'apply', 'need', 'connect', 'i want']
  if (intent === 'inquiry' && serviceKW.some(k => q.includes(k))) intent = 'service_request'
  
  return { intent }
}

/**
 * Node 2: Retrieve relevant knowledge from vector store
 */
async function retrieveKnowledge(state: AgentStateType): Promise<Partial<AgentStateType>> {
  try {
    const ragResult = await processRAGQuery({
      query: state.query,
      language: state.language,
      customerId: state.customerId,
      channel: state.channel as any,
      conversationHistory: state.conversationHistory,
    })
    
    return {
      retrievedContext: ragResult.sources.map(s => s.content).join('\n'),
      sources: ragResult.sources,
      intent: ragResult.intent,
    }
  } catch (error) {
    return { error: 'Knowledge retrieval failed' }
  }
}

/**
 * Node 3: Execute actions based on intent (create case, lookup status, etc.)
 */
async function executeAction(state: AgentStateType): Promise<Partial<AgentStateType>> {
  let actionTaken = 'none'
  let referenceNumber: string | undefined
  let caseId: string | undefined
  
  try {
    switch (state.intent) {
      case 'complaint': {
        // Auto-create a case for complaints
        if (state.customerId) {
          referenceNumber = generateReferenceNumber()
          const newCase = await db.case.create({
            data: {
              referenceNumber,
              customerId: state.customerId,
              titleEn: state.query.slice(0, 200),
              description: state.query,
              status: 'open',
              priority: 'medium',
              category: 'Complaint',
              channel: state.channel || 'web',
            },
          })
          caseId = newCase.id
          actionTaken = 'case_created'
        }
        break
      }
      
      case 'case_status': {
        // Try to find a reference number in the query
        const refMatch = state.query.match(/MOEI-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}/i)
        if (refMatch) {
          const caseData = await db.case.findUnique({
            where: { referenceNumber: refMatch[0].toUpperCase() },
          })
          if (caseData) {
            referenceNumber = caseData.referenceNumber
            caseId = caseData.id
            actionTaken = 'case_found'
          } else {
            actionTaken = 'case_not_found'
          }
        }
        break
      }
      
      case 'service_request': {
        // For service requests, just note the intent - actual fulfillment requires more context
        actionTaken = 'service_request_noted'
        break
      }
      
      case 'emergency': {
        actionTaken = 'emergency_alert'
        break
      }
    }
  } catch (error) {
    console.error('Action execution error:', error)
    actionTaken = 'action_failed'
  }
  
  return { actionTaken, referenceNumber, caseId }
}

/**
 * Node 4: Generate the final response using the AI + context + action results
 */
async function generateResponse(state: AgentStateType): Promise<Partial<AgentStateType>> {
  const { query, language, intent, retrievedContext, referenceNumber, caseId, actionTaken } = state
  
  // Build action context for the AI
  let actionContext = ''
  if (actionTaken === 'case_created' && referenceNumber) {
    actionContext = language === 'ar'
      ? `\n\n[System: تم إنشاء قضية برقم مرجعي ${referenceNumber}. أبلغ العميل بهذا الرقم.]`
      : `\n\n[System: A case has been created with reference number ${referenceNumber}. Inform the customer of this number.]`
  } else if (actionTaken === 'case_not_found') {
    actionContext = language === 'ar'
      ? '\n\n[System: لم يتم العثور على قضية بهذا الرقم المرجعي.]'
      : '\n\n[System: No case was found with the provided reference number.]'
  } else if (actionTaken === 'emergency_alert') {
    actionContext = language === 'ar'
      ? '\n\n[System: حالة طوارئ! وجّه العميل للاتصال بـ 997/998/999 فوراً.]'
      : '\n\n[System: EMERGENCY! Direct the customer to call 997/998/999 immediately.]'
  }
  
  // Use the RAG pipeline for the final response
  try {
    const ragResult = await processRAGQuery({
      query,
      language,
      customerId: state.customerId,
      channel: state.channel as any,
      conversationHistory: state.conversationHistory,
    })
    
    // Augment the response with action context
    let finalResponse = ragResult.answer
    if (actionContext) {
      finalResponse += actionContext
    }
    
    return {
      response: finalResponse,
      sources: ragResult.sources,
    }
  } catch (error) {
    const fallback = language === 'ar'
      ? 'أعتذر، لم أتمكن من معالجة طلبك. يرجى المحاولة مرة أخرى.'
      : 'I apologize, I was unable to process your request. Please try again.'
    return { response: fallback }
  }
}

// ─── Conditional Edge Logic ────────────────────────────────────────────────

function shouldExecuteAction(state: AgentStateType): string {
  if (state.intent === 'emergency') return 'execute_action'
  if (state.intent === 'complaint') return 'execute_action'
  if (state.intent === 'case_status') return 'execute_action'
  if (state.intent === 'service_request') return 'execute_action'
  return 'generate_response'
}

// ─── Build the Graph ───────────────────────────────────────────────────────

let compiledGraph: any = null

export async function getAgentGraph() {
  if (compiledGraph) return compiledGraph
  
  const graph = new StateGraph(AgentState)
    .addNode('classify_intent', classifyIntent)
    .addNode('retrieve_knowledge', retrieveKnowledge)
    .addNode('execute_action', executeAction)
    .addNode('generate_response', generateResponse)
    
    // Define the flow
    .addEdge(START, 'classify_intent')
    .addEdge('classify_intent', 'retrieve_knowledge')
    .addConditionalEdges('retrieve_knowledge', shouldExecuteAction, {
      execute_action: 'execute_action',
      generate_response: 'generate_response',
    })
    .addEdge('execute_action', 'generate_response')
    .addEdge('generate_response', END)
  
  compiledGraph = graph.compile()
  return compiledGraph
}

/**
 * Process a query through the LangGraph agent
 */
export async function processAgentQuery(req: RAGQuery): Promise<RAGResponse> {
  try {
    const graph = await getAgentGraph()
    
    const initialState: AgentStateType = {
      query: req.query,
      language: req.language || 'en',
      customerId: req.customerId,
      channel: req.channel || 'web',
      conversationHistory: req.conversationHistory || [],
      intent: '',
      retrievedContext: '',
      referenceNumber: undefined,
      caseId: undefined,
      response: '',
      sources: [],
      actionTaken: 'none',
      error: undefined,
    }
    
    const result = await graph.invoke(initialState)
    
    return {
      answer: result.response,
      sources: result.sources || [],
      intent: result.intent,
      language: req.language || 'en',
      referenceNumber: result.referenceNumber,
      caseCreated: result.actionTaken === 'case_created',
    }
  } catch (error) {
    console.error('LangGraph agent error:', error)
    // Fallback to direct RAG pipeline
    return processRAGQuery(req)
  }
}
