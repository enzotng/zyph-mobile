import { renderHook, waitFor } from '@testing-library/react-native'

import { createExpense } from '@/features/expenses'
import type { TripMember } from '@/features/group'
import { addPackingItems, generatePackingSuggestions } from '@/features/packing'
import { recordSettlement } from '@/features/settlements'
import { createEvent } from '@/features/timeline'
import type { Trip } from '@/features/trips'
import { createQueryWrapper } from '@/test-utils/query-wrapper'

import type { CopilotAction } from '../schemas'
import { useExecuteCopilotAction } from './use-execute-action'

jest.mock('@/lib/supabase')
jest.mock('@/features/expenses', () => ({ createExpense: jest.fn() }))
jest.mock('@/features/timeline', () => ({ createEvent: jest.fn() }))
jest.mock('@/features/settlements', () => ({ recordSettlement: jest.fn() }))
jest.mock('@/features/packing', () => ({
  addPackingItems: jest.fn(),
  generatePackingSuggestions: jest.fn(),
}))

const members: TripMember[] = [
  {
    id: 'm1',
    user_id: 'u1',
    role: 'owner',
    status: 'active',
    display_name: 'Ana',
    avatar_url: null,
  },
  {
    id: 'm2',
    user_id: 'u2',
    role: 'member',
    status: 'active',
    display_name: 'Bob',
    avatar_url: null,
  },
]

const trip = {
  id: 't1',
  currency: 'EUR',
  destination: 'Lisbon',
  start_date: null,
  end_date: null,
} as unknown as Trip

beforeEach(() => {
  jest.clearAllMocks()
})

function run(action: CopilotAction) {
  const { wrapper } = createQueryWrapper()
  const { result } = renderHook(() => useExecuteCopilotAction('t1'), { wrapper })
  result.current.mutate({ action, members, myUserId: 'u1', trip, language: 'en' })
  return result
}

describe('useExecuteCopilotAction', () => {
  it('add_expense: creates an equal-split expense paid by the user', async () => {
    jest.mocked(createExpense).mockResolvedValue({} as never)
    const result = run({
      tool: 'add_expense',
      args: { description: 'Dinner', amount: 40, splitWith: 'all' },
      text: '',
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(createExpense).toHaveBeenCalledWith(
      expect.objectContaining({
        tripId: 't1',
        description: 'Dinner',
        amountCents: 4000,
        baseAmountCents: 4000,
        fxRate: 1,
        splits: [
          { memberId: 'm1', shareCents: 2000 },
          { memberId: 'm2', shareCents: 2000 },
        ],
      }),
    )
  })

  it('record_settlement: resolves names to member ids', async () => {
    jest.mocked(recordSettlement).mockResolvedValue({} as never)
    const result = run({
      tool: 'record_settlement',
      args: { from: 'Ana', to: 'Bob', amount: 20 },
      text: '',
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(recordSettlement).toHaveBeenCalledWith({
      tripId: 't1',
      fromMemberId: 'm1',
      toMemberId: 'm2',
      amountCents: 2000,
    })
  })

  it('add_event: builds startsAt from date + time', async () => {
    jest.mocked(createEvent).mockResolvedValue({} as never)
    const result = run({
      tool: 'add_event',
      args: { title: 'Flight', type: 'flight', date: '2026-06-20', time: '09:00' },
      text: '',
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(createEvent).toHaveBeenCalledWith(
      expect.objectContaining({ tripId: 't1', title: 'Flight', type: 'flight' }),
    )
  })

  it('add_packing: generates then bulk-adds to the chosen scope', async () => {
    jest
      .mocked(generatePackingSuggestions)
      .mockResolvedValue([{ label: 'Boots', category: 'clothes', quantity: 1 }])
    jest.mocked(addPackingItems).mockResolvedValue([])
    const result = run({
      tool: 'add_packing',
      args: { scope: 'shared', request: 'hiking gear' },
      text: '',
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(generatePackingSuggestions).toHaveBeenCalled()
    expect(addPackingItems).toHaveBeenCalledWith([
      expect.objectContaining({ label: 'Boots', scope: 'shared', ownerId: 'u1', tripId: 't1' }),
    ])
  })

  it('add_expense: rejects an invalid amount', async () => {
    const result = run({ tool: 'add_expense', args: { description: 'X', amount: -1 }, text: '' })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(createExpense).not.toHaveBeenCalled()
  })
})
