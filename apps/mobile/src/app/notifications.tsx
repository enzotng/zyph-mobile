import type { Ionicons } from '@expo/vector-icons'
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Screen } from '@/components/screen'
import { EmptyState, ListRow, SectionTitle, Spinner, Surface } from '@/components/ui'
import {
  groupNotificationsByDay,
  type Notification,
  notificationContext,
  notificationIcon,
  notificationMessageKey,
  routeToNotification,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '@/features/notifications'

type Glyph = keyof typeof Ionicons.glyphMap

export default function NotificationsScreen() {
  const { t, i18n } = useTranslation()
  const { theme } = useUnistyles()
  const router = useRouter()
  const { data, isLoading, isError, refetch } = useNotifications()
  const markRead = useMarkNotificationRead()
  const markAll = useMarkAllNotificationsRead()

  // Refresh on focus - the app has no realtime, so the feed stays current via refetch.
  useFocusEffect(
    useCallback(() => {
      void refetch()
    }, [refetch]),
  )

  const notifications = data ?? []
  const groups = groupNotificationsByDay(notifications, new Date())
  const hasUnread = notifications.some((n) => n.read_at === null)

  function openNotification(n: Notification) {
    if (n.read_at === null) {
      markRead.mutate(n.id)
    }
    routeToNotification(
      router,
      n.type,
      n.trip_id,
      (n.payload ?? {}) as { expenseId?: string; eventId?: string },
    )
  }

  const markAllAction = hasUnread ? (
    <Pressable onPress={() => markAll.mutate()} hitSlop={8} accessibilityRole="button">
      <Text style={styles.headerAction}>{t('notifications.markAllRead')}</Text>
    </Pressable>
  ) : undefined

  if (isLoading) {
    return (
      <Screen title={t('notifications.title')} right={markAllAction}>
        <View style={styles.center}>
          <Spinner />
        </View>
      </Screen>
    )
  }

  if (isError) {
    return (
      <Screen title={t('notifications.title')}>
        <View style={styles.center}>
          <EmptyState
            icon="cloud-offline-outline"
            title={t('trips.errorTitle')}
            body={t('trips.error')}
            cta={t('common.retry')}
            onCta={() => void refetch()}
          />
        </View>
      </Screen>
    )
  }

  if (notifications.length === 0) {
    return (
      <Screen title={t('notifications.title')}>
        <View style={styles.center}>
          <EmptyState
            icon="notifications-outline"
            title={t('notifications.empty.title')}
            body={t('notifications.empty.body')}
          />
        </View>
      </Screen>
    )
  }

  return (
    <Screen title={t('notifications.title')} right={markAllAction} scroll>
      {groups.map((group) => (
        <View key={group.key} style={styles.section}>
          <SectionTitle>{t(`notifications.time.${group.key}`)}</SectionTitle>
          <Surface
            color={theme.colors.card}
            borderColor={theme.colors.border}
            borderWidth={1}
            radius={theme.radius.lg}
            style={styles.groupCard}
          >
            {group.items.map((n, index) => {
              const unread = n.read_at === null
              const context = notificationContext(n.payload)
              return (
                <ListRow
                  key={n.id}
                  icon={notificationIcon(n.type) as Glyph}
                  iconColor={unread ? theme.colors.primary : theme.colors.muted}
                  title={t(notificationMessageKey(n.type, n.payload))}
                  subtitle={context ?? undefined}
                  detail={new Date(n.created_at).toLocaleTimeString(i18n.language, {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  onPress={() => openNotification(n)}
                  last={index === group.items.length - 1}
                />
              )
            })}
          </Surface>
        </View>
      ))}
    </Screen>
  )
}

const styles = StyleSheet.create((theme) => ({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    gap: theme.gap(2),
  },
  groupCard: {
    paddingHorizontal: theme.gap(4),
  },
  headerAction: {
    fontFamily: theme.fonts.sans.bold,
    fontWeight: '600',
    fontSize: theme.fontSize.sm,
    color: theme.colors.primary,
  },
}))
