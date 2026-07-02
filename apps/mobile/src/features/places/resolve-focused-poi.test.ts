import type { Poi } from './poi.types'
import { resolveFocusedPoi } from './resolve-focused-poi'

function poi(placeId: string): Poi {
  return {
    placeId,
    name: placeId,
    lat: 0,
    lng: 0,
    rating: null,
    ratingCount: null,
    priceLevel: null,
    types: [],
    photoName: null,
    address: null,
    openNow: null,
  }
}

describe('resolveFocusedPoi', () => {
  it('resolves from the union result when the id is there', () => {
    const union = [poi('a'), poi('b')]
    const grid = [poi('c')]

    expect(resolveFocusedPoi('b', union, grid)).toEqual(poi('b'))
  })

  it('falls back to the grid result when the union result misses it', () => {
    const union = [poi('a')]
    const grid = [poi('b')]

    expect(resolveFocusedPoi('b', union, grid)).toEqual(poi('b'))
  })

  it('prefers the union match over a same-id grid match', () => {
    const unionMatch = { ...poi('a'), name: 'Union name' }
    const gridMatch = { ...poi('a'), name: 'Grid name' }

    expect(resolveFocusedPoi('a', [unionMatch], [gridMatch])).toEqual(unionMatch)
  })

  it('returns null when neither result has the id', () => {
    expect(resolveFocusedPoi('missing', [poi('a')], [poi('b')])).toBeNull()
  })

  it('returns null when both results are null or undefined', () => {
    expect(resolveFocusedPoi('a', null, undefined)).toBeNull()
  })
})
