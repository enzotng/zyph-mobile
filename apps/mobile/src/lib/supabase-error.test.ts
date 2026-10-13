import { toError, toUserMessage } from './supabase-error'

describe('toError', () => {
  it('turns a PostgREST error object into an Error that keeps its message and code', () => {
    const error = toError({ message: 'slot already claimed', code: 'P0001', details: '', hint: '' })

    expect(error).toBeInstanceOf(Error)
    expect(error.message).toBe('slot already claimed')
    expect((error as Error & { code?: string }).code).toBe('P0001')
  })

  it('returns an Error unchanged', () => {
    const original = new Error('network')

    expect(toError(original)).toBe(original)
  })

  it('wraps anything else in an Error', () => {
    expect(toError('boom').message).toBe('boom')
  })
})

describe('toUserMessage', () => {
  // Server text is not user copy: English function messages, constraint and policy names, or a
  // network TypeError. The translated fallback is what the user reads.
  it('shows the fallback for any database error, whatever its code', () => {
    const raised = toError({ message: 'splits must sum to the base amount', code: 'P0001' })
    const internal = toError({ message: 'permission denied for table expenses', code: '42501' })
    const offline = toError({ message: 'TypeError: Network request failed', code: '' })

    expect(toUserMessage(raised, 'Réessaie.')).toBe('Réessaie.')
    expect(toUserMessage(internal, 'Réessaie.')).toBe('Réessaie.')
    expect(toUserMessage(offline, 'Réessaie.')).toBe('Réessaie.')
  })

  it('keeps the message of an error the app or auth wrote', () => {
    expect(toUserMessage(new Error('Invalid login credentials'), 'Réessaie.')).toBe(
      'Invalid login credentials',
    )
  })

  it('falls back when there is no message to show', () => {
    expect(toUserMessage(new Error(''), 'Réessaie.')).toBe('Réessaie.')
    expect(toUserMessage(undefined, 'Réessaie.')).toBe('Réessaie.')
  })
})
