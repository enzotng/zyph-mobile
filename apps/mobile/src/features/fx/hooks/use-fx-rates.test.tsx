import { renderHook, waitFor } from '@testing-library/react-native'

import { createQueryWrapper } from '@/test-utils/query-wrapper'
import type { FxRates } from '../api/fx.api'
import * as api from '../api/fx.api'
import { fxRatesQueryKey, useFxRates } from './use-fx-rates'

jest.mock('@/lib/supabase')
jest.mock('../api/fx.api')

const rates: FxRates = {
  date: '2026-05-22',
  rates: { EUR: 1, USD: 1.08, GBP: 0.85 },
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('fxRatesQueryKey', () => {
  it('returns the expected key', () => {
    expect(fxRatesQueryKey()).toEqual(['fx-rates'])
  })
})

describe('useFxRates', () => {
  it('fetches and exposes the fx rates on success', async () => {
    jest.mocked(api.fetchFxRates).mockResolvedValue(rates)
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useFxRates(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(rates)
    expect(api.fetchFxRates).toHaveBeenCalledTimes(1)
  })

  it('surfaces an error when the fetch fails', async () => {
    jest.mocked(api.fetchFxRates).mockRejectedValue(new Error('ECB unavailable'))
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useFxRates(), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBeInstanceOf(Error)
  })
})
