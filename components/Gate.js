'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/AuthProvider'
import { supabase } from '@/lib/supabaseClient'
import Nav from './Nav'

function Shell({ children }) {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div
        className="w-full max-w-sm rounded-lg p-8 border"
        style={{ background: 'var(--card)', borderColor: 'var(--line)' }}
      >
        {children}
      </div>
    </main>
  )
}

function LoginForm() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo:
          typeof window !== 'undefined' ? window.location.origin : undefined,
      },
    })
    if (error) setError(error.message)
    else setSent(true)
  }

  if (sent) {
    return (
      <div>
        <h1 className="font-display text-2xl mb-2" style={{ color: 'var(--pine-dark)' }}>
          Check your email
        </h1>
        <p className="text-sm" style={{ color: 'var(--ink)' }}>
          We sent a sign-in link to <strong>{email}</strong>. Open it on this
          device to continue.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1 className="font-display text-2xl mb-1" style={{ color: 'var(--pine-dark)' }}>
        The Compound
      </h1>
      <p className="text-sm mb-6" style={{ color: 'var(--ink)' }}>
        Enter your email and we'll send you a link to sign in — no password
        needed.
      </p>
      <input
        type="email"
        required
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full border rounded px-3 py-2 mb-3 bg-white"
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
        Send sign-in link
      </button>
    </form>
  )
}

function ProfileForm() {
  const { createMemberProfile } = useAuth()
  const [name, setName] = useState('')
  const [household, setHousehold] = useState('')
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    const { error } = await createMemberProfile(name, household)
    if (error) setError(error.message)
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1 className="font-display text-2xl mb-1" style={{ color: 'var(--pine-dark)' }}>
        Welcome!
      </h1>
      <p className="text-sm mb-6" style={{ color: 'var(--ink)' }}>
        One last step — tell the rest of the family who you are.
      </p>
      <label className="text-xs uppercase tracking-wide" style={{ color: 'var(--pine-dark)' }}>
        Your name
      </label>
      <input
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full border rounded px-3 py-2 mt-1 mb-3 bg-white"
        style={{ borderColor: 'var(--line)' }}
      />
      <label className="text-xs uppercase tracking-wide" style={{ color: 'var(--pine-dark)' }}>
        Household / branch (optional)
      </label>
      <input
        value={household}
        onChange={(e) => setHousehold(e.target.value)}
        placeholder="e.g. Simon's family"
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
        Join the compound
      </button>
    </form>
  )
}

export default function Gate({ children }) {
  const { session, member, loadingMember } = useAuth()

  if (session === undefined) return null // initial load
  if (session === null) return <Shell><LoginForm /></Shell>
  if (loadingMember) return null
  if (!member) return <Shell><ProfileForm /></Shell>

  return (
    <>
      <Nav />
      <main className="max-w-5xl mx-auto px-6 py-10">{children}</main>
    </>
  )
}
