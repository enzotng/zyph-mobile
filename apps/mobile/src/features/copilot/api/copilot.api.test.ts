import { supabase } from '@/lib/supabase'

import { askCopilot, classifyCopilotError } from './copilot.api'

jest.mock('@/lib/supabase')

const invoke = supabase.functions.invoke as jest.Mock

const input = {
  context: 'Trip: Rome',
  language: 'en' as const,
  messages: [{ role: 'user' as const, content: 'How much do I owe?' }],
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('askCopilot', () => {
  it('invokes the copilot function and returns a text block', async () => {
    invoke.mockResolvedValue({
      data: { blocks: [{ kind: 'text', text: 'You owe 12.00 EUR.' }] },
      error: null,
    })

    await expect(askCopilot(input)).resolves.toEqual({
      blocks: [{ kind: 'text', text: 'You owe 12.00 EUR.' }],
    })
    expect(invoke).toHaveBeenCalledWith('copilot', { body: input })
  })

  it('returns a widget block', async () => {
    invoke.mockResolvedValue({
      data: {
        blocks: [
          { kind: 'text', text: 'It will be sunny.' },
          { kind: 'widget', source: 'weather' },
        ],
      },
      error: null,
    })

    await expect(askCopilot(input)).resolves.toEqual({
      blocks: [
        { kind: 'text', text: 'It will be sunny.' },
        { kind: 'widget', source: 'weather' },
      ],
    })
  })

  it('rejects an unknown widget source at the zod boundary', async () => {
    invoke.mockResolvedValue({
      data: { blocks: [{ kind: 'widget', source: 'bogus' }] },
      error: null,
    })

    await expect(askCopilot(input)).rejects.toThrow()
  })

  it('returns an action block', async () => {
    const block = {
      kind: 'action' as const,
      tool: 'add_expense' as const,
      args: { description: 'Dinner', amount: 40 },
      text: 'Add the 40 EUR dinner?',
    }
    invoke.mockResolvedValue({ data: { blocks: [block] }, error: null })

    await expect(askCopilot(input)).resolves.toEqual({ blocks: [block] })
  })

  it('throws when the function errors', async () => {
    invoke.mockResolvedValue({ data: null, error: new Error('boom') })

    await expect(askCopilot(input)).rejects.toThrow('boom')
  })

  it('throws on an empty response', async () => {
    invoke.mockResolvedValue({ data: null, error: null })

    await expect(askCopilot(input)).rejects.toThrow('Empty response')
  })

  it('rejects an empty blocks array at the zod boundary', async () => {
    invoke.mockResolvedValue({ data: { blocks: [] }, error: null })

    await expect(askCopilot(input)).rejects.toThrow()
  })

  it('rejects a response with no blocks field at the zod boundary', async () => {
    invoke.mockResolvedValue({ data: {}, error: null })

    await expect(askCopilot(input)).rejects.toThrow()
  })

  it('drops an invalid block and keeps the valid ones instead of discarding the whole turn', async () => {
    invoke.mockResolvedValue({
      data: {
        blocks: [
          { kind: 'text', text: 'Here is what I found.' },
          { kind: 'chips', chips: [{ action: 'navigate', to: 'bogus-target', label: 'Go' }] },
        ],
      },
      error: null,
    })

    await expect(askCopilot(input)).resolves.toEqual({
      blocks: [{ kind: 'text', text: 'Here is what I found.' }],
    })
  })

  it('throws when every block is invalid', async () => {
    invoke.mockResolvedValue({
      data: {
        blocks: [{ kind: 'chips', chips: [{ action: 'navigate', to: 'bogus', label: 'Go' }] }],
      },
      error: null,
    })

    await expect(askCopilot(input)).rejects.toThrow()
  })

  it('passes through a fully valid multi-block response unchanged', async () => {
    const blocks = [
      { kind: 'text' as const, text: 'It will be sunny.' },
      { kind: 'widget' as const, source: 'weather' as const },
    ]
    invoke.mockResolvedValue({ data: { blocks }, error: null })

    await expect(askCopilot(input)).resolves.toEqual({ blocks })
  })
})

describe('classifyCopilotError', () => {
  it('flags our 429 rate-limit as rateLimited', () => {
    expect(classifyCopilotError({ name: 'FunctionsHttpError', context: { status: 429 } })).toBe(
      'rateLimited',
    )
  })

  it('treats other HTTP statuses as generic', () => {
    expect(classifyCopilotError({ name: 'FunctionsHttpError', context: { status: 503 } })).toBe(
      'generic',
    )
  })

  it('flags a fetch failure as offline', () => {
    expect(classifyCopilotError({ name: 'FunctionsFetchError' })).toBe('offline')
  })

  it('falls back to generic for an unknown error', () => {
    expect(classifyCopilotError(new Error('boom'))).toBe('generic')
    expect(classifyCopilotError(null)).toBe('generic')
  })
})
