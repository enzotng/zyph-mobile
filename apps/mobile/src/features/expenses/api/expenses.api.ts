import type { Database } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'
import type { ExpenseSplit } from '../splits'

export type Expense = Database['public']['Tables']['expenses']['Row']
export type TripBalance = Database['public']['Functions']['get_trip_balances']['Returns'][number]

export async function getTripBalances(tripId: string): Promise<TripBalance[]> {
  const { data, error } = await supabase.rpc('get_trip_balances', { _trip_id: tripId })
  if (error) {
    throw error
  }
  return data
}

export async function listExpenses(tripId: string): Promise<Expense[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('trip_id', tripId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  if (error) {
    throw error
  }
  return data
}

export const EXPENSE_CATEGORIES = [
  'food',
  'transport',
  'lodging',
  'activity',
  'shopping',
  'other',
] as const

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]

export type CreateExpenseInput = {
  tripId: string
  description: string
  // Amount in the expense's own currency.
  amountCents: number
  currency: string
  // Amount converted to the trip's currency at entry time; drives splits/balances.
  baseAmountCents: number
  // Frozen rate used for the conversion (currency -> trip currency); 1 when identical.
  fxRate: number
  // Per-member shares (in trip currency); must sum to baseAmountCents. The server
  // validates membership + the sum.
  splits: ExpenseSplit[]
  category?: ExpenseCategory | null
  // Trip-member id of the payer; defaults to the caller server-side when omitted.
  paidBy?: string | null
  // Multi-payer breakdown (trip-currency cents, must sum to baseAmountCents). When omitted the
  // expense has a single payer (paidBy / caller). When set, paidBy is ignored server-side.
  payers?: ExpensePayer[] | null
}

export type ExpensePayer = { memberId: string; paidCents: number }

export async function createExpense({
  tripId,
  description,
  amountCents,
  currency,
  baseAmountCents,
  fxRate,
  splits,
  category,
  paidBy,
  payers,
}: CreateExpenseInput): Promise<Expense> {
  // Atomic server-side: inserts the expense + the provided splits, enforces membership,
  // resolves the payer from auth.uid(). One round trip, one transaction.
  // The server trusts the client-computed baseAmountCents/fxRate (it only validates
  // sign): acceptable because trip members are mutually trusted and balances are
  // informational (no money movement). Membership + the split sum are server-enforced.
  const { data, error } = await supabase.rpc('create_expense_with_splits', {
    _trip_id: tripId,
    _description: description,
    _amount_cents: amountCents,
    _currency: currency,
    _base_amount_cents: baseAmountCents,
    _fx_rate: fxRate,
    _splits: splits.map((s) => ({ member_id: s.memberId, share_cents: s.shareCents })),
    _category: category ?? undefined,
    _paid_by: paidBy ?? undefined,
    _payers: payers
      ? payers.map((p) => ({ member_id: p.memberId, paid_cents: p.paidCents }))
      : undefined,
  })
  if (error) {
    throw error
  }
  return data
}

export type ExpenseSplitRow = Database['public']['Tables']['expense_splits']['Row']
export type ExpensePayerRow = Database['public']['Tables']['expense_payers']['Row']

export async function listExpensePayers(expenseId: string): Promise<ExpensePayerRow[]> {
  const { data, error } = await supabase
    .from('expense_payers')
    .select('*')
    .eq('expense_id', expenseId)
  if (error) {
    throw error
  }
  return data
}

export async function getExpense(expenseId: string): Promise<Expense | null> {
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('id', expenseId)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) {
    throw error
  }
  return data
}

export async function listExpenseSplits(expenseId: string): Promise<ExpenseSplitRow[]> {
  const { data, error } = await supabase
    .from('expense_splits')
    .select('*')
    .eq('expense_id', expenseId)
  if (error) {
    throw error
  }
  return data
}

export type UpdateExpenseInput = {
  expenseId: string
  description: string
  amountCents: number
  currency: string
  baseAmountCents: number
  fxRate: number
  splits: ExpenseSplit[]
  category?: ExpenseCategory | null
  // Trip-member id of the payer; keeps the existing payer server-side when omitted.
  paidBy?: string | null
  // Multi-payer breakdown (trip-currency cents, must sum to baseAmountCents). When omitted the
  // expense falls back to a single payer (paidBy / existing). When set, paidBy is ignored.
  payers?: ExpensePayer[] | null
}

export async function updateExpense({
  expenseId,
  description,
  amountCents,
  currency,
  baseAmountCents,
  fxRate,
  splits,
  category,
  paidBy,
  payers,
}: UpdateExpenseInput): Promise<Expense> {
  const { data, error } = await supabase.rpc('update_expense_with_splits', {
    _expense_id: expenseId,
    _description: description,
    _amount_cents: amountCents,
    _currency: currency,
    _base_amount_cents: baseAmountCents,
    _fx_rate: fxRate,
    _splits: splits.map((s) => ({ member_id: s.memberId, share_cents: s.shareCents })),
    _category: category ?? undefined,
    _paid_by: paidBy ?? undefined,
    _payers: payers
      ? payers.map((p) => ({ member_id: p.memberId, paid_cents: p.paidCents }))
      : undefined,
  })
  if (error) {
    throw error
  }
  return data
}

export async function deleteExpense(expenseId: string): Promise<void> {
  // Soft delete via RPC; list queries filter on deleted_at is null. Splits stay tied to the
  // expense row so balances stop counting it but history is preserved. Goes through the
  // SECURITY DEFINER RPC because direct writes to expenses are locked down (RLS is SELECT-only).
  const { error } = await supabase.rpc('soft_delete_expense', { _expense_id: expenseId })
  if (error) {
    throw error
  }
}
