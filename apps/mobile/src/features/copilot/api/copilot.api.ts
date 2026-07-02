import type { Poi } from '@/features/places'
import { supabase } from '@/lib/supabase'

import { type Block, blockSchema, type CopilotResponse, copilotResponseSchema } from '../schemas'

export type CopilotMessage = { role: 'user' | 'assistant'; content: string }

export type AskCopilotInput = {
  context: string
  language: 'en' | 'fr'
  // Full conversation so far; the last message is the new user question.
  messages: CopilotMessage[]
  // POI candidates fetched when the turn looks like a planning request. Forwarded
  // to the edge function so the model can reference real places in the itinerary.
  candidates?: Poi[]
}

export async function askCopilot(input: AskCopilotInput): Promise<CopilotResponse> {
  const { data, error } = await supabase.functions.invoke<CopilotResponse>('copilot', {
    body: input,
  })
  if (error) {
    throw error
  }
  if (!data) {
    throw new Error('Empty response from the copilot.')
  }

  // Validate the envelope, then each block individually: one block an older client doesn't know
  // yet (e.g. a navigate chip whose target enum grew server-side) should not discard the whole
  // assistant turn. Mirrors history.ts's migrateMessage, which applies the same per-block
  // tolerance to persisted history.
  const rawBlocks = (data as { blocks?: unknown }).blocks
  if (!Array.isArray(rawBlocks) || rawBlocks.length === 0) {
    // Same envelope-shape failure as before - let zod produce the usual error.
    return copilotResponseSchema.parse(data)
  }

  const validBlocks: Block[] = rawBlocks
    .map((block: unknown) => blockSchema.safeParse(block))
    .filter((result): result is { success: true; data: Block } => result.success)
    .map((result) => result.data)

  if (validBlocks.length === 0) {
    // Total garbage still surfaces the error bubble, same as before.
    return copilotResponseSchema.parse(data)
  }

  return { blocks: validBlocks }
}

export type CopilotErrorKind = 'rateLimited' | 'offline' | 'generic'

// Maps a thrown askCopilot error to a user-facing category so the chat shows a specific message
// (and Retry) instead of one catch-all. Duck-typed on the supabase-js error shape so it stays
// testable without constructing a Response: FunctionsHttpError carries the HTTP status on
// `context`; FunctionsFetchError means the request never reached the server (offline).
export function classifyCopilotError(error: unknown): CopilotErrorKind {
  const candidate = error as { name?: unknown; context?: { status?: unknown } } | null
  if (candidate?.name === 'FunctionsHttpError') {
    return candidate.context?.status === 429 ? 'rateLimited' : 'generic'
  }
  if (candidate?.name === 'FunctionsFetchError') {
    return 'offline'
  }
  return 'generic'
}
