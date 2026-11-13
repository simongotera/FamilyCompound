// Multi-criteria decision analysis for the location quiz.
//
// Method (weighted-sum MCDA with AHP-elicited weights):
//   1. Each person sets an importance slider (0–10) for every criterion.
//   2. Optionally they compare their top criteria in pairs (AHP); the eigenvector of those
//      judgments re-divides the weight their sliders gave to that top group.
//   3. Group weights are the mean of everyone's normalized weights.
//   4. Each location's score = Σ wᵢ·xᵢ / Σ wᵢ over criteria that have data, where xᵢ is the
//      1–5 rating rescaled to 0–1. Missing data is never filled in: we report coverage and the
//      worst/best case (missing = 0 or 1) so a sparse location can't silently win.
//   5. Any participant's dealbreaker excludes a location for the group. A dealbreaker on a
//      criterion with no data marks the location "unverified" instead of excluding it.
//   6. Sensitivity: for each criterion, how far its weight must move (others rescaled
//      proportionally) before the top pick changes.

import { CRITERIA, CRITERION_IDS, criterionById } from './criteria.js'
import { ahp } from './ahp.js'

export const MAX_PAIRWISE = 5
export const DEFAULT_SLIDER = 5

// ---------- weights ----------

export function normalize(weights) {
  const total = CRITERION_IDS.reduce((s, id) => s + Math.max(0, Number(weights?.[id]) || 0), 0)
  const out = {}
  for (const id of CRITERION_IDS) out[id] = total > 0 ? Math.max(0, Number(weights?.[id]) || 0) / total : 1 / CRITERION_IDS.length
  return out
}

// The criteria a person compares pairwise: their highest sliders (ties broken by list order).
export function topCriteria(sliders, count = MAX_PAIRWISE) {
  return CRITERION_IDS
    .map((id, index) => ({ id, index, v: Number(sliders?.[id] ?? DEFAULT_SLIDER) }))
    .filter((c) => c.v > 0)
    .sort((a, b) => b.v - a.v || a.index - b.index)
    .slice(0, count)
    .map((c) => c.id)
}

// Turn one person's answers into normalized weights.
// response = { sliders: {id: 0..10}, pairwise: {"a|b": ratio}, top: [ids] }
export function personWeights(response) {
  const sliders = {}
  for (const id of CRITERION_IDS) sliders[id] = Number(response?.sliders?.[id] ?? DEFAULT_SLIDER)
  const base = normalize(sliders)
  const top = (response?.top?.length ? response.top : topCriteria(sliders)).filter((id) => base[id] > 0)
  const hasJudgments = response?.pairwise && Object.keys(response.pairwise).length > 0
  if (!hasJudgments || top.length < 2) return { weights: base, consistency: null }

  // Unanswered pairs fall back to the ratio of that person's own sliders.
  const fallback = (a, b) => (sliders[a] || 0.5) / (sliders[b] || 0.5)
  const result = ahp(top, response.pairwise, fallback)
  const groupMass = top.reduce((s, id) => s + base[id], 0)
  const weights = { ...base }
  for (const id of top) weights[id] = result.weights[id] * groupMass
  return { weights, consistency: { cr: result.cr, worstPair: result.worstPair, items: top } }
}

export function combineWeights(weightList) {
  if (!weightList.length) return normalize({})
  const out = {}
  for (const id of CRITERION_IDS) out[id] = weightList.reduce((s, w) => s + (w[id] || 0), 0) / weightList.length
  return normalize(out)
}

// Where people agree and disagree about what matters.
export function weightAgreement(people) {
  return CRITERION_IDS.map((id) => {
    const values = people.map((p) => ({ name: p.name, weight: p.weights[id] || 0 }))
    const ws = values.map((v) => v.weight)
    const max = Math.max(...ws)
    const min = Math.min(...ws)
    const mean = ws.reduce((s, v) => s + v, 0) / (ws.length || 1)
    return { id, values, mean, spread: ws.length ? max - min : 0 }
  }).sort((a, b) => b.spread - a.spread)
}

// ---------- data matrix ----------

function latestFacts(facts) {
  // key `${type}:${id}:${criterion}` → most recent fact
  const map = {}
  for (const f of facts || []) {
    if (f.rating == null) continue
    const targetId = f.target_type === 'country' ? f.country_id : f.land_option_id
    const key = `${f.target_type}:${targetId}:${f.criterion}`
    if (!map[key] || new Date(f.created_at) > new Date(map[key].created_at)) map[key] = f
  }
  return map
}

function profileRating(criterion, country) {
  const p = criterion.profile
  if (!p || !country) return null
  if (p.field) {
    const value = country[p.field]
    const rating = p.map[value]
    return rating == null ? null : { rating, fields: { [p.field]: value } }
  }
  const ratings = []
  const fields = {}
  for (const field of p.fields) {
    const rating = p.maps[field][country[field]]
    if (rating != null) { ratings.push(rating); fields[field] = country[field] }
  }
  if (!ratings.length) return null
  return { rating: ratings.reduce((s, v) => s + v, 0) / ratings.length, fields }
}

export function pricePerAcre(parcel) {
  const price = Number(parcel?.price)
  const acres = Number(parcel?.acreage)
  if (!(price > 0) || !(acres > 0)) return null
  return price / acres
}

function factCell(fact, origin) {
  return {
    rating: Number(fact.rating),
    origin,
    value: fact.value_text || null,
    source: fact.source || null,
    notes: fact.notes || null,
    by: fact.members?.name || null,
    factId: fact.id,
  }
}

// Build the location × criterion table.
// scope: 'countries' | 'parcels'. Parcels inherit their country's profile and facts.
export function buildDataMatrix({ scope, countries = [], parcels = [], facts = [] }) {
  const factMap = latestFacts(facts)
  const countryById = Object.fromEntries(countries.map((c) => [c.id, c]))

  const locations = scope === 'parcels'
    ? parcels.filter((p) => p.status !== 'rejected').map((p) => ({
      key: `parcel:${p.id}`, type: 'parcel', id: p.id, name: p.name, place: p.location || null,
      country: p.country_id ? countryById[p.country_id] || null : null, raw: p,
    }))
    : countries.map((c) => ({ key: `country:${c.id}`, type: 'country', id: c.id, name: c.name, flag: c.flag_emoji || null, country: c, raw: c }))

  // Relative price score: cheapest priced parcel → 5, most expensive → 1 (linear in $/acre).
  const prices = locations.map((l) => (l.type === 'parcel' ? pricePerAcre(l.raw) : null)).filter((v) => v != null)
  const minPrice = Math.min(...prices)
  const maxPrice = Math.max(...prices)

  const cells = {}
  for (const loc of locations) {
    const row = {}
    for (const criterion of CRITERIA) {
      const own = factMap[`${loc.type}:${loc.id}:${criterion.id}`]
      const countryFact = loc.type === 'parcel' && loc.country ? factMap[`country:${loc.country.id}:${criterion.id}`] : null
      let cell = null
      if (own) cell = factCell(own, 'fact')
      else if (criterion.computed === 'price_per_acre' && loc.type === 'parcel') {
        const ppa = pricePerAcre(loc.raw)
        if (ppa != null && prices.length >= 2 && maxPrice > minPrice) {
          cell = { rating: 5 - (4 * (ppa - minPrice)) / (maxPrice - minPrice), origin: 'computed', pricePerAcre: ppa }
        } else if (ppa != null && prices.length >= 2) {
          cell = { rating: 3, origin: 'computed', pricePerAcre: ppa } // every priced parcel costs the same per acre
        } else if (ppa != null) {
          cell = { rating: null, origin: 'missing', pricePerAcre: ppa, reason: 'onlyOnePrice' }
        }
      }
      if (!cell && countryFact) cell = factCell(countryFact, 'countryFact')
      if (!cell) {
        const p = profileRating(criterion, loc.country)
        if (p) cell = { rating: p.rating, origin: loc.type === 'parcel' ? 'countryProfile' : 'profile', fields: p.fields }
      }
      row[criterion.id] = cell && cell.rating != null ? cell : { rating: null, origin: 'missing', ...(cell || {}) }
    }
    cells[loc.key] = row
  }
  return { scope, locations, cells }
}

// ---------- scoring ----------

const toUnit = (rating) => (rating - 1) / 4

export function scoreLocation(row, weights) {
  let have = 0
  let sum = 0
  let total = 0
  const contributions = []
  const missing = []
  for (const id of CRITERION_IDS) {
    const w = weights[id] || 0
    total += w
    const rating = row[id]?.rating
    if (rating == null) { if (w > 0) missing.push({ id, weight: w }); continue }
    const x = toUnit(rating)
    have += w
    sum += w * x
    contributions.push({ id, weight: w, x, value: w * x })
  }
  const coverage = total > 0 ? have / total : 0
  const missingMass = total - have
  return {
    score: have > 0 ? (100 * sum) / have : null,
    low: total > 0 ? (100 * sum) / total : null,
    high: total > 0 ? (100 * (sum + missingMass)) / total : null,
    coverage,
    contributions,
    missing: missing.sort((a, b) => b.weight - a.weight),
  }
}

// rules = { minRatings: {criterionId: 1..5}, maxPricePerAcre: number|null }
export function checkDealbreakers(location, row, people) {
  const failed = []
  const unverified = []
  for (const person of people) {
    const rules = person.dealbreakers || {}
    for (const [id, min] of Object.entries(rules.minRatings || {})) {
      if (!min || !criterionById(id)) continue
      const rating = row[id]?.rating
      if (rating == null) unverified.push({ person: person.name, id, min })
      else if (rating < Number(min)) failed.push({ person: person.name, id, min, rating })
    }
    const cap = Number(rules.maxPricePerAcre)
    if (cap > 0 && location.type === 'parcel') {
      const ppa = pricePerAcre(location.raw)
      if (ppa == null) unverified.push({ person: person.name, id: 'land_price', cap })
      else if (ppa > cap) failed.push({ person: person.name, id: 'land_price', cap, pricePerAcre: ppa })
    }
  }
  return { failed, unverified }
}

function compareScored(a, b) {
  if (a.score == null && b.score == null) return a.name.localeCompare(b.name)
  if (a.score == null) return 1
  if (b.score == null) return -1
  return b.score - a.score || b.coverage - a.coverage || a.name.localeCompare(b.name)
}

export function rankLocations(matrix, weights, people = []) {
  const ranked = []
  const excluded = []
  for (const loc of matrix.locations) {
    const row = matrix.cells[loc.key]
    const s = scoreLocation(row, weights)
    const deal = checkDealbreakers(loc, row, people)
    const entry = { ...loc, ...s, dealbreakers: deal, why: explain(s, row) }
    if (deal.failed.length) excluded.push(entry)
    else ranked.push(entry)
  }
  ranked.sort(compareScored)
  ranked.forEach((r, i) => { r.rank = i + 1 })
  return { ranked, excluded }
}

// Plain-language reasons, as data the UI translates.
export function explain(scored, row) {
  const strengths = scored.contributions
    .filter((c) => c.x >= 0.6 && c.weight > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 3)
    .map((c) => ({ id: c.id, rating: row[c.id].rating, origin: row[c.id].origin }))
  const weaknesses = scored.contributions
    .filter((c) => c.x <= 0.35 && c.weight > 0)
    .sort((a, b) => b.weight * (1 - b.x) - a.weight * (1 - a.x))
    .slice(0, 3)
    .map((c) => ({ id: c.id, rating: row[c.id].rating, origin: row[c.id].origin }))
  const gaps = scored.missing.slice(0, 4).map((m) => m.id)
  return { strengths, weaknesses, gaps }
}

// ---------- sensitivity ----------

// Move criterion k's weight to t, scaling the others so the total stays 1.
export function shiftWeight(weights, k, t) {
  const rest = 1 - (weights[k] || 0)
  const out = {}
  for (const id of CRITERION_IDS) {
    if (id === k) out[id] = t
    else out[id] = rest > 0 ? ((weights[id] || 0) * (1 - t)) / rest : (1 - t) / (CRITERION_IDS.length - 1)
  }
  return out
}

function leaderOf(matrix, weights, eligibleKeys) {
  let best = null
  for (const loc of matrix.locations) {
    if (!eligibleKeys.has(loc.key)) continue
    const s = scoreLocation(matrix.cells[loc.key], weights)
    const entry = { key: loc.key, name: loc.name, score: s.score, coverage: s.coverage }
    if (!best || compareScored(entry, best) < 0) best = entry
  }
  return best
}

// For each criterion: the nearest weight (0..1, 1% steps) at which the top pick changes.
export function sensitivity(matrix, weights, ranked, step = 0.01) {
  const scoredRanked = ranked.filter((r) => r.score != null)
  if (scoredRanked.length < 2) return { leader: scoredRanked[0] || null, runnerUp: null, flips: [], dataRisks: [] }
  const leader = scoredRanked[0]
  const runnerUp = scoredRanked[1]
  const eligible = new Set(scoredRanked.map((r) => r.key))
  const flips = []
  for (const id of CRITERION_IDS) {
    const current = weights[id] || 0
    let found = null
    const steps = Math.round(1 / step)
    for (let d = 1; d <= steps && !found; d++) {
      for (const t of [current + d * step, current - d * step]) {
        if (t < 0 || t > 1) continue
        const l = leaderOf(matrix, shiftWeight(weights, id, t), eligible)
        if (l && l.key !== leader.key) { found = { id, current, flipAt: t, newLeader: l.name, newLeaderKey: l.key }; break }
      }
    }
    if (found) flips.push(found)
  }
  flips.sort((a, b) => Math.abs(a.flipAt - a.current) - Math.abs(b.flipAt - b.current))

  // Missing data that could flip the result: another option's best case beats the leader's worst case.
  const dataRisks = scoredRanked.slice(1)
    .filter((r) => r.high != null && leader.low != null && r.high > leader.low && (r.coverage < 1 || leader.coverage < 1))
    .map((r) => ({ key: r.key, name: r.name, high: r.high, leaderLow: leader.low }))

  return { leader, runnerUp, gap: leader.score - runnerUp.score, flips, dataRisks }
}

// ---------- everything together ----------

// people = [{ memberId, name, response: {sliders, pairwise, top, dealbreakers} }]
export function runQuiz({ matrix, people }) {
  const persons = people.map((p) => {
    const { weights, consistency } = personWeights(p.response)
    return { memberId: p.memberId, name: p.name, weights, consistency, dealbreakers: p.response?.dealbreakers || {} }
  })
  const groupWeights = combineWeights(persons.map((p) => p.weights))
  const group = rankLocations(matrix, groupWeights, persons)
  const perPerson = persons.map((p) => {
    const r = rankLocations(matrix, p.weights, [p])
    return { memberId: p.memberId, name: p.name, top: r.ranked.filter((x) => x.score != null).slice(0, 3).map((x) => ({ key: x.key, name: x.name, score: x.score })) }
  })
  // How each person would rank the group's shortlist, to show agreement per location.
  const personalRanks = {}
  for (const p of persons) {
    const r = rankLocations(matrix, p.weights, [])
    r.ranked.forEach((x) => {
      personalRanks[x.key] = personalRanks[x.key] || {}
      personalRanks[x.key][p.name] = x.score == null ? null : x.rank
    })
  }
  return {
    persons,
    groupWeights,
    ranked: group.ranked,
    excluded: group.excluded,
    perPerson,
    personalRanks,
    agreement: weightAgreement(persons),
    sensitivity: sensitivity(matrix, groupWeights, group.ranked),
  }
}
