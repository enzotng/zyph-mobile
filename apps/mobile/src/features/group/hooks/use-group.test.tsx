import { renderHook, waitFor } from '@testing-library/react-native'

import { createQueryWrapper } from '@/test-utils/query-wrapper'

import * as api from '../api/group.api'
import {
  tripClaimOptionsQueryKey,
  tripMemberNamesQueryKey,
  tripMembersQueryKey,
  useAddGhostMember,
  useClaimOptions,
  useClaimSlot,
  useDetachTripMember,
  useJoinTrip,
  useLeaveTrip,
  useRegenerateInviteCode,
  useRemoveTripMember,
  useRenameGhostMember,
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

const claimOptions = {
  tripId: 't1',
  tripTitle: 'Lisbon',
  myStatus: null,
  slots: [{ slotId: 'm2', slotName: 'Léa' }],
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

describe('useClaimOptions', () => {
  it('fetches the claim options for a code', async () => {
    jest.mocked(api.getTripClaimOptions).mockResolvedValue(claimOptions)
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useClaimOptions('abcd1234'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(claimOptions)
    expect(api.getTripClaimOptions).toHaveBeenCalledWith('abcd1234')
  })

  it('is disabled when the code is empty', () => {
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useClaimOptions(''), { wrapper })

    expect(result.current.fetchStatus).toBe('idle')
    expect(api.getTripClaimOptions).not.toHaveBeenCalled()
  })
})

describe('useClaimSlot', () => {
  it('claims a named slot and invalidates trips', async () => {
    jest.mocked(api.claimTripSlot).mockResolvedValue('t1')
    const { wrapper, queryClient } = createQueryWrapper()
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useClaimSlot(), { wrapper })
    result.current.mutate({ code: 'abcd1234', slotId: 'm2' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api.claimTripSlot).toHaveBeenCalledWith('abcd1234', 'm2')
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['trips'] })
  })

  it('claims without a slot when the caller is not in the list', async () => {
    jest.mocked(api.claimTripSlot).mockResolvedValue('t1')
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useClaimSlot(), { wrapper })
    result.current.mutate({ code: 'abcd1234', slotId: null })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api.claimTripSlot).toHaveBeenCalledWith('abcd1234', null)
  })
})

describe('useAddGhostMember', () => {
  it('adds a ghost and invalidates members, balances and member names', async () => {
    jest.mocked(api.addGhostMember).mockResolvedValue('m2')
    const { wrapper, queryClient } = createQueryWrapper()
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useAddGhostMember('t1'), { wrapper })
    result.current.mutate('Léa')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api.addGhostMember).toHaveBeenCalledWith('t1', 'Léa')
    expect(result.current.data).toBe('m2')
    expect(invalidate).toHaveBeenCalledWith({ queryKey: tripMembersQueryKey('t1') })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['trips', 't1', 'balances'] })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: tripMemberNamesQueryKey('t1') })
  })
})

describe('useRenameGhostMember', () => {
  it('renames a ghost and invalidates members, balances and member names', async () => {
    jest.mocked(api.renameGhostMember).mockResolvedValue(undefined)
    const { wrapper, queryClient } = createQueryWrapper()
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useRenameGhostMember('t1'), { wrapper })
    result.current.mutate({ memberId: 'm2', name: 'Léa' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api.renameGhostMember).toHaveBeenCalledWith('m2', 'Léa')
    expect(invalidate).toHaveBeenCalledWith({ queryKey: tripMembersQueryKey('t1') })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['trips', 't1', 'balances'] })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: tripMemberNamesQueryKey('t1') })
  })
})

describe('useDetachTripMember', () => {
  it('detaches a member and invalidates members, balances and member names', async () => {
    jest.mocked(api.detachTripMember).mockResolvedValue(undefined)
    const { wrapper, queryClient } = createQueryWrapper()
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useDetachTripMember('t1'), { wrapper })
    result.current.mutate('m1')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api.detachTripMember).toHaveBeenCalledWith('m1', expect.anything())
    expect(invalidate).toHaveBeenCalledWith({ queryKey: tripMembersQueryKey('t1') })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['trips', 't1', 'balances'] })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: tripMemberNamesQueryKey('t1') })
  })

  it('surfaces the tenure guard error to the caller', async () => {
    const guard = new Error('place has ledger activity since claim; remove the member instead')
    jest.mocked(api.detachTripMember).mockRejectedValue(guard)
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useDetachTripMember('t1'), { wrapper })
    result.current.mutate('m1')

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBe(guard)
  })
})

describe('tripMembersQueryKey', () => {
  it('returns the expected key', () => {
    expect(tripMembersQueryKey('t1')).toEqual(['trips', 't1', 'members'])
  })
})

describe('tripClaimOptionsQueryKey', () => {
  // Deliberately outside the ['trips'] prefix: a successful claim invalidates ['trips'], which
  // would otherwise refetch the rate-limited options RPC for a trip the caller just joined.
  it('returns a key outside the trips family', () => {
    expect(tripClaimOptionsQueryKey('abcd1234')).toEqual(['trip-claim-options', 'abcd1234'])
  })
})
