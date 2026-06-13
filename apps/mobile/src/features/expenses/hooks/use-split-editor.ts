import { useCallback, useMemo, useState } from 'react'

import { computeSplits, type ExpenseSplit, rescaleSplits } from '../splits'

type MemberLike = { id: string }
type InitialSplit = { member_id: string; share_cents: number }
type ShareState = { included: boolean; weight: number }

type UseSplitEditorParams = {
  // Trip members shown in the split list (only `id` is read here).
  members: readonly MemberLike[] | undefined
  // Trip-currency amount the live preview is split across; null while unresolved.
  baseCents: number | null
  // Edit mode only: the splits the expense was saved with. Their presence switches the editor
  // into "preserve" mode so an untouched custom split is kept intact instead of re-equalised.
  initialSplits?: readonly InitialSplit[]
}

export type SplitEditor = {
  isIncluded: (memberId: string) => boolean
  weightFor: (memberId: string) => number
  toggle: (memberId: string) => void
  setWeight: (memberId: string, weight: number) => void
  includedCount: number
  // Live per-member share for the preview (memberId -> cents); empty while baseCents is null.
  shareByMember: Map<string, number>
  // Splits to persist for a given resolved base amount; sums to baseCents (or [] when no members).
  splitsFor: (baseCents: number) => ExpenseSplit[]
}

// Shared split-editor state for the add and edit expense screens. Members are included with an
// equal weight by default; only user-touched members are stored as overrides (so a member who
// joins while the form is open is included by default, and no setState-in-effect is needed).
//
// In edit mode the loaded splits are preserved: until the user toggles a member or changes a
// weight, `splitsFor` reprojects the original shares onto the current amount (identity when the
// amount is unchanged), which fixes the bug where re-saving silently re-equalised a custom split.
export function useSplitEditor({
  members,
  baseCents,
  initialSplits,
}: UseSplitEditorParams): SplitEditor {
  const [overrides, setOverrides] = useState<Record<string, ShareState>>({})

  const initial = useMemo(() => {
    if (!initialSplits) {
      return null
    }
    return {
      splits: initialSplits.map((s) => ({ memberId: s.member_id, shareCents: s.share_cents })),
      includedIds: new Set(initialSplits.map((s) => s.member_id)),
    }
  }, [initialSplits])

  // Default inclusion before any user override: everyone in add mode, the original set in edit.
  const defaultIncluded = useCallback(
    (memberId: string) => (initial ? initial.includedIds.has(memberId) : true),
    [initial],
  )

  const isIncluded = useCallback(
    (memberId: string) => overrides[memberId]?.included ?? defaultIncluded(memberId),
    [overrides, defaultIncluded],
  )

  const weightFor = useCallback((memberId: string) => overrides[memberId]?.weight ?? 1, [overrides])

  const toggle = useCallback(
    (memberId: string) => {
      setOverrides((prev) => {
        const base = prev[memberId] ?? { included: defaultIncluded(memberId), weight: 1 }
        return { ...prev, [memberId]: { ...base, included: !base.included } }
      })
    },
    [defaultIncluded],
  )

  const setWeight = useCallback(
    (memberId: string, weight: number) => {
      setOverrides((prev) => {
        const base = prev[memberId] ?? { included: defaultIncluded(memberId), weight: 1 }
        return { ...prev, [memberId]: { ...base, weight: Math.max(1, weight) } }
      })
    },
    [defaultIncluded],
  )

  // "Touched" only when an override actually diverges from the default (included + weight 1), so a
  // no-op stepper round-trip (+1 then -1) does not abandon a preserved split in edit mode.
  const splitTouched = useMemo(
    () =>
      Object.entries(overrides).some(
        ([id, s]) => s.included !== defaultIncluded(id) || s.weight !== 1,
      ),
    [overrides, defaultIncluded],
  )

  const splitsFor = useCallback(
    (base: number): ExpenseSplit[] => {
      // Preserve the saved split until the user edits its structure - but only across members who
      // are still active (a removed member can no longer hold a share, and the update RPC rejects
      // inactive split members), and only when those shares are non-degenerate. Otherwise fall
      // through to an equal weight split.
      if (initial && !splitTouched) {
        const activeIds = new Set((members ?? []).map((m) => m.id))
        const preserved = initial.splits.filter((s) => activeIds.has(s.memberId))
        const total = preserved.reduce((sum, s) => sum + s.shareCents, 0)
        if (preserved.length > 0 && total > 0) {
          return rescaleSplits(preserved, base)
        }
      }
      const included = (members ?? []).filter((m) => isIncluded(m.id))
      return computeSplits(
        base,
        included.map((m) => ({ memberId: m.id, weight: weightFor(m.id) })),
      )
    },
    [initial, splitTouched, members, isIncluded, weightFor],
  )

  const shareByMember = useMemo(() => {
    if (baseCents === null) {
      return new Map<string, number>()
    }
    return new Map(splitsFor(baseCents).map((s) => [s.memberId, s.shareCents]))
  }, [baseCents, splitsFor])

  const includedCount = useMemo(
    () => (members ?? []).filter((m) => isIncluded(m.id)).length,
    [members, isIncluded],
  )

  return { isIncluded, weightFor, toggle, setWeight, includedCount, shareByMember, splitsFor }
}
