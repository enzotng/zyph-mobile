import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { createExpense, listExpenses } from '../api/expenses.api'

export function expensesQueryKey(tripId: string) {
  return ['trips', tripId, 'expenses'] as const
}

export function useExpenses(tripId: string) {
  return useQuery({
    queryKey: expensesQueryKey(tripId),
    queryFn: () => listExpenses(tripId),
    enabled: Boolean(tripId),
  })
}

export function useCreateExpense(tripId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createExpense,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: expensesQueryKey(tripId) })
    },
  })
}
