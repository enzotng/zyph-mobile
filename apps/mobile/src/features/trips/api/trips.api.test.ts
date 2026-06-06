import { supabase } from '@/lib/supabase'
import { makePostgrestError, makeQueryBuilder } from '@/test-utils/supabase-mock'
import { createTrip, deleteTrip, fetchTripCover, getTrip, listTrips, updateTrip } from './trips.api'

jest.mock('@/lib/supabase')

const from = supabase.from as jest.Mock
const getSession = supabase.auth.getSession as jest.Mock
const rpc = supabase.rpc as jest.Mock
const invoke = supabase.functions.invoke as jest.Mock

const trip = { id: 't1', owner_id: 'u1', title: 'Lisbon', destination: 'PT', currency: 'EUR' }

beforeEach(() => {
  jest.clearAllMocks()
  rpc.mockResolvedValue({ data: [], error: null })
  invoke.mockResolvedValue({ data: { url: null, author: null, authorUrl: null }, error: null })
})

describe('fetchTripCover', () => {
  it('returns the cover from the edge function', async () => {
    const cover = { url: 'https://img/x.jpg', author: 'Ann', authorUrl: 'https://u/ann' }
    invoke.mockResolvedValue({ data: cover, error: null })

    await expect(fetchTripCover('Lisbon')).resolves.toEqual(cover)
    expect(invoke).toHaveBeenCalledWith('trip-cover', { body: { destination: 'Lisbon' } })
  })

  it('returns nulls when the function errors', async () => {
    invoke.mockResolvedValue({ data: null, error: new Error('fn down') })

    await expect(fetchTripCover('Lisbon')).resolves.toEqual({
      url: null,
      author: null,
      authorUrl: null,
    })
  })

  it('returns nulls when the function returns no data', async () => {
    invoke.mockResolvedValue({ data: null, error: null })

    await expect(fetchTripCover('Lisbon')).resolves.toEqual({
      url: null,
      author: null,
      authorUrl: null,
    })
  })

  it('returns nulls when the invocation throws', async () => {
    invoke.mockRejectedValue(new Error('network'))

    await expect(fetchTripCover('Lisbon')).resolves.toEqual({
      url: null,
      author: null,
      authorUrl: null,
    })
  })
})

describe('listTrips', () => {
  it('returns trips ordered by creation date', async () => {
    const builder = makeQueryBuilder({ data: [trip], error: null })
    from.mockReturnValue(builder)

    await expect(listTrips()).resolves.toEqual([{ ...trip, members: [], myBalanceCents: 0 }])
    expect(from).toHaveBeenCalledWith('trips')
    expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false })
  })

  it('maps active members and the signed-in balance, dropping inactive ones', async () => {
    rpc.mockResolvedValue({ data: [{ trip_id: 't1', balance_cents: 1500 }], error: null })
    const row = {
      ...trip,
      trip_members: [
        {
          id: 'm1',
          user_id: 'u1',
          role: 'owner',
          status: 'active',
          profiles: { display_name: 'Ana', avatar_url: 'https://a/1.png' },
        },
        {
          id: 'm2',
          user_id: 'u2',
          role: 'member',
          status: 'active',
          profiles: null,
        },
        {
          id: 'm3',
          user_id: 'u3',
          role: 'member',
          status: 'removed',
          profiles: { display_name: 'Gone', avatar_url: null },
        },
      ],
    }
    from.mockReturnValue(makeQueryBuilder({ data: [row], error: null }))

    const [card] = await listTrips()
    expect(card.myBalanceCents).toBe(1500)
    expect(card.members).toEqual([
      {
        id: 'm1',
        user_id: 'u1',
        role: 'owner',
        status: 'active',
        display_name: 'Ana',
        avatar_url: 'https://a/1.png',
      },
      {
        id: 'm2',
        user_id: 'u2',
        role: 'member',
        status: 'active',
        display_name: null,
        avatar_url: null,
      },
    ])
  })

  it('defaults to empty members when trip_members is missing', async () => {
    const row = { ...trip, trip_members: null }
    from.mockReturnValue(makeQueryBuilder({ data: [row], error: null }))

    const [card] = await listTrips()
    expect(card.members).toEqual([])
    expect(card.myBalanceCents).toBe(0)
  })

  it('returns an empty list when both queries return null data', async () => {
    from.mockReturnValue(makeQueryBuilder({ data: null, error: null }))
    rpc.mockResolvedValue({ data: null, error: null })

    await expect(listTrips()).resolves.toEqual([])
  })

  it('throws when the query errors', async () => {
    from.mockReturnValue(makeQueryBuilder({ data: null, error: makePostgrestError('boom') }))

    await expect(listTrips()).rejects.toThrow('boom')
  })

  it('throws when the balances rpc errors', async () => {
    from.mockReturnValue(makeQueryBuilder({ data: [trip], error: null }))
    rpc.mockResolvedValue({ data: null, error: makePostgrestError('rpc down') })

    await expect(listTrips()).rejects.toThrow('rpc down')
  })
})

describe('getTrip', () => {
  it('returns a single trip by id', async () => {
    const builder = makeQueryBuilder({ data: trip, error: null })
    from.mockReturnValue(builder)

    await expect(getTrip('t1')).resolves.toEqual(trip)
    expect(builder.eq).toHaveBeenCalledWith('id', 't1')
  })

  it('throws on error', async () => {
    from.mockReturnValue(makeQueryBuilder({ data: null, error: makePostgrestError('nope') }))

    await expect(getTrip('t1')).rejects.toThrow('nope')
  })
})

describe('createTrip', () => {
  const input = {
    title: 'Rome',
    destination: 'IT',
    currency: 'EUR',
    startDate: null,
    endDate: null,
    latitude: null,
    longitude: null,
  }

  it('inserts a trip owned by the signed-in user', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
    const builder = makeQueryBuilder({ data: trip, error: null })
    from.mockReturnValue(builder)

    await expect(createTrip(input)).resolves.toEqual(trip)
    expect(builder.insert).toHaveBeenCalledWith({
      owner_id: 'u1',
      title: 'Rome',
      destination: 'IT',
      currency: 'EUR',
      start_date: null,
      end_date: null,
      latitude: null,
      longitude: null,
    })
  })

  it('persists the picked coordinates', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
    const builder = makeQueryBuilder({ data: trip, error: null })
    from.mockReturnValue(builder)

    await createTrip({ ...input, latitude: 38.72, longitude: -9.14 })
    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ latitude: 38.72, longitude: -9.14 }),
    )
  })

  it('persists travel dates when provided', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
    const builder = makeQueryBuilder({ data: trip, error: null })
    from.mockReturnValue(builder)

    await createTrip({ ...input, startDate: '2026-06-10', endDate: '2026-06-14' })
    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ start_date: '2026-06-10', end_date: '2026-06-14' }),
    )
  })

  it('nulls an empty destination', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
    const builder = makeQueryBuilder({ data: trip, error: null })
    from.mockReturnValue(builder)

    await createTrip({ ...input, destination: '' })
    expect(builder.insert).toHaveBeenCalledWith(expect.objectContaining({ destination: null }))
  })

  it('rejects when there is no session', async () => {
    getSession.mockResolvedValue({ data: { session: null } })

    await expect(createTrip(input)).rejects.toThrow('signed in')
    expect(from).not.toHaveBeenCalled()
  })

  it('throws when the insert errors', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
    from.mockReturnValue(makeQueryBuilder({ data: null, error: makePostgrestError('insert fail') }))

    await expect(createTrip(input)).rejects.toThrow('insert fail')
  })

  it('backfills the cover when one is found for the destination', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
    const inserted = { ...trip, destination: 'IT', cover_photo_url: null }
    const withPhoto = { ...inserted, cover_photo_url: 'https://img/it.jpg' }
    const insertBuilder = makeQueryBuilder({ data: inserted, error: null })
    const updateBuilder = makeQueryBuilder({ data: withPhoto, error: null })
    from.mockReturnValueOnce(insertBuilder).mockReturnValueOnce(updateBuilder)
    invoke.mockResolvedValue({
      data: { url: 'https://img/it.jpg', author: 'Ann', authorUrl: 'https://u/ann' },
      error: null,
    })

    await expect(createTrip(input)).resolves.toEqual(withPhoto)
    expect(updateBuilder.update).toHaveBeenCalledWith({
      cover_photo_url: 'https://img/it.jpg',
      cover_photo_author: 'Ann',
      cover_photo_author_url: 'https://u/ann',
    })
    expect(updateBuilder.eq).toHaveBeenCalledWith('id', 't1')
  })

  it('keeps the inserted trip when the cover update returns no data', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
    const inserted = { ...trip, destination: 'IT', cover_photo_url: null }
    from
      .mockReturnValueOnce(makeQueryBuilder({ data: inserted, error: null }))
      .mockReturnValueOnce(makeQueryBuilder({ data: null, error: null }))
    invoke.mockResolvedValue({
      data: { url: 'https://img/it.jpg', author: null, authorUrl: null },
      error: null,
    })

    await expect(createTrip(input)).resolves.toEqual(inserted)
  })

  it('skips the cover backfill when the trip already has a cover', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
    const inserted = { ...trip, destination: 'IT', cover_photo_url: 'https://existing.jpg' }
    const builder = makeQueryBuilder({ data: inserted, error: null })
    from.mockReturnValue(builder)

    await expect(createTrip(input)).resolves.toEqual(inserted)
    expect(invoke).not.toHaveBeenCalled()
    expect(from).toHaveBeenCalledTimes(1)
  })

  it('skips the cover backfill when the trip has no destination', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
    const inserted = { ...trip, destination: null, cover_photo_url: null }
    const builder = makeQueryBuilder({ data: inserted, error: null })
    from.mockReturnValue(builder)

    await expect(createTrip({ ...input, destination: '' })).resolves.toEqual(inserted)
    expect(invoke).not.toHaveBeenCalled()
    expect(from).toHaveBeenCalledTimes(1)
  })

  it('keeps the inserted trip when no cover url is found', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
    const inserted = { ...trip, destination: 'IT', cover_photo_url: null }
    const builder = makeQueryBuilder({ data: inserted, error: null })
    from.mockReturnValue(builder)
    invoke.mockResolvedValue({ data: { url: null, author: null, authorUrl: null }, error: null })

    await expect(createTrip(input)).resolves.toEqual(inserted)
    expect(invoke).toHaveBeenCalledWith('trip-cover', { body: { destination: 'IT' } })
    expect(from).toHaveBeenCalledTimes(1)
  })
})

describe('updateTrip', () => {
  it('updates and returns the trip', async () => {
    const builder = makeQueryBuilder({ data: trip, error: null })
    from.mockReturnValue(builder)

    await expect(
      updateTrip({
        id: 't1',
        title: 'Lisbon',
        destination: '',
        currency: 'EUR',
        startDate: '2026-06-10',
        endDate: '2026-06-14',
        latitude: 12.34,
        longitude: 56.78,
      }),
    ).resolves.toEqual(trip)
    expect(builder.update).toHaveBeenCalledWith({
      title: 'Lisbon',
      destination: null,
      currency: 'EUR',
      start_date: '2026-06-10',
      end_date: '2026-06-14',
      latitude: 12.34,
      longitude: 56.78,
    })
    expect(builder.eq).toHaveBeenCalledWith('id', 't1')
  })

  it('throws on error', async () => {
    from.mockReturnValue(makeQueryBuilder({ data: null, error: makePostgrestError('update fail') }))

    await expect(
      updateTrip({
        id: 't1',
        title: 'x',
        destination: 'y',
        currency: 'EUR',
        startDate: null,
        endDate: null,
        latitude: null,
        longitude: null,
      }),
    ).rejects.toThrow('update fail')
  })
})

describe('deleteTrip', () => {
  it('deletes by id', async () => {
    const builder = makeQueryBuilder({ data: null, error: null })
    from.mockReturnValue(builder)

    await expect(deleteTrip('t1')).resolves.toBeUndefined()
    expect(builder.eq).toHaveBeenCalledWith('id', 't1')
  })

  it('throws on error', async () => {
    from.mockReturnValue(makeQueryBuilder({ data: null, error: makePostgrestError('del fail') }))

    await expect(deleteTrip('t1')).rejects.toThrow('del fail')
  })
})
