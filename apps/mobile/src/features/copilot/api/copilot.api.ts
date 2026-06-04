import { supabase } from '@/lib/supabase'

import { type CopilotAnswer, copilotAnswerSchema } from '../schemas'

export type CopilotMessage = { role: 'user' | 'assistant'; content: string }

export type AskCopilotInput = {
  context: string
  language: 'en' | 'fr'
  // Full conversation so far; the last message is the new user question.
  messages: CopilotMessage[]
}

export async function askCopilot(input: AskCopilotInput): Promise<{ answer: string }> {
  const { data, error } = await supabase.functions.invoke<CopilotAnswer>('copilot', {
    body: input,
  })
  if (error) {
    throw error
  }
  if (!data) {
    throw new Error('Empty response from the copilot.')
  }
  // Validate at the boundary: the function returns free text, enforce the shape here.
  const parsed = copilotAnswerSchema.parse(data)
  return { answer: parsed.answer }
}
