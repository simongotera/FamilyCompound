'use client'

import { useEffect, useState } from 'react'
import Gate from '@/components/Gate'
import { Loading, ErrorState } from '@/components/Loading'
import { useAuth } from '@/lib/AuthProvider'
import { supabase } from '@/lib/supabaseClient'

const STATUSES = ['open', 'in_progress', 'done']
const STATUS_LABEL = { open: 'Open', in_progress: 'In progress', done: 'Done' }

function isOverdue(t) {
  return t.due_date && t.status !== 'done' && new Date(t.due_date) < new Date(new Date().toDateString())
}

function TasksPage() {
  const { member } = useAuth()
  const [tasks, setTasks] = useState([])
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function load() {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('tasks')
      .select('*, members(name)')
      .order('due_date', { ascending: true, nullsFirst: false })
    if (error) setError(error.message)
    else setTasks(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('tasks').insert({
      title,
      due_date: dueDate || null,
      owner_id: member.id,
      status: 'open',
    })
    setSaving(false)
    if (error) { setError(error.message); return }
    setTitle(''); setDueDate('')
    load()
  }

  async function updateStatus(id, status) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)))
    const { error } = await supabase.from('tasks').update({ status }).eq('id', id)
    if (error) { setError(error.message); load() }
  }

  return (
    <div>
      <h1 className="font-display text-3xl mb-2" style={{ color: 'var(--pine-dark)' }}>Tasks</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--ink)' }}>What&apos;s next, and who&apos;s got it.</p>

      {error && <div className="mb-6"><ErrorState message={error} /></div>}

      <form onSubmit={handleSubmit} className="rounded-lg border p-5 mb-8 flex flex-wrap gap-3 items-end" style={{ background: 'var(--card)', borderColor: 'var(--line)' }}>
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs uppercase tracking-wide block mb-1" style={{ color: 'var(--pine-dark)' }}>Task</label>
          <input required value={title} onChange={(e) => setTitle(e.target.value)} className="w-full border rounded px-3 py-2 bg-white" style={{ borderColor: 'var(--line)' }} />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide block mb-1" style={{ color: 'var(--pine-dark)' }}>Due date</label>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="border rounded px-3 py-2 bg-white" style={{ borderColor: 'var(--line)' }} />
        </div>
        <button type="submit" disabled={saving} className="rounded px-4 py-2 font-medium" style={{ background: 'var(--pine)', color: 'var(--card)' }}>
          {saving ? 'Adding…' : 'Add task'}
        </button>
      </form>

      {loading ? (
        <Loading />
      ) : (
        <div className="grid sm:grid-cols-3 gap-4">
          {STATUSES.map((status) => {
            const columnTasks = tasks.filter((t) => t.status === status)
            return (
              <div key={status}>
                <h3 className="font-display text-lg mb-2 flex items-center gap-2" style={{ color: 'var(--clay)' }}>
                  {STATUS_LABEL[status]}
                  <span className="text-xs font-sans font-normal" style={{ color: 'var(--ink)' }}>({columnTasks.length})</span>
                </h3>
                {columnTasks.length === 0 ? (
                  <p className="text-sm rounded-lg border border-dashed p-3" style={{ borderColor: 'var(--line)', color: 'var(--ink)' }}>Nothing here</p>
                ) : (
                  <ul className="space-y-2">
                    {columnTasks.map((t) => (
                      <li key={t.id} className="rounded-lg border p-3 text-sm" style={{ background: 'var(--card)', borderColor: isOverdue(t) ? 'var(--clay)' : 'var(--line)' }}>
                        <div className="font-medium">{t.title}</div>
                        <div className="text-xs mt-1" style={{ color: isOverdue(t) ? 'var(--clay)' : 'var(--ink)' }}>
                          {t.members?.name}{t.due_date && ` · due ${new Date(t.due_date).toLocaleDateString()}`}{isOverdue(t) && ' · overdue'}
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
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function Page() {
  return <Gate><TasksPage /></Gate>
}
