import { z } from 'zod'

// The copilot edge function returns either a text answer or a PROPOSED action (never executed
// server-side). Validate the envelope at the boundary before it reaches the UI.
export const copilotActionSchema = z.object({
  tool: z.enum(['add_expense', 'add_event', 'add_packing', 'record_settlement']),
  args: z.record(z.string(), z.unknown()),
  text: z.string().min(1),
})
export type CopilotAction = z.infer<typeof copilotActionSchema>
export type CopilotTool = CopilotAction['tool']

// A widget the copilot can attach to a text answer to visualise it. The model only picks the
// TYPE; the client renders the card from its own cached trip data, so the figures are always
// real (never produced by the LLM).
export const COPILOT_WIDGET_TYPES = [
  'weather',
  'balances',
  'next_events',
  'packing',
  'expenses',
] as const
export const copilotWidgetSchema = z.enum(COPILOT_WIDGET_TYPES)
export type CopilotWidgetType = z.infer<typeof copilotWidgetSchema>

export const copilotResponseSchema = z
  .object({
    answer: z.string().min(1).optional(),
    action: copilotActionSchema.optional(),
    widget: copilotWidgetSchema.optional(),
  })
  .refine((d) => Boolean(d.answer) || Boolean(d.action), {
    message: 'The copilot returned neither an answer nor an action.',
  })
export type CopilotResponse = z.infer<typeof copilotResponseSchema>
