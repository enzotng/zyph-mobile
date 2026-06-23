import { renderHook, waitFor } from '@testing-library/react-native'

import { createQueryWrapper } from '@/test-utils/query-wrapper'

import * as api from '../api/notifications.api'
import {
  notificationPreferencesQueryKey,
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from './use-notification-preferences'

jest.mock('@/lib/supabase')
jest.mock('../api/notifications.api')

const preferences = {
  user_id: 'u1',
  push_enabled: true,
  members_enabled: true,
  expenses_enabled: false,
  settlements_enabled: true,
  timeline_enabled: true,
  packing_enabled: true,
  updated_at: '2026-06-06T10:00:00.000Z',
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('useNotificationPreferences', () => {
  it('fetches the preferences for the user', async () => {
    jest.mocked(api.getNotificationPreferences).mockResolvedValue(preferences)
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useNotificationPreferences('u1'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(preferences)
    expect(api.getNotificationPreferences).toHaveBeenCalledWith('u1')
  })

  it('is disabled without a user id', () => {
    const { wrapper } = createQueryWrapper()

    const { result } = renderHook(() => useNotificationPreferences(''), { wrapper })

    expect(result.current.fetchStatus).toBe('idle')
    expect(api.getNotificationPreferences).not.toHaveBeenCalled()
  })
})

describe('useUpdateNotificationPreferences', () => {
  it('writes the returned row into the cache on success', async () => {
    jest.mocked(api.upsertNotificationPreferences).mockResolvedValue(preferences)
    const { wrapper, queryClient } = createQueryWrapper()
    const setData = jest.spyOn(queryClient, 'setQueryData')

    const { result } = renderHook(() => useUpdateNotificationPreferences('u1'), { wrapper })
    result.current.mutate({
      userId: 'u1',
      pushEnabled: true,
      membersEnabled: true,
      expensesEnabled: false,
      settlementsEnabled: true,
      timelineEnabled: true,
      packingEnabled: true,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(setData).toHaveBeenCalledWith(notificationPreferencesQueryKey('u1'), preferences)
  })

  it('rolls the cache back to the pre-mutation snapshot when the upsert fails', async () => {
    // The query feeds the snapshot; its live observer also keeps the cached row from being GC'd
    // (the test client uses gcTime: 0), so onMutate captures the real value to roll back to.
    jest.mocked(api.getNotificationPreferences).mockResolvedValue(preferences)
    jest.mocked(api.upsertNotificationPreferences).mockRejectedValue(new Error('offline'))
    const { wrapper, queryClient } = createQueryWrapper()
    const key = notificationPreferencesQueryKey('u1')

    const { result } = renderHook(
      () => ({
        query: useNotificationPreferences('u1'),
        update: useUpdateNotificationPreferences('u1'),
      }),
      { wrapper },
    )

    await waitFor(() => expect(result.current.query.isSuccess).toBe(true))

    result.current.update.mutate({
      userId: 'u1',
      pushEnabled: false,
      membersEnabled: true,
      expensesEnabled: false,
      settlementsEnabled: true,
      timelineEnabled: true,
      packingEnabled: true,
    })

    // On failure the optimistic write is rolled back to the snapshot captured in onMutate, so the
    // cache (and thus the Switch) returns to its real value instead of silently keeping the failed
    // push_enabled: false change.
    await waitFor(() => expect(result.current.update.isError).toBe(true))
    expect(queryClient.getQueryData(key)).toMatchObject({ push_enabled: true })
  })
})
