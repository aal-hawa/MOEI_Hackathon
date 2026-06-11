'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAppStore, type ActiveCall } from '@/store/app-store'

// ─── Types ────────────────────────────────────────────────────────────────────

export type AIMode = 'customer_support' | 'sales' | 'calm' | 'escalation' | 'technical' | 'friendly'

export interface VoiceCallState {
  isConnected: boolean
  isMuted: boolean
  isAIListening: boolean
  isAISpeaking: boolean
  isAIProcessing: boolean
  aiStatus: 'idle' | 'listening' | 'processing' | 'speaking'
  detectedEmotion: { emotion: string; confidence: number } | null
  aiMode: AIMode
  error: string | null
  audioLevel: number // 0-100 for mic visualization
  isRecording: boolean
  isMicAccessGranted: boolean
  isPushToTalkActive: boolean
}

const INITIAL_STATE: VoiceCallState = {
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
}

// ─── VAD Configuration ────────────────────────────────────────────────────────

const VAD_SILENCE_THRESHOLD = 10   // Volume level below this = silence (raised from 8)
const VAD_SILENCE_DURATION = 1800  // ms of silence before auto-stop (raised from 1500)
const VAD_SPEECH_THRESHOLD = 20    // Volume level above this = speech (raised from 15)
const VAD_SPEECH_ONSET_MS = 300    // ms of sustained speech before triggering VAD
const RECORDING_TIMESLICE = 500    // ms between MediaRecorder dataavailable events
const MIN_RECORDING_MS = 800       // minimum recording duration before allowing send (prevents noise sends)

// ─── Pipeline API Response ────────────────────────────────────────────────────

interface PipelineResponse {
  success: boolean
  transcription: string
  aiResponse: string
  audioBase64: string
  emotion: { emotion: string; confidence: number }
  language: 'en' | 'ar'
  sentiment: number
  error?: string
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useVoiceCall(call: ActiveCall | null) {
  const [state, setState] = useState<VoiceCallState>(INITIAL_STATE)
  const updateActiveCall = useAppStore((s) => s.updateActiveCall)

  // ── Refs ──────────────────────────────────────────────────────────────────
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioLevelIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const vadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isSpeakingRef = useRef(false)
  const isProcessingRef = useRef(false)
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)
  const isDestroyedRef = useRef(false)
  const isStartedRef = useRef(false)               // ⭐ NEW: prevents re-initialization
  const conversationHistoryRef = useRef<Array<{ role: 'user' | 'assistant'; content: string }>>([])
  const aiModeRef = useRef<AIMode>('customer_support')
  const abortControllerRef = useRef<AbortController | null>(null)
  const playbackUrlRef = useRef<string | null>(null)
  const recordingStartedAtRef = useRef<number>(0)   // ⭐ NEW: minimum recording duration
  const speechOnsetRef = useRef<ReturnType<typeof setTimeout> | null>(null)  // ⭐ NEW: debounce speech onset
  const currentCallIdRef = useRef<string | null>(null)  // ⭐ NEW: stable call ID ref
  const customerIdRef = useRef<string>('')           // ⭐ NEW: stable customer ID ref
  const customerNameRef = useRef<string>('')          // ⭐ NEW: stable customer name ref

  // Keep refs in sync with latest call data (without causing re-renders)
  useEffect(() => {
    if (call) {
      currentCallIdRef.current = call.id
      customerIdRef.current = call.customerId
      customerNameRef.current = call.customerName
    }
  }, [call?.id, call?.customerId, call?.customerName])

  // ── Cleanup all resources ─────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    isDestroyedRef.current = true
    isStartedRef.current = false  // ⭐ Allow restart after full cleanup

    // Abort any in-flight pipeline request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }

    // Clear intervals
    if (audioLevelIntervalRef.current) {
      clearInterval(audioLevelIntervalRef.current)
      audioLevelIntervalRef.current = null
    }
    if (vadTimeoutRef.current) {
      clearTimeout(vadTimeoutRef.current)
      vadTimeoutRef.current = null
    }
    if (speechOnsetRef.current) {
      clearTimeout(speechOnsetRef.current)
      speechOnsetRef.current = null
    }

    // Stop media recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop()
      } catch {
        // ignore
      }
    }
    mediaRecorderRef.current = null
    audioChunksRef.current = []

    // Stop media stream tracks
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop())
      mediaStreamRef.current = null
    }

    // Close audio context
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close()
      } catch {
        // ignore
      }
      audioContextRef.current = null
    }
    analyserRef.current = null

    // Stop any playing audio
    if (currentAudioRef.current) {
      try { currentAudioRef.current.pause(); currentAudioRef.current.currentTime = 0 } catch { /* ignore */ }
      currentAudioRef.current = null
    }
    if (playbackUrlRef.current) {
      URL.revokeObjectURL(playbackUrlRef.current)
      playbackUrlRef.current = null
    }

    isSpeakingRef.current = false
    isProcessingRef.current = false
    recordingStartedAtRef.current = 0
  }, [])

  // ── Stop all audio playback ───────────────────────────────────────────────
  const stopAllAudioPlayback = useCallback(() => {
    if (currentAudioRef.current) {
      try { currentAudioRef.current.pause(); currentAudioRef.current.currentTime = 0 } catch { /* ignore */ }
      currentAudioRef.current = null
    }
    if (playbackUrlRef.current) {
      URL.revokeObjectURL(playbackUrlRef.current)
      playbackUrlRef.current = null
    }
    setState((prev) => ({
      ...prev,
      isAISpeaking: false,
      aiStatus: prev.isRecording ? 'listening' : 'idle',
      isAIListening: prev.isRecording,
    }))
  }, [])

  // ── Play base64 audio (AI TTS response) ──────────────────────────────────
  const playBase64Audio = useCallback(async (base64Audio: string) => {
    if (isDestroyedRef.current) return

    try {
      const binaryString = atob(base64Audio)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }

      const blob = new Blob([bytes], { type: 'audio/wav' })
      const url = URL.createObjectURL(blob)

      // Clean up previous URL
      if (playbackUrlRef.current) {
        URL.revokeObjectURL(playbackUrlRef.current)
      }
      playbackUrlRef.current = url

      const audio = new Audio(url)
      currentAudioRef.current = audio

      setState((prev) => ({
        ...prev,
        isAISpeaking: true,
        aiStatus: 'speaking',
        isAIListening: false,
        isAIProcessing: false,
      }))

      await new Promise<void>((resolve, reject) => {
        audio.onended = () => {
          currentAudioRef.current = null
          URL.revokeObjectURL(url)
          playbackUrlRef.current = null
          if (!isDestroyedRef.current) {
            setState((prev) => ({
              ...prev,
              isAISpeaking: false,
              aiStatus: 'listening',
              isAIListening: true,
            }))
          }
          resolve()
        }
        audio.onerror = () => {
          currentAudioRef.current = null
          URL.revokeObjectURL(url)
          playbackUrlRef.current = null
          if (!isDestroyedRef.current) {
            setState((prev) => ({
              ...prev,
              isAISpeaking: false,
              aiStatus: 'listening',
              isAIListening: true,
            }))
          }
          resolve() // Don't reject — just move on
        }
        audio.play().catch(reject)
      })
    } catch (err) {
      console.error('[VOICE] Error playing audio:', err)
      if (!isDestroyedRef.current) {
        setState((prev) => ({
          ...prev,
          isAISpeaking: false,
          aiStatus: 'listening',
          isAIListening: true,
        }))
      }
    }
  }, [])

  // ── Send audio to pipeline API ────────────────────────────────────────────
  // NOTE: Uses refs instead of `call` to avoid dependency changes when the store updates
  const sendToPipeline = useCallback(async (audioBlob: Blob) => {
    const callId = currentCallIdRef.current
    if (!callId || isDestroyedRef.current) return
    if (isProcessingRef.current) return

    isProcessingRef.current = true

    // Create abort controller for this request
    const controller = new AbortController()
    abortControllerRef.current = controller

    setState((prev) => ({
      ...prev,
      isAIProcessing: true,
      isAIListening: false,
      aiStatus: 'processing',
      isRecording: false,
    }))

    try {
      // Convert blob to base64
      const reader = new FileReader()
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1]
          resolve(base64)
        }
        reader.onerror = reject
        reader.readAsDataURL(audioBlob)
      })

      const audioBase64 = await base64Promise

      if (!audioBase64 || isDestroyedRef.current) {
        isProcessingRef.current = false
        return
      }

      // POST to pipeline — uses stable refs instead of `call` object
      const response = await fetch('/api/ai/voice/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          audioBase64,
          sessionId: callId,
          language: 'en' as const,
          aiMode: aiModeRef.current,
          customerId: customerIdRef.current,
          customerName: customerNameRef.current,
          conversationHistory: conversationHistoryRef.current,
        }),
      })

      if (!response.ok) {
        throw new Error(`Pipeline returned ${response.status}`)
      }

      const data: PipelineResponse = await response.json()

      if (isDestroyedRef.current) return

      if (!data.success || !data.transcription) {
        // STT failed — go back to listening
        setState((prev) => ({
          ...prev,
          isAIProcessing: false,
          isAIListening: true,
          aiStatus: 'listening',
          isRecording: prev.isConnected,
          error: data.error || 'Could not transcribe audio. Please try again.',
        }))
        isProcessingRef.current = false
        return
      }

      // Update conversation history
      conversationHistoryRef.current.push({ role: 'user', content: data.transcription })
      if (data.aiResponse) {
        conversationHistoryRef.current.push({ role: 'assistant', content: data.aiResponse })
      }
      // Keep last 20 messages
      if (conversationHistoryRef.current.length > 20) {
        conversationHistoryRef.current = conversationHistoryRef.current.slice(-20)
      }

      // Update transcript in store — read from store directly to avoid stale data
      const currentTranscript = useAppStore.getState().activeCalls.find((c) => c.id === callId)?.transcript || []
      const newTranscript = [...currentTranscript]
      newTranscript.push(`[CUSTOMER] ${data.transcription}`)
      if (data.aiResponse) {
        newTranscript.push(`[AI] ${data.aiResponse}`)
      }
      updateActiveCall(callId, { transcript: newTranscript })

      // Update emotion
      setState((prev) => ({
        ...prev,
        isAIProcessing: false,
        detectedEmotion: data.emotion,
      }))

      // Update sentiment in store
      updateActiveCall(callId, { sentiment: data.sentiment })

      // Play TTS audio if available
      if (data.audioBase64) {
        await playBase64Audio(data.audioBase64)
      } else {
        // No audio — just go back to listening
        setState((prev) => ({
          ...prev,
          isAISpeaking: false,
          isAIListening: true,
          aiStatus: 'listening',
        }))
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // Request was cancelled (interruption) — not an error
      } else {
        console.error('[VOICE] Pipeline error:', err)
        if (!isDestroyedRef.current) {
          setState((prev) => ({
            ...prev,
            isAIProcessing: false,
            isAIListening: true,
            aiStatus: 'listening',
            isRecording: prev.isConnected,
            error: 'Voice processing failed. Please try again.',
          }))
        }
      }
    } finally {
      isProcessingRef.current = false
      abortControllerRef.current = null
    }
  }, [playBase64Audio, updateActiveCall])

  // ── Start a new recording session ─────────────────────────────────────────
  const startNewRecording = useCallback((stream: MediaStream) => {
    if (isDestroyedRef.current || isProcessingRef.current) return

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/ogg'

    try {
      const recorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 16000,
      })
      mediaRecorderRef.current = recorder
      audioChunksRef.current = []
      recordingStartedAtRef.current = Date.now()  // ⭐ Track when recording started

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0 && !isDestroyedRef.current) {
          audioChunksRef.current.push(event.data)
        }
      }

      recorder.onerror = () => {
        setState((prev) => ({ ...prev, error: 'Recording error occurred' }))
      }

      recorder.start(RECORDING_TIMESLICE)

      setState((prev) => ({
        ...prev,
        isRecording: true,
        isAIListening: true,
        aiStatus: 'listening',
      }))
    } catch (err) {
      console.error('[VOICE] Error starting MediaRecorder:', err)
      setState((prev) => ({ ...prev, error: 'Failed to start recording' }))
    }
  }, [])

  // ── Finalize recording and send to pipeline ──────────────────────────────
  // NOTE: Uses refs instead of `call` for stability
  const finalizeAndSend = useCallback(() => {
    const recorder = mediaRecorderRef.current
    const callId = currentCallIdRef.current
    if (!recorder || !callId) return

    // If recorder is still active, stop it first and send on next onstop
    if (recorder.state === 'recording') {
      recorder.onstop = () => {
        const chunks = audioChunksRef.current
        audioChunksRef.current = []
        if (chunks.length > 0) {
          const blob = new Blob(chunks, { type: recorder.mimeType })
          sendToPipeline(blob)
        }
        // Restart recording after a short delay
        setTimeout(() => {
          if (!isDestroyedRef.current && mediaStreamRef.current && !isProcessingRef.current) {
            startNewRecording(mediaStreamRef.current)
          }
        }, 500)
      }
      try {
        recorder.stop()
      } catch {
        // ignore
      }
    } else {
      // Already stopped — send what we have
      const chunks = audioChunksRef.current
      audioChunksRef.current = []
      if (chunks.length > 0) {
        const blob = new Blob(chunks, { type: 'audio/webm' })
        sendToPipeline(blob)
      }
    }
  }, [sendToPipeline, startNewRecording])

  // ── Start audio level monitoring & VAD ────────────────────────────────────
  const startAudioLevelMonitoring = useCallback((stream: MediaStream) => {
    try {
      const audioCtx = new AudioContext()
      audioContextRef.current = audioCtx
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.8
      analyserRef.current = analyser

      const source = audioCtx.createMediaStreamSource(stream)
      source.connect(analyser)

      const dataArray = new Uint8Array(analyser.frequencyBinCount)

      audioLevelIntervalRef.current = setInterval(() => {
        if (!analyserRef.current || isDestroyedRef.current) return
        analyserRef.current.getByteFrequencyData(dataArray)

        // Calculate average volume
        let sum = 0
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i]
        }
        const avg = sum / dataArray.length
        const normalizedLevel = Math.min(100, Math.round((avg / 128) * 100))

        setState((prev) => ({ ...prev, audioLevel: normalizedLevel }))

        // Simple VAD — only run when recording and not currently processing
        if (isProcessingRef.current) return

        if (normalizedLevel > VAD_SPEECH_THRESHOLD && !isSpeakingRef.current) {
          // ⭐ Debounce speech onset: require sustained speech before triggering
          if (!speechOnsetRef.current) {
            speechOnsetRef.current = setTimeout(() => {
              speechOnsetRef.current = null
              if (isProcessingRef.current || isDestroyedRef.current) return
              isSpeakingRef.current = true
              // Clear any pending silence timeout
              if (vadTimeoutRef.current) {
                clearTimeout(vadTimeoutRef.current)
                vadTimeoutRef.current = null
              }
            }, VAD_SPEECH_ONSET_MS)
          }
        } else if (normalizedLevel < VAD_SPEECH_THRESHOLD && speechOnsetRef.current) {
          // Speech didn't sustain — cancel the onset timer
          clearTimeout(speechOnsetRef.current)
          speechOnsetRef.current = null
        }

        if (normalizedLevel < VAD_SILENCE_THRESHOLD && isSpeakingRef.current) {
          // Start silence timeout
          if (!vadTimeoutRef.current) {
            vadTimeoutRef.current = setTimeout(() => {
              if (isSpeakingRef.current && !isProcessingRef.current) {
                // ⭐ Check minimum recording duration before sending
                const recordingDuration = Date.now() - recordingStartedAtRef.current
                if (recordingDuration < MIN_RECORDING_MS) {
                  // Too short — probably noise, just reset VAD and keep listening
                  isSpeakingRef.current = false
                  vadTimeoutRef.current = null
                  return
                }

                isSpeakingRef.current = false
                vadTimeoutRef.current = null
                // Auto-stop: finalize recording and send
                finalizeAndSend()
              }
            }, VAD_SILENCE_DURATION)
          }
        } else if (normalizedLevel > VAD_SPEECH_THRESHOLD && isSpeakingRef.current) {
          // Still speaking — cancel any pending silence timeout
          if (vadTimeoutRef.current) {
            clearTimeout(vadTimeoutRef.current)
            vadTimeoutRef.current = null
          }
        }
      }, 100)
    } catch (err) {
      console.error('[VOICE] Error setting up audio monitoring:', err)
    }
  }, [])

  // ── Finalize recording and send to pipeline ──────────────────────────────


  // ── Start voice call ──────────────────────────────────────────────────────
  const startVoiceCall = useCallback(async () => {
    // ⭐ CRITICAL FIX: If already started and connected, do NOT re-initialize
    if (isStartedRef.current) {
      console.log('[VOICE] Already started, skipping re-initialization')
      return
    }

    const callId = currentCallIdRef.current
    if (!callId) return

    console.log('[VOICE] Starting voice call for session:', callId)

    // Mark as started immediately to prevent duplicate calls
    isStartedRef.current = true
    isDestroyedRef.current = false
    isProcessingRef.current = false
    isSpeakingRef.current = false
    // NOTE: Do NOT reset conversationHistoryRef here — it should persist across the call
    setState((prev) => ({ ...prev, error: null }))

    // Request microphone access
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })

      // Check if destroyed while waiting for mic access
      if (isDestroyedRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        isStartedRef.current = false
        return
      }

      mediaStreamRef.current = stream
      setState((prev) => ({ ...prev, isMicAccessGranted: true }))

      // Start audio level monitoring (includes VAD)
      startAudioLevelMonitoring(stream)

      // Start recording
      startNewRecording(stream)

      // Mark as connected
      setState((prev) => ({ ...prev, isConnected: true }))
    } catch (err) {
      isStartedRef.current = false  // ⭐ Reset on error so retry works
      const errorMsg = err instanceof DOMException && err.name === 'NotAllowedError'
        ? 'Microphone access denied. Please allow microphone access in your browser settings.'
        : 'Failed to access microphone. Please check your device.'
      setState((prev) => ({ ...prev, error: errorMsg, isMicAccessGranted: false }))
    }
  }, [startAudioLevelMonitoring, startNewRecording])  // ⭐ REMOVED `call` dependency

  // ── Stop voice call ───────────────────────────────────────────────────────
  const stopVoiceCall = useCallback(() => {
    cleanup()
    conversationHistoryRef.current = []
    setState(INITIAL_STATE)
  }, [cleanup])

  // ── Toggle mute ───────────────────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    if (mediaStreamRef.current) {
      const audioTrack = mediaStreamRef.current.getAudioTracks()[0]
      if (audioTrack) {
        const newMuted = !audioTrack.enabled
        audioTrack.enabled = !newMuted
        setState((prev) => ({ ...prev, isMuted: newMuted }))
      }
    }
  }, [])

  // ── Set AI mode ───────────────────────────────────────────────────────────
  const setAIMode = useCallback((mode: AIMode) => {
    aiModeRef.current = mode
    setState((prev) => ({ ...prev, aiMode: mode }))
  }, [])

  // ── Toggle AI ─────────────────────────────────────────────────────────────
  const toggleAI = useCallback((_enabled: boolean) => {
    // In the REST-based architecture, AI is always enabled when the call is
    // connected. This is a no-op kept for interface compatibility.
  }, [])

  // ── Push to talk: start ───────────────────────────────────────────────────
  const pushToTalkStart = useCallback(() => {
    if (mediaStreamRef.current) {
      const audioTrack = mediaStreamRef.current.getAudioTracks()[0]
      if (audioTrack && !audioTrack.enabled) {
        audioTrack.enabled = true
      }
    }

    // Stop AI audio playback when user starts talking
    stopAllAudioPlayback()

    // Abort any in-flight pipeline request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    isProcessingRef.current = false

    setState((prev) => ({ ...prev, isPushToTalkActive: true, isMuted: false }))
  }, [stopAllAudioPlayback])

  // ── Push to talk: stop ────────────────────────────────────────────────────
  const pushToTalkStop = useCallback(() => {
    setState((prev) => ({ ...prev, isPushToTalkActive: false }))
    isSpeakingRef.current = false

    // Finalize and send the accumulated audio
    finalizeAndSend()
  }, [finalizeAndSend])

  // ── Manual stop speaking (for continuous mode) ────────────────────────────
  const manualStopSpeaking = useCallback(() => {
    isSpeakingRef.current = false

    // Finalize and send the accumulated audio
    finalizeAndSend()
  }, [finalizeAndSend])

  // ── Handle user interruption: if VAD detects speech while AI is speaking ──
  useEffect(() => {
    // When user starts speaking while AI is speaking, stop AI playback
    if (state.isAISpeaking && isSpeakingRef.current && !state.isPushToTalkActive) {
      stopAllAudioPlayback()

      // Abort any in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }
      isProcessingRef.current = false
    }
  }, [state.isAISpeaking, state.isPushToTalkActive, stopAllAudioPlayback])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup()
    }
  }, [cleanup])

  // ⭐ FIX: Only depend on call?.id, NOT the full call object
  const prevCallIdRef = useRef<string | null>(null)
  useEffect(() => {
    const currentCallId = call?.id ?? null
    if (prevCallIdRef.current !== null && currentCallId === null) {
      cleanup()
      conversationHistoryRef.current = []
    }
    prevCallIdRef.current = currentCallId
  }, [call?.id, cleanup])  // ⭐ REMOVED `call` dependency — only care about ID changes

  // Derive reset state when no call
  const effectiveState = call ? state : INITIAL_STATE

  return {
    ...effectiveState,
    startVoiceCall,
    stopVoiceCall,
    toggleMute,
    setAIMode,
    toggleAI,
    pushToTalkStart,
    pushToTalkStop,
    manualStopSpeaking,
    stopAllAudioPlayback,
  }
}
