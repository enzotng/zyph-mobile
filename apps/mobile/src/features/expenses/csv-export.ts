import type { Expense } from './api/expenses.api'

// RFC4180: quote a field when it contains a comma, double-quote, CR or LF; escape quotes by
// doubling them. Plain fields are emitted as-is.
function escapeCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

// Guard against CSV/formula injection: a spreadsheet treats a cell starting with = + - @ (or a
// tab/CR) as a formula. Prefix such user-controlled text with a single quote so it stays literal.
// Applied only to free-text fields - the numeric columns here are always non-negative, so they
// never trip this.
export function neutralizeFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
}

// Join a header row + data rows into an RFC4180 CSV (CRLF line breaks, the spec default).
export function toCsv(headers: string[], rows: string[][]): string {
  return [headers, ...rows].map((cols) => cols.map(escapeCell).join(',')).join('\r\n')
}

// Cents -> plain decimal string (e.g. 1250 -> "12.50") so the file imports cleanly into a
// spreadsheet, with no currency symbol or locale grouping in the numeric column.
function centsToDecimal(cents: number): string {
  return (cents / 100).toFixed(2)
}

export type ExpenseCsvLabels = {
  date: string
  description: string
  category: string
  amount: string
  currency: string
  tripAmount: string
  paidBy: string
}

export type ExpenseCsvContext = {
  labels: ExpenseCsvLabels
  // Resolve a stored category code to its localized label ('' when none).
  categoryLabel: (category: string | null) => string
  // Resolve a payer trip-member id to a display name.
  payerName: (memberId: string | null) => string
}

// Build a spreadsheet-friendly CSV of a trip's expenses: one row per expense, the amount in its own
// currency plus the trip-currency amount that drives the splits, and the payer name.
export function expensesToCsv(expenses: Expense[], ctx: ExpenseCsvContext): string {
  const { labels } = ctx
  const headers = [
    labels.date,
    labels.description,
    labels.category,
    labels.amount,
    labels.currency,
    labels.tripAmount,
    labels.paidBy,
  ]
  const rows = expenses.map((expense) => [
    (expense.created_at ?? '').slice(0, 10),
    neutralizeFormula(expense.description),
    neutralizeFormula(ctx.categoryLabel(expense.category)),
    centsToDecimal(expense.amount_cents),
    neutralizeFormula(expense.currency),
    centsToDecimal(expense.base_amount_cents),
    neutralizeFormula(ctx.payerName(expense.paid_by)),
  ])
  return toCsv(headers, rows)
}
