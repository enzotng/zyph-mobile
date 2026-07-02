import type { TFunction } from 'i18next'

import type { Poi } from './poi.types'
import { formatPriceRange } from './price'

// formatPriceRange is i18n-aware for the one-sided cases; the mock t echoes the key + options
// so we can assert which branch (and therefore which locale key) was chosen, same pattern as
// countdown.test.ts / schemas.test.ts.
const t = ((key: string, options?: Record<string, unknown>) =>
  `${key}:${JSON.stringify(options)}`) as unknown as TFunction

function makePoi(overrides: Partial<Poi> = {}): Poi {
  return {
    placeId: 'place-1',
    name: 'Test place',
    lat: 0,
    lng: 0,
    rating: null,
    ratingCount: null,
    priceLevel: null,
    types: [],
    photoName: null,
    address: null,
    openNow: null,
    description: null,
    typeLabel: null,
    priceStart: null,
    priceEnd: null,
    priceCurrency: null,
    weekdayHours: null,
    ...overrides,
  }
}

describe('formatPriceRange', () => {
  it('returns a plain "start-end currency" string when both bounds are known', () => {
    const poi = makePoi({ priceStart: 10, priceEnd: 20, priceCurrency: 'EUR' })

    expect(formatPriceRange(poi, t)).toBe('10-20 EUR')
  })

  it('omits the currency when it is unknown', () => {
    const poi = makePoi({ priceStart: 10, priceEnd: 20, priceCurrency: null })

    expect(formatPriceRange(poi, t)).toBe('10-20')
  })

  it('translates a "from" label when only the start bound is known', () => {
    const poi = makePoi({ priceStart: 10, priceEnd: null, priceCurrency: 'EUR' })

    expect(formatPriceRange(poi, t)).toBe('activities.priceFrom:{"price":"10 EUR"}')
  })

  it('translates an "up to" label when only the end bound is known', () => {
    const poi = makePoi({ priceStart: null, priceEnd: 20, priceCurrency: 'EUR' })

    expect(formatPriceRange(poi, t)).toBe('activities.priceUpTo:{"price":"20 EUR"}')
  })

  it('returns null when neither bound is known', () => {
    expect(formatPriceRange(makePoi(), t)).toBeNull()
  })
})
