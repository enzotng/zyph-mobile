import type { Database } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'

type MemberRow = Database['public']['Tables']['trip_members']['Row']

export type TripMember = Pick<MemberRow, 'id' | 'user_id' | 'role' | 'status'> & {
  display_name: string | null
  avatar_url: string | null
}

export async function listTripMembers(tripId: string): Promise<TripMember[]> {
  const { data, error } = await supabase
    .from('trip_members')
    .select('id, user_id, role, status, profiles(display_name, avatar_url)')
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
    display_name: member.profiles?.display_name ?? null,
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
