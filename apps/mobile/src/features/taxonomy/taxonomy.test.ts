import {
  categoriesForFlag,
  iconForCode,
  isValidCategory,
  isValidSubcategory,
  LEGACY_TYPE_MAP,
  labelKeyForCode,
  ROOT_CODES,
  rootOf,
  subcategoriesForFlag,
  TAXONOMY,
} from './taxonomy'

describe('taxonomy', () => {
  it('has exactly the 8 canonical roots in order', () => {
    expect(ROOT_CODES).toEqual([
      'transport',
      'lodging',
      'food',
      'activity',
      'shopping',
      'health',
      'fees',
      'other',
    ])
  })

  it('every subcategory code is dotted and prefixed by its root', () => {
    for (const root of TAXONOMY) {
      for (const leaf of root.subcategories) {
        expect(leaf.code.startsWith(`${root.code}.`)).toBe(true)
      }
    }
  })

  it('every subcategory code is globally unique', () => {
    const all = TAXONOMY.flatMap((r) => r.subcategories.map((s) => s.code))
    expect(new Set(all).size).toBe(all.length)
  })

  it('rootOf strips the leaf', () => {
    expect(rootOf('transport.flight')).toBe('transport')
    expect(rootOf('transport')).toBe('transport')
  })

  it('validates categories and subcategories against the closed set', () => {
    expect(isValidCategory('transport')).toBe(true)
    expect(isValidCategory('transport.flight')).toBe(false)
    expect(isValidCategory('nope')).toBe(false)
    expect(isValidCategory(null)).toBe(false)
    expect(isValidSubcategory('transport.flight')).toBe(true)
    expect(isValidSubcategory('transport')).toBe(false)
    expect(isValidSubcategory(undefined)).toBe(false)
  })

  it('resolves the most specific icon, falling back safely', () => {
    expect(iconForCode('transport', 'transport.flight')).toBe('airplane')
    expect(iconForCode('transport', null)).toBe('navigate')
    expect(iconForCode('other', null)).toBe('apps')
    // a bare dotted code passed as category still resolves (legacy safety)
    expect(iconForCode('transport.flight')).toBe('airplane')
    expect(iconForCode(null)).toBe('pricetag')
    expect(iconForCode('unknown')).toBe('pricetag')
  })

  it('builds nested i18n keys from codes', () => {
    expect(labelKeyForCode('transport')).toBe('taxonomy.transport._root')
    expect(labelKeyForCode('transport.flight')).toBe('taxonomy.transport.flight')
  })

  it('hides expenses-only nodes from the events flag', () => {
    const roots = categoriesForFlag('events')
    expect(roots.map((r) => r.code)).not.toContain('fees')
    // shopping stays because shopping.general is event-capable
    expect(roots.map((r) => r.code)).toContain('shopping')
    const shoppingSubs = subcategoriesForFlag('shopping', 'events').map((s) => s.code)
    expect(shoppingSubs).toEqual(['shopping.general'])
    // transport keeps every both-leaf but drops the expenses-only parking
    const transportSubs = subcategoriesForFlag('transport', 'events').map((s) => s.code)
    expect(transportSubs).not.toContain('transport.parking')
    expect(transportSubs).toContain('transport.flight')
  })

  it('maps every legacy event type losslessly', () => {
    expect(LEGACY_TYPE_MAP.flight).toEqual({
      category: 'transport',
      subcategory: 'transport.flight',
    })
    expect(LEGACY_TYPE_MAP.event).toEqual({ category: 'other', subcategory: 'other.event' })
    expect(LEGACY_TYPE_MAP.food).toEqual({ category: 'food', subcategory: null })
    for (const v of Object.values(LEGACY_TYPE_MAP)) {
      expect(isValidCategory(v.category)).toBe(true)
      if (v.subcategory) {
        expect(isValidSubcategory(v.subcategory)).toBe(true)
      }
    }
  })
})
