'use client'

import { useEffect, useMemo, useState } from 'react'
import Gate from '@/components/Gate'
import { Loading, EmptyState, ErrorState } from '@/components/Loading'
import { useAuth } from '@/lib/AuthProvider'
import { supabase } from '@/lib/supabaseClient'

const STATUS_COLORS = {
  considering: 'var(--ink)',
  favorite: 'var(--pine)',
  rejected: '#8a8a8a',
  offer_made: 'var(--clay)',
  purchased: 'var(--pine-dark)',
}

const STATUS_LABELS = {
  considering: 'Considering',
  favorite: 'Favorite',
  rejected: 'Rejected',
  offer_made: 'Offer made',
  purchased: 'Purchased',
}

const FILTERS = ['all', 'considering', 'favorite', 'offer_made', 'purchased', 'rejected']

function emptyForm() {
  return {
    name: '', location: '', acreage: '', price: '', water_source: '',
    zoning: '', utilities: '', pros: '', cons: '', listing_url: '', status: 'considering',
  }
}

function LandPage() {
  const { member } = useAuth()
  const [options, setOptions] = useState([])
  const [form, setForm] = useState(emptyForm())
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all')

  async function load() {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase.from('land_options').select('*').order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setOptions(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('land_options').insert({
      ...form,
      acreage: form.acreage ? Number(form.acreage) : null,
      price: form.price ? Number(form.price) : null,
      added_by: member.id,
    })
    setSaving(false)
    if (error) { setError(error.message); return }
    setForm(emptyForm())
    setShowForm(false)
    load()
  }

  async function updateStatus(id, status) {
    setOptions((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)))
    const { error } = await supabase.from('land_options').update({ status }).eq('id', id)
    if (error) { setError(error.message); load() }
  }

  const filtered = useMemo(
    () => (filter === 'all' ? options : options.filter((o) => o.status === filter)),
    [options, filter]
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl" style={{ color: 'var(--pine-dark)' }}>Land options</h1>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded-full px-4 py-2 text-sm font-medium"
          style={{ background: 'var(--pine)', color: 'var(--card)' }}
        >
          {showForm ? 'Cancel' : '+ Add parcel'}
        </button>
      </div>

      {error && <div className="mb-6"><ErrorState message={error} /></div>}

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-lg border p-5 mb-8 grid sm:grid-cols-2 gap-3" style={{ background: 'var(--card)', borderColor: 'var(--line)' }}>
          <Input label="Name / nickname" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
          <Input label="Location" value={form.location} onChange={(v) => setForm({ ...form, location: v })} />
          <Input label="Acreage" type="number" value={form.acreage} onChange={(v) => setForm({ ...form, acreage: v })} />
          <Input label="Price ($)" type="number" value={form.price} onChange={(v) => setForm({ ...form, price: v })} />
          <Input label="Water source" value={form.water_source} onChange={(v) => setForm({ ...form, water_source: v })} />
          <Input label="Zoning" value={form.zoning} onChange={(v) => setForm({ ...form, zoning: v })} />
          <Input label="Utilities" value={form.utilities} onChange={(v) => setForm({ ...form, utilities: v })} />
          <Input label="Listing URL" value={form.listing_url} onChange={(v) => setForm({ ...form, listing_url: v })} />
          <Textarea label="Pros" value={form.pros} onChange={(v) => setForm({ ...form, pros: v })} />
          <Textarea label="Cons" value={form.cons} onChange={(v) => setForm({ ...form, cons: v })} />
          <div className="sm:col-span-2">
            <button type="submit" disabled={saving} className="rounded px-4 py-2 font-medium" style={{ background: 'var(--clay)', color: 'var(--card)' }}>
              {saving ? 'Saving…' : 'Save parcel'}
            </button>
          </div>
        </form>
      )}

      {!loading && options.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-3 py-1 rounded-full text-xs font-medium border"
              style={{
                background: filter === f ? 'var(--pine)' : 'transparent',
                color: filter === f ? 'var(--card)' : 'var(--ink)',
                borderColor: filter === f ? 'var(--pine)' : 'var(--line)',
              }}
            >
              {f === 'all' ? `All (${options.length})` : STATUS_LABELS[f]}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <Loading />
      ) : options.length === 0 ? (
        <EmptyState title="No parcels yet" hint="Add the first one being considered." />
      ) : filtered.length === 0 ? (
        <EmptyState title="Nothing in this view" hint="Try a different filter above." />
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {filtered.map((o) => (
            <div key={o.id} className="rounded-lg border p-5" style={{ background: 'var(--card)', borderColor: 'var(--line)' }}>
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-display text-xl" style={{ color: 'var(--clay)' }}>{o.name}</h2>
                <select
                  value={o.status}
                  onChange={(e) => updateStatus(o.id, e.target.value)}
                  className="text-xs rounded-full px-2 py-1 border bg-white"
                  style={{ borderColor: 'var(--line)', color: STATUS_COLORS[o.status] }}
                >
                  <option value="considering">Considering</option>
                  <option value="favorite">Favorite</option>
                  <option value="rejected">Rejected</option>
                  <option value="offer_made">Offer made</option>
                  <option value="purchased">Purchased</option>
                </select>
              </div>
              <p className="text-sm mb-2" style={{ color: 'var(--ink)' }}>
                {o.location} {o.acreage ? `· ${o.acreage} acres` : ''} {o.price ? `· $${Number(o.price).toLocaleString()}` : ''}
              </p>
              {o.water_source && <p className="text-sm"><strong>Water:</strong> {o.water_source}</p>}
              {o.zoning && <p className="text-sm"><strong>Zoning:</strong> {o.zoning}</p>}
              {o.utilities && <p className="text-sm mb-2"><strong>Utilities:</strong> {o.utilities}</p>}
              {o.pros && <p className="text-sm mt-2"><strong>Pros:</strong> {o.pros}</p>}
              {o.cons && <p className="text-sm"><strong>Cons:</strong> {o.cons}</p>}
              {o.listing_url && (
                <a href={o.listing_url} target="_blank" rel="noreferrer" className="text-sm underline block mt-2" style={{ color: 'var(--pine)' }}>
                  View listing
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Input({ label, value, onChange, type = 'text', required = false }) {
  return (
    <div>
      <label className="text-xs uppercase tracking-wide block mb-1" style={{ color: 'var(--pine-dark)' }}>{label}</label>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border rounded px-3 py-2 bg-white"
        style={{ borderColor: 'var(--line)' }}
      />
    </div>
  )
}

function Textarea({ label, value, onChange }) {
  return (
    <div className="sm:col-span-2">
      <label className="text-xs uppercase tracking-wide block mb-1" style={{ color: 'var(--pine-dark)' }}>{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className="w-full border rounded px-3 py-2 bg-white"
        style={{ borderColor: 'var(--line)' }}
      />
    </div>
  )
}

export default function Page() {
  return <Gate><LandPage /></Gate>
}
