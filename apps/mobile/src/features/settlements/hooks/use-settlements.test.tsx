import { renderHook, waitFor } from '@testing-library/react-native'

import { createQueryWrapper } from '@/test-utils/query-wrapper'

import * as api from '../api/settlements.api'
import { settlementsQueryKey, useRecordSettlement, useSettlements } from './use-settlements'

jest.mock('@/lib/supabase')
jest.mock('../api/settlements.api')

const settlement = {
  id: 's1',
  trip_id: 't1',
  from_member: 'm1',
  to_member: 'm2',
  amount_cents: 2500,
  currency: 'EUR',
  status: 'active' as const,
  paid_at: '2026-06-04T00:00:00.000Z',
  created_by: 'u1',
  created_at: '2026-06-04T00:00:00.000Z',
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('useSettlements', () => {
  it('lists settlements for the trip', async () => {
    jest.mocked(api.listSettlements).mockResolvedValue([settlement])
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useSettlements('t1'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([settlement])
    expect(api.listSettlements).toHaveBeenCalledWith('t1')
  })

  it('is disabled when tripId is empty', () => {
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useSettlements(''), { wrapper })

    expect(result.current.fetchStatus).toBe('idle')
    expect(api.listSettlements).not.toHaveBeenCalled()
  })
})

describe('useRecordSettlement', () => {
  it('invalidates settlements and balances on success', async () => {
    jest.mocked(api.recordSettlement).mockResolvedValue(settlement)
    const { wrapper, queryClient } = createQueryWrapper()
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useRecordSettlement('t1'), { wrapper })
    result.current.mutate({
      tripId: 't1',
      fromMemberId: 'm1',
      toMemberId: 'm2',
      amountCents: 2500,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invalidate).toHaveBeenCalledWith({ queryKey: settlementsQueryKey('t1') })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['trips', 't1', 'balances'] })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['trips'], exact: true })
  })
})
