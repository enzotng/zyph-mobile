import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { createEvent, listEvents } from '../api/timeline.api'

export function eventsQueryKey(tripId: string) {
  return ['trips', tripId, 'events'] as const
}

export function useEvents(tripId: string) {
  return useQuery({
    queryKey: eventsQueryKey(tripId),
    queryFn: () => listEvents(tripId),
    enabled: Boolean(tripId),
  })
}

export function useCreateEvent(tripId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createEvent,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: eventsQueryKey(tripId) })
    },
  })
}
