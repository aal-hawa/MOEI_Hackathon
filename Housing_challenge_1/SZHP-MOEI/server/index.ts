/**
 * Standalone Hono server for local development
 * Replaces wrangler dev — runs the Worker API on port 3001
 * Uses better-sqlite3 for local SQLite database (Node.js compatible)
 *
 * Converted from mini-services/worker-service/index.ts which uses bun:sqlite.
 * This version works with standard Node.js — no Bun runtime required.
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serve } from '@hono/node-server'
import Database from 'better-sqlite3'
import { readFileSync, mkdirSync, writeFileSync, existsSync, unlinkSync, statSync, readdirSync } from 'fs'
import { basename, join } from 'path'
import { execFileSync, execSync } from 'child_process'
import { createHash, createHmac, timingSafeEqual } from 'crypto'
// z-ai-web-dev-sdk removed — using direct fetch via shared ai-client module
import mammoth from 'mammoth'
import * as XLSX from 'xlsx'

const localEnvPath = join(process.cwd(), '.env')
try {
  if (existsSync(localEnvPath)) {
    process.loadEnvFile?.(localEnvPath)
    console.log('✅ Local .env loaded')
  }
} catch (err: any) {
  console.warn('⚠️ Could not load local .env:', err.message)
}

// ── Shared Module Imports ───────────────────────────────────────────
// Utilities: generateId, maskApiKey, safeJsonParse, toNum
import { generateId, maskApiKey, safeJsonParse, toNum } from '../src/worker/lib/utils'

// Auth: hashPassword, verifyPassword, generateAccessToken, hasPermission, getDefaultPermissions, ROLE_PERMISSIONS
import {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  hasPermission,
  getDefaultPermissions,
  ROLE_PERMISSIONS,
} from '../src/worker/middleware/auth'

// AI Client: chatCompletion, visionCompletion, detectProvider, isUrlSafeForServerSideRequest, testConnection
import {
  chatCompletion,
  visionCompletion,
  detectProvider,
  isUrlSafeForServerSideRequest,
  testConnection as aiTestConnection,
} from '../src/worker/lib/ai-client'

// Types (type-only imports are erased at runtime)
import type { AIProviderConfig, ChatMessage } from '../src/worker/types'

const PORT = 3001
const OFFICER_CALL_AUDIO_TEXTS = new Map<string, { text: string; language: 'ar' | 'en'; createdAt: number }>()

function normalizeConfidence(value: unknown, fallback = 70): number {
  const numeric = typeof value === 'number' ? value : fallback
  const percentage = numeric > 0 && numeric <= 1 ? numeric * 100 : numeric
  return Math.max(1, Math.min(100, Math.round(percentage)))
}

// ── Initialize SQLite Database ──────────────────────────────────────
const DB_PATH = join(process.cwd(), 'data', 'szhp.db')

// Auto-create data directory
mkdirSync(join(process.cwd(), 'data'), { recursive: true })

const db = new Database(DB_PATH)

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL')

// Create tables if they don't exist
const schemaPath = join(process.cwd(), 'src', 'worker', 'db', 'schema.sql')
try {
  const schema = readFileSync(schemaPath, 'utf-8')
  db.exec(schema)
  console.log('✅ Database schema initialized')
} catch (err: any) {
  console.warn('⚠️ Schema init error (tables may already exist):', err.message)
}

// Auto-seed default data on first run
const seedPath = join(process.cwd(), 'src', 'worker', 'db', 'seed.sql')
try {
  // Check if already seeded (look for the superadmin user)
  const existingAdmin = db.prepare("SELECT id FROM User WHERE email = 'admin@szhp.gov.ae'").get()
  if (!existingAdmin) {
    const seed = readFileSync(seedPath, 'utf-8')
    db.exec(seed)
    console.log('✅ Database seeded with default data')
  } else {
    console.log('ℹ️ Database already seeded, skipping seed')
  }
} catch (err: any) {
  console.warn('⚠️ Seed init error:', err.message)
}

// ── Helper: Query wrappers (better-sqlite3 — synchronous) ──────────
function query(sql: string, params: any[] = []) {
  try {
    const stmt = db.prepare(sql)
    if (sql.trim().toUpperCase().startsWith('SELECT')) {
      return { results: stmt.all(...params), success: true }
    } else {
      const info = stmt.run(...params)
      return { results: [], success: true, meta: { changes: info.changes } }
    }
  } catch (err: any) {
    return { results: [], success: false, error: err.message }
  }
}

function queryFirst(sql: string, params: any[] = []) {
  try {
    return db.prepare(sql).get(...params)
  } catch {
    return null
  }
}

function queryRun(sql: string, params: any[] = []) {
  try {
    const info = db.prepare(sql).run(...params)
    return { changes: info.changes }
  } catch (err: any) {
    console.error('❌ DB run error:', err.message, '| SQL:', sql.substring(0, 100), '| Params count:', params.length, '| First 3 params:', params.slice(0, 3))
    return null
  }
}

// ── Config Helpers (local, using better-sqlite3 instead of D1+KV) ──
// These mirror src/worker/lib/config.ts but read directly from SQLite
// instead of going through DbClient + KV cache.

const CONFIG_CACHE_KEY = 'szhp:local_config'
let configCache: Record<string, string> | null = null
let configCacheExpiry = 0
const CONFIG_CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

function loadConfigs(): Record<string, string> {
  const now = Date.now()
  if (configCache && now < configCacheExpiry) return configCache

  try {
    const rows = query('SELECT configKey, configValue FROM SystemConfig WHERE isActive = 1').results as any[]
    const configs: Record<string, string> = {}
    for (const row of rows) {
      configs[row.configKey] = row.configValue
    }
    configCache = configs
    configCacheExpiry = now + CONFIG_CACHE_TTL_MS
    return configs
  } catch {
    return configCache || {}
  }
}

function invalidateConfigCache() {
  configCache = null
  configCacheExpiry = 0
}

function getConfigNumber(key: string, fallback: number): number {
  const configs = loadConfigs()
  const value = configs[key]
  if (value === undefined) return fallback
  const num = parseFloat(value)
  return isNaN(num) ? fallback : num
}

function getConfigString(key: string, fallback: string): string {
  const configs = loadConfigs()
  return configs[key] ?? fallback
}

function getConfigBoolean(key: string, fallback: boolean): boolean {
  const configs = loadConfigs()
  const value = configs[key]
  if (value === undefined) return fallback
  return value === 'true'
}

// ── Auth Helpers (using shared auth module) ─────────────────────────
// verifyAuth still needs local DB access (better-sqlite3), but password
// hashing/verification uses the shared module.

async function verifyAuth(token: string) {
  if (!token) return { authenticated: false, error: 'No token' }

  const row = queryFirst(`
    SELECT s.*, u.id as userId, u.email, u.role, u.permissions, u.isActive, u.lockedUntil
    FROM Session s JOIN User u ON s.userId = u.id
    WHERE s.accessToken = ?
  `, [token]) as any

  if (!row) return { authenticated: false, error: 'Invalid session token' }
  if (new Date(row.expiresAt) < new Date()) return { authenticated: false, error: 'Session expired' }
  if (!row.isActive) return { authenticated: false, error: 'Account deactivated' }
  if (row.lockedUntil && new Date(row.lockedUntil) > new Date()) return { authenticated: false, error: 'Account locked' }

  return {
    authenticated: true,
    user: {
      id: row.userId,
      email: row.email,
      role: row.role,
      permissions: safeJsonParse(row.permissions, []),
      isActive: !!row.isActive,
    },
    session: { id: row.id, authMode: row.authMode, expiresAt: row.expiresAt },
  }
}

function extractToken(c: any): string | null {
  const authHeader = c.req.header('Authorization')
  return authHeader?.replace('Bearer ', '') || null
}

function normalizeE164Phone(value: unknown): string | null {
  const phone = String(value || '').replace(/[\s()-]/g, '').trim()
  return /^\+\d{8,15}$/.test(phone) ? phone : null
}

function normalizeUaePhone(value: unknown): string | null {
  const raw = String(value || '').replace(/[\s()-]/g, '').trim()
  if (raw.startsWith('+')) return normalizeE164Phone(raw)
  if (/^0\d{8,9}$/.test(raw)) return normalizeE164Phone(`+971${raw.slice(1)}`)
  return null
}

function configuredEnv(value: string | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed || trimmed.startsWith('PASTE_')) return null
  return trimmed
}

type OfficerDecisionAction = 'approve' | 'reject' | 'escalate'
type CallAudioKind = 'brief' | 'decision_prompt' | 'beneficiary_notification'

function parseOfficerDecisionCommand(command: unknown): OfficerDecisionAction | null {
  const normalized = String(command || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!normalized) return null
  if (normalized === '1') return 'approve'
  if (normalized === '2') return 'reject'
  if (normalized === '3') return 'escalate'

  const approveWords = ['accept', 'accepted', 'approve', 'approved', 'yes', 'ok', 'confirm', 'اعتمد', 'اعتماد', 'اقبل', 'قبول', 'موافق', 'نعم', 'ايه', 'تمام']
  const rejectWords = ['reject', 'rejected', 'decline', 'declined', 'no', 'deny', 'denied', 'ارفض', 'رفض', 'مرفوض', 'لا', 'كلا']
  const escalateWords = ['escalate', 'review', 'human', 'officer review', 'refer', 'refer to officer', 'احالة', 'إحالة', 'لموظف', 'حول', 'حو ل', 'مراجعة']

  if (approveWords.some((word) => normalized.includes(word.toLowerCase()))) return 'approve'
  if (rejectWords.some((word) => normalized.includes(word.toLowerCase()))) return 'reject'
  if (escalateWords.some((word) => normalized.includes(word.toLowerCase()))) return 'escalate'
  return null
}

function statusForOfficerDecision(action: OfficerDecisionAction): 'approved' | 'rejected' | 'escalated' {
  if (action === 'approve') return 'approved'
  if (action === 'reject') return 'rejected'
  return 'escalated'
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function getTwilioWebhookSecret(): string | null {
  return configuredEnv(process.env.TWILIO_WEBHOOK_SECRET) || configuredEnv(process.env.TWILIO_AUTH_TOKEN)
}

function getElevenLabsConfig() {
  const enabled = String(process.env.ELEVENLABS_ENABLED || '').trim().toLowerCase()
  if (!['1', 'true', 'yes', 'on'].includes(enabled)) return null

  const apiKey = configuredEnv(process.env.ELEVENLABS_API_KEY)
  const voiceId = configuredEnv(process.env.ELEVENLABS_VOICE_ID)
  if (!apiKey || !voiceId) return null
  return {
    apiKey,
    voiceId,
    modelId: configuredEnv(process.env.ELEVENLABS_MODEL_ID) || 'eleven_multilingual_v2',
    outputFormat: configuredEnv(process.env.ELEVENLABS_OUTPUT_FORMAT) || 'mp3_44100_128',
  }
}

function signOfficerCallWebhook(requestId: string, language: 'ar' | 'en') {
  const secret = getTwilioWebhookSecret()
  if (!secret) return null
  return createHmac('sha256', secret).update(`${requestId}:${language}`).digest('hex')
}

function verifyOfficerCallWebhook(requestId: string, language: 'ar' | 'en', signature: string | null): boolean {
  const expected = signOfficerCallWebhook(requestId, language)
  if (!expected || !signature) return false
  const expectedBuffer = Buffer.from(expected, 'hex')
  const signatureBuffer = Buffer.from(signature, 'hex')
  return expectedBuffer.length === signatureBuffer.length && timingSafeEqual(expectedBuffer, signatureBuffer)
}

function buildOfficerDecisionWebhookUrl(requestId: string | null | undefined, language: 'ar' | 'en'): string | null {
  const baseUrl = configuredEnv(process.env.TWILIO_WEBHOOK_BASE_URL) || configuredEnv(process.env.PUBLIC_API_BASE_URL)
  if (!baseUrl || !requestId) return null

  try {
    const url = new URL('/api/officer-call/decision', baseUrl)
    const signature = signOfficerCallWebhook(requestId, language)
    if (!signature) return null
    url.searchParams.set('requestId', requestId)
    url.searchParams.set('lang', language)
    url.searchParams.set('sig', signature)
    return url.toString()
  } catch {
    return null
  }
}

function officerCallAudioKey(requestId: string, language: 'ar' | 'en', kind: string) {
  return `${requestId}:${language}:${kind}`
}

function buildOfficerCallAudioUrl(requestId: string | null | undefined, language: 'ar' | 'en', kind: CallAudioKind): string | null {
  const baseUrl = configuredEnv(process.env.TWILIO_WEBHOOK_BASE_URL) || configuredEnv(process.env.PUBLIC_API_BASE_URL)
  const elevenLabsConfig = getElevenLabsConfig()
  if (!baseUrl || !requestId || !elevenLabsConfig) return null

  try {
    const url = new URL('/api/officer-call/audio', baseUrl)
    const signature = signOfficerCallWebhook(requestId, language)
    if (!signature) return null
    url.searchParams.set('requestId', requestId)
    url.searchParams.set('lang', language)
    url.searchParams.set('kind', kind)
    url.searchParams.set('sig', signature)
    return url.toString()
  } catch {
    return null
  }
}

async function generateElevenLabsSpeech(text: string, language: 'ar' | 'en'): Promise<Buffer> {
  const config = getElevenLabsConfig()
  if (!config) throw new Error('ElevenLabs credentials are not configured.')

  const cacheDir = join(process.cwd(), 'data', 'call-audio-cache')
  mkdirSync(cacheDir, { recursive: true })
  const cacheKey = createHash('sha256')
    .update(`${config.voiceId}:${config.modelId}:${config.outputFormat}:${language}:${text}`)
    .digest('hex')
  const cachePath = join(cacheDir, `${cacheKey}.mp3`)
  if (existsSync(cachePath)) return readFileSync(cachePath)

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(config.voiceId)}?output_format=${encodeURIComponent(config.outputFormat)}`, {
    method: 'POST',
    headers: {
      'xi-api-key': config.apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      model_id: config.modelId,
      voice_settings: {
        stability: Number(process.env.ELEVENLABS_STABILITY || 0.42),
        similarity_boost: Number(process.env.ELEVENLABS_SIMILARITY_BOOST || 0.82),
        style: Number(process.env.ELEVENLABS_STYLE || 0.35),
        use_speaker_boost: true,
      },
    }),
  })

  if (!response.ok) {
    const message = await response.text().catch(() => '')
    throw new Error(`ElevenLabs TTS failed: ${response.status} ${message.slice(0, 160)}`)
  }

  const audio = Buffer.from(await response.arrayBuffer())
  writeFileSync(cachePath, audio)
  return audio
}

function twimlSay(text: string, language: 'ar' | 'en'): string {
  const voiceLanguage = language === 'ar' ? 'ar-AE' : 'en-US'
  const voiceName = language === 'ar'
    ? (process.env.TWILIO_AR_VOICE?.trim() || 'Polly.Hala-Neural')
    : process.env.TWILIO_EN_VOICE?.trim()
  const voiceAttribute = voiceName ? ` voice="${escapeXml(voiceName)}"` : ''
  return `<Say language="${voiceLanguage}"${voiceAttribute}>${escapeXml(text)}</Say>`
}

function formatAedForCall(value: unknown, language: 'ar' | 'en'): string {
  const amount = Math.round(Number(value || 0)).toLocaleString('en-US')
  return language === 'ar' ? `${amount} درهم` : `AED ${amount}`
}

function getCitizenFirstName(applicant: any, language: 'ar' | 'en'): string {
  const name = language === 'ar'
    ? String(applicant?.nameAr || applicant?.nameEn || '').trim()
    : String(applicant?.nameEn || applicant?.nameAr || '').trim()
  return name.split(/\s+/).filter(Boolean)[0] || (language === 'ar' ? 'المتعامل' : 'customer')
}

function buildBeneficiaryNotificationMessage(options: {
  request: any
  applicant: any
  assessment: any
  language: 'ar' | 'en'
  rejectionReason?: string
}): string {
  const { request, applicant, assessment, language } = options
  const firstName = getCitizenFirstName(applicant, language)
  const status = String(request?.status || '')
  const amount = formatAedForCall(assessment?.recommendedAmount, language)
  const installment = formatAedForCall(assessment?.recommendedInstallment, language)
  const duration = Number(assessment?.recommendedDuration || 0)
  const reason = String(options.rejectionReason || assessment?.humanReviewReason || assessment?.moeiReasoning || 'The application did not meet one or more approved governance rules.').slice(0, 320)

  if (language === 'ar') {
    if (status === 'approved') {
      return `هلا ${firstName}، وياك التوأم الرقمي من برنامج الشيخ زايد للإسكان. نبلغك أن طلب إعادة جدولة المتأخرات تمت الموافقة عليه. الخطة المعتمدة هي ${amount} لمدة ${duration} شهر، والقسط الشهري ${installment}. بتوصلك التفاصيل الرسمية عبر قنوات الوزارة.`
    }
    if (status === 'rejected') {
      return `هلا ${firstName}، وياك التوأم الرقمي من برنامج الشيخ زايد للإسكان. نعتذر، تعذر اعتماد طلب إعادة جدولة المتأخرات حاليا. السبب: ${reason}. تقدر تراجع التفاصيل في قنوات الوزارة أو تستكمل المتطلبات المطلوبة.`
    }
    return `هلا ${firstName}، وياك التوأم الرقمي من برنامج الشيخ زايد للإسكان. تم تحويل طلب إعادة جدولة المتأخرات لموظف مختص للمراجعة. بتوصلك التفاصيل الرسمية عبر قنوات الوزارة.`
  }

  if (status === 'approved') {
    return `Hello ${firstName}. This is the Sheikh Zayed Housing Programme Decision Twin. Your housing arrears rescheduling request has been approved. The approved plan is ${amount} over ${duration} months, with a monthly installment of ${installment}. Official details will be shared through ministry channels.`
  }
  if (status === 'rejected') {
    return `Hello ${firstName}. This is the Sheikh Zayed Housing Programme Decision Twin. Your housing arrears rescheduling request could not be approved at this time. Reason: ${reason}. Please review the ministry channels for the required next steps.`
  }
  return `Hello ${firstName}. This is the Sheikh Zayed Housing Programme Decision Twin. Your housing arrears rescheduling request has been referred to a specialist officer for review. Official details will be shared through ministry channels.`
}

function buildBeneficiaryCallTwiml(message: string, language: 'ar' | 'en', requestId: string): string {
  const audioUrl = buildOfficerCallAudioUrl(requestId, language, 'beneficiary_notification')
  if (audioUrl) {
    OFFICER_CALL_AUDIO_TEXTS.set(officerCallAudioKey(requestId, language, 'beneficiary_notification'), {
      text: message.slice(0, 1300),
      language,
      createdAt: Date.now(),
    })
  }

  return [
    '<Response>',
    audioUrl ? `<Play>${escapeXml(audioUrl)}</Play>` : twimlSay(message.slice(0, 1300), language),
    '</Response>',
  ].join('')
}

function buildOfficerCallTwiml(brief: string, language: 'ar' | 'en', requestId?: string | null): string {
  const fallbackBrief = language === 'ar'
    ? 'هلا، وياك التوأم الرقمي لوزارة الطاقة والبنية التحتية. عندنا حالة إعادة جدولة متأخرات سكنية جاهزة، ونحتاج قرارك: نعم، لا، أو إحالة لموظف.'
    : 'Hello. This is the MOEI Decision Twin calling about a housing arrears rescheduling case ready for officer review.'
  const voiceBrief = (brief || fallbackBrief).slice(0, 1400)
  const voiceLanguage = language === 'ar' ? 'ar-AE' : 'en-US'
  const decisionWebhookUrl = buildOfficerDecisionWebhookUrl(requestId, language)
  const decisionPrompt = language === 'ar'
    ? 'بعد الملخص، قل نعم للاعتماد، قل لا للرفض، أو قل إحالة لموظف. تقدر بعد تضغط 1 للاعتماد، 2 للرفض، أو 3 للإحالة.'
    : 'After the brief, say yes to approve, say no to reject, or say escalate to officer. You can also press 1 to approve, 2 to reject, or 3 to escalate.'
  const briefAudioUrl = buildOfficerCallAudioUrl(requestId, language, 'brief')
  const promptAudioUrl = buildOfficerCallAudioUrl(requestId, language, 'decision_prompt')

  if (requestId && briefAudioUrl && promptAudioUrl) {
    OFFICER_CALL_AUDIO_TEXTS.set(officerCallAudioKey(requestId, language, 'brief'), {
      text: voiceBrief,
      language,
      createdAt: Date.now(),
    })
    OFFICER_CALL_AUDIO_TEXTS.set(officerCallAudioKey(requestId, language, 'decision_prompt'), {
      text: decisionPrompt,
      language,
      createdAt: Date.now(),
    })
  }

  if (decisionWebhookUrl) {
    return [
      '<Response>',
      `<Gather input="speech dtmf" action="${escapeXml(decisionWebhookUrl)}" method="POST" language="${voiceLanguage}" speechTimeout="auto" timeout="8" numDigits="1">`,
      briefAudioUrl ? `<Play>${escapeXml(briefAudioUrl)}</Play>` : twimlSay(voiceBrief, language),
      '<Pause length="1"/>',
      promptAudioUrl ? `<Play>${escapeXml(promptAudioUrl)}</Play>` : twimlSay(decisionPrompt, language),
      '</Gather>',
      twimlSay(language === 'ar'
        ? 'ما وصلني قرار واضح. الرجاء الرجوع إلى شاشة الوزارة لتثبيت القرار.'
        : 'I did not receive a clear decision. Please return to the MOEI console to bind the decision.', language),
      '</Response>',
    ].join('')
  }

  return [
    '<Response>',
    briefAudioUrl ? `<Play>${escapeXml(briefAudioUrl)}</Play>` : twimlSay(voiceBrief, language),
    '<Pause length="1"/>',
    twimlSay(language === 'ar'
      ? 'تم تشغيل الاتصال الحقيقي، لكن التقاط القرار من المكالمة يحتاج رابط ويب هوك عام. الرجاء الرجوع إلى شاشة الوزارة وتثبيت القرار: نعم، لا، أو إحالة لموظف.'
      : 'The real call is active, but capturing the decision from the phone requires a public webhook URL. Please return to the MOEI console to bind approve, reject, or escalate.', language),
    '</Response>',
  ].join('')
}

async function placeTwilioOfficerCall(options: {
  to: string
  brief: string
  language: 'ar' | 'en'
  requestId?: string | null
}) {
  const accountSid = configuredEnv(process.env.TWILIO_ACCOUNT_SID)
  const authToken = configuredEnv(process.env.TWILIO_AUTH_TOKEN)
  const fromNumber = normalizeE164Phone(configuredEnv(process.env.TWILIO_FROM_NUMBER))
  const twimlUrl = process.env.TWILIO_TWIML_URL?.trim()
  const statusCallback = process.env.TWILIO_STATUS_CALLBACK_URL?.trim()
  const missingConfig = [
    !accountSid && 'TWILIO_ACCOUNT_SID',
    !authToken && 'TWILIO_AUTH_TOKEN',
    !fromNumber && 'TWILIO_FROM_NUMBER',
  ].filter(Boolean) as string[]

  if (missingConfig.length > 0) {
    return {
      ok: false,
      mode: 'demo' as const,
      provider: 'browser_demo' as const,
      missingConfig,
      message: 'Real carrier call was not placed because telephony credentials are not configured.',
    }
  }

  const form = new URLSearchParams()
  const decisionWebhookUrl = buildOfficerDecisionWebhookUrl(options.requestId, options.language)
  const elevenLabsVoiceEnabled = Boolean(buildOfficerCallAudioUrl(options.requestId, options.language, 'brief'))
  form.set('To', options.to)
  if (fromNumber) form.set('From', fromNumber)
  if (twimlUrl) {
    form.set('Url', twimlUrl)
  } else {
    form.set('Twiml', buildOfficerCallTwiml(options.brief, options.language, options.requestId))
  }
  if (statusCallback) {
    form.set('StatusCallback', statusCallback)
    form.set('StatusCallbackEvent', 'initiated ringing answered completed')
  }

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid!)}/Calls.json`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form,
  })
  const data = await response.json().catch(() => ({})) as Record<string, any>

  if (!response.ok) {
    return {
      ok: false,
      mode: 'demo' as const,
      provider: 'twilio' as const,
      status: response.status,
      error: data.message || data.error_message || 'Twilio call request failed.',
      message: 'Telephony provider returned an error; continuing with the browser demo fallback.',
    }
  }

  return {
    ok: true,
    mode: 'real' as const,
    provider: 'twilio' as const,
    callSid: data.sid,
    callStatus: data.status,
    voiceProvider: elevenLabsVoiceEnabled ? 'elevenlabs' : 'twilio_say',
    decisionCapture: {
      enabled: Boolean(decisionWebhookUrl && !twimlUrl),
      requiresPublicWebhook: !decisionWebhookUrl || Boolean(twimlUrl),
    },
    message: 'Real carrier call accepted by Twilio.',
  }
}

async function placeTwilioBeneficiaryCall(options: {
  to: string
  message: string
  language: 'ar' | 'en'
  requestId: string
}) {
  const accountSid = configuredEnv(process.env.TWILIO_ACCOUNT_SID)
  const authToken = configuredEnv(process.env.TWILIO_AUTH_TOKEN)
  const fromNumber = normalizeE164Phone(configuredEnv(process.env.TWILIO_FROM_NUMBER))
  const missingConfig = [
    !accountSid && 'TWILIO_ACCOUNT_SID',
    !authToken && 'TWILIO_AUTH_TOKEN',
    !fromNumber && 'TWILIO_FROM_NUMBER',
  ].filter(Boolean) as string[]

  if (missingConfig.length > 0) {
    return {
      ok: false,
      mode: 'demo' as const,
      provider: 'browser_demo' as const,
      missingConfig,
      message: 'Beneficiary notification call was not placed because telephony credentials are not configured.',
    }
  }

  const voiceProvider = buildOfficerCallAudioUrl(options.requestId, options.language, 'beneficiary_notification')
    ? 'elevenlabs'
    : 'twilio_say'
  const form = new URLSearchParams()
  form.set('To', options.to)
  form.set('From', fromNumber!)
  form.set('Twiml', buildBeneficiaryCallTwiml(options.message, options.language, options.requestId))

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid!)}/Calls.json`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form,
  })
  const data = await response.json().catch(() => ({})) as Record<string, any>

  if (!response.ok) {
    return {
      ok: false,
      mode: 'demo' as const,
      provider: 'twilio' as const,
      status: response.status,
      error: data.message || data.error_message || 'Twilio beneficiary call request failed.',
      message: 'Telephony provider returned an error; continuing with the browser demo fallback.',
    }
  }

  return {
    ok: true,
    mode: 'real' as const,
    provider: 'twilio' as const,
    callSid: data.sid,
    callStatus: data.status,
    voiceProvider,
    message: 'Beneficiary notification call accepted by Twilio.',
  }
}

// ── AI Helper (using shared ai-client module) ───────────────────────
// Get active model from local SQLite, then use shared chatCompletion
function getActiveModel(type: 'llm' | 'vlm' = 'llm'): AIProviderConfig | null {
  try {
    const configKey = type === 'llm' ? 'default_llm_id' : 'default_vlm_id'
    const targetModelId = getConfigString(configKey, '')

    let model: any = null
    if (targetModelId) {
      model = queryFirst('SELECT * FROM AIModelConfig WHERE id = ?', [targetModelId])
    }
    if (!model) {
      model = queryFirst('SELECT * FROM AIModelConfig WHERE isActive = 1 AND isDefault = 1')
    }
    if (!model) {
      model = queryFirst('SELECT * FROM AIModelConfig WHERE isActive = 1 LIMIT 1')
    }

    if (model) {
      return {
        id: model.id,
        provider: detectProvider(model.baseUrl) as AIProviderConfig['provider'],
        modelId: model.modelId,
        baseUrl: model.baseUrl,
        apiKey: model.apiKey || '',
        maxTokens: model.maxTokens || 4096,
        temperature: model.temperature || 0.7,
        isActive: !!model.isActive,
        isDefault: !!model.isDefault,
        capabilities: safeJsonParse(model.capabilities, []),
        zaiToken: process.env.Z_AI_TOKEN || undefined,
        zaiUserId: process.env.Z_AI_USER_ID || undefined,
        zaiChatId: process.env.Z_AI_CHAT_ID || undefined,
      }
    }
  } catch (err) {
    console.warn('Could not load AI model config from DB:', err)
  }
  return null
}

function getDefaultAIConfig(): AIProviderConfig {
  return {
    provider: 'recentech',
    modelId: 'glm-4-flash',
    baseUrl: process.env.RECENTECH_BASE_URL || 'https://recentech-ai-worker.42abudhabi424242.workers.dev/v1',
    apiKey: process.env.RECENTECH_API_KEY || 'rk_378538813a1da63282dbc24382a55cc8',
    maxTokens: 4096,
    temperature: 0.7,
    isActive: true,
    isDefault: true,
    capabilities: ['chat', 'vision'],
    zaiToken: process.env.Z_AI_TOKEN || undefined,
    zaiUserId: process.env.Z_AI_USER_ID || undefined,
    zaiChatId: process.env.Z_AI_CHAT_ID || undefined,
  }
}

function resolveAIConfig(): AIProviderConfig {
  return getActiveModel() || getDefaultAIConfig()
}

function resolveVLMConfig(): AIProviderConfig {
  return getActiveModel('vlm') || resolveAIConfig()
}

// Helper: Convert PDF pages to JPEG images using pdftoppm (poppler-utils)
// Returns an array of base64 data URLs (one per page) suitable for VLM analysis
function convertPdfToImageDataUrls(pdfFilePath: string, maxPages: number = 3): string[] {
  try {
    const tmpDir = join(process.cwd(), 'uploads', '_tmp_pdf')
    mkdirSync(tmpDir, { recursive: true })

    // Use pdftoppm to convert PDF pages to JPEG images
    // -jpeg: output as JPEG
    // -r 150: 150 DPI resolution (good balance of quality vs size)
    // -l N: limit to first N pages
    const prefix = join(tmpDir, `pdf_${Date.now()}`)
    const cmd = `pdftoppm -jpeg -r 150 -l ${maxPages} "${pdfFilePath}" "${prefix}"`
    execSync(cmd, { timeout: 30000 })

    // Read the generated JPEG files
    const imageUrls: string[] = []
    const files = readdirSync(tmpDir)
      .filter(f => f.startsWith(`pdf_`) && f.endsWith('.jpg'))
      .sort()

    for (const file of files.slice(0, maxPages)) {
      const imgPath = join(tmpDir, file)
      const imgBuffer = readFileSync(imgPath)
      const b64 = imgBuffer.toString('base64')
      imageUrls.push(`data:image/jpeg;base64,${b64}`)
      // Clean up temp file
      try { unlinkSync(imgPath) } catch {}
    }

    if (imageUrls.length === 0) {
      console.warn('⚠️ pdftoppm produced no images for PDF:', pdfFilePath)
    }

    return imageUrls
  } catch (err: any) {
    console.warn('⚠️ PDF to image conversion failed:', err?.message || err)
    return []
  }
}

// Helper: Read an uploaded file from disk and return a base64 data URL for VLM
// For PDFs: converts to JPEG images first (since RecenteTech Vision API doesn't support PDF data URLs)
// For images: returns the image data URL directly
function readFileAsDataUrl(fileName: string): { dataUrl: string; mimeType: string; filePath: string } | null {
  if (!fileName) return null
  const uploadDir = join(process.cwd(), 'uploads')
  const filePath = join(uploadDir, fileName)
  if (!existsSync(filePath)) return null

  try {
    const ext = fileName.toLowerCase().split('.').pop() || ''

    // For PDFs: Convert to JPEG image first, then return the first page as data URL
    // This is necessary because the RecenteTech Vision API only supports image formats (JPEG, PNG)
    if (ext === 'pdf') {
      const imageUrls = convertPdfToImageDataUrls(filePath)
      if (imageUrls.length > 0) {
        return { dataUrl: imageUrls[0], mimeType: 'image/jpeg', filePath }
      }
      // Fallback: if conversion fails, return PDF data URL (may not work with VLM)
      const fileBuffer = readFileSync(filePath)
      const base64 = fileBuffer.toString('base64')
      return { dataUrl: `data:application/pdf;base64,${base64}`, mimeType: 'application/pdf', filePath }
    }

    // For image files: Return data URL directly
    const fileBuffer = readFileSync(filePath)
    const base64 = fileBuffer.toString('base64')

    const mimeMap: Record<string, string> = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      webp: 'image/webp',
      gif: 'image/gif',
      bmp: 'image/bmp',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      txt: 'text/plain',
    }
    const mimeType = mimeMap[ext] || 'application/octet-stream'
    const dataUrl = `data:${mimeType};base64,${base64}`

    return { dataUrl, mimeType, filePath }
  } catch (err) {
    console.warn('Failed to read file for VLM analysis:', err)
    return null
  }
}

async function extractVisualDocumentText(fileName: string, documentLabel = 'document'): Promise<string> {
  const safeName = basename(fileName)
  const ext = safeName.toLowerCase().split('.').pop() || ''
  if (!['pdf', 'jpg', 'jpeg', 'png', 'webp'].includes(ext)) return ''

  try {
    const fileInfo = readFileAsDataUrl(safeName)
    if (!fileInfo) return ''

    const imageUrls = ext === 'pdf' ? readPdfAsImageDataUrls(safeName, 2) : [fileInfo.dataUrl]
    if (imageUrls.length === 0) return ''

    const messageContent: Array<{ type: string; text?: string; image_url?: { url: string } }> = [{
      type: 'text',
      text: `Read this ${documentLabel}. Extract all visible text, tables, dates, employer/deposit names, salary deposit amounts, and recurring deductions. Return plain text only; do not summarize.`,
    }]
    for (const imageUrl of imageUrls) {
      messageContent.push({ type: 'image_url', image_url: { url: imageUrl } })
    }

    const result = await visionCompletion([{ role: 'user', content: messageContent }], resolveVLMConfig())
    return (result.content || '').slice(0, 8000)
  } catch (err: any) {
    console.warn('Visual document text extraction failed:', safeName, err?.message || err)
    return ''
  }
}

async function extractUploadedDocumentText(fileName: string): Promise<string> {
  if (!fileName) return ''
  const safeName = basename(fileName)
  const filePath = join(process.cwd(), 'uploads', safeName)
  if (!existsSync(filePath)) return ''

  const ext = safeName.toLowerCase().split('.').pop() || ''
  try {
    if (ext === 'pdf') {
      const extractedText = execFileSync('pdftotext', ['-layout', filePath, '-'], {
        encoding: 'utf8',
        timeout: 7000,
        maxBuffer: 1024 * 1024,
      }).slice(0, 8000)
      if (extractedText.trim()) return extractedText
    }
    if (ext === 'docx') {
      const result = await mammoth.extractRawText({ buffer: readFileSync(filePath) })
      return (result.value || '').slice(0, 8000)
    }
    if (['txt', 'csv'].includes(ext)) {
      return readFileSync(filePath, 'utf-8').slice(0, 8000)
    }
  } catch (err: any) {
    console.warn('Bank statement text extraction failed:', safeName, err?.message || err)
  }
  if (['pdf', 'jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
    return extractVisualDocumentText(safeName, 'bank statement')
  }
  return ''
}

type AssessmentDocumentSummary = {
  fileName: string
  documentType: string
  verified: boolean
  status: 'verified' | 'review_required' | 'missing'
  confidence: number
  method: 'deterministic_text_extraction' | 'metadata_only' | 'not_provided'
  summary: string
  signals: string[]
}

function normalizeDocType(value: unknown): string {
  return String(value || 'additional').trim().toLowerCase().replace(/\s+/g, '_')
}

function getDocumentLabel(docType: string): string {
  const labels: Record<string, string> = {
    salary_certificate: 'Salary certificate',
    income_statement: 'Income statement',
    bank_statement: 'Bank statement',
    detailed_salary_statement: 'Detailed salary statement',
    rescheduling_agreement: 'Rescheduling agreement',
    medical_report: 'Medical report',
    termination_letter: 'Termination letter',
    divorce_decree: 'Divorce decree',
    pension_statement: 'Pension statement',
  }
  return labels[docType] || docType.replace(/_/g, ' ')
}

function requiredDocumentsForReason(reasonCategory: string, hasIncomeEvidence: boolean): string[] {
  const required = ['salary_certificate', hasIncomeEvidence ? 'income_evidence' : 'income_statement']
  if (reasonCategory === 'medical') required.push('medical_report')
  if (reasonCategory === 'job_loss') required.push('termination_letter')
  if (reasonCategory === 'divorce') required.push('divorce_decree')
  if (reasonCategory === 'retirement') required.push('pension_statement')
  return required
}

function extractMoneyAmounts(text: string): number[] {
  const matches = text.match(/(?:AED|درهم|د\.إ)?\s*([0-9]{1,3}(?:[, ]?[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]{4,7}(?:\.[0-9]{1,2})?)/gi) || []
  return matches
    .map((match) => Number(match.replace(/[^\d.]/g, '')))
    .filter((amount) => Number.isFinite(amount) && amount > 0)
}

function hasApproxAmount(amounts: number[], target: number, tolerance = 0.1): boolean {
  if (!target || target <= 0) return false
  return amounts.some((amount) => Math.abs(amount - target) / target <= tolerance)
}

function textIncludesName(text: string, name: string): boolean {
  const normalizedText = text.toLowerCase()
  return String(name || '')
    .toLowerCase()
    .split(/\s+/)
    .filter((part) => part.length >= 3)
    .some((part) => normalizedText.includes(part))
}

function textIncludesEmployer(text: string, employer: string): boolean {
  const normalizedText = text.toLowerCase()
  return String(employer || '')
    .toLowerCase()
    .split(/\s+/)
    .filter((part) => part.length >= 3)
    .some((part) => normalizedText.includes(part))
}

function buildDocumentSummaryFromText(options: {
  fileName: string
  docType: string
  text: string
  applicant: any
  monthlyIncome: number
  reasonCategory: string
}): AssessmentDocumentSummary {
  const { fileName, docType, text, applicant, monthlyIncome, reasonCategory } = options
  const compactText = text.replace(/\s+/g, ' ').slice(0, 7000)
  const amounts = extractMoneyAmounts(compactText)
  const salaryAmountFound = hasApproxAmount(amounts, monthlyIncome, 0.1)
  const applicantNameFound = textIncludesName(compactText, applicant.nameEn || applicant.nameAr || '')
  const employerFound = textIncludesEmployer(compactText, applicant.employer || '')
  const signals: string[] = []

  if (compactText.length > 0) signals.push(`${compactText.length.toLocaleString()} readable characters`)
  if (applicantNameFound) signals.push('applicant name detected')
  if (employerFound) signals.push('employer evidence detected')
  if (salaryAmountFound) signals.push(`income amount aligns within 10% of AED ${monthlyIncome.toLocaleString()}`)
  if (amounts.length > 0 && !salaryAmountFound) signals.push(`${Math.min(amounts.length, 8)} financial amount(s) extracted`)

  let verified = false
  let confidence = 72
  let summary = `${getDocumentLabel(docType)} was read by the document-intelligence layer and converted into structured evidence for the rule engine.`

  if (docType === 'salary_certificate') {
    verified = salaryAmountFound && (applicantNameFound || employerFound)
    confidence = verified ? 94 : compactText ? 78 : 55
    summary = verified
      ? `Salary certificate supports the declared monthly income of AED ${monthlyIncome.toLocaleString()} and includes applicant or employer evidence. This value feeds the DBR and 20% deduction calculations.`
      : `Salary certificate text was extracted, but the engine could not fully confirm both salary alignment and identity/employer evidence. The amount is still governed by the rule checks and can be opened by the officer.`
  } else if (['bank_statement', 'income_statement', 'detailed_salary_statement'].includes(docType)) {
    verified = salaryAmountFound || amounts.length >= 3
    confidence = verified ? 88 : 74
    summary = verified
      ? `Income evidence is readable and contains financial signals used to cross-check the declared salary and repayment capacity.`
      : `Income evidence is readable, but recurring salary deposits were not conclusively matched. Treat as reviewable evidence, not an automatic override.`
  } else if (docType === 'medical_report') {
    verified = reasonCategory === 'medical' && compactText.length > 0
    confidence = verified ? 86 : 72
    summary = reasonCategory === 'medical'
      ? 'Medical-support evidence is present for the stated hardship reason and is included in the documentation gate.'
      : 'Medical document is present as supplementary evidence; it does not change the financial rule calculation.'
  } else if (docType === 'rescheduling_agreement') {
    verified = compactText.length > 0
    confidence = verified ? 84 : 68
    summary = 'Rescheduling agreement evidence is present. It supports beneficiary intent but does not override eligibility, DBR, duration, or documentation rules.'
  }

  return {
    fileName,
    documentType: docType,
    verified,
    status: verified ? 'verified' : 'review_required',
    confidence,
    method: 'deterministic_text_extraction',
    summary,
    signals: signals.length > 0 ? signals : ['no high-confidence financial signal extracted'],
  }
}

async function buildDocumentIntelligence(options: {
  reqData: any
  applicant: any
  supportingDocuments: string[]
  missingDocuments: string[]
  monthlyIncome: number
  hasIncomeEvidence: boolean
}): Promise<AssessmentDocumentSummary[]> {
  const { reqData, applicant, supportingDocuments, missingDocuments, monthlyIncome, hasIncomeEvidence } = options
  const uploadedFiles = safeJsonParse<Array<Record<string, any>>>(reqData.uploadedFiles, [])
  const summaries: AssessmentDocumentSummary[] = []
  const summarizedTypes = new Set<string>()

  for (const file of uploadedFiles) {
    const docType = normalizeDocType(file.docType || file.documentType || file.originalName)
    const storedName = String(file.storedName || file.fileName || '')
    const fileName = String(file.originalName || storedName || getDocumentLabel(docType))
    summarizedTypes.add(docType)

    const text = storedName ? await extractUploadedDocumentText(storedName) : ''
    if (text.trim()) {
      summaries.push(buildDocumentSummaryFromText({
        fileName,
        docType,
        text,
        applicant,
        monthlyIncome,
        reasonCategory: String(reqData.reasonCategory || 'other'),
      }))
      continue
    }

    summaries.push({
      fileName,
      documentType: docType,
      verified: false,
      status: 'review_required',
      confidence: 62,
      method: 'metadata_only',
      summary: `${getDocumentLabel(docType)} is uploaded and counted for completeness, but text/OCR extraction was not conclusive. The strict rules still use only verified application values, and the officer can open the source file.`,
      signals: [
        'file metadata present',
        file.type ? `mime type: ${file.type}` : 'mime type unavailable',
        file.size ? `size: ${Number(file.size).toLocaleString()} bytes` : 'size unavailable',
      ],
    })
  }

  for (const doc of supportingDocuments) {
    const docType = normalizeDocType(doc)
    if (summarizedTypes.has(docType)) continue
    summaries.push({
      fileName: getDocumentLabel(docType),
      documentType: docType,
      verified: false,
      status: 'review_required',
      confidence: 58,
      method: 'metadata_only',
      summary: `${getDocumentLabel(docType)} was declared in the application, but no uploaded file metadata is attached to this case. Treat as a completeness signal only until an officer opens the source evidence.`,
      signals: ['declared by application payload', 'source file not attached to assessment record'],
    })
  }

  const requiredDocs = requiredDocumentsForReason(String(reqData.reasonCategory || 'other'), hasIncomeEvidence)
  for (const docType of requiredDocs) {
    if (docType === 'income_evidence') continue
    if (!missingDocuments.includes(docType)) continue
    summaries.push({
      fileName: getDocumentLabel(docType),
      documentType: docType,
      verified: false,
      status: 'missing',
      confidence: 100,
      method: 'not_provided',
      summary: `${getDocumentLabel(docType)} is mandatory for this request and was not provided. The case cannot proceed on the instant approval path until this gap is resolved.`,
      signals: ['mandatory document missing', 'blocks automatic approval'],
    })
  }

  if (missingDocuments.includes('income_statement') && !hasIncomeEvidence) {
    summaries.push({
      fileName: 'Income evidence',
      documentType: 'income_evidence',
      verified: false,
      status: 'missing',
      confidence: 100,
      method: 'not_provided',
      summary: 'A bank statement, income statement, or detailed salary statement is mandatory to validate repayment capacity. Missing income evidence blocks automatic approval.',
      signals: ['mandatory income evidence missing', 'DBR remains calculated from declared profile income only'],
    })
  }

  return summaries
}

// Helper: Read a PDF file and return ALL pages as JPEG data URLs for VLM analysis
// Returns empty array for non-PDF files or if conversion fails
function readPdfAsImageDataUrls(fileName: string, maxPages: number = 5): string[] {
  if (!fileName) return []
  const ext = fileName.toLowerCase().split('.').pop() || ''
  if (ext !== 'pdf') return []

  const uploadDir = join(process.cwd(), 'uploads')
  const filePath = join(uploadDir, fileName)
  if (!existsSync(filePath)) return []

  return convertPdfToImageDataUrls(filePath, maxPages)
}

// ── AI Helper (using shared ai-client module — direct fetch, no SDK) ──
// chatCompletion() and visionCompletion() are imported from src/worker/lib/ai-client
// These use direct fetch() calls to the Recentech AI endpoint.
// No z-ai-web-dev-sdk dependency needed.

// Helper: Determine if a file type can be analyzed by VLM (images and PDFs)
// Note: PDFs are converted to JPEG images before sending to the RecenteTech Vision API
function isVlmCompatibleFile(fileName: string): boolean {
  return /\.(pdf|jpe?g|png|webp|gif|bmp)$/i.test(fileName)
}

// Helper: Read text content from a non-image file for LLM analysis
function readTextFileContent(fileName: string): string | null {
  if (!fileName) return null
  const uploadDir = join(process.cwd(), 'uploads')
  const filePath = join(uploadDir, fileName)
  if (!existsSync(filePath)) return null

  try {
    const ext = fileName.toLowerCase().split('.').pop() || ''
    // Only read text-based files (txt, csv, etc.)
    if (['txt', 'csv', 'log', 'md'].includes(ext)) {
      return readFileSync(filePath, 'utf-8')
    }
    // For DOCX, PDF, etc. we can't easily extract text without extra libs
    // The VLM should handle PDFs, and DOCX will get LLM filename-based analysis
    return null
  } catch {
    return null
  }
}

// ── Create Hono App ─────────────────────────────────────────────────
const app = new Hono()

// CORS
app.use('/api/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length'],
  maxAge: 86400,
  credentials: true,
}))

// Error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err)
  return c.json({ error: 'Internal server error', message: err.message }, 500)
})

// ── Health Check ────────────────────────────────────────────────────
app.get('/api', (c) => {
  return c.json({ message: 'Hello, world!', status: 'ok', timestamp: new Date().toISOString() })
})

// ── Auth Routes ─────────────────────────────────────────────────────

// POST /api/auth/mock-login
app.post('/api/auth/mock-login', async (c) => {
  try {
    const body = await c.req.json()
    const { profile } = body

    if (!profile) return c.json({ error: 'Profile required' }, 400)

    const emiratesId = profile.idn || profile.sub || generateId()

    // Find or create user
    let user = queryFirst('SELECT * FROM User WHERE emiratesId = ?', [emiratesId]) as any
    if (!user) {
      const id = generateId()
      queryRun(`INSERT INTO User (id, uaepassSub, emiratesId, firstnameEN, lastnameEN, fullnameEN, role, sopLevel, isActive, permissions)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, '[]')`,
        [id, profile.sub || id, emiratesId, profile.firstnameEN || 'Test', profile.lastnameEN || 'User',
         `${profile.firstnameEN || 'Test'} ${profile.lastnameEN || 'User'}`, profile.role || 'citizen', 'sop2'])
      user = queryFirst('SELECT * FROM User WHERE id = ?', [id]) as any
    }

    // Create session — uses shared generateAccessToken
    const accessToken = generateAccessToken(user.id)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    queryRun('INSERT INTO Session (id, userId, accessToken, authMode, expiresAt) VALUES (?, ?, ?, ?, ?)',
      [generateId(), user.id, accessToken, 'mock', expiresAt])

    // Update last login
    queryRun('UPDATE User SET lastLoginAt = ? WHERE id = ?', [new Date().toISOString(), user.id])

    return c.json({
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        firstnameEN: user.firstnameEN,
        lastnameEN: user.lastnameEN,
        firstnameAR: user.firstnameAR,
        lastnameAR: user.lastnameAR,
        role: user.role,
        department: user.department,
        permissions: safeJsonParse(user.permissions, []),
      },
    })
  } catch (error: any) {
    console.error('Mock login error:', error)
    return c.json({ error: 'Login failed', message: error.message }, 500)
  }
})

// POST /api/auth/admin-login
app.post('/api/auth/admin-login', async (c) => {
  try {
    const { email, password } = await c.req.json()
    if (!email || !password) return c.json({ error: 'Email and password required' }, 400)

    const user = queryFirst('SELECT * FROM User WHERE email = ? AND isActive = 1', [email]) as any
    if (!user) return c.json({ error: 'Invalid credentials' }, 401)
    if (!user.passwordHash) return c.json({ error: 'Account not configured for password login' }, 401)

    // Check account lock
    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      return c.json({ error: 'Account is locked. Try again later.' }, 403)
    }

    // Use shared verifyPassword from auth middleware
    const valid = await verifyPassword(password, user.passwordHash)

    if (!valid) {
      const attempts = toNum(user.loginAttempts, 0) + 1
      const lockUntil = attempts >= 5 ? new Date(Date.now() + 30 * 60 * 1000).toISOString() : null
      queryRun('UPDATE User SET loginAttempts = ?, lockedUntil = ? WHERE id = ?', [attempts, lockUntil, user.id])
      return c.json({ error: 'Invalid credentials' }, 401)
    }

    // Reset attempts
    queryRun('UPDATE User SET loginAttempts = 0, lockedUntil = NULL, lastLoginAt = ? WHERE id = ?', [new Date().toISOString(), user.id])

    // Create session — uses shared generateAccessToken
    const accessToken = generateAccessToken(user.id)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    queryRun('INSERT INTO Session (id, userId, accessToken, authMode, expiresAt) VALUES (?, ?, ?, ?, ?)',
      [generateId(), user.id, accessToken, 'admin_password', expiresAt])

    return c.json({
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        firstnameEN: user.firstnameEN,
        lastnameEN: user.lastnameEN,
        firstnameAR: user.firstnameAR,
        lastnameAR: user.lastnameAR,
        role: user.role,
        department: user.department,
        permissions: safeJsonParse(user.permissions, []),
      },
    })
  } catch (error: any) {
    console.error('Admin login error:', error)
    return c.json({ error: 'Login failed', message: error.message }, 500)
  }
})

// POST /api/auth/logout
app.post('/api/auth/logout', async (c) => {
  const token = extractToken(c)
  if (token) {
    queryRun('DELETE FROM Session WHERE accessToken = ?', [token])
  }
  return c.json({ success: true })
})

// GET /api/auth/me
app.get('/api/auth/me', async (c) => {
  const token = extractToken(c)
  const auth = await verifyAuth(token || '')
  if (!auth.authenticated) return c.json({ error: auth.error }, 401)
  return c.json({ user: auth.user })
})

// POST /api/auth/seed-admin
app.post('/api/auth/seed-admin', async (c) => {
  try {
    const superAdminEmail = 'admin@szhp.gov.ae'
    const existingAdmin = queryFirst('SELECT id FROM User WHERE email = ?', [superAdminEmail])

    let superAdminId: string
    if (!existingAdmin) {
      superAdminId = generateId()
      // Use shared hashPassword
      const passwordHash = await hashPassword('Admin@2024')
      queryRun(`INSERT INTO User (id, uaepassSub, emiratesId, email, firstnameEN, lastnameEN, fullnameEN, role, sopLevel, isActive, permissions, passwordHash)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, '["*"]', ?)`,
        [superAdminId, superAdminId, `784-1990-${Math.random().toString().slice(2, 9)}-1`, superAdminEmail,
         'Super', 'Admin', 'Super Admin', 'superadmin', 'sop3', passwordHash])
    } else {
      superAdminId = (existingAdmin as any).id
    }

    // Create demo employees
    const demoEmployees = [
      { email: 'manager@szhp.gov.ae', name: 'Manager', role: 'manager', perms: '["dashboard","cases","cases.approve","cases.reject","workflows","employees.view","employees.manage","audit.view","settings","models"]' },
      { email: 'reviewer@szhp.gov.ae', name: 'Reviewer', role: 'reviewer', perms: '["dashboard","cases","cases.review","audit.view"]' },
      { email: 'employee@szhp.gov.ae', name: 'Employee', role: 'employee', perms: '["dashboard","cases.view"]' },
      { email: 'admin2@szhp.gov.ae', name: 'Admin', role: 'admin', perms: '["dashboard","cases","cases.approve","cases.reject","workflows","employees.view","employees.manage","audit.view","settings","models"]' },
    ]

    const created = []
    for (const emp of demoEmployees) {
      const existing = queryFirst('SELECT id FROM User WHERE email = ?', [emp.email])
      if (!existing) {
        const empId = generateId()
        // Use shared hashPassword
        const passwordHash = await hashPassword('Pass@2024')
        queryRun(`INSERT INTO User (id, uaepassSub, emiratesId, email, firstnameEN, lastnameEN, fullnameEN, role, department, sopLevel, isActive, permissions, passwordHash)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'housing_finance', 'sop2', 1, ?, ?)`,
          [empId, empId, `784-1990-${Math.random().toString().slice(2, 9)}-2`, emp.email,
           emp.name, 'User', `${emp.name} User`, emp.role, emp.perms, passwordHash])
        created.push({ id: empId, email: emp.email, role: emp.role, status: 'created' })
      } else {
        created.push({ id: (existing as any).id, email: emp.email, role: emp.role, status: 'already_exists' })
      }
    }

    return c.json({
      success: true,
      message: 'Accounts seeded. Change default passwords immediately.',
      superAdmin: { id: superAdminId, email: superAdminEmail, role: 'superadmin' },
      demoEmployees: created,
    })
  } catch (error: any) {
    console.error('Seed admin error:', error)
    return c.json({ error: 'Seed failed', message: error.message }, 500)
  }
})

// ── Dashboard Route ─────────────────────────────────────────────────
app.get('/api/dashboard', async (c) => {
  const token = extractToken(c)
  const auth = await verifyAuth(token || '')
  if (!auth.authenticated) return c.json({ error: auth.error }, 401)

  try {
    // Optional date range filter for dashboard
    const period = c.req.query('period') || 'all' // 'quarter', 'month', '30d', 'all', 'custom'
    const fromDate = c.req.query('fromDate') // ISO date string e.g. '2024-01-01'
    const toDate = c.req.query('toDate')     // ISO date string e.g. '2024-12-31'
    let dateCondition = ''
    const dateParams: any[] = []

    if (period === 'custom' && fromDate && toDate) {
      dateCondition = ' AND createdAt >= ? AND createdAt <= ?'
      dateParams.push(fromDate + 'T00:00:00.000Z', toDate + 'T23:59:59.999Z')
    } else if (period === 'quarter') {
      dateCondition = " AND strftime('%Y-%m', createdAt) >= strftime('%Y-%m', 'now', '-3 months')"
    } else if (period === 'month') {
      dateCondition = " AND strftime('%Y-%m', createdAt) >= strftime('%Y-%m', 'now', 'start of month')"
    } else if (period === '30d') {
      dateCondition = " AND createdAt >= datetime('now', '-30 days')"
    }
    // 'all' = no date filter

    const totalRequests = toNum((queryFirst(`SELECT COUNT(*) as count FROM ReschedulingRequest WHERE 1=1${dateCondition}`, dateParams) as any)?.count, 0)
    const pendingReview = toNum((queryFirst(`SELECT COUNT(*) as count FROM ReschedulingRequest WHERE status IN ('pending', 'under_review')${dateCondition}`, dateParams) as any)?.count, 0)
    const approvedThisMonth = toNum((queryFirst("SELECT COUNT(*) as count FROM ReschedulingRequest WHERE status = 'approved' AND strftime('%Y-%m', reviewedAt) = strftime('%Y-%m', 'now')") as any)?.count, 0)
    const rejectedThisMonth = toNum((queryFirst("SELECT COUNT(*) as count FROM ReschedulingRequest WHERE status = 'rejected' AND strftime('%Y-%m', reviewedAt) = strftime('%Y-%m', 'now')") as any)?.count, 0)

    // Status distribution
    const statusDist = (query(`SELECT status, COUNT(*) as count FROM ReschedulingRequest WHERE 1=1${dateCondition} GROUP BY status`, dateParams).results || []) as any[]

    // Risk distribution from assessments
    const riskDist = (query("SELECT riskLevel, COUNT(*) as count FROM AIAssessment GROUP BY riskLevel").results || []) as any[]

    // Recent requests
    const recentRequests = (query(`
      SELECT r.*, a.nameAr, a.nameEn, a.monthlyIncome, a.employerType, a.familySize,
        l.originalAmount, l.remainingBalance, l.monthlyInstallment, l.loanType, l.loanDurationMonths, l.elapsedMonths,
        ar.missedMonths, ar.totalOverdue, ar.delayDays, ar.reason as arrearReason,
        ass.riskScore, ass.riskLevel, ass.eligibilityStatus, ass.moeiRecommendation
      FROM ReschedulingRequest r
      LEFT JOIN Applicant a ON r.applicantId = a.id
      LEFT JOIN HousingLoan l ON r.loanId = l.id
      LEFT JOIN Arrear ar ON ar.loanId = l.id
      LEFT JOIN AIAssessment ass ON ass.requestId = r.id
      WHERE 1=1${dateCondition}
      ORDER BY r.createdAt DESC LIMIT 10
    `, dateParams).results || []) as any[]

    // Loan stats
    const loanStats = (query(`
      SELECT COALESCE(SUM(remainingBalance), 0) as totalOutstanding,
             COALESCE(AVG(monthlyInstallment), 0) as avgInstallment,
             COUNT(*) as totalLoans
      FROM HousingLoan WHERE status = 'active'
    `).results?.[0] || {}) as any

    // Arrear stats
    const arrearStats = (query(`
      SELECT COALESCE(SUM(totalOverdue), 0) as totalArrears,
             COALESCE(AVG(delayDays), 0) as avgDelayDays
      FROM Arrear
    `).results?.[0] || {}) as any

    // ── Real analytics (replacing hardcoded values) ──────────────

    // Avg processing time in seconds (from actual request data)
    const avgProcessingTimeRow = queryFirst(`
      SELECT AVG(julianday(COALESCE(reviewedAt, datetime('now'))) - julianday(createdAt)) * 24 * 60 * 60 as avgSeconds
      FROM ReschedulingRequest WHERE status NOT IN ('pending', 'under_review')
    `) as any
    const avgProcessingTime = toNum(avgProcessingTimeRow?.avgSeconds, 0)

    // Automation rate (% of ai_assessed requests)
    const automationRateRow = queryFirst(`
      SELECT CAST(SUM(CASE WHEN status = 'ai_assessed' THEN 1 ELSE 0 END) AS FLOAT) / COUNT(*) * 100 as rate
      FROM ReschedulingRequest
    `) as any
    const automationRate = toNum(automationRateRow?.rate, 0)

    // Monthly trend (last 12 months)
    const monthlyTrend = (query(`
      SELECT strftime('%Y-%m', createdAt) as month,
             COUNT(*) as requests,
             SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
             SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
      FROM ReschedulingRequest
      GROUP BY strftime('%Y-%m', createdAt)
      ORDER BY month DESC LIMIT 12
    `).results || []) as any[]

    // Gender distribution (from User table — Applicant table lacks gender column)
    const genderDistribution = (query(`
      SELECT gender, COUNT(*) as count FROM User WHERE gender IS NOT NULL GROUP BY gender
    `).results || []) as any[]

    // Age distribution (from User table — Applicant table lacks dateOfBirth column)
    const ageDistribution = (query(`
      SELECT
        CASE
          WHEN (strftime('%Y','now') - strftime('%Y',dob)) < 25 THEN '18-24'
          WHEN (strftime('%Y','now') - strftime('%Y',dob)) < 35 THEN '25-34'
          WHEN (strftime('%Y','now') - strftime('%Y',dob)) < 45 THEN '35-44'
          WHEN (strftime('%Y','now') - strftime('%Y',dob)) < 55 THEN '45-54'
          ELSE '55+'
        END as ageGroup, COUNT(*) as count
      FROM User WHERE dob IS NOT NULL GROUP BY ageGroup ORDER BY ageGroup
    `).results || []) as any[]

    // Avg response time in hours (average time from request creation to first review)
    const avgResponseTimeRow = queryFirst(`
      SELECT AVG(julianday(reviewedAt) - julianday(createdAt)) * 24 as avgHours
      FROM ReschedulingRequest WHERE reviewedAt IS NOT NULL
    `) as any
    const avgResponseTimeHours = toNum(avgResponseTimeRow?.avgHours, 0)

    // Nationality distribution (from User table)
    const nationalityDistribution = (query(`
      SELECT nationalityEN as nationality, COUNT(*) as count FROM User WHERE nationalityEN IS NOT NULL GROUP BY nationalityEN
    `).results || []) as any[]

    // Response time trend by month
    const responseTimeTrend = (query(`
      SELECT strftime('%Y-%m', createdAt) as month,
             AVG(julianday(reviewedAt) - julianday(createdAt)) * 24 as avgHours
      FROM ReschedulingRequest
      WHERE reviewedAt IS NOT NULL
      GROUP BY strftime('%Y-%m', createdAt)
      ORDER BY month DESC LIMIT 12
    `).results || []) as any[]

    return c.json({
      totalRequests,
      pendingReview,
      approvedThisMonth,
      rejectedThisMonth,
      avgProcessingTime,
      automationRate,
      statusDistribution: statusDist,
      riskDistribution: riskDist,
      monthlyTrend: monthlyTrend.reverse(),
      recentRequests: recentRequests.map((r: any) => ({
        ...r,
        applicant: r.nameAr ? { nameAr: r.nameAr, nameEn: r.nameEn, monthlyIncome: r.monthlyIncome, employerType: r.employerType, familySize: r.familySize } : undefined,
        loan: r.originalAmount ? { originalAmount: r.originalAmount, remainingBalance: r.remainingBalance, monthlyInstallment: r.monthlyInstallment, loanType: r.loanType, loanDurationMonths: r.loanDurationMonths, elapsedMonths: r.elapsedMonths } : undefined,
        arrear: r.missedMonths ? { missedMonths: r.missedMonths, totalOverdue: r.totalOverdue, delayDays: r.delayDays, reason: r.arrearReason } : undefined,
        assessment: r.riskScore ? { riskScore: r.riskScore, riskLevel: r.riskLevel, eligibilityStatus: r.eligibilityStatus, moeiRecommendation: r.moeiRecommendation } : undefined,
      })),
      avgMonthlyInstallment: toNum(loanStats.avgInstallment, 0),
      totalOutstandingArrears: toNum(arrearStats.totalArrears, 0),
      genderDistribution,
      ageDistribution,
      avgResponseTimeHours,
      nationalityDistribution,
      responseTimeTrend: responseTimeTrend.reverse(),
    })
  } catch (error: any) {
    console.error('Dashboard error:', error)
    return c.json({ error: 'Failed to load dashboard', message: error.message }, 500)
  }
})

// ── Requests Routes ─────────────────────────────────────────────────

// GET /api/requests
app.get('/api/requests', async (c) => {
  const token = extractToken(c)
  const auth = await verifyAuth(token || '')
  if (!auth.authenticated) return c.json({ error: auth.error }, 401)

  try {
    const status = c.req.query('status')
    const search = c.req.query('search')

    let sql = `
      SELECT r.*, a.nameAr, a.nameEn, a.monthlyIncome, a.employerType, a.familySize, a.emiratesId as applicantEmiratesId,
        l.originalAmount, l.remainingBalance, l.monthlyInstallment, l.loanType, l.loanDurationMonths, l.elapsedMonths,
        ar.missedMonths, ar.totalOverdue, ar.delayDays,
        ass.riskScore, ass.riskLevel, ass.eligibilityStatus,
        ass.recommendedAmount, ass.recommendedDuration, ass.recommendedInstallment, ass.proposedDeductionRate
      FROM ReschedulingRequest r
      LEFT JOIN Applicant a ON r.applicantId = a.id
      LEFT JOIN HousingLoan l ON r.loanId = l.id
      LEFT JOIN Arrear ar ON ar.loanId = l.id
      LEFT JOIN AIAssessment ass ON ass.requestId = r.id
    `
    const conditions: string[] = []
    const params: any[] = []

    if (status && status !== 'all') {
      conditions.push('r.status = ?')
      params.push(status)
    }
    if (search) {
      conditions.push('(a.nameAr LIKE ? OR a.nameEn LIKE ? OR r.id LIKE ?)')
      params.push(`%${search}%`, `%${search}%`, `%${search}%`)
    }

    // Date range filtering
    const dateFrom = c.req.query('dateFrom')
    const dateTo = c.req.query('dateTo')
    if (dateFrom) {
      conditions.push('r.createdAt >= ?')
      params.push(dateFrom + 'T00:00:00.000Z')
    }
    if (dateTo) {
      conditions.push('r.createdAt <= ?')
      params.push(dateTo + 'T23:59:59.999Z')
    }

    // Non-admin users can only see their own requests
    if (auth.user?.role === 'citizen') {
      // Look up the user's emiratesId from the User table and find their Applicant records
      const userRow = queryFirst('SELECT emiratesId FROM User WHERE id = ?', [auth.user?.id]) as any
      if (userRow?.emiratesId) {
        conditions.push('r.applicantId IN (SELECT id FROM Applicant WHERE emiratesId = ?)')
        params.push(userRow.emiratesId)
      } else {
        // If no emiratesId mapping, show all requests (fallback)
        // This shouldn't normally happen but prevents empty results for citizens
      }
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ')
    }

    sql += ' ORDER BY r.createdAt DESC'

    const results = (query(sql, params).results || []) as any[]

    return c.json(results.map((r: any) => ({
      ...r,
      applicant: r.nameAr ? {
        nameAr: r.nameAr,
        nameEn: r.nameEn,
        monthlyIncome: r.monthlyIncome,
        employerType: r.employerType,
        familySize: r.familySize,
        emiratesId: r.applicantEmiratesId,
      } : undefined,
      loan: r.originalAmount ? {
        originalAmount: r.originalAmount,
        remainingBalance: r.remainingBalance,
        monthlyInstallment: r.monthlyInstallment,
        loanType: r.loanType,
        loanDurationMonths: r.loanDurationMonths,
        elapsedMonths: r.elapsedMonths,
      } : undefined,
      arrear: r.missedMonths ? {
        missedMonths: r.missedMonths,
        totalOverdue: r.totalOverdue,
        delayDays: r.delayDays,
      } : undefined,
      assessment: r.riskScore ? {
        riskScore: r.riskScore,
        riskLevel: r.riskLevel,
        eligibilityStatus: r.eligibilityStatus,
        recommendedAmount: r.recommendedAmount,
        recommendedDuration: r.recommendedDuration,
        recommendedInstallment: r.recommendedInstallment,
        proposedDeductionRate: r.proposedDeductionRate,
      } : undefined,
    })))
  } catch (error: any) {
    console.error('List requests error:', error)
    return c.json({ error: 'Failed to fetch requests' }, 500)
  }
})

// POST /api/requests
app.post('/api/requests', async (c) => {
  try {
    const body = await c.req.json()

    // Support both payload structures:
    // 1. { applicant, loan, request: { reason, reasonCategory, ... } } — from new-request-form.tsx
    // 2. { applicant, loan, arrear, reasonCategory, reason, ... } — flat structure
    const applicant = body.applicant
    const loan = body.loan
    const requestObj = body.request || {}
    const arrear = body.arrear || null

    // Extract request-level fields from body.request (preferred) or top-level (fallback)
    const reasonCategory = requestObj.reasonCategory || body.reasonCategory || 'other'
    const reason = requestObj.reason || body.reason || ''
    const requestedDurationMonths = requestObj.requestedDurationMonths || body.requestedDurationMonths || 60
    const priority = requestObj.priority || body.priority || 'normal'
    const supportingDocuments = requestObj.supportingDocuments || body.supportingDocuments || []
    const uploadedFiles = requestObj.uploadedFiles || body.uploadedFiles || []

    // Extract arrear data from loan object if present (frontend puts arrear fields in loan)
    const arrearMissedMonths = loan?.missedMonths || arrear?.missedMonths || 0
    const arrearTotalOverdue = loan?.totalOverdue || arrear?.totalOverdue || 0
    const arrearDelayDays = loan?.delayDays || arrear?.delayDays || 0

    // Create applicant if provided
    let applicantId = body.applicantId
    if (applicant && !applicantId) {
      // Check if applicant already exists by emiratesId
      const existingApplicant = applicant.emiratesId
        ? queryFirst('SELECT id FROM Applicant WHERE emiratesId = ?', [applicant.emiratesId]) as any
        : null

      if (existingApplicant) {
        applicantId = existingApplicant.id
        // Update existing applicant with new data
        queryRun(`UPDATE Applicant SET nameAr = ?, nameEn = ?, phone = ?, email = ?, monthlyIncome = ?,
          employer = ?, employerType = ?, familySize = ?, maritalStatus = ?, spouseIncome = ?,
          totalHouseholdIncome = ?, incomeStability = ?, numberOfChildren = ?, housingType = ?, updatedAt = ?
          WHERE id = ?`,
          [applicant.nameAr || 'مواطن', applicant.nameEn || 'Citizen',
           applicant.phone || '0500000000', applicant.email || null, applicant.monthlyIncome || 0,
           applicant.employer || null, applicant.employerType || 'government', applicant.familySize || 1,
           applicant.maritalStatus || null, applicant.spouseIncome || 0,
           applicant.totalHouseholdIncome || applicant.monthlyIncome || 0,
           applicant.incomeStability || 'stable', applicant.numberOfChildren || 0, applicant.housingType || null,
           new Date().toISOString(), applicantId])
      } else {
        applicantId = generateId()
        queryRun(`INSERT INTO Applicant (id, emiratesId, nameAr, nameEn, phone, email, monthlyIncome, employer, employerType, familySize, isCitizen, hasFamilyBook, maritalStatus, spouseIncome, totalHouseholdIncome, incomeStability, numberOfChildren, housingType)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [applicantId, applicant.emiratesId || generateId(), applicant.nameAr || 'مواطن', applicant.nameEn || 'Citizen',
           applicant.phone || '0500000000', applicant.email || null, applicant.monthlyIncome || 0,
           applicant.employer || null, applicant.employerType || 'government', applicant.familySize || 1,
           applicant.isCitizen !== false ? 1 : 0, applicant.hasFamilyBook !== false ? 1 : 0,
           applicant.maritalStatus || null, applicant.spouseIncome || 0,
           applicant.totalHouseholdIncome || applicant.monthlyIncome || 0,
           applicant.incomeStability || 'stable', applicant.numberOfChildren || 0, applicant.housingType || null])
      }
    }

    // Create loan if provided
    let loanId = body.loanId
    if (loan && !loanId && applicantId) {
      loanId = generateId()
      queryRun(`INSERT INTO HousingLoan (id, applicantId, originalAmount, remainingBalance, monthlyInstallment, loanDurationMonths, elapsedMonths, interestRate, loanType, status, paymentHistory, totalPaid, totalMissedPayments, reschedulingCount)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [loanId, applicantId, loan.originalAmount || 0, loan.remainingBalance || 0,
         loan.monthlyInstallment || 0, loan.loanDurationMonths || 240, loan.elapsedMonths || 0,
         loan.interestRate || 0, loan.loanType || 'housing_loan', loan.status || 'active',
         '[]', 0, 0, 0])
    }

    // Create arrear if there is arrear data and a loan
    if (loanId && (arrearMissedMonths > 0 || arrearTotalOverdue > 0 || arrearDelayDays > 0 || arrear)) {
      queryRun(`INSERT INTO Arrear (id, loanId, missedMonths, totalOverdue, delayDays, reason, consecutiveMissedMonths)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [generateId(), loanId, arrearMissedMonths, arrearTotalOverdue,
         arrearDelayDays, arrear?.reason || reasonCategory, arrear?.consecutiveMissedMonths || 0])
    }

    // Create request
    const reqId = generateId()
    const incomePerMember = (applicant?.totalHouseholdIncome || applicant?.monthlyIncome || 0) / Math.max(applicant?.familySize || 1, 1)
    const deductionRate = loan?.monthlyInstallment ? (loan.monthlyInstallment / (applicant?.monthlyIncome || 1)) * 100 : 0

    // Store extra request metadata in notes if provided
    const requestNotes = requestObj.notes || body.notes || null

    queryRun(`INSERT INTO ReschedulingRequest (id, applicantId, loanId, requestedDurationMonths, reason, reasonCategory, supportingDocuments, uploadedFiles, status, priority, incomePerFamilyMember, deductionRate, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [reqId, applicantId, loanId, requestedDurationMonths, reason, reasonCategory,
       JSON.stringify(supportingDocuments), JSON.stringify(uploadedFiles),
       'pending', priority, incomePerMember, deductionRate, requestNotes])

    // Create audit log
    queryRun(`INSERT INTO AuditLog (id, requestId, action, performedBy, details, category) VALUES (?, ?, ?, ?, ?, ?)`,
      [generateId(), reqId, 'created', applicantId || 'system', JSON.stringify({ reasonCategory, reason: reason?.substring(0, 100) }), 'request'])

    let autoAssessment: any = null
    try {
      autoAssessment = await runLocalRequestAssessment(reqId, 'system:auto_assessment')
    } catch (assessmentError: any) {
      console.error('Auto-assessment failed:', assessmentError)
      queryRun(`INSERT INTO AuditLog (id, requestId, action, performedBy, details, category) VALUES (?, ?, ?, ?, ?, ?)`,
        [generateId(), reqId, 'assessment_failed', 'system:auto_assessment',
         JSON.stringify({ message: 'Automatic assessment failed; request remains pending manual assessment', error: assessmentError?.message || 'Unknown error' }),
         'request'])
    }

    // Return the created request with full details
    const newRequest = queryFirst(`
      SELECT r.*, a.nameAr, a.nameEn, a.monthlyIncome, a.employerType, a.familySize, a.emiratesId as applicantEmiratesId,
        l.originalAmount, l.remainingBalance, l.monthlyInstallment, l.loanType, l.loanDurationMonths, l.elapsedMonths,
        ar.missedMonths, ar.totalOverdue, ar.delayDays,
        ass.riskScore, ass.riskLevel, ass.eligibilityStatus, ass.requiresHumanReview
      FROM ReschedulingRequest r
      LEFT JOIN Applicant a ON r.applicantId = a.id
      LEFT JOIN HousingLoan l ON r.loanId = l.id
      LEFT JOIN Arrear ar ON ar.loanId = l.id
      LEFT JOIN AIAssessment ass ON ass.requestId = r.id
      WHERE r.id = ?
    `, [reqId]) as any

    return c.json({
      ...newRequest,
      applicant: newRequest?.nameAr ? {
        nameAr: newRequest.nameAr,
        nameEn: newRequest.nameEn,
        monthlyIncome: newRequest.monthlyIncome,
        employerType: newRequest.employerType,
        familySize: newRequest.familySize,
        emiratesId: newRequest.applicantEmiratesId,
      } : undefined,
      loan: newRequest?.originalAmount ? {
        originalAmount: newRequest.originalAmount,
        remainingBalance: newRequest.remainingBalance,
        monthlyInstallment: newRequest.monthlyInstallment,
        loanType: newRequest.loanType,
        loanDurationMonths: newRequest.loanDurationMonths,
        elapsedMonths: newRequest.elapsedMonths,
      } : undefined,
      arrear: newRequest?.missedMonths ? {
        missedMonths: newRequest.missedMonths,
        totalOverdue: newRequest.totalOverdue,
        delayDays: newRequest.delayDays,
      } : undefined,
      assessment: autoAssessment ? {
        riskScore: autoAssessment.riskScore,
        riskLevel: autoAssessment.riskLevel,
        eligibilityStatus: autoAssessment.eligibilityStatus,
        requiresHumanReview: !!autoAssessment.requiresHumanReview,
      } : undefined,
      autoAssessment: autoAssessment ? { completed: true, requiresHumanReview: !!autoAssessment.requiresHumanReview } : { completed: false },
    }, 201)
  } catch (error: any) {
    console.error('Create request error:', error)
    return c.json({ error: 'Failed to create request', message: error.message }, 500)
  }
})

// GET /api/requests/:id
app.get('/api/requests/:id', async (c) => {
  const token = extractToken(c)
  const auth = await verifyAuth(token || '')
  if (!auth.authenticated) return c.json({ error: auth.error }, 401)

  const id = c.req.param('id')
  const req = queryFirst('SELECT * FROM ReschedulingRequest WHERE id = ?', [id]) as any
  if (!req) return c.json({ error: 'Request not found' }, 404)

  const applicant = queryFirst('SELECT * FROM Applicant WHERE id = ?', [req.applicantId])
  const loan = queryFirst('SELECT * FROM HousingLoan WHERE id = ?', [req.loanId])
  const arrear = loan ? queryFirst('SELECT * FROM Arrear WHERE loanId = ?', [(loan as any).id]) : null
  const assessment = queryFirst('SELECT * FROM AIAssessment WHERE requestId = ?', [id])
  const auditLogs = query('SELECT * FROM AuditLog WHERE requestId = ? ORDER BY timestamp DESC', [id]).results

  // Track first view
  if (!req.isViewed && auth.user?.role !== 'citizen') {
    queryRun('UPDATE ReschedulingRequest SET isViewed = 1, firstViewedAt = ? WHERE id = ?', [new Date().toISOString(), id])
  }

  return c.json({
    ...req,
    applicant,
    loan,
    arrear,
    assessment,
    auditLogs,
  })
})

// PATCH /api/requests/:id
app.patch('/api/requests/:id', async (c) => {
  const token = extractToken(c)
  const auth = await verifyAuth(token || '')
  if (!auth.authenticated) return c.json({ error: auth.error }, 401)

  const id = c.req.param('id')
  const body = await c.req.json()

  const allowedStatuses = ['pending', 'under_review', 'ai_assessed', 'approved', 'rejected', 'escalated']
  if (body.status && !allowedStatuses.includes(body.status)) {
    return c.json({ error: 'Invalid status' }, 400)
  }

  // Fetch current request data before update to capture previous state
  const reqData = queryFirst('SELECT status, priority FROM ReschedulingRequest WHERE id = ?', [id]) as any

  const updates: string[] = []
  const params: any[] = []

  if (body.status) { updates.push('status = ?'); params.push(body.status) }
  if (body.priority) { updates.push('priority = ?'); params.push(body.priority) }
  if (body.notes !== undefined) { updates.push('notes = ?'); params.push(body.notes) }
  if (body.reviewedBy !== undefined) { updates.push('reviewedBy = ?'); params.push(body.reviewedBy) }

  if (updates.length > 0) {
    updates.push('reviewedAt = ?')
    params.push(new Date().toISOString())
    params.push(id)
    queryRun(`UPDATE ReschedulingRequest SET ${updates.join(', ')} WHERE id = ?`, params)
  }

  // Create audit log for status change with previous and new status info
  if (body.status) {
    const newStatus = body.status
    const previousStatus = reqData?.status || 'unknown'
    queryRun(`INSERT INTO AuditLog (id, requestId, action, performedBy, performedByUserId, details, category, previousValue, newValue, affectedRecord) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [generateId(), id, newStatus, auth.user?.email || auth.user?.id || 'unknown', auth.user?.id || null,
        JSON.stringify({ previousStatus, newStatus, priority: reqData?.priority || 'normal', changedBy: auth.user?.email || auth.user?.id, notes: body.notes || null }),
        'request', previousStatus, newStatus, id])
  }

  const updated = queryFirst('SELECT * FROM ReschedulingRequest WHERE id = ?', [id])
  return c.json(updated)
})

// POST /api/officer-call — Attempt a real carrier call, with browser-demo fallback
app.post('/api/officer-call', async (c) => {
  const token = extractToken(c)
  const auth = await verifyAuth(token || '')
  if (!auth.authenticated) return c.json({ error: auth.error }, 401)

  const body = await c.req.json().catch(() => ({})) as Record<string, any>
  const to = normalizeE164Phone(body.to)
  if (!to) return c.json({ error: 'A valid E.164 phone number is required, for example +971501234567.' }, 400)

  const requestId = typeof body.caseId === 'string' ? body.caseId : null
  const language = body.language === 'ar' ? 'ar' : 'en'
  const brief = Array.isArray(body.brief)
    ? body.brief.map((line) => String(line)).join(' ')
    : String(body.brief || '')

  const result = await placeTwilioOfficerCall({ to, brief, language, requestId })

  queryRun(`INSERT INTO AuditLog (id, requestId, action, performedBy, performedByUserId, details, category, affectedRecord) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      generateId(),
      requestId,
      result.mode === 'real' ? 'officer_call_placed' : 'officer_call_demo_fallback',
      auth.user?.email || auth.user?.id || 'unknown',
      auth.user?.id || null,
      JSON.stringify({
        to,
        provider: result.provider,
        mode: result.mode,
        callSid: 'callSid' in result ? result.callSid : null,
        callStatus: 'callStatus' in result ? result.callStatus : null,
        decisionCapture: 'decisionCapture' in result ? result.decisionCapture : null,
        missingConfig: 'missingConfig' in result ? result.missingConfig : [],
        error: 'error' in result ? result.error : null,
        message: result.message,
      }),
      'request',
      requestId,
    ])

  return c.json({
    success: true,
    to,
    ...result,
  })
})

// GET /api/officer-call/audio — Signed ElevenLabs MP3 prompt for Twilio <Play>
app.get('/api/officer-call/audio', async (c) => {
  const requestId = c.req.query('requestId') || ''
  const language = c.req.query('lang') === 'ar' ? 'ar' : 'en'
  const rawKind = c.req.query('kind')
  const kind: CallAudioKind = rawKind === 'decision_prompt'
    ? 'decision_prompt'
    : rawKind === 'beneficiary_notification'
      ? 'beneficiary_notification'
      : 'brief'
  const signature = c.req.query('sig')

  if (!requestId || !verifyOfficerCallWebhook(requestId, language, signature)) {
    return c.text('Invalid audio signature', 403)
  }

  const audioText = OFFICER_CALL_AUDIO_TEXTS.get(officerCallAudioKey(requestId, language, kind))
  if (!audioText || Date.now() - audioText.createdAt > 15 * 60 * 1000) {
    return c.text('Call audio prompt expired. Start the officer call again.', 410)
  }

  try {
    const audio = await generateElevenLabsSpeech(audioText.text, audioText.language)
    c.header('Content-Type', 'audio/mpeg')
    c.header('Cache-Control', 'public, max-age=900')
    return c.body(audio)
  } catch (err: any) {
    console.error('ElevenLabs call audio error:', err?.message || err)
    return c.text('ElevenLabs audio generation failed', 503)
  }
})

// POST /api/beneficiary-call — Notify the citizen after a final officer decision
app.post('/api/beneficiary-call', async (c) => {
  const token = extractToken(c)
  const auth = await verifyAuth(token || '')
  if (!auth.authenticated) return c.json({ error: auth.error }, 401)

  const body = await c.req.json().catch(() => ({})) as Record<string, any>
  const requestId = typeof body.caseId === 'string' ? body.caseId : null
  if (!requestId) return c.json({ error: 'caseId is required.' }, 400)

  const request = queryFirst('SELECT * FROM ReschedulingRequest WHERE id = ?', [requestId]) as any
  if (!request) return c.json({ error: 'Request not found.' }, 404)
  if (!['approved', 'rejected', 'escalated'].includes(String(request.status))) {
    return c.json({ error: 'Beneficiary notification is only available after approval, rejection, or escalation.' }, 400)
  }

  const applicant = queryFirst('SELECT * FROM Applicant WHERE id = ?', [request.applicantId]) as any
  const assessment = queryFirst('SELECT * FROM AIAssessment WHERE requestId = ?', [requestId]) as any
  const language = body.language === 'en' ? 'en' : 'ar'
  const explicitPhone = typeof body.to === 'string' && body.to.trim().length > 0
  const to = explicitPhone
    ? (normalizeE164Phone(body.to) || normalizeUaePhone(body.to))
    : normalizeUaePhone(applicant?.phone)
  if (!to) return c.json({ error: 'A valid beneficiary phone number is required.' }, 400)

  const notificationMessage = buildBeneficiaryNotificationMessage({
    request,
    applicant,
    assessment,
    language,
    rejectionReason: typeof body.reason === 'string' ? body.reason : undefined,
  })
  const result = await placeTwilioBeneficiaryCall({
    to,
    message: notificationMessage,
    language,
    requestId,
  })

  queryRun(`INSERT INTO AuditLog (id, requestId, action, performedBy, performedByUserId, details, category, affectedRecord) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      generateId(),
      requestId,
      result.mode === 'real' ? 'beneficiary_call_placed' : 'beneficiary_call_demo_fallback',
      auth.user?.email || auth.user?.id || 'unknown',
      auth.user?.id || null,
      JSON.stringify({
        to,
        status: request.status,
        language,
        provider: result.provider,
        mode: result.mode,
        callSid: 'callSid' in result ? result.callSid : null,
        callStatus: 'callStatus' in result ? result.callStatus : null,
        voiceProvider: 'voiceProvider' in result ? result.voiceProvider : null,
        missingConfig: 'missingConfig' in result ? result.missingConfig : [],
        error: 'error' in result ? result.error : null,
        message: result.message,
        notificationPreview: notificationMessage.slice(0, 220),
      }),
      'request',
      requestId,
    ])

  return c.json({
    success: true,
    to,
    notificationMessage,
    ...result,
  })
})

// POST /api/officer-call/decision — Twilio webhook for speech/DTMF officer decisions
app.post('/api/officer-call/decision', async (c) => {
  const requestId = c.req.query('requestId') || ''
  const language = c.req.query('lang') === 'ar' ? 'ar' : 'en'
  const signature = c.req.query('sig')

  const respond = (message: string, status = 200) => {
    c.header('Content-Type', 'text/xml; charset=utf-8')
    return c.body(['<Response>', twimlSay(message, language), '</Response>'].join(''), status)
  }

  if (!requestId || !verifyOfficerCallWebhook(requestId, language, signature)) {
    return respond(language === 'ar'
      ? 'تعذر التحقق من صلاحية رابط القرار. الرجاء العودة إلى شاشة الوزارة.'
      : 'The decision link could not be verified. Please return to the MOEI console.', 403)
  }

  const request = queryFirst('SELECT id, status, notes FROM ReschedulingRequest WHERE id = ?', [requestId]) as any
  if (!request) {
    return respond(language === 'ar'
      ? 'لم أجد ملف الحالة المطلوب. الرجاء العودة إلى شاشة الوزارة.'
      : 'I could not find the requested case. Please return to the MOEI console.', 404)
  }

  const form = await c.req.parseBody().catch(() => ({})) as Record<string, any>
  const digits = typeof form.Digits === 'string' ? form.Digits : ''
  const speechResult = typeof form.SpeechResult === 'string' ? form.SpeechResult : ''
  const rawDecision = speechResult || digits
  const action = parseOfficerDecisionCommand(rawDecision)

  if (!action) {
    const retryUrl = buildOfficerDecisionWebhookUrl(requestId, language)
    c.header('Content-Type', 'text/xml; charset=utf-8')
    return c.body([
      '<Response>',
      retryUrl ? `<Gather input="speech dtmf" action="${escapeXml(retryUrl)}" method="POST" language="${language === 'ar' ? 'ar-AE' : 'en-US'}" speechTimeout="auto" timeout="8" numDigits="1">` : '',
      twimlSay(language === 'ar'
        ? 'ما وصلني قرار واضح. قل نعم للاعتماد، لا للرفض، أو إحالة لموظف. أو اضغط 1، 2، أو 3.'
        : 'I did not receive a clear decision. Say yes to approve, no to reject, or escalate to officer. Or press 1, 2, or 3.', language),
      retryUrl ? '</Gather>' : '',
      twimlSay(language === 'ar'
        ? 'لم يتم تحديث الحالة. الرجاء العودة إلى شاشة الوزارة.'
        : 'The case was not updated. Please return to the MOEI console.', language),
      '</Response>',
    ].join(''))
  }

  const nextStatus = statusForOfficerDecision(action)
  const now = new Date().toISOString()
  const note = language === 'ar'
    ? `قرار مكالمة الموظف عبر Twilio: ${nextStatus}. العبارة/المدخل: ${rawDecision || digits || '-'}.`
    : `Officer phone decision via Twilio: ${nextStatus}. Phrase/input: ${rawDecision || digits || '-'}.`
  const notes = [request.notes, note].filter(Boolean).join('\n')

  queryRun('UPDATE ReschedulingRequest SET status = ?, notes = ?, reviewedBy = ?, reviewedAt = ?, updatedAt = ? WHERE id = ?',
    [nextStatus, notes, 'twilio:officer-call', now, now, requestId])

  queryRun(`INSERT INTO AuditLog (id, requestId, action, performedBy, details, category, previousValue, newValue, affectedRecord) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      generateId(),
      requestId,
      nextStatus,
      'twilio:officer-call',
      JSON.stringify({
        previousStatus: request.status,
        newStatus: nextStatus,
        parsedAction: action,
        rawDecision,
        digits,
        speechResult,
        speechConfidence: form.Confidence || null,
        callSid: form.CallSid || null,
        from: form.From || null,
        to: form.To || null,
      }),
      'request',
      request.status,
      nextStatus,
      requestId,
    ])

  return respond(language === 'ar'
    ? `تم استلام قرارك وتحديث الحالة إلى ${nextStatus === 'approved' ? 'معتمد' : nextStatus === 'rejected' ? 'مرفوض' : 'محال للمراجعة'}. شكرا.`
    : `Your decision was received and the case is now ${nextStatus}. Thank you.`)
})

// ── System Config Routes ────────────────────────────────────────────
app.get('/api/system-config', async (c) => {
  const category = c.req.query('category')
  const isPublic = c.req.query('public')

  let sql = 'SELECT * FROM SystemConfig WHERE isActive = 1'
  const params: any[] = []

  if (category) { sql += ' AND category = ?'; params.push(category) }
  if (isPublic === 'true') { sql += ' AND isPublic = 1' }

  sql += ' ORDER BY category, labelEN'

  const configs = query(sql, params).results

  // Group by category
  const grouped: Record<string, any[]> = {}
  for (const cfg of (configs || []) as any[]) {
    if (!grouped[cfg.category]) grouped[cfg.category] = []
    grouped[cfg.category].push({
      ...cfg,
      isActive: !!cfg.isActive,
      isPublic: !!cfg.isPublic,
    })
  }

  return c.json(grouped)
})

app.patch('/api/system-config', async (c) => {
  const token = extractToken(c)
  const auth = await verifyAuth(token || '')
  if (!auth.authenticated) return c.json({ error: auth.error }, 401)

  try {
    const updates = await c.req.json()
    if (!Array.isArray(updates)) return c.json({ error: 'Expected array of updates' }, 400)

    for (const update of updates) {
      if (update.configKey && update.configValue !== undefined) {
        queryRun('UPDATE SystemConfig SET configValue = ?, updatedAt = ? WHERE configKey = ?',
          [String(update.configValue), new Date().toISOString(), update.configKey])
      }
    }

    // Invalidate config cache after updates
    invalidateConfigCache()

    return c.json({ success: true, updated: updates.length })
  } catch (error: any) {
    return c.json({ error: 'Failed to update configs' }, 500)
  }
})

app.post('/api/system-config/seed', async (c) => {
  const token = extractToken(c)
  const auth = await verifyAuth(token || '')
  if (!auth.authenticated) return c.json({ error: auth.error }, 401)

  const defaultConfigs = [
    // ── DBR Limits ─────────────────────────────────────────────────
    { configKey: 'max_dbr_limit', configValue: '0.6', defaultValue: '0.6', labelEN: 'Maximum DBR Limit', labelAR: 'الحد الأقصى لنسبة عبء الدين', descriptionEN: 'Maximum Debt Burden Ratio allowed. Cases above this are auto-rejected per Cabinet Resolution 61/2021.', descriptionAR: 'الحد الأقصى المسموح لنسبة عبء الدين. الحالات التي تتجاوز هذا الحد تُرفض تلقائياً وفقاً لقرار مجلس الوزراء 61/2021.', category: 'dbr_limits', valueType: 'number', min: 0.1, max: 1.0, unit: '%', isPublic: 1 },
    { configKey: 'dbr_healthy_limit', configValue: '0.35', defaultValue: '0.35', labelEN: 'Healthy DBR Threshold', labelAR: 'عتبة نسبة عبء الدين الصحية', descriptionEN: 'DBR below this is considered healthy/low risk. Shown as green indicator to customers.', descriptionAR: 'نسبة عبء الدين أقل من هذا المستوى تعتبر صحية/منخفضة المخاطر. تظهر كمؤشر أخضر للعملاء.', category: 'dbr_limits', valueType: 'number', min: 0.1, max: 0.6, unit: '%', isPublic: 1 },
    { configKey: 'dbr_caution_limit', configValue: '0.5', defaultValue: '0.5', labelEN: 'Caution DBR Threshold', labelAR: 'عتبة تحذير نسبة عبء الدين', descriptionEN: 'DBR between healthy and this value is caution zone (yellow). Above this is high risk (red).', descriptionAR: 'نسبة عبء الدين بين المستوى الصحي وهذه القيمة هي منطقة تحذير (صفراء). أعلى من هذا مخاطر عالية (حمراء).', category: 'dbr_limits', valueType: 'number', min: 0.2, max: 0.7, unit: '%', isPublic: 1 },
    // ── Risk Score Thresholds ───────────────────────────────────────
    { configKey: 'risk_threshold_low', configValue: '30', defaultValue: '30', labelEN: 'Low Risk Threshold', labelAR: 'عتبة المخاطر المنخفضة', descriptionEN: 'Risk score 0 to this value = LOW risk. Low risk cases may be auto-approved.', descriptionAR: 'درجة المخاطر من 0 إلى هذه القيمة = مخاطر منخفضة. حالات المخاطر المنخفضة قد تحظى بموافقة تلقائية.', category: 'risk_thresholds', valueType: 'number', min: 0, max: 100, unit: 'points', isPublic: 0 },
    { configKey: 'risk_threshold_medium', configValue: '50', defaultValue: '50', labelEN: 'Medium Risk Threshold', labelAR: 'عتبة المخاطر المتوسطة', descriptionEN: 'Risk score above low and up to this value = MEDIUM risk. Requires standard review.', descriptionAR: 'درجة المخاطر أعلى من المنخفضة وحتى هذه القيمة = مخاطر متوسطة. تتطلب مراجعة عادية.', category: 'risk_thresholds', valueType: 'number', min: 10, max: 100, unit: 'points', isPublic: 0 },
    { configKey: 'risk_threshold_high', configValue: '70', defaultValue: '70', labelEN: 'High Risk Threshold', labelAR: 'عتبة المخاطر العالية', descriptionEN: 'Risk score above medium and up to this value = HIGH risk. Requires detailed review.', descriptionAR: 'درجة المخاطر أعلى من المتوسطة وحتى هذه القيمة = مخاطر عالية. تتطلب مراجعة تفصيلية.', category: 'risk_thresholds', valueType: 'number', min: 20, max: 100, unit: 'points', isPublic: 0 },
    { configKey: 'delay_low_risk_days', configValue: '90', defaultValue: '90', labelEN: 'Low Risk Delay Threshold (days)', labelAR: 'عتبة التأخير المنخفض المخاطر (يوم)', descriptionEN: 'Delay days up to this value classified as lower risk.', descriptionAR: 'أيام التأخير حتى هذه القيمة مصنفة كمخاطر أقل.', category: 'risk_thresholds', valueType: 'number', min: 1, max: 365, unit: 'days', isPublic: 0 },
    { configKey: 'delay_high_risk_days', configValue: '180', defaultValue: '180', labelEN: 'High Risk Delay Threshold (days)', labelAR: 'عتبة التأخير عالي المخاطر (يوم)', descriptionEN: 'Delay days exceeding this value classified as HIGH RISK.', descriptionAR: 'أيام التأخير التي تتجاوز هذه القيمة مصنفة كمخاطر عالية.', category: 'risk_thresholds', valueType: 'number', min: 30, max: 730, unit: 'days', isPublic: 0 },
    { configKey: 'delay_severe_days', configValue: '365', defaultValue: '365', labelEN: 'Severe Distress Delay (days)', labelAR: 'تأخير الضائقة الشديدة (يوم)', descriptionEN: 'Delay days exceeding this value indicate severe financial distress.', descriptionAR: 'أيام التأخير التي تتجاوز هذه القيمة تشير إلى ضائقة مالية شديدة.', category: 'risk_thresholds', valueType: 'number', min: 90, max: 1825, unit: 'days', isPublic: 0 },
    // ── Loan Limits ─────────────────────────────────────────────────
    { configKey: 'max_loan_duration_months', configValue: '360', defaultValue: '360', labelEN: 'Maximum Loan Duration', labelAR: 'الحد الأقصى لمدة القرض', descriptionEN: 'Maximum loan duration in months per SZHP policy. Currently 30 years (360 months).', descriptionAR: 'الحد الأقصى لمدة القرض بالأشهر وفقاً لسياسة برنامج الشيخ زايد. حالياً 30 سنة (360 شهراً).', category: 'loan_limits', valueType: 'number', min: 12, max: 600, unit: 'months', isPublic: 1 },
    { configKey: 'min_loan_duration_months', configValue: '12', defaultValue: '12', labelEN: 'Minimum Loan Duration', labelAR: 'الحد الأدنى لمدة القرض', descriptionEN: 'Minimum loan duration in months.', descriptionAR: 'الحد الأدنى لمدة القرض بالأشهر.', category: 'loan_limits', valueType: 'number', min: 1, max: 60, unit: 'months', isPublic: 0 },
    { configKey: 'max_grant_amount', configValue: '800000', defaultValue: '800000', labelEN: 'Maximum Grant Amount (AED)', labelAR: 'الحد الأقصى لمبلغ المنحة (درهم)', descriptionEN: 'Maximum assistance amount for grants per SZHP policy.', descriptionAR: 'الحد الأقصى لمبلغ المساعدة للمنح وفقاً لسياسة برنامج الشيخ زايد.', category: 'loan_limits', valueType: 'number', min: 10000, max: 2000000, unit: 'AED', isPublic: 1 },
    { configKey: 'max_housing_loan_amount', configValue: '1500000', defaultValue: '1500000', labelEN: 'Maximum Housing Loan Amount (AED)', labelAR: 'الحد الأقصى لمبلغ القرض الإسكاني (درهم)', descriptionEN: 'Maximum housing loan amount per SZHP policy.', descriptionAR: 'الحد الأقصى لمبلغ القرض الإسكاني وفقاً لسياسة برنامج الشيخ زايد.', category: 'loan_limits', valueType: 'number', min: 100000, max: 5000000, unit: 'AED', isPublic: 0 },
    { configKey: 'max_maintenance_amount', configValue: '200000', defaultValue: '200000', labelEN: 'Maximum Maintenance Amount (AED)', labelAR: 'الحد الأقصى لمبلغ الصيانة (درهم)', descriptionEN: 'Maximum maintenance loan amount per SZHP policy.', descriptionAR: 'الحد الأقصى لمبلغ قرض الصيانة وفقاً لسياسة برنامج الشيخ زايد.', category: 'loan_limits', valueType: 'number', min: 10000, max: 500000, unit: 'AED', isPublic: 0 },
    // ── Eligibility ─────────────────────────────────────────────────
    { configKey: 'income_per_member_threshold', configValue: '2500', defaultValue: '2500', labelEN: 'Income Per Member Threshold', labelAR: 'عتبة الدخل لكل فرد', descriptionEN: 'Minimum income per family member (AED). Used in the 20% deduction rule for SZHP rescheduling eligibility.', descriptionAR: 'الحد الأدنى للدخل لكل فرد في الأسرة (درهم). يُستخدم في قاعدة الخصم 20% لأهلية إعادة الجدولة.', category: 'eligibility', valueType: 'number', min: 0, max: 10000, unit: 'AED', isPublic: 1 },
    { configKey: 'moei_max_deduction_rate', configValue: '0.20', defaultValue: '0.20', labelEN: 'MOEI Maximum Deduction Rate', labelAR: 'الحد الأقصى لنسبة الخصم', descriptionEN: 'Maximum proposed monthly deduction from income for arrears rescheduling under the 20% rule.', descriptionAR: 'الحد الأقصى للخصم الشهري المقترح من الدخل لإعادة جدولة المتأخرات وفق قاعدة 20%.', category: 'dbr_limits', valueType: 'number', min: 0.05, max: 0.5, unit: '%', isPublic: 1 },
    { configKey: 'citizenship_required', configValue: 'true', defaultValue: 'true', labelEN: 'UAE Citizenship Required', labelAR: 'مطلوب الجنسية الإماراتية', descriptionEN: 'Whether UAE citizenship is mandatory for any housing assistance per MOEI policy.', descriptionAR: 'ما إذا كانت الجنسية الإماراتية إلزامية لأي مساعدة إسكانية وفقاً لسياسة وزارة الاقتصاد.', category: 'eligibility', valueType: 'boolean', isPublic: 0 },
    { configKey: 'family_book_required', configValue: 'true', defaultValue: 'true', labelEN: 'Family Book Required', labelAR: 'مطلوب دفتر العائلة', descriptionEN: 'Whether a UAE family book (Khulasat Al Qaid) is mandatory for housing assistance.', descriptionAR: 'ما إذا كان دفتر العائلة (خلاصة القيد) إلزامياً للمساعدة الإسكانية.', category: 'eligibility', valueType: 'boolean', isPublic: 0 },
    { configKey: 'min_monthly_income', configValue: '3000', defaultValue: '3000', labelEN: 'Minimum Monthly Income (AED)', labelAR: 'الحد الأدنى للدخل الشهري (درهم)', descriptionEN: 'Minimum monthly income to be eligible for rescheduling.', descriptionAR: 'الحد الأدنى للدخل الشهري للأهلية لإعادة الجدولة.', category: 'eligibility', valueType: 'number', min: 0, max: 50000, unit: 'AED', isPublic: 0 },
    { configKey: 'eligibility_check_enabled', configValue: 'true', defaultValue: 'true', labelEN: 'Eligibility Check (Emirati + Loan)', labelAR: 'التحقق من الأهلية (إماراتي + قرض)', descriptionEN: 'Enable Emirati + active loan eligibility check before request submission.', descriptionAR: 'تمكين التحقق من الأهلية (إماراتي + قرض نشط) قبل تقديم الطلب.', category: 'eligibility', valueType: 'boolean', isPublic: 1 },
    // ── Auto-Approval Rules ─────────────────────────────────────────
    { configKey: 'auto_approve_enabled', configValue: 'true', defaultValue: 'true', labelEN: 'Auto-Approval Enabled', labelAR: 'الموافقة التلقائية مفعلة', descriptionEN: 'Enable or disable automatic approval for low-risk SZHP rescheduling cases.', descriptionAR: 'تمكين أو تعطيل الموافقة التلقائية لحالات إعادة الجدولة منخفضة المخاطر.', category: 'auto_approve', valueType: 'boolean', isPublic: 0 },
    { configKey: 'auto_approve_max_risk_score', configValue: '30', defaultValue: '30', labelEN: 'Auto-Approve Max Risk Score', labelAR: 'الحد الأقصى لدرجة المخاطر للموافقة التلقائية', descriptionEN: 'Cases with risk score at or below this value are auto-approved.', descriptionAR: 'الحالات التي تبلغ درجة مخاطرها هذه القيمة أو أقل تحظى بموافقة تلقائية.', category: 'auto_approve', valueType: 'number', min: 0, max: 80, unit: 'points', isPublic: 0 },
    { configKey: 'auto_approve_max_dbr', configValue: '0.4', defaultValue: '0.4', labelEN: 'Auto-Approve Max DBR', labelAR: 'الحد الأقصى لنسبة عبء الدين للموافقة التلقائية', descriptionEN: 'Cases with proposed DBR at or below this value may be auto-approved.', descriptionAR: 'الحالات التي تبلغ نسبة عبء الدين المقترحة هذه القيمة أو أقل قد تحظى بموافقة تلقائية.', category: 'auto_approve', valueType: 'number', min: 0.1, max: 0.6, unit: '%', isPublic: 0 },
    { configKey: 'auto_approve_max_delay_days', configValue: '90', defaultValue: '90', labelEN: 'Auto-Approve Max Delay Days', labelAR: 'الحد الأقصى لأيام التأخير للموافقة التلقائية', descriptionEN: 'Cases with delay days at or below this value may be auto-approved.', descriptionAR: 'الحالات التي تبلغ أيام تأخيرها هذه القيمة أو أقل قد تحظى بموافقة تلقائية.', category: 'auto_approve', valueType: 'number', min: 0, max: 365, unit: 'days', isPublic: 0 },
    { configKey: 'auto_approve_gov_only', configValue: 'false', defaultValue: 'false', labelEN: 'Auto-Approve Government Employees Only', labelAR: 'الموافقة التلقائية للموظفين الحكوميين فقط', descriptionEN: 'If enabled, only government employees qualify for auto-approval.', descriptionAR: 'إذا تم التمكين، فقط الموظفون الحكوميون مؤهلون للموافقة التلقائية.', category: 'auto_approve', valueType: 'boolean', isPublic: 0 },
    // ── Auto-Rejection Rules ────────────────────────────────────────
    { configKey: 'auto_reject_enabled', configValue: 'true', defaultValue: 'true', labelEN: 'Auto-Rejection Enabled', labelAR: 'الرفض التلقائي مفعل', descriptionEN: 'Enable or disable automatic rejection for ineligible SZHP cases.', descriptionAR: 'تمكين أو تعطيل الرفض التلقائي للحالات غير المؤهلة.', category: 'auto_reject', valueType: 'boolean', isPublic: 0 },
    { configKey: 'auto_reject_min_dbr', configValue: '0.6', defaultValue: '0.6', labelEN: 'Auto-Reject DBR Threshold', labelAR: 'عتبة نسبة عبء الدين للرفض التلقائي', descriptionEN: 'Cases with proposed DBR exceeding this value are auto-rejected.', descriptionAR: 'الحالات التي تتجاوز نسبة عبء الدين المقترحة هذه القيمة تُرفض تلقائياً.', category: 'auto_reject', valueType: 'number', min: 0.3, max: 1.0, unit: '%', isPublic: 0 },
    { configKey: 'auto_reject_min_risk_score', configValue: '80', defaultValue: '80', labelEN: 'Auto-Reject Min Risk Score', labelAR: 'الحد الأدنى لدرجة المخاطر للرفض التلقائي', descriptionEN: 'Cases with risk score at or above this value are auto-rejected.', descriptionAR: 'الحالات التي تبلغ درجة مخاطرها هذه القيمة أو أكثر تُرفض تلقائياً.', category: 'auto_reject', valueType: 'number', min: 50, max: 100, unit: 'points', isPublic: 0 },
    { configKey: 'auto_reject_min_delay_days', configValue: '365', defaultValue: '365', labelEN: 'Auto-Reject Delay Days Threshold', labelAR: 'عتبة أيام التأخير للرفض التلقائي', descriptionEN: 'Cases with delay days exceeding this value may be auto-rejected.', descriptionAR: 'الحالات التي تتجاوز أيام تأخيرها هذه القيمة قد تُرفض تلقائياً.', category: 'auto_reject', valueType: 'number', min: 90, max: 1825, unit: 'days', isPublic: 0 },
    { configKey: 'auto_reject_non_citizen', configValue: 'true', defaultValue: 'true', labelEN: 'Auto-Reject Non-Citizens', labelAR: 'الرفض التلقائي لغير المواطنين', descriptionEN: 'If enabled, non-UAE citizens are automatically rejected.', descriptionAR: 'إذا تم التمكين، يتم رفض غير مواطني الإمارات تلقائياً.', category: 'auto_reject', valueType: 'boolean', isPublic: 0 },
    // ── Human Review ────────────────────────────────────────────────
    { configKey: 'human_review_risk_threshold', configValue: '50', defaultValue: '50', labelEN: 'Human Review Risk Threshold', labelAR: 'عتبة المخاطر للمراجعة البشرية', descriptionEN: 'Cases with risk score above this value require human review.', descriptionAR: 'الحالات التي تتجاوز درجة مخاطرها هذه القيمة تتطلب مراجعة بشرية.', category: 'human_review', valueType: 'number', min: 0, max: 100, unit: 'points', isPublic: 0 },
    { configKey: 'human_review_dbr_threshold', configValue: '0.5', defaultValue: '0.5', labelEN: 'Human Review DBR Threshold', labelAR: 'عتبة نسبة عبء الدين للمراجعة البشرية', descriptionEN: 'Cases with proposed DBR above this value require human review.', descriptionAR: 'الحالات التي تتجاوز نسبة عبء الدين المقترحة هذه القيمة تتطلب مراجعة بشرية.', category: 'human_review', valueType: 'number', min: 0.2, max: 0.8, unit: '%', isPublic: 0 },
    { configKey: 'human_review_delay_days', configValue: '180', defaultValue: '180', labelEN: 'Human Review Delay Days', labelAR: 'أيام التأخير للمراجعة البشرية', descriptionEN: 'Cases with delay days above this value require human review.', descriptionAR: 'الحالات التي تتجاوز أيام تأخيرها هذه القيمة تتطلب مراجعة بشرية.', category: 'human_review', valueType: 'number', min: 30, max: 730, unit: 'days', isPublic: 0 },
    { configKey: 'human_review_estimated_days', configValue: '14', defaultValue: '14', labelEN: 'Estimated Review Days', labelAR: 'أيام المراجعة المقدرة', descriptionEN: 'Estimated number of business days for human review.', descriptionAR: 'العدد المقدر من أيام العمل للمراجعة البشرية.', category: 'human_review', valueType: 'number', min: 1, max: 60, unit: 'days', isPublic: 0 },
    // ── Employer Risk Weights ───────────────────────────────────────
    { configKey: 'employer_weight_government', configValue: '0.8', defaultValue: '0.8', labelEN: 'Government Employee Risk Weight', labelAR: 'معامل مخاطر الموظف الحكومي', descriptionEN: 'Risk multiplier for government employees. Below 1.0 = favorable (lower risk).', descriptionAR: 'معامل المخاطر للموظفين الحكوميين. أقل من 1.0 = مؤاتي (مخاطر أقل).', category: 'employer_weights', valueType: 'number', min: 0.1, max: 2.0, unit: '×', isPublic: 0 },
    { configKey: 'employer_weight_semi_government', configValue: '1.0', defaultValue: '1.0', labelEN: 'Semi-Government Employee Risk Weight', labelAR: 'معامل مخاطر الموظف شبه الحكومي', descriptionEN: 'Risk multiplier for semi-government employees. 1.0 = neutral.', descriptionAR: 'معامل المخاطر للموظفين شبه الحكوميين. 1.0 = محايد.', category: 'employer_weights', valueType: 'number', min: 0.1, max: 2.0, unit: '×', isPublic: 0 },
    { configKey: 'employer_weight_private', configValue: '1.3', defaultValue: '1.3', labelEN: 'Private Sector Employee Risk Weight', labelAR: 'معامل مخاطر موظف القطاع الخاص', descriptionEN: 'Risk multiplier for private sector employees. Above 1.0 = higher risk.', descriptionAR: 'معامل المخاطر لموظفي القطاع الخاص. أعلى من 1.0 = مخاطر أعلى.', category: 'employer_weights', valueType: 'number', min: 0.1, max: 3.0, unit: '×', isPublic: 0 },
    // ── Grace Period ────────────────────────────────────────────────
    { configKey: 'max_grace_period_months', configValue: '6', defaultValue: '6', labelEN: 'Maximum Grace Period (months)', labelAR: 'الحد الأقصى لفترة السماح (شهر)', descriptionEN: 'Maximum grace period allowed before rescheduled payments begin.', descriptionAR: 'الحد الأقصى لفترة السماح المسموح بها قبل بدء الأقساط المعاد جدولتها.', category: 'grace_period', valueType: 'number', min: 0, max: 24, unit: 'months', isPublic: 0 },
    { configKey: 'grace_period_for_medical', configValue: '3', defaultValue: '3', labelEN: 'Grace Period for Medical Cases', labelAR: 'فترة السماح للحالات الطبية', descriptionEN: 'Default grace period for medical hardship cases.', descriptionAR: 'فترة السماح الافتراضية لحالات الطوارئ الطبية.', category: 'grace_period', valueType: 'number', min: 0, max: 12, unit: 'months', isPublic: 0 },
    { configKey: 'grace_period_for_divorce', configValue: '3', defaultValue: '3', labelEN: 'Grace Period for Divorce Cases', labelAR: 'فترة السماح لحالات الطلاق', descriptionEN: 'Default grace period for divorce cases.', descriptionAR: 'فترة السماح الافتراضية لحالات الطلاق.', category: 'grace_period', valueType: 'number', min: 0, max: 12, unit: 'months', isPublic: 0 },
    // ── Documents & Upload ──────────────────────────────────────────
    { configKey: 'salary_certificate_required', configValue: 'true', defaultValue: 'true', labelEN: 'Salary Certificate Required', labelAR: 'مطلوب شهادة الراتب', descriptionEN: 'Whether a salary certificate is mandatory for rescheduling applications.', descriptionAR: 'ما إذا كانت شهادة الراتب إلزامية لطلبات إعادة الجدولة.', category: 'documents', valueType: 'boolean', isPublic: 1 },
    { configKey: 'ai_analysis_mode', configValue: 'optional', defaultValue: 'optional', labelEN: 'AI Analysis Mode', labelAR: 'وضع تحليل الذكاء الاصطناعي', descriptionEN: 'Whether AI document analysis is optional or required.', descriptionAR: 'ما إذا كان تحليل المستندات بالذكاء الاصطناعي اختياري أو مطلوب.', category: 'documents', valueType: 'string', isPublic: 1 },
    { configKey: 'max_file_upload_size_mb', configValue: '10', defaultValue: '10', labelEN: 'Max File Upload Size (MB)', labelAR: 'الحد الأقصى لحجم الملف (ميجابايت)', descriptionEN: 'Maximum file size allowed for document uploads in megabytes.', descriptionAR: 'الحد الأقصى لحجم الملف المسموح به لرفع المستندات بالميجابايت.', category: 'documents', valueType: 'number', min: 1, max: 50, unit: 'MB', isPublic: 0 },
    // ── Landing Page Metrics ────────────────────────────────────────
    { configKey: 'landing_automation_rate', configValue: '85', defaultValue: '85', labelEN: 'Automation Rate (%)', labelAR: 'معدل الأتمتة (%)', descriptionEN: 'Percentage shown on the landing page for automation rate metric.', descriptionAR: 'النسبة المئوية المعروضة في الصفحة الرئيسية لمعدل الأتمتة.', category: 'landing_metrics', valueType: 'number', min: 0, max: 100, unit: '%', isPublic: 1 },
    { configKey: 'landing_assessment_time', configValue: '30', defaultValue: '30', labelEN: 'Assessment Time (seconds)', labelAR: 'وقت التقييم (ثانية)', descriptionEN: 'Assessment time in seconds shown on the landing page.', descriptionAR: 'وقت التقييم بالثواني المعروض في الصفحة الرئيسية.', category: 'landing_metrics', valueType: 'number', min: 1, max: 300, unit: 'seconds', isPublic: 1 },
    { configKey: 'landing_compliance_rate', configValue: '100', defaultValue: '100', labelEN: 'Compliance Rate (%)', labelAR: 'معدل الامتثال (%)', descriptionEN: 'Compliance percentage shown on the landing page.', descriptionAR: 'نسبة الامتثال المعروضة في الصفحة الرئيسية.', category: 'landing_metrics', valueType: 'number', min: 0, max: 100, unit: '%', isPublic: 1 },
    // ── System Branding ─────────────────────────────────────────────
    { configKey: 'system_version', configValue: '9.0.0', defaultValue: '9.0.0', labelEN: 'System Version', labelAR: 'إصدار النظام', descriptionEN: 'Current system version displayed in the footer.', descriptionAR: 'إصدار النظام الحالي المعروض في التذييل.', category: 'branding', valueType: 'string', isPublic: 1 },
    // ── AI Models ────────────────────────────────────────────────────
    { configKey: 'default_llm_id', configValue: '', defaultValue: '', labelEN: 'Default LLM Model', labelAR: 'نموذج اللغة الافتراضي', descriptionEN: 'ID of the default LLM model used for text analysis and chat.', descriptionAR: 'معرف نموذج اللغة الافتراضي المستخدم لتحليل النصوص والمحادثة.', category: 'ai_models', valueType: 'string', isPublic: 0 },
    { configKey: 'default_vlm_id', configValue: '', defaultValue: '', labelEN: 'Default VLM Model', labelAR: 'نموذج الرؤية الافتراضي', descriptionEN: 'ID of the default Vision Language Model used for document analysis.', descriptionAR: 'معرف نموذج الرؤية الافتراضي المستخدم لتحليل المستندات.', category: 'ai_models', valueType: 'string', isPublic: 0 },
    // ── Features ────────────────────────────────────────────────────
    { configKey: 'customer_chatbot_enabled', configValue: 'true', defaultValue: 'true', labelEN: 'Enable Customer Chatbot', labelAR: 'تفعيل روبوت المحادثة للعملاء', descriptionEN: 'Show the AI chatbot widget on the customer portal', descriptionAR: 'عرض أداة روبوت المحادثة على بوابة العملاء', category: 'features', valueType: 'boolean', isPublic: 1 },
    { configKey: 'admin_chatbot_enabled', configValue: 'true', defaultValue: 'true', labelEN: 'Enable Admin AI Assistant', labelAR: 'تفعيل المساعد الذكي للإدارة', descriptionEN: 'Show the AI assistant panel in the admin dashboard', descriptionAR: 'عرض لوحة المساعد الذكي في لوحة الإدارة', category: 'features', valueType: 'boolean', isPublic: 0 },
  ]

  let seeded = 0
  let updated = 0
  for (const cfg of defaultConfigs) {
    const existing = queryFirst('SELECT id FROM SystemConfig WHERE configKey = ?', [cfg.configKey]) as any
    if (!existing) {
      queryRun(`INSERT INTO SystemConfig (id, configKey, configValue, defaultValue, labelEN, labelAR, descriptionEN, descriptionAR, category, valueType, min, max, unit, isPublic, isActive)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [generateId(), cfg.configKey, cfg.configValue, cfg.defaultValue, cfg.labelEN, cfg.labelAR,
         (cfg as any).descriptionEN || null, (cfg as any).descriptionAR || null,
         cfg.category, cfg.valueType, cfg.min || null, cfg.max || null, cfg.unit || null, cfg.isPublic || 0])
      seeded++
    } else {
      // Update existing config with descriptions if missing
      queryRun(`UPDATE SystemConfig SET descriptionEN = COALESCE(descriptionEN, ?), descriptionAR = COALESCE(descriptionAR, ?), labelEN = ?, labelAR = ?, min = COALESCE(min, ?), max = COALESCE(max, ?), unit = COALESCE(unit, ?), updatedAt = ? WHERE configKey = ?`,
        [(cfg as any).descriptionEN || null, (cfg as any).descriptionAR || null, cfg.labelEN, cfg.labelAR,
         cfg.min || null, cfg.max || null, cfg.unit || null,
         new Date().toISOString(), cfg.configKey])
      updated++
    }
  }

  // Invalidate config cache after seeding
  invalidateConfigCache()

  return c.json({ success: true, seeded, updated, message: `Seeded ${seeded} new configs, updated ${updated} existing configs with descriptions` })
})

// ── Employees Routes ────────────────────────────────────────────────
app.get('/api/employees', async (c) => {
  const token = extractToken(c)
  const auth = await verifyAuth(token || '')
  if (!auth.authenticated) return c.json({ error: auth.error }, 401)

  const search = c.req.query('search')
  let sql = "SELECT id, email, firstnameEN, lastnameEN, fullnameEN, role, department, isActive, lastLoginAt, permissions FROM User WHERE role IN ('employee', 'reviewer', 'manager', 'admin', 'superadmin')"
  const params: any[] = []

  if (search) {
    sql += ' AND (email LIKE ? OR fullnameEN LIKE ?)'
    params.push(`%${search}%`, `%${search}%`)
  }

  sql += ' ORDER BY createdAt DESC'

  const employees = query(sql, params).results
  return c.json(employees)
})

// ── Models Routes ───────────────────────────────────────────────────
app.get('/api/models', async (c) => {
  const token = extractToken(c)
  const auth = await verifyAuth(token || '')
  if (!auth.authenticated) return c.json({ error: auth.error }, 401)

  const models = query('SELECT * FROM AIModelConfig ORDER BY createdAt DESC').results
  return c.json((models || []).map((m: any) => ({
    ...m,
    apiKey: maskApiKey(m.apiKey), // Uses shared maskApiKey
    hasApiKey: !!m.apiKey,
    isActive: !!m.isActive,
    isDefault: !!m.isDefault,
  })))
})

app.post('/api/models/seed', async (c) => {
  const token = extractToken(c)
  const auth = await verifyAuth(token || '')
  if (!auth.authenticated) return c.json({ error: auth.error }, 401)

  const defaultModels = [
    { name: 'Recentech AI — GLM-4-Flash', provider: 'recentech', modelId: 'glm-4-flash', baseUrl: process.env.RECENTECH_BASE_URL || 'https://recentech-ai-worker.42abudhabi424242.workers.dev/v1', apiKey: process.env.RECENTECH_API_KEY || 'rk_378538813a1da63282dbc24382a55cc8', isActive: 1, isDefault: 1, capabilities: '["chat","vision"]', maxTokens: 4096, temperature: 0.7, descriptionEN: 'Default fast model', descriptionAR: 'النموذج السريع الافتراضي' },
    { name: 'Recentech AI — GLM-4-Plus', provider: 'recentech', modelId: 'glm-4-plus', baseUrl: process.env.RECENTECH_BASE_URL || 'https://recentech-ai-worker.42abudhabi424242.workers.dev/v1', apiKey: process.env.RECENTECH_API_KEY || 'rk_378538813a1da63282dbc24382a55cc8', isActive: 1, isDefault: 0, capabilities: '["chat","vision"]', maxTokens: 4096, temperature: 0.7, descriptionEN: 'Balanced model', descriptionAR: 'نموذج متوازن' },
    { name: 'Recentech AI — GLM-5', provider: 'recentech', modelId: 'glm-5', baseUrl: process.env.RECENTECH_BASE_URL || 'https://recentech-ai-worker.42abudhabi424242.workers.dev/v1', apiKey: process.env.RECENTECH_API_KEY || 'rk_378538813a1da63282dbc24382a55cc8', isActive: 1, isDefault: 0, capabilities: '["chat","vision","thinking"]', maxTokens: 8192, temperature: 0.7, descriptionEN: 'Advanced reasoning', descriptionAR: 'استدلال متقدم' },
  ]

  let seeded = 0
  for (const model of defaultModels) {
    const existing = queryFirst('SELECT id FROM AIModelConfig WHERE modelId = ? AND provider = ?', [model.modelId, model.provider])
    if (!existing) {
      queryRun(`INSERT INTO AIModelConfig (id, name, provider, modelId, baseUrl, apiKey, isActive, isDefault, capabilities, maxTokens, temperature, descriptionEN, descriptionAR)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [generateId(), ...Object.values(model)])
      seeded++
    }
  }

  return c.json({ success: true, seeded })
})

// POST /api/models/test-connection
app.post('/api/models/test-connection', async (c) => {
  const token = extractToken(c)
  const auth = await verifyAuth(token || '')
  if (!auth.authenticated) return c.json({ error: auth.error }, 401)

  try {
    const body = await c.req.json()
    const config: AIProviderConfig = {
      provider: detectProvider(body.baseUrl || ''), // Uses shared detectProvider
      modelId: body.modelId || 'glm-4-flash',
      baseUrl: body.baseUrl || '',
      apiKey: body.apiKey || '',
      maxTokens: body.maxTokens || 4096,
      temperature: body.temperature || 0.7,
      zaiToken: process.env.Z_AI_TOKEN || undefined,
      zaiUserId: process.env.Z_AI_USER_ID || undefined,
      zaiChatId: process.env.Z_AI_CHAT_ID || undefined,
    }

    // Uses shared testConnection
    const result = await aiTestConnection(config)
    return c.json(result)
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500)
  }
})

// ── Form Fields Routes ──────────────────────────────────────────────
app.get('/api/form-fields', (c) => {
  const fields = query("SELECT * FROM FormField WHERE isActive = 1 ORDER BY section, \"order\"").results
  return c.json(fields)
})

app.patch('/api/form-fields/:id', async (c) => {
  const token = extractToken(c)
  const auth = await verifyAuth(token || '')
  if (!auth.authenticated) return c.json({ error: auth.error }, 401)

  try {
    const id = c.req.param('id')
    const body = await c.req.json()
    const updates: string[] = []
    const params: any[] = []

    if (body.aiValidationPrompt !== undefined) {
      updates.push('aiValidationPrompt = ?')
      params.push(body.aiValidationPrompt)
    }
    if (body.aiAutoValidate !== undefined) {
      updates.push('aiAutoValidate = ?')
      params.push(body.aiAutoValidate ? 1 : 0)
    }

    if (updates.length === 0) return c.json({ error: 'No fields to update' }, 400)

    updates.push('updatedAt = ?')
    params.push(new Date().toISOString())
    params.push(id)

    queryRun(`UPDATE FormField SET ${updates.join(', ')} WHERE id = ?`, params)
    return c.json({ success: true })
  } catch (error: any) {
    return c.json({ error: 'Failed to update form field' }, 500)
  }
})

app.post('/api/form-fields/seed', async (c) => {
  // Comprehensive SZHP/MOEI housing arrears rescheduling form fields with project-specific AI prompts
  const defaultFields = [
    // ── Personal Section ─────────────────────────────────────────────
    { labelEN: 'Emirates ID', labelAR: 'رقم الهوية', fieldKey: 'emiratesId', fieldType: 'text', section: 'personal', required: 1, "order": 1,
      validation: '{"regex":"^784-\\\\d{4}-\\\\d{7}-\\\\d{1}$","customMessage":"Emirates ID must follow format 784-XXXX-XXXXXXX-X","customMessageAr":"يجب أن يتبع رقم الهوية التنسيق 784-XXXX-XXXXXXX-X"}',
      ruleDescriptionEN: 'Must be a valid 15-digit UAE Emirates ID', ruleDescriptionAR: 'يجب أن يكون رقم هوية إماراتي صالح',
      aiAutoValidate: 1,
      aiValidationPrompt: 'Verify this Emirates ID for SZHP housing arrears rescheduling. Check: 1) The ID follows the UAE format 784-XXXX-XXXXXXX-X, 2) The ID matches the UAE PASS authenticated identity, 3) The applicant is a UAE national (Emirati citizenship required per MOEI policy), 4) The ID has not been flagged in previous fraudulent submissions. Cross-reference with the Applicant database to confirm this citizen has an active housing loan. Flag any discrepancies between the ID and the authenticated session.' },
    { labelEN: 'Full Name (English)', labelAR: 'الاسم الكامل (بالإنجليزية)', fieldKey: 'nameEn', fieldType: 'text', section: 'personal', required: 0, "order": 2,
      validation: '{"regex":"^[A-Za-z\\\\s\\\\-]+$","minLength":2,"maxLength":100}',
      ruleDescriptionEN: 'English letters only, 2-100 characters', ruleDescriptionAR: 'حروف إنجليزية فقط، 2-100 حرف',
      aiAutoValidate: 1,
      aiValidationPrompt: 'Verify the English name for SZHP housing arrears rescheduling. Check: 1) The name uses only English/Latin letters, 2) The name matches the UAE PASS authenticated profile exactly (First Father Grandfather Family format), 3) The name matches the Applicant database record, 4) The name is consistent with the Arabic name (transliteration check). Flag any mismatch between UAE PASS, the application, and SZHP records.' },
    { labelEN: 'Full Name (Arabic)', labelAR: 'الاسم الكامل (بالعربية)', fieldKey: 'nameAr', fieldType: 'text', section: 'personal', required: 1, "order": 3,
      validation: '{"regex":"^[\\\\u0600-\\\\u06FF\\\\s\\\\-]+$","minLength":2,"maxLength":100}',
      ruleDescriptionEN: 'Arabic letters only, 2-100 characters', ruleDescriptionAR: 'حروف عربية فقط، 2-100 حرف',
      aiAutoValidate: 1,
      aiValidationPrompt: 'Verify the Arabic name for SZHP housing arrears rescheduling. Check: 1) The name uses only Arabic letters, 2) The name matches the UAE PASS authenticated Arabic profile, 3) The Arabic name is consistent with the English name (both refer to the same person), 4) The name matches the SZHP Applicant record. This is critical for legal document matching in the rescheduling process.' },
    { labelEN: 'Phone Number', labelAR: 'رقم الهاتف', fieldKey: 'phone', fieldType: 'text', section: 'personal', required: 1, "order": 4,
      validation: '{"regex":"^05[0-9]{8}$","customMessage":"Must be a valid UAE mobile number"}',
      ruleDescriptionEN: 'Valid UAE mobile number', ruleDescriptionAR: 'رقم هاتف إماراتي صالح',
      aiAutoValidate: 1,
      aiValidationPrompt: 'Verify this is a valid UAE mobile phone number for SZHP rescheduling communication. Check: 1) Starts with 05 followed by 8 digits, 2) The number matches the contact number in the UAE PASS profile, 3) The number matches the Applicant record on file. SZHP will use this number for rescheduling notifications and direct debit setup confirmation.' },
    { labelEN: 'Email Address', labelAR: 'البريد الإلكتروني', fieldKey: 'email', fieldType: 'text', section: 'personal', required: 1, "order": 5,
      validation: '{"regex":"^[^\\\\s@]+@[^\\\\s@]+\\\\.[^\\\\s@]+$"}',
      ruleDescriptionEN: 'Valid email format', ruleDescriptionAR: 'تنسيق بريد إلكتروني صالح',
      aiAutoValidate: 1,
      aiValidationPrompt: 'Verify this email address for SZHP housing arrears rescheduling communications. Check: 1) Valid email format, 2) The domain appears legitimate (not a disposable email service), 3) The email matches the Applicant record. SZHP will send rescheduling confirmations, payment schedules, and direct debit authorizations to this address.' },
    { labelEN: 'Monthly Income', labelAR: 'الدخل الشهري', fieldKey: 'monthlyIncome', fieldType: 'number', section: 'personal', required: 1, "order": 6,
      validation: '{"min":0}',
      ruleDescriptionEN: 'Must be a positive number (AED)', ruleDescriptionAR: 'يجب أن يكون رقماً موجباً (درهم)',
      aiAutoValidate: 1,
      aiValidationPrompt: 'Cross-check the declared monthly income against multiple sources for SZHP housing arrears rescheduling. Verify: 1) Salary certificate amount matches this declared income, 2) Bank statement deposits are consistent with this income, 3) Previous income records in the Applicant database align, 4) The income is realistic for the stated employer type (government/semi-government/private sector benchmarks). Ensure the DBR calculation uses the verified income. Flag if income appears understated (to lower DBR) or overstated (to appear more eligible) for the rescheduling assessment. The 20% deduction rule and income-per-family-member threshold (AED 2,500) depend on this value.' },
    { labelEN: 'Employer Name', labelAR: 'اسم جهة العمل', fieldKey: 'employer', fieldType: 'text', section: 'personal', required: 1, "order": 7,
      validation: '{}',
      ruleDescriptionEN: 'Name of current employer', ruleDescriptionAR: 'اسم جهة العمل الحالية',
      aiAutoValidate: 1,
      aiValidationPrompt: 'Verify the employer name for SZHP housing arrears rescheduling eligibility. Check: 1) The employer is a recognized UAE entity (government ministry, semi-government organization, or registered private company), 2) The employer name matches the salary certificate, 3) The employer type classification (government/semi-government/private) is correct for this employer, 4) The employer appears in the UAE PASS profile. Government employees have favorable risk weights (0.8×) per SZHP policy, so accurate employer classification is critical for the risk assessment.' },
    { labelEN: 'Employer Type', labelAR: 'نوع جهة العمل', fieldKey: 'employerType', fieldType: 'select', section: 'personal', required: 1, "order": 8,
      options: '["government","semi-government","private"]',
      validation: '{}',
      ruleDescriptionEN: 'Must be government, semi-government, or private', ruleDescriptionAR: 'يجب أن يكون حكومي، شبه حكومي، أو خاص',
      aiAutoValidate: 1,
      aiValidationPrompt: 'Verify the employer type classification for SZHP rescheduling risk assessment. Check: 1) Government employees (ministries, federal/local authorities) get 0.8× risk weight — confirm the employer is truly government, 2) Semi-government entities (Emirates Airlines, Mubadala, ADNOC subsidiaries) get 1.0× risk weight, 3) Private sector companies get 1.3× risk weight, 4) The classification matches the salary certificate issuer. Misclassification directly impacts the risk score and rescheduling decision. Government employees may qualify for auto-approval if other criteria are met.' },
    { labelEN: 'Family Size', labelAR: 'حجم الأسرة', fieldKey: 'familySize', fieldType: 'number', section: 'personal', required: 1, "order": 9,
      validation: '{"min":1,"max":20}',
      ruleDescriptionEN: '1-20 household members', ruleDescriptionAR: '1-20 فرد في الأسرة',
      aiAutoValidate: 1,
      aiValidationPrompt: 'Verify the number of dependents/family size against UAE PASS family book data for SZHP housing arrears rescheduling. Check: 1) Total household members match the family book (Khulasat Al Qaid), 2) Number of children under 18 is consistent, 3) Spouse income is declared if applicable, 4) This affects the income-per-family-member calculation for the AED 2,500 threshold rule compliance. A larger family size may improve eligibility by reducing income-per-member below the threshold. Flag if the family size appears inflated to lower the per-member income calculation.' },
    { labelEN: 'Has Family Book', labelAR: 'يملك دفتر العائلة', fieldKey: 'hasFamilyBook', fieldType: 'select', section: 'personal', required: 1, "order": 10,
      options: '["yes","no"]',
      validation: '{}',
      ruleDescriptionEN: 'Whether applicant has UAE family book', ruleDescriptionAR: 'ما إذا كان المتقدم يملك دفتر عائلة إماراتي',
      aiAutoValidate: 1,
      aiValidationPrompt: 'Verify the family book (Khulasat Al Qaid) status for SZHP housing arrears rescheduling eligibility. Check: 1) A family book is mandatory per SZHP/MOEI policy for housing assistance, 2) If the applicant claims to have a family book, verify against UAE PASS data, 3) The family book should list all household members that affect the family size and income-per-member calculation, 4) Flag if the family book is missing — this may require manual review or disqualification per eligibility rules.' },

    // ── Loan & Arrear Section ──────────────────────────────────────────
    { labelEN: 'Original Loan Amount', labelAR: 'مبلغ القرض الأصلي', fieldKey: 'originalAmount', fieldType: 'number', section: 'loan', required: 1, "order": 1,
      validation: '{"min":0}',
      ruleDescriptionEN: 'Must be a positive number (AED)', ruleDescriptionAR: 'يجب أن يكون رقماً موجباً (درهم)',
      aiAutoValidate: 1,
      aiValidationPrompt: 'Validate the original loan amount against SZHP records for housing arrears rescheduling. Check: 1) The amount is within SZHP loan limits (max AED 1,500,000 for housing loans, AED 800,000 for grants, AED 200,000 for maintenance), 2) The amount matches the HousingLoan record in the database, 3) The loan type (housing/grant/maintenance) is consistent with this amount, 4) Flag any discrepancy that suggests the applicant is misrepresenting the loan details to appear more favorable for rescheduling.' },
    { labelEN: 'Remaining Balance', labelAR: 'الرصيد المتبقي', fieldKey: 'remainingBalance', fieldType: 'number', section: 'loan', required: 1, "order": 2,
      validation: '{"min":0}',
      ruleDescriptionEN: 'Must be a positive number (AED)', ruleDescriptionAR: 'يجب أن يكون رقماً موجباً (درهم)',
      aiAutoValidate: 1,
      aiValidationPrompt: 'Validate the outstanding remaining balance against SZHP housing loan records for rescheduling. Check: 1) Remaining balance is less than original amount and consistent with elapsed payment months, 2) The balance matches the HousingLoan record, 3) The balance minus total paid should approximately equal the original amount (accounting for interest), 4) This figure directly impacts the rescheduling calculation — a higher remaining balance means longer rescheduling duration or higher installments. Flag if the balance seems inconsistent with the payment history.' },
    { labelEN: 'Monthly Installment', labelAR: 'القسط الشهري', fieldKey: 'monthlyInstallment', fieldType: 'number', section: 'loan', required: 1, "order": 3,
      validation: '{"min":0}',
      ruleDescriptionEN: 'Must be a positive number (AED)', ruleDescriptionAR: 'يجب أن يكون رقماً موجباً (درهم)',
      aiAutoValidate: 1,
      aiValidationPrompt: 'Verify the monthly installment amount against SZHP housing loan records for DBR calculation. Check: 1) The installment matches the HousingLoan record, 2) The installment is consistent with the original amount and loan duration (originalAmount / loanDurationMonths ≈ monthlyInstallment for interest-free loans), 3) This is the key figure for DBR calculation: DBR = monthlyInstallment / monthlyIncome. Under SZHP policy, the proposed DBR after rescheduling must not exceed the maximum limit. Flag any discrepancy that could affect the rescheduling assessment.' },
    { labelEN: 'Loan Duration (months)', labelAR: 'مدة القرض (شهر)', fieldKey: 'loanDurationMonths', fieldType: 'number', section: 'loan', required: 1, "order": 4,
      validation: '{"min":1,"max":600}',
      ruleDescriptionEN: '1-600 months', ruleDescriptionAR: '1-600 شهر',
      aiAutoValidate: 1,
      aiValidationPrompt: 'Validate the loan duration against SZHP policy limits for housing arrears rescheduling. Check: 1) The duration is within the maximum of 360 months (30 years) per SZHP policy, 2) The duration matches the HousingLoan record, 3) The requested rescheduling duration plus elapsed months should not exceed the maximum, 4) Shorter durations may result in higher monthly installments after rescheduling, affecting DBR. Flag if the duration is inconsistent with the original loan terms.' },
    { labelEN: 'Elapsed Months', labelAR: 'الأشهر المنقضية', fieldKey: 'elapsedMonths', fieldType: 'number', section: 'loan', required: 0, "order": 5,
      validation: '{"min":0}',
      ruleDescriptionEN: 'Months since loan disbursement', ruleDescriptionAR: 'الأشهر منذ صرف القرض',
      aiAutoValidate: 1,
      aiValidationPrompt: 'Verify the elapsed months for SZHP housing loan rescheduling context. Check: 1) The elapsed months match the HousingLoan record (calculated from disbursement date), 2) The ratio of elapsed months to total duration helps assess repayment progress, 3) Loans in early stages with arrears may indicate different risk patterns than loans near maturity, 4) Combined with remaining balance, this determines the feasible rescheduling options available under SZHP policy.' },
    { labelEN: 'Loan Type', labelAR: 'نوع القرض', fieldKey: 'loanType', fieldType: 'select', section: 'loan', required: 1, "order": 6,
      options: '["housing","grant","maintenance"]',
      validation: '{}',
      ruleDescriptionEN: 'Type of SZHP housing assistance', ruleDescriptionAR: 'نوع المساعدة الإسكانية',
      aiAutoValidate: 1,
      aiValidationPrompt: 'Validate the loan type for SZHP housing arrears rescheduling eligibility. Check: 1) The loan type is one of: housing loan, grant, or maintenance loan — each has different SZHP limits and rescheduling rules, 2) Housing loans (max AED 1,500,000) have standard rescheduling options, 3) Grants (max AED 800,000) may have different rescheduling conditions, 4) Maintenance loans (max AED 200,000) have shorter durations, 5) The loan type should match the original SZHP agreement. Misclassification could lead to incorrect rescheduling terms.' },
    { labelEN: 'Total Overdue (AED)', labelAR: 'إجمالي المتأخرات (درهم)', fieldKey: 'totalOverdue', fieldType: 'number', section: 'arrear', required: 1, "order": 1,
      validation: '{"min":0}',
      ruleDescriptionEN: 'Must be a positive number (AED)', ruleDescriptionAR: 'يجب أن يكون رقماً موجباً (درهم)',
      aiAutoValidate: 1,
      aiValidationPrompt: 'Validate the total overdue amount against SZHP arrears records for rescheduling. Check: 1) Total overdue should be approximately missedMonths × monthlyInstallment (possibly with penalties), 2) The amount matches the Arrear record in the database, 3) This figure is critical for determining the rescheduling plan — it determines how much needs to be absorbed into the new payment schedule, 4) Flag if the overdue amount seems inconsistent with missed months and installment amount, as this could indicate calculation errors or misrepresentation.' },
    { labelEN: 'Missed Months', labelAR: 'الأشهر المتأخرة', fieldKey: 'missedMonths', fieldType: 'number', section: 'arrear', required: 1, "order": 2,
      validation: '{"min":1}',
      ruleDescriptionEN: 'At least 1 missed month', ruleDescriptionAR: 'شهر متأخر واحد على الأقل',
      aiAutoValidate: 1,
      aiValidationPrompt: 'Verify the number of missed months against SZHP arrear records for rescheduling assessment. Check: 1) The missed months count matches the Arrear record, 2) The consecutive missed months vs total missed months ratio indicates severity — consecutive misses suggest ongoing inability to pay, 3) More missed months generally mean higher risk and may require human review, 4) This affects the delay days calculation and the rescheduling urgency classification (low/high/severe). Flag if the count seems understated relative to the delay days.' },
    { labelEN: 'Delay Days', labelAR: 'أيام التأخير', fieldKey: 'delayDays', fieldType: 'number', section: 'arrear', required: 1, "order": 3,
      validation: '{"min":1}',
      ruleDescriptionEN: 'At least 1 day', ruleDescriptionAR: 'يوم واحد على الأقل',
      aiAutoValidate: 1,
      aiValidationPrompt: 'Verify the delay days for SZHP rescheduling risk classification. Check: 1) Delay days should be consistent with missed months (approximately missedMonths × 30), 2) The delay days match the Arrear record, 3) Classification: ≤90 days = low risk, 91-180 days = high risk, >180 days = severe distress, >365 days may trigger auto-rejection, 4) Delay days directly affect the risk score, human review threshold, and rescheduling terms. Higher delay days require more favorable rescheduling terms to bring the citizen back to compliance.' },

    // ── Request Section ────────────────────────────────────────────────
    { labelEN: 'Reason Category', labelAR: 'فئة السبب', fieldKey: 'reasonCategory', fieldType: 'select', section: 'request', required: 1, "order": 1,
      options: '["job_loss","medical","salary_cut","divorce","retirement","other"]',
      validation: '{}',
      ruleDescriptionEN: 'Primary reason for arrears', ruleDescriptionAR: 'السبب الرئيسي للمتأخرات',
      aiAutoValidate: 1,
      aiValidationPrompt: 'Verify the reason category against supporting documents for SZHP housing arrears rescheduling. Check: 1) Job loss — verify with termination letter, 2) Medical — verify with medical reports/hospital bills, 3) Salary cut — verify with new salary certificate showing reduced income, 4) Divorce — verify with court documents, affects grace period eligibility (3 months default), 5) Retirement — verify with pension documents, 6) The reason must be consistent with the detailed reason text. Each category has different grace period and rescheduling implications under SZHP/MOEI policy.' },
    { labelEN: 'Detailed Reason', labelAR: 'السبب التفصيلي', fieldKey: 'reason', fieldType: 'textarea', section: 'request', required: 1, "order": 2,
      validation: '{"minLength":10}',
      ruleDescriptionEN: 'Detailed explanation of hardship', ruleDescriptionAR: 'شرح تفصيلي للصعوبات',
      aiAutoValidate: 1,
      aiValidationPrompt: 'Analyze the detailed reason text for SZHP housing arrears rescheduling. Check: 1) The reason is consistent with the selected reason category, 2) The explanation provides specific, verifiable details (dates, amounts, circumstances), 3) The hardship described is plausible and matches the financial data (e.g., job loss should correspond with income changes), 4) Flag vague or generic explanations that lack specifics, 5) The reason should justify the need for rescheduling rather than simple inability to pay due to mismanagement.' },
    { labelEN: 'Requested Duration (months)', labelAR: 'المدة المطلوبة (شهر)', fieldKey: 'requestedDurationMonths', fieldType: 'number', section: 'request', required: 1, "order": 3,
      validation: '{"min":1}',
      ruleDescriptionEN: 'Desired rescheduling duration', ruleDescriptionAR: 'مدة إعادة الجدولة المطلوبة',
      aiAutoValidate: 1,
      aiValidationPrompt: 'Evaluate the requested rescheduling duration for SZHP housing arrears compliance. Check: 1) The requested duration plus elapsed months does not exceed the maximum loan duration (360 months), 2) The resulting monthly installment after rescheduling must keep DBR within the maximum limit, 3) Longer durations reduce monthly payments but increase total interest, 4) The AI will recommend an optimal duration based on DBR, risk score, and the 20% deduction rule. Flag if the requested duration is unrealistically short (resulting in unaffordable installments) or unnecessarily long.' },
    { labelEN: 'Priority Level', labelAR: 'مستوى الأولوية', fieldKey: 'priority', fieldType: 'select', section: 'request', required: 0, "order": 4,
      options: '["normal","urgent","critical"]',
      validation: '{}',
      ruleDescriptionEN: 'Priority of the rescheduling request', ruleDescriptionAR: 'أولوية طلب إعادة الجدولة',
      aiAutoValidate: 1,
      aiValidationPrompt: 'Cross-validate the priority level against delay severity for SZHP rescheduling. Check: 1) Normal priority is appropriate for delay days ≤90, 2) Urgent for delay days 91-180, 3) Critical for delay days >180 or imminent legal action, 4) The priority should be consistent with the reason category (medical and divorce cases may warrant higher priority), 5) Higher priority triggers faster human review but does not guarantee approval. Flag if the priority seems too low for the severity of arrears or too high for a minor delay.' },

    // ── Cross-Field Validation Section ──────────────────────────────────
    { labelEN: 'Name Match (EN ↔ AR)', labelAR: 'تطابق الاسم (إنجليزي ↔ عربي)', fieldKey: 'cross_name_match', fieldType: 'text', section: 'validation', required: 0, "order": 1,
      validation: '{}',
      ruleDescriptionEN: 'Cross-validate English and Arabic names', ruleDescriptionAR: 'التحقق المتبادل بين الاسمين الإنجليزي والعربي',
      aiAutoValidate: 1,
      aiValidationPrompt: 'Cross-validate that the English name and Arabic name refer to the same person for SZHP rescheduling. Check: 1) The English name transliterates to the Arabic name and vice versa, 2) Both names match the UAE PASS authenticated profile, 3) The name order follows UAE conventions (First Father Grandfather Family), 4) Any discrepancy may indicate identity fraud or data entry errors. This is critical for legal document consistency in the rescheduling agreement.' },
    { labelEN: 'Income ↔ Employer Cross-Check', labelAR: 'التحقق المتبادل: الدخل ↔ جهة العمل', fieldKey: 'cross_income_employer', fieldType: 'text', section: 'validation', required: 0, "order": 2,
      validation: '{}',
      ruleDescriptionEN: 'Cross-validate income against employer type', ruleDescriptionAR: 'التحقق المتبادل: الدخل مقابل نوع جهة العمل',
      aiAutoValidate: 1,
      aiValidationPrompt: 'Cross-validate the monthly income against the employer type for SZHP rescheduling. Check: 1) Government employee income should fall within UAE government salary scales (typically AED 8,000-45,000+), 2) Semi-government employees typically earn AED 10,000-60,000+, 3) Private sector varies widely but should be verifiable, 4) The income should be consistent with the salary certificate, 5) The employer risk weight (0.8×/1.0×/1.3×) applied in risk scoring depends on accurate classification. Flag if the income seems inconsistent with the employer type.' },
    { labelEN: 'Loan ↔ Arrear Math Check', labelAR: 'التحقق: القرض ↔ حسابات المتأخرات', fieldKey: 'cross_loan_arrear_math', fieldType: 'text', section: 'validation', required: 0, "order": 3,
      validation: '{}',
      ruleDescriptionEN: 'Cross-validate loan and arrear figures', ruleDescriptionAR: 'التحقق المتبادل: أرقام القرض والمتأخرات',
      aiAutoValidate: 1,
      aiValidationPrompt: 'Cross-validate the loan and arrear mathematics for SZHP rescheduling. Check: 1) totalOverdue ≈ missedMonths × monthlyInstallment (within 10-15% tolerance for penalties), 2) remainingBalance + totalPaid ≈ originalAmount, 3) monthlyInstallment × loanDurationMonths ≈ originalAmount (for interest-free loans), 4) delayDays ≈ missedMonths × 30, 5) These calculations are critical for accurate DBR assessment and rescheduling terms. Flag any mathematical inconsistencies that suggest data entry errors or misrepresentation.' },
    { labelEN: 'Reason ↔ Documents Check', labelAR: 'التحقق: السبب ↔ المستندات', fieldKey: 'cross_reason_docs', fieldType: 'text', section: 'validation', required: 0, "order": 4,
      validation: '{}',
      ruleDescriptionEN: 'Cross-validate reason with supporting documents', ruleDescriptionAR: 'التحقق المتبادل: السبب مقابل المستندات الداعمة',
      aiAutoValidate: 1,
      aiValidationPrompt: 'Cross-validate the reason category with the uploaded supporting documents for SZHP rescheduling. Check: 1) Job loss requires termination letter or employer confirmation, 2) Medical requires hospital/clinic documentation, 3) Salary cut requires old and new salary certificates, 4) Divorce requires court decree, 5) Retirement requires pension statement, 6) All documents should be authentic and unaltered, 7) The document dates should align with the timeline of arrears onset. Flag missing or inconsistent documentation.' },
    { labelEN: 'DBR Feasibility Check', labelAR: 'التحقق: جدوى نسبة عبء الدين', fieldKey: 'cross_dbr_feasibility', fieldType: 'text', section: 'validation', required: 0, "order": 5,
      validation: '{}',
      ruleDescriptionEN: 'Calculate proposed DBR and check feasibility', ruleDescriptionAR: 'حساب نسبة عبء الدين المقترحة والتحقق من الجدوى',
      aiAutoValidate: 1,
      aiValidationPrompt: 'Calculate the proposed Debt Burden Ratio for SZHP rescheduling feasibility. DBR = monthlyInstallment / monthlyIncome. Check: 1) Current DBR (with arrears included in monthly obligations), 2) Proposed DBR after rescheduling (new installment / verified income), 3) Proposed DBR must not exceed the maximum limit (currently 60%), 4) Under the 20% deduction rule, the monthly installment deduction from salary should not cause undue hardship, 5) If DBR exceeds healthy threshold (35%), the case enters caution zone, 6) If DBR exceeds 50%, human review is required. This is the most critical cross-validation for rescheduling approval.' },
    { labelEN: 'Identity ↔ Emirates ID Check', labelAR: 'التحقق: الهوية ↔ رقم الهوية', fieldKey: 'cross_identity_eid', fieldType: 'text', section: 'validation', required: 0, "order": 6,
      validation: '{}',
      ruleDescriptionEN: 'Cross-validate identity with Emirates ID', ruleDescriptionAR: 'التحقق المتبادل: الهوية مقابل رقم الهوية',
      aiAutoValidate: 1,
      aiValidationPrompt: 'Cross-validate that the Emirates ID is consistent with the authenticated UAE PASS identity for SZHP rescheduling. Check: 1) The Emirates ID matches the UAE PASS session user, 2) The name on the Emirates ID matches the application name, 3) The applicant has an active housing loan in the SZHP system linked to this Emirates ID, 4) The applicant is a UAE national (Emirati) as required by MOEI policy, 5) The Emirates ID has not been associated with previous fraudulent rescheduling applications. This is the primary identity verification gate.' },
    { labelEN: 'Family Book ↔ Family Size Check', labelAR: 'التحقق: دفتر العائلة ↔ حجم الأسرة', fieldKey: 'cross_family_book_size', fieldType: 'text', section: 'validation', required: 0, "order": 7,
      validation: '{}',
      ruleDescriptionEN: 'Cross-validate family size against family book', ruleDescriptionAR: 'التحقق المتبادل: حجم الأسرة مقابل دفتر العائلة',
      aiAutoValidate: 1,
      aiValidationPrompt: 'Cross-validate family size against the family book status for SZHP rescheduling. Check: 1) If hasFamilyBook is true, the family size should be consistent with the family book member count from UAE PASS, 2) Family size affects the income-per-family-member calculation: incomePerMember = monthlyIncome / familySize, 3) If incomePerMember < AED 2,500, the applicant may qualify for additional deductions under the 20% rule, 4) Flag if the family size appears inflated (reducing per-member income below threshold) or deflated (excluding eligible members), 5) Spouse income should be included in total household income calculation if applicable.' },
    { labelEN: 'Loan Type ↔ Amount Check', labelAR: 'التحقق: نوع القرض ↔ المبلغ', fieldKey: 'cross_loan_type_amount', fieldType: 'text', section: 'validation', required: 0, "order": 8,
      validation: '{}',
      ruleDescriptionEN: 'Cross-validate loan amount against loan type', ruleDescriptionAR: 'التحقق المتبادل: مبلغ القرض مقابل نوع القرض',
      aiAutoValidate: 1,
      aiValidationPrompt: 'Cross-validate the loan amount against the loan type per SZHP policy limits. Check: 1) Housing loans must not exceed AED 1,500,000, 2) Grants must not exceed AED 800,000, 3) Maintenance loans must not exceed AED 200,000, 4) The loan duration should be appropriate for the type and amount, 5) The remaining balance should not exceed the original amount. Flag any loan that exceeds the SZHP-mandated maximum for its type — this may require special approval or indicate a data error.' },
    { labelEN: 'Priority ↔ Delay Severity Check', labelAR: 'التحقق: الأولوية ↔ شدة التأخير', fieldKey: 'cross_priority_delay_severity', fieldType: 'text', section: 'validation', required: 0, "order": 9,
      validation: '{}',
      ruleDescriptionEN: 'Cross-validate priority with delay severity', ruleDescriptionAR: 'التحقق المتبادل: الأولوية مقابل شدة التأخير',
      aiAutoValidate: 1,
      aiValidationPrompt: 'Cross-validate the priority level against delay severity for SZHP rescheduling. Check: 1) Normal priority with delay >180 days is inconsistent — should be urgent or critical, 2) Critical priority with delay <30 days is likely overstated, 3) Delay days directly map to risk: ≤90 low, 91-180 high, >180 severe, 4) Higher priority cases should have proportionally more supporting documentation, 5) The priority affects the SLA for human review — mismatched priority could delay processing or waste reviewer time.' },
    { labelEN: 'Employer ↔ Deduction Rate Check', labelAR: 'التحقق: جهة العمل ↔ نسبة الخصم', fieldKey: 'cross_employer_income_ratio', fieldType: 'text', section: 'validation', required: 0, "order": 10,
      validation: '{}',
      ruleDescriptionEN: 'Cross-validate deduction rate with employer type', ruleDescriptionAR: 'التحقق المتبادل: نسبة الخصم مقابل نوع جهة العمل',
      aiAutoValidate: 1,
      aiValidationPrompt: 'Cross-validate the deduction rate (monthlyInstallment / monthlyIncome) with the employer type for SZHP rescheduling. Check: 1) Government employees have salary deduction capabilities via WPS — direct debit is more reliable, 2) Private sector employees may change jobs more frequently — higher risk of payment interruption, 3) The 20% deduction rule caps the maximum monthly deduction from salary, 4) Deduction rate = DBR — must not exceed maximum DBR limit, 5) Government employees with DBR ≤40% and risk ≤30 may qualify for auto-approval. This cross-check ensures the rescheduling terms are realistic given the employment stability.' },
  ]

  let seeded = 0
  let updated = 0
  for (const field of defaultFields) {
    const existing = queryFirst('SELECT id FROM FormField WHERE fieldKey = ?', [field.fieldKey]) as any
    if (!existing) {
      queryRun(`INSERT INTO FormField (id, labelEN, labelAR, fieldKey, fieldType, section, required, "order", validation, ruleDescriptionEN, ruleDescriptionAR, options, placeholderEN, placeholderAR, helpTextEN, helpTextAR, showRule, aiAutoValidate, aiValidationPrompt, isVisible, isActive)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, 1, ?, ?, 1, 1)`,
        [generateId(), field.labelEN, field.labelAR, field.fieldKey, field.fieldType, field.section,
         field.required, field.order, field.validation || '{}', field.ruleDescriptionEN || null, field.ruleDescriptionAR || null,
         field.options || '[]', field.aiAutoValidate ? 1 : 0, field.aiValidationPrompt || null])
      seeded++
    } else {
      // Update existing field with SZHP-specific AI prompt if it doesn't have one
      queryRun(`UPDATE FormField SET aiValidationPrompt = ?, aiAutoValidate = ?, labelEN = ?, labelAR = ?, ruleDescriptionEN = ?, ruleDescriptionAR = ?, section = ?, "order" = ?, updatedAt = ? WHERE fieldKey = ?`,
        [field.aiValidationPrompt || null, field.aiAutoValidate ? 1 : 0, field.labelEN, field.labelAR,
         field.ruleDescriptionEN || null, field.ruleDescriptionAR || null, field.section, field.order,
         new Date().toISOString(), field.fieldKey])
      updated++
    }
  }

  return c.json({ success: true, seeded, updated, message: `Seeded ${seeded} new fields, updated ${updated} existing fields with SZHP-specific AI prompts` })
})

// ── Workflows Routes ────────────────────────────────────────────────
app.get('/api/workflows', async (c) => {
  const token = extractToken(c)
  const auth = await verifyAuth(token || '')
  if (!auth.authenticated) return c.json({ error: auth.error }, 401)

  const workflows = query('SELECT * FROM ApprovalWorkflow WHERE isActive = 1 ORDER BY priority DESC').results
  return c.json(workflows)
})

// ── Audit Trail Routes ──────────────────────────────────────────────

// POST /api/audit-log/view — Log case detail views
app.post('/api/audit-log/view', async (c) => {
  const token = extractToken(c)
  const auth = await verifyAuth(token || '')
  if (!auth.authenticated) return c.json({ error: auth.error }, 401)

  const { requestId, action, details } = await c.req.json()
  queryRun(`INSERT INTO AuditLog (id, requestId, action, performedBy, performedByUserId, details, category) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [generateId(), requestId || null, action || 'viewed', auth.user?.email || auth.user?.id || 'unknown', auth.user?.id || null, JSON.stringify(details || {}), 'request'])
  return c.json({ success: true })
})

app.get('/api/audit-trail', async (c) => {
  const token = extractToken(c)
  const auth = await verifyAuth(token || '')
  if (!auth.authenticated) return c.json({ error: auth.error }, 401)

  const category = c.req.query('category')
  const action = c.req.query('action')
  const dateFrom = c.req.query('dateFrom')
  const dateTo = c.req.query('dateTo')
  const performedByUserId = c.req.query('performedByUserId')
  const limit = Math.min(Number(c.req.query('limit') || 50), 200)
  const offset = Number(c.req.query('offset') || 0)

  // Join with User table on performedByUserId (primary) and also try matching performedBy with email
  let sql = `SELECT a.*, COALESCE(u1.firstnameEN, u2.firstnameEN) as firstnameEN,
    COALESCE(u1.lastnameEN, u2.lastnameEN) as lastnameEN,
    COALESCE(u1.firstnameAR, u2.firstnameAR) as firstnameAR,
    COALESCE(u1.lastnameAR, u2.lastnameAR) as lastnameAR,
    COALESCE(u1.role, u2.role) as userRole
    FROM AuditLog a
    LEFT JOIN User u1 ON a.performedByUserId = u1.id
    LEFT JOIN User u2 ON (a.performedByUserId IS NULL AND REPLACE(a.performedBy, 'employee:', '') = u2.email)`
  const params: any[] = []
  const conditions: string[] = []

  if (category && category !== 'all') {
    conditions.push('a.category = ?')
    params.push(category)
  }
  if (action && action !== 'all') {
    conditions.push('a.action = ?')
    params.push(action)
  }
  if (dateFrom) {
    conditions.push('a.timestamp >= ?')
    params.push(dateFrom + ' 00:00:00')
  }
  if (dateTo) {
    conditions.push('a.timestamp <= ?')
    params.push(dateTo + ' 23:59:59')
  }
  if (performedByUserId) {
    conditions.push('(a.performedByUserId = ? OR a.performedBy = ?)')
    params.push(performedByUserId, performedByUserId)
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ')
  }

  sql += ' ORDER BY a.timestamp DESC LIMIT ? OFFSET ?'
  params.push(limit, offset)

  const logs = query(sql, params).results as any[]

  // Map timestamp to createdAt and include user info
  const mapped = logs.map((log: any) => ({
    ...log,
    createdAt: log.timestamp || log.createdAt,
    employeeName: log.firstnameEN ? `${log.firstnameEN} ${log.lastnameEN}` : null,
    employeeRole: log.userRole || null,
    user: log.firstnameEN ? {
      id: log.performedByUserId,
      firstnameEN: log.firstnameEN,
      lastnameEN: log.lastnameEN,
      firstnameAR: log.firstnameAR,
      lastnameAR: log.lastnameAR,
      role: log.userRole,
    } : null,
  }))

  return c.json(mapped)
})

app.get('/api/audit-trail/stats', (c) => {
  const actions24h = toNum((queryFirst("SELECT COUNT(*) as count FROM AuditLog WHERE timestamp >= datetime('now', '-1 day')") as any)?.count, 0)
  const actions7d = toNum((queryFirst("SELECT COUNT(*) as count FROM AuditLog WHERE timestamp >= datetime('now', '-7 days')") as any)?.count, 0)
  const actions30d = toNum((queryFirst("SELECT COUNT(*) as count FROM AuditLog WHERE timestamp >= datetime('now', '-30 days')") as any)?.count, 0)
  const totalActions = toNum((queryFirst("SELECT COUNT(*) as count FROM AuditLog") as any)?.count, 0)

  // Most active user — try both performedByUserId and email matching
  const mostActive = queryFirst(`
    SELECT COALESCE(u1.firstnameEN, u2.firstnameEN) as firstnameEN,
      COALESCE(u1.lastnameEN, u2.lastnameEN) as lastnameEN,
      COALESCE(u1.firstnameAR, u2.firstnameAR) as firstnameAR,
      COALESCE(u1.lastnameAR, u2.lastnameAR) as lastnameAR,
      COALESCE(u1.role, u2.role) as role, COUNT(*) as count
    FROM AuditLog a
    LEFT JOIN User u1 ON a.performedByUserId = u1.id
    LEFT JOIN User u2 ON (a.performedByUserId IS NULL AND REPLACE(a.performedBy, 'employee:', '') = u2.email)
    WHERE a.timestamp >= datetime('now', '-30 days')
    GROUP BY COALESCE(a.performedByUserId, a.performedBy)
    ORDER BY count DESC LIMIT 1
  `) as any

  const mostActiveUser = mostActive?.firstnameEN ? {
    name: `${mostActive.firstnameEN} ${mostActive.lastnameEN}`,
    role: mostActive.role,
    count: mostActive.count,
  } : null

  // Action type breakdown (last 30 days)
  const actionBreakdown = (query(`
    SELECT action, COUNT(*) as count FROM AuditLog
    WHERE timestamp >= datetime('now', '-30 days')
    GROUP BY action ORDER BY count DESC
  `).results || []) as any[]

  // Category breakdown (last 30 days)
  const categoryBreakdown = (query(`
    SELECT category, COUNT(*) as count FROM AuditLog
    WHERE timestamp >= datetime('now', '-30 days')
    GROUP BY category ORDER BY count DESC
  `).results || []) as any[]

  return c.json({ actions24h, actions7d, actions30d, totalActions, mostActiveUser, actionBreakdown, categoryBreakdown })
})

// ── AI Routes (using shared ai-client module) ───────────────────────
app.post('/api/analyze', async (c) => {
  try {
    const body = await c.req.json()
    const systemPrompt = 'You are a UAE housing policy expert. Analyze the rescheduling request and provide recommendations based on MOEI rules. Focus on: 20% deduction rule, income per family member threshold (AED 2,500), income stability, payment history. Respond in JSON format.'

    // Use shared chatCompletion (direct fetch to Recentech AI)
    const config = resolveAIConfig()
    if (!isUrlSafeForServerSideRequest(config.baseUrl)) {
      return c.json({ error: `Blocked: AI model URL targets an internal/private address.` }, 400)
    }

    const result = await chatCompletion(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify(body) },
      ],
      config,
      { stream: false }
    )

    return c.json({ analysis: result.content, model: result.model, provider: result.provider })
  } catch (error: any) {
    console.error('Analyze error:', error)
    return c.json({ error: 'Analysis failed', message: error.message }, 500)
  }
})

app.post('/api/simulate', async (c) => {
  const token = extractToken(c)
  const auth = await verifyAuth(token || '')
  if (!auth.authenticated) return c.json({ error: auth.error }, 401)

  try {
    const body = await c.req.json()

    // Basic simulation using rules
    const monthlyIncome = toNum(body.monthlyIncome, 10000)
    const remainingBalance = toNum(body.remainingBalance, 500000)
    const requestedDuration = toNum(body.requestedDurationMonths, 60)
    const familySize = toNum(body.familySize, 4)
    const totalHouseholdIncome = toNum(body.totalHouseholdIncome, monthlyIncome)

    const proposedInstallment = Math.ceil(remainingBalance / requestedDuration)
    const dbr = proposedInstallment / monthlyIncome
    const incomePerMember = totalHouseholdIncome / familySize
    const maxDbr = getConfigNumber('max_dbr_limit', 0.20)

    const eligible = dbr <= maxDbr && incomePerMember >= getConfigNumber('income_per_member_threshold', 2500)

    return c.json({
      eligible,
      proposedInstallment,
      dbr: Math.round(dbr * 10000) / 10000,
      maxDbr,
      withinDbrLimit: dbr <= maxDbr,
      incomePerMember: Math.round(incomePerMember * 100) / 100,
      requestedDuration,
      deductionRate: Math.round((proposedInstallment / monthlyIncome) * 10000) / 100,
      recommendation: eligible ? 'Eligible for rescheduling' : 'Not eligible - exceeds limits',
    })
  } catch (error: any) {
    return c.json({ error: 'Simulation failed', message: error.message }, 500)
  }
})

app.post('/api/ai-assistant', async (c) => {
  try {
    const { message, action } = await c.req.json()

    const systemPrompt = 'You are a helpful AI assistant for the Sheikh Zayed Housing Programme (SZHP) in the UAE. Help citizens with their housing loan arrears rescheduling questions. Be concise, professional, and empathetic. Respond in the same language the user uses (Arabic or English).'

    // Use shared chatCompletion (direct fetch to Recentech AI)
    const config = resolveAIConfig()
    if (!isUrlSafeForServerSideRequest(config.baseUrl)) {
      return c.json({ response: 'AI service is currently unavailable.', action: action || 'chat' })
    }

    const result = await chatCompletion(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message || 'How can I apply for rescheduling?' },
      ],
      config
    )

    return c.json({ response: result.content, action: action || 'chat' })
  } catch (error: any) {
    console.error('AI assistant error:', error)
    return c.json({ response: 'Sorry, an error occurred. Please try again later.', action: 'chat' })
  }
})

async function runLocalRequestAssessment(id: string, performedBy = 'system:ai_v1.1-moei-instant', performedByUserId: string | null = null) {
  const startTime = Date.now()

  const reqData = queryFirst('SELECT * FROM ReschedulingRequest WHERE id = ?', [id]) as any
  if (!reqData) throw new Error('Request not found')

  const applicant = queryFirst('SELECT * FROM Applicant WHERE id = ?', [reqData.applicantId]) as any
  const loan = queryFirst('SELECT * FROM HousingLoan WHERE id = ?', [reqData.loanId]) as any
  if (!applicant || !loan) throw new Error('Missing applicant or loan data')

  const arrear = (queryFirst('SELECT * FROM Arrear WHERE loanId = ?', [loan.id]) as any) || {
    missedMonths: 0,
    totalOverdue: 0,
    delayDays: 0,
    reason: reqData.reasonCategory || 'other',
  }

  queryRun('DELETE FROM AIAssessment WHERE requestId = ?', [id])

  const totalHouseholdIncome = toNum(applicant.totalHouseholdIncome, toNum(applicant.monthlyIncome, 0))
  const monthlyIncome = Math.max(toNum(applicant.monthlyIncome, 0), 0)
  const familySize = Math.max(toNum(applicant.familySize, 1), 1)
  const incomePerMember = Math.round((totalHouseholdIncome / familySize) * 100) / 100
  const requestedDuration = Math.max(toNum(reqData.requestedDurationMonths, 0), 0)
  const maxRemaining = Math.max(toNum(loan.loanDurationMonths, 0) - toNum(loan.elapsedMonths, 0), 0)
  const effectiveDuration = requestedDuration > 0 && maxRemaining > 0
    ? Math.min(requestedDuration, maxRemaining)
    : requestedDuration
  const reschedulingAmount = toNum(loan.remainingBalance, 0) + toNum(arrear.totalOverdue, 0)
  const proposedInstallment = effectiveDuration > 0 ? Math.ceil(reschedulingAmount / effectiveDuration) : 0
  const currentDbr = monthlyIncome > 0 ? toNum(loan.monthlyInstallment, 0) / monthlyIncome : 1
  const proposedDbr = monthlyIncome > 0 ? proposedInstallment / monthlyIncome : 1
  const proposedDeductionRate = Math.round(proposedDbr * 10000) / 100

  const maxDbr = getConfigNumber('max_dbr_limit', 0.20)
  const deductionLimit = getConfigNumber('moei_max_deduction_rate', 0.20)
  const incomeThreshold = getConfigNumber('income_per_member_threshold', 2500)
  const humanReviewRiskThreshold = getConfigNumber('human_review_risk_threshold', 50)
  const humanReviewDbrThreshold = getConfigNumber('human_review_dbr_threshold', 0.5)
  const humanReviewDelayDays = getConfigNumber('human_review_delay_days', 180)
  const riskLow = getConfigNumber('risk_threshold_low', 30)
  const riskMedium = getConfigNumber('risk_threshold_medium', 50)
  const riskHigh = getConfigNumber('risk_threshold_high', 70)

  const supportingDocuments = safeJsonParse<string[]>(reqData.supportingDocuments, [])
  const hasIncomeEvidence = supportingDocuments.some((doc) => ['income_statement', 'bank_statement', 'detailed_salary_statement'].includes(doc))
  const activeRequestCount = toNum((queryFirst(`
    SELECT COUNT(*) as count
    FROM ReschedulingRequest
    WHERE applicantId = ?
      AND id <> ?
      AND status IN ('pending', 'under_review', 'ai_assessed', 'escalated')
  `, [reqData.applicantId, id]) as any)?.count, 0)
  const hasActiveRequest = activeRequestCount > 0
  const missingDocuments: string[] = []
  if (!supportingDocuments.includes('salary_certificate')) missingDocuments.push('salary_certificate')
  if (!hasIncomeEvidence) missingDocuments.push('income_statement')
  if (reqData.reasonCategory === 'medical' && !supportingDocuments.includes('medical_report')) missingDocuments.push('medical_report')

  const documentSummaries = await buildDocumentIntelligence({
    reqData,
    applicant,
    supportingDocuments,
    missingDocuments,
    monthlyIncome,
    hasIncomeEvidence,
  })

  const governanceChecks = [
    {
      ruleCode: 'ACTIVE-001',
      ruleName: 'Active Application Validation',
      passed: !hasActiveRequest,
      message: hasActiveRequest
        ? `Applicant has ${activeRequestCount} other active rescheduling application(s); human officer review is required`
        : 'No other active rescheduling application found',
      category: 'governance',
    },
    {
      ruleCode: 'ELIG-CITIZENSHIP',
      ruleName: 'UAE Citizenship',
      passed: !!applicant.isCitizen,
      message: applicant.isCitizen ? 'Applicant is a UAE citizen' : 'Applicant must be a UAE citizen',
      category: 'eligibility',
    },
    {
      ruleCode: 'ELIG-FAMILY-BOOK',
      ruleName: 'Family Book',
      passed: !!applicant.hasFamilyBook,
      message: applicant.hasFamilyBook ? 'Family book confirmed' : 'Family book is required',
      category: 'eligibility',
    },
    {
      ruleCode: 'DBR-001',
      ruleName: 'Debt Burden Ratio',
      passed: proposedDbr <= maxDbr,
      message: proposedDbr <= maxDbr ? `Proposed DBR ${(proposedDbr * 100).toFixed(1)}% is within limit` : `Proposed DBR ${(proposedDbr * 100).toFixed(1)}% exceeds ${(maxDbr * 100).toFixed(1)}% limit`,
      category: 'debt_burden',
    },
    {
      ruleCode: 'MOEI-20',
      ruleName: '20% Deduction Rule',
      passed: proposedDbr <= deductionLimit,
      message: proposedDbr <= deductionLimit ? `Proposed deduction ${proposedDeductionRate.toFixed(1)}% is within 20% limit` : `Proposed deduction ${proposedDeductionRate.toFixed(1)}% exceeds 20% limit`,
      category: 'debt_burden',
    },
    {
      ruleCode: 'DUR-001',
      ruleName: 'Remaining Approved Period',
      passed: requestedDuration <= maxRemaining,
      message: requestedDuration <= maxRemaining ? `Duration within remaining ${maxRemaining}-month period` : `Requested duration exceeds remaining ${maxRemaining}-month period`,
      category: 'duration',
    },
    {
      ruleCode: 'DOC-001',
      ruleName: 'Document Completeness',
      passed: missingDocuments.length === 0,
      message: missingDocuments.length === 0 ? 'Required documents provided' : `Missing documents: ${missingDocuments.join(', ')}`,
      category: 'documentation',
    },
    {
      ruleCode: 'DOC-INCOME-001',
      ruleName: 'Detailed Income Statement',
      passed: hasIncomeEvidence,
      message: hasIncomeEvidence
        ? 'Detailed income evidence provided through income or bank statement'
        : 'Detailed income statement or bank statement is required',
      category: 'documentation',
    },
  ]

  let riskScore = 0
  const riskFactors: Array<{ factor: string; contribution: number; severity: string; description: string }> = []

  const dbrContribution = proposedDbr > 0.8 ? 25 : proposedDbr > 0.6 ? 20 : proposedDbr > 0.4 ? 12 : proposedDbr > 0.2 ? 5 : 0
  riskScore += dbrContribution
  riskFactors.push({ factor: 'proposed_dbr', contribution: dbrContribution, severity: dbrContribution >= 20 ? 'critical' : dbrContribution >= 10 ? 'high' : 'medium', description: `Proposed DBR ${(proposedDbr * 100).toFixed(1)}% contributes ${dbrContribution} risk points` })

  const delayDays = toNum(arrear.delayDays, 0)
  const delayContribution = delayDays > 365 ? 30 : delayDays > 180 ? 25 : delayDays > 90 ? 15 : delayDays > 30 ? 8 : 0
  riskScore += delayContribution
  riskFactors.push({ factor: 'delay_duration', contribution: delayContribution, severity: delayContribution >= 20 ? 'critical' : delayContribution >= 10 ? 'high' : 'medium', description: `${delayDays} days delay contributes ${delayContribution} risk points` })

  const incomeContribution = monthlyIncome < 5000 ? 20 : monthlyIncome < 10000 ? 15 : monthlyIncome < 20000 ? 8 : monthlyIncome < 35000 ? 3 : 0
  riskScore += incomeContribution
  riskFactors.push({ factor: 'income_level', contribution: incomeContribution, severity: incomeContribution >= 20 ? 'critical' : incomeContribution >= 10 ? 'high' : 'medium', description: `Monthly income AED ${monthlyIncome.toLocaleString()} contributes ${incomeContribution} risk points` })

  const normalizedEmployer = String(applicant.employerType || 'private').replace(/_/g, '-')
  const employerContribution = normalizedEmployer === 'private' ? 13 : normalizedEmployer === 'semi-government' ? 5 : 2
  riskScore += employerContribution
  riskFactors.push({ factor: 'employer_type', contribution: employerContribution, severity: employerContribution >= 10 ? 'high' : 'medium', description: `${normalizedEmployer} employment contributes ${employerContribution} risk points` })

  if (incomePerMember < incomeThreshold) {
    riskScore += 5
    riskFactors.push({ factor: 'income_per_family_member', contribution: 5, severity: 'medium', description: `Income per family member AED ${incomePerMember.toLocaleString()} is below AED ${incomeThreshold.toLocaleString()}` })
  }

  riskScore = Math.min(riskScore, 100)
  const riskLevel = riskScore >= riskHigh ? 'critical' : riskScore >= riskMedium ? 'high' : riskScore >= riskLow ? 'medium' : 'low'

  const humanReviewReasons: string[] = []
  if (hasActiveRequest) humanReviewReasons.push(`Existing active rescheduling application found (${activeRequestCount})`)
  if (missingDocuments.length > 0) humanReviewReasons.push(`Missing required documents: ${missingDocuments.join(', ')}`)
  if (!governanceChecks.every((check) => check.passed)) humanReviewReasons.push('One or more governance checks failed')
  if (riskScore >= humanReviewRiskThreshold) humanReviewReasons.push(`Risk score ${riskScore} meets human review threshold ${humanReviewRiskThreshold}`)
  if (proposedDbr >= humanReviewDbrThreshold) humanReviewReasons.push(`Proposed DBR ${(proposedDbr * 100).toFixed(1)}% meets human review threshold ${(humanReviewDbrThreshold * 100).toFixed(1)}%`)
  if (delayDays >= humanReviewDelayDays) humanReviewReasons.push(`Delay of ${delayDays} days meets human review threshold ${humanReviewDelayDays} days`)
  if (proposedDbr > deductionLimit) humanReviewReasons.push(`Proposed deduction ${proposedDeductionRate.toFixed(1)}% exceeds 20% rule`)
  if (requestedDuration > maxRemaining) humanReviewReasons.push(`Requested duration exceeds remaining approved period of ${maxRemaining} months`)

  const mandatoryEligibilityFailure = !applicant.isCitizen || !applicant.hasFamilyBook
  const requiresHumanReview = !mandatoryEligibilityFailure && humanReviewReasons.length > 0
  const eligible = !!applicant.isCitizen && !!applicant.hasFamilyBook && proposedDbr <= maxDbr && effectiveDuration > 0
  const eligibilityStatus = !eligible || riskLevel === 'critical'
    ? 'ineligible'
    : requiresHumanReview || riskLevel === 'high'
      ? 'conditionally_eligible'
      : 'eligible'

  let moeiRecommendation = eligible ? 'approve' : 'reject'
  if (mandatoryEligibilityFailure) moeiRecommendation = 'reject'
  else if (missingDocuments.length > 0) moeiRecommendation = 'request_documents'
  else if (requiresHumanReview) moeiRecommendation = 'refer_to_employee'

  let moeiReasoning = eligible
    ? 'Rules engine found the case financially feasible under configured MOEI controls.'
    : 'Case does not meet one or more mandatory MOEI eligibility or financial rules.'
  if (mandatoryEligibilityFailure) {
    moeiReasoning = !applicant.isCitizen
      ? 'Applicant is not authorized for this service because housing arrears rescheduling is restricted to UAE nationals.'
      : 'Applicant is not authorized for this service because a valid family book is required for housing assistance.'
  }
  let caseSummary = `${applicant.nameEn || applicant.nameAr} has AED ${reschedulingAmount.toLocaleString()} to reschedule over ${effectiveDuration} months at AED ${proposedInstallment.toLocaleString()} per month.`
  const documentReviewCount = documentSummaries.filter((doc) => !doc.verified).length
  const deterministicConfidenceCap = Math.max(
    50,
    100 - riskScore - (missingDocuments.length * 15) - Math.min(12, documentReviewCount * 3),
  )
  let confidenceScore = deterministicConfidenceCap
  let aiModelVersion = 'v1.1-rules-only'

  try {
    const config = resolveAIConfig()
    if (config.apiKey && isUrlSafeForServerSideRequest(config.baseUrl)) {
      const result = await chatCompletion(
        [
          {
            role: 'system',
            content: 'You are an MOEI housing arrears analyst. Return compact JSON with recommendation, reasoning, caseSummary, and confidence. Do not override hard governance failures.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              income: monthlyIncome,
              familySize,
              incomePerMember,
              proposedDeductionRate,
              proposedDbr,
              riskScore,
              riskLevel,
              missingDocuments,
              governanceChecks,
              baseRecommendation: moeiRecommendation,
            }),
          },
        ],
        config,
        { stream: false },
      )
      const parsed = safeJsonParse(result.content.match(/\{[\s\S]*\}/)?.[0] || '{}', {} as any)
      if (parsed.reasoning) moeiReasoning = String(parsed.reasoning)
      if (parsed.caseSummary) caseSummary = String(parsed.caseSummary)
      if (typeof parsed.confidence === 'number') confidenceScore = Math.min(normalizeConfidence(parsed.confidence, confidenceScore), deterministicConfidenceCap)
      if (parsed.recommendation && !requiresHumanReview && eligible) moeiRecommendation = String(parsed.recommendation)
      aiModelVersion = `v1.1-${config.modelId}`
    }
  } catch {
    // Deterministic rules above are sufficient for the instant decision.
  }

  const processingTimeMs = Date.now() - startTime
  const governanceCompliant = governanceChecks.every((check) => check.passed)
  const algorithmTrace = [
    {
      step: 1,
      gate: 'Eligibility Gate',
      rule: 'Applicant must be a UAE citizen and have a valid family book.',
      input: `citizen=${!!applicant.isCitizen}; familyBook=${!!applicant.hasFamilyBook}`,
      result: mandatoryEligibilityFailure ? 'fail' : 'pass',
      outcome: mandatoryEligibilityFailure ? 'Hard reject before financial optimization.' : 'Proceed to document and financial gates.',
    },
    {
      step: 2,
      gate: 'Document Gate',
      rule: 'Salary certificate plus income evidence are mandatory; hardship-specific documents are required when applicable.',
      input: `provided=${supportingDocuments.join(', ') || 'none'}; missing=${missingDocuments.join(', ') || 'none'}`,
      result: missingDocuments.length === 0 ? 'pass' : 'review',
      outcome: missingDocuments.length === 0 ? 'Evidence package complete.' : 'Automatic approval blocked until required evidence is supplied.',
    },
    {
      step: 3,
      gate: 'Financial Formula',
      rule: 'amount = remaining balance + arrears; installment = ceil(amount / duration); DBR = installment / monthly income.',
      input: `amount=AED ${reschedulingAmount.toLocaleString()}; duration=${effectiveDuration} months; income=AED ${monthlyIncome.toLocaleString()}`,
      result: proposedDbr <= maxDbr ? 'pass' : 'fail',
      outcome: `installment=AED ${proposedInstallment.toLocaleString()}; proposedDBR=${(proposedDbr * 100).toFixed(1)}%; limit=${(maxDbr * 100).toFixed(1)}%.`,
    },
    {
      step: 4,
      gate: 'Governance Gate',
      rule: '20% deduction cap, remaining approved period, no active duplicate request.',
      input: `deduction=${proposedDeductionRate.toFixed(1)}%; requestedDuration=${requestedDuration}; remainingPeriod=${maxRemaining}; activeRequests=${activeRequestCount}`,
      result: governanceCompliant ? 'pass' : 'review',
      outcome: governanceCompliant ? 'All configured governance checks passed.' : 'At least one governance rule requires officer attention.',
    },
    {
      step: 5,
      gate: 'Risk Score',
      rule: 'Weighted risk = proposed DBR + arrears delay + income level + employer type + income per family member.',
      input: riskFactors.map((factor) => `${factor.factor}:${factor.contribution}`).join('; '),
      result: riskScore >= humanReviewRiskThreshold ? 'review' : 'pass',
      outcome: `riskScore=${riskScore}/100; riskLevel=${riskLevel}; humanReviewThreshold=${humanReviewRiskThreshold}.`,
    },
    {
      step: 6,
      gate: 'Decision Path',
      rule: 'Reject mandatory eligibility failure; request documents when incomplete; hand off high-risk exceptions; otherwise AI-assessed.',
      input: `eligible=${eligible}; requiresHumanReview=${requiresHumanReview}; recommendation=${moeiRecommendation}`,
      result: mandatoryEligibilityFailure || moeiRecommendation === 'reject' ? 'fail' : requiresHumanReview ? 'review' : 'pass',
      outcome: mandatoryEligibilityFailure ? 'AI rejects due to mandatory eligibility failure.' : requiresHumanReview ? 'AI refers the exception to a human officer.' : 'AI can place the case on the instant assessed path.',
    },
  ]
  const decisionRationale = {
    algorithm: 'MOEI-STRICT-GOVERNANCE-V2',
    algorithm_trace: algorithmTrace,
    moei_recommendation: moeiRecommendation,
    moei_reasoning: moeiReasoning,
    governance_compliant: governanceCompliant,
    document_completeness: { complete: missingDocuments.length === 0, missingDocuments },
    document_summaries: documentSummaries,
    active_application_validation: {
      passed: !hasActiveRequest,
      activeRequestCount,
    },
    human_review_reasons: humanReviewReasons,
    financial_summary: {
      currentDBR: currentDbr,
      proposedDBR: proposedDbr,
      proposedDeductionRate,
      recommendedAmount: reschedulingAmount,
      recommendedDuration: effectiveDuration,
      recommendedInstallment: proposedInstallment,
    },
  }
  const shapExplanation = riskFactors.map((factor) => ({
    feature: factor.factor,
    value: factor.contribution,
    contribution: factor.contribution,
    description: factor.description,
  }))

  const assessmentId = generateId()
  queryRun(`INSERT INTO AIAssessment (id, requestId, riskScore, riskLevel, confidenceScore, recommendedAmount, recommendedDuration, recommendedInstallment, debtBurdenRatio, proposedDBR, eligibilityStatus, decisionRationale, governanceCompliance, riskFactors, shapExplanation, requiresHumanReview, humanReviewReason, aiModelVersion, processingTimeMs, applicationStatus, incomeAnalysis, proposedDeductionRate, rule20PercentCompliance, periodRuleCompliance, moeiRecommendation, moeiReasoning, caseSummary)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [assessmentId, id, riskScore, riskLevel, confidenceScore,
     reschedulingAmount, effectiveDuration, proposedInstallment,
     currentDbr, proposedDbr, eligibilityStatus,
     JSON.stringify(decisionRationale),
     JSON.stringify(governanceChecks),
     JSON.stringify(riskFactors),
     JSON.stringify(shapExplanation),
     requiresHumanReview ? 1 : 0,
     humanReviewReasons.join('; ') || null,
     aiModelVersion,
     processingTimeMs,
     missingDocuments.length === 0 ? 'complete' : 'incomplete',
     JSON.stringify({ salary: monthlyIncome, stability: applicant.incomeStability || 'stable', perMemberAverage: incomePerMember, householdTotal: totalHouseholdIncome }),
     proposedDeductionRate,
     proposedDbr <= deductionLimit ? 'pass' : 'fail',
     requestedDuration <= maxRemaining ? 'pass' : 'fail',
     moeiRecommendation,
     moeiReasoning,
     caseSummary])

  const nextRequestStatus = mandatoryEligibilityFailure ? 'rejected' : requiresHumanReview ? 'escalated' : 'ai_assessed'
  queryRun(`UPDATE ReschedulingRequest SET status = ?, incomePerFamilyMember = ?, deductionRate = ?, documentCompleteness = ?, missingDocuments = ?, moeiCompliance = ?, updatedAt = ? WHERE id = ?`,
    [nextRequestStatus, incomePerMember, proposedDeductionRate,
     missingDocuments.length === 0 ? 'complete' : 'incomplete',
     JSON.stringify(missingDocuments), JSON.stringify(governanceChecks), new Date().toISOString(), id])

  queryRun(`INSERT INTO AuditLog (id, requestId, action, performedBy, performedByUserId, details, category) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [generateId(), id, 'assessed', performedBy, performedByUserId,
     JSON.stringify({ algorithm: 'MOEI-STRICT-GOVERNANCE-V2', riskScore, riskLevel, eligibilityStatus, moeiRecommendation, requiresHumanReview, autoRejected: mandatoryEligibilityFailure, humanReviewReasons, documentSummaries: documentSummaries.length, processingTimeMs }),
     'request'])

  return queryFirst('SELECT * FROM AIAssessment WHERE id = ?', [assessmentId]) as any
}

app.post('/api/requests/:id/assess', async (c) => {
  const token = extractToken(c)
  const auth = await verifyAuth(token || '')
  if (!auth.authenticated) return c.json({ error: auth.error }, 401)

  const id = c.req.param('id')

  try {
    const assessment = await runLocalRequestAssessment(id, `employee:${auth.user?.email || auth.user?.id}`, auth.user?.id || null)

    return c.json({
      ...assessment,
      request: queryFirst('SELECT * FROM ReschedulingRequest WHERE id = ?', [id]),
    })
  } catch (error: any) {
    console.error('Assessment error:', error)
    return c.json({ error: 'Assessment failed', message: error.message }, 500)
  }
})

// ── Upload Route (simplified - local storage) ───────────────────────
app.post('/api/upload', async (c) => {
  try {
    const formData = await c.req.formData()
    const file = formData.get('file') as File
    if (!file) return c.json({ error: 'No file provided' }, 400)

    const fileId = generateId()
    const storedName = `${fileId}-${file.name}`

    // Save file to disk for AI analysis
    const uploadDir = join(process.cwd(), 'uploads')
    mkdirSync(uploadDir, { recursive: true })
    const filePath = join(uploadDir, storedName)
    const arrayBuffer = await file.arrayBuffer()
    writeFileSync(filePath, Buffer.from(arrayBuffer))
    console.log(`📁 File saved: ${filePath} (${file.size} bytes)`)

    // Response shape matches Cloudflare Worker: { data: { id, originalName, storedName, size, type, uploadedAt } }
    return c.json({
      data: {
        id: fileId,
        originalName: file.name,
        storedName,
        size: file.size,
        type: file.type,
        uploadedAt: new Date().toISOString(),
      },
    })
  } catch (error: any) {
    return c.json({ error: 'Upload failed', message: error.message }, 500)
  }
})

// ── System Routes ───────────────────────────────────────────────────
app.get('/api/system/hardware', (c) => {
  return c.json({
    platform: 'Node.js + better-sqlite3',
    memory: 'N/A',
    cpu: 'N/A',
    gpu: 'N/A',
  })
})

app.post('/api/system/generate-mock', async (c) => {
  const token = extractToken(c)
  const auth = await verifyAuth(token || '')
  if (!auth.authenticated) return c.json({ error: auth.error }, 401)

  try {
    const applicantId = generateId()
    const loanId = generateId()
    const arrearId = generateId()
    const requestId = generateId()

    const monthlyIncome = Math.floor(Math.random() * 30000) + 5000
    const familySize = Math.floor(Math.random() * 8) + 1
    const originalAmount = Math.floor(Math.random() * 1500000) + 200000
    const remainingBalance = originalAmount * (0.3 + Math.random() * 0.5)
    const missedMonths = Math.floor(Math.random() * 6) + 1
    const monthlyInstallment = originalAmount / 240
    const totalOverdue = monthlyInstallment * missedMonths

    // Create applicant
    queryRun(`INSERT INTO Applicant (id, emiratesId, nameAr, nameEn, phone, monthlyIncome, employerType, familySize, isCitizen, hasFamilyBook, maritalStatus, totalHouseholdIncome, incomeStability, numberOfChildren)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?, ?, ?)`,
      [applicantId, `784-1990-${Math.random().toString().slice(2, 9)}-1`, `مواطن ${Math.floor(Math.random() * 1000)}`, `Citizen ${Math.floor(Math.random() * 1000)}`,
       `05${Math.floor(Math.random() * 100000000)}`, monthlyIncome, ['government', 'semi-government', 'private'][Math.floor(Math.random() * 3)],
       familySize, ['single', 'married', 'divorced'][Math.floor(Math.random() * 3)],
       monthlyIncome * (1 + Math.random() * 0.5), ['stable', 'reduced', 'variable'][Math.floor(Math.random() * 3)],
       Math.floor(Math.random() * 5)])

    // Create loan
    queryRun(`INSERT INTO HousingLoan (id, applicantId, originalAmount, remainingBalance, monthlyInstallment, loanDurationMonths, elapsedMonths, loanType, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [loanId, applicantId, originalAmount, remainingBalance, monthlyInstallment, 240, Math.floor(Math.random() * 120) + 12,
       ['grant', 'loan', 'maintenance'][Math.floor(Math.random() * 3)]])

    // Create arrear
    queryRun(`INSERT INTO Arrear (id, loanId, missedMonths, totalOverdue, delayDays, reason, consecutiveMissedMonths)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [arrearId, loanId, missedMonths, totalOverdue, missedMonths * 30,
       ['job_loss', 'medical', 'salary_cut', 'divorce'][Math.floor(Math.random() * 4)], missedMonths])

    // Create request
    queryRun(`INSERT INTO ReschedulingRequest (id, applicantId, loanId, requestedDurationMonths, reasonCategory, status, priority, incomePerFamilyMember, deductionRate)
      VALUES (?, ?, ?, ?, ?, 'pending', 'normal', ?, ?)`,
      [requestId, applicantId, loanId, 60, ['job_loss', 'medical', 'salary_cut'][Math.floor(Math.random() * 3)],
       monthlyIncome / familySize, (monthlyInstallment / monthlyIncome) * 100])

    return c.json({ requestId, applicantId, loanId })
  } catch (error: any) {
    return c.json({ error: 'Mock generation failed', message: error.message }, 500)
  }
})

// ── Applicants Routes ────────────────────────────────────────────────
app.get('/api/applicants', async (c) => {
  const token = extractToken(c)
  const auth = await verifyAuth(token || '')
  if (!auth.authenticated) return c.json({ error: auth.error }, 401)

  const applicants = query(`
    SELECT a.*, COUNT(DISTINCT l.id) as loanCount, COUNT(DISTINCT r.id) as requestCount
    FROM Applicant a
    LEFT JOIN HousingLoan l ON l.applicantId = a.id
    LEFT JOIN ReschedulingRequest r ON r.applicantId = a.id
    GROUP BY a.id
    ORDER BY a.createdAt DESC
  `).results
  return c.json(applicants)
})

// ── Verify Document (VLM-based) ────────────────────────────────────
app.post('/api/verify-document', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}))
    const { fileName, documentType, language: reqLang } = body as { fileName?: string; documentType?: string; language?: string }

    const fileInfo = readFileAsDataUrl(fileName || '')
    if (!fileInfo) {
      return c.json({ verified: false, message: 'File not found on disk for verification' })
    }

    const isAr = reqLang === 'ar'
    const prompt = isAr
      ? `تحقق من هذا المستند من نوع "${documentType || 'غير معروف'}". هل يبدو أصليًا وصالحًا؟ أجب بصيغة JSON: { "verified": boolean, "confidence": number, "issues": string[] }`
      : `Verify this ${documentType || 'unknown'} document. Does it appear authentic and valid? Look for letterhead, signatures, stamps, QR codes, dates, and any signs of tampering. Answer as JSON only: { "verified": boolean, "confidence": number, "issues": string[] }`

    try {
      // Use shared visionCompletion (direct fetch to Recentech AI)
      const vlmConfig = resolveVLMConfig()

      // For PDFs: convert to JPEG images first
      const isPdf = (fileName || '').toLowerCase().endsWith('.pdf')
      const messageContent: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
        { type: 'text', text: prompt },
      ]

      if (isPdf) {
        const imageUrls = readPdfAsImageDataUrls(fileName || '', 2)
        if (imageUrls.length > 0) {
          for (const imgUrl of imageUrls) {
            messageContent.push({ type: 'image_url', image_url: { url: imgUrl } })
          }
        } else {
          // Fallback: use the dataUrl from readFileAsDataUrl (may be JPEG if conversion worked)
          messageContent.push({ type: 'image_url', image_url: { url: fileInfo.dataUrl } })
        }
      } else {
        messageContent.push({ type: 'image_url', image_url: { url: fileInfo.dataUrl } })
      }

      const visionMessages = [{
        role: 'user' as const,
        content: messageContent,
      }]
      const visionResult = await visionCompletion(visionMessages, vlmConfig)
      const content = visionResult.content || ''
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content]
      const parsed = JSON.parse((jsonMatch[1] || content).trim())
      return c.json({ verified: !!parsed.verified, confidence: parsed.confidence || 0, issues: parsed.issues || [], message: 'Document verified by VLM' })
    } catch (vlmErr: any) {
      return c.json({ verified: false, confidence: 0, issues: ['VLM verification failed'], message: 'AI verification unavailable — manual review required' })
    }
  } catch (error: any) {
    return c.json({ verified: false, message: error.message }, 500)
  }
})

app.post('/api/analyze-salary-certificate', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}))
    const { fileName, language: reqLang } = body as { fileName?: string; language?: string }
    const isAr = reqLang === 'ar'

    // ── Step 1: Read the actual uploaded file from disk ──────────
    const fileInfo = readFileAsDataUrl(fileName || '')
    const hasFile = !!fileInfo

    if (hasFile) {
      console.log(`🔍 Analyzing salary certificate: ${fileName} (${fileInfo!.mimeType})`)
    } else {
      console.log(`⚠️ File not found on disk: ${fileName}, using filename-only analysis`)
    }

    // ── Step 2: Build the analysis prompt ─────────────────────────
    const systemPrompt = `You are an expert UAE salary certificate analyst for SZHP/MOEI. Analyze the uploaded document and return ONLY valid JSON with this structure:
{
  "isSalaryCertificate": boolean,
  "confidence": number (0-100),
  "documentType": string,
  "extractedFields": {
    "employeeName": string | null,
    "employer": string | null,
    "monthlySalary": number | null,
    "totalSalary": number | null,
    "basicSalary": number | null,
    "housingAllowance": number | null,
    "transportAllowance": number | null,
    "position": string | null,
    "employeeId": string | null,
    "certificateDate": string | null,
    "certificateNumber": string | null,
    "employerType": "government" | "semi-government" | "private" | null
  },
  "validationChecks": {
    "hasLetterhead": boolean,
    "hasSignature": boolean,
    "hasDate": boolean,
    "hasEmployeeDetails": boolean,
    "hasSalaryBreakdown": boolean,
    "hasValidityClause": boolean,
    "validityPeriodDays": number | null,
    "isWithinValidity": boolean
  },
  "anomalies": string[],
  "authenticityScore": number (0-100),
  "requiresHumanReview": boolean,
  "humanReviewReason": string | null,
  "recommendation": "accept" | "review" | "reject",
  "recommendationReason": string
}

Critical UAE salary certificate validation rules:
1. Letterhead: Valid salary certificates MUST be on company letterhead — look for company logo, name, and contact details at the top
2. Signature: Must bear an authorized signature (HR manager, director, etc.) — look for a signature line or stamp
3. Date: Must have an issue date; UAE standard validity is 30 days from issue
4. Employee details: Must include employee name, position, and ideally employee ID
5. Salary info: Must show salary breakdown (basic + allowances is standard in UAE)
6. Validity clause: Many UAE certificates state "valid for 30 days" or similar
7. If certificate date is older than 30 days, isWithinValidity should be false
8. If any critical check fails (no letterhead, no signature, no date), recommendation should be "reject" or "review"
9. If confidence < 70, set requiresHumanReview to true with specific reason
10. authenticityScore should reflect: letterhead(25%), signature(25%), date(15%), salary info(20%), validity(15%)
11. IMPORTANT: Actually read the document content visible in the image/PDF — extract real names, real salary figures, real dates
12. If the document is not a salary certificate (e.g. bank statement, letter, etc.), set isSalaryCertificate to false and confidence below 30`

    const userPrompt = isAr
      ? `تحليل مستند شهادة الراتب المرفوع. يرجى قراءة المستند بعناية واستخراج المعلومات الحقيقية وإرجاع النتائج بصيغة JSON فقط.`
      : `Analyze this uploaded salary certificate document. READ THE DOCUMENT CAREFULLY — extract real information from what you can see in the document (actual names, amounts, dates, etc). This was uploaded by a citizen applying for housing arrears rescheduling through SZHP/MOEI. Return your analysis as JSON only.`

    // ── Step 3: Try VLM (Vision Language Model) first if file exists ──
    let analysisResult: Record<string, unknown> = {
      isSalaryCertificate: true,
      confidence: 40,
      documentType: 'salary_certificate',
      extractedFields: null,
      validationChecks: {
        hasLetterhead: false,
        hasSignature: false,
        hasDate: false,
        hasEmployeeDetails: false,
        hasSalaryBreakdown: false,
        hasValidityClause: false,
        validityPeriodDays: null,
        isWithinValidity: false,
      },
      anomalies: ['Document analysis pending'],
      authenticityScore: 40,
      requiresHumanReview: true,
      humanReviewReason: 'AI analysis could not be completed — manual review required',
      recommendation: 'review',
      recommendationReason: 'AI analysis could not be completed — manual review required',
    }

    // Try VLM analysis with the actual document image
    if (hasFile) {
      const isVlmCompatible = isVlmCompatibleFile(fileName || '')

      if (isVlmCompatible) {
        // Image/PDF files: Use VLM to visually analyze the document
        try {
          console.log(`🤖 Using shared visionCompletion for salary cert analysis`)
          const vlmConfig = resolveVLMConfig()

          // For PDFs: send up to 3 pages as separate images in one vision call
          const isPdf = (fileName || '').toLowerCase().endsWith('.pdf')
          let imageUrls: string[] = []

          if (isPdf) {
            imageUrls = readPdfAsImageDataUrls(fileName || '', 3)
            if (imageUrls.length === 0) {
              // PDF-to-image conversion failed, fall through to LLM text analysis
              console.warn('⚠️ PDF to image conversion failed, falling back to LLM text analysis')
              throw new Error('PDF to image conversion failed')
            }
            console.log(`📄 Converted PDF to ${imageUrls.length} page images for VLM analysis`)
          }

          // Build the vision message content with text + image(s)
          const messageContent: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
            { type: 'text', text: systemPrompt + '\n\n' + userPrompt },
          ]

          if (isPdf && imageUrls.length > 0) {
            // For multi-page PDFs, add all pages as images
            for (const imgUrl of imageUrls) {
              messageContent.push({ type: 'image_url', image_url: { url: imgUrl } })
            }
          } else {
            // Single image file
            messageContent.push({ type: 'image_url', image_url: { url: fileInfo!.dataUrl } })
          }

          const visionMessages = [{
            role: 'user' as const,
            content: messageContent,
          }]
          const visionResult = await visionCompletion(visionMessages, vlmConfig)
          const content = visionResult.content || ''
          const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content]
          const jsonStr = (jsonMatch[1] || content).trim()
          const parsed = JSON.parse(jsonStr)
          analysisResult = { ...analysisResult, ...parsed }
          console.log(`✅ VLM salary cert analysis complete (confidence: ${parsed.confidence || 'N/A'})`)
        } catch (vlmErr: any) {
          console.warn('⚠️ VLM salary cert analysis failed:', vlmErr?.message || vlmErr)
          // For PDFs that fail VLM, try text-based analysis with DOCX/text extraction
          const isPdf = (fileName || '').toLowerCase().endsWith('.pdf')
          if (isPdf) {
            try {
              console.log('🔄 Falling back to LLM text analysis for PDF salary cert')
              const textPrompt = `${systemPrompt}\n\nThe file "${fileName}" is a PDF that could not be visually analyzed. Please provide your best assessment. For PDFs, note that manual review is required for letterhead, signature verification. Return JSON only.`
              const llmResult = await chatCompletion([{ role: 'system', content: textPrompt }, { role: 'user', content: userPrompt }], resolveAIConfig())
              const llmContent = llmResult.content
              const jsonMatch = llmContent.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, llmContent]
              const parsed = JSON.parse((jsonMatch[1] || llmContent).trim())
              analysisResult = { ...analysisResult, ...parsed }
              analysisResult.requiresHumanReview = true
              if (!analysisResult.humanReviewReason) {
                analysisResult.humanReviewReason = 'PDF visual analysis failed — manual review required for letterhead and signature verification'
              }
              analysisResult.confidence = Math.min(Number(analysisResult.confidence) || 0, 55)
            } catch (llmErr2: any) {
              console.warn('⚠️ LLM fallback analysis also failed:', llmErr2?.message || llmErr2)
            }
          }
        }
      } else {
        // Non-image files (DOCX, TXT, etc.): Extract text if possible, then use LLM
        const textContent = readTextFileContent(fileName || '')
        try {
          let llmPrompt: string
          if (textContent) {
            llmPrompt = `${systemPrompt}\n\nThe following is the text content extracted from the uploaded file "${fileName}":\n\n---\n${textContent}\n---\n\nAnalyze the above document content and return your analysis as JSON only.`
          } else {
            llmPrompt = `${systemPrompt}\n\nThe uploaded file is "${fileName}" (type: ${fileInfo!.mimeType}). Since this file format cannot be visually analyzed, please provide your best assessment. For DOCX files, note that manual review is required for letterhead, signature verification. Return JSON only.`
          }
          const llmResult = await chatCompletion([{ role: 'system', content: llmPrompt }, { role: 'user', content: userPrompt }], resolveAIConfig())
          const llmContent = llmResult.content
          const jsonMatch = llmContent.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, llmContent]
          const parsed = JSON.parse((jsonMatch[1] || llmContent).trim())
          analysisResult = { ...analysisResult, ...parsed }

          // For non-image files, force human review
          analysisResult.requiresHumanReview = true
          if (!analysisResult.humanReviewReason || analysisResult.humanReviewReason === 'Document analysis pending') {
            analysisResult.humanReviewReason = 'Non-image/PDF format requires manual verification for letterhead, signature, and authenticity'
          }
          analysisResult.confidence = Math.min(Number(analysisResult.confidence) || 0, 65)
          console.log(`✅ LLM salary cert analysis complete for non-image file (confidence: ${analysisResult.confidence})`)
        } catch (llmErr: any) {
          console.warn('⚠️ LLM analysis failed:', llmErr?.message || llmErr)
        }
      }
    } else {
      // No file on disk — use text-only LLM with filename
      try {
        const textPrompt = `${systemPrompt}\n\nThe file "${fileName}" was uploaded but could not be read from disk for visual analysis. Please provide your best assessment based on the filename alone. Return JSON only.`
        const llmResult = await chatCompletion([{ role: 'system', content: textPrompt }, { role: 'user', content: `Analyze salary certificate: ${fileName}` }], resolveAIConfig())
        const llmContent = llmResult.content
        const jsonMatch = llmContent.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, llmContent]
        const parsed = JSON.parse((jsonMatch[1] || llmContent).trim())
        analysisResult = { ...analysisResult, ...parsed }
        analysisResult.requiresHumanReview = true
        analysisResult.humanReviewReason = analysisResult.humanReviewReason || 'File could not be read for visual analysis — manual review required'
        analysisResult.confidence = Math.min(Number(analysisResult.confidence) || 0, 50)
      } catch (llmErr: any) {
        console.warn('⚠️ Filename-only LLM analysis failed:', llmErr?.message || llmErr)
        // Ultimate fallback based on file extension
        const isPdf = (fileName || '').toLowerCase().endsWith('.pdf')
        const isImage = /\.(jpe?g|png|webp)$/i.test(fileName || '')
        const isDoc = /\.docx?$/i.test(fileName || '')
        analysisResult = {
          isSalaryCertificate: isPdf || isImage || isDoc,
          confidence: isPdf ? 40 : isImage ? 35 : isDoc ? 30 : 20,
          documentType: isPdf ? 'salary_certificate_pdf' : isImage ? 'salary_certificate_image' : isDoc ? 'salary_certificate_doc' : 'unknown',
          extractedFields: null,
          validationChecks: {
            hasLetterhead: false,
            hasSignature: false,
            hasDate: false,
            hasEmployeeDetails: false,
            hasSalaryBreakdown: false,
            hasValidityClause: false,
            validityPeriodDays: null,
            isWithinValidity: false,
          },
          anomalies: ['AI analysis failed — could not process document'],
          authenticityScore: isPdf ? 35 : isImage ? 30 : isDoc ? 25 : 15,
          requiresHumanReview: true,
          humanReviewReason: 'AI analysis failed — manual verification required for all document checks',
          recommendation: 'review',
          recommendationReason: 'AI analysis could not be completed — manual review required',
        }
      }
    }

    // Ensure confidence-based human review logic
    if (Number(analysisResult.confidence) < 70) {
      analysisResult.requiresHumanReview = true
      if (!analysisResult.humanReviewReason) {
        analysisResult.humanReviewReason = `Low confidence score (${analysisResult.confidence}%) — manual review recommended`
      }
    }

    // Response shape matches Cloudflare Worker: { data: { ... } }
    return c.json({ data: analysisResult })
  } catch (error: any) {
    console.error('Salary certificate analysis error:', error)
    return c.json({ error: 'Salary certificate analysis failed', message: error.message }, 500)
  }
})

app.post('/api/verify-identity', async (c) => {
  return c.json({ verified: true, message: 'Identity verification is available in production deployment' })
})

// ── Medical Report Analysis ────────────────────────────────────────────
app.post('/api/analyze-medical-report', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}))
    const { fileName, language: reqLang } = body as { fileName?: string; language?: string }
    const isAr = reqLang === 'ar'

    // ── Step 1: Read the actual uploaded file from disk ──────────
    const fileInfo = readFileAsDataUrl(fileName || '')
    const hasFile = !!fileInfo

    if (hasFile) {
      console.log(`🔍 Analyzing medical report: ${fileName} (${fileInfo!.mimeType})`)
    } else {
      console.log(`⚠️ File not found on disk: ${fileName}, using filename-only analysis`)
    }

    // ── Step 2: Build the analysis prompt ─────────────────────────
    const systemPrompt = `You are an expert UAE medical report analyst for SZHP/MOEI housing programme. Analyze the uploaded medical report document and return ONLY valid JSON with this structure:
{
  "isMedicalReport": boolean,
  "confidence": number (0-100),
  "documentType": string,
  "extractedFields": {
    "patientName": string | null,
    "diagnosis": string | null,
    "hospitalName": string | null,
    "doctorName": string | null,
    "reportDate": string | null,
    "reportNumber": string | null,
    "healthcareAuthority": string | null
  },
  "validationChecks": {
    "hasLetterhead": boolean,
    "hasSignature": boolean,
    "hasDate": boolean,
    "hasQrCode": boolean,
    "hasDigitalAuthentication": boolean,
    "recognizedAuthority": boolean,
    "authorityName": string | null
  },
  "recognizedUAEAuthorities": string[],
  "anomalies": string[],
  "authenticityScore": number (0-100),
  "requiresHumanReview": boolean,
  "humanReviewReason": string | null,
  "recommendation": "accept" | "review" | "reject",
  "recommendationReason": string
}

UAE recognized healthcare authorities include:
- Department of Health - Abu Dhabi (DOH/HAAD)
- Dubai Health Authority (DHA)
- Ministry of Health and Prevention (MOHAP)
- Emirates Health Services (EHS)
- SEHA
- Mediclinic
- NMC Healthcare
- Aster DM Healthcare
- Saudi German Hospital
- Rashid Hospital
- Al Ain Hospital
- Tawam Hospital

For QR codes: If the document mentions QR code verification, a digital authentication link, or an electronic stamp, set hasQrCode/hasDigitalAuthentication accordingly.
If confidence < 70 or any critical validation check fails, set requiresHumanReview to true with a specific reason.
IMPORTANT: Actually read the document content visible in the image/PDF — extract real patient names, real diagnoses, real hospital names, real dates.
If the document is not a medical report, set isMedicalReport to false and confidence below 30.`

    const userPrompt = isAr
      ? `تحليل تقرير طبي مرفوع. يرجى قراءة المستند بعناية واستخراج المعلومات الحقيقية والتحقق من صحته وإرجاع النتائج بصيغة JSON فقط.`
      : `Analyze this uploaded medical report document. READ THE DOCUMENT CAREFULLY — extract real information from what you can see (actual patient name, diagnosis, hospital, doctor, dates, etc). The file was uploaded by a citizen applying for housing arrears rescheduling (medical reason). Validate the document for authenticity, check for recognized UAE healthcare authorities, QR codes, digital authentication. Return your analysis as JSON only.`

    // ── Step 3: Try VLM analysis ────────────────────────────────
    let analysisResult: Record<string, unknown> = {
      isMedicalReport: true,
      confidence: 35,
      documentType: 'medical_report',
      extractedFields: null,
      validationChecks: {
        hasLetterhead: false,
        hasSignature: false,
        hasDate: false,
        hasQrCode: false,
        hasDigitalAuthentication: false,
        recognizedAuthority: false,
        authorityName: null,
      },
      recognizedUAEAuthorities: [],
      anomalies: ['Document analysis pending'],
      authenticityScore: 35,
      requiresHumanReview: true,
      humanReviewReason: 'AI analysis could not be completed — manual verification recommended',
      recommendation: 'review',
      recommendationReason: 'Medical report needs manual verification for authenticity',
    }

    // Try VLM analysis with the actual document image
    if (hasFile) {
      const isVlmCompatible = isVlmCompatibleFile(fileName || '')

      if (isVlmCompatible) {
        try {
          console.log(`🤖 Using shared visionCompletion for medical report analysis`)
          const vlmConfig = resolveVLMConfig()

          // For PDFs: send up to 3 pages as separate images in one vision call
          const isPdf = (fileName || '').toLowerCase().endsWith('.pdf')
          let imageUrls: string[] = []

          if (isPdf) {
            imageUrls = readPdfAsImageDataUrls(fileName || '', 3)
            if (imageUrls.length === 0) {
              console.warn('⚠️ PDF to image conversion failed, falling back to LLM text analysis')
              throw new Error('PDF to image conversion failed')
            }
            console.log(`📄 Converted PDF to ${imageUrls.length} page images for VLM analysis`)
          }

          // Build the vision message content with text + image(s)
          const messageContent: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
            { type: 'text', text: systemPrompt + '\n\n' + userPrompt },
          ]

          if (isPdf && imageUrls.length > 0) {
            for (const imgUrl of imageUrls) {
              messageContent.push({ type: 'image_url', image_url: { url: imgUrl } })
            }
          } else {
            messageContent.push({ type: 'image_url', image_url: { url: fileInfo!.dataUrl } })
          }

          const visionMessages = [{
            role: 'user' as const,
            content: messageContent,
          }]
          const visionResult = await visionCompletion(visionMessages, vlmConfig)
          const content = visionResult.content || ''
          const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content]
          const jsonStr = (jsonMatch[1] || content).trim()
          const parsed = JSON.parse(jsonStr)
          analysisResult = { ...analysisResult, ...parsed }
          console.log(`✅ VLM medical report analysis complete (confidence: ${parsed.confidence || 'N/A'})`)
        } catch (vlmErr: any) {
          console.warn('⚠️ VLM medical report analysis failed:', vlmErr?.message || vlmErr)
          // For PDFs that fail VLM, try text-based analysis
          const isPdf = (fileName || '').toLowerCase().endsWith('.pdf')
          if (isPdf) {
            try {
              console.log('🔄 Falling back to LLM text analysis for PDF medical report')
              const textPrompt = `${systemPrompt}\n\nThe file "${fileName}" is a PDF that could not be visually analyzed. Please provide your best assessment. Return JSON only.`
              const llmResult = await chatCompletion([{ role: 'system', content: textPrompt }, { role: 'user', content: userPrompt }], resolveAIConfig())
              const llmContent = llmResult.content
              const jsonMatch = llmContent.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, llmContent]
              const parsed = JSON.parse((jsonMatch[1] || llmContent).trim())
              analysisResult = { ...analysisResult, ...parsed }
              analysisResult.requiresHumanReview = true
              if (!analysisResult.humanReviewReason) {
                analysisResult.humanReviewReason = 'PDF visual analysis failed — manual review required for medical document verification'
              }
              analysisResult.confidence = Math.min(Number(analysisResult.confidence) || 0, 45)
            } catch (llmErr2: any) {
              console.warn('⚠️ LLM fallback analysis also failed:', llmErr2?.message || llmErr2)
            }
          }
        }
      } else {
        // Non-image files: Extract text if possible, then use LLM
        const textContent = readTextFileContent(fileName || '')
        try {
          let llmPrompt: string
          if (textContent) {
            llmPrompt = `${systemPrompt}\n\nThe following is the text content extracted from the uploaded file "${fileName}":\n\n---\n${textContent}\n---\n\nAnalyze the above document content and return your analysis as JSON only.`
          } else {
            llmPrompt = `${systemPrompt}\n\nThe uploaded file is "${fileName}" (type: ${fileInfo!.mimeType}). Since this file format cannot be visually analyzed, please provide your best assessment. Return JSON only.`
          }
          const llmResult = await chatCompletion([{ role: 'system', content: llmPrompt }, { role: 'user', content: userPrompt }], resolveAIConfig())
          const llmContent = llmResult.content
          const jsonMatch = llmContent.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, llmContent]
          const parsed = JSON.parse((jsonMatch[1] || llmContent).trim())
          analysisResult = { ...analysisResult, ...parsed }
          analysisResult.requiresHumanReview = true
          if (!analysisResult.humanReviewReason || analysisResult.humanReviewReason === 'Document analysis pending') {
            analysisResult.humanReviewReason = 'Non-image/PDF format requires manual verification'
          }
        } catch (llmErr: any) {
          console.warn('⚠️ LLM analysis failed:', llmErr?.message || llmErr)
        }
      }
    } else {
      try {
        const textPrompt = `${systemPrompt}\n\nThe file "${fileName}" was uploaded but could not be read from disk for visual analysis. Please provide your best assessment based on the filename alone. Return JSON only.`
        const llmResult = await chatCompletion([{ role: 'system', content: textPrompt }, { role: 'user', content: `Analyze medical report: ${fileName}` }], resolveAIConfig())
        const llmContent = llmResult.content
        const jsonMatch = llmContent.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, llmContent]
        const parsed = JSON.parse((jsonMatch[1] || llmContent).trim())
        analysisResult = { ...analysisResult, ...parsed }
        analysisResult.requiresHumanReview = true
        analysisResult.humanReviewReason = analysisResult.humanReviewReason || 'File could not be read for visual analysis — manual review required'
        analysisResult.confidence = Math.min(Number(analysisResult.confidence) || 0, 45)
      } catch (llmErr: any) {
        console.warn('⚠️ Filename-only LLM analysis failed:', llmErr?.message || llmErr)
        const isPdf = (fileName || '').toLowerCase().endsWith('.pdf')
        const isImage = /\.(jpe?g|png|webp)$/i.test(fileName || '')
        analysisResult = {
          isMedicalReport: isPdf || isImage,
          confidence: isPdf ? 35 : isImage ? 30 : 15,
          documentType: isPdf ? 'medical_report_pdf' : isImage ? 'medical_report_image' : 'unknown',
          extractedFields: null,
          validationChecks: {
            hasLetterhead: false, hasSignature: false, hasDate: false,
            hasQrCode: false, hasDigitalAuthentication: false,
            recognizedAuthority: false, authorityName: null,
          },
          recognizedUAEAuthorities: [],
          anomalies: ['AI analysis failed — could not process document'],
          authenticityScore: isPdf ? 30 : isImage ? 25 : 10,
          requiresHumanReview: true,
          humanReviewReason: 'AI analysis failed — manual verification required for medical document',
          recommendation: 'review',
          recommendationReason: 'Medical report requires manual verification to confirm authenticity',
        }
      }
    }

    // Ensure confidence-based human review logic
    if (Number(analysisResult.confidence) < 70) {
      analysisResult.requiresHumanReview = true
      if (!analysisResult.humanReviewReason) {
        analysisResult.humanReviewReason = `Low confidence score (${analysisResult.confidence}%) — manual review required`
      }
    }

    return c.json({ data: analysisResult })
  } catch (error: any) {
    console.error('Medical report analysis error:', error)
    return c.json({ error: 'Medical report analysis failed', message: error.message }, 500)
  }
})

// ── Salary-Bank Cross-Check ────────────────────────────────────────────
app.post('/api/cross-check-salary-bank', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}))
    const {
      salaryCertData,
      bankStatementFiles,
      applicantName,
      language: reqLang,
    } = body as {
      salaryCertData?: Record<string, unknown>
      bankStatementFiles?: Array<{ fileName: string; originalName?: string; docType: string }>
      applicantName?: string
      language?: string
    }
    const isAr = reqLang === 'ar'

    const modelConfig = resolveAIConfig()

    // Extract salary info from certificate
    const extractedFields = salaryCertData?.extractedFields as Record<string, unknown> | undefined
    const certSalary = extractedFields?.monthlySalary || extractedFields?.totalSalary || 0
    const certEmployer = extractedFields?.employer || extractedFields?.employerName || 'Unknown'
    const certEmployeeName = extractedFields?.employeeName || applicantName || 'Unknown'

    const systemPrompt = `You are an expert financial document cross-checker for SZHP/MOEI housing programme. Your job is to cross-check a salary certificate against bank statements to verify the applicant's income over a 6-month assessment period. Return ONLY valid JSON.

Cross-check criteria:
1. Salary deposit consistency: Verify monthly salary transfers match the salary certificate amount
2. Employer name matching: Bank statement deposits should come from the same employer
3. 6-month period coverage: At least 6 months of salary deposits should be visible
4. Deposit pattern analysis: Regular monthly deposits indicate stable employment
5. Additional income sources: Identify any other regular income
6. Deductions: Note any recurring deductions that might affect net income

Return JSON with this structure:
{
  "crossCheckPassed": boolean,
  "overallConfidence": number (0-100),
  "salaryMatch": {
    "certifiedSalary": number,
    "averageMonthlyDeposit": number | null,
    "salaryMatchPercentage": number | null (0-100),
    "matchStatus": "exact" | "close" | "discrepancy" | "unverifiable"
  },
  "employerMatch": {
    "certifiedEmployer": string,
    "depositSourceName": string | null,
    "employerMatchStatus": "matched" | "partial" | "mismatch" | "unverifiable"
  },
  "periodCoverage": {
    "monthsCovered": number (0-6),
    "coverageStatus": "full" | "partial" | "insufficient",
    "missingMonths": number
  },
  "depositPattern": {
    "isRegular": boolean,
    "regularityScore": number (0-100),
    "anomalies": string[]
  },
  "additionalIncome": {
    "detected": boolean,
    "sources": string[],
    "estimatedMonthlyAmount": number | null
  },
  "deductions": {
    "detected": boolean,
    "types": string[],
    "estimatedMonthlyAmount": number | null
  },
  "requiresHumanReview": boolean,
  "humanReviewReason": string | null,
  "recommendation": "accept" | "review" | "reject",
  "recommendationReason": string,
  "riskFlags": string[]
}

If salary match is within ±10%, consider it "close". If within ±5%, "exact".
If fewer than 4 months covered, set periodCoverage.coverageStatus to "insufficient".
If confidence < 70, always set requiresHumanReview to true.`

    const bankStatementExtracts = await Promise.all((bankStatementFiles || []).map(async (f: any) => {
      const fileName = String(f.fileName || f.storedName || '')
      const originalName = String(f.originalName || f.fileName || 'unknown')
      const text = await extractUploadedDocumentText(fileName)
      return { originalName, text }
    }))
    const bankFileNames = bankStatementExtracts.map((f) => f.originalName || 'unknown').join(', ')
    const bankStatementText = bankStatementExtracts
      .filter((f) => f.text.trim().length > 0)
      .map((f) => `FILE: ${f.originalName}\n${f.text.trim()}`)
      .join('\n\n---\n\n')
      .slice(0, 12000)
    const userPrompt = isAr
      ? `التحقق المتقاطع لشهادة الراتب مع كشف الحساب البنكي. راتب معتمد: ${certSalary} درهم. صاحب العمل: ${certEmployer}. الموظف: ${certEmployeeName}. ملفات كشف الحساب: ${bankFileNames || 'غير متوفر'}.\n\nالنص المستخرج من كشوف الحساب إن وجد:\n${bankStatementText || 'تعذر استخراج نص مباشر من الملفات، استخدم أسماء الملفات وبيانات شهادة الراتب لتحديد أن التحقق غير قابل للجزم.'}\n\nيرجى إجراء التحقق المتقاطع وإرجاع النتائج بصيغة JSON فقط.`
      : `Cross-check salary certificate against bank statements. Certified salary: AED ${certSalary}. Employer: ${certEmployer}. Employee: ${certEmployeeName}. Bank statement files: ${bankFileNames || 'Not available'}.\n\nExtracted bank statement text when available:\n${bankStatementText || 'No direct text could be extracted from the files; use the file metadata and salary certificate data to mark unverifiable items clearly.'}\n\nThe 6-month assessment period should verify regular salary deposits matching the certified amount. Return your cross-check analysis as JSON only.`

    let crossCheckResult: Record<string, unknown> = {
      crossCheckPassed: false,
      overallConfidence: 0,
      salaryMatch: {
        certifiedSalary: Number(certSalary) || 0,
        averageMonthlyDeposit: null,
        salaryMatchPercentage: null,
        matchStatus: 'unverifiable',
      },
      employerMatch: {
        certifiedEmployer: String(certEmployer),
        depositSourceName: null,
        employerMatchStatus: 'unverifiable',
      },
      periodCoverage: {
        monthsCovered: 0,
        coverageStatus: 'insufficient',
        missingMonths: 6,
      },
      depositPattern: {
        isRegular: false,
        regularityScore: 0,
        anomalies: [],
      },
      additionalIncome: { detected: false, sources: [], estimatedMonthlyAmount: null },
      deductions: { detected: false, types: [], estimatedMonthlyAmount: null },
      requiresHumanReview: true,
      humanReviewReason: 'Bank statement analysis requires manual review - AI cross-check could not fully verify',
      recommendation: 'review',
      recommendationReason: 'Unable to automatically verify salary deposits against bank statements',
      riskFlags: ['bank_statements_require_manual_review'],
    }

    try {
      const completion = await chatCompletion(
        [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
        modelConfig,
      )
      const content = completion.content
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content]
      const parsed = JSON.parse((jsonMatch[1] || content).trim())
      crossCheckResult = { ...crossCheckResult, ...parsed }

      // Ensure human review for low confidence
      if (Number(crossCheckResult.overallConfidence) < 70) {
        crossCheckResult.requiresHumanReview = true
        if (!crossCheckResult.humanReviewReason) {
          crossCheckResult.humanReviewReason = 'Low confidence in cross-check results - manual review required'
        }
      }
    } catch (aiErr: any) {
      console.warn('AI salary-bank cross-check failed, using fallback:', aiErr?.message || aiErr)
      // Provide a reasonable fallback that indicates manual review is needed
      crossCheckResult.salaryMatch.certifiedSalary = Number(certSalary) || 0
      crossCheckResult.overallConfidence = 25
      crossCheckResult.requiresHumanReview = true
      crossCheckResult.humanReviewReason = 'AI cross-check failed - manual review required'
      crossCheckResult.riskFlags = ['ai_cross_check_failed', 'manual_verification_required']
    }

    return c.json({ data: crossCheckResult })
  } catch (error: any) {
    console.error('Salary-bank cross-check error:', error)
    return c.json({ error: 'Cross-check failed', message: error.message }, 500)
  }
})

// ── Document Identity Verification ────────────────────────────────────

app.post('/api/verify-document-identity', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}))
    const {
      emiratesId,
      extractedFields,
      documentType,
      uaepassProfile,
    } = body as {
      emiratesId?: string
      extractedFields?: Record<string, unknown>
      documentType?: string
      uaepassProfile?: {
        nameEn?: string
        nameAr?: string
        monthlyIncome?: number
        employer?: string
        employerType?: string
        nationalityEN?: string
      }
    }

    if (!emiratesId) {
      return c.json({ error: 'emiratesId is required' }, 400)
    }

    // Look up the customer in the Applicant DB table by emiratesId
    const dbApplicant = queryFirst(
      'SELECT * FROM Applicant WHERE emiratesId = ?',
      [emiratesId]
    ) as any

    // Build the known identity data from DB + UAEPASS profile
    const knownData: Record<string, unknown> = {}

    if (dbApplicant) {
      knownData.dbNameEn = dbApplicant.nameEn || null
      knownData.dbNameAr = dbApplicant.nameAr || null
      knownData.dbMonthlyIncome = dbApplicant.monthlyIncome || null
      knownData.dbEmployer = dbApplicant.employer || null
      knownData.dbEmployerType = dbApplicant.employerType || null
      knownData.dbMaritalStatus = dbApplicant.maritalStatus || null
      knownData.dbSpouseIncome = dbApplicant.spouseIncome || null
      knownData.dbFamilySize = dbApplicant.familySize || null
    }

    if (uaepassProfile) {
      knownData.uaepassNameEn = uaepassProfile.nameEn || null
      knownData.uaepassNameAr = uaepassProfile.nameAr || null
      knownData.uaepassMonthlyIncome = uaepassProfile.monthlyIncome || null
      knownData.uaepassEmployer = uaepassProfile.employer || null
      knownData.uaepassEmployerType = uaepassProfile.employerType || null
      knownData.uaepassNationality = uaepassProfile.nationalityEN || null
    }

    const modelConfig = resolveAIConfig()

    const systemPrompt = `You are an expert identity verification system for the SZHP/MOEI housing programme in the UAE. Your task is to cross-check document-extracted data against known identity records (UAEPASS profile and database records) to detect inconsistencies, fraud, or data entry errors. Return ONLY valid JSON.

Cross-check criteria:
1. Name matching: Does the name on the document match the UAEPASS name and/or DB name? Consider minor transliteration differences as acceptable.
2. Salary matching: Does the salary on the document match the DB-recorded salary? A difference of more than ±10% is a potential mismatch.
3. Employer name matching: Does the employer on the document match the UAEPASS/DB employer name? Consider abbreviations and partial matches.
4. Emirates ID consistency: Does the emirates ID on the document match the provided emirates ID?
5. Overall consistency: Check for any other contradictions between the document data and known records.

Return JSON with this structure:
{
  "verified": boolean,
  "mismatches": string[],
  "confidence": number (0-100),
  "details": string,
  "checks": {
    "nameMatch": { "match": boolean, "detail": string },
    "salaryMatch": { "match": boolean, "detail": string },
    "employerMatch": { "match": boolean, "detail": string },
    "emiratesIdMatch": { "match": boolean, "detail": string }
  }
}

If a field cannot be verified (not present in both document and known data), set match to null and explain in detail. A single critical mismatch (name or emiratesId) should set verified to false. Salary/employer mismatches should lower confidence but not necessarily fail verification.`

    const extractedSummary = extractedFields
      ? Object.entries(extractedFields)
          .map(([k, v]) => `${k}: ${v}`)
          .join(', ')
      : 'No extracted fields provided'

    const knownSummary = Object.entries(knownData)
      .filter(([_, v]) => v !== null && v !== undefined)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ')

    const userPrompt = `Cross-verify document identity for Emirates ID: ${emiratesId}.
Document type: ${documentType || 'unknown'}
Extracted fields from document: ${extractedSummary}
Known identity data (UAEPASS + DB): ${knownSummary || 'No known data available'}
Emirates ID to verify against: ${emiratesId}

Please cross-check the document data against the known identity records and return your verification as JSON only.`

    let verifyResult: Record<string, unknown> = {
      verified: false,
      mismatches: [],
      confidence: 0,
      details: 'Verification not performed',
      checks: {
        nameMatch: { match: null, detail: 'Not checked' },
        salaryMatch: { match: null, detail: 'Not checked' },
        employerMatch: { match: null, detail: 'Not checked' },
        emiratesIdMatch: { match: null, detail: 'Not checked' },
      },
    }

    try {
      // Use shared chatCompletion (direct fetch to Recentech AI)
      const completion = await chatCompletion(
        [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
        modelConfig,
      )
      const content = completion.content
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content]
      const parsed = JSON.parse((jsonMatch[1] || content).trim())
      verifyResult = { ...verifyResult, ...parsed }
    } catch (aiErr: any) {
      console.warn('AI identity verification failed, using fallback:', aiErr?.message || aiErr)
      // Fallback: basic client-side-like check
      const mismatches: string[] = []
      let confidence = 50

      if (extractedFields?.employeeName && knownData.uaepassNameEn) {
        const docName = String(extractedFields.employeeName).toLowerCase().trim()
        const knownName = String(knownData.uaepassNameEn).toLowerCase().trim()
        if (!docName.includes(knownName.split(' ')[0]) && !knownName.includes(docName.split(' ')[0])) {
          mismatches.push('Name on document does not match UAEPASS name')
          confidence -= 20
        }
      }
      if (extractedFields?.monthlySalary && knownData.dbMonthlyIncome) {
        const docSalary = Number(extractedFields.monthlySalary)
        const dbSalary = Number(knownData.dbMonthlyIncome)
        if (docSalary > 0 && dbSalary > 0 && Math.abs(docSalary - dbSalary) / dbSalary > 0.1) {
          mismatches.push('Salary on document differs from DB record by more than 10%')
          confidence -= 15
        }
      }
      if (extractedFields?.employer && knownData.uaepassEmployer) {
        const docEmployer = String(extractedFields.employer).toLowerCase().trim()
        const knownEmployer = String(knownData.uaepassEmployer).toLowerCase().trim()
        if (!docEmployer.includes(knownEmployer.substring(0, 5)) && !knownEmployer.includes(docEmployer.substring(0, 5))) {
          mismatches.push('Employer name on document does not match UAEPASS employer')
          confidence -= 15
        }
      }

      verifyResult = {
        verified: mismatches.length === 0,
        mismatches,
        confidence: Math.max(confidence, 10),
        details: mismatches.length > 0
          ? `Found ${mismatches.length} mismatch(es): ${mismatches.join('; ')}`
          : 'Basic verification passed (AI analysis unavailable, performed rule-based check)',
        checks: {
          nameMatch: { match: null, detail: 'AI analysis unavailable' },
          salaryMatch: { match: null, detail: 'AI analysis unavailable' },
          employerMatch: { match: null, detail: 'AI analysis unavailable' },
          emiratesIdMatch: { match: null, detail: 'AI analysis unavailable' },
        },
      }
    }

    return c.json({ data: verifyResult })
  } catch (error: any) {
    console.error('Document identity verification error:', error)
    return c.json({ error: 'Verification failed', message: error.message }, 500)
  }
})

// ── Admin Chatbot Routes ──────────────────────────────────────────────

// GET /api/admin-chatbot/stats
app.get('/api/admin-chatbot/stats', async (c) => {
  const token = extractToken(c)
  const auth = await verifyAuth(token || '')
  if (!auth.authenticated) return c.json({ error: auth.error }, 401)

  try {
    // Total requests
    const totalRequests = toNum((queryFirst('SELECT COUNT(*) as count FROM ReschedulingRequest') as any)?.count, 0)

    // Requests by status
    const statusDistribution = (query("SELECT status, COUNT(*) as count FROM ReschedulingRequest GROUP BY status").results || []) as any[]

    // Pending count
    const pendingCount = toNum((queryFirst("SELECT COUNT(*) as count FROM ReschedulingRequest WHERE status IN ('pending', 'under_review')") as any)?.count, 0)

    // Approved count
    const approvedCount = toNum((queryFirst("SELECT COUNT(*) as count FROM ReschedulingRequest WHERE status = 'approved'") as any)?.count, 0)

    // Rejected count
    const rejectedCount = toNum((queryFirst("SELECT COUNT(*) as count FROM ReschedulingRequest WHERE status = 'rejected'") as any)?.count, 0)

    // Approval rate
    const decidedCount = approvedCount + rejectedCount
    const approvalRate = decidedCount > 0 ? Math.round((approvedCount / decidedCount) * 100) : 0

    // Risk distribution
    const riskDistribution = (query("SELECT riskLevel, COUNT(*) as count FROM AIAssessment GROUP BY riskLevel").results || []) as any[]

    // High risk cases
    const highRiskCount = toNum((queryFirst("SELECT COUNT(*) as count FROM AIAssessment WHERE riskLevel IN ('high', 'critical')") as any)?.count, 0)

    // Average installment
    const avgInstallment = toNum((queryFirst("SELECT AVG(monthlyInstallment) as val FROM HousingLoan WHERE status = 'active'") as any)?.val, 0)

    // Total arrears
    const totalArrears = toNum((queryFirst("SELECT COALESCE(SUM(totalOverdue), 0) as val FROM Arrear") as any)?.val, 0)

    // Average delay days
    const avgDelayDays = toNum((queryFirst("SELECT AVG(delayDays) as val FROM Arrear") as any)?.val, 0)

    // Loan stats
    const totalLoans = toNum((queryFirst("SELECT COUNT(*) as count FROM HousingLoan WHERE status = 'active'") as any)?.count, 0)
    const totalOutstanding = toNum((queryFirst("SELECT COALESCE(SUM(remainingBalance), 0) as val FROM HousingLoan WHERE status = 'active'") as any)?.val, 0)

    // Reason distribution
    const reasonDistribution = (query("SELECT reasonCategory, COUNT(*) as count FROM ReschedulingRequest GROUP BY reasonCategory").results || []) as any[]

    // Monthly trend (last 6 months)
    const monthlyTrend = (query(`
      SELECT strftime('%Y-%m', createdAt) as month,
             COUNT(*) as total,
             SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
             SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
      FROM ReschedulingRequest
      WHERE createdAt >= date('now', '-6 months')
      GROUP BY strftime('%Y-%m', createdAt)
      ORDER BY month DESC
    `).results || []) as any[]

    // Escalated count
    const escalatedCount = toNum((queryFirst("SELECT COUNT(*) as count FROM ReschedulingRequest WHERE status = 'escalated'") as any)?.count, 0)

    return c.json({
      totalRequests,
      statusDistribution,
      pendingCount,
      approvedCount,
      rejectedCount,
      approvalRate,
      riskDistribution,
      highRiskCount,
      avgInstallment: Math.round(avgInstallment),
      totalArrears,
      avgDelayDays: Math.round(avgDelayDays),
      totalLoans,
      totalOutstanding,
      reasonDistribution,
      monthlyTrend,
      escalatedCount,
    })
  } catch (error: any) {
    console.error('Admin chatbot stats error:', error)
    return c.json({ error: 'Failed to load stats', message: error.message }, 500)
  }
})

// POST /api/admin-chatbot
app.post('/api/admin-chatbot', async (c) => {
  const token = extractToken(c)
  const auth = await verifyAuth(token || '')
  if (!auth.authenticated) return c.json({ error: auth.error }, 401)

  let lang = 'en'
  try {
    const body = await c.req.json()
    const { message, context, language, role, permissions, currentView } = body
    lang = language || 'en'
    if (!message) return c.json({ error: 'Message is required' }, 400)

    // Determine if the user has full access based on role
    const fullAccessRoles = ['manager', 'admin', 'superadmin']
    const hasFullAccess = fullAccessRoles.includes(role)
    const isReviewer = role === 'reviewer'
    const isEmployee = role === 'employee'

    // ── Fetch comprehensive live data from ALL database tables ──────────

    // 1. Summary statistics
    const totalRequests = toNum((queryFirst('SELECT COUNT(*) as count FROM ReschedulingRequest') as any)?.count, 0)
    const statusDist = (query("SELECT status, COUNT(*) as count FROM ReschedulingRequest GROUP BY status").results || []) as any[]
    const riskDist = (query("SELECT riskLevel, COUNT(*) as count FROM AIAssessment GROUP BY riskLevel").results || []) as any[]
    const avgInstallment = toNum((queryFirst("SELECT AVG(monthlyInstallment) as val FROM HousingLoan WHERE status = 'active'") as any)?.val, 0)
    const totalArrears = toNum((queryFirst("SELECT COALESCE(SUM(totalOverdue), 0) as val FROM Arrear") as any)?.val, 0)
    const avgDelayDays = toNum((queryFirst("SELECT AVG(delayDays) as val FROM Arrear") as any)?.val, 0)
    const totalLoans = toNum((queryFirst("SELECT COUNT(*) as count FROM HousingLoan WHERE status = 'active'") as any)?.count, 0)
    const totalOutstanding = toNum((queryFirst("SELECT COALESCE(SUM(remainingBalance), 0) as val FROM HousingLoan WHERE status = 'active'") as any)?.val, 0)
    const reasonDist = (query("SELECT reasonCategory, COUNT(*) as count FROM ReschedulingRequest GROUP BY reasonCategory").results || []) as any[]
    const pendingCount = toNum((queryFirst("SELECT COUNT(*) as count FROM ReschedulingRequest WHERE status IN ('pending', 'under_review')") as any)?.count, 0)
    const approvedCount = toNum((queryFirst("SELECT COUNT(*) as count FROM ReschedulingRequest WHERE status = 'approved'") as any)?.count, 0)
    const rejectedCount = toNum((queryFirst("SELECT COUNT(*) as count FROM ReschedulingRequest WHERE status = 'rejected'") as any)?.count, 0)
    const highRiskCount = toNum((queryFirst("SELECT COUNT(*) as count FROM AIAssessment WHERE riskLevel IN ('high', 'critical')") as any)?.count, 0)
    const escalatedCount = toNum((queryFirst("SELECT COUNT(*) as count FROM ReschedulingRequest WHERE status = 'escalated'") as any)?.count, 0)
    const decidedCount = approvedCount + rejectedCount
    const approvalRate = decidedCount > 0 ? Math.round((approvedCount / decidedCount) * 100) : 0

    // 2. Recent cases with FULL details (applicant, loan, arrear, assessment)
    const recentCases = (query(`
      SELECT r.id, r.status, r.reasonCategory, r.reason, r.requestedDurationMonths, r.priority, r.createdAt, r.reviewedAt,
        r.incomePerFamilyMember, r.deductionRate,
        a.nameAr, a.nameEn, a.monthlyIncome, a.employerType, a.familySize, a.emiratesId as applicantEmiratesId,
        a.employer, a.maritalStatus, a.isCitizen, a.hasFamilyBook, a.incomeStability,
        l.originalAmount, l.remainingBalance, l.monthlyInstallment, l.loanType, l.loanDurationMonths, l.elapsedMonths, l.interestRate,
        ar.missedMonths, ar.totalOverdue, ar.delayDays, ar.consecutiveMissedMonths, ar.reason as arrearReason,
        ass.riskScore, ass.riskLevel, ass.eligibilityStatus, ass.moeiRecommendation, ass.dbrAfterRescheduling, ass.recommendedDuration
      FROM ReschedulingRequest r
      LEFT JOIN Applicant a ON r.applicantId = a.id
      LEFT JOIN HousingLoan l ON r.loanId = l.id
      LEFT JOIN Arrear ar ON ar.loanId = l.id
      LEFT JOIN AIAssessment ass ON ass.requestId = r.id
      ORDER BY r.createdAt DESC LIMIT 30
    `).results || []) as any[]

    // 3. Pending cases (most urgent)
    const pendingCases = (query(`
      SELECT r.id, r.status, r.reasonCategory, r.reason, r.priority, r.createdAt,
        a.nameAr, a.nameEn, a.employerType, a.familySize,
        l.monthlyInstallment, l.remainingBalance, l.loanType,
        ar.delayDays, ar.totalOverdue, ar.missedMonths,
        ass.riskScore, ass.riskLevel, ass.eligibilityStatus
      FROM ReschedulingRequest r
      LEFT JOIN Applicant a ON r.applicantId = a.id
      LEFT JOIN HousingLoan l ON r.loanId = l.id
      LEFT JOIN Arrear ar ON ar.loanId = l.id
      LEFT JOIN AIAssessment ass ON ass.requestId = r.id
      WHERE r.status IN ('pending', 'under_review')
      ORDER BY ar.delayDays DESC, r.priority DESC, r.createdAt ASC
      LIMIT 20
    `).results || []) as any[]

    // 4. High risk / critical cases
    const highRiskCases = (query(`
      SELECT r.id, r.status, r.reasonCategory, r.priority, r.createdAt,
        a.nameAr, a.nameEn, a.employerType,
        l.monthlyInstallment, l.remainingBalance,
        ar.delayDays, ar.totalOverdue,
        ass.riskScore, ass.riskLevel, ass.eligibilityStatus, ass.moeiRecommendation
      FROM ReschedulingRequest r
      LEFT JOIN Applicant a ON r.applicantId = a.id
      LEFT JOIN HousingLoan l ON r.loanId = l.id
      LEFT JOIN Arrear ar ON ar.loanId = l.id
      JOIN AIAssessment ass ON ass.requestId = r.id
      WHERE ass.riskLevel IN ('high', 'critical')
      ORDER BY ass.riskScore DESC, ar.delayDays DESC
      LIMIT 15
    `).results || []) as any[]

    // 5. Users / Employees info
    const totalUsers = toNum((queryFirst('SELECT COUNT(*) as count FROM User') as any)?.count, 0)
    const activeUsers = toNum((queryFirst('SELECT COUNT(*) as count FROM User WHERE isActive = 1') as any)?.count, 0)
    const roleDist = (query("SELECT role, COUNT(*) as count FROM User WHERE isActive = 1 GROUP BY role").results || []) as any[]
    const employeeList = (query(`
      SELECT id, firstnameEN, lastnameEN, email, role, department, isActive, lastLoginAt
      FROM User WHERE role IN ('admin', 'manager', 'reviewer', 'employee', 'superadmin') AND isActive = 1
      ORDER BY role, lastnameEN LIMIT 20
    `).results || []) as any[]

    // 6. Recent audit trail
    const recentAudit = (query(`
      SELECT al.action, al.performedBy, al.details, al.category, al.createdAt,
        u.firstnameEN as performerName, u.lastnameEN as performerLast, u.role as performerRole
      FROM AuditLog al
      LEFT JOIN User u ON al.performedBy = u.id
      ORDER BY al.createdAt DESC LIMIT 20
    `).results || []) as any[]

    // 7. System configuration summary
    const configKeys = [
      'max_dbr_limit', 'dbr_healthy_limit', 'auto_approve_enabled', 'auto_approve_max_risk_score',
      'auto_approve_max_dbr', 'auto_reject_enabled', 'auto_reject_min_dbr', 'auto_reject_min_risk_score',
      'risk_score_low', 'risk_score_medium', 'risk_score_high',
      'max_loan_duration_months', 'max_housing_loan_amount', 'max_grant_amount', 'max_maintenance_amount',
      'citizenship_required', 'salary_certificate_required', 'grace_period_max_months',
    ]
    const configRows = (query(`SELECT configKey, configValue FROM SystemConfig WHERE isActive = 1 AND configKey IN (${configKeys.map(() => '?').join(',')})`, configKeys).results || []) as any[]
    const configMap: Record<string, string> = {}
    for (const row of configRows) { configMap[row.configKey] = row.configValue }

    // 8. Employer type distribution
    const employerDist = (query("SELECT employerType, COUNT(*) as count, AVG(monthlyIncome) as avgIncome FROM Applicant GROUP BY employerType").results || []) as any[]

    // 9. Monthly trend (last 12 months)
    const monthlyTrend = (query(`
      SELECT strftime('%Y-%m', createdAt) as month,
             COUNT(*) as total,
             SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
             SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
             SUM(CASE WHEN status IN ('pending', 'under_review') THEN 1 ELSE 0 END) as pending
      FROM ReschedulingRequest
      WHERE createdAt >= date('now', '-12 months')
      GROUP BY strftime('%Y-%m', createdAt)
      ORDER BY month DESC
    `).results || []) as any[]

    // 10. Loan type distribution
    const loanTypeDist = (query("SELECT loanType, COUNT(*) as count, AVG(remainingBalance) as avgBalance FROM HousingLoan WHERE status = 'active' GROUP BY loanType").results || []) as any[]

    // ── Build permission-specific prompt section ───────────────────────
    let permissionPrompt = ''
    if (isEmployee) {
      permissionPrompt = '\n\nPermission restrictions: You can only view basic dashboard stats. You CANNOT see financial details (monthlyIncome, remainingBalance, totalOverdue, monthlyInstallment, originalAmount, interestRate, deductionRate, incomePerFamilyMember), applicant names, or specific case details. If asked about these, explain that your role does not permit access to that information.'
    } else if (isReviewer) {
      permissionPrompt = '\n\nPermission restrictions: You can view cases and statistics but CANNOT see sensitive financial figures (monthlyIncome, remainingBalance, totalOverdue, originalAmount, interestRate). You CAN see risk levels, delay days, missed months, employer type, loan type, and case status. If asked about restricted financial data, explain that your role does not permit access.'
    } else if (hasFullAccess) {
      permissionPrompt = '\n\nPermission level: You have FULL read access to all data including financial details, risk scores, applicant names, and all cases. Provide comprehensive answers.'
    }

    // ── Current view context ──────────────────────────────────────────────
    const viewLabels: Record<string, string> = {
      'dashboard': 'Dashboard — viewing overview statistics and charts',
      'cases': 'Cases — viewing list of rescheduling requests',
      'case-detail': 'Case Detail — viewing a specific case with full applicant, loan, arrear, and assessment data',
      'form-builder': 'AI Prompts — viewing form field AI validation prompts',
      'workflows': 'Workflows — viewing system configuration and approval rules',
      'users': 'Employees — viewing employee/user accounts',
      'audit': 'Audit Log — viewing system audit trail',
      'models': 'AI Models — viewing AI model configurations',
      'data-import': 'Data Import — importing data from files',
      'settings': 'Settings — viewing/editing system settings',
    }
    const currentViewLabel = viewLabels[currentView || 'dashboard'] || `Unknown view (${currentView})`
    const viewContextStr = `\n\nCurrent page context: The employee is currently on the "${currentViewLabel}" page. Use this to understand what they're likely asking about. If they say "this page" or "here" or ask about something visible on their screen, reference the current page context.`

    // ── Format case data for the prompt (filtered by permissions) ──────
    const formatCase = (c: any, idx: number): string => {
      const name = hasFullAccess ? (c.nameEn || c.nameAr || 'Unknown') : (isReviewer ? `Case #${idx + 1}` : '')
      const base = `Case ${idx + 1}: ID=${c.id?.slice(0,8)}..., Status=${c.status}, Priority=${c.priority}, Reason=${c.reasonCategory || 'N/A'}, Created=${c.createdAt?.slice(0,16) || 'N/A'}`
      if (isEmployee) return base
      const mid = `${base}, Applicant=${name}, EmployerType=${c.employerType || 'N/A'}, FamilySize=${c.familySize || 'N/A'}, DelayDays=${c.delayDays ?? 'N/A'}, MissedMonths=${c.missedMonths ?? 'N/A'}, RiskLevel=${c.riskLevel || 'Not assessed'}`
      if (isReviewer) return mid
      // Full access
      return `${mid}, MonthlyIncome=AED ${(c.monthlyIncome||0).toLocaleString()}, MonthlyInstallment=AED ${(c.monthlyInstallment||0).toLocaleString()}, RemainingBalance=AED ${(c.remainingBalance||0).toLocaleString()}, TotalOverdue=AED ${(c.totalOverdue||0).toLocaleString()}, OriginalAmount=AED ${(c.originalAmount||0).toLocaleString()}, LoanType=${c.loanType||'N/A'}, RiskScore=${c.riskScore ?? 'N/A'}, Eligibility=${c.eligibilityStatus || 'N/A'}, DBR=${c.deductionRate?.toFixed(1) || 'N/A'}%${c.moeiRecommendation ? ', MOEIRecommendation=' + c.moeiRecommendation : ''}`
    }

    const recentCasesStr = recentCases.length > 0
      ? recentCases.slice(0, 15).map((c, i) => formatCase(c, i)).join('\n')
      : 'No cases in the database yet.'

    const pendingCasesStr = pendingCases.length > 0
      ? pendingCases.slice(0, 10).map((c, i) => formatCase(c, i)).join('\n')
      : 'No pending cases.'

    const highRiskCasesStr = highRiskCases.length > 0
      ? highRiskCases.slice(0, 10).map((c, i) => formatCase(c, i)).join('\n')
      : 'No high risk cases.'

    // ── Build system prompt with comprehensive live data ───────────────
    const financialStats = hasFullAccess
      ? `- Total outstanding balance: AED ${totalOutstanding.toLocaleString()}
- Average monthly installment: AED ${Math.round(avgInstallment).toLocaleString()}
- Total arrears: AED ${totalArrears.toLocaleString()}
- Average delay days: ${Math.round(avgDelayDays)}
- Total active loans: ${totalLoans}
- Loan types: ${loanTypeDist.map((l: any) => `${l.loanType}: ${l.count} loans, avg balance AED ${Math.round(l.avgBalance).toLocaleString()}`).join('; ')}`
      : isReviewer
      ? `- Total active loans: ${totalLoans}
- Average delay days: ${Math.round(avgDelayDays)}
- Loan types: ${loanTypeDist.map((l: any) => `${l.loanType}: ${l.count} loans`).join('; ')}`
      : `- Total active loans: ${totalLoans}`

    const employerStats = employerDist.length > 0
      ? employerDist.map((e: any) => `${e.employerType}: ${e.count} applicants (avg income AED ${Math.round(e.avgIncome).toLocaleString()})`).join('; ')
      : 'No employer data.'

    const auditStr = recentAudit.length > 0 && (hasFullAccess || isReviewer)
      ? recentAudit.slice(0, 10).map((a: any) => `${a.createdAt?.slice(0,16)} | ${a.action} | ${a.performerName || a.performedBy?.slice(0,8)} (${a.performerRole || '?'}) | ${a.category} | ${(a.details || '').slice(0,80)}`).join('\n')
      : ''

    const configStr = Object.entries(configMap).length > 0 && hasFullAccess
      ? Object.entries(configMap).map(([k, v]) => `${k}=${v}`).join(', ')
      : ''

    const systemPrompt = `You are the SZHP Admin AI Assistant, an intelligent data analyst for the Sheikh Zayed Housing Programme (SZHP) arrears rescheduling system. You help administrators understand data, analyze trends, and make informed decisions about housing loan rescheduling requests.
${permissionPrompt}${viewContextStr}

═══════════════════════════════════════════
CURRENT DATABASE STATISTICS (LIVE DATA):
═══════════════════════════════════════════
- Total rescheduling requests: ${totalRequests}
- Pending review: ${pendingCount}
- Approved: ${approvedCount}
- Rejected: ${rejectedCount}
- Escalated: ${escalatedCount}
- Approval rate: ${approvalRate}%
- High risk/critical cases: ${highRiskCount}
${financialStats}

Status distribution: ${statusDist.map((s: any) => `${s.status}: ${s.count}`).join(', ')}
Risk distribution: ${riskDist.map((r: any) => `${r.riskLevel || 'unassessed'}: ${r.count}`).join(', ')}
Reason categories: ${reasonDist.map((r: any) => `${r.reasonCategory}: ${r.count}`).join(', ')}
Employer types: ${employerStats}

═══════════════════════════════════════════
RECENT CASES (last 15, with full details):
═══════════════════════════════════════════
${recentCasesStr}

═══════════════════════════════════════════
PENDING CASES (oldest first, max 10):
═══════════════════════════════════════════
${pendingCasesStr}

═══════════════════════════════════════════
HIGH RISK / CRITICAL CASES (max 10):
═══════════════════════════════════════════
${highRiskCasesStr}

═══════════════════════════════════════════
MONTHLY TREND (last 12 months):
═══════════════════════════════════════════
${monthlyTrend.map((m: any) => `${m.month}: ${m.total} total, ${m.approved} approved, ${m.rejected} rejected, ${m.pending} pending`).join('\n')}${auditStr ? `

═══════════════════════════════════════════
RECENT AUDIT TRAIL (last 10 actions):
═══════════════════════════════════════════
${auditStr}` : ''}${configStr ? `

═══════════════════════════════════════════
SYSTEM CONFIGURATION:
═══════════════════════════════════════════
${configStr}` : ''}

═══════════════════════════════════════════
USERS / EMPLOYEES:
═══════════════════════════════════════════
Total users: ${totalUsers}, Active: ${activeUsers}
Roles: ${roleDist.map((r: any) => `${r.role}: ${r.count}`).join(', ')}${hasFullAccess && employeeList.length > 0 ? '\n' + employeeList.map((e: any) => `- ${e.firstnameEN} ${e.lastnameEN} (${e.role}, ${e.department || 'N/A'}, last login: ${e.lastLoginAt?.slice(0,10) || 'never'})`).join('\n') : ''}

RESPONSE STYLE:
- Talk like a colleague, not a report. Be direct and natural — human to human.
- NEVER repeat the question back. NEVER say "Based on the data..." or "According to the statistics..." — just answer.
- NEVER recap previous messages or conversation history. Just give the answer.
- NEVER start with filler phrases like "Here's what I found:" or "Looking at the data:" — dive straight in.
- NEVER output a "Data Used" summary table or statistics block in your response unless the user explicitly asks for an overview, summary, or statistics breakdown. Just answer the question directly with the relevant numbers.
- Use REAL DATABASE DATA above to answer accurately. Reference specific numbers and case details when relevant.
- Be concise. Give the exact answer asked for, nothing more. If they ask "how many pending?", say "2" not "There are currently 2 pending cases in the system."
- For follow-up questions, treat the conversation as continuous — don't re-explain context.
- Format numbers with commas (e.g., 1,500,000) and use AED for currency.
- If you don't have enough data, say so briefly.
- Always respond in ${lang === 'ar' ? 'Arabic' : 'English'}`

    // Build the data used object for transparency (filtered by permissions)
    // ── Detect if user explicitly asks for stats/data overview (to show "Data Used" panel) ──
    // Only show the Data Used panel when the user explicitly requests a summary, overview, or statistics breakdown
    const explicitStatsKeywords = ['show me the data', 'show data', 'data summary', 'data overview', 'statistics summary', 'stats summary', 'data used', 'show statistics', 'show stats', 'give me a summary', 'give me an overview', 'overall summary', 'full overview', 'full summary', 'أظهر البيانات', 'ملخص البيانات', 'إحصائيات', 'نظرة عامة']
    const lowerMsg = message.toLowerCase()
    const isStatsQuestion = explicitStatsKeywords.some(kw => lowerMsg.includes(kw))

    const dataUsed: Record<string, any> = {
      totalRequests,
      statusDistribution: statusDist,
      riskDistribution: riskDist,
      approvalRate,
      pendingCount,
      approvedCount,
      rejectedCount,
      highRiskCount,
      avgDelayDays: Math.round(avgDelayDays),
      totalLoans,
      reasonDistribution: reasonDist,
      monthlyTrend,
      recentCasesCount: recentCases.length,
      pendingCasesCount: pendingCases.length,
      highRiskCasesCount: highRiskCases.length,
      totalUsers,
      activeUsers,
      _showDataPanel: isStatsQuestion,
    }

    // Only include sensitive financial data for full-access roles
    if (hasFullAccess) {
      dataUsed.avgInstallment = Math.round(avgInstallment)
      dataUsed.totalArrears = totalArrears
      dataUsed.totalOutstanding = totalOutstanding
    }

    // Use shared chatCompletion (direct fetch to Recentech AI)
    let responseText = ''
    try {
      const aiConfig = resolveAIConfig()

      // SSRF protection
      if (!isUrlSafeForServerSideRequest(aiConfig.baseUrl)) {
        return c.json({
          response: lang === 'ar'
            ? 'خدمة الذكاء الاصطناعي غير متوفرة حالياً. يرجى المحاولة لاحقاً.'
            : 'AI service is currently unavailable. Please try again later.',
          dataUsed: null,
        })
      }

      const chatMessages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        ...(context || []).map((msg: any) => ({ role: msg.role as any, content: msg.content })),
        { role: 'user', content: message },
      ]

      const aiResponse = await chatCompletion(chatMessages, aiConfig, {
        maxTokens: 2048,
        temperature: 0.5,
      })

      responseText = aiResponse?.content || (lang === 'ar' ? 'عذراً، لم أتمكن من معالجة طلبك.' : 'Sorry, I could not process your request.')
    } catch (err: any) {
      console.warn('Admin chat failed:', err?.message)
    }

    if (!responseText) {
      responseText = lang === 'ar' ? 'عذراً، لم أتمكن من معالجة طلبك.' : 'Sorry, I could not process your request.'
    }

    return c.json({ response: responseText, dataUsed })
  } catch (error: any) {
    console.error('Admin chatbot error:', error)
    return c.json({
      response: lang === 'ar' ? 'عذراً، حدث خطأ أثناء معالجة طلبك. يرجى المحاولة لاحقاً.' : 'Sorry, an error occurred while processing your request. Please try again later.',
      dataUsed: null,
      error: error.message,
    }, 500)
  }
})

// ── Data Import Routes ──────────────────────────────────────────────

// Table schema definitions for import mapping
const IMPORT_TABLE_SCHEMAS: Record<string, Array<{ name: string; type: string; required: boolean; label: string }>> = {
  Applicant: [
    { name: 'emiratesId', type: 'string', required: true, label: 'Emirates ID' },
    { name: 'nameAr', type: 'string', required: true, label: 'Name (Arabic)' },
    { name: 'nameEn', type: 'string', required: false, label: 'Name (English)' },
    { name: 'phone', type: 'string', required: true, label: 'Phone' },
    { name: 'email', type: 'string', required: false, label: 'Email' },
    { name: 'monthlyIncome', type: 'number', required: true, label: 'Monthly Income' },
    { name: 'employer', type: 'string', required: false, label: 'Employer' },
    { name: 'employerType', type: 'string', required: false, label: 'Employer Type' },
    { name: 'familySize', type: 'number', required: true, label: 'Family Size' },
    { name: 'isCitizen', type: 'number', required: false, label: 'Is Citizen (1/0)' },
    { name: 'hasFamilyBook', type: 'number', required: false, label: 'Has Family Book (1/0)' },
    { name: 'maritalStatus', type: 'string', required: false, label: 'Marital Status' },
  ],
  HousingLoan: [
    { name: 'applicantId', type: 'string', required: true, label: 'Applicant ID' },
    { name: 'originalAmount', type: 'number', required: true, label: 'Original Amount' },
    { name: 'remainingBalance', type: 'number', required: true, label: 'Remaining Balance' },
    { name: 'monthlyInstallment', type: 'number', required: true, label: 'Monthly Installment' },
    { name: 'loanDurationMonths', type: 'number', required: false, label: 'Loan Duration (Months)' },
    { name: 'elapsedMonths', type: 'number', required: false, label: 'Elapsed Months' },
    { name: 'interestRate', type: 'number', required: false, label: 'Interest Rate' },
    { name: 'loanType', type: 'string', required: true, label: 'Loan Type' },
    { name: 'status', type: 'string', required: false, label: 'Status' },
  ],
  Arrear: [
    { name: 'loanId', type: 'string', required: true, label: 'Loan ID' },
    { name: 'missedMonths', type: 'number', required: true, label: 'Missed Months' },
    { name: 'totalOverdue', type: 'number', required: true, label: 'Total Overdue' },
    { name: 'delayDays', type: 'number', required: true, label: 'Delay Days' },
    { name: 'reason', type: 'string', required: false, label: 'Reason' },
  ],
  ReschedulingRequest: [
    { name: 'applicantId', type: 'string', required: true, label: 'Applicant ID' },
    { name: 'loanId', type: 'string', required: true, label: 'Loan ID' },
    { name: 'requestedDurationMonths', type: 'number', required: true, label: 'Requested Duration (Months)' },
    { name: 'reason', type: 'string', required: false, label: 'Reason' },
    { name: 'reasonCategory', type: 'string', required: true, label: 'Reason Category' },
    { name: 'status', type: 'string', required: false, label: 'Status' },
    { name: 'priority', type: 'string', required: false, label: 'Priority' },
  ],
}

// GET /api/import/schema/:table — Returns schema for a given table
app.get('/api/import/schema/:table', async (c) => {
  const token = extractToken(c)
  const auth = await verifyAuth(token || '')
  if (!auth.authenticated) return c.json({ error: auth.error }, 401)

  const table = c.req.param('table')
  const schema = IMPORT_TABLE_SCHEMAS[table]
  if (!schema) {
    return c.json({ error: `Unknown table: ${table}. Available: ${Object.keys(IMPORT_TABLE_SCHEMAS).join(', ')}` }, 400)
  }

  return c.json({ table, columns: schema })
})

// POST /api/import/preview — Parse uploaded CSV file and return preview
app.post('/api/import/preview', async (c) => {
  const token = extractToken(c)
  const auth = await verifyAuth(token || '')
  if (!auth.authenticated) return c.json({ error: auth.error }, 401)

  try {
    const body = await c.req.parseBody()
    const file = body['file']

    if (!file || !(file instanceof File)) {
      return c.json({ error: 'No file uploaded. Please provide a file with key "file".' }, 400)
    }

    const fileName = file.name.toLowerCase()
    if (!fileName.endsWith('.csv') && !fileName.endsWith('.xlsx')) {
      return c.json({ error: 'Unsupported file format. Please upload a .csv or .xlsx file.' }, 400)
    }

    // For XLSX, we recommend saving as CSV first but also try basic parsing
    if (fileName.endsWith('.xlsx')) {
      // Try to read as CSV (some xlsx exports are actually CSV)
      // Otherwise, return a helpful message
      const text = await file.text()
      if (text.includes('<') && text.includes('xml')) {
        return c.json({
          error: 'XLSX format requires conversion. Please save your file as CSV first, then re-upload.',
          hint: 'In Excel: File → Save As → CSV (Comma delimited) (*.csv)',
        }, 400)
      }
    }

    const text = await file.text()
    // Use papaparse for CSV parsing
    const Papa = await import('papaparse')
    const result = Papa.parse(text, {
      header: false,
      skipEmptyLines: true,
      dynamicTyping: false, // keep as strings so we can detect types ourselves
    })

    if (result.errors && result.errors.length > 0 && result.data.length === 0) {
      return c.json({ error: 'Failed to parse file', details: result.errors.slice(0, 5) }, 400)
    }

    const allRows = result.data as string[][]
    if (allRows.length === 0) {
      return c.json({ error: 'File is empty' }, 400)
    }

    // First row is headers
    const headers = allRows[0].map((h: string) => (h || '').trim())
    const dataRows = allRows.slice(1)
    const previewRows = dataRows.slice(0, 5)
    const totalRows = dataRows.length

    // Detect column types based on sample data
    const types: string[] = headers.map((_: string, colIdx: number) => {
      const sampleValues = previewRows.map(row => row[colIdx]).filter(v => v !== undefined && v !== '')
      if (sampleValues.length === 0) return 'string'

      const numCount = sampleValues.filter(v => !isNaN(Number(v)) && v.trim() !== '').length
      if (numCount === sampleValues.length) return 'number'

      // Check for date patterns
      const datePattern = /^\d{4}[-/]\d{2}[-/]\d{2}/
      const dateCount = sampleValues.filter(v => datePattern.test(v.trim())).length
      if (dateCount > sampleValues.length * 0.5) return 'date'

      return 'string'
    })

    return c.json({
      headers,
      rows: previewRows,
      totalRows,
      types,
      fileName: file.name,
    })
  } catch (error: any) {
    console.error('Import preview error:', error)
    return c.json({ error: 'Failed to parse file', message: error.message }, 500)
  }
})

// POST /api/import/execute — Execute the import with mapped columns
app.post('/api/import/execute', async (c) => {
  const token = extractToken(c)
  const auth = await verifyAuth(token || '')
  if (!auth.authenticated) return c.json({ error: auth.error }, 401)

  try {
    const { headers, rows, targetTable, columnMapping, importOptions } = await c.req.json()

    if (!targetTable || !IMPORT_TABLE_SCHEMAS[targetTable]) {
      return c.json({ error: `Invalid target table. Available: ${Object.keys(IMPORT_TABLE_SCHEMAS).join(', ')}` }, 400)
    }
    if (!headers || !rows || !columnMapping) {
      return c.json({ error: 'Missing required fields: headers, rows, columnMapping' }, 400)
    }

    const schema = IMPORT_TABLE_SCHEMAS[targetTable]
    const requiredColumns = schema.filter(c => c.required).map(c => c.name)

    // Validate that all required columns are mapped
    const mappedColumns = Object.values(columnMapping as Record<string, string>).filter(v => v && v !== 'skip')
    for (const reqCol of requiredColumns) {
      if (!mappedColumns.includes(reqCol)) {
        return c.json({ error: `Required column "${reqCol}" is not mapped` }, 400)
      }
    }

    const errors: Array<{ row: number; column: string; message: string }> = []
    let imported = 0
    let skipped = 0
    const batchSize = importOptions?.batchSize || 50

    // Process rows
    for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
      const row = rows[rowIdx]
      const rowData: Record<string, any> = {}

      // Build mapped row data
      for (const [fileColIdx, dbCol] of Object.entries(columnMapping as Record<string, string>)) {
        if (dbCol === 'skip' || !dbCol) continue
        const colIdx = parseInt(fileColIdx)
        const colSchema = schema.find(c => c.name === dbCol)
        let value = row[colIdx]

        if (value === undefined || value === null || String(value).trim() === '') {
          if (colSchema?.required) {
            errors.push({ row: rowIdx + 1, column: dbCol, message: `Required field "${dbCol}" is empty` })
            continue
          }
          value = null
        } else {
          // Type conversion
          if (colSchema?.type === 'number') {
            const num = Number(String(value).replace(/,/g, ''))
            if (isNaN(num)) {
              errors.push({ row: rowIdx + 1, column: dbCol, message: `Invalid number: "${value}"` })
              continue
            }
            value = num
          }
          if (colSchema?.type === 'string') {
            value = String(value).trim()
          }
        }

        rowData[dbCol] = value
      }

      // Check if row has errors — skip if so
      const rowHasErrors = errors.some(e => e.row === rowIdx + 1)
      if (rowHasErrors) {
        skipped++
        continue
      }

      // Validate required fields one more time
      let missingRequired = false
      for (const reqCol of requiredColumns) {
        if (rowData[reqCol] === undefined || rowData[reqCol] === null) {
          errors.push({ row: rowIdx + 1, column: reqCol, message: `Required field "${reqCol}" is missing` })
          missingRequired = true
        }
      }
      if (missingRequired) {
        skipped++
        continue
      }

      // Insert the row
      try {
        const id = generateId()
        const columns = ['id', ...Object.keys(rowData)]
        const values = [id, ...Object.values(rowData)]
        const placeholders = columns.map(() => '?').join(', ')

        queryRun(`INSERT INTO ${targetTable} (${columns.join(', ')}) VALUES (${placeholders})`, values)
        imported++
      } catch (dbErr: any) {
        // Handle duplicate key or other DB errors
        if (dbErr.message?.includes('UNIQUE constraint')) {
          if (importOptions?.skipDuplicates) {
            skipped++
            errors.push({ row: rowIdx + 1, column: 'id', message: 'Duplicate record skipped' })
          } else {
            errors.push({ row: rowIdx + 1, column: 'id', message: `Duplicate record: ${dbErr.message}` })
            skipped++
          }
        } else {
          errors.push({ row: rowIdx + 1, column: '*', message: `DB error: ${dbErr.message?.substring(0, 100)}` })
          skipped++
        }
      }
    }

    // Create audit log for the import
    queryRun(`INSERT INTO AuditLog (id, requestId, action, performedBy, details, category) VALUES (?, ?, ?, ?, ?, ?)`,
      [generateId(), null, 'data_import', `admin:${auth.user?.email || auth.user?.id}`,
        JSON.stringify({ targetTable, imported, skipped, errors: errors.length, performedBy: auth.user?.email }),
        'import'])

    return c.json({
      imported,
      errors: errors.slice(0, 100), // Limit errors returned
      skipped,
      totalProcessed: rows.length,
    })
  } catch (error: any) {
    console.error('Import execute error:', error)
    return c.json({ error: 'Import failed', message: error.message }, 500)
  }
})

// ── 404 Handler ─────────────────────────────────────────────────────
app.notFound((c) => {
  return c.json({ error: 'Not found', path: c.req.path }, 404)
})

// ── Customer Chatbot Route ──────────────────────────────────────────
app.post('/api/customer-chatbot', async (c) => {
  try {
    const { message, context, language, emiratesId, userName, profileInfo } = await c.req.json()

    // ── Load system config values for data injection ────────────────
    const maxDbrLimit = getConfigNumber('max_dbr_limit', 0.6)
    const dbrHealthyLimit = getConfigNumber('dbr_healthy_limit', 0.35)
    const dbrCautionLimit = getConfigNumber('dbr_caution_limit', 0.5)
    const maxLoanDuration = getConfigNumber('max_loan_duration_months', 360)
    const minMonthlyIncome = getConfigNumber('min_monthly_income', 3000)
    const incomePerMemberThreshold = getConfigNumber('income_per_member_threshold', 2500)
    const maxGracePeriod = getConfigNumber('max_grace_period_months', 6)
    const gracePeriodMedical = getConfigNumber('grace_period_for_medical', 3)
    const gracePeriodDivorce = getConfigNumber('grace_period_for_divorce', 3)
    const salaryCertRequired = getConfigBoolean('salary_certificate_required', true)
    const citizenshipRequired = getConfigBoolean('citizenship_required', true)
    const familyBookRequired = getConfigBoolean('family_book_required', true)
    const eligibilityCheckEnabled = getConfigBoolean('eligibility_check_enabled', true)
    const humanReviewDays = getConfigNumber('human_review_estimated_days', 14)
    const autoApproveEnabled = getConfigBoolean('auto_approve_enabled', true)
    const autoApproveMaxDbr = getConfigNumber('auto_approve_max_dbr', 0.4)

    // ── Look up the logged-in citizen's own data (ONLY their own) ───
    let userDataSection = ''
    if (emiratesId) {
      const applicant = queryFirst('SELECT * FROM Applicant WHERE emiratesId = ?', [emiratesId]) as any
      if (applicant) {
        // Fetch ONLY this applicant's own requests (scoped by applicantId)
        const requests = (query(`
          SELECT r.*, l.originalAmount, l.remainingBalance, l.monthlyInstallment, l.loanType, l.loanDurationMonths,
            ar.missedMonths, ar.totalOverdue, ar.delayDays, ar.reason as arrearReason,
            ass.riskScore, ass.riskLevel, ass.eligibilityStatus, ass.moeiRecommendation
          FROM ReschedulingRequest r
          LEFT JOIN HousingLoan l ON r.loanId = l.id
          LEFT JOIN Arrear ar ON ar.loanId = l.id
          LEFT JOIN AIAssessment ass ON ass.requestId = r.id
          WHERE r.applicantId = ?
          ORDER BY r.createdAt DESC LIMIT 5
        `, [applicant.id]).results || []) as any[]

        const requestSummaries = requests.map((r: any, i: number) => {
          let summary = `  ${i + 1}. Request ID: ${r.id.substring(0, 8)}... | Status: ${r.status} | Category: ${r.reasonCategory || 'N/A'} | Created: ${r.createdAt}`
          if (r.originalAmount) summary += `\n     Loan: AED ${r.originalAmount.toLocaleString()} (Remaining: AED ${r.remainingBalance?.toLocaleString()}, Installment: AED ${r.monthlyInstallment?.toLocaleString()})`
          if (r.missedMonths) summary += `\n     Arrears: ${r.missedMonths} missed months, AED ${r.totalOverdue?.toLocaleString()} overdue, ${r.delayDays} days delay`
          if (r.riskScore !== null && r.riskScore !== undefined) summary += `\n     AI Assessment: Risk ${r.riskLevel} (score ${r.riskScore}), Eligibility: ${r.eligibilityStatus}`
          if (r.moeiRecommendation) summary += `, Recommendation: ${r.moeiRecommendation}`
          return summary
        })

        userDataSection = `
USER'S OWN DATA (this citizen is currently logged in):
- Name: ${applicant.nameEn || userName || 'Unknown'}${applicant.nameAr ? ` / ${applicant.nameAr}` : ''}
- Emirates ID: ${applicant.emiratesId || emiratesId}
- Monthly Income: AED ${applicant.monthlyIncome?.toLocaleString() || 'N/A'}
- Employer: ${applicant.employer || 'N/A'} (${applicant.employerType || 'N/A'})
- Family Size: ${applicant.familySize || 'N/A'}
- Marital Status: ${applicant.maritalStatus || 'N/A'}
- Spouse Income: AED ${applicant.spouseIncome?.toLocaleString() || '0'}
- Total Household Income: AED ${applicant.totalHouseholdIncome?.toLocaleString() || 'N/A'}
- Number of Children: ${applicant.numberOfChildren || '0'}
- Housing Type: ${applicant.housingType || 'N/A'}
- Income Stability: ${applicant.incomeStability || 'N/A'}
- Has Family Book: ${applicant.hasFamilyBook ? 'Yes' : 'No'}
- Is Citizen: ${applicant.isCitizen ? 'Yes' : 'No'}

${requests.length > 0 ? `User's Own Rescheduling Requests (${requests.length} most recent):` : 'User has no previous rescheduling requests on file.'}
${requestSummaries.length > 0 ? requestSummaries.join('\n') : ''}
`
      } else {
        // Applicant not in DB yet — use profile info from UAEPASS
        if (profileInfo) {
          userDataSection = `
USER'S OWN DATA (this citizen is currently logged in — no prior application record found):
- Name: ${profileInfo.name || userName || 'Unknown'}${profileInfo.nameAr ? ` / ${profileInfo.nameAr}` : ''}
- Emirates ID: ${profileInfo.emiratesId || emiratesId}
- Nationality: ${profileInfo.nationality || 'N/A'}
- Email: ${profileInfo.email || 'N/A'}
- Mobile: ${profileInfo.mobile || 'N/A'}
- Gender: ${profileInfo.gender || 'N/A'}

This citizen has not submitted any rescheduling requests yet. They may be asking about how to start a new request.
`
        }
      }
    }

    // ── Build the enhanced system prompt ────────────────────────────
    const systemPrompt = `You are the SZHP AI Assistant for the Sheikh Zayed Housing Programme (برنامج الشيخ زايد للإسكان) Housing Arrears Rescheduling System. This IS the official MOEI (Ministry of Energy & Infrastructure) system — do NOT direct users to external websites or phone numbers.

═══════════════════════════════════════════════════════
IMPORTANT RULES — YOU MUST FOLLOW THESE AT ALL TIMES:
═══════════════════════════════════════════════════════
1. You can ONLY discuss the logged-in user's OWN data and general SZHP information.
2. NEVER reveal information about other users, admin operations, or internal system details.
3. If asked about other users' data, admin data, or internal operations, politely decline and explain you can only help with their own request and general SZHP information.
4. Never discuss internal scoring algorithms, risk weights, or employee permissions.
5. When a citizen asks "how to apply" or "where to go", tell them they are already in the right place — this IS the SZHP portal — and guide them step-by-step.
6. Be empathetic, professional, and clear. Use simple language that citizens can understand.
7. If you reference the user's own data, clearly state it is their own information from their record.

═══════════════════════════════════════════════════════
GENERAL SZHP INFORMATION — USE THESE FACTS:
═══════════════════════════════════════════════════════

ELIGIBILITY CRITERIA:
- UAE citizenship (Emirati nationality) is ${citizenshipRequired ? 'REQUIRED' : 'not required'} for rescheduling
- Must have an active SZHP housing loan
- Minimum monthly income: AED ${minMonthlyIncome.toLocaleString()}
- Family book (Khulasat Al Qaid) is ${familyBookRequired ? 'REQUIRED' : 'not required'}
- Eligibility check is currently ${eligibilityCheckEnabled ? 'ENABLED' : 'DISABLED'}

REQUIRED DOCUMENTS:
- UAE PASS authentication (mandatory — used to verify identity and pull profile data)
- Salary Certificate${salaryCertRequired ? ' (MANDATORY)' : ' (optional)'}
- Emirates ID (verified via UAE PASS)
- Family book / Khulasat Al Qaid${familyBookRequired ? ' (required)' : ' (recommended)'}
- Optional supporting documents: bank statements, medical reports, divorce decrees, termination letters

THE 20% DEDUCTION RULE (Cabinet Resolution 61/2021):
- The monthly housing loan installment CANNOT exceed 20% of the citizen's monthly income
- This is a federal regulation designed to protect citizens from excessive debt burden
- If the current installment exceeds 20%, rescheduling will reduce it to within the 20% threshold
- Income per family member must remain above AED ${incomePerMemberThreshold.toLocaleString()} after deduction
- Example: If monthly income is AED 15,000, the maximum installment is AED 3,000 (20% of 15,000)

DBR (DEBT BURDEN RATIO) RULES:
- DBR = Total monthly debt obligations / Monthly income
- Maximum DBR allowed: ${(maxDbrLimit * 100).toFixed(0)}% (cases above are auto-rejected)
- Healthy DBR: below ${(dbrHealthyLimit * 100).toFixed(0)}% (green — low risk)
- Caution DBR: ${(dbrHealthyLimit * 100).toFixed(0)}% to ${(dbrCautionLimit * 100).toFixed(0)}% (yellow — moderate risk)
- High risk DBR: above ${(dbrCautionLimit * 100).toFixed(0)}% (red — requires detailed review)
- Auto-approval may apply for DBR at or below ${(autoApproveMaxDbr * 100).toFixed(0)}%${autoApproveEnabled ? ' (auto-approval is ENABLED)' : ' (auto-approval is DISABLED)'}

3 RESCHEDULING OPTIONS:
1. Reschedule Arrears (إعادة جدولة المتأخرات): Spread overdue amounts over the remaining loan term
2. Postpone Installment (تأجيل القسط): Temporarily stop or reduce payments for a grace period
3. Reduce Installment (تخفيض القسط): Lower the monthly payment amount, possibly extending the loan duration

GRACE PERIODS:
- Maximum grace period: ${maxGracePeriod} months
- Medical hardship cases: up to ${gracePeriodMedical} months grace period
- Divorce cases: up to ${gracePeriodDivorce} months grace period
- Grace periods are evaluated case-by-case based on supporting documentation

PROCESS TIMELINE:
- Low-risk cases with auto-approval: typically processed within 1-3 business days
- Cases requiring human review: approximately ${humanReviewDays} business days
- Complex cases (high risk, special circumstances): may take up to 30 business days
- The citizen will receive status updates through this portal

LOAN LIMITS:
- Maximum loan duration: ${maxLoanDuration} months (${Math.floor(maxLoanDuration / 12)} years)

═══════════════════════════════════════════════════════
${userDataSection || 'USER DATA: No user is currently logged in. Provide general SZHP information only.'}
═══════════════════════════════════════════════════════
${context ? `Context: ${context}` : ''}
${language ? `Respond in ${language === 'ar' ? 'Arabic' : 'English'}.` : ''}`

    const userMessage = message || 'How can I apply for rescheduling?'

    // Use shared chatCompletion (direct fetch to Recentech AI)
    const config = resolveAIConfig()
    if (!isUrlSafeForServerSideRequest(config.baseUrl)) {
      return c.json({ response: language === 'ar' ? 'خدمة الذكاء الاصطناعي غير متاحة حالياً.' : 'AI service is currently unavailable.' })
    }

    const result = await chatCompletion(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      config
    )

    return c.json({ response: result.content })
  } catch (error: any) {
    console.error('Customer chatbot error:', error)
    return c.json({ response: 'Sorry, an error occurred. Please try again later.' })
  }
})

// ── File Text Extraction Endpoint ──────────────────────────────────
app.get('/api/extract-file-text', async (c) => {
  const filename = c.req.query('file')
  if (!filename) return c.json({ error: 'Missing file parameter' }, 400)

  const uploadDir = join(process.cwd(), 'uploads')
  const filePath = join(uploadDir, filename)
  if (!existsSync(filePath)) return c.json({ error: 'File not found' }, 404)

  try {
    const ext = filename.toLowerCase().split('.').pop() || ''

    // DOCX files — extract text using mammoth
    if (ext === 'docx') {
      const fileBuffer = readFileSync(filePath)
      const result = await mammoth.extractRawText({ buffer: fileBuffer })
      return c.json({ text: result.value, type: 'docx' })
    }

    // DOC files — older format, try mammoth with a note
    if (ext === 'doc') {
      // .doc is the older binary format — mammoth doesn't fully support it,
      // but we try and fallback gracefully
      try {
        const fileBuffer = readFileSync(filePath)
        const result = await mammoth.extractRawText({ buffer: fileBuffer })
        return c.json({ text: result.value || 'Could not extract text from this .doc file. Please download to view.', type: 'docx' })
      } catch {
        return c.json({ text: 'This .doc file format is not supported for preview. Please download the file to view it.', type: 'docx' })
      }
    }

    // XLS/XLSX files — extract cell data using xlsx library
    if (['xls', 'xlsx'].includes(ext)) {
      const fileBuffer = readFileSync(filePath)
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' })
      const rows: string[][] = []

      // Get the first sheet
      const sheetName = workbook.SheetNames[0]
      if (sheetName) {
        const sheet = workbook.Sheets[sheetName]
        const sheetData = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '' })
        for (const row of sheetData) {
          rows.push(row.map(cell => String(cell ?? '')))
        }
      }

      return c.json({
        text: `Spreadsheet: ${workbook.SheetNames.length} sheet(s) — ${sheetName || 'Sheet1'}`,
        type: 'spreadsheet',
        rows,
        sheetNames: workbook.SheetNames,
      })
    }

    // CSV files — parse using xlsx library
    if (ext === 'csv') {
      const csvContent = readFileSync(filePath, 'utf-8')
      const workbook = XLSX.read(csvContent, { type: 'string' })
      const rows: string[][] = []

      const sheetName = workbook.SheetNames[0]
      if (sheetName) {
        const sheet = workbook.Sheets[sheetName]
        const sheetData = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '' })
        for (const row of sheetData) {
          rows.push(row.map(cell => String(cell ?? '')))
        }
      }

      return c.json({
        text: `CSV file with ${rows.length} row(s)`,
        type: 'spreadsheet',
        rows,
      })
    }

    return c.json({ error: 'Unsupported file type for text extraction' }, 400)
  } catch (err: any) {
    console.error('File text extraction error:', err)
    return c.json({ error: 'Failed to extract file text', message: err.message }, 500)
  }
})

// ── File Serving Endpoint ──────────────────────────────────────────
app.get('/api/files/:filename', async (c) => {
  const filename = c.req.param('filename')
  const filePath = join(process.cwd(), 'uploads', filename)

  try {
    const fileBuffer = readFileSync(filePath)
    const ext = filename.split('.').pop()?.toLowerCase()
    const mimeTypes: Record<string, string> = {
      'pdf': 'application/pdf',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'webp': 'image/webp',
      'gif': 'image/gif',
      'bmp': 'image/bmp',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'csv': 'text/csv',
      'txt': 'text/plain',
    }
    const mimeType = mimeTypes[ext || ''] || 'application/octet-stream'

    return new Response(fileBuffer, {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch {
    return c.json({ error: 'File not found' }, 404)
  }
})

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`🚀 SZHP API Server running on http://localhost:${info.port}`)
  console.log(`📊 Dashboard: http://localhost:${info.port}/api/dashboard`)
  console.log(`🔑 Auth: http://localhost:${info.port}/api/auth/seed-admin`)
  console.log(`📦 Using shared modules from src/worker/lib/ and src/worker/middleware/`)
  console.log(`🗄️  Database: ${DB_PATH}`)
})
