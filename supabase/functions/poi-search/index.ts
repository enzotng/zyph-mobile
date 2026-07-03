// poi-search: given a lat/lng + place types, returns a bounded list of verified POIs from
// Google Places API (New). A 7-day server-side cache (service role, private.places_cache) cuts
// API cost. On any Google error the function degrades to an empty list (HTTP 200) rather than 500.
//
// Env vars (set via `supabase secrets set`):
//   GOOGLE_MAPS_API_KEY    — required (same Google Cloud key the trip-cover fn already uses for
//                            Places API New; the API is enabled on that project)
//   SUPABASE_URL           — auto-injected by the runtime
//   SUPABASE_SERVICE_ROLE_KEY — auto-injected by the runtime

import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "@supabase/supabase-js"
import { withSupabase } from "@supabase/server"

import { isWithinRateLimit } from "../_shared/rate-limit.ts"
import { searchPlaces } from "../_shared/google-places.ts"
import type { Poi } from "../_shared/google-places.ts"

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

function round4(x: number): number {
  return Math.round(x * 1e4) / 1e4
}

async function toSha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

export default {
  fetch: withSupabase({ auth: ["publishable"] }, async (req, ctx) => {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 })
    }
    if (!(await isWithinRateLimit(ctx.supabase, "poi-search", 30, 60))) {
      return Response.json({ error: "Too many requests, please slow down." }, { status: 429 })
    }

    let body: {
      lat?: unknown
      lng?: unknown
      includedTypes?: unknown
      max?: unknown
      languageCode?: unknown
    }
    try {
      body = await req.json()
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const lat = typeof body.lat === "number" ? body.lat : NaN
    const lng = typeof body.lng === "number" ? body.lng : NaN

    if (!isFinite(lat) || lat < -90 || lat > 90) {
      return Response.json(
        { error: "lat must be a finite number between -90 and 90" },
        { status: 400 },
      )
    }
    if (!isFinite(lng) || lng < -180 || lng > 180) {
      return Response.json(
        { error: "lng must be a finite number between -180 and 180" },
        { status: 400 },
      )
    }

    if (!Array.isArray(body.includedTypes) || body.includedTypes.length === 0) {
      return Response.json(
        { error: "includedTypes must be a non-empty array" },
        { status: 400 },
      )
    }
    // Cap to 10 entries, filter to non-empty strings.
    const includedTypes: string[] = (body.includedTypes as unknown[])
      .slice(0, 10)
      .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
      .map((t) => t.trim())
    if (includedTypes.length === 0) {
      return Response.json(
        { error: "includedTypes must contain at least one non-empty string" },
        { status: 400 },
      )
    }

    let max = 12
    if (body.max !== undefined) {
      const rawMax = typeof body.max === "number" ? body.max : NaN
      if (!isFinite(rawMax)) {
        return Response.json({ error: "max must be a finite number" }, { status: 400 })
      }
      max = Math.max(1, Math.min(20, Math.round(rawMax)))
    }

    // Only 'fr'/'en' are supported (mirrors the copilot's language validation); default 'en'.
    const languageCode = body.languageCode === "fr" ? "fr" : "en"

    const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY")
    if (!apiKey) {
      return Response.json({ error: "GOOGLE_MAPS_API_KEY is not configured" }, { status: 500 })
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

    // Canonical cache key: rounded coordinates + sorted types + max + language. `v: 2` busts any
    // payload cached before the richer place fields (description/price range/hours) shipped, and
    // `lang` keeps fr/en results cached separately since Google localizes several fields.
    const canonical = JSON.stringify({
      v: 2,
      lat: round4(lat),
      lng: round4(lng),
      types: [...includedTypes].sort(),
      max,
      lang: languageCode,
    })
    const hash = await toSha256Hex(canonical)

    // Cache read (private schema, service role only).
    const { data: cacheRow } = await admin
      .schema("private")
      .from("places_cache")
      .select("payload, fetched_at")
      .eq("query_hash", hash)
      .maybeSingle()

    if (cacheRow) {
      const fetchedAt = new Date(cacheRow.fetched_at as string).getTime()
      if (Date.now() - fetchedAt < CACHE_TTL_MS) {
        return Response.json({ pois: cacheRow.payload })
      }
    }

    // Cache miss or stale: fetch from Google Places. Degrade to empty list on any error.
    let pois: Poi[]
    try {
      pois = await searchPlaces(apiKey, { lat, lng, includedTypes, max, languageCode })
    } catch (err) {
      console.error("poi-search google error", err)
      return Response.json({ pois: [] })
    }

    // Best-effort cache upsert — a failure here must never block the response.
    const { error: upsertError } = await admin
      .schema("private")
      .from("places_cache")
      .upsert(
        { query_hash: hash, payload: pois, fetched_at: new Date().toISOString() },
        { onConflict: "query_hash" },
      )
    if (upsertError) {
      console.error("poi-search cache upsert error", upsertError)
    }

    return Response.json({ pois })
  }),
}
