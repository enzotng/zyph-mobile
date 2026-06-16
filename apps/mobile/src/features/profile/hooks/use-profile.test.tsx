import { renderHook, waitFor } from '@testing-library/react-native'

import { useAuth } from '@/features/auth'
import { createQueryWrapper } from '@/test-utils/query-wrapper'

import * as api from '../api/profile.api'
import { profileQueryKey, useProfile, useUpdateProfile, useUploadAvatar } from './use-profile'

jest.mock('@/lib/supabase')
jest.mock('../api/profile.api')
jest.mock('@/features/auth', () => ({ useAuth: jest.fn() }))

const mockedUseAuth = useAuth as jest.Mock

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
  mockedUseAuth.mockReturnValue({ session: { user: { id: 'u1' } }, isLoading: false })
})

describe('useProfile', () => {
  it('is disabled until a session exists', () => {
    mockedUseAuth.mockReturnValue({ session: null, isLoading: false })
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useProfile(), { wrapper })

    expect(result.current.fetchStatus).toBe('idle')
    expect(api.getProfile).not.toHaveBeenCalled()
  })

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

describe('useUpdateProfile', () => {
  it('seeds the profile cache with the updated row on success', async () => {
    const updated = { ...profile, display_name: 'Bob' }
    jest.mocked(api.updateProfile).mockResolvedValue(updated)
    const { wrapper, queryClient } = createQueryWrapper()
    const setQueryData = jest.spyOn(queryClient, 'setQueryData')

    const { result } = renderHook(() => useUpdateProfile(), { wrapper })
    result.current.mutate({ displayName: 'Bob', preferredCurrency: 'EUR' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(setQueryData).toHaveBeenCalledWith(profileQueryKey, updated)
  })
})

describe('useUploadAvatar', () => {
  it('seeds the profile cache and refreshes trip-backed views on success', async () => {
    const updated = { ...profile, avatar_url: 'https://cdn.example.com/avatars/u1/avatar?v=1' }
    jest.mocked(api.uploadAvatar).mockResolvedValue(updated)
    const { wrapper, queryClient } = createQueryWrapper()
    const setQueryData = jest.spyOn(queryClient, 'setQueryData')
    const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useUploadAvatar(), { wrapper })
    result.current.mutate({ imageBase64: 'YmFzZTY0', contentType: 'image/jpeg' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(setQueryData).toHaveBeenCalledWith(profileQueryKey, updated)
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['trips'] })
  })
})
