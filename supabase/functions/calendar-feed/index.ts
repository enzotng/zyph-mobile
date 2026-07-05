// calendar-feed: public ICS calendar feed for a trip, gated by a bearer capability token
// (private.calendar_feed_tokens) rather than a Supabase JWT - webcal-subscribing calendar clients
// (Apple/Google Calendar, etc.) never send one. Every auth-adjacent failure (bad token format,
// unknown hash, revoked, member no longer active) answers a uniform 404 so the endpoint never
// confirms or denies which part failed - no oracle for token guessing/enumeration. Nothing
// user-derived (the token, its hash, member/trip ids) is ever logged.
//
// Auth: verify_jwt = false (see config.toml). Raw Deno.serve + service-role client, like
// send-push/upload-avatar - there is no user JWT here to build a per-caller client from.
//
// The token hash lookup, active-membership check and rate limit all live behind ONE public
// SECURITY DEFINER RPC (public.resolve_calendar_feed, service_role only) instead of direct
// .schema("private") access: PostgREST only exposes [public, graphql_public]
// (supabase/config.toml), so a direct .schema("private") call fails for every caller, service
// role included. The RPC hashes the raw token itself, so this function never computes or holds a
// hash - it only ever holds the opaque bearer token from the query string.

import { createClient } from "@supabase/supabase-js"

import { buildCalendar } from "./ics.ts"
import type { CalendarEventInput } from "./ics.ts"

const TOKEN_RE = /^[0-9a-f]{64}$/

const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 120
const RATE_LIMIT_MAP_CAP = 10_000

// Coarse, isolate-local protection for the UNAUTHENTICATED failure path (bad token format,
// unknown hash, revoked, inactive member - none of these ever reach resolve_calendar_feed's own
// atomic per-token rate limit, since that only fires for a token it can resolve). Fixed window,
// keyed by client IP; resets on cold start - accepted, the platform gateway is the real backstop.
const ipHits = new Map<string, { count: number; windowStart: number }>()

function clientIp(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for")
  if (!forwardedFor) return "unknown"
  return forwardedFor.split(",")[0]?.trim() || "unknown"
}

function isRateLimited(ip: string): boolean {
  if (ipHits.size > RATE_LIMIT_MAP_CAP) {
    ipHits.clear()
  }
  const now = Date.now()
  const entry = ipHits.get(ip)
  if (!entry || now - entry.windowStart >= RATE_LIMIT_WINDOW_MS) {
    ipHits.set(ip, { count: 1, windowStart: now })
    return false
  }
  entry.count++
  return entry.count > RATE_LIMIT_MAX
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function notFound(): Response {
  return json({ error: "Not found" }, 404)
}

type ResolveCalendarFeedRow = {
  trip_id: string | null
  rate_limited: boolean
}

type TripRow = {
  title: string
}

type TripEventRow = {
  id: string
  title: string
  notes: string | null
  starts_at: string
  ends_at: string | null
  lat: number | null
  lng: number | null
  location_name: string | null
  // Free-form jsonb (see database.types.ts / the events detail and edit screens, which read this
  // same column as this same optional-fields shape) - any field can be missing or malformed on a
  // legacy/hand-edited row.
  gate_location: { label?: string; lat?: number; lng?: number } | null
  updated_at: string
}

Deno.serve(async (req: Request) => {
  if (req.method !== "GET") {
    return json({ error: "Method not allowed" }, 405)
  }

  const url = new URL(req.url)
  const token = url.searchParams.get("token") ?? ""
  if (!TOKEN_RE.test(token)) {
    return notFound()
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!supabaseUrl || !serviceKey) {
    return json({ error: "Server is not configured" }, 500)
  }
  if (isRateLimited(clientIp(req))) {
    return json({ error: "Too many requests, please slow down." }, 429)
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  // Defaults (_limit=60, _window_seconds=60) match the brief's rate limit; no need to pass them.
  const { data: resolveData, error: resolveError } = await admin.rpc("resolve_calendar_feed", {
    _token: token,
  })
  if (resolveError) {
    console.error("calendar-feed resolve error", resolveError)
    return json({ error: "Server error" }, 500)
  }

  // A SETOF/TABLE RPC always comes back as an array: empty = invalid/unknown/revoked/inactive
  // token (the RPC folds all of those into "no row" - no oracle for which one it was).
  const rows = (resolveData ?? []) as ResolveCalendarFeedRow[]
  if (rows.length === 0) {
    return notFound()
  }
  const resolved = rows[0]
  if (resolved.rate_limited) {
    return json({ error: "Too many requests, please slow down." }, 429)
  }
  const tripId = resolved.trip_id
  if (!tripId) {
    // Defensive only: the RPC contract only omits trip_id when rate_limited is true, handled
    // above - this branch should be unreachable but fails closed (404) rather than querying with
    // a null trip id if that contract ever changes.
    return notFound()
  }

  // Both queries only depend on tripId - run them concurrently instead of serially.
  const [
    { data: tripData, error: tripError },
    { data: eventsData, error: eventsError },
  ] = await Promise.all([
    admin.from("trips").select("title").eq("id", tripId).maybeSingle(),
    admin
      .from("trip_events")
      .select(
        "id, title, notes, starts_at, ends_at, lat, lng, location_name, gate_location, updated_at",
      )
      .eq("trip_id", tripId)
      .not("starts_at", "is", null)
      .order("starts_at", { ascending: true }),
  ])
  if (tripError) {
    console.error("calendar-feed trip lookup error", tripError)
    return json({ error: "Server error" }, 500)
  }
  if (!tripData) {
    return notFound()
  }
  const trip = tripData as TripRow

  if (eventsError) {
    console.error("calendar-feed events lookup error", eventsError)
    return json({ error: "Server error" }, 500)
  }

  const events = (eventsData ?? []) as TripEventRow[]
  const calendarEvents: CalendarEventInput[] = events.map((e) => ({
    id: e.id,
    title: e.title,
    notes: e.notes,
    startsAt: e.starts_at,
    endsAt: e.ends_at,
    lat: e.lat,
    lng: e.lng,
    locationName: e.location_name,
    gateLocation: e.gate_location,
    updatedAt: e.updated_at,
  }))

  const ics = buildCalendar({ tripTitle: trip.title, events: calendarEvents })

  return new Response(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      // Secret-addressed resource (the token IS the auth) - never cache/store it, and never let
      // a client sniff the body as something other than what Content-Type declares.
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  })
})
