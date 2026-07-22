import { FunctionsHttpError } from '@supabase/supabase-js'

import type { Database } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'
import type { BudgetLevel, CreateTripValues, Dietary, Interest, Pace, TripType } from '../schemas'

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
  // Only write if the cover is still empty: a concurrent manual upload (or another auto-fetch)
  // could have set one between the read above and here - don't clobber it. maybeSingle so a 0-row
  // update (cover taken meanwhile) returns null and we keep the trip as-is.
  const { data } = await supabase
    .from('trips')
    .update({
      cover_photo_url: cover.url,
      cover_photo_author: cover.author,
      cover_photo_author_url: cover.authorUrl,
    })
    .eq('id', trip.id)
    .is('cover_photo_url', null)
    .select()
    .maybeSingle()
  return data ?? trip
}

// Uploads a base64 cover photo for a trip via the upload-trip-cover edge function (service role,
// owner-checked), which stores it and writes the public URL onto the trip. Goes through an edge
// function (not a direct Storage upload) for the same ES256 reason as the avatar upload.
export async function uploadTripCover(
  tripId: string,
  imageBase64: string,
  contentType: string,
): Promise<Trip> {
  const { data, error } = await supabase.functions.invoke<{ trip: Trip }>('upload-trip-cover', {
    body: { tripId, imageBase64, contentType },
  })
  if (error) {
    // Surface the function's own { error } body (bad type, too large, not owner, ...) instead of
    // invoke's generic FunctionsHttpError message.
    if (error instanceof FunctionsHttpError) {
      const body = (await error.context.json().catch(() => null)) as { error?: string } | null
      throw new Error(body?.error ?? error.message)
    }
    throw error
  }
  if (!data?.trip) {
    throw new Error('Cover upload returned no trip.')
  }
  return data.trip
}

// Clears a custom cover and re-fetches the automatic (Google/Unsplash) one for the destination.
// The trips UPDATE RLS is owner-only, so this only succeeds for the owner (matching the UI gate).
export async function resetTripCover(tripId: string): Promise<Trip> {
  const { data, error } = await supabase
    .from('trips')
    .update({ cover_photo_url: null, cover_photo_author: null, cover_photo_author_url: null })
    .eq('id', tripId)
    .select()
    .single()
  if (error || !data) {
    throw error ?? new Error('Could not reset the cover')
  }
  // Cover is now empty, so withCover re-fetches the automatic one (when there is a destination).
  return withCover(data)
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

// The create form (createTripSchema) plus the two optional "light" profile fields the
// new-trip screen collects (newTripSchema). Both default to null when omitted.
export type CreateTripInput = CreateTripValues & {
  tripType?: TripType | null
  budgetLevel?: BudgetLevel | null
}

export async function createTrip(input: CreateTripInput): Promise<Trip> {
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
      trip_type: input.tripType ?? null,
      budget_level: input.budgetLevel ?? null,
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

// Trip profile / preferences. A dedicated path (not updateTrip) so the trip edit form, which
// renders none of these fields, can never blank them out. budgetTotalCents is integer cents in
// the trip currency. Owner-only at the DB (trips_update_owner RLS) and gated again in the UI.
export type UpdateTripPreferencesInput = {
  id: string
  tripType: TripType | null
  budgetLevel: BudgetLevel | null
  budgetTotalCents: number | null
  pace: Pace | null
  interests: Interest[]
  dietary: Dietary[]
}

export async function updateTripPreferences(input: UpdateTripPreferencesInput): Promise<Trip> {
  const { data, error } = await supabase
    .from('trips')
    .update({
      trip_type: input.tripType,
      budget_level: input.budgetLevel,
      budget_total_cents: input.budgetTotalCents,
      pace: input.pace,
      interests: input.interests,
      dietary: input.dietary,
    })
    .eq('id', input.id)
    .select()
    .single()
  if (error) {
    throw error
  }
  return data
}

export async function deleteTrip(id: string): Promise<void> {
  // Cascades to members, events, expenses, splits and media via FK on delete cascade.
  const { error } = await supabase.from('trips').delete().eq('id', id)
  if (error) {
    throw error
  }
}

// Creates (or regenerates) the signed-in member's calendar feed token for a trip. Returns the
// RAW bearer token - shown once, never stored client-side beyond component state. Regenerating
// revokes the previous live token server-side, so a single call covers both create and rotate.
export async function createCalendarFeedToken(tripId: string): Promise<string> {
  const { data, error } = await supabase.rpc('create_calendar_feed_token', { _trip_id: tripId })
  if (error) {
    throw error
  }
  return data
}

export type TripInboxAddress = { address: string; autoValidate: boolean }

// Creates (or regenerates) the trip's shared inbound email address. Returns the full address -
// unlike the calendar token this is re-displayable, not shown-once, but the RPC still revokes
// any previous live address server-side, so a single call covers both create and regenerate.
export async function createTripInboxAddress(tripId: string): Promise<string> {
  const { data, error } = await supabase.rpc('create_trip_inbox_address', { _trip_id: tripId })
  if (error) {
    throw error
  }
  return data
}

// Reads the trip's live inbound address and its auto-validate flag, or null if none was
// generated yet. The RPC returns a TABLE (0 or 1 row) rather than a scalar.
export async function getTripInboxAddress(tripId: string): Promise<TripInboxAddress | null> {
  const { data, error } = await supabase.rpc('get_trip_inbox_address', { _trip_id: tripId })
  if (error) {
    throw error
  }
  const row = data?.[0]
  if (!row) {
    return null
  }
  return { address: row.address, autoValidate: row.auto_validate }
}

export async function revokeTripInboxAddress(tripId: string): Promise<void> {
  const { error } = await supabase.rpc('revoke_trip_inbox_address', { _trip_id: tripId })
  if (error) {
    throw error
  }
}

export async function setTripInboxAutoValidate(tripId: string, on: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_trip_inbox_autovalidate', {
    _trip_id: tripId,
    _on: on,
  })
  if (error) {
    throw error
  }
}
