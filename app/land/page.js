'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Gate from '@/components/Gate'
import { Loading, EmptyState, ErrorState } from '@/components/Loading'
import { DeleteButton } from '@/components/DeleteButton'
import { useAuth } from '@/lib/AuthProvider'
import { useLocale } from '@/lib/i18n/LocaleProvider'
import { supabase } from '@/lib/supabaseClient'

const COUNTRY_SELECT = 'name, flag_emoji, clear_path_citizenship, retiree_pathway, property_purchase_difficulty, healthcare_system'

const STATUS_COLORS = {
  considering: 'var(--ink)',
  favorite: 'var(--pine)',
  rejected: '#8a8a8a',
  offer_made: 'var(--clay)',
  purchased: 'var(--pine-dark)',
}

const FILTERS = ['all', 'considering', 'favorite', 'offer_made', 'purchased', 'rejected']

function emptyForm() {
  return {
    name: '', location: '', acreage: '', price: '', water_source: '',
    zoning: '', utilities: '', pros: '', cons: '', listing_url: '', status: 'considering', country_id: '',
  }
}

function LandPage() {
  const { member } = useAuth()
  const { t } = useLocale()
  const [options, setOptions] = useState([])
  const [countries, setCountries] = useState([])
  const [form, setForm] = useState(emptyForm())
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all')

  const statusLabels = {
    considering: t('land.statusConsidering'),
    favorite: t('land.statusFavorite'),
    rejected: t('land.statusRejected'),
    offer_made: t('land.statusOfferMade'),
    purchased: t('land.statusPurchased'),
  }

  async function load() {
    setLoading(true)
    setError(null)
    const [optionsRes, countriesRes] = await Promise.all([
      supabase.from('land_options').select(`*, countries(${COUNTRY_SELECT})`).order('created_at', { ascending: false }),
      supabase.from('countries').select('id, name, flag_emoji').order('name', { ascending: true }),
    ])
    if (optionsRes.error) setError(optionsRes.error.message)
    else setOptions(optionsRes.data || [])
    setCountries(countriesRes.data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    const { data, error } = await supabase
      .from('land_options')
      .insert({
        ...form,
        acreage: form.acreage ? Number(form.acreage) : null,
        price: form.price ? Number(form.price) : null,
        country_id: form.country_id || null,
        added_by: member.id,
      })
      .select(`*, countries(${COUNTRY_SELECT})`)
      .single()
    setSaving(false)
    if (error) { setError(error.message); return }
    setOptions((prev) => [data, ...prev])
    setForm(emptyForm())
    setShowForm(false)
  }

  async function updateStatus(id, status) {
    setOptions((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)))
    const { error } = await supabase.from('land_options').update({ status }).eq('id', id)
    if (error) { setError(error.message); load() }
  }

  async function handleDelete(id) {
    setOptions((prev) => prev.filter((o) => o.id !== id))
    const { error } = await supabase.from('land_options').delete().eq('id', id)
    if (error) { setError(error.message); load() }
  }

  const filtered = useMemo(
    () => (filter === 'all' ? options : options.filter((o) => o.status === filter)),
    [options, filter]
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl" style={{ color: 'var(--pine-dark)' }}>{t('land.title')}</h1>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded-full px-4 py-2 text-sm font-medium"
          style={{ background: 'var(--pine)', color: 'var(--card)' }}
        >
          {showForm ? t('common.cancel') : t('land.addParcel')}
        </button>
      </div>

      {error && <div className="mb-6"><ErrorState message={error} /></div>}

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-lg border p-5 mb-8 grid sm:grid-cols-2 gap-3" style={{ background: 'var(--card)', borderColor: 'var(--line)' }}>
          <Input label={t('land.nameLabel')} value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
          <Input label={t('land.locationLabel')} value={form.location} onChange={(v) => setForm({ ...form, location: v })} />
          <Input label={t('land.acreageLabel')} type="number" value={form.acreage} onChange={(v) => setForm({ ...form, acreage: v })} />
          <Input label={t('land.priceLabel')} type="number" value={form.price} onChange={(v) => setForm({ ...form, price: v })} />
          <Input label={t('land.waterSourceLabel')} value={form.water_source} onChange={(v) => setForm({ ...form, water_source: v })} />
          <Input label={t('land.zoningLabel')} value={form.zoning} onChange={(v) => setForm({ ...form, zoning: v })} />
          <Input label={t('land.utilitiesLabel')} value={form.utilities} onChange={(v) => setForm({ ...form, utilities: v })} />
          <Input label={t('land.listingUrlLabel')} value={form.listing_url} onChange={(v) => setForm({ ...form, listing_url: v })} />
          <div>
            <label className="text-xs uppercase tracking-wide block mb-1" style={{ color: 'var(--pine-dark)' }}>{t('land.countryLabel')}</label>
            <select
              value={form.country_id}
              onChange={(e) => setForm({ ...form, country_id: e.target.value })}
              className="w-full border rounded px-3 py-2 bg-white"
              style={{ borderColor: 'var(--line)' }}
            >
              <option value="">{t('land.countryNone')}</option>
              {countries.map((c) => (
                <option key={c.id} value={c.id}>{c.flag_emoji ? `${c.flag_emoji} ` : ''}{c.name}</option>
              ))}
            </select>
          </div>
          <Textarea label={t('land.prosLabel')} value={form.pros} onChange={(v) => setForm({ ...form, pros: v })} />
          <Textarea label={t('land.consLabel')} value={form.cons} onChange={(v) => setForm({ ...form, cons: v })} />
          <div className="sm:col-span-2">
            <button type="submit" disabled={saving} className="rounded px-4 py-2 font-medium" style={{ background: 'var(--clay)', color: 'var(--card)' }}>
              {saving ? t('land.saving') : t('land.saveParcel')}
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
              {f === 'all' ? t('land.filterAll', { count: options.length }) : statusLabels[f]}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <Loading />
      ) : options.length === 0 ? (
        <EmptyState title={t('land.emptyTitle')} hint={t('land.emptyHint')} />
      ) : filtered.length === 0 ? (
        <EmptyState title={t('land.emptyFilteredTitle')} hint={t('land.emptyFilteredHint')} />
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
                  <option value="considering">{statusLabels.considering}</option>
                  <option value="favorite">{statusLabels.favorite}</option>
                  <option value="rejected">{statusLabels.rejected}</option>
                  <option value="offer_made">{statusLabels.offer_made}</option>
                  <option value="purchased">{statusLabels.purchased}</option>
                </select>
              </div>
              <p className="text-sm mb-2" style={{ color: 'var(--ink)' }}>
                {o.location} {o.acreage ? `· ${o.acreage} ${t('land.acres')}` : ''} {o.price ? `· $${Number(o.price).toLocaleString()}` : ''}
              </p>
              {o.countries && (
                <div className="rounded-lg border p-3 mb-2" style={{ background: 'var(--paper)', borderColor: 'var(--line)' }}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">
                      {o.countries.flag_emoji && <span aria-hidden>{o.countries.flag_emoji} </span>}
                      {o.countries.name}
                    </span>
                    <Link href="/countries" className="text-xs underline shrink-0" style={{ color: 'var(--pine)' }}>{t('land.viewCountryProfile')}</Link>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-1.5">
                    {o.countries.clear_path_citizenship && (
                      <span className="text-xs rounded-full px-2 py-0.5 border" style={{ borderColor: 'var(--line)' }}>
                        {t('countries.field.clear_path_citizenship')}: {t(`countries.enum.clear_path_citizenship.${o.countries.clear_path_citizenship}`)}
                      </span>
                    )}
                    {o.countries.property_purchase_difficulty && (
                      <span className="text-xs rounded-full px-2 py-0.5 border" style={{ borderColor: 'var(--line)' }}>
                        {t('countries.field.property_purchase_difficulty')}: {t(`countries.enum.property_purchase_difficulty.${o.countries.property_purchase_difficulty}`)}
                      </span>
                    )}
                  </div>
                </div>
              )}
              {o.water_source && <p className="text-sm"><strong>{t('land.waterLabel')}</strong> {o.water_source}</p>}
              {o.zoning && <p className="text-sm"><strong>{t('land.zoningFieldLabel')}</strong> {o.zoning}</p>}
              {o.utilities && <p className="text-sm mb-2"><strong>{t('land.utilitiesFieldLabel')}</strong> {o.utilities}</p>}
              {o.pros && <p className="text-sm mt-2"><strong>{t('land.prosFieldLabel')}</strong> {o.pros}</p>}
              {o.cons && <p className="text-sm"><strong>{t('land.consFieldLabel')}</strong> {o.cons}</p>}
              {o.listing_url && (
                <a href={o.listing_url} target="_blank" rel="noreferrer" className="text-sm underline block mt-2" style={{ color: 'var(--pine)' }}>
                  {t('land.viewListing')}
                </a>
              )}
              {o.added_by === member.id && (
                <div className="mt-3 pt-3 border-t flex justify-end" style={{ borderColor: 'var(--line)' }}>
                  <DeleteButton onDelete={() => handleDelete(o.id)} label={t('land.deleteParcel')} confirmText={t('land.deleteConfirm', { name: o.name })} />
                </div>
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
