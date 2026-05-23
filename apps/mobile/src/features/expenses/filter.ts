import type { Expense, ExpenseCategory } from './api/expenses.api'

export type ExpenseFilter = {
  query?: string
  category?: ExpenseCategory | null
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
    if (category && expense.category !== category) {
      return false
    }
    return true
  })
}
