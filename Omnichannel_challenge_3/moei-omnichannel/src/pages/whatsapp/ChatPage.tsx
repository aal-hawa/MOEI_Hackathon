'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { ContactList } from './ContactList';
import { ChatArea } from './ChatArea';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  MessageSquare, MoreVertical, LogOut, Star, Settings, Users, Plus, Search, Mail,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { WhatsAppConversation, WhatsAppMessage } from '@/worker/whatsapp/types';
import { useAppStore } from '@/pages/store/app-store';
import { useAuthStore } from '@/components/shared/lib/auth-store';
import { useRealtime } from '@/pages/hooks/use-realtime';

const moeiPhone = '+9718006634';

// Only MOEI Support conversation — no fake/mock personal chats, no auto-welcome
const initialConversations: WhatsAppConversation[] = [
  {
    id: 'c_moei', contactId: 'ct_moei',
    contact: { id: 'ct_moei', name: 'MOEI Support', phone: moeiPhone, avatar: '', isOnline: true, isBusiness: true, lastSeen: undefined, labels: ['Business'] },
    lastMessage: { id: 'm_moei_placeholder', conversationId: 'c_moei', from: moeiPhone, to: '', text: '', timestamp: new Date().toISOString(), status: 'read', type: 'text', isFromBusiness: true },
    unreadCount: 0, updatedAt: new Date().toISOString(), isPinned: true, isMuted: false,
  },
];

const initialMessagesMap: Record<string, WhatsAppMessage[]> = {
  c_moei: [],
};

type FilterType = 'all' | 'unread' | 'groups';

interface ChatPageProps {
  onSwitchPage?: () => void;
}

export function ChatPage({ onSwitchPage }: ChatPageProps) {
  const [conversations, setConversations] = useState<WhatsAppConversation[]>(initialConversations);
  const [messagesMap, setMessagesMap] = useState<Record<string, WhatsAppMessage[]>>(initialMessagesMap);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>('c_moei');
  const [mobileShowChat, setMobileShowChat] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [typingConversationId, setTypingConversationId] = useState<string | null>(null);
  const { toast } = useToast();

  // Use UAE PASS logged-in user identity from auth store
  const { userProfile } = useAuthStore();
  const selectedUaeUser = useMemo(() => ({
    id: userProfile?.sub || 'uaepass-unknown',
    name: userProfile?.fullnameEN || 'User',
    nameAr: userProfile?.fullnameAR || '',
    phone: userProfile?.mobile || '+971500000000',
    email: userProfile?.email || 'user@moei.ae',
    language: (userProfile?.firstnameAR ? 'ar' : 'en') as 'ar' | 'en',
    emiratesId: userProfile?.idn || '',
    nationality: userProfile?.nationalityEN || '',
    gender: userProfile?.gender || '',
    dateOfBirth: userProfile?.dob || '',
    isVerified: !!userProfile?.sub,
  }), [userProfile?.sub, userProfile?.fullnameEN, userProfile?.fullnameAR, userProfile?.mobile, userProfile?.email, userProfile?.firstnameAR, userProfile?.idn, userProfile?.nationalityEN, userProfile?.gender, userProfile?.dob]);

  const [dbHistory, setDbHistory] = useState<WhatsAppMessage[]>([]);
  const [clearedAt, setClearedAt] = useState<number>(0);

  // Load clearedAt flag from localStorage
  useEffect(() => {
    const val = localStorage.getItem(`whatsapp_cleared_${selectedUaeUser.id}`);
    setClearedAt(val ? parseInt(val, 10) : 0);
  }, [selectedUaeUser.id]);

  // Fetch DB History — also poll every 5s so customer sees admin responses in near-real-time
  useEffect(() => {
    let cancelled = false;
    const fetchHistory = () => {
      fetch(`/api/realtime/history?email=${selectedUaeUser.email}&channel=whatsapp`)
        .then(res => res.json())
        .then(data => {
          if (cancelled) return;
          if (data.history) {
             const historyMsgs = data.history.map((m: any) => ({
               id: m.id,
               conversationId: 'c_moei',
               from: m.direction === 'inbound' ? selectedUaeUser.phone : moeiPhone,
               to: m.direction === 'inbound' ? moeiPhone : selectedUaeUser.phone,
               text: m.content,
               timestamp: new Date(m.createdAt).toISOString(),
               status: 'read',
               type: 'text',
               isFromBusiness: m.direction === 'outbound'
             }));
             setDbHistory(historyMsgs);
          }
        })
        .catch(err => { if (!cancelled) console.error('Failed to fetch DB history', err); });
    };
    fetchHistory(); // initial fetch
    const interval = setInterval(fetchHistory, 5000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [selectedUaeUser.email, selectedUaeUser.phone]);

  const { whatsappMessages } = useAppStore();
  useRealtime(); // Start polling for real-time messages

  // Sync MOEI conversation with global store & DB
  useEffect(() => {
    // Match store messages by multiple criteria since IDs differ across systems:
    // - Store messages use DB customer IDs (cuid like 'cmq6b4rja...')
    // - Customer view uses UAE PASS IDs (like 'UAEPASS/xxx')
    // - We also match by phone number and email for robustness
    const storeMsgs = whatsappMessages
      .filter(m => {
        // Match by UAE PASS ID (exact)
        if (m.customerId === selectedUaeUser.id) return true
        // Match by customer phone
        if (m.customerPhone && m.customerPhone === selectedUaeUser.phone.replace('+971', '')) return true
        // Match by customer name (for initial messages before DB ID is resolved)
        if (m.customerName && m.customerName === selectedUaeUser.name) return true
        return false
      })
      .map(m => ({
         id: m.id,
         conversationId: 'c_moei',
         from: m.direction === 'inbound' ? selectedUaeUser.phone : moeiPhone,
         to: m.direction === 'inbound' ? moeiPhone : selectedUaeUser.phone,
         text: m.content,
         timestamp: new Date(m.timestamp).toISOString(),
         status: m.status as any,
         type: 'text' as const,
         isFromBusiness: m.direction === 'outbound'
      }));

    // Combine DB history, Store messages, AND existing local messages (dedup by content+direction to avoid duplicates)
    setMessagesMap(prev => {
      const existingLocal = prev['c_moei'] || [];
      const combined = [...dbHistory, ...storeMsgs, ...existingLocal];

      // Deduplicate by content + direction + approximate timestamp (within 5 seconds)
      // This prevents the same message appearing multiple times with different IDs
      const uniqueMsgsMap = new Map<string, WhatsAppMessage>();
      combined.forEach(m => {
        const dedupeKey = `${m.isFromBusiness ? 'biz' : 'cust'}:${m.text.slice(0, 100)}:${Math.floor(new Date(m.timestamp).getTime() / 5000)}`;
        if (!uniqueMsgsMap.has(dedupeKey)) {
          uniqueMsgsMap.set(dedupeKey, m);
        }
      });

      const allMsgs = Array.from(uniqueMsgsMap.values())
        .filter(m => new Date(m.timestamp).getTime() > clearedAt)
        .sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      const lastMsg = allMsgs.length > 0 ? allMsgs[allMsgs.length - 1] : initialConversations[0].lastMessage;

      // Also update conversations
      setConversations(prevConv => {
        const existing = prevConv.filter(c => c.id !== 'c_moei');
        const moeiConv: WhatsAppConversation = {
           id: 'c_moei', contactId: 'ct_moei',
           contact: { id: 'ct_moei', name: 'MOEI Support', phone: moeiPhone, avatar: '', isOnline: true, isBusiness: true, labels: ['Business'] },
           lastMessage: lastMsg,
           unreadCount: 0,
           updatedAt: lastMsg.timestamp,
           isPinned: true,
           isMuted: false,
        };
        return [moeiConv, ...existing].sort((a,b) => {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        });
      });

      return {
        ...prev,
        'c_moei': allMsgs.length > 0 ? allMsgs : []
      };
    });
  }, [whatsappMessages, dbHistory, clearedAt, selectedUaeUser]);

  // Track typing indicator timeouts so we can cancel them if AI responds quickly
  const typingTimeoutRefs = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const selectedConversation = conversations.find(c => c.id === selectedConversationId) || null;
  const currentMessages = selectedConversationId ? (messagesMap[selectedConversationId] || []) : [];

  // Filter conversations by search and active filter
  const filteredConversations = conversations
    .filter(c => {
      // Apply search filter
      if (searchQuery) {
        const matchesSearch =
          c.contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.lastMessage?.text.toLowerCase().includes(searchQuery.toLowerCase());
        if (!matchesSearch) return false;
      }
      // Apply tab filter
      if (activeFilter === 'unread') return c.unreadCount > 0;
      if (activeFilter === 'groups') return c.contact.labels?.includes('group') ?? false;
      return true;
    });

  const handleSendMessage = useCallback(async (conversationId: string, text: string) => {
    const newMessage: WhatsAppMessage = {
      id: `msg_${Date.now()}`,
      conversationId,
      from: selectedUaeUser.phone,
      to: conversations.find(c => c.id === conversationId)?.contact.phone || '',
      text,
      timestamp: new Date().toISOString(),
      status: 'sent',
      type: 'text',
      isFromBusiness: false,
    };

    // Add customer message to chat immediately
    setMessagesMap(prev => ({
      ...prev,
      [conversationId]: [...(prev[conversationId] || []), newMessage],
    }));

    // Update conversation's last message and move to top
    setConversations(prev => {
      const updated = prev.map(c => {
        if (c.id === conversationId) {
          return { ...c, lastMessage: newMessage, updatedAt: newMessage.timestamp };
        }
        return c;
      });
      return updated.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
    });

    // Simulate delivery status
    setTimeout(() => {
      setMessagesMap(prev => ({
        ...prev,
        [conversationId]: (prev[conversationId] || []).map(m =>
          m.id === newMessage.id ? { ...m, status: 'delivered' as const } : m
        ),
      }));
    }, 1000);

    // Show typing indicator
    setTypingConversationId(conversationId);

    if (conversationId === 'c_moei') {
      try {
        // Send message to AI — this single endpoint handles:
        // 1. Creating/finding customer in DB
        // 2. Creating/finding conversation session
        // 3. Saving customer message to DB (Interaction + WAMessage)
        // 4. Getting AI response via BrainOrchestrator
        // 5. Saving AI response to DB (Interaction + WAMessage + transcript)
        // 6. Returning the AI answer
        const chatRes = await fetch('/api/ai/whatsapp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            sessionId: `wa-${Date.now()}`,
            language: selectedUaeUser.language,
            customerName: selectedUaeUser.name,
            customerNameAr: selectedUaeUser.nameAr,
            customerPhone: selectedUaeUser.phone.replace('+971', ''),
            customerEmail: selectedUaeUser.email,
            uaePassId: selectedUaeUser.id,
            emiratesId: selectedUaeUser.emiratesId,
            nationality: selectedUaeUser.nationality,
            gender: selectedUaeUser.gender,
            dateOfBirth: selectedUaeUser.dateOfBirth,
            isVerified: selectedUaeUser.isVerified,
          })
        });

        if (chatRes.ok) {
          const chatData = await chatRes.json();

          // If AI returned a response, show it in the chat
          if (chatData.response) {
            const aiMessage: WhatsAppMessage = {
              id: `ai_${Date.now()}`,
              conversationId,
              from: moeiPhone,
              to: selectedUaeUser.phone,
              text: chatData.response,
              timestamp: new Date().toISOString(),
              status: 'read',
              type: 'text',
              isFromBusiness: true,
            };

            setMessagesMap(prev => ({
              ...prev,
              [conversationId]: [...(prev[conversationId] || []), aiMessage],
            }));

            setConversations(prev => prev.map(c =>
              c.id === conversationId ? { ...c, lastMessage: aiMessage, updatedAt: aiMessage.timestamp } : c
            ));
          }
        }
      } catch (err) {
        console.error('Failed to get AI response', err);
      } finally {
        setTypingConversationId(null);
      }
    } else {
      setTypingConversationId(null);
    }

  }, [conversations, selectedUaeUser]);

  const handleClearChat = useCallback(() => {
    if (!selectedConversationId) return;
    
    if (selectedConversationId === 'c_moei') {
      const now = Date.now();
      localStorage.setItem(`whatsapp_cleared_${selectedUaeUser.id}`, now.toString());
      setClearedAt(now);
    }
    
    setMessagesMap(prev => ({
      ...prev,
      [selectedConversationId]: [],
    }));
    setConversations(prev => prev.map(c =>
      c.id === selectedConversationId ? { ...c, lastMessage: undefined, unreadCount: 0 } : c
    ));
    toast({ title: 'Chat cleared', duration: 2000 });
  }, [selectedConversationId, selectedUaeUser.id, toast]);

  const handleSelectConversation = useCallback((id: string) => {
    setSelectedConversationId(id);
    setMobileShowChat(true);
    // Mark as read
    setConversations(prev => prev.map(c =>
      c.id === id ? { ...c, unreadCount: 0 } : c
    ));
  }, []);

  const handleBack = useCallback(() => {
    setMobileShowChat(false);
  }, []);

  const handleTogglePin = useCallback((id: string) => {
    setConversations(prev => {
      const conv = prev.find(c => c.id === id);
      const newPinned = !conv?.isPinned;
      const updated = prev.map(c =>
        c.id === id ? { ...c, isPinned: newPinned } : c
      );
      return updated.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
    });
    toast({
      title: conv?.isPinned ? 'Chat unpinned' : 'Chat pinned',
      description: conv?.isPinned
        ? `${conv?.contact.name} has been unpinned`
        : `${conv?.contact.name} has been pinned to the top`,
    });
  }, [toast]);

  const handleToggleMute = useCallback((id: string) => {
    setConversations(prev => {
      const conv = prev.find(c => c.id === id);
      const newMuted = !conv?.isMuted;
      return prev.map(c =>
        c.id === id ? { ...c, isMuted: newMuted } : c
      );
    });
    const conv = conversations.find(c => c.id === id);
    toast({
      title: conv?.isMuted ? 'Chat unmuted' : 'Chat muted',
      description: conv?.isMuted
        ? `${conv?.contact.name} notifications restored`
        : `${conv?.contact.name} notifications silenced`,
    });
  }, [conversations, toast]);

  return (
    <div className="flex h-full w-full overflow-hidden bg-[#111b21]">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex md:w-[380px] md:min-w-[380px] md:flex-col border-r border-[#222d34]">
        <SidebarContent
          conversations={filteredConversations}
          allConversations={conversations}
          selectedId={selectedConversationId}
          onSelect={handleSelectConversation}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          onTogglePin={handleTogglePin}
          onToggleMute={handleToggleMute}
          onSwitchPage={onSwitchPage}
          selectedUaeUser={selectedUaeUser}
        />
      </div>

      {/* Desktop Chat Area */}
      <div className="hidden md:flex md:flex-1">
        <ChatArea
          conversation={selectedConversation}
          messages={currentMessages}
          onBack={handleBack}
          onSendMessage={(text) => {
            if (selectedConversationId) {
              handleSendMessage(selectedConversationId, text);
            }
          }}
          isTyping={typingConversationId === selectedConversationId}
          myPhone={selectedUaeUser.phone}
        />
      </div>

      {/* Mobile View */}
      <div className="flex md:hidden flex-1">
        {!mobileShowChat ? (
          <div className="flex flex-col w-full">
            <MobileSidebarHeader onSwitchPage={onSwitchPage} />
            <SidebarContent
              conversations={filteredConversations}
              allConversations={conversations}
              selectedId={selectedConversationId}
              onSelect={handleSelectConversation}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              activeFilter={activeFilter}
              onFilterChange={setActiveFilter}
              onTogglePin={handleTogglePin}
              onToggleMute={handleToggleMute}
              onSwitchPage={onSwitchPage}
              selectedUaeUser={selectedUaeUser}
            />
          </div>
        ) : (
          <ChatArea
            conversation={selectedConversation}
            messages={currentMessages}
            onBack={handleBack}
            onSendMessage={(text) => {
              if (selectedConversationId) {
                handleSendMessage(selectedConversationId, text);
              }
            }}
            isMobile
            isTyping={typingConversationId === selectedConversationId}
            myPhone={selectedUaeUser.phone}
          />
        )}
      </div>
    </div>
  );
}

interface MobileSidebarHeaderProps {
  onSwitchPage?: () => void;
}

function MobileSidebarHeader({ onSwitchPage }: MobileSidebarHeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-[#202c33]">
      <span className="text-[#aebac1] text-lg font-semibold">WhatsApp</span>
      {onSwitchPage && (
        <Button
          variant="ghost"
          size="icon"
          className="text-[#aebac1] hover:bg-[#2a3942] h-8 w-8"
          onClick={onSwitchPage}
          title="Switch to Email"
        >
          <Mail className="w-5 h-5" />
        </Button>
      )}
    </div>
  );
}

const avatarColors = [
  'bg-emerald-600', 'bg-teal-600', 'bg-cyan-600', 'bg-amber-600',
  'bg-rose-600', 'bg-violet-600', 'bg-orange-600', 'bg-lime-600',
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

interface SidebarContentProps {
  conversations: WhatsAppConversation[];
  allConversations: WhatsAppConversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  onTogglePin: (id: string) => void;
  onToggleMute: (id: string) => void;
  onSwitchPage?: () => void;
  selectedUaeUser: { id: string; name: string; nameAr: string; phone: string; email: string; language: string; emiratesId: string; nationality: string; gender: string; dateOfBirth: string; isVerified: boolean };
}

function SidebarContent({
  conversations,
  allConversations,
  selectedId,
  onSelect,
  searchQuery,
  onSearchChange,
  activeFilter,
  onFilterChange,
  onTogglePin,
  onToggleMute,
  onSwitchPage,
  selectedUaeUser,
}: SidebarContentProps) {
  const [newChatSearch, setNewChatSearch] = useState('');
  const { toast } = useToast();

  const filterTabs: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'unread', label: 'Unread' },
    { key: 'groups', label: 'Groups' },
  ];

  // All contacts for the "New Chat" popover
  const filteredContacts = allConversations.filter(c =>
    c.contact.name.toLowerCase().includes(newChatSearch.toLowerCase()) ||
    c.contact.phone.toLowerCase().includes(newChatSearch.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-[#111b21]">
      {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#202c33]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#25D366] flex items-center justify-center text-white font-bold text-sm">
            ME
          </div>
          <span className="text-[#e9edef] font-medium text-sm">WhatsApp Simulator</span>
        </div>
        <div className="flex items-center gap-2">
          {/* UAE PASS Identity Badge */}
          <div className="flex items-center gap-1.5 bg-[#2a3942] text-[#25D366] text-xs rounded-md px-2 py-1">
            <span className="w-1.5 h-1.5 bg-[#25D366] rounded-full" />
            {selectedUaeUser.name}
          </div>

          {/* Switch to Email */}
          {onSwitchPage && (
            <Button
              variant="ghost"
              size="icon"
              className="text-[#aebac1] hover:bg-[#2a3942] h-8 w-8"
              onClick={onSwitchPage}
              title="Switch to Email"
            >
              <Mail className="w-5 h-5" />
            </Button>
          )}

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="text-[#aebac1] hover:bg-[#2a3942] h-8 w-8">
                <MessageSquare className="w-5 h-5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-80 p-0 bg-[#233138] border-[#2a3942] rounded-lg overflow-hidden"
            >
              {/* Popover Header */}
              <div className="px-4 py-3 border-b border-[#2a3942]">
                <h3 className="text-[#e9edef] font-medium text-base">New chat</h3>
              </div>
              {/* Search inside popover */}
              <div className="px-3 py-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8696a0]" />
                  <input
                    type="text"
                    value={newChatSearch}
                    onChange={(e) => setNewChatSearch(e.target.value)}
                    placeholder="Search contacts"
                    className="w-full bg-[#2a3942] text-[#e9edef] text-sm rounded-lg pl-10 pr-4 py-2 outline-none placeholder:text-[#8696a0] focus:ring-1 focus:ring-[#25D366]"
                  />
                </div>
              </div>
              {/* New Group Option */}
              <button
                onClick={() => {
                  toast({ title: 'Create a group coming soon' });
                }}
                className="flex items-center gap-3 w-full px-4 py-3 hover:bg-[#2a3942] transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-[#2a3942] flex items-center justify-center">
                  <Users className="w-5 h-5 text-[#25D366]" />
                </div>
                <span className="text-[#e9edef] text-sm font-medium">New group</span>
              </button>
              {/* Contacts List */}
              <ScrollArea className="max-h-64">
                {filteredContacts.map(conv => (
                  <button
                    key={conv.id}
                    onClick={() => {
                      onSelect(conv.id);
                      setNewChatSearch('');
                    }}
                    className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-[#2a3942] transition-colors"
                  >
                    <Avatar className="w-10 h-10">
                      <AvatarFallback className={`${getAvatarColor(conv.contact.name)} text-white font-medium text-xs`}>
                        {getInitials(conv.contact.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0 text-left">
                      <span className="text-[#e9edef] text-sm font-medium block truncate">
                        {conv.contact.name}
                      </span>
                      <span className="text-[#8696a0] text-xs block truncate">
                        {conv.contact.phone || 'Group'}
                      </span>
                    </div>
                  </button>
                ))}
                {filteredContacts.length === 0 && (
                  <div className="px-4 py-6 text-center text-[#8696a0] text-sm">
                    No contacts found
                  </div>
                )}
              </ScrollArea>
            </PopoverContent>
          </Popover>

          {/* More Options Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="text-[#aebac1] hover:bg-[#2a3942] h-8 w-8">
                <MoreVertical className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="bg-[#233138] border-[#2a3942] text-[#e9edef] min-w-[180px]"
            >
              <DropdownMenuItem
                className="focus:bg-[#2a3942] focus:text-[#e9edef] cursor-pointer"
                onClick={() => toast({ title: 'Create a group coming soon' })}
              >
                <Users className="w-4 h-4 mr-2 text-[#8696a0]" />
                New group
              </DropdownMenuItem>
              <DropdownMenuItem
                className="focus:bg-[#2a3942] focus:text-[#e9edef] cursor-pointer"
                onClick={() => toast({ title: 'Starred messages coming soon' })}
              >
                <Star className="w-4 h-4 mr-2 text-[#8696a0]" />
                Starred messages
              </DropdownMenuItem>
              <DropdownMenuItem
                className="focus:bg-[#2a3942] focus:text-[#e9edef] cursor-pointer"
                onClick={() => toast({ title: 'Settings coming soon' })}
              >
                <Settings className="w-4 h-4 mr-2 text-[#8696a0]" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-[#2a3942]" />
              <DropdownMenuItem
                className="focus:bg-[#2a3942] focus:text-[#e9edef] cursor-pointer"
                onClick={() => {
                  useAuthStore.getState().logout()
                  toast({ title: 'Logged out', description: 'You have been signed out successfully.' })
                }}
              >
                <LogOut className="w-4 h-4 mr-2 text-[#8696a0]" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8696a0]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search or start new chat"
            className="w-full bg-[#202c33] text-[#e9edef] text-sm rounded-lg pl-10 pr-4 py-2 outline-none placeholder:text-[#8696a0] focus:ring-1 focus:ring-[#25D366]"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8696a0] hover:text-[#e9edef]"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="px-3 pb-2 flex gap-2">
        {filterTabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => onFilterChange(tab.key)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              activeFilter === tab.key
                ? 'bg-[#25D366]/20 text-[#25D366]'
                : 'bg-[#202c33] text-[#8696a0] hover:bg-[#2a3942]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Contact List */}
      <ContactList
        conversations={conversations}
        selectedId={selectedId}
        onSelect={onSelect}
        onTogglePin={onTogglePin}
        onToggleMute={onToggleMute}
      />
    </div>
  );
}
