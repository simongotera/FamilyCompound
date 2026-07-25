'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Gate from '@/components/Gate'
import { supabase } from '@/lib/supabaseClient'

const cards = [
  { href: '/land', label: 'Land options', desc: 'Compare parcels side by side' },
  { href: '/priorities', label: 'Priorities', desc: "Everyone's must-haves and dealbreakers" },
  { href: '/budget', label: 'Budget', desc: 'Who has committed what' },
  { href: '/decisions', label: 'Decisions', desc: "What we've agreed on, and why" },
  { href: '/tasks', label: 'Tasks', desc: "What's next, and who owns it" },
]

function Dashboard() {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    async function load() {
      const [land, priorities, budget, decisions, tasks] = await Promise.all([
        supabase.from('land_options').select('id', { count: 'exact', head: true }),
        supabase.from('priorities').select('id', { count: 'exact', head: true }),
        supabase.from('budget_contributions').select('amount'),
        supabase.from('decisions').select('id', { count: 'exact', head: true }),
        supabase.from('tasks').select('id', { count: 'exact' }).neq('status', 'done'),
      ])
      const total = (budget.data || []).reduce((sum, b) => sum + Number(b.amount), 0)
      setStats({
        land: land.count || 0,
        priorities: priorities.count || 0,
        budget: total,
        decisions: decisions.count || 0,
        openTasks: tasks.count || 0,
      })
    }
    load()
  }, [])

  return (
    <div>
      <h1 className="font-display text-4xl mb-2" style={{ color: 'var(--pine-dark)' }}>
        Our homestead, in progress
      </h1>
      <p className="mb-8" style={{ color: 'var(--ink)' }}>
        A shared place to compare land, weigh priorities, track the budget, and
        keep everyone pointed the same direction.
      </p>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-10">
          <Stat label="Parcels considered" value={stats.land} />
          <Stat label="Priorities logged" value={stats.priorities} />
          <Stat label="Committed" value={`$${stats.budget.toLocaleString()}`} />
          <Stat label="Decisions made" value={stats.decisions} />
          <Stat label="Open tasks" value={stats.openTasks} />
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="block rounded-lg p-5 border transition-transform hover:-translate-y-0.5"
            style={{ background: 'var(--card)', borderColor: 'var(--line)' }}
          >
            <h2 className="font-display text-xl mb-1" style={{ color: 'var(--clay)' }}>
              {c.label}
            </h2>
            <p className="text-sm" style={{ color: 'var(--ink)' }}>{c.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="rounded-lg p-3 border text-center" style={{ background: 'var(--card)', borderColor: 'var(--line)' }}>
      <div className="font-display text-2xl" style={{ color: 'var(--pine-dark)' }}>{value}</div>
      <div className="text-xs uppercase tracking-wide mt-1" style={{ color: 'var(--ink)' }}>{label}</div>
    </div>
  )
}

export default function Page() {
  return (
    <Gate>
      <Dashboard />
    </Gate>
  )
}
