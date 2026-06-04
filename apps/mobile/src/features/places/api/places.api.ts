import { supabase } from '@/lib/supabase'

import { type PlaceResult, placeSearchResponseSchema } from '../schemas'

// Type-ahead address search via the place-search edge function (OSM Photon proxy).
export async function searchPlaces(query: string, language: 'en' | 'fr'): Promise<PlaceResult[]> {
  const { data, error } = await supabase.functions.invoke('place-search', {
    body: { query, language },
  })
  if (error) {
    throw error
  }
  if (!data) {
    return []
  }
  // Validate at the boundary before the suggestions reach the UI.
  return placeSearchResponseSchema.parse(data).results
}
