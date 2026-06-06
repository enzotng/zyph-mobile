import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  addPackingItem,
  addPackingItems,
  deletePackingItem,
  generatePackingSuggestions,
  listPackingItems,
  type NewPackingItem,
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

export type SuggestPackingVars = {
  destination: string
  days: number | null
  weather: string
  language: string
  activities: string
  hint?: string
  mode: 'generate' | 'gaps'
  existing: { label: string }[]
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
