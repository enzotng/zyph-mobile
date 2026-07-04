import { z } from 'zod'

// Runtime contract for a POI at the client boundary. Mirrors the shape emitted by
// supabase/functions/_shared/google-places.ts (normalizeGooglePlace): the server always emits
// every key, with nullable fields set to null (never undefined). Validating here drops corrupt
// items - e.g. a stale cached poi-search payload from an older schema - instead of crashing the
// rail. Poi's type is derived from this schema (see poi.types.ts) so the two never drift.
export const poiSchema = z.object({
  placeId: z.string().min(1),
  name: z.string().min(1),
  lat: z.number(),
  lng: z.number(),
  rating: z.number().nullable(), // 0..5
  ratingCount: z.number().nullable(),
  priceLevel: z.number().nullable(), // 0..4, null if unspecified
  types: z.array(z.string()),
  photoName: z.string().nullable(), // Google photo resource name "places/X/photos/Y"
  address: z.string().nullable(),
  openNow: z.boolean().nullable(),
  description: z.string().nullable(), // editorialSummary.text, localized
  typeLabel: z.string().nullable(), // primaryTypeDisplayName.text, localized
  priceStart: z.number().nullable(), // priceRange.startPrice.units
  priceEnd: z.number().nullable(), // priceRange.endPrice.units
  priceCurrency: z.string().nullable(), // priceRange.startPrice.currencyCode
  weekdayHours: z.array(z.string()).nullable(), // 7 localized weekday hour lines
})

// The poi-search envelope. Items are validated one-by-one against poiSchema by the caller (a
// single corrupt item must not drop the whole rail), so the envelope only asserts `pois` is an
// array.
export const poiSearchResponseSchema = z.object({
  pois: z.array(z.unknown()),
})

// The poi-photo envelope: a resolved keyless URL, or null when the provider had no photo.
export const poiPhotoResponseSchema = z.object({
  photoUri: z.string().nullable(),
})
