import { supabase } from '@/lib/supabase'

import type { PackingCategory, PackingItem, PackingScope, SuggestedItem } from '../schemas'

export async function listPackingItems(tripId: string): Promise<PackingItem[]> {
  // RLS returns the trip's shared items plus the caller's own personal items.
  const { data, error } = await supabase
    .from('packing_items')
    .select('*')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: true })
  if (error) {
    throw error
  }
  return data
}

export type NewPackingItem = {
  tripId: string
  scope: PackingScope
  ownerId: string
  label: string
  category: PackingCategory
  quantity: number
  assignedMember?: string | null
}

function toRow(item: NewPackingItem) {
  return {
    trip_id: item.tripId,
    scope: item.scope,
    owner_id: item.ownerId,
    label: item.label,
    category: item.category,
    quantity: item.quantity,
    assigned_member: item.assignedMember ?? null,
  }
}

export async function addPackingItem(item: NewPackingItem): Promise<PackingItem> {
  const { data, error } = await supabase.from('packing_items').insert(toRow(item)).select().single()
  if (error) {
    throw error
  }
  return data
}

// Bulk insert (used by the AI generation, which adds several deduped items at once).
export async function addPackingItems(items: NewPackingItem[]): Promise<void> {
  if (items.length === 0) {
    return
  }
  const { error } = await supabase.from('packing_items').insert(items.map(toRow))
  if (error) {
    throw error
  }
}

export type PackingItemPatch = {
  label?: string
  category?: PackingCategory
  quantity?: number
  packed?: boolean
  assignedMember?: string | null
}

export async function updatePackingItem(id: string, patch: PackingItemPatch): Promise<void> {
  const { error } = await supabase
    .from('packing_items')
    .update({
      ...(patch.label !== undefined ? { label: patch.label } : {}),
      ...(patch.category !== undefined ? { category: patch.category } : {}),
      ...(patch.quantity !== undefined ? { quantity: patch.quantity } : {}),
      ...(patch.packed !== undefined ? { packed: patch.packed } : {}),
      ...(patch.assignedMember !== undefined ? { assigned_member: patch.assignedMember } : {}),
    })
    .eq('id', id)
  if (error) {
    throw error
  }
}

export async function deletePackingItem(id: string): Promise<void> {
  const { error } = await supabase.from('packing_items').delete().eq('id', id)
  if (error) {
    throw error
  }
}

export type GeneratePackingInput = {
  destination: string
  days: number | null
  weather: string
  language: string
  // Compact summary of the trip's planned events, so the list reflects the actual activities.
  activities?: string
  // Optional free-text "refine with Zo" request.
  hint?: string
  // 'generate' builds a fresh list; 'gaps' returns only missing items (with a reason each).
  mode?: 'generate' | 'gaps'
  // Current item labels, so gaps mode does not repeat what is already there.
  existing?: string[]
  // Group size and whether this is the SHARED list, so Zo packs communal gear once for the
  // group (one tent) instead of one per traveller.
  travelers?: number
  shared?: boolean
  // Minimise clothing quantities assuming laundry is available.
  packLight?: boolean
}

// Asks the generate-packing Edge Function for a tailored list. The function validates and
// clamps every item server-side, so here we just narrow the shape.
export async function generatePackingSuggestions(
  input: GeneratePackingInput,
): Promise<SuggestedItem[]> {
  const { data, error } = await supabase.functions.invoke('generate-packing', {
    body: {
      destination: input.destination,
      days: input.days,
      weather: input.weather,
      language: input.language,
      activities: input.activities ?? '',
      hint: input.hint ?? '',
      mode: input.mode ?? 'generate',
      existing: input.existing ?? [],
      travelers: input.travelers ?? 1,
      shared: input.shared ?? false,
      packLight: input.packLight ?? false,
    },
  })
  if (error) {
    throw error
  }
  const items = (data as { items?: unknown })?.items
  return Array.isArray(items) ? (items as SuggestedItem[]) : []
}
