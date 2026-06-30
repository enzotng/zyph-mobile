// poi-photo: resolves a Google Places photo resource name into a keyless, embeddable URL.
//
// The client sends a `photoName` (e.g. "places/ChIJ.../photos/AXC...") obtained from the
// poi-search response. This function proxies the Google Place Photo (New) media endpoint with
// skipHttpRedirect=true, which returns a JSON { photoUri } pointing at a keyless
// googleusercontent URL - the API key is NEVER forwarded to the client.
//
// On any provider error the function degrades to { photoUri: null } (HTTP 200) so the caller
// can silently skip the image rather than crashing the itinerary UI.
//
// Auth: verify_jwt = true; only signed-in users can invoke this.

import "@supabase/functions-js/edge-runtime.d.ts"
import { withSupabase } from "@supabase/server"

import { isWithinRateLimit } from "../_shared/rate-limit.ts"

const GOOGLE_PLACES = "https://places.googleapis.com/v1"
const FETCH_TIMEOUT_MS = 10_000

export default {
  fetch: withSupabase({ auth: ["publishable"] }, async (req, ctx) => {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 })
    }

    if (!(await isWithinRateLimit(ctx.supabase, "poi-photo", 60, 60))) {
      return Response.json({ error: "Too many requests, please slow down." }, { status: 429 })
    }

    let body: { photoName?: unknown; maxWidthPx?: unknown }
    try {
      body = await req.json()
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    if (
      typeof body.photoName !== "string" ||
      body.photoName.trim().length === 0 ||
      !body.photoName.startsWith("places/")
    ) {
      return Response.json(
        { error: 'photoName must be a non-empty string starting with "places/"' },
        { status: 400 },
      )
    }
    const photoName = body.photoName.trim()

    let maxWidthPx = 800
    if (body.maxWidthPx !== undefined) {
      const raw = typeof body.maxWidthPx === "number" ? body.maxWidthPx : NaN
      if (!isFinite(raw)) {
        return Response.json({ error: "maxWidthPx must be a finite number" }, { status: 400 })
      }
      maxWidthPx = Math.max(100, Math.min(1600, Math.round(raw)))
    }

    const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY")
    if (!apiKey) {
      return Response.json({ error: "GOOGLE_MAPS_API_KEY is not configured" }, { status: 500 })
    }

    try {
      const mediaRes = await fetch(
        `${GOOGLE_PLACES}/${photoName}/media?maxWidthPx=${maxWidthPx}&skipHttpRedirect=true`,
        {
          headers: { "X-Goog-Api-Key": apiKey },
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        },
      )
      if (!mediaRes.ok) {
        console.error("poi-photo google error", mediaRes.status, mediaRes.statusText)
        return Response.json({ photoUri: null })
      }
      const data = await mediaRes.json()
      return Response.json({ photoUri: data.photoUri ?? null })
    } catch (err) {
      console.error("poi-photo fetch error", err instanceof Error ? err.message : String(err))
      return Response.json({ photoUri: null })
    }
  }),
}
