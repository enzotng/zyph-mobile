// upload-trip-cover: stores a cover photo uploaded by the trip OWNER with the SERVICE ROLE
// (bypassing Storage RLS) and writes its public URL onto the trip row, overriding the automatic
// Google/Unsplash cover.
//
// Same ES256 rationale as upload-avatar: a direct client Storage upload under per-user RLS fails,
// so we write with the service role here. The caller is still authenticated (verify_jwt gates the
// function); we resolve their id from their own bearer and CHECK they own the trip - mirroring the
// owner-only RLS on public.trips - so a member who is not the owner can never change the cover.

import { createClient } from "@supabase/supabase-js"

const BUCKET = "trip-covers"
const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405)
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!supabaseUrl || !serviceKey) {
    return json({ error: "Server is not configured" }, 500)
  }
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  // Resolve the caller from their own bearer token (verify_jwt also gates this function).
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "")
  if (!token) {
    return json({ error: "Unauthorized" }, 401)
  }
  const { data: userData, error: userError } = await admin.auth.getUser(token)
  if (userError || !userData.user) {
    return json({ error: "Unauthorized" }, 401)
  }
  const userId = userData.user.id

  let body: { tripId?: unknown; imageBase64?: unknown; contentType?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: "Invalid JSON body" }, 400)
  }
  const tripId = typeof body.tripId === "string" ? body.tripId : ""
  const imageBase64 = typeof body.imageBase64 === "string" ? body.imageBase64 : ""
  const contentType = typeof body.contentType === "string" ? body.contentType : "image/jpeg"
  if (!tripId) {
    return json({ error: "tripId is required" }, 400)
  }
  if (!imageBase64) {
    return json({ error: "imageBase64 is required" }, 400)
  }
  if (!ALLOWED_TYPES.has(contentType)) {
    return json({ error: "Unsupported image type" }, 400)
  }
  // Reject an oversized payload before allocating/decoding it (base64 is ~4/3 of the bytes).
  if (imageBase64.length > Math.ceil(MAX_BYTES / 3) * 4 + 8) {
    return json({ error: "Image is too large" }, 413)
  }

  // Authorisation: only the trip owner may change the cover (mirrors the owner-only trips RLS).
  const { data: trip, error: tripError } = await admin
    .from("trips")
    .select("id, owner_id")
    .eq("id", tripId)
    .single()
  if (tripError || !trip) {
    return json({ error: "Trip not found" }, 404)
  }
  if (trip.owner_id !== userId) {
    return json({ error: "Only the trip owner can change the cover" }, 403)
  }

  let bytes: Uint8Array
  try {
    bytes = decodeBase64(imageBase64)
  } catch {
    return json({ error: "Invalid base64 image" }, 400)
  }
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) {
    return json({ error: "Image is empty or too large" }, 400)
  }

  // Stable per-trip path (overwritten on each change); the stored URL is cache-busted below.
  const path = `${tripId}/cover`
  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType, upsert: true })
  if (uploadError) {
    console.error("Trip cover upload failed", uploadError.message)
    return json({ error: "Upload failed" }, 502)
  }

  const { publicUrl } = admin.storage.from(BUCKET).getPublicUrl(path).data
  const versionedUrl = `${publicUrl}?v=${Date.now()}`

  // Clear the photographer attribution (a user photo has none) and store the new cover.
  const { data: updated, error: updateError } = await admin
    .from("trips")
    .update({
      cover_photo_url: versionedUrl,
      cover_photo_author: null,
      cover_photo_author_url: null,
    })
    .eq("id", tripId)
    .select()
    .single()
  if (updateError || !updated) {
    console.error("Trip cover row update failed", updateError?.message)
    return json({ error: "Could not save the cover" }, 500)
  }

  return json({ trip: updated })
})
