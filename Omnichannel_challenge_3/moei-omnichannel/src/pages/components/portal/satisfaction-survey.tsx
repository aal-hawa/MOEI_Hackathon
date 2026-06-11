'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Star,
  MessageSquare,
  X,
  Loader2,
  CheckCircle2,
  PartyPopper,
} from 'lucide-react'
import { useTranslation } from '@/i18n'
import { useAppStore } from '@/store/app-store'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'

// ─── Types ───────────────────────────────────────────────────────────────────

interface CategoryRating {
  speed: number
  quality: number
  friendliness: number
  resolution: number
}

type SurveyState = 'idle' | 'rating' | 'submitting' | 'submitted'

// ─── Confetti Effect ────────────────────────────────────────────────────────

function ConfettiEffect({ active }: { active: boolean }) {
  if (!active) return null

  const particles = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 0.5,
    color: ['#0D9488', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#3B82F6'][i % 6],
    size: 4 + Math.random() * 6,
  }))

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-50">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ y: -20, x: `${p.x}%`, opacity: 1, scale: 1 }}
          animate={{ y: '120%', opacity: 0, scale: 0.5, rotate: 720 }}
          transition={{ duration: 1.5 + Math.random(), delay: p.delay, ease: 'easeOut' }}
          className="absolute rounded-sm"
          style={{
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            left: `${p.x}%`,
          }}
        />
      ))}
    </div>
  )
}

// ─── Star Rating Component ──────────────────────────────────────────────────

function StarRating({
  value,
  onChange,
  size = 'md',
}: {
  value: number
  onChange: (v: number) => void
  size?: 'sm' | 'md' | 'lg'
}) {
  const [hover, setHover] = useState(0)
  const sizeClasses = { sm: 'w-5 h-5', md: 'w-7 h-7', lg: 'w-9 h-9' }
  const emojiMap: Record<number, string> = { 1: '😞', 2: '😕', 3: '😐', 4: '🙂', 5: '😊' }

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(star)}
          className="transition-transform hover:scale-110"
        >
          <Star
            className={`${sizeClasses[size]} ${
              star <= (hover || value)
                ? 'fill-amber-400 text-amber-400'
                : 'text-base-200'
            }`}
          />
        </button>
      ))}
      {(hover || value) > 0 && (
        <motion.span
          key={hover || value}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-lg ml-2"
        >
          {emojiMap[hover || value]}
        </motion.span>
      )}
    </div>
  )
}

// ─── Category Rating Row ────────────────────────────────────────────────────

function CategoryRow({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="text-sm font-medium text-base-800 min-w-[100px]">{label}</span>
      <StarRating value={value} onChange={onChange} size="sm" />
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function SatisfactionSurvey() {
  const { t, isRTL } = useTranslation()
  const { customerContext, chatOpen } = useAppStore()

  const [surveyState, setSurveyState] = useState<SurveyState>('idle')
  const [overallRating, setOverallRating] = useState(0)
  const [categories, setCategories] = useState<CategoryRating>({
    speed: 0,
    quality: 0,
    friendliness: 0,
    resolution: 0,
  })
  const [comment, setComment] = useState('')
  const [showConfetti, setShowConfetti] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  const handleCategoryChange = useCallback((key: keyof CategoryRating, value: number) => {
    setCategories((prev) => ({ ...prev, [key]: value }))
  }, [])

  const handleSubmit = useCallback(async () => {
    if (overallRating === 0) return

    setSurveyState('submitting')

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: customerContext?.id || null,
          rating: overallRating,
          categories: {
            speed: categories.speed,
            quality: categories.quality,
            friendliness: categories.friendliness,
            resolution: categories.resolution,
          },
          comment: comment.trim() || undefined,
          channel: 'web',
        }),
      })

      if (res.ok) {
        setSurveyState('submitted')
        if (overallRating === 5) {
          setShowConfetti(true)
          setTimeout(() => setShowConfetti(false), 3000)
        }
      } else {
        setSurveyState('rating')
      }
    } catch {
      setSurveyState('rating')
    }
  }, [overallRating, categories, comment, customerContext])

  const handleReset = useCallback(() => {
    setSurveyState('idle')
    setOverallRating(0)
    setCategories({ speed: 0, quality: 0, friendliness: 0, resolution: 0 })
    setComment('')
    setIsOpen(false)
  }, [])

  // ─── Floating button (hidden when chat widget is open) ──────────
  if (!isOpen && surveyState !== 'submitted') {
    // Don't show the survey button when the chat widget is open to prevent overlap
    if (chatOpen) return null
    return (
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => { setIsOpen(true); setSurveyState('rating') }}
        className={`fixed bottom-6 ${isRTL ? 'right-6' : 'left-6'} z-30 bg-gradient-to-r from-[#C5A55A] to-[#B08E3A] text-[#1B2A4A] px-4 py-3 rounded-xl shadow-[0_0_15px_rgba(197,165,90,0.5)] hover:shadow-[0_0_25px_rgba(197,165,90,0.7)] transition-all flex items-center gap-2`}
      >
        <Star className="w-4 h-4 fill-[#1B2A4A] text-[#1B2A4A]" />
        <span className="text-sm font-medium">{t('surveyFloatingButton')}</span>
      </motion.button>
    )
  }

  // ─── Survey panel ────────────────────────────────────────────────
  return (
    <>
      <ConfettiEffect active={showConfetti} />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        className={`fixed bottom-20 ${isRTL ? 'right-4' : 'left-4'} z-30 w-80 bg-white dark:bg-[#0F1724] rounded-2xl shadow-2xl border border-[#C5A55A]/20 overflow-hidden ${isRTL ? 'rtl font-arabic' : ''}`}
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-[#1B2A4A] to-[#263C5C] p-4 relative">
          <button
            onClick={handleReset}
            className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-white" />
          </button>
          <h3 className="text-white font-semibold text-base">{t('surveyTitle')}</h3>
          <p className="text-white/70 text-xs mt-0.5">{t('surveyDesc')}</p>
        </div>

        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
          <AnimatePresence mode="wait">
            {surveyState === 'rating' && (
              <motion.div
                key="rating"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                {/* Overall rating */}
                <div className="text-center">
                  <p className="text-sm font-semibold text-base-900 mb-3">{t('surveyRatePrompt')}</p>
                  <div className="flex justify-center">
                    <StarRating value={overallRating} onChange={setOverallRating} size="lg" />
                  </div>
                </div>

                {/* Category ratings */}
                {overallRating > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-1"
                  >
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      {t('surveyCategoryPrompt')}
                    </p>
                    <CategoryRow label={t('surveySpeed')} value={categories.speed} onChange={(v) => handleCategoryChange('speed', v)} />
                    <CategoryRow label={t('surveyQuality')} value={categories.quality} onChange={(v) => handleCategoryChange('quality', v)} />
                    <CategoryRow label={t('surveyFriendliness')} value={categories.friendliness} onChange={(v) => handleCategoryChange('friendliness', v)} />
                    <CategoryRow label={t('surveyResolution')} value={categories.resolution} onChange={(v) => handleCategoryChange('resolution', v)} />
                  </motion.div>
                )}

                {/* Comment */}
                {overallRating > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-xs font-medium text-muted-foreground">{t('surveyCommentPlaceholder').slice(0, 20)}...</p>
                      <Badge variant="outline" className="text-[9px]">{t('surveyOptional')}</Badge>
                    </div>
                    <Textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder={t('surveyCommentPlaceholder')}
                      className="text-xs min-h-[60px] resize-none"
                    />
                  </motion.div>
                )}

                {/* Submit */}
                <Button
                  className="w-full bg-brand-600 hover:bg-brand-700 text-white h-10"
                  disabled={overallRating === 0 || surveyState === 'submitting'}
                  onClick={handleSubmit}
                >
                  {surveyState === 'submitting' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      {t('surveySubmitting')}
                    </>
                  ) : (
                    <>
                      <MessageSquare className="w-4 h-4 mr-2" />
                      {t('surveySubmit')}
                    </>
                  )}
                </Button>
              </motion.div>
            )}

            {surveyState === 'submitted' && (
              <motion.div
                key="submitted"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-4"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
                  className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3"
                >
                  {overallRating === 5 ? (
                    <PartyPopper className="w-7 h-7 text-emerald-600" />
                  ) : (
                    <CheckCircle2 className="w-7 h-7 text-emerald-600" />
                  )}
                </motion.div>
                <h4 className="text-base font-bold text-emerald-800 mb-1">{t('surveySubmitted')}</h4>
                <p className="text-xs text-muted-foreground">{t('surveySubmittedDesc')}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 text-xs"
                  onClick={handleReset}
                >
                  {t('close')}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </>
  )
}
