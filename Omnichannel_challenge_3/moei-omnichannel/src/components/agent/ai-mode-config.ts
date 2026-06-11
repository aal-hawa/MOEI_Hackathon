// ─── AI Mode Centralized Configuration ──────────────────────────────────────────
// Single source of truth for all AI mode definitions used across the project.
// Import from this module instead of defining mode-specific labels, colors,
// or icons inline in components.
//
// i18n rule: NO English text when Arabic is selected, NO Arabic when English is selected.
// Every visible string has both labelEn/labelAr, descEn/descAr, shortLabelEn/shortLabelAr.

// ─── Type ────────────────────────────────────────────────────────────────────────

/** All supported AI modes for conversation sessions */
export type AiMode = 'full_ai' | 'ai_assist' | 'llm_tts' | 'human_only' | 'ai_disabled'

// ─── Config Interface ────────────────────────────────────────────────────────────

/** Complete configuration for a single AI mode */
export interface AiModeConfigEntry {
  /** Unique mode identifier */
  id: AiMode

  /** Lucide icon name (string) — resolve to component at render time via dynamic import or icon map */
  iconName: string

  /** Emoji shorthand for the mode */
  emoji: string

  /** Full English label — used in switcher / detailed views */
  labelEn: string
  /** Full Arabic label — used in switcher / detailed views */
  labelAr: string

  /** Short English label — used in badges / compact UI */
  shortLabelEn: string
  /** Short Arabic label — used in badges / compact UI */
  shortLabelAr: string

  /** English description — explains the mode behavior */
  descEn: string
  /** Arabic description */
  descAr: string

  /** Default (inactive) Tailwind classes for switcher button */
  color: string
  /** Active / selected Tailwind classes for switcher button */
  activeColor: string

  /** Badge Tailwind classes — used in conversation list items */
  badgeColor: string
}

// ─── Full Config ─────────────────────────────────────────────────────────────────

export const AI_MODE_CONFIG: Record<AiMode, AiModeConfigEntry> = {
  full_ai: {
    id: 'full_ai',
    iconName: 'Bot',
    emoji: '🤖',
    labelEn: 'Full AI',
    labelAr: 'ذكاء اصطناعي كامل',
    shortLabelEn: 'Full AI',
    shortLabelAr: 'ذكاء كامل',
    descEn: 'AI handles STT, LLM & TTS',
    descAr: 'الذكاء الاصطناعي يتولى التعرف على الكلام والرد والنطق',
    color: 'border-purple-200 bg-purple-50 text-purple-600 hover:bg-purple-100',
    activeColor:
      'bg-purple-500 text-white border-purple-500 shadow-md shadow-purple-200',
    badgeColor: 'bg-purple-100 text-purple-700 border-purple-200',
  },

  ai_assist: {
    id: 'ai_assist',
    iconName: 'Hand',
    emoji: '🤝',
    labelEn: 'AI Assist',
    labelAr: 'مساعدة ذكية',
    shortLabelEn: 'AI Assist',
    shortLabelAr: 'مساعدة ذكية',
    descEn: 'AI suggests, you decide',
    descAr: 'الذكاء يقترح وأنت تقرر',
    color: 'border-ae-gold-200 bg-ae-gold-50 text-ae-gold-600 hover:bg-ae-gold-100',
    activeColor:
      'bg-ae-gold-500 text-white border-ae-gold-500 shadow-md shadow-ae-gold-200',
    badgeColor: 'bg-ae-gold-100 text-ae-gold-700 border-ae-gold-200',
  },

  llm_tts: {
    id: 'llm_tts',
    iconName: 'Volume2',
    emoji: '🔊',
    labelEn: 'LLM + TTS',
    labelAr: 'رد ذكي مع نطق',
    shortLabelEn: 'LLM+TTS',
    shortLabelAr: 'رد ونطق',
    descEn: 'You speak, AI responds with voice',
    descAr: 'أنت تتكلم والذكاء يجيب بالنطق',
    color: 'border-teal-200 bg-teal-50 text-teal-600 hover:bg-teal-100',
    activeColor:
      'bg-teal-500 text-white border-teal-500 shadow-md shadow-teal-200',
    badgeColor: 'bg-teal-100 text-teal-700 border-teal-200',
  },

  human_only: {
    id: 'human_only',
    iconName: 'User',
    emoji: '👤',
    labelEn: 'Human Only',
    labelAr: 'بشري فقط',
    shortLabelEn: 'Human',
    shortLabelAr: 'بشري',
    descEn: 'You handle, AI suggests text',
    descAr: 'أنت تتعامل والذكاء يقترح نصوصاً',
    color: 'border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100',
    activeColor:
      'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-200',
    badgeColor: 'bg-ae-black-100 text-ae-black-600 border-ae-black-200',
  },

  ai_disabled: {
    id: 'ai_disabled',
    iconName: 'Ban',
    emoji: '🚫',
    labelEn: 'AI Disabled',
    labelAr: 'بدون ذكاء اصطناعي',
    shortLabelEn: 'AI Off',
    shortLabelAr: 'بدون ذكاء',
    descEn: 'No AI assistance',
    descAr: 'بدون أي مساعدة من الذكاء الاصطناعي',
    color: 'border-red-200 bg-red-50 text-red-500 hover:bg-red-100',
    activeColor:
      'bg-red-500 text-white border-red-500 shadow-md shadow-red-200',
    badgeColor: 'bg-red-50 text-red-600 border-red-200',
  },
}

// ─── Ordered list (preserves visual order in switchers / filters) ────────────────

export const AI_MODE_ORDER: AiMode[] = [
  'full_ai',
  'ai_assist',
  'llm_tts',
  'human_only',
  'ai_disabled',
]

// ─── i18n Strings for AI Mode UI ────────────────────────────────────────────────
// Used by components that render AI mode related UI text (headers, tooltips, etc.)

export const AI_MODE_I18N = {
  /** "AI Mode" header label */
  headerLabel: { en: 'AI Mode', ar: 'وضع الذكاء الاصطناعي' },
  /** "Updated" confirmation text */
  updated: { en: 'Updated', ar: 'تم التحديث' },
  /** "All Modes" filter label */
  allModes: { en: 'All Modes', ar: 'جميع الأوضاع' },
  /** "AI" footer abbreviation */
  aiLabel: { en: 'AI', ar: 'ذكاء' },
  /** "total conversations" footer text */
  totalConversations: { en: 'total conversations', ar: 'إجمالي المحادثات' },
  /** "Sentiment" tooltip */
  sentiment: { en: 'Sentiment', ar: 'المشاعر' },
} as const

// ─── Helper Functions ────────────────────────────────────────────────────────────

/**
 * Get the full display label for an AI mode.
 * Use this for switchers, detail panels, and tooltips.
 */
export function getAiModeLabel(mode: AiMode, isAr: boolean): string {
  const entry = AI_MODE_CONFIG[mode]
  return isAr ? entry.labelAr : entry.labelEn
}

/**
 * Get the short/compact label for an AI mode.
 * Use this for badges, chips, and space-constrained UI.
 */
export function getAiModeShortLabel(mode: AiMode, isAr: boolean): string {
  const entry = AI_MODE_CONFIG[mode]
  return isAr ? entry.shortLabelAr : entry.shortLabelEn
}

/**
 * Get the badge Tailwind classes for an AI mode.
 * Returns a default fallback for unknown modes.
 */
export function getAiModeBadgeColor(mode: AiMode): string {
  return AI_MODE_CONFIG[mode]?.badgeColor ?? 'bg-ae-black-50 text-ae-black-400 border-ae-black-100'
}

/**
 * Get the full config entry for an AI mode.
 * Useful when you need multiple properties at once.
 * Returns `undefined` for unknown modes.
 */
export function getAiModeConfig(mode: AiMode): AiModeConfigEntry | undefined {
  return AI_MODE_CONFIG[mode]
}

/**
 * Get the description for an AI mode.
 */
export function getAiModeDescription(mode: AiMode, isAr: boolean): string {
  const entry = AI_MODE_CONFIG[mode]
  return isAr ? entry.descAr : entry.descEn
}

/**
 * Get the emoji for an AI mode.
 */
export function getAiModeEmoji(mode: AiMode): string {
  return AI_MODE_CONFIG[mode]?.emoji ?? '❓'
}

/**
 * Get the Lucide icon name for an AI mode.
 * Resolve to the actual icon component in the consuming component.
 */
export function getAiModeIconName(mode: AiMode): string {
  return AI_MODE_CONFIG[mode]?.iconName ?? 'HelpCircle'
}

/**
 * Get ordered list of all AI mode config entries.
 * Useful for rendering mode lists, switchers, or filter dropdowns.
 */
export function getOrderedAiModes(): AiModeConfigEntry[] {
  return AI_MODE_ORDER.map((id) => AI_MODE_CONFIG[id])
}

/**
 * Get ordered list of AI mode IDs.
 */
export function getOrderedAiModeIds(): AiMode[] {
  return [...AI_MODE_ORDER]
}
