import type { Ionicons } from '@expo/vector-icons'

import { CATEGORICAL_TINTS } from '@/lib/color'

type IoniconName = keyof typeof Ionicons.glyphMap

export type TaxonomyFlag = 'events' | 'expenses' | 'both'
export type LeafNode = { code: string; icon: IoniconName; flag: TaxonomyFlag }
export type RootNode = {
  code: string
  icon: IoniconName
  flag: TaxonomyFlag
  subcategories: LeafNode[]
}

// Single source of truth for the unified travel taxonomy.
// Codes are stable namespaced identifiers; labels live in i18n (taxonomy.* keys). Icons are
// Ionicons glyphs, each root distinct from its namesake child. Flags drive picker filtering.
export const TAXONOMY: readonly RootNode[] = [
  {
    code: 'transport',
    icon: 'navigate',
    flag: 'both',
    subcategories: [
      { code: 'transport.flight', icon: 'airplane', flag: 'both' },
      { code: 'transport.train', icon: 'train', flag: 'both' },
      { code: 'transport.transit', icon: 'ticket', flag: 'both' },
      { code: 'transport.car', icon: 'car', flag: 'both' },
      { code: 'transport.bus', icon: 'bus', flag: 'both' },
      { code: 'transport.ferry', icon: 'boat', flag: 'both' },
      { code: 'transport.taxi', icon: 'car-sport', flag: 'both' },
      { code: 'transport.bike', icon: 'bicycle', flag: 'both' },
      { code: 'transport.fuel', icon: 'speedometer', flag: 'both' },
      { code: 'transport.parking', icon: 'trail-sign', flag: 'expenses' },
    ],
  },
  {
    code: 'lodging',
    icon: 'business',
    flag: 'both',
    subcategories: [
      { code: 'lodging.hotel', icon: 'bed', flag: 'both' },
      { code: 'lodging.rental', icon: 'home', flag: 'both' },
      { code: 'lodging.hostel', icon: 'moon', flag: 'both' },
      { code: 'lodging.camping', icon: 'bonfire', flag: 'both' },
    ],
  },
  {
    code: 'food',
    icon: 'fast-food',
    flag: 'both',
    subcategories: [
      { code: 'food.restaurant', icon: 'restaurant', flag: 'both' },
      { code: 'food.bar', icon: 'wine', flag: 'both' },
      { code: 'food.cafe', icon: 'cafe', flag: 'both' },
      { code: 'food.groceries', icon: 'basket', flag: 'both' },
    ],
  },
  {
    code: 'activity',
    icon: 'compass',
    flag: 'both',
    subcategories: [
      { code: 'activity.sightseeing', icon: 'library', flag: 'both' },
      { code: 'activity.excursion', icon: 'walk', flag: 'both' },
      { code: 'activity.show', icon: 'musical-notes', flag: 'both' },
      { code: 'activity.sport', icon: 'barbell', flag: 'both' },
      { code: 'activity.nature', icon: 'leaf', flag: 'both' },
      { code: 'activity.nightlife', icon: 'beer', flag: 'both' },
      { code: 'activity.wellness', icon: 'flower', flag: 'both' },
      { code: 'activity.experience', icon: 'easel', flag: 'both' },
    ],
  },
  {
    code: 'shopping',
    icon: 'cart',
    flag: 'both',
    subcategories: [
      { code: 'shopping.souvenirs', icon: 'pricetags', flag: 'expenses' },
      { code: 'shopping.gifts', icon: 'gift', flag: 'expenses' },
      { code: 'shopping.clothes', icon: 'shirt', flag: 'expenses' },
      { code: 'shopping.general', icon: 'bag-handle', flag: 'both' },
    ],
  },
  {
    code: 'health',
    icon: 'medkit',
    flag: 'both',
    subcategories: [
      { code: 'health.pharmacy', icon: 'medical', flag: 'expenses' },
      { code: 'health.doctor', icon: 'pulse', flag: 'both' },
    ],
  },
  {
    code: 'fees',
    icon: 'receipt',
    flag: 'expenses',
    subcategories: [
      { code: 'fees.bank', icon: 'card', flag: 'expenses' },
      { code: 'fees.tax', icon: 'document-text', flag: 'expenses' },
      { code: 'fees.visa', icon: 'document', flag: 'expenses' },
      { code: 'fees.insurance', icon: 'shield-checkmark', flag: 'expenses' },
      { code: 'fees.tips', icon: 'cash', flag: 'expenses' },
    ],
  },
  {
    code: 'other',
    icon: 'apps',
    flag: 'both',
    subcategories: [
      { code: 'other.event', icon: 'calendar', flag: 'events' },
      { code: 'other.meetup', icon: 'location', flag: 'events' },
      { code: 'other.reminder', icon: 'alarm', flag: 'events' },
      { code: 'other.connectivity', icon: 'wifi', flag: 'expenses' },
      { code: 'other.misc', icon: 'ellipsis-horizontal', flag: 'both' },
    ],
  },
]

export const ROOT_CODES = TAXONOMY.map((r) => r.code) as readonly string[]

const ROOT_BY_CODE = new Map(TAXONOMY.map((r) => [r.code, r] as const))
const LEAF_BY_CODE = new Map(
  TAXONOMY.flatMap((r) => r.subcategories.map((s) => [s.code, s] as const)),
)

const FALLBACK_ICON: IoniconName = 'pricetag'

export function rootOf(code: string): string {
  return code.split('.')[0]
}

export function isValidCategory(code: string | null | undefined): boolean {
  return !!code && ROOT_BY_CODE.has(code)
}

export function isValidSubcategory(code: string | null | undefined): boolean {
  return !!code && LEAF_BY_CODE.has(code)
}

// Most-specific-first icon resolution: leaf -> root -> (bare dotted code passed as category) ->
// fallback. Tolerates legacy/partial input so a stored value never renders the fallback wrongly.
export function iconForCode(
  category: string | null | undefined,
  subcategory?: string | null,
): IoniconName {
  if (subcategory) {
    const leaf = LEAF_BY_CODE.get(subcategory)
    if (leaf) {
      return leaf.icon
    }
  }
  if (category) {
    const root = ROOT_BY_CODE.get(category)
    if (root) {
      return root.icon
    }
    const asLeaf = LEAF_BY_CODE.get(category)
    if (asLeaf) {
      return asLeaf.icon
    }
    const parentRoot = ROOT_BY_CODE.get(rootOf(category))
    if (parentRoot) {
      return parentRoot.icon
    }
  }
  return FALLBACK_ICON
}

// i18n keys mirror the code nesting: taxonomy.transport._root / taxonomy.transport.flight.
export function labelKeyForCode(code: string): string {
  return code.includes('.') ? `taxonomy.${code}` : `taxonomy.${code}._root`
}

// A root is visible for a flag if the root itself or any child matches (or is 'both').
export function categoriesForFlag(flag: 'events' | 'expenses'): RootNode[] {
  return TAXONOMY.filter(
    (r) =>
      r.flag === 'both' ||
      r.flag === flag ||
      r.subcategories.some((s) => s.flag === 'both' || s.flag === flag),
  )
}

export function subcategoriesForFlag(rootCode: string, flag: 'events' | 'expenses'): LeafNode[] {
  const root = ROOT_BY_CODE.get(rootCode)
  if (!root) {
    return []
  }
  return root.subcategories.filter((s) => s.flag === 'both' || s.flag === flag)
}

// One color per root category, reusing the vetted categorical palette (which deliberately avoids
// money green/red). Shared by the analytics donut and category bars so color reads consistently.
const UNCATEGORIZED_COLOR = '#8A8178'

export const CATEGORY_COLORS: Record<string, string> = {
  transport: CATEGORICAL_TINTS[0],
  lodging: CATEGORICAL_TINTS[1],
  food: CATEGORICAL_TINTS[2],
  activity: CATEGORICAL_TINTS[3],
  shopping: CATEGORICAL_TINTS[4],
  health: CATEGORICAL_TINTS[5],
  fees: CATEGORICAL_TINTS[6],
  other: CATEGORICAL_TINTS[7],
}

export function categoryColor(code: string | null | undefined): string {
  if (!code) {
    return UNCATEGORIZED_COLOR
  }
  return CATEGORY_COLORS[rootOf(code)] ?? UNCATEGORIZED_COLOR
}
