import { supabase } from '@/lib/supabase'
import { makePostgrestError, makeQueryBuilder } from '@/test-utils/supabase-mock'

import { createExpense, getTripBalances, listExpenses } from './expenses.api'

jest.mock('@/lib/supabase')

const from = supabase.from as jest.Mock
const rpc = supabase.rpc as jest.Mock

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

describe('getTripBalances', () => {
  it('calls rpc get_trip_balances with the trip id', async () => {
    rpc.mockResolvedValue({ data: [balance], error: null })

    await expect(getTripBalances('t1')).resolves.toEqual([balance])
    expect(rpc).toHaveBeenCalledWith('get_trip_balances', { _trip_id: 't1' })
  })

  it('throws when rpc errors', async () => {
    rpc.mockResolvedValue({ data: null, error: makePostgrestError('rpc error') })

    await expect(getTripBalances('t1')).rejects.toThrow('rpc error')
  })
})

describe('listExpenses', () => {
  it('returns expenses filtered by trip id, ordered by created_at desc', async () => {
    const builder = makeQueryBuilder({ data: [expense], error: null })
    from.mockReturnValue(builder)

    await expect(listExpenses('t1')).resolves.toEqual([expense])
    expect(from).toHaveBeenCalledWith('expenses')
    expect(builder.eq).toHaveBeenCalledWith('trip_id', 't1')
    expect(builder.is).toHaveBeenCalledWith('deleted_at', null)
    expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false })
  })

  it('throws when the query errors', async () => {
    from.mockReturnValue(makeQueryBuilder({ data: null, error: makePostgrestError('list fail') }))

    await expect(listExpenses('t1')).rejects.toThrow('list fail')
  })
})

describe('createExpense', () => {
  const input = {
    tripId: 't1',
    description: 'Dinner',
    amountCents: 5000,
    currency: 'EUR',
    baseAmountCents: 5000,
    fxRate: 1,
    splits: [
      { memberId: 'm1', shareCents: 2500 },
      { memberId: 'm2', shareCents: 2500 },
    ],
  }

  it('calls rpc create_expense_with_splits with mapped arguments', async () => {
    rpc.mockResolvedValue({ data: expense, error: null })

    await expect(createExpense(input)).resolves.toEqual(expense)
    expect(rpc).toHaveBeenCalledWith('create_expense_with_splits', {
      _trip_id: 't1',
      _description: 'Dinner',
      _amount_cents: 5000,
      _currency: 'EUR',
      _base_amount_cents: 5000,
      _fx_rate: 1,
      _splits: [
        { member_id: 'm1', share_cents: 2500 },
        { member_id: 'm2', share_cents: 2500 },
      ],
    })
  })

  it('throws when rpc errors', async () => {
    rpc.mockResolvedValue({ data: null, error: makePostgrestError('create fail') })

    await expect(createExpense(input)).rejects.toThrow('create fail')
  })
})
