import type { Expense } from '@/features/expenses'

export type CategoryTotal = { category: string | null; cents: number }

// Sums expenses by category in the trip's base currency (base_amount_cents), so a mixed-currency
// trip still totals correctly. Pure + sorted by spend descending. Used by the expenses widget.
export function expensesByCategory(expenses: Expense[]): CategoryTotal[] {
  const totals = new Map<string | null, number>()
  for (const expense of expenses) {
    const key = expense.category ?? null
    totals.set(key, (totals.get(key) ?? 0) + expense.base_amount_cents)
  }
  return [...totals.entries()]
    .map(([category, cents]) => ({ category, cents }))
    .sort((a, b) => b.cents - a.cents)
}
