'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ArrowLeft, Phone, Video, Search, MoreVertical,
  Smile, Paperclip, Mic, Send,
  Check, CheckCheck, Clock, AlertCircle,
  X, StopCircle, PhoneOff, VideoOff, Info, MousePointerClick, BellOff, Trash2,
  Camera, FileText, MapPin, UserPlus,
} from 'lucide-react';
import { toast } from 'sonner';
import type { WhatsAppConversation, WhatsAppMessage } from '@/worker/whatsapp/types';

interface ChatAreaProps {
  conversation: WhatsAppConversation | null;
  messages: WhatsAppMessage[];
  onBack: () => void;
  onSendMessage: (text: string) => void;
  isMobile?: boolean;
  isTyping?: boolean;
  onClearChat?: () => void;
  onDeleteChat?: () => void;
  myPhone: string;
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
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

function formatMessageTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function StatusIcon({ status, isFromMe }: { status: string; isFromMe: boolean }) {
  if (!isFromMe) return null;
  switch (status) {
    case 'sent':
      return <Check className="w-4 h-4 text-[#8696a0]" />;
    case 'delivered':
      return <CheckCheck className="w-4 h-4 text-[#8696a0]" />;
    case 'read':
      return <CheckCheck className="w-4 h-4 text-[#53bdeb]" />;
    case 'failed':
      return <AlertCircle className="w-4 h-4 text-red-400" />;
    default:
      return <Clock className="w-4 h-4 text-[#8696a0]" />;
  }
}

const EMOJI_ROWS = [
  ['😀', '😂', '🥰', '😎', '🤔', '😢', '😡', '🥳', '🤗', '😴'],
  ['👍', '👎', '❤️', '🔥', '💯', '✨', '🎉', '🙏', '💪', '👋'],
  ['✅', '❌', '⏰', '🎵', '📷', '📎', '🔗', '💬', '🎯', '🏆'],
];

export function ChatArea({ conversation, messages, onBack, onSendMessage, isMobile, isTyping, onClearChat, onDeleteChat, myPhone }: ChatAreaProps) {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Call overlays
  const [videoCallActive, setVideoCallActive] = useState(false);
  const [phoneCallActive, setPhoneCallActive] = useState(false);

  // Search
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Emoji picker
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);

  // Voice recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-close calls after 5 seconds
  useEffect(() => {
    if (!videoCallActive) return;
    const timer = setTimeout(() => setVideoCallActive(false), 5000);
    return () => clearTimeout(timer);
  }, [videoCallActive]);

  useEffect(() => {
    if (!phoneCallActive) return;
    const timer = setTimeout(() => setPhoneCallActive(false), 5000);
    return () => clearTimeout(timer);
  }, [phoneCallActive]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Focus input when conversation changes
  useEffect(() => {
    if (conversation) {
      inputRef.current?.focus();
    }
  }, [conversation?.id]);

  const handleSend = useCallback(() => {
    if (inputText.trim()) {
      onSendMessage(inputText.trim());
      setInputText('');
      inputRef.current?.focus();
    }
  }, [inputText, onSendMessage]);

  const startRecording = () => {
    setRecordingSeconds(0);
    setIsRecording(true);
  };

  const stopRecordingRef = useRef<((secs: number) => void) | null>(null);

  const stopRecording = useCallback((finalSecs?: number) => {
    const secs = finalSecs ?? recordingSeconds;
    setIsRecording(false);
    if (secs > 0) {
      const formatted = secs < 10 ? `0:0${secs}` : `0:${secs}`;
      onSendMessage(`[🎤 Voice message ${formatted}]`);
    }
    setRecordingSeconds(0);
  }, [recordingSeconds, onSendMessage]);

  // Keep ref in sync with latest stopRecording
  useEffect(() => {
    stopRecordingRef.current = (secs: number) => {
      setIsRecording(false);
      if (secs > 0) {
        const formatted = secs < 10 ? `0:0${secs}` : `0:${secs}`;
        onSendMessage(`[🎤 Voice message ${formatted}]`);
      }
      setRecordingSeconds(0);
    };
  }, [onSendMessage]);

  // Voice recording timer
  useEffect(() => {
    if (isRecording) {
      recordingIntervalRef.current = setInterval(() => {
        setRecordingSeconds(prev => {
          if (prev >= 29) {
            // Auto-stop at 30 seconds
            if (recordingIntervalRef.current) {
              clearInterval(recordingIntervalRef.current);
              recordingIntervalRef.current = null;
            }
            // Schedule the stop via ref to avoid calling setState in effect
            const finalSecs = 29;
            setTimeout(() => stopRecordingRef.current?.(finalSecs), 0);
            return 29;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    }
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    };
  }, [isRecording]);

  // Search filtering
  const filteredMessages = searchOpen && searchQuery.trim()
    ? messages.filter(msg => msg.text.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages;

  const searchMatchCount = searchOpen && searchQuery.trim()
    ? messages.filter(msg => msg.text.toLowerCase().includes(searchQuery.toLowerCase())).length
    : 0;

  // Empty state - no conversation selected
  if (!conversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#0b141a]">
        <div className="text-center max-w-md px-6">
          <div className="w-64 h-64 mx-auto mb-6 opacity-30">
            <svg viewBox="0 0 303 172" fill="none" className="w-full h-full">
              <path fillRule="evenodd" clipRule="evenodd" d="M229.565 160.229C262.212 149.245 286.931 118.241 283.39 73.4194C278.009 5.31929 210.459 -13.3381 152.4 8.24474C113.714 22.5765 74.0311 18.498 45.4085 40.8971C12.6 66.4469 -1.23819 109.71 21.5736 144.483C50.3675 188.084 116.448 143.137 155.282 135.231C186.218 128.952 203.423 168.823 229.565 160.229Z" fill="#25D366" fillOpacity="0.08"/>
            </svg>
          </div>
          <h2 className="text-[#e9edef] text-2xl font-light mb-2">WhatsApp Web</h2>
          <p className="text-[#8696a0] text-sm leading-relaxed">
            Send and receive messages without keeping your phone online.
            <br />
            Use WhatsApp on up to 4 linked devices and 1 phone at the same time.
          </p>
          <div className="mt-8 flex items-center justify-center gap-2 text-[#8696a0] text-xs">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            <span>End-to-end encrypted</span>
          </div>
        </div>
      </div>
    );
  }

  const isGroup = conversation.contact.labels?.includes('group');
  const contactName = conversation.contact.name;

  return (
    <div className="flex-1 flex flex-col bg-[#0b141a]">
      {/* Chat Header */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-[#202c33] border-b border-[#222d34]">
        {isMobile && (
          <Button variant="ghost" size="icon" onClick={onBack} className="text-[#aebac1] hover:bg-[#2a3942] h-8 w-8 mr-1">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        )}
        <Avatar className="w-10 h-10">
          <AvatarFallback className={`${getAvatarColor(contactName)} text-white font-medium text-sm`}>
            {getInitials(contactName)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[#e9edef] font-medium text-[15px] truncate">{contactName}</span>
          </div>
          <span className="text-[#8696a0] text-xs">
            {isTyping
              ? 'typing...'
              : conversation.contact.isOnline
              ? 'online'
              : isGroup
              ? 'tap here for group info'
              : `last seen ${formatMessageTime(conversation.contact.lastSeen || conversation.updatedAt)}`
            }
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setVideoCallActive(true)} className="text-[#aebac1] hover:bg-[#2a3942] h-8 w-8">
            <Video className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setPhoneCallActive(true)} className="text-[#aebac1] hover:bg-[#2a3942] h-8 w-8">
            <Phone className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => { setSearchOpen(prev => !prev); setSearchQuery(''); }} className="text-[#aebac1] hover:bg-[#2a3942] h-8 w-8">
            <Search className="w-5 h-5" />
          </Button>

          {/* MoreVertical Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="text-[#aebac1] hover:bg-[#2a3942] h-8 w-8">
                <MoreVertical className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-[#233138] border-[#2a3942] text-[#e9edef] min-w-[200px]" align="end">
              <DropdownMenuItem className="focus:bg-[#182229] focus:text-[#e9edef] cursor-pointer gap-3" onClick={() => toast.info('Contact info coming soon')}>
                <Info className="w-4 h-4" />
                Contact info
              </DropdownMenuItem>
              <DropdownMenuItem className="focus:bg-[#182229] focus:text-[#e9edef] cursor-pointer gap-3" onClick={() => toast.info('Select messages coming soon')}>
                <MousePointerClick className="w-4 h-4" />
                Select messages
              </DropdownMenuItem>
              <DropdownMenuItem className="focus:bg-[#182229] focus:text-[#e9edef] cursor-pointer gap-3" onClick={() => toast.success('Notifications muted')}>
                <BellOff className="w-4 h-4" />
                Mute notifications
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-[#2a3942]" />
              <DropdownMenuItem className="focus:bg-[#182229] focus:text-[#e9edef] cursor-pointer gap-3" onClick={() => onClearChat?.()}>
                <Trash2 className="w-4 h-4" />
                Clear chat
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" className="focus:bg-[#182229] cursor-pointer gap-3 text-red-400" onClick={() => onDeleteChat?.()}>
                <Trash2 className="w-4 h-4" />
                Delete chat
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Search Bar (toggled) */}
      {searchOpen && (
        <div className="flex items-center gap-2 px-4 py-2 bg-[#202c33] border-b border-[#222d34]">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search in chat..."
            className="bg-[#2a3942] border-none text-[#e9edef] placeholder:text-[#8696a0] rounded-lg h-8 text-sm focus-visible:ring-[#25D366]"
            autoFocus
          />
          {searchQuery.trim() && (
            <span className="text-[#8696a0] text-xs whitespace-nowrap">{searchMatchCount} match{searchMatchCount !== 1 ? 'es' : ''}</span>
          )}
          <Button variant="ghost" size="icon" onClick={() => { setSearchOpen(false); setSearchQuery(''); }} className="text-[#8696a0] hover:bg-[#2a3942] h-7 w-7 flex-shrink-0">
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Video Call Overlay */}
      {videoCallActive && (
        <div className="flex items-center justify-between px-4 py-3 bg-[#1a2e35] border-b border-[#222d34]">
          <div className="flex items-center gap-3">
            <Video className="w-5 h-5 text-[#25D366]" />
            <span className="text-[#e9edef] text-sm font-medium">Video calling {contactName}...</span>
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#25D366] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-[#25D366]"></span>
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setVideoCallActive(false)} className="bg-red-600 hover:bg-red-700 text-white h-8 px-4 rounded-full gap-2">
            <VideoOff className="w-4 h-4" />
            Decline
          </Button>
        </div>
      )}

      {/* Phone Call Overlay */}
      {phoneCallActive && (
        <div className="flex items-center justify-between px-4 py-3 bg-[#1a2e35] border-b border-[#222d34]">
          <div className="flex items-center gap-3">
            <Phone className="w-5 h-5 text-[#25D366]" />
            <span className="text-[#e9edef] text-sm font-medium">Calling {contactName}...</span>
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#25D366] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-[#25D366]"></span>
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setPhoneCallActive(false)} className="bg-red-600 hover:bg-red-700 text-white h-8 px-4 rounded-full gap-2">
            <PhoneOff className="w-4 h-4" />
            Decline
          </Button>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-[5%] md:px-[10%] py-4" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='400' height='400' viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23050505' fill-opacity='0.05'%3E%3Cpath d='M20 20h10v10H20zM60 60h10v10H60zM100 100h10v10h-10zM140 140h10v10h-10zM180 180h10v10h-10zM220 20h10v10h-10zM260 60h10v10h-10zM300 100h10v10h-10zM340 140h10v10h-10z'/%3E%3C/g%3E%3C/svg%3E")`,
        backgroundColor: '#0b141a',
      }}>
        {/* Date separator */}
        <div className="flex justify-center mb-4">
          <span className="bg-[#182229] text-[#8696a0] text-xs px-3 py-1 rounded-lg shadow-sm">
            Today
          </span>
        </div>

        {/* Encryption notice */}
        <div className="flex justify-center mb-4">
          <span className="bg-[#182229] text-[#8696a0] text-[11px] px-3 py-1 rounded-lg flex items-center gap-1.5">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            Messages are end-to-end encrypted. No one outside of this chat can read them.
          </span>
        </div>

        {filteredMessages.map((msg) => {
          const isFromMe = msg.from === myPhone;

          // Highlight search matches
          let messageContent: React.ReactNode = msg.text;
          if (searchOpen && searchQuery.trim()) {
            const lowerText = msg.text.toLowerCase();
            const lowerQuery = searchQuery.toLowerCase();
            const index = lowerText.indexOf(lowerQuery);
            if (index !== -1) {
              const before = msg.text.slice(0, index);
              const match = msg.text.slice(index, index + searchQuery.length);
              const after = msg.text.slice(index + searchQuery.length);
              messageContent = (
                <>
                  {before}
                  <span className="bg-yellow-500/40 text-[#e9edef] rounded px-0.5">{match}</span>
                  {after}
                </>
              );
            }
          }

          return (
            <div key={msg.id} className={`flex mb-1 ${isFromMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[65%]`}>
                <div className={`relative rounded-lg px-2.5 py-1.5 shadow-sm ${
                  isFromMe
                    ? 'bg-[#005c4b] text-[#e9edef]'
                    : 'bg-[#202c33] text-[#e9edef]'
                }`}>
                  <div className="flex items-end gap-2">
                    <span className="text-sm leading-relaxed whitespace-pre-wrap break-words">{messageContent}</span>
                    <span className="flex items-center gap-0.5 flex-shrink-0 self-end">
                      <span className="text-[10px] text-[#8696a0]">{formatMessageTime(msg.timestamp)}</span>
                      <StatusIcon status={msg.status} isFromMe={isFromMe} />
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {/* Typing indicator bubble */}
        {isTyping && (
          <div className="flex mb-1 justify-start">
            <div className="bg-[#202c33] rounded-lg px-4 py-2.5 shadow-sm">
              <div className="flex items-center gap-1.5">
                <span className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-[#8696a0] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-1.5 h-1.5 bg-[#8696a0] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-1.5 h-1.5 bg-[#8696a0] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="relative">
        {/* Emoji Picker Popup */}
        {emojiPickerOpen && (
          <div className="absolute bottom-full left-0 mb-2 bg-[#202c33] border border-[#2a3942] rounded-xl shadow-2xl p-3 w-[320px] z-50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[#8696a0] text-xs font-medium">Emojis</span>
              <Button variant="ghost" size="icon" onClick={() => setEmojiPickerOpen(false)} className="text-[#8696a0] hover:bg-[#2a3942] h-6 w-6">
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
            <div className="space-y-1.5">
              {EMOJI_ROWS.map((row, rowIdx) => (
                <div key={rowIdx} className="flex gap-0.5">
                  {row.map((emoji, emojiIdx) => (
                    <button
                      key={emojiIdx}
                      onClick={() => {
                        setInputText(prev => prev + emoji);
                        inputRef.current?.focus();
                      }}
                      className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#2a3942] text-lg transition-colors cursor-pointer"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {isRecording ? (
          /* Recording UI */
          <div className="flex items-center gap-3 px-4 py-2.5 bg-[#202c33]">
            <div className="flex items-center gap-2 flex-1">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
              <span className="text-[#e9edef] text-sm font-medium">
                Recording 0:{recordingSeconds < 10 ? `0${recordingSeconds}` : recordingSeconds}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => stopRecording()}
              className="bg-red-600 hover:bg-red-700 text-white h-8 px-4 rounded-full gap-2"
            >
              <StopCircle className="w-4 h-4" />
              Stop
            </Button>
          </div>
        ) : (
          /* Normal Input UI */
          <div className="flex items-center gap-2 px-4 py-2.5 bg-[#202c33]">
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={() => setEmojiPickerOpen(prev => !prev)} className="text-[#8696a0] hover:bg-[#2a3942] h-8 w-8">
                <Smile className="w-5 h-5" />
              </Button>

              {/* Paperclip / Attach Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-[#8696a0] hover:bg-[#2a3942] h-8 w-8">
                    <Paperclip className="w-5 h-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-[#233138] border-[#2a3942] text-[#e9edef] min-w-[220px]" align="start" side="top">
                  <DropdownMenuItem className="focus:bg-[#182229] focus:text-[#e9edef] cursor-pointer gap-3" onClick={() => onSendMessage('[📷 Photo]')}>
                    <Camera className="w-4 h-4" />
                    Photos &amp; Videos
                  </DropdownMenuItem>
                  <DropdownMenuItem className="focus:bg-[#182229] focus:text-[#e9edef] cursor-pointer gap-3" onClick={() => onSendMessage('[📄 Document]')}>
                    <FileText className="w-4 h-4" />
                    Document
                  </DropdownMenuItem>
                  <DropdownMenuItem className="focus:bg-[#182229] focus:text-[#e9edef] cursor-pointer gap-3" onClick={() => onSendMessage('[📍 Location shared]')}>
                    <MapPin className="w-4 h-4" />
                    Location
                  </DropdownMenuItem>
                  <DropdownMenuItem className="focus:bg-[#182229] focus:text-[#e9edef] cursor-pointer gap-3" onClick={() => onSendMessage('[👤 Contact shared]')}>
                    <UserPlus className="w-4 h-4" />
                    Contact
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="flex-1 relative">
              <Input
                ref={inputRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Type a message"
                className="bg-[#2a3942] border-none text-[#e9edef] placeholder:text-[#8696a0] rounded-lg h-10 text-sm focus-visible:ring-[#25D366]"
              />
            </div>
            <div className="flex items-center gap-1">
              {inputText.trim() ? (
                <Button variant="ghost" size="icon" onClick={handleSend} className="text-[#25D366] hover:bg-[#2a3942] h-8 w-8">
                  <Send className="w-5 h-5" />
                </Button>
              ) : (
                <Button variant="ghost" size="icon" onClick={startRecording} className="text-[#8696a0] hover:bg-[#2a3942] h-8 w-8">
                  <Mic className="w-5 h-5" />
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
