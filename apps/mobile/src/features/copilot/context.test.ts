import { buildTripContext, type CopilotContextInput } from './context'

type LooseInput = {
  trip?: Record<string, unknown>
  members?: Record<string, unknown>[]
  events?: Record<string, unknown>[]
  expenses?: Record<string, unknown>[]
  balances?: Record<string, unknown>[]
}

// Builds a context input with sensible defaults; only the fields buildTripContext reads
// matter, so a single boundary cast keeps the test readable without faking whole DB rows.
function makeInput(over: LooseInput = {}): CopilotContextInput {
  return {
    trip: over.trip ?? {
      title: 'Rome trip',
      destination: 'Rome, Italy',
      start_date: '2026-06-10',
      end_date: '2026-06-14',
      currency: 'EUR',
    },
    members: over.members ?? [
      { id: 'm1', display_name: 'Alice' },
      { id: 'm2', display_name: 'Bob' },
    ],
    events: over.events ?? [
      {
        type: 'flight',
        title: 'Flight to Rome',
        starts_at: '2026-06-10T08:00:00Z',
        ends_at: null,
        notes: null,
      },
    ],
    expenses: over.expenses ?? [
      { description: 'Dinner', amount_cents: 4500, currency: 'EUR', paid_by: 'm1' },
    ],
    balances: over.balances ?? [
      { member_id: 'm1', balance_cents: 1250, paid_cents: 4500, owed_cents: 3250, user_id: 'u1' },
    ],
  } as unknown as CopilotContextInput
}

describe('buildTripContext', () => {
  it('includes the trip header and member names', () => {
    const ctx = buildTripContext(makeInput())
    expect(ctx).toContain('Rome trip')
    expect(ctx).toContain('Rome, Italy')
    expect(ctx).toContain('EUR')
    expect(ctx).toContain('Alice')
    expect(ctx).toContain('Bob')
  })

  it('maps a payer id to the member name and never leaks the id', () => {
    const ctx = buildTripContext(makeInput())
    expect(ctx).toContain('Dinner: 45.00 EUR paid by Alice')
    expect(ctx).not.toContain('m1')
  })

  it('formats balances with paid/owes and the net amount', () => {
    const ctx = buildTripContext(makeInput())
    expect(ctx).toContain('Alice: net 12.50 EUR (paid 45.00 EUR, owes 32.50 EUR)')
  })

  it('emits "- none" lines for an empty trip and never throws', () => {
    const ctx = buildTripContext(makeInput({ events: [], expenses: [], balances: [] }))
    expect(ctx).toContain('Timeline (0 events):')
    expect(ctx).toContain('- none')
  })

  it('caps the events list and notes the overflow', () => {
    const events = Array.from({ length: 30 }, (_, i) => ({
      type: 'event',
      title: `Event ${i}`,
      starts_at: null,
      ends_at: null,
      notes: null,
    }))
    const ctx = buildTripContext(makeInput({ events }))
    expect(ctx).toContain('...and 5 more')
  })

  it('truncates an oversized context', () => {
    const events = Array.from({ length: 25 }, () => ({
      type: 'event',
      title: 'X'.repeat(600),
      starts_at: '2026-01-01',
      ends_at: null,
      notes: 'Y'.repeat(600),
    }))
    const ctx = buildTripContext(makeInput({ events }))
    expect(ctx.length).toBeLessThanOrEqual(11020)
    expect(ctx.endsWith('(truncated)')).toBe(true)
  })
})
