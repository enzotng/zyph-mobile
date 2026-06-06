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
import { dedupeSuggestions, type PackingCategory, type PackingScope } from '../schemas'

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

export type GeneratePackingVars = {
  scope: PackingScope
  ownerId: string
  destination: string
  days: number | null
  weather: string
  language: string
  existing: { label: string }[]
}

// Generates suggestions via the Edge Function, drops duplicates against the current list, and
// bulk-inserts the rest. Returns how many were actually added.
export function useGeneratePacking(tripId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (vars: GeneratePackingVars): Promise<number> => {
      const suggestions = await generatePackingSuggestions({
        destination: vars.destination,
        days: vars.days,
        weather: vars.weather,
        language: vars.language,
      })
      const fresh = dedupeSuggestions(vars.existing, suggestions)
      await addPackingItems(
        fresh.map((s) => ({
          tripId,
          scope: vars.scope,
          ownerId: vars.ownerId,
          label: s.label,
          category: s.category as PackingCategory,
          quantity: s.quantity,
        })),
      )
      return fresh.length
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: packingQueryKey(tripId) })
    },
  })
}
