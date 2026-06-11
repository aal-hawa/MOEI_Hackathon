'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  Mail, Send, Search, Sparkles, ArrowLeft, Clock, Paperclip, Loader2, Inbox, PenSquare,
  Reply, Check, X, Plus, FileEdit, Trash2, Archive, AlertTriangle, Star, FolderOpen,
  Tag, Settings, User, PenLine, MessageSquareReply, MessageSquare,
} from 'lucide-react'
import { useAppStore, type EmailMessage as StoreEmailMessage } from '@/store/app-store'
import { useTranslation } from '@/i18n'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import type { EmailMessage, EmailFolder } from '@/worker/email/types'

// ─── Mock Data ──────────────────────────────────────────────────────────────

const initialFolders: EmailFolder[] = [
  { id: 'f1', name: 'Inbox', icon: 'inbox', count: 2, type: 'inbox', order: 0 },
  { id: 'f2', name: 'Sent', icon: 'send', count: 1, type: 'sent', order: 1 },
  { id: 'f3', name: 'Drafts', icon: 'file-edit', count: 1, type: 'drafts', order: 2 },
  { id: 'f4', name: 'Starred', icon: 'star', count: 3, type: 'custom', order: 3 },
  { id: 'f5', name: 'Archive', icon: 'archive', count: 0, type: 'archive', order: 4 },
  { id: 'f6', name: 'Spam', icon: 'alert-triangle', count: 0, type: 'spam', order: 5 },
  { id: 'f7', name: 'Trash', icon: 'trash', count: 0, type: 'trash', order: 6 },
  { id: 'f8', name: 'Customers', icon: 'tag', count: 4, type: 'custom', order: 7 },
  { id: 'f9', name: 'Partners', icon: 'tag', count: 2, type: 'custom', order: 8 },
]

const initialEmails: EmailMessage[] = [
  {
    id: 'e1',
    from: { email: 'ahmed@techcorp.ae', name: 'Ahmed Al-Rashid' },
    to: [{ email: 'support@moei.gov.ae', name: 'MOEI Support' }],
    subject: 'Partnership Proposal - Q2 2025 Integration',
    body: 'Dear MOEI Team,\n\nI hope this email finds you well. I\'m reaching out regarding a potential partnership opportunity for Q2 2025.\n\nOur company, TechCorp, is looking to integrate AI-powered solutions into our customer service platform, and we believe MOEI\'s WhatsApp Business API capabilities would be an excellent fit.\n\nWe\'d love to schedule a call to discuss the details. Would next Tuesday at 10 AM work for your team?\n\nBest regards,\nAhmed Al-Rashid\nCTO, TechCorp',
    timestamp: '2025-03-04T14:30:00Z', isRead: false, isStarred: true, isDraft: false,
    hasAttachments: true, attachments: [{ id: 'a1', filename: 'partnership_proposal.pdf', contentType: 'application/pdf', size: 2400000 }],
    folder: 'inbox', threadId: 'th1', labels: ['Partners'], priority: 'high',
  },
  {
    id: 'e2',
    from: { email: 'sara@mohammed.com', name: 'Sara Mohammed' },
    to: [{ email: 'support@moei.gov.ae', name: 'MOEI Support' }],
    cc: [{ email: 'help@moei.gov.ae', name: 'MOEI Help Desk' }],
    subject: 'Order Confirmation - #ORD-78901',
    body: 'Hello,\n\nI placed an order yesterday but haven\'t received a confirmation email yet. My order number is #ORD-78901.\n\nCould you please check the status?\n\nThank you,\nSara',
    timestamp: '2025-03-04T13:15:00Z', isRead: false, isStarred: false, isDraft: false,
    hasAttachments: false, folder: 'inbox', threadId: 'th2', labels: ['Customers'], priority: 'normal',
  },
  {
    id: 'e3',
    from: { email: 'noreply@cloudflare.com', name: 'Cloudflare' },
    to: [{ email: 'support@moei.gov.ae', name: 'MOEI Support' }],
    subject: 'Your Worker deployment was successful',
    body: 'Your Cloudflare Worker "moei-whatsapp-handler" has been deployed successfully.\n\nDeployment Details:\n- Worker: moei-whatsapp-handler\n- Region: Middle East (Dubai)\n- Status: Active\n- Last Updated: March 4, 2025 at 12:00 PM\n\nView your deployment dashboard for more details.',
    timestamp: '2025-03-04T12:00:00Z', isRead: true, isStarred: false, isDraft: false,
    hasAttachments: false, folder: 'inbox', labels: [], priority: 'low',
  },
  {
    id: 'e4',
    from: { email: 'omar@startup.ae', name: 'Omar Hassan' },
    to: [{ email: 'support@moei.gov.ae', name: 'MOEI Support' }],
    subject: 'WhatsApp Business API - Pricing Inquiry',
    body: 'Hi there,\n\nI\'m interested in your WhatsApp Business API services. Could you please share the pricing details for the following:\n\n1. Starter plan - up to 1,000 messages/month\n2. Business plan - up to 10,000 messages/month\n3. Enterprise plan - unlimited messages\n\nAlso, do you offer a free trial?\n\nThanks,\nOmar Hassan\nFounder, Startup.ae',
    timestamp: '2025-03-04T10:45:00Z', isRead: true, isStarred: true, isDraft: false,
    hasAttachments: false, folder: 'inbox', threadId: 'th3', labels: ['Customers'], priority: 'normal',
  },
  {
    id: 'e5',
    from: { email: 'fatima@design.co', name: 'Fatima Khalil' },
    to: [{ email: 'support@moei.gov.ae', name: 'MOEI Support' }],
    subject: 'Design Assets for Email Templates',
    body: 'Hi MOEI Team,\n\nAttached are the updated design assets for the email template project. Please review and let me know if any changes are needed.\n\nBest,\nFatima',
    timestamp: '2025-03-03T18:45:00Z', isRead: true, isStarred: false, isDraft: false,
    hasAttachments: true, attachments: [
      { id: 'a2', filename: 'email_templates_v3.fig', contentType: 'application/fig', size: 5800000 },
      { id: 'a3', filename: 'assets_bundle.zip', contentType: 'application/zip', size: 12000000 },
    ],
    folder: 'inbox', threadId: 'th4', labels: ['Partners'], priority: 'normal',
  },
  {
    id: 'e6',
    from: { email: 'logistics@dubai.ae', name: 'Dubai Logistics' },
    to: [{ email: 'support@moei.gov.ae', name: 'MOEI Support' }],
    subject: 'Shipment Status Update - SHP-456',
    body: 'Dear MOEI,\n\nYour shipment #SHP-456 has been delivered successfully.\n\nDelivery Details:\n- Delivered to: Dubai Internet City, Building 12\n- Time: March 3, 2025 at 3:45 PM\n- Signed by: Reception\n\nThank you for choosing Dubai Logistics.',
    timestamp: '2025-03-03T15:45:00Z', isRead: true, isStarred: false, isDraft: false,
    hasAttachments: false, folder: 'inbox', labels: [], priority: 'low',
  },
  {
    id: 'e7',
    from: { email: 'layla@retail.ae', name: 'Layla Noor' },
    to: [{ email: 'support@moei.gov.ae', name: 'MOEI Support' }],
    subject: 'Bulk WhatsApp Messaging - Feature Request',
    body: 'Hello,\n\nWe\'re a retail company with 50,000+ customers. We\'re looking for a bulk WhatsApp messaging solution that can handle:\n\n- Personalized messages at scale\n- Template-based campaigns\n- Analytics and delivery reports\n- Opt-out management\n\nDo you offer these features? We\'d love a demo.\n\nBest regards,\nLayla Noor\nMarketing Director, Retail.ae',
    timestamp: '2025-03-02T09:30:00Z', isRead: true, isStarred: true, isDraft: false,
    hasAttachments: false, folder: 'inbox', threadId: 'th5', labels: ['Customers'], priority: 'high',
  },
  {
    id: 'e8',
    from: { email: 'support@moei.gov.ae', name: 'MOEI Support' },
    to: [{ email: 'ahmed@techcorp.ae', name: 'Ahmed Al-Rashid' }],
    subject: 'Re: Partnership Proposal - Q2 2025 Integration',
    body: 'Dear Ahmed,\n\nThank you for reaching out! We\'re very interested in exploring a partnership with TechCorp.\n\nNext Tuesday at 10 AM works perfectly. I\'ll send a calendar invite shortly.\n\nLooking forward to the discussion!\n\nBest regards,\nMOEI Support Team',
    timestamp: '2025-03-04T15:00:00Z', isRead: true, isStarred: false, isDraft: false,
    hasAttachments: false, folder: 'sent', threadId: 'th1', labels: ['Partners'], priority: 'high',
  },
  {
    id: 'e9',
    from: { email: 'support@moei.gov.ae', name: 'MOEI Support' },
    to: [{ email: 'omar@startup.ae', name: 'Omar Hassan' }],
    subject: 'Re: WhatsApp Business API - Pricing Inquiry',
    body: '[DRAFT] Hi Omar,\n\nThank you for your interest in our WhatsApp Business API services. Here are the pricing details:\n\n1. Starter - $49/mo (1,000 messages)\n2. Business - $199/mo (10,000 messages)\n3. Enterprise - Custom pricing\n\nYes, we offer a 14-day free trial...',
    timestamp: '2025-03-04T11:00:00Z', isRead: true, isStarred: false, isDraft: true,
    hasAttachments: false, folder: 'drafts', labels: [], priority: 'normal',
  },
]

const ALL_LABELS = ['Customers', 'Partners', 'Internal', 'Urgent']

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatRelativeTime(date: Date | string, t: (key: string) => string): string {
  const now = Date.now()
  const then = new Date(date).getTime()
  const diff = now - then

  if (diff < 60000) return t('justNow' as Parameters<typeof t>[0])
  if (diff < 3600000) return `${Math.floor(diff / 60000)}${t('minAgo' as Parameters<typeof t>[0])}`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}${t('hAgo' as Parameters<typeof t>[0])}`
  return new Date(date).toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function formatTime(date: Date | string): string {
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function getInitials(name: string): string {
  return name.split('@')[0].split('.').map(n => n[0]).join('').toUpperCase().slice(0, 2) || name.slice(0, 2).toUpperCase()
}

const avatarColors = [
  'from-amber-500 to-orange-500',
  'from-emerald-500 to-teal-500',
  'from-rose-500 to-pink-500',
  'from-cyan-500 to-blue-500',
  'from-violet-500 to-purple-500',
  'from-lime-500 to-green-500',
]

function getAvatarGradient(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return avatarColors[Math.abs(hash) % avatarColors.length]
}

type ViewMode = 'inbox' | 'detail' | 'compose'

// ─── Default Export: EmailPanel ──────────────────────────────────────────────

export default function EmailPanel() {
  const { t } = useTranslation()
  const {
    emailMessages,
    emailUnread,
    setEmailMessages,
    addEmailMessage,
    setEmailUnread,
    language,
  } = useAppStore()

  const isAr = language === 'ar'

  // Local state
  const [emails, setEmails] = useState<EmailMessage[]>([])
  const [dbFolders, setDbFolders] = useState<Array<{ name: string; count: number; unreadCount: number }>>([])
  const [folders, setFolders] = useState<EmailFolder[]>([])
  const [loadingEmails, setLoadingEmails] = useState(true)
  const [activeFolder, setActiveFolder] = useState('f1')
  const [labelFilter, setLabelFilter] = useState<string | null>(null)
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('inbox')
  const [searchQuery, setSearchQuery] = useState('')
  const [mobileShowSidebar, setMobileShowSidebar] = useState(true)

  // Compose state
  const [composeTo, setComposeTo] = useState('')
  const [composeSubject, setComposeSubject] = useState('')
  const [composeBody, setComposeBody] = useState('')
  const [sendingCompose, setSendingCompose] = useState(false)
  const [showCompose, setShowCompose] = useState(false)

  // AI reply
  const [aiReplyLoading, setAiReplyLoading] = useState(false)
  const [replyText, setReplyText] = useState('')

  // ── Fetch real emails from DB ──
  const fetchEmails = useCallback(async () => {
    try {
      const res = await fetch('/api/email/inbox?limit=100')
      if (res.ok) {
        const data = await res.json()
        // Map DB emails to UI format
        const mapped: EmailMessage[] = (data.emails || []).map((e: any) => {
          let toEmails: string[] = []
          try { toEmails = JSON.parse(e.toEmails || '[]') } catch {}
          let labels: string[] = []
          try { labels = JSON.parse(e.labels || '[]') } catch {}

          return {
            id: e.id,
            from: { email: e.fromEmail, name: e.fromName || e.fromEmail.split('@')[0] },
            to: toEmails.map((em: string) => ({ email: em, name: em.split('@')[0] })),
            subject: e.subject || 'Inquiry',
            body: e.body || '',
            timestamp: e.timestamp || e.createdAt,
            isRead: e.isRead,
            isStarred: e.isStarred,
            isDraft: e.isDraft,
            hasAttachments: e.hasAttachment,
            folder: e.folder || 'inbox',
            threadId: e.threadId,
            labels,
            priority: e.priority || 'normal',
          }
        })
        setEmails(mapped)

        // Build folders from DB counts
        if (data.folders && data.folders.length > 0) {
          setDbFolders(data.folders)
          const folderIconMap: Record<string, string> = { inbox: 'inbox', sent: 'send', drafts: 'file-edit', starred: 'star', archive: 'archive', spam: 'alert-triangle', trash: 'trash' }
          const folderTypeMap: Record<string, string> = { inbox: 'inbox', sent: 'sent', drafts: 'drafts', starred: 'custom', archive: 'archive', spam: 'spam', trash: 'trash' }
          const dbFolderList: EmailFolder[] = data.folders.map((f: any, i: number) => ({
            id: `db_${f.name}`,
            name: f.name.charAt(0).toUpperCase() + f.name.slice(1),
            icon: folderIconMap[f.name] || 'folder',
            count: f.unreadCount || f.count || 0,
            type: (folderTypeMap[f.name] || 'custom') as EmailFolder['type'],
            order: i,
          }))
          setFolders(dbFolderList)
          // Auto-select inbox
          if (dbFolderList.length > 0 && !activeFolder.startsWith('db_')) {
            setActiveFolder(dbFolderList[0].id)
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch emails:', err)
    } finally {
      setLoadingEmails(false)
    }
  }, [])

  // Initial load + polling every 10s
  useEffect(() => {
    fetchEmails()
    const interval = setInterval(fetchEmails, 10000)
    return () => clearInterval(interval)
  }, [fetchEmails])

  // Sync store emails with local state (for real-time updates from WhatsApp/Email views)
  useEffect(() => {
    if (emailMessages.length === 0) return
    const storeEmails: EmailMessage[] = emailMessages.map((m: StoreEmailMessage) => ({
      id: m.id,
      from: { email: m.direction === 'inbound' ? m.fromAddress : 'support@moei.gov.ae', name: m.direction === 'inbound' ? m.fromAddress.split('@')[0] : 'MOEI Support' },
      to: [{ email: m.direction === 'inbound' ? 'support@moei.gov.ae' : m.toAddress, name: m.direction === 'inbound' ? 'MOEI Support' : m.toAddress.split('@')[0] }],
      subject: m.subject || 'Inquiry',
      body: m.body || '',
      timestamp: new Date(m.createdAt).toISOString(),
      isRead: m.status === 'read',
      isStarred: false,
      isDraft: false,
      hasAttachments: false,
      folder: m.direction === 'inbound' ? 'inbox' : 'sent',
      labels: [],
      priority: 'normal' as const,
    }))

    setEmails(prev => {
      const existingIds = new Set(prev.map(e => e.id))
      const newOnes = storeEmails.filter(e => !existingIds.has(e.id))
      if (newOnes.length === 0) return prev
      return [...newOnes, ...prev].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    })
  }, [emailMessages])

  // Extract all unique labels from emails
  const allLabels = useMemo(() => {
    const labelSet = new Set<string>()
    for (const e of emails) {
      if (e.labels) e.labels.forEach(l => labelSet.add(l))
    }
    return Array.from(labelSet).length > 0 ? Array.from(labelSet) : ['Customers', 'Partners', 'Internal', 'Urgent']
  }, [emails])

  // Current folder & selected email
  const currentFolder = folders.find(f => f.id === activeFolder)
  const selectedEmail = emails.find(e => e.id === selectedEmailId) || null

  // Recalculate folder counts
  const recalcFolders = useCallback((updatedEmails: EmailMessage[]) => {
    setFolders(prev => prev.map(f => {
      let count = 0
      if (f.type === 'inbox') count = updatedEmails.filter(e => e.folder === 'inbox' && !e.isRead).length
      else if (f.type === 'sent') count = updatedEmails.filter(e => e.folder === 'sent').length
      else if (f.type === 'drafts') count = updatedEmails.filter(e => e.isDraft).length
      else if (f.name === 'Starred') count = updatedEmails.filter(e => e.isStarred).length
      else if (f.name === 'Trash') count = updatedEmails.filter(e => e.folder === 'trash').length
      else if (f.name === 'Spam') count = updatedEmails.filter(e => e.folder === 'spam').length
      else if (f.type === 'custom') count = updatedEmails.filter(e => e.labels?.includes(f.name)).length
      else count = 0
      return { ...f, count }
    }))
  }, [])

  // Filtered emails
  const filteredEmails = useMemo(() => {
    return emails.filter(email => {
      const matchesFolder = currentFolder?.type === 'inbox'
        ? email.folder === 'inbox'
        : currentFolder?.type === 'sent'
        ? email.folder === 'sent'
        : currentFolder?.type === 'drafts'
        ? email.folder === 'drafts' || email.isDraft
        : currentFolder?.type === 'spam'
        ? email.folder === 'spam'
        : currentFolder?.type === 'trash'
        ? email.folder === 'trash'
        : currentFolder?.type === 'archive'
        ? email.folder === 'archive'
        : currentFolder?.name === 'Starred'
        ? email.isStarred
        : email.labels?.includes(currentFolder?.name || '')

      const matchesLabel = !labelFilter || (email.labels && email.labels.includes(labelFilter))
      const matchesSearch = !searchQuery ||
        email.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (email.from.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        email.from.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        email.body.toLowerCase().includes(searchQuery.toLowerCase())

      return matchesFolder && matchesLabel && matchesSearch
    })
  }, [emails, currentFolder, labelFilter, searchQuery])

  // ─── Handlers ────────────────────────────────────────────────────────────

  const handleFolderClick = useCallback((folderId: string) => {
    setActiveFolder(folderId)
    setLabelFilter(null)
    setViewMode('inbox')
    setSelectedEmailId(null)
    setMobileShowSidebar(false)
  }, [])

  const handleLabelClick = useCallback((label: string) => {
    setLabelFilter(prev => prev === label ? null : label)
  }, [])

  const handleSelectEmail = useCallback((id: string) => {
    setSelectedEmailId(id)
    setViewMode('detail')
    setMobileShowSidebar(false)
    setReplyText('')
    setEmails(prev => {
      const updated = prev.map(e => e.id === id ? { ...e, isRead: true } : e)
      recalcFolders(updated)
      return updated
    })
  }, [recalcFolders])

  const handleToggleStar = useCallback((id: string) => {
    setEmails(prev => {
      const updated = prev.map(e => e.id === id ? { ...e, isStarred: !e.isStarred } : e)
      recalcFolders(updated)
      return updated
    })
  }, [recalcFolders])

  const handleDeleteEmail = useCallback((id: string) => {
    setEmails(prev => {
      const updated = prev.map(e => e.id === id ? { ...e, folder: 'trash' } : e)
      recalcFolders(updated)
      return updated
    })
    if (selectedEmailId === id) {
      setSelectedEmailId(null)
      setViewMode('inbox')
    }
  }, [selectedEmailId, recalcFolders])

  const handleArchiveEmail = useCallback((id: string) => {
    setEmails(prev => {
      const updated = prev.map(e => e.id === id ? { ...e, folder: 'archive' } : e)
      recalcFolders(updated)
      return updated
    })
    if (selectedEmailId === id) {
      setSelectedEmailId(null)
      setViewMode('inbox')
    }
  }, [selectedEmailId, recalcFolders])

  const handleMarkAllRead = useCallback(() => {
    setEmails(prev => {
      const updated = prev.map(e => {
        if (filteredEmails.some(fe => fe.id === e.id)) return { ...e, isRead: true }
        return e
      })
      recalcFolders(updated)
      return updated
    })
  }, [filteredEmails, recalcFolders])

  const handleMoveToFolder = useCallback((folder: string) => {
    if (!selectedEmailId) return
    setEmails(prev => {
      const updated = prev.map(e => e.id === selectedEmailId ? { ...e, folder } : e)
      recalcFolders(updated)
      return updated
    })
    setSelectedEmailId(null)
    setViewMode('inbox')
  }, [selectedEmailId, recalcFolders])

  const handleAddLabel = useCallback((label: string) => {
    if (!selectedEmailId) return
    setEmails(prev => {
      const updated = prev.map(e => {
        if (e.id === selectedEmailId) {
          const currentLabels = e.labels || []
          const newLabels = currentLabels.includes(label) ? currentLabels.filter(l => l !== label) : [...currentLabels, label]
          return { ...e, labels: newLabels }
        }
        return e
      })
      recalcFolders(updated)
      return updated
    })
  }, [selectedEmailId, recalcFolders])

  const handleMarkUnread = useCallback(() => {
    if (!selectedEmailId) return
    setEmails(prev => {
      const updated = prev.map(e => e.id === selectedEmailId ? { ...e, isRead: false } : e)
      recalcFolders(updated)
      return updated
    })
    setSelectedEmailId(null)
    setViewMode('inbox')
  }, [selectedEmailId, recalcFolders])

  const handleCompose = useCallback(() => {
    setShowCompose(true)
    setComposeTo('')
    setComposeSubject('')
    setComposeBody('')
    setReplyText('')
  }, [])

  // AI auto-reply
  const handleAiReply = useCallback(async () => {
    if (!selectedEmail) return
    setAiReplyLoading(true)
    try {
      const res = await fetch('/api/ai/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: selectedEmail.body,
          subject: selectedEmail.subject,
          language: isAr ? 'ar' : 'en',
          customerEmail: selectedEmail.from.email,
          customerName: selectedEmail.from.name,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.response) setReplyText(data.response)
      }
    } catch {
      setReplyText(
        `Thank you for your email regarding "${selectedEmail.subject}". We have received your message and will respond within 24 hours.\n\nBest regards,\nMOEI Support Team`
      )
    }
    setAiReplyLoading(false)
  }, [selectedEmail, isAr])

  // Send reply
  const handleSendReply = useCallback(async () => {
    if (!replyText.trim() || !selectedEmail || sendingCompose) return
    setSendingCompose(true)
    const content = replyText.trim()
    setReplyText('')

    const newEmail: EmailMessage = {
      id: `em_out_${Date.now()}`,
      from: { email: 'support@moei.gov.ae', name: 'MOEI Support' },
      to: [selectedEmail.from],
      subject: selectedEmail.subject.startsWith('Re: ') ? selectedEmail.subject : `Re: ${selectedEmail.subject}`,
      body: content,
      timestamp: new Date().toISOString(),
      isRead: true, isStarred: false, isDraft: false, hasAttachments: false,
      folder: 'sent', threadId: selectedEmail.threadId || selectedEmail.id,
      labels: [], priority: 'normal',
    }

    setEmails(prev => {
      const updated = [newEmail, ...prev]
      recalcFolders(updated)
      return updated
    })

    try {
      await fetch('/api/realtime/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: selectedEmail.threadId || selectedEmail.id,
          subject: newEmail.subject,
          message: content,
        }),
      })
      // Refresh emails from DB after sending
      fetchEmails()
    } catch {
      // silent
    }
    setSendingCompose(false)
  }, [replyText, selectedEmail, sendingCompose, recalcFolders, fetchEmails])

  // Send compose
  const handleSendCompose = useCallback(async () => {
    if (!composeTo.trim() || !composeSubject.trim() || !composeBody.trim() || sendingCompose) return
    setSendingCompose(true)

    const newEmail: EmailMessage = {
      id: `em_comp_${Date.now()}`,
      from: { email: 'support@moei.gov.ae', name: 'MOEI Support' },
      to: [{ email: composeTo.trim(), name: composeTo.split('@')[0] }],
      subject: composeSubject.trim(),
      body: composeBody.trim(),
      timestamp: new Date().toISOString(),
      isRead: true, isStarred: false, isDraft: false, hasAttachments: false,
      folder: 'sent', labels: [], priority: 'normal',
    }

    setEmails(prev => {
      const updated = [newEmail, ...prev]
      recalcFolders(updated)
      return updated
    })

    try {
      await fetch('/api/realtime/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: composeSubject.trim(), message: composeBody.trim() }),
      })
      // Refresh emails from DB after sending
      fetchEmails()
    } catch {
      // silent
    }

    setShowCompose(false)
    setComposeTo('')
    setComposeSubject('')
    setComposeBody('')
    setSendingCompose(false)
  }, [composeTo, composeSubject, composeBody, sendingCompose, recalcFolders, fetchEmails])

  const handleBack = useCallback(() => {
    setViewMode('inbox')
    setSelectedEmailId(null)
    setMobileShowSidebar(false)
  }, [])

  // ─── Folder Icon Map ─────────────────────────────────────────────────────

  const folderIconMap: Record<string, React.ElementType> = {
    inbox: Inbox, send: Send, 'file-edit': FileEdit, star: Star,
    archive: Archive, 'alert-triangle': AlertTriangle, trash: Trash2, tag: Tag,
  }

  // ─── Render: Sidebar ─────────────────────────────────────────────────────

  const renderSidebar = () => (
    <div className="flex flex-col h-full bg-white dark:bg-[#1a1a2e]">
      {/* Compose Button */}
      <div className="px-3 pt-3 pb-2">
        <Button
          onClick={handleCompose}
          className="w-full bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white rounded-xl h-11 shadow-lg shadow-amber-500/20"
        >
          <Plus className="w-5 h-5 mr-2" />
          {isAr ? 'رسالة جديدة' : 'Compose'}
        </Button>
      </div>

      {/* Search */}
      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isAr ? 'البحث في البريد...' : 'Search emails...'}
            className="pl-9 h-8 text-sm bg-muted/50 border-none focus-visible:ring-amber-500"
          />
        </div>
      </div>

      {/* Folders */}
      <ScrollArea className="flex-1">
        <div className="px-2 py-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2 mb-1">
            {isAr ? 'المجلدات' : 'Folders'}
          </div>
          {folders.map(folder => {
            const IconComp = folderIconMap[folder.icon] || FolderOpen
            return (
              <button
                key={folder.id}
                onClick={() => handleFolderClick(folder.id)}
                className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm transition-colors ${
                  activeFolder === folder.id && !labelFilter
                    ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 font-medium'
                    : 'text-muted-foreground hover:bg-muted/50'
                }`}
              >
                <IconComp className="w-4 h-4" />
                <span className="flex-1 text-left">{isAr ? folder.name : folder.name}</span>
                {folder.count > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    activeFolder === folder.id && !labelFilter
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {folder.count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Labels */}
        <div className="px-2 py-1 mt-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2 mb-1">
            {isAr ? 'التصنيفات' : 'Labels'}
          </div>
          <div className="flex flex-wrap gap-1.5 px-2">
            {allLabels.map(label => (
              <button
                key={label}
                onClick={() => handleLabelClick(label)}
                className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full transition-colors cursor-pointer ${
                  labelFilter === label
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 font-medium'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                }`}
              >
                <Tag className="w-3 h-3" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </ScrollArea>

      {/* Account */}
      <div className="px-3 py-2 border-t border-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-600 to-amber-700 flex items-center justify-center text-white text-xs font-bold">
            MO
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">MOEI Support</div>
            <div className="text-xs text-muted-foreground truncate">support@moei.gov.ae</div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground"
            onClick={handleMarkAllRead}
            title={isAr ? 'قراءة الكل' : 'Mark all read'}
          >
            <Inbox className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )

  // ─── Render: Email List Item ─────────────────────────────────────────────

  const renderEmailListItem = (email: EmailMessage) => {
    const isSelected = selectedEmailId === email.id
    const isUnread = !email.isRead

    return (
      <button
        key={email.id}
        onClick={() => handleSelectEmail(email.id)}
        className={`w-full text-left p-3 rounded-xl transition-all duration-200 cursor-pointer group border hover:bg-amber-50/60 ${
          isSelected ? 'bg-amber-50 border-amber-500/40 shadow-sm' : 'border-transparent hover:border-border'
        }`}
      >
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className="relative shrink-0">
            <Avatar className="h-10 w-10">
              <AvatarFallback className={`bg-gradient-to-br ${getAvatarGradient(email.from.name || email.from.email)} text-white text-xs font-semibold`}>
                {getInitials(email.from.name || email.from.email)}
              </AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 bg-amber-500 rounded-full border-2 border-white" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-0.5">
              <span className={`text-sm truncate ${isUnread ? 'font-bold text-foreground' : 'font-medium text-foreground'}`}>
                {email.from.name || email.from.email.split('@')[0]}
              </span>
              <span className="text-[11px] text-muted-foreground shrink-0">
                {formatRelativeTime(email.timestamp, t)}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2">
              <p className={`text-xs truncate leading-relaxed ${isUnread ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                {email.subject}
              </p>
              {isUnread && <div className="h-2.5 w-2.5 bg-amber-500 rounded-full shrink-0" />}
            </div>

            <p className="text-[11px] text-muted-foreground/70 truncate mt-0.5">
              {email.body.slice(0, 60)}
            </p>

            <div className="flex items-center gap-1.5 mt-1">
              {email.hasAttachments && (
                <Badge className="text-[9px] h-4 px-1.5 bg-amber-100 text-amber-700 border-amber-200" variant="outline">
                  <Paperclip className="h-2.5 w-2.5 mr-0.5" />
                  {isAr ? 'مرفق' : 'Attach'}
                </Badge>
              )}
              {email.isStarred && (
                <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
              )}
              {email.labels && email.labels.length > 0 && email.labels.map(label => (
                <Badge key={label} className="text-[9px] h-4 px-1.5 bg-muted text-muted-foreground" variant="outline">
                  {label}
                </Badge>
              ))}
              {email.priority === 'high' && (
                <Badge className="text-[9px] h-4 px-1.5 bg-red-100 text-red-700 border-red-200" variant="outline">
                  !
                </Badge>
              )}
            </div>
          </div>
        </div>
      </button>
    )
  }

  // ─── Render: Email Detail View ──────────────────────────────────────────

  const renderEmailDetail = () => {
    if (!selectedEmail) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
          <div className="bg-amber-50 rounded-full p-6 mb-4">
            <Mail className="h-12 w-12 text-amber-400" />
          </div>
          <h3 className="text-lg font-medium mb-2 text-foreground">
            {isAr ? 'البريد الإلكتروني' : 'Email Channel'}
          </h3>
          <p className="text-sm text-center max-w-xs">
            {isAr ? 'اختر بريدًا إلكترونيًا لعرض التفاصيل' : 'Select an email to view details'}
          </p>
        </div>
      )
    }

    return (
      <div className="flex flex-col h-full">
        {/* Email Header */}
        <div className="px-4 py-3 border-b border-border bg-white">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="md:hidden h-8 w-8 shrink-0" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Avatar className="h-10 w-10">
              <AvatarFallback className={`bg-gradient-to-br ${getAvatarGradient(selectedEmail.from.name || selectedEmail.from.email)} text-white text-sm font-semibold`}>
                {getInitials(selectedEmail.from.name || selectedEmail.from.email)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm text-foreground truncate">{selectedEmail.subject}</h3>
              <p className="text-xs text-muted-foreground">
                <span className="font-medium">{selectedEmail.from.name || selectedEmail.from.email}</span>
                {' → '}
                {selectedEmail.to.map(t => t.name || t.email).join(', ')}
              </p>
            </div>
            <div className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatRelativeTime(selectedEmail.timestamp, t)}
            </div>
          </div>
        </div>

        {/* Email Body */}
        <div className="flex-1 overflow-y-auto p-4 bg-amber-50/30 custom-scrollbar">
          <div className="space-y-4 max-w-2xl mx-auto">
            <Card className="border bg-white">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className={`text-[10px] font-semibold bg-gradient-to-br ${getAvatarGradient(selectedEmail.from.name || selectedEmail.from.email)} text-white`}>
                      {getInitials(selectedEmail.from.name || selectedEmail.from.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium text-foreground">
                      {selectedEmail.from.name || selectedEmail.from.email}
                    </span>
                    <span className="text-[10px] text-muted-foreground ml-2">{formatTime(selectedEmail.timestamp)}</span>
                  </div>
                  <div className="flex gap-1">
                    {selectedEmail.labels?.map(label => (
                      <Badge key={label} className="text-[8px] h-4 px-1 bg-muted" variant="outline">{label}</Badge>
                    ))}
                    {selectedEmail.priority === 'high' && (
                      <Badge className="text-[8px] h-4 px-1 bg-red-100 text-red-700" variant="outline">High</Badge>
                    )}
                  </div>
                </div>
                <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words">
                  {selectedEmail.body}
                </div>
                {selectedEmail.hasAttachments && selectedEmail.attachments && selectedEmail.attachments.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Paperclip className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground">
                        {selectedEmail.attachments.length} {isAr ? 'مرفقات' : 'attachments'}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedEmail.attachments.map(att => (
                        <div key={att.id} className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-1.5 text-xs">
                          <Paperclip className="w-3 h-3 text-muted-foreground" />
                          <span className="text-foreground">{att.filename}</span>
                          <span className="text-muted-foreground">({(att.size / 1024 / 1024).toFixed(1)} MB)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Reply Area */}
        <div className="border-t border-border bg-white">
          {/* AI Reply Button */}
          <div className="px-4 pt-2">
            <div className="max-w-2xl mx-auto flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[11px] gap-1 border-amber-200 text-amber-700 hover:bg-amber-50"
                onClick={handleAiReply}
                disabled={aiReplyLoading}
              >
                {aiReplyLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                {isAr ? 'رد تلقائي بالذكاء' : 'AI Auto-Reply'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[11px] gap-1"
                onClick={() => handleToggleStar(selectedEmail.id)}
              >
                <Star className={`h-3 w-3 ${selectedEmail.isStarred ? 'text-amber-400 fill-amber-400' : ''}`} />
                {isAr ? 'تمييز' : 'Star'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[11px] gap-1"
                onClick={() => handleArchiveEmail(selectedEmail.id)}
              >
                <Archive className="h-3 w-3" />
                {isAr ? 'أرشيف' : 'Archive'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[11px] gap-1 hover:text-destructive"
                onClick={() => handleDeleteEmail(selectedEmail.id)}
              >
                <Trash2 className="h-3 w-3" />
                {isAr ? 'حذف' : 'Delete'}
              </Button>
            </div>
          </div>

          {/* Reply Input */}
          <div className="p-3">
            <div className="max-w-2xl mx-auto flex gap-2 items-end">
              <Textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder={isAr ? 'اكتب الرد...' : 'Type your reply...'}
                className="resize-none min-h-[40px] max-h-28 bg-amber-50/30 border-border text-foreground placeholder:text-muted-foreground text-sm rounded-xl"
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault()
                    handleSendReply()
                  }
                }}
              />
              <Button
                onClick={handleSendReply}
                disabled={!replyText.trim() || sendingCompose}
                className="bg-amber-600 hover:bg-amber-700 text-white shrink-0 self-end rounded-xl h-10 w-10 p-0"
                size="icon"
              >
                {sendingCompose ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ─── Render: Compose Modal ──────────────────────────────────────────────

  const renderCompose = () => {
    if (!showCompose) return null

    return (
      <div className="absolute inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg bg-white shadow-xl">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PenSquare className="h-4 w-4 text-amber-600" />
              <h3 className="font-semibold text-sm">{isAr ? 'رسالة جديدة' : 'Compose Email'}</h3>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowCompose(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <CardContent className="p-4 space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{isAr ? 'إلى' : 'To'}</label>
              <Input
                value={composeTo}
                onChange={(e) => setComposeTo(e.target.value)}
                placeholder={isAr ? 'البريد الإلكتروني للمستلم' : 'Recipient email'}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{isAr ? 'الموضوع' : 'Subject'}</label>
              <Input
                value={composeSubject}
                onChange={(e) => setComposeSubject(e.target.value)}
                placeholder={isAr ? 'موضوع البريد' : 'Email subject'}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{isAr ? 'النص' : 'Body'}</label>
              <Textarea
                value={composeBody}
                onChange={(e) => setComposeBody(e.target.value)}
                placeholder={isAr ? 'اكتب رسالتك...' : 'Write your message...'}
                className="min-h-[120px] text-sm resize-none"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowCompose(false)}>
                {isAr ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 text-white gap-1"
                onClick={handleSendCompose}
                disabled={!composeTo.trim() || !composeSubject.trim() || !composeBody.trim() || sendingCompose}
              >
                {sendingCompose ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                {isAr ? 'إرسال' : 'Send'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ─── Render: Inbox View ─────────────────────────────────────────────────

  const renderInboxView = () => (
    <div className="flex flex-col flex-1">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-white">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">
            {currentFolder?.name || 'Inbox'}
          </span>
          <Badge className="text-[9px] h-4 px-1.5 bg-amber-100 text-amber-700 border-amber-200" variant="outline">
            {filteredEmails.length}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {filteredEmails.filter(e => !e.isRead).length > 0
              ? `${filteredEmails.filter(e => !e.isRead).length} unread`
              : isAr ? 'الكل مقروء' : 'All read'
            }
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground"
            onClick={handleMarkAllRead}
          >
            {isAr ? 'قراءة الكل' : 'Mark all read'}
          </Button>
        </div>
      </div>

      {/* Email List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {loadingEmails ? (
            <div className="p-8 text-center">
              <Loader2 className="h-8 w-8 mx-auto mb-3 animate-spin text-primary/50" />
              <p className="text-sm text-muted-foreground">
                {isAr ? 'جارٍ تحميل البريد...' : 'Loading emails...'}
              </p>
            </div>
          ) : filteredEmails.length === 0 ? (
            <div className="p-8 text-center">
              <Inbox className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground font-medium">
                {isAr ? 'لا توجد رسائل' : 'No emails'}
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                {isAr ? 'لا توجد رسائل في هذا المجلد' : 'No emails in this folder'}
              </p>
            </div>
          ) : (
            filteredEmails.map(renderEmailListItem)
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="px-4 py-1.5 border-t border-border bg-white text-center">
        <span className="text-[10px] text-muted-foreground">
          1-{filteredEmails.length} {isAr ? 'من' : 'of'} {filteredEmails.length}
        </span>
      </div>
    </div>
  )

  // ─── Render: Main Layout ────────────────────────────────────────────────

  return (
    <div className="relative flex h-full bg-white rounded-xl border border-border shadow-sm overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex md:w-[260px] md:min-w-[260px] md:flex-col border-r border-border">
        {renderSidebar()}
      </div>

      {/* Desktop Content */}
      <div className="hidden md:flex md:flex-1 md:flex-col">
        {viewMode === 'detail' && selectedEmail
          ? renderEmailDetail()
          : renderInboxView()
        }
      </div>

      {/* Mobile View */}
      <div className="flex md:hidden flex-1 flex-col">
        {mobileShowSidebar ? (
          <div className="flex flex-col w-full">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-gradient-to-r from-amber-600 to-amber-700">
              <Mail className="h-5 w-5 text-white" />
              <span className="text-white font-semibold text-sm">
                {isAr ? 'البريد الإلكتروني' : 'Email'}
              </span>
              <div className="flex-1" />
              {emailUnread > 0 && (
                <Badge className="bg-white text-amber-700 text-xs font-bold">{emailUnread}</Badge>
              )}
            </div>
            {renderSidebar()}
          </div>
        ) : (
          <div className="flex flex-col flex-1">
            {viewMode === 'detail' && selectedEmail
              ? renderEmailDetail()
              : renderInboxView()
            }
          </div>
        )}
      </div>

      {/* Compose Modal */}
      {renderCompose()}
    </div>
  )
}
