import { Ionicons } from '@expo/vector-icons'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import * as ImagePicker from 'expo-image-picker'
import { LinearGradient } from 'expo-linear-gradient'
import { useGlobalSearchParams, useRouter } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { ScreenCornerRadius } from 'react-native-screen-corner-radius'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { TRIP_TAB_BAR_CLEARANCE } from '@/components/layout/trip-tab-bar'
import { Screen } from '@/components/screen'
import { AvatarStack, BottomSheet, CityImage, ErrorState, Skeleton } from '@/components/ui'
import { useAuth } from '@/features/auth'
import { useTripBalances } from '@/features/expenses'
import { useLeaveTrip, useRegenerateInviteCode, useTripMembers } from '@/features/group'
import { ActivitiesRail } from '@/features/places'
import { eventStatus, useEvents } from '@/features/timeline'
import {
  formatTripDates,
  useDeleteTrip,
  useResetTripCover,
  useTrip,
  useUploadTripCover,
} from '@/features/trips'
import { CockpitTimeline } from '@/features/trips/components/cockpit-timeline'
import { RightNowCard } from '@/features/trips/components/right-now-card'
import { TripBalanceStrip } from '@/features/trips/components/trip-balance-strip'
import { conditionIcon, useTripWeather } from '@/features/weather'
import { haptics } from '@/lib/haptics'
import { paramString } from '@/lib/routing'

// Staggered entrance for the content blocks below the cover. Short step, capped so the
// last block never lags; the cover hero stays static (its corner-radius logic is untouched).
// Only the loaded content runs this stagger (the skeleton placeholder stays still), so the
// skeleton -> content swap plays the entrance exactly once instead of replaying it.
const ENTER_STEP = 50
const enter = (index: number) => FadeInDown.duration(320).delay(index * ENTER_STEP)

// Warm-ink scrim over the cover: a light top veil keeps the dark nav buttons legible, the
// middle stays clear, and a strong bottom fade carries the cream title + meta pills.
const COVER_FADE_COLORS = [
  'rgba(20, 17, 12, 0.28)',
  'rgba(20, 17, 12, 0)',
  'rgba(20, 17, 12, 0.86)',
] as const
const COVER_FADE_LOCATIONS = [0, 0.3, 1] as const

function CoverButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={() => {
        haptics.light()
        onPress()
      }}
      style={({ pressed }) => [styles.coverButton, pressed && styles.coverButtonPressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
    >
      <Ionicons name={icon} size={18} color="#FFFFFF" />
    </Pressable>
  )
}

// A pill in the cover meta row: a translucent rounded chip with an icon and a short label.
function MetaPill({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.metaPill}>
      <Ionicons name={icon} size={13} color="#FFFFFF" />
      <Text style={styles.metaPillText} numberOfLines={1}>
        {label}
      </Text>
    </View>
  )
}

// A row in the trip-actions sheet (opened from the cover ellipsis).
function TripActionRow({
  icon,
  label,
  tone = 'default',
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  tone?: 'default' | 'destructive'
  onPress: () => void
}) {
  const { theme } = useUnistyles()
  const color = tone === 'destructive' ? theme.colors.destructive : theme.colors.foreground
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.actionRow, pressed && styles.actionRowPressed]}
    >
      <Ionicons name={icon} size={20} color={color} />
      <Text style={[styles.actionLabel, { color }]}>{label}</Text>
    </Pressable>
  )
}

export default function TripDashboardScreen() {
  const params = useGlobalSearchParams<{ id: string }>()
  const tripId = paramString(params.id)
  const router = useRouter()
  const { theme } = useUnistyles()
  const { t, i18n } = useTranslation()
  const { session } = useAuth()
  const userId = session?.user.id

  const { data: trip, isLoading, isError, refetch: refetchTrip } = useTrip(tripId)
  const { data: balances, refetch: refetchBalances } = useTripBalances(tripId)
  const { data: members } = useTripMembers(tripId)
  const { data: events, refetch: refetchEvents } = useEvents(tripId)
  const { data: weather, refetch: refetchWeather } = useTripWeather(trip)
  // Snapshot once on mount; the countdown badge does not need to tick on this screen.
  const [now] = useState(() => Date.now())
  const [refreshing, setRefreshing] = useState(false)

  // Pull-to-refresh refetches every query feeding the dashboard (trip, events, balances, weather).
  const onRefresh = useCallback(async () => {
    haptics.light()
    setRefreshing(true)
    try {
      await Promise.all([refetchTrip(), refetchEvents(), refetchBalances(), refetchWeather()])
    } finally {
      setRefreshing(false)
    }
  }, [refetchTrip, refetchEvents, refetchBalances, refetchWeather])

  const [actionsOpen, setActionsOpen] = useState(false)
  const regenerate = useRegenerateInviteCode(tripId)
  const deleteTripMutation = useDeleteTrip()
  const leaveTripMutation = useLeaveTrip()
  const uploadCover = useUploadTripCover()
  const resetCover = useResetTripCover()

  const avatarMembers = useMemo(
    () =>
      (members ?? []).map((member) => ({
        id: member.id,
        name: member.display_name ?? undefined,
        imageUrl: member.avatar_url,
      })),
    [members],
  )

  // The event currently running (drives the "right now" card), and the next few upcoming
  // events for the rail. listEvents returns rows ordered by starts_at asc.
  const inProgressEvent = useMemo(
    () =>
      (events ?? []).find(
        (event) => eventStatus(event.starts_at, event.ends_at, now).kind === 'in_progress',
      ),
    [events, now],
  )
  const upcomingEvents = useMemo(
    () =>
      (events ?? [])
        .filter((event) => eventStatus(event.starts_at, event.ends_at, now).kind === 'upcoming')
        .slice(0, 3),
    [events, now],
  )

  // Weather chip for the cover: today's forecast if present, else the first available day.
  const weatherDay = useMemo(() => {
    const days = weather?.days
    if (!days?.length) {
      return null
    }
    const today = new Date(now).toISOString().slice(0, 10)
    return days.find((day) => day.date === today) ?? days[0]
  }, [weather, now])

  const dates = useMemo(
    () => (trip ? formatTripDates(trip.start_date, trip.end_date, i18n.language) : null),
    [trip, i18n.language],
  )

  function goGroup() {
    router.push({ pathname: '/trips/[id]/group', params: { id: tripId } })
  }

  if (isLoading) {
    return <TripDashboardSkeleton />
  }

  if (isError || !trip) {
    return (
      <Screen title={t('trip.notFound')} showBack>
        <ErrorState
          icon="cloud-offline-outline"
          title={t('trip.notFound')}
          body={t('errors.body')}
          retryLabel={t('common.retry')}
          onRetry={() => void refetchTrip()}
        />
      </Screen>
    )
  }

  const currency = trip.currency
  const myBalance =
    (balances ?? []).find((balance) => balance.user_id === userId)?.balance_cents ?? 0

  const isOwner = trip.owner_id === userId

  // Pick a photo, downscale to a 1200px-wide JPEG, and upload it as the trip cover via the
  // owner-checked edge function (overriding the auto Google/Unsplash cover).
  async function pickCover(source: 'library' | 'camera') {
    if (uploadCover.isPending) {
      return
    }
    try {
      const permission =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!permission.granted) {
        Alert.alert(t('trip.coverPermissionTitle'), t('trip.coverPermissionBody'))
        return
      }
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({
              allowsEditing: true,
              aspect: [16, 9],
              quality: 0.6,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              allowsEditing: true,
              aspect: [16, 9],
              quality: 0.6,
            })
      if (result.canceled) {
        return
      }
      const rendered = await ImageManipulator.manipulate(result.assets[0].uri)
        .resize({ width: 1200 })
        .renderAsync()
      const image = await rendered.saveAsync({
        compress: 0.7,
        format: SaveFormat.JPEG,
        base64: true,
      })
      if (!image.base64) {
        throw new Error('Could not read the selected image.')
      }
      await uploadCover.mutateAsync({
        tripId,
        imageBase64: image.base64,
        contentType: 'image/jpeg',
      })
    } catch (error) {
      Alert.alert(
        t('trip.coverError'),
        error instanceof Error ? error.message : t('common.tryAgain'),
      )
    }
  }

  function changeCoverPhoto() {
    setActionsOpen(false)
    Alert.alert(t('trip.coverPhoto'), undefined, [
      { text: t('trip.coverCamera'), onPress: () => void pickCover('camera') },
      { text: t('trip.coverLibrary'), onPress: () => void pickCover('library') },
      { text: t('common.cancel'), style: 'cancel' },
    ])
  }

  async function revertToAutoCover() {
    if (resetCover.isPending) {
      return
    }
    setActionsOpen(false)
    try {
      await resetCover.mutateAsync(tripId)
    } catch (error) {
      Alert.alert(
        t('trip.coverError'),
        error instanceof Error ? error.message : t('common.tryAgain'),
      )
    }
  }

  function confirmRegenerate() {
    Alert.alert(
      'Régénérer le code d’invitation',
      'Le code actuel cessera de fonctionner. Les personnes déjà inscrites conservent leur accès.',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('group.regenerate'),
          style: 'destructive',
          onPress: async () => {
            try {
              await regenerate.mutateAsync()
            } catch (error) {
              Alert.alert(
                'Régénération impossible',
                error instanceof Error ? error.message : t('common.tryAgain'),
              )
            }
          },
        },
      ],
    )
  }

  function confirmDelete() {
    Alert.alert(
      t('group.deleteTrip'),
      'Cette action supprime définitivement le voyage et toutes ses données.',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTripMutation.mutateAsync(tripId)
              router.replace('/')
            } catch (error) {
              Alert.alert(
                'Suppression impossible',
                error instanceof Error ? error.message : t('common.tryAgain'),
              )
            }
          },
        },
      ],
    )
  }

  function confirmLeave() {
    Alert.alert(
      t('group.leaveTrip'),
      'Tu ne verras plus ce voyage ni ses dépenses. Les dépenses passées que tu as payées ou que tu dois restent comptabilisées.',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: 'Quitter',
          style: 'destructive',
          onPress: async () => {
            try {
              await leaveTripMutation.mutateAsync(tripId)
              router.replace('/')
            } catch (error) {
              Alert.alert(
                'Impossible de quitter',
                error instanceof Error ? error.message : t('common.tryAgain'),
              )
            }
          },
        },
      ],
    )
  }

  // Full-bleed cover: its corners trace the device's screen radius exactly (no inset to
  // subtract). Falls back to the xl token when the radius is undetectable.
  const coverRadius = ScreenCornerRadius > 0 ? ScreenCornerRadius : theme.radius.xl

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={theme.colors.primary}
          />
        }
      >
        {/* Inset cover hero */}
        <View>
          <CityImage
            uri={trip.cover_photo_url}
            seed={trip.destination ?? trip.title}
            height={284}
            radius={coverRadius}
            corners="all"
            scrim={false}
          >
            <LinearGradient
              colors={COVER_FADE_COLORS}
              locations={COVER_FADE_LOCATIONS}
              style={styles.fade}
              pointerEvents="none"
            />
            <View style={styles.coverTop}>
              <CoverButton
                icon="chevron-back"
                label={t('common.back')}
                onPress={() => router.back()}
              />
              <CoverButton
                icon="ellipsis-horizontal"
                label={t('trip.settings')}
                onPress={() => setActionsOpen(true)}
              />
            </View>
            <View style={styles.coverBottom}>
              <View style={styles.coverInfo}>
                <Text style={styles.coverTitle} numberOfLines={2}>
                  {trip.title}
                </Text>
                <View style={styles.metaRow}>
                  {trip.destination ? <MetaPill icon="location" label={trip.destination} /> : null}
                  {dates ? <MetaPill icon="calendar-outline" label={dates} /> : null}
                  {weatherDay ? (
                    <MetaPill
                      icon={conditionIcon(weatherDay.condition) as keyof typeof Ionicons.glyphMap}
                      label={`${Math.round(weatherDay.tempMaxC)}°`}
                    />
                  ) : null}
                </View>
              </View>
              {avatarMembers.length > 0 ? (
                <Pressable
                  onPress={() => {
                    haptics.light()
                    goGroup()
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t('trip.members')}
                  hitSlop={6}
                >
                  <AvatarStack members={avatarMembers} size={32} />
                </Pressable>
              ) : null}
            </View>
          </CityImage>
        </View>

        <View style={styles.content}>
          <Animated.View entering={enter(0)}>
            <TripBalanceStrip cents={myBalance} currency={currency} onPress={goGroup} />
          </Animated.View>

          {inProgressEvent ? (
            <Animated.View entering={enter(1)}>
              <RightNowCard event={inProgressEvent} now={now} />
            </Animated.View>
          ) : null}

          <Animated.View entering={enter(2)}>
            <CockpitTimeline
              events={upcomingEvents}
              now={now}
              onPressEvent={(eventId) =>
                router.push({
                  pathname: '/trips/[id]/events/[eventId]',
                  params: { id: tripId, eventId },
                })
              }
            />
          </Animated.View>

          <Animated.View entering={enter(3)}>
            <ActivitiesRail trip={trip} />
          </Animated.View>
        </View>
      </ScrollView>

      <Pressable
        onPress={() => {
          haptics.light()
          router.push({ pathname: '/trips/[id]/copilot', params: { id: tripId } })
        }}
        accessibilityRole="button"
        accessibilityLabel={t('trip.copilot')}
        style={({ pressed }) => [styles.zoFab, pressed && styles.zoFabPressed]}
      >
        <Ionicons name="sparkles" size={24} color={theme.colors.primaryForeground} />
      </Pressable>

      <BottomSheet
        open={actionsOpen}
        onClose={() => setActionsOpen(false)}
        title={t('trip.manage')}
      >
        <View style={styles.sheetActions}>
          {isOwner ? (
            <>
              <TripActionRow
                icon="create-outline"
                label={t('trip.editTrip')}
                onPress={() => {
                  setActionsOpen(false)
                  router.push({ pathname: '/trips/[id]/edit', params: { id: tripId } })
                }}
              />
              <TripActionRow
                icon="image-outline"
                label={t('trip.changeCover')}
                onPress={changeCoverPhoto}
              />
              <TripActionRow
                icon="sparkles-outline"
                label={t('trip.autoCoverPhoto')}
                onPress={() => void revertToAutoCover()}
              />
              <TripActionRow
                icon="refresh-outline"
                label={t('trip.regenerateCode')}
                onPress={() => {
                  setActionsOpen(false)
                  confirmRegenerate()
                }}
              />
              <TripActionRow
                icon="trash-outline"
                label={t('group.deleteTrip')}
                tone="destructive"
                onPress={() => {
                  setActionsOpen(false)
                  confirmDelete()
                }}
              />
            </>
          ) : (
            <TripActionRow
              icon="exit-outline"
              label={t('group.leaveTrip')}
              tone="destructive"
              onPress={() => {
                setActionsOpen(false)
                confirmLeave()
              }}
            />
          )}
        </View>
      </BottomSheet>
    </View>
  )
}

// Loading placeholder shaped like the new cockpit: a full-bleed cover block, then the balance
// strip, the right-now card and a couple of rail rows. It stays static (only the real content
// runs the staggered entrance), so the skeleton -> content swap plays the stagger exactly once.
function TripDashboardSkeleton() {
  const { theme } = useUnistyles()
  // Match the real cover's device-corner radius so the skeleton -> hero swap doesn't shift the
  // corner shape (falls back to the xl token when the radius is undetectable).
  const coverRadius = ScreenCornerRadius > 0 ? ScreenCornerRadius : theme.radius.xl
  return (
    <View style={styles.container}>
      <View style={styles.skeletonCover}>
        <Skeleton width="100%" height={284} radius={coverRadius} />
      </View>
      <View style={styles.content}>
        <Skeleton width="100%" height={64} radius={theme.radius.lg} />
        <Skeleton width="100%" height={96} radius={theme.radius.lg} />
        <View style={styles.skeletonSection}>
          <Skeleton width="100%" height={72} radius={theme.radius.md} />
          <Skeleton width="100%" height={40} radius={theme.radius.md} />
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create((theme, rt) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  sheetActions: {
    gap: theme.gap(1),
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(3),
    paddingVertical: theme.gap(3),
  },
  actionRowPressed: {
    opacity: 0.6,
  },
  actionLabel: {
    fontFamily: theme.fonts.sans.medium,
    fontWeight: '500',
    fontSize: theme.fontSize.md,
  },
  scroll: {
    paddingBottom: rt.insets.bottom + TRIP_TAB_BAR_CLEARANCE,
  },
  zoFab: {
    position: 'absolute',
    right: theme.gap(6),
    bottom: rt.insets.bottom + 96,
    width: 52,
    height: 52,
    borderRadius: 18,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  zoFabPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.96 }],
  },
  fade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  coverTop: {
    position: 'absolute',
    top: rt.insets.top + theme.gap(2),
    left: theme.gap(6),
    right: theme.gap(6),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  coverButton: {
    width: 38,
    height: 38,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20, 17, 12, 0.4)',
  },
  coverButtonPressed: {
    opacity: 0.8,
  },
  coverBottom: {
    position: 'absolute',
    left: theme.gap(6),
    right: theme.gap(6),
    bottom: theme.gap(6),
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: theme.gap(2.5),
  },
  coverInfo: {
    flexShrink: 1,
    gap: theme.gap(2),
  },
  coverTitle: {
    fontFamily: theme.fonts.display.bold,
    fontWeight: '700',
    fontSize: 30,
    color: '#FFFFFF',
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 10,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.gap(1.5),
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(1),
    paddingVertical: theme.gap(1),
    paddingHorizontal: theme.gap(2),
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  metaPillText: {
    flexShrink: 1,
    fontFamily: theme.fonts.sans.medium,
    fontWeight: '500',
    fontSize: theme.fontSize.xs,
    color: '#FFFFFF',
  },
  content: {
    paddingHorizontal: theme.gap(6),
    paddingTop: theme.gap(4),
    gap: theme.gap(4),
  },
  skeletonCover: {
    paddingTop: rt.insets.top,
  },
  skeletonSection: {
    gap: theme.gap(2.5),
  },
}))
