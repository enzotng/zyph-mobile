import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  createCalendarFeedToken,
  createTrip,
  createTripInboxAddress,
  deleteTrip,
  getTrip,
  getTripInboxAddress,
  listTrips,
  resetTripCover,
  revokeTripInboxAddress,
  setTripInboxAutoValidate,
  updateTrip,
  updateTripPreferences,
  uploadTripCover,
} from '../api/trips.api'

export const tripsQueryKey = ['trips'] as const

export function useTrips() {
  return useQuery({ queryKey: tripsQueryKey, queryFn: listTrips })
}

export function useTrip(id: string) {
  return useQuery({
    queryKey: [...tripsQueryKey, id],
    queryFn: () => getTrip(id),
    enabled: Boolean(id),
  })
}

export function useCreateTrip() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createTrip,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: tripsQueryKey })
    },
  })
}

export function useUpdateTrip() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateTrip,
    onSuccess: (trip) => {
      void queryClient.invalidateQueries({ queryKey: tripsQueryKey, exact: true })
      void queryClient.invalidateQueries({ queryKey: [...tripsQueryKey, trip.id], exact: true })
    },
  })
}

export function useUpdateTripPreferences() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateTripPreferences,
    onSuccess: (trip) => {
      void queryClient.invalidateQueries({ queryKey: tripsQueryKey, exact: true })
      void queryClient.invalidateQueries({ queryKey: [...tripsQueryKey, trip.id], exact: true })
    },
  })
}

export function useDeleteTrip() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteTrip,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: tripsQueryKey })
    },
  })
}

export function useUploadTripCover() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      tripId,
      imageBase64,
      contentType,
    }: {
      tripId: string
      imageBase64: string
      contentType: string
    }) => uploadTripCover(tripId, imageBase64, contentType),
    onSuccess: (trip) => {
      void queryClient.invalidateQueries({ queryKey: tripsQueryKey, exact: true })
      void queryClient.invalidateQueries({ queryKey: [...tripsQueryKey, trip.id], exact: true })
    },
  })
}

export function useResetTripCover() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (tripId: string) => resetTripCover(tripId),
    onSuccess: (trip) => {
      void queryClient.invalidateQueries({ queryKey: tripsQueryKey, exact: true })
      void queryClient.invalidateQueries({ queryKey: [...tripsQueryKey, trip.id], exact: true })
    },
  })
}

// The raw token is never fetched/cached - it lives only in the mutation's own transient state
// (and the caller's component state), so there is no query key to invalidate.
export function useCreateCalendarFeedToken() {
  return useMutation({ mutationFn: createCalendarFeedToken })
}

// Unlike the calendar token, the inbox address is stable and re-displayable, so it is a real
// cached query (not fetched into transient component state on open).
export function tripInboxAddressQueryKey(tripId: string) {
  return ['trip-inbox-address', tripId] as const
}

export function useTripInboxAddress(tripId: string) {
  return useQuery({
    queryKey: tripInboxAddressQueryKey(tripId),
    queryFn: () => getTripInboxAddress(tripId),
    enabled: Boolean(tripId),
  })
}

export function useCreateTripInboxAddress() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createTripInboxAddress,
    onSuccess: (_address, tripId) => {
      void queryClient.invalidateQueries({ queryKey: tripInboxAddressQueryKey(tripId) })
    },
  })
}

export function useRevokeTripInboxAddress() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: revokeTripInboxAddress,
    onSuccess: (_void, tripId) => {
      void queryClient.invalidateQueries({ queryKey: tripInboxAddressQueryKey(tripId) })
    },
  })
}

export function useSetTripInboxAutoValidate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ tripId, on }: { tripId: string; on: boolean }) =>
      setTripInboxAutoValidate(tripId, on),
    onSuccess: (_void, { tripId }) => {
      void queryClient.invalidateQueries({ queryKey: tripInboxAddressQueryKey(tripId) })
    },
  })
}
