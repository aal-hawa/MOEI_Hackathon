'use client';

import { useState, useCallback } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Star, Paperclip, ChevronDown, RefreshCw, MoreHorizontal, Trash2, Archive, MailCheck, CheckCheck, ArrowDownNarrowWide, ArrowUpNarrowWide } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import type { EmailMessage } from '@/worker/email/types';

interface InboxViewProps {
  emails: EmailMessage[];
  selectedEmailId: string | null;
  onSelectEmail: (id: string) => void;
  onToggleStar: (id: string) => void;
  onDeleteEmail: (id: string) => void;
  onArchiveEmails?: (ids: string[]) => void;
  onMarkAllRead?: () => void;
  folderName: string;
}

const avatarColors = [
  'from-rose-500 to-pink-500',
  'from-emerald-500 to-teal-500',
  'from-amber-500 to-orange-500',
  'from-cyan-500 to-blue-500',
  'from-violet-500 to-purple-500',
  'from-lime-500 to-green-500',
];

function getAvatarGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function formatEmailTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const priorityConfig: Record<string, { label: string; className: string }> = {
  high: { label: 'High', className: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400' },
  normal: { label: '', className: '' },
  low: { label: 'Low', className: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' },
};

export function InboxView({
  emails,
  selectedEmailId,
  onSelectEmail,
  onToggleStar,
  onDeleteEmail,
  onArchiveEmails,
  onMarkAllRead,
  folderName,
}: InboxViewProps) {
  const [selectedEmailIds, setSelectedEmailIds] = useState<Set<string>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const unreadCount = emails.filter(e => !e.isRead).length;

  // Determine master checkbox state
  const allSelected = emails.length > 0 && selectedEmailIds.size === emails.length;
  const someSelected = selectedEmailIds.size > 0 && !allSelected;
  const masterCheckedState: boolean | 'indeterminate' = allSelected ? true : someSelected ? 'indeterminate' : false;

  const handleToggleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelectedEmailIds(new Set());
    } else {
      setSelectedEmailIds(new Set(emails.map(e => e.id)));
    }
  }, [allSelected, emails]);

  const handleToggleSelect = useCallback((emailId: string) => {
    setSelectedEmailIds(prev => {
      const next = new Set(prev);
      if (next.has(emailId)) {
        next.delete(emailId);
      } else {
        next.add(emailId);
      }
      return next;
    });
  }, []);

  const handleRefresh = useCallback(() => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    toast({ title: 'Refreshing...' });
    setTimeout(() => {
      toast({ title: 'Up to date' });
      setIsRefreshing(false);
    }, 1000);
  }, [isRefreshing]);

  const handleSelectAllFromMenu = useCallback(() => {
    setSelectedEmailIds(new Set(emails.map(e => e.id)));
  }, [emails]);

  const handleDeleteSelected = useCallback(() => {
    selectedEmailIds.forEach(id => onDeleteEmail(id));
    setSelectedEmailIds(new Set());
  }, [selectedEmailIds, onDeleteEmail]);

  const handleArchiveSelected = useCallback(() => {
    if (onArchiveEmails) {
      onArchiveEmails(Array.from(selectedEmailIds));
    }
    setSelectedEmailIds(new Set());
  }, [selectedEmailIds, onArchiveEmails]);

  const handlePaginationClick = useCallback(() => {
    toast({ title: 'All emails shown' });
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-background">
        <div className="flex items-center gap-2">
          <Checkbox
            className="border-muted-foreground"
            checked={masterCheckedState}
            onCheckedChange={handleToggleSelectAll}
            aria-label="Select all emails"
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground"
            onClick={handleRefresh}
            disabled={isRefreshing}
            aria-label="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} style={isRefreshing ? { animationDuration: '1s' } : undefined} />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" aria-label="More options">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={onMarkAllRead}>
                <MailCheck className="w-4 h-4" />
                Mark all as read
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleSelectAllFromMenu}>
                <CheckCheck className="w-4 h-4" />
                Select all
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => toast({ title: 'Sorted by newest' })}>
                <ArrowDownNarrowWide className="w-4 h-4" />
                Sort by newest
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast({ title: 'Sorted by oldest' })}>
                <ArrowUpNarrowWide className="w-4 h-4" />
                Sort by oldest
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All read'}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground"
            onClick={handlePaginationClick}
          >
            1-{emails.length} of {emails.length}
            <ChevronDown className="w-3 h-3 ml-1" />
          </Button>
        </div>
      </div>

      {/* Selected actions bar */}
      {selectedEmailIds.size > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-muted/40">
          <span className="text-xs text-muted-foreground font-medium">
            {selectedEmailIds.size} selected
          </span>
          <div className="flex items-center gap-1 ml-auto">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-destructive hover:text-destructive"
              onClick={handleDeleteSelected}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              Delete selected ({selectedEmailIds.size})
            </Button>
            {onArchiveEmails && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground"
                onClick={handleArchiveSelected}
              >
                <Archive className="w-3.5 h-3.5 mr-1" />
                Archive selected ({selectedEmailIds.size})
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Email List */}
      <ScrollArea className="flex-1">
        {emails.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <svg className="w-24 h-24 opacity-20 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <p className="text-sm">No emails in {folderName}</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {emails.map(email => (
              <div
                key={email.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectEmail(email.id)}
                onKeyDown={(e) => { if (e.key === 'Enter') onSelectEmail(email.id); }}
                className={`flex items-start gap-3 px-4 py-3 w-full text-left transition-colors hover:bg-muted/30 cursor-pointer ${
                  selectedEmailId === email.id ? 'bg-rose-50 dark:bg-rose-500/5' : ''
                } ${!email.isRead ? 'bg-muted/20' : ''}`}
              >
                {/* Checkbox & Star */}
                <div className="flex flex-col items-center gap-1 pt-1 flex-shrink-0">
                  <Checkbox
                    className="border-muted-foreground"
                    checked={selectedEmailIds.has(email.id)}
                    onCheckedChange={() => handleToggleSelect(email.id)}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Select email from ${email.from.name}`}
                  />
                  <button
                    onClick={(e) => { e.stopPropagation(); onToggleStar(email.id); }}
                    className="p-0.5 hover:scale-125 transition-transform"
                    aria-label={email.isStarred ? 'Unstar email' : 'Star email'}
                  >
                    <Star className={`w-3.5 h-3.5 ${email.isStarred ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/40 hover:text-muted-foreground'}`} />
                  </button>
                </div>

                {/* Avatar */}
                <Avatar className="w-9 h-9 mt-0.5 flex-shrink-0">
                  <AvatarFallback className={`bg-gradient-to-br ${getAvatarGradient(email.from.name)} text-white text-xs font-medium`}>
                    {getInitials(email.from.name)}
                  </AvatarFallback>
                </Avatar>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-sm truncate ${!email.isRead ? 'font-semibold text-foreground' : 'text-foreground/80'}`}>
                        {email.from.name}
                      </span>
                      {email.priority === 'high' && (
                        <Badge className={`${priorityConfig.high.className} text-[9px] px-1.5 py-0 h-4 border-none`}>
                          !
                        </Badge>
                      )}
                    </div>
                    <span className={`text-xs flex-shrink-0 ${!email.isRead ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                      {formatEmailTime(email.timestamp)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`text-sm truncate ${!email.isRead ? 'font-medium text-foreground' : 'text-foreground/70'}`}>
                      {email.subject}
                    </span>
                    {email.isDraft && (
                      <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5">DRAFT</Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground truncate flex-1">
                      {email.body.split('\n')[0].slice(0, 80)}...
                    </span>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {email.hasAttachments && (
                        <Paperclip className="w-3 h-3 text-muted-foreground" />
                      )}
                      {email.labels && email.labels.length > 0 && email.labels.map(label => (
                        <Badge key={label} variant="secondary" className="text-[9px] px-1 py-0 h-3.5 bg-muted">
                          {label}
                        </Badge>
                      ))}
                      <button
                        onClick={(e) => { e.stopPropagation(); onDeleteEmail(email.id); }}
                        className="p-0.5 text-muted-foreground/40 hover:text-destructive transition-colors"
                        aria-label="Delete email"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
