import type { Database } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'
import { type ClaimOptions, claimOptionsSchema } from '../schemas'

type MemberRow = Database['public']['Tables']['trip_members']['Row']

export type TripMember = Pick<MemberRow, 'id' | 'user_id' | 'role' | 'status'> & {
  display_name: string | null
  avatar_url: string | null
}

export async function listTripMembers(tripId: string): Promise<TripMember[]> {
  const { data, error } = await supabase
    .from('trip_members')
    .select('id, user_id, role, status, display_name, profiles(display_name, avatar_url)')
    .eq('trip_id', tripId)
    .eq('status', 'active')
    .order('joined_at', { ascending: true })
  if (error) {
    throw error
  }
  return data.map((member) => ({
    id: member.id,
    user_id: member.user_id,
    role: member.role,
    status: member.status,
    // Profile name first, place alias second: a claimed place follows the account's current name,
    // while a ghost (no profile at all) and a detached place keep the alias frozen on the row.
    display_name: member.profiles?.display_name ?? member.display_name ?? null,
    avatar_url: member.profiles?.avatar_url ?? null,
  }))
}

export type TripMemberName = { id: string; user_id: string | null; display_name: string | null }

// All members of a trip INCLUDING removed ones, for resolving names in historical splits/balances
// where a soft-removed member would otherwise show as "Member". Goes through a SECURITY DEFINER RPC
// because the profiles RLS only exposes profiles of mutually-active members, so a direct join reads
// a removed member's name back as null.
export async function listTripMemberNames(tripId: string): Promise<TripMemberName[]> {
  const { data, error } = await supabase.rpc('trip_member_names', { _trip_id: tripId })
  if (error) {
    throw error
  }
  return (data ?? []).map((member) => ({
    id: member.id,
    user_id: member.user_id,
    // The generated RPC type says non-null, but the profiles left-join / RGPD anonymisation can
    // yield null; normalise so consumers' "?? member" fallback is reached.
    display_name: member.display_name ?? null,
  }))
}

export async function joinTripByCode(code: string): Promise<string> {
  const { data, error } = await supabase.rpc('join_trip_by_code', { _code: code })
  if (error) {
    throw error
  }
  return data
}

export async function regenerateInviteCode(tripId: string): Promise<string> {
  const { data, error } = await supabase.rpc('regenerate_invite_code', { _trip_id: tripId })
  if (error) {
    throw error
  }
  return data
}

export async function leaveTrip(tripId: string): Promise<void> {
  const { error } = await supabase.rpc('leave_trip', { _trip_id: tripId })
  if (error) {
    throw error
  }
}

export async function removeTripMember(memberId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_trip_member', { _member_id: memberId })
  if (error) {
    throw error
  }
}

// Reads a trip's title and its free places from an invite code alone, for a caller RLS still hides
// the whole trip from. Rate-limited server-side, so a wrong code is not a free retry.
export async function getTripClaimOptions(code: string): Promise<ClaimOptions> {
  const { data, error } = await supabase.rpc('get_trip_claim_options', { _code: code })
  if (error) {
    throw error
  }
  return claimOptionsSchema.parse(data)
}

// Binds the caller's account to a free place, or to a brand new one when slotId is null ("I am not
// in the list"). Returns the trip id.
export async function claimTripSlot(code: string, slotId: string | null): Promise<string> {
  const { data, error } = await supabase.rpc('claim_trip_slot', {
    _code: code,
    _slot_id: slotId ?? undefined,
  })
  if (error) {
    throw error
  }
  return data
}

export async function addGhostMember(tripId: string, name: string): Promise<string> {
  const { data, error } = await supabase.rpc('add_ghost_member', { _trip_id: tripId, _name: name })
  if (error) {
    throw error
  }
  return data
}

export async function renameGhostMember(memberId: string, name: string): Promise<void> {
  const { error } = await supabase.rpc('rename_ghost_member', { _member_id: memberId, _name: name })
  if (error) {
    throw error
  }
}

// Unbinds an account from its place, leaving the place and its whole ledger history behind. The RPC
// refuses with 'place has ledger activity since claim; remove the member instead' when the current
// tenure moved the balances - callers route their fallback on that message, so it must not be
// wrapped or reworded here.
export async function detachTripMember(memberId: string): Promise<void> {
  const { error } = await supabase.rpc('detach_trip_member', { _member_id: memberId })
  if (error) {
    throw error
  }
}
