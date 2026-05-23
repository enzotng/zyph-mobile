import type { Database } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'

export type TripPoi = Database['public']['Tables']['trip_pois']['Row']
export type MemberLocation = Database['public']['Tables']['member_locations']['Row']

export async function listPois(tripId: string): Promise<TripPoi[]> {
  const { data, error } = await supabase
    .from('trip_pois')
    .select('*')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: true })
  if (error) {
    throw error
  }
  return data
}

export async function getPoi(poiId: string): Promise<TripPoi | null> {
  const { data, error } = await supabase.from('trip_pois').select('*').eq('id', poiId).maybeSingle()
  if (error) {
    throw error
  }
  return data
}

export type CreatePoiInput = {
  tripId: string
  label: string
  icon: string
  lat: number
  lng: number
}

export async function createPoi({
  tripId,
  label,
  icon,
  lat,
  lng,
}: CreatePoiInput): Promise<TripPoi> {
  const { data: auth } = await supabase.auth.getSession()
  const userId = auth.session?.user.id
  if (!userId) {
    throw new Error('You must be signed in.')
  }

  const { data, error } = await supabase
    .from('trip_pois')
    .insert({
      trip_id: tripId,
      label,
      icon,
      lat,
      lng,
      created_by: userId,
    })
    .select()
    .single()
  if (error) {
    throw error
  }
  return data
}

export type UpdatePoiInput = {
  poiId: string
  label: string
  icon: string
  lat: number
  lng: number
}

export async function updatePoi({
  poiId,
  label,
  icon,
  lat,
  lng,
}: UpdatePoiInput): Promise<TripPoi> {
  const { data, error } = await supabase
    .from('trip_pois')
    .update({ label, icon, lat, lng, updated_at: new Date().toISOString() })
    .eq('id', poiId)
    .select()
    .single()
  if (error) {
    throw error
  }
  return data
}

export async function deletePoi(poiId: string): Promise<void> {
  const { error } = await supabase.from('trip_pois').delete().eq('id', poiId)
  if (error) {
    throw error
  }
}

export type UpsertMemberLocationInput = {
  tripId: string
  lat: number
  lng: number
  accuracyM?: number
  headingDeg?: number
}

export async function upsertMemberLocation({
  tripId,
  lat,
  lng,
  accuracyM,
  headingDeg,
}: UpsertMemberLocationInput): Promise<void> {
  const { error } = await supabase.rpc('upsert_member_location', {
    _trip_id: tripId,
    _lat: lat,
    _lng: lng,
    _accuracy_m: typeof accuracyM === 'number' ? accuracyM : undefined,
    _heading_deg: typeof headingDeg === 'number' ? headingDeg : undefined,
  })
  if (error) {
    throw error
  }
}

export async function clearMemberLocation(tripId: string): Promise<void> {
  const { error } = await supabase.rpc('clear_member_location', { _trip_id: tripId })
  if (error) {
    throw error
  }
}

export type MemberLocationWithMember = MemberLocation & {
  trip_member: {
    id: string
    user_id: string | null
    status: string
    profile: { id: string; display_name: string | null; avatar_url: string | null } | null
  } | null
}

export async function listMemberLocations(tripId: string): Promise<MemberLocationWithMember[]> {
  const { data: auth } = await supabase.auth.getSession()
  const myUserId = auth.session?.user.id ?? null

  let query = supabase
    .from('member_locations')
    .select(
      'lat, lng, accuracy_m, heading_deg, updated_at, trip_member_id, trip_member:trip_members!inner(id, user_id, status, trip_id, profile:profiles(id, display_name, avatar_url))',
    )
    .eq('trip_member.trip_id', tripId)
    .eq('trip_member.status', 'active')
  if (myUserId) {
    query = query.neq('trip_member.user_id', myUserId)
  }

  const { data, error } = await query
  if (error) {
    throw error
  }
  return data as unknown as MemberLocationWithMember[]
}
