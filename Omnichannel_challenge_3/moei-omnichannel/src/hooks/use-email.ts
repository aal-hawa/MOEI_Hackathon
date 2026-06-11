'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { EmailMessage, EmailFolder } from '@/worker/email/types';

const MY_EMAIL = 'business@z.ai';

export function useEmail() {
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [folders, setFolders] = useState<EmailFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const socketRef = useRef<null>(null); // Socket.IO removed — no fake data service
  const currentFolderRef = useRef<string>('inbox');
  const currentLabelRef = useRef<string | null>(null);

  // NOTE: Socket.IO connection removed — all data now comes from the
  // worker REST API via polling (use-realtime.ts). No fake data service.

  // Load initial data
  useEffect(() => {
    async function loadData() {
      try {
        const [emailsRes, foldersRes] = await Promise.all([
          fetch('/api/email?action=emails&folder=inbox'),
          fetch('/api/email?action=folders'),
        ]);
        const emailsJson = await emailsRes.json();
        const foldersJson = await foldersRes.json();

        if (emailsJson.success) setEmails(emailsJson.data);
        if (foldersJson.success) setFolders(foldersJson.data);
      } catch (err) {
        console.error('Failed to load email data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Refresh folders
  const refreshFolders = useCallback(async () => {
    try {
      const res = await fetch('/api/email?action=folders');
      const json = await res.json();
      if (json.success) setFolders(json.data);
    } catch {
      // silently fail
    }
  }, []);

  // Load emails for a specific folder
  const loadEmails = useCallback(async (folder: string, label?: string | null, search?: string) => {
    setLoading(true);
    currentFolderRef.current = folder;
    currentLabelRef.current = label || null;
    try {
      const params = new URLSearchParams({ action: 'emails' });
      if (folder && folder !== 'all') params.set('folder', folder);
      if (label) params.set('label', label);
      if (search) params.set('search', search);

      const res = await fetch(`/api/email?${params}`);
      const json = await res.json();
      if (json.success) setEmails(json.data);
    } catch (err) {
      console.error('Failed to load emails:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Send email
  const sendEmail = useCallback(async (data: {
    to: string; subject: string; body: string;
    cc?: string; bcc?: string; priority?: string;
    attachments?: string[]; scheduledAt?: string;
  }) => {
    try {
      const res = await fetch('/api/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send', ...data }),
      });
      const json = await res.json();
      if (json.success) {
        // Add sent email to list if currently viewing sent or all
        const folder = currentFolderRef.current;
        if (folder === 'sent' || folder === 'all') {
          setEmails(prev => [json.data, ...prev]);
        }
        await refreshFolders();
      }
      return json;
    } catch (err) {
      console.error('Failed to send email:', err);
      return { success: false, error: 'Failed to send email' };
    }
  }, [refreshFolders]);

  // Save draft
  const saveDraft = useCallback(async (data: {
    to: string; subject: string; body: string;
    cc?: string; bcc?: string; priority?: string;
    attachments?: string[];
  }) => {
    try {
      const res = await fetch('/api/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save-draft', ...data }),
      });
      const json = await res.json();
      if (json.success) {
        // Add draft to list if currently viewing drafts
        const folder = currentFolderRef.current;
        if (folder === 'drafts' || folder === 'all') {
          setEmails(prev => [json.data, ...prev]);
        }
        await refreshFolders();
      }
      return json;
    } catch (err) {
      console.error('Failed to save draft:', err);
      return { success: false, error: 'Failed to save draft' };
    }
  }, [refreshFolders]);

  // Update email
  const updateEmail = useCallback(async (id: string, updates: {
    isRead?: boolean; isStarred?: boolean; folder?: string; labels?: string[];
  }) => {
    try {
      const res = await fetch('/api/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', id, ...updates }),
      });
      const json = await res.json();
      if (json.success) {
        // Update the email in the local list
        setEmails(prev => {
          const updated = prev.map(e => e.id === id ? { ...e, ...updates } : e);
          // If folder changed and the email was moved out of current view, remove it
          if (updates.folder) {
            const currentFolder = currentFolderRef.current;
            const currentLabel = currentLabelRef.current;
            const movedEmail = updated.find(e => e.id === id);
            if (movedEmail) {
              let shouldRemove = false;
              if (currentFolder === 'starred' && !movedEmail.isStarred) shouldRemove = true;
              else if (currentFolder !== 'starred' && currentFolder !== 'all' && movedEmail.folder !== currentFolder) shouldRemove = true;
              if (currentLabel && !movedEmail.labels?.includes(currentLabel)) shouldRemove = true;
              if (shouldRemove) return updated.filter(e => e.id !== id);
            }
          }
          return updated;
        });
        await refreshFolders();
      }
      return json;
    } catch (err) {
      console.error('Failed to update email:', err);
      return { success: false, error: 'Failed to update email' };
    }
  }, [refreshFolders]);

  // Delete email (move to trash)
  const deleteEmail = useCallback(async (id: string) => {
    try {
      const res = await fetch('/api/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id }),
      });
      const json = await res.json();
      if (json.success) {
        // Remove from current view or update folder
        setEmails(prev => {
          const currentFolder = currentFolderRef.current;
          if (currentFolder === 'trash') {
            // In trash view, show the updated email
            return prev.map(e => e.id === id ? { ...e, folder: 'trash' } : e);
          }
          // In other views, remove it since it moved to trash
          return prev.filter(e => e.id !== id);
        });
        await refreshFolders();
      }
      return json;
    } catch (err) {
      console.error('Failed to delete email:', err);
      return { success: false, error: 'Failed to delete email' };
    }
  }, [refreshFolders]);

  return {
    emails, folders, loading,
    loadEmails, sendEmail, saveDraft, updateEmail, deleteEmail, refreshFolders,
  };
}
