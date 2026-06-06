import { renderHook, waitFor } from '@testing-library/react-native'

import { createQueryWrapper } from '@/test-utils/query-wrapper'

import * as api from '../api/weather.api'
import { useTripWeather } from './use-weather'

jest.mock('../api/weather.api')

const trip = {
  id: 't1',
  destination: 'Lisbon',
  start_date: '2026-06-10',
  end_date: '2026-06-12',
}

const weather = {
  place: 'Lisbon, Portugal',
  mode: 'trip' as const,
  days: [{ date: '2026-06-10', condition: 'clear' as const, tempMaxC: 25, tempMinC: 15 }],
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('useTripWeather', () => {
  it('fetches when the trip has a destination', async () => {
    jest.mocked(api.getTripWeather).mockResolvedValue(weather)
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useTripWeather(trip), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(weather)
    expect(api.getTripWeather).toHaveBeenCalledWith(
      'Lisbon',
      '2026-06-10',
      '2026-06-12',
      expect.any(String),
    )
  })

  it('is disabled without a destination', () => {
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useTripWeather({ ...trip, destination: null }), { wrapper })

    expect(result.current.fetchStatus).toBe('idle')
    expect(api.getTripWeather).not.toHaveBeenCalled()
  })

  it('is disabled when the trip is undefined', () => {
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useTripWeather(undefined), { wrapper })

    expect(result.current.fetchStatus).toBe('idle')
  })
})
