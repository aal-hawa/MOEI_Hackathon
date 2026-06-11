'use client'

import React, { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Paperclip,
  Send,
  Smile,
  FileText,
  ImageIcon,
  MapPin,
  User,
  ChevronDown,
  X,
} from 'lucide-react'
import type { WhatsAppTemplate } from '@/worker/whatsapp/types'

// Mock templates
const mockTemplates: WhatsAppTemplate[] = [
  {
    id: 'tpl-welcome',
    name: 'welcome_message',
    category: 'UTILITY',
    language: 'en',
    status: 'APPROVED',
    body: 'Hi {{1}}, welcome to our service! How can we help you today?',
    header: 'Welcome!',
    footer: 'Reply with HELP for assistance',
    parameters: [
      { type: 'text', placeholder: '{{1}}', example: 'Sarah' },
    ],
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
  },
  {
    id: 'tpl-order-update',
    name: 'order_update',
    category: 'UTILITY',
    language: 'en',
    status: 'APPROVED',
    body: 'Your order #{{1}} has been {{2}}. Expected delivery: {{3}}.',
    header: 'Order Update',
    footer: 'Track your order at example.com',
    parameters: [
      { type: 'text', placeholder: '{{1}}', example: '2847' },
      { type: 'text', placeholder: '{{2}}', example: 'shipped' },
      { type: 'text', placeholder: '{{3}}', example: 'March 15, 2025' },
    ],
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 25).toISOString(),
  },
  {
    id: 'tpl-promo',
    name: 'seasonal_promo',
    category: 'MARKETING',
    language: 'en',
    status: 'APPROVED',
    body: '🎉 Special offer! Get {{1}}% off on {{2}}. Use code {{3}} at checkout. Valid until {{4}}.',
    header: 'Exclusive Deal!',
    parameters: [
      { type: 'text', placeholder: '{{1}}', example: '25' },
      { type: 'text', placeholder: '{{2}}', example: 'all premium plans' },
      { type: 'text', placeholder: '{{3}}', example: 'SAVE25' },
      { type: 'text', placeholder: '{{4}}', example: 'March 31, 2025' },
    ],
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 20).toISOString(),
  },
  {
    id: 'tpl-verify',
    name: 'verification_code',
    category: 'AUTHENTICATION',
    language: 'en',
    status: 'APPROVED',
    body: 'Your verification code is {{1}}. This code expires in {{2}} minutes.',
    parameters: [
      { type: 'text', placeholder: '{{1}}', example: '123456' },
      { type: 'text', placeholder: '{{2}}', example: '10' },
    ],
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15).toISOString(),
  },
]

interface MessageInputProps {
  onSendMessage?: (text: string, isTemplate?: boolean, templateId?: string) => void
  templates?: WhatsAppTemplate[]
  disabled?: boolean
}

export function MessageInput({
  onSendMessage,
  templates = mockTemplates,
  disabled = false,
}: MessageInputProps) {
  const [message, setMessage] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<WhatsAppTemplate | null>(null)
  const [templateParams, setTemplateParams] = useState<Record<string, string>>({})
  const [showTemplateSelector, setShowTemplateSelector] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const approvedTemplates = templates.filter((t) => t.status === 'APPROVED')

  const handleSend = useCallback(() => {
    if (selectedTemplate) {
      // Send template message
      let body = selectedTemplate.body
      for (const [key, value] of Object.entries(templateParams)) {
        body = body.replace(`{{${parseInt(key) + 1}}}`, value || `{{${parseInt(key) + 1}}}`)
      }
      onSendMessage?.(body, true, selectedTemplate.id)
      setSelectedTemplate(null)
      setTemplateParams({})
    } else if (message.trim()) {
      onSendMessage?.(message.trim())
      setMessage('')
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    }
  }, [message, selectedTemplate, templateParams, onSendMessage])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value)
    // Auto-resize
    const textarea = e.target
    textarea.style.height = 'auto'
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px'
  }

  const selectTemplate = (template: WhatsAppTemplate) => {
    setSelectedTemplate(template)
    setTemplateParams({})
    setShowTemplateSelector(false)
  }

  const cancelTemplate = () => {
    setSelectedTemplate(null)
    setTemplateParams({})
  }

  const getTemplatePreview = () => {
    if (!selectedTemplate) return ''
    let body = selectedTemplate.body
    for (const [key, value] of Object.entries(templateParams)) {
      body = body.replace(`{{${parseInt(key) + 1}}}`, value || selectedTemplate.parameters?.[parseInt(key)]?.placeholder || `{{${parseInt(key) + 1}}}`)
    }
    return body
  }

  return (
    <div className="bg-[#f0f2f5] border-t border-gray-200">
      {/* Template selector indicator */}
      {selectedTemplate && (
        <div className="px-4 pt-2">
          <div className="bg-white rounded-lg p-3 border border-[#128C7E]/20">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <FileText className="size-4 text-[#128C7E]" />
                <span className="text-sm font-medium text-[#128C7E]">
                  {selectedTemplate.name}
                </span>
                <Badge
                  variant="outline"
                  className="text-[10px] px-1 py-0 h-4 border-[#128C7E]/30 text-[#128C7E]"
                >
                  {selectedTemplate.category}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-6 text-gray-400 hover:text-gray-600"
                onClick={cancelTemplate}
              >
                <X className="size-3.5" />
              </Button>
            </div>

            {/* Template parameters */}
            {selectedTemplate.parameters && selectedTemplate.parameters.length > 0 && (
              <div className="space-y-2 mb-2">
                {selectedTemplate.parameters.map((param, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <label className="text-xs text-gray-500 w-16 shrink-0">
                      {param.placeholder}:
                    </label>
                    <input
                      type="text"
                      placeholder={param.example}
                      value={templateParams[idx.toString()] || ''}
                      onChange={(e) =>
                        setTemplateParams((prev) => ({
                          ...prev,
                          [idx.toString()]: e.target.value,
                        }))
                      }
                      className="flex-1 text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-[#25D366]"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Preview */}
            <div className="text-xs text-gray-500 bg-gray-50 rounded p-2 mt-1">
              <span className="font-medium">Preview:</span>{' '}
              {getTemplatePreview()}
            </div>
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="flex items-end gap-2 px-4 py-2">
        {/* Emoji button */}
        <Button
          variant="ghost"
          size="icon"
          className="text-gray-500 hover:text-gray-700 shrink-0"
          disabled={disabled}
        >
          <Smile className="size-6" />
        </Button>

        {/* Attachment button */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-gray-500 hover:text-gray-700 shrink-0"
              disabled={disabled}
            >
              <Paperclip className="size-6" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" className="w-48">
            <DropdownMenuLabel className="text-xs text-gray-500">
              Attach
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <ImageIcon className="size-4 mr-2 text-[#128C7E]" />
              Photos & Videos
            </DropdownMenuItem>
            <DropdownMenuItem>
              <FileText className="size-4 mr-2 text-[#075E54]" />
              Document
            </DropdownMenuItem>
            <DropdownMenuItem>
              <MapPin className="size-4 mr-2 text-[#25D366]" />
              Location
            </DropdownMenuItem>
            <DropdownMenuItem>
              <User className="size-4 mr-2 text-[#128C7E]" />
              Contact
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Text input */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={selectedTemplate ? getTemplatePreview() : message}
            onChange={selectedTemplate ? undefined : handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder={selectedTemplate ? 'Template message (fill parameters above)' : 'Type a message'}
            disabled={disabled || !!selectedTemplate}
            rows={1}
            className="w-full bg-white rounded-lg px-4 py-2.5 text-sm resize-none outline-none focus:ring-1 focus:ring-[#25D366]/30 disabled:bg-gray-50 disabled:text-gray-500 max-h-[120px] overflow-y-auto"
          />
        </div>

        {/* Template selector */}
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="text-gray-500 hover:text-gray-700 shrink-0"
            disabled={disabled}
            onClick={() => setShowTemplateSelector(!showTemplateSelector)}
          >
            <FileText className="size-5" />
            <ChevronDown className="size-3 absolute -bottom-0.5 -right-0.5" />
          </Button>

          {showTemplateSelector && (
            <div className="absolute bottom-full right-0 mb-2 w-72 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-80 overflow-y-auto">
              <div className="p-2 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700">
                  Message Templates
                </h3>
                <p className="text-xs text-gray-400">
                  Select an approved template
                </p>
              </div>
              <div className="p-1">
                {approvedTemplates.length === 0 ? (
                  <div className="p-4 text-center text-sm text-gray-400">
                    No approved templates
                  </div>
                ) : (
                  approvedTemplates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => selectTemplate(template)}
                      className="w-full text-left p-2.5 rounded-md hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-gray-800">
                          {template.name}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[9px] px-1 py-0 h-3.5 ${
                            template.category === 'MARKETING'
                              ? 'border-amber-300 text-amber-600'
                              : template.category === 'AUTHENTICATION'
                              ? 'border-blue-300 text-blue-600'
                              : 'border-gray-300 text-gray-600'
                          }`}
                        >
                          {template.category}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-500 truncate">
                        {template.body}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Send / Voice button */}
        <Button
          variant="ghost"
          size="icon"
          className={`shrink-0 ${
            message.trim() || selectedTemplate
              ? 'text-[#075E54] hover:text-[#128C7E]'
              : 'text-gray-500'
          }`}
          onClick={handleSend}
          disabled={disabled || (!message.trim() && !selectedTemplate)}
        >
          <Send className="size-6" />
        </Button>
      </div>
    </div>
  )
}
