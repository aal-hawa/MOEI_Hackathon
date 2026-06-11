'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '@/store/app-store'

/**
 * Real-time data hook — uses HTTP polling to the worker backend
 * instead of Socket.io mini-service.
 * 
 * Architecture: Frontend (src/pages/) -> HTTP Poll -> Worker Backend (src/worker/)
 * The worker's /api/realtime/* endpoints provide simulated live data.
 * 
 * No mini-services needed — everything runs in pages + worker only.
 */

const POLL_INTERVAL = 5000 // Poll every 5 seconds

export function useRealtime() {
  const setKpis = useAppStore((s) => s.setKpis)
  const setQueueStatus = useAppStore((s) => s.setQueueStatus)
  const setSentimentTimeline = useAppStore((s) => s.setSentimentTimeline)
  const setActiveConversations = useAppStore((s) => s.setActiveConversations)
  const addWhatsappMessage = useAppStore((s) => s.addWhatsappMessage)
  const incrementWhatsappUnread = useAppStore((s) => s.incrementWhatsappUnread)
  const setActiveCalls = useAppStore((s) => s.setActiveCalls)
  const addActiveCall = useAppStore((s) => s.addActiveCall)
  const updateActiveCall = useAppStore((s) => s.updateActiveCall)
  const removeActiveCall = useAppStore((s) => s.removeActiveCall)
  const addEmailMessage = useAppStore((s) => s.addEmailMessage)
  const incrementEmailUnread = useAppStore((s) => s.incrementEmailUnread)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastWaCountRef = useRef(0)
  const seenWaIdsRef = useRef<Set<string>>(new Set())
  const lastEmailCountRef = useRef(0)
  const seenEmailIdsRef = useRef<Set<string>>(new Set())
  const lastCallIdsRef = useRef<Set<string>>(new Set())
  const initializedRef = useRef(false)

  const pollData = useCallback(async () => {
    try {
      // Fetch combined status (KPIs + queue)
      const statusRes = await fetch('/api/realtime/status')
      if (statusRes.ok) {
        const status = await statusRes.json()
        if (status.kpis) setKpis(status.kpis)
        if (status.queue) setQueueStatus(status.queue)
      }

      // Fetch conversations — worker returns { conversations: [...], count: N }
      const convsRes = await fetch('/api/realtime/conversations')
      if (convsRes.ok) {
        const convsData = await convsRes.json()
        const convs = convsData.conversations || convsData
        if (Array.isArray(convs)) setActiveConversations(convs)
      }

      // Fetch sentiment timeline — worker returns { timeline: [...], count: N }
      const sentimentRes = await fetch('/api/realtime/sentiment')
      if (sentimentRes.ok) {
        const sentimentData = await sentimentRes.json()
        const timeline = sentimentData.timeline || sentimentData
        if (Array.isArray(timeline)) setSentimentTimeline(timeline)
      }

      // Fetch WhatsApp messages — worker returns { messages: [...], count: N }
      const waRes = await fetch('/api/realtime/whatsapp')
      if (waRes.ok) {
        const waData = await waRes.json()
        const messages = waData.messages || waData
        if (Array.isArray(messages)) {
          // Use ID-based deduplication instead of slice offset
          // (messages are ordered newest-first, so slice(lastCount) misses new messages)
          const newMessages = messages.filter((msg: { id: string }) => !seenWaIdsRef.current.has(msg.id))
          for (const msg of newMessages) {
            seenWaIdsRef.current.add(msg.id)
            addWhatsappMessage({
              id: msg.id || `wa-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              customerId: msg.customerId || '',
              customerName: msg.customerName || 'Unknown',
              customerPhone: msg.customerPhone || msg.customerId || '',
              content: msg.text || msg.content || msg.message || '',
              direction: (msg.direction || 'inbound') as 'inbound' | 'outbound',
              status: (msg.status || 'read') as 'sent' | 'delivered' | 'read' | 'failed',
              timestamp: new Date(msg.timestamp || Date.now()),
              isTemplate: false,
              conversationId: msg.conversationId || undefined,
            })
            if ((msg.direction || 'inbound') === 'inbound') {
              incrementWhatsappUnread()
            }
          }
          lastWaCountRef.current = messages.length
        }
      }

      // Fetch Email messages
      const emailRes = await fetch('/api/realtime/email')
      if (emailRes.ok) {
        const emailData = await emailRes.json()
        const messages = emailData.messages || emailData
        if (Array.isArray(messages)) {
          const newMessages = messages.filter((msg: { id: string }) => !seenEmailIdsRef.current.has(msg.id))
          for (const msg of newMessages) {
            seenEmailIdsRef.current.add(msg.id)
            addEmailMessage({
              id: msg.id || `email-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              customerId: msg.customerId || null,
              fromAddress: msg.direction === 'inbound' ? (msg.customerName || 'customer@example.com') : 'agent@moei.gov.ae',
              toAddress: msg.direction === 'inbound' ? 'agent@moei.gov.ae' : (msg.customerName || 'customer@example.com'),
              subject: msg.subject || 'No Subject',
              body: msg.text || msg.content || msg.message || '',
              direction: (msg.direction || 'inbound') as 'inbound' | 'outbound',
              status: (msg.status || 'read') as 'read',
              threadId: msg.conversationId || null,
              aiReplied: false,
              createdAt: new Date(msg.timestamp || Date.now()),
            })
            if ((msg.direction || 'inbound') === 'inbound') {
              incrementEmailUnread()
            }
          }
          lastEmailCountRef.current = messages.length
        }
      }

      // Fetch active calls — worker returns { calls: [...], count: N }
      const callsRes = await fetch('/api/realtime/calls')
      if (callsRes.ok) {
        const callsData = await callsRes.json()
        const calls = callsData.calls || callsData
        if (Array.isArray(calls)) {
          const currentCallIds = new Set(calls.map((c: { id: string }) => c.id))

          // First poll: just set all calls (don't add one by one)
          if (!initializedRef.current) {
            setActiveCalls(calls.map((call: { id: string; customerId: string; customerName: string; phoneNumber?: string; status: string; duration: number; language?: string; sentiment: number; transcriptChunks?: string[]; agentId?: string }) => ({
              id: call.id,
              customerId: call.customerId || '',
              customerName: call.customerName || 'Unknown Caller',
              customerPhone: call.phoneNumber || '',
              direction: 'inbound' as const,
              status: call.status || 'ringing',
              duration: call.duration || 0,
              startedAt: new Date(),
              agentId: call.agentId,
              transcript: call.transcriptChunks || [],
              sentiment: call.sentiment || 0.5,
            })))
            initializedRef.current = true
          } else {
            // Subsequent polls: detect new/ended calls
            for (const call of calls) {
              if (!lastCallIdsRef.current.has(call.id)) {
                // New call
                addActiveCall({
                  id: call.id,
                  customerId: call.customerId || '',
                  customerName: call.customerName || 'Unknown Caller',
                  customerPhone: call.phoneNumber || '',
                  direction: 'inbound',
                  status: call.status || 'ringing',
                  duration: call.duration || 0,
                  startedAt: new Date(),
                  agentId: call.agentId,
                  transcript: call.transcriptChunks || [],
                  sentiment: call.sentiment || 0.5,
                })
              } else {
                // Existing call — update status
                updateActiveCall(call.id, {
                  status: call.status,
                  ...(call.agentId ? { agentId: call.agentId } : {}),
                })
              }
            }

            // Detect ended calls
            for (const prevId of lastCallIdsRef.current) {
              if (!currentCallIds.has(prevId)) {
                removeActiveCall(prevId)
              }
            }
          }

          lastCallIdsRef.current = currentCallIds
        }
      }
    } catch (err) {
      // Silently fail — will retry on next poll
      console.warn('[Realtime] Poll error:', err)
    }
  }, [setKpis, setQueueStatus, setSentimentTimeline, setActiveConversations, addWhatsappMessage, incrementWhatsappUnread, setActiveCalls, addActiveCall, updateActiveCall, removeActiveCall, addEmailMessage, incrementEmailUnread])

  // Start polling
  useEffect(() => {
    // Initial fetch immediately
    pollData()

    // Then poll at interval
    intervalRef.current = setInterval(pollData, POLL_INTERVAL)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [pollData])

  // Emit function — for WhatsApp send, call answer/end, etc.
  // These now go through the worker API instead of Socket.io
  const emit = useCallback(async (event: string, data: unknown) => {
    try {
      switch (event) {
        case 'whatsapp:send': {
          const waData = data as { conversationId: string; customerId: string; message: string }
          await fetch('/api/realtime/whatsapp/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(waData),
          })
          break
        }
        case 'email:send': {
          const emailData = data as { conversationId: string; customerId: string; message: string; subject: string }
          await fetch('/api/realtime/email/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(emailData),
          })
          break
        }
        case 'call:answer': {
          const callData = data as { callId: string; agentId?: string }
          await fetch('/api/realtime/call/answer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(callData),
          })
          break
        }
        case 'call:end': {
          const endData = data as { callId: string }
          await fetch('/api/realtime/call/end', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(endData),
          })
          break
        }
        case 'agent:register':
        case 'dashboard:register':
          // No-op in polling mode (no Socket.io connection to register)
          break
        default:
          // Unknown events are ignored
          break
      }
    } catch (err) {
      console.warn(`[Realtime] Emit error (${event}):`, err)
    }
  }, [])

  return { emit }
}
