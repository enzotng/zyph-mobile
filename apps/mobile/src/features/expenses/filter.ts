import { rootOf } from '@/features/taxonomy'

import type { Expense } from './api/expenses.api'

export type ExpenseFilter = {
  query?: string
  category?: string | null
}

export function filterExpenses(expenses: Expense[], filter: ExpenseFilter): Expense[] {
  const q = filter.query?.trim().toLowerCase() ?? ''
  const category = filter.category ?? null

  if (!q && !category) {
    return expenses
  }

  return expenses.filter((expense) => {
    if (q && !expense.description.toLowerCase().includes(q)) {
      return false
    }
    if (category && rootOf(expense.category ?? '') !== category) {
      return false
    }
    return true
  })
}
