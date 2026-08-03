'use client'

import { useEffect, useState } from 'react'
import Gate from '@/components/Gate'
import { Loading, EmptyState, ErrorState } from '@/components/Loading'
import { DeleteButton } from '@/components/DeleteButton'
import { useAuth } from '@/lib/AuthProvider'
import { supabase } from '@/lib/supabaseClient'

function DecisionsPage() {
  const { member } = useAuth()
  const [items, setItems] = useState([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function load() {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('decisions')
      .select('*, members(name)')
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
      .from('decisions')
      .insert({ title, description, decided_by: member.id })
      .select('*, members(name)')
      .single()
    setSaving(false)
    if (error) { setError(error.message); return }
    setItems((prev) => [data, ...prev])
    setTitle(''); setDescription('')
  }

  async function handleDelete(id) {
    setItems((prev) => prev.filter((d) => d.id !== id))
    const { error } = await supabase.from('decisions').delete().eq('id', id)
    if (error) { setError(error.message); load() }
  }

  return (
    <div>
      <h1 className="font-display text-3xl mb-2" style={{ color: 'var(--pine-dark)' }}>Decisions log</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--ink)' }}>
        A running record so nobody has to re-argue settled ground.
      </p>

      {error && <div className="mb-6"><ErrorState message={error} /></div>}

      <form onSubmit={handleSubmit} className="rounded-lg border p-5 mb-8" style={{ background: 'var(--card)', borderColor: 'var(--line)' }}>
        <label className="text-xs uppercase tracking-wide block mb-1" style={{ color: 'var(--pine-dark)' }}>What was decided</label>
        <input required value={title} onChange={(e) => setTitle(e.target.value)} className="w-full border rounded px-3 py-2 mb-3 bg-white" style={{ borderColor: 'var(--line)' }} />
        <label className="text-xs uppercase tracking-wide block mb-1" style={{ color: 'var(--pine-dark)' }}>Why / context</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full border rounded px-3 py-2 mb-3 bg-white" style={{ borderColor: 'var(--line)' }} />
        <button type="submit" disabled={saving} className="rounded px-4 py-2 font-medium" style={{ background: 'var(--clay)', color: 'var(--card)' }}>
          {saving ? 'Logging…' : 'Log decision'}
        </button>
      </form>

      {loading ? (
        <Loading />
      ) : items.length === 0 ? (
        <EmptyState title="No decisions logged yet" hint="Once the family agrees on something, log it here so it doesn't get re-litigated." />
      ) : (
      <ul className="space-y-4">
        {items.map((d) => (
          <li key={d.id} className="rounded-lg border p-4" style={{ background: 'var(--card)', borderColor: 'var(--line)' }}>
            <div className="flex justify-between items-baseline gap-2">
              <h3 className="font-display text-lg" style={{ color: 'var(--clay)' }}>{d.title}</h3>
              <span className="text-xs shrink-0" style={{ color: 'var(--ink)' }}>
                {d.members?.name} · {new Date(d.created_at).toLocaleDateString()}
              </span>
            </div>
            {d.description && <p className="text-sm mt-1">{d.description}</p>}
            {d.decided_by === member.id && (
              <div className="mt-2 flex justify-end">
                <DeleteButton onDelete={() => handleDelete(d.id)} confirmText="Delete this decision?" />
              </div>
            )}
          </li>
        ))}
      </ul>
      )}
    </div>
  )
}

export default function Page() {
  return <Gate><DecisionsPage /></Gate>
}
