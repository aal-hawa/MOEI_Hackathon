'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAppStore } from '@/store/app-store'

// ─── Types ────────────────────────────────────────────────────────
type CallScreen = 'dialer' | 'connecting' | 'active' | 'ended'

interface TranscriptLine {
  id: string
  role: 'user' | 'agent'
  text: string
  time: number
}

// ─── Utility ──────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36) }

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function upsampleInt16PCM(data: Int16Array, from: number, to: number): Int16Array {
  if (from === to) return data
  const r = to / from
  const len = Math.round(data.length * r)
  const out = new Int16Array(len)
  for (let i = 0; i < len; i++) {
    const p = i / r
    const idx = Math.floor(p)
    const f = p - idx
    out[i] = Math.round(data[Math.min(idx, data.length - 1)] + (data[Math.min(idx + 1, data.length - 1)] - data[Math.min(idx, data.length - 1)]) * f)
  }
  return out
}

// ─── Dial Pad Keys ────────────────────────────────────────────────
const KEYS = [
  { digit: '1', letters: '' },
  { digit: '2', letters: 'ABC' },
  { digit: '3', letters: 'DEF' },
  { digit: '4', letters: 'GHI' },
  { digit: '5', letters: 'JKL' },
  { digit: '6', letters: 'MNO' },
  { digit: '7', letters: 'PQRS' },
  { digit: '8', letters: 'TUV' },
  { digit: '9', letters: 'WXYZ' },
  { digit: '*', letters: '' },
  { digit: '0', letters: '+' },
  { digit: '#', letters: '' },
]

// ─── Audio Wave Visualizer ────────────────────────────────────────
function AudioWaveform({ level, isActive, color = '#34C759' }: { level: number; isActive: boolean; color?: string }) {
  const bars = 28
  return (
    <div className="flex items-center justify-center gap-[2px] h-8">
      {Array.from({ length: bars }).map((_, i) => {
        const dist = Math.abs(i - bars / 2) / (bars / 2)
        const baseH = 0.15 + (1 - dist) * 0.4
        const h = isActive ? baseH + level * (1 - dist) * 0.7 : baseH * 0.4
        return (
          <div
            key={i}
            className="w-[2.5px] rounded-full transition-all duration-100"
            style={{
              height: `${Math.max(0.08, Math.min(1, h)) * 100}%`,
              backgroundColor: color,
              opacity: isActive ? 0.6 + level * 0.4 : 0.15,
            }}
          />
        )
      })}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// Main Page Component
// ═══════════════════════════════════════════════════════════════════
export default function VoiceCallPage() {
  // ─── Screen state ─────────────────────────────────────────────
  const [screen, setScreen] = useState<CallScreen>('dialer')
  const [phoneNumber, setPhoneNumber] = useState('800-MOEI')
  const [callDuration, setCallDuration] = useState(0)
  const [transcripts, setTranscripts] = useState<TranscriptLine[]>([])
  const [interimText, setInterimText] = useState('')
  const [isMuted, setIsMuted] = useState(false)
  const [isSpeaker, setIsSpeaker] = useState(false)
  const [showKeypad, setShowKeypad] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [agentState, setAgentState] = useState<'listening' | 'thinking' | 'speaking'>('listening')
  const [agentAudioLevel, setAgentAudioLevel] = useState(0)
  const [micAudioLevel, setMicAudioLevel] = useState(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // ─── Refs ─────────────────────────────────────────────────────
  const socketRef = useRef<Socket | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const micAnalyserRef = useRef<AnalyserNode | null>(null)
  const agentAnalyserRef = useRef<AnalyserNode | null>(null)
  const agentGainRef = useRef<GainNode | null>(null)
  const nextPlayTimeRef = useRef(0)
  const isPlaybackActiveRef = useRef(false)
  const isPlaybackInterruptedRef = useRef(false)
  const activeSourceNodesRef = useRef<AudioBufferSourceNode[]>([])
  const isMutedRef = useRef(false)
  const ttsSampleRateRef = useRef(24000)
  const durationRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const levelRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const playbackEndTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const transcriptEndRef = useRef<HTMLDivElement | null>(null)
  const chatInputRef = useRef<HTMLInputElement | null>(null)
  const ringOscRef = useRef<OscillatorNode | null>(null)

  // ─── Keep refs in sync ───────────────────────────────────────
  useEffect(() => { isMutedRef.current = isMuted }, [isMuted])

  // ─── Auto-scroll transcripts ─────────────────────────────────
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [transcripts, interimText])

  // ─── Duration timer ──────────────────────────────────────────
  useEffect(() => {
    if (screen === 'active') {
      durationRef.current = setInterval(() => {
        setCallDuration(d => d + 1)
      }, 1000)
    }
    return () => { if (durationRef.current) clearInterval(durationRef.current) }
  }, [screen])

  // ─── Ringing sound during connecting ─────────────────────────
  const startRing = useCallback(() => {
    try {
      const ctx = audioCtxRef.current || new AudioContext()
      if (!audioCtxRef.current) audioCtxRef.current = ctx
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = 440
      const gain = ctx.createGain()
      gain.gain.value = 0.08
      osc.connect(gain)
      gain.connect(ctx.destination)
      // Ring pattern: 1s on, 2s off
      const now = ctx.currentTime
      for (let i = 0; i < 10; i++) {
        gain.gain.setValueAtTime(0.08, now + i * 3)
        gain.gain.setValueAtTime(0, now + i * 3 + 1)
      }
      osc.start(now)
      osc.stop(now + 30)
      ringOscRef.current = osc
    } catch { /* non-critical */ }
  }, [])

  const stopRing = useCallback(() => {
    try { ringOscRef.current?.stop() } catch { /* */ }
    ringOscRef.current = null
  }, [])

  // ─── Level monitoring ────────────────────────────────────────
  const startLevels = useCallback(() => {
    if (levelRef.current) clearInterval(levelRef.current)
    levelRef.current = setInterval(() => {
      if (micAnalyserRef.current) {
        const d = new Uint8Array(micAnalyserRef.current.frequencyBinCount)
        micAnalyserRef.current.getByteFrequencyData(d)
        setMicAudioLevel(d.reduce((s, v) => s + v, 0) / d.length / 255)
      }
      if (agentAnalyserRef.current) {
        const d = new Uint8Array(agentAnalyserRef.current.frequencyBinCount)
        agentAnalyserRef.current.getByteFrequencyData(d)
        setAgentAudioLevel(d.reduce((s, v) => s + v, 0) / d.length / 255)
      }
    }, 80)
  }, [])

  const stopLevels = useCallback(() => {
    if (levelRef.current) { clearInterval(levelRef.current); levelRef.current = null }
    setMicAudioLevel(0); setAgentAudioLevel(0)
  }, [])

  // ─── Audio playback ──────────────────────────────────────────
  const playChunk = useCallback((pcm: Int16Array, srcRate: number) => {
    const ctx = audioCtxRef.current
    if (!ctx) return
    const target = ctx.sampleRate
    const resampled = srcRate !== target ? upsampleInt16PCM(pcm, srcRate, target) : pcm
    const f32 = new Float32Array(resampled.length)
    for (let i = 0; i < resampled.length; i++) f32[i] = resampled[i] / 32768
    const buf = ctx.createBuffer(1, f32.length, target)
    buf.copyToChannel(f32, 0)
    const src = ctx.createBufferSource()
    src.buffer = buf
    if (isPlaybackInterruptedRef.current) return
    if (agentGainRef.current && agentAnalyserRef.current) src.connect(agentGainRef.current)
    else src.connect(ctx.destination)
    const t = Math.max(ctx.currentTime, nextPlayTimeRef.current)
    src.start(t)
    nextPlayTimeRef.current = t + buf.duration
    activeSourceNodesRef.current.push(src)
    src.onended = () => {
      const i = activeSourceNodesRef.current.indexOf(src)
      if (i >= 0) activeSourceNodesRef.current.splice(i, 1)
    }
  }, [])

  // ─── Cleanup ─────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    if (playbackEndTimeoutRef.current) { clearTimeout(playbackEndTimeoutRef.current); playbackEndTimeoutRef.current = null }
    isPlaybackActiveRef.current = false
    isPlaybackInterruptedRef.current = false
    nextPlayTimeRef.current = 0
    for (const n of activeSourceNodesRef.current) { try { n.stop() } catch { /* */ } }
    activeSourceNodesRef.current = []
    if (agentGainRef.current) agentGainRef.current.gain.value = 1
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    processorRef.current?.disconnect(); processorRef.current = null
    micSourceRef.current?.disconnect(); micSourceRef.current = null
    micAnalyserRef.current = null; agentAnalyserRef.current = null; agentGainRef.current = null
    if (socketRef.current) { socketRef.current.disconnect(); socketRef.current = null }
    stopLevels()
    stopRing()
  }, [stopLevels, stopRing])

  // ─── Start Call ──────────────────────────────────────────────
  const startCall = useCallback(async () => {
    try {
      setErrorMsg(null)
      setTranscripts([])
      setInterimText('')
      setCallDuration(0)
      setAgentState('listening')
      setScreen('connecting')

      const ctx = new AudioContext()
      audioCtxRef.current = ctx
      const gain = ctx.createGain(); gain.gain.value = 1; agentGainRef.current = gain
      const analyser = ctx.createAnalyser(); analyser.fftSize = 256; agentAnalyserRef.current = analyser
      gain.connect(analyser); analyser.connect(ctx.destination)

      // Start ring sound
      startRing()

      const socketUrl = typeof window !== 'undefined' && window.location.hostname === 'localhost' 
        ? 'http://localhost:3004' 
        : '/?XTransformPort=3004';
        
      const socket = io(socketUrl, {
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 15000,
        transports: ['websocket', 'polling'],
      })
      socketRef.current = socket

      socket.on('connect', () => {
        socket.emit('start-session', { sampleRate: ctx.sampleRate })
      })

      socket.on('session-started', () => {
        stopRing()
        setScreen('active')
        startLevels()
        // Set up microphone
        navigator.mediaDevices.getUserMedia({
          audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        }).then(stream => {
          streamRef.current = stream
          if (ctx.state === 'suspended') ctx.resume()
          const micA = ctx.createAnalyser(); micA.fftSize = 256; micAnalyserRef.current = micA
          const micSrc = ctx.createMediaStreamSource(stream); micSourceRef.current = micSrc
          micSrc.connect(micA)
          const proc = ctx.createScriptProcessor(4096, 1, 1); processorRef.current = proc
          const silentGain = ctx.createGain(); silentGain.gain.value = 0
          proc.connect(silentGain); silentGain.connect(ctx.destination)
          proc.onaudioprocess = (e) => {
            if (!socket.connected || isMutedRef.current) return
            const input = e.inputBuffer.getChannelData(0)
            const pcm = new Int16Array(input.length)
            for (let i = 0; i < input.length; i++) {
              const s = Math.max(-1, Math.min(1, input[i]))
              pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
            }
            socket.emit('audio-data', pcm.buffer.slice(0))
          }
          micSrc.connect(proc)
          socket.emit('update-sample-rate', { sampleRate: ctx.sampleRate })
        }).catch(err => {
          console.error('Mic error:', err)
          setErrorMsg('Microphone access denied — use text chat instead')
          setShowChat(true)
        })
      })

      socket.on('transcript', (msg: { id?: string; role: string; text: string }) => {
        setTranscripts(p => [...p, { id: msg.id || uid(), role: msg.role as 'user' | 'agent', text: msg.text, time: Date.now() }])
        setInterimText('')
      })

      socket.on('transcript-interim', (msg: { text: string }) => {
        setInterimText(msg.text)
      })

      socket.on('agent-thinking', () => setAgentState('thinking'))

      socket.on('agent-speaking-start', () => {
        setAgentState('speaking')
        isPlaybackActiveRef.current = true
        isPlaybackInterruptedRef.current = false
        nextPlayTimeRef.current = 0
        if (agentGainRef.current) agentGainRef.current.gain.value = 1
        if (playbackEndTimeoutRef.current) { clearTimeout(playbackEndTimeoutRef.current); playbackEndTimeoutRef.current = null }
      })

      socket.on('agent-speaking-interrupted', () => {
        isPlaybackInterruptedRef.current = true
        if (agentGainRef.current) agentGainRef.current.gain.value = 0
        for (const n of activeSourceNodesRef.current) { try { n.stop() } catch { /* */ } }
        activeSourceNodesRef.current = []
        nextPlayTimeRef.current = 0
        isPlaybackActiveRef.current = false
        setAgentState('listening')
        socket.emit('client-playback-ended')
      })

      socket.on('agent-speaking-end', () => {
        const curCtx = audioCtxRef.current
        if (curCtx && nextPlayTimeRef.current > 0) {
          const rem = Math.max(0, (nextPlayTimeRef.current - curCtx.currentTime) * 1000)
          playbackEndTimeoutRef.current = setTimeout(() => {
            isPlaybackActiveRef.current = false
            setAgentState('listening')
            socket.emit('client-playback-ended')
            playbackEndTimeoutRef.current = null
          }, rem + 200)
        } else {
          isPlaybackActiveRef.current = false
          setAgentState('listening')
          socket.emit('client-playback-ended')
        }
      })

      socket.on('agent-audio-format', (msg: { sampleRate?: number }) => {
        if (msg.sampleRate) ttsSampleRateRef.current = msg.sampleRate
      })

      socket.on('agent-audio', (data: ArrayBuffer) => {
        if (isPlaybackInterruptedRef.current || !isPlaybackActiveRef.current) return
        const byteLen = data.byteLength - (data.byteLength % 2)
        if (byteLen === 0) return
        playChunk(new Int16Array(data, 0, byteLen / 2), ttsSampleRateRef.current)
      })

      socket.on('audio-level', (msg: { level: number }) => setAgentAudioLevel(msg.level))

      socket.on('error', (msg: { message: string }) => setErrorMsg(msg.message))

      socket.on('connect_error', () => {
        stopRing()
        setErrorMsg('Cannot connect to voice service')
        setScreen('dialer')
        cleanup()
      })

      socket.on('disconnect', () => {
        stopRing()
        if (screen === 'active' || screen === 'connecting') {
          setScreen('ended')
        }
        stopLevels()
      })

    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to start call')
      setScreen('dialer')
      cleanup()
    }
  }, [startLevels, stopLevels, cleanup, playChunk, screen, startRing, stopRing])

  // ─── End Call ────────────────────────────────────────────────
  const endCall = useCallback(() => {
    if (socketRef.current?.connected) socketRef.current.emit('stop-session')
    setScreen('ended')
    stopRing()
    stopLevels()
    cleanup()
  }, [cleanup, stopLevels, stopRing])

  // ─── Mute toggle ─────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const next = !prev
      if (socketRef.current?.connected) socketRef.current.emit('mute-toggle', { muted: next })
      return next
    })
  }, [])

  // ─── Send chat message ───────────────────────────────────────
  const sendChat = useCallback(() => {
    if (!chatInput.trim() || !socketRef.current?.connected) return
    socketRef.current.emit('chat-message', { text: chatInput.trim() })
    setChatInput('')
  }, [chatInput])

  // ─── Dial pad press ──────────────────────────────────────────
  const pressKey = useCallback((key: string) => {
    setPhoneNumber(p => p.length < 15 ? p + key : p)
  }, [])

  const backspace = useCallback(() => {
    setPhoneNumber(p => p.slice(0, -1))
  }, [])

  // ─── Reset to dialer ─────────────────────────────────────────
  const resetCall = useCallback(() => {
    setScreen('dialer')
    setCallDuration(0)
    setTranscripts([])
    setInterimText('')
    setIsMuted(false)
    setIsSpeaker(false)
    setShowKeypad(false)
    setShowChat(false)
    setErrorMsg(null)
  }, [])

  // ─── Cleanup on unmount ──────────────────────────────────────
  useEffect(() => { return () => { cleanup() } }, [cleanup])

  // ─── State label text ────────────────────────────────────────
  const stateLabel = agentState === 'thinking' ? 'Thinking...' : agentState === 'speaking' ? 'Speaking' : formatDuration(callDuration)
  const stateColor = agentState === 'thinking' ? 'text-amber-400' : agentState === 'speaking' ? 'text-emerald-400' : 'text-white/40'

  // ═════════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════════
  return (
    <div className="fixed inset-0 bg-black flex flex-col select-none overflow-hidden" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif' }}>
      {/* Fake Status Bar */}
      <div className="flex items-center justify-between px-6 pt-3 pb-1 text-white/60 text-xs shrink-0 safe-top">
        <span>9:41</span>
        <div className="flex items-center gap-1.5">
          <svg width="16" height="12" viewBox="0 0 16 12" fill="currentColor"><rect x="0" y="5" width="3" height="7" rx="0.5"/><rect x="4.5" y="3" width="3" height="9" rx="0.5"/><rect x="9" y="1" width="3" height="11" rx="0.5"/><rect x="13" y="0" width="3" height="12" rx="0.5" opacity="0.3"/></svg>
          <span>5G</span>
          <svg width="22" height="10" viewBox="0 0 22 10" fill="none"><rect x="0.5" y="1" width="17" height="8" rx="2" stroke="currentColor" strokeWidth="1"/><rect x="1.5" y="2.5" width="12" height="5" rx="1" fill="#34C759"/><rect x="19" y="3" width="2" height="4" rx="1" fill="currentColor"/></svg>
        </div>
      </div>

      {/* Navigation */}
      <div className="px-6 py-2 shrink-0 flex items-center absolute top-12 left-0 z-50">
        <button onClick={() => useAppStore.getState().setPageView('customer')} className="flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm font-medium bg-white/[0.06] hover:bg-white/[0.12] px-3 py-1.5 rounded-full backdrop-blur-sm">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          Portal
        </button>
      </div>

      {/* ─── DIALER SCREEN ────────────────────────────────────── */}
      {screen === 'dialer' && (
        <div className="flex-1 flex flex-col px-6 min-h-0">
          {/* Logo / Branding */}
          <div className="flex flex-col items-center pt-4 pb-3">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mb-2 shadow-lg shadow-emerald-500/20">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
            </div>
            <h1 className="text-white text-lg font-semibold tracking-wide">MOEI Call Center</h1>
            <p className="text-white/40 text-xs mt-0.5">AI-Powered Voice Assistant</p>
          </div>

          {/* Phone Number Display */}
          <div className="flex items-center justify-center mb-4 min-h-[44px]">
            <span className="text-white text-3xl font-light tracking-[0.15em]">
              {phoneNumber || <span className="text-white/20">Enter number</span>}
            </span>
            {phoneNumber && (
              <button onClick={backspace} className="ml-3 p-2 text-white/40 active:text-white transition-colors" aria-label="Delete">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/>
                  <line x1="18" y1="9" x2="12" y2="15"/><line x1="12" y1="9" x2="18" y2="15"/>
                </svg>
              </button>
            )}
          </div>

          {/* Number Pad */}
          <div className="grid grid-cols-3 gap-y-2.5 max-w-[276px] mx-auto">
            {KEYS.map(({ digit, letters }) => (
              <button
                key={digit}
                onClick={() => pressKey(digit)}
                className="flex flex-col items-center justify-center w-[76px] h-[76px] mx-auto rounded-full bg-white/[0.08] active:bg-white/[0.2] transition-colors"
              >
                <span className="text-white text-[28px] font-light leading-none">{digit}</span>
                {letters && <span className="text-white/40 text-[9px] tracking-[0.2em] mt-0.5">{letters}</span>}
              </button>
            ))}
          </div>

          {/* Call Button */}
          <div className="flex justify-center mt-6 mb-8">
            <button
              onClick={startCall}
              className="w-[76px] h-[76px] rounded-full bg-[#34C759] active:bg-[#2db84e] flex items-center justify-center shadow-lg shadow-[#34C759]/30 transition-all active:scale-95"
              aria-label="Start call"
            >
              <svg width="30" height="30" viewBox="0 0 24 24" fill="white" stroke="none">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ─── CONNECTING SCREEN ────────────────────────────────── */}
      {screen === 'connecting' && (
        <div className="flex-1 flex flex-col items-center justify-between py-12 px-6">
          {/* Contact info + pulse */}
          <div className="flex flex-col items-center">
            <div className="relative w-32 h-32 flex items-center justify-center mb-5">
              <div className="absolute inset-0 rounded-full border-2 border-emerald-400/20 animate-[pulse-ring_2s_ease-out_infinite]" />
              <div className="absolute inset-0 rounded-full border-2 border-emerald-400/15 animate-[pulse-ring_2s_ease-out_0.6s_infinite]" />
              <div className="absolute inset-0 rounded-full border-2 border-emerald-400/10 animate-[pulse-ring_2s_ease-out_1.2s_infinite]" />
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center z-10 shadow-lg shadow-emerald-500/30">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
              </div>
            </div>
            <h2 className="text-white text-2xl font-light tracking-wide mb-1.5">MOEI Call Center</h2>
            <p className="text-white/50 text-sm">{phoneNumber}</p>
          </div>

          {/* Calling animation */}
          <div className="flex flex-col items-center gap-3">
            <p className="text-white/70 text-lg font-light">Calling</p>
            <div className="flex gap-2">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full bg-white/70 animate-[dot-bounce_1.4s_ease-in-out_infinite]"
                  style={{ animationDelay: `${i * 0.2}s` }}
                />
              ))}
            </div>
          </div>

          {/* End Call button */}
          <button
            onClick={endCall}
            className="w-[76px] h-[76px] rounded-full bg-[#FF3B30] active:bg-[#e0352b] flex items-center justify-center shadow-lg shadow-[#FF3B30]/30 transition-all active:scale-95"
            aria-label="End call"
          >
            <svg width="30" height="30" viewBox="0 0 24 24" fill="white" stroke="none" transform="rotate(135)">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
            </svg>
          </button>
        </div>
      )}

      {/* ─── ACTIVE CALL SCREEN ───────────────────────────────── */}
      {screen === 'active' && (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Top: Contact info + duration */}
          <div className="flex flex-col items-center pt-3 pb-1 shrink-0">
            <div className="relative w-20 h-20 flex items-center justify-center mb-2">
              {agentState === 'speaking' && (
                <>
                  <div className="absolute inset-0 rounded-full border-2 border-emerald-400/25 animate-[pulse-ring_2s_ease-out_infinite]" />
                  <div className="absolute inset-0 rounded-full border-2 border-emerald-400/15 animate-[pulse-ring_2s_ease-out_0.6s_infinite]" />
                </>
              )}
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center z-10">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
              </div>
            </div>
            <h2 className="text-white text-lg font-medium">MOEI Call Center</h2>

            {/* State + Duration indicator */}
            <div className="flex items-center gap-2 mt-1">
              {agentState === 'thinking' && (
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              )}
              {agentState === 'speaking' && (
                <div className="flex items-end gap-[2px] h-3">
                  {[0.4, 1, 0.6, 0.8, 0.5].map((h, i) => (
                    <div
                      key={i}
                      className="w-[3px] bg-emerald-400 rounded-full animate-[wave-bar_0.8s_ease-in-out_infinite]"
                      style={{ height: `${h * 100}%`, animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
              )}
              <span className={`text-xs ${stateColor}`}>{stateLabel}</span>
            </div>
          </div>

          {/* Audio Waveform Visualizer */}
          <div className="px-6 shrink-0">
            <AudioWaveform
              level={agentAudioLevel}
              isActive={agentState === 'speaking'}
              color={agentState === 'speaking' ? '#34C759' : '#ffffff'}
            />
          </div>

          {/* Transcript area */}
          <div className="flex-1 overflow-y-auto px-4 py-2 min-h-0">
            {transcripts.length === 0 && !interimText && (
              <div className="flex flex-col items-center justify-center h-full text-white/20 text-sm">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-2">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
                </svg>
                Speak to start conversation
              </div>
            )}
            {transcripts.map(t => (
              <div key={t.id} className={`mb-2 ${t.role === 'user' ? 'text-right' : 'text-left'}`}>
                <div className={`inline-block max-w-[85%] px-3 py-1.5 rounded-2xl text-[13px] leading-relaxed ${
                  t.role === 'user'
                    ? 'bg-white/[0.12] text-white/90 rounded-br-sm'
                    : 'bg-emerald-500/20 text-emerald-100 rounded-bl-sm'
                }`}>
                  {t.text}
                </div>
              </div>
            ))}
            {interimText && (
              <div className="mb-2 text-right">
                <div className="inline-block max-w-[85%] px-3 py-1.5 rounded-2xl rounded-br-sm bg-white/[0.06] text-white/50 text-[13px] italic">
                  {interimText}
                </div>
              </div>
            )}
            <div ref={transcriptEndRef} />
          </div>

          {/* Error toast with Retry button */}
          {errorMsg && (
            <div className="mx-4 mb-1 px-3 py-2 bg-red-500/20 rounded-xl text-red-300 text-xs text-center shrink-0 select-text flex items-center justify-center gap-2">
              <span>{errorMsg}</span>
              {errorMsg.includes('Cannot connect') && (
                <button
                  onClick={async () => {
                    setErrorMsg(null)
                    setScreen('dialer')
                    try {
                      const res = await fetch('/api/service-manager', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ service: 'voice-agent' }),
                      })
                      const data = await res.json()
                      if (data.started || data.skipped) {
                        // Wait for service to be ready
                        await new Promise(r => setTimeout(r, 4000))
                      }
                    } catch {
                      // Service manager may be unavailable
                    }
                  }}
                  className="px-2 py-0.5 bg-red-500/30 hover:bg-red-500/50 rounded-md text-red-200 text-[10px] font-medium transition-colors"
                >
                  Start Service &amp; Retry
                </button>
              )}
            </div>
          )}

          {/* Chat input (toggle) */}
          {showChat && (
            <div className="px-4 pb-2 shrink-0">
              <div className="flex items-center gap-2">
                <input
                  ref={chatInputRef}
                  type="text"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendChat()}
                  placeholder="Type a message..."
                  className="flex-1 h-10 px-3 bg-white/[0.08] rounded-full text-white text-sm placeholder:text-white/30 outline-none focus:bg-white/[0.12] transition-colors"
                />
                <button
                  onClick={sendChat}
                  className="w-10 h-10 rounded-full bg-[#34C759] flex items-center justify-center shrink-0 active:scale-95 transition-transform"
                  aria-label="Send message"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="white" stroke="none">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* In-call Keypad (toggle) */}
          {showKeypad && (
            <div className="px-4 pb-2 shrink-0">
              <div className="grid grid-cols-3 gap-y-1.5 max-w-[240px] mx-auto">
                {KEYS.map(({ digit, letters }) => (
                  <button
                    key={digit}
                    onClick={() => pressKey(digit)}
                    className="flex flex-col items-center justify-center w-[56px] h-[56px] mx-auto rounded-full bg-white/[0.06] active:bg-white/[0.15] transition-colors"
                  >
                    <span className="text-white text-lg font-light leading-none">{digit}</span>
                    {letters && <span className="text-white/30 text-[7px] tracking-[0.15em] mt-0.5">{letters}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Call controls */}
          <div className="px-6 pb-6 pt-2 shrink-0 safe-bottom">
            {/* Mute / Keypad / Chat / Speaker row */}
            <div className="flex justify-center gap-8 mb-5">
              {/* Mute */}
              <button onClick={toggleMute} className="flex flex-col items-center gap-1">
                <div className={`w-[52px] h-[52px] rounded-full flex items-center justify-center transition-all duration-200 ${
                  isMuted ? 'bg-white text-[#007AFF] scale-105' : 'bg-white/[0.08] text-white/80'
                }`}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {isMuted ? (
                      <>
                        <line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .87-.16 1.7-.44 2.47"/>
                        <line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
                      </>
                    ) : (
                      <>
                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
                      </>
                    )}
                  </svg>
                </div>
                <span className={`text-[10px] font-medium ${isMuted ? 'text-[#007AFF]' : 'text-white/50'}`}>
                  {isMuted ? 'Unmute' : 'Mute'}
                </span>
              </button>

              {/* Keypad */}
              <button onClick={() => { setShowKeypad(k => !k); setShowChat(false) }} className="flex flex-col items-center gap-1">
                <div className={`w-[52px] h-[52px] rounded-full flex items-center justify-center transition-all duration-200 ${
                  showKeypad ? 'bg-white text-[#007AFF] scale-105' : 'bg-white/[0.08] text-white/80'
                }`}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="4" y="4" width="4" height="4" rx="1"/><rect x="10" y="4" width="4" height="4" rx="1"/><rect x="16" y="4" width="4" height="4" rx="1"/>
                    <rect x="4" y="10" width="4" height="4" rx="1"/><rect x="10" y="10" width="4" height="4" rx="1"/><rect x="16" y="10" width="4" height="4" rx="1"/>
                    <rect x="10" y="16" width="4" height="4" rx="1"/>
                  </svg>
                </div>
                <span className={`text-[10px] font-medium ${showKeypad ? 'text-[#007AFF]' : 'text-white/50'}`}>Keypad</span>
              </button>

              {/* Chat */}
              <button onClick={() => { setShowChat(c => !c); setShowKeypad(false) }} className="flex flex-col items-center gap-1">
                <div className={`w-[52px] h-[52px] rounded-full flex items-center justify-center transition-all duration-200 ${
                  showChat ? 'bg-white text-[#007AFF] scale-105' : 'bg-white/[0.08] text-white/80'
                }`}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                </div>
                <span className={`text-[10px] font-medium ${showChat ? 'text-[#007AFF]' : 'text-white/50'}`}>Chat</span>
              </button>

              {/* Speaker */}
              <button onClick={() => setIsSpeaker(s => !s)} className="flex flex-col items-center gap-1">
                <div className={`w-[52px] h-[52px] rounded-full flex items-center justify-center transition-all duration-200 ${
                  isSpeaker ? 'bg-white text-[#007AFF] scale-105' : 'bg-white/[0.08] text-white/80'
                }`}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                    {isSpeaker ? (
                      <><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></>
                    ) : (
                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                    )}
                  </svg>
                </div>
                <span className={`text-[10px] font-medium ${isSpeaker ? 'text-[#007AFF]' : 'text-white/50'}`}>Speaker</span>
              </button>
            </div>

            {/* End Call */}
            <div className="flex justify-center">
              <button
                onClick={endCall}
                className="w-[76px] h-[76px] rounded-full bg-[#FF3B30] active:bg-[#e0352b] flex items-center justify-center shadow-lg shadow-[#FF3B30]/30 transition-all active:scale-95"
                aria-label="End call"
              >
                <svg width="30" height="30" viewBox="0 0 24 24" fill="white" stroke="none" transform="rotate(135)">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── CALL ENDED SCREEN ────────────────────────────────── */}
      {screen === 'ended' && (
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <div className="w-20 h-20 rounded-full bg-white/[0.06] flex items-center justify-center mb-4">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/30">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
            </svg>
          </div>
          <h2 className="text-white text-xl font-medium mb-1">Call Ended</h2>
          <p className="text-white/40 text-sm mb-0.5">{phoneNumber}</p>
          <p className="text-white/30 text-sm mb-6">Duration: {formatDuration(callDuration)}</p>

          {transcripts.length > 0 && (
            <div className="w-full max-w-sm mb-6 max-h-44 overflow-y-auto px-2">
              <p className="text-white/30 text-xs text-center mb-2">Conversation Summary</p>
              {transcripts.map(t => (
                <div key={t.id} className={`mb-1.5 ${t.role === 'user' ? 'text-right' : 'text-left'}`}>
                  <span className={`text-xs font-medium ${t.role === 'user' ? 'text-white/50' : 'text-emerald-400/60'}`}>
                    {t.role === 'user' ? 'You' : 'Agent'}
                  </span>
                  <span className="text-white/40 text-xs ml-1">{t.text}</span>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={resetCall}
            className="w-[76px] h-[76px] rounded-full bg-[#34C759] active:bg-[#2db84e] flex items-center justify-center shadow-lg shadow-[#34C759]/30 transition-all active:scale-95"
            aria-label="Call again"
          >
            <svg width="30" height="30" viewBox="0 0 24 24" fill="white" stroke="none">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
            </svg>
          </button>
          <p className="text-white/30 text-xs mt-3">Call Again</p>
        </div>
      )}

      {/* ─── Global animations (CSS keyframes) ────────────────── */}
      <style jsx global>{`
        @keyframes pulse-ring {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(1.8); opacity: 0; }
        }
        @keyframes dot-bounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
        @keyframes wave-bar {
          0%, 100% { transform: scaleY(0.3); }
          50% { transform: scaleY(1); }
        }
        /* Hide scrollbar */
        .overflow-y-auto::-webkit-scrollbar { width: 0; height: 0; }
        .overflow-y-auto { scrollbar-width: none; }
        /* Prevent pull-to-refresh */
        body { overscroll-behavior-y: contain; }
        /* Safe area padding */
        .safe-top { padding-top: env(safe-area-inset-top, 12px); }
        .safe-bottom { padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 16px); }
      `}</style>
    </div>
  )
}
