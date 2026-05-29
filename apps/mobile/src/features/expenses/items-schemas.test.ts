import {
  buildAssignmentsByPosition,
  buildEqualAssignments,
  computeMemberTotalsCents,
  groupMembersByItemId,
  type SmartSplitAssignment,
  smartSplitAssignmentSchema,
  smartSplitInputSchema,
  smartSplitItemSchema,
} from './items-schemas'

describe('smartSplitItemSchema', () => {
  it('accepts a valid item', () => {
    expect(() =>
      smartSplitItemSchema.parse({ label: 'Burger', amountCents: 1850, position: 0 }),
    ).not.toThrow()
  })

  it('rejects an empty label', () => {
    expect(() => smartSplitItemSchema.parse({ label: '', amountCents: 100, position: 0 })).toThrow()
  })

  it('rejects a negative amount', () => {
    expect(() => smartSplitItemSchema.parse({ label: 'X', amountCents: -1, position: 0 })).toThrow()
  })
})

describe('smartSplitAssignmentSchema', () => {
  it('accepts a valid assignment', () => {
    expect(() =>
      smartSplitAssignmentSchema.parse({
        position: 0,
        memberId: '00000000-0000-0000-0000-000000000001',
        share: 0.5,
      }),
    ).not.toThrow()
  })

  it('rejects share <= 0 and > 1', () => {
    const id = '00000000-0000-0000-0000-000000000001'
    expect(() =>
      smartSplitAssignmentSchema.parse({ position: 0, memberId: id, share: 0 }),
    ).toThrow()
    expect(() =>
      smartSplitAssignmentSchema.parse({ position: 0, memberId: id, share: 1.5 }),
    ).toThrow()
  })
})

describe('smartSplitInputSchema', () => {
  const m1 = '00000000-0000-0000-0000-000000000001'
  const m2 = '00000000-0000-0000-0000-000000000002'

  it('accepts a valid input', () => {
    const input = {
      description: 'Dinner',
      currency: 'EUR',
      fxRate: 1,
      items: [
        { label: 'Burger', amountCents: 1850, position: 0 },
        { label: 'Salad', amountCents: 1200, position: 1 },
      ],
      assignments: [
        { position: 0, memberId: m1, share: 1 },
        { position: 1, memberId: m2, share: 1 },
      ],
    }
    expect(() => smartSplitInputSchema.parse(input)).not.toThrow()
  })

  it('rejects when an item has no assignment', () => {
    const input = {
      description: 'Dinner',
      currency: 'EUR',
      fxRate: 1,
      items: [
        { label: 'Burger', amountCents: 1850, position: 0 },
        { label: 'Salad', amountCents: 1200, position: 1 },
      ],
      assignments: [{ position: 0, memberId: m1, share: 1 }],
    }
    expect(() => smartSplitInputSchema.parse(input)).toThrow()
  })

  it('rejects when shares for an item do not sum to 1', () => {
    const input = {
      description: 'Dinner',
      currency: 'EUR',
      fxRate: 1,
      items: [{ label: 'Wine', amountCents: 1200, position: 0 }],
      assignments: [
        { position: 0, memberId: m1, share: 0.4 },
        { position: 0, memberId: m2, share: 0.4 },
      ],
    }
    expect(() => smartSplitInputSchema.parse(input)).toThrow()
  })

  it('accepts shares summing to 1 within tolerance (1/3 split)', () => {
    const m3 = '00000000-0000-0000-0000-000000000003'
    const input = {
      description: 'Dinner',
      currency: 'EUR',
      fxRate: 1,
      items: [{ label: 'Wine', amountCents: 1200, position: 0 }],
      assignments: [
        { position: 0, memberId: m1, share: 1 / 3 },
        { position: 0, memberId: m2, share: 1 / 3 },
        { position: 0, memberId: m3, share: 1 / 3 },
      ],
    }
    expect(() => smartSplitInputSchema.parse(input)).not.toThrow()
  })
})

describe('buildEqualAssignments', () => {
  const m1 = '00000000-0000-0000-0000-000000000001'
  const m2 = '00000000-0000-0000-0000-000000000002'

  it('returns an empty array when there are no members', () => {
    expect(buildEqualAssignments([0, 1], [])).toEqual([])
  })

  it('assigns share=1 when there is one member', () => {
    const out = buildEqualAssignments([0], [m1])
    expect(out).toEqual([{ position: 0, memberId: m1, share: 1 }])
  })

  it('splits 1/N when there are N members', () => {
    const out = buildEqualAssignments([0], [m1, m2])
    expect(out).toHaveLength(2)
    expect(out[0].share).toBeCloseTo(0.5)
    expect(out[1].share).toBeCloseTo(0.5)
  })
})

describe('computeMemberTotalsCents', () => {
  const m1 = '00000000-0000-0000-0000-000000000001'
  const m2 = '00000000-0000-0000-0000-000000000002'

  it('sums items per member with full share', () => {
    const items = [{ amountCents: 1000 }, { amountCents: 500 }]
    const assignments: SmartSplitAssignment[] = [
      { position: 0, memberId: m1, share: 1 },
      { position: 1, memberId: m2, share: 1 },
    ]
    const totals = computeMemberTotalsCents(items, assignments)
    expect(totals.get(m1)).toBe(1000)
    expect(totals.get(m2)).toBe(500)
  })

  it('halves the cost when two members share an item', () => {
    const items = [{ amountCents: 800 }]
    const assignments: SmartSplitAssignment[] = [
      { position: 0, memberId: m1, share: 0.5 },
      { position: 0, memberId: m2, share: 0.5 },
    ]
    const totals = computeMemberTotalsCents(items, assignments)
    expect(totals.get(m1)).toBe(400)
    expect(totals.get(m2)).toBe(400)
  })

  it('rounds at the boundary for display', () => {
    const items = [{ amountCents: 1000 }]
    const assignments: SmartSplitAssignment[] = [
      { position: 0, memberId: m1, share: 1 / 3 },
      { position: 0, memberId: m2, share: 2 / 3 },
    ]
    const totals = computeMemberTotalsCents(items, assignments)
    expect(totals.get(m1)! + totals.get(m2)!).toBe(1000)
  })
})

describe('groupMembersByItemId', () => {
  const m1 = '00000000-0000-0000-0000-000000000001'
  const m2 = '00000000-0000-0000-0000-000000000002'

  it('returns an empty map for no assignments', () => {
    expect(groupMembersByItemId([]).size).toBe(0)
  })

  it('groups members under their item id', () => {
    const out = groupMembersByItemId([
      { item_id: 'a', member_id: m1 },
      { item_id: 'a', member_id: m2 },
      { item_id: 'b', member_id: m1 },
    ])
    expect(out.get('a')).toEqual([m1, m2])
    expect(out.get('b')).toEqual([m1])
  })

  it('de-duplicates a member assigned twice to the same item', () => {
    const out = groupMembersByItemId([
      { item_id: 'a', member_id: m1 },
      { item_id: 'a', member_id: m1 },
    ])
    expect(out.get('a')).toEqual([m1])
  })
})

describe('buildAssignmentsByPosition', () => {
  const m1 = '00000000-0000-0000-0000-000000000001'
  const m2 = '00000000-0000-0000-0000-000000000002'

  it('maps assignments back to item positions', () => {
    const items = [
      { id: 'i0', position: 0 },
      { id: 'i1', position: 1 },
    ]
    const assignments = [
      { item_id: 'i0', member_id: m1 },
      { item_id: 'i1', member_id: m1 },
      { item_id: 'i1', member_id: m2 },
    ]
    expect(buildAssignmentsByPosition(items, assignments)).toEqual({
      0: [m1],
      1: [m1, m2],
    })
  })

  it('omits items that have no assignment', () => {
    const items = [
      { id: 'i0', position: 0 },
      { id: 'i1', position: 1 },
    ]
    const assignments = [{ item_id: 'i0', member_id: m1 }]
    expect(buildAssignmentsByPosition(items, assignments)).toEqual({ 0: [m1] })
  })

  it('ignores assignments whose item is not in the list', () => {
    const items = [{ id: 'i0', position: 0 }]
    const assignments = [
      { item_id: 'i0', member_id: m1 },
      { item_id: 'ghost', member_id: m2 },
    ]
    expect(buildAssignmentsByPosition(items, assignments)).toEqual({ 0: [m1] })
  })

  it('honours the item position field rather than array order', () => {
    const items = [
      { id: 'i0', position: 5 },
      { id: 'i1', position: 2 },
    ]
    const assignments = [
      { item_id: 'i0', member_id: m1 },
      { item_id: 'i1', member_id: m2 },
    ]
    expect(buildAssignmentsByPosition(items, assignments)).toEqual({
      5: [m1],
      2: [m2],
    })
  })
})
