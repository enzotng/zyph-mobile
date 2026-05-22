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
}

export async function createExpense({
  tripId,
  description,
  amountCents,
  currency,
  baseAmountCents,
  fxRate,
  splits,
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
  })
  if (error) {
    throw error
  }
  return data
}
