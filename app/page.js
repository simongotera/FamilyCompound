'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Gate from '@/components/Gate'
import { Loading, ErrorState } from '@/components/Loading'
import { useAuth } from '@/lib/AuthProvider'
import { useLocale } from '@/lib/i18n/LocaleProvider'
import { supabase } from '@/lib/supabaseClient'

function firstName(fullName) {
  return fullName ? fullName.split(' ')[0] : null
}

function Dashboard() {
  const { member } = useAuth()
  const { t } = useLocale()
  const [stats, setStats] = useState(null)
  const [upNext, setUpNext] = useState([])
  const [latestDecision, setLatestDecision] = useState(null)
  const [favorite, setFavorite] = useState(null)
  const [error, setError] = useState(null)

  const cards = [
    { href: '/land', label: t('dashboard.cardLandLabel'), desc: t('dashboard.cardLandDesc') },
    { href: '/priorities', label: t('dashboard.cardPrioritiesLabel'), desc: t('dashboard.cardPrioritiesDesc') },
    { href: '/budget', label: t('dashboard.cardBudgetLabel'), desc: t('dashboard.cardBudgetDesc') },
    { href: '/decisions', label: t('dashboard.cardDecisionsLabel'), desc: t('dashboard.cardDecisionsDesc') },
    { href: '/tasks', label: t('dashboard.cardTasksLabel'), desc: t('dashboard.cardTasksDesc') },
  ]

  useEffect(() => {
    let cancelled = false
    async function load() {
      setError(null)
      const [land, priorities, budget, decisions, tasks, upNextRes, latestDecisionRes, favoriteRes] = await Promise.all([
        supabase.from('land_options').select('id', { count: 'exact', head: true }),
        supabase.from('priorities').select('id', { count: 'exact', head: true }),
        supabase.from('budget_contributions').select('amount'),
        supabase.from('decisions').select('id', { count: 'exact', head: true }),
        supabase.from('tasks').select('id', { count: 'exact', head: true }).neq('status', 'done'),
        supabase.from('tasks').select('id, title, due_date, members(name)').neq('status', 'done').order('due_date', { ascending: true, nullsFirst: false }).limit(3),
        supabase.from('decisions').select('id, title, created_at, members(name)').order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('land_options').select('id, name, location').eq('status', 'favorite').limit(1).maybeSingle(),
      ])

      if (cancelled) return

      const firstError = [land, priorities, budget, decisions, tasks, upNextRes, latestDecisionRes, favoriteRes]
        .find((r) => r.error)?.error
      if (firstError) {
        setError(firstError.message)
        return
      }

      const total = (budget.data || []).reduce((sum, b) => sum + Number(b.amount), 0)
      setStats({
        land: land.count || 0,
        priorities: priorities.count || 0,
        budget: total,
        decisions: decisions.count || 0,
        openTasks: tasks.count || 0,
      })
      setUpNext(upNextRes.data || [])
      setLatestDecision(latestDecisionRes.data || null)
      setFavorite(favoriteRes.data || null)
    }
    load()
    return () => { cancelled = true }
  }, [])

  const isFreshStart = stats && stats.land === 0 && stats.priorities === 0 && stats.decisions === 0 && stats.openTasks === 0

  return (
    <div>
      <h1 className="font-display text-4xl mb-2" style={{ color: 'var(--pine-dark)' }}>
        {member?.name ? t('dashboard.welcomeBack', { name: firstName(member.name) }) : t('dashboard.title')}
      </h1>
      <p className="mb-8" style={{ color: 'var(--ink)' }}>
        {t('dashboard.subtitle')}
      </p>

      {error && <div className="mb-8"><ErrorState message={t('dashboard.loadError', { error })} /></div>}

      {!stats && !error && <Loading label={t('dashboard.loadingLabel')} />}

      {stats && isFreshStart && (
        <div
          className="rounded-lg border p-5 mb-8"
          style={{ background: 'var(--card)', borderColor: 'var(--clay-light)' }}
        >
          <p className="font-display text-lg mb-1" style={{ color: 'var(--clay)' }}>{t('dashboard.freshStartTitle')}</p>
          <p className="text-sm" style={{ color: 'var(--ink)' }}>
            {t('dashboard.freshStartPrefix')}
            <Link href="/land" className="underline" style={{ color: 'var(--pine)' }}>{t('dashboard.freshStartLandLink')}</Link>
            {t('dashboard.freshStartMid')}
            <Link href="/priorities" className="underline" style={{ color: 'var(--pine)' }}>{t('dashboard.freshStartPrioritiesLink')}</Link>
            {t('dashboard.freshStartSuffix')}
          </p>
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          <Stat label={t('dashboard.statLand')} value={stats.land} />
          <Stat label={t('dashboard.statPriorities')} value={stats.priorities} />
          <Stat label={t('dashboard.statBudget')} value={`$${stats.budget.toLocaleString()}`} />
          <Stat label={t('dashboard.statDecisions')} value={stats.decisions} />
          <Stat label={t('dashboard.statTasks')} value={stats.openTasks} />
        </div>
      )}

      {favorite && (
        <div className="rounded-lg border p-4 mb-8 flex items-center justify-between gap-3" style={{ background: 'var(--card)', borderColor: 'var(--pine)' }}>
          <p className="text-sm">
            <span className="text-xs font-semibold uppercase mr-2" style={{ color: 'var(--pine)' }}>{t('dashboard.currentFavorite')}</span>
            <strong>{favorite.name}</strong>{favorite.location && ` — ${favorite.location}`}
          </p>
          <Link href="/land" className="text-sm underline shrink-0" style={{ color: 'var(--pine)' }}>{t('dashboard.viewLand')}</Link>
        </div>
      )}

      {stats && !isFreshStart && (
        <div className="grid sm:grid-cols-2 gap-4 mb-10">
          <div className="rounded-lg border p-5" style={{ background: 'var(--card)', borderColor: 'var(--line)' }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-lg" style={{ color: 'var(--clay)' }}>{t('dashboard.upNext')}</h2>
              <Link href="/tasks" className="text-xs underline" style={{ color: 'var(--pine)' }}>{t('dashboard.allTasks')}</Link>
            </div>
            {upNext.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--ink)' }}>{t('dashboard.noOpenTasks')}</p>
            ) : (
              <ul className="space-y-2">
                {upNext.map((task) => (
                  <li key={task.id} className="text-sm flex justify-between gap-2">
                    <span>{task.title}</span>
                    <span className="shrink-0" style={{ color: 'var(--ink)' }}>
                      {task.due_date ? new Date(task.due_date).toLocaleDateString() : task.members?.name || ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-lg border p-5" style={{ background: 'var(--card)', borderColor: 'var(--line)' }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-lg" style={{ color: 'var(--clay)' }}>{t('dashboard.latestDecision')}</h2>
              <Link href="/decisions" className="text-xs underline" style={{ color: 'var(--pine)' }}>{t('dashboard.fullLog')}</Link>
            </div>
            {latestDecision ? (
              <div>
                <p className="text-sm font-medium">{latestDecision.title}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--ink)' }}>
                  {latestDecision.members?.name} · {new Date(latestDecision.created_at).toLocaleDateString()}
                </p>
              </div>
            ) : (
              <p className="text-sm" style={{ color: 'var(--ink)' }}>{t('dashboard.nothingDecided')}</p>
            )}
          </div>
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
