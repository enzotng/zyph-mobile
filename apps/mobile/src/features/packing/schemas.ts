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

// Keeps only suggestions whose label is not already present (case-insensitive) in the list,
// so "Generate" never creates duplicates of items the user already has.
export function dedupeSuggestions(
  existing: { label: string }[],
  incoming: SuggestedItem[],
): SuggestedItem[] {
  const seen = new Set(existing.map((i) => i.label.trim().toLowerCase()))
  const out: SuggestedItem[] = []
  for (const item of incoming) {
    const key = item.label.trim().toLowerCase()
    if (key && !seen.has(key)) {
      seen.add(key)
      out.push(item)
    }
  }
  return out
}
