import type { Ionicons } from '@expo/vector-icons'

import type { ExpenseCategory } from './api/expenses.api'

// Single source of truth for the per-category icon, shared by the expense feed, the overview tab,
// the expense detail and the category picker so a category looks identical everywhere.
export const CATEGORY_ICON: Record<ExpenseCategory, keyof typeof Ionicons.glyphMap> = {
  food: 'restaurant',
  transport: 'car',
  lodging: 'bed',
  activity: 'ticket',
  shopping: 'bag-handle',
  other: 'pricetag',
}
