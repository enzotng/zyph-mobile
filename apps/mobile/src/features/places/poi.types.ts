import type { z } from 'zod'

import type { poiSchema } from './poi.schemas'

// Canonical POI shape, derived from poiSchema so the runtime validator and the type never drift.
// Field docs live on poiSchema; the source contract is normalizeGooglePlace in
// supabase/functions/_shared/google-places.ts.
export type Poi = z.infer<typeof poiSchema>

export type PoiSearchInput = {
  lat: number
  lng: number
  includedTypes: string[]
  max?: number
  languageCode?: string
}
