import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  createExpense,
  deleteExpense,
  getExpense,
  getTripBalances,
  listExpensePayers,
  listExpenseSplits,
  listExpenses,
  listMyExpenseShares,
  updateExpense,
} from '../api/expenses.api'

export function expensesQueryKey(tripId: string) {
  return ['trips', tripId, 'expenses'] as const
}

export function balancesQueryKey(tripId: string) {
  return ['trips', tripId, 'balances'] as const
}

export function expenseSharesQueryKey(tripId: string) {
  return ['trips', tripId, 'expense-shares'] as const
}

export function expenseQueryKey(expenseId: string) {
  return ['expenses', expenseId] as const
}

export function expenseSplitsQueryKey(expenseId: string) {
  return ['expenses', expenseId, 'splits'] as const
}

export function expensePayersQueryKey(expenseId: string) {
  return ['expenses', expenseId, 'payers'] as const
}

export function useExpenses(tripId: string) {
  return useQuery({
    queryKey: expensesQueryKey(tripId),
    queryFn: () => listExpenses(tripId),
    enabled: Boolean(tripId),
  })
}

export function useExpense(expenseId: string) {
  return useQuery({
    queryKey: expenseQueryKey(expenseId),
    queryFn: () => getExpense(expenseId),
    enabled: Boolean(expenseId),
  })
}

export function useExpenseSplits(expenseId: string) {
  return useQuery({
    queryKey: expenseSplitsQueryKey(expenseId),
    queryFn: () => listExpenseSplits(expenseId),
    enabled: Boolean(expenseId),
  })
}

export function useExpensePayers(expenseId: string) {
  return useQuery({
    queryKey: expensePayersQueryKey(expenseId),
    queryFn: () => listExpensePayers(expenseId),
    enabled: Boolean(expenseId),
  })
}

export function useTripBalances(tripId: string) {
  return useQuery({
    queryKey: balancesQueryKey(tripId),
    queryFn: () => getTripBalances(tripId),
    enabled: Boolean(tripId),
  })
}

// The signed-in member's share of each expense (memberId = their trip membership), for the feed's
// "your share" per row. Disabled until the membership is resolved.
export function useMyExpenseShares(tripId: string, memberId: string | null) {
  return useQuery({
    queryKey: [...expenseSharesQueryKey(tripId), memberId],
    queryFn: () => listMyExpenseShares(memberId as string),
    enabled: Boolean(tripId && memberId),
  })
}

export function useCreateExpense(tripId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createExpense,
    onSuccess: () => {
      // Refresh only what an expense affects: the expense list and the balances.
      void queryClient.invalidateQueries({ queryKey: expensesQueryKey(tripId) })
      void queryClient.invalidateQueries({ queryKey: balancesQueryKey(tripId) })
      void queryClient.invalidateQueries({ queryKey: expenseSharesQueryKey(tripId) })
    },
  })
}

export function useUpdateExpense(tripId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateExpense,
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: expensesQueryKey(tripId) })
      void queryClient.invalidateQueries({ queryKey: balancesQueryKey(tripId) })
      void queryClient.invalidateQueries({ queryKey: expenseSharesQueryKey(tripId) })
      void queryClient.invalidateQueries({ queryKey: expenseQueryKey(updated.id) })
      void queryClient.invalidateQueries({ queryKey: expenseSplitsQueryKey(updated.id) })
      void queryClient.invalidateQueries({ queryKey: expensePayersQueryKey(updated.id) })
    },
  })
}

export function useDeleteExpense(tripId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteExpense,
    onSuccess: (_data, expenseId) => {
      void queryClient.invalidateQueries({ queryKey: expensesQueryKey(tripId) })
      void queryClient.invalidateQueries({ queryKey: balancesQueryKey(tripId) })
      void queryClient.invalidateQueries({ queryKey: expenseSharesQueryKey(tripId) })
      queryClient.removeQueries({ queryKey: expenseQueryKey(expenseId) })
      queryClient.removeQueries({ queryKey: expenseSplitsQueryKey(expenseId) })
      queryClient.removeQueries({ queryKey: expensePayersQueryKey(expenseId) })
    },
  })
}
