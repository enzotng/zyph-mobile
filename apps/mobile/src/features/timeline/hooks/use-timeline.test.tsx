import { renderHook, waitFor } from '@testing-library/react-native'

import { createQueryWrapper } from '@/test-utils/query-wrapper'

import * as api from '../api/timeline.api'
import { eventQueryKey, eventsQueryKey, useCreateEvent, useEvent, useEvents } from './use-timeline'

jest.mock('@/lib/supabase')
jest.mock('../api/timeline.api')

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

describe('useEvents', () => {
  it('fetches the event list for a trip', async () => {
    jest.mocked(api.listEvents).mockResolvedValue([event])
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useEvents('t1'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([event])
  })

  it('is disabled when tripId is empty', () => {
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useEvents(''), { wrapper })

    expect(result.current.fetchStatus).toBe('idle')
    expect(api.listEvents).not.toHaveBeenCalled()
  })
})

describe('useEvent', () => {
  it('fetches a single event by id', async () => {
    jest.mocked(api.getEvent).mockResolvedValue(event)
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useEvent('ev1'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(event)
  })

  it('is disabled when eventId is empty', () => {
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useEvent(''), { wrapper })

    expect(result.current.fetchStatus).toBe('idle')
    expect(api.getEvent).not.toHaveBeenCalled()
  })
})

describe('useCreateEvent', () => {
  it('invalidates the events list on success', async () => {
    jest.mocked(api.createEvent).mockResolvedValue(event)
    const { wrapper, queryClient } = createQueryWrapper()
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useCreateEvent('t1'), { wrapper })
    result.current.mutate({
      tripId: 't1',
      title: 'Eiffel Tower visit',
      startsAt: '2024-06-01T10:00:00Z',
      notes: 'Bring camera',
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invalidate).toHaveBeenCalledWith({ queryKey: eventsQueryKey('t1') })
  })
})

describe('query key helpers', () => {
  it('eventsQueryKey returns the expected key', () => {
    expect(eventsQueryKey('t1')).toEqual(['trips', 't1', 'events'])
  })

  it('eventQueryKey returns the expected key', () => {
    expect(eventQueryKey('ev1')).toEqual(['events', 'ev1'])
  })
})
