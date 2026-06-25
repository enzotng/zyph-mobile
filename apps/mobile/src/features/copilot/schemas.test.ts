import { copilotResponseSchema } from './schemas'

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
})
