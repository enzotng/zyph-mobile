import type { SmartSplitItem } from './items-schemas'
import { toCents } from './schemas'

// Editor-local draft of a Smart Split line: the amount stays a decimal string while the
// user types (so the caret never fights a re-formatted value), converted to cents on save.
export type DraftItem = { label: string; amount: string }

const AMOUNT_RE = /^\d+([.,]\d{1,2})?$/

// Parses a user-typed decimal amount to integer cents; returns 0 for partial/invalid input.
export function amountToCents(amount: string): number {
  const trimmed = amount.trim()
  if (!AMOUNT_RE.test(trimmed)) {
    return 0
  }
  return toCents(trimmed)
}

// Seeds editor drafts from persisted/scanned items (cents -> a 2-decimal string).
export function draftFromItems(items: { label: string; amountCents: number }[]): DraftItem[] {
  return items.map((item) => ({ label: item.label, amount: (item.amountCents / 100).toFixed(2) }))
}

// Live total of the drafts, in expense-currency cents.
export function draftTotalCents(drafts: DraftItem[]): number {
  return drafts.reduce((sum, draft) => sum + amountToCents(draft.amount), 0)
}

// Converts drafts to the SmartSplitItem[] the RPC expects (position = array index).
export function draftsToItems(drafts: DraftItem[]): SmartSplitItem[] {
  return drafts.map((draft, position) => ({
    label: draft.label.trim(),
    amountCents: amountToCents(draft.amount),
    position,
  }))
}

// True when every draft carries a non-empty label (the RPC rejects empty labels).
export function everyDraftLabelled(drafts: DraftItem[]): boolean {
  return drafts.every((draft) => draft.label.trim().length > 0)
}

// True when every draft resolves to a positive amount. Catches mid-typing states like
// '12.' or a left-blank field that would otherwise be saved silently as 0 cents.
export function everyDraftAmountValid(drafts: DraftItem[]): boolean {
  return drafts.every((draft) => amountToCents(draft.amount) > 0)
}

// Removes the line at `removed` from an index-keyed assignment map: keys above the removed
// index shift down by one, the removed key is dropped. Keeps assignments aligned with the
// re-indexed draft array (position = array index throughout the editor).
export function reindexAssignmentsAfterRemoval(
  assignments: Record<number, Set<string>>,
  removed: number,
): Record<number, Set<string>> {
  const out: Record<number, Set<string>> = {}
  for (const key of Object.keys(assignments)) {
    const position = Number(key)
    if (position === removed) {
      continue
    }
    out[position > removed ? position - 1 : position] = assignments[position]
  }
  return out
}
