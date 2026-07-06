import { z } from 'zod'

// Deep import rather than the feature barrel: the barrel also re-exports the (UI-heavy)
// EventPreviewCard, which this pure schema module has no business dragging in.
import { parsedEmailEventSchema } from '@/features/smart-import/schemas'

// Mirrors import_proposals.status/source (bare `string` columns server-side) - an unexpected
// value degrades to a safe default rather than sinking the whole row.
export const IMPORT_PROPOSAL_STATUSES = [
  'parsing',
  'pending',
  'validated',
  'rejected',
  'failed',
  'expired',
] as const
export type ImportProposalStatus = (typeof IMPORT_PROPOSAL_STATUSES)[number]

export const IMPORT_PROPOSAL_SOURCES = ['email', 'share'] as const
export type ImportProposalSource = (typeof IMPORT_PROPOSAL_SOURCES)[number]

export const importProposalSchema = z.object({
  id: z.string(),
  trip_id: z.string(),
  status: z.enum(IMPORT_PROPOSAL_STATUSES).catch('pending'),
  source: z.enum(IMPORT_PROPOSAL_SOURCES).catch('email'),
  sender_email: z.string().nullable(),
  subject: z.string().nullable(),
  // `events` is arbitrary Json server-side (the raw parse shape, nested location, participant
  // NAME strings) - reuses the same tolerant per-field schema the parse boundary validates
  // against. A malformed events blob degrades to null (the screen renders it as "nothing
  // extracted") rather than throwing.
  events: z.array(parsedEmailEventSchema).nullable().catch(null),
  received_at: z.string().nullable(),
  created_at: z.string(),
})

export type ImportProposal = z.infer<typeof importProposalSchema>
