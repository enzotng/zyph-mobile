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

// Thrown (as the Error message) when the account cannot be deleted because the user still owns
// trips other travellers are part of. The UI maps it to a dedicated, actionable message.
export const ACCOUNT_HAS_SHARED_TRIPS = 'owns_shared_trips'

// Permanently deletes the signed-in user's account via the delete-account edge function (block
// owned shared trips, delete solo trips, soft-remove guest memberships, anonymise + disable/erase
// the auth user). On success the server session is invalidated, so the caller should sign out.
export async function deleteAccount(): Promise<void> {
  const { error } = await supabase.functions.invoke<{ success: boolean }>('delete-account', {
    body: {},
  })
  if (error) {
    // Surface the function's own { error } body (e.g. the owns_shared_trips sentinel) so the UI can
    // react, instead of invoke's generic FunctionsHttpError message.
    if (error instanceof FunctionsHttpError) {
      const body = (await error.context.json().catch(() => null)) as { error?: string } | null
      throw new Error(body?.error ?? error.message)
    }
    throw error
  }
}
