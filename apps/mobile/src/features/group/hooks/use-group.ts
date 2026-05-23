import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  joinTripByCode,
  leaveTrip,
  listTripMembers,
  regenerateInviteCode,
  removeTripMember,
} from '../api/group.api'

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

export function useRegenerateInviteCode(tripId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => regenerateInviteCode(tripId),
    onSuccess: () => {
      // Refresh the cached trip so the new invite code is reflected immediately.
      void queryClient.invalidateQueries({ queryKey: ['trips', tripId], exact: true })
    },
  })
}

export function useLeaveTrip() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: leaveTrip,
    onSuccess: () => {
      // The trip is gone from the user's list and balances need a refresh anyway.
      void queryClient.invalidateQueries({ queryKey: ['trips'] })
    },
  })
}

export function useRemoveTripMember(tripId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: removeTripMember,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: tripMembersQueryKey(tripId) })
      void queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'balances'] })
    },
  })
}
