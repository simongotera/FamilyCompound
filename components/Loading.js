export function Loading({ label = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm" style={{ color: 'var(--ink)' }}>
      <span
        className="inline-block h-4 w-4 rounded-full border-2 animate-spin"
        style={{ borderColor: 'var(--line)', borderTopColor: 'var(--pine)' }}
      />
      {label}
    </div>
  )
}

export function EmptyState({ title, hint }) {
  return (
    <div className="rounded-lg border border-dashed p-8 text-center" style={{ borderColor: 'var(--line)' }}>
      <p className="font-display text-lg mb-1" style={{ color: 'var(--pine-dark)' }}>{title}</p>
      {hint && <p className="text-sm" style={{ color: 'var(--ink)' }}>{hint}</p>}
    </div>
  )
}

export function ErrorState({ message = "Couldn't load this — check your connection and try refreshing." }) {
  return (
    <div
      className="rounded-lg border p-4 text-sm"
      style={{ borderColor: 'var(--clay)', background: 'var(--card)', color: 'var(--clay)' }}
      role="alert"
    >
      {message}
    </div>
  )
}
