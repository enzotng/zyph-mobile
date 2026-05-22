import type { Database } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'

type MemberRow = Database['public']['Tables']['trip_members']['Row']

export type TripMember = Pick<MemberRow, 'id' | 'user_id' | 'role' | 'status'> & {
  display_name: string | null
}

export async function listTripMembers(tripId: string): Promise<TripMember[]> {
  const { data, error } = await supabase
    .from('trip_members')
    .select('id, user_id, role, status, profiles(display_name)')
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
