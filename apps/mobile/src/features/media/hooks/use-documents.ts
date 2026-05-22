import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  deleteDocument,
  listEventDocuments,
  type TripDocument,
  uploadDocument,
} from '../api/media.api'

export function eventDocumentsQueryKey(eventId: string) {
  return ['events', eventId, 'documents'] as const
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
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: eventDocumentsQueryKey(eventId) })
    },
  })
}

export function useDeleteDocument(eventId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (doc: TripDocument) => deleteDocument(doc),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: eventDocumentsQueryKey(eventId) })
    },
  })
}
