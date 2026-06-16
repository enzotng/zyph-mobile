import { renderHook, waitFor } from '@testing-library/react-native'

import { createQueryWrapper } from '@/test-utils/query-wrapper'

import * as api from '../api/group.api'
import {
  tripMembersQueryKey,
  useJoinTrip,
  useLeaveTrip,
  useRegenerateInviteCode,
  useRemoveTripMember,
  useTripMembers,
} from './use-group'

jest.mock('@/lib/supabase')
jest.mock('../api/group.api')

const member = {
  id: 'm1',
  user_id: 'u1',
  role: 'member' as const,
  status: 'active' as const,
  display_name: 'Alice',
  avatar_url: null,
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('useTripMembers', () => {
  it('fetches the member list for a trip', async () => {
    jest.mocked(api.listTripMembers).mockResolvedValue([member])
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useTripMembers('t1'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([member])
  })

  it('is disabled when tripId is empty', () => {
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useTripMembers(''), { wrapper })

    expect(result.current.fetchStatus).toBe('idle')
    expect(api.listTripMembers).not.toHaveBeenCalled()
  })
})

describe('useJoinTrip', () => {
  it('invalidates trips on success', async () => {
    jest.mocked(api.joinTripByCode).mockResolvedValue('t1')
    const { wrapper, queryClient } = createQueryWrapper()
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useJoinTrip(), { wrapper })
    result.current.mutate('ABCD1234')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['trips'] })
  })
})

describe('useRegenerateInviteCode', () => {
  it('regenerates the code and invalidates the cached trip', async () => {
    jest.mocked(api.regenerateInviteCode).mockResolvedValue('newcode123456')
    const { wrapper, queryClient } = createQueryWrapper()
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useRegenerateInviteCode('t1'), { wrapper })
    result.current.mutate()

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api.regenerateInviteCode).toHaveBeenCalledWith('t1')
    expect(result.current.data).toBe('newcode123456')
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['trips', 't1'], exact: true })
  })
})

describe('useLeaveTrip', () => {
  it('invalidates trips on success', async () => {
    jest.mocked(api.leaveTrip).mockResolvedValue(undefined)
    const { wrapper, queryClient } = createQueryWrapper()
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useLeaveTrip(), { wrapper })
    result.current.mutate('t1')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api.leaveTrip).toHaveBeenCalledWith('t1', expect.anything())
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['trips'] })
  })
})

describe('useRemoveTripMember', () => {
  it('invalidates members and balances for the trip on success', async () => {
    jest.mocked(api.removeTripMember).mockResolvedValue(undefined)
    const { wrapper, queryClient } = createQueryWrapper()
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useRemoveTripMember('t1'), { wrapper })
    result.current.mutate('m1')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api.removeTripMember).toHaveBeenCalledWith('m1', expect.anything())
    expect(invalidate).toHaveBeenCalledWith({ queryKey: tripMembersQueryKey('t1') })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['trips', 't1', 'balances'] })
  })
})

describe('tripMembersQueryKey', () => {
  it('returns the expected key', () => {
    expect(tripMembersQueryKey('t1')).toEqual(['trips', 't1', 'members'])
  })
})
