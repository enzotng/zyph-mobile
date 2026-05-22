import { z } from 'zod'

export const joinTripSchema = z.object({
  code: z.string().trim().min(1, 'Enter an invite code'),
})

export type JoinTripValues = z.infer<typeof joinTripSchema>
