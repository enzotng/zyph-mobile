import { supabase } from '@/lib/supabase'
import { makePostgrestError, makeQueryBuilder } from '@/test-utils/supabase-mock'

import {
  createEvent,
  createEvents,
  deleteEvent,
  getEvent,
  listEvents,
  updateEvent,
} from './timeline.api'

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
      lat: null,
      lng: null,
      gate_location: null,
      created_by: 'u1',
    })
  })

  it('passes through coordinates when provided', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
    const builder = makeQueryBuilder({ data: event, error: null })
    from.mockReturnValue(builder)

    await createEvent({ ...input, lat: 48.8584, lng: 2.2945 })
    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ lat: 48.8584, lng: 2.2945 }),
    )
  })

  it('persists the chosen type, defaulting to event', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
    const builder = makeQueryBuilder({ data: event, error: null })
    from.mockReturnValue(builder)

    await createEvent({ ...input, type: 'flight' })
    expect(builder.insert).toHaveBeenCalledWith(expect.objectContaining({ type: 'flight' }))

    await createEvent(input)
    expect(builder.insert).toHaveBeenCalledWith(expect.objectContaining({ type: 'event' }))
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

describe('updateEvent', () => {
  const input = {
    eventId: 'ev1',
    title: 'Updated title',
    startsAt: '2024-06-01T10:00:00Z',
    endsAt: '2024-06-01T12:00:00Z',
    notes: 'Updated notes',
  }

  it('updates event fields and returns the updated row', async () => {
    const builder = makeQueryBuilder({ data: event, error: null })
    from.mockReturnValue(builder)

    await expect(updateEvent(input)).resolves.toEqual(event)
    expect(builder.update).toHaveBeenCalledWith({
      title: 'Updated title',
      starts_at: '2024-06-01T10:00:00Z',
      ends_at: '2024-06-01T12:00:00Z',
      notes: 'Updated notes',
      lat: null,
      lng: null,
      gate_location: null,
    })
    expect(builder.eq).toHaveBeenCalledWith('id', 'ev1')
  })

  it('passes through coordinates when provided', async () => {
    const builder = makeQueryBuilder({ data: event, error: null })
    from.mockReturnValue(builder)

    await updateEvent({ ...input, lat: 48.8584, lng: 2.2945 })
    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({ lat: 48.8584, lng: 2.2945 }),
    )
  })

  it('updates the type when provided, and leaves it untouched when omitted', async () => {
    const builder = makeQueryBuilder({ data: event, error: null })
    from.mockReturnValue(builder)

    await updateEvent({ ...input, type: 'lodging' })
    expect(builder.update).toHaveBeenCalledWith(expect.objectContaining({ type: 'lodging' }))

    await updateEvent(input)
    expect(builder.update).toHaveBeenCalledWith(
      expect.not.objectContaining({ type: expect.anything() }),
    )
  })

  it('sets nullable fields to null when empty', async () => {
    const builder = makeQueryBuilder({ data: event, error: null })
    from.mockReturnValue(builder)

    await updateEvent({ ...input, endsAt: undefined, notes: '' })
    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({ ends_at: null, notes: null }),
    )
  })

  it('throws when the update errors', async () => {
    from.mockReturnValue(makeQueryBuilder({ data: null, error: makePostgrestError('update fail') }))

    await expect(updateEvent(input)).rejects.toThrow('update fail')
  })
})

describe('createEvents', () => {
  const e1 = {
    title: 'Eiffel Tower',
    type: 'activity',
    startsAt: '2024-06-01T10:00:00Z',
    lat: 48.8584,
    lng: 2.2945,
    placeId: 'place1',
    notes: 'Great view',
  }
  const e2 = {
    title: 'Louvre',
    type: 'activity',
    startsAt: '2024-06-01T14:00:00Z',
    lat: 48.8606,
    lng: 2.3376,
    placeId: null,
  }
  const row1 = {
    trip_id: 't1',
    title: 'Eiffel Tower',
    type: 'activity',
    starts_at: '2024-06-01T10:00:00Z',
    ends_at: null,
    notes: 'Great view',
    lat: 48.8584,
    lng: 2.2945,
    place_id: 'place1',
    created_by: 'u1',
  }
  const row2 = {
    trip_id: 't1',
    title: 'Louvre',
    type: 'activity',
    starts_at: '2024-06-01T14:00:00Z',
    ends_at: null,
    notes: null,
    lat: 48.8606,
    lng: 2.3376,
    place_id: null,
    created_by: 'u1',
  }

  it('inserts a batch of events and returns the inserted rows', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
    const returned = [
      { ...event, title: 'Eiffel Tower' },
      { ...event, id: 'ev2', title: 'Louvre' },
    ]
    const builder = makeQueryBuilder({ data: returned, error: null })
    from.mockReturnValue(builder)

    await expect(createEvents('t1', [e1, e2])).resolves.toEqual(returned)
    expect(from).toHaveBeenCalledWith('trip_events')
    expect(builder.insert).toHaveBeenCalledWith([row1, row2])
    expect(builder.select).toHaveBeenCalled()
  })

  it('returns [] and does not call supabase.from when events array is empty', async () => {
    await expect(createEvents('t1', [])).resolves.toEqual([])
    expect(from).not.toHaveBeenCalled()
  })

  it('throws when the insert returns an error', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
    from.mockReturnValue(makeQueryBuilder({ data: null, error: makePostgrestError('batch fail') }))

    await expect(createEvents('t1', [e1])).rejects.toThrow('batch fail')
  })
})

describe('deleteEvent', () => {
  it('deletes the event by id', async () => {
    const builder = makeQueryBuilder({ data: null, error: null })
    from.mockReturnValue(builder)

    await expect(deleteEvent('ev1')).resolves.toBeUndefined()
    expect(from).toHaveBeenCalledWith('trip_events')
    expect(builder.delete).toHaveBeenCalled()
    expect(builder.eq).toHaveBeenCalledWith('id', 'ev1')
  })

  it('throws on error', async () => {
    from.mockReturnValue(makeQueryBuilder({ data: null, error: makePostgrestError('delete fail') }))

    await expect(deleteEvent('ev1')).rejects.toThrow('delete fail')
  })
})
