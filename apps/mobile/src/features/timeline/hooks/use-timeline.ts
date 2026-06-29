import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { NewItineraryEvent } from '../api/timeline.api'
import {
  createEvent,
  createEvents,
  deleteEvent,
  getEvent,
  listEvents,
  updateEvent,
} from '../api/timeline.api'

export function eventsQueryKey(tripId: string) {
  return ['trips', tripId, 'events'] as const
}

export function eventQueryKey(eventId: string) {
  return ['events', eventId] as const
}

export function useEvents(tripId: string) {
  return useQuery({
    queryKey: eventsQueryKey(tripId),
    queryFn: () => listEvents(tripId),
    enabled: Boolean(tripId),
  })
}

export function useEvent(eventId: string) {
  return useQuery({
    queryKey: eventQueryKey(eventId),
    queryFn: () => getEvent(eventId),
    enabled: Boolean(eventId),
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

export function useCreateEvents() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ tripId, events }: { tripId: string; events: NewItineraryEvent[] }) =>
      createEvents(tripId, events),
    onSuccess: (_data, { tripId }) => {
      void queryClient.invalidateQueries({ queryKey: eventsQueryKey(tripId) })
    },
  })
}

export function useUpdateEvent(tripId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateEvent,
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: eventsQueryKey(tripId) })
      void queryClient.invalidateQueries({ queryKey: eventQueryKey(updated.id) })
    },
  })
}

export function useDeleteEvent(tripId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteEvent,
    onSuccess: (_data, eventId) => {
      void queryClient.invalidateQueries({ queryKey: eventsQueryKey(tripId) })
      queryClient.removeQueries({ queryKey: eventQueryKey(eventId) })
    },
  })
}
