import { z } from 'zod'

export const createEventSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(120),
  startsAt: z.string().min(1, 'Pick a date'),
  notes: z.string().trim().max(500),
})

export type CreateEventValues = z.infer<typeof createEventSchema>
