import type { Database } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'

export type Profile = Database['public']['Tables']['profiles']['Row']

export async function getProfile(): Promise<Profile> {
  const { data: auth } = await supabase.auth.getSession()
  const userId = auth.session?.user.id
  if (!userId) {
    throw new Error('You must be signed in.')
  }
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
  if (error) {
    throw error
  }
  return data
}

export type UpdateProfileInput = {
  displayName: string
  preferredCurrency: string
}

export async function updateProfile({
  displayName,
  preferredCurrency,
}: UpdateProfileInput): Promise<Profile> {
  const { data: auth } = await supabase.auth.getSession()
  const userId = auth.session?.user.id
  if (!userId) {
    throw new Error('You must be signed in.')
  }
  const { data, error } = await supabase
    .from('profiles')
    .update({ display_name: displayName, preferred_currency: preferredCurrency })
    .eq('id', userId)
    .select()
    .single()
  if (error) {
    throw error
  }
  return data
}
