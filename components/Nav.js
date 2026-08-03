'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/AuthProvider'
import { useLocale } from '@/lib/i18n/LocaleProvider'
import { LanguageToggle } from './LanguageToggle'

export default function Nav() {
  const pathname = usePathname()
  const { member, signOut } = useAuth()
  const { t } = useLocale()

  const links = [
    { href: '/', label: t('nav.home') },
    { href: '/land', label: t('nav.land') },
    { href: '/countries', label: t('nav.countries') },
    { href: '/priorities', label: t('nav.priorities') },
    { href: '/budget', label: t('nav.budget') },
    { href: '/decisions', label: t('nav.decisions') },
    { href: '/tasks', label: t('nav.tasks') },
  ]

  return (
    <header
      className="sticky top-0 z-10 border-b backdrop-blur"
      style={{ borderColor: 'var(--line)', background: 'color-mix(in srgb, var(--paper) 92%, transparent)' }}
    >
      <div className="max-w-5xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <Link href="/" className="font-display text-2xl shrink-0" style={{ color: 'var(--pine-dark)' }}>
          The Compound
        </Link>
        <nav className="flex flex-wrap gap-1" aria-label="Main">
          {links.map((l) => {
            const active = pathname === l.href
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? 'page' : undefined}
                className="px-3 py-1.5 rounded-full text-sm font-medium"
                style={{
                  background: active ? 'var(--pine)' : 'transparent',
                  color: active ? 'var(--card)' : 'var(--ink)',
                }}
              >
                {l.label}
              </Link>
            )
          })}
        </nav>
        <div className="flex items-center gap-3 text-sm">
          <LanguageToggle />
          {member && (
            <span style={{ color: 'var(--pine-dark)' }}>
              {member.name}
              {member.household && (
                <span className="hidden sm:inline" style={{ color: 'var(--ink)' }}> · {member.household}</span>
              )}
            </span>
          )}
          <button
            onClick={signOut}
            className="underline decoration-dotted underline-offset-4"
            style={{ color: 'var(--clay)' }}
          >
            {t('common.signOut')}
          </button>
        </div>
      </div>
    </header>
  )
}
