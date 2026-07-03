import { INTERESTS } from '@/features/trips'

// A chip/card category for the Activities discovery surface: a Google Places search plus the
// i18n label used to render it. Shared by the copilot planning search and later Activities
// tasks (screen, detail sheet, cockpit carousel).
export type ActivityCategory = {
  key: string
  labelKey: string
  googleTypes: string[]
}

// Maps trip interest keys (stored as strings in the DB) to Google Places types. Always
// includes a base set so the model has candidates even when no interests are configured.
// Single source of truth for both the copilot planning search (googleTypesFor) and the
// Activities category chips (ACTIVITY_CATEGORIES below).
export const INTEREST_GOOGLE_TYPES: Record<string, string[]> = {
  food: ['restaurant'],
  nightlife: ['bar', 'night_club'],
  museums: ['museum'],
  nature: ['park'],
  shopping: ['shopping_mall'],
  sports: ['stadium'],
  history: ['historical_landmark'],
  art: ['art_gallery'],
  music: ['performing_arts_theater'],
  photography: ['tourist_attraction'],
  relaxation: ['spa'],
  local_culture: ['tourist_attraction'],
}

export function googleTypesFor(interests: string[]): string[] {
  const set = new Set<string>(['restaurant', 'tourist_attraction'])
  for (const interest of interests) {
    for (const googleType of INTEREST_GOOGLE_TYPES[interest] ?? []) {
      set.add(googleType)
    }
  }
  // The poi-search edge function caps includedTypes at 10.
  return Array.from(set).slice(0, 10)
}

// The two defaults + one category per trip-profile interest (INTERESTS, from @/features/trips).
export const ACTIVITY_CATEGORIES: ActivityCategory[] = [
  {
    key: 'highlights',
    labelKey: 'activities.categories.highlights',
    googleTypes: ['tourist_attraction'],
  },
  { key: 'food', labelKey: 'activities.categories.food', googleTypes: ['restaurant'] },
  ...INTERESTS.map((key) => ({
    key,
    labelKey: `tripPreferences.options.interests.${key}`,
    googleTypes: INTEREST_GOOGLE_TYPES[key] ?? [],
  })),
]

// Fallback chips shown when the trip has no profile interests set.
const DEFAULT_CATEGORY_KEYS = ['highlights', 'food', 'museums', 'nature']

// Chips for a trip: the trip's interests first (profile order, mapped to their categories),
// then 'highlights' and 'food' (deduped - e.g. the 'food' interest already covers food), and
// when the trip has no interests: [highlights, food, museums, nature].
export function categoriesForTrip(interests: string[]): ActivityCategory[] {
  const byKey = new Map(ACTIVITY_CATEGORIES.map((category) => [category.key, category]))

  if (interests.length === 0) {
    return DEFAULT_CATEGORY_KEYS.map((key) => byKey.get(key)).filter(
      (category): category is ActivityCategory => category !== undefined,
    )
  }

  const result: ActivityCategory[] = []
  const seen = new Set<string>()
  const add = (key: string) => {
    const category = byKey.get(key)
    if (category && !seen.has(category.key)) {
      result.push(category)
      seen.add(category.key)
    }
  }

  for (const interest of interests) {
    add(interest)
  }
  add('highlights')
  add('food')

  return result
}
