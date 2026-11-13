'use client'

import { useMemo, useState } from 'react'
import { useLocale } from '@/lib/i18n/LocaleProvider'
import { CRITERIA, GROUPS, RATING_SCALE } from '@/lib/quiz/criteria'
import { pairKey, pairsFor } from '@/lib/quiz/ahp'
import { DEFAULT_SLIDER, personWeights, topCriteria } from '@/lib/quiz/engine'
import { Card, SectionTitle, PrimaryButton, SecondaryButton, WeightBars } from './ui'

const STEPS = ['importance', 'compare', 'dealbreakers', 'review']

// Saaty values offered for "a vs b": a much more … equal … b much more.
const SCALE = [7, 5, 3, 1, 1 / 3, 1 / 5, 1 / 7]
const SCALE_KEYS = ['aMuchMore', 'aMore', 'aBitMore', 'equal', 'bBitMore', 'bMore', 'bMuchMore']

function sliderWord(v) {
  if (v === 0) return 'notAtAll'
  if (v <= 3) return 'niceToHave'
  if (v <= 6) return 'important'
  if (v <= 9) return 'veryImportant'
  return 'critical'
}

export function emptyResponse() {
  return { sliders: Object.fromEntries(CRITERIA.map((c) => [c.id, DEFAULT_SLIDER])), top: [], pairwise: {}, dealbreakers: { minRatings: {}, maxPricePerAcre: null } }
}

export default function Wizard({ initial, myDealbreakerNotes, onSave, saving }) {
  const { t } = useLocale()
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState(() => ({ ...emptyResponse(), ...(initial || {}), dealbreakers: { minRatings: {}, maxPricePerAcre: null, ...(initial?.dealbreakers || {}) } }))
  const name = (id) => t(`quiz.criteria.${id}.name`)

  const top = useMemo(() => topCriteria(draft.sliders), [draft.sliders])
  const pairs = useMemo(() => pairsFor(top), [top])
  const computed = useMemo(() => personWeights({ ...draft, top }), [draft, top])
  const answered = pairs.filter(([a, b]) => draft.pairwise[pairKey(a, b)] > 0).length

  function setSlider(id, v) {
    setDraft((d) => ({ ...d, sliders: { ...d.sliders, [id]: v } }))
  }

  function setJudgment(a, b, v) {
    setDraft((d) => ({ ...d, pairwise: { ...d.pairwise, [pairKey(a, b)]: v } }))
  }

  function setMin(id, v) {
    setDraft((d) => ({ ...d, dealbreakers: { ...d.dealbreakers, minRatings: { ...d.dealbreakers.minRatings, [id]: v ? Number(v) : undefined } } }))
  }

  function finish() {
    // Only keep judgments for the pairs that are actually in play.
    const pairwise = {}
    for (const [a, b] of pairs) if (draft.pairwise[pairKey(a, b)] > 0) pairwise[pairKey(a, b)] = draft.pairwise[pairKey(a, b)]
    const minRatings = Object.fromEntries(Object.entries(draft.dealbreakers.minRatings || {}).filter(([, v]) => v))
    onSave({ ...draft, top, pairwise, dealbreakers: { ...draft.dealbreakers, minRatings } })
  }

  const current = STEPS[step]

  return (
    <div>
      <ol className="flex flex-wrap gap-2 mb-6 text-sm" aria-label={t('quiz.wizard.progress')}>
        {STEPS.map((s, i) => (
          <li key={s}>
            <button
              type="button"
              onClick={() => setStep(i)}
              aria-current={i === step ? 'step' : undefined}
              className="px-3 py-1 rounded-full border"
              style={{ borderColor: i === step ? 'var(--pine)' : 'var(--line)', background: i === step ? 'var(--pine)' : 'transparent', color: i === step ? 'var(--card)' : 'var(--ink)' }}
            >
              {i + 1}. {t(`quiz.wizard.step.${s}`)}
            </button>
          </li>
        ))}
      </ol>

      {current === 'importance' && (
        <div className="space-y-6">
          <SectionTitle hint={t('quiz.wizard.importanceHint')}>{t('quiz.wizard.importanceTitle')}</SectionTitle>
          {GROUPS.map((g) => (
            <Card key={g}>
              <h3 className="text-xs uppercase tracking-wide mb-3" style={{ color: 'var(--clay)' }}>{t(`quiz.groups.${g}`)}</h3>
              <div className="space-y-4">
                {CRITERIA.filter((c) => c.group === g).map((c) => {
                  const v = Number(draft.sliders[c.id] ?? DEFAULT_SLIDER)
                  return (
                    <div key={c.id}>
                      <div className="flex justify-between items-baseline gap-3">
                        <label htmlFor={`s-${c.id}`} className="font-medium text-sm" style={{ color: 'var(--pine-dark)' }}>{name(c.id)}</label>
                        <span className="text-xs tabular-nums" style={{ color: 'var(--ink)' }}>{v} · {t(`quiz.wizard.slider.${sliderWord(v)}`)}</span>
                      </div>
                      <p className="text-xs mb-1" style={{ color: 'var(--ink)' }}>{t(`quiz.criteria.${c.id}.desc`)}</p>
                      <input id={`s-${c.id}`} type="range" min={0} max={10} step={1} value={v} onChange={(e) => setSlider(c.id, Number(e.target.value))} className="w-full" style={{ accentColor: 'var(--pine)' }} />
                    </div>
                  )
                })}
              </div>
            </Card>
          ))}
        </div>
      )}

      {current === 'compare' && (
        <div className="space-y-4">
          <SectionTitle hint={t('quiz.wizard.compareHint', { count: top.length })}>{t('quiz.wizard.compareTitle')}</SectionTitle>
          {pairs.length === 0 ? (
            <Card><p className="text-sm">{t('quiz.wizard.compareNotEnough')}</p></Card>
          ) : pairs.map(([a, b]) => {
            const selected = draft.pairwise[pairKey(a, b)]
            return (
              <Card key={pairKey(a, b)}>
                <p className="text-sm mb-3"><strong>{name(a)}</strong> <span style={{ color: 'var(--ink)' }}>{t('quiz.wizard.vs')}</span> <strong>{name(b)}</strong></p>
                <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={`${name(a)} / ${name(b)}`}>
                  {SCALE.map((v, i) => {
                    const on = selected && Math.abs(selected - v) < 1e-9
                    return (
                      <button
                        key={SCALE_KEYS[i]}
                        type="button"
                        role="radio"
                        aria-checked={!!on}
                        onClick={() => setJudgment(a, b, v)}
                        className="text-xs px-2 py-1 rounded-full border"
                        style={{ borderColor: on ? 'var(--clay)' : 'var(--line)', background: on ? 'var(--clay)' : 'transparent', color: on ? 'var(--card)' : 'var(--ink)' }}
                      >
                        {t(`quiz.wizard.scale.${SCALE_KEYS[i]}`, { a: name(a), b: name(b) })}
                      </button>
                    )
                  })}
                </div>
              </Card>
            )
          })}
          {pairs.length > 0 && (
            <Card>
              <p className="text-sm mb-2">{t('quiz.wizard.answered', { done: answered, total: pairs.length })}</p>
              {computed.consistency && answered === pairs.length && (
                computed.consistency.cr > 0.1 ? (
                  <p className="text-sm mb-3" style={{ color: 'var(--clay)' }}>
                    {t('quiz.wizard.inconsistent', {
                      cr: computed.consistency.cr.toFixed(2),
                      a: name(computed.consistency.worstPair.a),
                      b: name(computed.consistency.worstPair.b),
                    })}
                  </p>
                ) : (
                  <p className="text-sm mb-3" style={{ color: 'var(--pine)' }}>{t('quiz.wizard.consistent', { cr: computed.consistency.cr.toFixed(2) })}</p>
                )
              )}
              <p className="text-xs uppercase tracking-wide mb-2" style={{ color: 'var(--pine-dark)' }}>{t('quiz.wizard.yourWeights')}</p>
              <WeightBars weights={computed.weights} label={name} limit={8} />
              <SecondaryButton type="button" className="mt-4" onClick={() => setDraft((d) => ({ ...d, pairwise: {} }))}>
                {t('quiz.wizard.skipCompare')}
              </SecondaryButton>
            </Card>
          )}
        </div>
      )}

      {current === 'dealbreakers' && (
        <div className="space-y-4">
          <SectionTitle hint={t('quiz.wizard.dealbreakersHint')}>{t('quiz.wizard.dealbreakersTitle')}</SectionTitle>
          {myDealbreakerNotes.length > 0 && (
            <Card>
              <p className="text-sm mb-2">{t('quiz.wizard.yourLoggedDealbreakers')}</p>
              <ul className="list-disc pl-5 text-sm">
                {myDealbreakerNotes.map((p) => <li key={p.id}>{p.category ? `[${p.category}] ` : ''}{p.description}</li>)}
              </ul>
            </Card>
          )}
          <Card>
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
              {CRITERIA.filter((c) => c.dealbreaker).map((c) => (
                <label key={c.id} className="text-sm flex items-center justify-between gap-2">
                  <span>{name(c.id)}</span>
                  <select value={draft.dealbreakers.minRatings?.[c.id] || ''} onChange={(e) => setMin(c.id, e.target.value)} className="border rounded px-2 py-1 bg-white text-sm" style={{ borderColor: 'var(--line)' }}>
                    <option value="">{t('quiz.wizard.noMinimum')}</option>
                    {RATING_SCALE.slice(1).map((r) => (
                      <option key={r} value={r}>{t('quiz.wizard.atLeast', { rating: r, label: t(`quiz.rating.${r}`) })}</option>
                    ))}
                  </select>
                </label>
              ))}
              <label className="text-sm flex items-center justify-between gap-2 sm:col-span-2">
                <span>{t('quiz.wizard.maxPricePerAcre')}</span>
                <input
                  type="number" min={0} step={100} inputMode="numeric"
                  value={draft.dealbreakers.maxPricePerAcre ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, dealbreakers: { ...d.dealbreakers, maxPricePerAcre: e.target.value ? Number(e.target.value) : null } }))}
                  placeholder={t('quiz.wizard.noCap')}
                  className="border rounded px-2 py-1 bg-white w-36 text-sm" style={{ borderColor: 'var(--line)' }}
                />
              </label>
            </div>
          </Card>
        </div>
      )}

      {current === 'review' && (
        <div className="space-y-4">
          <SectionTitle hint={t('quiz.wizard.reviewHint')}>{t('quiz.wizard.reviewTitle')}</SectionTitle>
          <Card>
            <WeightBars weights={computed.weights} label={name} />
            <p className="text-sm mt-4">
              {Object.values(draft.dealbreakers.minRatings || {}).filter(Boolean).length + (draft.dealbreakers.maxPricePerAcre ? 1 : 0) === 0
                ? t('quiz.wizard.noDealbreakers')
                : t('quiz.wizard.dealbreakerCount', { count: Object.values(draft.dealbreakers.minRatings || {}).filter(Boolean).length + (draft.dealbreakers.maxPricePerAcre ? 1 : 0) })}
            </p>
          </Card>
        </div>
      )}

      <div className="flex justify-between mt-6">
        <SecondaryButton type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>{t('quiz.wizard.back')}</SecondaryButton>
        {step < STEPS.length - 1 ? (
          <PrimaryButton type="button" onClick={() => setStep((s) => s + 1)}>{t('quiz.wizard.next')}</PrimaryButton>
        ) : (
          <PrimaryButton type="button" onClick={finish} disabled={saving}>{saving ? t('quiz.wizard.saving') : t('quiz.wizard.save')}</PrimaryButton>
        )}
      </div>
    </div>
  )
}
