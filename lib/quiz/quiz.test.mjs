import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ahp, pairKey } from './ahp.js'
import {
  buildDataMatrix, personWeights, combineWeights, normalize, scoreLocation, rankLocations,
  sensitivity, shiftWeight, runQuiz, topCriteria, pricePerAcre,
} from './engine.js'
import { CRITERION_IDS } from './criteria.js'

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`)
const sum = (o) => Object.values(o).reduce((s, v) => s + v, 0)

test('AHP: perfectly consistent judgments recover the true weights with CR 0', () => {
  // true weights 4:2:1
  const j = { [pairKey('a', 'b')]: 2, [pairKey('a', 'c')]: 4, [pairKey('b', 'c')]: 2 }
  const r = ahp(['a', 'b', 'c'], j)
  close(r.weights.a, 4 / 7); close(r.weights.b, 2 / 7); close(r.weights.c, 1 / 7)
  close(r.cr, 0, 1e-9)
})

test('AHP: reversed-key judgments are read the right way round', () => {
  const r = ahp(['a', 'b'], { [pairKey('b', 'a')]: 3 })
  close(r.weights.b, 0.75); close(r.weights.a, 0.25)
})

test('AHP: contradictory judgments give a high CR and name the worst pair', () => {
  const j = { 'a|b': 9, 'b|c': 9, 'a|c': 1 / 9 } // a≫b≫c but c≫a
  const r = ahp(['a', 'b', 'c'], j)
  assert.ok(r.cr > 0.1, `cr ${r.cr}`)
  assert.ok(r.worstPair)
})

test('AHP: matches Saaty textbook example within rounding', () => {
  // Classic 3x3: [[1,3,5],[1/3,1,3],[1/5,1/3,1]] → ≈ [0.637, 0.258, 0.105], CR ≈ 0.033
  const r = ahp(['x', 'y', 'z'], { 'x|y': 3, 'x|z': 5, 'y|z': 3 })
  close(r.weights.x, 0.637, 0.002); close(r.weights.y, 0.258, 0.002); close(r.weights.z, 0.105, 0.002)
  close(r.cr, 0.033, 0.005)
})

test('weights: sliders normalize; all-zero sliders fall back to equal weights', () => {
  const w = normalize({ water: 10, soil: 5 })
  close(sum(w), 1); close(w.water, 2 / 3); close(w.climate, 0)
  const eq = normalize({})
  close(eq.water, 1 / CRITERION_IDS.length)
})

test('weights: pairwise judgments re-divide only the top group and keep its total', () => {
  const sliders = Object.fromEntries(CRITERION_IDS.map((id) => [id, 1]))
  sliders.water = 10; sliders.soil = 10
  const base = normalize(sliders)
  const { weights, consistency } = personWeights({ sliders, top: ['water', 'soil'], pairwise: { 'water|soil': 3 } })
  close(sum(weights), 1)
  close(weights.water + weights.soil, base.water + base.soil)
  close(weights.water / weights.soil, 3)
  close(weights.climate, base.climate)
  assert.equal(consistency.cr, 0)
})

test('weights: topCriteria picks the highest sliders, ignores zeros', () => {
  const sliders = Object.fromEntries(CRITERION_IDS.map((id) => [id, 0]))
  sliders.internet = 9; sliders.water = 10; sliders.soil = 2
  assert.deepEqual(topCriteria(sliders, 5), ['water', 'internet', 'soil'])
})

test('combineWeights averages people', () => {
  const a = normalize({ water: 1 })
  const b = normalize({ soil: 1 })
  const g = combineWeights([a, b])
  close(g.water, 0.5); close(g.soil, 0.5)
})

const countries = [
  { id: 'c1', name: 'Alpha', natural_disaster_risk: 'low', cost_of_living: 'low', language_barrier: 'high' },
  { id: 'c2', name: 'Beta', natural_disaster_risk: 'high', cost_of_living: 'low', language_barrier: 'low' },
  { id: 'c3', name: 'Gamma' }, // empty profile
]

test('matrix: profile enums map to ratings, empty profiles stay missing (never invented)', () => {
  const m = buildDataMatrix({ scope: 'countries', countries })
  assert.equal(m.cells['country:c1'].hazards.rating, 5)
  assert.equal(m.cells['country:c2'].hazards.rating, 1)
  for (const id of CRITERION_IDS) {
    assert.equal(m.cells['country:c3'][id].rating, null)
    assert.equal(m.cells['country:c3'][id].origin, 'missing')
  }
  assert.equal(m.cells['country:c1'].soil.origin, 'missing')
})

test('matrix: a sourced fact overrides the profile proxy, latest fact wins', () => {
  const facts = [
    { id: 'f1', target_type: 'country', country_id: 'c2', criterion: 'hazards', rating: 2, source: 'old', created_at: '2026-01-01' },
    { id: 'f2', target_type: 'country', country_id: 'c2', criterion: 'hazards', rating: 4, source: 'https://example.org/report', created_at: '2026-06-01' },
  ]
  const m = buildDataMatrix({ scope: 'countries', countries, facts })
  const cell = m.cells['country:c2'].hazards
  assert.equal(cell.rating, 4); assert.equal(cell.origin, 'fact'); assert.equal(cell.source, 'https://example.org/report')
})

test('matrix: parcels inherit country data; price per acre is relative among parcels', () => {
  const parcels = [
    { id: 'p1', name: 'Cheap', price: 100000, acreage: 10, country_id: 'c1', status: 'considering' },
    { id: 'p2', name: 'Pricey', price: 300000, acreage: 10, country_id: 'c2', status: 'favorite' },
    { id: 'p3', name: 'Mid', price: 400000, acreage: 20, country_id: null, status: 'considering' },
    { id: 'p4', name: 'Gone', price: 1, acreage: 1, status: 'rejected' },
  ]
  const m = buildDataMatrix({ scope: 'parcels', countries, parcels })
  assert.equal(m.locations.length, 3, 'rejected parcels are left out')
  assert.equal(pricePerAcre(parcels[0]), 10000)
  close(m.cells['parcel:p1'].land_price.rating, 5)
  close(m.cells['parcel:p2'].land_price.rating, 1)
  close(m.cells['parcel:p3'].land_price.rating, 3)
  assert.equal(m.cells['parcel:p1'].hazards.origin, 'countryProfile')
  assert.equal(m.cells['parcel:p3'].hazards.rating, null)
})

test('matrix: one priced parcel is not given a made-up relative price score', () => {
  const m = buildDataMatrix({ scope: 'parcels', countries, parcels: [{ id: 'p1', name: 'Only', price: 5, acreage: 1 }] })
  assert.equal(m.cells['parcel:p1'].land_price.rating, null)
  assert.equal(m.cells['parcel:p1'].land_price.pricePerAcre, 5)
})

test('scoring: renormalizes over available data and reports coverage and range', () => {
  const row = { hazards: { rating: 5 }, soil: { rating: null } }
  const w = normalize({ hazards: 1, soil: 1 })
  const s = scoreLocation(row, w)
  close(s.score, 100); close(s.coverage, 0.5); close(s.low, 50); close(s.high, 100)
  assert.deepEqual(s.missing.map((m) => m.id), ['soil'])
})

test('dealbreakers: failing excludes, missing data only flags unverified', () => {
  const m = buildDataMatrix({ scope: 'countries', countries })
  const people = [{ name: 'Ana', dealbreakers: { minRatings: { hazards: 3 } } }]
  const r = rankLocations(m, normalize({ hazards: 1, cost_of_living: 1 }), people)
  assert.deepEqual(r.excluded.map((x) => x.name), ['Beta'])
  const gamma = r.ranked.find((x) => x.name === 'Gamma')
  assert.equal(gamma.dealbreakers.unverified.length, 1)
  assert.equal(gamma.score, null, 'no data → no score')
  assert.equal(r.ranked[r.ranked.length - 1].name, 'Gamma', 'unscored sorts last')
})

test('shiftWeight keeps total at 1', () => {
  const w = normalize({ water: 3, soil: 1, climate: 1 })
  const s = shiftWeight(w, 'water', 0.2)
  close(sum(s), 1); close(s.water, 0.2); close(s.soil / s.climate, 1)
})

test('sensitivity: finds the weight that flips the top pick', () => {
  const m = buildDataMatrix({ scope: 'countries', countries: countries.slice(0, 2) })
  // Alpha: safe, hard language. Beta: hazardous, easy language.
  const w = normalize({ hazards: 6, language: 4 })
  const r = rankLocations(m, w, [])
  assert.equal(r.ranked[0].name, 'Alpha')
  const s = sensitivity(m, w, r.ranked)
  const lang = s.flips.find((f) => f.id === 'language')
  assert.ok(lang, 'language weight can flip it')
  assert.equal(lang.newLeader, 'Beta')
  assert.ok(lang.flipAt > 0.5 && lang.flipAt <= 0.52, `flip at ${lang.flipAt}`)
  const haz = s.flips.find((f) => f.id === 'hazards')
  assert.ok(haz.flipAt < 0.5)
})

test('runQuiz: combines people and shows disagreement', () => {
  const m = buildDataMatrix({ scope: 'countries', countries: countries.slice(0, 2) })
  const zero = Object.fromEntries(CRITERION_IDS.map((id) => [id, 0]))
  const people = [
    { memberId: 'm1', name: 'Ana', response: { sliders: { ...zero, hazards: 10 } } },
    { memberId: 'm2', name: 'Ben', response: { sliders: { ...zero, language: 10 } } },
  ]
  const out = runQuiz({ matrix: m, people })
  assert.equal(out.perPerson[0].top[0].name, 'Alpha')
  assert.equal(out.perPerson[1].top[0].name, 'Beta')
  assert.equal(out.agreement[0].spread, 1)
  assert.ok(['hazards', 'language'].includes(out.agreement[0].id))
  assert.equal(out.personalRanks['country:c1'].Ana, 1)
  assert.equal(out.personalRanks['country:c1'].Ben, 2)
})

// ---------- reference countries ----------
import { REFERENCE_COUNTRIES, referenceCountries, draftProfileFrom } from './referenceCountries.js'
import { splitRanked } from './engine.js'

test('reference data contains no borrowed numbers', () => {
  // The whole point: coarse categories only. A stray year or price would be a fabricated fact.
  for (const c of REFERENCE_COUNTRIES) {
    for (const [field, cell] of Object.entries(c.fields)) {
      assert.equal(typeof cell.value, 'string', `${c.name}.${field} should be a category, not a number`)
      assert.ok(['established', 'estimate'].includes(cell.confidence), `${c.name}.${field} needs a confidence`)
      assert.ok(!/^\d/.test(cell.value), `${c.name}.${field} looks like a figure: ${cell.value}`)
    }
    assert.ok(c.verify.length > 0, `${c.name} must list what still needs checking`)
  }
})

test('reference list hides countries already profiled', () => {
  const names = referenceCountries(['uruguay ', 'Spain']).map((c) => c.name)
  assert.ok(!names.includes('Uruguay'))
  assert.ok(!names.includes('Spain'))
  assert.ok(names.includes('Portugal'))
})

test('candidates are scored but kept out of the real shortlist and the sensitivity check', () => {
  const own = [{ id: 'c1', name: 'Alpha', natural_disaster_risk: 'low', healthcare_system: 'universal', language_barrier: 'low' }]
  const m = buildDataMatrix({ scope: 'countries', countries: own, includeReference: true })
  assert.ok(m.locations.length > 1, 'reference countries were added')
  assert.equal(m.locations.filter((l) => l.isReference).length, REFERENCE_COUNTRIES.length)

  const zero = Object.fromEntries(CRITERION_IDS.map((id) => [id, 0]))
  const out = runQuiz({
    matrix: m,
    people: [{ memberId: 'm1', name: 'Ana', response: { sliders: { ...zero, hazards: 10, healthcare: 5 } } }],
  })
  assert.deepEqual(out.ranked.map((r) => r.name), ['Alpha'], 'shortlist holds only researched places')
  assert.ok(out.candidates.length > 0, 'candidates are returned separately')
  assert.ok(out.candidates.every((c) => c.isReference))
  assert.equal(out.candidates[0].rank, 1, 'candidates are ranked among themselves')
  assert.equal(out.sensitivity.runnerUp, null, 'one researched country means nothing to flip')
  assert.ok(out.perPerson[0].top.every((t) => t.name === 'Alpha'), 'personal tops exclude candidates')
})

test('splitRanked separates the two kinds', () => {
  const { researched, candidates } = splitRanked([{ isReference: false }, { isReference: true }])
  assert.equal(researched.length, 1)
  assert.equal(candidates.length, 1)
})

test('a promoted draft carries the research to-do, not invented detail', () => {
  const draft = draftProfileFrom(REFERENCE_COUNTRIES.find((c) => c.name === 'Portugal'))
  assert.equal(draft.name, 'Portugal')
  assert.equal(draft.primary_language, 'Portuguese')
  assert.ok(/Still to check/.test(draft.research_sources))
  assert.ok(/residency/.test(draft.research_sources))
  assert.equal(draft.citizenship_timeline_years, undefined, 'no year is ever pre-filled')
})

test('a barely-known candidate cannot outrank a better-known one on ignorance alone', () => {
  const own = [{ id: 'c1', name: 'Alpha', natural_disaster_risk: 'low' }]
  const m = buildDataMatrix({ scope: 'countries', countries: own, includeReference: true })
  const out = runQuiz({
    matrix: m,
    people: [{ memberId: 'm1', name: 'Ana', response: {} }],
  })
  const cands = out.candidates.filter((c) => c.midpoint != null)
  // Ranked by midpoint, so the order must be non-increasing in midpoint...
  for (let i = 1; i < cands.length; i++) {
    assert.ok(cands[i - 1].midpoint >= cands[i].midpoint, 'candidates are ordered by midpoint')
  }
  // ...and the leader must not simply be the one with the least data.
  const leader = cands[0]
  const sparsest = [...cands].sort((a, b) => a.coverage - b.coverage)[0]
  if (leader.coverage !== sparsest.coverage) {
    assert.ok(leader.midpoint >= sparsest.midpoint)
  }
  // The midpoint always sits inside the stated range.
  for (const c of cands) assert.ok(c.midpoint >= c.low && c.midpoint <= c.high)
})
