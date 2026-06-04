import {
  amountToCents,
  draftFromItems,
  draftsToItems,
  draftTotalCents,
  everyDraftAmountValid,
  everyDraftLabelled,
  reindexAssignmentsAfterRemoval,
} from './smart-split-edit'

describe('amountToCents', () => {
  it('parses dot and comma decimals', () => {
    expect(amountToCents('12.50')).toBe(1250)
    expect(amountToCents('12,50')).toBe(1250)
    expect(amountToCents('8')).toBe(800)
  })

  it('returns 0 for partial or invalid input', () => {
    expect(amountToCents('')).toBe(0)
    expect(amountToCents('12.')).toBe(0)
    expect(amountToCents('abc')).toBe(0)
    expect(amountToCents('-5')).toBe(0)
    expect(amountToCents('1.234')).toBe(0)
  })
})

describe('draftFromItems / draftsToItems round-trip', () => {
  it('seeds drafts from cents and converts back to positioned items', () => {
    const drafts = draftFromItems([
      { label: 'Pizza', amountCents: 1850 },
      { label: 'Soda', amountCents: 300 },
    ])
    expect(drafts).toEqual([
      { label: 'Pizza', amount: '18.50' },
      { label: 'Soda', amount: '3.00' },
    ])
    expect(draftsToItems(drafts)).toEqual([
      { label: 'Pizza', amountCents: 1850, position: 0 },
      { label: 'Soda', amountCents: 300, position: 1 },
    ])
  })

  it('trims labels and re-positions by array index', () => {
    const items = draftsToItems([
      { label: '  Tip  ', amount: '2,00' },
      { label: 'Tax', amount: '1.10' },
    ])
    expect(items[0]).toEqual({ label: 'Tip', amountCents: 200, position: 0 })
    expect(items[1]).toEqual({ label: 'Tax', amountCents: 110, position: 1 })
  })
})

describe('draftTotalCents', () => {
  it('sums valid amounts and ignores invalid ones', () => {
    expect(
      draftTotalCents([
        { label: 'a', amount: '10.00' },
        { label: 'b', amount: '5,50' },
      ]),
    ).toBe(1550)
    expect(
      draftTotalCents([
        { label: 'a', amount: '10.00' },
        { label: 'b', amount: '' },
      ]),
    ).toBe(1000)
  })
})

describe('everyDraftLabelled', () => {
  it('requires a non-empty label on every draft', () => {
    expect(everyDraftLabelled([{ label: 'a', amount: '1' }])).toBe(true)
    expect(everyDraftLabelled([{ label: '  ', amount: '1' }])).toBe(false)
    expect(
      everyDraftLabelled([
        { label: 'a', amount: '1' },
        { label: '', amount: '2' },
      ]),
    ).toBe(false)
  })
})

describe('everyDraftAmountValid', () => {
  it('requires a positive amount on every draft', () => {
    expect(everyDraftAmountValid([{ label: 'a', amount: '10.00' }])).toBe(true)
    expect(everyDraftAmountValid([{ label: 'a', amount: '12.' }])).toBe(false)
    expect(everyDraftAmountValid([{ label: 'a', amount: '' }])).toBe(false)
    expect(everyDraftAmountValid([{ label: 'a', amount: '0' }])).toBe(false)
    expect(
      everyDraftAmountValid([
        { label: 'a', amount: '10.00' },
        { label: 'b', amount: '12.' },
      ]),
    ).toBe(false)
  })
})

describe('reindexAssignmentsAfterRemoval', () => {
  it('drops the removed index and shifts higher indices down', () => {
    const assignments = {
      0: new Set(['m1']),
      1: new Set(['m2']),
      2: new Set(['m3']),
    }
    const next = reindexAssignmentsAfterRemoval(assignments, 1)
    expect(Object.keys(next).sort()).toEqual(['0', '1'])
    expect(next[0]).toEqual(new Set(['m1']))
    expect(next[1]).toEqual(new Set(['m3']))
  })

  it('leaves lower indices untouched when removing the last line', () => {
    const assignments = { 0: new Set(['m1']), 1: new Set(['m2']) }
    const next = reindexAssignmentsAfterRemoval(assignments, 1)
    expect(Object.keys(next)).toEqual(['0'])
    expect(next[0]).toEqual(new Set(['m1']))
  })
})
