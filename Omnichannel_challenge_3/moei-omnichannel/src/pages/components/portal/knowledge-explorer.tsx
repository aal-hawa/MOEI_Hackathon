'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  BookOpen,
  ChevronRight,
  Clock,
  Sparkles,
  ArrowLeft,
  X,
  ThumbsUp,
  ThumbsDown,
  Zap,
  Home,
  Flame,
  Building2,
  Monitor,
  Droplets,
  Loader2,
  Star,
  ChevronDown,
} from 'lucide-react'
import { useTranslation } from '@/i18n'
import { useAppStore } from '@/store/app-store'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

// ─── Types ───────────────────────────────────────────────────────────────────

interface KnowledgeArticle {
  id: string
  title: string
  content: string
  category: string
  tags: string[]
  featured?: boolean
}

interface CategoryInfo {
  key: string
  name: string
  icon: React.ElementType
  color: string
  bgColor: string
}

// ─── Category configuration ──────────────────────────────────────────────────

const categoryDefinitions: CategoryInfo[] = [
  { key: 'Electricity & Water', name: 'Electricity & Water', icon: Zap, color: 'text-amber-600', bgColor: 'bg-amber-50' },
  { key: 'Housing', name: 'Housing', icon: Home, color: 'text-brand-600', bgColor: 'bg-brand-50' },
  { key: 'Petroleum & Energy', name: 'Petroleum & Energy', icon: Flame, color: 'text-orange-600', bgColor: 'bg-orange-50' },
  { key: 'Transport', name: 'Transport', icon: Building2, color: 'text-sky-600', bgColor: 'bg-sky-50' },
  { key: 'Digital', name: 'Digital Services', icon: Monitor, color: 'text-purple-600', bgColor: 'bg-purple-50' },
  { key: 'Sustainability', name: 'Sustainability', icon: Droplets, color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
]

// ─── Auto-suggest terms ────────────────────────────────────────────────────

const SUGGESTIONS = [
  'Electricity connection', 'Water supply', 'Housing loan', 'Power outage',
  'Renewable energy', 'Construction permit', 'Fuel station', 'UAE PASS',
  'Energy strategy 2050', 'Bill payment', 'Complaint procedure',
]

// ─── Animation variants ─────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: 'easeOut' as const },
  }),
}

const stagger = {
  visible: { transition: { staggerChildren: 0.06 } },
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function KnowledgeExplorer() {
  const { t, isRTL, language } = useTranslation()
  const setChatOpen = useAppStore((s) => s.setChatOpen)

  const [articles, setArticles] = useState<KnowledgeArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedArticle, setSelectedArticle] = useState<KnowledgeArticle | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [helpfulArticleId, setHelpfulArticleId] = useState<string | null>(null)
  const [helpfulVote, setHelpfulVote] = useState<'yes' | 'no' | null>(null)

  // Fetch articles from /api/knowledge
  const fetchArticles = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (searchQuery) params.set('search', searchQuery)
      if (selectedCategory) params.set('category', selectedCategory)
      params.set('lang', language)

      const res = await fetch(`/api/knowledge?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setArticles(Array.isArray(data) ? data : [])
      } else {
        setArticles([])
      }
    } catch {
      setArticles([])
    } finally {
      setLoading(false)
    }
  }, [searchQuery, selectedCategory, language])

  useEffect(() => {
    fetchArticles()
  }, [fetchArticles])

  // Filter suggestions based on query
  const filteredSuggestions = useMemo(() => {
    if (!searchQuery.trim()) return []
    return SUGGESTIONS.filter((s) =>
      s.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 5)
  }, [searchQuery])

  // Group articles by category
  const groupedByCategory = articles.reduce<Record<string, KnowledgeArticle[]>>((acc, article) => {
    const cat = article.category || 'General Services'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(article)
    return acc
  }, {})

  // Featured articles
  const featuredArticles = useMemo(() => {
    return articles.filter((a) => a.featured || a.tags?.includes('featured')).slice(0, 3)
  }, [articles])

  // If no featured flag, pick first 3
  const displayFeatured = featuredArticles.length > 0 ? featuredArticles : articles.slice(0, 3)

  // Get category info
  const getCategoryInfo = (catKey: string): CategoryInfo => {
    return categoryDefinitions.find((c) => c.key === catKey) || {
      key: catKey,
      name: catKey,
      icon: BookOpen,
      color: 'text-gray-600',
      bgColor: 'bg-gray-50',
    }
  }

  // Estimate reading time
  const getReadingTime = (content: string): number => {
    const words = content.split(/\s+/).length
    return Math.max(1, Math.ceil(words / 200))
  }

  // Handle article click
  const handleArticleClick = (article: KnowledgeArticle) => {
    setSelectedArticle(article)
    setDetailOpen(true)
    setHelpfulVote(null)
  }

  // Handle "Ask AI" button
  const handleAskAI = (article: KnowledgeArticle) => {
    setChatOpen(true)
    setDetailOpen(false)
  }

  // Handle category selection
  const handleCategorySelect = (cat: string) => {
    if (selectedCategory === cat) {
      setSelectedCategory(null)
    } else {
      setSelectedCategory(cat)
    }
  }

  // Filter articles
  const filteredArticles = searchQuery
    ? articles.filter(
        (a) =>
          a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          a.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          a.category?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : selectedCategory
      ? articles.filter((a) => a.category === selectedCategory)
      : articles

  // All unique categories
  const allCategories = Array.from(new Set(articles.map((a) => a.category || 'General Services')))

  // Get related articles (same category, different article)
  const getRelatedArticles = (article: KnowledgeArticle): KnowledgeArticle[] => {
    return articles
      .filter((a) => a.category === article.category && a.id !== article.id)
      .slice(0, 3)
  }

  return (
    <div className={`w-full ${isRTL ? 'rtl font-arabic' : ''}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex flex-col lg:flex-row gap-6">
        {/* ── Left Sidebar: Category Tree ────────────────────────────────── */}
        <div className="lg:w-72 flex-shrink-0">
          <Card className="border-0 shadow-sm bg-white sticky top-4">
            <CardContent className="p-4">
              {/* Search bar with auto-suggest */}
              <div className="relative mb-4">
                <Search className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground ${isRTL ? 'right-3' : 'left-3'}`} />
                <Input
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setShowSuggestions(true) }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  placeholder={t('searchKnowledge')}
                  className={`h-9 text-sm ${isRTL ? 'pr-9 pl-3' : 'pl-9 pr-3'}`}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className={`absolute top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground ${isRTL ? 'left-3' : 'right-3'}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                {/* Auto-suggest dropdown */}
                <AnimatePresence>
                  {showSuggestions && filteredSuggestions.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-base-200 z-50 overflow-hidden"
                    >
                      {filteredSuggestions.map((suggestion) => (
                        <button
                          key={suggestion}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-brand-50 border-b border-base-50 last:border-0 transition-colors flex items-center gap-2"
                          onMouseDown={() => { setSearchQuery(suggestion); setShowSuggestions(false) }}
                        >
                          <Search className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                          <span className="text-foreground">{suggestion}</span>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                {t('categories')}
              </h3>

              {/* Category list */}
              <div className="space-y-1">
                {/* All categories option */}
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                    !selectedCategory
                      ? 'bg-brand-50 text-brand-700 font-medium'
                      : 'text-base-600 hover:bg-base-50'
                  }`}
                >
                  <BookOpen className="w-4 h-4" />
                  <span className="flex-1 text-start">{t('allCategories')}</span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {articles.length}
                  </Badge>
                </button>

                {/* Individual categories with icons */}
                {categoryDefinitions.map((cat) => {
                  const catArticles = groupedByCategory[cat.key] || []
                  const CatIcon = cat.icon
                  const isSelected = selectedCategory === cat.key

                  return (
                    <button
                      key={cat.key}
                      onClick={() => handleCategorySelect(cat.key)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                        isSelected
                          ? `${cat.bgColor} ${cat.color} font-medium`
                          : 'text-base-600 hover:bg-base-50'
                      }`}
                      style={{
                        maxHeight: isSelected ? '200px' : '40px',
                        overflow: 'hidden',
                        transition: 'max-height 0.3s ease, background-color 0.2s ease, color 0.2s ease',
                      }}
                    >
                      <CatIcon className="w-4 h-4 flex-shrink-0" />
                      <span className="flex-1 text-start">{t(cat.name === 'Electricity & Water' ? 'catElectricityWater' : cat.name === 'Housing' ? 'catHousing' : cat.name === 'Petroleum & Energy' ? 'catPetroleum' : cat.name === 'Transport' ? 'catTransport' : cat.name === 'Digital Services' ? 'catDigital' : 'catSustainability' as Parameters<typeof t>[0])}</span>
                      <ChevronRight className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${isSelected ? 'rotate-90' : ''} ${isRTL ? 'rotate-180' : ''}`} />
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {catArticles.length}
                      </Badge>
                    </button>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Main Content ─────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          {/* Featured Articles Section */}
          {!selectedCategory && !searchQuery && displayFeatured.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <Star className="w-5 h-5 text-amber-500 fill-amber-400" />
                <h3 className="text-sm font-semibold text-base-900">{t('featuredArticles')}</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {displayFeatured.map((article, i) => {
                  const catInfo = getCategoryInfo(article.category)
                  const CatIcon = catInfo.icon
                  return (
                    <motion.div
                      key={article.id}
                      variants={fadeUp}
                      initial="hidden"
                      animate="visible"
                      custom={i}
                      whileHover={{ y: -2 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Card
                        className="h-full border-0 shadow-sm hover:shadow-md transition-shadow duration-300 bg-gradient-to-br from-brand-50/50 to-white cursor-pointer group relative overflow-hidden"
                        onClick={() => handleArticleClick(article)}
                      >
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-500 to-brand-300" />
                        <CardContent className="p-4">
                          <Badge variant="outline" className={`text-[10px] gap-1 mb-2 ${catInfo.bgColor} ${catInfo.color} border-0`}>
                            <CatIcon className="w-3 h-3" />
                            {t(catInfo.key === 'Electricity & Water' ? 'catElectricityWater' : catInfo.key === 'Housing' ? 'catHousing' : catInfo.key === 'Petroleum & Energy' ? 'catPetroleum' : catInfo.key === 'Transport' ? 'catTransport' : catInfo.key === 'Digital' || catInfo.key === 'Digital Services' ? 'catDigital' : 'catSustainability' as Parameters<typeof t>[0])}
                          </Badge>
                          <h4 className="text-sm font-semibold text-base-900 mb-1 group-hover:text-brand-700 transition-colors line-clamp-2">
                            {article.title}
                          </h4>
                          <p className="text-xs text-muted-foreground line-clamp-2">{article.content?.slice(0, 120)}</p>
                          <div className="flex items-center gap-1 mt-2 text-[11px] text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            {getReadingTime(article.content)} {t('readingTime')}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Article Grid */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-40 rounded-xl" />
              ))}
            </div>
          ) : filteredArticles.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-full bg-base-100 flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-base-400" />
              </div>
              <p className="text-base-600 font-medium">{t('noArticlesFound')}</p>
            </div>
          ) : (
            <motion.div
              initial="hidden"
              animate="visible"
              variants={stagger}
              className="grid grid-cols-1 sm:grid-cols-2 gap-4"
            >
              {filteredArticles.map((article, i) => {
                const catInfo = getCategoryInfo(article.category)
                const CatIcon = catInfo.icon

                return (
                  <motion.div
                    key={article.id}
                    variants={fadeUp}
                    custom={i}
                    whileHover={{ y: -2, scale: 1.01 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Card
                      className="h-full border-0 shadow-sm hover:shadow-md transition-shadow duration-300 bg-white cursor-pointer group"
                      onClick={() => handleArticleClick(article)}
                    >
                      <CardContent className="p-5">
                        {/* Category badge & reading time */}
                        <div className="flex items-center justify-between mb-3">
                          <Badge
                            variant="outline"
                            className={`text-[10px] gap-1 ${catInfo.bgColor} ${catInfo.color} border-0`}
                          >
                            <CatIcon className="w-3 h-3" />
                            {t(
                              (article.category === 'Electricity & Water'
                                ? 'catElectricityWater'
                                : article.category === 'Housing'
                                  ? 'catHousing'
                                  : article.category === 'Petroleum & Energy'
                                    ? 'catPetroleum'
                                    : article.category === 'Transport'
                                      ? 'catTransport'
                                      : article.category === 'Digital'
                                        ? 'catDigital'
                                        : article.category === 'Sustainability'
                                          ? 'catSustainability'
                                          : 'catDigital') as Parameters<typeof t>[0]
                            )}
                          </Badge>
                          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            {getReadingTime(article.content)} {t('readingTime')}
                          </span>
                        </div>

                        {/* Title */}
                        <h3 className="text-sm font-semibold text-base-900 mb-2 group-hover:text-brand-700 transition-colors line-clamp-2">
                          {article.title}
                        </h3>

                        {/* Description */}
                        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3 mb-4">
                          {article.content?.slice(0, 160)}...
                        </p>

                        {/* Footer */}
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-brand-600 font-medium group-hover:underline">
                            {t('readMore')} →
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-brand-600 hover:text-brand-700 hover:bg-brand-50 gap-1"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleAskAI(article)
                            }}
                          >
                            <Sparkles className="w-3 h-3" />
                            {t('askAIAbout')}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )
              })}
            </motion.div>
          )}
        </div>
      </div>

      {/* ── Article Detail Dialog ─────────────────────────────────────────── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedArticle && (
            <>
              <DialogHeader>
                {/* Breadcrumb navigation */}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                  <button className="hover:text-brand-600 transition-colors" onClick={() => setDetailOpen(false)}>
                    {t('breadcrumbHome')}
                  </button>
                  <ChevronRight className="w-3 h-3" />
                  <span className="hover:text-brand-600 transition-colors">{t('breadcrumbKnowledge')}</span>
                  <ChevronRight className="w-3 h-3" />
                  <span className="text-brand-700 font-medium truncate max-w-[200px]">
                    {selectedArticle.category}
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  {(() => {
                    const catInfo = getCategoryInfo(selectedArticle.category)
                    const CatIcon = catInfo.icon
                    return (
                      <Badge
                        variant="outline"
                        className={`text-[10px] gap-1 ${catInfo.bgColor} ${catInfo.color} border-0`}
                      >
                        <CatIcon className="w-3 h-3" />
                        {selectedArticle.category}
                      </Badge>
                    )
                  })()}
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {getReadingTime(selectedArticle.content)} {t('readingTime')}
                  </span>
                </div>
                <DialogTitle className="text-lg leading-tight">
                  {selectedArticle.title}
                </DialogTitle>
              </DialogHeader>

              {/* Article content */}
              <div className="py-4">
                {selectedArticle.content?.split('\n').filter(Boolean).map((paragraph, idx) => (
                  <p key={idx} className="text-sm text-base-700 leading-relaxed mb-3">
                    {paragraph}
                  </p>
                ))}
              </div>

              {/* Tags */}
              {selectedArticle.tags && selectedArticle.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {selectedArticle.tags.map((tag, idx) => (
                    <Badge key={idx} variant="outline" className="text-[10px]">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Related Articles */}
              {getRelatedArticles(selectedArticle).length > 0 && (
                <div className="border-t pt-4 mb-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5" />
                    {t('relatedArticles')}
                  </p>
                  <div className="space-y-2">
                    {getRelatedArticles(selectedArticle).map((related) => (
                      <button
                        key={related.id}
                        className="w-full text-left p-3 rounded-lg border border-base-100 hover:bg-brand-50 hover:border-brand-200 transition-all"
                        onClick={() => handleArticleClick(related)}
                      >
                        <p className="text-sm font-medium text-foreground line-clamp-1">{related.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{related.content?.slice(0, 80)}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Helpful feedback */}
              <div className="flex items-center justify-between border-t pt-4 mt-2">
                <Button
                  className="bg-brand-600 hover:bg-brand-700 text-white gap-1.5"
                  onClick={() => handleAskAI(selectedArticle)}
                >
                  <Sparkles className="w-4 h-4" />
                  {t('askAIAbout')}
                </Button>
                {helpfulVote ? (
                  <span className="text-xs text-emerald-600 font-medium">{t('thankYouFeedback')}</span>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{t('wasThisHelpful')}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-emerald-600 hover:bg-emerald-50"
                      onClick={() => setHelpfulVote('yes')}
                    >
                      <ThumbsUp className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-red-500 hover:bg-red-50"
                      onClick={() => setHelpfulVote('no')}
                    >
                      <ThumbsDown className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export { KnowledgeExplorer }
