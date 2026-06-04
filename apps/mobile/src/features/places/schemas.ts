import { z } from 'zod'

// One geocoded suggestion: a human label plus its coordinates.
export const placeResultSchema = z.object({
  label: z.string().min(1),
  lat: z.number(),
  lng: z.number(),
})

export const placeSearchResponseSchema = z.object({
  results: z.array(placeResultSchema),
})

export type PlaceResult = z.infer<typeof placeResultSchema>
