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

// Bulk insert (used by the AI generation, which adds several deduped items at once). Returns the
// inserted rows so the caller can offer a one-tap "undo all" of the batch just added.
export async function addPackingItems(items: NewPackingItem[]): Promise<PackingItem[]> {
  if (items.length === 0) {
    return []
  }
  const { data, error } = await supabase.from('packing_items').insert(items.map(toRow)).select()
  if (error) {
    throw error
  }
  return data ?? []
}

// Assignment is NOT here on purpose: it flows through assign/claim/nudge RPCs so it can emit a
// notification (a direct UPDATE could not). label/category/quantity/packed stay direct CRUD.
export type PackingItemPatch = {
  label?: string
  category?: PackingCategory
  quantity?: number
  packed?: boolean
}

export async function updatePackingItem(id: string, patch: PackingItemPatch): Promise<void> {
  const { error } = await supabase
    .from('packing_items')
    .update({
      ...(patch.label !== undefined ? { label: patch.label } : {}),
      ...(patch.category !== undefined ? { category: patch.category } : {}),
      ...(patch.quantity !== undefined ? { quantity: patch.quantity } : {}),
      ...(patch.packed !== undefined ? { packed: patch.packed } : {}),
    })
    .eq('id', id)
  if (error) {
    throw error
  }
}

// Assigns a shared item to a member (or unassigns with null) via the RPC, which notifies the
// assignee. The RPC derives the actor from auth.uid() and validates trip membership.
export async function assignPackingItem(itemId: string, memberId: string | null): Promise<void> {
  const { error } = await supabase.rpc('assign_packing_item', {
    _item_id: itemId,
    _member_id: memberId ?? undefined,
  })
  if (error) {
    throw error
  }
}

// Self-assigns a shared item to the caller's own member (no notification).
export async function claimPackingItem(itemId: string): Promise<void> {
  const { error } = await supabase.rpc('claim_packing_item', { _item_id: itemId })
  if (error) {
    throw error
  }
}

// Pings the item's current assignee with a packing.nudged notification.
export async function nudgePackingItem(itemId: string): Promise<void> {
  const { error } = await supabase.rpc('nudge_packing_item', { _item_id: itemId })
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

// Bulk delete by id (used to undo a whole batch of Zo-suggested items at once).
export async function deletePackingItems(ids: string[]): Promise<void> {
  if (ids.length === 0) {
    return
  }
  const { error } = await supabase.from('packing_items').delete().in('id', ids)
  if (error) {
    throw error
  }
}

// Turns a shared packing item into a trip expense, split equally across the chosen members, and
// links the expense back to the item. The RPC derives the payer from auth.uid(), computes the
// shares server-side and notifies the group (expense.added) - here we only forward the inputs.
export async function expensePackingItem(
  itemId: string,
  amountCents: number,
  memberIds: string[],
): Promise<void> {
  const { error } = await supabase.rpc('expense_packing_item', {
    _item_id: itemId,
    _amount_cents: amountCents,
    _member_ids: memberIds,
  })
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
