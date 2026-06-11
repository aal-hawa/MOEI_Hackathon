import nodemailer from 'nodemailer'
import { getChannelConfig, type EmailConfig } from '../channels'

export function createEmailTransporter(config: EmailConfig) {
  return nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpPort === 465,
    auth: {
      user: config.smtpUser,
      pass: config.smtpPass,
    },
  })
}

export async function sendEmail(to: string, subject: string, html: string, replyTo?: string) {
  const config = await getChannelConfig<EmailConfig>('email')
  if (!config || !config.enabled) {
    throw new Error('Email channel is not configured or enabled')
  }

  const transporter = createEmailTransporter(config)
  const result = await transporter.sendMail({
    from: `"${config.fromName}" <${config.fromAddress}>`,
    to,
    subject,
    html,
    replyTo,
  })

  return { messageId: result.messageId, response: result.response }
}

export async function testEmailConnection() {
  const config = await getChannelConfig<EmailConfig>('email')
  if (!config) return { success: false, error: 'Email not configured' }

  try {
    const transporter = createEmailTransporter(config)
    await transporter.verify()
    return { success: true }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, error: message }
  }
}
