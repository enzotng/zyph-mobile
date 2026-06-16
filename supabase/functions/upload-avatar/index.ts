// upload-avatar: stores a signed-in user's avatar with the SERVICE ROLE (bypassing Storage RLS)
// and writes the public URL onto their profile.
//
// Why an edge function rather than a direct client upload: this project uses asymmetric (ES256)
// JWT signing keys. PostgREST accepts those user tokens (DB writes work), but the Storage service
// rejects them - a direct client upload under per-user RLS is treated as anonymous and fails.
// Writing here with the service role sidesteps that. The caller is still authenticated (verify_jwt
// gates the function) and we resolve their id from their own bearer token, so a user can only ever
// write their own avatar (avatars/<uid>/avatar).

import { createClient } from "@supabase/supabase-js"

import { isWithinRateLimit } from "../_shared/rate-limit.ts"

const BUCKET = "avatars"
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

  // Per-user rate limit so a signed-in caller cannot spam 5 MB uploads (DoS / Storage quota burn).
  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    auth: { persistSession: false },
  })
  if (!(await isWithinRateLimit(userClient, "upload-avatar", 10, 60))) {
    return json({ error: "Too many uploads, please slow down." }, 429)
  }

  let body: { imageBase64?: unknown; contentType?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: "Invalid JSON body" }, 400)
  }
  const imageBase64 = typeof body.imageBase64 === "string" ? body.imageBase64 : ""
  const contentType = typeof body.contentType === "string" ? body.contentType : "image/jpeg"
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

  let bytes: Uint8Array
  try {
    bytes = decodeBase64(imageBase64)
  } catch {
    return json({ error: "Invalid base64 image" }, 400)
  }
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) {
    return json({ error: "Image is empty or too large" }, 400)
  }

  // Stable per-user path (overwritten on each change); the stored URL is cache-busted below.
  const path = `${userId}/avatar`
  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType, upsert: true })
  if (uploadError) {
    console.error("Avatar upload failed", uploadError.message)
    return json({ error: "Upload failed" }, 502)
  }

  const { publicUrl } = admin.storage.from(BUCKET).getPublicUrl(path).data
  const versionedUrl = `${publicUrl}?v=${Date.now()}`

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .update({ avatar_url: versionedUrl })
    .eq("id", userId)
    .select()
    .single()
  if (profileError || !profile) {
    console.error("Profile update failed", profileError?.message)
    return json({ error: "Profile update failed" }, 500)
  }

  return json({ profile })
})
