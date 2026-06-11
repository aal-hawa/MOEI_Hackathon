/**
 * WhatsApp Channel Types
 * Used by WhatsApp simulator components
 */

export interface WhatsAppContact {
  id: string
  name: string
  phone: string
  avatar?: string
  isOnline: boolean
  isBusiness: boolean
  lastSeen?: string
  labels?: string[]
}

export interface WhatsAppMessage {
  id: string
  conversationId: string
  from: string
  to: string
  text: string
  timestamp: string
  status: 'sent' | 'delivered' | 'read' | 'failed'
  type: 'text' | 'image' | 'document' | 'template'
  isFromBusiness: boolean
}

export interface WhatsAppConversation {
  id: string
  contactId: string
  contact: WhatsAppContact
  lastMessage?: WhatsAppMessage
  unreadCount: number
  updatedAt: string
  isPinned: boolean
  isMuted: boolean
}

export interface WhatsAppTemplate {
  id: string
  name: string
  category: 'marketing' | 'utility' | 'authentication'
  language: string
  status: 'approved' | 'pending' | 'rejected'
  body: string
  variables?: string[]
}
