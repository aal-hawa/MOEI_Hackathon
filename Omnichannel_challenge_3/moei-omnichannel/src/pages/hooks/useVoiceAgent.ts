'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'

export type VoiceAgentState = 'disconnected' | 'connecting' | 'connected' | 'listening' | 'thinking' | 'speaking'

export interface VoiceAgentConfig {
  socketUrl: string
  socketOptions: {
    reconnectionAttempts: number
    reconnectionDelay: number
    connectTimeout: number
    sessionTimeout: number
  }
}

export interface TranscriptMessage {
  id: string
  role: 'user' | 'agent' | 'employer'
  text: string
  timestamp: number
}

export interface VoiceAgentControls {
  start: () => Promise<void>
  stop: () => void
  toggleMute: () => void
  sendChatMessage: (text: string) => void
  updateConfig: (config: VoiceAgentConfig) => void
}

export interface VoiceProviderStatus {
  stt: string
  tts: string
  llm: string
}

export interface VoiceAgentData {
  state: VoiceAgentState
  isConnected: boolean
  isMuted: boolean
  hasMic: boolean
  messages: TranscriptMessage[]
  audioLevel: number
  agentAudioLevel: number
  error: string | null
  providerStatus: VoiceProviderStatus | null
  interimTranscript: string
}

export type UseVoiceAgentReturn = VoiceAgentData & VoiceAgentControls

function upsampleInt16PCM(data: Int16Array, fromRate: number, toRate: number): Int16Array {
  if (fromRate === toRate) return data
  const ratio = toRate / fromRate
  const newLength = Math.round(data.length * ratio)
  const result = new Int16Array(newLength)
  for (let i = 0; i < newLength; i++) {
    const srcPos = i / ratio
    const srcIdx = Math.floor(srcPos)
    const frac = srcPos - srcIdx
    const s0 = data[Math.min(srcIdx, data.length - 1)]
    const s1 = data[Math.min(srcIdx + 1, data.length - 1)]
    result[i] = Math.round(s0 + (s1 - s0) * frac)
  }
  return result
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 11) + Date.now().toString(36)
}

export function useVoiceAgent(): UseVoiceAgentReturn {
  const [state, setState] = useState<VoiceAgentState>('disconnected')
  const [isMuted, setIsMuted] = useState(false)
  const [hasMic, setHasMic] = useState(false)
  const [messages, setMessages] = useState<TranscriptMessage[]>([])
  const [audioLevel, setAudioLevel] = useState(0)
  const [agentAudioLevel, setAgentAudioLevel] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [providerStatus, setProviderStatus] = useState<VoiceProviderStatus | null>(null)
  const [interimTranscript, setInterimTranscript] = useState('')

  const audioContextRef = useRef<AudioContext | null>(null)
  const micAnalyserRef = useRef<AnalyserNode | null>(null)
  const agentAnalyserRef = useRef<AnalyserNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const nextPlayTimeRef = useRef(0)
  const isMutedRef = useRef(false)
  const isPlaybackActiveRef = useRef(false)
  const isPlaybackInterruptedRef = useRef(false)
  const agentGainRef = useRef<GainNode | null>(null)
  const activeSourceNodesRef = useRef<AudioBufferSourceNode[]>([])
  const playbackEndTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const levelIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const sessionStartedResolveRef = useRef<((value: void) => void) | null>(null)
  const sessionStartedRejectRef = useRef<((reason?: unknown) => void) | null>(null)
  const socketRef = useRef<Socket | null>(null)
  const ttsSourceSampleRateRef = useRef(24000)
  const configRef = useRef<VoiceAgentConfig>({
    socketUrl: '',
    socketOptions: {
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      connectTimeout: 15000,
      sessionTimeout: 15000,
    },
  })

  useEffect(() => { isMutedRef.current = isMuted }, [isMuted])

  const startLevelMonitoring = useCallback(() => {
    if (levelIntervalRef.current) clearInterval(levelIntervalRef.current)
    levelIntervalRef.current = setInterval(() => {
      if (micAnalyserRef.current) {
        const dataArray = new Uint8Array(micAnalyserRef.current.frequencyBinCount)
        micAnalyserRef.current.getByteFrequencyData(dataArray)
        const avg = dataArray.reduce((sum, v) => sum + v, 0) / dataArray.length
        setAudioLevel(avg / 255)
      }
      if (agentAnalyserRef.current) {
        const dataArray = new Uint8Array(agentAnalyserRef.current.frequencyBinCount)
        agentAnalyserRef.current.getByteFrequencyData(dataArray)
        const avg = dataArray.reduce((sum, v) => sum + v, 0) / dataArray.length
        setAgentAudioLevel(avg / 255)
      }
    }, 50)
  }, [])

  const stopLevelMonitoring = useCallback(() => {
    if (levelIntervalRef.current) { clearInterval(levelIntervalRef.current); levelIntervalRef.current = null }
    setAudioLevel(0)
    setAgentAudioLevel(0)
  }, [])

  const playAudioChunk = useCallback((pcmData: Int16Array, sourceSampleRate: number) => {
    const ctx = audioContextRef.current
    if (!ctx) return
    const targetRate = ctx.sampleRate
    const resampledData = sourceSampleRate !== targetRate ? upsampleInt16PCM(pcmData, sourceSampleRate, targetRate) : pcmData
    const float32 = new Float32Array(resampledData.length)
    for (let i = 0; i < resampledData.length; i++) { float32[i] = resampledData[i] / 32768 }
    const audioBuffer = ctx.createBuffer(1, float32.length, targetRate)
    audioBuffer.copyToChannel(float32, 0)
    const source = ctx.createBufferSource()
    source.buffer = audioBuffer
    if (isPlaybackInterruptedRef.current) return
    const gainNode = agentGainRef.current
    if (gainNode && agentAnalyserRef.current) { source.connect(gainNode) }
    else if (agentAnalyserRef.current) { source.connect(agentAnalyserRef.current); agentAnalyserRef.current.connect(ctx.destination) }
    else { source.connect(ctx.destination) }
    const currentTime = ctx.currentTime
    const startTime = Math.max(currentTime, nextPlayTimeRef.current)
    source.start(startTime)
    nextPlayTimeRef.current = startTime + audioBuffer.duration
    activeSourceNodesRef.current.push(source)
    source.onended = () => {
      const idx = activeSourceNodesRef.current.indexOf(source)
      if (idx >= 0) activeSourceNodesRef.current.splice(idx, 1)
    }
  }, [])

  const processAudioData = useCallback((data: ArrayBuffer) => {
    if (isPlaybackInterruptedRef.current) return
    if (!isPlaybackActiveRef.current) return
    const byteLen = data.byteLength - (data.byteLength % 2)
    if (byteLen === 0) return
    const int16Array = new Int16Array(data, 0, byteLen / 2)
    playAudioChunk(int16Array, ttsSourceSampleRateRef.current)
  }, [playAudioChunk])

  const cleanup = useCallback(() => {
    if (playbackEndTimeoutRef.current) { clearTimeout(playbackEndTimeoutRef.current); playbackEndTimeoutRef.current = null }
    isPlaybackActiveRef.current = false
    isPlaybackInterruptedRef.current = false
    nextPlayTimeRef.current = 0
    for (const node of activeSourceNodesRef.current) { try { node.stop() } catch { /* ignore */ } }
    activeSourceNodesRef.current = []
    if (agentGainRef.current) { agentGainRef.current.gain.value = 1 }
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    processorRef.current?.disconnect(); processorRef.current = null
    micSourceRef.current?.disconnect(); micSourceRef.current = null
    micAnalyserRef.current = null; agentAnalyserRef.current = null; agentGainRef.current = null
    audioContextRef.current?.close(); audioContextRef.current = null
    if (socketRef.current) { socketRef.current.disconnect(); socketRef.current = null }
    sessionStartedResolveRef.current = null
    sessionStartedRejectRef.current = null
  }, [])

  const setupMicrophone = useCallback(async (ctx: AudioContext) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
      streamRef.current = stream
      setHasMic(true)
      if (ctx.state === 'suspended') await ctx.resume()
      const micAnalyser = ctx.createAnalyser(); micAnalyser.fftSize = 256; micAnalyserRef.current = micAnalyser
      const micSource = ctx.createMediaStreamSource(stream); micSourceRef.current = micSource
      micSource.connect(micAnalyser)
      const processor = ctx.createScriptProcessor(4096, 1, 1); processorRef.current = processor
      const silenceGain = ctx.createGain(); silenceGain.gain.value = 0
      processor.connect(silenceGain); silenceGain.connect(ctx.destination)

      processor.onaudioprocess = (e) => {
        const socket = socketRef.current
        if (!socket || !socket.connected) return
        if (isMutedRef.current) return
        const inputData = e.inputBuffer.getChannelData(0)
        const pcmData = new Int16Array(inputData.length)
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]))
          pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
        }
        socket.emit('audio-data', pcmData.buffer.slice(0))
      }

      micSource.connect(processor)
      socket.emit('update-sample-rate', { sampleRate: ctx.sampleRate })
    } catch (micErr) {
      setHasMic(false)
      const errName = (micErr as DOMException)?.name || 'UnknownError'
      if (errName === 'NotAllowedError') setError('Microphone permission denied. You can still chat using the text input below.')
      else if (errName === 'NotFoundError') setError('No microphone found. You can still chat using the text input below.')
    }
  }, [])

  const start = useCallback(async () => {
    try {
      setError(null)
      setState('connecting')

      const ctx = new AudioContext()
      audioContextRef.current = ctx
      const agentGain = ctx.createGain(); agentGain.gain.value = 1; agentGainRef.current = agentGain
      const agentAnalyser = ctx.createAnalyser(); agentAnalyser.fftSize = 256; agentAnalyserRef.current = agentAnalyser
      agentGain.connect(agentAnalyser); agentAnalyser.connect(ctx.destination)

      const sessionStartedPromise = new Promise<void>((resolve, reject) => {
        sessionStartedResolveRef.current = resolve
        sessionStartedRejectRef.current = reject
      })

      const cfg = configRef.current

      // Connect via Caddy gateway — CRITICAL: use /?XTransformPort=3004
      const socket = io('/?XTransformPort=3004', {
        reconnectionAttempts: cfg.socketOptions.reconnectionAttempts,
        reconnectionDelay: cfg.socketOptions.reconnectionDelay,
        timeout: cfg.socketOptions.connectTimeout,
        transports: ['websocket', 'polling'],
      })
      socketRef.current = socket

      socket.on('connect', () => {
        console.log('[VoiceAgent] Socket.IO connected')
        socket.emit('start-session', { sampleRate: ctx.sampleRate })
      })

      socket.on('session-started', () => {
        setState('listening')
        startLevelMonitoring()
        sessionStartedResolveRef.current?.()
        sessionStartedResolveRef.current = null
        sessionStartedRejectRef.current = null
      })

      socket.on('provider-status', (msg: VoiceProviderStatus) => {
        setProviderStatus(msg)
        console.log('[VoiceAgent] Provider status:', msg)
      })

      socket.on('transcript', (msg: { id?: string; role: string; text: string }) => {
        setMessages(prev => [...prev, { id: msg.id || generateId(), role: msg.role as 'user' | 'agent' | 'employer', text: msg.text, timestamp: Date.now() }])
        setInterimTranscript('') // Clear interim when final transcript arrives
      })

      socket.on('transcript-interim', (msg: { text: string }) => {
        setInterimTranscript(msg.text)
      })

      socket.on('user-speech-started', () => {
        // User started speaking
      })

      socket.on('agent-thinking', () => {
        setState('thinking')
      })

      socket.on('agent-speaking-start', () => {
        setState('speaking')
        isPlaybackActiveRef.current = true
        isPlaybackInterruptedRef.current = false
        nextPlayTimeRef.current = 0
        if (agentGainRef.current) agentGainRef.current.gain.value = 1
        if (playbackEndTimeoutRef.current) { clearTimeout(playbackEndTimeoutRef.current); playbackEndTimeoutRef.current = null }
      })

      socket.on('agent-speaking-interrupted', () => {
        isPlaybackInterruptedRef.current = true
        if (agentGainRef.current) agentGainRef.current.gain.value = 0
        for (const node of activeSourceNodesRef.current) { try { node.stop() } catch { /* ignore */ } }
        activeSourceNodesRef.current = []
        if (playbackEndTimeoutRef.current) { clearTimeout(playbackEndTimeoutRef.current); playbackEndTimeoutRef.current = null }
        nextPlayTimeRef.current = 0
        isPlaybackActiveRef.current = false
        setState('listening')
        socket.emit('client-playback-ended')
      })

      socket.on('agent-speaking-end', () => {
        const currentCtx = audioContextRef.current
        if (currentCtx && nextPlayTimeRef.current > 0) {
          const remainingMs = Math.max(0, (nextPlayTimeRef.current - currentCtx.currentTime) * 1000)
          const waitMs = remainingMs + 200
          playbackEndTimeoutRef.current = setTimeout(() => {
            isPlaybackActiveRef.current = false
            setState('listening')
            socket.emit('client-playback-ended')
            playbackEndTimeoutRef.current = null
          }, waitMs)
        } else {
          isPlaybackActiveRef.current = false
          setState('listening')
          socket.emit('client-playback-ended')
        }
      })

      socket.on('agent-audio-format', (msg: { sampleRate?: number; numChannels?: number; bitsPerSample?: number }) => {
        if (msg.sampleRate) ttsSourceSampleRateRef.current = msg.sampleRate
      })

      socket.on('agent-audio', (data: ArrayBuffer) => {
        processAudioData(data)
      })

      socket.on('audio-level', (msg: { level: number }) => {
        setAgentAudioLevel(msg.level)
      })

      socket.on('error', (msg: { message: string }) => {
        setError(msg.message)
        sessionStartedRejectRef.current?.(new Error(msg.message))
        sessionStartedResolveRef.current = null
        sessionStartedRejectRef.current = null
      })

      socket.on('connect_error', (err: Error) => {
        console.error('[VoiceAgent] Socket.IO connect error:', err)
        setError('Connection error: ' + err.message)
        sessionStartedRejectRef.current?.(err)
      })

      socket.on('disconnect', (reason: string) => {
        console.log('[VoiceAgent] Socket.IO disconnected:', reason)
        setState('disconnected')
        stopLevelMonitoring()
        sessionStartedRejectRef.current?.(new Error(`Socket disconnected: ${reason}`))
        sessionStartedResolveRef.current = null
        sessionStartedRejectRef.current = null
      })

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Connection timeout - server did not start session')), cfg.socketOptions.sessionTimeout)
      })

      await Promise.race([sessionStartedPromise, timeoutPromise])

      // Set up microphone on the unified AudioContext
      await setupMicrophone(ctx)

    } catch (err) {
      const errMessage = err instanceof Error ? err.message : 'Failed to start'
      setError(errMessage)
      setState('disconnected')
      stopLevelMonitoring()
      cleanup()
    }
  }, [startLevelMonitoring, stopLevelMonitoring, processAudioData, cleanup, setupMicrophone])

  const stop = useCallback(() => {
    const socket = socketRef.current
    if (socket?.connected) socket.emit('stop-session')
    setState('disconnected')
    setIsMuted(false)
    setHasMic(false)
    setMessages([])
    stopLevelMonitoring()
    cleanup()
  }, [stopLevelMonitoring, cleanup])

  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const newMuted = !prev
      const socket = socketRef.current
      if (socket?.connected) socket.emit('mute-toggle', { muted: newMuted })
      return newMuted
    })
  }, [])

  const sendChatMessage = useCallback((text: string) => {
    const socket = socketRef.current
    if (!socket?.connected) return
    socket.emit('chat-message', { text })
  }, [])

  const updateConfig = useCallback((config: VoiceAgentConfig) => {
    configRef.current = config
  }, [])

  useEffect(() => { return () => { stop() } }, [stop])

  return {
    state, isConnected: state === 'connected' || state === 'listening' || state === 'thinking' || state === 'speaking', isMuted, hasMic, messages, audioLevel, agentAudioLevel, error, providerStatus, interimTranscript,
    start, stop, toggleMute, sendChatMessage, updateConfig,
  }
}
