import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { createTrip, getTrip, listTrips } from '../api/trips.api'

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
