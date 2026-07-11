import { expensesByCategory, spendBySubcategory, totalSpentCents } from './analytics'
import type { Expense } from './api/expenses.api'

function make(over: Partial<Expense> & { base_amount_cents: number }): Expense {
  return {
    id: 'e1',
    trip_id: 't1',
    description: 'x',
    amount_cents: over.base_amount_cents,
    currency: 'EUR',
    fx_rate: 1,
    category: null,
    subcategory: null,
    paid_by: 'u1',
    created_by: 'u1',
    created_at: '2026-07-01T10:00:00Z',
    updated_at: '2026-07-01T10:00:00Z',
    deleted_at: null,
    version: 1,
    ...over,
  } as Expense
}

describe('totalSpentCents', () => {
  it('sums base_amount_cents across mixed currencies', () => {
    const rows = [
      make({ base_amount_cents: 1000, currency: 'USD' }),
      make({ base_amount_cents: 2550, currency: 'GBP' }),
    ]
    expect(totalSpentCents(rows)).toBe(3550)
  })
  it('is 0 for no expenses', () => {
    expect(totalSpentCents([])).toBe(0)
  })
})

describe('expensesByCategory', () => {
  it('rolls sub-codes up to their root and sorts by spend desc', () => {
    const rows = [
      make({ base_amount_cents: 100, category: 'food.restaurant' }),
      make({ base_amount_cents: 400, category: 'food.bar' }),
      make({ base_amount_cents: 900, category: 'transport' }),
    ]
    expect(expensesByCategory(rows)).toEqual([
      { category: 'transport', cents: 900 },
      { category: 'food', cents: 500 },
    ])
  })
  it('groups uncategorized under a null bucket', () => {
    const rows = [make({ base_amount_cents: 300, category: null })]
    expect(expensesByCategory(rows)).toEqual([{ category: null, cents: 300 }])
  })
})

describe('spendBySubcategory', () => {
  it('groups one root by its dotted subcategory codes, sorted desc', () => {
    const rows = [
      make({ base_amount_cents: 100, category: 'food', subcategory: 'food.restaurant' }),
      make({ base_amount_cents: 400, category: 'food', subcategory: 'food.bar' }),
      make({ base_amount_cents: 250, category: 'food', subcategory: 'food.restaurant' }),
      make({ base_amount_cents: 900, category: 'transport', subcategory: 'transport.taxi' }),
    ]
    expect(spendBySubcategory(rows, 'food')).toEqual([
      { category: 'food.bar', cents: 400 },
      { category: 'food.restaurant', cents: 350 },
    ])
  })
  it('buckets root-only expenses (no subcategory) under null', () => {
    const rows = [
      make({ base_amount_cents: 300, category: 'food', subcategory: null }),
      make({ base_amount_cents: 100, category: 'food', subcategory: 'food.cafe' }),
    ]
    expect(spendBySubcategory(rows, 'food')).toEqual([
      { category: null, cents: 300 },
      { category: 'food.cafe', cents: 100 },
    ])
  })
  it('is empty for a root with no expenses', () => {
    expect(
      spendBySubcategory([make({ base_amount_cents: 100, category: 'food' })], 'transport'),
    ).toEqual([])
  })
})
