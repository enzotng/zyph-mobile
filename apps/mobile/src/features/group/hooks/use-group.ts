import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { joinTripByCode, listTripMembers } from '../api/group.api'

export function tripMembersQueryKey(tripId: string) {
  return ['trips', tripId, 'members'] as const
}

export function useTripMembers(tripId: string) {
  return useQuery({
    queryKey: tripMembersQueryKey(tripId),
    queryFn: () => listTripMembers(tripId),
    enabled: Boolean(tripId),
  })
}

export function useJoinTrip() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: joinTripByCode,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['trips'] })
    },
  })
}
