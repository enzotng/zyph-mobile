import { supabase } from '@/lib/supabase'
import { makePostgrestError, makeQueryBuilder } from '@/test-utils/supabase-mock'

import { createEvent, getEvent, listEvents } from './timeline.api'

jest.mock('@/lib/supabase')

const from = supabase.from as jest.Mock
const getSession = supabase.auth.getSession as jest.Mock

const event = {
  id: 'ev1',
  trip_id: 't1',
  title: 'Eiffel Tower visit',
  type: 'event',
  starts_at: '2024-06-01T10:00:00Z',
  ends_at: '2024-06-01T12:00:00Z',
  notes: 'Bring camera',
  location: null,
  created_by: 'u1',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('listEvents', () => {
  it('returns events ordered by starts_at ascending', async () => {
    const builder = makeQueryBuilder({ data: [event], error: null })
    from.mockReturnValue(builder)

    await expect(listEvents('t1')).resolves.toEqual([event])
    expect(from).toHaveBeenCalledWith('trip_events')
    expect(builder.eq).toHaveBeenCalledWith('trip_id', 't1')
    expect(builder.order).toHaveBeenCalledWith('starts_at', { ascending: true, nullsFirst: false })
  })

  it('throws when the query errors', async () => {
    from.mockReturnValue(makeQueryBuilder({ data: null, error: makePostgrestError('list fail') }))

    await expect(listEvents('t1')).rejects.toThrow('list fail')
  })
})

describe('getEvent', () => {
  it('returns the event by id', async () => {
    const builder = makeQueryBuilder({ data: event, error: null })
    from.mockReturnValue(builder)

    await expect(getEvent('ev1')).resolves.toEqual(event)
    expect(from).toHaveBeenCalledWith('trip_events')
    expect(builder.eq).toHaveBeenCalledWith('id', 'ev1')
    expect(builder.maybeSingle).toHaveBeenCalled()
  })

  it('returns null when event is not found', async () => {
    const builder = makeQueryBuilder({ data: null, error: null })
    from.mockReturnValue(builder)

    await expect(getEvent('ev999')).resolves.toBeNull()
  })

  it('throws on error', async () => {
    from.mockReturnValue(makeQueryBuilder({ data: null, error: makePostgrestError('get fail') }))

    await expect(getEvent('ev1')).rejects.toThrow('get fail')
  })
})

describe('createEvent', () => {
  const input = {
    tripId: 't1',
    title: 'Eiffel Tower visit',
    startsAt: '2024-06-01T10:00:00Z',
    endsAt: '2024-06-01T12:00:00Z',
    notes: 'Bring camera',
  }

  it('inserts an event with the signed-in user as creator', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
    const builder = makeQueryBuilder({ data: event, error: null })
    from.mockReturnValue(builder)

    await expect(createEvent(input)).resolves.toEqual(event)
    expect(builder.insert).toHaveBeenCalledWith({
      trip_id: 't1',
      title: 'Eiffel Tower visit',
      type: 'event',
      starts_at: '2024-06-01T10:00:00Z',
      ends_at: '2024-06-01T12:00:00Z',
      notes: 'Bring camera',
      created_by: 'u1',
    })
  })

  it('sets ends_at to null when not provided', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
    const builder = makeQueryBuilder({ data: event, error: null })
    from.mockReturnValue(builder)

    await createEvent({ ...input, endsAt: undefined })
    expect(builder.insert).toHaveBeenCalledWith(expect.objectContaining({ ends_at: null }))
  })

  it('sets notes to null when empty', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
    const builder = makeQueryBuilder({ data: event, error: null })
    from.mockReturnValue(builder)

    await createEvent({ ...input, notes: '' })
    expect(builder.insert).toHaveBeenCalledWith(expect.objectContaining({ notes: null }))
  })

  it('rejects when there is no session', async () => {
    getSession.mockResolvedValue({ data: { session: null } })

    await expect(createEvent(input)).rejects.toThrow('signed in')
    expect(from).not.toHaveBeenCalled()
  })

  it('throws when the insert errors', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
    from.mockReturnValue(makeQueryBuilder({ data: null, error: makePostgrestError('insert fail') }))

    await expect(createEvent(input)).rejects.toThrow('insert fail')
  })
})
