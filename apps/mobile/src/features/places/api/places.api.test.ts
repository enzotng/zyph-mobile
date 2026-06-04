import { supabase } from '@/lib/supabase'

import { searchPlaces } from './places.api'

jest.mock('@/lib/supabase')

const invoke = supabase.functions.invoke as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
})

describe('searchPlaces', () => {
  it('invokes place-search and returns parsed results', async () => {
    invoke.mockResolvedValue({
      data: { results: [{ label: 'Eiffel Tower, Paris', lat: 48.85, lng: 2.29 }] },
      error: null,
    })

    await expect(searchPlaces('eiffel', 'fr')).resolves.toEqual([
      { label: 'Eiffel Tower, Paris', lat: 48.85, lng: 2.29 },
    ])
    expect(invoke).toHaveBeenCalledWith('place-search', {
      body: { query: 'eiffel', language: 'fr' },
    })
  })

  it('returns an empty list when the function returns no data', async () => {
    invoke.mockResolvedValue({ data: null, error: null })

    await expect(searchPlaces('x', 'en')).resolves.toEqual([])
  })

  it('throws when the function errors', async () => {
    invoke.mockResolvedValue({ data: null, error: new Error('boom') })

    await expect(searchPlaces('x', 'en')).rejects.toThrow('boom')
  })

  it('rejects a malformed result at the zod boundary', async () => {
    invoke.mockResolvedValue({
      data: { results: [{ label: '', lat: 'nope', lng: 2 }] },
      error: null,
    })

    await expect(searchPlaces('x', 'en')).rejects.toThrow()
  })
})
