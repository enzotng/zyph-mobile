import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  deleteDocument,
  listEventDocuments,
  listTripDocuments,
  type TripDocument,
  uploadDocument,
} from '../api/media.api'

export function eventDocumentsQueryKey(eventId: string) {
  return ['events', eventId, 'documents'] as const
}

export function tripDocumentsQueryKey(tripId: string) {
  return ['trips', tripId, 'documents'] as const
}

export function useEventDocuments(eventId: string) {
  return useQuery({
    queryKey: eventDocumentsQueryKey(eventId),
    queryFn: () => listEventDocuments(eventId),
    enabled: Boolean(eventId),
  })
}

export function useUploadDocument(eventId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: uploadDocument,
    onSuccess: (doc) => {
      void queryClient.invalidateQueries({ queryKey: eventDocumentsQueryKey(eventId) })
      // Keep the trip-level documents hub in sync with this event-level upload.
      void queryClient.invalidateQueries({ queryKey: tripDocumentsQueryKey(doc.trip_id) })
    },
  })
}

export function useDeleteDocument(eventId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (doc: TripDocument) => deleteDocument(doc),
    onSuccess: (_result, doc) => {
      void queryClient.invalidateQueries({ queryKey: eventDocumentsQueryKey(eventId) })
      // Keep the trip-level documents hub in sync so it cannot show a deleted ghost doc.
      void queryClient.invalidateQueries({ queryKey: tripDocumentsQueryKey(doc.trip_id) })
    },
  })
}

export function useTripDocuments(tripId: string) {
  return useQuery({
    queryKey: tripDocumentsQueryKey(tripId),
    queryFn: () => listTripDocuments(tripId),
    enabled: Boolean(tripId),
  })
}

export function useUploadTripDocument(tripId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: uploadDocument,
    onSuccess: (doc) => {
      void queryClient.invalidateQueries({ queryKey: tripDocumentsQueryKey(tripId) })
      // A doc attached to an event must also refresh that event's own list.
      if (doc.event_id) {
        void queryClient.invalidateQueries({ queryKey: eventDocumentsQueryKey(doc.event_id) })
      }
    },
  })
}

export function useDeleteTripDocument(tripId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (doc: TripDocument) => deleteDocument(doc),
    onSuccess: (_result, doc) => {
      void queryClient.invalidateQueries({ queryKey: tripDocumentsQueryKey(tripId) })
      if (doc.event_id) {
        void queryClient.invalidateQueries({ queryKey: eventDocumentsQueryKey(doc.event_id) })
      }
    },
  })
}
