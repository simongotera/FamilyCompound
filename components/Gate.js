'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/AuthProvider'
import { useLocale } from '@/lib/i18n/LocaleProvider'
import Nav from './Nav'
import { LanguageToggle } from './LanguageToggle'
import ComingSoon from './ComingSoon'

function Shell({ children }) {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex justify-end mb-3">
          <LanguageToggle />
        </div>
        <div
          className="rounded-lg p-8 border"
          style={{ background: 'var(--card)', borderColor: 'var(--line)' }}
        >
          {children}
        </div>
      </div>
    </main>
  )
}

function ProfileForm() {
  const { createMemberProfile } = useAuth()
  const { t, locale } = useLocale()
  const [name, setName] = useState('')
  const [household, setHousehold] = useState('')
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    const { error } = await createMemberProfile(name, household, locale)
    if (error) setError(error.message === 'No invitation for this account.' ? t('gate.noInvite') : error.message)
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1 className="font-display text-2xl mb-1" style={{ color: 'var(--pine-dark)' }}>
        {t('auth.welcomeTitle')}
      </h1>
      <p className="text-sm mb-6" style={{ color: 'var(--ink)' }}>
        {t('auth.welcomeSubtitle')}
      </p>
      <label className="text-xs uppercase tracking-wide" style={{ color: 'var(--pine-dark)' }}>
        {t('auth.yourName')}
      </label>
      <input
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full border rounded px-3 py-2 mt-1 mb-3 bg-white"
        style={{ borderColor: 'var(--line)' }}
      />
      <label className="text-xs uppercase tracking-wide" style={{ color: 'var(--pine-dark)' }}>
        {t('auth.householdLabel')}
      </label>
      <input
        value={household}
        onChange={(e) => setHousehold(e.target.value)}
        placeholder={t('auth.householdPlaceholder')}
        className="w-full border rounded px-3 py-2 mt-1 mb-3 bg-white"
        style={{ borderColor: 'var(--line)' }}
      />
      {error && (
        <p className="text-sm mb-3" style={{ color: 'var(--clay)' }}>
          {error}
        </p>
      )}
      <button
        type="submit"
        className="w-full rounded py-2 font-medium"
        style={{ background: 'var(--pine)', color: 'var(--card)' }}
      >
        {t('auth.joinButton')}
      </button>
    </form>
  )
}

export default function Gate({ children }) {
  const { session, member, loadingMember } = useAuth()

  if (session === undefined) return null // initial load
  if (session === null) return <ComingSoon />
  if (loadingMember) return null
  if (!member) return <Shell><ProfileForm /></Shell>

  return (
    <>
      <Nav />
      <main className="max-w-5xl mx-auto px-6 py-10">{children}</main>
    </>
  )
}
