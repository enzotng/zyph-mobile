import { useQuery } from '@tanstack/react-query'

import { searchPois } from '../api/poi.api'
import type { PoiSearchInput } from '../poi.types'

export const poisQueryKey = ['pois'] as const

// Pass null to disable. Enabled only with finite coords and at least one type.
export function usePois(input: PoiSearchInput | null) {
  return useQuery({
    queryKey: [
      ...poisQueryKey,
      input?.lat,
      input?.lng,
      input?.includedTypes,
      input?.max,
      input?.languageCode,
    ],
    queryFn: () => searchPois(input as PoiSearchInput),
    enabled:
      input != null &&
      Number.isFinite(input.lat) &&
      Number.isFinite(input.lng) &&
      input.includedTypes.length > 0,
  })
}
