import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  clearMemberLocation,
  createPoi,
  deletePoi,
  getPoi,
  listMemberLocations,
  listPois,
  updatePoi,
  upsertMemberLocation,
} from '../api/wayfinder.api'

export function poisQueryKey(tripId: string) {
  return ['trips', tripId, 'pois'] as const
}

export function poiQueryKey(poiId: string) {
  return ['pois', poiId] as const
}

export function memberLocationsQueryKey(tripId: string) {
  return ['trips', tripId, 'member-locations'] as const
}

export function usePois(tripId: string) {
  return useQuery({
    queryKey: poisQueryKey(tripId),
    queryFn: () => listPois(tripId),
    enabled: Boolean(tripId),
  })
}

export function usePoi(poiId: string) {
  return useQuery({
    queryKey: poiQueryKey(poiId),
    queryFn: () => getPoi(poiId),
    enabled: Boolean(poiId),
  })
}

export function useCreatePoi(tripId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createPoi,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: poisQueryKey(tripId) })
    },
  })
}

export function useUpdatePoi(tripId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updatePoi,
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: poisQueryKey(tripId) })
      void queryClient.invalidateQueries({ queryKey: poiQueryKey(updated.id) })
    },
  })
}

export function useDeletePoi(tripId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deletePoi,
    onSuccess: (_data, poiId) => {
      void queryClient.invalidateQueries({ queryKey: poisQueryKey(tripId) })
      queryClient.removeQueries({ queryKey: poiQueryKey(poiId) })
    },
  })
}

export function useMemberLocations(tripId: string, enabled: boolean) {
  return useQuery({
    queryKey: memberLocationsQueryKey(tripId),
    queryFn: () => listMemberLocations(tripId),
    enabled: enabled && Boolean(tripId),
    staleTime: 3_500,
    refetchInterval: 4_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
  })
}

export function useUpsertMemberLocation() {
  return useMutation({ mutationFn: upsertMemberLocation })
}

export function useClearMemberLocation(tripId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => clearMemberLocation(tripId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: memberLocationsQueryKey(tripId) })
    },
  })
}
