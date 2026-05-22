import { renderHook, waitFor } from '@testing-library/react-native'

import { createQueryWrapper } from '@/test-utils/query-wrapper'

import * as api from '../api/expenses.api'
import {
  balancesQueryKey,
  expensesQueryKey,
  useCreateExpense,
  useExpenses,
  useTripBalances,
} from './use-expenses'

jest.mock('@/lib/supabase')
jest.mock('../api/expenses.api')

const expense = {
  id: 'e1',
  trip_id: 't1',
  description: 'Dinner',
  amount_cents: 5000,
  base_amount_cents: 5000,
  currency: 'EUR',
  fx_rate: 1,
  created_by: 'u1',
  paid_by: 'm1',
  deleted_at: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  version: 1,
}

const balance = {
  member_id: 'm1',
  user_id: 'u1',
  paid_cents: 5000,
  owed_cents: 2500,
  balance_cents: 2500,
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('useExpenses', () => {
  it('fetches the expense list for a trip', async () => {
    jest.mocked(api.listExpenses).mockResolvedValue([expense])
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useExpenses('t1'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([expense])
  })

  it('is disabled when tripId is empty', () => {
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useExpenses(''), { wrapper })

    expect(result.current.fetchStatus).toBe('idle')
    expect(api.listExpenses).not.toHaveBeenCalled()
  })
})

describe('useTripBalances', () => {
  it('fetches the balances for a trip', async () => {
    jest.mocked(api.getTripBalances).mockResolvedValue([balance])
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useTripBalances('t1'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([balance])
  })

  it('is disabled when tripId is empty', () => {
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useTripBalances(''), { wrapper })

    expect(result.current.fetchStatus).toBe('idle')
    expect(api.getTripBalances).not.toHaveBeenCalled()
  })
})

describe('useCreateExpense', () => {
  it('invalidates expenses and balances on success', async () => {
    jest.mocked(api.createExpense).mockResolvedValue(expense)
    const { wrapper, queryClient } = createQueryWrapper()
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useCreateExpense('t1'), { wrapper })
    result.current.mutate({
      tripId: 't1',
      description: 'Dinner',
      amountCents: 5000,
      currency: 'EUR',
      baseAmountCents: 5000,
      fxRate: 1,
      splits: [{ memberId: 'm1', shareCents: 5000 }],
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invalidate).toHaveBeenCalledWith({ queryKey: expensesQueryKey('t1') })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: balancesQueryKey('t1') })
  })
})
