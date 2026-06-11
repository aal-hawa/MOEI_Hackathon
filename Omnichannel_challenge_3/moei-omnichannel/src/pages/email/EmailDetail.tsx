'use client';

import React, { useState } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import {
  ArrowLeft, Reply, ReplyAll, Forward, Star, Archive,
  Trash2, MoreHorizontal, Paperclip, Download,
  Printer, FolderOpen, Tag, Clock, Shield, AlertCircle,
  MailX, MoveRight,
} from 'lucide-react';
import type { EmailMessage } from '@/worker/email/types';

interface EmailDetailProps {
  email: EmailMessage;
  onBack: () => void;
  onReply: () => void;
  onForward: () => void;
  onToggleStar: () => void;
  onDelete: () => void;
  onArchive: () => void;
  onReplyAll?: () => void;
  onMoveToFolder?: (folder: string) => void;
  onAddLabel?: (label: string) => void;
  onMarkUnread?: () => void;
}

const FOLDER_OPTIONS = [
  { value: 'inbox', label: 'Inbox' },
  { value: 'sent', label: 'Sent' },
  { value: 'drafts', label: 'Drafts' },
  { value: 'archive', label: 'Archive' },
  { value: 'spam', label: 'Spam' },
  { value: 'trash', label: 'Trash' },
];

const LABEL_OPTIONS = ['Customers', 'Partners', 'Internal', 'Urgent'];

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

function formatFullDate(timestamp: string): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

const priorityConfig: Record<string, { label: string; className: string; icon: React.ElementType }> = {
  high: { label: 'High Priority', className: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400', icon: AlertCircle },
  normal: { label: '', className: '', icon: Shield },
  low: { label: 'Low Priority', className: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400', icon: Clock },
};

export function EmailDetail({
  email,
  onBack,
  onReply,
  onForward,
  onToggleStar,
  onDelete,
  onArchive,
  onReplyAll,
  onMoveToFolder,
  onAddLabel,
  onMarkUnread,
}: EmailDetailProps) {
  const priorityInfo = priorityConfig[email.priority || 'normal'];

  const handleToggleStar = () => {
    onToggleStar();
  };

  const handleDelete = () => {
    onDelete();
  };

  const handleArchive = () => {
    onArchive();
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8 text-muted-foreground">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleArchive} className="h-8 w-8 text-muted-foreground">
            <Archive className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleDelete} className="h-8 w-8 text-muted-foreground hover:text-destructive">
            <Trash2 className="w-4 h-4" />
          </Button>

          {/* Move to Folder */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                <FolderOpen className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {FOLDER_OPTIONS.map(folder => (
                <DropdownMenuItem
                  key={folder.value}
                  onClick={() => onMoveToFolder?.(folder.value)}
                  disabled={email.folder === folder.value}
                >
                  <MoveRight className="w-4 h-4 mr-2" />
                  {folder.label}
                  {email.folder === folder.value && (
                    <span className="ml-auto text-xs text-muted-foreground">(current)</span>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Add Label */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                <Tag className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {LABEL_OPTIONS.map(label => {
                const isActive = email.labels?.includes(label);
                return (
                  <DropdownMenuItem
                    key={label}
                    onClick={() => onAddLabel?.(label)}
                  >
                    <Tag className={`w-4 h-4 mr-2 ${isActive ? 'text-rose-500' : ''}`} />
                    {label}
                    {isActive && (
                      <span className="ml-auto text-xs text-rose-500">✓</span>
                    )}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex items-center gap-1">
          {onMarkUnread && (
            <Button variant="ghost" size="icon" onClick={onMarkUnread} className="h-8 w-8 text-muted-foreground" title="Mark as unread">
              <MailX className="w-4 h-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => { /* Print not implemented */ }}>
            <Printer className="w-4 h-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onMarkUnread}>
                <MailX className="w-4 h-4 mr-2" />
                Mark as unread
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleArchive}>
                <Archive className="w-4 h-4 mr-2" />
                Archive
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDelete}>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="px-6 py-4">
          {/* Subject & Star */}
          <div className="flex items-start justify-between gap-4 mb-4">
            <h2 className="text-xl font-semibold text-foreground leading-tight">
              {email.isDraft && <Badge variant="secondary" className="mr-2 text-xs">DRAFT</Badge>}
              {email.subject}
            </h2>
            <button onClick={handleToggleStar} className="p-1 hover:scale-125 transition-transform flex-shrink-0 mt-1">
              <Star className={`w-5 h-5 ${email.isStarred ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/40 hover:text-muted-foreground'}`} />
            </button>
          </div>

          {/* Priority */}
          {email.priority && email.priority !== 'normal' && (
            <div className="mb-3">
              <Badge className={`${priorityInfo.className} text-xs border-none`}>
                {React.createElement(priorityInfo.icon, { className: 'w-3 h-3 mr-1' })}
                {priorityInfo.label}
              </Badge>
            </div>
          )}

          {/* Sender Info */}
          <div className="flex items-start gap-3 mb-4">
            <Avatar className="w-10 h-10 flex-shrink-0">
              <AvatarFallback className={`bg-gradient-to-br ${getAvatarGradient(email.from.name)} text-white text-sm font-medium`}>
                {getInitials(email.from.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="font-medium text-foreground">{email.from.name}</span>
                  <span className="text-muted-foreground text-sm ml-2">&lt;{email.from.email}&gt;</span>
                </div>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {formatFullDate(email.timestamp)}
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                to {email.to.map(t => t.name || t.email).join(', ')}
                {email.cc && email.cc.length > 0 && (
                  <span>, cc {email.cc.map(c => c.name || c.email).join(', ')}</span>
                )}
              </div>
              {email.labels && email.labels.length > 0 && (
                <div className="flex gap-1 mt-1.5">
                  {email.labels.map(label => (
                    <Badge key={label} variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                      <Tag className="w-2.5 h-2.5 mr-0.5" />
                      {label}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          <Separator className="mb-4" />

          {/* Body */}
          <div className="text-foreground text-sm leading-relaxed whitespace-pre-wrap mb-6">
            {email.body}
          </div>

          {/* Attachments */}
          {email.hasAttachments && email.attachments && email.attachments.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <Paperclip className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">
                  {email.attachments.length} attachment{email.attachments.length > 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {email.attachments.map(att => (
                  <div key={att.id} className="flex items-center gap-3 bg-muted/50 rounded-lg px-3 py-2 border border-border hover:bg-muted/80 transition-colors cursor-pointer">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-rose-500/20 to-pink-500/20 flex items-center justify-center">
                      <Paperclip className="w-5 h-5 text-rose-500" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-foreground">{att.filename}</div>
                      <div className="text-xs text-muted-foreground">{formatFileSize(att.size)}</div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                      <Download className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Separator className="mb-4" />

          {/* Reply Section */}
          <div className="flex items-center gap-2">
            <Button onClick={onReply} variant="outline" className="flex-1 h-9 text-sm">
              <Reply className="w-4 h-4 mr-2" />
              Reply
            </Button>
            <Button onClick={onReplyAll || (() => {})} variant="outline" className="flex-1 h-9 text-sm">
              <ReplyAll className="w-4 h-4 mr-2" />
              Reply All
            </Button>
            <Button onClick={onForward} variant="outline" className="flex-1 h-9 text-sm">
              <Forward className="w-4 h-4 mr-2" />
              Forward
            </Button>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
