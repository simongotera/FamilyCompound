'use client'

import { useEffect, useState } from 'react'
import Gate from '@/components/Gate'
import { useAuth } from '@/lib/AuthProvider'
import { supabase } from '@/lib/supabaseClient'

const STATUSES = ['open', 'in_progress', 'done']
const STATUS_LABEL = { open: 'Open', in_progress: 'In progress', done: 'Done' }

function TasksPage() {
  const { member } = useAuth()
  const [tasks, setTasks] = useState([])
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')

  async function load() {
    const { data } = await supabase
      .from('tasks')
      .select('*, members(name)')
      .order('due_date', { ascending: true, nullsFirst: false })
    setTasks(data || [])
  }

  useEffect(() => { load() }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    await supabase.from('tasks').insert({
      title,
      due_date: dueDate || null,
      owner_id: member.id,
      status: 'open',
    })
    setTitle(''); setDueDate('')
    load()
  }

  async function updateStatus(id, status) {
    await supabase.from('tasks').update({ status }).eq('id', id)
    load()
  }

  return (
    <div>
      <h1 className="font-display text-3xl mb-2" style={{ color: 'var(--pine-dark)' }}>Tasks</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--ink)' }}>What's next, and who's got it.</p>

      <form onSubmit={handleSubmit} className="rounded-lg border p-5 mb-8 flex flex-wrap gap-3 items-end" style={{ background: 'var(--card)', borderColor: 'var(--line)' }}>
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs uppercase tracking-wide block mb-1" style={{ color: 'var(--pine-dark)' }}>Task</label>
          <input required value={title} onChange={(e) => setTitle(e.target.value)} className="w-full border rounded px-3 py-2 bg-white" style={{ borderColor: 'var(--line)' }} />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide block mb-1" style={{ color: 'var(--pine-dark)' }}>Due date</label>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="border rounded px-3 py-2 bg-white" style={{ borderColor: 'var(--line)' }} />
        </div>
        <button type="submit" className="rounded px-4 py-2 font-medium" style={{ background: 'var(--pine)', color: 'var(--card)' }}>
          Add task
        </button>
      </form>

      <div className="grid sm:grid-cols-3 gap-4">
        {STATUSES.map((status) => (
          <div key={status}>
            <h3 className="font-display text-lg mb-2" style={{ color: 'var(--clay)' }}>{STATUS_LABEL[status]}</h3>
            <ul className="space-y-2">
              {tasks.filter((t) => t.status === status).map((t) => (
                <li key={t.id} className="rounded-lg border p-3 text-sm" style={{ background: 'var(--card)', borderColor: 'var(--line)' }}>
                  <div className="font-medium">{t.title}</div>
                  <div className="text-xs mt-1" style={{ color: 'var(--ink)' }}>
                    {t.members?.name}{t.due_date && ` · due ${new Date(t.due_date).toLocaleDateString()}`}
                  </div>
                  <select
                    value={t.status}
                    onChange={(e) => updateStatus(t.id, e.target.value)}
                    className="text-xs mt-2 border rounded px-2 py-1 bg-white"
                    style={{ borderColor: 'var(--line)' }}
                  >
                    {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                  </select>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Page() {
  return <Gate><TasksPage /></Gate>
}
