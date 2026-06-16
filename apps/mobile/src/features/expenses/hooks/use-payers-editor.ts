import { useCallback, useMemo, useState } from 'react'

import type { ExpensePayer } from '../api/expenses.api'
import { parseCentsInput, validateExactSum } from '../split-modes'

type MemberLike = { id: string }
export type PayerMode = 'single' | 'multiple'
type InitialPayer = { memberId: string; paidCents: number }

type UsePayersEditorParams = {
  members: readonly MemberLike[] | undefined
  // Expense total in trip-currency cents (same base the splits use), or null until the amount is
  // valid. Multi-payer amounts are entered and validated in this currency, like the split shares.
  baseCents: number | null
  // Single-payer fallback (the current user's membership) when no multi-payer split is set.
  defaultPayerId: string | null
  // Persisted payers (trip-currency cents) seeding the editor on edit; more than one opens it in
  // 'multiple' mode. Defaults reactively so an async load does not need a setState-in-effect.
  initialPayers?: readonly InitialPayer[]
}

export type PayersEditor = {
  mode: PayerMode
  setMode: (mode: PayerMode) => void
  // Single mode: the selected payer.
  payerId: string | null
  setPayerId: (memberId: string) => void
  // Multiple mode: raw trip-currency amount per member ('' = untouched, prefilled from initial).
  amountValueFor: (memberId: string) => string
  setAmountValue: (memberId: string, raw: string) => void
  // Remainder banner inputs (multiple mode); single mode always balances.
  allocatedCents: number
  remainderCents: number
  isBalanced: boolean
  canSubmit: boolean
  // What to send to the API: single -> { paidBy, payers: null }; multiple -> { paidBy: null, payers }.
  resolve: () => { paidBy: string | null; payers: ExpensePayer[] | null }
}

// Payer-editor state for the add/edit expense screens, mirroring useSplitEditor: defaults derive
// reactively from the loaded data and only user-touched values are stored as overrides. Multi-payer
// amounts live in trip-currency cents (the same base as the splits), so they map straight to the
// _payers RPC input with no currency conversion.
export function usePayersEditor({
  members,
  baseCents,
  defaultPayerId,
  initialPayers,
}: UsePayersEditorParams): PayersEditor {
  const [modeOverride, setModeOverride] = useState<PayerMode | null>(null)
  const [payerOverride, setPayerOverride] = useState<string | null>(null)
  const [amountOverrides, setAmountOverrides] = useState<Record<string, string>>({})

  const initial = useMemo(() => {
    const baseline = new Map((initialPayers ?? []).map((p) => [p.memberId, p.paidCents]))
    const defaultMode: PayerMode = (initialPayers?.length ?? 0) > 1 ? 'multiple' : 'single'
    const seededPayer =
      initialPayers?.length === 1 ? initialPayers[0].memberId : (defaultPayerId ?? null)
    return { baseline, defaultMode, seededPayer }
  }, [initialPayers, defaultPayerId])

  const mode = modeOverride ?? initial.defaultMode
  const payerId = payerOverride ?? initial.seededPayer

  const setMode = useCallback((next: PayerMode) => setModeOverride(next), [])
  const setPayerId = useCallback((memberId: string) => setPayerOverride(memberId), [])
  const setAmountValue = useCallback((memberId: string, raw: string) => {
    setAmountOverrides((prev) => ({ ...prev, [memberId]: raw }))
  }, [])

  const amountValueFor = useCallback(
    (memberId: string): string => {
      if (amountOverrides[memberId] !== undefined) {
        return amountOverrides[memberId]
      }
      const cents = initial.baseline.get(memberId)
      return cents === undefined ? '' : (cents / 100).toFixed(2)
    },
    [amountOverrides, initial],
  )

  const entries = useMemo(
    () =>
      (members ?? []).map((m) => ({
        memberId: m.id,
        cents: parseCentsInput(amountValueFor(m.id)),
      })),
    [members, amountValueFor],
  )

  const { allocatedCents, remainderCents, isBalanced } = useMemo(() => {
    if (mode === 'single') {
      const base = baseCents ?? 0
      return { allocatedCents: base, remainderCents: 0, isBalanced: true }
    }
    return validateExactSum(entries, baseCents ?? 0)
  }, [mode, entries, baseCents])

  const resolve = useCallback((): { paidBy: string | null; payers: ExpensePayer[] | null } => {
    if (mode === 'single') {
      return { paidBy: payerId, payers: null }
    }
    const payers = entries
      .filter((e) => e.cents > 0)
      .map((e) => ({ memberId: e.memberId, paidCents: e.cents }))
    return { paidBy: null, payers }
  }, [mode, payerId, entries])

  const canSubmit =
    mode === 'single'
      ? payerId !== null
      : baseCents !== null && isBalanced && entries.some((e) => e.cents > 0)

  return {
    mode,
    setMode,
    payerId,
    setPayerId,
    amountValueFor,
    setAmountValue,
    allocatedCents,
    remainderCents,
    isBalanced,
    canSubmit,
    resolve,
  }
}
