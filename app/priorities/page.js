'use client'

import { useEffect, useState } from 'react'
import Gate from '@/components/Gate'
import { useAuth } from '@/lib/AuthProvider'
import { supabase } from '@/lib/supabaseClient'

function PrioritiesPage() {
  const { member } = useAuth()
  const [items, setItems] = useState([])
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [isDealbreaker, setIsDealbreaker] = useState(false)

  async function load() {
    const { data } = await supabase
      .from('priorities')
      .select('*, members(name, household)')
      .order('created_at', { ascending: false })
    setItems(data || [])
  }

  useEffect(() => { load() }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    await supabase.from('priorities').insert({
      member_id: member.id,
      category,
      description,
      is_dealbreaker: isDealbreaker,
    })
    setCategory(''); setDescription(''); setIsDealbreaker(false)
    load()
  }

  const grouped = items.reduce((acc, i) => {
    const key = i.members?.name || 'Unknown'
    acc[key] = acc[key] || []
    acc[key].push(i)
    return acc
  }, {})

  return (
    <div>
      <h1 className="font-display text-3xl mb-2" style={{ color: 'var(--pine-dark)' }}>Priorities & dealbreakers</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--ink)' }}>
        Everyone sees everyone else's — this is how conflicts surface early instead of at closing.
      </p>

      <form onSubmit={handleSubmit} className="rounded-lg border p-5 mb-8 grid sm:grid-cols-4 gap-3 items-end" style={{ background: 'var(--card)', borderColor: 'var(--line)' }}>
        <div>
          <label className="text-xs uppercase tracking-wide block mb-1" style={{ color: 'var(--pine-dark)' }}>Category</label>
          <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. budget" className="w-full border rounded px-3 py-2 bg-white" style={{ borderColor: 'var(--line)' }} />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs uppercase tracking-wide block mb-1" style={{ color: 'var(--pine-dark)' }}>What matters to you</label>
          <input required value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. needs reliable cell signal" className="w-full border rounded px-3 py-2 bg-white" style={{ borderColor: 'var(--line)' }} />
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" checked={isDealbreaker} onChange={(e) => setIsDealbreaker(e.target.checked)} id="db" />
          <label htmlFor="db" className="text-sm">Dealbreaker</label>
        </div>
        <button type="submit" className="rounded px-4 py-2 font-medium sm:col-span-4 justify-self-start" style={{ background: 'var(--clay)', color: 'var(--card)' }}>
          Add
        </button>
      </form>

      {Object.keys(grouped).length === 0 ? (
        <p style={{ color: 'var(--ink)' }}>Nobody's added their priorities yet.</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {Object.entries(grouped).map(([name, list]) => (
            <div key={name} className="rounded-lg border p-5" style={{ background: 'var(--card)', borderColor: 'var(--line)' }}>
              <h2 className="font-display text-xl mb-2" style={{ color: 'var(--clay)' }}>{name}</h2>
              <ul className="space-y-2">
                {list.map((i) => (
                  <li key={i.id} className="text-sm">
                    {i.is_dealbreaker && <span className="text-xs font-semibold uppercase mr-2" style={{ color: 'var(--clay)' }}>Dealbreaker</span>}
                    {i.category && <span className="italic mr-1">[{i.category}]</span>}
                    {i.description}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Page() {
  return <Gate><PrioritiesPage /></Gate>
}
