import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useTranslation } from 'react-i18next'
import { Pressable, Text, View } from 'react-native'
import { StyleSheet, useUnistyles } from 'react-native-unistyles'

import { AvatarStack, CityImage } from '@/components/ui'
import { PHOTO_CREAM, PHOTO_CREAM_MUTED } from '@/lib/color'
import { haptics } from '@/lib/haptics'

import type { TripCard } from '../api/trips.api'
import { BalancePill } from './balance-pill'

// Dark at the top (for the tag + countdown), clear in the middle, dark at the bottom (for
// the title, members and balance) - a single vertical fade over the cover photo.
const HERO_FADE_COLORS = [
  'rgba(20, 17, 12, 0.5)',
  'rgba(20, 17, 12, 0)',
  'rgba(20, 17, 12, 0)',
  'rgba(20, 17, 12, 0.85)',
] as const
const HERO_FADE_LOCATIONS = [0, 0.28, 0.5, 1] as const

type NextDepartureCardProps = {
  trip: TripCard
  days: number
  inProgress: boolean
  // e.g. "14 juin"; null when the trip has no start date.
  departureLabel: string | null
  onPress: () => void
}

// The home hero: the soonest/in-progress trip, full-bleed cover with a "next departure" tag,
// a J-{days} countdown, title + location, member avatars and the balance pill.
export function NextDepartureCard({
  trip,
  days,
  inProgress,
  departureLabel,
  onPress,
}: NextDepartureCardProps) {
  const { t } = useTranslation()
  const { theme } = useUnistyles()

  const countdown = inProgress
    ? t('home.inProgress')
    : days === 0
      ? t('home.today')
      : t('home.countdownDay', { days })

  const members = trip.members.map((member) => ({
    id: member.id,
    name: member.display_name ?? undefined,
    imageUrl: member.avatar_url,
  }))

  // Reuse visible text so the label stays in sync with the locale: title, countdown and (when
  // set) the destination, e.g. "Summer in Paris, D-5, Paris".
  const accessibilityLabel = [trip.title, countdown, trip.destination ?? undefined]
    .filter(Boolean)
    .join(', ')

  const handlePress = () => {
    haptics.light()
    onPress()
  }

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => (pressed ? styles.pressed : undefined)}
    >
      <CityImage
        uri={trip.cover_photo_url}
        seed={trip.destination ?? trip.title}
        height={232}
        radius={theme.radius.xl}
        corners="all"
        scrim={false}
      >
        <LinearGradient
          colors={HERO_FADE_COLORS}
          locations={HERO_FADE_LOCATIONS}
          style={styles.fade}
          pointerEvents="none"
        />

        <View style={styles.topRow}>
          <View style={styles.tag}>
            <Ionicons name="airplane" size={13} color={PHOTO_CREAM} />
            <Text style={styles.tagText}>{t('home.nextDeparture')}</Text>
          </View>
          <View style={styles.countdownCol}>
            <Text style={styles.countdown}>{countdown}</Text>
            {departureLabel && !inProgress ? (
              <Text style={styles.departureDate}>{departureLabel}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.bottom}>
          <Text style={styles.title} numberOfLines={1}>
            {trip.title}
          </Text>
          {trip.destination ? (
            <View style={styles.locationRow}>
              <Ionicons name="location" size={14} color={PHOTO_CREAM_MUTED} />
              <Text style={styles.location} numberOfLines={1}>
                {trip.destination}
              </Text>
            </View>
          ) : null}
          <View style={styles.bottomRow}>
            {members.length > 0 ? <AvatarStack members={members} size={30} /> : <View />}
            <BalancePill cents={trip.myBalanceCents} currency={trip.currency} />
          </View>
        </View>
      </CityImage>
    </Pressable>
  )
}

const styles = StyleSheet.create((theme) => ({
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  fade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  topRow: {
    position: 'absolute',
    top: theme.gap(3.5),
    left: theme.gap(4),
    right: theme.gap(4),
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.gap(2),
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(1.5),
    paddingVertical: theme.gap(1.5),
    paddingHorizontal: theme.gap(2.5),
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  tagText: {
    color: PHOTO_CREAM,
    fontFamily: theme.fonts.sans.semibold,
    fontWeight: '600',
    fontSize: theme.fontSize.xs,
  },
  countdownCol: {
    alignItems: 'flex-end',
  },
  countdown: {
    color: PHOTO_CREAM,
    fontFamily: theme.fonts.display.bold,
    fontWeight: '700',
    fontSize: theme.fontSize.xl,
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  departureDate: {
    color: PHOTO_CREAM_MUTED,
    fontFamily: theme.fonts.sans.medium,
    fontSize: theme.fontSize.sm,
  },
  bottom: {
    position: 'absolute',
    left: theme.gap(4),
    right: theme.gap(4),
    bottom: theme.gap(4),
    gap: theme.gap(2),
  },
  title: {
    fontFamily: theme.fonts.display.bold,
    fontWeight: '700',
    fontSize: theme.fontSize.xxl,
    color: PHOTO_CREAM,
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 10,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.gap(1),
    marginTop: -theme.gap(1),
  },
  location: {
    flexShrink: 1,
    fontFamily: theme.fonts.sans.regular,
    fontSize: theme.fontSize.sm,
    color: PHOTO_CREAM_MUTED,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.gap(2),
    marginTop: theme.gap(1),
  },
}))
