'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { WhatsAppConversation, WhatsAppMessage } from '@/worker/whatsapp/types';

const MY_PHONE = '+971501234567';

export function useWhatsApp() {
  const [conversations, setConversations] = useState<WhatsAppConversation[]>([]);
  const [messagesMap, setMessagesMap] = useState<Record<string, WhatsAppMessage[]>>({});
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [typingConversations, setTypingConversations] = useState<Set<string>>(new Set());
  const conversationsRef = useRef<WhatsAppConversation[]>([]);
  const loadedConversationsRef = useRef<Set<string>>(new Set());
  const selectedConversationIdRef = useRef<string | null>(null);

  // Keep refs in sync
  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    selectedConversationIdRef.current = selectedConversationId;
  }, [selectedConversationId]);

  // NOTE: Socket.IO connection removed — all data now comes from the
  // worker REST API via polling (use-realtime.ts). No fake data service.

  // Load conversations from API on mount
  useEffect(() => {
    async function loadConversations() {
      try {
        const res = await fetch('/api/whatsapp?action=conversations');
        const json = await res.json();
        if (json.success) {
          setConversations(json.data);
        }
      } catch (err) {
        console.error('Failed to load conversations:', err);
      } finally {
        setLoading(false);
      }
    }
    loadConversations();
  }, []);

  // Load messages when conversation is selected
  useEffect(() => {
    if (!selectedConversationId) return;

    // Only load if not already loaded
    if (loadedConversationsRef.current.has(selectedConversationId)) return;

    async function loadMessages() {
      try {
        const res = await fetch(`/api/whatsapp?action=messages&conversationId=${selectedConversationId}`);
        const json = await res.json();
        if (json.success) {
          loadedConversationsRef.current.add(selectedConversationId);
          setMessagesMap(prev => ({
            ...prev,
            [selectedConversationId]: json.data,
          }));
        }
      } catch (err) {
        console.error('Failed to load messages:', err);
      }
    }
    loadMessages();
  }, [selectedConversationId]);

  // Send message via API
  const sendMessage = useCallback(async (conversationId: string, text: string) => {
    const conversation = conversationsRef.current.find(c => c.id === conversationId);
    if (!conversation) return;

    const to = conversation.contact.phone;

    // Optimistically add message to UI
    const optimisticMsg: WhatsAppMessage = {
      id: `temp_${Date.now()}`,
      conversationId,
      from: MY_PHONE,
      to,
      text,
      timestamp: new Date().toISOString(),
      status: 'sent',
      type: 'text',
      isFromBusiness: false,
    };

    setMessagesMap(prev => ({
      ...prev,
      [conversationId]: [...(prev[conversationId] || []), optimisticMsg],
    }));

    // Update conversation
    setConversations(prev => {
      const updated = prev.map(c => {
        if (c.id === conversationId) {
          return { ...c, lastMessage: optimisticMsg, updatedAt: optimisticMsg.timestamp };
        }
        return c;
      });
      return sortConversations(updated);
    });

    // Send via API
    try {
      const res = await fetch('/api/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send',
          to,
          text,
          conversationId,
        }),
      });
      const json = await res.json();

      if (json.success) {
        // Replace optimistic message with real one
        const realMsg = json.data.message;
        setMessagesMap(prev => ({
          ...prev,
          [conversationId]: (prev[conversationId] || []).map(m =>
            m.id === optimisticMsg.id ? realMsg : m
          ),
        }));

        // Update conversation with real message
        setConversations(prev => {
          const updated = prev.map(c => {
            if (c.id === conversationId) {
              return { ...c, lastMessage: realMsg, updatedAt: realMsg.timestamp };
            }
            return c;
          });
          return sortConversations(updated);
        });

        // Simulate delivery status progression
        setTimeout(() => {
          setMessagesMap(prev => ({
            ...prev,
            [conversationId]: (prev[conversationId] || []).map(m =>
              m.id === realMsg.id ? { ...m, status: 'delivered' as const } : m
            ),
          }));
        }, 1000);

        setTimeout(() => {
          setMessagesMap(prev => ({
            ...prev,
            [conversationId]: (prev[conversationId] || []).map(m =>
              m.id === realMsg.id ? { ...m, status: 'read' as const } : m
            ),
          }));
        }, 2500);
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      // Mark as failed
      setMessagesMap(prev => ({
        ...prev,
        [conversationId]: (prev[conversationId] || []).map(m =>
          m.id === optimisticMsg.id ? { ...m, status: 'failed' as const } : m
        ),
      }));
    }
  }, []);

  // Select conversation and mark as read
  const selectConversation = useCallback((id: string) => {
    setSelectedConversationId(id);
    // Mark as read locally
    setConversations(prev => prev.map(c =>
      c.id === id ? { ...c, unreadCount: 0 } : c
    ));
    // Also tell the API
    fetch('/api/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark-read', conversationId: id }),
    }).catch(() => {});
  }, []);

  // Toggle pin (local state only)
  const togglePin = useCallback((id: string) => {
    setConversations(prev => {
      const conv = prev.find(c => c.id === id);
      const newPinned = !conv?.isPinned;
      const updated = prev.map(c =>
        c.id === id ? { ...c, isPinned: newPinned } : c
      );
      return sortConversations(updated);
    });
  }, []);

  // Toggle mute (local state only)
  const toggleMute = useCallback((id: string) => {
    setConversations(prev =>
      prev.map(c => c.id === id ? { ...c, isMuted: !c.isMuted } : c)
    );
  }, []);

  const selectedConversation = conversations.find(c => c.id === selectedConversationId) || null;
  const currentMessages = selectedConversationId ? (messagesMap[selectedConversationId] || []) : [];
  const isTyping = selectedConversationId ? typingConversations.has(selectedConversationId) : false;

  return {
    conversations,
    selectedConversation,
    currentMessages,
    selectedConversationId,
    loading,
    isTyping,
    selectConversation,
    sendMessage,
    togglePin,
    toggleMute,
  };
}

// Helper: sort conversations (pinned first, then by updatedAt desc)
function sortConversations(conversations: WhatsAppConversation[]): WhatsAppConversation[] {
  return [...conversations].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}
