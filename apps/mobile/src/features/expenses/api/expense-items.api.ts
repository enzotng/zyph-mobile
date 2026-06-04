import type { Database } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'

import type { SmartSplitAssignment, SmartSplitItem } from '../items-schemas'

export type ExpenseItemRow = Database['public']['Tables']['expense_items']['Row']
export type ExpenseItemAssignmentRow =
  Database['public']['Tables']['expense_item_assignments']['Row']

export async function listExpenseItems(expenseId: string): Promise<ExpenseItemRow[]> {
  const { data, error } = await supabase
    .from('expense_items')
    .select('*')
    .eq('expense_id', expenseId)
    .order('position', { ascending: true })
  if (error) {
    throw error
  }
  return data
}

export async function listExpenseItemAssignments(
  expenseId: string,
): Promise<ExpenseItemAssignmentRow[]> {
  // PostgREST does not support filtering by an embedded relation's column with
  // `.eq('item.expense_id', ...)` - it would silently scan the whole table
  // (potential cross-trip leak via RLS gaps). Resolve the items first, then
  // filter assignments by their primary-key parents.
  const items = await listExpenseItems(expenseId)
  if (items.length === 0) {
    return []
  }
  const { data, error } = await supabase
    .from('expense_item_assignments')
    .select('*')
    .in(
      'item_id',
      items.map((i) => i.id),
    )
  if (error) {
    throw error
  }
  return data
}

export type UpsertExpenseWithItemsInput = {
  expenseId: string
  description: string
  // Amount in expense currency cents.
  amountCents: number
  currency: string
  // Amount in trip currency cents (used to derive splits).
  baseAmountCents: number
  fxRate: number
  items: SmartSplitItem[]
  assignments: SmartSplitAssignment[]
}

export async function upsertExpenseWithItems({
  expenseId,
  description,
  amountCents,
  currency,
  baseAmountCents,
  fxRate,
  items,
  assignments,
}: UpsertExpenseWithItemsInput) {
  const { data, error } = await supabase.rpc('upsert_expense_with_items', {
    _expense_id: expenseId,
    _description: description,
    _amount_cents: amountCents,
    _currency: currency,
    _base_amount_cents: baseAmountCents,
    _fx_rate: fxRate,
    _items: items.map((item) => ({
      label: item.label,
      amount_cents: item.amountCents,
      position: item.position,
    })),
    _assignments: assignments.map((assignment) => ({
      position: assignment.position,
      member_id: assignment.memberId,
      share: assignment.share,
    })),
  })
  if (error) {
    throw error
  }
  return data
}
