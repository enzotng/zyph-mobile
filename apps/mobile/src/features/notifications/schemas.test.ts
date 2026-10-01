import {
  ACTOR_MARK,
  categoryForType,
  groupNotificationsByDay,
  isDetachedRecipient,
  NOTIFICATION_TYPES,
  type Notification,
  notificationContext,
  notificationIcon,
  notificationMessageKey,
  notificationMessageValues,
  withoutActor,
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

  it('covers the ghost-place member types', () => {
    for (const type of ['member.added', 'member.claimed', 'member.renamed', 'member.detached']) {
      expect(NOTIFICATION_TYPES).toContain(type)
      expect(categoryForType(type)).toBe('members')
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

  it('maps the ghost-place member types to their keys', () => {
    expect(notificationMessageKey('member.added', {})).toBe('notifications.types.memberAdded')
    expect(notificationMessageKey('member.claimed', {})).toBe('notifications.types.memberClaimed')
    expect(notificationMessageKey('member.renamed', {})).toBe('notifications.types.memberRenamed')
    expect(notificationMessageKey('member.detached', {})).toBe('notifications.types.memberDetached')
  })

  it('falls back to a generic key for unknown types', () => {
    expect(notificationMessageKey('weird.thing', {})).toBe('notifications.types.generic')
  })

  it('gives the detached account its own key', () => {
    expect(notificationMessageKey('member.detached', { detachedUserId: 'u1' }, 'u1')).toBe(
      'notifications.types.memberDetachedSelf',
    )
  })

  it('keeps the group copy for every other recipient of a detach', () => {
    expect(notificationMessageKey('member.detached', { detachedUserId: 'u2' }, 'u1')).toBe(
      'notifications.types.memberDetached',
    )
    expect(notificationMessageKey('member.detached', {}, 'u1')).toBe(
      'notifications.types.memberDetached',
    )
    expect(notificationMessageKey('member.detached', { detachedUserId: 'u1' })).toBe(
      'notifications.types.memberDetached',
    )
  })
})

describe('isDetachedRecipient', () => {
  it('is true only for the detached account on a detach notification', () => {
    expect(isDetachedRecipient('member.detached', { detachedUserId: 'u1' }, 'u1')).toBe(true)
    expect(isDetachedRecipient('member.detached', { detachedUserId: 'u2' }, 'u1')).toBe(false)
    expect(isDetachedRecipient('member.removed', { detachedUserId: 'u1' }, 'u1')).toBe(false)
  })

  it('is false without an identity on either side', () => {
    expect(isDetachedRecipient('member.detached', { detachedUserId: 'u1' }, null)).toBe(false)
    expect(isDetachedRecipient('member.detached', {}, 'u1')).toBe(false)
    expect(isDetachedRecipient('member.detached', null, 'u1')).toBe(false)
  })
})

describe('notificationMessageValues', () => {
  it('reads the actor and the place name from a member payload', () => {
    expect(notificationMessageValues({ actorName: 'Marco', name: 'Léa' })).toEqual({
      actor: 'Marco',
      name: 'Léa',
    })
  })

  it('accepts slotName as the place name', () => {
    expect(notificationMessageValues({ actorName: 'Marco', slotName: 'Léa' })).toEqual({
      actor: 'Marco',
      name: 'Léa',
    })
  })

  it('returns nulls for a payload that carries neither', () => {
    expect(notificationMessageValues({})).toEqual({ actor: null, name: null })
    expect(notificationMessageValues(null)).toEqual({ actor: null, name: null })
    expect(notificationMessageValues({ actorName: '  ', name: '' })).toEqual({
      actor: null,
      name: null,
    })
  })

  // A profile name of one zero-width space is not empty to String.trim, so a bare emptiness test
  // would render a nominative headline that names nobody. The screen's "someone" fallback only
  // takes over if this returns null.
  it('treats a name built only from invisible characters as absent', () => {
    expect(notificationMessageValues({ actorName: '\u200B', name: '\uFEFF\u200D' })).toEqual({
      actor: null,
      name: null,
    })
    expect(notificationMessageValues({ actorName: '\u202E\u2066', slotName: '\u00AD' })).toEqual({
      actor: null,
      name: null,
    })
  })

  // Blank-rendering rather than zero-width: whitespace to neither btrim nor String.trim, so the
  // first version of this filter let them through and the headline named nobody.
  it('treats a name built only from blank-rendering characters as absent', () => {
    expect(
      notificationMessageValues({ actorName: '\u2800\u2800\u2800', name: '\u3164\u3164' }),
    ).toEqual({
      actor: null,
      name: null,
    })
    expect(notificationMessageValues({ actorName: ' \u3000 ', slotName: '\uFFA0\u1160' })).toEqual({
      actor: null,
      name: null,
    })
  })

  it('keeps a blank-rendering character that separates two real words', () => {
    expect(
      notificationMessageValues({ actorName: 'Jean\u00A0Pierre', name: 'Marco\u2800Léa' }),
    ).toEqual({
      actor: 'Jean Pierre',
      name: 'Marco Léa',
    })
  })

  // Not blank, so the cleaning pass keeps them; only the legibility gate can reject them.
  it('refuses a name that survives cleaning but names nobody', () => {
    expect(notificationMessageValues({ actorName: '...', name: '---' })).toEqual({
      actor: null,
      name: null,
    })
    // Free text is deliberately NOT gated: an expense described as "!!!" must still render.
    expect(notificationContext({ description: '!!!' })).toBe('!!!')
  })

  it('strips invisible characters from a name that has real content', () => {
    expect(notificationMessageValues({ actorName: 'M\u200Barco', name: '\u202ELéa' })).toEqual({
      actor: 'Marco',
      name: 'Léa',
    })
  })
})

describe('withoutActor', () => {
  it('lifts the actor out of a sentence that leads with it', () => {
    expect(withoutActor(`${ACTOR_MARK} joined the trip`)).toBe(' joined the trip')
    expect(withoutActor(`${ACTOR_MARK} a rejoint le voyage`)).toBe(' a rejoint le voyage')
  })

  // Losing words would be worse than a merged line, so anything unexpected renders whole.
  it('declines to split when the actor is not the first thing said', () => {
    expect(withoutActor(`On ${ACTOR_MARK} joined`)).toBeNull()
    expect(withoutActor('You were removed from a trip')).toBeNull()
    expect(withoutActor(`${ACTOR_MARK} and ${ACTOR_MARK}`)).toBeNull()
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

  it('leaves the place name of a member payload to the title', () => {
    expect(notificationContext({ memberId: 'm1', name: 'Léa' })).toBeNull()
    expect(notificationContext({ memberId: 'm1', slotName: 'Marco' })).toBeNull()
  })

  it('renders a rename as old -> new', () => {
    expect(notificationContext({ memberId: 'm1', oldName: 'Léa', newName: 'Marco' })).toBe(
      'Léa -> Marco',
    )
  })

  it('falls back to the new name when the old one is missing', () => {
    expect(notificationContext({ memberId: 'm1', oldName: '  ', newName: 'Marco' })).toBe('Marco')
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
