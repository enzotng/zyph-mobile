export type Poi = {
  placeId: string
  name: string
  lat: number
  lng: number
  rating: number | null
  ratingCount: number | null
  priceLevel: number | null // 0..4, null if unspecified
  types: string[]
  photoName: string | null // Google photo resource name; turned into a URL in a later phase
  address: string | null
  openNow: boolean | null
}

export type PoiSearchInput = { lat: number; lng: number; includedTypes: string[]; max?: number }
