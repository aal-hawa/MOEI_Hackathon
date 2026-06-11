'use client';

/* ───────────────────────────────────────────────────────────────
   MOEI Country Intelligence Platform – Footer
   Minimal, clean footer with official MOEI logo and gold accent
   ─────────────────────────────────────────────────────────────── */

import Image from 'next/image';
import { useLanguage } from '@/lib/LanguageContext';

export default function Footer() {
  const { t, isRTL, dir } = useLanguage();

  return (
    <footer
      dir={dir}
      className="mt-auto bg-white border-t border-gray-200"
    >
      {/* Thin gold accent line */}
      <div className="h-[2px] bg-gradient-to-r from-transparent via-[#C9A84C] to-transparent" />

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-3">
        <div className={`flex items-center justify-between gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
          {/* Branding with MOEI Logo */}
          <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <Image
              src="/uae_moei_ar.png"
              alt={t('app.shortTitle')}
              width={60}
              height={20}
              className="h-5 w-auto object-contain"
            />
            <span className="text-[11px] text-gray-400">
              {t('app.title')}
            </span>
          </div>

          {/* Status */}
          <div className={`flex items-center gap-3 text-[11px] text-gray-400 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <span>{t('footer.sourceVerified')}</span>
          </div>

          {/* Copyright */}
          <span className="text-[11px] text-gray-400">
            {t('footer.copyright')}
          </span>
        </div>
      </div>
    </footer>
  );
}
