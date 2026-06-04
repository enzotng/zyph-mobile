import { renderHook, waitFor } from '@testing-library/react-native'

import { createQueryWrapper } from '@/test-utils/query-wrapper'

import type { ParseEmailResult } from '../api/smart-import.api'
import * as api from '../api/smart-import.api'
import { useParseEmail } from './use-parse-email'

jest.mock('@/lib/supabase')
jest.mock('../api/smart-import.api')

beforeEach(() => {
  jest.clearAllMocks()
})

const parsedResult: ParseEmailResult = {
  event: {
    type: 'flight',
    title: 'AF1234 Paris -> Rome',
    startsAt: '2026-06-10T08:00:00Z',
    endsAt: '2026-06-10T10:00:00Z',
    location: { name: 'Charles de Gaulle', lat: 49.0097, lng: 2.5479 },
    gateLocation: { label: 'Gate K12', lat: 49.0097, lng: 2.5479 },
    notes: 'Window seat',
    currency: 'EUR',
    priceCents: 12_000,
    confidence: 0.9,
  },
}

describe('useParseEmail', () => {
  it('resolves with the parsed event and forwards the email text to the parser', async () => {
    jest.mocked(api.parseEmailViaAi).mockResolvedValue(parsedResult)
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useParseEmail(), { wrapper })
    result.current.mutate('booking confirmation')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(parsedResult)
    // TanStack Query v5 passes a second mutate-context arg to the mutationFn.
    expect(api.parseEmailViaAi).toHaveBeenCalledWith('booking confirmation', expect.anything())
  })

  it('surfaces the error when the parser rejects', async () => {
    jest.mocked(api.parseEmailViaAi).mockRejectedValue(new Error('edge boom'))
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useParseEmail(), { wrapper })
    result.current.mutate('whatever')

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toEqual(new Error('edge boom'))
    expect(result.current.data).toBeUndefined()
  })
})
