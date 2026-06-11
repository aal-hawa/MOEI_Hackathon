'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Pin, Volume2, VolumeX, PinOff, Trash2, Archive, BellOff, Bell } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { WhatsAppConversation } from '@/worker/whatsapp/types';

interface ContactListProps {
  conversations: WhatsAppConversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onTogglePin?: (id: string) => void;
  onToggleMute?: (id: string) => void;
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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

const myPhone = '+971501234567';

export function ContactList({ conversations, selectedId, onSelect, onTogglePin, onToggleMute }: ContactListProps) {
  const { toast } = useToast();

  return (
    <ScrollArea className="flex-1">
      <div className="flex flex-col">
        {conversations.map((conv) => {
          const isFromMe = conv.lastMessage?.from === myPhone;

          return (
            <ContextMenu key={conv.id}>
              <ContextMenuTrigger asChild>
                <button
                  onClick={() => onSelect(conv.id)}
                  className={`flex items-center gap-3 px-3 py-3 hover:bg-[#2a3942] transition-colors w-full text-left ${
                    selectedId === conv.id ? 'bg-[#2a3942]' : ''
                  }`}
                >
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    <Avatar className="w-12 h-12">
                      <AvatarFallback className={`${getAvatarColor(conv.contact.name)} text-white font-medium text-sm`}>
                        {getInitials(conv.contact.name)}
                      </AvatarFallback>
                    </Avatar>
                    {conv.contact.isOnline && (
                      <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-[#25D366] rounded-full border-2 border-[#111b21]" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[#e9edef] font-medium text-[15px] truncate">
                        {conv.contact.name}
                      </span>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {conv.isPinned && <Pin className="w-3 h-3 text-[#8696a0]" />}
                        {conv.isMuted && <Volume2 className="w-3 h-3 text-[#8696a0]" />}
                        <span className={`text-xs ${conv.unreadCount > 0 ? 'text-[#25D366]' : 'text-[#8696a0]'}`}>
                          {formatTime(conv.updatedAt)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <div className="flex items-center gap-1 min-w-0">
                        {isFromMe && (
                          <svg className={`w-4 h-4 flex-shrink-0 ${
                            conv.lastMessage?.status === 'read' ? 'text-[#53bdeb]' :
                            conv.lastMessage?.status === 'delivered' ? 'text-[#53bdeb]' :
                            'text-[#8696a0]'
                          }`} fill="currentColor" viewBox="0 0 24 24">
                            <path d="M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM.41 13.41L6 19l1.41-1.41L1.83 12 .41 13.41z"/>
                          </svg>
                        )}
                        <span className="text-[#8696a0] text-sm truncate">
                          {conv.lastMessage?.text || ''}
                        </span>
                      </div>
                      {conv.unreadCount > 0 && (
                        <span className="bg-[#25D366] text-white text-xs font-medium rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5 flex-shrink-0">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              </ContextMenuTrigger>
              <ContextMenuContent className="bg-[#233138] border-[#2a3942] text-[#e9edef] min-w-[180px]">
                <ContextMenuItem
                  className="focus:bg-[#2a3942] focus:text-[#e9edef] cursor-pointer"
                  onClick={() => onTogglePin?.(conv.id)}
                >
                  {conv.isPinned ? (
                    <>
                      <PinOff className="w-4 h-4 mr-2 text-[#8696a0]" />
                      Unpin chat
                    </>
                  ) : (
                    <>
                      <Pin className="w-4 h-4 mr-2 text-[#8696a0]" />
                      Pin chat
                    </>
                  )}
                </ContextMenuItem>
                <ContextMenuItem
                  className="focus:bg-[#2a3942] focus:text-[#e9edef] cursor-pointer"
                  onClick={() => onToggleMute?.(conv.id)}
                >
                  {conv.isMuted ? (
                    <>
                      <Bell className="w-4 h-4 mr-2 text-[#8696a0]" />
                      Unmute notifications
                    </>
                  ) : (
                    <>
                      <BellOff className="w-4 h-4 mr-2 text-[#8696a0]" />
                      Mute notifications
                    </>
                  )}
                </ContextMenuItem>
                <ContextMenuSeparator className="bg-[#2a3942]" />
                <ContextMenuItem
                  className="focus:bg-[#2a3942] focus:text-[#e9edef] cursor-pointer"
                  onClick={() => toast({ title: 'Archive coming soon' })}
                >
                  <Archive className="w-4 h-4 mr-2 text-[#8696a0]" />
                  Archive chat
                </ContextMenuItem>
                <ContextMenuItem
                  className="focus:bg-[#2a3942] focus:text-red-400 cursor-pointer"
                  onClick={() => toast({ title: 'Delete coming soon' })}
                >
                  <Trash2 className="w-4 h-4 mr-2 text-red-400" />
                  Delete chat
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          );
        })}
      </div>
    </ScrollArea>
  );
}
