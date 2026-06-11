/**
 * Email Sending with UAEPASS Link Routes - Hono
 * 
 * Endpoints:
 *   POST /email/send                      - Send email to customer
 *   POST /email/send-request-confirmation - Send request creation confirmation
 */

import { Hono } from 'hono'
import { db } from '../lib/db'

const app = new Hono()

// Base URL for UAEPASS links
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://moei.gov.ae'

// ─── POST /email/send ─────────────────────────────────────────────────────────
// Send email to customer
app.post('/email/send', async (c) => {
  try {
    const body = await c.req.json()
    const { to, subject, body: emailBody, customerId, type } = body

    if (!to || !subject || !emailBody) {
      return c.json({ error: 'to, subject, and body are required' }, 400)
    }

    let finalBody = emailBody
    let htmlBody = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #0D9488; color: white; padding: 20px; text-align: center;">
        <h1>MOEI - Ministry of Energy & Infrastructure</h1>
        <p>وزارة الطاقة والبنية التحتية</p>
      </div>
      <div style="padding: 20px;">
        ${emailBody.replace(/\n/g, '<br>')}
      </div>`

    // If type is "uaepass_login", include a link
    if (type === 'uaepass_login' && customerId) {
      const uaepassLink = `${BASE_URL}/?uaepass=1&ref=${customerId}`
      htmlBody += `
      <div style="background-color: #f0fdfa; padding: 15px; margin: 20px 0; border-radius: 8px; border: 1px solid #0D9488;">
        <p style="margin: 0 0 10px 0; font-weight: bold;">Login with UAE PASS / تسجيل الدخول باستخدام الهوية الرقمية</p>
        <a href="${uaepassLink}" style="display: inline-block; background-color: #0D9488; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
          UAE PASS Login / تسجيل الدخول
        </a>
      </div>`
      finalBody += `\n\nUAE PASS Login: ${uaepassLink}`
    }

    htmlBody += `
      <div style="background-color: #f5f5f5; padding: 15px; margin-top: 20px; font-size: 12px; color: #666; text-align: center;">
        <p>Ministry of Energy & Infrastructure | وزارة الطاقة والبنية التحتية</p>
        <p>Call Center: 8006634 | مركز الاتصال: 8006634</p>
      </div>
    </div>`

    // Save to EmailMsg table
    const emailMsg = await db.emailMsg.create({
      data: {
        fromEmail: 'noreply@moei.gov.ae',
        fromName: 'MOEI - Ministry of Energy & Infrastructure',
        toEmails: JSON.stringify([to]),
        subject,
        body: finalBody,
        htmlBody,
        timestamp: new Date().toISOString(),
        folder: 'sent',
        priority: 'normal',
        labels: JSON.stringify([type || 'general']),
      },
    })

    // Save to EmailMessage table (for customer email tracking)
    if (customerId) {
      await db.emailMessage.create({
        data: {
          customerId,
          fromAddress: 'noreply@moei.gov.ae',
          toAddress: to,
          subject,
          body: finalBody,
          direction: 'outbound',
          status: 'sent',
          threadId: emailMsg.threadId,
          aiReplied: false,
        },
      })
    }

    // Create EmployerNotification
    await db.employerNotification.create({
      data: {
        agentId: null, // broadcast
        type: 'email',
        title: 'Email Sent',
        titleAr: 'تم إرسال بريد إلكتروني',
        message: `Email sent to ${to}: ${subject}`,
        messageAr: `تم إرسال بريد إلكتروني إلى ${to}: ${subject}`,
        priority: 'normal',
        metadata: JSON.stringify({
          emailMsgId: emailMsg.id,
          to,
          subject,
          type: type || 'general',
          customerId: customerId || null,
        }),
      },
    })

    return c.json({
      success: true,
      emailId: emailMsg.id,
      to,
      subject,
      sentAt: emailMsg.createdAt,
      uaepassLinkIncluded: type === 'uaepass_login' && customerId,
    })
  } catch (error) {
    console.error('Email send error:', error)
    return c.json({ error: 'Failed to send email' }, 500)
  }
})

// ─── POST /email/send-request-confirmation ────────────────────────────────────
// Send request creation confirmation
app.post('/email/send-request-confirmation', async (c) => {
  try {
    const body = await c.req.json()
    const { to, referenceNumber, customerName, language, channel } = body

    if (!to || !referenceNumber) {
      return c.json({ error: 'to and referenceNumber are required' }, 400)
    }

    const effectiveLanguage = language || 'en'
    const uaepassLink = `${BASE_URL}/?uaepass=1&ref=${referenceNumber}`
    const trackingLink = `${BASE_URL}/track?ref=${referenceNumber}`

    const subject = effectiveLanguage === 'ar'
      ? `تأكيد استلام الطلب - ${referenceNumber} | MOEI`
      : `Request Confirmation - ${referenceNumber} | MOEI`

    const bodyEn = `Dear ${customerName || 'Customer'},

Thank you for contacting the Ministry of Energy & Infrastructure. Your service request has been received successfully.

Request Details:
- Reference Number: ${referenceNumber}
- Channel: ${channel || 'Online'}
- Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}

Track Your Request:
Visit ${trackingLink} to check the status of your request.

For full access to your requests and government services, please log in using UAE PASS:
${uaepassLink}

If you have any questions, please contact our Call Center at 8006634.

Best regards,
Ministry of Energy & Infrastructure`

    const bodyAr = `السيد/ة ${customerName || 'العميل'} المحترم/ة،

شكراً لتواصلكم مع وزارة الطاقة والبنية التحتية. تم استلام طلب الخدمة بنجاح.

تفاصيل الطلب:
- الرقم المرجعي: ${referenceNumber}
- القناة: ${channel === 'voice' ? 'هاتفية' : channel === 'whatsapp' ? 'واتساب' : 'إلكترونية'}
- التاريخ: ${new Date().toLocaleDateString('ar-AE', { year: 'numeric', month: 'long', day: 'numeric' })}

تتبع طلبكم:
زيارة ${trackingLink} للاطلاع على حالة طلبكم.

للوصول الكامل إلى طلباتكم والخدمات الحكومية، يرجى تسجيل الدخول باستخدام الهوية الرقمية (UAE PASS):
${uaepassLink}

لأي استفسارات، يرجى الاتصال بمركز الاتصال على الرقم 8006634.

مع أطيب التحيات،
وزارة الطاقة والبنية التحتية`

    const fullBody = effectiveLanguage === 'ar' ? bodyAr : bodyEn

    const htmlBody = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; direction: ${effectiveLanguage === 'ar' ? 'rtl' : 'ltr'};">
      <div style="background-color: #0D9488; color: white; padding: 20px; text-align: center;">
        <h1>MOEI - Ministry of Energy & Infrastructure</h1>
        <p>وزارة الطاقة والبنية التحتية</p>
      </div>
      <div style="padding: 20px;">
        <p>${effectiveLanguage === 'ar' ? bodyAr.replace(/\n/g, '<br>') : bodyEn.replace(/\n/g, '<br>')}</p>
      </div>
      <div style="background-color: #f0fdfa; padding: 15px; margin: 20px 0; border-radius: 8px; border: 1px solid #0D9488; text-align: center;">
        <p style="font-weight: bold; margin-bottom: 10px;">
          ${effectiveLanguage === 'ar' ? 'تتبع طلبكم' : 'Track Your Request'}
        </p>
        <a href="${trackingLink}" style="display: inline-block; background-color: #0D9488; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-right: 10px;">
          ${effectiveLanguage === 'ar' ? 'تتبع الطلب' : 'Track Request'}
        </a>
        <a href="${uaepassLink}" style="display: inline-block; background-color: #115E59; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
          UAE PASS Login
        </a>
      </div>
      <div style="background-color: #f5f5f5; padding: 15px; margin-top: 20px; font-size: 12px; color: #666; text-align: center;">
        <p>Ministry of Energy & Infrastructure | وزارة الطاقة والبنية التحتية</p>
        <p>Call Center: 8006634 | مركز الاتصال: 8006634</p>
      </div>
    </div>`

    // Save to EmailMsg table
    const emailMsg = await db.emailMsg.create({
      data: {
        fromEmail: 'noreply@moei.gov.ae',
        fromName: 'MOEI - Ministry of Energy & Infrastructure',
        toEmails: JSON.stringify([to]),
        subject,
        body: fullBody,
        htmlBody,
        timestamp: new Date().toISOString(),
        folder: 'sent',
        priority: 'normal',
        labels: JSON.stringify(['request_confirmation']),
      },
    })

    // Save to EmailMessage table
    await db.emailMessage.create({
      data: {
        fromAddress: 'noreply@moei.gov.ae',
        toAddress: to,
        subject,
        body: fullBody,
        direction: 'outbound',
        status: 'sent',
        threadId: emailMsg.threadId,
        aiReplied: false,
        metadata: JSON.stringify({ referenceNumber, type: 'request_confirmation' }),
      },
    })

    return c.json({
      success: true,
      emailId: emailMsg.id,
      to,
      subject,
      referenceNumber,
      language: effectiveLanguage,
      sentAt: emailMsg.createdAt,
    })
  } catch (error) {
    console.error('Request confirmation email error:', error)
    return c.json({ error: 'Failed to send confirmation email' }, 500)
  }
})

export const emailSendRoutes = app
