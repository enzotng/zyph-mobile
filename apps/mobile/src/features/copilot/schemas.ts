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

// --- Block schemas ---

export const textBlockSchema = z.object({
  kind: z.literal('text'),
  text: z.string().min(1),
})

export const widgetBlockSchema = z.object({
  kind: z.literal('widget'),
  source: copilotWidgetSchema,
})

export const actionBlockSchema = z.object({
  kind: z.literal('action'),
  tool: copilotActionSchema.shape.tool,
  args: copilotActionSchema.shape.args,
  text: copilotActionSchema.shape.text,
})

export const blockSchema = z.discriminatedUnion('kind', [
  textBlockSchema,
  widgetBlockSchema,
  actionBlockSchema,
])

export type Block = z.infer<typeof blockSchema>

export const copilotResponseSchema = z.object({
  blocks: z.array(blockSchema).min(1),
})
export type CopilotResponse = z.infer<typeof copilotResponseSchema>
