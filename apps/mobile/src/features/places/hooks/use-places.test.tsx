import { renderHook, waitFor } from '@testing-library/react-native'

import { createQueryWrapper } from '@/test-utils/query-wrapper'

import * as api from '../api/places.api'
import { usePlaceSearch } from './use-places'

jest.mock('@/lib/supabase')
jest.mock('../api/places.api')

beforeEach(() => {
  jest.clearAllMocks()
})

describe('usePlaceSearch', () => {
  it('is disabled for short queries', () => {
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => usePlaceSearch('ab', 'en'), { wrapper })

    expect(result.current.fetchStatus).toBe('idle')
    expect(api.searchPlaces).not.toHaveBeenCalled()
  })

  it('searches once the query is long enough', async () => {
    jest.mocked(api.searchPlaces).mockResolvedValue([{ label: 'Rome', lat: 41.9, lng: 12.5 }])
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => usePlaceSearch('rome', 'en'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([{ label: 'Rome', lat: 41.9, lng: 12.5 }])
    expect(api.searchPlaces).toHaveBeenCalledWith('rome', 'en')
  })
})
