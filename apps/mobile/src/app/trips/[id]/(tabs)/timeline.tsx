import { Ionicons } from '@expo/vector-icons'
import { FlashList } from '@shopify/flash-list'
import { Link, useGlobalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { FLOATING_TAB_BAR_CLEARANCE } from '@/components/layout/floating-tab-bar'
import { Screen } from '@/components/screen'
import {
  eventStatus,
  formatCountdown,
  groupEventsByDay,
  type TimelineItem,
  useEvents,
} from '@/features/timeline'
import { useTrip } from '@/features/trips'
import { paramString } from '@/lib/routing'

export default function TimelineScreen() {
  const params = useGlobalSearchParams<{ id: string }>()
  const tripId = paramString(params.id)
  const { data: trip } = useTrip(tripId)
  const { data: events, isLoading, isError } = useEvents(tripId)
  const { theme } = useUnistyles()
  const router = useRouter()
  const items = useMemo(() => groupEventsByDay(events ?? []), [events])

  // Tick once a minute so the countdown stays current without per-second churn.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  const renderItem = useCallback(
    ({ item }: { item: TimelineItem }) => {
      if (item.kind === 'header') {
        return <Text style={styles.dayHeader}>{item.label}</Text>
      }
      const status = eventStatus(item.event.starts_at, item.event.ends_at, now)
      return (
        <Pressable
          style={styles.eventRow}
          onPress={() =>
            router.push({
              pathname: '/trips/[id]/events/[eventId]',
              params: { id: tripId, eventId: item.event.id },
            })
          }
          accessibilityRole="button"
        >
          <View style={styles.eventHead}>
            <Text style={styles.eventTitle}>{item.event.title}</Text>
            {status.kind === 'upcoming' ? (
              <Text style={[styles.badge, styles.badgeUpcoming]}>{formatCountdown(status)}</Text>
            ) : status.kind === 'in_progress' ? (
              <Text style={[styles.badge, styles.badgeProgress]}>In progress</Text>
            ) : status.kind === 'completed' ? (
              <Text style={[styles.badge, styles.badgeCompleted]}>Completed</Text>
            ) : null}
          </View>
          {item.event.notes ? <Text style={styles.muted}>{item.event.notes}</Text> : null}
        </Pressable>
      )
    },
    [now, router, tripId],
  )

  return (
    <Screen
      title={trip?.title}
      showBack
      right={
        <Link href={{ pathname: '/trips/[id]/add-event', params: { id: tripId } }} asChild>
          <Pressable accessibilityRole="button" accessibilityLabel="Add event" hitSlop={8}>
            <Ionicons name="add" size={26} color={theme.colors.primary} />
          </Pressable>
        </Link>
      }
    >
      {isLoading ? (
        <ActivityIndicator />
      ) : isError ? (
        <Text style={styles.muted}>Could not load the timeline.</Text>
      ) : items.length === 0 ? (
        <Text style={styles.muted}>Add your first event.</Text>
      ) : (
        <FlashList
          data={items}
          keyExtractor={(item) => item.key}
          getItemType={(item) => item.kind}
          contentContainerStyle={styles.list}
          renderItem={renderItem}
        />
      )}
    </Screen>
  )
}

const styles = StyleSheet.create((theme, rt) => ({
  muted: {
    color: theme.colors.muted,
  },
  list: {
    paddingBottom: rt.insets.bottom + FLOATING_TAB_BAR_CLEARANCE,
  },
  dayHeader: {
    fontSize: theme.fontSize.sm,
    fontWeight: '700',
    color: theme.colors.muted,
    paddingTop: theme.gap(4),
    paddingBottom: theme.gap(1),
  },
  eventRow: {
    gap: theme.gap(1),
    paddingVertical: theme.gap(3),
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  eventHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.gap(2),
  },
  eventTitle: {
    flex: 1,
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.foreground,
  },
  badge: {
    fontSize: theme.fontSize.sm,
    fontWeight: '700',
  },
  badgeUpcoming: {
    color: theme.colors.primary,
  },
  badgeProgress: {
    color: theme.colors.success,
  },
  badgeCompleted: {
    color: theme.colors.muted,
  },
}))
