import { supabase } from '@/lib/supabase'
import { makePostgrestError, makeQueryBuilder } from '@/test-utils/supabase-mock'

import {
  deletePushToken,
  getNotificationPreferences,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  registerPushToken,
  upsertNotificationPreferences,
} from './notifications.api'

jest.mock('@/lib/supabase')

const from = supabase.from as jest.Mock
const rpc = supabase.rpc as jest.Mock

const notification = {
  id: 'n1',
  recipient_id: 'u1',
  actor_id: 'u2',
  trip_id: 't1',
  type: 'expense.added',
  payload: { expenseId: 'e1' },
  read_at: null,
  created_at: '2026-06-06T10:00:00.000Z',
}

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

describe('listNotifications', () => {
  it('returns the rows newest first', async () => {
    const builder = makeQueryBuilder({ data: [notification], error: null })
    from.mockReturnValue(builder)

    await expect(listNotifications()).resolves.toEqual([notification])
    expect(from).toHaveBeenCalledWith('notifications')
    expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(builder.limit).toHaveBeenCalledWith(100)
  })

  it('throws on error', async () => {
    from.mockReturnValue(makeQueryBuilder({ data: null, error: makePostgrestError('boom') }))
    await expect(listNotifications()).rejects.toThrow('boom')
  })
})

describe('markNotificationRead', () => {
  it('calls the rpc with the id', async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    await expect(markNotificationRead('n1')).resolves.toBeUndefined()
    expect(rpc).toHaveBeenCalledWith('mark_notification_read', { _id: 'n1' })
  })

  it('throws on error', async () => {
    rpc.mockResolvedValue({ data: null, error: makePostgrestError('nope') })
    await expect(markNotificationRead('n1')).rejects.toThrow('nope')
  })
})

describe('markAllNotificationsRead', () => {
  it('calls the rpc', async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    await expect(markAllNotificationsRead()).resolves.toBeUndefined()
    expect(rpc).toHaveBeenCalledWith('mark_all_notifications_read')
  })

  it('throws on error', async () => {
    rpc.mockResolvedValue({ data: null, error: makePostgrestError('nope') })
    await expect(markAllNotificationsRead()).rejects.toThrow('nope')
  })
})

describe('registerPushToken', () => {
  it('calls the rpc with the token, platform and locale', async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    await expect(registerPushToken('ExpoTok[abc]', 'ios', 'en-US')).resolves.toBeUndefined()
    expect(rpc).toHaveBeenCalledWith('register_push_token', {
      _token: 'ExpoTok[abc]',
      _platform: 'ios',
      _locale: 'en-US',
    })
  })

  it('throws on error', async () => {
    rpc.mockResolvedValue({ data: null, error: makePostgrestError('nope') })
    await expect(registerPushToken('t', 'android')).rejects.toThrow('nope')
  })
})

describe('deletePushToken', () => {
  it('deletes the row by token', async () => {
    const builder = makeQueryBuilder({ data: null, error: null })
    from.mockReturnValue(builder)

    await expect(deletePushToken('ExpoTok[abc]')).resolves.toBeUndefined()
    expect(from).toHaveBeenCalledWith('push_tokens')
    expect(builder.delete).toHaveBeenCalled()
    expect(builder.eq).toHaveBeenCalledWith('token', 'ExpoTok[abc]')
  })

  it('throws on error', async () => {
    from.mockReturnValue(makeQueryBuilder({ data: null, error: makePostgrestError('del') }))
    await expect(deletePushToken('t')).rejects.toThrow('del')
  })
})

describe('getNotificationPreferences', () => {
  it('returns the row when present', async () => {
    const builder = makeQueryBuilder({ data: preferences, error: null })
    from.mockReturnValue(builder)

    await expect(getNotificationPreferences('u1')).resolves.toEqual(preferences)
    expect(from).toHaveBeenCalledWith('notification_preferences')
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'u1')
  })

  it('returns null when none exists', async () => {
    from.mockReturnValue(makeQueryBuilder({ data: null, error: null }))
    await expect(getNotificationPreferences('u1')).resolves.toBeNull()
  })

  it('throws on error', async () => {
    from.mockReturnValue(makeQueryBuilder({ data: null, error: makePostgrestError('boom') }))
    await expect(getNotificationPreferences('u1')).rejects.toThrow('boom')
  })
})

describe('upsertNotificationPreferences', () => {
  const input = {
    userId: 'u1',
    pushEnabled: true,
    membersEnabled: true,
    expensesEnabled: false,
    settlementsEnabled: true,
    timelineEnabled: true,
    packingEnabled: true,
  }

  it('upserts the full row mapped to db columns', async () => {
    const builder = makeQueryBuilder({ data: preferences, error: null })
    from.mockReturnValue(builder)

    await expect(upsertNotificationPreferences(input)).resolves.toEqual(preferences)
    expect(builder.upsert).toHaveBeenCalledWith(
      {
        user_id: 'u1',
        push_enabled: true,
        members_enabled: true,
        expenses_enabled: false,
        settlements_enabled: true,
        timeline_enabled: true,
        packing_enabled: true,
      },
      { onConflict: 'user_id' },
    )
  })

  it('throws on error', async () => {
    from.mockReturnValue(makeQueryBuilder({ data: null, error: makePostgrestError('boom') }))
    await expect(upsertNotificationPreferences(input)).rejects.toThrow('boom')
  })
})
