'use client'

import { useEffect, useState } from 'react'
import Gate from '@/components/Gate'
import { useAuth } from '@/lib/AuthProvider'
import { supabase } from '@/lib/supabaseClient'

function BudgetPage() {
  const { member } = useAuth()
  const [items, setItems] = useState([])
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')

  async function load() {
    const { data } = await supabase
      .from('budget_contributions')
      .select('*, members(name, household)')
      .order('created_at', { ascending: false })
    setItems(data || [])
  }

  useEffect(() => { load() }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    await supabase.from('budget_contributions').insert({
      member_id: member.id,
      amount: Number(amount),
      notes,
    })
    setAmount(''); setNotes('')
    load()
  }

  const total = items.reduce((sum, i) => sum + Number(i.amount), 0)
  const byPerson = items.reduce((acc, i) => {
    const key = i.members?.name || 'Unknown'
    acc[key] = (acc[key] || 0) + Number(i.amount)
    return acc
  }, {})

  return (
    <div>
      <h1 className="font-display text-3xl mb-2" style={{ color: 'var(--pine-dark)' }}>Budget</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--ink)' }}>
        What each household has committed toward the compound.
      </p>

      <div className="rounded-lg border p-5 mb-6 text-center" style={{ background: 'var(--card)', borderColor: 'var(--line)' }}>
        <div className="font-display text-4xl" style={{ color: 'var(--pine-dark)' }}>
          ${total.toLocaleString()}
        </div>
        <div className="text-xs uppercase tracking-wide mt-1" style={{ color: 'var(--ink)' }}>Total committed</div>
      </div>

      <div className="grid sm:grid-cols-2 gap-6 mb-8">
        <div>
          <h3 className="font-display text-lg mb-2" style={{ color: 'var(--clay)' }}>By household</h3>
          <ul className="space-y-1 text-sm">
            {Object.entries(byPerson).map(([name, amt]) => (
              <li key={name} className="flex justify-between border-b pb-1" style={{ borderColor: 'var(--line)' }}>
                <span>{name}</span>
                <span>${amt.toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </div>

        <form onSubmit={handleSubmit} className="rounded-lg border p-5" style={{ background: 'var(--card)', borderColor: 'var(--line)' }}>
          <h3 className="font-display text-lg mb-3" style={{ color: 'var(--clay)' }}>Log a contribution</h3>
          <label className="text-xs uppercase tracking-wide block mb-1" style={{ color: 'var(--pine-dark)' }}>Amount ($)</label>
          <input required type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full border rounded px-3 py-2 mb-3 bg-white" style={{ borderColor: 'var(--line)' }} />
          <label className="text-xs uppercase tracking-wide block mb-1" style={{ color: 'var(--pine-dark)' }}>Notes</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. initial deposit" className="w-full border rounded px-3 py-2 mb-3 bg-white" style={{ borderColor: 'var(--line)' }} />
          <button type="submit" className="rounded px-4 py-2 font-medium" style={{ background: 'var(--pine)', color: 'var(--card)' }}>
            Add
          </button>
        </form>
      </div>

      <h3 className="font-display text-lg mb-2" style={{ color: 'var(--clay)' }}>History</h3>
      <ul className="space-y-1 text-sm">
        {items.map((i) => (
          <li key={i.id} className="flex justify-between border-b pb-1" style={{ borderColor: 'var(--line)' }}>
            <span>{i.members?.name} {i.notes && `— ${i.notes}`}</span>
            <span>${Number(i.amount).toLocaleString()}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function Page() {
  return <Gate><BudgetPage /></Gate>
}
