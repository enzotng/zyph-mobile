import { supabase } from '@/lib/supabase'
import { makePostgrestError, makeQueryBuilder } from '@/test-utils/supabase-mock'

import {
  clearMemberLocation,
  createPoi,
  deletePoi,
  getPoi,
  listMemberLocations,
  listPois,
  updatePoi,
  upsertMemberLocation,
} from './wayfinder.api'

jest.mock('@/lib/supabase')

const from = supabase.from as jest.Mock
const rpc = supabase.rpc as jest.Mock
const getSession = supabase.auth.getSession as jest.Mock

const poi = {
  id: 'p1',
  trip_id: 't1',
  label: 'Colosseum',
  icon: 'pin',
  lat: 41.89,
  lng: 12.49,
  created_by: 'u1',
  created_at: '2026-06-04T00:00:00.000Z',
  updated_at: '2026-06-04T00:00:00.000Z',
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('listPois', () => {
  it('returns trip pois ordered by creation date', async () => {
    const builder = makeQueryBuilder({ data: [poi], error: null })
    from.mockReturnValue(builder)

    await expect(listPois('t1')).resolves.toEqual([poi])
    expect(from).toHaveBeenCalledWith('trip_pois')
    expect(builder.eq).toHaveBeenCalledWith('trip_id', 't1')
    expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: true })
  })

  it('throws when the query errors', async () => {
    from.mockReturnValue(makeQueryBuilder({ data: null, error: makePostgrestError('list fail') }))

    await expect(listPois('t1')).rejects.toThrow('list fail')
  })
})

describe('getPoi', () => {
  it('returns a single poi by id', async () => {
    const builder = makeQueryBuilder({ data: poi, error: null })
    from.mockReturnValue(builder)

    await expect(getPoi('p1')).resolves.toEqual(poi)
    expect(from).toHaveBeenCalledWith('trip_pois')
    expect(builder.eq).toHaveBeenCalledWith('id', 'p1')
    expect(builder.maybeSingle).toHaveBeenCalled()
  })

  it('returns null when the poi does not exist', async () => {
    from.mockReturnValue(makeQueryBuilder({ data: null, error: null }))

    await expect(getPoi('missing')).resolves.toBeNull()
  })

  it('throws on error', async () => {
    from.mockReturnValue(makeQueryBuilder({ data: null, error: makePostgrestError('get fail') }))

    await expect(getPoi('p1')).rejects.toThrow('get fail')
  })
})

describe('createPoi', () => {
  const input = { tripId: 't1', label: 'Colosseum', icon: 'pin', lat: 41.89, lng: 12.49 }

  it('inserts a poi created by the signed-in user', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
    const builder = makeQueryBuilder({ data: poi, error: null })
    from.mockReturnValue(builder)

    await expect(createPoi(input)).resolves.toEqual(poi)
    expect(from).toHaveBeenCalledWith('trip_pois')
    expect(builder.insert).toHaveBeenCalledWith({
      trip_id: 't1',
      label: 'Colosseum',
      icon: 'pin',
      lat: 41.89,
      lng: 12.49,
      created_by: 'u1',
    })
  })

  it('rejects when there is no session', async () => {
    getSession.mockResolvedValue({ data: { session: null } })

    await expect(createPoi(input)).rejects.toThrow('signed in')
    expect(from).not.toHaveBeenCalled()
  })

  it('throws when the insert errors', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
    from.mockReturnValue(makeQueryBuilder({ data: null, error: makePostgrestError('insert fail') }))

    await expect(createPoi(input)).rejects.toThrow('insert fail')
  })
})

describe('updatePoi', () => {
  const input = { poiId: 'p1', label: 'Forum', icon: 'star', lat: 41.0, lng: 12.0 }

  it('updates and returns the poi', async () => {
    const builder = makeQueryBuilder({ data: poi, error: null })
    from.mockReturnValue(builder)

    await expect(updatePoi(input)).resolves.toEqual(poi)
    expect(from).toHaveBeenCalledWith('trip_pois')
    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({ label: 'Forum', icon: 'star', lat: 41.0, lng: 12.0 }),
    )
    expect(builder.eq).toHaveBeenCalledWith('id', 'p1')
  })

  it('throws on error', async () => {
    from.mockReturnValue(makeQueryBuilder({ data: null, error: makePostgrestError('update fail') }))

    await expect(updatePoi(input)).rejects.toThrow('update fail')
  })
})

describe('deletePoi', () => {
  it('deletes by id', async () => {
    const builder = makeQueryBuilder({ data: null, error: null })
    from.mockReturnValue(builder)

    await expect(deletePoi('p1')).resolves.toBeUndefined()
    expect(from).toHaveBeenCalledWith('trip_pois')
    expect(builder.eq).toHaveBeenCalledWith('id', 'p1')
  })

  it('throws on error', async () => {
    from.mockReturnValue(makeQueryBuilder({ data: null, error: makePostgrestError('del fail') }))

    await expect(deletePoi('p1')).rejects.toThrow('del fail')
  })
})

describe('upsertMemberLocation', () => {
  it('passes optional accuracy and heading when they are numbers', async () => {
    rpc.mockResolvedValue({ data: null, error: null })

    await expect(
      upsertMemberLocation({ tripId: 't1', lat: 41.89, lng: 12.49, accuracyM: 5, headingDeg: 90 }),
    ).resolves.toBeUndefined()
    expect(rpc).toHaveBeenCalledWith('upsert_member_location', {
      _trip_id: 't1',
      _lat: 41.89,
      _lng: 12.49,
      _accuracy_m: 5,
      _heading_deg: 90,
    })
  })

  it('omits optional values when they are undefined', async () => {
    rpc.mockResolvedValue({ data: null, error: null })

    await upsertMemberLocation({ tripId: 't1', lat: 41.89, lng: 12.49 })
    expect(rpc).toHaveBeenCalledWith('upsert_member_location', {
      _trip_id: 't1',
      _lat: 41.89,
      _lng: 12.49,
      _accuracy_m: undefined,
      _heading_deg: undefined,
    })
  })

  it('throws when rpc errors', async () => {
    rpc.mockResolvedValue({ data: null, error: makePostgrestError('rpc fail') })

    await expect(upsertMemberLocation({ tripId: 't1', lat: 41.89, lng: 12.49 })).rejects.toThrow(
      'rpc fail',
    )
  })
})

describe('clearMemberLocation', () => {
  it('calls rpc clear_member_location with the trip id', async () => {
    rpc.mockResolvedValue({ data: null, error: null })

    await expect(clearMemberLocation('t1')).resolves.toBeUndefined()
    expect(rpc).toHaveBeenCalledWith('clear_member_location', { _trip_id: 't1' })
  })

  it('throws when rpc errors', async () => {
    rpc.mockResolvedValue({ data: null, error: makePostgrestError('clear fail') })

    await expect(clearMemberLocation('t1')).rejects.toThrow('clear fail')
  })
})

describe('listMemberLocations', () => {
  const location = {
    lat: 41.89,
    lng: 12.49,
    accuracy_m: 5,
    heading_deg: 90,
    updated_at: '2026-06-04T00:00:00.000Z',
    trip_member_id: 'm1',
    trip_member: {
      id: 'm1',
      user_id: 'u2',
      status: 'active',
      profile: { id: 'u2', display_name: 'Ada', avatar_url: null },
    },
  }

  it('excludes the current user when there is a session', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
    const builder = makeQueryBuilder({ data: [location], error: null })
    from.mockReturnValue(builder)

    await expect(listMemberLocations('t1')).resolves.toEqual([location])
    expect(from).toHaveBeenCalledWith('member_locations')
    expect(builder.eq).toHaveBeenCalledWith('trip_member.trip_id', 't1')
    expect(builder.eq).toHaveBeenCalledWith('trip_member.status', 'active')
    expect(builder.neq).toHaveBeenCalledWith('trip_member.user_id', 'u1')
  })

  it('does not filter by user when there is no session', async () => {
    getSession.mockResolvedValue({ data: { session: null } })
    const builder = makeQueryBuilder({ data: [location], error: null })
    from.mockReturnValue(builder)

    await expect(listMemberLocations('t1')).resolves.toEqual([location])
    expect(builder.neq).not.toHaveBeenCalled()
  })

  it('throws when the query errors', async () => {
    getSession.mockResolvedValue({ data: { session: null } })
    from.mockReturnValue(makeQueryBuilder({ data: null, error: makePostgrestError('loc fail') }))

    await expect(listMemberLocations('t1')).rejects.toThrow('loc fail')
  })
})
