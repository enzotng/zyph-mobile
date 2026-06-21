import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshControl, ScrollView, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { APP_TAB_BAR_CLEARANCE } from '@/components/layout/app-tab-bar'
import { EmptyState, SectionTitle, Skeleton, Surface } from '@/components/ui'
import { useUnreadNotificationCount } from '@/features/notifications'
import { useProfile } from '@/features/profile'
import { daysUntil, formatDay, selectHomeTrips, tripTimeline, useTrips } from '@/features/trips'
import { HomeHeader } from '@/features/trips/components/home-header'
import { LiveTripCard } from '@/features/trips/components/live-trip-card'
import { NextDepartureCard } from '@/features/trips/components/next-departure-card'
import { UpcomingTripRow } from '@/features/trips/components/upcoming-trip-row'

const MAX_UPCOMING = 4

export default function HomeScreen() {
  const router = useRouter()
  const { theme } = useUnistyles()
  const { t, i18n } = useTranslation()
  const { data: trips, isLoading, isError, isRefetching, refetch } = useTrips()
  const { data: profile } = useProfile()
  const { data: unreadCount, refetch: refetchUnread } = useUnreadNotificationCount()
  const [nowMs] = useState(() => Date.now())

  // The app has no realtime, so the unread badge stays current by refetching on focus.
  useFocusEffect(
    useCallback(() => {
      void refetchUnread()
    }, [refetchUnread]),
  )

  const now = useMemo(() => new Date(nowMs), [nowMs])
  const home = useMemo(() => selectHomeTrips(trips ?? [], now), [trips, now])

  const firstName = profile?.display_name?.trim()?.split(' ')[0] || t('home.greetingFallback')
  const tripCount = trips?.length ?? 0
  const liveCount = (home.next ? 1 : 0) + home.upcoming.length
  const tripCountLabel =
    tripCount === 1
      ? t('home.tripCountOne', { count: tripCount })
      : t('home.tripCountOther', { count: tripCount })
  const subtitle = `${tripCountLabel}, ${t('home.upcomingCount', { count: liveCount })}`

  const next = home.next
  const upcoming = home.upcoming.slice(0, MAX_UPCOMING)

  // Single full-width column of rows, shared by the upcoming section and the past-only fallback.
  const tripRows = (items: typeof upcoming) => (
    <View style={styles.list}>
      {items.map((trip, i) => (
        <Animated.View
          key={trip.id}
          entering={FadeInDown.delay(Math.min(i, 8) * 50 + 120).duration(360)}
        >
          <UpcomingTripRow
            trip={trip}
            now={now}
            onPress={() => router.push({ pathname: '/trips/[id]', params: { id: trip.id } })}
          />
        </Animated.View>
      ))}
    </View>
  )

  return (
    <View style={styles.container}>
      <HomeHeader
        greeting={t('home.greeting', { name: firstName })}
        subtitle={subtitle}
        avatarName={profile?.display_name ?? undefined}
        avatarUrl={profile?.avatar_url}
        onAvatarPress={() => router.push('/profile')}
        unreadCount={unreadCount ?? 0}
        onNotificationsPress={tripCount === 0 ? undefined : () => router.push('/notifications')}
        notificationsLabel={t('notifications.title')}
      />

      {isLoading ? (
        <HomeSkeleton />
      ) : isError ? (
        <View style={styles.stateWrap}>
          <EmptyState
            icon="cloud-offline-outline"
            title={t('trips.errorTitle')}
            body={t('trips.error')}
            cta={t('common.retry')}
            onCta={() => void refetch()}
          />
        </View>
      ) : tripCount === 0 ? (
        <View style={styles.stateWrap}>
          <EmptyState
            icon="airplane-outline"
            title={t('trips.empty.title')}
            body={t('trips.empty.body')}
            cta={t('trips.create')}
            onCta={() => router.push('/trips/new')}
            secondaryCta={t('trips.join')}
            onSecondaryCta={() => router.push('/trips/join')}
          />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => void refetch()}
              tintColor={theme.colors.primary}
            />
          }
        >
          <Animated.View entering={FadeInDown.duration(360)}>
            {next ? (
              tripTimeline(next, now) === 'in_progress' ? (
                <LiveTripCard
                  trip={next}
                  now={now}
                  onPress={() => router.push({ pathname: '/trips/[id]', params: { id: next.id } })}
                />
              ) : (
                <NextDepartureCard
                  trip={next}
                  days={next.start_date ? daysUntil(next.start_date, now) : 0}
                  inProgress={false}
                  departureLabel={formatDay(next.start_date, i18n.language)}
                  onPress={() => router.push({ pathname: '/trips/[id]', params: { id: next.id } })}
                />
              )
            ) : (
              <NoUpcomingCard
                onCreate={() => router.push('/trips/new')}
                onJoin={() => router.push('/trips/join')}
              />
            )}
          </Animated.View>

          {upcoming.length > 0 ? (
            <Animated.View entering={FadeInDown.delay(60).duration(360)} style={styles.section}>
              <SectionTitle action={t('home.seeAll')} onAction={() => router.push('/trips')}>
                {t('home.sectionUpcoming')}
              </SectionTitle>
              {tripRows(upcoming)}
            </Animated.View>
          ) : home.past.length > 0 ? (
            <Animated.View entering={FadeInDown.delay(60).duration(360)} style={styles.section}>
              <SectionTitle action={t('home.seeAll')} onAction={() => router.push('/trips')}>
                {t('trips.title')}
              </SectionTitle>
              {tripRows(home.past.slice(0, MAX_UPCOMING))}
            </Animated.View>
          ) : null}
        </ScrollView>
      )}
    </View>
  )
}

// Loading placeholder shaped like the home content: a hero card then a column of row cards.
function HomeSkeleton() {
  const { theme } = useUnistyles()
  return (
    <View style={styles.skeleton}>
      <Skeleton width="100%" height={304} radius={theme.radius.xl} />
      <View style={styles.skeletonHeader}>
        <Skeleton width={140} height={20} radius={theme.radius.sm} />
        <Skeleton width={56} height={16} radius={theme.radius.sm} />
      </View>
      <Skeleton width="100%" height={70} radius={theme.radius.lg} />
      <Skeleton width="100%" height={70} radius={theme.radius.lg} />
      <Skeleton width="100%" height={70} radius={theme.radius.lg} />
    </View>
  )
}

// Hero fallback when no trip is upcoming or in progress: the shared EmptyState in a card frame,
// so it matches the 0-trip empty state (same branded icon badge + create/join CTA treatment).
function NoUpcomingCard({ onCreate, onJoin }: { onCreate: () => void; onJoin: () => void }) {
  const { t } = useTranslation()
  const { theme } = useUnistyles()
  return (
    <Surface radius={theme.radius.xl} style={styles.hero}>
      <EmptyState
        icon="airplane-outline"
        title={t('home.noUpcomingTitle')}
        body={t('home.noUpcomingBody')}
        cta={t('trips.create')}
        onCta={onCreate}
        secondaryCta={t('trips.join')}
        onSecondaryCta={onJoin}
      />
    </Surface>
  )
}

const styles = StyleSheet.create((theme, rt) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  skeleton: {
    paddingHorizontal: theme.gap(6),
    paddingTop: theme.gap(2),
    gap: theme.gap(4),
  },
  skeletonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stateWrap: {
    flex: 1,
    paddingHorizontal: theme.gap(6),
  },
  scroll: {
    paddingHorizontal: theme.gap(6),
    paddingTop: theme.gap(2),
    paddingBottom: rt.insets.bottom + APP_TAB_BAR_CLEARANCE,
    gap: theme.gap(4),
  },
  section: {
    gap: theme.gap(3),
  },
  list: {
    gap: theme.gap(2.5),
  },
  // Card frame for the no-upcoming hero; EmptyState supplies the horizontal padding + content.
  hero: {
    paddingVertical: theme.gap(6),
  },
}))
