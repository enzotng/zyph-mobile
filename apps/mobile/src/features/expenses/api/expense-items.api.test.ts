import { supabase } from '@/lib/supabase'
import { makePostgrestError, makeQueryBuilder } from '@/test-utils/supabase-mock'

import type { SmartSplitAssignment, SmartSplitItem } from '../items-schemas'

import {
  listExpenseItemAssignments,
  listExpenseItems,
  upsertExpenseWithItems,
} from './expense-items.api'

jest.mock('@/lib/supabase')

const from = supabase.from as jest.Mock
const rpc = supabase.rpc as jest.Mock

const item = {
  id: 'i1',
  expense_id: 'e1',
  label: 'Pizza',
  amount_cents: 1200,
  position: 0,
  created_at: '2024-01-01T00:00:00Z',
}

const assignment = {
  id: 'a1',
  item_id: 'i1',
  member_id: 'm1',
  share: 1,
  created_at: '2024-01-01T00:00:00Z',
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('listExpenseItems', () => {
  it('returns items filtered by expense id, ordered by position asc', async () => {
    const builder = makeQueryBuilder({ data: [item], error: null })
    from.mockReturnValue(builder)

    await expect(listExpenseItems('e1')).resolves.toEqual([item])
    expect(from).toHaveBeenCalledWith('expense_items')
    expect(builder.eq).toHaveBeenCalledWith('expense_id', 'e1')
    expect(builder.order).toHaveBeenCalledWith('position', { ascending: true })
  })

  it('throws when the query errors', async () => {
    from.mockReturnValue(makeQueryBuilder({ data: null, error: makePostgrestError('items fail') }))

    await expect(listExpenseItems('e1')).rejects.toThrow('items fail')
  })
})

describe('listExpenseItemAssignments', () => {
  it('returns assignments filtered by the resolved item ids', async () => {
    const itemsBuilder = makeQueryBuilder({ data: [item], error: null })
    const assignmentsBuilder = makeQueryBuilder({ data: [assignment], error: null })
    from.mockReturnValueOnce(itemsBuilder).mockReturnValueOnce(assignmentsBuilder)

    await expect(listExpenseItemAssignments('e1')).resolves.toEqual([assignment])
    expect(from).toHaveBeenNthCalledWith(1, 'expense_items')
    expect(from).toHaveBeenNthCalledWith(2, 'expense_item_assignments')
    expect(assignmentsBuilder.in).toHaveBeenCalledWith('item_id', ['i1'])
  })

  it('returns an empty array without querying assignments when there are no items', async () => {
    from.mockReturnValueOnce(makeQueryBuilder({ data: [], error: null }))

    await expect(listExpenseItemAssignments('e1')).resolves.toEqual([])
    expect(from).toHaveBeenCalledTimes(1)
    expect(from).toHaveBeenCalledWith('expense_items')
  })

  it('throws when resolving the items fails', async () => {
    from.mockReturnValueOnce(
      makeQueryBuilder({ data: null, error: makePostgrestError('items fail') }),
    )

    await expect(listExpenseItemAssignments('e1')).rejects.toThrow('items fail')
    expect(from).toHaveBeenCalledTimes(1)
  })

  it('throws when the assignments query errors', async () => {
    from
      .mockReturnValueOnce(makeQueryBuilder({ data: [item], error: null }))
      .mockReturnValueOnce(
        makeQueryBuilder({ data: null, error: makePostgrestError('assignments fail') }),
      )

    await expect(listExpenseItemAssignments('e1')).rejects.toThrow('assignments fail')
  })
})

describe('upsertExpenseWithItems', () => {
  const items: SmartSplitItem[] = [{ label: 'Pizza', amountCents: 1200, position: 0 }]
  const assignments: SmartSplitAssignment[] = [{ position: 0, memberId: 'm1', share: 1 }]
  const input = {
    expenseId: 'e1',
    description: 'Dinner',
    amountCents: 1200,
    currency: 'EUR',
    baseAmountCents: 1200,
    fxRate: 1,
    items,
    assignments,
  }

  it('calls rpc upsert_expense_with_items with mapped arguments', async () => {
    rpc.mockResolvedValue({ data: 'e1', error: null })

    await expect(upsertExpenseWithItems(input)).resolves.toBe('e1')
    expect(rpc).toHaveBeenCalledWith('upsert_expense_with_items', {
      _expense_id: 'e1',
      _description: 'Dinner',
      _amount_cents: 1200,
      _currency: 'EUR',
      _base_amount_cents: 1200,
      _fx_rate: 1,
      _items: [{ label: 'Pizza', amount_cents: 1200, position: 0 }],
      _assignments: [{ position: 0, member_id: 'm1', share: 1 }],
    })
  })

  it('maps empty item and assignment arrays to empty payloads', async () => {
    rpc.mockResolvedValue({ data: 'e1', error: null })

    await upsertExpenseWithItems({ ...input, items: [], assignments: [] })
    expect(rpc).toHaveBeenCalledWith(
      'upsert_expense_with_items',
      expect.objectContaining({ _items: [], _assignments: [] }),
    )
  })

  it('throws when rpc errors', async () => {
    rpc.mockResolvedValue({ data: null, error: makePostgrestError('upsert fail') })

    await expect(upsertExpenseWithItems(input)).rejects.toThrow('upsert fail')
  })
})
