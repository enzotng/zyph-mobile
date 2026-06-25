import { supabase } from '@/lib/supabase'

import { type CopilotResponse, copilotResponseSchema } from '../schemas'

export type CopilotMessage = { role: 'user' | 'assistant'; content: string }

export type AskCopilotInput = {
  context: string
  language: 'en' | 'fr'
  // Full conversation so far; the last message is the new user question.
  messages: CopilotMessage[]
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
  // Validate at the boundary: the function returns a blocks array.
  return copilotResponseSchema.parse(data)
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
