import { useQuery } from '@tanstack/react-query'

import { resolvePoiPhoto } from '../api/poi.api'

// maxWidthPx is part of BOTH this query key AND the resolved Google photo URI, so every caller for
// a given photoName MUST share a single width - a second width forks the cache and triggers a
// redundant edge fetch (and a different image URL) for the same photo. Keep the tuple stable: it
// is persisted to MMKV, so changing its shape needs a query-cache buster bump.
export function poiPhotoQueryKey(photoName: string | null, maxWidthPx: number) {
  return ['poi-photo', photoName, maxWidthPx] as const
}

// Resolves a Google Places photoName to a keyless embeddable URL.
// Pass null to disable (e.g. when the POI has no photo).
// Photos are stable for days; staleTime is set to 24 h to avoid redundant edge calls.
export function usePoiPhoto(photoName: string | null, maxWidthPx = 800) {
  return useQuery({
    queryKey: poiPhotoQueryKey(photoName, maxWidthPx),
    queryFn: () => resolvePoiPhoto(photoName as string, maxWidthPx),
    enabled: Boolean(photoName),
    staleTime: 1000 * 60 * 60 * 24,
  })
}
