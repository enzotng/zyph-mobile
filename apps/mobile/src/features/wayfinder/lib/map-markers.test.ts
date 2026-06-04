import { POI_ICONS } from '../schemas'
import { layerOf, mapSymbolFor, mapTintFor, sfSymbolForPoiIcon } from './map-markers'

const colors = { primary: '#6366f1', accent: '#0ea5e9', success: '#22c55e' }

describe('layerOf', () => {
  it('folds gate into the events layer', () => {
    expect(layerOf('gate')).toBe('event')
  })

  it('maps the other kinds to themselves', () => {
    expect(layerOf('event')).toBe('event')
    expect(layerOf('poi')).toBe('poi')
    expect(layerOf('member')).toBe('member')
  })
})

describe('mapTintFor', () => {
  it('tints by layer', () => {
    expect(mapTintFor(colors, 'event')).toBe(colors.primary)
    expect(mapTintFor(colors, 'gate')).toBe(colors.primary)
    expect(mapTintFor(colors, 'poi')).toBe(colors.accent)
    expect(mapTintFor(colors, 'member')).toBe(colors.success)
  })
})

describe('sfSymbolForPoiIcon', () => {
  it('maps known POI icons to symbols', () => {
    expect(sfSymbolForPoiIcon('food')).toBe('fork.knife')
    expect(sfSymbolForPoiIcon('taxi')).toBe('car.fill')
    expect(sfSymbolForPoiIcon('wifi')).toBe('wifi')
    expect(sfSymbolForPoiIcon('star')).toBe('star.fill')
  })

  it('returns a symbol for every canonical POI icon', () => {
    for (const icon of POI_ICONS) {
      expect(sfSymbolForPoiIcon(icon).length).toBeGreaterThan(0)
    }
  })

  it('falls back to mappin for unknown or empty icons', () => {
    expect(sfSymbolForPoiIcon('nonsense')).toBe('mappin')
    expect(sfSymbolForPoiIcon('')).toBe('mappin')
  })
})

describe('mapSymbolFor', () => {
  it('uses a fixed symbol per non-poi kind', () => {
    expect(mapSymbolFor('event', 'pin')).toBe('calendar')
    expect(mapSymbolFor('gate', 'gate')).toBe('airplane')
    expect(mapSymbolFor('member', 'star')).toBe('person.fill')
  })

  it('uses the POI icon symbol for places', () => {
    expect(mapSymbolFor('poi', 'food')).toBe('fork.knife')
    expect(mapSymbolFor('poi', 'cash')).toBe('dollarsign.circle.fill')
  })
})
