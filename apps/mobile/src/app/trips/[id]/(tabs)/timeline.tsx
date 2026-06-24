import { Ionicons } from '@expo/vector-icons'
import { FlashList } from '@shopify/flash-list'
import { Link, useFocusEffect, useGlobalSearchParams, useRouter } from 'expo-router'
import type { TFunction } from 'i18next'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { TRIP_TAB_BAR_CLEARANCE } from '@/components/layout/trip-tab-bar'
import { Screen } from '@/components/screen'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui'
import {
  type EventStatus,
  eventStatus,
  eventTypeIcon,
  formatCountdown,
  groupEventsByDay,
  type TimelineItem,
  useEvents,
} from '@/features/timeline'
import { useTrip } from '@/features/trips'
import { PlanSegmented } from '@/features/trips/components/plan-segmented'
import { withAlpha } from '@/lib/color'
import { haptics } from '@/lib/haptics'
import { paramString } from '@/lib/routing'

function formatEventTime(iso: string | null): string | null {
  if (!iso) {
    return null
  }
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

// The right-side status text + its tone, derived from the event status. Tones map to the
// money-safe palette: muted (done), success (live), primary (upcoming countdown).
function statusLabel(status: EventStatus, t: TFunction): { label: string; tone: string } | null {
  switch (status.kind) {
    case 'upcoming':
      return { label: formatCountdown(status, t), tone: 'primary' }
    case 'in_progress':
      return { label: t('timeline.inProgress'), tone: 'success' }
    case 'completed':
      return { label: t('timeline.done'), tone: 'muted' }
    default:
      return null
  }
}

export default function TimelineScreen() {
  const { t } = useTranslation()
  const params = useGlobalSearchParams<{ id: string }>()
  const tripId = paramString(params.id)
  const { data: trip } = useTrip(tripId)
  const { data: events, isLoading, isError, refetch, isRefetching } = useEvents(tripId)
  const { theme } = useUnistyles()
  const router = useRouter()
  const items = useMemo(() => groupEventsByDay(events ?? []), [events])

  // Tick once a minute so the countdown stays current without per-second churn. Gated to focus so
  // the timer does not keep firing while another Plan tab (map/expenses) is showing.
  const [now, setNow] = useState(() => Date.now())
  useFocusEffect(
    useCallback(() => {
      setNow(Date.now())
      const id = setInterval(() => setNow(Date.now()), 60_000)
      return () => clearInterval(id)
    }, []),
  )

  const renderItem = useCallback(
    ({ item }: { item: TimelineItem }) => {
      if (item.kind === 'header') {
        return <Text style={styles.dayHeader}>{item.label}</Text>
      }
      const status = eventStatus(item.event.starts_at, item.event.ends_at, now)
      const badge = statusLabel(status, t)
      const time = formatEventTime(item.event.starts_at)
      const completed = status.kind === 'completed'
      const inProgress = status.kind === 'in_progress'

      const tileColor = completed
        ? withAlpha(theme.colors.foreground, 0.05)
        : inProgress
          ? withAlpha(theme.colors.success, 0.16)
          : withAlpha(theme.colors.primary, 0.1)
      const iconColor = completed
        ? theme.colors.muted
        : inProgress
          ? theme.colors.success
          : theme.colors.primary
      const statusColor =
        badge?.tone === 'success'
          ? theme.colors.success
          : badge?.tone === 'muted'
            ? theme.colors.muted
            : theme.colors.primary

      return (
        <Pressable
          onPress={() => {
            haptics.light()
            router.push({
              pathname: '/trips/[id]/events/[eventId]',
              params: { id: tripId, eventId: item.event.id },
            })
          }}
          accessibilityRole="button"
          accessibilityLabel={item.event.title}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <View style={styles.rail}>
            <View style={[styles.tile, { backgroundColor: tileColor }]}>
              <Ionicons name={eventTypeIcon(item.event.type)} size={18} color={iconColor} />
            </View>
            <View style={styles.connector} />
          </View>

          <View style={styles.body}>
            <View style={styles.head}>
              <Text style={[styles.title, completed && styles.titleDone]} numberOfLines={1}>
                {item.event.title}
              </Text>
              {badge ? (
                <Text style={[styles.status, { color: statusColor }]} numberOfLines={1}>
                  {badge.label}
                </Text>
              ) : null}
            </View>

            {item.event.notes ? (
              <Text style={styles.notes} numberOfLines={1}>
                {item.event.notes}
              </Text>
            ) : null}

            {time ? (
              <View style={styles.metaRow}>
                <Ionicons name="time-outline" size={13} color={theme.colors.muted} />
                <Text style={styles.metaText}>{time}</Text>
              </View>
            ) : null}
          </View>
        </Pressable>
      )
    },
    [now, router, tripId, theme, t],
  )

  return (
    <Screen
      title={trip?.title ?? t('tabs.timeline')}
      showBack
      right={
        <View style={styles.headerActions}>
          <Link href={{ pathname: '/trips/[id]/import-email', params: { id: tripId } }} asChild>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('smartImport.open')}
              hitSlop={12}
            >
              <Ionicons name="sparkles" size={22} color={theme.colors.primary} />
            </Pressable>
          </Link>
          <Link href={{ pathname: '/trips/[id]/add-event', params: { id: tripId } }} asChild>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('timeline.addEvent')}
              hitSlop={12}
            >
              <Ionicons name="add" size={26} color={theme.colors.primary} />
            </Pressable>
          </Link>
        </View>
      }
    >
      <View style={styles.segment}>
        <PlanSegmented active="timeline" tripId={tripId} />
      </View>

      {isLoading ? (
        <TimelineSkeleton />
      ) : isError ? (
        <ErrorState
          icon="cloud-offline-outline"
          title={t('timeline.errorTitle')}
          body={t('timeline.errorBody')}
          retryLabel={t('common.retry')}
          onRetry={() => void refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon="calendar-outline"
          title={t('timeline.emptyTitle')}
          body={t('timeline.emptyBody')}
          cta={t('timeline.addEvent')}
          onCta={() => router.push({ pathname: '/trips/[id]/add-event', params: { id: tripId } })}
        />
      ) : (
        <Animated.View entering={FadeIn.duration(280)} style={styles.fill}>
          <FlashList
            data={items}
            keyExtractor={(item) => item.key}
            getItemType={(item) => item.kind}
            contentContainerStyle={styles.list}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            refreshing={isRefetching}
            onRefresh={() => void refetch()}
          />
        </Animated.View>
      )}
    </Screen>
  )
}

// Skeleton placeholder that mirrors the timeline layout (day header + rail rows). Rendered in a
// plain View via .map(), so staggered entrance is safe (no FlashList recycling here).
function TimelineSkeleton() {
  const { theme } = useUnistyles()
  return (
    <View style={styles.skeleton}>
      <Skeleton width={120} height={14} radius={theme.radius.sm} style={styles.skeletonHeader} />
      {[0, 1, 2, 3].map((i) => (
        <Animated.View
          key={i}
          entering={FadeIn.delay(i * 50).duration(280)}
          style={styles.skeletonRow}
        >
          <Skeleton width={TILE_SIZE} height={TILE_SIZE} radius={theme.radius.md} />
          <View style={styles.skeletonText}>
            <Skeleton width="55%" height={15} radius={theme.radius.sm} />
            <Skeleton width="35%" height={12} radius={theme.radius.sm} />
          </View>
        </Animated.View>
      ))}
    </View>
  )
}

const TILE_SIZE = 40

const styles = StyleSheet.create((theme, rt) => ({
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(2),
  },
  segment: {
    marginBottom: theme.gap(3),
  },
  fill: {
    flex: 1,
  },
  skeleton: {
    paddingTop: theme.gap(1),
  },
  skeletonHeader: {
    marginBottom: theme.gap(3),
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(3),
    paddingBottom: theme.gap(3),
  },
  skeletonText: {
    flex: 1,
    gap: theme.gap(1.5),
  },
  list: {
    paddingTop: theme.gap(1),
    paddingBottom: rt.insets.bottom + TRIP_TAB_BAR_CLEARANCE,
  },
  dayHeader: {
    fontFamily: theme.fonts.sans.bold,
    fontSize: theme.fontSize.sm,
    fontWeight: '700',
    color: theme.colors.muted,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    paddingTop: theme.gap(3),
    paddingBottom: theme.gap(2),
  },
  row: {
    flexDirection: 'row',
    gap: theme.gap(3),
    paddingBottom: theme.gap(3),
  },
  pressed: {
    opacity: 0.85,
  },
  rail: {
    width: TILE_SIZE,
    alignItems: 'center',
  },
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  connector: {
    flex: 1,
    width: 2,
    marginTop: theme.gap(1),
    backgroundColor: theme.colors.border,
  },
  body: {
    flex: 1,
    paddingBottom: theme.gap(1),
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.gap(2),
    minHeight: TILE_SIZE,
  },
  title: {
    flexShrink: 1,
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.md,
    color: theme.colors.foreground,
  },
  titleDone: {
    color: theme.colors.muted,
    textDecorationLine: 'line-through',
  },
  status: {
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.sm,
  },
  notes: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
    marginTop: theme.gap(0.5),
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(1),
    marginTop: theme.gap(1),
  },
  metaText: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
  },
}))
