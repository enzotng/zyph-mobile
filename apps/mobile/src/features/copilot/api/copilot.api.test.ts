import { supabase } from '@/lib/supabase'

import { askCopilot } from './copilot.api'

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
  it('invokes the copilot function and returns the answer', async () => {
    invoke.mockResolvedValue({ data: { answer: 'You owe 12.00 EUR.' }, error: null })

    await expect(askCopilot(input)).resolves.toEqual({ answer: 'You owe 12.00 EUR.' })
    expect(invoke).toHaveBeenCalledWith('copilot', { body: input })
  })

  it('returns a proposed action', async () => {
    const action = {
      tool: 'add_expense',
      args: { description: 'Dinner', amount: 40 },
      text: 'Add the 40 EUR dinner?',
    }
    invoke.mockResolvedValue({ data: { action }, error: null })

    await expect(askCopilot(input)).resolves.toEqual({ action })
  })

  it('throws when the function errors', async () => {
    invoke.mockResolvedValue({ data: null, error: new Error('boom') })

    await expect(askCopilot(input)).rejects.toThrow('boom')
  })

  it('throws on an empty response', async () => {
    invoke.mockResolvedValue({ data: null, error: null })

    await expect(askCopilot(input)).rejects.toThrow('Empty response')
  })

  it('rejects an empty answer at the zod boundary', async () => {
    invoke.mockResolvedValue({ data: { answer: '' }, error: null })

    await expect(askCopilot(input)).rejects.toThrow()
  })
})
