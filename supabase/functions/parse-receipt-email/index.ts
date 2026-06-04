// Smart Import — parses a pasted confirmation email (flight, hotel, train, activity)
// into a structured itinerary event via Groq Llama. Pilier 1 du pitch ZYPH.
//
// Architecture: app mobile → cette Edge Function → Groq API → JSON structuré → app.
// La clé GROQ_API_KEY est stockée comme secret Supabase (jamais dans le bundle).
//
// Env vars (set via `supabase secrets set`):
//   GROQ_API_KEY   — required, your Groq API key
//   GROQ_MODEL     — optional, defaults to llama-3.1-8b-instant
//   GROQ_BASE_URL  — optional, defaults to https://api.groq.com/openai/v1

import "@supabase/functions-js/edge-runtime.d.ts"
import { withSupabase } from "@supabase/server"

const DEFAULT_MODEL = "llama-3.1-8b-instant"
const DEFAULT_BASE_URL = "https://api.groq.com/openai/v1"

const SYSTEM_PROMPT = `You are an assistant that extracts travel itinerary events from confirmation emails (flights, hotels, trains, car rentals, activities, restaurant reservations).

Extract a single event when the email is clearly about one reservation. Return only valid JSON matching the schema below. When a field is not in the email, use null.

Schema:
{
  "type": "flight" | "hotel" | "transport" | "activity" | "event",
  "title": string,                      // short human title, e.g. "Flight AF1234 CDG → JFK"
  "startsAt": string | null,            // ISO 8601 timestamp with timezone
  "endsAt": string | null,              // ISO 8601 timestamp with timezone (or null for point events)
  "location": { "name": string, "lat": number | null, "lng": number | null } | null,
  "gateLocation": { "label": string, "lat": number | null, "lng": number | null } | null,
  "notes": string | null,               // additional info (reservation number, terminal, WiFi code, ...)
  "currency": string | null,            // ISO 4217 if a price appears
  "priceCents": integer | null,         // total price in cents
  "confidence": number                  // 0.0 - 1.0 estimate of how confident you are
}

Rules:
- For flights, title MUST include flight number and route.
- For hotels, startsAt = check-in datetime, endsAt = check-out datetime.
- gateLocation only when terminal/gate is explicit AND lat/lng can be inferred from major airport coordinates (otherwise null).
- If you cannot extract a meaningful event, return { "type": "event", "title": null, ... "confidence": 0 }.
- Output JSON only. No prose.`

type Event = {
  type: "flight" | "hotel" | "transport" | "activity" | "event"
  title: string | null
  startsAt: string | null
  endsAt: string | null
  location: { name: string; lat: number | null; lng: number | null } | null
  gateLocation: { label: string; lat: number | null; lng: number | null } | null
  notes: string | null
  currency: string | null
  priceCents: number | null
  confidence: number
}

export default {
  fetch: withSupabase({ auth: ["publishable"] }, async (req) => {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 })
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
        max_tokens: 800,
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

    let event: Event
    try {
      event = JSON.parse(content) as Event
    } catch {
      console.error("Could not parse LLM response", content)
      return Response.json({ error: "Could not parse LLM response" }, { status: 502 })
    }

    return Response.json({ event })
  }),
}
