// Candidate countries the family hasn't profiled yet, so the quiz can suggest places to look
// at rather than only ranking what's already been researched.
//
// THE RULE THIS FILE OBEYS: no borrowed numbers.
//
// While building this I searched for naturalisation timelines and found secondary sources
// contradicting each other, and Portugal's requirement apparently moved to ten years under a
// 2026 law — a figure I would have written as five from memory and got wrong. So this file
// deliberately contains NO years, prices, rainfall or index scores. It holds only coarse,
// slow-moving categories, each tagged with how much to trust it, plus the official place to
// check. Anything time-sensitive is left out entirely and listed under `verify`.
//
// confidence:
//   'established' — stable, uncontroversial facts (what language is spoken, which bloc).
//   'estimate'    — a reasonable prior that MUST be checked before it influences a decision.
//                   The UI labels these, and the quiz marks every reference country's score
//                   as provisional.
//
// Values use exactly the same enums as a real Country Profile (lib/countryFields.js), so a
// candidate can be promoted into a proper profile without re-typing anything.

export const REFERENCE_SOURCES = {
  hazards: { label: 'INFORM Risk Index (EC Joint Research Centre)', url: 'https://drmkc.jrc.ec.europa.eu/inform-index/INFORM-Risk/Results-and-data' },
  residency: { label: "the country's own immigration authority", url: null },
  cost_of_living: { label: 'World Bank / national statistics office', url: 'https://data.worldbank.org/' },
  healthcare: { label: 'WHO country profile', url: 'https://data.who.int/countries' },
  climate: { label: 'national meteorological service 1991–2020 normals', url: null },
  property_access: { label: "the country's land registry or a local notary", url: null },
  zoning: { label: 'the municipality where the land is', url: null },
  safety: { label: 'national statistics + your own visit', url: null },
}

// Every entry below is a starting point for research, not a finding.
const C = (name, flag, region, fields, verify) => ({ name, flag, region, fields, verify })

export const REFERENCE_COUNTRIES = [
  C('Uruguay', '🇺🇾', 'South America', {
    primary_language: { value: 'Spanish', confidence: 'established' },
    language_barrier: { value: 'low', confidence: 'established' },
    latino_community: { value: 'strong', confidence: 'established' },
    natural_disaster_risk: { value: 'low', confidence: 'estimate' },
    socioeconomic_stability: { value: 'strong', confidence: 'estimate' },
    healthcare_system: { value: 'mixed', confidence: 'estimate' },
    property_purchase_difficulty: { value: 'easy', confidence: 'estimate' },
  }, ['residency', 'cost_of_living', 'zoning', 'climate']),

  C('Costa Rica', '🇨🇷', 'Central America', {
    primary_language: { value: 'Spanish', confidence: 'established' },
    language_barrier: { value: 'low', confidence: 'established' },
    latino_community: { value: 'strong', confidence: 'established' },
    healthcare_system: { value: 'universal', confidence: 'estimate' },
    natural_disaster_risk: { value: 'high', confidence: 'estimate' },
    socioeconomic_stability: { value: 'moderate', confidence: 'estimate' },
    property_purchase_difficulty: { value: 'easy', confidence: 'estimate' },
  }, ['residency', 'cost_of_living', 'zoning', 'climate', 'hazards']),

  C('Panama', '🇵🇦', 'Central America', {
    primary_language: { value: 'Spanish', confidence: 'established' },
    language_barrier: { value: 'low', confidence: 'established' },
    latino_community: { value: 'strong', confidence: 'established' },
    healthcare_system: { value: 'mixed', confidence: 'estimate' },
    natural_disaster_risk: { value: 'moderate', confidence: 'estimate' },
    property_purchase_difficulty: { value: 'easy', confidence: 'estimate' },
  }, ['residency', 'cost_of_living', 'zoning', 'climate', 'safety']),

  C('Chile', '🇨🇱', 'South America', {
    primary_language: { value: 'Spanish', confidence: 'established' },
    language_barrier: { value: 'low', confidence: 'established' },
    latino_community: { value: 'strong', confidence: 'established' },
    socioeconomic_stability: { value: 'strong', confidence: 'estimate' },
    healthcare_system: { value: 'mixed', confidence: 'estimate' },
    natural_disaster_risk: { value: 'high', confidence: 'estimate' },
  }, ['residency', 'cost_of_living', 'zoning', 'climate', 'property_access']),

  C('Mexico', '🇲🇽', 'North America', {
    primary_language: { value: 'Spanish', confidence: 'established' },
    language_barrier: { value: 'low', confidence: 'established' },
    latino_community: { value: 'strong', confidence: 'established' },
    healthcare_system: { value: 'mixed', confidence: 'estimate' },
    natural_disaster_risk: { value: 'high', confidence: 'estimate' },
    cost_of_living: { value: 'low', confidence: 'estimate' },
  }, ['residency', 'zoning', 'climate', 'safety', 'property_access']),

  C('Colombia', '🇨🇴', 'South America', {
    primary_language: { value: 'Spanish', confidence: 'established' },
    language_barrier: { value: 'low', confidence: 'established' },
    latino_community: { value: 'strong', confidence: 'established' },
    healthcare_system: { value: 'mixed', confidence: 'estimate' },
    cost_of_living: { value: 'low', confidence: 'estimate' },
    natural_disaster_risk: { value: 'moderate', confidence: 'estimate' },
  }, ['residency', 'zoning', 'climate', 'safety', 'property_access']),

  C('Ecuador', '🇪🇨', 'South America', {
    primary_language: { value: 'Spanish', confidence: 'established' },
    language_barrier: { value: 'low', confidence: 'established' },
    latino_community: { value: 'strong', confidence: 'established' },
    cost_of_living: { value: 'low', confidence: 'estimate' },
    natural_disaster_risk: { value: 'high', confidence: 'estimate' },
    healthcare_system: { value: 'mixed', confidence: 'estimate' },
  }, ['residency', 'zoning', 'climate', 'safety', 'socioeconomic_stability']),

  C('Argentina', '🇦🇷', 'South America', {
    primary_language: { value: 'Spanish', confidence: 'established' },
    language_barrier: { value: 'low', confidence: 'established' },
    latino_community: { value: 'strong', confidence: 'established' },
    healthcare_system: { value: 'universal', confidence: 'estimate' },
    natural_disaster_risk: { value: 'low', confidence: 'estimate' },
  }, ['residency', 'cost_of_living', 'socioeconomic_stability', 'zoning', 'climate']),

  C('Spain', '🇪🇸', 'Europe', {
    primary_language: { value: 'Spanish', confidence: 'established' },
    language_barrier: { value: 'low', confidence: 'established' },
    latino_community: { value: 'strong', confidence: 'established' },
    healthcare_system: { value: 'universal', confidence: 'estimate' },
    socioeconomic_stability: { value: 'strong', confidence: 'estimate' },
    natural_disaster_risk: { value: 'moderate', confidence: 'estimate' },
  }, ['residency', 'cost_of_living', 'zoning', 'climate', 'property_access']),

  C('Portugal', '🇵🇹', 'Europe', {
    primary_language: { value: 'Portuguese', confidence: 'established' },
    language_barrier: { value: 'moderate', confidence: 'estimate' },
    latino_community: { value: 'moderate', confidence: 'estimate' },
    healthcare_system: { value: 'universal', confidence: 'estimate' },
    socioeconomic_stability: { value: 'strong', confidence: 'estimate' },
    natural_disaster_risk: { value: 'moderate', confidence: 'estimate' },
  }, ['residency', 'cost_of_living', 'zoning', 'climate']),

  C('Italy', '🇮🇹', 'Europe', {
    primary_language: { value: 'Italian', confidence: 'established' },
    language_barrier: { value: 'moderate', confidence: 'estimate' },
    latino_community: { value: 'minimal', confidence: 'estimate' },
    healthcare_system: { value: 'universal', confidence: 'estimate' },
    natural_disaster_risk: { value: 'high', confidence: 'estimate' },
  }, ['residency', 'cost_of_living', 'zoning', 'climate', 'property_access']),

  C('Greece', '🇬🇷', 'Europe', {
    primary_language: { value: 'Greek', confidence: 'established' },
    language_barrier: { value: 'high', confidence: 'estimate' },
    latino_community: { value: 'minimal', confidence: 'estimate' },
    healthcare_system: { value: 'universal', confidence: 'estimate' },
    natural_disaster_risk: { value: 'high', confidence: 'estimate' },
  }, ['residency', 'cost_of_living', 'zoning', 'climate', 'property_access']),
]

// Shape a reference entry like a Country Profile row, so the scoring code needs no special case.
export function referenceAsCountry(entry, index) {
  const row = {
    id: `ref:${entry.name}`,
    name: entry.name,
    flag_emoji: entry.flag,
    region: entry.region,
    __reference: true,
    __index: index,
    __verify: entry.verify,
    __confidence: Object.fromEntries(Object.entries(entry.fields).map(([k, v]) => [k, v.confidence])),
  }
  for (const [field, { value }] of Object.entries(entry.fields)) row[field] = value
  return row
}

export function referenceCountries(existingNames = []) {
  const taken = new Set(existingNames.map((n) => n.trim().toLowerCase()))
  return REFERENCE_COUNTRIES
    .filter((c) => !taken.has(c.name.toLowerCase()))
    .map(referenceAsCountry)
}

// What a promoted profile starts life as: the categories above, plus a research to-do list
// in the notes field rather than invented detail.
export function draftProfileFrom(entry) {
  const draft = { name: entry.name, flag_emoji: entry.flag, region: entry.region }
  for (const [field, { value }] of Object.entries(entry.fields)) draft[field] = value
  const lines = ['Started from The Compound’s reference list. Nothing here is researched yet — verify before relying on it.', '', 'Still to check:']
  for (const key of entry.verify) {
    const src = REFERENCE_SOURCES[key]
    lines.push(`- ${key}${src ? ` — ${src.label}${src.url ? ` (${src.url})` : ''}` : ''}`)
  }
  const estimates = Object.entries(entry.fields).filter(([, v]) => v.confidence === 'estimate').map(([k]) => k)
  if (estimates.length) {
    lines.push('', `Pre-filled as rough estimates, confirm each: ${estimates.join(', ')}`)
  }
  draft.research_sources = lines.join('\n')
  return draft
}
