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
    })
    .eq('id', eventId)
    .select()
    .single()
  if (error) {
    throw error
  }
  return data
}

export async function deleteEvent(eventId: string): Promise<void> {
  const { error } = await supabase.from('trip_events').delete().eq('id', eventId)
  if (error) {
    throw error
  }
}
