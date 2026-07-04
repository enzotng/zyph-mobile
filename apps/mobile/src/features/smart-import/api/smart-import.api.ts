import { supabase } from '@/lib/supabase'

import { type ParsedEmailEvent, parsedEmailEventSchema, parseEmailResponseSchema } from '../schemas'

export type ParseEmailResult = {
  events: ParsedEmailEvent[]
}

export async function parseEmailViaAi(text: string): Promise<ParseEmailResult> {
  const { data, error } = await supabase.functions.invoke<unknown>('parse-receipt-email', {
    body: { text },
  })
  if (error) {
    throw error
  }
  if (!data) {
    throw new Error('Empty response from the parser.')
  }
  // Validate at the boundary: the envelope must be a list (throw = final guard, surfaced as the
  // friendly parse alert); each item is validated tolerantly so one corrupt entry drops itself
  // without discarding the rest (same pattern as the POI boundary).
  const envelope = parseEmailResponseSchema.parse(data)
  const events = envelope.events.flatMap((item) => {
    const parsed = parsedEmailEventSchema.safeParse(item)
    return parsed.success ? [parsed.data] : []
  })
  return { events }
}
