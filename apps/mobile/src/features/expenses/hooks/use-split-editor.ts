import { useCallback, useMemo, useState } from 'react'

import {
  centsToPercent,
  exactToSplits,
  parseCentsInput,
  parsePercentInput,
  percentToSplits,
  type SplitMode,
  validateExactSum,
  validatePercentSum,
} from '../split-modes'
import { computeSplits, type ExpenseSplit, rescaleSplits } from '../splits'

type MemberLike = { id: string }
type InitialSplit = { member_id: string; share_cents: number }
type ShareState = { included: boolean; weight: number }

type UseSplitEditorParams = {
  members: readonly MemberLike[] | undefined
  baseCents: number | null
  initialSplits?: readonly InitialSplit[]
  // Mode the editor opens in. Add defaults to 'equal'; edit passes 'shares' so an untouched saved
  // split flows through the preserve branch unchanged.
  initialMode?: SplitMode
}

export type SplitEditor = {
  isIncluded: (memberId: string) => boolean
  weightFor: (memberId: string) => number
  toggle: (memberId: string) => void
  setWeight: (memberId: string, weight: number) => void
  includedCount: number
  // Live per-member share for the preview (memberId -> cents); empty while baseCents is null.
  shareByMember: Map<string, number>
  // Splits to persist for a given resolved base amount (mode-dependent).
  splitsFor: (baseCents: number) => ExpenseSplit[]
  // Mode selector.
  mode: SplitMode
  setMode: (mode: SplitMode) => void
  // EXACT mode: raw trip-currency input per member ('' = untouched, prefilled from the auto split).
  exactValueFor: (memberId: string) => string
  setExactValue: (memberId: string, raw: string) => void
  // PERCENT mode: raw 0..100 input per member ('' = untouched, prefilled from the auto split).
  percentValueFor: (memberId: string) => string
  setPercentValue: (memberId: string, raw: string) => void
  // Remainder banner + submit gate.
  allocatedCents: number
  remainderCents: number
  isBalanced: boolean
  canSubmit: boolean
}

// Shared split-editor state for the add and edit expense screens. Members are included with an
// equal weight by default; only user-touched members are stored as overrides (so a member who
// joins while the form is open is included by default, and no setState-in-effect is needed).
//
// Four modes: 'equal' (all equal), 'shares' (integer weights), 'exact' (per-member amounts),
// 'percent' (per-member %). Exact/percent values are kept as raw strings per member so they survive
// mid-typing and never touch the weight overrides - the edit-mode "preserve a saved custom split"
// behaviour stays fully insulated in the equal/shares path.
export function useSplitEditor({
  members,
  baseCents,
  initialSplits,
  initialMode,
}: UseSplitEditorParams): SplitEditor {
  const [overrides, setOverrides] = useState<Record<string, ShareState>>({})
  const [mode, setMode] = useState<SplitMode>(initialMode ?? 'equal')
  const [exactInputs, setExactInputs] = useState<Record<string, string>>({})
  const [percentInputs, setPercentInputs] = useState<Record<string, string>>({})

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

  // Equal/shares split (+ the edit-mode preserve branch). EQUAL forces weight 1; SHARES uses the
  // weight overrides. This is the only auto-balancing path and the one exact/percent prefill reads.
  const autoSplitsFor = useCallback(
    (base: number): ExpenseSplit[] => {
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
        included.map((m) => ({ memberId: m.id, weight: mode === 'equal' ? 1 : weightFor(m.id) })),
      )
    },
    [initial, splitTouched, members, isIncluded, weightFor, mode],
  )

  // Prefill baseline (read-only, no state write): the auto split feeds exact/percent inputs until
  // the user types over them.
  const baselineByMember = useMemo(() => {
    if (baseCents === null) {
      return new Map<string, number>()
    }
    return new Map(autoSplitsFor(baseCents).map((s) => [s.memberId, s.shareCents]))
  }, [baseCents, autoSplitsFor])

  const exactValueFor = useCallback(
    (memberId: string): string => {
      if (exactInputs[memberId] !== undefined) {
        return exactInputs[memberId]
      }
      const cents = baselineByMember.get(memberId)
      return cents === undefined ? '' : (cents / 100).toFixed(2)
    },
    [exactInputs, baselineByMember],
  )

  const percentValueFor = useCallback(
    (memberId: string): string => {
      if (percentInputs[memberId] !== undefined) {
        return percentInputs[memberId]
      }
      if (baseCents === null) {
        return ''
      }
      const pct = centsToPercent(autoSplitsFor(baseCents), baseCents).find(
        (p) => p.memberId === memberId,
      )?.percent
      return pct === undefined ? '' : String(pct)
    },
    [percentInputs, baseCents, autoSplitsFor],
  )

  const setExactValue = useCallback((memberId: string, raw: string) => {
    setExactInputs((prev) => ({ ...prev, [memberId]: raw }))
  }, [])

  const setPercentValue = useCallback((memberId: string, raw: string) => {
    setPercentInputs((prev) => ({ ...prev, [memberId]: raw }))
  }, [])

  const splitsFor = useCallback(
    (base: number): ExpenseSplit[] => {
      const included = (members ?? []).filter((m) => isIncluded(m.id))
      if (mode === 'exact') {
        return exactToSplits(
          included.map((m) => ({ memberId: m.id, cents: parseCentsInput(exactValueFor(m.id)) })),
        )
      }
      if (mode === 'percent') {
        return percentToSplits(
          included.map((m) => ({
            memberId: m.id,
            percent: parsePercentInput(percentValueFor(m.id)),
          })),
          base,
        )
      }
      return autoSplitsFor(base)
    },
    [mode, members, isIncluded, exactValueFor, percentValueFor, autoSplitsFor],
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

  const { allocatedCents, remainderCents, isBalanced } = useMemo(() => {
    const base = baseCents ?? 0
    const included = (members ?? []).filter((m) => isIncluded(m.id))
    if (included.length === 0) {
      return { allocatedCents: 0, remainderCents: base, isBalanced: false }
    }
    if (mode === 'exact') {
      return validateExactSum(
        included.map((m) => ({ memberId: m.id, cents: parseCentsInput(exactValueFor(m.id)) })),
        base,
      )
    }
    if (mode === 'percent') {
      return validatePercentSum(
        included.map((m) => ({
          memberId: m.id,
          percent: parsePercentInput(percentValueFor(m.id)),
        })),
        base,
      )
    }
    // equal/shares always reconcile to the base via largest-remainder.
    return { allocatedCents: base, remainderCents: 0, isBalanced: true }
  }, [mode, baseCents, members, isIncluded, exactValueFor, percentValueFor])

  const canSubmit = isBalanced && includedCount > 0 && baseCents !== null

  return {
    isIncluded,
    weightFor,
    toggle,
    setWeight,
    includedCount,
    shareByMember,
    splitsFor,
    mode,
    setMode,
    exactValueFor,
    setExactValue,
    percentValueFor,
    setPercentValue,
    allocatedCents,
    remainderCents,
    isBalanced,
    canSubmit,
  }
}
