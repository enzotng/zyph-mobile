import { useQuery } from '@tanstack/react-query'

import { resolvePoiPhoto } from '../poi.api'

// Resolves a Google Places photoName to a keyless embeddable URL.
// Pass null to disable (e.g. when the POI has no photo).
// Photos are stable for days; staleTime is set to 24 h to avoid redundant edge calls.
export function usePoiPhoto(photoName: string | null, maxWidthPx = 800) {
  return useQuery({
    queryKey: ['poi-photo', photoName, maxWidthPx],
    queryFn: () => resolvePoiPhoto(photoName as string, maxWidthPx),
    enabled: Boolean(photoName),
    staleTime: 1000 * 60 * 60 * 24,
  })
}
