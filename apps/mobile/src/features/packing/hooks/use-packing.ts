import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  addPackingItem,
  addPackingItems,
  assignPackingItem,
  claimPackingItem,
  deletePackingItem,
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
