import { Ionicons } from '@expo/vector-icons'
import { FlashList } from '@shopify/flash-list'
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, RefreshControl, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Screen } from '@/components/screen'
import { EmptyState, ListRow, SectionTitle, Spinner, Surface } from '@/components/ui'
import {
  groupNotificationsByDay,
  type Notification,
  type NotificationGroup,
  notificationContext,
  notificationIcon,
  notificationMessageKey,
  routeToNotification,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '@/features/notifications'
import { haptics } from '@/lib/haptics'

type Glyph = keyof typeof Ionicons.glyphMap

export default function NotificationsScreen() {
  const { t, i18n } = useTranslation()
  const { theme } = useUnistyles()
  const router = useRouter()
  const { data, isLoading, isError, isRefetching, refetch } = useNotifications()
  const markRead = useMarkNotificationRead()
  const markAll = useMarkAllNotificationsRead()

  // Refresh on focus - the app has no realtime, so the feed stays current via refetch.
  useFocusEffect(
    useCallback(() => {
      void refetch()
    }, [refetch]),
  )

  // Stable reference so the grouping memo below only recomputes when the feed actually changes.
  const notifications = useMemo(() => data ?? [], [data])
  // Grouping is pure over the feed; memoise so it does not recompute on every unrelated render.
  const groups = useMemo(() => groupNotificationsByDay(notifications, new Date()), [notifications])
  const hasUnread = notifications.some((n) => n.read_at === null)

  // ListRow already fires haptics.light() on press, so the "open" feedback is covered there.
  const openNotification = useCallback(
    (n: Notification) => {
      if (n.read_at === null) {
        markRead.mutate(n.id)
      }
      routeToNotification(
        router,
        n.type,
        n.trip_id,
        (n.payload ?? {}) as { expenseId?: string; eventId?: string },
      )
    },
    [markRead, router],
  )

  const renderGroup = useCallback(
    ({ item: group }: { item: NotificationGroup }) => (
      <View style={styles.section}>
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
    ),
    [i18n.language, openNotification, t, theme],
  )

  // A single icon in the header (the long "Mark all read" label wrapped to several lines).
  const markAllAction = hasUnread ? (
    <Pressable
      onPress={() => {
        haptics.success()
        markAll.mutate()
      }}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={t('notifications.markAllRead')}
    >
      <Ionicons name="checkmark-done-outline" size={22} color={theme.colors.primary} />
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
    <Screen title={t('notifications.title')} right={markAllAction}>
      <Animated.View entering={FadeIn.duration(280)} style={styles.fill}>
        <FlashList
          data={groups}
          keyExtractor={(group) => group.key}
          contentContainerStyle={styles.list}
          renderItem={renderGroup}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => void refetch()}
              tintColor={theme.colors.primary}
            />
          }
        />
      </Animated.View>
    </Screen>
  )
}

const styles = StyleSheet.create((theme, rt) => ({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fill: {
    flex: 1,
  },
  list: {
    paddingTop: theme.gap(2),
    paddingBottom: rt.insets.bottom + theme.gap(6),
  },
  section: {
    gap: theme.gap(2),
    paddingBottom: theme.gap(4),
  },
  groupCard: {
    paddingHorizontal: theme.gap(4),
  },
}))
