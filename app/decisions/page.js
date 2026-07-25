'use client'

import { useEffect, useState } from 'react'
import Gate from '@/components/Gate'
import { useAuth } from '@/lib/AuthProvider'
import { supabase } from '@/lib/supabaseClient'

function DecisionsPage() {
  const { member } = useAuth()
  const [items, setItems] = useState([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  async function load() {
    const { data } = await supabase
      .from('decisions')
      .select('*, members(name)')
      .order('created_at', { ascending: false })
    setItems(data || [])
  }

  useEffect(() => { load() }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    await supabase.from('decisions').insert({ title, description, decided_by: member.id })
    setTitle(''); setDescription('')
    load()
  }

  return (
    <div>
      <h1 className="font-display text-3xl mb-2" style={{ color: 'var(--pine-dark)' }}>Decisions log</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--ink)' }}>
        A running record so nobody has to re-argue settled ground.
      </p>

      <form onSubmit={handleSubmit} className="rounded-lg border p-5 mb-8" style={{ background: 'var(--card)', borderColor: 'var(--line)' }}>
        <label className="text-xs uppercase tracking-wide block mb-1" style={{ color: 'var(--pine-dark)' }}>What was decided</label>
        <input required value={title} onChange={(e) => setTitle(e.target.value)} className="w-full border rounded px-3 py-2 mb-3 bg-white" style={{ borderColor: 'var(--line)' }} />
        <label className="text-xs uppercase tracking-wide block mb-1" style={{ color: 'var(--pine-dark)' }}>Why / context</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full border rounded px-3 py-2 mb-3 bg-white" style={{ borderColor: 'var(--line)' }} />
        <button type="submit" className="rounded px-4 py-2 font-medium" style={{ background: 'var(--clay)', color: 'var(--card)' }}>
          Log decision
        </button>
      </form>

      <ul className="space-y-4">
        {items.map((d) => (
          <li key={d.id} className="rounded-lg border p-4" style={{ background: 'var(--card)', borderColor: 'var(--line)' }}>
            <div className="flex justify-between items-baseline">
              <h3 className="font-display text-lg" style={{ color: 'var(--clay)' }}>{d.title}</h3>
              <span className="text-xs" style={{ color: 'var(--ink)' }}>
                {d.members?.name} · {new Date(d.created_at).toLocaleDateString()}
              </span>
            </div>
            {d.description && <p className="text-sm mt-1">{d.description}</p>}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function Page() {
  return <Gate><DecisionsPage /></Gate>
}
