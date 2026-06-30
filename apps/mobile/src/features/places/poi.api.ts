import { supabase } from '@/lib/supabase'

import type { Poi, PoiSearchInput } from './poi.types'

// Calls the poi-search edge function. Degrades to [] on any error so a provider/network failure
// never throws into the UI (the itinerary generator treats "no candidates" gracefully).
export async function searchPois(input: PoiSearchInput): Promise<Poi[]> {
  const { data, error } = await supabase.functions.invoke<{ pois: Poi[] }>('poi-search', {
    body: input,
  })
  if (error || !data) {
    return []
  }
  return data.pois ?? []
}

// Resolves a Google Places photo resource name (e.g. "places/.../photos/...") into a keyless,
// embeddable URL via the poi-photo edge function. The API key never reaches the client.
// Returns null on any provider or network error so callers can silently fall back to a placeholder.
export async function resolvePoiPhoto(photoName: string, maxWidthPx = 800): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke<{ photoUri: string | null }>(
    'poi-photo',
    { body: { photoName, maxWidthPx } },
  )
  if (error || !data) {
    return null
  }
  return data.photoUri ?? null
}
