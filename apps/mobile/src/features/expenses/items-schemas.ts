import { z } from 'zod'

// A single article extracted from an OCR scan or entered manually.
export const smartSplitItemSchema = z.object({
  label: z.string().trim().min(1, 'Label is required').max(120),
  amountCents: z.number().int().min(0, 'Amount must be non-negative'),
  position: z.number().int().min(0),
})

export type SmartSplitItem = z.infer<typeof smartSplitItemSchema>

// An assignment of one trip member to one item with a share (1.0 = sole owner,
// 0.5 = co-shared with one other member, etc.).
export const smartSplitAssignmentSchema = z.object({
  position: z.number().int().min(0),
  // FK-validated server-side; we only require a non-empty string here.
  memberId: z.string().min(1),
  share: z.number().gt(0).lte(1),
})

export type SmartSplitAssignment = z.infer<typeof smartSplitAssignmentSchema>

export const smartSplitInputSchema = z
  .object({
    description: z.string().trim().min(1, 'Description is required').max(160),
    currency: z.string().min(3).max(3),
    fxRate: z.number().positive(),
    items: z.array(smartSplitItemSchema).min(1, 'At least one item is required'),
    assignments: z
      .array(smartSplitAssignmentSchema)
      .min(1, 'Each item must have at least one assignment'),
  })
  .superRefine((value, ctx) => {
    const itemCount = value.items.length
    const positions = new Set(value.assignments.map((a) => a.position))
    // Accumulate every issue we find — don't early-return so the user sees the
    // full picture in one validation pass.
    for (let i = 0; i < itemCount; i++) {
      if (!positions.has(i)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Item ${i + 1} has no assignment.`,
          path: ['assignments'],
        })
      }
    }
    const sharesByPosition = new Map<number, number>()
    for (const assignment of value.assignments) {
      sharesByPosition.set(
        assignment.position,
        (sharesByPosition.get(assignment.position) ?? 0) + assignment.share,
      )
    }
    for (const [position, total] of sharesByPosition.entries()) {
      if (position >= itemCount) {
        continue
      }
      if (Math.abs(total - 1) > 0.0001) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Shares for item ${position + 1} must sum to 1 (got ${total.toFixed(4)}).`,
          path: ['assignments'],
        })
      }
    }
  })

export type SmartSplitInput = z.infer<typeof smartSplitInputSchema>

// Equal split helper: when N members share an item, each gets 1/N.
export function buildEqualAssignments(
  positions: number[],
  memberIds: string[],
): SmartSplitAssignment[] {
  if (memberIds.length === 0) {
    return []
  }
  const share = 1 / memberIds.length
  const out: SmartSplitAssignment[] = []
  for (const position of positions) {
    for (const memberId of memberIds) {
      out.push({ position, memberId, share })
    }
  }
  return out
}

// Compute per-member totals (in expense currency cents) from items + assignments.
// Used to drive the live "per person" footer in the attribution UI.
export function computeMemberTotalsCents(
  items: { amountCents: number }[],
  assignments: SmartSplitAssignment[],
): Map<string, number> {
  const totals = new Map<string, number>()
  for (const assignment of assignments) {
    const item = items[assignment.position]
    if (!item) {
      continue
    }
    const contribution = item.amountCents * assignment.share
    const existing = totals.get(assignment.memberId) ?? 0
    totals.set(assignment.memberId, existing + contribution)
  }
  // Round at the boundary for display; the RPC does its own rounding for splits.
  for (const [memberId, value] of totals.entries()) {
    totals.set(memberId, Math.round(value))
  }
  return totals
}

// Group raw assignment rows by their item, returning the de-duplicated member
// ids per item id (insertion order preserved). Used to render the per-item
// breakdown on the expense detail screen.
export function groupMembersByItemId(
  assignments: { item_id: string; member_id: string }[],
): Map<string, string[]> {
  const byItem = new Map<string, string[]>()
  for (const assignment of assignments) {
    const list = byItem.get(assignment.item_id)
    if (list) {
      if (!list.includes(assignment.member_id)) {
        list.push(assignment.member_id)
      }
    } else {
      byItem.set(assignment.item_id, [assignment.member_id])
    }
  }
  return byItem
}

// Rebuild the position → member-ids shape the attribution editor works with,
// from the persisted items + assignment rows. Items carry the canonical
// position; assignments reference items by id. Items with no assignment are
// omitted. Used to pre-fill the editor when re-editing an existing Smart Split.
export function buildAssignmentsByPosition(
  items: { id: string; position: number }[],
  assignments: { item_id: string; member_id: string }[],
): Record<number, string[]> {
  const byItem = groupMembersByItemId(assignments)
  const out: Record<number, string[]> = {}
  for (const item of items) {
    const members = byItem.get(item.id)
    if (members && members.length > 0) {
      out[item.position] = members
    }
  }
  return out
}
