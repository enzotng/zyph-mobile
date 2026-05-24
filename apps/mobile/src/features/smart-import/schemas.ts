import { z } from 'zod'

// Matches the JSON contract enforced server-side by the parse-receipt-email Edge
// Function. We re-validate on the client so a hallucinated payload never reaches
// the UI in an inconsistent shape.

export const EVENT_TYPES = ['flight', 'hotel', 'transport', 'activity', 'event'] as const
export type ParsedEventType = (typeof EVENT_TYPES)[number]

export const parsedLocationSchema = z
  .object({
    name: z.string(),
    lat: z.number().nullable(),
    lng: z.number().nullable(),
  })
  .nullable()

export const parsedGateSchema = z
  .object({
    label: z.string(),
    lat: z.number().nullable(),
    lng: z.number().nullable(),
  })
  .nullable()

export const parsedEmailEventSchema = z.object({
  type: z.enum(EVENT_TYPES),
  title: z.string().nullable(),
  startsAt: z.string().nullable(),
  endsAt: z.string().nullable(),
  location: parsedLocationSchema,
  gateLocation: parsedGateSchema,
  notes: z.string().nullable(),
  currency: z.string().nullable(),
  priceCents: z.number().int().nullable(),
  confidence: z.number().min(0).max(1),
})

export type ParsedEmailEvent = z.infer<typeof parsedEmailEventSchema>
