import { FunctionsHttpError } from '@supabase/supabase-js'

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

// Uploads a base64 image as the user's avatar via the upload-avatar edge function, which writes
// it with the service role and returns the updated profile. We go through an edge function (not a
// direct Storage upload) because the project's ES256 user tokens are rejected by Storage RLS.
export async function uploadAvatar(imageBase64: string, contentType: string): Promise<Profile> {
  const { data, error } = await supabase.functions.invoke<{ profile: Profile }>('upload-avatar', {
    body: { imageBase64, contentType },
  })
  if (error) {
    // invoke wraps a non-2xx response in a FunctionsHttpError with a generic message; surface the
    // function's own { error } body so the user sees the real reason (bad type, too large, ...).
    if (error instanceof FunctionsHttpError) {
      const body = (await error.context.json().catch(() => null)) as { error?: string } | null
      throw new Error(body?.error ?? error.message)
    }
    throw error
  }
  if (!data?.profile) {
    throw new Error('Avatar upload returned no profile.')
  }
  return data.profile
}
