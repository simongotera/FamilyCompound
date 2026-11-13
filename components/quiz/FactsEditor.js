'use client'

import { useMemo, useState } from 'react'
import { useLocale } from '@/lib/i18n/LocaleProvider'
import { CRITERIA, CRITERION_IDS, RATING_SCALE } from '@/lib/quiz/criteria'
import { Card, SectionTitle, PrimaryButton, Pill } from './ui'
import { DeleteButton } from '@/components/DeleteButton'

// Where the quiz's numbers come from: a member researches one criterion for one country or parcel
// and records a rating WITH a source. Sourced facts always beat the country-profile proxy.
export default function FactsEditor({ matrix, facts, memberId, onAdd, onDelete, saving }) {
  const { t } = useLocale()
  const name = (id) => t(`quiz.criteria.${id}.name`)
  const [form, setForm] = useState({ target: '', criterion: CRITERION_IDS[0], rating: '3', value_text: '', source: '', notes: '' })
  const [error, setError] = useState(null)

  const byTarget = useMemo(() => {
    const map = {}
    for (const f of facts) {
      const key = f.target_type === 'country' ? `country:${f.country_id}` : `parcel:${f.land_option_id}`
      map[key] = map[key] || []
      map[key].push(f)
    }
    return map
  }, [facts])

  function submit(e) {
    e.preventDefault()
    setError(null)
    if (!form.target) { setError(t('quiz.facts.pickTarget')); return }
    if (form.source.trim().length < 3) { setError(t('quiz.facts.sourceRequired')); return }
    const [targetType, targetId] = form.target.split(':')
    onAdd({
      target_type: targetType === 'country' ? 'country' : 'parcel',
      target_id: targetId,
      criterion: form.criterion,
      rating: Number(form.rating),
      value_text: form.value_text,
      source: form.source,
      notes: form.notes,
    })
    setForm((f) => ({ ...f, value_text: '', source: '', notes: '' }))
  }

  return (
    <div className="space-y-6">
      <SectionTitle hint={t('quiz.facts.hint')}>{t('quiz.facts.title')}</SectionTitle>

      <Card>
        <form onSubmit={submit} className="grid sm:grid-cols-2 gap-3">
          <label className="text-sm">
            <span className="text-xs uppercase tracking-wide block mb-1" style={{ color: 'var(--pine-dark)' }}>{t('quiz.facts.target')}</span>
            <select required value={form.target} onChange={(e) => setForm((f) => ({ ...f, target: e.target.value }))} className="w-full border rounded px-3 py-2 bg-white" style={{ borderColor: 'var(--line)' }}>
              <option value="">{t('quiz.facts.choose')}</option>
              {matrix.locations.map((l) => <option key={l.key} value={l.key}>{l.flag ? `${l.flag} ` : ''}{l.name}{l.place ? ` — ${l.place}` : ''}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="text-xs uppercase tracking-wide block mb-1" style={{ color: 'var(--pine-dark)' }}>{t('quiz.facts.criterion')}</span>
            <select value={form.criterion} onChange={(e) => setForm((f) => ({ ...f, criterion: e.target.value }))} className="w-full border rounded px-3 py-2 bg-white" style={{ borderColor: 'var(--line)' }}>
              {CRITERIA.map((c) => <option key={c.id} value={c.id}>{name(c.id)}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="text-xs uppercase tracking-wide block mb-1" style={{ color: 'var(--pine-dark)' }}>{t('quiz.facts.rating')}</span>
            <select value={form.rating} onChange={(e) => setForm((f) => ({ ...f, rating: e.target.value }))} className="w-full border rounded px-3 py-2 bg-white" style={{ borderColor: 'var(--line)' }}>
              {RATING_SCALE.map((r) => <option key={r} value={r}>{r} — {t(`quiz.rating.${r}`)}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="text-xs uppercase tracking-wide block mb-1" style={{ color: 'var(--pine-dark)' }}>{t('quiz.facts.measured')}</span>
            <input value={form.value_text} onChange={(e) => setForm((f) => ({ ...f, value_text: e.target.value }))} placeholder={t('quiz.facts.measuredPlaceholder')} className="w-full border rounded px-3 py-2 bg-white" style={{ borderColor: 'var(--line)' }} />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="text-xs uppercase tracking-wide block mb-1" style={{ color: 'var(--pine-dark)' }}>{t('quiz.facts.source')}</span>
            <input required value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))} placeholder={t('quiz.facts.sourcePlaceholder')} className="w-full border rounded px-3 py-2 bg-white" style={{ borderColor: 'var(--line)' }} />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="text-xs uppercase tracking-wide block mb-1" style={{ color: 'var(--pine-dark)' }}>{t('quiz.facts.notes')}</span>
            <textarea rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className="w-full border rounded px-3 py-2 bg-white" style={{ borderColor: 'var(--line)' }} />
          </label>
          {error && <p className="text-sm sm:col-span-2" style={{ color: 'var(--clay)' }}>{error}</p>}
          <div className="sm:col-span-2">
            <PrimaryButton type="submit" disabled={saving}>{saving ? t('quiz.facts.adding') : t('quiz.facts.add')}</PrimaryButton>
          </div>
        </form>
      </Card>

      <div className="space-y-3">
        {matrix.locations.map((l) => {
          const list = byTarget[l.key] || []
          const covered = new Set(list.map((f) => f.criterion))
          const profileCovered = CRITERIA.filter((c) => matrix.cells[l.key][c.id].rating != null && !covered.has(c.id))
          const missing = CRITERIA.filter((c) => matrix.cells[l.key][c.id].rating == null)
          return (
            <Card key={l.key}>
              <h3 className="font-display text-lg mb-1" style={{ color: 'var(--pine-dark)' }}>{l.flag ? `${l.flag} ` : ''}{l.name}</h3>
              <p className="text-xs mb-2" style={{ color: 'var(--ink)' }}>
                {t('quiz.facts.counts', { researched: list.length, profile: profileCovered.length, missing: missing.length })}
              </p>
              {list.length > 0 && (
                <ul className="space-y-1 text-sm mb-2">
                  {list.map((f) => (
                    <li key={f.id} className="flex items-start justify-between gap-2">
                      <span>
                        <strong>{name(f.criterion)}</strong> {Number(f.rating).toFixed(1)}
                        {f.value_text && <span style={{ color: 'var(--ink)' }}> · {f.value_text}</span>}
                        <span className="block text-xs" style={{ color: 'var(--ink)' }}>
                          {f.source}{f.members?.name ? ` — ${f.members.name}` : ''}
                        </span>
                      </span>
                      {f.added_by === memberId && <DeleteButton onDelete={() => onDelete(f.id)} confirmText={t('quiz.facts.deleteConfirm')} />}
                    </li>
                  ))}
                </ul>
              )}
              {missing.length > 0 && <div>{missing.map((c) => <Pill key={c.id} tone="grey">{name(c.id)}</Pill>)}</div>}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
