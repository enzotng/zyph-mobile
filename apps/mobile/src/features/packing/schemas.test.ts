import {
  applyPackLight,
  assignCommunalRoundRobin,
  categoryIcon,
  dedupeSuggestions,
  duplicateSharedOwner,
  filterByTraveler,
  findDuplicateSharedItem,
  groupByCategory,
  groupReadiness,
  inferCategory,
  memberPackingProgress,
  PACKING_CATEGORIES,
  type PackingItem,
  type SuggestedItem,
  UNASSIGNED_FILTER,
  unassignedSharedCount,
} from './schemas'

type ItemOverrides = Partial<Pick<PackingItem, 'scope' | 'assigned_member' | 'packed'>>

function item(category: string, label: string, overrides: ItemOverrides = {}): PackingItem {
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
    ...overrides,
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

describe('applyPackLight', () => {
  const sug = (label: string, category: string, quantity: number): SuggestedItem => ({
    label,
    category,
    quantity,
  })

  it('caps repeat-wear clothing to a laundry-aware count', () => {
    const result = applyPackLight(
      [sug('T-shirts', 'clothes', 12), sug('Socks', 'clothes', 14), sug('Boxers', 'clothes', 10)],
      10,
    )
    expect(result.every((r) => r.quantity <= 5)).toBe(true)
  })

  it('uses the trip length when shorter than the cap', () => {
    const [socks] = applyPackLight([sug('Socks', 'clothes', 8)], 3)
    expect(socks.quantity).toBe(3)
  })

  it('never raises a quantity and leaves one-off / non-clothing items alone', () => {
    const result = applyPackLight(
      [sug('Socks', 'clothes', 2), sug('Jacket', 'clothes', 1), sug('Sunscreen', 'toiletries', 9)],
      10,
    )
    expect(result.map((r) => r.quantity)).toEqual([2, 1, 9])
  })

  it('defaults the cap when the trip length is unknown', () => {
    const [tops] = applyPackLight([sug('Tops', 'clothes', 12)], null)
    expect(tops.quantity).toBe(5)
  })
})

describe('assignCommunalRoundRobin', () => {
  const sug = (label: string, communal?: boolean): SuggestedItem => ({
    label,
    category: 'other',
    quantity: 1,
    communal,
  })

  it('returns all null when there are no members', () => {
    expect(assignCommunalRoundRobin([sug('Tent', true), sug('Socks')], [])).toEqual([null, null])
  })

  it('assigns only communal items, leaving personal ones null', () => {
    const result = assignCommunalRoundRobin(
      [sug('Tent', true), sug('Socks'), sug('Speaker', true)],
      ['m1', 'm2'],
    )
    expect(result).toEqual(['m1', null, 'm2'])
  })

  it('advances the counter only on communal items and wraps around', () => {
    const items = [sug('a', true), sug('b', true), sug('c', true), sug('d', true), sug('e', true)]
    expect(assignCommunalRoundRobin(items, ['m0', 'm1'])).toEqual(['m0', 'm1', 'm0', 'm1', 'm0'])
  })

  it('treats a missing communal flag as not communal', () => {
    expect(assignCommunalRoundRobin([sug('Socks'), sug('Shirt')], ['m1'])).toEqual([null, null])
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

const members = [
  { id: 'm1', display_name: 'Ana' },
  { id: 'm2', display_name: 'Bob' },
]

describe('memberPackingProgress', () => {
  it('counts assigned + packed per member, including members with zero assigned', () => {
    const items = [
      item('other', 'Tent', { assigned_member: 'm1', packed: true }),
      item('other', 'Stove', { assigned_member: 'm1', packed: false }),
    ]
    expect(memberPackingProgress(items, members)).toEqual([
      { memberId: 'm1', name: 'Ana', assigned: 2, packed: 1 },
      { memberId: 'm2', name: 'Bob', assigned: 0, packed: 0 },
    ])
  })

  it('ignores items assigned to an id absent from members, and keeps member order', () => {
    const items = [item('other', 'Ghost', { assigned_member: 'gone', packed: true })]
    expect(memberPackingProgress(items, members).map((p) => p.assigned)).toEqual([0, 0])
  })

  it('returns [] for no members', () => {
    expect(memberPackingProgress([item('other', 'Tent')], [])).toEqual([])
  })
})

describe('unassignedSharedCount', () => {
  it('counts items with no assignee', () => {
    expect(
      unassignedSharedCount([
        item('other', 'Tent', { assigned_member: 'm1' }),
        item('other', 'Stove'),
        item('other', 'Speaker'),
      ]),
    ).toBe(2)
  })

  it('is 0 when all assigned', () => {
    expect(unassignedSharedCount([item('other', 'Tent', { assigned_member: 'm1' })])).toBe(0)
  })
})

describe('groupReadiness', () => {
  it('returns 0/false for an empty list', () => {
    expect(groupReadiness([])).toEqual({ percent: 0, ready: false })
  })

  it('is ready only when everything is packed AND assigned', () => {
    const packedAssigned = item('other', 'Tent', { assigned_member: 'm1', packed: true })
    expect(groupReadiness([packedAssigned])).toEqual({ percent: 100, ready: true })
  })

  it('is 100% but not ready when a packed item is unassigned', () => {
    expect(groupReadiness([item('other', 'Tent', { packed: true })])).toEqual({
      percent: 100,
      ready: false,
    })
  })

  it('rounds the percent', () => {
    const items = [
      item('other', 'a', { assigned_member: 'm1', packed: true }),
      item('other', 'b', { assigned_member: 'm1' }),
      item('other', 'c', { assigned_member: 'm1' }),
    ]
    expect(groupReadiness(items).percent).toBe(33)
  })
})

describe('filterByTraveler', () => {
  const items = [
    item('other', 'Tent', { assigned_member: 'm1' }),
    item('other', 'Stove', { assigned_member: 'm2' }),
    item('other', 'Speaker'),
  ]

  it('returns all (new array) for null', () => {
    const result = filterByTraveler(items, null)
    expect(result).toHaveLength(3)
    expect(result).not.toBe(items)
  })

  it('filters by member id and to unassigned', () => {
    expect(filterByTraveler(items, 'm1').map((i) => i.label)).toEqual(['Tent'])
    expect(filterByTraveler(items, UNASSIGNED_FILTER).map((i) => i.label)).toEqual(['Speaker'])
  })

  it('returns [] for an unknown id', () => {
    expect(filterByTraveler(items, 'nobody')).toEqual([])
  })
})

describe('findDuplicateSharedItem / duplicateSharedOwner', () => {
  const items = [
    item('toiletries', 'Sunscreen', { assigned_member: 'm2' }),
    { ...item('toiletries', 'Sunscreen'), scope: 'personal' as const, id: 'perso' },
  ]
  const nameById = new Map([['m2', 'Bob']])

  it('matches a shared label case-insensitively, ignoring personal items', () => {
    expect(findDuplicateSharedItem(items, '  sunSCREEN ')?.id).toBe('toiletries-Sunscreen')
  })

  it('returns null for no match or an empty label', () => {
    expect(findDuplicateSharedItem(items, 'Tent')).toBeNull()
    expect(findDuplicateSharedItem(items, '  ')).toBeNull()
  })

  it('resolves the duplicate owner name', () => {
    expect(duplicateSharedOwner(items, 'Sunscreen', nameById)).toEqual({ name: 'Bob' })
  })

  it('returns name null for an unassigned duplicate and null for no duplicate', () => {
    const unowned = [item('other', 'Rope')]
    expect(duplicateSharedOwner(unowned, 'Rope', nameById)).toEqual({ name: null })
    expect(duplicateSharedOwner(unowned, 'Axe', nameById)).toBeNull()
  })
})
