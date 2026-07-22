import { z } from 'zod'

import { isValidCategory, isValidSubcategory } from '@/features/taxonomy'

export const gateLocationSchema = z.object({
  label: z.string().trim().min(1).max(40),
  lat: z.number(),
  lng: z.number(),
})

export type GateLocationValues = z.infer<typeof gateLocationSchema>

export const createEventSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(120),
    // Unified taxonomy: a root category and an optional dotted subcategory, both validated
    // against the closed set so a hallucinated code never reaches the write path. No
    // zod .default() here (see trips/schemas.ts): it would make the output type require the
    // field, breaking the react-hook-form resolver for callers that omit it - the API layer
    // (timeline.api.ts resolveCode) falls back to 'other' instead.
    category: z
      .string()
      .optional()
      .refine((v) => v === undefined || isValidCategory(v), 'Invalid category'),
    subcategory: z
      .string()
      .nullable()
      .optional()
      .refine((v) => v === undefined || v === null || isValidSubcategory(v), 'Invalid subcategory'),
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
  .refine((v) => !v.subcategory || (!!v.category && v.subcategory.startsWith(`${v.category}.`)), {
    message: 'Subcategory must belong to the category',
    path: ['subcategory'],
  })

export type CreateEventValues = z.infer<typeof createEventSchema>
