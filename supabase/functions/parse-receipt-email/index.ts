// Smart Import — parses a pasted confirmation email (flight, hotel, train, activity)
// into structured itinerary events (one per reservation leg) via Groq Llama. Pilier 1 du pitch ZYPH.
//
// Architecture: app mobile → cette Edge Function → Groq API → JSON structuré → app.
// La clé GROQ_API_KEY est stockée comme secret Supabase (jamais dans le bundle).
//
// Env vars (set via `supabase secrets set`):
//   GROQ_API_KEY   — required, your Groq API key
//   GROQ_MODEL     — optional, defaults to llama-3.3-70b-versatile
//   GROQ_BASE_URL  — optional, defaults to https://api.groq.com/openai/v1

import "@supabase/functions-js/edge-runtime.d.ts"
import { withSupabase } from "@supabase/server"

import { isWithinRateLimit } from "../_shared/rate-limit.ts"

const DEFAULT_MODEL = "llama-3.3-70b-versatile"
const DEFAULT_BASE_URL = "https://api.groq.com/openai/v1"

const SYSTEM_PROMPT = `You are an assistant that extracts travel itinerary events from confirmation emails (flights, hotels, trains, car rentals, activities, restaurant reservations).

Extract EVERY distinct reservation leg in the email as its own event (an outbound and a return
flight are TWO events; a hotel in the same confirmation is its own event). Return only valid JSON
matching the schema below. When a field is not in the email, use null.

Schema:
{
  "events": [
    {
      "category": one of "transport" | "lodging" | "food" | "activity" | "shopping" | "health" | "fees" | "other",
      "subcategory": a dotted code under the chosen category from the allowlist below, or null,
      "title": string,                      // short human title, e.g. "Flight AF1234 CDG → JFK"
      "startsAt": string | null,            // ISO 8601 timestamp with timezone
      "endsAt": string | null,              // ISO 8601 timestamp with timezone (or null for point events)
      "location": { "name": string, "lat": number | null, "lng": number | null } | null,
      "gateLocation": { "label": string, "lat": number | null, "lng": number | null } | null,
      "endLocation": { "name": string, "lat": number | null, "lng": number | null } | null,
      "participants": string[],
      "notes": string | null,               // additional info (reservation number, terminal, WiFi code, ...)
      "currency": string | null,            // ISO 4217 if a price appears
      "priceCents": integer | null,         // total price in cents
      "confidence": number                  // 0.0 - 1.0 estimate of how confident you are
    }
  ]
}

Allowed subcategory codes (pick the most specific that clearly applies, else null):
transport.flight, transport.train, transport.transit, transport.car, transport.bus, transport.ferry, transport.taxi, transport.bike, transport.fuel
lodging.hotel, lodging.rental, lodging.hostel, lodging.camping
food.restaurant, food.bar, food.cafe, food.groceries
activity.sightseeing, activity.excursion, activity.show, activity.sport, activity.nature, activity.nightlife, activity.wellness, activity.experience
health.doctor
other.event, other.meetup, other.reminder

Classification rules:
- A flight -> category "transport", subcategory "transport.flight". A hotel -> "lodging" / "lodging.hotel".
- A restaurant/bar/cafe reservation -> "food" with the matching subcategory (this is a first-class category now).
- A car rental -> "transport" / "transport.car"; a train -> "transport.train".
- When unsure of the leaf, set subcategory to null but ALWAYS set a category.
- If nothing fits, use category "other" (subcategory "other.event" for a generic dated booking, else null).
- TITLE: write a short, specific, human title in the email's language. Flights: include flight number and route ("Vol AF1234 CDG - JFK"). Hotels: the hotel name and city ("Hotel Le Marais, Paris"). Restaurants: venue name. Never a generic "Reservation" or "Event" when a name is present.

Rules:
- For flights, title MUST include flight number and route.
- For hotels, startsAt = check-in datetime, endsAt = check-out datetime.
- gateLocation only when terminal/gate is explicit AND lat/lng can be inferred from major airport coordinates (otherwise null).
- For flights and transport, "location" is the DEPARTURE place and "endLocation" is the ARRIVAL place. ALWAYS provide name AND lat/lng for well-known airports and stations.
- "participants": the passenger/guest names EXACTLY as written in the email, [] when the email names nobody.
- If you cannot extract any meaningful event, return { "events": [] }.
- Never return more than 10 events.
- ALWAYS include every key of the schema. Use null for anything not present in the email - never omit a key.
- Output JSON only. No prose.`

type Event = {
  category: string
  subcategory: string | null
  title: string | null
  startsAt: string | null
  endsAt: string | null
  location: { name: string; lat: number | null; lng: number | null } | null
  gateLocation: { label: string; lat: number | null; lng: number | null } | null
  endLocation: { name: string; lat: number | null; lng: number | null } | null
  participants: string[]
  notes: string | null
  currency: string | null
  priceCents: number | null
  confidence: number
}

const CATEGORIES = ["transport", "lodging", "food", "activity", "shopping", "health", "fees", "other"]
const SUBCATEGORIES = ["transport.flight","transport.train","transport.transit","transport.car","transport.bus","transport.ferry","transport.taxi","transport.bike","transport.fuel","lodging.hotel","lodging.rental","lodging.hostel","lodging.camping","food.restaurant","food.bar","food.cafe","food.groceries","activity.sightseeing","activity.excursion","activity.show","activity.sport","activity.nature","activity.nightlife","activity.wellness","activity.experience","health.doctor","other.event","other.meetup","other.reminder"]

// The model does not reliably follow "use null": it sometimes omits keys or emits
// wrong-typed values, and the client contract requires EVERY key present (null when
// absent). Normalize here - same normalize-and-null spirit as normalizeGooglePlace in
// _shared/google-places.ts - so a model quirk can never reach a client as a broken shape.
function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v : null
}

function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

function asLocation(v: unknown): Event["location"] {
  const o = asRecord(v)
  const name = o ? asString(o.name) : null
  // The 120-char cap mirrors the client-side write cap (title parity).
  return o && name ? { name: name.slice(0, 120), lat: asNumber(o.lat), lng: asNumber(o.lng) } : null
}

function asGate(v: unknown): Event["gateLocation"] {
  const o = asRecord(v)
  const label = o ? asString(o.label) : null
  // The 40-char cap mirrors the manual form's gate-label limit (client gateLocationSchema).
  return o && label ? { label: label.slice(0, 40), lat: asNumber(o.lat), lng: asNumber(o.lng) } : null
}

function asNames(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v
    .filter((n): n is string => typeof n === "string" && n.trim().length > 0)
    .map((n) => n.trim().slice(0, 80))
    .slice(0, 6)
}

function normalizeEvent(raw: unknown): Event {
  const o = asRecord(raw) ?? {}
  const category = CATEGORIES.includes(o.category as string) ? (o.category as string) : "other"
  const rawSub = o.subcategory as string | null
  const subcategory =
    rawSub && SUBCATEGORIES.includes(rawSub) && rawSub.startsWith(category + ".") ? rawSub : null
  // Mirror the client's coercion: a 0-100 scale is mapped onto 0-1, then clamped.
  const rawConfidence = asNumber(o.confidence) ?? 0
  const confidence = Math.min(
    1,
    Math.max(0, rawConfidence > 1 ? rawConfidence / 100 : rawConfidence),
  )
  return {
    category,
    subcategory,
    // Length caps mirror the manual add-event form's invariants (title 120, notes 500)
    // so the LLM write path can never exceed what the form itself allows.
    title: asString(o.title)?.slice(0, 120) ?? null,
    startsAt: asString(o.startsAt),
    endsAt: asString(o.endsAt),
    location: asLocation(o.location),
    gateLocation: asGate(o.gateLocation),
    endLocation: asLocation(o.endLocation),
    participants: asNames(o.participants),
    notes: asString(o.notes)?.slice(0, 500) ?? null,
    currency: asString(o.currency),
    priceCents: typeof o.priceCents === "number" && Number.isInteger(o.priceCents)
      ? o.priceCents
      : null,
    confidence,
  }
}

// The model is asked for {"events": [...]} but may return a bare event object or a bare array.
// Normalize every root shape into a bounded list; an item that carries nothing displayable
// (title AND startsAt both null after normalization) is dropped. Empty list = "cannot extract".
function normalizeEvents(raw: unknown): Event[] {
  const root = asRecord(raw)
  const list: unknown[] = Array.isArray(raw)
    ? raw
    : root && Array.isArray(root.events)
      ? root.events
      : root
        ? [root]
        : []
  return list
    .map(normalizeEvent)
    .filter((e) => e.title !== null || e.startsAt !== null)
    .slice(0, 10)
}

export default {
  fetch: withSupabase({ auth: ["publishable"] }, async (req, ctx) => {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 })
    }
    if (!(await isWithinRateLimit(ctx.supabase, "parse-receipt-email", 10, 60))) {
      return Response.json({ error: "Too many requests, please slow down." }, { status: 429 })
    }

    let body: { text?: unknown }
    try {
      body = await req.json()
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const text = typeof body.text === "string" ? body.text.trim() : ""
    if (text.length < 30) {
      return Response.json(
        { error: "Email text is too short (minimum 30 characters)" },
        { status: 400 },
      )
    }
    if (text.length > 20000) {
      return Response.json(
        { error: "Email text is too long (maximum 20000 characters)" },
        { status: 400 },
      )
    }

    const groqKey = Deno.env.get("GROQ_API_KEY")
    if (!groqKey) {
      return Response.json({ error: "GROQ_API_KEY is not configured" }, { status: 500 })
    }
    const model = Deno.env.get("GROQ_MODEL") || DEFAULT_MODEL
    const baseUrl = Deno.env.get("GROQ_BASE_URL") || DEFAULT_BASE_URL

    const groqResponse = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: text },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 2000,
      }),
    })

    if (!groqResponse.ok) {
      const errText = await groqResponse.text()
      console.error("Groq API error", groqResponse.status, errText)
      return Response.json(
        { error: `LLM provider returned ${groqResponse.status}` },
        { status: 502 },
      )
    }

    const groqJson = (await groqResponse.json()) as {
      choices?: { message?: { content?: string } }[]
    }
    const content = groqJson.choices?.[0]?.message?.content
    if (!content) {
      return Response.json({ error: "LLM returned an empty response" }, { status: 502 })
    }

    let raw: unknown
    try {
      raw = JSON.parse(content)
    } catch {
      console.error("Could not parse LLM response", content)
      return Response.json({ error: "Could not parse LLM response" }, { status: 502 })
    }

    // A structurally unusable payload normalizes to an empty list; the client renders its
    // "no event detected" state instead of an error.
    return Response.json({ events: normalizeEvents(raw) })
  }),
}
