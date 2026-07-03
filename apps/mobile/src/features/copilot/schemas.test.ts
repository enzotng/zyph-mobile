import { blockSchema, copilotResponseSchema } from './schemas'

describe('copilotResponseSchema (block-based)', () => {
  // --- text block ---
  it('accepts a valid text block', () => {
    const result = copilotResponseSchema.safeParse({
      blocks: [{ kind: 'text', text: 'Hello world' }],
    })
    expect(result.success).toBe(true)
  })

  // --- widget block ---
  it('accepts a widget block with an allowlisted source', () => {
    const result = copilotResponseSchema.safeParse({
      blocks: [{ kind: 'widget', source: 'balances' }],
    })
    expect(result.success).toBe(true)
  })

  it('rejects a widget block with an unknown source', () => {
    const result = copilotResponseSchema.safeParse({
      blocks: [{ kind: 'widget', source: 'unknown_widget' }],
    })
    expect(result.success).toBe(false)
  })

  // --- action block ---
  it('accepts a valid action block', () => {
    const result = copilotResponseSchema.safeParse({
      blocks: [
        {
          kind: 'action',
          tool: 'add_expense',
          args: { amount: 42 },
          text: 'Add an expense of 42',
        },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('rejects an action block with an unknown tool', () => {
    const result = copilotResponseSchema.safeParse({
      blocks: [
        {
          kind: 'action',
          tool: 'unknown_tool',
          args: {},
          text: 'Do something',
        },
      ],
    })
    expect(result.success).toBe(false)
  })

  // --- structural constraints ---
  it('rejects an empty blocks array', () => {
    const result = copilotResponseSchema.safeParse({ blocks: [] })
    expect(result.success).toBe(false)
  })

  it('rejects a block with an unknown kind', () => {
    const result = copilotResponseSchema.safeParse({
      blocks: [{ kind: 'chips', label: 'some chip' }],
    })
    expect(result.success).toBe(false)
  })

  // --- chips block ---
  it('accepts a chips block with a navigate chip', () => {
    const result = copilotResponseSchema.safeParse({
      blocks: [
        {
          kind: 'chips',
          chips: [{ action: 'navigate', to: 'spend', label: 'Open Spend' }],
        },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('rejects a navigate chip with an unknown screen', () => {
    const result = copilotResponseSchema.safeParse({
      blocks: [
        {
          kind: 'chips',
          chips: [{ action: 'navigate', to: 'nope', label: 'Nope' }],
        },
      ],
    })
    expect(result.success).toBe(false)
  })

  it('accepts a chips block with a prompt chip', () => {
    const result = copilotResponseSchema.safeParse({
      blocks: [
        {
          kind: 'chips',
          chips: [{ action: 'prompt', prompt: 'Suggest dinner', label: 'Dinner' }],
        },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('accepts a chips block with a tool chip', () => {
    const result = copilotResponseSchema.safeParse({
      blocks: [
        {
          kind: 'chips',
          chips: [{ action: 'tool', tool: 'add_expense', args: {}, label: 'Add expense' }],
        },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('rejects a chips block with an empty chips array', () => {
    const result = copilotResponseSchema.safeParse({
      blocks: [{ kind: 'chips', chips: [] }],
    })
    expect(result.success).toBe(false)
  })

  // --- spend_by_category widget ---
  it('accepts a widget block with spend_by_category source', () => {
    const result = copilotResponseSchema.safeParse({
      blocks: [{ kind: 'widget', source: 'spend_by_category' }],
    })
    expect(result.success).toBe(true)
  })
})

// --- itinerary block ---
describe('itinerary block schema', () => {
  const validItineraryBlock = {
    kind: 'itinerary',
    days: [
      {
        date: '2026-07-15',
        items: [
          { placeId: 'place-1', title: 'Eiffel Tower', type: 'landmark' },
          {
            placeId: 'place-2',
            title: 'Le Marais',
            type: 'neighbourhood',
            time: '14:00',
            notes: 'Great for lunch',
          },
        ],
      },
    ],
  }

  it('accepts a valid itinerary block via blockSchema', () => {
    const result = blockSchema.safeParse(validItineraryBlock)
    expect(result.success).toBe(true)
  })

  it('rejects an itinerary block with empty days array', () => {
    const result = blockSchema.safeParse({ kind: 'itinerary', days: [] })
    expect(result.success).toBe(false)
  })

  it('rejects an itinerary block with a day that has empty items array', () => {
    const result = blockSchema.safeParse({
      kind: 'itinerary',
      days: [{ date: '2026-07-15', items: [] }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects an itinerary block with an item missing placeId', () => {
    const result = blockSchema.safeParse({
      kind: 'itinerary',
      days: [
        {
          date: '2026-07-15',
          items: [{ title: 'Eiffel Tower', type: 'landmark' }],
        },
      ],
    })
    expect(result.success).toBe(false)
  })

  it('rejects an itinerary block with a day exceeding 6 items', () => {
    const items = Array.from({ length: 7 }, (_, i) => ({
      placeId: `place-${i}`,
      title: `Place ${i}`,
      type: 'landmark',
    }))
    const result = blockSchema.safeParse({
      kind: 'itinerary',
      days: [{ date: '2026-07-15', items }],
    })
    expect(result.success).toBe(false)
  })

  it('parses a copilotResponseSchema with a text block and an itinerary block', () => {
    const result = copilotResponseSchema.safeParse({
      blocks: [{ kind: 'text', text: 'Here is your itinerary:' }, validItineraryBlock],
    })
    expect(result.success).toBe(true)
  })
})
