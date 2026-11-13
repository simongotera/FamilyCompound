'use client'

// Small shared pieces for the location quiz screens.

export function Card({ children, className = '' }) {
  return (
    <div className={`rounded-lg border p-5 ${className}`} style={{ background: 'var(--card)', borderColor: 'var(--line)' }}>
      {children}
    </div>
  )
}

export function SectionTitle({ children, hint }) {
  return (
    <div className="mb-3">
      <h2 className="font-display text-xl" style={{ color: 'var(--pine-dark)' }}>{children}</h2>
      {hint && <p className="text-sm mt-1" style={{ color: 'var(--ink)' }}>{hint}</p>}
    </div>
  )
}

export function PrimaryButton({ children, ...props }) {
  return (
    <button {...props} className={`rounded-full px-4 py-2 text-sm font-medium ${props.className || ''}`} style={{ background: 'var(--pine)', color: 'var(--card)' }}>
      {children}
    </button>
  )
}

export function SecondaryButton({ children, ...props }) {
  return (
    <button {...props} className={`rounded-full px-4 py-2 text-sm font-medium border ${props.className || ''}`} style={{ borderColor: 'var(--line)', color: 'var(--pine-dark)', background: 'transparent' }}>
      {children}
    </button>
  )
}

export function Pill({ children, tone = 'ink' }) {
  const colors = { ink: 'var(--ink)', pine: 'var(--pine)', clay: 'var(--clay)', grey: '#8a8a8a' }
  return (
    <span className="inline-block text-xs px-2 py-0.5 rounded-full border mr-1 mb-1" style={{ borderColor: colors[tone], color: colors[tone] }}>
      {children}
    </span>
  )
}

export function pct(v, digits = 0) {
  return `${(v * 100).toFixed(digits)}%`
}

export function WeightBars({ weights, label, limit = 15 }) {
  const entries = Object.entries(weights).sort((a, b) => b[1] - a[1]).slice(0, limit)
  const max = Math.max(...entries.map(([, w]) => w), 0.0001)
  return (
    <ul className="space-y-1">
      {entries.map(([id, w]) => (
        <li key={id} className="grid grid-cols-[9rem_1fr_3rem] items-center gap-2 text-xs">
          <span className="truncate">{label(id)}</span>
          <span className="h-2 rounded-full" style={{ background: 'var(--line)' }}>
            <span className="block h-2 rounded-full" style={{ width: `${(w / max) * 100}%`, background: 'var(--pine)' }} />
          </span>
          <span className="text-right tabular-nums">{pct(w)}</span>
        </li>
      ))}
    </ul>
  )
}
