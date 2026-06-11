import { getChannelConfig, getTwilioClient, type WhatsAppConfig, type VoiceConfig } from '../channels'

export async function sendWhatsAppMessage(to: string, body: string, mediaUrl?: string) {
  const config = await getChannelConfig<WhatsAppConfig>('whatsapp')
  if (!config || !config.enabled) {
    throw new Error('WhatsApp channel is not configured or enabled')
  }

  const client = getTwilioClient(config.accountSid, config.authToken)
  const messageData: Record<string, unknown> = {
    from: `whatsapp:${config.phoneNumber}`,
    to: `whatsapp:${to}`,
    body,
  }
  if (mediaUrl) messageData.mediaUrl = mediaUrl

  const message = await client.messages.create(messageData)
  return { sid: message.sid, status: message.status }
}

export async function initiateOutboundCall(to: string, webhookUrl?: string) {
  const config = await getChannelConfig<VoiceConfig>('voice')
  if (!config || !config.enabled) {
    throw new Error('Voice channel is not configured or enabled')
  }

  const client = getTwilioClient(config.accountSid, config.authToken)
  const call = await client.calls.create({
    from: config.phoneNumber,
    to,
    url: webhookUrl || `${config.webhookUrl}/api/channels/voice/webhook`,
    statusCallback: `${config.webhookUrl}/api/channels/voice/status`,
    statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
  })

  return { sid: call.sid, status: call.status }
}

export async function getCallStatus(callSid: string) {
  const config = await getChannelConfig<VoiceConfig>('voice')
  if (!config || !config.enabled) {
    throw new Error('Voice channel is not configured or enabled')
  }

  const client = getTwilioClient(config.accountSid, config.authToken)
  const call = await client.calls(callSid).fetch()
  return { sid: call.sid, status: call.status, duration: call.duration, from: call.from, to: call.to }
}

export async function hangupCall(callSid: string) {
  const config = await getChannelConfig<VoiceConfig>('voice')
  if (!config || !config.enabled) {
    throw new Error('Voice channel is not configured or enabled')
  }

  const client = getTwilioClient(config.accountSid, config.authToken)
  await client.calls(callSid).update({ status: 'completed' })
  return { success: true }
}
