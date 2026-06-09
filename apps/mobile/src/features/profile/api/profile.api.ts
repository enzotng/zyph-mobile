import { File } from 'expo-file-system'

import type { Database } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'

export type Profile = Database['public']['Tables']['profiles']['Row']

const AVATAR_BUCKET = 'avatars'

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

// Uploads a picked image as the user's avatar and writes the public URL onto their profile.
// The object lives at a stable per-user path (overwritten on each change); the stored URL is
// cache-busted with a ?v= timestamp so a replaced photo is fetched fresh.
export async function uploadAvatar(uri: string, contentType: string): Promise<Profile> {
  const { data: auth } = await supabase.auth.getSession()
  const userId = auth.session?.user.id
  if (!userId) {
    throw new Error('You must be signed in.')
  }

  const bytes = await new File(uri).arrayBuffer()
  if (bytes.byteLength === 0) {
    throw new Error('The selected image is empty or could not be read.')
  }

  // First path segment is the user id - Storage RLS checks it against auth.uid().
  const path = `${userId}/avatar`
  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, bytes, { contentType: contentType || 'image/jpeg', upsert: true })
  if (uploadError) {
    throw uploadError
  }

  const { publicUrl } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path).data
  const versionedUrl = `${publicUrl}?v=${Date.now()}`

  const { data, error } = await supabase
    .from('profiles')
    .update({ avatar_url: versionedUrl })
    .eq('id', userId)
    .select()
    .single()
  if (error) {
    throw error
  }
  return data
}
