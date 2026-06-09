import type { Database } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'
import type { CreateTripValues } from '../schemas'

export type Trip = Database['public']['Tables']['trips']['Row']

export type TripMemberLite = {
  id: string
  user_id: string
  display_name: string | null
  avatar_url: string | null
  role: string
  status: string
}

// A trip plus what the list cards need: its active members and the signed-in
// user's net balance on it (positive = owed to you, negative = you owe).
export type TripCard = Trip & {
  members: TripMemberLite[]
  myBalanceCents: number
}

export type TripCover = {
  url: string | null
  author: string | null
  authorUrl: string | null
}

async function getMyTripBalances(): Promise<Map<string, number>> {
  const { data, error } = await supabase.rpc('get_my_trip_balances')
  if (error) {
    throw error
  }
  return new Map((data ?? []).map((row) => [row.trip_id, row.balance_cents]))
}

// Asks the trip-cover Edge Function for an Unsplash cover for a destination.
// Best-effort: returns nulls when the function or Unsplash is unavailable.
export async function fetchTripCover(destination: string): Promise<TripCover> {
  try {
    const { data, error } = await supabase.functions.invoke<TripCover>('trip-cover', {
      body: { destination },
    })
    if (error || !data) {
      return { url: null, author: null, authorUrl: null }
    }
    return data
  } catch {
    return { url: null, author: null, authorUrl: null }
  }
}

// Backfills an Unsplash cover when a trip has a destination but no cover yet.
// Never overwrites an existing cover, so editing a trip keeps its photo.
async function withCover(trip: Trip): Promise<Trip> {
  if (!trip.destination || trip.cover_photo_url) {
    return trip
  }
  const cover = await fetchTripCover(trip.destination)
  if (!cover.url) {
    return trip
  }
  const { data } = await supabase
    .from('trips')
    .update({
      cover_photo_url: cover.url,
      cover_photo_author: cover.author,
      cover_photo_author_url: cover.authorUrl,
    })
    .eq('id', trip.id)
    .select()
    .single()
  return data ?? trip
}

export async function listTrips(): Promise<TripCard[]> {
  const [tripsResult, balanceByTrip] = await Promise.all([
    supabase
      .from('trips')
      .select('*, trip_members(id, user_id, role, status, profiles(display_name, avatar_url))')
      .order('created_at', { ascending: false }),
    getMyTripBalances(),
  ])
  if (tripsResult.error) {
    throw tripsResult.error
  }
  return (tripsResult.data ?? []).map((row) => {
    const { trip_members, ...trip } = row
    const members: TripMemberLite[] = (trip_members ?? [])
      .filter((member) => member.status === 'active')
      .map((member) => ({
        id: member.id,
        user_id: member.user_id,
        role: member.role,
        status: member.status,
        display_name: member.profiles?.display_name ?? null,
        avatar_url: member.profiles?.avatar_url ?? null,
      }))
    return { ...trip, members, myBalanceCents: balanceByTrip.get(trip.id) ?? 0 }
  })
}

export async function getTrip(id: string): Promise<Trip> {
  const { data, error } = await supabase.from('trips').select('*').eq('id', id).single()
  if (error) {
    throw error
  }
  return data
}

export async function createTrip(input: CreateTripValues): Promise<Trip> {
  // getSession reads the cached local session (no auth-server round-trip).
  const { data: auth } = await supabase.auth.getSession()
  const ownerId = auth.session?.user.id
  if (!ownerId) {
    throw new Error('You must be signed in to create a trip.')
  }

  const { data, error } = await supabase
    .from('trips')
    .insert({
      owner_id: ownerId,
      title: input.title,
      destination: input.destination || null,
      currency: input.currency,
      start_date: input.startDate,
      end_date: input.endDate,
      latitude: input.latitude,
      longitude: input.longitude,
    })
    .select()
    .single()
  if (error) {
    throw error
  }
  return withCover(data)
}

export type UpdateTripInput = CreateTripValues & { id: string }

export async function updateTrip({
  id,
  title,
  destination,
  currency,
  startDate,
  endDate,
  latitude,
  longitude,
}: UpdateTripInput): Promise<Trip> {
  const { data, error } = await supabase
    .from('trips')
    .update({
      title,
      destination: destination || null,
      currency,
      start_date: startDate,
      end_date: endDate,
      latitude,
      longitude,
    })
    .eq('id', id)
    .select()
    .single()
  if (error) {
    throw error
  }
  return withCover(data)
}

export async function deleteTrip(id: string): Promise<void> {
  // Cascades to members, events, expenses, splits and media via FK on delete cascade.
  const { error } = await supabase.from('trips').delete().eq('id', id)
  if (error) {
    throw error
  }
}
