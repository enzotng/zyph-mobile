import { renderHook, waitFor } from '@testing-library/react-native'

import { createQueryWrapper } from '@/test-utils/query-wrapper'

import * as api from '../api/inbox.api'
import {
  proposalsQueryKey,
  useProposals,
  useRejectProposal,
  useValidateProposal,
} from './use-proposals'

jest.mock('@/lib/supabase')
jest.mock('../api/inbox.api')

const proposal = {
  id: 'p1',
  trip_id: 't1',
  status: 'pending' as const,
  source: 'email' as const,
  sender_email: 'friend@example.com',
  subject: 'Your booking confirmation',
  events: [],
  received_at: '2026-07-05T12:00:00Z',
  created_at: '2026-07-05T12:00:01Z',
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('useProposals', () => {
  it('fetches the proposal list for a trip', async () => {
    jest.mocked(api.getProposals).mockResolvedValue([proposal])
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useProposals('t1'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([proposal])
  })

  it('is disabled when tripId is empty', () => {
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useProposals(''), { wrapper })

    expect(result.current.fetchStatus).toBe('idle')
    expect(api.getProposals).not.toHaveBeenCalled()
  })
})

describe('useValidateProposal', () => {
  it('validates and invalidates both the proposals list and the trip timeline', async () => {
    jest.mocked(api.validateProposal).mockResolvedValue(undefined)
    const { wrapper, queryClient } = createQueryWrapper()
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useValidateProposal('t1'), { wrapper })
    result.current.mutate({ proposalId: 'p1', events: [] })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api.validateProposal).toHaveBeenCalledWith('p1', [])
    expect(invalidate).toHaveBeenCalledWith({ queryKey: proposalsQueryKey('t1') })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['trips', 't1', 'events'] })
  })
})

describe('useRejectProposal', () => {
  it('rejects and invalidates the proposals list', async () => {
    jest.mocked(api.rejectProposal).mockResolvedValue(undefined)
    const { wrapper, queryClient } = createQueryWrapper()
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useRejectProposal('t1'), { wrapper })
    result.current.mutate('p1')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api.rejectProposal).toHaveBeenCalledWith('p1', expect.anything())
    expect(invalidate).toHaveBeenCalledWith({ queryKey: proposalsQueryKey('t1') })
  })
})

describe('proposalsQueryKey', () => {
  it('returns the expected key', () => {
    expect(proposalsQueryKey('t1')).toEqual(['import-proposals', 't1'])
  })
})
