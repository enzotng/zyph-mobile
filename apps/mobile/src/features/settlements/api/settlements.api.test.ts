import { supabase } from '@/lib/supabase'
import { makePostgrestError, makeQueryBuilder } from '@/test-utils/supabase-mock'

import { listSettlements, recordSettlement, reverseSettlement } from './settlements.api'

jest.mock('@/lib/supabase')

const from = supabase.from as jest.Mock
const rpc = supabase.rpc as jest.Mock

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

describe('recordSettlement', () => {
  const input = {
    tripId: 't1',
    fromMemberId: 'm1',
    toMemberId: 'm2',
    amountCents: 2500,
  }

  it('calls rpc record_settlement with mapped arguments', async () => {
    rpc.mockResolvedValue({ data: settlement, error: null })

    await expect(recordSettlement(input)).resolves.toEqual(settlement)
    expect(rpc).toHaveBeenCalledWith('record_settlement', {
      _trip_id: 't1',
      _from_member: 'm1',
      _to_member: 'm2',
      _amount_cents: 2500,
    })
  })

  it('throws when rpc errors', async () => {
    rpc.mockResolvedValue({ data: null, error: makePostgrestError('amount must be positive') })

    await expect(recordSettlement(input)).rejects.toThrow('amount must be positive')
  })
})

describe('listSettlements', () => {
  it('queries active settlements for the trip, newest first', async () => {
    const builder = makeQueryBuilder({ data: [settlement], error: null })
    from.mockReturnValue(builder)

    await expect(listSettlements('t1')).resolves.toEqual([settlement])
    expect(from).toHaveBeenCalledWith('trip_settlements')
    expect(builder.eq).toHaveBeenCalledWith('trip_id', 't1')
    expect(builder.eq).toHaveBeenCalledWith('status', 'active')
    expect(builder.order).toHaveBeenCalledWith('paid_at', { ascending: false })
  })

  it('throws when the query errors', async () => {
    from.mockReturnValue(makeQueryBuilder({ data: null, error: makePostgrestError('list fail') }))

    await expect(listSettlements('t1')).rejects.toThrow('list fail')
  })
})

describe('reverseSettlement', () => {
  it('calls rpc reverse_settlement with the id', async () => {
    rpc.mockResolvedValue({ data: { ...settlement, status: 'reversed' }, error: null })

    await expect(reverseSettlement('s1')).resolves.toEqual({ ...settlement, status: 'reversed' })
    expect(rpc).toHaveBeenCalledWith('reverse_settlement', { _id: 's1' })
  })

  it('throws when rpc errors', async () => {
    rpc.mockResolvedValue({ data: null, error: makePostgrestError('settlement is not active') })

    await expect(reverseSettlement('s1')).rejects.toThrow('settlement is not active')
  })
})
