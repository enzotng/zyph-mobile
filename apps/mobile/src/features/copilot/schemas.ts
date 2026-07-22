import { z } from 'zod'

import { isValidCategory, isValidSubcategory } from '@/features/taxonomy'

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
  'spend_by_category',
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

// --- Navigation targets for chips ---
export const NAV_TARGETS = [
  'trip_home',
  'spend',
  'timeline',
  'packing',
  'map',
  'balances',
  'group',
  'activities',
] as const
export const navTargetSchema = z.enum(NAV_TARGETS)
export type NavTarget = z.infer<typeof navTargetSchema>

// --- Chip schemas ---
const navigateChipSchema = z.object({
  action: z.literal('navigate'),
  to: navTargetSchema,
  label: z.string().min(1),
})

const promptChipSchema = z.object({
  action: z.literal('prompt'),
  prompt: z.string().min(1),
  label: z.string().min(1),
})

const toolChipSchema = z.object({
  action: z.literal('tool'),
  tool: copilotActionSchema.shape.tool,
  args: copilotActionSchema.shape.args,
  label: z.string().min(1),
})

export const chipSchema = z.discriminatedUnion('action', [
  navigateChipSchema,
  promptChipSchema,
  toolChipSchema,
])
export type Chip = z.infer<typeof chipSchema>

export const chipsBlockSchema = z.object({
  kind: z.literal('chips'),
  chips: z.array(chipSchema).min(1).max(3),
})

// --- Itinerary block ---
const itineraryItemSchema = z.object({
  placeId: z.string().min(1),
  title: z.string().min(1),
  category: z
    .string()
    .catch('activity')
    .transform((v) => (isValidCategory(v) ? v : 'activity')),
  subcategory: z
    .string()
    .nullable()
    .catch(null)
    .transform((v) => (v && isValidSubcategory(v) ? v : null)),
  time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  notes: z.string().optional(),
})
const itineraryDaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  items: z.array(itineraryItemSchema).min(1).max(6),
})
export const itineraryBlockSchema = z.object({
  kind: z.literal('itinerary'),
  days: z.array(itineraryDaySchema).min(1).max(14),
})

export type ItineraryItem = z.infer<typeof itineraryItemSchema>
export type ItineraryDay = z.infer<typeof itineraryDaySchema>
export type ItineraryBlock = z.infer<typeof itineraryBlockSchema>

export const blockSchema = z.discriminatedUnion('kind', [
  textBlockSchema,
  widgetBlockSchema,
  actionBlockSchema,
  chipsBlockSchema,
  itineraryBlockSchema,
])

export type Block = z.infer<typeof blockSchema>

export const copilotResponseSchema = z.object({
  blocks: z.array(blockSchema).min(1),
})
export type CopilotResponse = z.infer<typeof copilotResponseSchema>
