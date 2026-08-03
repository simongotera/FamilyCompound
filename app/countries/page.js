'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Gate from '@/components/Gate'
import { Loading, EmptyState, ErrorState } from '@/components/Loading'
import { DeleteButton } from '@/components/DeleteButton'
import { useAuth } from '@/lib/AuthProvider'
import { useLocale } from '@/lib/i18n/LocaleProvider'
import { supabase } from '@/lib/supabaseClient'
import { ENUM_OPTIONS, FILTER_FIELDS, SUMMARY_FIELDS, SECTIONS, emptyCountryForm } from '@/lib/countryFields'

const BADGE_COLORS = {
  yes: 'var(--pine)', easy: 'var(--pine)', universal: 'var(--pine)', low: 'var(--pine)', strong: 'var(--pine)', very_safe: 'var(--pine)',
  income_based: 'var(--pine)', ancestry: 'var(--pine)',
  complex: 'var(--clay)', moderate: 'var(--clay)', family_sponsorship: 'var(--clay)', sponsorship_lottery: 'var(--clay)', mixed: 'var(--clay)',
  no: '#8a8a8a', hard: '#8a8a8a', restricted: '#8a8a8a', high: '#8a8a8a', minimal: '#8a8a8a', visitor_only: '#8a8a8a', none: '#8a8a8a', unstable: '#8a8a8a', private: '#8a8a8a', caution: '#8a8a8a',
}

function badgeColor(value) {
  return BADGE_COLORS[value] || 'var(--ink)'
}

function CountriesPage() {
  const { member } = useAuth()
  const { t, locale } = useLocale()
  const [countries, setCountries] = useState([])
  const [parcelsByCountry, setParcelsByCountry] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyCountryForm())
  const [expandedId, setExpandedId] = useState(null)
  const [filters, setFilters] = useState({})

  async function load() {
    setLoading(true)
    setError(null)
    const [countriesRes, parcelsRes] = await Promise.all([
      supabase.from('countries').select('*').order('name', { ascending: true }),
      supabase.from('land_options').select('id, name, country_id').not('country_id', 'is', null),
    ])
    if (countriesRes.error) setError(countriesRes.error.message)
    else setCountries(countriesRes.data || [])
    const grouped = {}
    for (const p of parcelsRes.data || []) {
      grouped[p.country_id] = grouped[p.country_id] || []
      grouped[p.country_id].push(p)
    }
    setParcelsByCountry(grouped)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function fieldLabel(name) {
    return t(`countries.field.${name}`)
  }

  function enumLabel(fieldName, value) {
    if (!value) return null
    return t(`countries.enum.${fieldName}.${value}`)
  }

  function updateField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  function startAdd() {
    setForm(emptyCountryForm())
    setEditingId(null)
    setShowForm(true)
  }

  function startEdit(country) {
    const next = emptyCountryForm()
    for (const key of Object.keys(next)) {
      if (country[key] !== null && country[key] !== undefined) next[key] = country[key]
    }
    setForm(next)
    setEditingId(country.id)
    setShowForm(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    const payload = { ...form }
    for (const key of Object.keys(payload)) {
      if (payload[key] === '') payload[key] = null
    }
    payload.citizenship_timeline_years = payload.citizenship_timeline_years ? Number(payload.citizenship_timeline_years) : null
    payload.annual_rainy_days = payload.annual_rainy_days ? Number(payload.annual_rainy_days) : null
    payload.annual_sunny_days = payload.annual_sunny_days ? Number(payload.annual_sunny_days) : null

    if (editingId) {
      payload.updated_by = member.id
      payload.updated_at = new Date().toISOString()
      const { data, error } = await supabase.from('countries').update(payload).eq('id', editingId).select().single()
      setSaving(false)
      if (error) { setError(error.message); return }
      setCountries((prev) => prev.map((c) => (c.id === editingId ? data : c)).sort((a, b) => a.name.localeCompare(b.name)))
    } else {
      payload.added_by = member.id
      const { data, error } = await supabase.from('countries').insert(payload).select().single()
      setSaving(false)
      if (error) { setError(error.message); return }
      setCountries((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    }
    setShowForm(false)
    setEditingId(null)
    setForm(emptyCountryForm())
  }

  async function handleDelete(id) {
    setCountries((prev) => prev.filter((c) => c.id !== id))
    const { error } = await supabase.from('countries').delete().eq('id', id)
    if (error) { setError(error.message); load() }
  }

  const filtered = useMemo(
    () => countries.filter((c) => FILTER_FIELDS.every((f) => !filters[f] || c[f] === filters[f])),
    [countries, filters]
  )
  const hasActiveFilters = Object.values(filters).some(Boolean)

  return (
    <div>
      <div className="flex items-center justify-between mb-2 gap-3">
        <h1 className="font-display text-3xl" style={{ color: 'var(--pine-dark)' }}>{t('countries.title')}</h1>
        <button
          onClick={() => (showForm ? setShowForm(false) : startAdd())}
          className="rounded-full px-4 py-2 text-sm font-medium shrink-0"
          style={{ background: 'var(--pine)', color: 'var(--card)' }}
        >
          {showForm ? t('common.cancel') : t('countries.addCountry')}
        </button>
      </div>
      <p className="text-sm mb-6" style={{ color: 'var(--ink)' }}>{t('countries.subtitle')}</p>

      {error && <div className="mb-6"><ErrorState message={error} /></div>}

      {showForm && (
        <CountryForm
          form={form}
          updateField={updateField}
          onSubmit={handleSubmit}
          onCancel={() => { setShowForm(false); setEditingId(null) }}
          saving={saving}
          isEditing={!!editingId}
          t={t}
          fieldLabel={fieldLabel}
        />
      )}

      {!loading && countries.length > 0 && (
        <div className="rounded-lg border p-4 mb-6" style={{ background: 'var(--card)', borderColor: 'var(--line)' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase tracking-wide font-semibold" style={{ color: 'var(--pine-dark)' }}>{t('countries.filtersLabel')}</span>
            {hasActiveFilters && (
              <button onClick={() => setFilters({})} className="text-xs underline" style={{ color: 'var(--clay)' }}>{t('countries.clearFilters')}</button>
            )}
          </div>
          <div className="grid sm:grid-cols-3 md:grid-cols-5 gap-2">
            {FILTER_FIELDS.map((f) => (
              <select
                key={f}
                value={filters[f] || ''}
                onChange={(e) => setFilters((prev) => ({ ...prev, [f]: e.target.value || undefined }))}
                className="text-xs border rounded px-2 py-1.5 bg-white"
                style={{ borderColor: 'var(--line)' }}
              >
                <option value="">{fieldLabel(f)}: {t('countries.filterAny')}</option>
                {ENUM_OPTIONS[f].map((v) => (
                  <option key={v} value={v}>{enumLabel(f, v)}</option>
                ))}
              </select>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <Loading />
      ) : countries.length === 0 ? (
        <EmptyState title={t('countries.emptyTitle')} hint={t('countries.emptyHint')} />
      ) : filtered.length === 0 ? (
        <EmptyState title={t('countries.emptyFilteredTitle')} hint={t('countries.emptyFilteredHint')} />
      ) : (
        <div className="grid gap-4">
          {filtered.map((country) => (
            <CountryCard
              key={country.id}
              country={country}
              parcels={parcelsByCountry[country.id] || []}
              expanded={expandedId === country.id}
              onToggle={() => setExpandedId(expandedId === country.id ? null : country.id)}
              onEdit={() => startEdit(country)}
              onDelete={() => handleDelete(country.id)}
              t={t}
              locale={locale}
              fieldLabel={fieldLabel}
              enumLabel={enumLabel}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function CountryCard({ country, parcels, expanded, onToggle, onEdit, onDelete, t, locale, fieldLabel, enumLabel }) {
  return (
    <div className="rounded-lg border p-5" style={{ background: 'var(--card)', borderColor: 'var(--line)' }}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="font-display text-2xl flex items-center gap-2" style={{ color: 'var(--clay)' }}>
            {country.flag_emoji && <span aria-hidden>{country.flag_emoji}</span>}
            {country.name}
          </h2>
          {country.region && <p className="text-xs mt-0.5" style={{ color: 'var(--ink)' }}>{country.region}</p>}
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={onEdit} className="text-xs underline decoration-dotted underline-offset-4" style={{ color: 'var(--pine)' }}>{t('countries.editCountry')}</button>
          <DeleteButton onDelete={onDelete} label={t('countries.deleteCountry')} confirmText={t('countries.deleteConfirm', { name: country.name })} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {SUMMARY_FIELDS.map((f) => (
          country[f] ? (
            <span
              key={f}
              className="text-xs rounded-full px-2.5 py-1 border"
              style={{ borderColor: badgeColor(country[f]), color: badgeColor(country[f]) }}
            >
              {fieldLabel(f)}: {enumLabel(f, country[f])}
            </span>
          ) : null
        ))}
      </div>

      <button onClick={onToggle} className="text-sm underline" style={{ color: 'var(--pine)' }}>
        {expanded ? t('countries.hideDetails') : t('countries.viewDetails')}
      </button>

      {expanded && (
        <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--line)' }}>
          {SECTIONS.map((section) => (
            <div key={section.titleKey} className="mb-5">
              <h3 className="font-display text-lg mb-2" style={{ color: 'var(--pine-dark)' }}>{t(section.titleKey)}</h3>
              <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                {section.fields.map((field) => {
                  const value = country[field.name]
                  if (value === null || value === undefined || value === '') return null
                  const display =
                    field.kind === 'enum' ? enumLabel(field.name, value) :
                    field.kind === 'boolean' ? (value ? t('common.yes') : t('common.no')) :
                    value
                  const isLongText = field.kind === 'notes' || field.kind === 'longtext'
                  return (
                    <div key={field.name} className={isLongText ? 'sm:col-span-2' : ''}>
                      <dt className="text-xs uppercase tracking-wide" style={{ color: 'var(--pine-dark)' }}>
                        {field.kind === 'notes' ? t('countries.notesLabel') : fieldLabel(field.name)}
                      </dt>
                      <dd className={isLongText ? 'text-sm italic' : 'font-medium'}>{display}</dd>
                    </div>
                  )
                })}
              </dl>
            </div>
          ))}

          <div>
            <h3 className="font-display text-lg mb-2" style={{ color: 'var(--pine-dark)' }}>{t('countries.parcelsInCountry')}</h3>
            {parcels.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--ink)' }}>{t('countries.noParcelsYet')}</p>
            ) : (
              <ul className="text-sm space-y-1">
                {parcels.map((p) => (
                  <li key={p.id}>
                    <Link href="/land" className="underline" style={{ color: 'var(--pine)' }}>{p.name}</Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {country.updated_at && (
            <p className="text-xs mt-4" style={{ color: 'var(--ink)' }}>
              {t('countries.lastUpdated', { date: new Date(country.updated_at).toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-US') })}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function CountryForm({ form, updateField, onSubmit, onCancel, saving, isEditing, t, fieldLabel }) {
  return (
    <form onSubmit={onSubmit} className="rounded-lg border p-5 mb-8" style={{ background: 'var(--card)', borderColor: 'var(--line)' }}>
      <h3 className="font-display text-lg mb-4" style={{ color: 'var(--clay)' }}>
        {isEditing ? t('countries.editTitle') : t('countries.addTitle')}
      </h3>

      <div className="mb-5">
        <h4 className="font-display text-base mb-2" style={{ color: 'var(--pine-dark)' }}>{t('countries.sectionBasics')}</h4>
        <div className="grid sm:grid-cols-3 gap-3">
          <TextInput label={fieldLabel('name')} value={form.name} onChange={(v) => updateField('name', v)} required />
          <TextInput label={fieldLabel('flag_emoji')} value={form.flag_emoji} onChange={(v) => updateField('flag_emoji', v)} />
          <TextInput label={fieldLabel('region')} value={form.region} onChange={(v) => updateField('region', v)} />
        </div>
      </div>

      {SECTIONS.map((section) => (
        <div key={section.titleKey} className="mb-5">
          <h4 className="font-display text-base mb-2" style={{ color: 'var(--pine-dark)' }}>{t(section.titleKey)}</h4>
          <div className="grid sm:grid-cols-2 gap-3">
            {section.fields.map((field) => {
              const label = field.kind === 'notes' ? t('countries.notesLabel') : fieldLabel(field.name)
              if (field.kind === 'enum') {
                return (
                  <EnumInput
                    key={field.name}
                    label={label}
                    value={form[field.name]}
                    onChange={(v) => updateField(field.name, v)}
                    fieldName={field.name}
                    t={t}
                  />
                )
              }
              if (field.kind === 'boolean') {
                return (
                  <label key={field.name} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={!!form[field.name]} onChange={(e) => updateField(field.name, e.target.checked)} />
                    {label}
                  </label>
                )
              }
              if (field.kind === 'notes' || field.kind === 'longtext') {
                return <NotesInput key={field.name} label={label} value={form[field.name]} onChange={(v) => updateField(field.name, v)} />
              }
              return (
                <TextInput
                  key={field.name}
                  label={label}
                  type={field.kind === 'number' ? 'number' : 'text'}
                  value={form[field.name]}
                  onChange={(v) => updateField(field.name, v)}
                />
              )
            })}
          </div>
        </div>
      ))}

      <div className="flex gap-3">
        <button type="submit" disabled={saving} className="rounded px-4 py-2 font-medium" style={{ background: 'var(--clay)', color: 'var(--card)' }}>
          {saving ? t('countries.saving') : t('countries.saveCountry')}
        </button>
        <button type="button" onClick={onCancel} className="rounded px-4 py-2 font-medium border" style={{ borderColor: 'var(--line)', color: 'var(--ink)' }}>
          {t('countries.cancelEdit')}
        </button>
      </div>
    </form>
  )
}

function TextInput({ label, value, onChange, type = 'text', required = false }) {
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

function NotesInput({ label, value, onChange }) {
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

function EnumInput({ label, value, onChange, fieldName, t }) {
  return (
    <div>
      <label className="text-xs uppercase tracking-wide block mb-1" style={{ color: 'var(--pine-dark)' }}>{label}</label>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border rounded px-3 py-2 bg-white"
        style={{ borderColor: 'var(--line)' }}
      >
        <option value="">—</option>
        {ENUM_OPTIONS[fieldName].map((v) => (
          <option key={v} value={v}>{t(`countries.enum.${fieldName}.${v}`)}</option>
        ))}
      </select>
    </div>
  )
}

export default function Page() {
  return <Gate><CountriesPage /></Gate>
}
