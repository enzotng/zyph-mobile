import type { Expense, TripBalance } from '@/features/expenses'
import type { TripMember } from '@/features/group'
import type { TripEvent } from '@/features/timeline'
import type { Trip } from '@/features/trips'
import { formatAmount } from '@/lib/money'

export type CopilotContextInput = {
  trip: Trip
  members: TripMember[]
  events: TripEvent[]
  expenses: Expense[]
  balances: TripBalance[]
}

const MAX_EVENTS = 25
const MAX_EXPENSES = 25
// Hard ceiling kept under the 12000 the edge function rejects at.
const MAX_CONTEXT_CHARS = 11000

// Turns cached trip data into a compact, bounded plain-text block for the LLM. Pure: no
// wall-clock read, no I/O, no React. Member ids are mapped to display names so the model
// never has to reason about UUIDs.
export function buildTripContext(input: CopilotContextInput): string {
  const { trip, members, events, expenses, balances } = input
  const nameById = new Map(members.map((m) => [m.id, m.display_name ?? 'Unknown']))

  const header = [
    `Trip: ${trip.title}`,
    trip.destination ? `Destination: ${trip.destination}` : null,
    trip.start_date
      ? `Dates: ${trip.start_date}${trip.end_date ? ` to ${trip.end_date}` : ''}`
      : null,
    `Currency: ${trip.currency}`,
    `Members: ${members.map((m) => m.display_name ?? 'Unknown').join(', ') || 'none'}`,
  ]
    .filter(Boolean)
    .join('\n')

  const eventLines = events.slice(0, MAX_EVENTS).map((event) => {
    const when = event.starts_at ?? 'no date'
    const end = event.ends_at ? ` to ${event.ends_at}` : ''
    const note = event.notes ? ` (${event.notes})` : ''
    return `- [${event.type}] ${event.title} @ ${when}${end}${note}`
  })

  const expenseLines = expenses.slice(0, MAX_EXPENSES).map((expense) => {
    const payer = expense.paid_by ? (nameById.get(expense.paid_by) ?? 'Unknown') : 'Unknown'
    return `- ${expense.description}: ${formatAmount(expense.amount_cents, expense.currency)} paid by ${payer}`
  })

  const balanceLines = balances.map((balance) => {
    const name = nameById.get(balance.member_id) ?? 'Unknown'
    return `- ${name}: net ${formatAmount(balance.balance_cents, trip.currency)} (paid ${formatAmount(balance.paid_cents, trip.currency)}, owes ${formatAmount(balance.owed_cents, trip.currency)})`
  })

  const block = [
    header,
    `\nTimeline (${events.length} events):`,
    eventLines.length ? eventLines.join('\n') : '- none',
    events.length > MAX_EVENTS ? `- ...and ${events.length - MAX_EVENTS} more` : null,
    `\nExpenses (${expenses.length} total):`,
    expenseLines.length ? expenseLines.join('\n') : '- none',
    expenses.length > MAX_EXPENSES ? `- ...and ${expenses.length - MAX_EXPENSES} more` : null,
    '\nBalances:',
    balanceLines.length ? balanceLines.join('\n') : '- none',
  ]
    .filter(Boolean)
    .join('\n')

  return block.length > MAX_CONTEXT_CHARS
    ? `${block.slice(0, MAX_CONTEXT_CHARS)}\n- (truncated)`
    : block
}
