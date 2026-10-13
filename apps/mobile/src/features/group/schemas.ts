import { z } from 'zod'

export const joinTripSchema = z.object({
  code: z.string().trim().min(1, 'Enter an invite code'),
})

export type JoinTripValues = z.infer<typeof joinTripSchema>

// get_trip_claim_options returns jsonb, so its generated type is Json and tsc has nothing to check
// behind it: this parse IS the type boundary. Strict on purpose - a payload that does not match is
// a backend contract break, not something to degrade into a half-filled object.
export const claimOptionsSchema = z.object({
  tripId: z.uuid(),
  tripTitle: z.string(),
  myStatus: z.enum(['invited', 'active', 'removed']).nullable(),
  slots: z.array(z.object({ slotId: z.uuid(), slotName: z.string().nullable() })),
})

// How get_trip_claim_options answers an unknown code: a value, not a raise, because a raise would
// roll back the attempt the lookup just cost.
export const unknownInviteCodeSchema = z.object({ error: z.literal('invalid_code') })

export type ClaimOptions = z.infer<typeof claimOptionsSchema>
export type ClaimOption = ClaimOptions['slots'][number]
