import type { Expense } from '@/features/expenses'

import { expensesByCategory } from './widgets'

function makeExpense(over: Partial<Expense>): Expense {
  return { category: null, base_amount_cents: 0, ...over } as Expense
}

describe('expensesByCategory', () => {
  it('sums base amounts per category and sorts by spend descending', () => {
    const result = expensesByCategory([
      makeExpense({ category: 'food', base_amount_cents: 2000 }),
      makeExpense({ category: 'transport', base_amount_cents: 5000 }),
      makeExpense({ category: 'food', base_amount_cents: 1500 }),
    ])
    expect(result).toEqual([
      { category: 'transport', cents: 5000 },
      { category: 'food', cents: 3500 },
    ])
  })

  it('groups uncategorised expenses under a null category', () => {
    const result = expensesByCategory([
      makeExpense({ category: null, base_amount_cents: 800 }),
      makeExpense({ category: null, base_amount_cents: 200 }),
    ])
    expect(result).toEqual([{ category: null, cents: 1000 }])
  })

  it('returns an empty list for no expenses', () => {
    expect(expensesByCategory([])).toEqual([])
  })
})
