import type { Database } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'

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
  amountCents: number
  currency: string
}

export async function createExpense({
  tripId,
  description,
  amountCents,
  currency,
}: CreateExpenseInput): Promise<Expense> {
  // Atomic server-side: inserts the expense + equal splits, enforces membership,
  // resolves the payer from auth.uid(). One round trip, one transaction.
  const { data, error } = await supabase.rpc('create_expense_with_splits', {
    _trip_id: tripId,
    _description: description,
    _amount_cents: amountCents,
    _currency: currency,
  })
  if (error) {
    throw error
  }
  return data
}
