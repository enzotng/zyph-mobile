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
  // Lenient on EVERY field the model output can vary on, so one odd field never sinks an
  // otherwise valid event: unknown type -> 'event', and any missing key (the 8B model
  // sometimes OMITS keys instead of emitting null despite the prompt), wrong-typed value
  // or malformed sub-object degrades to null. The edge function normalizes server-side;
  // this is the defense-in-depth layer. Confidence is coerced (accepts a 0-100 scale)
  // and clamped to 0-1.
  type: z.enum(EVENT_TYPES).catch('event'),
  title: z.string().nullable().catch(null),
  startsAt: z.string().nullable().catch(null),
  endsAt: z.string().nullable().catch(null),
  location: parsedLocationSchema.catch(null),
  gateLocation: parsedGateSchema.catch(null),
  // Arrival place for directional events (flights, transfers). Absent from older edge
  // responses - catch degrades to null, additive both ways.
  endLocation: parsedLocationSchema.catch(null),
  // Passenger/guest names as written in the booking email, for member matching (see
  // matchParticipants). Whole-array catch: a non-array or an array with a non-string item
  // degrades to [] rather than sinking the event - the edge already normalizes this shape.
  participants: z.array(z.string()).catch([]),
  notes: z.string().nullable().catch(null),
  currency: z.string().nullable().catch(null),
  priceCents: z.number().int().nullable().catch(null),
  confidence: z
    .number()
    .catch(0)
    .transform((n) => Math.min(1, Math.max(0, n > 1 ? n / 100 : n))),
})

export type ParsedEmailEvent = z.infer<typeof parsedEmailEventSchema>

// The parse-receipt-email envelope: a list of events (1..10 server-side). Items are validated
// one-by-one by the API caller so a single corrupt item never discards the whole list. The .max
// mirrors the edge cap as defense in depth - the batch size must not depend on the server alone.
export const parseEmailResponseSchema = z.object({
  events: z.array(z.unknown()).max(10),
})
