'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Brain, Sparkles, Send, Loader2, BarChart, TrendingDown, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export default function AILeadershipAdvisor() {
  const [query, setQuery] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [response, setResponse] = useState<null | {
    query: string
    rootCause: string
    trends: string
    risks: string
    actions: string[]
  }>(null)

  const handleAsk = async () => {
    if (!query.trim()) return
    setIsTyping(true)
    setResponse(null)
    
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          sessionId: `leadership-advisor-${Date.now()}`,
          language: 'en',
        }),
      })
      
      if (res.ok) {
        const data = await res.json()
        const reply = data.response || data.reply || ''
        setResponse({
          query,
          rootCause: reply || 'No data available.',
          trends: 'No data available.',
          risks: 'No data available.',
          actions: reply ? [reply] : [],
        })
      } else {
        setResponse({
          query,
          rootCause: 'No data available.',
          trends: 'No data available.',
          risks: 'No data available.',
          actions: [],
        })
      }
    } catch {
      setResponse({
        query,
        rootCause: 'No data available.',
        trends: 'No data available.',
        risks: 'No data available.',
        actions: [],
      })
    }
    
    setIsTyping(false)
    setQuery('')
  }

  return (
    <Card className="border border-brand-200 shadow-sm bg-gradient-to-br from-card to-brand-50/20 overflow-hidden relative mb-6">
      <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/5 rounded-full blur-[60px] pointer-events-none" />
      
      <CardHeader className="px-6 py-4 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-brand-100 border-2 border-brand-500 flex items-center justify-center relative z-10">
            <Brain className="w-5 h-5 text-brand-600" />
            <div className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-uae-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-uae-green-500" />
            </div>
          </div>
          <div>
            <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              AI Leadership Advisor
              <Badge variant="outline" className="bg-brand-50 text-brand-700 border-brand-200 text-[10px] uppercase">Beta</Badge>
            </CardTitle>
            <CardDescription className="text-xs">Ask natural language questions about ministry operations</CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6">
        {/* Input Area */}
        <div className="relative mb-6">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            <Sparkles className="h-4 w-4 text-brand-400" />
          </div>
          <Input 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
            placeholder="e.g., Why did customer satisfaction decline in Dubai this month?"
            className="pl-9 pr-12 py-6 text-sm bg-white dark:bg-base-900 border-brand-200 focus-visible:ring-brand-500 shadow-inner rounded-xl"
            disabled={isTyping}
          />
          <Button 
            size="sm" 
            className="absolute right-2 top-2 h-8 w-8 p-0 rounded-lg bg-brand-600 hover:bg-brand-700 text-white"
            onClick={handleAsk}
            disabled={!query.trim() || isTyping}
          >
            {isTyping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 ml-0.5" />}
          </Button>
        </div>

        {/* Suggested Prompts */}
        {!response && !isTyping && (
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="bg-base-100 hover:bg-brand-50 hover:text-brand-700 cursor-pointer font-normal text-xs" onClick={() => setQuery("What is causing the spike in WhatsApp escalations today?")}>
              What is causing the spike in WhatsApp escalations today?
            </Badge>
            <Badge variant="secondary" className="bg-base-100 hover:bg-brand-50 hover:text-brand-700 cursor-pointer font-normal text-xs" onClick={() => setQuery("Are we adequately staffed for the predicted volume tomorrow?")}>
              Are we adequately staffed for the predicted volume tomorrow?
            </Badge>
          </div>
        )}

        {/* AI Typing Indicator */}
        <AnimatePresence>
          {isTyping && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }} 
              animate={{ opacity: 1, height: 'auto' }} 
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-3 text-sm text-muted-foreground p-4 bg-brand-50/50 rounded-xl border border-brand-100"
            >
              <Loader2 className="h-4 w-4 text-brand-600 animate-spin" />
              <span>Analyzing millions of interactions and generating root cause analysis...</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* AI Response Report */}
        <AnimatePresence>
          {response && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }}
              className="mt-2 bg-white dark:bg-base-900 border border-brand-200 rounded-xl overflow-hidden shadow-sm"
            >
              <div className="bg-brand-50/50 dark:bg-brand-950/20 px-4 py-3 border-b border-brand-100">
                <p className="text-xs text-muted-foreground font-medium">Analysis for:</p>
                <p className="text-sm font-semibold text-brand-900 dark:text-brand-100 mt-0.5">"{response.query}"</p>
              </div>
              
              <div className="p-5 space-y-5">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-uae-red-50 flex items-center justify-center shrink-0 mt-0.5">
                    <AlertTriangle className="w-4 h-4 text-uae-red-600" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-foreground uppercase tracking-wider mb-1">Root Cause Analysis</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">{response.rootCause}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-start gap-3 p-3 bg-base-50 rounded-lg">
                    <TrendingDown className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                    <div>
                      <h4 className="text-[10px] font-bold text-foreground uppercase tracking-wider mb-1">Trends</h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">{response.trends}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-uae-red-50/50 rounded-lg">
                    <BarChart className="w-4 h-4 text-uae-red-500 mt-0.5 shrink-0" />
                    <div>
                      <h4 className="text-[10px] font-bold text-foreground uppercase tracking-wider mb-1">Risks</h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">{response.risks}</p>
                    </div>
                  </div>
                </div>

                <div className="border-t border-base-100 pt-4">
                  <h4 className="text-xs font-bold text-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-uae-green-600" /> Recommended Actions
                  </h4>
                  <ul className="space-y-2">
                    {response.actions.map((action, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-brand-100 text-brand-700 text-[10px] font-bold shrink-0">{idx + 1}</span>
                        <span className="text-sm text-foreground">{action}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  )
}
