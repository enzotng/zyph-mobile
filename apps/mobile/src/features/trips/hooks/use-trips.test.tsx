import { renderHook, waitFor } from '@testing-library/react-native'

import { createQueryWrapper } from '@/test-utils/query-wrapper'
import * as api from '../api/trips.api'
import {
  tripsQueryKey,
  useCreateTrip,
  useDeleteTrip,
  useTrip,
  useTrips,
  useUpdateTrip,
} from './use-trips'

// Mock the api layer (under test elsewhere) and the Supabase client it imports, so the
// real client is never instantiated (avoids open-handle warnings from AppState/auto-refresh).
jest.mock('@/lib/supabase')
jest.mock('../api/trips.api')

const trip = {
  id: 't1',
  owner_id: 'u1',
  title: 'Lisbon',
  destination: 'PT',
  currency: 'EUR',
  invite_code: 'ABC123',
  start_date: null,
  end_date: null,
  latitude: null,
  longitude: null,
  cover_photo_url: null,
  cover_photo_author: null,
  cover_photo_author_url: null,
  created_at: '2026-05-22T00:00:00Z',
  updated_at: '2026-05-22T00:00:00Z',
  trip_type: null,
  budget_level: null,
  budget_total_cents: null,
  pace: null,
  interests: [],
  dietary: [],
  members: [],
  myBalanceCents: 0,
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('useTrips', () => {
  it('fetches the trip list', async () => {
    jest.mocked(api.listTrips).mockResolvedValue([trip])
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useTrips(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([trip])
  })
})

describe('useTrip', () => {
  it('is disabled without an id', () => {
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useTrip(''), { wrapper })

    expect(result.current.fetchStatus).toBe('idle')
    expect(api.getTrip).not.toHaveBeenCalled()
  })

  it('fetches a trip when an id is provided', async () => {
    jest.mocked(api.getTrip).mockResolvedValue(trip)
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useTrip('t1'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(trip)
  })
})

describe('useCreateTrip', () => {
  it('invalidates the trips list on success', async () => {
    jest.mocked(api.createTrip).mockResolvedValue(trip)
    const { wrapper, queryClient } = createQueryWrapper()
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useCreateTrip(), { wrapper })
    result.current.mutate({
      title: 'Lisbon',
      destination: 'PT',
      currency: 'EUR',
      startDate: null,
      endDate: null,
      latitude: null,
      longitude: null,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invalidate).toHaveBeenCalledWith({ queryKey: tripsQueryKey })
  })
})

describe('useUpdateTrip', () => {
  it('invalidates list and the detail of the returned trip on success', async () => {
    // Response id (t1) differs from the mutate input id to prove the hook invalidates
    // the detail key from the server response, not from the input.
    jest.mocked(api.updateTrip).mockResolvedValue(trip)
    const { wrapper, queryClient } = createQueryWrapper()
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useUpdateTrip(), { wrapper })
    result.current.mutate({
      id: 'stale-input-id',
      title: 'Lisbon',
      destination: 'PT',
      currency: 'EUR',
      startDate: null,
      endDate: null,
      latitude: null,
      longitude: null,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invalidate).toHaveBeenCalledWith({ queryKey: tripsQueryKey, exact: true })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: [...tripsQueryKey, 't1'], exact: true })
  })
})

describe('useDeleteTrip', () => {
  it('invalidates the trips list on success', async () => {
    jest.mocked(api.deleteTrip).mockResolvedValue(undefined)
    const { wrapper, queryClient } = createQueryWrapper()
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useDeleteTrip(), { wrapper })
    result.current.mutate('t1')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invalidate).toHaveBeenCalledWith({ queryKey: tripsQueryKey })
  })
})
