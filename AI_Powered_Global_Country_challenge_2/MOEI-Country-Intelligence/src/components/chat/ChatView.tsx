'use client';

/* ───────────────────────────────────────────────────────────────
   MOEI Country Intelligence Platform – Chat View
   Country-aware chat: shows selected country context badge
   Clean bubbles: white AI with teal left border, dark user bubbles
   ─────────────────────────────────────────────────────────────── */

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/lib/LanguageContext';
import type { ChatResponse } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Send, Bot, User, Loader2, MessageSquare, Globe, MapPin } from 'lucide-react';
import MarkdownContent from '@/components/common/MarkdownContent';

interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  content: string;
  countries?: string[];
  timestamp: Date;
}

interface ChatViewProps {
  onSendChat: (question: string) => Promise<ChatResponse>;
  loading: boolean;
  selectedCountry?: string;
  countryName?: string;
}

/* Typing indicator dots */
function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-[#0D9488]/50"
          style={{
            animation: `typing-dot 1.4s ease-in-out infinite`,
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}
    </div>
  );
}

export default function ChatView({
  onSendChat,
  loading,
  selectedCountry,
  countryName,
}: ChatViewProps) {
  const { t, lang, isRTL, dir } = useLanguage();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async () => {
    const question = input.trim();
    if (!question || sending) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: question,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setSending(true);

    try {
      const response = await onSendChat(question);

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'ai',
        content: response.answer,
        countries: response.countries,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'ai',
        content: t('chat.error'),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [input, sending, onSendChat, t]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Example questions - country-aware
  const examples = selectedCountry
    ? [
        t('chat.exampleStrategic', { country: countryName || selectedCountry }),
        t('chat.exampleTrade', { country: countryName || selectedCountry }),
        t('chat.exampleRisks', { country: countryName || selectedCountry }),
      ]
    : [
        t('chat.example1'),
        t('chat.example2'),
        t('chat.example3'),
      ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 flex flex-col" style={{ height: 'calc(100vh - 160px)' }} dir={dir}>
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1 custom-scrollbar">
        {/* Welcome state */}
        {messages.length === 0 && (
          <motion.div
            className="flex flex-col items-center justify-center py-12 text-center"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
          >
            <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center mb-5">
              <MessageSquare className="w-7 h-7 text-gray-400" />
            </div>
            <h2 className="text-lg font-bold text-gray-700 mb-2">
              {t('chat.title')}
            </h2>
            <p className="text-sm text-gray-400 max-w-sm mb-2 leading-relaxed">
              {t('chat.welcome')}
            </p>
            {/* Country context badge */}
            {selectedCountry && (
              <motion.div
                className="mb-6"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Badge className="px-3 py-1.5 text-xs gap-1.5 bg-[#0D9488]/10 text-[#0D9488] border border-[#0D9488]/20 hover:bg-[#0D9488]/15 rounded-lg">
                  <MapPin className="w-3.5 h-3.5" />
                  {t('chat.researchContext')}: {countryName || selectedCountry}
                </Badge>
              </motion.div>
            )}
            {/* Example questions */}
            <div className="space-y-2 w-full max-w-md">
              {examples.map((ex, i) => (
                <motion.button
                  key={i}
                  onClick={() => {
                    setInput(ex);
                    inputRef.current?.focus();
                  }}
                  className="w-full text-left px-4 py-3 rounded-lg bg-white border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all duration-150"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 + i * 0.06 }}
                >
                  {ex}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Message bubbles */}
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className={`flex gap-2.5 ${msg.role === 'user' ? (isRTL ? 'flex-row-reverse' : 'justify-end') : (isRTL ? 'flex-row-reverse' : '')}`}
            >
              {/* AI avatar */}
              {msg.role === 'ai' && (
                <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-[#0D9488]/10 flex items-center justify-center mt-0.5">
                  <Bot className="w-3.5 h-3.5 text-[#0D9488]" />
                </div>
              )}

              {/* Bubble */}
              <div
                className={`max-w-[80%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-[#0F172A] text-white rounded-br-sm'
                    : 'bg-white border border-gray-200 text-gray-700 rounded-bl-sm border-l-[3px] border-l-[#0D9488]'
                }`}
              >
                <MarkdownContent content={msg.content} size="sm" />

                {/* Related countries */}
                {msg.countries && msg.countries.length > 0 && msg.role === 'ai' && (
                  <div className={`flex flex-wrap gap-1.5 mt-2.5 pt-2 border-t border-gray-100 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <span className="text-[10px] text-gray-400">{t('chat.countries')}:</span>
                    {msg.countries.map((c) => (
                      <Badge
                        key={c}
                        variant="outline"
                        className="text-[10px] px-2 py-0 border-[#0D9488]/20 text-[#0D9488] bg-[#0D9488]/5 rounded-md"
                      >
                        {c}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* User avatar */}
              {msg.role === 'user' && (
                <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-[#0F172A] flex items-center justify-center mt-0.5">
                  <User className="w-3.5 h-3.5 text-white" />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Sending indicator */}
        {sending && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex gap-2.5 ${isRTL ? 'flex-row-reverse' : ''}`}
          >
            <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-[#0D9488]/10 flex items-center justify-center mt-0.5">
              <Bot className="w-3.5 h-3.5 text-[#0D9488]" />
            </div>
            <div className="bg-white border border-gray-200 rounded-xl rounded-bl-sm border-l-[3px] border-l-[#0D9488] px-4 py-3">
              <div className="flex items-center gap-2.5 text-xs text-gray-400">
                <TypingIndicator />
                {t('chat.thinking')}
              </div>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="bg-white border border-gray-200 rounded-xl px-3 py-2 mt-2 shadow-sm">
        {/* Country context indicator in input */}
        {selectedCountry && (
          <div className="flex items-center gap-1.5 mb-1.5 px-1">
            <Globe className="w-3 h-3 text-[#0D9488]" />
            <span className="text-[10px] text-[#0D9488] font-medium">
              {t('chat.context', { country: countryName || selectedCountry })}
            </span>
          </div>
        )}
        <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              selectedCountry
                ? t('chat.askAbout', { country: countryName || selectedCountry })
                : t('chat.placeholder')
            }
            disabled={sending}
            className="flex-1 h-10 text-sm border-0 bg-transparent focus:ring-0 focus:outline-none placeholder:text-gray-400"
          />
          <Button
            onClick={sendMessage}
            disabled={!input.trim() || sending}
            className="h-9 w-9 p-0 rounded-lg bg-[#0F172A] hover:bg-[#0F172A]/90 text-white shrink-0"
          >
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
