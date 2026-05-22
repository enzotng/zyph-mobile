import { renderHook, waitFor } from '@testing-library/react-native'

import { createQueryWrapper } from '@/test-utils/query-wrapper'

import * as api from '../api/profile.api'
import { useProfile } from './use-profile'

jest.mock('@/lib/supabase')
jest.mock('../api/profile.api')

const profile = {
  id: 'u1',
  display_name: 'Alice',
  avatar_url: null,
  preferred_currency: 'EUR',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('useProfile', () => {
  it('fetches the current user profile', async () => {
    jest.mocked(api.getProfile).mockResolvedValue(profile)
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useProfile(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(profile)
  })

  it('exposes the error when the query fails', async () => {
    jest.mocked(api.getProfile).mockRejectedValue(new Error('profile fetch failed'))
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useProfile(), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBeInstanceOf(Error)
  })
})
