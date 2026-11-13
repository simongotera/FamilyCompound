'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Gate from '@/components/Gate'
import { Loading, EmptyState, ErrorState } from '@/components/Loading'
import { DeleteButton } from '@/components/DeleteButton'
import { useAuth } from '@/lib/AuthProvider'
import { useLocale } from '@/lib/i18n/LocaleProvider'
import { buildDataMatrix, runQuiz } from '@/lib/quiz/engine'
import { loadQuizData, rowToResponse, saveResponse, addFact, deleteFact, saveShortlist, deleteShortlist } from '@/lib/quiz/store'
import Wizard from '@/components/quiz/Wizard'
import Results from '@/components/quiz/Results'
import FactsEditor from '@/components/quiz/FactsEditor'
import { Card, SectionTitle, PrimaryButton, SecondaryButton } from '@/components/quiz/ui'

const TABS = ['take', 'results', 'data', 'saved']

function QuizPage() {
  const { member } = useAuth()
  const { t } = useLocale()
  const [tab, setTab] = useState('take')
  const [scope, setScope] = useState('countries')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState(null)

  const load = useCallback(async () => {
    const result = await loadQuizData()
    if (result.error) setError(result.error)
    else { setData(result); setError(null) }
    setLoading(false)
  }, [])

  // Kick off the first fetch from a callback so the effect itself never sets state synchronously.
  useEffect(() => { Promise.resolve().then(load) }, [load])

  const matrix = useMemo(
    () => (data ? buildDataMatrix({ scope, countries: data.countries, parcels: data.parcels, facts: data.facts }) : null),
    [data, scope]
  )

  const people = useMemo(() => {
    if (!data) return []
    const nameOf = Object.fromEntries(data.members.map((m) => [m.id, m.name]))
    return data.responses.map((r) => ({ memberId: r.member_id, name: nameOf[r.member_id] || t('quiz.someone'), response: rowToResponse(r) }))
  }, [data, t])

  const result = useMemo(
    () => (matrix && people.length ? runQuiz({ matrix, people }) : null),
    [matrix, people]
  )

  const myResponse = useMemo(() => {
    const row = data?.responses.find((r) => r.member_id === member.id)
    return rowToResponse(row)
  }, [data, member.id])

  const myDealbreakerNotes = useMemo(
    () => (data?.dealbreakerPriorities || []).filter((p) => p.member_id === member.id),
    [data, member.id]
  )

  async function handleSaveResponse(response) {
    setSaving(true)
    const { data: saved, error: err } = await saveResponse({ localMode: data.localMode, memberId: member.id, response })
    setSaving(false)
    if (err) { setError(err); return }
    setData((d) => ({ ...d, responses: [...d.responses.filter((r) => r.member_id !== member.id), saved] }))
    setNotice(t('quiz.savedAnswers'))
    setTab('results')
  }

  async function handleAddFact(fact) {
    setSaving(true)
    const { data: saved, error: err } = await addFact({ localMode: data.localMode, memberId: member.id, memberName: member.name, fact })
    setSaving(false)
    if (err) { setError(err); return }
    setData((d) => ({ ...d, facts: [saved, ...d.facts] }))
  }

  async function handleDeleteFact(id) {
    const previous = data.facts
    setData((d) => ({ ...d, facts: d.facts.filter((f) => f.id !== id) }))
    const { error: err } = await deleteFact({ localMode: data.localMode, id })
    if (err) { setError(err); setData((d) => ({ ...d, facts: previous })) }
  }

  async function handleSaveShortlist() {
    setSaving(true)
    const shortlist = {
      title: t('quiz.saved.defaultTitle', { date: new Date().toLocaleDateString(), scope: t(`quiz.scope.${scope}`) }),
      scope,
      participants: result.persons.map((p) => ({ memberId: p.memberId, name: p.name, weights: p.weights, consistency: p.consistency })),
      result: {
        groupWeights: result.groupWeights,
        ranked: result.ranked.map((r) => ({ key: r.key, name: r.name, place: r.place || null, rank: r.rank, score: r.score, low: r.low, high: r.high, coverage: r.coverage, why: r.why })),
        excluded: result.excluded.map((e) => ({ name: e.name, failed: e.dealbreakers.failed })),
        sensitivity: result.sensitivity,
        agreement: result.agreement,
      },
    }
    const { data: saved, error: err } = await saveShortlist({ localMode: data.localMode, memberId: member.id, memberName: member.name, shortlist })
    setSaving(false)
    if (err) { setError(err); return }
    setData((d) => ({ ...d, shortlists: [saved, ...d.shortlists] }))
    setNotice(t('quiz.saved.saved'))
    setTab('saved')
  }

  async function handleDeleteShortlist(id) {
    const previous = data.shortlists
    setData((d) => ({ ...d, shortlists: d.shortlists.filter((s) => s.id !== id) }))
    const { error: err } = await deleteShortlist({ localMode: data.localMode, id })
    if (err) { setError(err); setData((d) => ({ ...d, shortlists: previous })) }
  }

  if (loading) return <Loading label={t('quiz.loading')} />
  if (error && !data) return <ErrorState message={error} />

  const hasLocations = matrix && matrix.locations.length > 0

  return (
    <div>
      <h1 className="font-display text-3xl mb-2" style={{ color: 'var(--pine-dark)' }}>{t('quiz.title')}</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--ink)' }}>{t('quiz.subtitle')}</p>

      {error && <div className="mb-6"><ErrorState message={error} /></div>}
      {notice && <div className="mb-6"><Card><p className="text-sm" style={{ color: 'var(--pine)' }}>{notice}</p></Card></div>}
      {data.localMode && (
        <div className="mb-6">
          <Card>
            <p className="text-sm" style={{ color: 'var(--clay)' }}>{t('quiz.localMode')}</p>
          </Card>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <nav className="flex flex-wrap gap-1" aria-label={t('quiz.title')}>
          {TABS.map((x) => (
            <button
              key={x}
              type="button"
              onClick={() => { setTab(x); setNotice(null) }}
              aria-current={tab === x ? 'page' : undefined}
              className="px-3 py-1.5 rounded-full text-sm font-medium"
              style={{ background: tab === x ? 'var(--pine)' : 'transparent', color: tab === x ? 'var(--card)' : 'var(--ink)' }}
            >
              {t(`quiz.tab.${x}`)}
            </button>
          ))}
        </nav>
        {(tab === 'results' || tab === 'data') && (
          <div className="flex gap-1">
            {['countries', 'parcels'].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setScope(s)}
                aria-pressed={scope === s}
                className="px-3 py-1 rounded-full text-xs border"
                style={{ borderColor: scope === s ? 'var(--clay)' : 'var(--line)', background: scope === s ? 'var(--clay)' : 'transparent', color: scope === s ? 'var(--card)' : 'var(--ink)' }}
              >
                {t(`quiz.scope.${s}`)}
              </button>
            ))}
          </div>
        )}
      </div>

      {tab === 'take' && (
        <div className="space-y-4">
          {myResponse && (
            <Card>
              <p className="text-sm">{t('quiz.alreadyTaken', { date: myResponse.updatedAt ? new Date(myResponse.updatedAt).toLocaleDateString() : '—' })}</p>
            </Card>
          )}
          <Wizard initial={myResponse} myDealbreakerNotes={myDealbreakerNotes} onSave={handleSaveResponse} saving={saving} />
        </div>
      )}

      {tab === 'results' && (
        !hasLocations ? (
          <EmptyState title={t('quiz.noLocationsTitle')} hint={t(scope === 'countries' ? 'quiz.noCountriesHint' : 'quiz.noParcelsHint')} />
        ) : !result ? (
          <EmptyState title={t('quiz.noAnswersTitle')} hint={t('quiz.noAnswersHint')} />
        ) : (
          <div className="space-y-6">
            <Card>
              <p className="text-sm mb-3">{t('quiz.whoTook', { list: result.persons.map((p) => p.name).join(', ') })}</p>
              <div className="flex flex-wrap gap-2">
                <PrimaryButton type="button" onClick={handleSaveShortlist} disabled={saving}>{t('quiz.saved.save')}</PrimaryButton>
                <SecondaryButton type="button" onClick={() => setTab('data')}>{t('quiz.results.addResearch')}</SecondaryButton>
              </div>
            </Card>
            <Results result={result} matrix={matrix} onOpenFacts={() => setTab('data')} />
          </div>
        )
      )}

      {tab === 'data' && (
        !hasLocations ? (
          <EmptyState title={t('quiz.noLocationsTitle')} hint={t(scope === 'countries' ? 'quiz.noCountriesHint' : 'quiz.noParcelsHint')} />
        ) : (
          <FactsEditor
            matrix={matrix}
            facts={data.facts}
            memberId={member.id}
            onAdd={handleAddFact}
            onDelete={handleDeleteFact}
            saving={saving}
          />
        )
      )}

      {tab === 'saved' && (
        <div className="space-y-4">
          <SectionTitle hint={t('quiz.saved.hint')}>{t('quiz.saved.title')}</SectionTitle>
          {data.shortlists.length === 0 ? (
            <EmptyState title={t('quiz.saved.emptyTitle')} hint={t('quiz.saved.emptyHint')} />
          ) : data.shortlists.map((s) => (
            <Card key={s.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-lg" style={{ color: 'var(--pine-dark)' }}>{s.title}</h3>
                  <p className="text-xs mb-2" style={{ color: 'var(--ink)' }}>
                    {new Date(s.created_at).toLocaleString()}
                    {s.members?.name ? ` · ${s.members.name}` : ''}
                    {' · '}
                    {t('quiz.saved.participants', { list: (s.participants || []).map((p) => p.name).join(', ') || '—' })}
                  </p>
                </div>
                {s.created_by === member.id && <DeleteButton onDelete={() => handleDeleteShortlist(s.id)} confirmText={t('quiz.saved.deleteConfirm')} />}
              </div>
              <ol className="text-sm space-y-1">
                {(s.result?.ranked || []).filter((r) => r.score != null).slice(0, 5).map((r) => (
                  <li key={r.key}>
                    <strong>#{r.rank} {r.name}</strong>
                    <span className="tabular-nums" style={{ color: 'var(--pine)' }}> {r.score.toFixed(0)}</span>
                    <span style={{ color: 'var(--ink)' }}>
                      {r.why?.strengths?.length ? ` · ↑ ${r.why.strengths.map((x) => t(`quiz.criteria.${x.id}.name`)).join(', ')}` : ''}
                      {r.why?.weaknesses?.length ? ` · ↓ ${r.why.weaknesses.map((x) => t(`quiz.criteria.${x.id}.name`)).join(', ')}` : ''}
                      {r.why?.gaps?.length ? ` · ? ${r.why.gaps.map((x) => t(`quiz.criteria.${x}.name`)).join(', ')}` : ''}
                    </span>
                  </li>
                ))}
              </ol>
              {s.result?.sensitivity?.flips?.length > 0 && (
                <p className="text-xs mt-2" style={{ color: 'var(--ink)' }}>
                  {t('quiz.saved.flipNote', { criterion: t(`quiz.criteria.${s.result.sensitivity.flips[0].id}.name`), newLeader: s.result.sensitivity.flips[0].newLeader })}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Page() {
  return <Gate><QuizPage /></Gate>
}
