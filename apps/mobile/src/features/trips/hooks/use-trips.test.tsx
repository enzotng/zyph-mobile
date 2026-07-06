import { renderHook, waitFor } from '@testing-library/react-native'

import { createQueryWrapper } from '@/test-utils/query-wrapper'
import * as api from '../api/trips.api'
import {
  tripInboxAddressQueryKey,
  tripsQueryKey,
  useCreateCalendarFeedToken,
  useCreateTrip,
  useCreateTripInboxAddress,
  useDeleteTrip,
  useRevokeTripInboxAddress,
  useSetTripInboxAutoValidate,
  useTrip,
  useTripInboxAddress,
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

describe('useCreateCalendarFeedToken', () => {
  it('resolves with the raw token and invalidates nothing (tokens are never cached)', async () => {
    const token = 'a'.repeat(64)
    jest.mocked(api.createCalendarFeedToken).mockResolvedValue(token)
    const { wrapper, queryClient } = createQueryWrapper()
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useCreateCalendarFeedToken(), { wrapper })
    result.current.mutate('t1')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBe(token)
    // TanStack Query 5 calls mutationFn(variables, context) - assert on the variable only.
    expect(jest.mocked(api.createCalendarFeedToken).mock.calls[0]?.[0]).toBe('t1')
    expect(invalidate).not.toHaveBeenCalled()
  })
})

const inboxAddress = { address: 'roadtrip-test-a1b2c3@zyph.enzotang.fr', autoValidate: false }

describe('useTripInboxAddress', () => {
  it('is disabled without a trip id', () => {
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useTripInboxAddress(''), { wrapper })

    expect(result.current.fetchStatus).toBe('idle')
    expect(api.getTripInboxAddress).not.toHaveBeenCalled()
  })

  it('fetches the cached address for a trip', async () => {
    jest.mocked(api.getTripInboxAddress).mockResolvedValue(inboxAddress)
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useTripInboxAddress('t1'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(inboxAddress)
  })
})

describe('useCreateTripInboxAddress', () => {
  it('invalidates the address query for the mutated trip on success', async () => {
    jest.mocked(api.createTripInboxAddress).mockResolvedValue(inboxAddress.address)
    const { wrapper, queryClient } = createQueryWrapper()
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useCreateTripInboxAddress(), { wrapper })
    result.current.mutate('t1')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invalidate).toHaveBeenCalledWith({ queryKey: tripInboxAddressQueryKey('t1') })
  })
})

describe('useRevokeTripInboxAddress', () => {
  it('invalidates the address query for the mutated trip on success', async () => {
    jest.mocked(api.revokeTripInboxAddress).mockResolvedValue(undefined)
    const { wrapper, queryClient } = createQueryWrapper()
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useRevokeTripInboxAddress(), { wrapper })
    result.current.mutate('t1')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invalidate).toHaveBeenCalledWith({ queryKey: tripInboxAddressQueryKey('t1') })
  })
})

describe('useSetTripInboxAutoValidate', () => {
  it('calls the api with the trip id and flag, invalidating the address query on success', async () => {
    jest.mocked(api.setTripInboxAutoValidate).mockResolvedValue(undefined)
    const { wrapper, queryClient } = createQueryWrapper()
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useSetTripInboxAutoValidate(), { wrapper })
    result.current.mutate({ tripId: 't1', on: true })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api.setTripInboxAutoValidate).toHaveBeenCalledWith('t1', true)
    expect(invalidate).toHaveBeenCalledWith({ queryKey: tripInboxAddressQueryKey('t1') })
  })
})
