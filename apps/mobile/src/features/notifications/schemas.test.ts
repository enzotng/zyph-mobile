import {
  categoryForType,
  groupNotificationsByDay,
  NOTIFICATION_TYPES,
  type Notification,
  notificationContext,
  notificationIcon,
  notificationMessageKey,
} from './schemas'

function at(iso: string): Notification {
  return {
    id: iso,
    recipient_id: 'u1',
    actor_id: null,
    trip_id: 't1',
    type: 'expense.added',
    payload: {},
    read_at: null,
    created_at: iso,
  }
}

describe('categoryForType', () => {
  it('maps every emitted notification type to a category', () => {
    for (const type of NOTIFICATION_TYPES) {
      expect(categoryForType(type)).not.toBeNull()
    }
  })

  it('maps each prefix to the matching category', () => {
    expect(categoryForType('member.added')).toBe('members')
    expect(categoryForType('expense.updated')).toBe('expenses')
    expect(categoryForType('settlement.created')).toBe('settlements')
    expect(categoryForType('event.added')).toBe('timeline')
    expect(categoryForType('packing.assigned')).toBe('packing')
  })

  it('returns null for an unknown prefix', () => {
    expect(categoryForType('unknown.thing')).toBeNull()
    expect(categoryForType('')).toBeNull()
  })
})

describe('notificationMessageKey', () => {
  it('resolves a key for every emitted type', () => {
    for (const type of NOTIFICATION_TYPES) {
      expect(notificationMessageKey(type, {})).toMatch(/^notifications\.types\./)
    }
  })

  it('splits settlement.created on the payload role', () => {
    expect(notificationMessageKey('settlement.created', { role: 'to' })).toBe(
      'notifications.types.settlementTo',
    )
    expect(notificationMessageKey('settlement.created', { role: 'from' })).toBe(
      'notifications.types.settlementFrom',
    )
    expect(notificationMessageKey('settlement.created', null)).toBe(
      'notifications.types.settlementFrom',
    )
  })

  it('maps settlement.reversed to a single key', () => {
    expect(notificationMessageKey('settlement.reversed', { role: 'to' })).toBe(
      'notifications.types.settlementReversed',
    )
  })

  it('maps packing types to their keys', () => {
    expect(notificationMessageKey('packing.assigned', {})).toBe(
      'notifications.types.packingAssigned',
    )
    expect(notificationMessageKey('packing.nudged', {})).toBe('notifications.types.packingNudged')
    expect(notificationMessageKey('packing.reminder', {})).toBe(
      'notifications.types.packingReminder',
    )
  })

  it('falls back to a generic key for unknown types', () => {
    expect(notificationMessageKey('weird.thing', {})).toBe('notifications.types.generic')
  })
})

describe('notificationIcon', () => {
  it('maps categories to glyphs and falls back', () => {
    expect(notificationIcon('member.left')).toBe('people-outline')
    expect(notificationIcon('expense.added')).toBe('card-outline')
    expect(notificationIcon('settlement.created')).toBe('swap-horizontal-outline')
    expect(notificationIcon('event.added')).toBe('calendar-outline')
    expect(notificationIcon('packing.assigned')).toBe('bag-handle-outline')
    expect(notificationIcon('weird.thing')).toBe('notifications-outline')
  })
})

describe('notificationContext', () => {
  it('returns description or title when present', () => {
    expect(notificationContext({ description: 'Dinner' })).toBe('Dinner')
    expect(notificationContext({ title: 'Museum' })).toBe('Museum')
  })

  it('returns null when absent or blank', () => {
    expect(notificationContext({})).toBeNull()
    expect(notificationContext(null)).toBeNull()
    expect(notificationContext({ description: '   ' })).toBeNull()
  })
})

describe('groupNotificationsByDay', () => {
  const now = new Date('2026-06-06T12:00:00.000Z')

  it('buckets into today, yesterday and earlier, dropping empty buckets', () => {
    const groups = groupNotificationsByDay(
      [
        at('2026-06-06T12:00:00.000Z'),
        at('2026-06-05T12:00:00.000Z'),
        at('2026-06-01T12:00:00.000Z'),
      ],
      now,
    )
    expect(groups.map((g) => g.key)).toEqual(['today', 'yesterday', 'earlier'])
    expect(groups[0].items).toHaveLength(1)
  })

  it('omits buckets with no items', () => {
    const groups = groupNotificationsByDay([at('2026-06-06T12:00:00.000Z')], now)
    expect(groups).toHaveLength(1)
    expect(groups[0].key).toBe('today')
  })

  it('returns nothing for an empty list', () => {
    expect(groupNotificationsByDay([], now)).toEqual([])
  })
})
