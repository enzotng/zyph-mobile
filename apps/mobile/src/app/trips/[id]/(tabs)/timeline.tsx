import { Ionicons } from '@expo/vector-icons'
import { FlashList } from '@shopify/flash-list'
import { Link, useGlobalSearchParams, useRouter } from 'expo-router'
import type { TFunction } from 'i18next'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { FLOATING_TAB_BAR_CLEARANCE } from '@/components/layout/floating-tab-bar'
import { Screen } from '@/components/screen'
import { Badge, Card, EmptyState, Spinner } from '@/components/ui'
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
import { paramString } from '@/lib/routing'

function formatEventTime(iso: string | null): string | null {
  if (!iso) {
    return null
  }
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function statusBadge(status: EventStatus, t: TFunction) {
  switch (status.kind) {
    case 'upcoming':
      return { label: formatCountdown(status, t), tone: 'primary' as const, icon: undefined }
    case 'in_progress':
      return { label: t('timeline.inProgress'), tone: 'success' as const, icon: 'ellipse' as const }
    case 'completed':
      return { label: t('timeline.completed'), tone: 'muted' as const, icon: undefined }
    default:
      return null
  }
}

export default function TimelineScreen() {
  const { t } = useTranslation()
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
      const badge = statusBadge(status, t)
      const time = formatEventTime(item.event.starts_at)
      const completed = status.kind === 'completed'
      const inProgress = status.kind === 'in_progress'

      const railColor = completed
        ? theme.colors.muted
        : inProgress
          ? theme.colors.success
          : theme.colors.primary
      const iconColor = completed ? theme.colors.muted : theme.colors.primary

      return (
        <View style={styles.row}>
          <View style={styles.rail}>
            <View style={styles.railLine} />
            <View
              style={[
                styles.dot,
                completed && styles.dotCompleted,
                inProgress && {
                  backgroundColor: theme.colors.success,
                  borderColor: theme.colors.background,
                },
                status.kind === 'upcoming' && {
                  backgroundColor: theme.colors.background,
                  borderColor: theme.colors.primary,
                  borderWidth: 3,
                },
                completed && { backgroundColor: railColor, borderColor: theme.colors.background },
                inProgress && styles.dotGlow,
              ]}
            />
          </View>

          <View style={styles.cardWrap}>
            <Card
              padding={theme.gap(3.25)}
              onPress={() =>
                router.push({
                  pathname: '/trips/[id]/events/[eventId]',
                  params: { id: tripId, eventId: item.event.id },
                })
              }
            >
              <View style={styles.eventHead}>
                <View style={styles.eventTitleWrap}>
                  <Ionicons name={eventTypeIcon(item.event.type)} size={18} color={iconColor} />
                  <Text style={styles.eventTitle} numberOfLines={1}>
                    {item.event.title}
                  </Text>
                </View>
                {badge ? <Badge label={badge.label} tone={badge.tone} icon={badge.icon} /> : null}
              </View>

              {item.event.notes ? (
                <Text style={styles.eventNotes} numberOfLines={1}>
                  {item.event.notes}
                </Text>
              ) : null}

              {time ? (
                <View style={styles.metaRow}>
                  <Ionicons name="time-outline" size={13} color={theme.colors.muted} />
                  <Text style={styles.metaText}>{time}</Text>
                </View>
              ) : null}
            </Card>
          </View>
        </View>
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
              hitSlop={8}
            >
              <Ionicons name="sparkles" size={22} color={theme.colors.primary} />
            </Pressable>
          </Link>
          <Link href={{ pathname: '/trips/[id]/add-event', params: { id: tripId } }} asChild>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('timeline.addEvent')}
              hitSlop={8}
            >
              <Ionicons name="add" size={26} color={theme.colors.primary} />
            </Pressable>
          </Link>
        </View>
      }
    >
      {isLoading ? (
        <View style={styles.center}>
          <Spinner label={t('common.loading')} />
        </View>
      ) : isError ? (
        <EmptyState
          icon="cloud-offline-outline"
          title={t('timeline.errorTitle')}
          body={t('timeline.errorBody')}
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
        <FlashList
          data={items}
          keyExtractor={(item) => item.key}
          getItemType={(item) => item.kind}
          contentContainerStyle={styles.list}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
        />
      )}
    </Screen>
  )
}

const RAIL_WIDTH = 24
const DOT_SIZE = 16

const styles = StyleSheet.create((theme, rt) => ({
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(2),
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingTop: theme.gap(1),
    paddingBottom: rt.insets.bottom + FLOATING_TAB_BAR_CLEARANCE,
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
  rail: {
    width: RAIL_WIDTH,
    alignItems: 'center',
  },
  railLine: {
    position: 'absolute',
    top: 0,
    bottom: -theme.gap(3),
    width: 2,
    backgroundColor: theme.colors.border,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    marginTop: theme.gap(4),
    backgroundColor: theme.colors.primary,
    borderWidth: 2,
    borderColor: theme.colors.background,
  },
  dotCompleted: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  dotGlow: {
    shadowColor: theme.colors.success,
    shadowOpacity: 0.4,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  cardWrap: {
    flex: 1,
  },
  eventHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.gap(2),
  },
  eventTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(2),
    flexShrink: 1,
  },
  eventTitle: {
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.md,
    color: theme.colors.foreground,
    flexShrink: 1,
  },
  eventNotes: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
    marginTop: theme.gap(1.5),
    paddingLeft: theme.gap(6.5),
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(1),
    marginTop: theme.gap(1.5),
    paddingLeft: theme.gap(6.5),
  },
  metaText: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
  },
}))
