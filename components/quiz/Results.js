'use client'

import { useState } from 'react'
import { useLocale } from '@/lib/i18n/LocaleProvider'
import { CRITERIA } from '@/lib/quiz/criteria'
import { Card, SectionTitle, Pill, WeightBars, pct } from './ui'

function originTone(origin) {
  return origin === 'fact' ? 'pine' : origin === 'computed' ? 'pine' : origin === 'missing' ? 'grey' : 'clay'
}

function scoreText(score) {
  return score == null ? '—' : score.toFixed(0)
}

export default function Results({ result, matrix, onOpenFacts }) {
  const { t } = useLocale()
  const [openKey, setOpenKey] = useState(null)
  const name = (id) => t(`quiz.criteria.${id}.name`)
  const { ranked, excluded, sensitivity: sens, agreement, persons, groupWeights, personalRanks } = result

  const scored = ranked.filter((r) => r.score != null)
  const unscored = ranked.filter((r) => r.score == null)

  return (
    <div className="space-y-8">
      <section>
        <SectionTitle hint={t('quiz.results.shortlistHint', { n: persons.length })}>{t('quiz.results.shortlistTitle')}</SectionTitle>
        {scored.length === 0 ? (
          <Card><p className="text-sm">{t('quiz.results.nothingScored')}</p></Card>
        ) : (
          <ol className="space-y-3">
            {scored.map((r) => {
              const open = openKey === r.key
              const row = matrix.cells[r.key]
              return (
                <li key={r.key}>
                  <Card>
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="font-display text-lg" style={{ color: 'var(--pine-dark)' }}>
                          #{r.rank} {r.flag ? `${r.flag} ` : ''}{r.name}
                          {r.place && <span className="text-sm font-sans ml-2" style={{ color: 'var(--ink)' }}>{r.place}</span>}
                        </h3>
                        <p className="text-xs mb-2" style={{ color: 'var(--ink)' }}>
                          {t('quiz.results.coverage', { pct: pct(r.coverage) })}
                          {r.coverage < 1 && ` · ${t('quiz.results.range', { low: scoreText(r.low), high: scoreText(r.high) })}`}
                        </p>
                        <div>
                          {r.why.strengths.map((s) => <Pill key={`s${s.id}`} tone="pine">↑ {name(s.id)}</Pill>)}
                          {r.why.weaknesses.map((s) => <Pill key={`w${s.id}`} tone="clay">↓ {name(s.id)}</Pill>)}
                          {r.why.gaps.map((g) => <Pill key={`g${g}`} tone="grey">? {name(g)}</Pill>)}
                        </div>
                        {r.dealbreakers.unverified.length > 0 && (
                          <p className="text-xs mt-2" style={{ color: 'var(--clay)' }}>
                            {t('quiz.results.unverified', { list: r.dealbreakers.unverified.map((u) => `${name(u.id)} (${u.person})`).join(', ') })}
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-display text-3xl tabular-nums" style={{ color: 'var(--pine)' }}>{scoreText(r.score)}</div>
                        <div className="text-xs" style={{ color: 'var(--ink)' }}>{t('quiz.results.outOf100')}</div>
                      </div>
                    </div>

                    {persons.length > 1 && (
                      <p className="text-xs mt-3" style={{ color: 'var(--ink)' }}>
                        {t('quiz.results.perPersonRank')}: {persons.map((p) => `${p.name} #${personalRanks[r.key]?.[p.name] ?? '—'}`).join(' · ')}
                      </p>
                    )}

                    <button type="button" onClick={() => setOpenKey(open ? null : r.key)} className="text-xs underline decoration-dotted underline-offset-4 mt-3" style={{ color: 'var(--clay)' }}>
                      {open ? t('quiz.results.hideDetail') : t('quiz.results.showDetail')}
                    </button>

                    {open && (
                      <table className="w-full mt-3 text-xs">
                        <thead>
                          <tr style={{ color: 'var(--pine-dark)' }} className="text-left">
                            <th className="py-1">{t('quiz.results.criterion')}</th>
                            <th className="py-1">{t('quiz.results.weight')}</th>
                            <th className="py-1">{t('quiz.results.rating')}</th>
                            <th className="py-1">{t('quiz.results.where')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {CRITERIA.map((c) => {
                            const cell = row[c.id]
                            return (
                              <tr key={c.id} className="border-t" style={{ borderColor: 'var(--line)' }}>
                                <td className="py-1 pr-2">{name(c.id)}</td>
                                <td className="py-1 pr-2 tabular-nums">{pct(groupWeights[c.id] || 0)}</td>
                                <td className="py-1 pr-2 tabular-nums">{cell.rating == null ? t('quiz.results.noData') : cell.rating.toFixed(1)}</td>
                                <td className="py-1">
                                  <Pill tone={originTone(cell.origin)}>{t(`quiz.origin.${cell.origin}`)}</Pill>
                                  {cell.source && <span className="block mt-0.5" style={{ color: 'var(--ink)' }}>{cell.source}</span>}
                                  {cell.fields && <span className="block mt-0.5" style={{ color: 'var(--ink)' }}>{Object.entries(cell.fields).map(([f, v]) => `${t(`countries.field.${f}`)}: ${v}`).join(' · ')}</span>}
                                  {cell.pricePerAcre != null && <span className="block mt-0.5" style={{ color: 'var(--ink)' }}>{t('quiz.results.pricePerAcre', { value: Math.round(cell.pricePerAcre).toLocaleString() })}</span>}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    )}
                  </Card>
                </li>
              )
            })}
          </ol>
        )}

        {unscored.length > 0 && (
          <Card className="mt-3">
            <p className="text-sm">{t('quiz.results.noDataAtAll', { list: unscored.map((u) => u.name).join(', ') })}</p>
            {onOpenFacts && (
              <button type="button" onClick={onOpenFacts} className="text-xs underline decoration-dotted underline-offset-4 mt-2" style={{ color: 'var(--clay)' }}>
                {t('quiz.results.addResearch')}
              </button>
            )}
          </Card>
        )}
      </section>

      {excluded.length > 0 && (
        <section>
          <SectionTitle hint={t('quiz.results.excludedHint')}>{t('quiz.results.excludedTitle')}</SectionTitle>
          <Card>
            <ul className="space-y-2 text-sm">
              {excluded.map((e) => (
                <li key={e.key}>
                  <strong>{e.name}</strong>
                  <span style={{ color: 'var(--ink)' }}>
                    {' — '}
                    {e.dealbreakers.failed.map((f) => (
                      f.cap != null
                        ? t('quiz.results.failedPrice', { person: f.person, cap: f.cap.toLocaleString(), actual: Math.round(f.pricePerAcre).toLocaleString() })
                        : t('quiz.results.failedRating', { person: f.person, criterion: name(f.id), min: f.min, rating: f.rating.toFixed(1) })
                    )).join('; ')}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}

      <section>
        <SectionTitle hint={t('quiz.results.sensitivityHint')}>{t('quiz.results.sensitivityTitle')}</SectionTitle>
        <Card>
          {!sens.runnerUp ? (
            <p className="text-sm">{t('quiz.results.needTwo')}</p>
          ) : (
            <>
              <p className="text-sm mb-3">{t('quiz.results.leadSummary', { leader: sens.leader.name, runnerUp: sens.runnerUp.name, gap: sens.gap.toFixed(1) })}</p>
              {sens.flips.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--pine)' }}>{t('quiz.results.noFlips', { leader: sens.leader.name })}</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {sens.flips.slice(0, 5).map((f) => (
                    <li key={f.id}>
                      {t('quiz.results.flip', {
                        criterion: name(f.id),
                        from: pct(f.current),
                        to: pct(f.flipAt),
                        direction: t(f.flipAt > f.current ? 'quiz.results.up' : 'quiz.results.down'),
                        newLeader: f.newLeader,
                      })}
                    </li>
                  ))}
                </ul>
              )}
              {sens.dataRisks.length > 0 && (
                <p className="text-sm mt-3" style={{ color: 'var(--clay)' }}>
                  {t('quiz.results.dataRisk', { list: sens.dataRisks.map((d) => d.name).join(', '), leader: sens.leader.name })}
                </p>
              )}
            </>
          )}
        </Card>
      </section>

      <section>
        <SectionTitle hint={t('quiz.results.weightsHint')}>{t('quiz.results.weightsTitle')}</SectionTitle>
        <div className="grid sm:grid-cols-2 gap-4">
          <Card>
            <p className="text-xs uppercase tracking-wide mb-2" style={{ color: 'var(--clay)' }}>{t('quiz.results.groupWeights')}</p>
            <WeightBars weights={groupWeights} label={name} />
          </Card>
          <Card>
            <p className="text-xs uppercase tracking-wide mb-2" style={{ color: 'var(--clay)' }}>{t('quiz.results.disagreement')}</p>
            {persons.length < 2 ? (
              <p className="text-sm">{t('quiz.results.needTwoPeople')}</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {agreement.slice(0, 5).map((a) => (
                  <li key={a.id}>
                    <strong>{name(a.id)}</strong>
                    <span style={{ color: 'var(--ink)' }}> — {a.values.map((v) => `${v.name} ${pct(v.weight)}`).join(' · ')}</span>
                  </li>
                ))}
              </ul>
            )}
            {persons.some((p) => p.consistency && p.consistency.cr > 0.1) && (
              <p className="text-xs mt-3" style={{ color: 'var(--clay)' }}>
                {t('quiz.results.inconsistentPeople', { list: persons.filter((p) => p.consistency && p.consistency.cr > 0.1).map((p) => p.name).join(', ') })}
              </p>
            )}
          </Card>
        </div>
      </section>
    </div>
  )
}
