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

export type CreateEventInput = {
  tripId: string
  title: string
  startsAt: string
  endsAt?: string
  notes: string
}

export async function createEvent({
  tripId,
  title,
  startsAt,
  endsAt,
  notes,
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
      type: 'event',
      starts_at: startsAt,
      ends_at: endsAt || null,
      notes: notes || null,
      created_by: userId,
    })
    .select()
    .single()
  if (error) {
    throw error
  }
  return data
}
