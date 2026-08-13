import type { Database } from '@/lib/database.types'

export type Notification = Database['public']['Tables']['notifications']['Row']
export type NotificationPreferences =
  Database['public']['Tables']['notification_preferences']['Row']

// Every notification type the backend can emit (mirrors private.notify call sites). The
// union keeps the UI exhaustive; the coverage test asserts each one maps to a category.
export const NOTIFICATION_TYPES = [
  'member.joined',
  'member.left',
  'member.removed',
  'member.added',
  'member.claimed',
  'member.renamed',
  'member.detached',
  'expense.added',
  'expense.updated',
  'settlement.created',
  'settlement.reversed',
  'event.added',
  'packing.assigned',
  'packing.nudged',
  'packing.reminder',
] as const

export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

export const NOTIFICATION_CATEGORIES = [
  'members',
  'expenses',
  'settlements',
  'timeline',
  'packing',
] as const
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number]

// Derives the category (used for preference toggles and grouping) from a type's prefix,
// matching the split_part(type, '.', 1) logic in private.notify.
export function categoryForType(type: string): NotificationCategory | null {
  switch (type.split('.')[0]) {
    case 'member':
      return 'members'
    case 'expense':
      return 'expenses'
    case 'settlement':
      return 'settlements'
    case 'event':
      return 'timeline'
    case 'packing':
      return 'packing'
    default:
      return null
  }
}

// The account whose place was just detached is a recipient of member.detached like the rest of the
// group, but RLS hides the trip from it the moment the row is written - so it needs its own copy
// and must not be routed into that trip.
export function isDetachedRecipient(
  type: string,
  payload: unknown,
  userId: string | null | undefined,
): boolean {
  return (
    type === 'member.detached' &&
    !!userId &&
    (payload as { detachedUserId?: unknown } | null)?.detachedUserId === userId
  )
}

// Resolves the i18n key for a notification's headline. settlement.created splits on the
// payload role (the payer vs the payee see different copy). Keys avoid dots so they don't
// collide with i18next's nesting separator.
export function notificationMessageKey(
  type: string,
  payload: unknown,
  userId?: string | null,
): string {
  if (isDetachedRecipient(type, payload, userId)) {
    return 'notifications.types.memberDetachedSelf'
  }
  if (type === 'settlement.created') {
    const role = (payload as { role?: string } | null)?.role
    return role === 'to' ? 'notifications.types.settlementTo' : 'notifications.types.settlementFrom'
  }
  if (type === 'settlement.reversed') {
    return 'notifications.types.settlementReversed'
  }
  const map: Record<string, string> = {
    'member.joined': 'notifications.types.memberJoined',
    'member.left': 'notifications.types.memberLeft',
    'member.removed': 'notifications.types.memberRemoved',
    'member.added': 'notifications.types.memberAdded',
    'member.claimed': 'notifications.types.memberClaimed',
    'member.renamed': 'notifications.types.memberRenamed',
    'member.detached': 'notifications.types.memberDetached',
    'expense.added': 'notifications.types.expenseAdded',
    'expense.updated': 'notifications.types.expenseUpdated',
    'event.added': 'notifications.types.eventAdded',
    'packing.assigned': 'notifications.types.packingAssigned',
    'packing.nudged': 'notifications.types.packingNudged',
    'packing.reminder': 'notifications.types.packingReminder',
  }
  return map[type] ?? 'notifications.types.generic'
}

// Ionicons glyph for a notification, by category.
export function notificationIcon(type: string): string {
  switch (categoryForType(type)) {
    case 'members':
      return 'people-outline'
    case 'expenses':
      return 'card-outline'
    case 'settlements':
      return 'swap-horizontal-outline'
    case 'timeline':
      return 'calendar-outline'
    case 'packing':
      return 'bag-handle-outline'
    default:
      return 'notifications-outline'
  }
}

// Characters that render as nothing, or reorder what follows. None of them are whitespace to
// String.trim, so a name built only from them survives a plain emptiness test and puts an actor
// on the feed that names no one. Mirrors private.clean_name, which strips them at the source;
// this pass covers rows written before it existed. Kept in sync with send-push/copy.ts.
const INVISIBLE =
  // biome-ignore lint/suspicious/noControlCharactersInRegex: removing them is the point
  /[\u0001-\u0008\u000E-\u001F\u007F-\u0084\u0086-\u009F\u00AD\u034F\u061C\u17B4-\u17B5\u180B-\u180E\u200B\u200E-\u200F\u202A-\u202E\u2060-\u2069\uFEFF\u{E0000}-\u{E007F}]/gu
// Blank but space-occupying, or an outright line break: whitespace to neither Postgres btrim nor
// String.trim. Mapped to a space rather than dropped, so a name that used one as a word break
// keeps it - and so U+2028 cannot end the line inside a one-line notification row.
const BLANK =
  /[\u0009-\u000D\u0085\u00A0\u115F-\u1160\u1680\u2000-\u200A\u2028-\u2029\u202F\u205F\u2800\u3000\u3164\uFFA0]/gu
// A name has to name someone. Enumerating invisible codepoints is a race against Unicode we lose;
// requiring that something which actually paints survives closes the class, including codepoints
// not yet assigned. Free text (an expense description, an event title) deliberately skips this.
const LEGIBLE = /[\p{L}\p{N}\p{S}]/u

// Mirrors private.clean_name's legibility gate, for the payload fields that name a person.
// Rows written before clean_name existed can still carry an unfiltered name, so this pass is not
// redundant with the server one.
function payloadName(value: unknown): string | null {
  const cleaned = payloadText(value)
  return cleaned !== null && LEGIBLE.test(cleaned) ? cleaned : null
}

function payloadText(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }
  const cleaned = value.replace(INVISIBLE, '').replace(BLANK, ' ').replace(/ +/g, ' ').trim()
  return cleaned === '' ? null : cleaned
}

// Interpolation values for the headline: who acted, and the place they acted on. Both are null on
// rows written before the payloads carried them, and the caller supplies the wording of that gap.
export function notificationMessageValues(payload: unknown): {
  actor: string | null
  name: string | null
} {
  const p = payload as { actorName?: unknown; name?: unknown; slotName?: unknown } | null
  return {
    actor: payloadName(p?.actorName),
    name: payloadName(p?.name) ?? payloadName(p?.slotName),
  }
}

// Optional secondary line drawn from the payload (an expense description, an event title, or both
// sides of a rename). The place name a member.* payload carries belongs to the headline.
export function notificationContext(payload: unknown): string | null {
  const p = payload as {
    description?: unknown
    title?: unknown
    oldName?: unknown
    newName?: unknown
  } | null
  const oldName = payloadText(p?.oldName)
  const newName = payloadText(p?.newName)
  if (oldName && newName) {
    return `${oldName} -> ${newName}`
  }
  return payloadText(p?.description) ?? payloadText(p?.title) ?? newName
}

export type NotificationDayBucket = 'today' | 'yesterday' | 'earlier'
export type NotificationGroup = { key: NotificationDayBucket; items: Notification[] }

// Buckets notifications into today / yesterday / earlier (local calendar days), preserving
// order and dropping empty buckets, for the section list.
export function groupNotificationsByDay(items: Notification[], now: Date): NotificationGroup[] {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const today = startOfDay(now)
  const dayMs = 86_400_000
  const buckets: Record<NotificationDayBucket, Notification[]> = {
    today: [],
    yesterday: [],
    earlier: [],
  }
  for (const n of items) {
    const diffDays = Math.round((today - startOfDay(new Date(n.created_at))) / dayMs)
    if (diffDays <= 0) {
      buckets.today.push(n)
    } else if (diffDays === 1) {
      buckets.yesterday.push(n)
    } else {
      buckets.earlier.push(n)
    }
  }
  return (['today', 'yesterday', 'earlier'] as const)
    .filter((key) => buckets[key].length > 0)
    .map((key) => ({ key, items: buckets[key] }))
}
