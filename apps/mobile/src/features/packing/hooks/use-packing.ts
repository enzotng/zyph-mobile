import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  balancesQueryKey,
  expenseSharesQueryKey,
  expensesQueryKey,
} from '@/features/expenses/hooks/use-expenses'

import {
  addPackingItem,
  addPackingItems,
  assignPackingItem,
  claimPackingItem,
  deletePackingItem,
  deletePackingItems,
  expensePackingItem,
  generatePackingSuggestions,
  listPackingItems,
  type NewPackingItem,
  nudgePackingItem,
  type PackingItemPatch,
  updatePackingItem,
} from '../api/packing.api'
import { dedupeSuggestions, type SuggestedItem } from '../schemas'

export function packingQueryKey(tripId: string) {
  return ['trips', tripId, 'packing'] as const
}

export function usePackingItems(tripId: string) {
  return useQuery({
    queryKey: packingQueryKey(tripId),
    queryFn: () => listPackingItems(tripId),
    enabled: Boolean(tripId),
  })
}

export function useAddPackingItem(tripId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (item: NewPackingItem) => addPackingItem(item),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: packingQueryKey(tripId) })
    },
  })
}

export function useUpdatePackingItem(tripId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: PackingItemPatch }) =>
      updatePackingItem(id, patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: packingQueryKey(tripId) })
    },
  })
}

export function useDeletePackingItem(tripId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deletePackingItem(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: packingQueryKey(tripId) })
    },
  })
}

// Bulk-deletes a set of items (the "undo all" of a Zo batch).
export function useDeletePackingItems(tripId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) => deletePackingItems(ids),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: packingQueryKey(tripId) })
    },
  })
}

// Splits a shared item's cost as a trip expense. Refreshes packing (paid badge), expenses and
// balances, since the RPC touches all three.
export function useExpensePackingItem(tripId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      itemId,
      amountCents,
      memberIds,
    }: {
      itemId: string
      amountCents: number
      memberIds: string[]
    }) => expensePackingItem(itemId, amountCents, memberIds),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: packingQueryKey(tripId) })
      void queryClient.invalidateQueries({ queryKey: expensesQueryKey(tripId) })
      void queryClient.invalidateQueries({ queryKey: balancesQueryKey(tripId) })
      // The new split is also one of "my shares" in the feed - refresh it like the expense mutations.
      void queryClient.invalidateQueries({ queryKey: expenseSharesQueryKey(tripId) })
      // And the trips-list card balance (get_my_trip_balances), keyed exactly ['trips'].
      void queryClient.invalidateQueries({ queryKey: ['trips'], exact: true })
    },
  })
}

// Assigns/unassigns a shared item to a member (notifies the assignee via the RPC).
export function useAssignPackingItem(tripId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ itemId, memberId }: { itemId: string; memberId: string | null }) =>
      assignPackingItem(itemId, memberId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: packingQueryKey(tripId) })
    },
  })
}

// Self-assigns a shared item to the current user's member.
export function useClaimPackingItem(tripId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (itemId: string) => claimPackingItem(itemId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: packingQueryKey(tripId) })
    },
  })
}

// Pings the item's assignee. No cache invalidation - it changes no packing row.
export function useNudgePackingItem() {
  return useMutation({
    mutationFn: (itemId: string) => nudgePackingItem(itemId),
  })
}

export type SuggestPackingVars = {
  destination: string
  days: number | null
  weather: string
  language: string
  activities: string
  hint?: string
  mode: 'generate' | 'gaps'
  existing: { label: string }[]
  travelers?: number
  shared?: boolean
  packLight?: boolean
}

// Asks the Edge Function for suggestions and drops anything already on the list. Does NOT
// insert - the screen previews the result so the user picks what to add.
export function useSuggestPacking() {
  return useMutation({
    mutationFn: async (vars: SuggestPackingVars): Promise<SuggestedItem[]> => {
      const suggestions = await generatePackingSuggestions({
        destination: vars.destination,
        days: vars.days,
        weather: vars.weather,
        language: vars.language,
        activities: vars.activities,
        hint: vars.hint,
        mode: vars.mode,
        existing: vars.existing.map((i) => i.label),
        travelers: vars.travelers,
        shared: vars.shared,
        packLight: vars.packLight,
      })
      return dedupeSuggestions(vars.existing, suggestions)
    },
  })
}

// Bulk-adds the items the user confirmed from a suggestion preview.
export function useAddPackingItems(tripId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (items: NewPackingItem[]) => addPackingItems(items),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: packingQueryKey(tripId) })
    },
  })
}
