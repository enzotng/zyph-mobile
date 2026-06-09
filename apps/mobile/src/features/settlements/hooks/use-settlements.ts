import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { listSettlements, recordSettlement, reverseSettlement } from '../api/settlements.api'

export function settlementsQueryKey(tripId: string) {
  return ['trips', tripId, 'settlements'] as const
}

export function useSettlements(tripId: string) {
  return useQuery({
    queryKey: settlementsQueryKey(tripId),
    queryFn: () => listSettlements(tripId),
    enabled: Boolean(tripId),
  })
}

// Recording a settlement changes who owes whom, so it must refresh both the settlements
// list and the balances - the same ['trips', tripId, 'balances'] key the expense mutations
// invalidate (kept as a literal to avoid a cross-feature import cycle).
export function useRecordSettlement(tripId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: recordSettlement,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: settlementsQueryKey(tripId) })
      void queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'balances'] })
      // Refresh the trips-list card balance (get_my_trip_balances), keyed exactly ['trips'].
      void queryClient.invalidateQueries({ queryKey: ['trips'], exact: true })
    },
  })
}

// Voiding a settlement re-credits the balances, so it invalidates the same keys as recording.
export function useReverseSettlement(tripId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => reverseSettlement(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: settlementsQueryKey(tripId) })
      void queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'balances'] })
      void queryClient.invalidateQueries({ queryKey: ['trips'], exact: true })
    },
  })
}
