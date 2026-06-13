import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  createExpenseWithItems,
  listExpenseItemAssignments,
  listExpenseItems,
  upsertExpenseWithItems,
} from '../api/expense-items.api'

import {
  balancesQueryKey,
  expensePayersQueryKey,
  expenseQueryKey,
  expenseSharesQueryKey,
  expenseSplitsQueryKey,
  expensesQueryKey,
} from './use-expenses'

export function expenseItemsQueryKey(expenseId: string) {
  return ['expenses', expenseId, 'items'] as const
}

export function expenseItemAssignmentsQueryKey(expenseId: string) {
  return ['expenses', expenseId, 'item-assignments'] as const
}

export function useExpenseItems(expenseId: string) {
  return useQuery({
    queryKey: expenseItemsQueryKey(expenseId),
    queryFn: () => listExpenseItems(expenseId),
    enabled: Boolean(expenseId),
  })
}

export function useExpenseItemAssignments(expenseId: string) {
  return useQuery({
    queryKey: expenseItemAssignmentsQueryKey(expenseId),
    queryFn: () => listExpenseItemAssignments(expenseId),
    enabled: Boolean(expenseId),
  })
}

export function useCreateExpenseWithItems(tripId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createExpenseWithItems,
    onSuccess: () => {
      // A new itemised expense changes the list and recomputes balances.
      void queryClient.invalidateQueries({ queryKey: expensesQueryKey(tripId) })
      void queryClient.invalidateQueries({ queryKey: balancesQueryKey(tripId) })
      void queryClient.invalidateQueries({ queryKey: expenseSharesQueryKey(tripId) })
    },
  })
}

export function useUpsertExpenseWithItems(tripId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: upsertExpenseWithItems,
    onSuccess: (updated) => {
      // Expense list + balances change because splits are recomputed.
      void queryClient.invalidateQueries({ queryKey: expensesQueryKey(tripId) })
      void queryClient.invalidateQueries({ queryKey: balancesQueryKey(tripId) })
      void queryClient.invalidateQueries({ queryKey: expenseSharesQueryKey(tripId) })
      void queryClient.invalidateQueries({ queryKey: expenseQueryKey(updated.id) })
      void queryClient.invalidateQueries({ queryKey: expenseSplitsQueryKey(updated.id) })
      void queryClient.invalidateQueries({ queryKey: expensePayersQueryKey(updated.id) })
      void queryClient.invalidateQueries({ queryKey: expenseItemsQueryKey(updated.id) })
      void queryClient.invalidateQueries({
        queryKey: expenseItemAssignmentsQueryKey(updated.id),
      })
    },
  })
}
