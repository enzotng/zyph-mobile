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
  'expense.added',
  'expense.updated',
  'settlement.created',
  'event.added',
] as const

export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

export const NOTIFICATION_CATEGORIES = ['members', 'expenses', 'settlements', 'timeline'] as const
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
    default:
      return null
  }
}

// Resolves the i18n key for a notification's headline. settlement.created splits on the
// payload role (the payer vs the payee see different copy). Keys avoid dots so they don't
// collide with i18next's nesting separator.
export function notificationMessageKey(type: string, payload: unknown): string {
  if (type === 'settlement.created') {
    const role = (payload as { role?: string } | null)?.role
    return role === 'to' ? 'notifications.types.settlementTo' : 'notifications.types.settlementFrom'
  }
  const map: Record<string, string> = {
    'member.joined': 'notifications.types.memberJoined',
    'member.left': 'notifications.types.memberLeft',
    'member.removed': 'notifications.types.memberRemoved',
    'expense.added': 'notifications.types.expenseAdded',
    'expense.updated': 'notifications.types.expenseUpdated',
    'event.added': 'notifications.types.eventAdded',
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
    default:
      return 'notifications-outline'
  }
}

// Optional secondary line drawn from the payload (an expense description or event title).
export function notificationContext(payload: unknown): string | null {
  const p = payload as { description?: unknown; title?: unknown } | null
  const value = p?.description ?? p?.title
  return typeof value === 'string' && value.trim() !== '' ? value : null
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
