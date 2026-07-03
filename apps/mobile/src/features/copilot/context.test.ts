import { buildTripContext, type CopilotContextInput } from './context'

type LooseInput = {
  trip?: Record<string, unknown>
  members?: Record<string, unknown>[]
  events?: Record<string, unknown>[]
  expenses?: Record<string, unknown>[]
  balances?: Record<string, unknown>[]
  packing?: Record<string, unknown>[]
  settlements?: Record<string, unknown>[]
  weather?: Record<string, unknown> | null
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
      trip_type: null,
      budget_level: null,
      budget_total_cents: null,
      pace: null,
      interests: [],
      dietary: [],
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
      { description: 'Dinner', amount_cents: 4500, currency: 'EUR', paid_by: 'm1', category: null },
    ],
    balances: over.balances ?? [
      { member_id: 'm1', balance_cents: 1250, paid_cents: 4500, owed_cents: 3250, user_id: 'u1' },
    ],
    packing: over.packing ?? [
      {
        id: 'p1',
        label: 'Sunscreen',
        category: 'toiletries',
        scope: 'shared',
        packed: false,
        quantity: 1,
        assigned_member: 'm1',
      },
      {
        id: 'p2',
        label: 'Charger',
        category: 'tech',
        scope: 'personal',
        packed: true,
        quantity: 2,
        assigned_member: null,
      },
    ],
    settlements: over.settlements ?? [
      {
        from_member: 'm2',
        to_member: 'm1',
        amount_cents: 1000,
        currency: 'EUR',
        paid_at: '2026-06-12T10:00:00Z',
      },
    ],
    weather:
      over.weather === undefined
        ? {
            place: 'Rome',
            mode: 'trip',
            days: [{ date: '2026-06-10', condition: 'clear', tempMaxC: 28, tempMinC: 18 }],
          }
        : over.weather,
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

  it('includes the trip profile lines when set', () => {
    const ctx = buildTripContext(
      makeInput({
        trip: {
          title: 'Rome trip',
          destination: 'Rome, Italy',
          start_date: null,
          end_date: null,
          currency: 'EUR',
          trip_type: 'city_break',
          budget_level: 'medium',
          budget_total_cents: 120000,
          pace: 'balanced',
          interests: ['food', 'museums'],
          dietary: ['vegan'],
        },
      }),
    )
    expect(ctx).toContain('Trip type: city_break')
    expect(ctx).toContain('Budget level: medium')
    expect(ctx).toContain('Budget total: 1200.00 EUR')
    expect(ctx).toContain('Pace: balanced')
    expect(ctx).toContain('Interests: food, museums')
    expect(ctx).toContain('Dietary: vegan')
  })

  it('omits trip-profile lines when unset', () => {
    const ctx = buildTripContext(makeInput())
    expect(ctx).not.toContain('Trip type:')
    expect(ctx).not.toContain('Budget level:')
    expect(ctx).not.toContain('Interests:')
    expect(ctx).not.toContain('Dietary:')
  })

  it('maps a payer id to the member name and never leaks the id', () => {
    const ctx = buildTripContext(makeInput())
    expect(ctx).toContain('Dinner: 45.00 EUR paid by Alice')
    expect(ctx).not.toContain('m1')
  })

  it('tags an expense with its category when present', () => {
    const ctx = buildTripContext(
      makeInput({
        expenses: [
          {
            description: 'Pizza',
            amount_cents: 2000,
            currency: 'EUR',
            paid_by: 'm2',
            category: 'food',
          },
        ],
      }),
    )
    expect(ctx).toContain('Pizza [food]: 20.00 EUR paid by Bob')
  })

  it('formats balances with paid/owes and the net amount', () => {
    const ctx = buildTripContext(makeInput())
    expect(ctx).toContain('Alice: net 12.50 EUR (paid 45.00 EUR, owes 32.50 EUR)')
  })

  it('summarises packing with a packed count and the assignee name', () => {
    const ctx = buildTripContext(makeInput())
    expect(ctx).toContain('Packing (1/2 packed):')
    expect(ctx).toContain('Sunscreen (shared): to pack, Alice')
    expect(ctx).toContain('Charger x2: packed')
  })

  it('lists recorded settlements with member names', () => {
    const ctx = buildTripContext(makeInput())
    expect(ctx).toContain('Settlements (1 recorded):')
    expect(ctx).toContain('Bob -> Alice: 10.00 EUR')
  })

  it('includes a compact weather forecast when available', () => {
    const ctx = buildTripContext(makeInput())
    expect(ctx).toContain('Weather: 2026-06-10 clear 28/18C')
  })

  it('omits the weather line when there is no forecast', () => {
    const ctx = buildTripContext(makeInput({ weather: null }))
    expect(ctx).not.toContain('Weather:')
  })

  it('emits "- none" lines for an empty trip and never throws', () => {
    const ctx = buildTripContext(
      makeInput({
        events: [],
        expenses: [],
        balances: [],
        packing: [],
        settlements: [],
        weather: null,
      }),
    )
    expect(ctx).toContain('Timeline (0 events):')
    expect(ctx).toContain('Packing (0/0 packed):')
    expect(ctx).toContain('Settlements (0 recorded):')
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
