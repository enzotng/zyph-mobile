import { z } from 'zod'

export const POI_ICONS = [
  'pin',
  'gate',
  'bag',
  'food',
  'wc',
  'cash',
  'taxi',
  'wifi',
  'star',
] as const

export type PoiIcon = (typeof POI_ICONS)[number]

export const poiSchema = z.object({
  label: z.string().trim().min(1, 'Label is required').max(80),
  icon: z.enum(POI_ICONS),
  lat: z.number(),
  lng: z.number(),
})

export type PoiValues = z.infer<typeof poiSchema>

export const gateLocationSchema = z
  .object({
    label: z.string().trim().min(1).max(40),
    lat: z.number(),
    lng: z.number(),
  })
  .nullable()

export type GateLocation = z.infer<typeof gateLocationSchema>
