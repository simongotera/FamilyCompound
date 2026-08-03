'use client'

import { useLocale } from '@/lib/i18n/LocaleProvider'

export function LanguageToggle({ className = '' }) {
  const { locale, setLocale, t } = useLocale()

  return (
    <div
      className={`inline-flex rounded-full border text-xs font-medium overflow-hidden shrink-0 ${className}`}
      style={{ borderColor: 'var(--line)' }}
      role="group"
      aria-label={t('lang.toggleLabel')}
    >
      {['en', 'es'].map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLocale(code)}
          aria-pressed={locale === code}
          className="px-3 py-1"
          style={{
            background: locale === code ? 'var(--pine)' : 'transparent',
            color: locale === code ? 'var(--card)' : 'var(--ink)',
          }}
        >
          {code === 'en' ? t('lang.english') : t('lang.spanish')}
        </button>
      ))}
    </div>
  )
}
