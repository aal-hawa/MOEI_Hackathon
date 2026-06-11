'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { InboxView } from './InboxView';
import { ComposeEmail } from './ComposeEmail';
import { EmailDetail } from './EmailDetail';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import {
  Inbox, Send, FileEdit, Trash2, Archive, AlertTriangle,
  Plus, Search, Settings, Tag, Star,
  FolderOpen, User, PenLine, MessageSquareReply,
  MessageSquare,
} from 'lucide-react';
import type { EmailMessage, EmailFolder, EmailAccount } from '@/worker/email/types';
import { useAppStore } from '@/pages/store/app-store';
import { useAuthStore } from '@/components/shared/lib/auth-store';
import { useRealtime } from '@/pages/hooks/use-realtime';

// Mock Data
const mockAccount: EmailAccount = {
  id: 'acc1', email: 'business@z.ai', name: 'Z.ai Business', avatar: '', provider: 'gmail', isConnected: true,
};

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
];

const initialEmails: EmailMessage[] = [
  {
    id: 'e1',
    from: { email: 'ahmed@techcorp.ae', name: 'Ahmed Al-Rashid' },
    to: [{ email: 'business@z.ai', name: 'Z.ai Business' }],
    subject: 'Partnership Proposal - Q2 2025 Integration',
    body: 'Dear Z.ai Team,\n\nI hope this email finds you well. I\'m reaching out regarding a potential partnership opportunity for Q2 2025.\n\nOur company, TechCorp, is looking to integrate AI-powered solutions into our customer service platform, and we believe Z.ai\'s WhatsApp Business API capabilities would be an excellent fit.\n\nWe\'d love to schedule a call to discuss the details. Would next Tuesday at 10 AM work for your team?\n\nBest regards,\nAhmed Al-Rashid\nCTO, TechCorp',
    timestamp: '2025-03-04T14:30:00Z', isRead: false, isStarred: true, isDraft: false,
    hasAttachments: true, attachments: [{ id: 'a1', filename: 'partnership_proposal.pdf', contentType: 'application/pdf', size: 2400000 }],
    folder: 'inbox', threadId: 'th1', labels: ['Partners'], priority: 'high',
  },
  {
    id: 'e2',
    from: { email: 'sara@mohammed.com', name: 'Sara Mohammed' },
    to: [{ email: 'business@z.ai', name: 'Z.ai Business' }],
    cc: [{ email: 'support@z.ai', name: 'Z.ai Support' }],
    subject: 'Order Confirmation - #ORD-78901',
    body: 'Hello,\n\nI placed an order yesterday but haven\'t received a confirmation email yet. My order number is #ORD-78901.\n\nCould you please check the status?\n\nThank you,\nSara',
    timestamp: '2025-03-04T13:15:00Z', isRead: false, isStarred: false, isDraft: false,
    hasAttachments: false, folder: 'inbox', threadId: 'th2', labels: ['Customers'], priority: 'normal',
  },
  {
    id: 'e3',
    from: { email: 'noreply@cloudflare.com', name: 'Cloudflare' },
    to: [{ email: 'business@z.ai', name: 'Z.ai Business' }],
    subject: 'Your Worker deployment was successful',
    body: 'Your Cloudflare Worker "zai-whatsapp-handler" has been deployed successfully.\n\nDeployment Details:\n- Worker: zai-whatsapp-handler\n- Region: Middle East (Dubai)\n- Status: Active\n- Last Updated: March 4, 2025 at 12:00 PM\n\nView your deployment dashboard for more details.',
    timestamp: '2025-03-04T12:00:00Z', isRead: true, isStarred: false, isDraft: false,
    hasAttachments: false, folder: 'inbox', labels: [], priority: 'low',
  },
  {
    id: 'e4',
    from: { email: 'omar@startup.ae', name: 'Omar Hassan' },
    to: [{ email: 'business@z.ai', name: 'Z.ai Business' }],
    subject: 'WhatsApp Business API - Pricing Inquiry',
    body: 'Hi there,\n\nI\'m interested in your WhatsApp Business API services. Could you please share the pricing details for the following:\n\n1. Starter plan - up to 1,000 messages/month\n2. Business plan - up to 10,000 messages/month\n3. Enterprise plan - unlimited messages\n\nAlso, do you offer a free trial?\n\nThanks,\nOmar Hassan\nFounder, Startup.ae',
    timestamp: '2025-03-04T10:45:00Z', isRead: true, isStarred: true, isDraft: false,
    hasAttachments: false, folder: 'inbox', threadId: 'th3', labels: ['Customers'], priority: 'normal',
  },
  {
    id: 'e5',
    from: { email: 'fatima@design.co', name: 'Fatima Khalil' },
    to: [{ email: 'business@z.ai', name: 'Z.ai Business' }],
    subject: 'Design Assets for Email Templates',
    body: 'Hi Z.ai Team,\n\nAttached are the updated design assets for the email template project. Please review and let me know if any changes are needed.\n\nBest,\nFatima',
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
    to: [{ email: 'business@z.ai', name: 'Z.ai Business' }],
    subject: 'Shipment Status Update - SHP-456',
    body: 'Dear Z.ai,\n\nYour shipment #SHP-456 has been delivered successfully.\n\nDelivery Details:\n- Delivered to: Dubai Internet City, Building 12\n- Time: March 3, 2025 at 3:45 PM\n- Signed by: Reception\n\nThank you for choosing Dubai Logistics.',
    timestamp: '2025-03-03T15:45:00Z', isRead: true, isStarred: false, isDraft: false,
    hasAttachments: false, folder: 'inbox', labels: [], priority: 'low',
  },
  {
    id: 'e7',
    from: { email: 'layla@retail.ae', name: 'Layla Noor' },
    to: [{ email: 'business@z.ai', name: 'Z.ai Business' }],
    subject: 'Bulk WhatsApp Messaging - Feature Request',
    body: 'Hello,\n\nWe\'re a retail company with 50,000+ customers. We\'re looking for a bulk WhatsApp messaging solution that can handle:\n\n- Personalized messages at scale\n- Template-based campaigns\n- Analytics and delivery reports\n- Opt-out management\n\nDo you offer these features? We\'d love a demo.\n\nBest regards,\nLayla Noor\nMarketing Director, Retail.ae',
    timestamp: '2025-03-02T09:30:00Z', isRead: true, isStarred: true, isDraft: false,
    hasAttachments: false, folder: 'inbox', threadId: 'th5', labels: ['Customers'], priority: 'high',
  },
  {
    id: 'e8',
    from: { email: 'business@z.ai', name: 'Z.ai Business' },
    to: [{ email: 'ahmed@techcorp.ae', name: 'Ahmed Al-Rashid' }],
    subject: 'Re: Partnership Proposal - Q2 2025 Integration',
    body: 'Dear Ahmed,\n\nThank you for reaching out! We\'re very interested in exploring a partnership with TechCorp.\n\nNext Tuesday at 10 AM works perfectly. I\'ll send a calendar invite shortly.\n\nLooking forward to the discussion!\n\nBest regards,\nZ.ai Business Team',
    timestamp: '2025-03-04T15:00:00Z', isRead: true, isStarred: false, isDraft: false,
    hasAttachments: false, folder: 'sent', threadId: 'th1', labels: ['Partners'], priority: 'high',
  },
  {
    id: 'e9',
    from: { email: 'business@z.ai', name: 'Z.ai Business' },
    to: [{ email: 'omar@startup.ae', name: 'Omar Hassan' }],
    subject: 'Re: WhatsApp Business API - Pricing Inquiry',
    body: '[DRAFT] Hi Omar,\n\nThank you for your interest in our WhatsApp Business API services. Here are the pricing details:\n\n1. Starter - $49/mo (1,000 messages)\n2. Business - $199/mo (10,000 messages)\n3. Enterprise - Custom pricing\n\nYes, we offer a 14-day free trial...',
    timestamp: '2025-03-04T11:00:00Z', isRead: true, isStarred: false, isDraft: true,
    hasAttachments: false, folder: 'drafts', labels: [], priority: 'normal',
  },
];

type ViewMode = 'inbox' | 'detail' | 'compose';

const ALL_LABELS = ['Customers', 'Partners', 'Internal', 'Urgent'];

interface EmailPageProps {
  onSwitchPage?: () => void;
}

export function EmailPage({ onSwitchPage }: EmailPageProps) {
  const { toast } = useToast();
  const [emails, setEmails] = useState<EmailMessage[]>(initialEmails);
  const [folders, setFolders] = useState<EmailFolder[]>(initialFolders);
  const [activeFolder, setActiveFolder] = useState('f1');
  const [labelFilter, setLabelFilter] = useState<string | null>(null);
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('compose');
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileShowContent, setMobileShowContent] = useState(true);
  const [composeData, setComposeData] = useState<{ to?: string; subject?: string; body?: string } | null>({ to: 'agent@moei.gov.ae', subject: 'Inquiry', body: '' });

  // Use UAE PASS logged-in user identity from auth store
  const { userProfile } = useAuthStore();
  const selectedUaeUser = useMemo(() => ({
    id: userProfile?.sub || 'uaepass-unknown',
    name: userProfile?.fullnameEN || 'User',
    phone: userProfile?.mobile || '+971500000000',
    email: userProfile?.email || 'user@moei.ae',
    language: (userProfile?.firstnameAR ? 'ar' : 'en') as 'ar' | 'en',
  }), [userProfile?.sub, userProfile?.fullnameEN, userProfile?.mobile, userProfile?.email, userProfile?.firstnameAR]);

  const [dbHistory, setDbHistory] = useState<EmailMessage[]>([]);
  const [clearedAt, setClearedAt] = useState<number>(0);

  useEffect(() => {
    const val = localStorage.getItem(`email_cleared_${selectedUaeUser.id}`);
    setClearedAt(val ? parseInt(val, 10) : 0);
  }, [selectedUaeUser.id]);

  useEffect(() => {
    fetch(`/api/realtime/history?email=${selectedUaeUser.email}&channel=email`)
      .then(res => res.json())
      .then(data => {
        if (data.history) {
           const historyMsgs: EmailMessage[] = data.history.map((m: any) => ({
             id: m.id,
             from: { email: m.direction === 'inbound' ? selectedUaeUser.email : 'agent@moei.gov.ae', name: m.direction === 'inbound' ? selectedUaeUser.name : 'MOEI Support' },
             to: [{ email: m.direction === 'inbound' ? 'agent@moei.gov.ae' : selectedUaeUser.email, name: m.direction === 'inbound' ? 'MOEI Support' : selectedUaeUser.name }],
             subject: m.metadata ? (JSON.parse(m.metadata).subject || 'Inquiry') : 'Inquiry',
             body: m.content,
             timestamp: new Date(m.createdAt).toISOString(),
             isRead: true,
             isStarred: false,
             isDraft: false,
             hasAttachments: false,
             folder: m.direction === 'inbound' ? 'sent' : 'inbox',
             labels: m.direction === 'outbound' ? ['MOEI Support'] : [],
             priority: 'normal' as const,
           }));
           setDbHistory(historyMsgs);
        }
      })
      .catch(err => console.error('Failed to fetch DB history', err));
  }, [selectedUaeUser]);

  const { emailMessages } = useAppStore();
  useRealtime();

  // Sync MOEI emails from global store & DB
  useEffect(() => {
    const storeMsgs: EmailMessage[] = emailMessages
      .filter(m => m.customerId === selectedUaeUser.id)
      .map(m => ({
        id: m.id,
        from: { email: m.direction === 'inbound' ? selectedUaeUser.email : 'agent@moei.gov.ae', name: m.direction === 'inbound' ? selectedUaeUser.name : 'MOEI Support' },
        to: [{ email: m.direction === 'inbound' ? 'agent@moei.gov.ae' : selectedUaeUser.email, name: m.direction === 'inbound' ? 'MOEI Support' : selectedUaeUser.name }],
        subject: m.subject || 'Inquiry',
        body: m.body || '',
        timestamp: new Date(m.createdAt).toISOString(),
        isRead: true,
        isStarred: false,
        isDraft: false,
        hasAttachments: false,
        folder: m.direction === 'inbound' ? 'sent' : 'inbox',
        labels: m.direction === 'outbound' ? ['MOEI Support'] : [],
        priority: 'normal' as const,
      }));

    const combined = [...dbHistory, ...storeMsgs];
    const uniqueMsgsMap = new Map<string, EmailMessage>();
    combined.forEach(m => uniqueMsgsMap.set(m.id, m));
    const moeiEmails = Array.from(uniqueMsgsMap.values())
      .filter(m => new Date(m.timestamp).getTime() > clearedAt);

    setEmails(prev => {
      // Keep only non-moei/non-synced emails from initial state
      const existing = prev.filter(e => !moeiEmails.some(em => em.id === e.id) && e.id.startsWith('em_'));
      const updated = [...moeiEmails, ...existing].sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      return updated;
    });
  }, [emailMessages, dbHistory, clearedAt, selectedUaeUser]);

  const currentFolder = folders.find(f => f.id === activeFolder);
  const selectedEmail = emails.find(e => e.id === selectedEmailId) || null;

  // Recalculate folder counts
  const recalcFolders = useCallback((updatedEmails: EmailMessage[]) => {
    setFolders(prev => prev.map(f => {
      let count = 0;
      if (f.type === 'inbox') count = updatedEmails.filter(e => e.folder === 'inbox' && !e.isRead).length;
      else if (f.type === 'sent') count = updatedEmails.filter(e => e.folder === 'sent').length;
      else if (f.type === 'drafts') count = updatedEmails.filter(e => e.isDraft).length;
      else if (f.name === 'Starred') count = updatedEmails.filter(e => e.isStarred).length;
      else if (f.name === 'Trash') count = updatedEmails.filter(e => e.folder === 'trash').length;
      else if (f.name === 'Spam') count = updatedEmails.filter(e => e.folder === 'spam').length;
      else if (f.type === 'custom') count = updatedEmails.filter(e => e.labels?.includes(f.name)).length;
      else count = 0;
      return { ...f, count };
    }));
  }, []);

  const filteredEmails = emails.filter(email => {
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
      : email.labels?.includes(currentFolder?.name || '');

    const matchesLabel = !labelFilter || (email.labels && email.labels.includes(labelFilter));

    const matchesSearch = !searchQuery ||
      email.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (email.from.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.from.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.body.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesFolder && matchesLabel && matchesSearch;
  });

  const handleSelectEmail = useCallback((id: string) => {
    setSelectedEmailId(id);
    setViewMode('detail');
    setMobileShowContent(true);
    // Mark as read
    setEmails(prev => {
      const updated = prev.map(e => e.id === id ? { ...e, isRead: true } : e);
      recalcFolders(updated);
      return updated;
    });
  }, [recalcFolders]);

  const handleToggleStar = useCallback((id: string) => {
    setEmails(prev => {
      const updated = prev.map(e => e.id === id ? { ...e, isStarred: !e.isStarred } : e);
      recalcFolders(updated);
      return updated;
    });
    toast({ title: 'Star updated', duration: 1500 });
  }, [recalcFolders, toast]);

  const handleDeleteEmail = useCallback((id: string) => {
    setEmails(prev => {
      const email = prev.find(e => e.id === id);
      const updated = email
        ? prev.map(e => e.id === id ? { ...e, folder: 'trash' } : e)
        : prev;
      recalcFolders(updated);
      return updated;
    });
    setViewMode('inbox');
    setSelectedEmailId(null);
    setMobileShowContent(false);
    toast({ title: 'Email moved to trash', duration: 2000 });
  }, [recalcFolders, toast]);

  const handleArchiveEmail = useCallback((id: string) => {
    setEmails(prev => {
      const updated = prev.map(e => e.id === id ? { ...e, folder: 'archive' } : e);
      recalcFolders(updated);
      return updated;
    });
    setViewMode('inbox');
    setSelectedEmailId(null);
    setMobileShowContent(false);
    toast({ title: 'Email archived', duration: 2000 });
  }, [recalcFolders, toast]);

  const handleCompose = useCallback((data?: { to?: string; subject?: string; body?: string }) => {
    setComposeData(data || null);
    setViewMode('compose');
    setMobileShowContent(true);
  }, []);

  const [isAiTyping, setIsAiTyping] = useState(false);

  const handleSendEmail = useCallback(async (to: string, subject: string, body: string) => {
    const newEmail: EmailMessage = {
      id: `em_${Date.now()}`,
      from: { name: selectedUaeUser.name, email: selectedUaeUser.email },
      to: [{ name: to.split('@')[0], email: to }],
      subject,
      body,
      timestamp: new Date().toISOString(),
      isRead: true,
      isStarred: false,
      isDraft: false,
      hasAttachments: false,
      folder: 'sent',
      labels: [],
      priority: 'normal',
    };

    // Add customer's sent email immediately
    setEmails(prev => {
      const updated = [newEmail, ...prev];
      recalcFolders(updated);
      return updated;
    });

    // If sending to MOEI, route through the AI Brain
    if (to === 'agent@moei.gov.ae' || to.includes('moei')) {
      setIsAiTyping(true);
      try {
        const aiRes = await fetch('/api/ai/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: body,
            subject,
            language: selectedUaeUser.language,
            customerName: selectedUaeUser.name,
            customerEmail: selectedUaeUser.email,
            customerPhone: selectedUaeUser.phone,
            uaePassId: selectedUaeUser.id,
          }),
        });

        if (aiRes.ok) {
          const aiData = await aiRes.json();
          const aiReplyEmail: EmailMessage = {
            id: `em_ai_${Date.now()}`,
            from: { name: selectedUaeUser.language === 'ar' ? 'دعم وزارة الطاقة' : 'MOEI Support', email: 'moei@moei.gov.ae' },
            to: [{ name: selectedUaeUser.name, email: selectedUaeUser.email }],
            subject: subject.startsWith('Re:') ? subject : `Re: ${subject}`,
            body: aiData.response || 'Thank you for your email. We will respond shortly.',
            timestamp: new Date().toISOString(),
            isRead: false,
            isStarred: false,
            isDraft: false,
            hasAttachments: false,
            folder: 'inbox',
            labels: ['MOEI Support'],
            priority: 'normal',
          };
          setEmails(prev => {
            const updated = [aiReplyEmail, ...prev];
            recalcFolders(updated);
            return updated;
          });
        }
      } catch (err) {
        console.error('Failed to get AI email reply', err);
        // Still save to DB even if AI fails
        try {
          await fetch('/api/realtime/email/receive', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              customerName: selectedUaeUser.name,
              text: body,
              email: selectedUaeUser.email,
              subject,
              language: selectedUaeUser.language,
              uaePassId: selectedUaeUser.id,
            }),
          });
        } catch (fallbackErr) {
          console.error('Failed to save email to DB', fallbackErr);
        }
      } finally {
        setIsAiTyping(false);
      }
    }

    setViewMode('inbox');
    setMobileShowContent(false);
    toast({ title: 'Email sent', description: `Message sent to ${to}${to.includes('moei') ? ' — AI is composing a reply...' : ''}`, duration: 3000 });
  }, [recalcFolders, toast, selectedUaeUser]);

  const handleBack = useCallback(() => {
    setViewMode('inbox');
    setMobileShowContent(false);
  }, []);

  // New handlers for InboxView and EmailDetail props
  const handleMarkAllRead = useCallback(() => {
    setEmails(prev => {
      const updated = prev.map(e => {
        // Mark all currently visible emails as read
        if (filteredEmails.some(fe => fe.id === e.id)) {
          return { ...e, isRead: true };
        }
        return e;
      });
      recalcFolders(updated);
      return updated;
    });
    toast({ title: 'All emails marked as read', duration: 2000 });
  }, [filteredEmails, recalcFolders, toast]);

  const handleArchiveEmails = useCallback((ids: string[]) => {
    setEmails(prev => {
      const updated = prev.map(e => ids.includes(e.id) ? { ...e, folder: 'archive' } : e);
      recalcFolders(updated);
      return updated;
    });
    toast({ title: `${ids.length} email${ids.length > 1 ? 's' : ''} archived`, duration: 2000 });
  }, [recalcFolders, toast]);

  const handleMoveToFolder = useCallback((folder: string) => {
    if (!selectedEmailId) return;
    setEmails(prev => {
      const updated = prev.map(e => e.id === selectedEmailId ? { ...e, folder } : e);
      recalcFolders(updated);
      return updated;
    });
    setViewMode('inbox');
    setSelectedEmailId(null);
    setMobileShowContent(false);
    toast({ title: `Email moved to ${folder}`, duration: 2000 });
  }, [selectedEmailId, recalcFolders, toast]);

  const handleAddLabel = useCallback((label: string) => {
    if (!selectedEmailId) return;
    setEmails(prev => {
      const updated = prev.map(e => {
        if (e.id === selectedEmailId) {
          const currentLabels = e.labels || [];
          const newLabels = currentLabels.includes(label)
            ? currentLabels.filter(l => l !== label)
            : [...currentLabels, label];
          return { ...e, labels: newLabels };
        }
        return e;
      });
      recalcFolders(updated);
      return updated;
    });
    toast({ title: `Label "${label}" updated`, duration: 2000 });
  }, [selectedEmailId, recalcFolders, toast]);

  const handleMarkUnread = useCallback(() => {
    if (!selectedEmailId) return;
    setEmails(prev => {
      const updated = prev.map(e => e.id === selectedEmailId ? { ...e, isRead: false } : e);
      recalcFolders(updated);
      return updated;
    });
    setViewMode('inbox');
    setSelectedEmailId(null);
    setMobileShowContent(false);
    toast({ title: 'Email marked as unread', duration: 2000 });
  }, [selectedEmailId, recalcFolders, toast]);

  const handleLabelClick = useCallback((label: string) => {
    setLabelFilter(prev => prev === label ? null : label);
  }, []);

  const handleFolderClick = useCallback((folderId: string) => {
    setActiveFolder(folderId);
    setLabelFilter(null);
    setViewMode('inbox');
    setMobileShowContent(false);
  }, []);

  const folderIconMap: Record<string, React.ElementType> = {
    inbox: Inbox, send: Send, 'file-edit': FileEdit, star: Star,
    archive: Archive, 'alert-triangle': AlertTriangle, trash: Trash2, tag: Tag,
  };

  const renderSidebar = () => (
    <div className="flex flex-col h-full bg-white dark:bg-[#1a1a2e]">
      {/* Compose Button */}
      <div className="px-3 pt-3 pb-2">
        <Button
          onClick={() => handleCompose()}
          className="w-full bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white rounded-xl h-11 shadow-lg shadow-rose-500/20"
        >
          <Plus className="w-5 h-5 mr-2" />
          Compose
        </Button>
      </div>

      {/* Search */}
      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search emails..."
            className="pl-9 h-8 text-sm bg-muted/50 border-none focus-visible:ring-rose-500"
          />
        </div>
      </div>

      {/* Folders */}
      <ScrollArea className="flex-1">
        <div className="px-2 py-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2 mb-1">Folders</div>
          {folders.map(folder => {
            const IconComp = folderIconMap[folder.icon] || FolderOpen;
            return (
              <button
                key={folder.id}
                onClick={() => handleFolderClick(folder.id)}
                className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm transition-colors ${
                  activeFolder === folder.id && !labelFilter
                    ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 font-medium'
                    : 'text-muted-foreground hover:bg-muted/50'
                }`}
              >
                <IconComp className="w-4 h-4" />
                <span className="flex-1 text-left">{folder.name}</span>
                {folder.count > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    activeFolder === folder.id && !labelFilter
                      ? 'bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {folder.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Labels */}
        <div className="px-2 py-1 mt-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2 mb-1">Labels</div>
          <div className="flex flex-wrap gap-1.5 px-2">
            {ALL_LABELS.map(label => (
              <button
                key={label}
                onClick={() => handleLabelClick(label)}
                className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full transition-colors cursor-pointer ${
                  labelFilter === label
                    ? 'bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 font-medium'
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
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-rose-500 to-pink-500 flex items-center justify-center text-white text-xs font-bold">
            ZB
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{selectedUaeUser.name}</div>
            <div className="text-xs text-muted-foreground truncate">{selectedUaeUser.email}</div>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => {
             const now = Date.now();
             localStorage.setItem(`email_cleared_${selectedUaeUser.id}`, now.toString());
             setClearedAt(now);
             setEmails(prev => prev.filter(e => e.id.startsWith('em_')));
             toast({ title: 'Inbox cleared' });
          }} title="Clear Inbox">
            <Trash2 className="w-4 h-4" />
          </Button>

          {/* UAE PASS Identity Badge */}
          <div className="flex items-center gap-1.5 bg-muted text-xs rounded-md px-2 py-1 hidden md:flex">
            <span className="w-1.5 h-1.5 bg-rose-500 rounded-full" />
            <span className="text-foreground">{selectedUaeUser.name}</span>
          </div>

          {onSwitchPage && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={onSwitchPage} title="Switch to WhatsApp">
              <MessageSquare className="w-4 h-4" />
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
                <Settings className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => toast({ title: 'Account settings coming soon', duration: 2000 })}>
                <User className="w-4 h-4 mr-2" />
                Account settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast({ title: 'Signature settings coming soon', duration: 2000 })}>
                <PenLine className="w-4 h-4 mr-2" />
                Signature
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => toast({ title: 'Auto-reply settings coming soon', duration: 2000 })}>
                <MessageSquareReply className="w-4 h-4 mr-2" />
                Auto-reply
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    if (viewMode === 'compose') {
      return (
        <ComposeEmail
          initialTo={composeData?.to}
          initialSubject={composeData?.subject}
          initialBody={composeData?.body}
          onBack={handleBack}
          onSend={handleSendEmail}
        />
      );
    }

    if (viewMode === 'detail' && selectedEmail) {
      return (
        <EmailDetail
          email={selectedEmail}
          onBack={handleBack}
          onReply={() => handleCompose({
            to: selectedEmail.from.email,
            subject: selectedEmail.subject.startsWith('Re:') ? selectedEmail.subject : `Re: ${selectedEmail.subject}`,
            body: `\n\n--- Original Message ---\nFrom: ${selectedEmail.from.name} <${selectedEmail.from.email}>\n\n${selectedEmail.body}`,
          })}
          onForward={() => handleCompose({
            subject: selectedEmail.subject.startsWith('Fwd:') ? selectedEmail.subject : `Fwd: ${selectedEmail.subject}`,
            body: `\n\n--- Forwarded Message ---\nFrom: ${selectedEmail.from.name} <${selectedEmail.from.email}>\nSubject: ${selectedEmail.subject}\n\n${selectedEmail.body}`,
          })}
          onToggleStar={() => handleToggleStar(selectedEmail.id)}
          onDelete={() => handleDeleteEmail(selectedEmail.id)}
          onArchive={() => handleArchiveEmail(selectedEmail.id)}
          onReplyAll={() => handleCompose({
            to: selectedEmail.from.email,
            subject: selectedEmail.subject.startsWith('Re:') ? selectedEmail.subject : `Re: ${selectedEmail.subject}`,
            body: `\n\n--- Original Message ---\nFrom: ${selectedEmail.from.name} <${selectedEmail.from.email}>\n\n${selectedEmail.body}`,
          })}
          onMoveToFolder={handleMoveToFolder}
          onAddLabel={handleAddLabel}
          onMarkUnread={handleMarkUnread}
        />
      );
    }

    return (
      <div className="flex flex-col flex-1">
        {/* AI Typing Indicator */}
        {isAiTyping && (
          <div className="flex items-center gap-2 px-4 py-2 bg-teal-50 dark:bg-teal-900/20 border-b border-teal-200 dark:border-teal-800">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-xs text-teal-700 dark:text-teal-300 font-medium">
              {selectedUaeUser.language === 'ar' ? 'الذكاء الاصطناعي يكتب الرد...' : 'AI is composing a reply...'}
            </span>
          </div>
        )}
        <InboxView
          emails={filteredEmails}
          selectedEmailId={selectedEmailId}
          onSelectEmail={handleSelectEmail}
          onToggleStar={handleToggleStar}
          onDeleteEmail={handleDeleteEmail}
          onArchiveEmails={handleArchiveEmails}
          onMarkAllRead={handleMarkAllRead}
          folderName={currentFolder?.name || 'Inbox'}
        />
      </div>
    );
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex md:w-[260px] md:min-w-[260px] md:flex-col border-r border-border">
        {renderSidebar()}
      </div>

      {/* Desktop Content */}
      <div className="hidden md:flex md:flex-1 md:flex-col">
        {renderContent()}
      </div>

      {/* Mobile View */}
      <div className="flex md:hidden flex-1 flex-col">
        {!mobileShowContent ? (
          <div className="flex flex-col w-full">
            <MobileHeader onSwitchPage={onSwitchPage} />
            {renderSidebar()}
          </div>
        ) : (
          <div className="flex flex-col flex-1">
            {renderContent()}
          </div>
        )}
      </div>
    </div>
  );
}

function MobileHeader({ onSwitchPage }: { onSwitchPage?: () => void }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background">
      <span className="text-foreground text-lg font-semibold">Mail Simulator</span>
      <div className="flex-1" />
      {onSwitchPage && (
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={onSwitchPage} title="Switch to WhatsApp">
          <MessageSquare className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}
