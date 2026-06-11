'use client';

/* ───────────────────────────────────────────────────────────────
   MOEI Country Intelligence Platform – Markdown Content Renderer
   Renders markdown text with proper typography and styling.
   Used for all AI-generated text: analysis, insights, reports,
   executive summary, risks, opportunities, chat, etc.
   ─────────────────────────────────────────────────────────────── */

import ReactMarkdown from 'react-markdown';

interface MarkdownContentProps {
  content: string;
  className?: string;
  size?: 'sm' | 'base';
}

/**
 * Renders markdown content with MOEI-branded typography.
 * - Bold text → font-bold
 * - Headers → section titles with accent bars
 * - Lists → proper bullet/numbered styling
 * - Links → teal colored with underline
 * - Inline code → monospace with background
 */
export default function MarkdownContent({
  content,
  className = '',
  size = 'base',
}: MarkdownContentProps) {
  const baseClass = size === 'sm'
    ? 'markdown-content markdown-content-sm'
    : 'markdown-content';

  return (
    <div className={`${baseClass} ${className}`}>
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}
