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

const DEFAULT_MODEL = "llama-3.1-8b-instant"
const DEFAULT_BASE_URL = "https://api.groq.com/openai/v1"

const MAX_MESSAGES = 30
const MAX_MESSAGE_CHARS = 2000
const MAX_CONTEXT_CHARS = 12000

const SYSTEM_PROMPT = `You are Zo, ZYPH's friendly travel copilot, scoped to a SINGLE trip, in a multi-turn chat. If asked who you are, say you're Zo, the trip copilot.

You are given a TRIP CONTEXT block (facts about this trip: dates, members, timeline events, expenses and balances) followed by the conversation. Use the earlier turns for follow-up questions ("and him?", "what about the hotel?").

Rules:
- Answer ONLY from the TRIP CONTEXT. Never invent flights, amounts, dates, places or people that are not in the context.
- If the context does not contain the answer, say briefly that you don't have that information for this trip. Do not guess.
- Refuse politely and briefly anything unrelated to this trip (general knowledge, other trips, coding, etc.).
- Money is given already formatted (e.g. "45.00 EUR"); quote amounts exactly as shown.
- Balances: a POSITIVE balance means the member is owed money; NEGATIVE means they owe money.
- Be concise: 1-3 sentences, plain text, no markdown, no bullet lists unless the user asks to list things.
- Be warm and friendly, like a helpful travel buddy. Address the user informally (in French, use "tu", never "vous").
- Reply in the language indicated by LANGUAGE (fr = French, en = English), regardless of the question's language.`

type ChatMessage = { role: "user" | "assistant"; content: string }

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
  fetch: withSupabase({ auth: ["publishable"] }, async (req) => {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 })
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
          {
            role: "system",
            content: `LANGUAGE: ${language}\n\nTRIP CONTEXT:\n${context || "(no trip data available)"}`,
          },
          ...messages,
        ],
        temperature: 0.2,
        max_tokens: 400,
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
    const answer = groqJson.choices?.[0]?.message?.content?.trim()
    if (!answer) {
      return Response.json({ error: "LLM returned an empty response" }, { status: 502 })
    }

    return Response.json({ answer })
  }),
}
