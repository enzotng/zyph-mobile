import { isValidCategory, isValidSubcategory } from '@/features/taxonomy'
import type { Database } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'

export type TripEvent = Database['public']['Tables']['trip_events']['Row']

// Resolves the taxonomy code a write should use, defaulting to 'other' / null when the caller
// omits or supplies an invalid category or subcategory.
function resolveCode(
  category: string | undefined,
  subcategory: string | null | undefined,
): { category: string; subcategory: string | null } {
  // Defense in depth: the two event forms validate the pair via zod, but other callers build the
  // input directly and bypass it, and the DB only CHECKs `category` (not `subcategory`). Re-validate
  // here so a bad or mismatched code never reaches the row, regardless of caller.
  const safeCategory = category && isValidCategory(category) ? category : 'other'
  const safeSubcategory =
    subcategory && isValidSubcategory(subcategory) && subcategory.startsWith(`${safeCategory}.`)
      ? subcategory
      : null
  return { category: safeCategory, subcategory: safeSubcategory }
}

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
  category?: string
  subcategory?: string | null
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
  category,
  subcategory,
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

  const code = resolveCode(category, subcategory)
  const { data, error } = await supabase
    .from('trip_events')
    .insert({
      trip_id: tripId,
      title,
      category: code.category,
      subcategory: code.subcategory,
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
  category?: string
  subcategory?: string | null
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
  category,
  subcategory,
  startsAt,
  endsAt,
  notes,
  lat,
  lng,
  gateLocation,
  participants,
}: UpdateEventInput): Promise<TripEvent> {
  const hasClassification = category !== undefined || subcategory !== undefined
  const code = hasClassification ? resolveCode(category, subcategory) : null
  const { data, error } = await supabase
    .from('trip_events')
    .update({
      title,
      ...(code ? { category: code.category, subcategory: code.subcategory } : {}),
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
  category?: string
  subcategory?: string | null
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
  const rows = events.map((e) => {
    const code = resolveCode(e.category, e.subcategory)
    return {
      trip_id: tripId,
      title: e.title,
      category: code.category,
      subcategory: code.subcategory,
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
    }
  })
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
