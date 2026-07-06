import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { eventsQueryKey, type NewItineraryEvent } from '@/features/timeline'

import { getProposals, rejectProposal, validateProposal } from '../api/inbox.api'

export function proposalsQueryKey(tripId: string) {
  return ['import-proposals', tripId] as const
}

export function useProposals(tripId: string) {
  return useQuery({
    queryKey: proposalsQueryKey(tripId),
    queryFn: () => getProposals(tripId),
    enabled: Boolean(tripId),
  })
}

export function useValidateProposal(tripId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ proposalId, events }: { proposalId: string; events: NewItineraryEvent[] }) =>
      validateProposal(proposalId, events),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: proposalsQueryKey(tripId) })
      // The validated events now live on the shared timeline - refresh it too.
      void queryClient.invalidateQueries({ queryKey: eventsQueryKey(tripId) })
    },
  })
}

export function useRejectProposal(tripId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: rejectProposal,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: proposalsQueryKey(tripId) })
    },
  })
}
