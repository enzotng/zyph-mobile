import { rootOf } from '@/features/taxonomy'

import type { Expense } from './api/expenses.api'

export type CategoryTotal = { category: string | null; cents: number }

// Total trip spend in the trip's base currency. base_amount_cents is the entry-time-frozen
// conversion to the trip currency, so summing it totals a mixed-currency trip correctly.
export function totalSpentCents(expenses: Expense[]): number {
  return expenses.reduce((sum, expense) => sum + expense.base_amount_cents, 0)
}

// Sums expenses by ROOT category in base currency, sorted by spend descending. A dotted
// subcategory rolls up to its root; uncategorized expenses collect under a null bucket.
export function expensesByCategory(expenses: Expense[]): CategoryTotal[] {
  const totals = new Map<string | null, number>()
  for (const expense of expenses) {
    const key = expense.category ? rootOf(expense.category) : null
    totals.set(key, (totals.get(key) ?? 0) + expense.base_amount_cents)
  }
  return [...totals.entries()]
    .map(([category, cents]) => ({ category, cents }))
    .sort((a, b) => b.cents - a.cents)
}
