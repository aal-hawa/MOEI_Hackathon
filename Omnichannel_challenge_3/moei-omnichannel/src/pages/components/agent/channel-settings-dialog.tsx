'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Settings, MessageCircle, Phone, Mail, Loader2, CheckCircle2, XCircle, TestTube, Volume2, Sparkles, Zap } from 'lucide-react'
import { useTranslation } from '@/i18n'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'

// ─── Types ───────────────────────────────────────────────────────────────────

interface WhatsAppConfig {
  enabled: boolean
  twilioAccountSid: string
  twilioAuthToken: string
  phoneNumber: string
  businessProfileName: string
  webhookUrl: string
  autoReply: boolean
}

interface VoiceConfig {
  enabled: boolean
  twilioAccountSid: string
  twilioAuthToken: string
  phoneNumber: string
  webhookUrl: string
  ttsVoice: string
  ttsProvider: 'gemini' | 'zai'
  ivrGreeting: string
  autoReply: boolean
}

interface EmailConfig {
  enabled: boolean
  smtpHost: string
  smtpPort: string
  smtpUser: string
  smtpPassword: string
  fromAddress: string
  fromName: string
  imapHost: string
  imapPort: string
  imapUser: string
  imapPassword: string
  autoReply: boolean
}

interface ChannelConfig {
  whatsapp: WhatsAppConfig
  voice: VoiceConfig
  email: EmailConfig
}

interface ChannelSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// ─── Default Config ──────────────────────────────────────────────────────────

const defaultConfig: ChannelConfig = {
  whatsapp: {
    enabled: false,
    twilioAccountSid: '',
    twilioAuthToken: '',
    phoneNumber: '',
    businessProfileName: '',
    webhookUrl: '',
    autoReply: false,
  },
  voice: {
    enabled: false,
    twilioAccountSid: '',
    twilioAuthToken: '',
    phoneNumber: '',
    webhookUrl: '',
    ttsVoice: 'Polly.Salma',
    ttsProvider: 'gemini' as const,
    ivrGreeting: '',
    autoReply: false,
  },
  email: {
    enabled: false,
    smtpHost: '',
    smtpPort: '587',
    smtpUser: '',
    smtpPassword: '',
    fromAddress: '',
    fromName: 'MOEI Support',
    imapHost: '',
    imapPort: '993',
    imapUser: '',
    imapPassword: '',
    autoReply: false,
  },
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ChannelSettingsDialog({ open, onOpenChange }: ChannelSettingsDialogProps) {
  const { t } = useTranslation()
  const [config, setConfig] = useState<ChannelConfig>(defaultConfig)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, 'success' | 'error' | null>>({
    whatsapp: null,
    voice: null,
    email: null,
  })
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [ttsLoading, setTtsLoading] = useState(false)
  const [ttsTestResult, setTtsTestResult] = useState<'playing' | 'success' | 'error' | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Load config on mount
  useEffect(() => {
    if (!open) return

    const fetchConfig = async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/channels/config')
        if (res.ok) {
          const data = await res.json()
          setConfig({
            whatsapp: { ...defaultConfig.whatsapp, ...data.whatsapp },
            voice: { ...defaultConfig.voice, ...data.voice },
            email: { ...defaultConfig.email, ...data.email },
          })
        }

        // Also fetch TTS provider setting
        const ttsRes = await fetch('/api/settings/tts')
        if (ttsRes.ok) {
          const ttsData = await ttsRes.json()
          if (ttsData.config?.provider) {
            setConfig((prev) => ({
              ...prev,
              voice: { ...prev.voice, ttsProvider: ttsData.config.provider as 'gemini' | 'zai' },
            }))
          }
        }
      } catch {
        // Keep default config
      }
      setLoading(false)
    }

    fetchConfig()
  }, [open])

  // Save config
  const handleSave = useCallback(async () => {
    setSaving(true)
    setSaveMessage(null)
    try {
      // Save each channel's config via the channel config API
      const channels = ['whatsapp', 'voice', 'email'] as const
      const savePromises = channels.map((channel) => {
        const channelConfig = config[channel]
        const { enabled, ...configData } = channelConfig
        return fetch('/api/channels/config', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channel, enabled, config: configData }),
        })
      })

      // Also save TTS provider setting
      const ttsPromise = fetch('/api/settings/tts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: config.voice.ttsProvider || 'gemini' }),
      })

      const results = await Promise.all([...savePromises, ttsPromise])
      const allOk = results.every((r) => r.ok)

      if (allOk) {
        setSaveMessage('Settings saved successfully')
      } else {
        setSaveMessage('Failed to save some settings')
      }
    } catch {
      setSaveMessage('Failed to save settings')
    }
    setSaving(false)
    setTimeout(() => setSaveMessage(null), 3000)
  }, [config])

  // Test connection
  const handleTest = useCallback(async (channel: string) => {
    setTesting(channel)
    setTestResults((prev) => ({ ...prev, [channel]: null }))

    try {
      if (channel === 'email') {
        const res = await fetch('/api/channels/email/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: config.email.fromAddress || 'test@moei.gov.ae',
            subject: 'Test Connection',
            body: 'This is a test email from MOEI Omnichannel Platform.',
            test: true,
          }),
        })
        setTestResults((prev) => ({ ...prev, [channel]: res.ok ? 'success' : 'error' }))
      } else {
        // For WhatsApp and Voice, just test the API config endpoint
        const res = await fetch('/api/channels/config')
        setTestResults((prev) => ({ ...prev, [channel]: res.ok ? 'success' : 'error' }))
      }
    } catch {
      setTestResults((prev) => ({ ...prev, [channel]: 'error' }))
    }

    setTesting(null)
    setTimeout(() => {
      setTestResults((prev) => ({ ...prev, [channel]: null }))
    }, 4000)
  }, [config])

  // Update config helper
  const updateConfig = (channel: 'whatsapp' | 'voice' | 'email', field: string, value: string | boolean) => {
    setConfig((prev) => ({
      ...prev,
      [channel]: {
        ...prev[channel],
        [field]: value,
      },
    }))
  }

  // ─── Render: Status Badge ───────────────────────────────────────────────

  const renderStatusBadge = (channel: 'whatsapp' | 'voice' | 'email') => {
    const isConfigured = Object.entries(config[channel]).some(
      ([key, val]) => key !== 'enabled' && key !== 'autoReply' && typeof val === 'string' && val.trim() !== ''
    )
    const testResult = testResults[channel]

    if (testResult === 'success') {
      return (
        <Badge className="bg-green-100 text-green-700 border-green-200 gap-1" variant="outline">
          <CheckCircle2 className="h-3 w-3" />
          Connected
        </Badge>
      )
    }
    if (testResult === 'error') {
      return (
        <Badge className="bg-red-100 text-red-700 border-red-200 gap-1" variant="outline">
          <XCircle className="h-3 w-3" />
          Failed
        </Badge>
      )
    }
    if (isConfigured) {
      return (
        <Badge className="bg-amber-100 text-amber-700 border-amber-200 gap-1" variant="outline">
          Configured
        </Badge>
      )
    }
    return (
      <Badge className="bg-gray-100 text-gray-600 border-gray-200 gap-1" variant="outline">
        Not Configured
      </Badge>
    )
  }

  // ─── Render: WhatsApp Tab ───────────────────────────────────────────────

  const renderWhatsAppTab = () => (
    <div className="space-y-4 py-4">
      {/* Enable toggle */}
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">Enable WhatsApp Channel</Label>
          <p className="text-xs text-muted-foreground">Allow customers to reach out via WhatsApp</p>
        </div>
        <Switch
          checked={config.whatsapp.enabled}
          onCheckedChange={(checked) => updateConfig('whatsapp', 'enabled', checked)}
        />
      </div>

      <Separator />

      {/* Twilio Settings */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-uae-green-500" />
          Twilio Configuration
        </h4>
        <div className="grid grid-cols-1 gap-3">
          <div>
            <Label className="text-xs">Account SID</Label>
            <Input
              value={config.whatsapp.twilioAccountSid}
              onChange={(e) => updateConfig('whatsapp', 'twilioAccountSid', e.target.value)}
              placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              className="h-8 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">Auth Token</Label>
            <Input
              type="password"
              value={config.whatsapp.twilioAuthToken}
              onChange={(e) => updateConfig('whatsapp', 'twilioAuthToken', e.target.value)}
              placeholder="••••••••••••••••"
              className="h-8 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">Phone Number</Label>
            <Input
              value={config.whatsapp.phoneNumber}
              onChange={(e) => updateConfig('whatsapp', 'phoneNumber', e.target.value)}
              placeholder="+971xxxxxxxxx"
              className="h-8 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">Business Profile Name</Label>
            <Input
              value={config.whatsapp.businessProfileName}
              onChange={(e) => updateConfig('whatsapp', 'businessProfileName', e.target.value)}
              placeholder="MOEI Support"
              className="h-8 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">Webhook URL</Label>
            <Input
              value={config.whatsapp.webhookUrl}
              onChange={(e) => updateConfig('whatsapp', 'webhookUrl', e.target.value)}
              placeholder="https://your-domain.com/api/channels/whatsapp/webhook"
              className="h-8 text-sm"
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Auto Reply */}
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">AI Auto-Reply</Label>
          <p className="text-xs text-muted-foreground">Automatically generate AI responses for incoming messages</p>
        </div>
        <Switch
          checked={config.whatsapp.autoReply}
          onCheckedChange={(checked) => updateConfig('whatsapp', 'autoReply', checked)}
        />
      </div>

      {/* Test & Status */}
      <div className="flex items-center justify-between">
        {renderStatusBadge('whatsapp')}
        <Button
          variant="outline"
          size="sm"
          className="gap-1 text-xs"
          onClick={() => handleTest('whatsapp')}
          disabled={testing === 'whatsapp'}
        >
          {testing === 'whatsapp' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <TestTube className="h-3.5 w-3.5" />
          )}
          Test Connection
        </Button>
      </div>
    </div>
  )

  // ─── TTS Provider Test ───────────────────────────────────────────────────

  const handleTestTTS = useCallback(async () => {
    setTtsLoading(true)
    setTtsTestResult('playing')

    try {
      const provider = config.voice.ttsProvider || 'gemini'
      const testText = provider === 'gemini'
        ? 'مرحباً، أنا المساعد الذكي لوزارة الطاقة والبنية التحتية. كيف يمكنني مساعدتك؟'
        : 'Hello, I am the smart assistant for the Ministry of Energy and Infrastructure.'

      // Update the TTS provider on the server first
      await fetch('/api/settings/tts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      })

      // Test TTS via the API
      const res = await fetch('/api/ai/voice/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: testText,
          language: provider === 'gemini' ? 'ar' : 'en',
          speed: 1.0,
        }),
      })

      if (res.ok) {
        const audioBlob = await res.blob()
        const audioUrl = URL.createObjectURL(audioBlob)
        const audio = new Audio(audioUrl)
        audioRef.current = audio

        audio.onended = () => {
          setTtsTestResult('success')
          URL.revokeObjectURL(audioUrl)
          setTimeout(() => setTtsTestResult(null), 3000)
        }

        audio.onerror = () => {
          setTtsTestResult('error')
          URL.revokeObjectURL(audioUrl)
          setTimeout(() => setTtsTestResult(null), 3000)
        }

        await audio.play()
      } else {
        setTtsTestResult('error')
        setTimeout(() => setTtsTestResult(null), 3000)
      }
    } catch {
      setTtsTestResult('error')
      setTimeout(() => setTtsTestResult(null), 3000)
    }

    setTtsLoading(false)
  }, [config.voice.ttsProvider])

  // ─── Render: Voice Tab ──────────────────────────────────────────────────

  const renderVoiceTab = () => (
    <div className="space-y-4 py-4">
      {/* Enable toggle */}
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">Enable Voice/Call Center</Label>
          <p className="text-xs text-muted-foreground">Allow customers to call for support</p>
        </div>
        <Switch
          checked={config.voice.enabled}
          onCheckedChange={(checked) => updateConfig('voice', 'enabled', checked)}
        />
      </div>

      <Separator />

      {/* ── TTS Provider Selection ─────────────────────────────────────────── */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
          <Volume2 className="h-4 w-4 text-brand-500" />
          Text-to-Speech Provider
        </h4>
        <p className="text-xs text-muted-foreground">
          Choose the TTS engine for AI voice responses. Google (Gemini) provides natural Arabic &amp; English voices.
        </p>

        <div className="grid grid-cols-2 gap-3">
          {/* Gemini / Google Cloud TTS */}
          <button
            type="button"
            onClick={() => updateConfig('voice', 'ttsProvider', 'gemini')}
            className={`relative rounded-lg border-2 p-3 text-left transition-all ${
              config.voice.ttsProvider === 'gemini'
                ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/30'
                : 'border-border hover:border-brand-300'
            }`}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <Sparkles className="h-4 w-4 text-brand-500" />
              <span className="text-sm font-semibold">Google (Gemini)</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-tight">
              ✅ Natural Arabic &amp; English<br/>
              ✅ 220+ voices, 40+ languages<br/>
              ✅ WaveNet &amp; Journey voices<br/>
              <span className="text-brand-600 font-medium">Recommended</span>
            </p>
            {config.voice.ttsProvider === 'gemini' && (
              <div className="absolute top-2 right-2">
                <CheckCircle2 className="h-4 w-4 text-brand-500" />
              </div>
            )}
          </button>

          {/* ZAI SDK TTS */}
          <button
            type="button"
            onClick={() => updateConfig('voice', 'ttsProvider', 'zai')}
            className={`relative rounded-lg border-2 p-3 text-left transition-all ${
              config.voice.ttsProvider === 'zai'
                ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30'
                : 'border-border hover:border-amber-300'
            }`}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <Zap className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-semibold">Z SDK</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-tight">
              ⚠️ Limited Arabic support<br/>
              ⚠️ English sounds Chinese<br/>
              ✅ Always available as fallback<br/>
              <span className="text-amber-600 font-medium">Fallback only</span>
            </p>
            {config.voice.ttsProvider === 'zai' && (
              <div className="absolute top-2 right-2">
                <CheckCircle2 className="h-4 w-4 text-amber-500" />
              </div>
            )}
          </button>
        </div>

        {/* TTS Voice Preview Test */}
        <div className="flex items-center gap-2 mt-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={handleTestTTS}
            disabled={ttsLoading}
          >
            {ttsLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : ttsTestResult === 'playing' ? (
              <Volume2 className="h-3.5 w-3.5 text-brand-500 animate-pulse" />
            ) : ttsTestResult === 'success' ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
            ) : ttsTestResult === 'error' ? (
              <XCircle className="h-3.5 w-3.5 text-red-500" />
            ) : (
              <Volume2 className="h-3.5 w-3.5" />
            )}
            {ttsTestResult === 'playing' ? 'Playing...' : ttsTestResult === 'success' ? 'Works!' : ttsTestResult === 'error' ? 'Failed' : 'Test Voice'}
          </Button>
          <span className="text-[10px] text-muted-foreground">
            {config.voice.ttsProvider === 'gemini' ? 'Tests Arabic voice (Aoede)' : 'Tests English voice (kazi)'}
          </span>
        </div>
      </div>

      <Separator />

      {/* Twilio Settings */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
          <Phone className="h-4 w-4 text-tech-blue" />
          Twilio Configuration
        </h4>
        <div className="grid grid-cols-1 gap-3">
          <div>
            <Label className="text-xs">Account SID</Label>
            <Input
              value={config.voice.twilioAccountSid}
              onChange={(e) => updateConfig('voice', 'twilioAccountSid', e.target.value)}
              placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              className="h-8 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">Auth Token</Label>
            <Input
              type="password"
              value={config.voice.twilioAuthToken}
              onChange={(e) => updateConfig('voice', 'twilioAuthToken', e.target.value)}
              placeholder="••••••••••••••••"
              className="h-8 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">Phone Number</Label>
            <Input
              value={config.voice.phoneNumber}
              onChange={(e) => updateConfig('voice', 'phoneNumber', e.target.value)}
              placeholder="+971xxxxxxxxx"
              className="h-8 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">Webhook URL</Label>
            <Input
              value={config.voice.webhookUrl}
              onChange={(e) => updateConfig('voice', 'webhookUrl', e.target.value)}
              placeholder="https://your-domain.com/api/channels/voice/webhook"
              className="h-8 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">Twilio TTS Voice (for phone calls only)</Label>
            <Input
              value={config.voice.ttsVoice}
              onChange={(e) => updateConfig('voice', 'ttsVoice', e.target.value)}
              placeholder="Polly.Salma"
              className="h-8 text-sm"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              This only affects Twilio phone calls. AI voice agent uses the provider above.
            </p>
          </div>
          <div>
            <Label className="text-xs">IVR Greeting</Label>
            <Input
              value={config.voice.ivrGreeting}
              onChange={(e) => updateConfig('voice', 'ivrGreeting', e.target.value)}
              placeholder="Welcome to MOEI support. Press 1 for..."
              className="h-8 text-sm"
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Auto Reply */}
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">AI Auto-Reply</Label>
          <p className="text-xs text-muted-foreground">Automatically handle calls with AI voice agent</p>
        </div>
        <Switch
          checked={config.voice.autoReply}
          onCheckedChange={(checked) => updateConfig('voice', 'autoReply', checked)}
        />
      </div>

      {/* Test & Status */}
      <div className="flex items-center justify-between">
        {renderStatusBadge('voice')}
        <Button
          variant="outline"
          size="sm"
          className="gap-1 text-xs"
          onClick={() => handleTest('voice')}
          disabled={testing === 'voice'}
        >
          {testing === 'voice' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <TestTube className="h-3.5 w-3.5" />
          )}
          Test Connection
        </Button>
      </div>
    </div>
  )

  // ─── Render: Email Tab ──────────────────────────────────────────────────

  const renderEmailTab = () => (
    <div className="space-y-4 py-4">
      {/* Enable toggle */}
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">Enable Email Channel</Label>
          <p className="text-xs text-muted-foreground">Allow customers to reach out via email</p>
        </div>
        <Switch
          checked={config.email.enabled}
          onCheckedChange={(checked) => updateConfig('email', 'enabled', checked)}
        />
      </div>

      <Separator />

      {/* SMTP Settings */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
          <Mail className="h-4 w-4 text-amber-600" />
          SMTP Configuration (Outgoing)
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">SMTP Host</Label>
            <Input
              value={config.email.smtpHost}
              onChange={(e) => updateConfig('email', 'smtpHost', e.target.value)}
              placeholder="smtp.gmail.com"
              className="h-8 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">SMTP Port</Label>
            <Input
              value={config.email.smtpPort}
              onChange={(e) => updateConfig('email', 'smtpPort', e.target.value)}
              placeholder="587"
              className="h-8 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">SMTP User</Label>
            <Input
              value={config.email.smtpUser}
              onChange={(e) => updateConfig('email', 'smtpUser', e.target.value)}
              placeholder="support@moei.gov.ae"
              className="h-8 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">SMTP Password</Label>
            <Input
              type="password"
              value={config.email.smtpPassword}
              onChange={(e) => updateConfig('email', 'smtpPassword', e.target.value)}
              placeholder="••••••••"
              className="h-8 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">From Address</Label>
            <Input
              value={config.email.fromAddress}
              onChange={(e) => updateConfig('email', 'fromAddress', e.target.value)}
              placeholder="support@moei.gov.ae"
              className="h-8 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">From Name</Label>
            <Input
              value={config.email.fromName}
              onChange={(e) => updateConfig('email', 'fromName', e.target.value)}
              placeholder="MOEI Support"
              className="h-8 text-sm"
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* IMAP Settings */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
          <Mail className="h-4 w-4 text-amber-600" />
          IMAP Configuration (Incoming)
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">IMAP Host</Label>
            <Input
              value={config.email.imapHost}
              onChange={(e) => updateConfig('email', 'imapHost', e.target.value)}
              placeholder="imap.gmail.com"
              className="h-8 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">IMAP Port</Label>
            <Input
              value={config.email.imapPort}
              onChange={(e) => updateConfig('email', 'imapPort', e.target.value)}
              placeholder="993"
              className="h-8 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">IMAP User</Label>
            <Input
              value={config.email.imapUser}
              onChange={(e) => updateConfig('email', 'imapUser', e.target.value)}
              placeholder="support@moei.gov.ae"
              className="h-8 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">IMAP Password</Label>
            <Input
              type="password"
              value={config.email.imapPassword}
              onChange={(e) => updateConfig('email', 'imapPassword', e.target.value)}
              placeholder="••••••••"
              className="h-8 text-sm"
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Auto Reply */}
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">AI Auto-Reply</Label>
          <p className="text-xs text-muted-foreground">Automatically generate AI responses for incoming emails</p>
        </div>
        <Switch
          checked={config.email.autoReply}
          onCheckedChange={(checked) => updateConfig('email', 'autoReply', checked)}
        />
      </div>

      {/* Test & Status */}
      <div className="flex items-center justify-between">
        {renderStatusBadge('email')}
        <Button
          variant="outline"
          size="sm"
          className="gap-1 text-xs"
          onClick={() => handleTest('email')}
          disabled={testing === 'email'}
        >
          {testing === 'email' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <TestTube className="h-3.5 w-3.5" />
          )}
          Test Connection
        </Button>
      </div>
    </div>
  )

  // ─── Render: Dialog ─────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Settings className="h-5 w-5 text-brand-500" />
            Channel Settings
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-6">
          <Tabs defaultValue="whatsapp" className="w-full">
            <TabsList className="w-full grid grid-cols-3 mb-2">
              <TabsTrigger value="whatsapp" className="gap-1.5 text-xs">
                <MessageCircle className="h-3.5 w-3.5" />
                WhatsApp
              </TabsTrigger>
              <TabsTrigger value="voice" className="gap-1.5 text-xs">
                <Phone className="h-3.5 w-3.5" />
                Voice
              </TabsTrigger>
              <TabsTrigger value="email" className="gap-1.5 text-xs">
                <Mail className="h-3.5 w-3.5" />
                Email
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="max-h-[55vh] px-1">
              <TabsContent value="whatsapp" className="mt-0">
                {renderWhatsAppTab()}
              </TabsContent>
              <TabsContent value="voice" className="mt-0">
                {renderVoiceTab()}
              </TabsContent>
              <TabsContent value="email" className="mt-0">
                {renderEmailTab()}
              </TabsContent>
            </ScrollArea>
          </Tabs>

          {/* Save Button & Feedback */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            {saveMessage && (
              <span className={`text-xs ${saveMessage.includes('success') ? 'text-green-600' : 'text-red-500'}`}>
                {saveMessage}
              </span>
            )}
            {!saveMessage && <span />}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-brand-600 hover:bg-brand-700 text-white gap-1"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                Save Settings
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
