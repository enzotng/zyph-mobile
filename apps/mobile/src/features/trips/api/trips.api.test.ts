import { supabase } from '@/lib/supabase'
import { makePostgrestError, makeQueryBuilder } from '@/test-utils/supabase-mock'
import { createTrip, deleteTrip, getTrip, listTrips, updateTrip } from './trips.api'

jest.mock('@/lib/supabase')

const from = supabase.from as jest.Mock
const getSession = supabase.auth.getSession as jest.Mock

const trip = { id: 't1', owner_id: 'u1', title: 'Lisbon', destination: 'PT', currency: 'EUR' }

beforeEach(() => {
  jest.clearAllMocks()
})

describe('listTrips', () => {
  it('returns trips ordered by creation date', async () => {
    const builder = makeQueryBuilder({ data: [trip], error: null })
    from.mockReturnValue(builder)

    await expect(listTrips()).resolves.toEqual([trip])
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
  const input = { title: 'Rome', destination: 'IT', currency: 'EUR' }

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
    })
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
      updateTrip({ id: 't1', title: 'Lisbon', destination: '', currency: 'EUR' }),
    ).resolves.toEqual(trip)
    expect(builder.update).toHaveBeenCalledWith({
      title: 'Lisbon',
      destination: null,
      currency: 'EUR',
    })
    expect(builder.eq).toHaveBeenCalledWith('id', 't1')
  })

  it('throws on error', async () => {
    from.mockReturnValue(makeQueryBuilder({ data: null, error: makePostgrestError('update fail') }))

    await expect(
      updateTrip({ id: 't1', title: 'x', destination: 'y', currency: 'EUR' }),
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
