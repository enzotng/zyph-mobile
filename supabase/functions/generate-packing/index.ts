// Packing-list generator — asks the LLM for a structured packing list tailored to ONE trip
// (destination, length, weather), and returns validated items the client adds to its list.
// Mirrors the copilot function: stateless, Groq via a Supabase secret, no DB access here.
//
// Env vars (set via `supabase secrets set`):
//   GROQ_API_KEY   — required (shared with the copilot function)
//   GROQ_MODEL     — optional, defaults to llama-3.1-8b-instant
//   GROQ_BASE_URL  — optional, defaults to https://api.groq.com/openai/v1

import "@supabase/functions-js/edge-runtime.d.ts"
import { withSupabase } from "@supabase/server"

import { isWithinRateLimit } from "../_shared/rate-limit.ts"

const DEFAULT_MODEL = "llama-3.1-8b-instant"
const DEFAULT_BASE_URL = "https://api.groq.com/openai/v1"
const CATEGORIES = ["clothes", "toiletries", "documents", "electronics", "health", "other"]
const MAX_ITEMS = 40

const SYSTEM_PROMPT = `You are Zo, ZYPH's travel copilot. You build a smart packing list for ONE trip.

Return ONLY JSON of the exact shape:
{"items":[{"label": string, "category": one of ["clothes","toiletries","documents","electronics","health","other"], "quantity": integer >= 1, "reason": string, "communal": boolean}]}

Rules:
- Set "communal" true for gear ONE of which serves the whole group (tent, first-aid kit, speaker, board games, power strip, sunscreen); false for per-person items (clothes, toothbrush, passport). When LIST TYPE is personal, "communal" MUST always be false.
- Tailor the list to the DESTINATION, TRIP LENGTH, WEATHER and PLANNED ACTIVITIES (e.g. a hike -> boots, a beach -> swimwear, a dinner -> smart outfit).
- WEATHER is a per-day forecast ("date condition max/min"). Pack for the actual conditions and, when an item is weather-driven, justify it by the day/condition in the reason (e.g. "rain Tue", "cold nights").
- Quantities are realistic for the trip length assuming occasional laundry (e.g. tops ~ min(days, 7), underwear ~ days, one jacket).
- If SHARED is true and TRAVELERS > 1, this is ONE communal list for the whole GROUP: pack ONE of each communal item (tent, first-aid kit, speaker, sunscreen, board games, power strip) for the group, NOT one per person. Never multiply shared gear by the number of travellers.
- If PACK LIGHT is true, minimise clothing: assume laundry is available, cap repeat-wear basics (socks, underwear, tops) to about 5, and prefer versatile layers.
- "label" is short (1-4 words), no brand names.
- "reason" is a SHORT justification (max 6 words), concrete, e.g. "rain Tue", "hike planned", "5-day trip".
- If a USER REQUEST is given, bias the list strongly toward it.
- In gaps MODE you are given the CURRENT LIST: return ONLY items that are MISSING yet clearly needed given the weather/activities (e.g. rain forecast but no rain jacket). Never repeat items already present.
- generate MODE: 8 to 20 items. gaps MODE: up to 12 items. No duplicates ever.
- Output JSON only, no markdown. Write labels and reasons in the language given by LANGUAGE (fr = French, en = English).`

export default {
  fetch: withSupabase({ auth: ["publishable"] }, async (req, ctx) => {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 })
    }
    if (!(await isWithinRateLimit(ctx.supabase, "generate-packing", 10, 60))) {
      return Response.json({ error: "Too many requests, please slow down." }, { status: 429 })
    }

    let body: {
      destination?: unknown
      days?: unknown
      weather?: unknown
      language?: unknown
      activities?: unknown
      hint?: unknown
      mode?: unknown
      existing?: unknown
      travelers?: unknown
      shared?: unknown
      packLight?: unknown
    }
    try {
      body = await req.json()
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const destination =
      typeof body.destination === "string" ? body.destination.trim().slice(0, 200) : ""
    const days =
      typeof body.days === "number" && Number.isFinite(body.days)
        ? Math.max(1, Math.min(60, Math.floor(body.days)))
        : null
    const weather = typeof body.weather === "string" ? body.weather.trim().slice(0, 500) : ""
    const language = body.language === "fr" ? "fr" : "en"
    const activities = typeof body.activities === "string" ? body.activities.trim().slice(0, 1500) : ""
    const hint = typeof body.hint === "string" ? body.hint.trim().slice(0, 300) : ""
    const mode = body.mode === "gaps" ? "gaps" : "generate"
    const existing = Array.isArray(body.existing)
      ? body.existing
          .filter((x): x is string => typeof x === "string")
          .slice(0, 120)
          .map((x) => x.trim().slice(0, 80))
      : []
    const travelers =
      typeof body.travelers === "number" && Number.isFinite(body.travelers)
        ? Math.max(1, Math.min(50, Math.floor(body.travelers)))
        : 1
    const shared = body.shared === true
    const packLight = body.packLight === true

    if (!destination) {
      return Response.json({ error: "destination is required" }, { status: 400 })
    }

    const groqKey = Deno.env.get("GROQ_API_KEY")
    if (!groqKey) {
      return Response.json({ error: "GROQ_API_KEY is not configured" }, { status: 500 })
    }
    const model = Deno.env.get("GROQ_MODEL") || DEFAULT_MODEL
    const baseUrl = Deno.env.get("GROQ_BASE_URL") || DEFAULT_BASE_URL

    const userPrompt = `LANGUAGE: ${language}
MODE: ${mode}
DESTINATION: ${destination}
TRIP LENGTH: ${days ? `${days} days` : "unknown"}
TRAVELERS: ${travelers}
LIST TYPE: ${shared ? "shared group list" : "personal list"}
PACK LIGHT: ${packLight ? "yes" : "no"}
WEATHER: ${weather || "unknown"}
PLANNED ACTIVITIES:
${activities || "(none listed)"}${hint ? `\nUSER REQUEST: ${hint}` : ""}${
      mode === "gaps"
        ? `\nCURRENT LIST (do not repeat any of these):\n${existing.length ? existing.map((e) => `- ${e}`).join("\n") : "(empty)"}`
        : ""
    }`

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
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 800,
        response_format: { type: "json_object" },
      }),
    })

    if (!groqResponse.ok) {
      const errText = await groqResponse.text()
      console.error("Groq API error", groqResponse.status, errText)
      return Response.json({ error: `LLM provider returned ${groqResponse.status}` }, { status: 502 })
    }

    const groqJson = (await groqResponse.json()) as {
      choices?: { message?: { content?: string } }[]
    }
    const content = groqJson.choices?.[0]?.message?.content
    if (!content) {
      return Response.json({ error: "LLM returned an empty response" }, { status: 502 })
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(content)
    } catch {
      return Response.json({ error: "LLM returned invalid JSON" }, { status: 502 })
    }

    // Validate + clamp every item server-side; never trust the model's shape.
    const rawItems = Array.isArray((parsed as { items?: unknown })?.items)
      ? ((parsed as { items: unknown[] }).items)
      : []
    const items: {
      label: string
      category: string
      quantity: number
      reason: string
      communal: boolean
    }[] = []
    for (const raw of rawItems) {
      const item = raw as {
        label?: unknown
        category?: unknown
        quantity?: unknown
        reason?: unknown
        communal?: unknown
      }
      const label = typeof item.label === "string" ? item.label.trim().slice(0, 80) : ""
      const category =
        typeof item.category === "string" && CATEGORIES.includes(item.category)
          ? item.category
          : "other"
      const quantity =
        typeof item.quantity === "number" && Number.isFinite(item.quantity)
          ? Math.max(1, Math.min(99, Math.floor(item.quantity)))
          : 1
      const reason = typeof item.reason === "string" ? item.reason.trim().slice(0, 60) : ""
      // Communal only makes sense for a multi-traveller shared list; never trust the model on
      // a personal or single-traveller list.
      const communal = item.communal === true && shared && travelers > 1
      if (label) {
        items.push({ label, category, quantity, reason, communal })
      }
      if (items.length >= MAX_ITEMS) {
        break
      }
    }

    return Response.json({ items })
  }),
}
