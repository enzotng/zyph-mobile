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
  // Lenient where the model output commonly varies, so one odd field never sinks an
  // otherwise valid event: unknown type -> 'event', non-int price -> null, and
  // confidence is coerced (accepts a 0-100 scale) and clamped to 0-1.
  type: z.enum(EVENT_TYPES).catch('event'),
  title: z.string().nullable(),
  startsAt: z.string().nullable(),
  endsAt: z.string().nullable(),
  location: parsedLocationSchema,
  gateLocation: parsedGateSchema,
  notes: z.string().nullable(),
  currency: z.string().nullable(),
  priceCents: z.number().int().nullable().catch(null),
  confidence: z
    .number()
    .catch(0)
    .transform((n) => Math.min(1, Math.max(0, n > 1 ? n / 100 : n))),
})

export type ParsedEmailEvent = z.infer<typeof parsedEmailEventSchema>
