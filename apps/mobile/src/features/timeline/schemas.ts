import { z } from 'zod'

export const gateLocationSchema = z.object({
  label: z.string().trim().min(1).max(40),
  lat: z.number(),
  lng: z.number(),
})

export type GateLocationValues = z.infer<typeof gateLocationSchema>

export const createEventSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(120),
    // Event type (see EVENT_TYPES). The form defaults it and the picker constrains the
    // choices; kept as a plain string so legacy/Smart-Import values never fail validation.
    type: z.string().min(1),
    startsAt: z.string().min(1, 'Pick a date'),
    // Empty string means "no end time" (point event).
    endsAt: z.string(),
    notes: z.string().trim().max(500),
    // Optional map location, set via the picker (not a text field).
    lat: z.number().optional(),
    lng: z.number().optional(),
    // Optional precise gate / destination override (for AR wayfinder).
    gateLocation: gateLocationSchema.nullable().optional(),
  })
  .refine((v) => !v.endsAt || new Date(v.endsAt) >= new Date(v.startsAt), {
    message: 'End must be after start',
    path: ['endsAt'],
  })

export type CreateEventValues = z.infer<typeof createEventSchema>
