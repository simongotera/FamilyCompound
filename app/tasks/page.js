'use client'

import { useEffect, useState } from 'react'
import Gate from '@/components/Gate'
import { Loading, ErrorState } from '@/components/Loading'
import { DeleteButton } from '@/components/DeleteButton'
import { useAuth } from '@/lib/AuthProvider'
import { useLocale } from '@/lib/i18n/LocaleProvider'
import { supabase } from '@/lib/supabaseClient'

const STATUSES = ['open', 'in_progress', 'done']

function isOverdue(t) {
  return t.due_date && t.status !== 'done' && new Date(t.due_date) < new Date(new Date().toDateString())
}

function sortByDueDate(list) {
  return [...list].sort((a, b) => {
    if (!a.due_date && !b.due_date) return 0
    if (!a.due_date) return 1
    if (!b.due_date) return -1
    return new Date(a.due_date) - new Date(b.due_date)
  })
}

function TasksPage() {
  const { member } = useAuth()
  const { t } = useLocale()
  const [tasks, setTasks] = useState([])
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const statusLabel = {
    open: t('tasks.statusOpen'),
    in_progress: t('tasks.statusInProgress'),
    done: t('tasks.statusDone'),
  }

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
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        title,
        due_date: dueDate || null,
        owner_id: member.id,
        status: 'open',
      })
      .select('*, members(name)')
      .single()
    setSaving(false)
    if (error) { setError(error.message); return }
    setTasks((prev) => sortByDueDate([data, ...prev]))
    setTitle(''); setDueDate('')
  }

  async function updateStatus(id, status) {
    setTasks((prev) => prev.map((task) => (task.id === id ? { ...task, status } : task)))
    const { error } = await supabase.from('tasks').update({ status }).eq('id', id)
    if (error) { setError(error.message); load() }
  }

  async function handleDelete(id) {
    setTasks((prev) => prev.filter((task) => task.id !== id))
    const { error } = await supabase.from('tasks').delete().eq('id', id)
    if (error) { setError(error.message); load() }
  }

  return (
    <div>
      <h1 className="font-display text-3xl mb-2" style={{ color: 'var(--pine-dark)' }}>{t('tasks.title')}</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--ink)' }}>{t('tasks.subtitle')}</p>

      {error && <div className="mb-6"><ErrorState message={error} /></div>}

      <form onSubmit={handleSubmit} className="rounded-lg border p-5 mb-8 flex flex-wrap gap-3 items-end" style={{ background: 'var(--card)', borderColor: 'var(--line)' }}>
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs uppercase tracking-wide block mb-1" style={{ color: 'var(--pine-dark)' }}>{t('tasks.taskLabel')}</label>
          <input required value={title} onChange={(e) => setTitle(e.target.value)} className="w-full border rounded px-3 py-2 bg-white" style={{ borderColor: 'var(--line)' }} />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide block mb-1" style={{ color: 'var(--pine-dark)' }}>{t('tasks.dueDateLabel')}</label>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="border rounded px-3 py-2 bg-white" style={{ borderColor: 'var(--line)' }} />
        </div>
        <button type="submit" disabled={saving} className="rounded px-4 py-2 font-medium" style={{ background: 'var(--pine)', color: 'var(--card)' }}>
          {saving ? t('tasks.adding') : t('tasks.addTask')}
        </button>
      </form>

      {loading ? (
        <Loading />
      ) : (
        <div className="grid sm:grid-cols-3 gap-4">
          {STATUSES.map((status) => {
            const columnTasks = tasks.filter((task) => task.status === status)
            return (
              <div key={status}>
                <h3 className="font-display text-lg mb-2 flex items-center gap-2" style={{ color: 'var(--clay)' }}>
                  {statusLabel[status]}
                  <span className="text-xs font-sans font-normal" style={{ color: 'var(--ink)' }}>({columnTasks.length})</span>
                </h3>
                {columnTasks.length === 0 ? (
                  <p className="text-sm rounded-lg border border-dashed p-3" style={{ borderColor: 'var(--line)', color: 'var(--ink)' }}>{t('tasks.nothingHere')}</p>
                ) : (
                  <ul className="space-y-2">
                    {columnTasks.map((task) => (
                      <li key={task.id} className="rounded-lg border p-3 text-sm" style={{ background: 'var(--card)', borderColor: isOverdue(task) ? 'var(--clay)' : 'var(--line)' }}>
                        <div className="font-medium">{task.title}</div>
                        <div className="text-xs mt-1" style={{ color: isOverdue(task) ? 'var(--clay)' : 'var(--ink)' }}>
                          {task.members?.name}{task.due_date && ` · ${t('tasks.due')} ${new Date(task.due_date).toLocaleDateString()}`}{isOverdue(task) && ` · ${t('tasks.overdue')}`}
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-2">
                          <select
                            value={task.status}
                            onChange={(e) => updateStatus(task.id, e.target.value)}
                            className="text-xs border rounded px-2 py-1 bg-white"
                            style={{ borderColor: 'var(--line)' }}
                          >
                            {STATUSES.map((s) => <option key={s} value={s}>{statusLabel[s]}</option>)}
                          </select>
                          {task.owner_id === member.id && (
                            <DeleteButton onDelete={() => handleDelete(task.id)} confirmText={t('tasks.deleteConfirm')} />
                          )}
                        </div>
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
