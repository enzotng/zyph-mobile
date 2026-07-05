import { supabase } from '@/lib/supabase'

import { poiPhotoResponseSchema, poiSchema, poiSearchResponseSchema } from '../poi.schemas'
import type { Poi, PoiSearchInput } from '../poi.types'

// Calls the poi-search edge function. Degrades to [] on any error so a provider/network failure
// never throws into the UI (the itinerary generator treats "no candidates" gracefully). The
// response is validated at the boundary: the envelope is checked first, then each POI is validated
// individually so one corrupt item (e.g. a stale cached payload from an older schema) drops itself
// without nuking the whole rail - mirroring the server's normalize-and-drop flatMap.
export async function searchPois(input: PoiSearchInput): Promise<Poi[]> {
  const { data, error } = await supabase.functions.invoke<unknown>('poi-search', {
    body: input,
  })
  if (error) {
    return []
  }
  const envelope = poiSearchResponseSchema.safeParse(data)
  if (!envelope.success) {
    return []
  }
  return envelope.data.pois.flatMap((item) => {
    const poi = poiSchema.safeParse(item)
    return poi.success ? [poi.data] : []
  })
}

// Resolves a Google Places photo resource name (e.g. "places/.../photos/...") into a keyless,
// embeddable URL via the poi-photo edge function. The API key never reaches the client.
// Returns null on any provider or network error so callers can silently fall back to a placeholder.
export async function resolvePoiPhoto(photoName: string, maxWidthPx = 800): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke<unknown>('poi-photo', {
    body: { photoName, maxWidthPx },
  })
  if (error) {
    return null
  }
  const parsed = poiPhotoResponseSchema.safeParse(data)
  return parsed.success ? parsed.data.photoUri : null
}
