'use client'

// What a signed-out visitor sees. Two doors: join the waitlist, or get in.
//
// Nothing here decides anything. Both forms post to the `request-access` edge function, which
// is the only thing that can create an account. This component never sees the allow-list, and
// the reply it gets back is deliberately the same whether or not an email is approved.

import { useState } from 'react'
import { useLocale } from '@/lib/i18n/LocaleProvider'
import { supabase } from '@/lib/supabaseClient'
import { LanguageToggle } from './LanguageToggle'

const FUNCTIONS_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/request-access`

async function requestAccess(payload) {
  const res = await fetch(FUNCTIONS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // The anon key is a public identifier, not a secret — it only gets you to the function.
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(payload),
  })
  let data = {}
  try { data = await res.json() } catch { /* non-JSON error page */ }
  return { status: res.status, ...data }
}

export default function ComingSoon() {
  const { t } = useLocale()
  // Read ?token= straight from the URL rather than with useSearchParams(), which would force
  // a Suspense bailout on every page in the app. This component only ever renders in the
  // browser, after the session has resolved.
  const [inviteToken] = useState(() =>
    (typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('token')))
  const [mode, setMode] = useState('notify')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null)
  const [error, setError] = useState(null)

  // An invited visitor should land straight on the access form.
  const effectiveMode = inviteToken ? 'access' : mode

  async function submitNotify(e) {
    e.preventDefault()
    setBusy(true); setError(null)
    const r = await requestAccess({ action: 'notify', email, note })
    setBusy(false)
    if (r.ok) setDone('waitlisted')
    else setError(t(r.error === 'badEmail' ? 'gate.badEmail' : 'gate.serverError'))
  }

  async function submitAccess(e) {
    e.preventDefault()
    setBusy(true); setError(null)
    const r = await requestAccess({ action: 'access', email, code: code || undefined, token: inviteToken || undefined })
    if (!r.ok) {
      setBusy(false)
      const key = { badCode: 'gate.badCode', badInvite: 'gate.badInvite', tooManyAttempts: 'gate.tooMany', badEmail: 'gate.badEmail' }[r.error] || 'gate.serverError'
      setError(t(key))
      return
    }
    // The account now exists if it was going to; ask Supabase for the sign-in link.
    // shouldCreateUser is false so this can never create an account on its own.
    await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
      },
    })
    setBusy(false)
    setDone('checkEmail')
  }

  if (done) {
    return (
      <Shell>
        <h1 className="font-display text-2xl mb-2" style={{ color: 'var(--pine-dark)' }}>
          {t(done === 'waitlisted' ? 'gate.waitlistedTitle' : 'gate.checkEmailTitle')}
        </h1>
        <p className="text-sm" style={{ color: 'var(--ink)' }}>
          {t(done === 'waitlisted' ? 'gate.waitlistedBody' : 'gate.checkEmailBody', { email })}
        </p>
      </Shell>
    )
  }

  return (
    <Shell>
      <h1 className="font-display text-3xl mb-2" style={{ color: 'var(--pine-dark)' }}>The Compound</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--ink)' }}>{t('gate.tagline')}</p>

      <div className="flex gap-1 mb-5">
        {['notify', 'access'].map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => { setMode(m); setError(null) }}
            aria-pressed={effectiveMode === m}
            className="px-3 py-1.5 rounded-full text-sm font-medium"
            style={{ background: effectiveMode === m ? 'var(--pine)' : 'transparent', color: effectiveMode === m ? 'var(--card)' : 'var(--ink)' }}
          >
            {t(m === 'notify' ? 'gate.tabNotify' : 'gate.tabAccess')}
          </button>
        ))}
      </div>

      {effectiveMode === 'notify' ? (
        <form onSubmit={submitNotify}>
          <p className="text-sm mb-3" style={{ color: 'var(--ink)' }}>{t('gate.notifyBlurb')}</p>
          <input
            type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder={t('auth.emailPlaceholder')}
            className="w-full border rounded px-3 py-2 mb-3 bg-white" style={{ borderColor: 'var(--line)' }}
          />
          <input
            value={note} onChange={(e) => setNote(e.target.value)} maxLength={500}
            placeholder={t('gate.notePlaceholder')}
            className="w-full border rounded px-3 py-2 mb-3 bg-white" style={{ borderColor: 'var(--line)' }}
          />
          {error && <p className="text-sm mb-3" style={{ color: 'var(--clay)' }}>{error}</p>}
          <button type="submit" disabled={busy} className="w-full rounded py-2 font-medium" style={{ background: 'var(--pine)', color: 'var(--card)' }}>
            {busy ? t('gate.sending') : t('gate.notifyButton')}
          </button>
        </form>
      ) : (
        <form onSubmit={submitAccess}>
          <p className="text-sm mb-3" style={{ color: 'var(--ink)' }}>
            {t(inviteToken ? 'gate.inviteBlurb' : 'gate.accessBlurb')}
          </p>
          <input
            type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder={t('auth.emailPlaceholder')}
            className="w-full border rounded px-3 py-2 mb-3 bg-white" style={{ borderColor: 'var(--line)' }}
          />
          {!inviteToken && (
            <input
              value={code} onChange={(e) => setCode(e.target.value)}
              placeholder={t('gate.codePlaceholder')} autoComplete="off" spellCheck={false}
              className="w-full border rounded px-3 py-2 mb-3 bg-white font-mono tracking-wide" style={{ borderColor: 'var(--line)' }}
            />
          )}
          {error && <p className="text-sm mb-3" style={{ color: 'var(--clay)' }}>{error}</p>}
          <button type="submit" disabled={busy} className="w-full rounded py-2 font-medium" style={{ background: 'var(--pine)', color: 'var(--card)' }}>
            {busy ? t('gate.sending') : t('gate.accessButton')}
          </button>
          <p className="text-xs mt-3" style={{ color: 'var(--ink)' }}>{t('gate.accessFootnote')}</p>
        </form>
      )}
    </Shell>
  )
}

function Shell({ children }) {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex justify-end mb-3"><LanguageToggle /></div>
        <div className="rounded-lg p-8 border" style={{ background: 'var(--card)', borderColor: 'var(--line)' }}>
          {children}
        </div>
      </div>
    </main>
  )
}
