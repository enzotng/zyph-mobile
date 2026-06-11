// AI Copilot — answers free-text questions about ONE trip across a multi-turn chat,
// grounded in a compact trip-context string the client builds from its cached data.
// Pilier 5 du pitch ZYPH.
//
// Architecture: app mobile → cette Edge Function → Groq API → réponse texte → app.
// Stateless: aucune lecture DB ici. Le contexte + l'historique arrivent du client.
// La clé GROQ_API_KEY est un secret Supabase (jamais dans le bundle).
//
// Env vars (set via `supabase secrets set`):
//   GROQ_API_KEY   — required
//   GROQ_MODEL     — optional, defaults to llama-3.1-8b-instant
//   GROQ_BASE_URL  — optional, defaults to https://api.groq.com/openai/v1

import "@supabase/functions-js/edge-runtime.d.ts"
import { withSupabase } from "@supabase/server"

import { isWithinRateLimit } from "../_shared/rate-limit.ts"

const DEFAULT_MODEL = "llama-3.1-8b-instant"
const DEFAULT_BASE_URL = "https://api.groq.com/openai/v1"

const MAX_MESSAGES = 30
const MAX_MESSAGE_CHARS = 2000
const MAX_CONTEXT_CHARS = 12000

// Abort a stuck upstream call rather than hanging the whole request; retry once on a transient
// upstream failure (timeout, network, 429, 5xx) with a short backoff.
const GROQ_TIMEOUT_MS = 25_000
const GROQ_ATTEMPTS = 2

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const TOOLS = ["add_expense", "add_event", "add_packing", "record_settlement"]
const WIDGETS = ["weather", "balances", "next_events", "packing", "expenses"]

const SYSTEM_PROMPT = `You are Zo, ZYPH's friendly travel copilot, scoped to a SINGLE trip, in a multi-turn chat. If asked who you are, say you're Zo, the trip copilot.

You are given a TRIP CONTEXT block (facts about this trip: dates, members, balances, timeline events, expenses, packing, recorded settlements, and a short weather forecast) followed by the conversation. Use earlier turns for follow-ups.

You can do TWO things:
1) ANSWER a question about this trip.
2) PROPOSE ONE ACTION, only when the user clearly asks to DO/ADD/CREATE/RECORD something in the app.

ALWAYS reply with a SINGLE JSON object, exactly one of these shapes:
{"type":"answer","text":"<your reply>","widget":"<optional, see WIDGETS>"}
{"type":"action","tool":"<tool>","args":{...},"text":"<one short sentence, in the user's language, asking them to confirm>"}

Available tools (propose at most one; the user will confirm before anything is written):
- "add_expense": {"description": string, "amount": number, "splitWith": "all" OR array of member names}. Paid by the current user. amount is in the trip currency.
- "add_event": {"title": string, "type": string (flight|hotel|activity|restaurant|transport|event), "date": "YYYY-MM-DD", "time": "HH:MM" optional}.
- "add_packing": {"scope": "shared" OR "personal", "request": string describing what to pack}.
- "record_settlement": {"from": member name who paid, "to": member name who received, "amount": number}.

WIDGETS (optional, ANSWER only): add a "widget" field to show a card under your text when it directly illustrates the answer. Use at most one, and ONLY when relevant - otherwise omit it. Always still write the text.
- "weather": the user asks about the weather, forecast, or what to wear/bring.
- "balances": about who owes what, balances, or settling up.
- "next_events": about the schedule, what's next, or upcoming plans.
- "packing": about packing or what is left to pack.
- "expenses": about spending, budget, or costs by category.

Rules:
- Propose an action ONLY for an explicit add/create/record request. Anything else -> ANSWER.
- Use member names exactly as in MEMBERS. For the current user use "me".
- Answers: 1-3 sentences, plain text, grounded ONLY in the TRIP CONTEXT, never invent facts; if unknown, say so briefly. Refuse politely anything unrelated to this trip.
- Money in context is already formatted; quote exactly. POSITIVE balance = owed money; NEGATIVE = owes.
- Be warm; address the user informally (in French use "tu"). Reply in the language given by LANGUAGE (fr/en). Output JSON only, no markdown.`

type ChatMessage = { role: "user" | "assistant"; content: string }

// Calls the LLM with a per-attempt timeout, retrying once on a timeout/network error or a
// transient upstream status. Throws only if every attempt fails to produce a response.
async function callGroqWithRetry(url: string, init: RequestInit): Promise<Response> {
  let lastError: unknown
  for (let attempt = 1; attempt <= GROQ_ATTEMPTS; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), GROQ_TIMEOUT_MS)
    try {
      const response = await fetch(url, { ...init, signal: controller.signal })
      clearTimeout(timer)
      // Retry once on a transient upstream status; drain the body so the socket can be reused.
      if ((response.status === 429 || response.status >= 500) && attempt < GROQ_ATTEMPTS) {
        await response.text().catch(() => undefined)
        await sleep(500 * attempt)
        continue
      }
      return response
    } catch (error) {
      clearTimeout(timer)
      lastError = error
      if (attempt < GROQ_ATTEMPTS) {
        await sleep(500 * attempt)
        continue
      }
    }
  }
  throw lastError ?? new Error("LLM request failed")
}

function parseMessages(raw: unknown): ChatMessage[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_MESSAGES) {
    return null
  }
  const out: ChatMessage[] = []
  for (const item of raw) {
    const role = (item as { role?: unknown })?.role
    const content = (item as { content?: unknown })?.content
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") {
      return null
    }
    const trimmed = content.trim()
    if (trimmed.length === 0 || trimmed.length > MAX_MESSAGE_CHARS) {
      return null
    }
    out.push({ role, content: trimmed })
  }
  // The latest turn must be the user's new question.
  if (out[out.length - 1].role !== "user") {
    return null
  }
  return out
}

export default {
  fetch: withSupabase({ auth: ["publishable"] }, async (req, ctx) => {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 })
    }
    if (!(await isWithinRateLimit(ctx.supabase, "copilot", 20, 60))) {
      return Response.json({ error: "Too many requests, please slow down." }, { status: 429 })
    }

    let body: { context?: unknown; language?: unknown; messages?: unknown }
    try {
      body = await req.json()
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const context = typeof body.context === "string" ? body.context.trim() : ""
    const language = body.language === "fr" ? "fr" : "en"
    const messages = parseMessages(body.messages)

    if (!messages) {
      return Response.json({ error: "Invalid or empty messages" }, { status: 400 })
    }
    if (context.length > MAX_CONTEXT_CHARS) {
      return Response.json(
        { error: `Context is too long (maximum ${MAX_CONTEXT_CHARS} characters)` },
        { status: 400 },
      )
    }

    const groqKey = Deno.env.get("GROQ_API_KEY")
    if (!groqKey) {
      return Response.json({ error: "GROQ_API_KEY is not configured" }, { status: 500 })
    }
    const model = Deno.env.get("GROQ_MODEL") || DEFAULT_MODEL
    const baseUrl = Deno.env.get("GROQ_BASE_URL") || DEFAULT_BASE_URL

    let groqResponse: Response
    try {
      groqResponse = await callGroqWithRetry(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${groqKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "system",
              content: `LANGUAGE: ${language}\n\nTRIP CONTEXT:\n${context || "(no trip data available)"}`,
            },
            ...messages,
          ],
          temperature: 0.2,
          max_tokens: 600,
          response_format: { type: "json_object" },
        }),
      })
    } catch (error) {
      // Timed out or never reached the provider after retrying.
      console.error("Groq request failed", error)
      return Response.json({ error: "The copilot is unavailable right now." }, { status: 503 })
    }

    if (!groqResponse.ok) {
      const errText = await groqResponse.text()
      console.error("Groq API error", groqResponse.status, errText)
      return Response.json({ error: `LLM provider returned ${groqResponse.status}` }, { status: 502 })
    }

    const groqJson = (await groqResponse.json()) as {
      choices?: { message?: { content?: string } }[]
    }
    const content = groqJson.choices?.[0]?.message?.content?.trim()
    if (!content) {
      return Response.json({ error: "LLM returned an empty response" }, { status: 502 })
    }

    let parsed: { type?: unknown; text?: unknown; tool?: unknown; args?: unknown; widget?: unknown }
    try {
      parsed = JSON.parse(content)
    } catch {
      // Defensive: if the model ignored JSON mode, surface the raw text as an answer.
      return Response.json({ answer: content })
    }

    const text = typeof parsed.text === "string" ? parsed.text.trim() : ""

    // An action is only ever PROPOSED here - the client confirms and executes it under the
    // user's own RLS. We just validate the envelope shape.
    if (parsed.type === "action" && typeof parsed.tool === "string" && TOOLS.includes(parsed.tool)) {
      const args = parsed.args && typeof parsed.args === "object" ? parsed.args : {}
      // The client schema requires a non-empty text; fall back in the user's language.
      const fallback = language === "fr" ? "Je confirme ?" : "Confirm?"
      return Response.json({ action: { tool: parsed.tool, args, text: text || fallback } })
    }

    // The client renders the card from its own cached data; we only pass through a valid type.
    const widget = typeof parsed.widget === "string" && WIDGETS.includes(parsed.widget)
      ? parsed.widget
      : undefined
    const answer = text || content
    return Response.json(widget ? { answer, widget } : { answer })
  }),
}
