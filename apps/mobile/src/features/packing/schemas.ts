import type { Database } from '@/lib/database.types'

export type PackingItem = Database['public']['Tables']['packing_items']['Row']
export type PackingScope = 'shared' | 'personal'

export const PACKING_CATEGORIES = [
  'clothes',
  'toiletries',
  'documents',
  'electronics',
  'health',
  'other',
] as const
export type PackingCategory = (typeof PACKING_CATEGORIES)[number]

// Ionicons glyph per category (for the section headers).
export function categoryIcon(category: string): string {
  switch (category) {
    case 'clothes':
      return 'shirt-outline'
    case 'toiletries':
      return 'water-outline'
    case 'documents':
      return 'document-text-outline'
    case 'electronics':
      return 'phone-portrait-outline'
    case 'health':
      return 'medkit-outline'
    default:
      return 'cube-outline'
  }
}

export type PackingGroup = { category: PackingCategory; items: PackingItem[] }

// Groups items by category in the canonical order, dropping empty categories. An unknown
// category falls into 'other' so a stray value never disappears from the UI.
export function groupByCategory(items: PackingItem[]): PackingGroup[] {
  const buckets = new Map<PackingCategory, PackingItem[]>()
  for (const item of items) {
    const category = (PACKING_CATEGORIES as readonly string[]).includes(item.category)
      ? (item.category as PackingCategory)
      : 'other'
    const bucket = buckets.get(category)
    if (bucket) {
      bucket.push(item)
    } else {
      buckets.set(category, [item])
    }
  }
  return PACKING_CATEGORIES.filter((c) => buckets.has(c)).map((category) => ({
    category,
    items: buckets.get(category) ?? [],
  }))
}

export type SuggestedItem = {
  label: string
  category: string
  quantity: number
  reason?: string
  // True when one of the item serves the whole group (tent, first-aid kit). Optional so
  // gaps/refine/seed/cached suggestions without the field stay valid.
  communal?: boolean
}

// Round-robins communal items across the trip's members so the group shares the load. Personal
// (non-communal) items stay unassigned (null). The counter only advances on communal items, so
// the few communal items spread evenly even within a mostly-personal list. Deterministic on
// input order; returns one assignment (member id or null) per item.
export function assignCommunalRoundRobin(
  items: SuggestedItem[],
  memberIds: string[],
): (string | null)[] {
  if (memberIds.length === 0) {
    return items.map(() => null)
  }
  let counter = 0
  return items.map((item) => {
    if (item.communal !== true) {
      return null
    }
    const memberId = memberIds[counter % memberIds.length]
    counter += 1
    return memberId
  })
}

// Keyword heuristic to pre-fill the category of a manually typed item (the user can override).
const CATEGORY_KEYWORDS: Record<PackingCategory, string[]> = {
  documents: ['passport', 'passeport', 'visa', 'ticket', 'billet', 'boarding', 'permis', 'carte'],
  toiletries: [
    'toothbrush',
    'brosse',
    'dentifrice',
    'shampoo',
    'shampoing',
    'soap',
    'savon',
    'towel',
    'serviette',
    'deodorant',
    'déodorant',
    'sunscreen',
    'crème',
    'razor',
    'rasoir',
  ],
  electronics: [
    'charger',
    'chargeur',
    'phone',
    'adapter',
    'adaptateur',
    'camera',
    'laptop',
    'headphone',
    'écouteur',
    'cable',
    'câble',
    'battery',
    'batterie',
    'powerbank',
  ],
  health: ['medicine', 'médicament', 'pills', 'aspirin', 'bandage', 'mask', 'masque', 'vitamin'],
  clothes: [
    'shirt',
    't-shirt',
    'tshirt',
    'pants',
    'pantalon',
    'jacket',
    'veste',
    'shoe',
    'chaussure',
    'sock',
    'chaussette',
    'underwear',
    'jean',
    'dress',
    'robe',
    'swimsuit',
    'maillot',
    'hat',
    'chapeau',
    'coat',
    'manteau',
    'pull',
    'sweater',
    'short',
  ],
  other: [],
}

// Daily-wear clothing whose count a laundry cycle lets you repeat, so "pack light" caps them
// instead of packing one per day. Matched case-insensitively against the label (FR + EN).
const REPEAT_WEAR_KEYWORDS = [
  'sock',
  'chaussette',
  'underwear',
  'sous-vêtement',
  'sous-vetement',
  'slip',
  'culotte',
  'boxer',
  't-shirt',
  'tshirt',
  'tee-shirt',
  'tee',
  'top',
  'haut',
  'shirt',
  'chemise',
  'débardeur',
]

// Most you sensibly carry of a daily-wear item when you can do laundry on the road.
const LAUNDRY_CAP = 5

// Deterministic "pack light": with occasional laundry you never need one daily-wear item per
// day, so cap repeat-wear clothing to a laundry-aware count. Unlike a fuzzy LLM hint this is
// guaranteed, so the demo never shows "12 t-shirts". Non-clothing and one-off items untouched.
export function applyPackLight(items: SuggestedItem[], days: number | null): SuggestedItem[] {
  const cap = Math.max(2, Math.min(days ?? LAUNDRY_CAP, LAUNDRY_CAP))
  return items.map((item) => {
    const label = item.label.trim().toLowerCase()
    const isRepeatWear =
      item.category === 'clothes' && REPEAT_WEAR_KEYWORDS.some((k) => label.includes(k))
    return isRepeatWear && item.quantity > cap ? { ...item, quantity: cap } : item
  })
}

export function inferCategory(label: string): PackingCategory {
  const l = label.trim().toLowerCase()
  if (!l) {
    return 'other'
  }
  const order: PackingCategory[] = ['documents', 'toiletries', 'electronics', 'health', 'clothes']
  for (const category of order) {
    if (CATEGORY_KEYWORDS[category].some((k) => l.includes(k))) {
      return category
    }
  }
  return 'other'
}

// Canonical label key for case-insensitive matching (trim + lowercase).
const normalizeLabel = (label: string): string => label.trim().toLowerCase()

// Keeps only suggestions whose label is not already present (case-insensitive) in the list,
// so "Generate" never creates duplicates of items the user already has.
export function dedupeSuggestions(
  existing: { label: string }[],
  incoming: SuggestedItem[],
): SuggestedItem[] {
  const seen = new Set(existing.map((i) => normalizeLabel(i.label)))
  const out: SuggestedItem[] = []
  for (const item of incoming) {
    const key = normalizeLabel(item.label)
    if (key && !seen.has(key)) {
      seen.add(key)
      out.push(item)
    }
  }
  return out
}

// --- Group visibility (Increment 3) -------------------------------------------------------
// All pure and deterministic. assigned_member is a trip_members.id (never a user_id). Callers
// pass the already-scoped (shared) item array so these compose with groupByCategory.

// Sentinel for the "Unassigned" choice in the traveler filter.
export const UNASSIGNED_FILTER = '__unassigned__' as const

export type MemberProgress = {
  memberId: string
  name: string | null
  assigned: number
  packed: number
}

// One row per member (in the given order, members with 0 assigned included), counting items
// assigned to that member and how many of those are packed. Items assigned to an id not in
// `members` are counted by nobody.
export function memberPackingProgress(
  items: PackingItem[],
  members: { id: string; display_name: string | null }[],
): MemberProgress[] {
  return members.map((member) => {
    const assigned = items.filter((i) => i.assigned_member === member.id)
    return {
      memberId: member.id,
      name: member.display_name,
      assigned: assigned.length,
      packed: assigned.filter((i) => i.packed).length,
    }
  })
}

// Count of items nobody is bringing yet.
export function unassignedSharedCount(items: PackingItem[]): number {
  return items.filter((i) => i.assigned_member == null).length
}

// Group-wide readiness: percent packed (0 when empty) and a "ready" flag that requires every
// item packed AND every item assigned (nothing left hanging).
export function groupReadiness(items: PackingItem[]): { percent: number; ready: boolean } {
  if (items.length === 0) {
    return { percent: 0, ready: false }
  }
  const packed = items.filter((i) => i.packed).length
  const ready = packed === items.length && items.every((i) => i.assigned_member != null)
  return { percent: Math.round((packed / items.length) * 100), ready }
}

// Filters items to one traveler. null = everyone, UNASSIGNED_FILTER = unassigned only, otherwise
// a member id. Always returns a new array, preserving order, never mutating the input.
export function filterByTraveler(items: PackingItem[], filter: string | null): PackingItem[] {
  if (filter === null) {
    return [...items]
  }
  if (filter === UNASSIGNED_FILTER) {
    return items.filter((i) => i.assigned_member == null)
  }
  return items.filter((i) => i.assigned_member === filter)
}

// First SHARED item whose label matches (case-insensitive), so a manual/AI add can warn instead
// of silently duplicating. Ignores personal-scope items and an empty label.
export function findDuplicateSharedItem(items: PackingItem[], label: string): PackingItem | null {
  const key = normalizeLabel(label)
  if (!key) {
    return null
  }
  return items.find((i) => i.scope === 'shared' && normalizeLabel(i.label) === key) ?? null
}

// Resolves who already added a duplicate shared item, for the warning copy. Returns the owner's
// name (null when unassigned or unknown), or null when there is no duplicate.
export function duplicateSharedOwner(
  items: PackingItem[],
  label: string,
  nameById: Map<string, string>,
): { name: string | null } | null {
  const hit = findDuplicateSharedItem(items, label)
  if (!hit) {
    return null
  }
  return { name: hit.assigned_member ? (nameById.get(hit.assigned_member) ?? null) : null }
}
