export type { NotificationPreferenceInput } from './api/notifications.api'
export {
  getNotificationPreferences,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  upsertNotificationPreferences,
} from './api/notifications.api'
export {
  notificationPreferencesQueryKey,
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from './hooks/use-notification-preferences'
export {
  notificationsQueryKey,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadNotificationCount,
} from './hooks/use-notifications'
export {
  categoryForType,
  groupNotificationsByDay,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_TYPES,
  type Notification,
  type NotificationCategory,
  type NotificationDayBucket,
  type NotificationGroup,
  type NotificationPreferences,
  type NotificationType,
  notificationContext,
  notificationIcon,
  notificationMessageKey,
} from './schemas'
