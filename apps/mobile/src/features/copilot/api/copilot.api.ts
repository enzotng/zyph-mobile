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
  // Validate at the boundary: the function returns an answer OR a proposed action.
  return copilotResponseSchema.parse(data)
}
