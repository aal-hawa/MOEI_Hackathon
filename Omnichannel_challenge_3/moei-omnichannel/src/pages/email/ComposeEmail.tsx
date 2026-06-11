'use client';

import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft, Send, Paperclip, ImageIcon, Link, Smile,
  Bold, Italic, Underline, AlignLeft, List, ListOrdered,
  MoreHorizontal, Clock, Trash2, Save, FileQuestion, X,
} from 'lucide-react';

interface ComposeEmailProps {
  initialTo?: string;
  initialSubject?: string;
  initialBody?: string;
  onBack: () => void;
  onSend: (to: string, subject: string, body: string) => void;
}

const EMOJI_ROWS = [
  ['😀', '😂', '🥹', '😊', '😍', '🥰', '😘', '😜', '🤪', '😎', '🤓', '🧐'],
  ['👍', '👎', '👏', '🙌', '🤝', '✌️', '🤞', '💪', '❤️', '🔥', '⭐', '✨'],
  ['🎉', '🎊', '💯', '✅', '❌', '⚡', '💡', '📌', '📎', '🔗', '💬', '🙏'],
];

export function ComposeEmail({ initialTo, initialSubject, initialBody, onBack, onSend }: ComposeEmailProps) {
  const { toast } = useToast();
  const [to, setTo] = useState(initialTo || '');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [subject, setSubject] = useState(initialSubject || '');
  const [body, setBody] = useState(initialBody || '');
  const [showCc, setShowCc] = useState(false);
  const [priority, setPriority] = useState('normal');
  const [attachments, setAttachments] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cursorPosRef = useRef<number>(0);

  // Helper to insert text at the cursor position in the body textarea
  const insertAtCursor = useCallback(
    (before: string, after: string = '') => {
      const textarea = textareaRef.current;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = body.substring(start, end);
        const newText =
          body.substring(0, start) + before + (selectedText || '') + after + body.substring(end);
        setBody(newText);
        // Set cursor position after the inserted text
        const newCursorPos = start + before.length + (selectedText || '').length + after.length;
        cursorPosRef.current = newCursorPos;
        // Use setTimeout to set selection after React re-renders
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(newCursorPos, newCursorPos);
        }, 0);
      } else {
        // Fallback: append to the end
        setBody(body + before + after);
      }
    },
    [body],
  );

  const handleSend = () => {
    if (!to.trim()) {
      toast({ title: 'Missing recipient', description: 'Please enter a recipient email address', variant: 'destructive', duration: 3000 });
      return;
    }
    if (!subject.trim()) {
      toast({ title: 'Missing subject', description: 'Please enter a subject', variant: 'destructive', duration: 3000 });
      return;
    }

    setSending(true);
    // Simulate network delay
    setTimeout(() => {
      onSend(to.trim(), subject.trim(), body.trim() || '(No content)');
      setSending(false);
    }, 500);
  };

  const handleInsertEmoji = (emoji: string) => {
    insertAtCursor(emoji);
    setShowEmoji(false);
  };

  return (
    <div className="flex flex-col h-full bg-background relative">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8 text-muted-foreground">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <span className="font-medium text-foreground">New Message</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            onClick={() => toast({ title: 'Schedule send coming soon', duration: 3000 })}
          >
            <Clock className="w-4 h-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => toast({ title: 'Draft saved', duration: 3000 })}>
                <Save className="w-4 h-4 mr-2" />
                Save as draft
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onBack}>
                <Trash2 className="w-4 h-4 mr-2" />
                Discard
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast({ title: 'Read receipt requested', duration: 3000 })}>
                <FileQuestion className="w-4 h-4 mr-2" />
                Request read receipt
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            onClick={handleSend}
            disabled={sending || !to.trim() || !subject.trim()}
            className="bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white h-8 px-4 shadow-sm disabled:opacity-50"
          >
            <Send className="w-4 h-4 mr-1.5" />
            {sending ? 'Sending...' : 'Send'}
          </Button>
        </div>
      </div>

      {/* Form Fields */}
      <div className="flex-1 overflow-y-auto">
        <div className="divide-y divide-border">
          {/* To */}
          <div className="flex items-center gap-2 px-4 py-2">
            <span className="text-sm text-muted-foreground w-10 flex-shrink-0">To</span>
            <Input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipients"
              className="border-none h-8 text-sm focus-visible:ring-0 px-0 shadow-none"
            />
            <button onClick={() => setShowCc(!showCc)} className="text-xs text-rose-500 hover:text-rose-600 flex-shrink-0">
              {showCc ? 'Hide CC' : 'CC / BCC'}
            </button>
          </div>

          {/* CC */}
          {showCc && (
            <>
              <div className="flex items-center gap-2 px-4 py-2">
                <span className="text-sm text-muted-foreground w-10 flex-shrink-0">Cc</span>
                <Input
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
                  placeholder="cc recipients"
                  className="border-none h-8 text-sm focus-visible:ring-0 px-0 shadow-none"
                />
              </div>
              <div className="flex items-center gap-2 px-4 py-2">
                <span className="text-sm text-muted-foreground w-10 flex-shrink-0">Bcc</span>
                <Input
                  value={bcc}
                  onChange={(e) => setBcc(e.target.value)}
                  placeholder="bcc recipients"
                  className="border-none h-8 text-sm focus-visible:ring-0 px-0 shadow-none"
                />
              </div>
            </>
          )}

          {/* Subject */}
          <div className="flex items-center gap-2 px-4 py-2">
            <span className="text-sm text-muted-foreground w-10 flex-shrink-0">Subject</span>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              className="border-none h-8 text-sm focus-visible:ring-0 px-0 shadow-none font-medium"
            />
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="w-24 h-7 text-xs border-none bg-muted/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">🔴 High</SelectItem>
                <SelectItem value="normal">⚪ Normal</SelectItem>
                <SelectItem value="low">🔵 Low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Attachments */}
          {attachments.length > 0 && (
            <div className="px-4 py-2">
              <div className="flex flex-wrap gap-2">
                {attachments.map((att, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-1.5">
                    <Paperclip className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs text-foreground">{att}</span>
                    <button onClick={() => setAttachments(attachments.filter((_, i) => i !== idx))}>
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Body */}
          <div className="px-4 py-3 min-h-[300px]">
            <Textarea
              ref={textareaRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your message..."
              className="border-none h-full min-h-[300px] text-sm leading-relaxed resize-none focus-visible:ring-0 px-0 shadow-none"
            />
          </div>
        </div>
      </div>

      {/* Emoji Popup */}
      {showEmoji && (
        <div className="absolute bottom-14 left-4 z-50 bg-popover border border-border rounded-lg shadow-lg p-3 w-72">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground">Emojis</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 text-muted-foreground hover:text-foreground"
              onClick={() => setShowEmoji(false)}
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div className="space-y-1.5">
            {EMOJI_ROWS.map((row, rowIdx) => (
              <div key={rowIdx} className="flex gap-1">
                {row.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleInsertEmoji(emoji)}
                    className="w-6 h-6 flex items-center justify-center rounded text-base hover:bg-muted transition-colors"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Formatting Toolbar */}
      <div className="flex items-center gap-1 px-4 py-2 border-t border-border bg-muted/30">
        <div className="flex items-center gap-0.5 mr-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => insertAtCursor('**', '**')}
          >
            <Bold className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => insertAtCursor('*', '*')}
          >
            <Italic className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => insertAtCursor('__', '__')}
          >
            <Underline className="w-4 h-4" />
          </Button>
        </div>
        <Separator orientation="vertical" className="h-4" />
        <div className="flex items-center gap-0.5 mx-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => toast({ title: 'Text alignment coming soon', duration: 3000 })}
          >
            <AlignLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => insertAtCursor('\n• ')}
          >
            <List className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => insertAtCursor('\n1. ')}
          >
            <ListOrdered className="w-4 h-4" />
          </Button>
        </div>
        <Separator orientation="vertical" className="h-4" />
        <div className="flex items-center gap-0.5 mx-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setAttachments([...attachments, `document_${attachments.length + 1}.pdf`])}
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
          >
            <Paperclip className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => setAttachments([...attachments, `image_${attachments.length + 1}.png`])}
          >
            <ImageIcon className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => insertAtCursor('[link text](', 'url)')}
          >
            <Link className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => setShowEmoji(!showEmoji)}
          >
            <Smile className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={onBack}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
