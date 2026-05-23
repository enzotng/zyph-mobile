import { z } from 'zod'

export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1, 'Name is required').max(80),
  preferredCurrency: z.string().trim().min(3, 'Pick a currency').max(3),
})

export type UpdateProfileValues = z.infer<typeof updateProfileSchema>
