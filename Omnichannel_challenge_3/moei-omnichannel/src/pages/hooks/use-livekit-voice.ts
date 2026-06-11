'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Room,
  RoomEvent,
  Track,
  RemoteParticipant,
  RemoteTrackPublication,
  DataPacket_Kind,
  ConnectionState,
} from 'livekit-client'
import { useAppStore, type ActiveCall } from '@/store/app-store'

// ─── Types ────────────────────────────────────────────────────────────────────

export type AIMode = 'customer_support' | 'sales' | 'calm' | 'escalation' | 'technical' | 'friendly'
export type CallMode = 'voice' | 'text' | 'unavailable'

export interface LiveKitVoiceState {
  isConnected: boolean
  isMuted: boolean
  isAIListening: boolean
  isAISpeaking: boolean
  isAIProcessing: boolean
  aiStatus: 'idle' | 'connecting' | 'listening' | 'processing' | 'speaking'
  detectedEmotion: { emotion: string; confidence: number } | null
  aiMode: AIMode
  error: string | null
  audioLevel: number
  isRecording: boolean
  isMicAccessGranted: boolean
  isPushToTalkActive: boolean
  latency: number
  callMode: CallMode
  isMicSupported: boolean
  roomName: string | null
  agentConnected: boolean
}

interface UseLiveKitVoiceReturn extends LiveKitVoiceState {
  startVoiceCall: () => Promise<void>
  stopVoiceCall: () => void
  toggleMute: () => void
  setAIMode: (mode: AIMode) => void
  pushToTalkStart: () => void
  pushToTalkStop: () => void
  manualStopSpeaking: () => void
  stopAllAudioPlayback: () => void
  sendTextMessage: (text: string) => void
}

const INITIAL_STATE: LiveKitVoiceState = {
  isConnected: false,
  isMuted: false,
  isAIListening: false,
  isAISpeaking: false,
  isAIProcessing: false,
  aiStatus: 'idle',
  detectedEmotion: null,
  aiMode: 'customer_support',
  error: null,
  audioLevel: 0,
  isRecording: false,
  isMicAccessGranted: false,
  isPushToTalkActive: false,
  latency: 0,
  callMode: 'voice',
  isMicSupported: true,
  roomName: null,
  agentConnected: false,
}

// ─── Data message payload types (for LiveKit data channel) ────────────────────

interface TranscriptPayload {
  type: 'transcript'
  role: 'user' | 'assistant'
  text: string
  is_final?: boolean
}

interface AgentStatePayload {
  type: 'agent_state'
  state: 'listening' | 'thinking' | 'speaking'
}

interface EmotionPayload {
  type: 'emotion'
  emotion: string
  confidence: number
}

interface ModeChangePayload {
  type: 'mode_change'
  mode: AIMode
}

interface TextMessagePayload {
  type: 'text_message'
  text: string
}

interface EndTurnPayload {
  type: 'end_turn'
}

type DataPayload =
  | TranscriptPayload
  | AgentStatePayload
  | EmotionPayload
  | ModeChangePayload
  | TextMessagePayload
  | EndTurnPayload
  | Record<string, unknown>

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useLiveKitVoice(call: ActiveCall | null): UseLiveKitVoiceReturn {
  const [state, setState] = useState<LiveKitVoiceState>(INITIAL_STATE)
  const updateActiveCall = useAppStore((s) => s.updateActiveCall)

  // ── Refs ──────────────────────────────────────────────────────────────────
  const roomRef = useRef<Room | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const audioLevelIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isDestroyedRef = useRef(false)
  const isStartedRef = useRef(false)
  const aiModeRef = useRef<AIMode>('customer_support')
  const currentCallIdRef = useRef<string | null>(null)
  const customerIdRef = useRef<string>('')
  const customerNameRef = useRef<string>('')
  const transcriptBufferRef = useRef<string>('')
  const connectStartTimeRef = useRef<number>(0)
  const remoteAudioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map())
  const wasMutedBeforePTTRef = useRef(false)

  // Keep refs in sync with latest call data
  useEffect(() => {
    if (call) {
      currentCallIdRef.current = call.id
      customerIdRef.current = call.customerId
      customerNameRef.current = call.customerName
    }
  }, [call?.id, call?.customerId, call?.customerName])

  // ── Start audio level monitoring ────────────────────────────────────────
  const startAudioLevelMonitoring = useCallback(() => {
    if (audioLevelIntervalRef.current) {
      clearInterval(audioLevelIntervalRef.current)
    }

    audioLevelIntervalRef.current = setInterval(() => {
      if (!analyserRef.current || isDestroyedRef.current) {
        setState((prev) => ({ ...prev, audioLevel: 0 }))
        return
      }

      const analyser = analyserRef.current
      const dataArray = new Uint8Array(analyser.frequencyBinCount)
      analyser.getByteFrequencyData(dataArray)

      let sum = 0
      for (let i = 0; i < dataArray.length; i++) sum += dataArray[i]
      const avg = sum / dataArray.length
      const level = Math.min(100, Math.round((avg / 128) * 100))

      setState((prev) => ({ ...prev, audioLevel: level }))
    }, 80)
  }, [])

  // ── Stop audio level monitoring ───────────────────────────────────────────
  const stopAudioLevelMonitoring = useCallback(() => {
    if (audioLevelIntervalRef.current) {
      clearInterval(audioLevelIntervalRef.current)
      audioLevelIntervalRef.current = null
    }
    setState((prev) => ({ ...prev, audioLevel: 0 }))
  }, [])

  // ── Initialize mic and audio analyser ────────────────────────────────────
  const initMicrophone = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })

      if (isDestroyedRef.current) {
        stream.getTracks().forEach((t) => t.stop())
        return null
      }

      mediaStreamRef.current = stream

      const audioContext = new AudioContext()
      audioContextRef.current = audioContext

      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.8
      analyserRef.current = analyser

      const source = audioContext.createMediaStreamSource(stream)
      source.connect(analyser)
      sourceRef.current = source

      setState((prev) => ({
        ...prev,
        isMicAccessGranted: true,
        isMicSupported: true,
        callMode: 'voice',
      }))

      return stream
    } catch (err) {
      console.warn('[LiveKit] Microphone unavailable:', err)
      return null
    }
  }, [])

  // ── Cleanup all resources ─────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    isDestroyedRef.current = true
    isStartedRef.current = false
    transcriptBufferRef.current = ''

    // Disconnect from LiveKit room
    if (roomRef.current) {
      roomRef.current
        .disconnect()
        .catch((err) => console.warn('[LiveKit] Error disconnecting room:', err))
      roomRef.current = null
    }

    // Stop media stream
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop())
      mediaStreamRef.current = null
    }

    // Disconnect audio source
    if (sourceRef.current) {
      try { sourceRef.current.disconnect() } catch { /* ignore */ }
      sourceRef.current = null
    }

    // Close audio context
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try { audioContextRef.current.close() } catch { /* ignore */ }
      audioContextRef.current = null
    }
    analyserRef.current = null

    // Clean up remote audio elements
    remoteAudioElementsRef.current.forEach((el) => {
      el.pause()
      el.srcObject = null
    })
    remoteAudioElementsRef.current.clear()

    // Stop audio level monitoring
    stopAudioLevelMonitoring()
  }, [stopAudioLevelMonitoring])

  // ═══════════════════════════════════════════════════════════════════════════
  // LiveKit WebRTC MODE
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Helper: check if any remote participant is an agent ─────────────────
  const checkAgentConnected = useCallback((room: Room): boolean => {
    for (const [, participant] of room.remoteParticipants) {
      if (
        participant.identity.startsWith('agent') ||
        participant.identity.startsWith('moei-voice-agent')
      ) {
        return true
      }
    }
    return false
  }, [])

  // ── Helper: parse and handle data messages from agent ────────────────────
  const handleDataMessage = useCallback(
    (payload: Uint8Array, participant?: RemoteParticipant) => {
      if (isDestroyedRef.current) return

      const callId = currentCallIdRef.current
      if (!callId) return

      try {
        const text = new TextDecoder().decode(payload)
        const data: DataPayload = JSON.parse(text)

        switch (data.type) {
          case 'transcript': {
            const t = data as TranscriptPayload
            if (t.role === 'assistant' && t.text) {
              if (t.is_final !== false) {
                const currentTranscript =
                  useAppStore.getState().activeCalls.find((c) => c.id === callId)?.transcript || []
                const newLine = `[AI] ${t.text.trim()}`
                if (currentTranscript[currentTranscript.length - 1] !== newLine) {
                  updateActiveCall(callId, { transcript: [...currentTranscript, newLine] })
                }
                transcriptBufferRef.current = ''
              } else {
                transcriptBufferRef.current = t.text
              }
            } else if (t.role === 'user' && t.text && t.is_final !== false) {
              const currentTranscript =
                useAppStore.getState().activeCalls.find((c) => c.id === callId)?.transcript || []
              const newLine = `[CUSTOMER] ${t.text.trim()}`
              if (currentTranscript[currentTranscript.length - 1] !== newLine) {
                updateActiveCall(callId, { transcript: [...currentTranscript, newLine] })
              }
            }
            break
          }

          case 'agent_state': {
            const s = data as AgentStatePayload
            switch (s.state) {
              case 'listening':
                setState((prev) => ({
                  ...prev,
                  isAISpeaking: false,
                  isAIListening: true,
                  isAIProcessing: false,
                  aiStatus: 'listening',
                }))
                if (transcriptBufferRef.current.trim() && callId) {
                  const currentTranscript =
                    useAppStore.getState().activeCalls.find((c) => c.id === callId)?.transcript || []
                  const newLine = `[AI] ${transcriptBufferRef.current.trim()}`
                  transcriptBufferRef.current = ''
                  if (currentTranscript[currentTranscript.length - 1] !== newLine) {
                    updateActiveCall(callId, { transcript: [...currentTranscript, newLine] })
                  }
                }
                break
              case 'thinking':
                setState((prev) => ({
                  ...prev,
                  isAISpeaking: false,
                  isAIListening: false,
                  isAIProcessing: true,
                  aiStatus: 'processing',
                }))
                break
              case 'speaking':
                setState((prev) => ({
                  ...prev,
                  isAISpeaking: true,
                  isAIListening: false,
                  isAIProcessing: false,
                  aiStatus: 'speaking',
                }))
                break
            }
            break
          }

          case 'emotion': {
            const e = data as EmotionPayload
            setState((prev) => ({
              ...prev,
              detectedEmotion: { emotion: e.emotion, confidence: e.confidence },
            }))
            if (callId) {
              const sentimentMap: Record<string, number> = {
                positive: 0.8, happy: 0.9, neutral: 0.5, frustrated: 0.2,
                angry: 0.1, sad: 0.15, anxious: 0.25,
              }
              const sentiment = sentimentMap[e.emotion.toLowerCase()] ?? 0.5
              updateActiveCall(callId, { sentiment })
            }
            break
          }

          default:
            break
        }
      } catch (err) {
        if (process.env.NODE_ENV === 'development') {
          console.debug('[LiveKit] Non-JSON data message received:', err)
        }
      }
    },
    [updateActiveCall],
  )

  // ── Set up room event listeners ──────────────────────────────────────────
  const setupRoomListeners = useCallback(
    (room: Room) => {
      room.on(
        RoomEvent.TrackSubscribed,
        (track: RemoteTrackPublication, _publication: RemoteTrackPublication, participant: RemoteParticipant) => {
          if (track.kind === Track.Kind.Audio) {
            console.log(`[LiveKit] Audio track subscribed from ${participant.identity}`)
            const isAgent =
              participant.identity.startsWith('agent') ||
              participant.identity.startsWith('moei-voice-agent')

            if (isAgent) {
              setState((prev) => ({ ...prev, agentConnected: true }))
              if (connectStartTimeRef.current > 0) {
                const lat = Date.now() - connectStartTimeRef.current
                connectStartTimeRef.current = 0
                setState((prev) => ({ ...prev, latency: lat }))
              }
            }
          }
        },
      )

      room.on(
        RoomEvent.TrackUnsubscribed,
        (_track: RemoteTrackPublication, _publication: RemoteTrackPublication, participant: RemoteParticipant) => {
          const audioEl = remoteAudioElementsRef.current.get(participant.identity)
          if (audioEl) {
            audioEl.pause()
            audioEl.srcObject = null
            remoteAudioElementsRef.current.delete(participant.identity)
          }
        },
      )

      room.on(
        RoomEvent.DataReceived,
        (payload: Uint8Array, participant?: RemoteParticipant, _kind?: DataPacket_Kind, topic?: string) => {
          handleDataMessage(payload, participant)
        },
      )

      room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
        const isAgent =
          participant.identity.startsWith('agent') ||
          participant.identity.startsWith('moei-voice-agent')
        if (isAgent) {
          setState((prev) => ({ ...prev, agentConnected: true, isAIListening: true, aiStatus: 'listening' }))
        }
      })

      room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
        const isAgent =
          participant.identity.startsWith('agent') ||
          participant.identity.startsWith('moei-voice-agent')
        if (isAgent) {
          setState((prev) => ({
            ...prev,
            agentConnected: false,
            isAISpeaking: false,
            isAIListening: false,
            isAIProcessing: false,
            aiStatus: prev.isConnected ? 'listening' : 'idle',
          }))
        }
      })

      room.on(RoomEvent.Reconnected, () => {
        setState((prev) => ({ ...prev, isConnected: true, error: null }))
      })

      room.on(RoomEvent.Disconnected, () => {
        if (!isDestroyedRef.current) {
          setState((prev) => ({
            ...prev,
            isConnected: false,
            agentConnected: false,
            isAISpeaking: false,
            isAIListening: false,
            isAIProcessing: false,
            aiStatus: 'idle',
            isRecording: false,
            audioLevel: 0,
          }))
          stopAudioLevelMonitoring()
        }
      })

      room.on(RoomEvent.LocalTrackPublished, (publication) => {
        if (publication.kind === Track.Kind.Audio) {
          setState((prev) => ({ ...prev, isRecording: true }))
        }
      })

      room.on(RoomEvent.LocalTrackUnpublished, (publication) => {
        if (publication.kind === Track.Kind.Audio) {
          setState((prev) => ({ ...prev, isRecording: false }))
        }
      })
    },
    [handleDataMessage, stopAudioLevelMonitoring],
  )

  // ── Start WebRTC mode (LiveKit Room) ──────────────────────────────────────
  const startWebRTCMode = useCallback(async (callId: string, micStream: MediaStream | null) => {
    // 1. Fetch connection details from the token API
    const tokenRes = await fetch('/api/livekit/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomName: `moei-call-${callId}`,
        participantName: customerNameRef.current || 'customer',
      }),
    })

    if (!tokenRes.ok) {
      throw new Error(`Token API returned ${tokenRes.status}`)
    }

    const tokenData = await tokenRes.json()

    // Check if LiveKit service is available (it returns { available: false } when disabled)
    if (tokenData.available === false) {
      throw new Error('LiveKit service is not available. Use the voice pipeline API instead.')
    }

    const { serverUrl, roomName, participantToken } = tokenData

    if (isDestroyedRef.current) {
      isStartedRef.current = false
      return
    }

    // 2. Create and connect to LiveKit room
    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
      audioCaptureDefaults: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    })

    roomRef.current = room
    setupRoomListeners(room)

    connectStartTimeRef.current = Date.now()

    await room.connect(serverUrl, participantToken)

    if (isDestroyedRef.current) {
      room.disconnect()
      roomRef.current = null
      isStartedRef.current = false
      return
    }

    console.log(`[LiveKit] Connected to room via WebRTC: ${roomName}`)
    setState((prev) => ({
      ...prev,
      isConnected: true,
      roomName,
      callMode: micStream ? 'voice' : 'text',
    }))

    // 3. Enable microphone if we have a stream
    if (micStream) {
      try {
        await room.localParticipant.setMicrophoneEnabled(true)
        console.log('[LiveKit] Microphone enabled')
        startAudioLevelMonitoring()

        setState((prev) => ({
          ...prev,
          isRecording: true,
          isAIListening: true,
          aiStatus: 'listening',
        }))
      } catch (micErr) {
        console.warn('[LiveKit] Failed to enable microphone, falling back to text mode:', micErr)
        setState((prev) => ({
          ...prev,
          callMode: 'text',
          isRecording: false,
          isAIListening: true,
          aiStatus: 'listening',
        }))

        const currentTranscript =
          useAppStore.getState().activeCalls.find((c) => c.id === callId)?.transcript || []
        updateActiveCall(callId, {
          transcript: [...currentTranscript, '[SYSTEM] Microphone unavailable — using text mode'],
        })
      }
    } else {
      setState((prev) => ({
        ...prev,
        callMode: 'text',
        isMicSupported: false,
        isMicAccessGranted: false,
        isAIListening: true,
        aiStatus: 'listening',
      }))

      let warningMsg = 'Text mode active — voice not available'
      if (!navigator.mediaDevices?.getUserMedia) {
        warningMsg = 'Text mode active — voice not supported in this browser'
      }

      const currentTranscript =
        useAppStore.getState().activeCalls.find((c) => c.id === callId)?.transcript || []
      updateActiveCall(callId, { transcript: [...currentTranscript, `[SYSTEM] ${warningMsg}`] })
    }

    // 4. Send initial metadata to the agent
    try {
      const metadata = JSON.stringify({
        type: 'session_init',
        sessionId: callId,
        aiMode: aiModeRef.current,
        customerId: customerIdRef.current,
        customerName: customerNameRef.current,
        callMode: micStream ? 'voice' : 'text',
      })
      await room.localParticipant.publishData(
        new TextEncoder().encode(metadata),
        { reliable: true },
      )
    } catch (dataErr) {
      console.warn('[LiveKit] Could not send session init data:', dataErr)
    }

    // 5. Check if agent is already in the room
    const agentPresent = checkAgentConnected(room)
    if (agentPresent) {
      setState((prev) => ({
        ...prev,
        agentConnected: true,
        isAIListening: true,
        aiStatus: 'listening',
      }))
    }
  }, [setupRoomListeners, startAudioLevelMonitoring, checkAgentConnected, updateActiveCall])

  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN: Start voice call (LiveKit WebRTC only)
  // ═══════════════════════════════════════════════════════════════════════════

  const startVoiceCall = useCallback(async () => {
    if (isStartedRef.current) {
      console.log('[LiveKit] Already started, skipping re-initialization')
      return
    }

    const callId = currentCallIdRef.current
    if (!callId) return

    console.log('[LiveKit] Starting voice call for session:', callId)
    isStartedRef.current = true
    isDestroyedRef.current = false
    transcriptBufferRef.current = ''

    setState((prev) => ({ ...prev, error: null, aiStatus: 'connecting' }))

    // Check if browser supports getUserMedia
    const micSupported = !!(
      typeof navigator !== 'undefined' &&
      navigator.mediaDevices &&
      navigator.mediaDevices.getUserMedia
    )

    // Initialize microphone if supported
    let micStream: MediaStream | null = null
    if (micSupported) {
      micStream = await initMicrophone()
    }

    if (isDestroyedRef.current) {
      isStartedRef.current = false
      return
    }

    // Connect via LiveKit WebRTC
    try {
      await startWebRTCMode(callId, micStream)
    } catch (rtcErr) {
      console.error('[LiveKit] WebRTC connection failed:', rtcErr)

      // Clean up WebRTC partial state
      if (roomRef.current) {
        roomRef.current.disconnect().catch(() => {})
        roomRef.current = null
      }

      isStartedRef.current = false

      const errorMessage =
        rtcErr instanceof Error ? rtcErr.message : 'Failed to connect to voice service'

      setState((prev) => ({
        ...prev,
        error: errorMessage,
        isConnected: false,
        aiStatus: 'idle',
        callMode: 'unavailable',
      }))
    }
  }, [initMicrophone, startWebRTCMode])

  // ── Stop voice call ───────────────────────────────────────────────────────
  const stopVoiceCall = useCallback(() => {
    console.log('[LiveKit] Stopping voice call')

    // Send end signal
    if (roomRef.current && roomRef.current.state === ConnectionState.Connected) {
      try {
        const endMsg = JSON.stringify({ type: 'end_call' })
        roomRef.current.localParticipant.publishData(
          new TextEncoder().encode(endMsg),
          { reliable: true },
        )
      } catch { /* best effort */ }
    }

    setTimeout(() => {
      cleanup()
      setState(INITIAL_STATE)
    }, 150)
  }, [cleanup])

  // ── Toggle mute ───────────────────────────────────────────────────────────
  const toggleMute = useCallback(async () => {
    const room = roomRef.current
    if (room && room.state === ConnectionState.Connected) {
      try {
        const isCurrentlyEnabled = room.localParticipant.isMicrophoneEnabled
        await room.localParticipant.setMicrophoneEnabled(!isCurrentlyEnabled)
        setState((prev) => ({
          ...prev,
          isMuted: isCurrentlyEnabled,
          isRecording: !isCurrentlyEnabled,
        }))
      } catch (err) {
        console.error('[LiveKit] Error toggling mute:', err)
      }
    }
  }, [])

  // ── Set AI mode ───────────────────────────────────────────────────────────
  const setAIMode = useCallback((mode: AIMode) => {
    aiModeRef.current = mode
    setState((prev) => ({ ...prev, aiMode: mode }))

    // Send via data channel
    const room = roomRef.current
    if (room && room.state === ConnectionState.Connected) {
      try {
        const modeMsg = JSON.stringify({ type: 'mode_change', mode } as ModeChangePayload)
        room.localParticipant.publishData(new TextEncoder().encode(modeMsg), { reliable: true })
      } catch (err) {
        console.warn('[LiveKit] Could not send mode change:', err)
      }
    }
  }, [])

  // ── Push to talk: start ───────────────────────────────────────────────────
  const pushToTalkStart = useCallback(async () => {
    const room = roomRef.current
    if (room && room.state === ConnectionState.Connected) {
      wasMutedBeforePTTRef.current = true
      try {
        if (!room.localParticipant.isMicrophoneEnabled) {
          await room.localParticipant.setMicrophoneEnabled(true)
        }
        setState((prev) => ({ ...prev, isPushToTalkActive: true, isMuted: false, isRecording: true }))
      } catch (err) {
        console.error('[LiveKit] Push-to-talk start error:', err)
      }
    }
  }, [])

  // ── Push to talk: stop ────────────────────────────────────────────────────
  const pushToTalkStop = useCallback(async () => {
    const room = roomRef.current
    if (room && room.state === ConnectionState.Connected && wasMutedBeforePTTRef.current) {
      try {
        await room.localParticipant.setMicrophoneEnabled(false)
        setState((prev) => ({ ...prev, isPushToTalkActive: false, isMuted: true, isRecording: false }))
      } catch (err) {
        console.error('[LiveKit] Push-to-talk stop error:', err)
      }
      wasMutedBeforePTTRef.current = false
    }
  }, [])

  // ── Manual stop speaking ──────────────────────────────────────────────────
  const manualStopSpeaking = useCallback(() => {
    const room = roomRef.current
    if (room && room.state === ConnectionState.Connected) {
      try {
        const endTurnMsg = JSON.stringify({ type: 'end_turn' } as EndTurnPayload)
        room.localParticipant.publishData(new TextEncoder().encode(endTurnMsg), { reliable: true })
      } catch (err) {
        console.warn('[LiveKit] Could not send end turn:', err)
      }
    }

    // Flush remaining text buffer
    const callId = currentCallIdRef.current
    if (transcriptBufferRef.current.trim() && callId) {
      const fullText = transcriptBufferRef.current.trim()
      transcriptBufferRef.current = ''
      const currentTranscript =
        useAppStore.getState().activeCalls.find((c) => c.id === callId)?.transcript || []
      const newLine = `[AI] ${fullText}`
      if (currentTranscript[currentTranscript.length - 1] !== newLine) {
        updateActiveCall(callId, { transcript: [...currentTranscript, newLine] })
      }
    }

    setState((prev) => ({
      ...prev,
      isAISpeaking: false,
      isAIListening: true,
      isAIProcessing: false,
      aiStatus: 'listening',
    }))
  }, [updateActiveCall])

  // ── Stop all audio playback ───────────────────────────────────────────────
  const stopAllAudioPlayback = useCallback(() => {
    remoteAudioElementsRef.current.forEach((el) => {
      el.pause()
      el.srcObject = null
    })
    remoteAudioElementsRef.current.clear()
  }, [])

  // ── Send text message ─────────────────────────────────────────────────────
  const sendTextMessage = useCallback((text: string) => {
    const room = roomRef.current
    if (room && room.state === ConnectionState.Connected) {
      try {
        const textMsg = JSON.stringify({ type: 'text_message', text: text.trim() } as TextMessagePayload)
        room.localParticipant.publishData(new TextEncoder().encode(textMsg), { reliable: true })
      } catch (err) {
        console.warn('[LiveKit] Could not send text message:', err)
      }
    }
  }, [])

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      cleanup()
    }
  }, [cleanup])

  return {
    ...state,
    startVoiceCall,
    stopVoiceCall,
    toggleMute,
    setAIMode,
    pushToTalkStart,
    pushToTalkStop,
    manualStopSpeaking,
    stopAllAudioPlayback,
    sendTextMessage,
  }
}
