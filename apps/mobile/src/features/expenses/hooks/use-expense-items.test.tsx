import { renderHook, waitFor } from '@testing-library/react-native'

import { createQueryWrapper } from '@/test-utils/query-wrapper'

import type { ExpenseItemAssignmentRow, ExpenseItemRow } from '../api/expense-items.api'
import * as api from '../api/expense-items.api'
import {
  expenseItemAssignmentsQueryKey,
  expenseItemsQueryKey,
  useExpenseItemAssignments,
  useExpenseItems,
  useUpsertExpenseWithItems,
} from './use-expense-items'
import {
  balancesQueryKey,
  expenseQueryKey,
  expenseSplitsQueryKey,
  expensesQueryKey,
} from './use-expenses'

jest.mock('@/lib/supabase')
jest.mock('../api/expense-items.api')

const item: ExpenseItemRow = {
  id: 'i1',
  expense_id: 'e1',
  label: 'Pizza',
  amount_cents: 1200,
  position: 0,
  created_at: '2024-01-01T00:00:00Z',
}

const assignment: ExpenseItemAssignmentRow = {
  id: 'a1',
  item_id: 'i1',
  member_id: 'm1',
  share: 1,
}

const upserted = {
  id: 'e1',
  trip_id: 't1',
  description: 'Dinner',
  amount_cents: 1200,
  base_amount_cents: 1200,
  currency: 'EUR',
  fx_rate: 1,
  created_by: 'u1',
  paid_by: 'm1',
  deleted_at: null,
  category: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  version: 1,
}

const upsertInput = {
  expenseId: 'e1',
  description: 'Dinner',
  amountCents: 1200,
  currency: 'EUR',
  baseAmountCents: 1200,
  fxRate: 1,
  items: [{ label: 'Pizza', amountCents: 1200, position: 0 }],
  assignments: [{ position: 0, memberId: 'm1', share: 1 }],
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('query key builders', () => {
  it('builds the expense items query key', () => {
    expect(expenseItemsQueryKey('e1')).toEqual(['expenses', 'e1', 'items'])
  })

  it('builds the expense item assignments query key', () => {
    expect(expenseItemAssignmentsQueryKey('e1')).toEqual(['expenses', 'e1', 'item-assignments'])
  })
})

describe('useExpenseItems', () => {
  it('fetches items for an expense', async () => {
    jest.mocked(api.listExpenseItems).mockResolvedValue([item])
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useExpenseItems('e1'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([item])
    expect(api.listExpenseItems).toHaveBeenCalledWith('e1')
  })

  it('surfaces an error when the fetch fails', async () => {
    jest.mocked(api.listExpenseItems).mockRejectedValue(new Error('boom'))
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useExpenseItems('e1'), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toEqual(new Error('boom'))
  })

  it('is disabled when expenseId is empty', () => {
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useExpenseItems(''), { wrapper })

    expect(result.current.fetchStatus).toBe('idle')
    expect(api.listExpenseItems).not.toHaveBeenCalled()
  })
})

describe('useExpenseItemAssignments', () => {
  it('fetches assignments for an expense', async () => {
    jest.mocked(api.listExpenseItemAssignments).mockResolvedValue([assignment])
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useExpenseItemAssignments('e1'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([assignment])
    expect(api.listExpenseItemAssignments).toHaveBeenCalledWith('e1')
  })

  it('surfaces an error when the fetch fails', async () => {
    jest.mocked(api.listExpenseItemAssignments).mockRejectedValue(new Error('fail'))
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useExpenseItemAssignments('e1'), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toEqual(new Error('fail'))
  })

  it('is disabled when expenseId is empty', () => {
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useExpenseItemAssignments(''), { wrapper })

    expect(result.current.fetchStatus).toBe('idle')
    expect(api.listExpenseItemAssignments).not.toHaveBeenCalled()
  })
})

describe('useUpsertExpenseWithItems', () => {
  it('invalidates list, balances, expense, splits, items and assignments on success', async () => {
    jest.mocked(api.upsertExpenseWithItems).mockResolvedValue(upserted)
    const { wrapper, queryClient } = createQueryWrapper()
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useUpsertExpenseWithItems('t1'), { wrapper })
    result.current.mutate(upsertInput)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api.upsertExpenseWithItems).toHaveBeenCalledTimes(1)
    expect(jest.mocked(api.upsertExpenseWithItems).mock.calls[0]?.[0]).toEqual(upsertInput)
    expect(invalidate).toHaveBeenCalledWith({ queryKey: expensesQueryKey('t1') })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: balancesQueryKey('t1') })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: expenseQueryKey('e1') })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: expenseSplitsQueryKey('e1') })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: expenseItemsQueryKey('e1') })
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: expenseItemAssignmentsQueryKey('e1'),
    })
  })

  it('does not invalidate when the mutation fails', async () => {
    jest.mocked(api.upsertExpenseWithItems).mockRejectedValue(new Error('nope'))
    const { wrapper, queryClient } = createQueryWrapper()
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useUpsertExpenseWithItems('t1'), { wrapper })
    result.current.mutate(upsertInput)

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toEqual(new Error('nope'))
    expect(invalidate).not.toHaveBeenCalled()
  })
})
