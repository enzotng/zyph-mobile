import type { Database } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'

export type TripEvent = Database['public']['Tables']['trip_events']['Row']

export async function listEvents(tripId: string): Promise<TripEvent[]> {
  const { data, error } = await supabase
    .from('trip_events')
    .select('*')
    .eq('trip_id', tripId)
    .order('starts_at', { ascending: true, nullsFirst: false })
  if (error) {
    throw error
  }
  return data
}

export async function getEvent(eventId: string): Promise<TripEvent | null> {
  const { data, error } = await supabase
    .from('trip_events')
    .select('*')
    .eq('id', eventId)
    .maybeSingle()
  if (error) {
    throw error
  }
  return data
}

export type GateLocation = {
  label: string
  lat: number
  lng: number
}

export type CreateEventInput = {
  tripId: string
  title: string
  type?: string
  startsAt: string
  endsAt?: string
  notes: string
  lat?: number
  lng?: number
  gateLocation?: GateLocation | null
  participants?: string[] | null
}

export async function createEvent({
  tripId,
  title,
  type,
  startsAt,
  endsAt,
  notes,
  lat,
  lng,
  gateLocation,
  participants,
}: CreateEventInput): Promise<TripEvent> {
  const { data: auth } = await supabase.auth.getSession()
  const userId = auth.session?.user.id
  if (!userId) {
    throw new Error('You must be signed in.')
  }

  const { data, error } = await supabase
    .from('trip_events')
    .insert({
      trip_id: tripId,
      title,
      type: type || 'event',
      starts_at: startsAt,
      ends_at: endsAt || null,
      notes: notes || null,
      lat: lat ?? null,
      lng: lng ?? null,
      gate_location: gateLocation ?? null,
      // null means "all active members" - callers guarantee that, we just pass it through.
      participants: participants ?? null,
      created_by: userId,
    })
    .select()
    .single()
  if (error) {
    throw error
  }
  return data
}

export type UpdateEventInput = {
  eventId: string
  title: string
  type?: string
  startsAt: string
  endsAt?: string
  notes: string
  lat?: number
  lng?: number
  gateLocation?: GateLocation | null
  participants?: string[] | null
}

export async function updateEvent({
  eventId,
  title,
  type,
  startsAt,
  endsAt,
  notes,
  lat,
  lng,
  gateLocation,
  participants,
}: UpdateEventInput): Promise<TripEvent> {
  const { data, error } = await supabase
    .from('trip_events')
    .update({
      title,
      // Only touch type when the caller supplies it, so a typeless update never wipes it.
      ...(type !== undefined ? { type } : {}),
      starts_at: startsAt,
      ends_at: endsAt || null,
      notes: notes || null,
      lat: lat ?? null,
      lng: lng ?? null,
      gate_location: gateLocation ?? null,
      // null means "all active members" - callers guarantee that, we just pass it through.
      participants: participants ?? null,
    })
    .eq('id', eventId)
    .select()
    .single()
  if (error) {
    throw error
  }
  return data
}

export type NewItineraryEvent = {
  title: string
  type: string
  startsAt: string
  endsAt?: string | null
  lat: number | null
  lng: number | null
  placeId: string | null
  notes?: string
  gateLocation?: GateLocation | null
  // Departure/venue display name (trip_events.location is a PostGIS point, not a name).
  locationName?: string | null
  // Arrival place for directional events (flights, transfers).
  endLocation?: { name: string; lat: number | null; lng: number | null } | null
  // Subset of active trip members attending. null means "all active members" - callers
  // guarantee that, we just pass it through.
  participants?: string[] | null
}

// Batch-inserts itinerary events into the shared timeline in one round trip. created_by is the
// signed-in user. Returns the inserted rows. An empty list is a no-op (returns []).
export async function createEvents(
  tripId: string,
  events: NewItineraryEvent[],
): Promise<TripEvent[]> {
  if (events.length === 0) {
    return []
  }
  const { data: auth } = await supabase.auth.getSession()
  const userId = auth.session?.user.id
  if (!userId) {
    throw new Error('You must be signed in.')
  }
  const rows = events.map((e) => ({
    trip_id: tripId,
    title: e.title,
    type: e.type || 'activity',
    starts_at: e.startsAt,
    ends_at: e.endsAt ?? null,
    notes: e.notes || null,
    lat: e.lat,
    lng: e.lng,
    place_id: e.placeId,
    gate_location: e.gateLocation ?? null,
    location_name: e.locationName ?? null,
    end_location: e.endLocation ?? null,
    participants: e.participants ?? null,
    created_by: userId,
  }))
  const { data, error } = await supabase.from('trip_events').insert(rows).select()
  if (error) {
    throw error
  }
  return data ?? []
}

export async function deleteEvent(eventId: string): Promise<void> {
  const { error } = await supabase.from('trip_events').delete().eq('id', eventId)
  if (error) {
    throw error
  }
}
