'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, Clock, XCircle, AlertCircle, Search, FileText, Eye, Copy } from 'lucide-react';
import type { WhatsAppTemplate } from '@/worker/whatsapp/types';

interface TemplateManagerProps {
  templates: WhatsAppTemplate[];
}

const categoryColors: Record<string, string> = {
  MARKETING: 'bg-amber-500/20 text-amber-400',
  UTILITY: 'bg-emerald-500/20 text-emerald-400',
  AUTHENTICATION: 'bg-cyan-500/20 text-cyan-400',
};

const statusConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  APPROVED: { icon: CheckCircle, color: 'text-emerald-400', label: 'Approved' },
  PENDING: { icon: Clock, color: 'text-amber-400', label: 'Pending' },
  REJECTED: { icon: XCircle, color: 'text-red-400', label: 'Rejected' },
  DISABLED: { icon: AlertCircle, color: 'text-gray-400', label: 'Disabled' },
};

export function TemplateManager({ templates }: TemplateManagerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [previewTemplate, setPreviewTemplate] = useState<WhatsAppTemplate | null>(null);

  const filteredTemplates = templates.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.body.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || t.category === categoryFilter;
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const stats = {
    total: templates.length,
    approved: templates.filter(t => t.status === 'APPROVED').length,
    pending: templates.filter(t => t.status === 'PENDING').length,
    rejected: templates.filter(t => t.status === 'REJECTED').length,
  };

  return (
    <div className="flex flex-col h-full">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-2 px-3 py-3">
        <div className="bg-[#202c33] rounded-lg p-2 text-center">
          <div className="text-[#e9edef] text-lg font-semibold">{stats.total}</div>
          <div className="text-[#8696a0] text-[10px]">Total</div>
        </div>
        <div className="bg-[#202c33] rounded-lg p-2 text-center">
          <div className="text-emerald-400 text-lg font-semibold">{stats.approved}</div>
          <div className="text-[#8696a0] text-[10px]">Approved</div>
        </div>
        <div className="bg-[#202c33] rounded-lg p-2 text-center">
          <div className="text-amber-400 text-lg font-semibold">{stats.pending}</div>
          <div className="text-[#8696a0] text-[10px]">Pending</div>
        </div>
        <div className="bg-[#202c33] rounded-lg p-2 text-center">
          <div className="text-red-400 text-lg font-semibold">{stats.rejected}</div>
          <div className="text-[#8696a0] text-[10px]">Rejected</div>
        </div>
      </div>

      {/* Filters */}
      <div className="px-3 py-2 space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8696a0]" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates..."
            className="bg-[#202c33] border-none text-[#e9edef] placeholder:text-[#8696a0] rounded-lg pl-9 h-8 text-sm focus-visible:ring-[#25D366]"
          />
        </div>
        <div className="flex gap-2">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="bg-[#202c33] border-none text-[#e9edef] h-8 text-xs w-full focus:ring-[#25D366]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent className="bg-[#233138] border-[#2a3942]">
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="MARKETING">Marketing</SelectItem>
              <SelectItem value="UTILITY">Utility</SelectItem>
              <SelectItem value="AUTHENTICATION">Authentication</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="bg-[#202c33] border-none text-[#e9edef] h-8 text-xs w-full focus:ring-[#25D366]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-[#233138] border-[#2a3942]">
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Template List */}
      <ScrollArea className="flex-1">
        <div className="px-3 py-2 space-y-2">
          {filteredTemplates.map(template => {
            const statusInfo = statusConfig[template.status] || statusConfig.PENDING;
            const StatusIcon = statusInfo.icon;

            return (
              <div
                key={template.id}
                className="bg-[#202c33] rounded-lg p-3 hover:bg-[#2a3942] transition-colors cursor-pointer"
                onClick={() => setPreviewTemplate(previewTemplate?.id === template.id ? null : template)}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#25D366]" />
                    <span className="text-[#e9edef] text-sm font-medium">{template.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <StatusIcon className={`w-3.5 h-3.5 ${statusInfo.color}`} />
                    <span className={`text-[10px] ${statusInfo.color}`}>{statusInfo.label}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Badge className={`${categoryColors[template.category]} text-[10px] px-1.5 py-0 h-4 font-medium border-none`}>
                    {template.category}
                  </Badge>
                  <span className="text-[#8696a0] text-[10px]">{template.language.toUpperCase()}</span>
                </div>

                {previewTemplate?.id === template.id && (
                  <div className="mt-2 pt-2 border-t border-[#2a3942]">
                    {template.header && (
                      <div className="text-[#e9edef] text-sm font-medium mb-1">{template.header}</div>
                    )}
                    <p className="text-[#8696a0] text-xs leading-relaxed mb-2">{template.body}</p>
                    {template.footer && (
                      <p className="text-[#8696a0] text-[10px] mt-1">{template.footer}</p>
                    )}
                    {template.parameters && template.parameters.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <span className="text-[#8696a0] text-[10px] font-medium">Parameters:</span>
                        {template.parameters.map((param, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-[10px]">
                            <span className="text-amber-400 font-mono">{param.placeholder}</span>
                            <span className="text-[#8696a0]">→</span>
                            <span className="text-[#e9edef]">{param.example}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" className="bg-[#25D366] hover:bg-[#1ebe57] text-white h-7 text-xs">
                        Use Template
                      </Button>
                      <Button variant="ghost" size="sm" className="text-[#8696a0] h-7 text-xs hover:bg-[#2a3942]">
                        <Copy className="w-3 h-3 mr-1" />
                        Copy
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
