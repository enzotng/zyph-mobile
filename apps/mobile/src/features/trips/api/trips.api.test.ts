import { supabase } from '@/lib/supabase'
import { makePostgrestError, makeQueryBuilder } from '@/test-utils/supabase-mock'
import {
  createCalendarFeedToken,
  createTrip,
  createTripInboxAddress,
  deleteTrip,
  fetchTripCover,
  getTrip,
  getTripInboxAddress,
  listTrips,
  resetTripCover,
  revokeTripInboxAddress,
  setTripInboxAutoValidate,
  updateTrip,
  updateTripPreferences,
  uploadTripCover,
} from './trips.api'

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
      trip_type: null,
      budget_level: null,
    })
  })

  it('persists the light profile fields collected at creation', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
    const builder = makeQueryBuilder({ data: trip, error: null })
    from.mockReturnValue(builder)

    await createTrip({ ...input, tripType: 'beach', budgetLevel: 'high' })
    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ trip_type: 'beach', budget_level: 'high' }),
    )
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

describe('updateTripPreferences', () => {
  it('maps the profile fields to snake_case columns and returns the trip', async () => {
    const builder = makeQueryBuilder({ data: trip, error: null })
    from.mockReturnValue(builder)

    await expect(
      updateTripPreferences({
        id: 't1',
        tripType: 'beach',
        budgetLevel: 'high',
        budgetTotalCents: 120000,
        pace: 'relaxed',
        interests: ['food', 'museums'],
        dietary: ['vegan'],
      }),
    ).resolves.toEqual(trip)
    expect(builder.update).toHaveBeenCalledWith({
      trip_type: 'beach',
      budget_level: 'high',
      budget_total_cents: 120000,
      pace: 'relaxed',
      interests: ['food', 'museums'],
      dietary: ['vegan'],
    })
    expect(builder.eq).toHaveBeenCalledWith('id', 't1')
  })

  it('throws on error', async () => {
    from.mockReturnValue(makeQueryBuilder({ data: null, error: makePostgrestError('prefs fail') }))

    await expect(
      updateTripPreferences({
        id: 't1',
        tripType: null,
        budgetLevel: null,
        budgetTotalCents: null,
        pace: null,
        interests: [],
        dietary: [],
      }),
    ).rejects.toThrow('prefs fail')
  })
})

describe('uploadTripCover', () => {
  it('uploads via the edge function and returns the updated trip', async () => {
    const updated = { ...trip, cover_photo_url: 'https://covers/t1.jpg' }
    invoke.mockResolvedValue({ data: { trip: updated }, error: null })

    await expect(uploadTripCover('t1', 'YmFzZTY0', 'image/jpeg')).resolves.toEqual(updated)
    expect(invoke).toHaveBeenCalledWith('upload-trip-cover', {
      body: { tripId: 't1', imageBase64: 'YmFzZTY0', contentType: 'image/jpeg' },
    })
  })

  it('throws when the function errors', async () => {
    invoke.mockResolvedValue({ data: null, error: new Error('fn down') })

    await expect(uploadTripCover('t1', 'YmFzZTY0', 'image/jpeg')).rejects.toThrow('fn down')
  })

  it('throws when the function returns no trip', async () => {
    invoke.mockResolvedValue({ data: {}, error: null })

    await expect(uploadTripCover('t1', 'YmFzZTY0', 'image/jpeg')).rejects.toThrow('no trip')
  })
})

describe('resetTripCover', () => {
  it('clears the cover then re-fetches the automatic one', async () => {
    const cleared = { ...trip, destination: 'PT', cover_photo_url: null }
    const recovered = { ...cleared, cover_photo_url: 'https://img/auto.jpg' }
    const clearBuilder = makeQueryBuilder({ data: cleared, error: null })
    const updateBuilder = makeQueryBuilder({ data: recovered, error: null })
    from.mockReturnValueOnce(clearBuilder).mockReturnValueOnce(updateBuilder)
    invoke.mockResolvedValue({
      data: { url: 'https://img/auto.jpg', author: null, authorUrl: null },
      error: null,
    })

    await expect(resetTripCover('t1')).resolves.toEqual(recovered)
    expect(clearBuilder.update).toHaveBeenCalledWith({
      cover_photo_url: null,
      cover_photo_author: null,
      cover_photo_author_url: null,
    })
  })

  it('keeps the cover cleared when the trip has no destination', async () => {
    const cleared = { ...trip, destination: null, cover_photo_url: null }
    from.mockReturnValue(makeQueryBuilder({ data: cleared, error: null }))

    await expect(resetTripCover('t1')).resolves.toEqual(cleared)
    // No destination -> withCover skips the auto-fetch, so the cover function is never called.
    expect(invoke).not.toHaveBeenCalled()
  })

  it('throws when clearing the cover errors', async () => {
    from.mockReturnValue(makeQueryBuilder({ data: null, error: makePostgrestError('reset fail') }))

    await expect(resetTripCover('t1')).rejects.toThrow('reset fail')
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

describe('createCalendarFeedToken', () => {
  it('returns the raw token from the rpc', async () => {
    const token = 'a'.repeat(64)
    rpc.mockResolvedValue({ data: token, error: null })

    await expect(createCalendarFeedToken('t1')).resolves.toBe(token)
    expect(rpc).toHaveBeenCalledWith('create_calendar_feed_token', { _trip_id: 't1' })
  })

  it('throws when the rpc errors', async () => {
    rpc.mockResolvedValue({ data: null, error: makePostgrestError('not an active member') })

    await expect(createCalendarFeedToken('t1')).rejects.toThrow('not an active member')
  })
})

// Fictional address matching create_trip_inbox_address's real shape (slug + zyph domain).
const INBOX_ADDRESS = 'roadtrip-test-a1b2c3@zyph.enzotang.fr'

describe('createTripInboxAddress', () => {
  it('returns the full address from the rpc', async () => {
    rpc.mockResolvedValue({ data: INBOX_ADDRESS, error: null })

    await expect(createTripInboxAddress('t1')).resolves.toBe(INBOX_ADDRESS)
    expect(rpc).toHaveBeenCalledWith('create_trip_inbox_address', { _trip_id: 't1' })
  })

  it('throws when the rpc errors', async () => {
    rpc.mockResolvedValue({ data: null, error: makePostgrestError('not an active member') })

    await expect(createTripInboxAddress('t1')).rejects.toThrow('not an active member')
  })
})

describe('getTripInboxAddress', () => {
  it('maps the single row to address + autoValidate', async () => {
    rpc.mockResolvedValue({
      data: [{ address: INBOX_ADDRESS, auto_validate: true }],
      error: null,
    })

    await expect(getTripInboxAddress('t1')).resolves.toEqual({
      address: INBOX_ADDRESS,
      autoValidate: true,
    })
    expect(rpc).toHaveBeenCalledWith('get_trip_inbox_address', { _trip_id: 't1' })
  })

  it('returns null when no address exists yet', async () => {
    rpc.mockResolvedValue({ data: [], error: null })

    await expect(getTripInboxAddress('t1')).resolves.toBeNull()
  })

  it('throws when the rpc errors', async () => {
    rpc.mockResolvedValue({ data: null, error: makePostgrestError('not an active member') })

    await expect(getTripInboxAddress('t1')).rejects.toThrow('not an active member')
  })
})

describe('revokeTripInboxAddress', () => {
  it('calls the rpc with the trip id', async () => {
    rpc.mockResolvedValue({ data: null, error: null })

    await expect(revokeTripInboxAddress('t1')).resolves.toBeUndefined()
    expect(rpc).toHaveBeenCalledWith('revoke_trip_inbox_address', { _trip_id: 't1' })
  })

  it('throws when the rpc errors', async () => {
    rpc.mockResolvedValue({ data: null, error: makePostgrestError('not an active member') })

    await expect(revokeTripInboxAddress('t1')).rejects.toThrow('not an active member')
  })
})

describe('setTripInboxAutoValidate', () => {
  it('calls the rpc with the trip id and flag', async () => {
    rpc.mockResolvedValue({ data: null, error: null })

    await expect(setTripInboxAutoValidate('t1', true)).resolves.toBeUndefined()
    expect(rpc).toHaveBeenCalledWith('set_trip_inbox_autovalidate', { _trip_id: 't1', _on: true })
  })

  it('throws when the rpc errors', async () => {
    rpc.mockResolvedValue({ data: null, error: makePostgrestError('not an active member') })

    await expect(setTripInboxAutoValidate('t1', false)).rejects.toThrow('not an active member')
  })
})
