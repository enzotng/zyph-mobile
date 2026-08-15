import { supabase } from '@/lib/supabase'
import { makePostgrestError, makeQueryBuilder } from '@/test-utils/supabase-mock'

import {
  addGhostMember,
  claimTripSlot,
  detachTripMember,
  getTripClaimOptions,
  leaveTrip,
  listTripMemberNames,
  listTripMembers,
  regenerateInviteCode,
  removeTripMember,
  renameGhostMember,
} from './group.api'

jest.mock('@/lib/supabase')

const from = supabase.from as jest.Mock
const rpc = supabase.rpc as jest.Mock

const TRIP_ID = '11111111-1111-4111-8111-111111111111'
const SLOT_ONE = '22222222-2222-4222-8222-222222222222'
const SLOT_TWO = '33333333-3333-4333-8333-333333333333'

// Raw shape returned by the Supabase join query.
const rawMember = {
  id: 'm1',
  user_id: 'u1',
  role: 'member' as const,
  status: 'active' as const,
  display_name: null,
  profiles: { display_name: 'Alice', avatar_url: 'https://cdn.example.com/avatars/u1/avatar?v=1' },
}

const mappedMember = {
  id: 'm1',
  user_id: 'u1',
  role: 'member' as const,
  status: 'active' as const,
  display_name: 'Alice',
  avatar_url: 'https://cdn.example.com/avatars/u1/avatar?v=1',
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('listTripMembers', () => {
  it('returns members mapped with display_name from profiles join', async () => {
    const builder = makeQueryBuilder({ data: [rawMember], error: null })
    from.mockReturnValue(builder)

    await expect(listTripMembers('t1')).resolves.toEqual([mappedMember])
    expect(from).toHaveBeenCalledWith('trip_members')
    expect(builder.select).toHaveBeenCalledWith(
      'id, user_id, role, status, display_name, profiles(display_name, avatar_url)',
    )
    expect(builder.eq).toHaveBeenCalledWith('trip_id', 't1')
    expect(builder.eq).toHaveBeenCalledWith('status', 'active')
    expect(builder.order).toHaveBeenCalledWith('joined_at', { ascending: true })
  })

  it('falls back to the trip alias for a ghost member with no profile', async () => {
    const ghost = {
      id: 'm2',
      user_id: null,
      role: 'member' as const,
      status: 'active' as const,
      display_name: 'Léa',
      profiles: null,
    }
    from.mockReturnValue(makeQueryBuilder({ data: [ghost], error: null }))

    const result = await listTripMembers('t1')
    expect(result[0]).toEqual({
      id: 'm2',
      user_id: null,
      role: 'member',
      status: 'active',
      display_name: 'Léa',
      avatar_url: null,
    })
  })

  it('prefers the profile name over the trip alias on a claimed place', async () => {
    const claimed = { ...rawMember, display_name: 'Léa' }
    from.mockReturnValue(makeQueryBuilder({ data: [claimed], error: null }))

    const result = await listTripMembers('t1')
    expect(result[0].display_name).toBe('Alice')
  })

  it('maps null profiles fields to null', async () => {
    const memberWithNullProfile = {
      ...rawMember,
      profiles: { display_name: null, avatar_url: null },
    }
    const builder = makeQueryBuilder({ data: [memberWithNullProfile], error: null })
    from.mockReturnValue(builder)

    const result = await listTripMembers('t1')
    expect(result[0].display_name).toBeNull()
    expect(result[0].avatar_url).toBeNull()
  })

  it('throws when the query errors', async () => {
    from.mockReturnValue(makeQueryBuilder({ data: null, error: makePostgrestError('list fail') }))

    await expect(listTripMembers('t1')).rejects.toThrow('list fail')
  })
})

describe('listTripMemberNames', () => {
  it('calls the trip_member_names RPC and maps the rows (incl. null names for removed/anon)', async () => {
    rpc.mockResolvedValue({
      data: [
        { id: 'm1', user_id: 'u1', display_name: 'Alice' },
        { id: 'm2', user_id: 'u2', display_name: null },
      ],
      error: null,
    })

    await expect(listTripMemberNames('t1')).resolves.toEqual([
      { id: 'm1', user_id: 'u1', display_name: 'Alice' },
      { id: 'm2', user_id: 'u2', display_name: null },
    ])
    expect(rpc).toHaveBeenCalledWith('trip_member_names', { _trip_id: 't1' })
  })

  it('throws when the RPC errors', async () => {
    rpc.mockResolvedValue({ data: null, error: makePostgrestError('names fail') })

    await expect(listTripMemberNames('t1')).rejects.toThrow('names fail')
  })
})

describe('regenerateInviteCode', () => {
  it('calls rpc regenerate_invite_code and returns the new code', async () => {
    rpc.mockResolvedValue({ data: 'newcode123456', error: null })

    await expect(regenerateInviteCode('t1')).resolves.toBe('newcode123456')
    expect(rpc).toHaveBeenCalledWith('regenerate_invite_code', { _trip_id: 't1' })
  })

  it('throws when rpc errors', async () => {
    rpc.mockResolvedValue({ data: null, error: makePostgrestError('not owner') })

    await expect(regenerateInviteCode('t1')).rejects.toThrow('not owner')
  })
})

describe('leaveTrip', () => {
  it('calls rpc leave_trip with the trip id', async () => {
    rpc.mockResolvedValue({ data: null, error: null })

    await expect(leaveTrip('t1')).resolves.toBeUndefined()
    expect(rpc).toHaveBeenCalledWith('leave_trip', { _trip_id: 't1' })
  })

  it('throws when rpc errors (e.g. owner cannot leave)', async () => {
    rpc.mockResolvedValue({ data: null, error: makePostgrestError('owner cannot leave') })

    await expect(leaveTrip('t1')).rejects.toThrow('owner cannot leave')
  })
})

describe('removeTripMember', () => {
  it('calls rpc remove_trip_member with the member id', async () => {
    rpc.mockResolvedValue({ data: null, error: null })

    await expect(removeTripMember('m1')).resolves.toBeUndefined()
    expect(rpc).toHaveBeenCalledWith('remove_trip_member', { _member_id: 'm1' })
  })

  it('throws when rpc errors (non-owner caller)', async () => {
    rpc.mockResolvedValue({ data: null, error: makePostgrestError('only owner') })

    await expect(removeTripMember('m1')).rejects.toThrow('only owner')
  })
})

describe('getTripClaimOptions', () => {
  it('calls the rpc and parses the jsonb payload, keeping the slot order', async () => {
    rpc.mockResolvedValue({
      data: {
        tripId: TRIP_ID,
        tripTitle: 'Lisbon',
        myStatus: null,
        slots: [
          { slotId: SLOT_ONE, slotName: 'Léa' },
          { slotId: SLOT_TWO, slotName: 'Marco' },
        ],
      },
      error: null,
    })

    await expect(getTripClaimOptions('abcd1234')).resolves.toEqual({
      tripId: TRIP_ID,
      tripTitle: 'Lisbon',
      myStatus: null,
      slots: [
        { slotId: SLOT_ONE, slotName: 'Léa' },
        { slotId: SLOT_TWO, slotName: 'Marco' },
      ],
    })
    expect(rpc).toHaveBeenCalledWith('get_trip_claim_options', { _code: 'abcd1234' })
  })

  it('parses a trip with no free slot and an existing membership', async () => {
    rpc.mockResolvedValue({
      data: { tripId: TRIP_ID, tripTitle: 'Lisbon', myStatus: 'removed', slots: [] },
      error: null,
    })

    await expect(getTripClaimOptions('abcd1234')).resolves.toEqual({
      tripId: TRIP_ID,
      tripTitle: 'Lisbon',
      myStatus: 'removed',
      slots: [],
    })
  })

  it('throws instead of returning a half-typed object when the payload is malformed', async () => {
    rpc.mockResolvedValue({ data: { tripId: TRIP_ID, slots: 'nope' }, error: null })

    await expect(getTripClaimOptions('abcd1234')).rejects.toThrow()
  })

  it('throws when the rpc errors', async () => {
    rpc.mockResolvedValue({ data: null, error: makePostgrestError('invalid invite code') })

    await expect(getTripClaimOptions('nope')).rejects.toThrow('invalid invite code')
  })
})

describe('claimTripSlot', () => {
  it('claims a named slot and returns the trip id', async () => {
    rpc.mockResolvedValue({ data: TRIP_ID, error: null })

    await expect(claimTripSlot('abcd1234', SLOT_ONE)).resolves.toBe(TRIP_ID)
    expect(rpc).toHaveBeenCalledWith('claim_trip_slot', {
      _code: 'abcd1234',
      _slot_id: SLOT_ONE,
    })
  })

  it('omits the slot id when the caller is not in the list', async () => {
    rpc.mockResolvedValue({ data: TRIP_ID, error: null })

    await expect(claimTripSlot('abcd1234', null)).resolves.toBe(TRIP_ID)
    expect(rpc).toHaveBeenCalledWith('claim_trip_slot', { _code: 'abcd1234' })
  })

  it('throws when the slot was claimed meanwhile', async () => {
    rpc.mockResolvedValue({ data: null, error: makePostgrestError('slot already claimed') })

    await expect(claimTripSlot('abcd1234', SLOT_ONE)).rejects.toThrow('slot already claimed')
  })
})

describe('addGhostMember', () => {
  it('calls the rpc and returns the new member id', async () => {
    rpc.mockResolvedValue({ data: SLOT_ONE, error: null })

    await expect(addGhostMember(TRIP_ID, 'Léa')).resolves.toBe(SLOT_ONE)
    expect(rpc).toHaveBeenCalledWith('add_ghost_member', { _trip_id: TRIP_ID, _name: 'Léa' })
  })

  it('throws when the rpc errors', async () => {
    rpc.mockResolvedValue({ data: null, error: makePostgrestError('member limit reached') })

    await expect(addGhostMember(TRIP_ID, 'Léa')).rejects.toThrow('member limit reached')
  })
})

describe('renameGhostMember', () => {
  it('calls the rpc with the member id and the new name', async () => {
    rpc.mockResolvedValue({ data: null, error: null })

    await expect(renameGhostMember('m2', 'Léa')).resolves.toBeUndefined()
    expect(rpc).toHaveBeenCalledWith('rename_ghost_member', { _member_id: 'm2', _name: 'Léa' })
  })

  it('throws when the target is not a renamable ghost', async () => {
    rpc.mockResolvedValue({ data: null, error: makePostgrestError('not a renamable ghost') })

    await expect(renameGhostMember('m1', 'Léa')).rejects.toThrow('not a renamable ghost')
  })
})

describe('detachTripMember', () => {
  it('calls the rpc with the member id', async () => {
    rpc.mockResolvedValue({ data: null, error: null })

    await expect(detachTripMember('m1')).resolves.toBeUndefined()
    expect(rpc).toHaveBeenCalledWith('detach_trip_member', { _member_id: 'm1' })
  })

  // The participants screen routes its fallback dialog on this exact string, so the wrapper
  // must let it through untouched.
  it('surfaces the tenure guard message verbatim', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: makePostgrestError('place has ledger activity since claim; remove the member instead'),
    })

    await expect(detachTripMember('m1')).rejects.toThrow(
      'place has ledger activity since claim; remove the member instead',
    )
  })

  it('throws when the caller is not the owner', async () => {
    rpc.mockResolvedValue({ data: null, error: makePostgrestError('owner only') })

    await expect(detachTripMember('m1')).rejects.toThrow('owner only')
  })
})
