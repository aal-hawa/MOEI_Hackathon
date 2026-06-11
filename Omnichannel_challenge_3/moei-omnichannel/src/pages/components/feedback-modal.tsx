'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Star, ThumbsUp, ThumbsDown, MessageSquare, Send } from 'lucide-react'
import { useTranslation } from '@/i18n'
import { motion } from 'framer-motion'

interface FeedbackModalProps {
  open: boolean
  onClose: () => void
  caseRef?: string
  channel?: string
  onSubmit?: (rating: number, comment: string, category: string) => void
}

export function FeedbackModal({ open, onClose, caseRef, channel = 'web', onSubmit }: FeedbackModalProps) {
  const { t } = useTranslation()
  const [rating, setRating] = useState(0)
  const [hoveredRating, setHoveredRating] = useState(0)
  const [comment, setComment] = useState('')
  const [category, setCategory] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = () => {
    if (rating === 0) return
    onSubmit?.(rating, comment, category)
    setSubmitted(true)
    setTimeout(() => {
      setRating(0)
      setComment('')
      setCategory('')
      setSubmitted(false)
      onClose()
    }, 2000)
  }

  const categories = [
    { key: 'speed', label: t('feedbackSpeed') || 'Response Speed', icon: '⚡' },
    { key: 'accuracy', label: t('feedbackAccuracy') || 'Accuracy', icon: '🎯' },
    { key: 'friendliness', label: t('feedbackFriendliness') || 'Friendliness', icon: '😊' },
    { key: 'resolution', label: t('feedbackResolution') || 'Issue Resolution', icon: '✅' },
  ]

  if (submitted) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center py-8 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              className="w-16 h-16 rounded-full bg-uae-green-50 flex items-center justify-center mb-4"
            >
              <ThumbsUp className="w-8 h-8 text-uae-green-600" />
            </motion.div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {t('feedbackThankYou') || 'Thank You!'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t('feedbackThankYouDesc') || 'Your feedback helps us improve our services.'}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-brand-600" />
            {t('feedbackTitle') || 'Rate Your Experience'}
          </DialogTitle>
          <DialogDescription>
            {caseRef
              ? (t('feedbackCaseRef') || 'Case {ref}').replace('{ref}', caseRef)
              : (t('feedbackDesc') || 'Help us improve by sharing your experience')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Star Rating */}
          <div className="flex flex-col items-center gap-3">
            <p className="text-sm font-medium text-foreground">{t('feedbackRating') || 'How would you rate your experience?'}</p>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <motion.button
                  key={star}
                  whileHover={{ scale: 1.2 }}
                  whileTap={{ scale: 0.9 }}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  onClick={() => setRating(star)}
                  className="focus:outline-none"
                >
                  <Star
                    className={`w-8 h-8 transition-colors ${
                      star <= (hoveredRating || rating)
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-muted-foreground/30'
                    }`}
                  />
                </motion.button>
              ))}
            </div>
            {rating > 0 && (
              <motion.p
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-muted-foreground"
              >
                {rating <= 2
                  ? t('feedbackSorry') || 'We\'re sorry to hear that'
                  : rating <= 3
                    ? t('feedbackFair') || 'We can do better'
                    : rating <= 4
                      ? t('feedbackGood') || 'Good experience'
                      : t('feedbackExcellent') || 'Excellent!'}
              </motion.p>
            )}
          </div>

          {/* Category Selection */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">{t('feedbackCategory') || 'What aspect are you rating?'}</p>
            <div className="grid grid-cols-2 gap-2">
              {categories.map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => setCategory(cat.key)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    category === cat.key
                      ? 'bg-brand-50 text-brand-700 ring-2 ring-brand-200'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span className="truncate">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Comment */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">{t('feedbackComment') || 'Additional Comments'}</p>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t('feedbackCommentPlaceholder') || 'Tell us more about your experience...'}
              rows={3}
              className="resize-none"
            />
          </div>

          {/* Quick Feedback */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setRating(Math.max(rating, 1)); setCategory(category || 'speed'); handleSubmit() }}
              className="gap-1.5 flex-1"
              disabled={rating === 0}
            >
              <ThumbsUp className="w-3.5 h-3.5" />
              {t('feedbackQuickPositive') || 'Quick Thumbs Up'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setRating(Math.min(rating, 2)); setCategory(category || 'speed'); handleSubmit() }}
              className="gap-1.5 flex-1"
              disabled={rating === 0}
            >
              <ThumbsDown className="w-3.5 h-3.5" />
              {t('feedbackQuickNegative') || 'Needs Improvement'}
            </Button>
          </div>

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            className="w-full gap-2"
            disabled={rating === 0}
          >
            <Send className="w-4 h-4" />
            {t('feedbackSubmit') || 'Submit Feedback'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
