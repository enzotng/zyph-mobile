import {
  categoryIcon,
  dedupeSuggestions,
  groupByCategory,
  inferCategory,
  PACKING_CATEGORIES,
  type PackingItem,
} from './schemas'

function item(category: string, label: string): PackingItem {
  return {
    id: `${category}-${label}`,
    trip_id: 't1',
    scope: 'shared',
    owner_id: 'u1',
    label,
    category,
    quantity: 1,
    assigned_member: null,
    packed: false,
    created_at: '2026-06-06T00:00:00.000Z',
  }
}

describe('categoryIcon', () => {
  it('maps every category to a glyph and falls back', () => {
    for (const c of PACKING_CATEGORIES) {
      expect(typeof categoryIcon(c)).toBe('string')
    }
    expect(categoryIcon('clothes')).toBe('shirt-outline')
    expect(categoryIcon('weird')).toBe('cube-outline')
  })
})

describe('groupByCategory', () => {
  it('groups in canonical order, dropping empty categories', () => {
    const groups = groupByCategory([
      item('documents', 'Passport'),
      item('clothes', 'Socks'),
      item('clothes', 'Jacket'),
    ])
    expect(groups.map((g) => g.category)).toEqual(['clothes', 'documents'])
    expect(groups[0].items).toHaveLength(2)
  })

  it('routes an unknown category into other', () => {
    const groups = groupByCategory([item('weird', 'Thing')])
    expect(groups.map((g) => g.category)).toEqual(['other'])
  })

  it('returns nothing for an empty list', () => {
    expect(groupByCategory([])).toEqual([])
  })
})

describe('inferCategory', () => {
  it('infers a category from keywords (fr + en)', () => {
    expect(inferCategory('Passeport')).toBe('documents')
    expect(inferCategory('Brosse à dents')).toBe('toiletries')
    expect(inferCategory('Chargeur USB')).toBe('electronics')
    expect(inferCategory('T-shirt')).toBe('clothes')
    expect(inferCategory('Masque')).toBe('health')
  })

  it('falls back to other for unknown labels', () => {
    expect(inferCategory('Licorne')).toBe('other')
    expect(inferCategory('')).toBe('other')
  })
})

describe('dedupeSuggestions', () => {
  it('drops suggestions already present (case-insensitive) and within the batch', () => {
    const result = dedupeSuggestions(
      [{ label: 'Passport' }],
      [
        { label: 'passport', category: 'documents', quantity: 1 },
        { label: 'Socks', category: 'clothes', quantity: 3 },
        { label: 'socks', category: 'clothes', quantity: 1 },
        { label: '  ', category: 'other', quantity: 1 },
      ],
    )
    expect(result.map((r) => r.label)).toEqual(['Socks'])
  })
})
