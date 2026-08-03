export const ENUM_OPTIONS = {
  clear_path_citizenship: ['yes', 'no', 'complex'],
  retiree_pathway: ['income_based', 'family_sponsorship', 'sponsorship_lottery', 'visitor_only', 'ancestry', 'none'],
  property_purchase_difficulty: ['easy', 'moderate', 'hard', 'restricted'],
  zoning_strictness: ['flexible', 'moderate', 'strict'],
  natural_disaster_risk: ['low', 'moderate', 'high'],
  socioeconomic_stability: ['strong', 'moderate', 'unstable'],
  cost_of_living: ['low', 'moderate', 'high'],
  healthcare_system: ['universal', 'private', 'mixed'],
  safety_level: ['very_safe', 'moderate', 'caution'],
  language_barrier: ['low', 'moderate', 'high'],
  latino_community: ['strong', 'moderate', 'minimal'],
}

export const FILTER_FIELDS = [
  'clear_path_citizenship',
  'retiree_pathway',
  'property_purchase_difficulty',
  'healthcare_system',
  'language_barrier',
]

// Highlight fields surfaced on the collapsed card and on land-parcel badges.
export const SUMMARY_FIELDS = ['clear_path_citizenship', 'retiree_pathway', 'property_purchase_difficulty', 'healthcare_system']

export const SECTIONS = [
  {
    titleKey: 'countries.sectionImmigration',
    fields: [
      { name: 'clear_path_citizenship', kind: 'enum' },
      { name: 'clear_path_citizenship_notes', kind: 'notes' },
      { name: 'citizenship_timeline_years', kind: 'number' },
      { name: 'citizenship_timeline_notes', kind: 'notes' },
      { name: 'dual_citizenship_allowed', kind: 'boolean' },
      { name: 'dual_citizenship_notes', kind: 'notes' },
      { name: 'retiree_pathway', kind: 'enum' },
      { name: 'retiree_pathway_notes', kind: 'notes' },
      { name: 'working_pathway', kind: 'text' },
      { name: 'working_pathway_notes', kind: 'notes' },
      { name: 'ancestry_pathway_available', kind: 'boolean' },
      { name: 'ancestry_pathway_notes', kind: 'notes' },
      { name: 'family_sponsorship_available', kind: 'boolean' },
      { name: 'family_sponsorship_notes', kind: 'notes' },
    ],
  },
  {
    titleKey: 'countries.sectionProperty',
    fields: [
      { name: 'property_purchase_difficulty', kind: 'enum' },
      { name: 'property_purchase_notes', kind: 'notes' },
      { name: 'zoning_strictness', kind: 'enum' },
      { name: 'zoning_notes', kind: 'notes' },
    ],
  },
  {
    titleKey: 'countries.sectionClimate',
    fields: [
      { name: 'summer_temp_range', kind: 'text' },
      { name: 'winter_temp_range', kind: 'text' },
      { name: 'annual_rainy_days', kind: 'number' },
      { name: 'annual_sunny_days', kind: 'number' },
      { name: 'natural_disaster_risk', kind: 'enum' },
      { name: 'natural_disaster_notes', kind: 'notes' },
    ],
  },
  {
    titleKey: 'countries.sectionEconomy',
    fields: [
      { name: 'socioeconomic_stability', kind: 'enum' },
      { name: 'socioeconomic_notes', kind: 'notes' },
      { name: 'cost_of_living', kind: 'enum' },
      { name: 'cost_of_living_notes', kind: 'notes' },
    ],
  },
  {
    titleKey: 'countries.sectionHealthcare',
    fields: [
      { name: 'healthcare_system', kind: 'enum' },
      { name: 'healthcare_notes', kind: 'notes' },
      { name: 'safety_level', kind: 'enum' },
      { name: 'safety_notes', kind: 'notes' },
    ],
  },
  {
    titleKey: 'countries.sectionCulture',
    fields: [
      { name: 'primary_language', kind: 'text' },
      { name: 'language_barrier', kind: 'enum' },
      { name: 'language_notes', kind: 'notes' },
      { name: 'latino_community', kind: 'enum' },
      { name: 'latino_community_notes', kind: 'notes' },
    ],
  },
  {
    titleKey: 'countries.sectionRegional',
    fields: [
      { name: 'regional_bloc', kind: 'text' },
      { name: 'regional_bloc_notes', kind: 'notes' },
      { name: 'geopolitical_outlook_notes', kind: 'longtext' },
      { name: 'distance_from_family', kind: 'text' },
    ],
  },
  {
    titleKey: 'countries.sectionPractical',
    fields: [
      { name: 'additional_notes', kind: 'longtext' },
      { name: 'research_sources', kind: 'longtext' },
    ],
  },
]

export function emptyCountryForm() {
  const form = { name: '', flag_emoji: '', region: '' }
  for (const section of SECTIONS) {
    for (const field of section.fields) {
      form[field.name] = field.kind === 'boolean' ? false : field.kind === 'number' ? '' : ''
    }
  }
  return form
}
