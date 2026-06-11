/**
 * Email Channel Types
 * Used by Email simulator components
 */

export interface EmailAccount {
  id: string
  email: string
  name: string
  avatar?: string
  provider: 'gmail' | 'outlook' | 'custom'
  isConnected: boolean
}

export interface EmailFolder {
  id: string
  name: string
  icon: string
  count: number
  type: 'inbox' | 'sent' | 'drafts' | 'spam' | 'trash' | 'archive' | 'custom'
  order: number
}

export interface EmailAttachment {
  id: string
  filename: string
  contentType: string
  size: number
}

export interface EmailAddress {
  email: string
  name?: string
}

export interface EmailMessage {
  id: string
  from: EmailAddress
  to: EmailAddress[]
  cc?: EmailAddress[]
  subject: string
  body: string
  timestamp: string
  isRead: boolean
  isStarred: boolean
  isDraft: boolean
  hasAttachments: boolean
  attachments?: EmailAttachment[]
  folder: string
  threadId?: string | null
  labels?: string[]
  priority: 'high' | 'normal' | 'low'
}
