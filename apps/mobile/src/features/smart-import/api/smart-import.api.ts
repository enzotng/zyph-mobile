import { supabase } from '@/lib/supabase'

import { type ParsedEmailEvent, parsedEmailEventSchema } from '../schemas'

export type ParseEmailResult = {
  event: ParsedEmailEvent
}

export async function parseEmailViaAi(text: string): Promise<ParseEmailResult> {
  const { data, error } = await supabase.functions.invoke<ParseEmailResult>('parse-receipt-email', {
    body: { text },
  })
  if (error) {
    throw error
  }
  if (!data) {
    throw new Error('Empty response from the parser.')
  }
  // Validate at the boundary: the LLM can return unexpected shapes, this is the
  // contract enforcement before the data hits any UI.
  const parsedEvent = parsedEmailEventSchema.parse(data.event)
  return { event: parsedEvent }
}
