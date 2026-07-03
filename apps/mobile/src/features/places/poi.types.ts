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
  description: string | null // editorialSummary.text, localized
  typeLabel: string | null // primaryTypeDisplayName.text, localized
  priceStart: number | null // priceRange.startPrice.units
  priceEnd: number | null // priceRange.endPrice.units
  priceCurrency: string | null // priceRange.startPrice.currencyCode
  weekdayHours: string[] | null // 7 localized weekday hour lines
}

export type PoiSearchInput = {
  lat: number
  lng: number
  includedTypes: string[]
  max?: number
  languageCode?: string
}
