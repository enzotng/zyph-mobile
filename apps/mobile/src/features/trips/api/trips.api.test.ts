import { supabase } from '@/lib/supabase'
import { makePostgrestError, makeQueryBuilder } from '@/test-utils/supabase-mock'
import { createTrip, deleteTrip, getTrip, listTrips, updateTrip } from './trips.api'

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

describe('listTrips', () => {
  it('returns trips ordered by creation date', async () => {
    const builder = makeQueryBuilder({ data: [trip], error: null })
    from.mockReturnValue(builder)

    await expect(listTrips()).resolves.toEqual([{ ...trip, members: [], myBalanceCents: 0 }])
    expect(from).toHaveBeenCalledWith('trips')
    expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false })
  })

  it('throws when the query errors', async () => {
    from.mockReturnValue(makeQueryBuilder({ data: null, error: makePostgrestError('boom') }))

    await expect(listTrips()).rejects.toThrow('boom')
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
    })
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
      }),
    ).resolves.toEqual(trip)
    expect(builder.update).toHaveBeenCalledWith({
      title: 'Lisbon',
      destination: null,
      currency: 'EUR',
      start_date: '2026-06-10',
      end_date: '2026-06-14',
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
