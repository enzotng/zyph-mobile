import { renderHook, waitFor } from '@testing-library/react-native'

import { createQueryWrapper } from '@/test-utils/query-wrapper'

import * as api from '../api/notifications.api'
import {
  notificationsQueryKey,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadNotificationCount,
} from './use-notifications'

jest.mock('@/lib/supabase')
jest.mock('../api/notifications.api')

const read = {
  id: 'n1',
  recipient_id: 'u1',
  actor_id: 'u2',
  trip_id: 't1',
  type: 'expense.added',
  payload: {},
  read_at: '2026-06-06T11:00:00.000Z',
  created_at: '2026-06-06T10:00:00.000Z',
}
const unread = { ...read, id: 'n2', read_at: null }

beforeEach(() => {
  jest.clearAllMocks()
})

describe('useNotifications', () => {
  it('lists notifications', async () => {
    jest.mocked(api.listNotifications).mockResolvedValue([read, unread])
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useNotifications(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([read, unread])
  })
})

describe('useUnreadNotificationCount', () => {
  it('counts only the unread notifications', async () => {
    jest.mocked(api.listNotifications).mockResolvedValue([read, unread])
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useUnreadNotificationCount(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBe(1)
  })
})

describe('useMarkNotificationRead', () => {
  it('invalidates the notifications query on success', async () => {
    jest.mocked(api.markNotificationRead).mockResolvedValue()
    const { wrapper, queryClient } = createQueryWrapper()
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useMarkNotificationRead(), { wrapper })
    result.current.mutate('n2')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api.markNotificationRead).toHaveBeenCalledWith('n2')
    expect(invalidate).toHaveBeenCalledWith({ queryKey: notificationsQueryKey })
  })
})

describe('useMarkAllNotificationsRead', () => {
  it('invalidates the notifications query on success', async () => {
    jest.mocked(api.markAllNotificationsRead).mockResolvedValue()
    const { wrapper, queryClient } = createQueryWrapper()
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useMarkAllNotificationsRead(), { wrapper })
    result.current.mutate()

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invalidate).toHaveBeenCalledWith({ queryKey: notificationsQueryKey })
  })
})
