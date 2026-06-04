import type { Database } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'

export type TripSettlement = Database['public']['Tables']['trip_settlements']['Row']

export type RecordSettlementInput = {
  tripId: string
  fromMemberId: string
  toMemberId: string
  amountCents: number
}

// Records an off-app payment between two members. The RPC (SECURITY DEFINER) enforces
// active membership, a positive amount, distinct members, and that both belong to the trip.
// The stored currency is the trip currency, derived server-side (never trusted from here).
export async function recordSettlement({
  tripId,
  fromMemberId,
  toMemberId,
  amountCents,
}: RecordSettlementInput): Promise<TripSettlement> {
  const { data, error } = await supabase.rpc('record_settlement', {
    _trip_id: tripId,
    _from_member: fromMemberId,
    _to_member: toMemberId,
    _amount_cents: amountCents,
  })
  if (error) {
    throw error
  }
  return data
}

export async function listSettlements(tripId: string): Promise<TripSettlement[]> {
  const { data, error } = await supabase
    .from('trip_settlements')
    .select('*')
    .eq('trip_id', tripId)
    .eq('status', 'active')
    .order('paid_at', { ascending: false })
  if (error) {
    throw error
  }
  return data
}
