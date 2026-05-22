import { z } from 'zod'

export const createEventSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(120),
    startsAt: z.string().min(1, 'Pick a date'),
    // Empty string means "no end time" (point event).
    endsAt: z.string(),
    notes: z.string().trim().max(500),
    // Optional map location, set via the picker (not a text field).
    lat: z.number().optional(),
    lng: z.number().optional(),
  })
  .refine((v) => !v.endsAt || new Date(v.endsAt) >= new Date(v.startsAt), {
    message: 'End must be after start',
    path: ['endsAt'],
  })

export type CreateEventValues = z.infer<typeof createEventSchema>
