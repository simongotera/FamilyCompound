'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/AuthProvider'

const links = [
  { href: '/', label: 'Home' },
  { href: '/land', label: 'Land' },
  { href: '/priorities', label: 'Priorities' },
  { href: '/budget', label: 'Budget' },
  { href: '/decisions', label: 'Decisions' },
  { href: '/tasks', label: 'Tasks' },
]

export default function Nav() {
  const pathname = usePathname()
  const { member, signOut } = useAuth()

  return (
    <header className="border-b" style={{ borderColor: 'var(--line)' }}>
      <div className="max-w-5xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <Link href="/" className="font-display text-2xl" style={{ color: 'var(--pine-dark)' }}>
          The Compound
        </Link>
        <nav className="flex flex-wrap gap-1">
          {links.map((l) => {
            const active = pathname === l.href
            return (
              <Link
                key={l.href}
                href={l.href}
                className="px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
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
          {member && <span style={{ color: 'var(--pine-dark)' }}>{member.name}</span>}
          <button
            onClick={signOut}
            className="underline decoration-dotted underline-offset-4"
            style={{ color: 'var(--clay)' }}
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  )
}
