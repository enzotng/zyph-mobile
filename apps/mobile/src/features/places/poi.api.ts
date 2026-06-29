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
