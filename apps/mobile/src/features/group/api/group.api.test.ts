import { supabase } from '@/lib/supabase'
import { makePostgrestError, makeQueryBuilder } from '@/test-utils/supabase-mock'

import {
  joinTripByCode,
  leaveTrip,
  listTripMemberNames,
  listTripMembers,
  regenerateInviteCode,
  removeTripMember,
} from './group.api'

jest.mock('@/lib/supabase')

const from = supabase.from as jest.Mock
const rpc = supabase.rpc as jest.Mock

// Raw shape returned by the Supabase join query.
const rawMember = {
  id: 'm1',
  user_id: 'u1',
  role: 'member' as const,
  status: 'active' as const,
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
    expect(builder.eq).toHaveBeenCalledWith('trip_id', 't1')
    expect(builder.eq).toHaveBeenCalledWith('status', 'active')
    expect(builder.order).toHaveBeenCalledWith('joined_at', { ascending: true })
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

describe('joinTripByCode', () => {
  it('calls rpc join_trip_by_code and returns the trip id', async () => {
    rpc.mockResolvedValue({ data: 't1', error: null })

    await expect(joinTripByCode('ABCD1234')).resolves.toBe('t1')
    expect(rpc).toHaveBeenCalledWith('join_trip_by_code', { _code: 'ABCD1234' })
  })

  it('throws when rpc errors', async () => {
    rpc.mockResolvedValue({ data: null, error: makePostgrestError('invalid code') })

    await expect(joinTripByCode('WRONG')).rejects.toThrow('invalid code')
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
