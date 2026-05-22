import type { Database } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'
import type { CreateTripValues } from '../schemas'

export type Trip = Database['public']['Tables']['trips']['Row']

export async function listTrips(): Promise<Trip[]> {
  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) {
    throw error
  }
  return data
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
    })
    .select()
    .single()
  if (error) {
    throw error
  }
  return data
}

export type UpdateTripInput = CreateTripValues & { id: string }

export async function updateTrip({
  id,
  title,
  destination,
  currency,
}: UpdateTripInput): Promise<Trip> {
  const { data, error } = await supabase
    .from('trips')
    .update({ title, destination: destination || null, currency })
    .eq('id', id)
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
