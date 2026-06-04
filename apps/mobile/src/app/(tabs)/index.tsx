import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshControl, ScrollView, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { FLOATING_TAB_BAR_CLEARANCE } from '@/components/layout/floating-tab-bar'
import { EmptyState, SectionTitle, Spinner, Surface } from '@/components/ui'
import { useProfile } from '@/features/profile'
import {
  daysUntil,
  formatDay,
  selectHomeTrips,
  statusTone,
  type TripCard,
  tripTimeline,
  useTrips,
} from '@/features/trips'
import { HomeHeader } from '@/features/trips/components/home-header'
import { NextDepartureCard } from '@/features/trips/components/next-departure-card'
import { UpcomingTripCard } from '@/features/trips/components/upcoming-trip-card'

const MAX_UPCOMING = 4

// Groups the upcoming trips into rows of two for the grid.
function chunkPairs(items: TripCard[]): TripCard[][] {
  const pairs: TripCard[][] = []
  for (let i = 0; i < items.length; i += 2) {
    pairs.push(items.slice(i, i + 2))
  }
  return pairs
}

export default function HomeScreen() {
  const router = useRouter()
  const { theme } = useUnistyles()
  const { t, i18n } = useTranslation()
  const { data: trips, isLoading, isError, isRefetching, refetch } = useTrips()
  const { data: profile } = useProfile()
  const [nowMs] = useState(() => Date.now())

  const now = useMemo(() => new Date(nowMs), [nowMs])
  const home = useMemo(() => selectHomeTrips(trips ?? [], now), [trips, now])

  const firstName = profile?.display_name?.trim()?.split(' ')[0] || t('home.greetingFallback')
  const tripCount = trips?.length ?? 0
  const liveCount = (home.next ? 1 : 0) + home.upcoming.length
  const tripCountLabel =
    tripCount === 1
      ? t('home.tripCountOne', { count: tripCount })
      : t('home.tripCountOther', { count: tripCount })
  const subtitle = `${tripCountLabel} · ${t('home.upcomingCount', { count: liveCount })}`

  const next = home.next
  const upcoming = home.upcoming.slice(0, MAX_UPCOMING)

  return (
    <View style={styles.container}>
      <HomeHeader
        greeting={t('home.greeting', { name: firstName })}
        subtitle={subtitle}
        avatarName={profile?.display_name ?? undefined}
        avatarUrl={profile?.avatar_url}
        onAvatarPress={() => router.push('/profile')}
      />

      {isLoading ? (
        <View style={styles.center}>
          <Spinner label={t('common.loading')} />
        </View>
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
          {next ? (
            <NextDepartureCard
              trip={next}
              days={next.start_date ? daysUntil(next.start_date, now) : 0}
              inProgress={tripTimeline(next, now) === 'in_progress'}
              departureLabel={formatDay(next.start_date, i18n.language)}
              onPress={() => router.push({ pathname: '/trips/[id]', params: { id: next.id } })}
            />
          ) : (
            <NoUpcomingCard onCreate={() => router.push('/trips/new')} />
          )}

          {upcoming.length > 0 ? (
            <View style={styles.section}>
              <SectionTitle action={t('home.seeAll')} onAction={() => router.push('/trips')}>
                {t('home.sectionUpcoming')}
              </SectionTitle>
              <View style={styles.grid}>
                {chunkPairs(upcoming).map((pair) => (
                  <View key={pair.map((trip) => trip.id).join('-')} style={styles.row}>
                    {pair.map((trip) => (
                      <UpcomingTripCard
                        key={trip.id}
                        trip={trip}
                        tone={statusTone(trip, now)}
                        onPress={() =>
                          router.push({ pathname: '/trips/[id]', params: { id: trip.id } })
                        }
                      />
                    ))}
                    {pair.length === 1 ? <View style={styles.spacer} /> : null}
                  </View>
                ))}
              </View>
            </View>
          ) : home.past.length > 0 ? (
            <SectionTitle action={t('home.seeAll')} onAction={() => router.push('/trips')}>
              {t('trips.title')}
            </SectionTitle>
          ) : null}
        </ScrollView>
      )}
    </View>
  )
}

// Hero fallback when no trip is upcoming or in progress.
function NoUpcomingCard({ onCreate }: { onCreate: () => void }) {
  const { t } = useTranslation()
  const { theme } = useUnistyles()
  return (
    <Surface radius={theme.radius.xl} style={styles.cta}>
      <Ionicons name="airplane-outline" size={34} color={theme.colors.primary} />
      <Text style={styles.ctaTitle}>{t('home.noUpcomingTitle')}</Text>
      <Text style={styles.ctaBody}>{t('home.noUpcomingBody')}</Text>
      <Button label={t('trips.create')} icon="add" onPress={onCreate} />
    </Surface>
  )
}

const styles = StyleSheet.create((theme, rt) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateWrap: {
    flex: 1,
    paddingHorizontal: theme.gap(6),
  },
  scroll: {
    paddingHorizontal: theme.gap(6),
    paddingTop: theme.gap(2),
    paddingBottom: rt.insets.bottom + FLOATING_TAB_BAR_CLEARANCE,
    gap: theme.gap(4),
  },
  section: {
    gap: theme.gap(3),
  },
  grid: {
    gap: theme.gap(3),
  },
  row: {
    flexDirection: 'row',
    gap: theme.gap(3),
  },
  spacer: {
    flex: 1,
  },
  cta: {
    alignItems: 'center',
    gap: theme.gap(2),
    paddingVertical: theme.gap(7),
    paddingHorizontal: theme.gap(5),
  },
  ctaTitle: {
    fontFamily: theme.fonts.display.bold,
    fontWeight: '700',
    fontSize: theme.fontSize.lg,
    color: theme.colors.foreground,
  },
  ctaBody: {
    textAlign: 'center',
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
    marginBottom: theme.gap(1),
  },
}))
