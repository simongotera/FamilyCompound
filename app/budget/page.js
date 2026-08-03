'use client'

import { useEffect, useState } from 'react'
import Gate from '@/components/Gate'
import { Loading, EmptyState, ErrorState } from '@/components/Loading'
import { DeleteButton } from '@/components/DeleteButton'
import { useAuth } from '@/lib/AuthProvider'
import { useLocale } from '@/lib/i18n/LocaleProvider'
import { supabase } from '@/lib/supabaseClient'

function BudgetPage() {
  const { member } = useAuth()
  const { t } = useLocale()
  const [items, setItems] = useState([])
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function load() {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('budget_contributions')
      .select('*, members(name, household)')
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setItems(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    const { data, error } = await supabase
      .from('budget_contributions')
      .insert({
        member_id: member.id,
        amount: Number(amount),
        notes,
      })
      .select('*, members(name, household)')
      .single()
    setSaving(false)
    if (error) { setError(error.message); return }
    setItems((prev) => [data, ...prev])
    setAmount(''); setNotes('')
  }

  async function handleDelete(id) {
    setItems((prev) => prev.filter((i) => i.id !== id))
    const { error } = await supabase.from('budget_contributions').delete().eq('id', id)
    if (error) { setError(error.message); load() }
  }

  const total = items.reduce((sum, i) => sum + Number(i.amount), 0)
  const byPerson = items.reduce((acc, i) => {
    const key = i.members?.name || 'Unknown'
    acc[key] = (acc[key] || 0) + Number(i.amount)
    return acc
  }, {})

  return (
    <div>
      <h1 className="font-display text-3xl mb-2" style={{ color: 'var(--pine-dark)' }}>{t('budget.title')}</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--ink)' }}>
        {t('budget.subtitle')}
      </p>

      {error && <div className="mb-6"><ErrorState message={error} /></div>}

      {loading ? (
        <Loading />
      ) : (
        <>
          <div className="rounded-lg border p-5 mb-6 text-center" style={{ background: 'var(--card)', borderColor: 'var(--line)' }}>
            <div className="font-display text-4xl" style={{ color: 'var(--pine-dark)' }}>
              ${total.toLocaleString()}
            </div>
            <div className="text-xs uppercase tracking-wide mt-1" style={{ color: 'var(--ink)' }}>{t('budget.totalCommitted')}</div>
          </div>

          <div className="grid sm:grid-cols-2 gap-6 mb-8">
            <div>
              <h3 className="font-display text-lg mb-2" style={{ color: 'var(--clay)' }}>{t('budget.byHousehold')}</h3>
              {Object.keys(byPerson).length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--ink)' }}>{t('budget.noContributions')}</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {Object.entries(byPerson)
                    .sort((a, b) => b[1] - a[1])
                    .map(([name, amt]) => (
                      <li key={name} className="flex justify-between border-b pb-1" style={{ borderColor: 'var(--line)' }}>
                        <span>{name}</span>
                        <span>${amt.toLocaleString()} <span style={{ color: 'var(--ink)' }}>({total ? Math.round((amt / total) * 100) : 0}%)</span></span>
                      </li>
                    ))}
                </ul>
              )}
            </div>

            <form onSubmit={handleSubmit} className="rounded-lg border p-5" style={{ background: 'var(--card)', borderColor: 'var(--line)' }}>
              <h3 className="font-display text-lg mb-3" style={{ color: 'var(--clay)' }}>{t('budget.logContribution')}</h3>
              <label className="text-xs uppercase tracking-wide block mb-1" style={{ color: 'var(--pine-dark)' }}>{t('budget.amountLabel')}</label>
              <input required type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full border rounded px-3 py-2 mb-3 bg-white" style={{ borderColor: 'var(--line)' }} />
              <label className="text-xs uppercase tracking-wide block mb-1" style={{ color: 'var(--pine-dark)' }}>{t('budget.notesLabel')}</label>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('budget.notesPlaceholder')} className="w-full border rounded px-3 py-2 mb-3 bg-white" style={{ borderColor: 'var(--line)' }} />
              <button type="submit" disabled={saving} className="rounded px-4 py-2 font-medium" style={{ background: 'var(--pine)', color: 'var(--card)' }}>
                {saving ? t('budget.adding') : t('budget.add')}
              </button>
            </form>
          </div>

          <h3 className="font-display text-lg mb-2" style={{ color: 'var(--clay)' }}>{t('budget.history')}</h3>
          {items.length === 0 ? (
            <EmptyState title={t('budget.emptyTitle')} hint={t('budget.emptyHint')} />
          ) : (
            <ul className="space-y-1 text-sm">
              {items.map((i) => (
                <li key={i.id} className="flex justify-between items-center border-b pb-1 gap-2" style={{ borderColor: 'var(--line)' }}>
                  <span>{i.members?.name} {i.notes && `— ${i.notes}`}</span>
                  <span className="flex items-center gap-3 shrink-0">
                    ${Number(i.amount).toLocaleString()}
                    {i.member_id === member.id && <DeleteButton onDelete={() => handleDelete(i.id)} confirmText={t('budget.deleteConfirm')} />}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

export default function Page() {
  return <Gate><BudgetPage /></Gate>
}
