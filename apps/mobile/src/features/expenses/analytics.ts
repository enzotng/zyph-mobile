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

// Sums ONE root's expenses by their full dotted subcategory code, in base currency, sorted by
// spend descending. Expenses filed under the root with no subcategory collect under a null bucket
// (rendered as "Other" by the caller). Used by the category drill-down.
export function spendBySubcategory(expenses: Expense[], root: string): CategoryTotal[] {
  const totals = new Map<string | null, number>()
  for (const expense of expenses) {
    if (!expense.category || rootOf(expense.category) !== root) {
      continue
    }
    const key = expense.subcategory ?? null
    totals.set(key, (totals.get(key) ?? 0) + expense.base_amount_cents)
  }
  return [...totals.entries()]
    .map(([category, cents]) => ({ category, cents }))
    .sort((a, b) => b.cents - a.cents)
}

export type DayTotal = { date: string; cents: number }

// Hard ceiling on the days a single trip can chart. Trip dates are only validated as end >= start,
// with no maximum span, so an absurd range (a typo'd year) would otherwise build an unbounded array
// and render that many bars on every member's device. A year of daily bars is already past legible.
const MAX_DAYS = 366

// Adds `days` calendar days to a YYYY-MM-DD string, staying in UTC so a local timezone can never
// shift the day.
function addDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

// The trip's daily spend, in base currency, zero-filled across the range so the bars keep a real
// time axis (a day with no expense is a gap, not a missing bar). The range is the trip's own dates
// when it has them, otherwise the first..last day an expense was recorded. Expenses outside the
// range are ignored. Days come from `created_at` (the only date the ledger carries).
export function spendByDay(
  expenses: Expense[],
  start: string | null,
  end: string | null,
): DayTotal[] {
  const totals = new Map<string, number>()
  for (const expense of expenses) {
    const day = (expense.created_at ?? '').slice(0, 10)
    if (!day) {
      continue
    }
    totals.set(day, (totals.get(day) ?? 0) + expense.base_amount_cents)
  }

  const days = [...totals.keys()].sort()
  const from = start?.slice(0, 10) || days[0]
  const to = end?.slice(0, 10) || days[days.length - 1]
  if (!from || !to || from > to) {
    return []
  }

  const out: DayTotal[] = []
  for (let day = from; day <= to && out.length < MAX_DAYS; day = addDays(day, 1)) {
    out.push({ date: day, cents: totals.get(day) ?? 0 })
  }
  return out
}
