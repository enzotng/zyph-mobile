// receive-booking-email: public inbound-parse webhook for Brevo. Turns a forwarded booking email
// (roadtrip-<slug>@zyph.enzotang.fr) into a review-gated import proposal, or - when the trip has
// auto-validation on and the parse is unambiguous - inserts the events straight into the timeline.
//
// Invoked by Brevo's inbound-parse webhook (NOT by the app), so there is no user JWT
// (verify_jwt = false in config.toml). Authorisation is a shared secret in the Authorization
// header, checked against the BREVO_INBOUND_SECRET function secret - same fail-closed idiom as
// send-push's x-push-secret. Brevo delivers at-least-once, so every item is claimed against
// private.processed_inbound_webhooks (via claim_inbound_webhook) before any parsing happens,
// making a retry a cheap 200 no-op instead of a re-parse/re-insert.
//
// Never logs the email body, subject, or recipient - only counts/ids. No raw body is ever stored,
// only the normalized events + subject (import_proposals.events / .subject).

import { createClient } from "@supabase/supabase-js"

import { emailToText } from "./preprocess.ts"
import { findInboxRecipient } from "./resolver.ts"
import type { BrevoInboundItem } from "./resolver.ts"

const DEFAULT_MODEL = "llama-3.3-70b-versatile"
const DEFAULT_BASE_URL = "https://api.groq.com/openai/v1"

// --- Groq event parsing ------------------------------------------------------------------------
// Copied verbatim from parse-receipt-email/index.ts:20-157 (SYSTEM_PROMPT, the Event type, and the
// asString/asNumber/asRecord/asLocation/asGate/asNames/normalizeEvent/normalizeEvents helpers).
// Deliberate v1 duplication: both edge functions need the exact same Groq contract and there is no
// shared module yet - a DRY refactor to _shared/parse-events.ts is a follow-up.

const SYSTEM_PROMPT = `You are an assistant that extracts travel itinerary events from confirmation emails (flights, hotels, trains, car rentals, activities, restaurant reservations).

Extract EVERY distinct reservation leg in the email as its own event (an outbound and a return
flight are TWO events; a hotel in the same confirmation is its own event). Return only valid JSON
matching the schema below. When a field is not in the email, use null.

Schema:
{
  "events": [
    {
      "type": "flight" | "hotel" | "transport" | "activity" | "event",
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
  type: "flight" | "hotel" | "transport" | "activity" | "event"
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

const EVENT_TYPES: readonly Event["type"][] = ["flight", "hotel", "transport", "activity", "event"]

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
  const type = EVENT_TYPES.includes(o.type as Event["type"]) ? (o.type as Event["type"]) : "event"
  // Mirror the client's coercion: a 0-100 scale is mapped onto 0-1, then clamped.
  const rawConfidence = asNumber(o.confidence) ?? 0
  const confidence = Math.min(
    1,
    Math.max(0, rawConfidence > 1 ? rawConfidence / 100 : rawConfidence),
  )
  return {
    type,
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

// --- end copied block --------------------------------------------------------------------------

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

// The real Brevo payload carries Uuid/MessageId for idempotency, but they're not part of the
// shared BrevoInboundItem shape (resolver.ts only models what findInboxRecipient/emailToText
// need) - extend it locally here rather than touching the pure module.
type InboundItem = BrevoInboundItem & { Uuid?: string; MessageId?: string }

type InboundBody = {
  items?: InboundItem[]
}

type ResolveTripInboxRow = {
  trip_id: string
  auto_validate: boolean
  rate_limited: boolean
}

// The auto-validate path skips human review, so a parse that LOOKS complete (title + startsAt)
// but carries a garbled or out-of-order date must not reach it - Date.parse rejects a non-ISO
// string, and an out-of-order end would otherwise fail trip_events' ends_at >= starts_at check
// constraint on insert (which would strand the proposal - see the insert-error handling below).
function hasValidWindow(e: Event): boolean {
  if (!e.startsAt || Number.isNaN(Date.parse(e.startsAt))) return false
  if (!e.endsAt) return true
  const ends = Date.parse(e.endsAt)
  return !Number.isNaN(ends) && ends >= Date.parse(e.startsAt)
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405)
  }

  // Fail closed: an unset secret rejects every request (inbound stays off) rather than opening up.
  const secret = Deno.env.get("BREVO_INBOUND_SECRET")
  if (!secret) {
    console.error(
      "BREVO_INBOUND_SECRET is not set - rejecting (inbound email is disabled until configured)",
    )
    return json({ error: "Server is not configured" }, 500)
  }
  if (req.headers.get("Authorization") !== `Bearer ${secret}`) {
    return json({ error: "Unauthorized" }, 401)
  }

  let body: InboundBody
  try {
    body = await req.json()
  } catch {
    return json({ error: "Invalid JSON body" }, 400)
  }

  const item = body?.items?.[0]
  if (!item) {
    return json({ skipped: "no item" })
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!supabaseUrl || !serviceKey) {
    return json({ error: "Server is not configured" }, 500)
  }
  const client = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  // Idempotency: Brevo retries on anything but a 2xx, so claim the provider's email id BEFORE any
  // parsing - a retry becomes a cheap no-op instead of a re-parse/re-insert. Falsy id (neither
  // Uuid nor MessageId present) can't be deduped - proceed anyway.
  const providerEmailId = item.Uuid ?? item.MessageId ?? null
  if (providerEmailId) {
    const { data: fresh, error: claimError } = await client.rpc("claim_inbound_webhook", {
      _provider_email_id: providerEmailId,
    })
    if (claimError) {
      // Log the Postgres error CODE only - never the error object/message/details, which can
      // echo email-derived values (e.g. a constraint violation naming the offending value).
      console.error("receive-booking-email claim error", claimError?.code)
      return json({ error: "Server error" }, 500)
    }
    if (fresh === false) {
      return json({ skipped: "duplicate" })
    }
  }

  // Uniform drop when no inbox address is found in the item - never log which part failed.
  const recipient = findInboxRecipient(item)
  if (!recipient) {
    return json({ skipped: "no recipient" })
  }

  const { data: resolved, error: resolveError } = await client.rpc("resolve_trip_inbox", {
    _recipient: recipient,
  })
  if (resolveError) {
    console.error("receive-booking-email resolve error", resolveError?.code)
    return json({ error: "Server error" }, 500)
  }
  const rows = (resolved ?? []) as ResolveTripInboxRow[]
  if (rows.length === 0) {
    return json({ skipped: "no trip" })
  }
  const row = rows[0]
  if (row.rate_limited) {
    return json({ skipped: "rate limited" })
  }
  const tripId = row.trip_id
  const autoValidate = row.auto_validate

  // Durable row BEFORE parsing: any failure below still leaves something visible/debuggable
  // instead of silence. sender_email is the From HEADER address, NOT the envelope sender (which is
  // SRS-mangled on auto-forward).
  const { data: proposal, error: insertError } = await client
    .from("import_proposals")
    .insert({
      trip_id: tripId,
      provider_email_id: providerEmailId,
      status: "parsing",
      source: "email",
      sender_email: item.From?.Address ?? null,
      subject: item.Subject ?? null,
      received_at: new Date().toISOString(),
    })
    .select("id")
    .single()
  if (insertError || !proposal) {
    console.error("receive-booking-email proposal insert error", insertError?.code)
    return json({ error: "Server error" }, 500)
  }
  const proposalId = proposal.id

  const text = emailToText(item)
  if (text.trim().length < 30) {
    await client.from("import_proposals").update({ status: "failed" }).eq("id", proposalId)
    return json({ skipped: "empty body" })
  }

  const groqKey = Deno.env.get("GROQ_API_KEY")
  if (!groqKey) {
    console.error("GROQ_API_KEY is not configured")
    await client.from("import_proposals").update({ status: "failed" }).eq("id", proposalId)
    return json({ skipped: "parse failed" })
  }
  const model = Deno.env.get("GROQ_MODEL") || DEFAULT_MODEL
  const baseUrl = Deno.env.get("GROQ_BASE_URL") || DEFAULT_BASE_URL

  // The whole Groq interaction is wrapped: fetch() itself (network/DNS/reset), response.json(), and
  // JSON.parse can all THROW - and the webhook is already claimed, so an uncaught throw would strand
  // this row at 'parsing' forever (a Brevo retry is swallowed as a duplicate). Any failure here is
  // terminal -> 'failed', 200.
  let raw: unknown
  try {
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
      console.error("Groq API error", groqResponse.status)
      await client.from("import_proposals").update({ status: "failed" }).eq("id", proposalId)
      return json({ skipped: "parse failed" })
    }

    const groqJson = (await groqResponse.json()) as {
      choices?: { message?: { content?: string } }[]
    }
    const content = groqJson.choices?.[0]?.message?.content
    if (!content) {
      console.error("Groq returned an empty response")
      await client.from("import_proposals").update({ status: "failed" }).eq("id", proposalId)
      return json({ skipped: "parse failed" })
    }

    raw = JSON.parse(content)
  } catch {
    console.error("receive-booking-email Groq call threw")
    await client.from("import_proposals").update({ status: "failed" }).eq("id", proposalId)
    return json({ skipped: "parse failed" })
  }

  const events = normalizeEvents(raw)
  const unambiguous = events.length >= 1 && events.every((e) => e.title && hasValidWindow(e))

  if (autoValidate && unambiguous) {
    // No client here to run matchParticipants, so participants default to whole-group (null).
    const { error: eventsError } = await client.from("trip_events").insert(
      events.map((e) => ({
        trip_id: tripId,
        title: e.title,
        type: e.type,
        starts_at: e.startsAt,
        ends_at: e.endsAt,
        notes: e.notes,
        lat: e.location?.lat ?? null,
        lng: e.location?.lng ?? null,
        location_name: e.location?.name ?? null,
        gate_location: e.gateLocation ?? null,
        end_location: e.endLocation ?? null,
        participants: null,
        created_by: null,
      })),
    )
    if (eventsError) {
      // Terminal, not 500: the webhook is already claimed, so a Brevo retry would just be
      // swallowed as a duplicate - leaving this row at 'parsing' would strand it forever. The
      // status update is best-effort (its own error is ignored) since we're already failing.
      console.error("receive-booking-email trip_events insert failed", eventsError?.code)
      await client.from("import_proposals").update({ status: "failed" }).eq("id", proposalId)
      return json({ skipped: "insert failed" })
    }

    const { error: updateError } = await client
      .from("import_proposals")
      // Clears sender_email (third-party PII no longer needed once validated), mirroring
      // validate_import_proposal's manual-review counterpart.
      .update({
        status: "validated",
        validated_at: new Date().toISOString(),
        events,
        sender_email: null,
      })
      .eq("id", proposalId)
    if (updateError) {
      console.error("receive-booking-email proposal update failed", updateError?.code)
      await client.from("import_proposals").update({ status: "failed" }).eq("id", proposalId)
      return json({ skipped: "update failed" })
    }
  } else {
    const { error: updateError } = await client
      .from("import_proposals")
      .update({ status: "pending", events })
      .eq("id", proposalId)
    if (updateError) {
      console.error("receive-booking-email proposal update failed", updateError?.code)
      await client.from("import_proposals").update({ status: "failed" }).eq("id", proposalId)
      return json({ skipped: "update failed" })
    }
  }

  return json({ ok: true })
})
