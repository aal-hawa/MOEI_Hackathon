import { db } from '@/lib/db'
import { generateSecureId } from '@/lib/security'

export interface WhatsAppConfig {
  accountSid: string
  authToken: string
  phoneNumber: string
  businessProfile: string
  webhookUrl: string
  autoReply: boolean
}

export interface VoiceConfig {
  accountSid: string
  authToken: string
  phoneNumber: string
  webhookUrl: string
  ttsVoice: string
  ttsProvider: 'gemini' | 'zai'
  autoReply: boolean
  ivrGreeting: string
}

export interface EmailConfig {
  smtpHost: string
  smtpPort: number
  smtpUser: string
  smtpPass: string
  fromAddress: string
  fromName: string
  imapHost: string
  imapPort: number
  imapUser: string
  imapPass: string
  autoReply: boolean
}

export type ChannelType = 'whatsapp' | 'voice' | 'email'

interface ChannelConfigRow {
  id: string
  channel: string
  enabled: number
  config: string
  createdAt: string
  updatedAt: string
}

// Check if a Prisma model is available on the db client
function hasModel(modelName: string): boolean {
  return typeof (db as unknown as Record<string, unknown>)[modelName] !== 'undefined'
}

// ---- ChannelConfig raw query helpers ----

async function rawFindChannelConfig(channel: string): Promise<ChannelConfigRow | null> {
  const results = await db.$queryRaw`SELECT * FROM ChannelConfig WHERE channel = ${channel} LIMIT 1` as ChannelConfigRow[]
  return results[0] || null
}

async function rawUpsertChannelConfig(channel: string, enabled: boolean, config: string): Promise<void> {
  const existing = await rawFindChannelConfig(channel)
  if (existing) {
    await db.$executeRaw`UPDATE ChannelConfig SET enabled = ${enabled ? 1 : 0}, config = ${config}, updatedAt = CURRENT_TIMESTAMP WHERE channel = ${channel}`
  } else {
    const id = generateSecureId('cc')
    await db.$executeRaw`INSERT INTO ChannelConfig (id, channel, enabled, config, createdAt, updatedAt) VALUES (${id}, ${channel}, ${enabled ? 1 : 0}, ${config}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
  }
}

async function rawFindAllChannelConfigs(): Promise<ChannelConfigRow[]> {
  return db.$queryRaw`SELECT * FROM ChannelConfig` as Promise<ChannelConfigRow[]>
}

// ---- EmailMessage raw query helpers ----

interface EmailMessageRow {
  id: string
  customerId: string | null
  fromAddress: string
  toAddress: string
  subject: string
  body: string
  direction: string
  status: string
  threadId: string | null
  aiReplied: number
  metadata: string | null
  createdAt: string
}

async function rawCreateEmailMessage(data: {
  customerId?: string | null
  fromAddress: string
  toAddress: string
  subject: string
  body: string
  direction: string
  status: string
  threadId?: string | null
  aiReplied?: boolean
  metadata?: string | null
}): Promise<string> {
  const id = generateSecureId('em')
  const aiRepliedVal = data.aiReplied ? 1 : 0
  await db.$executeRaw`INSERT INTO EmailMessage (id, customerId, fromAddress, toAddress, subject, body, direction, status, threadId, aiReplied, metadata, createdAt) VALUES (${id}, ${data.customerId || null}, ${data.fromAddress}, ${data.toAddress}, ${data.subject}, ${data.body}, ${data.direction}, ${data.status}, ${data.threadId || null}, ${aiRepliedVal}, ${data.metadata || null}, CURRENT_TIMESTAMP)`
  return id
}

async function rawUpdateEmailMessage(id: string, data: Record<string, unknown>): Promise<void> {
  const sets: string[] = []
  const values: unknown[] = []

  for (const [key, value] of Object.entries(data)) {
    sets.push(`${key} = ?`)
    values.push(value)
  }

  if (sets.length === 0) return

  sets.push('createdAt = createdAt') // no-op to ensure valid SQL
  values.push(id)

  await db.$executeRawUnsafe(
    `UPDATE EmailMessage SET ${sets.join(', ')} WHERE id = ?`,
    ...values
  )
}

async function rawFindEmailMessages(options: {
  where?: Record<string, unknown>
  orderBy?: string
  take?: number
}): Promise<EmailMessageRow[]> {
  let sql = 'SELECT * FROM EmailMessage'
  const conditions: string[] = []
  const values: unknown[] = []

  if (options.where) {
    for (const [key, value] of Object.entries(options.where)) {
      if (value !== undefined && value !== null) {
        conditions.push(`${key} = ?`)
        values.push(value)
      }
    }
  }

  if (conditions.length > 0) {
    sql += ` WHERE ${conditions.join(' AND ')}`
  }

  if (options.orderBy) {
    sql += ` ORDER BY ${options.orderBy}`
  } else {
    sql += ' ORDER BY createdAt DESC'
  }

  if (options.take) {
    sql += ` LIMIT ${options.take}`
  }

  return db.$queryRawUnsafe(sql, ...values) as Promise<EmailMessageRow[]>
}

// ---- Exported Channel Config Functions ----

export async function getChannelConfig<T>(channel: ChannelType): Promise<(T & { enabled: boolean }) | null> {
  try {
    if (hasModel('channelConfig')) {
      const config = await db.channelConfig.findUnique({ where: { channel } })
      if (!config) return null
      return { ...JSON.parse(config.config), enabled: config.enabled }
    }
  } catch {
    // Fallback to raw
  }

  const row = await rawFindChannelConfig(channel)
  if (!row) return null
  return { ...JSON.parse(row.config), enabled: Boolean(row.enabled) }
}

export async function setChannelConfig(channel: ChannelType, enabled: boolean, config: Record<string, unknown>): Promise<void> {
  const configStr = JSON.stringify(config)

  try {
    if (hasModel('channelConfig')) {
      await db.channelConfig.upsert({
        where: { channel },
        update: { enabled, config: configStr },
        create: { channel, enabled, config: configStr },
      })
      return
    }
  } catch {
    // Fallback to raw
  }

  await rawUpsertChannelConfig(channel, enabled, configStr)
}

export async function getAllChannelConfigs() {
  try {
    if (hasModel('channelConfig')) {
      const configs = await db.channelConfig.findMany()
      return configs.reduce((acc, c) => {
        acc[c.channel as ChannelType] = { ...JSON.parse(c.config), enabled: c.enabled }
        return acc
      }, {} as Record<ChannelType, Record<string, unknown> & { enabled: boolean }>)
    }
  } catch {
    // Fallback to raw
  }

  const rows = await rawFindAllChannelConfigs()
  return rows.reduce((acc, c) => {
    acc[c.channel as ChannelType] = { ...JSON.parse(c.config), enabled: Boolean(c.enabled) }
    return acc
  }, {} as Record<ChannelType, Record<string, unknown> & { enabled: boolean }>)
}

export function isChannelConfigured(config: Record<string, unknown> | null): boolean {
  if (!config) return false
  if ('accountSid' in config && (!config.accountSid || config.accountSid === '')) return false
  if ('smtpHost' in config && (!config.smtpHost || config.smtpHost === '')) return false
  return true
}

export function maskConfig(channel: ChannelType, config: Record<string, unknown>): Record<string, unknown> {
  const masked = { ...config }
  const sensitiveFields: Record<ChannelType, string[]> = {
    whatsapp: ['authToken'],
    voice: ['authToken'],
    email: ['smtpPass', 'imapPass'],
  }

  for (const field of sensitiveFields[channel] || []) {
    if (masked[field] && typeof masked[field] === 'string') {
      const val = masked[field] as string
      masked[field] = val.length > 4 ? '••••••••' + val.slice(-4) : '••••••••'
    }
  }
  return masked
}

export function getTwilioClient(accountSid: string, authToken: string) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const twilio = require('twilio')
  return twilio(accountSid, authToken)
}

// ---- Exported Email Message Functions ----

export async function createEmailMessage(data: {
  customerId?: string | null
  fromAddress: string
  toAddress: string
  subject: string
  body: string
  direction: string
  status: string
  threadId?: string | null
  aiReplied?: boolean
  metadata?: string | null
}): Promise<{ id: string }> {
  try {
    if (hasModel('emailMessage')) {
      const msg = await db.emailMessage.create({ data })
      return { id: msg.id }
    }
  } catch {
    // Fallback to raw
  }

  const id = await rawCreateEmailMessage(data)
  return { id }
}

export async function updateEmailMessage(id: string, data: Record<string, unknown>): Promise<void> {
  try {
    if (hasModel('emailMessage')) {
      await db.emailMessage.update({ where: { id }, data })
      return
    }
  } catch {
    // Fallback to raw
  }

  await rawUpdateEmailMessage(id, data)
}

export async function findEmailMessages(options: {
  where?: Record<string, unknown>
  orderBy?: string
  take?: number
  include?: Record<string, unknown>
}): Promise<unknown[]> {
  try {
    if (hasModel('emailMessage')) {
      const emailModel = db.emailMessage as unknown as Record<string, () => Promise<unknown[]>>
      const result = await (emailModel.findMany as any)({
        where: options.where || {},
        orderBy: options.orderBy ? { [options.orderBy]: 'desc' } : { createdAt: 'desc' },
        take: options.take || 20,
        include: options.include || {},
      })
      return result
    }
  } catch {
    // Fallback to raw
  }

  return rawFindEmailMessages({
    where: options.where,
    orderBy: options.orderBy ? `${options.orderBy} DESC` : undefined,
    take: options.take,
  })
}
