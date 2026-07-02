import { INTERESTS } from '@/features/trips'

import {
  ACTIVITY_CATEGORIES,
  type ActivityCategory,
  categoriesForTrip,
  googleTypesFor,
  INTEREST_GOOGLE_TYPES,
} from './categories'

describe('googleTypesFor', () => {
  it('always includes the base set (restaurant + tourist_attraction) even with no interests', () => {
    expect(googleTypesFor([])).toEqual(['restaurant', 'tourist_attraction'])
  })

  it('adds the mapped Google types for each known interest', () => {
    const types = googleTypesFor(['museums', 'nightlife'])

    expect(types).toEqual(
      expect.arrayContaining(['restaurant', 'tourist_attraction', 'museum', 'bar', 'night_club']),
    )
  })

  it('skips an interest with no Google types mapping', () => {
    expect(googleTypesFor(['not-a-real-interest'])).toEqual(['restaurant', 'tourist_attraction'])
  })

  it('caps the result at 10 Google types', () => {
    const types = googleTypesFor(Object.keys(INTEREST_GOOGLE_TYPES))

    expect(types.length).toBeLessThanOrEqual(10)
  })
})

describe('ACTIVITY_CATEGORIES', () => {
  it('has one category per INTERESTS key plus the highlights and food defaults', () => {
    expect(ACTIVITY_CATEGORIES).toHaveLength(INTERESTS.length + 2)
  })

  it('includes the highlights default', () => {
    expect(ACTIVITY_CATEGORIES).toContainEqual<ActivityCategory>({
      key: 'highlights',
      labelKey: 'activities.categories.highlights',
      googleTypes: ['tourist_attraction'],
    })
  })

  it('includes the food default', () => {
    expect(ACTIVITY_CATEGORIES).toContainEqual<ActivityCategory>({
      key: 'food',
      labelKey: 'activities.categories.food',
      googleTypes: ['restaurant'],
    })
  })

  it('maps each interest key to its i18n labelKey and Google types', () => {
    const museums = ACTIVITY_CATEGORIES.find((category) => category.key === 'museums')

    expect(museums).toEqual<ActivityCategory>({
      key: 'museums',
      labelKey: 'tripPreferences.options.interests.museums',
      googleTypes: ['museum'],
    })
  })
})

describe('categoriesForTrip', () => {
  it('puts the trip interests first, in profile order, then highlights and food', () => {
    const result = categoriesForTrip(['museums', 'nature'])

    expect(result.map((category) => category.key)).toEqual([
      'museums',
      'nature',
      'highlights',
      'food',
    ])
  })

  it('dedups "food" when the food interest is already present', () => {
    const result = categoriesForTrip(['food', 'history'])

    expect(result.map((category) => category.key)).toEqual(['food', 'history', 'highlights'])
  })

  it('falls back to [highlights, food, museums, nature] when there are no interests', () => {
    const result = categoriesForTrip([])

    expect(result.map((category) => category.key)).toEqual([
      'highlights',
      'food',
      'museums',
      'nature',
    ])
  })

  it('skips an interest unknown to the categories map', () => {
    const result = categoriesForTrip(['made-up-interest', 'art'])

    expect(result.map((category) => category.key)).toEqual(['art', 'highlights', 'food'])
  })

  it('never duplicates a category even with duplicate interests', () => {
    const result = categoriesForTrip(['art', 'art'])

    expect(result.map((category) => category.key)).toEqual(['art', 'highlights', 'food'])
  })
})
