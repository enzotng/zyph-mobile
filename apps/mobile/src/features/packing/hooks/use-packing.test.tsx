import { renderHook, waitFor } from '@testing-library/react-native'

import { createQueryWrapper } from '@/test-utils/query-wrapper'

import * as api from '../api/packing.api'
import {
  packingQueryKey,
  useAddPackingItem,
  useAddPackingItems,
  useAssignPackingItem,
  useClaimPackingItem,
  useDeletePackingItem,
  useNudgePackingItem,
  usePackingItems,
  useSuggestPacking,
  useUpdatePackingItem,
} from './use-packing'

jest.mock('@/lib/supabase')
jest.mock('../api/packing.api')

const row = {
  id: 'p1',
  trip_id: 't1',
  scope: 'shared' as const,
  owner_id: 'u1',
  label: 'Passport',
  category: 'documents',
  quantity: 1,
  assigned_member: null,
  packed: false,
  created_at: '2026-06-06T00:00:00.000Z',
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('usePackingItems', () => {
  it('lists items for the trip', async () => {
    jest.mocked(api.listPackingItems).mockResolvedValue([row])
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => usePackingItems('t1'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([row])
  })

  it('is disabled without a trip id', () => {
    const { wrapper } = createQueryWrapper()
    const { result } = renderHook(() => usePackingItems(''), { wrapper })
    expect(result.current.fetchStatus).toBe('idle')
    expect(api.listPackingItems).not.toHaveBeenCalled()
  })
})

describe('useAddPackingItem', () => {
  it('adds then invalidates the packing query', async () => {
    jest.mocked(api.addPackingItem).mockResolvedValue(row)
    const { wrapper, queryClient } = createQueryWrapper()
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useAddPackingItem('t1'), { wrapper })
    result.current.mutate({
      tripId: 't1',
      scope: 'shared',
      ownerId: 'u1',
      label: 'Passport',
      category: 'documents',
      quantity: 1,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invalidate).toHaveBeenCalledWith({ queryKey: packingQueryKey('t1') })
  })
})

describe('useUpdatePackingItem', () => {
  it('updates with id + patch and invalidates', async () => {
    jest.mocked(api.updatePackingItem).mockResolvedValue()
    const { wrapper, queryClient } = createQueryWrapper()
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useUpdatePackingItem('t1'), { wrapper })
    result.current.mutate({ id: 'p1', patch: { packed: true } })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api.updatePackingItem).toHaveBeenCalledWith('p1', { packed: true })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: packingQueryKey('t1') })
  })
})

describe('useDeletePackingItem', () => {
  it('deletes then invalidates', async () => {
    jest.mocked(api.deletePackingItem).mockResolvedValue()
    const { wrapper, queryClient } = createQueryWrapper()
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useDeletePackingItem('t1'), { wrapper })
    result.current.mutate('p1')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api.deletePackingItem).toHaveBeenCalledWith('p1')
    expect(invalidate).toHaveBeenCalledWith({ queryKey: packingQueryKey('t1') })
  })
})

describe('useAssignPackingItem', () => {
  it('assigns then invalidates', async () => {
    jest.mocked(api.assignPackingItem).mockResolvedValue()
    const { wrapper, queryClient } = createQueryWrapper()
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useAssignPackingItem('t1'), { wrapper })
    result.current.mutate({ itemId: 'p1', memberId: 'm2' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api.assignPackingItem).toHaveBeenCalledWith('p1', 'm2')
    expect(invalidate).toHaveBeenCalledWith({ queryKey: packingQueryKey('t1') })
  })
})

describe('useClaimPackingItem', () => {
  it('claims then invalidates', async () => {
    jest.mocked(api.claimPackingItem).mockResolvedValue()
    const { wrapper, queryClient } = createQueryWrapper()
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useClaimPackingItem('t1'), { wrapper })
    result.current.mutate('p1')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api.claimPackingItem).toHaveBeenCalledWith('p1')
    expect(invalidate).toHaveBeenCalledWith({ queryKey: packingQueryKey('t1') })
  })
})

describe('useNudgePackingItem', () => {
  it('nudges without invalidating the packing query', async () => {
    jest.mocked(api.nudgePackingItem).mockResolvedValue()
    const { wrapper, queryClient } = createQueryWrapper()
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useNudgePackingItem(), { wrapper })
    result.current.mutate('p1')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api.nudgePackingItem).toHaveBeenCalledWith('p1')
    expect(invalidate).not.toHaveBeenCalled()
  })
})

describe('useSuggestPacking', () => {
  it('returns deduped suggestions without inserting', async () => {
    jest.mocked(api.generatePackingSuggestions).mockResolvedValue([
      { label: 'Passport', category: 'documents', quantity: 1 },
      { label: 'Socks', category: 'clothes', quantity: 3, reason: 'cold' },
    ])
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useSuggestPacking(), { wrapper })
    result.current.mutate({
      destination: 'Lisbon',
      days: 3,
      weather: 'mild',
      language: 'en',
      activities: '- [hike] Sintra',
      mode: 'generate',
      existing: [{ label: 'Passport' }],
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([
      { label: 'Socks', category: 'clothes', quantity: 3, reason: 'cold' },
    ])
    expect(api.addPackingItems).not.toHaveBeenCalled()
  })
})

describe('useAddPackingItems', () => {
  it('bulk-adds then invalidates the packing query', async () => {
    jest.mocked(api.addPackingItems).mockResolvedValue()
    const { wrapper, queryClient } = createQueryWrapper()
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useAddPackingItems('t1'), { wrapper })
    result.current.mutate([
      {
        tripId: 't1',
        scope: 'shared',
        ownerId: 'u1',
        label: 'Socks',
        category: 'clothes',
        quantity: 3,
      },
    ])

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api.addPackingItems).toHaveBeenCalled()
    expect(invalidate).toHaveBeenCalledWith({ queryKey: packingQueryKey('t1') })
  })
})
