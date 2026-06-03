import { Ionicons } from '@expo/vector-icons'
import { FlashList } from '@shopify/flash-list'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, RefreshControl, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { Button } from '@/components/button'
import { FLOATING_TAB_BAR_CLEARANCE } from '@/components/layout/floating-tab-bar'
import { Screen } from '@/components/screen'
import {
  AvatarStack,
  Badge,
  BottomSheet,
  CityImage,
  EmptyState,
  Spinner,
  Squircle,
} from '@/components/ui'
import { type TripCard, useTrips } from '@/features/trips'
import { formatAmount } from '@/lib/money'

// "14 - 16 juin" when both dates exist; null hides the date row (trips have no dates yet).
// Month names follow the app i18n language (not the device locale). When start and end
// share the same month and year, the month is shown once ("14 - 16 juin").
function formatTripDates(start: string | null, end: string | null, locale: string): string | null {
  if (!start) {
    return null
  }
  const startDate = new Date(start)
  const fullOpts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  if (!end || end === start) {
    return startDate.toLocaleDateString(locale, fullOpts)
  }
  const endDate = new Date(end)
  const sameMonth =
    startDate.getFullYear() === endDate.getFullYear() && startDate.getMonth() === endDate.getMonth()
  const startLabel = startDate.toLocaleDateString(locale, sameMonth ? { day: 'numeric' } : fullOpts)
  return `${startLabel} - ${endDate.toLocaleDateString(locale, fullOpts)}`
}

export default function TripsScreen() {
  const router = useRouter()
  const { theme } = useUnistyles()
  const { t } = useTranslation()
  const { data: trips, isLoading, isError, isRefetching, refetch } = useTrips()
  const [addOpen, setAddOpen] = useState(false)

  return (
    <Screen
      title={t('trips.title')}
      showBack={false}
      right={
        <Pressable
          onPress={() => setAddOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={t('trips.add')}
          hitSlop={8}
        >
          <Ionicons name="add" size={28} color={theme.colors.primary} />
        </Pressable>
      }
    >
      {isLoading ? (
        <View style={styles.center}>
          <Spinner label={t('common.loading')} />
        </View>
      ) : isError ? (
        <EmptyState
          icon="cloud-offline-outline"
          title={t('trips.errorTitle')}
          body={t('trips.error')}
          cta={t('common.retry')}
          onCta={() => void refetch()}
        />
      ) : !trips || trips.length === 0 ? (
        <EmptyState
          icon="airplane-outline"
          title={t('trips.empty.title')}
          body={t('trips.empty.body')}
          cta={t('trips.create')}
          onCta={() => router.push('/trips/new')}
        />
      ) : (
        <View style={styles.listWrap}>
          <FlashList
            data={trips}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={() => void refetch()}
                tintColor={theme.colors.primary}
              />
            }
            renderItem={({ item }) => (
              <TripListCard
                trip={item}
                onPress={() => router.push({ pathname: '/trips/[id]', params: { id: item.id } })}
              />
            )}
          />
        </View>
      )}

      <BottomSheet open={addOpen} onClose={() => setAddOpen(false)} title={t('trips.add')}>
        <View style={styles.sheetActions}>
          <Button
            label={t('trips.create')}
            icon="add"
            onPress={() => {
              setAddOpen(false)
              router.push('/trips/new')
            }}
          />
          <Button
            label={t('trips.join')}
            variant="secondary"
            icon="enter-outline"
            onPress={() => {
              setAddOpen(false)
              router.push('/trips/join')
            }}
          />
        </View>
      </BottomSheet>
    </Screen>
  )
}

function TripListCard({ trip, onPress }: { trip: TripCard; onPress: () => void }) {
  const { theme } = useUnistyles()
  const { t, i18n } = useTranslation()

  const balance = trip.myBalanceCents
  const tone = balance > 0 ? 'success' : balance < 0 ? 'destructive' : 'muted'
  const balanceLabel =
    balance > 0
      ? t('trips.owed', { amount: formatAmount(balance, trip.currency) })
      : balance < 0
        ? t('trips.owe', { amount: formatAmount(Math.abs(balance), trip.currency) })
        : t('trips.settled')

  const dates = formatTripDates(trip.start_date, trip.end_date, i18n.language)
  const members = trip.members.map((member) => ({
    id: member.id,
    name: member.display_name ?? undefined,
  }))

  return (
    <Pressable
      style={({ pressed }) => [styles.cardWrap, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={trip.title}
    >
      <Squircle radius={theme.radius.lg} borderWidth={0} style={styles.card}>
        <CityImage
          uri={trip.cover_photo_url}
          seed={trip.destination ?? trip.title}
          height={126}
          corners="top"
        >
          <View pointerEvents="none" style={styles.coverScrim} />
          <View style={styles.coverOverlay}>
            <View style={styles.coverText}>
              <Text style={styles.title} numberOfLines={1}>
                {trip.title}
              </Text>
              {trip.destination ? (
                <View style={styles.destinationRow}>
                  <Ionicons name="location" size={13} color="rgba(255,255,255,0.92)" />
                  <Text style={styles.destination} numberOfLines={1}>
                    {trip.destination}
                  </Text>
                </View>
              ) : null}
            </View>
            {members.length > 0 ? <AvatarStack members={members} size={28} /> : null}
          </View>
        </CityImage>

        <View style={styles.footer}>
          {dates ? (
            <View style={styles.datesRow}>
              <Ionicons name="calendar-outline" size={14} color={theme.colors.muted} />
              <Text style={styles.dates}>{dates}</Text>
            </View>
          ) : (
            <View />
          )}
          <Badge label={balanceLabel} tone={tone} />
        </View>
      </Squircle>
    </Pressable>
  )
}

const styles = StyleSheet.create((theme, rt) => ({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listWrap: {
    flex: 1,
  },
  list: {
    paddingVertical: theme.gap(3),
    paddingBottom: rt.insets.bottom + FLOATING_TAB_BAR_CLEARANCE,
  },
  cardWrap: {
    marginBottom: theme.gap(3.5),
  },
  card: {
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.85,
  },
  // Dark band behind the white cover text so contrast holds even over the bright
  // fallback tint (the CityImage gradient scrim only covers loaded photos).
  coverScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '55%',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  coverOverlay: {
    position: 'absolute',
    left: theme.gap(3.5),
    right: theme.gap(3.5),
    bottom: theme.gap(3),
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: theme.gap(2.5),
  },
  coverText: {
    flexShrink: 1,
  },
  title: {
    fontFamily: theme.fonts.display.bold,
    fontWeight: '700',
    fontSize: theme.fontSize.lg,
    color: '#FFFFFF',
    letterSpacing: -0.2,
    textShadowColor: 'rgba(0, 0, 0, 0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  destinationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(1),
    marginTop: 2,
  },
  destination: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.sm,
    color: 'rgba(255, 255, 255, 0.92)',
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.gap(2.5),
    paddingVertical: theme.gap(3),
    paddingHorizontal: theme.gap(3.5),
  },
  datesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(1),
  },
  dates: {
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.sm,
    color: theme.colors.muted,
  },
  sheetActions: {
    gap: theme.gap(2),
  },
}))
