import type { NewItineraryEvent } from '@/features/timeline'
import { supabase } from '@/lib/supabase'

import { type ImportProposal, importProposalSchema } from '../schemas'

// Newest first, so a freshly forwarded email always surfaces at the top. RLS already scopes this
// to proposals of trips the caller actively belongs to.
export async function getProposals(tripId: string): Promise<ImportProposal[]> {
  const { data, error } = await supabase
    .from('import_proposals')
    .select('*')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: false })
  if (error) {
    throw error
  }
  // Validate/parse tolerantly: a row that still fails after the schema's own per-field
  // .catch() fallbacks drops itself rather than sinking the whole list.
  return (data ?? []).flatMap((row) => {
    const parsed = importProposalSchema.safeParse(row)
    return parsed.success ? [parsed.data] : []
  })
}

// Confirms a proposal: `events` is the RESOLVED shape (matchParticipants + previewsToEvents
// already ran client-side, mirroring Smart Import's own confirm step) - the RPC inserts them
// into the shared timeline and marks the proposal validated in one transaction.
export async function validateProposal(
  proposalId: string,
  events: NewItineraryEvent[],
): Promise<void> {
  const { error } = await supabase.rpc('validate_import_proposal', {
    _proposal_id: proposalId,
    _events: events,
  })
  if (error) {
    throw error
  }
}

export async function rejectProposal(proposalId: string): Promise<void> {
  const { error } = await supabase.rpc('reject_import_proposal', { _proposal_id: proposalId })
  if (error) {
    throw error
  }
}
