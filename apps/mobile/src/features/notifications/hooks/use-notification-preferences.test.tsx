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
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(setData).toHaveBeenCalledWith(notificationPreferencesQueryKey('u1'), preferences)
  })
})
