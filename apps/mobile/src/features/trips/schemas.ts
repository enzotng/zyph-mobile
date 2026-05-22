import { z } from 'zod'

// No zod .default() here: the form supplies defaults via defaultValues, which keeps
// the schema input/output types identical (avoids the react-hook-form resolver mismatch).
export const createTripSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(120),
  destination: z.string().trim().max(120),
  currency: z.string().trim().length(3, 'Use a 3-letter code'),
})

export type CreateTripValues = z.infer<typeof createTripSchema>
