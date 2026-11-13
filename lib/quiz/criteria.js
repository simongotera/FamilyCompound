// Criteria for the location quiz, grounded in common homesteading site-selection checklists
// (climate/growing season, water, soil, price, cost of living, zoning, hazards, services, people).
//
// Every location gets a 1–5 rating per criterion, from one of three places, in this order:
//   1. a "location fact" a family member researched and entered with a source (always wins),
//   2. a value computed from real numbers in the app (price per acre from a parcel's price and acreage),
//   3. a proxy mapped from a Country Profile field (e.g. natural_disaster_risk: low → 5, high → 1).
// When none exist the rating is missing. The engine never fills a gap with a guess; it reports
// coverage and a best/worst-case range instead.
//
// `profile` maps a Country Profile enum to a 1–5 rating. These maps are judgment calls about how
// a category translates to "good for us", not data; the UI labels them as "from country profile".

export const CRITERIA = [
  { id: 'climate', group: 'land', dealbreaker: true },
  { id: 'water', group: 'land', dealbreaker: true },
  { id: 'soil', group: 'land', dealbreaker: true },
  { id: 'hazards', group: 'land', dealbreaker: true, profile: { field: 'natural_disaster_risk', map: { low: 5, moderate: 3, high: 1 } } },
  { id: 'land_price', group: 'money', dealbreaker: false, computed: 'price_per_acre' },
  { id: 'cost_of_living', group: 'money', dealbreaker: true, profile: { field: 'cost_of_living', map: { low: 5, moderate: 3, high: 1 } } },
  { id: 'zoning', group: 'legal', dealbreaker: true, profile: { field: 'zoning_strictness', map: { flexible: 5, moderate: 3, strict: 1 } } },
  { id: 'property_access', group: 'legal', dealbreaker: true, profile: { field: 'property_purchase_difficulty', map: { easy: 5, moderate: 3.7, hard: 2.3, restricted: 1 } } },
  { id: 'residency', group: 'legal', dealbreaker: true, profile: { field: 'clear_path_citizenship', map: { yes: 5, complex: 3, no: 1 } } },
  { id: 'healthcare', group: 'services', dealbreaker: true, profile: { field: 'healthcare_system', map: { universal: 5, mixed: 3.5, private: 2 } } },
  { id: 'internet', group: 'services', dealbreaker: true },
  { id: 'safety', group: 'people', dealbreaker: true, profile: { fields: ['safety_level', 'socioeconomic_stability'], maps: { safety_level: { very_safe: 5, moderate: 3, caution: 1 }, socioeconomic_stability: { strong: 5, moderate: 3, unstable: 1 } } } },
  { id: 'family_distance', group: 'people', dealbreaker: true },
  { id: 'community', group: 'people', dealbreaker: false, profile: { field: 'latino_community', map: { strong: 5, moderate: 3, minimal: 1 } } },
  { id: 'language', group: 'people', dealbreaker: true, profile: { field: 'language_barrier', map: { low: 5, moderate: 3, high: 1 } } },
]

export const CRITERION_IDS = CRITERIA.map((c) => c.id)
export const GROUPS = ['land', 'money', 'legal', 'services', 'people']

// Country Profile text fields shown next to a criterion as context (never scored automatically).
export const CONTEXT_FIELDS = {
  climate: ['summer_temp_range', 'winter_temp_range', 'annual_rainy_days', 'annual_sunny_days'],
  water: ['annual_rainy_days'],
  hazards: ['natural_disaster_notes'],
  family_distance: ['distance_from_family'],
  residency: ['retiree_pathway', 'citizenship_timeline_years'],
  language: ['primary_language'],
}

// Parcel fields shown as context.
export const PARCEL_CONTEXT_FIELDS = {
  water: ['water_source'],
  zoning: ['zoning'],
  internet: ['utilities'],
}

// What a 1–5 rating means, shown when someone enters researched data.
export const RATING_SCALE = [1, 2, 3, 4, 5]

export function criterionById(id) {
  return CRITERIA.find((c) => c.id === id)
}
