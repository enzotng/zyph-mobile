import { File } from 'expo-file-system'

import type { Database } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'

export type TripDocument = Database['public']['Tables']['media']['Row']

const BUCKET = 'trip-documents'
const SIGNED_URL_TTL = 3600

export type UploadDocumentInput = {
  tripId: string
  eventId: string
  uri: string
  name: string
  mimeType: string
  sizeBytes: number
}

export async function uploadDocument(input: UploadDocumentInput): Promise<TripDocument> {
  const { data: auth } = await supabase.auth.getSession()
  const userId = auth.session?.user.id
  if (!userId) {
    throw new Error('You must be signed in.')
  }

  // First path segment is the trip id - Storage RLS checks membership against it.
  const path = `${input.tripId}/${Date.now()}-${Math.floor(Math.random() * 1e6)}.pdf`
  // expo-document-picker copies to cache (file://), so File().arrayBuffer() is reliable
  // on both platforms; guard against a 0-byte read producing a silent empty upload.
  const bytes = await new File(input.uri).arrayBuffer()
  if (bytes.byteLength === 0) {
    throw new Error('The selected file is empty or could not be read.')
  }

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: input.mimeType || 'application/pdf',
    upsert: false,
  })
  if (uploadError) {
    throw uploadError
  }

  const { data, error } = await supabase
    .from('media')
    .insert({
      trip_id: input.tripId,
      event_id: input.eventId,
      owner_id: userId,
      storage_path: path,
      kind: 'document',
      name: input.name,
      mime_type: input.mimeType,
      size_bytes: input.sizeBytes,
    })
    .select()
    .single()
  if (error) {
    // Avoid leaving an orphaned object if the metadata insert fails.
    await supabase.storage.from(BUCKET).remove([path])
    throw error
  }
  return data
}

export async function listEventDocuments(eventId: string): Promise<TripDocument[]> {
  const { data, error } = await supabase
    .from('media')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })
  if (error) {
    throw error
  }
  return data
}

export async function getDocumentUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL)
  if (error) {
    throw error
  }
  return data.signedUrl
}

export async function deleteDocument(doc: TripDocument): Promise<void> {
  // Remove the object first: a stored object whose metadata row still exists can be
  // retried, whereas a row without its object would be a dead, undeletable entry.
  const { error: storageError } = await supabase.storage.from(BUCKET).remove([doc.storage_path])
  if (storageError) {
    throw storageError
  }
  const { error } = await supabase.from('media').delete().eq('id', doc.id)
  if (error) {
    throw error
  }
}
