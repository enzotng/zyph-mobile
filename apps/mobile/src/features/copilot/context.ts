import type { Expense, TripBalance } from '@/features/expenses'
import type { TripMember } from '@/features/group'
import type { PackingItem } from '@/features/packing'
import type { TripSettlement } from '@/features/settlements'
import type { TripEvent } from '@/features/timeline'
import type { Trip } from '@/features/trips'
import { forecastToPrompt, type TripWeather } from '@/features/weather'
import { formatAmount } from '@/lib/money'

export type CopilotContextInput = {
  trip: Trip
  members: TripMember[]
  events: TripEvent[]
  expenses: Expense[]
  balances: TripBalance[]
  packing: PackingItem[]
  settlements: TripSettlement[]
  weather: TripWeather | null
}

const MAX_EVENTS = 25
const MAX_EXPENSES = 25
const MAX_PACKING = 30
const MAX_SETTLEMENTS = 20
// Hard ceiling kept under the 12000 the edge function rejects at.
const MAX_CONTEXT_CHARS = 11000

// Turns cached trip data into a compact, bounded plain-text block for the LLM. Pure: no
// wall-clock read, no I/O, no React. Member ids are mapped to display names so the model
// never has to reason about UUIDs. Balances come first so the most decision-relevant facts
// survive the tail truncation when a trip is large.
export function buildTripContext(input: CopilotContextInput): string {
  const { trip, members, events, expenses, balances, packing, settlements, weather } = input
  const nameById = new Map(members.map((m) => [m.id, m.display_name ?? 'Unknown']))

  const header = [
    `Trip: ${trip.title}`,
    trip.destination ? `Destination: ${trip.destination}` : null,
    trip.start_date
      ? `Dates: ${trip.start_date}${trip.end_date ? ` to ${trip.end_date}` : ''}`
      : null,
    `Currency: ${trip.currency}`,
    // Trip profile (preferences) - grounds Zo's suggestions. Optional/`?.` because a trip cached
    // before these columns existed has them undefined until it refetches.
    trip.trip_type ? `Trip type: ${trip.trip_type}` : null,
    trip.budget_level ? `Budget level: ${trip.budget_level}` : null,
    trip.budget_total_cents != null
      ? `Budget total: ${formatAmount(trip.budget_total_cents, trip.currency)}`
      : null,
    trip.pace ? `Pace: ${trip.pace}` : null,
    trip.interests?.length ? `Interests: ${trip.interests.join(', ')}` : null,
    trip.dietary?.length ? `Dietary: ${trip.dietary.join(', ')}` : null,
    `Members: ${members.map((m) => m.display_name ?? 'Unknown').join(', ') || 'none'}`,
  ]
    .filter(Boolean)
    .join('\n')

  const balanceLines = balances.map((balance) => {
    const name = nameById.get(balance.member_id) ?? 'Unknown'
    return `- ${name}: net ${formatAmount(balance.balance_cents, trip.currency)} (paid ${formatAmount(balance.paid_cents, trip.currency)}, owes ${formatAmount(balance.owed_cents, trip.currency)})`
  })

  const eventLines = events.slice(0, MAX_EVENTS).map((event) => {
    const when = event.starts_at ?? 'no date'
    const end = event.ends_at ? ` to ${event.ends_at}` : ''
    const note = event.notes ? ` (${event.notes})` : ''
    return `- [${event.subcategory ?? event.category}] ${event.title} @ ${when}${end}${note}`
  })

  const expenseLines = expenses.slice(0, MAX_EXPENSES).map((expense) => {
    const payer = expense.paid_by ? (nameById.get(expense.paid_by) ?? 'Unknown') : 'Unknown'
    const category = expense.category ? ` [${expense.category}]` : ''
    return `- ${expense.description}${category}: ${formatAmount(expense.amount_cents, expense.currency)} paid by ${payer}`
  })

  const packedCount = packing.filter((item) => item.packed).length
  const packingLines = packing.slice(0, MAX_PACKING).map((item) => {
    const qty = item.quantity > 1 ? ` x${item.quantity}` : ''
    const scope = item.scope === 'shared' ? ' (shared)' : ''
    const who = item.assigned_member ? `, ${nameById.get(item.assigned_member) ?? 'Unknown'}` : ''
    return `- ${item.label}${qty}${scope}: ${item.packed ? 'packed' : 'to pack'}${who}`
  })

  const settlementLines = settlements.slice(0, MAX_SETTLEMENTS).map((settlement) => {
    const from = nameById.get(settlement.from_member) ?? 'Unknown'
    const to = nameById.get(settlement.to_member) ?? 'Unknown'
    return `- ${from} -> ${to}: ${formatAmount(settlement.amount_cents, settlement.currency)}`
  })

  const weatherLine = forecastToPrompt(weather)

  const block = [
    header,
    '\nBalances:',
    balanceLines.length ? balanceLines.join('\n') : '- none',
    `\nTimeline (${events.length} events):`,
    eventLines.length ? eventLines.join('\n') : '- none',
    events.length > MAX_EVENTS ? `- ...and ${events.length - MAX_EVENTS} more` : null,
    `\nExpenses (${expenses.length} total):`,
    expenseLines.length ? expenseLines.join('\n') : '- none',
    expenses.length > MAX_EXPENSES ? `- ...and ${expenses.length - MAX_EXPENSES} more` : null,
    `\nPacking (${packedCount}/${packing.length} packed):`,
    packingLines.length ? packingLines.join('\n') : '- none',
    packing.length > MAX_PACKING ? `- ...and ${packing.length - MAX_PACKING} more` : null,
    `\nSettlements (${settlements.length} recorded):`,
    settlementLines.length ? settlementLines.join('\n') : '- none',
    settlements.length > MAX_SETTLEMENTS
      ? `- ...and ${settlements.length - MAX_SETTLEMENTS} more`
      : null,
    weatherLine ? `\nWeather: ${weatherLine}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  return block.length > MAX_CONTEXT_CHARS
    ? `${block.slice(0, MAX_CONTEXT_CHARS)}\n- (truncated)`
    : block
}
