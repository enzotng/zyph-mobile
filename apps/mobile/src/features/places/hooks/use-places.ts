import { useQuery } from '@tanstack/react-query'

import { searchPlaces } from '../api/places.api'

export function placeSearchQueryKey(query: string, language: string) {
  return ['place-search', language, query] as const
}

// Searches only once the query is meaningful (>= 3 chars); results cache for a minute so
// re-typing the same query is free. Callers pass an already-debounced query.
export function usePlaceSearch(query: string, language: 'en' | 'fr') {
  const trimmed = query.trim()
  return useQuery({
    queryKey: placeSearchQueryKey(trimmed, language),
    queryFn: () => searchPlaces(trimmed, language),
    enabled: trimmed.length >= 3,
    staleTime: 60_000,
  })
}
