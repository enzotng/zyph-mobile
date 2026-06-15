import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  createTrip,
  deleteTrip,
  getTrip,
  listTrips,
  resetTripCover,
  updateTrip,
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
